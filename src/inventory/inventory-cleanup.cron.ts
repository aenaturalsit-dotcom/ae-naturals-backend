import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma';

@Injectable()
export class InventoryCleanupCron {
  private readonly logger = new Logger(InventoryCleanupCron.name);

  constructor(private prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiredReservations() {
    this.logger.debug('Running expired inventory reservation cleanup...');
    try {
      const result = await this.prisma.inventoryReservation.deleteMany({
        where: {
          expiresAt: { lte: new Date() },
        },
      });
      if (result.count > 0) {
        this.logger.log(`Released ${result.count} expired inventory reservations.`);
      }
    } catch (error) {
      this.logger.error('Failed to cleanup inventory reservations', error);
    }
  }
}