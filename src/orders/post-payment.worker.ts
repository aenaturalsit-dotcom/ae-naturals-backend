// src/payments/post-payment.worker.ts
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';

@Processor('post-payment-queue')
export class PostPaymentWorker extends WorkerHost {
  private readonly logger = new Logger(PostPaymentWorker.name);

  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {
    super();
  }

  async process(job: Job<any>) {
    const { orderId, userId, userEmail, userPhone, userName, totalAmount } = job.data;
    
    this.logger.log(`[Worker] Executing post-payment tasks for Order ${orderId}`);
    
    // Task 1: Safely clear the user's cart
    await this.prisma.cartItem.deleteMany({
      where: { cart: { userId } },
    });
    this.logger.log(`[Worker] Cart cleared for User ${userId}`);

    // Task 2: Send Notifications
    if (userEmail || userPhone) {
      await this.notificationService.sendOrderConfirmation(
        { email: userEmail || '', phone: userPhone || '', name: userName || 'Customer' },
        { id: orderId, amount: totalAmount }
      );
      this.logger.log(`[Worker] Notifications dispatched for Order ${orderId}`);
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    // If the email provider is down, the job will fail and BullMQ will retry it.
    this.logger.error(`[Worker] Job ${job.id} failed for Order ${job.data?.orderId}: ${error.message}`);
  }
}