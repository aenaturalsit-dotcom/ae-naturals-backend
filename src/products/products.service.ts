// src/products/products.service.ts
import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import type { Request } from 'express';

import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../common/cloudinary.service';
import { AppCacheService } from '../common/cache/cache.service';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private prisma: PrismaService,
    private cache: AppCacheService,
    private cloudinary: CloudinaryService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  // ================== GET CATALOG ==================
  async getStoreCatalog(
    slug: string,
    categorySlug?: string,
    isAdmin: boolean = false,
  ) {
    const start = Date.now();
    const cacheKey = `catalog:${slug}:${categorySlug || 'all'}:${isAdmin}`;

    this.logger.log(`📦 Catalog request: ${cacheKey}`);

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        this.logger.log(`⚡ Cache MISS`);

        const store = await this.prisma.store.findUnique({
          where: { slug },
          include: {
            products: {
              where: {
                ...(isAdmin ? {} : { isActive: true }),
                ...(categorySlug && {
                  category: { slug: categorySlug },
                }),
              },
              include: {
                category: true,
                variants: true,
              },
            },
          },
        });

        if (!store) {
          this.logger.error(`❌ Store not found: ${slug}`);
          throw new NotFoundException(`Store ${slug} not found`);
        }

        this.logger.log(
          `✅ Store: ${store.name} | Products: ${store.products.length}`,
        );

        this.logger.log(`⏱ ${Date.now() - start}ms`);
        return store;
      },
      3600,
    );
  }

  // ================== GET PRODUCT ==================
  async getProductBySlug(slug: string) {
    this.logger.log(`🔍 Product fetch: ${slug}`);

    const cacheKey = `product:${slug}`;
    const cached = await this.cacheManager.get(cacheKey);

    if (cached) {
      this.logger.log(`⚡ Cache HIT`);
      return cached;
    }

    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: {
        category: true,
        attributes: true,
        variants: true,
        extra: true, // ✅ Ensures Extra details/A+ Content loads on the product page
      },
    });

    if (!product) {
      this.logger.error(`❌ Product not found`);
      throw new NotFoundException('Product not found');
    }

    this.logger.log(`✅ Found product: ${product.name}`);

    await this.cacheManager.set(cacheKey, product, 600000);
    return product;
  }

  // ================== SIMILAR ==================
  async getSimilarProducts(categorySlug: string) {
    this.logger.log(`🔁 Similar products for: ${categorySlug}`);

    const data = await this.prisma.product.findMany({
      where: {
        category: { slug: categorySlug },
        isActive: true,
      },
      take: 4,
      include: {
        category: true,
        variants: true,
      },
    });

    this.logger.log(`✅ Found ${data.length}`);
    return data;
  }

  // ================== CREATE ==================
  async createProduct(data: any) {
    this.logger.log(`🆕 Creating product`);

    const {
      attributes = [],
      variants = [],
      extra,
      careInstructions = [],
      deliveryInfo = [],
      ...rest
    } = data || {};

    if (!rest.storeId) throw new BadRequestException('Store ID required');
    if (!rest.categoryId)
      throw new BadRequestException('Category ID required');

    const slug =
      rest.slug ||
      rest.name
        ?.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');

    try {
      const product = await this.prisma.product.create({
        data: {
          ...rest,
          slug,
          // ✅ Correctly mapped creation for 1-to-1 relation with A+ content JSON
          ...(extra && Object.keys(extra).length > 0 && {
            extra: {
              create: {
                safetyInfo: extra.safetyInfo,
                ingredients: extra.ingredients,
                directions: extra.directions,
                legalDisclaimer: extra.legalDisclaimer,
                manufacturer: extra.manufacturer,
                countryOfOrigin: extra.countryOfOrigin,
                weight: extra.weight,
                dimensions: extra.dimensions,
                genericName: extra.genericName,
                aPlusContent: extra.aPlusContent || [], // JSON field
              },
            },
          }),
          careInstructions,
          deliveryInfo,
          attributes: {
            create: attributes.map((a: any) => ({
              name: a.name,
              value: a.value,
            })),
          },
          variants: {
            create: variants.map((v: any) => ({
              name: v.name,
              priceModifier: +v.priceModifier || 0,
              stock: +v.stock || 0,
            })),
          },
        },
        include: {
          extra: true, // Return created extra content
          attributes: true,
          variants: true,
          category: true,
          store: true,
        },
      });

      this.logger.log(`✅ Product created: ${product.name}`);
      return product;
    } catch (error: any) {
      this.logger.error(`💥 Create failed`, error);

      if (error.code === 'P2002') {
        throw new BadRequestException('Duplicate slug');
      }

      throw new BadRequestException('Create failed');
    }
  }

  // ================== UPDATE ==================
  async updateProduct(id: string, data: any) {
    this.logger.log(`✏️ Updating product: ${id}`);

    const {
      extra,
      attributes = [],
      variants = [],
      images = [],
      ...rest
    } = data || {};

    const existing = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!existing) {
      this.logger.error(`❌ Product not found`);
      throw new NotFoundException('Product not found');
    }

    // 🔥 IMAGE DEBUG
    const removedImages = (existing.images || []).filter(
      (img) => !images.includes(img),
    );

    this.logger.log(`🖼 Removed images: ${removedImages.length}`);

    if (removedImages.length) {
      Promise.all(
        removedImages.map((url) => this.cloudinary.deleteImage(url)),
      ).catch((e) => this.logger.error(`Cloudinary cleanup error`, e));
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        ...rest,
        // ✅ Use UPSERT: Creates 'extra' if the product didn't have it, updates if it does
        ...(extra && {
          extra: {
            upsert: {
              create: {
                safetyInfo: extra.safetyInfo,
                ingredients: extra.ingredients,
                directions: extra.directions,
                legalDisclaimer: extra.legalDisclaimer,
                manufacturer: extra.manufacturer,
                countryOfOrigin: extra.countryOfOrigin,
                weight: extra.weight,
                dimensions: extra.dimensions,
                genericName: extra.genericName,
                aPlusContent: extra.aPlusContent || [],
              },
              update: {
                safetyInfo: extra.safetyInfo,
                ingredients: extra.ingredients,
                directions: extra.directions,
                legalDisclaimer: extra.legalDisclaimer,
                manufacturer: extra.manufacturer,
                countryOfOrigin: extra.countryOfOrigin,
                weight: extra.weight,
                dimensions: extra.dimensions,
                genericName: extra.genericName,
                aPlusContent: extra.aPlusContent || [],
              },
            },
          },
        }),
        images,
        attributes: {
          deleteMany: {},
          create: attributes.map((a: any) => ({
            name: a.name,
            value: a.value,
          })),
        },
        variants: {
          deleteMany: {},
          create: variants.map((v: any) => ({
            name: v.name,
            priceModifier: +v.priceModifier || 0,
            stock: +v.stock || 0,
          })),
        },
      },
      include: {
        extra: true, // ✅ Ensure Admin Panel receives the updated extra data back
        attributes: true,
        variants: true,
        category: true,
      },
    });
    // 🧹 CACHE INVALIDATION
  // 1. Remove the specific product cache so the next 'getProductBySlug' fetches fresh data.
  await this.cacheManager.del(`product:${updated.slug}`);
  
  // 2. Invalidate the store catalog cache so list views are updated.
  await this.invalidateCatalogCache(updated.storeId);

    this.logger.log(`✅ Updated product`);
    return updated;
  }

  // ================== DELETE ==================
  async deleteProduct(id: string) {
    this.logger.log(`🗑 Deleting product: ${id}`);

    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      this.logger.error(`❌ Product not found`);
      throw new NotFoundException('Product not found');
    }

    if (product.images?.length) {
      this.logger.log(`🧹 Cleaning ${product.images.length} images`);

      Promise.all(
        product.images.map((url) => this.cloudinary.deleteImage(url)),
      ).catch((e) => this.logger.error(`Cloudinary delete error`, e));
    }

    await this.prisma.product.delete({ where: { id } });

    await this.invalidateCatalogCache(product.storeId);

    this.logger.log(`✅ Product deleted`);
    return product;
  }

  // ================== CACHE ==================
  async invalidateCatalogCache(storeId: string) {
    this.logger.log(`🧠 Invalidating cache for store: ${storeId}`);

    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
    });

    if (store) {
      await this.cacheManager.del(`catalog:${store.slug}`);
      this.logger.log(`✅ Cache cleared`);
    }
  }

  // ================== ALL PRODUCTS ==================
  async getAllProducts() {
    this.logger.log(`📦 Fetching ALL products`);

    return this.prisma.product.findMany({
      include: {
        category: true,
        store: true,
        attributes: true,
        variants: true,
        extra: true, // ✅ Helpful for admin listing exports
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ================== DOMAIN RESOLVER ==================
  /**
   * Production-Grade Store Resolver
   * Extracts domain, strips ports, and handles fallbacks securely.
   */
 async resolveStoreSlug(req: Request): Promise<string> {
  const start = Date.now();

  this.logger.log('🌐 [Store Resolver] Incoming request');

  // 1. Extract raw domain
  const rawDomain =
    (req.headers['x-tenant-domain'] as string) ||
    (req.headers.origin
      ? new URL(req.headers.origin).hostname
      : null) ||
    (req.headers.host as string);

  this.logger.debug(`📥 Raw Domain: ${rawDomain}`);

  // 2. Clean domain (remove port)
  const searchDomain = rawDomain ? rawDomain.split(':')[0] : null;

  this.logger.debug(`🧹 Clean Domain: ${searchDomain}`);

  // 3. Try domain-based resolution
  if (searchDomain) {
    this.logger.log(`🔍 Searching store by domain: ${searchDomain}`);

    const storeByDomain = await this.prisma.store.findFirst({
      where: { domain: searchDomain },
    });

    if (storeByDomain) {
      this.logger.log(
        `✅ Store found by domain → ${storeByDomain.slug} (${storeByDomain.name})`,
      );
      this.logger.log(`⏱ Resolve Time: ${Date.now() - start}ms`);
      return storeByDomain.slug;
    }

    this.logger.warn(`⚠️ No store mapped to domain: ${searchDomain}`);
  } else {
    this.logger.warn(`⚠️ No domain extracted from request`);
  }

  // 4. Fallback to default store
  this.logger.log(`🔄 Trying fallback to default store`);

  const defaultStore = await this.prisma.store.findFirst({
    where: { isDefault: true },
  });

  if (defaultStore) {
    this.logger.warn(
      `⚠️ Using DEFAULT store → ${defaultStore.slug} (${defaultStore.name})`,
    );
    this.logger.log(`⏱ Resolve Time: ${Date.now() - start}ms`);
    return defaultStore.slug;
  }

  // 5. Critical failure
  this.logger.error(`❌ CRITICAL: No store found for domain or default`);
  this.logger.error(`👉 Raw Domain: ${rawDomain}`);
  this.logger.error(`👉 Clean Domain: ${searchDomain}`);

  throw new BadRequestException(
    'Critical: No store mapped to this domain and no default store is configured in the database.',
  );
}
}