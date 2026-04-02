// src/providers/provider-config.service.ts
import { Injectable, Inject, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/security/encryption.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { ProviderType } from '@prisma/client'; // From your schema

@Injectable()
export class ProviderConfigService {
  private readonly logger = new Logger(ProviderConfigService.name);

  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  // 1. Used by Email/SMS Services (Cached, Active Only)
  async getActiveConfigs(type: ProviderType) {
    const cacheKey = `providers_active_${type}`;
    let configs = await this.cacheManager.get<any[]>(cacheKey);

    if (!configs) {
      const records = await this.prisma.providerConfig.findMany({
        where: { type, isActive: true },
        orderBy: { priority: 'asc' },
      });

      configs = records.map(r => {
        try {
          return {
            provider: r.provider,
            config: JSON.parse(this.encryption.decrypt(r.config))
          };
        } catch (e) {
          this.logger.error(`Failed to decrypt config for ${r.provider}`);
          return null;
        }
      }).filter(Boolean);

      await this.cacheManager.set(cacheKey, configs, 600000); 
    }
    return configs;
  }

  // 2. NEW: Used by the Admin Frontend (Uncached, ALL Providers, All Data)
  async getAllAdminConfigs(type: ProviderType) {
    const records = await this.prisma.providerConfig.findMany({
      where: { type },
      orderBy: { priority: 'asc' },
    });

    return records.map(r => {
      try {
        return {
          id: r.id,
          type: r.type,
          provider: r.provider,
          isActive: r.isActive,
          priority: r.priority,
          config: JSON.parse(this.encryption.decrypt(r.config))
        };
      } catch (e) {
        this.logger.error(`Failed to decrypt admin config for ${r.provider}`);
        return null;
      }
    }).filter(Boolean);
  }

  // Used by the Admin API to update configurations
  async saveConfig(data: { type: ProviderType; provider: string; isActive: boolean; priority: number; config: any }) {
    
    // Encrypt the JSON object into a secure string
    const encryptedConfig = this.encryption.encrypt(JSON.stringify(data.config));
   
    await this.prisma.providerConfig.upsert({
      where: { type_provider: { type: data.type, provider: data.provider } },
      update: { isActive: data.isActive, priority: data.priority, config: encryptedConfig },
      create: { type: data.type, provider: data.provider, isActive: data.isActive, priority: data.priority, config: encryptedConfig },
    });

    // Invalidate Cache instantly so next request uses new keys
    await this.cacheManager.del(`providers_active_${data.type}`);
    return { success: true };
  }
  // Add this method inside ProviderConfigService (src/providers/provider-config.service.ts)

  // Used by the Admin API to update an existing provider (Edit or Toggle Status)
  async updateConfigById(id: string, data: any) {
    const updatePayload: any = {};
console.log(data,"-------data");
    // Only update fields that were actually sent in the PATCH request
    if (data.isActive !== undefined) updatePayload.isActive = data.isActive;
    if (data.priority !== undefined) updatePayload.priority = data.priority;
    
    // If new API keys were sent, encrypt them before saving
    if (data.config) {
      updatePayload.config = this.encryption.encrypt(JSON.stringify(data.config));
    }

    // Update the database
    const updated = await this.prisma.providerConfig.update({
      where: { id },
      data: updatePayload,
    });
    console.log(updated,"--------updated")

    // Invalidate the cache for this specific provider type
    await this.cacheManager.del(`providers_active_${updated.type}`);
    
    return { success: true, provider: updated };
  }
}