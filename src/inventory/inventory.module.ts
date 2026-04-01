// src/inventory/inventory.module.ts

import { Module } from '@nestjs/common';
import { InventoryCleanupCron } from './inventory-cleanup.cron';
import { PrismaModule } from '../prisma/prisma.module';
import { InventoryService } from './inventory.service';

@Module({
  imports: [PrismaModule],
  providers: [InventoryService, InventoryCleanupCron],
  exports: [InventoryService],
})
export class InventoryModule {}