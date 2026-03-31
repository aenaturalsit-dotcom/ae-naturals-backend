// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { TerminusModule } from '@nestjs/terminus';
import { CommonCacheModule } from './common/cache/cache.module'; // Import your new module
// Internal Modules
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { PaymentsModule } from './payments/payments.module';
import { AuthModule } from './auth/auth.module';

// Health Components
import { HealthController } from './health/health.controller';
import { PrismaHealthIndicator } from './prisma/prisma.health';
import { AdminProductsController } from './admin/products.controller';
import { UsersModule } from './users/users.module';
import { UsersController } from './users/users.controller';
import { UsersService } from './users/users.service';
import { CategoriesController } from './categories/categories.controller';
import { StoreController } from './admin/store.controller';
import { StoreService } from './admin/store.service';
import { AdminController } from './admin/admin.controller';
import { AdminService } from './admin/admin.service';
import { AdminOrdersController } from './admin/orders.controller';
import { CategoriesService } from './categories/categories.service';
import { AuthController } from './auth/auth.controller';
import { CartModule } from './cart/cart.module';
import { OrdersModule } from './orders/orders.module';
import { ProvidersModule } from './providers/providers.module';
import { ProvidersController } from './admin/providers.controller';
import { EncryptionModule } from './common/security/encryption.module';
import { ProfileModule } from './profile/profile.module';


// Features / Highlights
import { AdminFeaturesController } from './admin/features/features.controller';
import { AdminFeaturesService } from './admin/features/features.service'; // <-- ADDED THIS IMPORT
import { FeaturesModule } from './features/features.module';
@Module({
  imports: [
    // 1. Configuration (Loaded first to ensure variables are available for other modules)
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // 2. Health Check Monitoring
    TerminusModule,

    // 3. Security: Rate Limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100, // Limit each IP to 100 requests per minute
      },
    ]),

    // 4. Redis Caching Configuration
    // flower-fairy-backend/src/app.module.ts

    CommonCacheModule,
    // 5. Business Logic Modules
    PrismaModule,
    ProductsModule,
    PaymentsModule,
    AuthModule,
    UsersModule,
    OrdersModule,
    CartModule,
    ProvidersModule,
    EncryptionModule,
    ProfileModule,
    FeaturesModule
  ],
  controllers: [
    HealthController,
    AdminProductsController,
    AdminOrdersController,
    AdminController,
    StoreController,
    UsersController,
    CategoriesController,
    AuthController,
    ProvidersController,
    AdminFeaturesController
    
  ],
  providers: [
    PrismaHealthIndicator,
    UsersService,
    StoreService,
    AdminService,
    CategoriesService,
    AdminFeaturesService
  ],
})
export class AppModule {}
