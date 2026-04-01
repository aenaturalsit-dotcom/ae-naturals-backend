// src\modules\inventory\inventory.service.ts
import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/prisma';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  /**
   * Calculates actual available stock by subtracting active reservations.
   */
  async getAvailableStock(productId: string, variantId?: string): Promise<number> {
    const productData = variantId 
      ? await this.prisma.productVariant.findUnique({ where: { id: variantId } })
      : await this.prisma.product.findUnique({ where: { id: productId } });

    if (!productData) throw new BadRequestException('Product or Variant not found');

    const reservations = await this.prisma.inventoryReservation.aggregate({
      where: {
        productId,
        variantId: variantId || null,
        expiresAt: { gt: new Date() },
      },
      _sum: { quantity: true },
    });

    const reservedStock = reservations._sum.quantity || 0;
    return productData.stock - reservedStock;
  }

  /**
   * Safely reserves inventory using a database-level lock.
   * MUST be executed within a Prisma $transaction context.
   */
  async reserveInventory(
    tx: any, // Prisma Transaction Client
    productId: string, 
    variantId: string | undefined, 
    quantity: number, 
    checkoutSessionId: string
  ) {
    // 1. Pessimistic Lock: Block other transactions from modifying this row
    if (variantId) {
      await tx.$executeRaw`SELECT id FROM "ProductVariant" WHERE id = ${variantId} FOR UPDATE`;
    } else {
      await tx.$executeRaw`SELECT id FROM "Product" WHERE id = ${productId} FOR UPDATE`;
    }

    // 2. Fetch actual stock directly from tx to ensure we read the locked row
    const actualStockRecord = variantId
      ? await tx.productVariant.findUnique({ where: { id: variantId }, select: { stock: true } })
      : await tx.product.findUnique({ where: { id: productId }, select: { stock: true } });

    if (!actualStockRecord) throw new BadRequestException('Item not found');

    // 3. Calculate active reservations
    const reservations = await tx.inventoryReservation.aggregate({
      where: {
        productId,
        variantId: variantId || null,
        expiresAt: { gt: new Date() },
      },
      _sum: { quantity: true },
    });

    const reservedStock = reservations._sum.quantity || 0;
    const availableStock = actualStockRecord.stock - reservedStock;

    // 4. Validate
    if (availableStock < quantity) {
      throw new BadRequestException(`Insufficient stock. Only ${availableStock} available.`);
    }

    // 5. Create Reservation (Valid for 10 minutes)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    return tx.inventoryReservation.create({
      data: {
        productId,
        variantId: variantId || null,
        quantity,
        checkoutSessionId,
        expiresAt,
      },
    });
  }
}