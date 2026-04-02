// src\notifications\sms.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProviderFactory } from '../providers/provider.factory';
import { AppCacheService } from '../common/cache/cache.service';
import { EncryptionService } from '../common/security/encryption.service';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly CACHE_KEY = 'sms_providers_config';

  constructor(
    private prisma: PrismaService,
    private providerFactory: ProviderFactory,
    private cacheService: AppCacheService,
    private encryption: EncryptionService,
  ) {}

  /**
   * Sends an SMS using a resilient dynamic fallback strategy.
   * It strictly respects the 'isActive' flag in the database.
   */
  
  // Update the method signature
  // Update the method signature
  async sendSMS(phone: string, message: string, payload?: { templateKey: string; variables: Record<string, string> }): Promise<boolean> {
    try {
      const providers = await this.getActiveProviders();

      if (!providers || providers.length === 0) {
        this.logger.warn('No active SMS providers configured.');
        return false;
      }

      for (const item of providers) {
        try {
          const decryptedConfig = JSON.parse(this.encryption.decrypt(item.config));
          const provider = this.providerFactory.getProvider('SMS', item.provider, decryptedConfig);

          // ✅ Pass the payload. Twilio/Fast2SMS ignores it and uses the raw 'message'
          await provider.send(phone, message, payload);

          await this.logNotification('SMS', item.provider, phone, 'SUCCESS');
          return true; 
        } catch (err) {
          this.logger.error(`❌ Provider ${item.provider} failed: ${err.message}`);
          await this.logNotification('SMS', item.provider, phone, 'FAILED', err.message);
          this.logger.warn(`Switching to next available SMS fallback...`);
        }
      }
      return false;
    } catch (globalError) {
      this.logger.error(`Critical failure in SmsService: ${globalError.message}`);
      return false;
    }
  }

  /**
   * Fetches active SMS providers from Cache or Database.
   */
  private async getActiveProviders() {
    return await this.cacheService.getOrSet(
      this.CACHE_KEY,
      async () => {
        return await this.prisma.providerConfig.findMany({
          where: {
            type: 'SMS',
            isActive: true, // Only fetch enabled providers
          },
          orderBy: { priority: 'asc' }, // Respect priority order
        });
      },
      300, // Cache for 5 minutes
    );
  }

  /**
   * Logs notification attempts for auditing.
   */
  private async logNotification(
    type: string,
    provider: string,
    recipient: string,
    status: string,
    error?: string,
  ) {
    try {
      await this.prisma.notificationLog.create({
        data: { type, provider, recipient, status, error },
      });
    } catch (logError) {
      this.logger.error(`Failed to log notification: ${logError.message}`);
    }
  }

  /**
   * Invalidate cache when DB configs change (e.g., from Admin UI)
   */
  async invalidateProviderCache() {
    await this.cacheService.del(this.CACHE_KEY);
    this.logger.log('SMS provider cache invalidated.');
  }
}