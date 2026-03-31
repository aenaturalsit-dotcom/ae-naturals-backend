import { PrismaClient, Role, ProviderType, APlusBlockType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

// ----------------------------------------------------
// DATABASE CONNECTION (Production Safe)
// ----------------------------------------------------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: ['warn', 'error'],
});

// ----------------------------------------------------
// UTILITY FUNCTIONS
// ----------------------------------------------------
const randomPhone = (i: number) => `90000000${i.toString().padStart(2, '0')}`;

const randomPrice = () => Math.floor(Math.random() * 1000) + 199;

const productImages = [
  'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d',
  'https://images.unsplash.com/photo-1615485737651-3c3d5c7a2e7d',
  'https://images.unsplash.com/photo-1589302168068-964664d93dc0',
];

// ----------------------------------------------------
// MAIN SEED FUNCTION
// ----------------------------------------------------
async function main() {
  console.log('🌱 Starting database seed...');

 const tx = prisma;
    // ------------------------------------------------
    // 1. CREATE ADMINS
    // ------------------------------------------------
    const adminEmails = [
      'admin1@store.com',
      'admin2@store.com',
      'admin3@store.com',
    ];

    const admins: Awaited<ReturnType<typeof tx.user.upsert>>[] = [];

    for (let i = 0; i < adminEmails.length; i++) {
      const admin = await tx.user.upsert({
        where: { email: adminEmails[i] },
        update: {},
        create: {
          email: adminEmails[i],
          phone: randomPhone(i),
          name: `Admin ${i + 1}`,
          role: Role.ADMIN,
        },
      });

      admins.push(admin);
    }

    console.log(`👑 Admin users created: ${admins.length}`);

    // ------------------------------------------------
    // 2. CREATE NORMAL USERS
    // ------------------------------------------------
    const users: Awaited<ReturnType<typeof tx.user.upsert>>[] = [];

    for (let i = 1; i <= 10; i++) {
      const user = await tx.user.upsert({
        where: { phone: randomPhone(i + 10) },
        update: {},
        create: {
          email: `user${i}@mail.com`,
          phone: randomPhone(i + 10),
          name: `User ${i}`,
          role: Role.USER,
        },
      });

      users.push(user);
    }

    console.log(`👤 Users created: ${users.length}`);

    // ------------------------------------------------
    // 3. STORE
    // ------------------------------------------------
    const store = await tx.store.upsert({
      where: { slug: 'default-store' },
      update: {},
      create: {
        name: 'AE Naturals Store',
        slug: 'default-store',
        industry: 'Health & Wellness',
        isDefault: true,
      },
    });

    console.log(`🏪 Store ready`);

    // ------------------------------------------------
    // 4. CATEGORIES
    // ------------------------------------------------
    const categories = await Promise.all([
      tx.category.upsert({
        where: { slug: 'flowers' },
        update: {},
        create: { name: 'Flowers', slug: 'flowers' },
      }),
      tx.category.upsert({
        where: { slug: 'cakes' },
        update: {},
        create: { name: 'Cakes', slug: 'cakes' },
      }),
      tx.category.upsert({
        where: { slug: 'wellness' },
        update: {},
        create: { name: 'Wellness', slug: 'wellness' },
      }),
    ]);

    console.log(`📦 Categories created`);

    // ------------------------------------------------
    // 5. CREATE 15 PRODUCTS
    // ------------------------------------------------
    const productNames = [
      'Red Rose Bouquet',
      'Chocolate Cake',
      'Tulip Flowers',
      'Lavender Oil',
      'Vanilla Cake',
      'Rose Water',
      'Orchid Basket',
      'Strawberry Cake',
      'Aloe Vera Gel',
      'Jasmine Flowers',
      'Honey Face Pack',
      'Dry Fruit Cake',
      'Herbal Tea',
      'Lotus Bouquet',
      'Organic Shampoo',
    ];

    const products: Awaited<ReturnType<typeof tx.product.upsert>>[] = [];

    for (let i = 0; i < productNames.length; i++) {
      const category = categories[i % categories.length];

      const product = await tx.product.upsert({
        where: { slug: productNames[i].toLowerCase().replace(/ /g, '-') },
        update: {},
        create: {
          storeId: store.id,
          name: productNames[i],
          slug: productNames[i].toLowerCase().replace(/ /g, '-'),
          description: `${productNames[i]} premium product`,
          price: randomPrice(),
          oldPrice: randomPrice() + 200,
          images: productImages,
          categoryId: category.id,
          ingredients: 'Natural ingredients',
          careInstructions: ['Keep in cool place', 'Avoid sunlight'],
          deliveryInfo: ['Same day delivery', 'Free delivery above ₹999'],

          attributes: {
            create: [
              { name: 'Quality', value: 'Premium' },
              { name: 'Origin', value: 'India' },
            ],
          },

          variants: {
            create: [
              { name: 'Standard', priceModifier: 0, stock: 100 },
              { name: 'Premium', priceModifier: 200, stock: 50 },
            ],
          },

          extra: {
            create: {
              manufacturer: 'AE Naturals',
              countryOfOrigin: 'India',
              weight: '500g',
              dimensions: '10x10',
              genericName: 'Natural Product',
            },
          },
        },
      });

      products.push(product);
    }

    console.log(`🛍️ Products created: ${products.length}`);

    // ------------------------------------------------
    // 6. ADD A+ CONTENT BLOCKS
    // ------------------------------------------------
    for (const product of products) {
      await tx.aPlusContent.createMany({
        data: [
          {
            productId: product.id,
            type: APlusBlockType.BANNER,
            order: 1,
            content: {
              image: productImages[0],
              title: 'Premium Quality',
            },
          },
          {
            productId: product.id,
            type: APlusBlockType.TEXT,
            order: 2,
            content: {
              text: 'Best product in category',
            },
          },
        ],
      });
    }

    console.log(`🧩 A+ content added`);

    // ------------------------------------------------
    // 7. PROVIDER CONFIG
    // ------------------------------------------------
    await tx.providerConfig.createMany({
      data: [
        {
          type: ProviderType.EMAIL,
          provider: 'SMTP',
          isActive: true,
          priority: 1,
          config: JSON.stringify({
            host: 'smtp.office365.com',
            port: 587,
            user: 'mail@test.com',
            password: 'password',
          }),
        },
        {
          type: ProviderType.SMS,
          provider: 'MSG91',
          isActive: true,
          priority: 1,
          config: JSON.stringify({
            apiKey: 'MSG91_KEY',
          }),
        },
        {
          type: ProviderType.PAYMENT,
          provider: 'RAZORPAY',
          isActive: true,
          priority: 1,
          config: JSON.stringify({
            key_id: 'rzp_test',
            key_secret: 'rzp_secret',
          }),
        },
      ],
      skipDuplicates: true,
    });

    console.log(`⚙️ Provider configs created`);

    // ------------------------------------------------
    // 8. SHIPPING RULES
    // ------------------------------------------------
    await tx.shippingRule.createMany({
      data: [
        {
          storeId: store.id,
          pincode: '560001',
          deliveryCharge: 40,
        },
        {
          storeId: store.id,
          pincode: '560059',
          deliveryCharge: 50,
        },
        {
          storeId: store.id,
          pincode: '400001',
          deliveryCharge: 60,
        },
      ],
    });

    console.log(`🚚 Shipping rules added`);


  console.log('🎉 Seed completed successfully');
}

// ----------------------------------------------------
// RUN SEED
// ----------------------------------------------------
main()
  .catch((e) => {
    console.error('❌ Seed failed', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });