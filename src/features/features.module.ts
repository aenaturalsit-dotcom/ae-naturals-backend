// src/features/features.module.ts
import { Module } from '@nestjs/common';
import { FeaturesController } from './features.controller';
import { FeaturesService } from 'src/admin/features/features.service';

@Module({
  controllers: [FeaturesController],
  providers: [FeaturesService],
  exports: [FeaturesService], // Exported so AdminModule can use it
})
export class FeaturesModule {}