// src/cart/cart.service.ts
import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppCacheService } from '../common/cache/cache.service';
import { CartOwnerType, Prisma } from '@prisma/client';
import { InventoryService } from '../inventory/inventory.service';
import { AddToCartDto } from 'src/dto/cart.dto';

@Injectable()
export class CartService {
  private readonly logger = new Logger('CartService');

  constructor(
    private prisma: PrismaService,
    private cache: AppCacheService,
    private inventoryService: InventoryService,
  ) {}

  private getCacheKey(tenantId: string, userId?: string, sessionId?: string) {
    const identifier = userId ? `user:${userId}` : `guest:${sessionId}`;
    return `cart:${tenantId}:${identifier}`;
  }

  async getCart(tenantId: string, userId?: string, sessionId?: string) {
    const cacheKey = this.getCacheKey(tenantId, userId, sessionId);

    return await this.cache.getOrSet(
      cacheKey,
      async () => {
        const where: Prisma.CartWhereUniqueInput = userId
          ? { tenantId_userId: { tenantId, userId } }
          : { tenantId_sessionId: { tenantId, sessionId: sessionId! } };

        let cart = await this.prisma.cart.findUnique({
          where,
          include: { items: { include: { product: true, variant: true } } },
        });

        if (!cart) {
          cart = await this.prisma.cart.create({
            data: {
              tenantId,
              ownerType: userId ? CartOwnerType.USER : CartOwnerType.GUEST,
              userId,
              sessionId,
            },
            include: { items: { include: { product: true, variant: true } } },
          });
        }

        return cart;
      },
      3600,
    );
  }

  async addToCart(tenantId: string, userId: string | undefined, sessionId: string | undefined, dto: AddToCartDto) {
    const availableStock = await this.inventoryService.getAvailableStock(dto.productId, dto.variantId);
    if (availableStock < dto.quantity) {
      throw new BadRequestException(`Insufficient stock. Only ${availableStock} available.`);
    }

    const cart = await this.getCart(tenantId, userId, sessionId);

    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException('Product not found');
    
    let priceSnapshot = product.price;
    if (dto.variantId) {
      const variant = await this.prisma.productVariant.findUnique({ where: { id: dto.variantId } });
      if (!variant) throw new NotFoundException('Variant not found');
      priceSnapshot += variant.priceModifier;
    }

    // 🔥 FIX: Clean TypeScript null casting for Prisma unique inputs
    const safeVariantId = dto.variantId ? dto.variantId : null;

   // ADD THIS INSTEAD:
    const existingItem = await this.prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        productId: dto.productId,
        variantId: safeVariantId, // Prisma handles null safely in findFirst
      },
    });

    let result;
    if (existingItem) {
      result = await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: { increment: dto.quantity } },
      });
    } else {
      result = await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: dto.productId,
          variantId: safeVariantId,
          quantity: dto.quantity,
          priceSnapshot: priceSnapshot,
          tenantId: tenantId,
        },
      });
    }
    await this.invalidateCache(tenantId, userId, sessionId);
    return result;
  }

  async mergeGuestCart(tenantId: string, userId: string, sessionId: string) {
    const guestCart = await this.getCart(tenantId, undefined, sessionId);

    if (!guestCart || guestCart.items.length === 0) return;

    for (const item of guestCart.items) {
      await this.addToCart(tenantId, userId, undefined, {
        productId: item.productId,
        variantId: item.variantId || undefined,
        quantity: item.quantity,
      });
    }

    await this.prisma.cart.delete({ where: { id: guestCart.id } });
    await this.invalidateCache(tenantId, undefined, sessionId);
  }
async removeItem(tenantId: string, userId: string | undefined, sessionId: string | undefined, productId: string, variantId?: string) {
    const cart = await this.getCart(tenantId, userId, sessionId);
    const safeVariantId = variantId ? variantId : null;

    const existingItem = await this.prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        productId: productId,
        variantId: safeVariantId,
      },
    });

    if (!existingItem) {
      throw new NotFoundException('Item not found in cart');
    }

    await this.prisma.cartItem.delete({
      where: { id: existingItem.id },
    });

    await this.invalidateCache(tenantId, userId, sessionId);
    return { success: true, message: 'Item removed from cart' };
  }

  async clearCart(tenantId: string, userId: string | undefined, sessionId: string | undefined) {
    const cart = await this.getCart(tenantId, userId, sessionId);

    await this.prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    await this.invalidateCache(tenantId, userId, sessionId);
    return { success: true, message: 'Cart cleared' };
  }

  async updateQuantity(tenantId: string, userId: string | undefined, sessionId: string | undefined, productId: string, quantity: number, variantId?: string) {
    if (quantity <= 0) {
      // If quantity is 0 or less, just remove the item
      return this.removeItem(tenantId, userId, sessionId, productId, variantId);
    }

    const availableStock = await this.inventoryService.getAvailableStock(productId, variantId);
    if (availableStock < quantity) {
      throw new BadRequestException(`Insufficient stock. Only ${availableStock} available.`);
    }

    const cart = await this.getCart(tenantId, userId, sessionId);
    const safeVariantId = variantId ? variantId : null;

    const existingItem = await this.prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        productId: productId,
        variantId: safeVariantId,
      },
    });

    if (!existingItem) {
      throw new NotFoundException('Item not found in cart');
    }

    const result = await this.prisma.cartItem.update({
      where: { id: existingItem.id },
      data: { quantity },
    });

    await this.invalidateCache(tenantId, userId, sessionId);
    return result;
  }
  async invalidateCache(tenantId: string, userId?: string, sessionId?: string) {
    const cacheKey = this.getCacheKey(tenantId, userId, sessionId);
    await this.cache.del(cacheKey);
  }
}