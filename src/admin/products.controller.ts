// src\admin\products.controller.ts
import { Controller, Put, Post, Delete, Body, Param, UseGuards, BadRequestException, Get, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from '../products/products.service';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CreateProductDto, UpdateProductDto } from './dto/create-product.dto'; // <-- Adjust path if needed

@ApiTags('Admin Products')
@ApiBearerAuth()
@Controller('admin/products')
@UseGuards(AuthGuard('jwt'), AdminGuard)
export class AdminProductsController {
  constructor(
    private prisma: PrismaService,
    private productsService: ProductsService
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all products (Admin)' })
  @ApiResponse({ status: 200, description: 'List of all products including inactive ones.' })
  async getAll() {
    return this.productsService.getAllProducts();
  }

  @Post()
  @ApiOperation({ summary: 'Create a new product', description: 'Creates a product with variants, attributes, and A+ content.' })
  @ApiBody({ type: CreateProductDto }) 
  @ApiResponse({ status: 201, description: 'The product has been successfully created.' })
  @ApiResponse({ status: 400, description: 'Validation failed (e.g., missing name/price).' })
  async create(@Body() createProductDto: CreateProductDto) {
    
    if (!createProductDto.name || !createProductDto.price) {
      throw new BadRequestException('Product name and price are required');
    }

    const result = await this.productsService.createProduct(createProductDto);

    if (result?.storeId) {
      await this.productsService.invalidateCatalogCache(result.storeId);
    }

    return result;
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an existing product' })
  @ApiBody({ type: UpdateProductDto, description: 'Send partial or full product data' })
  @ApiResponse({ status: 200, description: 'The product has been successfully updated.' })
  @ApiResponse({ status: 404, description: 'Product not found.' })
  async updateProduct(
    @Param('id') id: string, 
    @Body() data: UpdateProductDto 
  ) {


    if (!data || Object.keys(data).length === 0) {
      throw new BadRequestException('Payload is required');
    }
    return this.productsService.updateProduct(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a product' })
  @ApiResponse({ status: 200, description: 'The product has been deleted.' })
  async deleteProduct(@Param('id') id: string) {
    return this.productsService.deleteProduct(id);
  }

  @Patch(':id/highlights')
  @ApiOperation({ summary: 'Sync highlights for a product' })
  async syncHighlights(
    @Param('id') id: string, 
    @Body('highlightIds') highlightIds: string[]
  ) {
    return this.productsService.syncProductHighlights(id, highlightIds);
  }
}