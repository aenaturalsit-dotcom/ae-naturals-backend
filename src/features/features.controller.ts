import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FeaturesService } from './features.service';
import { FeatureResponseDto } from './dto/feature-response.dto';

@ApiTags('Storefront Features')
@Controller('features')
export class FeaturesController {
  constructor(private readonly featuresService: FeaturesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all active global feature highlights for storefront' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns an array of active feature highlights', 
    type: [FeatureResponseDto] 
  })
  async getActive() {
    return this.featuresService.getActiveFeatures();
  }
}