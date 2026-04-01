// src/orders/orders.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CartService } from '../cart/cart.service';
// Import the NotificationService
import { NotificationService } from '../notifications/notification.service';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private prisma: PrismaService,
    private cartService: CartService,
    // Inject NotificationService
    private notificationService: NotificationService,
  ) {}

  async createOrder(userId: string, storeId: string) {
    // 1. Validation: Prevent P2003 error by checking store existence
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
    });

    if (!store) {
      this.logger.error(`FAILED: Store ID ${storeId} does not exist.`);
      throw new NotFoundException(`Store with ID ${storeId} not found.`);
    }

    // 2. Fetch current cart
    // FIX: Using storeId as the tenantId and ensuring the unique constraint matches your schema
    const cart = await this.prisma.cart.findUnique({
      where: userId
        ? { tenantId_userId: { tenantId: storeId, userId } }
        : { tenantId_sessionId: { tenantId: storeId, sessionId: 'SESSION_ID_FROM_REQUEST' } }, 
      include: { items: true }, 
    });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    // 3. Calculate Total Amount
    const totalAmount = cart.items.reduce((sum, item) => {
      return sum + item.priceSnapshot * item.quantity;
    }, 0);

    // 4. Atomic Database Transaction
    try {
      const order = await this.prisma.$transaction(async (tx) => {
        // Create the Order and OrderItems
        const newOrder = await tx.order.create({
          data: {
            userId, 
            storeId,
            totalAmount,
            status: 'PENDING',
            items: {
              create: cart.items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                // FIX: Use priceSnapshot to match CartItem schema
                price: item.priceSnapshot, 
              })),
            },
          },
        });

        // Clear the cart items in DB using the transaction client
        await tx.cartItem.deleteMany({
          where: { cartId: cart.id }, // FIX: cart.id exists, cartId didn't
        });

        return newOrder;
      });

      // 5. Cleanup: Invalidate Redis Cache (Ensure this method exists in CartService)
      await this.cartService.invalidateCache(userId);

      // 6. Async Notification
      this.sendOrderNotificationsAsync(userId, order).catch((err) =>
        this.logger.error(`Failed to send order notification: ${err.message}`),
      );

      return order;
    } catch (error) {
      this.logger.error(`TRANSACTION FATAL: ${error.message}`);
      throw new BadRequestException(
        'Order processing failed. Please try again.',
      );
    }
  }

  // Helper method so notification delays don't block the API response
  private async sendOrderNotificationsAsync(userId: string, order: any) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      await this.notificationService.sendOrderConfirmation(
        {
          email: user.email || '',
          phone: user.phone || '',
          name: user.name || 'Customer',
        },
        {
          id: order.id,
          amount: order.totalAmount,
        },
      );
    }
  }

  async getMyOrders(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: {
        items: {
          include: { product: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
