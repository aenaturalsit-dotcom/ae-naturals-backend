// src/admin/features/dto/feature-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class FeatureResponseDto {
  @ApiProperty({ example: 'cuid12345' })
  id: string;

  @ApiProperty({ example: 'Same day delivery' })
  title: string;

  @ApiProperty({ example: 'Truck' })
  icon: string;

  @ApiProperty({ example: '#16a34a', required: false })
  color?: string;
}