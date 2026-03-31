import { 
  IsString, 
  IsNumber, 
  IsArray, 
  IsOptional, 
  IsNotEmpty, 
  ValidateNested, 
  IsBoolean, 
  IsObject,
  IsEnum
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

// Enum mirroring the Prisma APlusBlockType
export enum APlusBlockType {
  BANNER = 'BANNER',
  SPLIT = 'SPLIT',
  IMAGE_GRID = 'IMAGE_GRID',
  TEXT = 'TEXT',
}

export class APlusContentDto {
  @ApiProperty({ enum: APlusBlockType, example: APlusBlockType.BANNER })
  @IsEnum(APlusBlockType)
  type: APlusBlockType;

  @ApiProperty({ example: 0, description: 'Order for drag and drop sorting' })
  @IsNumber()
  order: number;

  @ApiProperty({ 
    example: { imageUrl: 'https://example.com/banner.jpg', overlayTitle: 'Premium Quality' },
    description: 'JSON object containing block-specific configurations'
  })
  @IsObject()
  content: Record<string, any>;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ProductExtraDto {
  @ApiPropertyOptional({ example: 'Keep away from direct sunlight and children.' })
  @IsOptional() @IsString() safetyInfo?: string;

  @ApiPropertyOptional({ example: 'Organic Aloe Vera, Neem Extract, Rose Water' })
  @IsOptional() @IsString() ingredients?: string;

  @ApiPropertyOptional({ example: 'Apply twice daily on clean skin.' })
  @IsOptional() @IsString() directions?: string;

  @ApiPropertyOptional({ example: 'Not evaluated by the FDA. Not intended to diagnose, treat, cure, or prevent any disease.' })
  @IsOptional() @IsString() legalDisclaimer?: string;

  @ApiPropertyOptional({ example: 'AE Naturals Pvt Ltd' })
  @IsOptional() @IsString() manufacturer?: string;

  @ApiPropertyOptional({ example: 'India' })
  @IsOptional() @IsString() countryOfOrigin?: string;

  @ApiPropertyOptional({ example: '250g' })
  @IsOptional() @IsString() weight?: string;

  @ApiPropertyOptional({ example: '10x5x5 cm' })
  @IsOptional() @IsString() dimensions?: string;

  @ApiPropertyOptional({ example: 'Herbal Face Wash' })
  @IsOptional() @IsString() genericName?: string;

  @ApiPropertyOptional({ 
    description: 'Legacy/Alternative JSON storage for A+ Content',
    example: [{ type: 'text', content: 'Legacy format block' }]
  })
  @IsOptional() @IsArray() aPlusContent?: any[]; 
}

export class ProductAttributeDto {
  @ApiProperty({ example: 'Size' })
  @IsString() @IsNotEmpty() name: string;

  @ApiProperty({ example: '500ml' })
  @IsString() @IsNotEmpty() value: string;
}

export class ProductVariantDto {
  @ApiProperty({ example: 'Pack of 2' })
  @IsString() @IsNotEmpty() name: string;

  @ApiProperty({ example: 150, description: 'Amount added to base price' })
  @IsNumber() priceModifier: number;

  @ApiProperty({ example: 50, description: 'Inventory stock for this variant' })
  @IsNumber() stock: number;
}

export class CreateProductDto {
  @ApiProperty({ example: 'Organic Aloe Vera Gel 500ml' })
  @IsString() @IsNotEmpty() name: string;

  @ApiProperty({ example: 'organic-aloe-vera-gel-500ml' })
  @IsString() @IsNotEmpty() slug: string;

  @ApiPropertyOptional({ example: '100% pure organic aloe vera gel for glowing skin and healthy hair.' })
  @IsOptional() @IsString() description?: string;
  
  @ApiProperty({ example: 299.00 })
  @IsNumber() price: number;

  @ApiPropertyOptional({ example: 399.00 })
  @IsOptional() @IsNumber() oldPrice?: number | null;
  
  @ApiProperty({ example: 'clq123abc0000category' }) // Replace with valid DB ID in Swagger
  @IsString() @IsNotEmpty() categoryId: string;

  @ApiProperty({ example: 'clq123abc0001store' }) // Replace with valid DB ID in Swagger
  @IsString() @IsNotEmpty() storeId: string;
  
  @ApiProperty({ example: ['https://res.cloudinary.com/demo/image/upload/v1/aloe1.jpg'] })
  @IsArray() @IsString({ each: true }) images: string[];
  
  @ApiPropertyOptional({ example: 'Aloe Vera Extract, Vitamin E' })
  @IsOptional() @IsString() ingredients?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional() @IsBoolean() isActive?: boolean;

  @ApiPropertyOptional({ example: ['Store in a cool dry place', 'Do not freeze'] })
  @IsOptional() @IsArray() @IsString({ each: true }) careInstructions?: string[];

  @ApiPropertyOptional({ example: ['Ships in 24 hours', 'Free delivery over ₹500'] })
  @IsOptional() @IsArray() @IsString({ each: true }) deliveryInfo?: string[];

  @ApiPropertyOptional({ type: () => [ProductAttributeDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductAttributeDto)
  attributes?: ProductAttributeDto[];

  @ApiPropertyOptional({ type: () => [ProductVariantDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  variants?: ProductVariantDto[];

  @ApiPropertyOptional({ type: () => ProductExtraDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProductExtraDto)
  extra?: ProductExtraDto;

  @ApiPropertyOptional({ 
    type: () => [APlusContentDto],
    description: 'Relational A+ Content Blocks attached to this product'
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => APlusContentDto)
  aPlusBlocks?: APlusContentDto[];

  @ApiPropertyOptional({ 
    example: ['clq123highlight1', 'clq123highlight2'],
    description: 'Array of FeatureHighlight IDs to connect to this product'
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  highlightIds?: string[];
}

// Automatically creates an Update DTO with all fields marked as Optional for Swagger!
export class UpdateProductDto extends PartialType(CreateProductDto) {}