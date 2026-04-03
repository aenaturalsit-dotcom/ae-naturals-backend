// Location: src/payments/payments.module.ts

import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from '../prisma/prisma.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { ProvidersModule } from 'src/providers/providers.module';
import { NotificationModule } from 'src/notifications/notification.module';
import { BullModule } from '@nestjs/bullmq';
import { PostPaymentWorker } from 'src/orders/post-payment.worker';

@Module({
  imports: [PrismaModule, HttpModule,ProvidersModule,NotificationModule,// 1. Register the BullMQ Queue for post-payment processing
    BullModule.registerQueue({
      name: 'post-payment-queue',
    }),],
  controllers: [PaymentsController],
  providers: [PaymentsService,PostPaymentWorker],
  exports: [PaymentsService],
})
export class PaymentsModule {}