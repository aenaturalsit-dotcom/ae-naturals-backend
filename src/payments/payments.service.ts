import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProviderFactory } from '../providers/provider.factory';
import { ProviderConfigService } from '../providers/provider-config.service';
import { NotificationService } from '../notifications/notification.service';

export type PaymentGateway = 'STRIPE' | 'RAZORPAY' | 'PHONEPE' | 'PAYU';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private providerFactory: ProviderFactory,
    private configService: ProviderConfigService,
    private notificationService: NotificationService,
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
  async markOrderPaid(paymentId: string) {
    console.log(`marking order paid for payment id ${paymentId}`)
    const order = await this.prisma.order.update({
      where: { paymentProviderId: paymentId },
      data: { status: 'PAID' },
      include: { user: true },
    });

    // 1. Safely clear the user's cart now that they have purchased
    await this.prisma.cartItem.deleteMany({
      where: { cart: { userId: order.userId } },
    });

    // 2. Fire Success Email & SMS Notifications in the background
    if (order.user) {
      this.notificationService
        .sendOrderConfirmation(
          {
            email: order.user.email || '',
            phone: order.user.phone || '',
            name: order.user.name || 'Customer',
          },
          {
            id: order.id,
            amount: order.totalAmount,
          },
        )
        .catch((err) =>
          this.logger.error(`Failed to send success notification: ${err.message}`),
        );
    }
    
    return order;
  }
}