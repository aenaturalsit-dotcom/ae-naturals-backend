// src\admin\features\features.controller.ts
import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard } from '../../auth/guards/admin.guard'; // Adjust path if needed
import { AdminFeaturesService } from './features.service';
import { CreateFeatureDto, UpdateFeatureDto, ReorderFeaturesDto } from './dto/feature.dto';

@ApiTags('Admin Features Master List')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), AdminGuard)
@Controller('admin/features') // <-- This creates the /api/v1/admin/features route!
export class AdminFeaturesController {
  constructor(private readonly featuresService: AdminFeaturesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all master feature highlights' })
  async getAll() {
    return this.featuresService.getAllFeatures();
  }

  @Post()
  @ApiOperation({ summary: 'Create a new global feature highlight' })
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
  @ApiOperation({ summary: 'Delete a global feature highlight' })
  async remove(@Param('id') id: string) {
    return this.featuresService.deleteFeature(id);
  }
}