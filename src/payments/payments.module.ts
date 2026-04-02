// Location: src/payments/payments.module.ts

import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from '../prisma/prisma.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { StripeService } from './providers/stripe.service';
import { RazorpayService } from './providers/razorpay.service';
import { PhonePeService } from './providers/phonepe.service';
import { ProvidersModule } from 'src/providers/providers.module';
import { NotificationModule } from 'src/notifications/notification.module';

@Module({
  imports: [PrismaModule, HttpModule,ProvidersModule,NotificationModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, StripeService, RazorpayService, PhonePeService],
  exports: [PaymentsService],
})
export class PaymentsModule {}