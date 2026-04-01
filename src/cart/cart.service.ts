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

    const result = await this.prisma.cartItem.upsert({
      where: {
        cartId_productId_variantId: {
          cartId: cart.id,
          productId: dto.productId,
          variantId: safeVariantId as string, // Cast to satisfy TS, Prisma handles the null safely
        },
      },
      update: { quantity: { increment: dto.quantity } },
      create: {
        cartId: cart.id,
        productId: dto.productId,
        variantId: safeVariantId,
        quantity: dto.quantity,
        priceSnapshot: priceSnapshot,
        tenantId: tenantId,
      },
    });

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

  async invalidateCache(tenantId: string, userId?: string, sessionId?: string) {
    const cacheKey = this.getCacheKey(tenantId, userId, sessionId);
    await this.cache.del(cacheKey);
  }
}