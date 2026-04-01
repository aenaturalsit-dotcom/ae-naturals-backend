import {
  PrismaClient,
  Role,
  ProviderType,
  APlusBlockType,
  CartOwnerType,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

// ---------------- DB ----------------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
  log: ['warn', 'error'],
});

// ---------------- UTILS ----------------
const phone = (i: number) => `90000000${i.toString().padStart(2, '0')}`;
const price = () => Math.floor(Math.random() * 1000) + 199;

const images = [
  'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d',
  'https://images.unsplash.com/photo-1615485737651-3c3d5c7a2e7d',
  'https://images.unsplash.com/photo-1589302168068-964664d93dc0',
];

// ---------------- MAIN ----------------
async function main() {
  console.log('🌱 Seeding started...');

  // ---------------- USERS ----------------
  const admins: any[] = [];

  for (let i = 1; i <= 3; i++) {
    const user = await prisma.user.upsert({
      where: { phone: phone(i) },
      update: {},
      create: {
        phone: phone(i),
        email: `admin${i}@mail.com`,
        name: `Admin ${i}`,
        role: Role.ADMIN,
      },
    });
    admins.push(user);
  }
  const users: any[] = [];

  for (let i = 10; i < 20; i++) {
    const user = await prisma.user.upsert({
      where: { phone: phone(i) },
      update: {},
      create: {
        phone: phone(i),
        email: `user${i}@mail.com`,
        name: `User ${i}`,
      },
    });
    users.push(user);
  }

  console.log('👤 Users seeded');

  // ---------------- STORE ----------------
  const store = await prisma.store.upsert({
    where: { slug: 'default-store' },
    update: {},
    create: {
      name: 'AE Naturals',
      slug: 'default-store',
      industry: 'Wellness',
      isDefault: true,
    },
  });

  // ---------------- CATEGORY ----------------
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { slug: 'flowers' },
      update: {},
      create: { name: 'Flowers', slug: 'flowers' },
    }),
    prisma.category.upsert({
      where: { slug: 'cakes' },
      update: {},
      create: { name: 'Cakes', slug: 'cakes' },
    }),
    prisma.category.upsert({
      where: { slug: 'wellness' },
      update: {},
      create: { name: 'Wellness', slug: 'wellness' },
    }),
  ]);

  console.log('📦 Categories ready');

  // ---------------- GLOBAL HIGHLIGHTS ----------------
  const highlight1 = await prisma.featureHighlight.create({
    data: {
      title: '100% Natural',
      icon: 'leaf',
      isGlobal: true,
    },
  });

  const highlight2 = await prisma.featureHighlight.create({
    data: {
      title: 'Fast Delivery',
      icon: 'truck',
      isGlobal: true,
    },
  });

  // ---------------- PRODUCTS ----------------
  const productNames = [
    'Rose Bouquet',
    'Chocolate Cake',
    'Lavender Oil',
    'Aloe Vera Gel',
    'Herbal Tea',
  ];

  const products: any[] = [];

  for (let i = 0; i < productNames.length; i++) {
    const category = categories[i % categories.length];

    const product = await prisma.product.upsert({
      where: {
        slug: productNames[i].toLowerCase().replace(/ /g, '-'),
      },
      update: {},
      create: {
        name: productNames[i],
        slug: productNames[i].toLowerCase().replace(/ /g, '-'),
        storeId: store.id,
        categoryId: category.id,
        price: price(),
        oldPrice: price() + 200,
        images,
        stock: 50,

        ingredients: 'Natural ingredients',
        careInstructions: ['Keep cool'],
        deliveryInfo: ['Same day delivery'],

        attributes: {
          create: [
            { name: 'Quality', value: 'Premium' },
            { name: 'Origin', value: 'India' },
          ],
        },

        variants: {
          create: [
            { name: 'Standard', stock: 100 },
            { name: 'Premium', priceModifier: 200, stock: 50 },
          ],
        },

        extra: {
          create: {
            manufacturer: 'AE Naturals',
            countryOfOrigin: 'India',
            weight: '500g',
            genericName: 'Natural Product',
          },
        },
      },
    });

    // attach highlights
    await prisma.productHighlight.createMany({
      data: [
        { productId: product.id, highlightId: highlight1.id },
        { productId: product.id, highlightId: highlight2.id },
      ],
      skipDuplicates: true,
    });

    // A+ Content
    await prisma.aPlusContent.createMany({
      data: [
        {
          productId: product.id,
          type: APlusBlockType.BANNER,
          order: 1,
          content: {
            title: 'Premium Quality',
            image: images[0],
          },
        },
        {
          productId: product.id,
          type: APlusBlockType.TEXT,
          order: 2,
          content: {
            text: 'Best in category',
          },
        },
      ],
    });

    products.push(product);
  }

  console.log('🛍️ Products created');

  // ---------------- CART ----------------
  for (const user of users) {
    const cart = await prisma.cart.create({
      data: {
        tenantId: store.id,
        ownerType: CartOwnerType.USER,
        userId: user.id,
      },
    });

    // add 1 item
    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId: products[0].id,
        quantity: 2,
        priceSnapshot: products[0].price,
        tenantId: store.id,
      },
    });
  }

  console.log('🛒 Cart seeded');

  // ---------------- PROVIDERS ----------------
  await prisma.providerConfig.createMany({
    data: [
      {
        type: ProviderType.EMAIL,
        provider: 'SMTP',
        isActive: true,
        config: JSON.stringify({ host: 'smtp.test.com' }),
      },
      {
        type: ProviderType.PAYMENT,
        provider: 'RAZORPAY',
        isActive: true,
        config: JSON.stringify({ key: 'rzp_test' }),
      },
    ],
    skipDuplicates: true,
  });

  // ---------------- SHIPPING ----------------
  await prisma.shippingRule.createMany({
    data: [
      { storeId: store.id, pincode: '400001', deliveryCharge: 50 },
      { storeId: store.id, pincode: '560001', deliveryCharge: 40 },
    ],
  });

  console.log('🚚 Shipping done');

  console.log('🎉 SEED COMPLETE');
}

// ---------------- RUN ----------------
main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
