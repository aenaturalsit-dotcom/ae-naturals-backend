//src/admin/features/features.service.ts)
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service'; // Adjust path if needed
import { CreateFeatureDto, UpdateFeatureDto, ReorderFeaturesDto } from './dto/feature.dto';

@Injectable()
export class AdminFeaturesService {
  constructor(private prisma: PrismaService) {}

  async getAllFeatures() {
    return this.prisma.featureHighlight.findMany({
      orderBy: { order: 'asc' }, // Returns sorted by drag-and-drop order
    });
  }

  async createFeature(data: CreateFeatureDto) {
    // Put new features at the bottom of the list automatically
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
      throw new NotFoundException('Feature highlight not found');
    });
  }

  async reorderFeatures(data: ReorderFeaturesDto) {
    // Safe transactional batch update for drag-and-drop UI
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
    return this.prisma.featureHighlight.delete({
      where: { id },
    }).catch(() => {
      throw new NotFoundException('Feature highlight not found');
    });
  }
}