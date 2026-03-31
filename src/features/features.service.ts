// src/features/features.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FeaturesService {
  constructor(private prisma: PrismaService) {}

  async getActiveFeatures() {
    return this.prisma.featureHighlight.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: { 
        id: true, 
        title: true, 
        icon: true,
        color: true // <-- ADD THIS LINE SO THE STOREFRONT GETS THE COLOR!
      },
    });
  }
}