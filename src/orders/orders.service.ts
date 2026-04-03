// src/orders/orders.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  ForbiddenException,
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
    // 1. Find the real store for the database relation
    let store = await this.prisma.store.findUnique({
      where: { id: storeId },
    });

    // CRITICAL FIX: If frontend passed 'default-store', find the actual default store in the DB
    if (!store && storeId === 'default-store') {
      store = await this.prisma.store.findFirst({ where: { isDefault: true } });

      // Fallback: Just grab the first available store if none are marked default
      if (!store) {
        store = await this.prisma.store.findFirst();
      }
    }

    if (!store) {
      this.logger.error(`FAILED: No valid store found to place order.`);
      throw new NotFoundException(`Valid store not found.`);
    }

    const realStoreId = store.id; // Use this valid ID for the Order foreign key

    // 2. Fetch current cart
    // Use the original `storeId` ('default-store') to find the cart, as that's how it was saved
    const cart = await this.prisma.cart.findUnique({
      where: userId
        ? { tenantId_userId: { tenantId: storeId, userId } }
        : {
            tenantId_sessionId: {
              tenantId: storeId,
              sessionId: 'SESSION_ID_FROM_REQUEST',
            },
          },
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
        const newOrder = await tx.order.create({
          data: {
            userId,
            storeId: realStoreId, // ✅ Use the REAL database store ID here
            totalAmount,
            status: 'PENDING',
            items: {
              create: cart.items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                price: item.priceSnapshot,
              })),
            },
          },
        });

        // ❌ DO NOT delete the cart here. The cart should only be cleared in
        // PaymentsService -> markOrderPaid after the user actually pays successfully.

        return newOrder;
      });

      // 5. Cleanup: Invalidate Redis Cache
      // ✅ FIX: pass the tenantId (storeId) first, then the userId
      await this.cartService.invalidateCache(storeId, userId);

      // 6. Async Notification
      // this.sendOrderNotificationsAsync(userId, order).catch((err) =>
      //   this.logger.error(`Failed to send order notification: ${err.message}`),
      // );

      return order;
    } catch (error) {
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
  async getOrderStatus(userId: string, orderId: string) {
    const order = this.prisma.order.findUnique({
      where: { id: orderId, userId: userId },
      select: { status: true }, // Only return status for high-performance polling
    });
    if (!order) throw new NotFoundException();
    return order;
  }

  // ✅ NEW: Securely fetch order details for the success page
  async getOrderByIdForSuccessPage(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: { product: true },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // 🔒 Security: Prevent users from viewing someone else's order
    if (order.userId !== userId) {
      throw new ForbiddenException('You do not have permission to view this order.');
    }

    // Map to exactly what the frontend UI expects
    return {
      id: order.id,
      status: order.status,
      totalAmount: order.totalAmount,
      items: order.items.map((item) => ({
        name: item.product?.name || 'Unknown Product',
        description: item.product?.description || '', // Optional
        // Get the first image from the images array
        image: item.product?.images?.[0] || null, 
        price: item.price,
        quantity: item.quantity,
      })),
    };
  }

}
