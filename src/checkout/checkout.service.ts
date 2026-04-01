// src/modules/checkout/checkout.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InventoryService } from '../inventory/inventory.service';
import { BuyNowDto } from '../dto/buy-now.dto';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma';

@Injectable()
export class CheckoutService {
  constructor(
    private prisma: PrismaService,
    private inventoryService: InventoryService,
  ) {}

  async processBuyNow(tenantId: string, userId: string | undefined, sessionId: string | undefined, dto: BuyNowDto) {
    // 1. Pre-fetch product to calculate total amount
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException('Product not found');
    
    let unitPrice = product.price;
    if (dto.variantId) {
      const variant = await this.prisma.productVariant.findUnique({ where: { id: dto.variantId } });
      if (!variant) throw new NotFoundException('Variant not found');
      unitPrice += variant.priceModifier;
    }

    const totalAmount = unitPrice * dto.quantity;
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // 2. Execute High-Concurrency Transaction
    return this.prisma.$transaction(async (tx) => {
      // Create draft session first so we have an ID for the reservation
      const session = await tx.checkoutSession.create({
        data: {
          tenantId,
          userId,
          sessionId,
          status: OrderStatus.PENDING,
          totalAmount,
          expiresAt,
        },
      });

      // Reserve inventory (Throws error and rolls back if out of stock)
      await this.inventoryService.reserveInventory(tx, dto.productId, dto.variantId, dto.quantity, session.id);

      return session;
    });
  }
}