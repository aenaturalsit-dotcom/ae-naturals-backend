import { Injectable, BadRequestException, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProviderFactory } from '../providers/provider.factory';
import { ProviderConfigService } from '../providers/provider-config.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export type PaymentGateway = 'STRIPE' | 'RAZORPAY' | 'PHONEPE' | 'PAYU';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private providerFactory: ProviderFactory,
    private configService: ProviderConfigService,
    @InjectQueue('post-payment-queue') private postPaymentQueue: Queue,
  ) {}

  async initiateCheckout(
    orderId: string,
    provider: PaymentGateway,
    userId: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { store: true },
    });

    if (!order) throw new BadRequestException('Order not found');

    // 1. Fetch active global config from DB/Cache dynamically
    const activeConfigs = await this.configService.getActiveConfigs('PAYMENT');
    const globalConfig = activeConfigs.find((c) => c.provider === provider);
    
    
    if (!globalConfig || !globalConfig.config) {
      throw new BadRequestException(`Payment provider ${provider} is not active or missing configuration.`);
    }

    // 2. Merge Global DB keys with specific Store tenant overrides safely
    const storePaymentKeys = (order.store?.paymentConfig as Record<string, any>) || {};
    
    // ✅ CRITICAL FIX: Merge cleanly. Do NOT force process.env fallbacks here, 
    // otherwise you will overwrite the valid DB settings with 'undefined'
    const finalConfig = {
      ...globalConfig.config,
      ...storePaymentKeys, 
    };

    // 3. Dynamic Instantiation via Factory
    const paymentInstance = this.providerFactory.getProvider(
      'PAYMENT',
      provider,
      finalConfig,
    );

    // 4. Execute Payment payload generation
    const paymentResult = await paymentInstance.createOrder(
      order.id,
      order.totalAmount,
      'INR',
    );

    // 5. Save the Provider's generated TXN/Order ID to your DB
    if (paymentResult.providerOrderId) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: { paymentProviderId: paymentResult.providerOrderId },
      });
    }

    return paymentResult;
  }

  // ✅ DYNAMIC VERIFICATION FOR PAYU/RAZORPAY
  async verifyPayment(
    provider: PaymentGateway,
    orderId: string,
    paymentData: any,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { store: true },
    });

    if (!order) throw new BadRequestException('Order not found');

    // 1. Fetch exact same config used for creation
    const activeConfigs = await this.configService.getActiveConfigs('PAYMENT');
    const globalConfig = activeConfigs.find((c) => c.provider === provider);
    
    if (!globalConfig || !globalConfig.config) {
      throw new BadRequestException(`Payment provider ${provider} is not active or missing configuration.`);
    }

    const storePaymentKeys = (order.store?.paymentConfig as Record<string, any>) || {};
    const finalConfig = { ...globalConfig.config, ...storePaymentKeys };

    // 2. Instantiate
    const paymentInstance = this.providerFactory.getProvider(
      'PAYMENT',
      provider,
      finalConfig,
    );

    if (!paymentInstance.verifyPayment) {
      throw new BadRequestException('Verification is not supported by this payment provider.');
    }

    // 3. Verify the hash/signature
    const isValid = paymentInstance.verifyPayment(paymentData);

    if (isValid) {
      if (!order.paymentProviderId) {
        throw new BadRequestException('Order does not have a valid payment provider ID attached.');
      }

      // 4. Mark paid and dispatch notifications
      await this.markOrderPaid(order.paymentProviderId);
      
      return {
        success: true,
        orderId: order.id,
        frontendUrl: finalConfig.frontend_url, // Used by the controller to redirect the user
      };
    }

    throw new BadRequestException('Payment signature validation failed. Hashes do not match.');
  }

  // ✅ HANDLES SUCCESS WORKFLOW (Status, Cart cleanup, Email/SMS)
 // ✅ FULLY PRODUCTION-GRADE SUCCESS WORKFLOW
  async markOrderPaid(paymentId: string) {
    this.logger.log(`[Payment Workflow] Received success signal for Payment ID: ${paymentId}`);

    // 1. Fetch current state to prevent duplicate processing
    const existingOrder = await this.prisma.order.findUnique({
      where: { paymentProviderId: paymentId },
    });

    if (!existingOrder) {
      this.logger.error(`[Payment Workflow] Order not found for payment ID: ${paymentId}`);
      throw new BadRequestException('Order not found');
    }

    // 2. IDEMPOTENCY CHECK (CRITICAL)
    if (existingOrder.status === 'PAID') {
      this.logger.log(`[Idempotency] Order ${existingOrder.id} is already PAID. Ignoring duplicate webhook.`);
      return existingOrder; // Return safely without doing anything
    }

    try {
      // 3. OPTIMISTIC LOCKING: Update ONLY if the status is PENDING
      const order = await this.prisma.order.update({
        where: { id: existingOrder.id, status: 'PENDING' },
        data: { status: 'PAID' },
        include: { user: true },
      });

      this.logger.log(`[Payment Workflow] Order ${order.id} strictly marked as PAID. Dispatching background jobs.`);

      // 4. OFFLOAD HEAVY TASKS TO BACKGROUND WORKER
      // We DO NOT delete carts or send emails here to avoid webhook timeouts.
      await this.postPaymentQueue.add(
        'process-success',
        {
          orderId: order.id,
          userId: order.userId,
          userEmail: order.user?.email,
          userPhone: order.user?.phone,
          userName: order.user?.name,
          totalAmount: order.totalAmount,
        },
        {
          attempts: 5, // Retry up to 5 times if SES/Msg91 fails
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: true, // Keep Redis clean
        }
      );

      return order;
    } catch (error) {
      // If Prisma throws here, it means another thread just updated this order to PAID concurrently
      this.logger.warn(`[Idempotency] Concurrent update collision handled for Order: ${existingOrder.id}`);
      return existingOrder;
    }
  }

  // ✅ NEW: High-performance polling verification
  async verifyPaymentStatusForFrontend(orderId: string, userId: string) {
    // We only select what we need to make polling extremely fast and cheap for the DB
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { status: true, userId: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // 🔒 Security check
    if (order.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    // Translate backend Order states to the specific UI Payment states
    if (['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'].includes(order.status)) {
      return { status: 'SUCCESS' };
    }
    
    if (['FAILED', 'CANCELLED', 'PAYMENT_FAILED'].includes(order.status)) {
      return { status: 'FAILED' };
    }

    // If it's PENDING, return PENDING so UI keeps polling
    return { status: 'PENDING' };
  }
}