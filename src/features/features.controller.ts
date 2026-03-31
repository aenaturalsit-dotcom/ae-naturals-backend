// src/features/features.controller.ts
import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { FeaturesService } from 'src/admin/features/features.service';

@ApiTags('Storefront Features')
@Controller('features')
export class FeaturesController {
  constructor(private readonly featuresService: FeaturesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all active feature highlights for storefront UI' })
  async getActive() {
    return this.featuresService.getActiveFeatures();
  }
}