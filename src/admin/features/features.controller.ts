// src/admin/features.controller.ts
import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { FeaturesService } from './features.service';
import { CreateFeatureDto, UpdateFeatureDto, ReorderFeaturesDto } from './dto/feature.dto';
import { AdminGuard } from 'src/auth/guards/admin.guard';

@ApiTags('Admin Features')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), AdminGuard)
@Controller('admin/features')
export class AdminFeaturesController {
  constructor(private readonly featuresService: FeaturesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all feature highlights (Admin)' })
  async getAll() {
    return this.featuresService.getAllFeaturesForAdmin();
  }

  @Post()
  @ApiOperation({ summary: 'Create a new feature highlight' })
  async create(@Body() createFeatureDto: CreateFeatureDto) {
    return this.featuresService.createFeature(createFeatureDto);
  }

  @Patch('reorder')
  @ApiOperation({ summary: 'Batch update the display order of features' })
  async reorder(@Body() reorderDto: ReorderFeaturesDto) {
    return this.featuresService.reorderFeatures(reorderDto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a specific feature' })
  async update(@Param('id') id: string, @Body() updateFeatureDto: UpdateFeatureDto) {
    return this.featuresService.updateFeature(id, updateFeatureDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a feature highlight' })
  async remove(@Param('id') id: string) {
    return this.featuresService.deleteFeature(id);
  }
}