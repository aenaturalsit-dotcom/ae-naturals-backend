// src/features/features.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateFeatureDto, UpdateFeatureDto, ReorderFeaturesDto } from './dto/feature.dto';
import { PrismaService } from 'src/prisma';

@Injectable()
export class FeaturesService {
  constructor(private prisma: PrismaService) {}

  // --- PUBLIC ENDPOINT LOGIC ---
  async getActiveFeatures() {
    return this.prisma.featureHighlight.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: { id: true, title: true, icon: true }, // Hide backend-only fields like dates/status
    });
  }

  // --- ADMIN ENDPOINT LOGIC ---
  async getAllFeaturesForAdmin() {
    return this.prisma.featureHighlight.findMany({
      orderBy: { order: 'asc' }, // Show all, including inactive ones
    });
  }

  async createFeature(data: CreateFeatureDto) {
    // Automatically put new features at the end of the list
    const highestOrder = await this.prisma.featureHighlight.findFirst({
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    
    const nextOrder = (highestOrder?.order ?? -1) + 1;

    return this.prisma.featureHighlight.create({
      data: { ...data, order: nextOrder },
    });
  }

  async updateFeature(id: string, data: UpdateFeatureDto) {
    return this.prisma.featureHighlight.update({
      where: { id },
      data,
    }).catch(() => {
      throw new NotFoundException(`Feature with ID ${id} not found`);
    });
  }

  async reorderFeatures(data: ReorderFeaturesDto) {
    // Use an interactive transaction to prevent race conditions while reordering
    return this.prisma.$transaction(
      data.updates.map((update) =>
        this.prisma.featureHighlight.update({
          where: { id: update.id },
          data: { order: update.order },
        })
      )
    );
  }

  async deleteFeature(id: string) {
    // Hard delete for simplicity, or change to isActive: false for soft delete
    return this.prisma.featureHighlight.delete({
      where: { id },
    }).catch(() => {
      throw new NotFoundException(`Feature with ID ${id} not found`);
    });
  }
}