// src/cart/cart.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { OrdersModule } from '../orders/orders.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonCacheModule } from '../common/cache/cache.module';
import { InventoryModule } from 'src/inventory/inventory.module';

@Module({
  imports: [
    PrismaModule,
    CommonCacheModule,
    forwardRef(() => OrdersModule), // Handles circular dependency
    InventoryModule
  ],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService], // This MUST be exported
})
export class CartModule {}