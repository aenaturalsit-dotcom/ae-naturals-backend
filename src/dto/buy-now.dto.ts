// src\modules\dto\buy-now.dto.ts
import { IsString, IsInt, Min, IsOptional } from 'class-validator';

export class BuyNowDto {
  @IsString()
  productId: string;

  @IsOptional()
  @IsString()
  variantId?: string;

  @IsInt()
  @Min(1)
  quantity: number;
}