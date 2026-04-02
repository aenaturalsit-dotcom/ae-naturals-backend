import { Controller, Get, Post, Body, UseGuards, Query, Patch, Param } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport'; 
import { AdminGuard } from '../auth/guards/admin.guard';
import { ProviderConfigService } from '../providers/provider-config.service';
import { ProviderType } from '@prisma/client';

@UseGuards(AuthGuard('jwt'), AdminGuard)
@Controller('admin/providers')
export class ProvidersController {
  constructor(private readonly providerConfigService: ProviderConfigService) {}

  @Get()
  async getProviders(@Query('type') type: ProviderType) {
    if (!type) return [];
    return this.providerConfigService.getAllAdminConfigs(type.toUpperCase() as ProviderType);
  }

  // ✅ Handles POST /api/v1/admin/providers
  @Post()
  async saveProviderConfig(@Body() body: any) {
    return this.providerConfigService.saveConfig(body);
  }

  // ✅ Handles POST /api/v1/admin/providers/config (Resolves your 404 error)
  @Post('config')
  async saveProviderConfigAlias(@Body() body: any) {
    return this.providerConfigService.saveConfig(body);
  }

  @Patch(':id')
  async updateProvider(
    @Param('id') id: string,
    @Body() body: any 
  ) {
    return this.providerConfigService.updateConfigById(id, body);
  }
}