import { Controller, Get, Inject, Logger } from '@nestjs/common';
import { HealthCheckService, HealthCheck, HealthIndicatorResult } from '@nestjs/terminus';
import { PrismaHealthIndicator } from '../prisma/prisma.health';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
// Import your config service
import { ProviderConfigService } from '../providers/provider-config.service';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private health: HealthCheckService,
    private prismaIndicator: PrismaHealthIndicator,
    private configService: ProviderConfigService, // 1. Inject the Config Service
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  @Get()
  @HealthCheck()
  async check() {
    this.logger.log(`Checking system health status...`);

    return this.health.check([
      // 1. Database Health Check
      () => this.prismaIndicator.isHealthy('database'),

      // 2. Redis / Cache Health Check
      async () => {
        try {
          const testKey = `health:${Date.now()}`;
          await this.cacheManager.set(testKey, 'pong', 10000);
          const result = await this.cacheManager.get(testKey);

          if (result === 'pong') {
            return { redis: { status: 'up' } };
          }
          throw new Error('Redis response mismatch');
        } catch (e) {
          return {
            redis: {
              status: 'down',
              message: e instanceof Error ? e.message : String(e),
            },
          };
        }
      },

      // 3. Payment Config Integrity Check
      async (): Promise<HealthIndicatorResult> => {
        try {
          // Fetch active payment configs exactly like your service does
          const activeConfigs = await this.configService.getActiveConfigs('PAYMENT');
          console.log('Active Payment Configs:', activeConfigs); // Debug log
          if (!activeConfigs || activeConfigs.length === 0) {
            return { 
              payment_providers: { 
                status: 'down', 
                message: 'No active payment providers found in DB' 
              } 
            };
          }

          // List which providers are currently loaded
          const providers = activeConfigs.map(c => c.provider);
          
          return {
            payment_providers: {
              status: 'up',
              active_count: activeConfigs.length,
              available: providers,
            },
          };
        } catch (error) {
          return {
            payment_providers: {
              status: 'down',
              message: error instanceof Error ? error.message : 'Config fetch failed',
            },
          };
        }
      },
    ]);
  }
}