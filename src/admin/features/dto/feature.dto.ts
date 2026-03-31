// src/admin/features/dto/feature.dto.ts
// src/admin/features/dto/feature.dto.ts
import { IsString, IsBoolean, IsOptional, IsInt, IsArray, ValidateNested, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, PartialType } from '@nestjs/swagger';

export class CreateFeatureDto {
  @ApiProperty({ description: 'Display title', example: 'Same day delivery' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Lucide icon string name', example: 'Truck' })
  @IsString()
  @IsNotEmpty()
  icon: string;

  @ApiProperty({ description: 'Hex color code', example: '#16a34a', required: false })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiProperty({ default: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

// Automatically makes all fields from CreateFeatureDto optional for updates
export class UpdateFeatureDto extends PartialType(CreateFeatureDto) {}

class FeatureOrderDto {
  @ApiProperty({ description: 'The ID of the feature' })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ description: 'The new order index' })
  @IsInt()
  order: number;
}

export class ReorderFeaturesDto {
  @ApiProperty({ type: [FeatureOrderDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FeatureOrderDto)
  updates: FeatureOrderDto[];
}