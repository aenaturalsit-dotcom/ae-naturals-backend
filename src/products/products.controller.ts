import {
  Controller,
  Get,
  Query,
  Param,
  NotFoundException,
  Req,
} from '@nestjs/common';

import * as express from 'express';
import { ProductsService } from './products.service';
import { ApiOperation } from '@nestjs/swagger';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // ✅ DYNAMIC STORE CATALOG
  @Get('catalog')
  async getDynamicStoreCatalog(
    @Req() req: express.Request,
    @Query('category') categorySlug?: string,
  ) {
    const resolvedSlug =
      await this.productsService.resolveStoreSlug(req);

    return this.productsService.getStoreCatalog(
      resolvedSlug,
      categorySlug,
    );
  }

  // ✅ BACKWARD COMPATIBILITY
  @Get('catalog/:storeSlug')
  async getStoreCatalog(
    @Param('storeSlug') storeSlug: string,
    @Query('category') categorySlug?: string,
  ) {
    return this.productsService.getStoreCatalog(
      storeSlug,
      categorySlug,
    );
  }

  // ✅ GET ALL PRODUCTS (DYNAMIC)
  // 3. 🚨 THE CULPRIT: FIXED BASE GET ROUTE 🚨
  @Get()
  async findAll(@Req() req: express.Request, @Query('category') category?: string) {
    // Dynamically resolve the store instead of hardcoding 'flower-fairy-dehradun'
    const resolvedSlug = await this.productsService.resolveStoreSlug(req);
    
    const catalog = (await this.productsService.getStoreCatalog(resolvedSlug)) as any;

    if (!catalog || !catalog.products) {
      console.warn(`No catalog or products found for store: ${resolvedSlug}`);
      return [];
    }

    if (category) {
      return catalog.products.filter((p: any) => p.category?.slug === category);
    }

    return catalog.products;
  }

  // ✅ SINGLE PRODUCT
  @Get(':slug')
  async findOne(@Param('slug') slug: string) {
    const product =
      await this.productsService.getProductBySlug(slug);

    if (!product) {
      throw new NotFoundException(
        `Product with slug ${slug} not found`,
      );
    }

    return product;
  }

  // ✅ SIMILAR PRODUCTS
  @Get('similar/:category')
  async findSimilar(@Param('category') category: string) {
    return this.productsService.getSimilarProducts(category);
  }

  // ✅ NEW: Must be placed ABOVE the :slug route!
  @Get(':id/highlights')
  async getHighlights(@Param('id') id: string) {
    return this.productsService.getProductHighlights(id);
  }
}