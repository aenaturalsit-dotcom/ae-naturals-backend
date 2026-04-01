import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
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

  /**
   * Generates a unique cache key based on User ID or Guest Session ID
   */
  private getCacheKey(tenantId: string, userId?: string, sessionId?: string) {
    const identifier = userId ? `user:${userId}` : `guest:${sessionId}`;
    return `cart:${tenantId}:${identifier}`;
  }

  /**
   * Fetches the cart from cache/DB. 
   * If it doesn't exist in DB, it creates one immediately.
   */
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
          include: {
            items: { include: { product: true, variant: true } },
          },
        });

        // 🔥 If no cart exists in DB, create one immediately (Old logic merged)
        if (!cart) {
          const ownerType = userId ? CartOwnerType.USER : CartOwnerType.GUEST;
          cart = await this.prisma.cart.create({
            data: {
              tenantId,
              ownerType,
              userId,
              sessionId,
            },
            include: {
              items: { include: { product: true, variant: true } },
            },
          });
        }

        return cart;
      },
      3600, // Cache for 1 hour
    );
  }

  /**
   * Adds an item or variant to the cart with inventory validation
   */
  async addToCart(tenantId: string, userId: string | undefined, sessionId: string | undefined, dto: AddToCartDto) {
    // 1. Verify Stock using InventoryService (New logic)
    const availableStock = await this.inventoryService.getAvailableStock(dto.productId, dto.variantId);
    if (availableStock < dto.quantity) {
      throw new BadRequestException(`Insufficient stock. Only ${availableStock} available.`);
    }

    // 2. Fetch/Create Cart (Using the auto-create logic from getCart)
    const cart = await this.getCart(tenantId, userId, sessionId);

    // 3. Fetch Product/Variant to get price snapshot
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException('Product not found');
    
    let priceSnapshot = product.price;
    if (dto.variantId) {
      const variant = await this.prisma.productVariant.findUnique({ where: { id: dto.variantId } });
      if (!variant) throw new NotFoundException('Variant not found');
      priceSnapshot += variant.priceModifier;
    }

    // 4. Upsert the Item (Merged variant support)
    const result = await this.prisma.cartItem.upsert({
      where: {
        cartId_productId_variantId: {
          cartId: cart.id,
          productId: dto.productId,
          // Change: Ensure null is accepted or use undefined if the type is strict
      variantId: dto.variantId || null as any,
        },
      },
      update: {
        quantity: { increment: dto.quantity },
      },
      create: {
        cartId: cart.id,
        productId: dto.productId,
        variantId: dto.variantId || null,
        quantity: dto.quantity,
        priceSnapshot: priceSnapshot,
        tenantId: tenantId,
      },
    });

    // 5. Invalidate Cache
    await this.invalidateCache(tenantId, userId, sessionId);
    return result;
  }

  async removeItem(tenantId: string, userId: string | undefined, sessionId: string | undefined, productId: string, variantId?: string) {
    const cart = await this.getCart(tenantId, userId, sessionId);
    
    await this.prisma.cartItem.delete({
      where: {
        cartId_productId_variantId: {
          cartId: cart.id,
          productId,
          variantId: variantId || null as any,
        },
      },
    });

    await this.invalidateCache(tenantId, userId, sessionId);
  }

  /**
   * Merges a guest cart into a user cart upon login
   */
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

    // Delete guest cart after successful merge
    await this.prisma.cart.delete({ where: { id: guestCart.id } });
    await this.invalidateCache(tenantId, undefined, sessionId);
  }

  /**
   * Clears cache and database items
   */
  async invalidateCache(tenantId: string, userId?: string, sessionId?: string) {
    const cacheKey = this.getCacheKey(tenantId, userId, sessionId);
    await this.cache.del(cacheKey);
  }

  async clearCart(tenantId: string, userId?: string, sessionId?: string) {
    const cart = await this.getCart(tenantId, userId, sessionId);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    await this.invalidateCache(tenantId, userId, sessionId);
  }
}