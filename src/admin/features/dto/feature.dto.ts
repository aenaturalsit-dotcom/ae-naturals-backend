// src/features/dto/feature.dto.ts
import { 
  IsString, 
  IsBoolean, 
  IsOptional, 
  IsInt, 
  IsArray, 
  ValidateNested, 
  IsNotEmpty 
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, PartialType } from '@nestjs/swagger';

export class CreateFeatureDto {
  @ApiProperty({ 
    description: 'The display label for the feature highlight', 
    example: 'Same day delivery' 
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ 
    description: 'The exact string name of the Lucide React icon to render', 
    example: 'Truck' 
  })
  @IsString()
  @IsNotEmpty()
  icon: string;

  @ApiProperty({ 
    description: 'Toggles visibility on the frontend', 
    default: true, 
    required: false 
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

// Automatically generates a type where all fields from CreateFeatureDto are optional
export class UpdateFeatureDto extends PartialType(CreateFeatureDto) {}

// --- Reorder Types ---

class FeatureOrderDto {
  @ApiProperty({ description: 'The UUID of the feature being moved' })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ description: 'The new sequential index for rendering' })
  @IsInt()
  order: number;
}

export class ReorderFeaturesDto {
  @ApiProperty({ 
    description: 'An array of features and their new order mappings',
    type: [FeatureOrderDto] 
  })
  @IsArray()
  @ValidateNested({ each: true }) // Ensures each item in the array is validated against FeatureOrderDto
  @Type(() => FeatureOrderDto)    // Tells class-transformer how to construct the nested objects
  updates: FeatureOrderDto[];
}