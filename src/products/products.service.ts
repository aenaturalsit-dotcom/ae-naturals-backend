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
                extra: true, 
              },
            },
          },
        });

        if (!store) {
          throw new NotFoundException(`Store ${slug} not found`);
        }

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
      return cached;
    }

    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: {
        category: true,
        attributes: true,
        variants: true,
        extra: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    await this.cacheManager.set(cacheKey, product, 600000);
    return product;
  }

  // ================== SIMILAR ==================
  async getSimilarProducts(categorySlug: string) {
    const data = await this.prisma.product.findMany({
      where: {
        category: { slug: categorySlug },
        isActive: true,
      },
      take: 4,
      include: {
        category: true,
        variants: true,
        extra: true,
      },
    });

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
      highlightIds = [], // <-- NEW: Extract highlightIds from payload
      ...rest
    } = data || {};

    if (!rest.storeId) throw new BadRequestException('Store ID required');
    if (!rest.categoryId) throw new BadRequestException('Category ID required');

    const slug = rest.slug || rest.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    try {
      const product = await this.prisma.product.create({
        data: {
          ...rest,
          slug,
          careInstructions,
          deliveryInfo,
          ...(extra && {
            extra: {
              create: {
                safetyInfo: extra.safetyInfo || null,
                ingredients: extra.ingredients || null,
                directions: extra.directions || null,
                legalDisclaimer: extra.legalDisclaimer || null,
                manufacturer: extra.manufacturer || null,
                countryOfOrigin: extra.countryOfOrigin || null,
                weight: extra.weight || null,
                dimensions: extra.dimensions || null,
                genericName: extra.genericName || null,
                aPlusContent: Array.isArray(extra.aPlusContent) ? extra.aPlusContent : [], 
              },
            },
          }),
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
          // ✅ NEW: Connect Product to Highlights preserving the drag-and-drop order
          ...(highlightIds && highlightIds.length > 0 && {
            highlights: {
              create: highlightIds.map((id: string, index: number) => ({
                highlight: { connect: { id } },
                order: index, // Saves the order they were selected in the UI
              })),
            },
          }),
        },
        include: {
          extra: true,
          attributes: true,
          variants: true,
          category: true,
          store: true,
          // ✅ NEW: Return the newly mapped highlights so the UI updates properly
          highlights: { 
            include: {
              highlight: true
            },
            orderBy: {
              order: 'asc'
            }
          },
        },
      });

      return product;
    } catch (error: any) {
      this.logger.error(`💥 Create failed`, error);
      if (error.code === 'P2002') throw new BadRequestException('Duplicate slug');
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
      highlightIds, // <-- NEW: Extract highlightIds
      ...rest
    } = data || {};

    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Product not found');

    const removedImages = (existing.images || []).filter((img) => !images.includes(img));
    if (removedImages.length) {
      Promise.all(removedImages.map((url) => this.cloudinary.deleteImage(url)))
        .catch((e) => this.logger.error(`Cloudinary cleanup error`, e));
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        ...rest,
        images,
        ...(extra !== undefined && {
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
                aPlusContent: Array.isArray(extra.aPlusContent) ? extra.aPlusContent : [],
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
                aPlusContent: Array.isArray(extra.aPlusContent) ? extra.aPlusContent : [],
              },
            },
          },
        }),
        attributes: {
          deleteMany: {},
          create: attributes.map((a: any) => ({ name: a.name, value: a.value })),
        },
        variants: {
          deleteMany: {},
          create: variants.map((v: any) => ({
            name: v.name,
            priceModifier: +v.priceModifier || 0,
            stock: +v.stock || 0,
          })),
        },
        // ✅ NEW: Replace existing highlight mappings with the newly sorted array
        ...(highlightIds !== undefined && {
          highlights: {
            deleteMany: {}, // Clear existing mappings
            create: highlightIds.map((highlightId: string, index: number) => ({
              highlight: { connect: { id: highlightId } },
              order: index, // Preserve the order sent from the frontend
            })),
          },
        }),
      },
      include: {
        extra: true,
        attributes: true,
        variants: true,
        category: true,
        // ✅ NEW: Return the updated highlights array sorted by their order
        highlights: {
          include: {
            highlight: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    await this.cacheManager.del(`product:${updated.slug}`);
    await this.invalidateCatalogCache(updated.storeId);

    return updated;
  }

  // ================== DELETE ==================
  async deleteProduct(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');

    if (product.images?.length) {
      Promise.all(product.images.map((url) => this.cloudinary.deleteImage(url)))
        .catch((e) => this.logger.error(`Cloudinary delete error`, e));
    }

    await this.prisma.product.delete({ where: { id } });
    await this.invalidateCatalogCache(product.storeId);
    return product;
  }

  // ================== CACHE ==================
  async invalidateCatalogCache(storeId: string) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (store) {
      await this.cacheManager.del(`catalog:${store.slug}`);
    }
  }

  // ================== ALL PRODUCTS ==================
  async getAllProducts() {
    return this.prisma.product.findMany({
      include: {
        category: true,
        store: true,
        attributes: true,
        variants: true,
        extra: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ================== DOMAIN RESOLVER ==================
  async resolveStoreSlug(req: Request): Promise<string> {
    const rawDomain = (req.headers['x-tenant-domain'] as string) || (req.headers.origin ? new URL(req.headers.origin).hostname : null) || (req.headers.host as string);
    const searchDomain = rawDomain ? rawDomain.split(':')[0] : null;

    if (searchDomain) {
      const storeByDomain = await this.prisma.store.findFirst({ where: { domain: searchDomain } });
      if (storeByDomain) return storeByDomain.slug;
    }

    const defaultStore = await this.prisma.store.findFirst({ where: { isDefault: true } });
    if (defaultStore) return defaultStore.slug;

    throw new BadRequestException('Critical: No store mapped to this domain and no default store is configured.');
  }

  // --- PRODUCT HIGHLIGHTS LOGIC ---

  // ================== GET PRODUCT HIGHLIGHTS ==================
  // ✅ NEW: Added this method to serve the frontend component
  async getProductHighlights(productId: string) {
    console.log(`Fetching highlights for product ID: ${productId}`);
    
    const mappings = await this.prisma.productHighlight.findMany({
      where: {
        productId,
        isActive: true,
        highlight: { isActive: true }, 
      },
      orderBy: { order: 'asc' },
      include: {
        highlight: {
          select: { id: true, title: true, icon: true, color: true},
        },
      },
    });
    console.log(`Found ${mappings.length} highlights for product ID: ${productId}`);

    return mappings.map((m) => ({
      mappingId: m.id,
      id: m.highlight.id,
      title: m.highlight.title,
      icon: m.highlight.icon,
      order: m.order,
      color: m.highlight.color, // <-- Ensure color is included in the response
    }));
  }
  
  // For Admin Backend: Sync highlights for a product
  async syncProductHighlights(productId: string, highlightIds: string[]) {
    // 1. Interactive transaction to safely clear and recreate mappings
    return this.prisma.$transaction(async (tx) => {
      // Clear existing mappings
      await tx.productHighlight.deleteMany({
        where: { productId },
      });

      // Insert new mappings with sequential ordering
      if (highlightIds && highlightIds.length > 0) {
        const mappings = highlightIds.map((highlightId, index) => ({
          productId,
          highlightId,
          order: index, // Preserves the array order from the frontend drag-and-drop
        }));

        await tx.productHighlight.createMany({
          data: mappings,
        });
      }

      return { success: true, count: highlightIds.length };
    });
  }
}