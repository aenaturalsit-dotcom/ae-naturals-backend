// src/payments/payments.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; 
import { ProviderFactory } from '../providers/provider.factory';
import { ProviderConfigService } from '../providers/provider-config.service';

export type PaymentGateway = 'STRIPE' | 'RAZORPAY' | 'PHONEPE' | 'PAYU';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    // ✅ INJECT YOUR AWESOME FACTORY AND CONFIG SERVICE
    private providerFactory: ProviderFactory,
    private configService: ProviderConfigService,
  ) {}

  async initiateCheckout(orderId: string, provider: PaymentGateway, userId: string) {
    const order = await this.prisma.order.findUnique({ 
      where: { id: orderId },
      include: { store: true } 
    });
    
    if (!order) throw new BadRequestException('Order not found');

    // 1. Fetch active global config from DB Cache
    const activeConfigs = await this.configService.getActiveConfigs('PAYMENT');
    const globalConfig = activeConfigs.find(c => c.provider === provider) || { config: {} };

    // 2. Merge Global DB keys with specific Store tenant overrides (White-label)
    const storePaymentKeys = (order.store.paymentConfig as Record<string, string>) || {};
    const finalConfig = { 
      ...globalConfig.config, 
      ...storePaymentKeys,
      frontend_url: storePaymentKeys.frontend_url || process.env.FRONTEND_URL,
      backend_webhook_url: process.env.BACKEND_URL 
    };

    // 3. ✅ DYNAMIC INSTANTIATION (No more giant switch statements!)
    const paymentInstance = this.providerFactory.getProvider('PAYMENT', provider, finalConfig);

    // 4. Execute Payment
    const paymentResult = await paymentInstance.createOrder(order.id, order.totalAmount, 'INR');

    // 5. Save the Payment ID so your Webhooks don't fail
    if (paymentResult.providerOrderId) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: { paymentProviderId: paymentResult.providerOrderId }
      });
    }

    return paymentResult;
  }

  // ✅ DYNAMIC VERIFICATION FOR PAYU/RAZORPAY
  async verifyPayment(provider: PaymentGateway, orderId: string, paymentData: any) {
    const order = await this.prisma.order.findUnique({ 
      where: { id: orderId },
      include: { store: true } 
    });
    
    if (!order) throw new BadRequestException('Order not found');

    const activeConfigs = await this.configService.getActiveConfigs('PAYMENT');
    const globalConfig = activeConfigs.find(c => c.provider === provider) || { config: {} };
    const storePaymentKeys = (order.store.paymentConfig as Record<string, string>) || {};
    const finalConfig = { ...globalConfig.config, ...storePaymentKeys };

    const paymentInstance = this.providerFactory.getProvider('PAYMENT', provider, finalConfig);

    // Dynamic verification
    const isValid = paymentInstance.verifyPayment(paymentData);

    if (isValid) {
      // ✅ ADD THIS CHECK: Narrow the type to satisfy TypeScript and prevent runtime null errors
      if (!order.paymentProviderId) {
        throw new BadRequestException('Order does not have a valid payment provider ID');
      }

      await this.markOrderPaid(order.paymentProviderId);
      return { success: true, orderId: order.id, frontendUrl: finalConfig.frontend_url };
    }
    
    throw new BadRequestException('Payment signature validation failed');
   
    
  }

  async markOrderPaid(paymentId: string) {
    const order = await this.prisma.order.update({
      where: { paymentProviderId: paymentId },
      data: { status: 'PAID' }, 
    });

    // Safely clear cart only on success
    await this.prisma.cartItem.deleteMany({
      where: { cart: { userId: order.userId } }
    });

    return order;
  }
}