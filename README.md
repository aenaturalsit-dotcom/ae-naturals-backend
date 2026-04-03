# 🌸 AE Naturals Backend

The **AE Naturals Backend** is a **production-grade, scalable Multi-Tenant E-Commerce API** built using **NestJS**, **Prisma**, **PostgreSQL**, **Redis**, and **Cloudinary**.
It powers the complete AE Naturals ecosystem including:

• Customer storefront (frontend)
• Admin dashboard
• Payment processing
• Messaging infrastructure
• Media optimization

The system is designed with a **modular architecture**, enabling independent scaling of core services such as authentication, product management, orders, and payment gateways.

This backend focuses on:

• Security
• Performance
• Scalability
• Multi-store support
• Clean architecture


# 🎯 Project Goals

The backend was designed to achieve the following:

• Provide a reliable API for high-traffic e-commerce applications
• Support multiple storefronts within a single system
• Implement secure password-less authentication
• Enable fast product catalog delivery
• Handle real-time cart and order workflows
• Integrate global and regional payment systems

---

# 🏗 System Architecture

The backend follows a **modular NestJS architecture** with clear separation of responsibilities.

### Core Architectural Layers

**Controller Layer**
Handles incoming HTTP requests and response formatting.

**Service Layer**
Contains business logic such as:

• Order processing
• Cart management
• OTP verification
• Payment workflows

**Data Layer**
Managed using:

Prisma ORM + PostgreSQL

This layer ensures:

• Type-safe database queries
• Schema consistency
• Migration management

**Infrastructure Layer**
Handles external integrations like:

Redis caching
Cloudinary media storage
Messaging services
Payment gateways

---

# ✨ Core Features

## 🔐 Password-less OTP Authentication

The system replaces traditional password login with a **secure OTP-based authentication mechanism**.

### How Authentication Works

1 User enters phone or email
2 OTP is generated and stored securely
3 OTP is delivered via SMS or Email
4 User verifies OTP
5 JWT token is issued

### Security Implementation

• OTPs are hashed using SHA-256 before storage
• Tokens expire automatically
• Rate limiting prevents abuse
• Secure JWT session management

### Messaging Channels

SMS via Fast2SMS
Email via Amazon SES

This approach improves both **security and user experience**.

---

## 🏬 Multi-Tenant Store Architecture

The platform supports **multiple independent stores** running on the same backend.

Each store has:

• Unique product catalog
• Independent pricing
• Branding configuration
• Business metadata

This architecture enables:

Marketplace platforms
Multi-brand businesses
White-label deployments

---

## 🛒 Cart Management System

The backend maintains persistent cart states for authenticated users.

Key capabilities:

• Cart item persistence
• Quantity updates
• Price validation
• Cart synchronization

This ensures that:

Users never lose their cart items
Orders remain consistent
Pricing stays validated

---

## 📦 Order Processing & Lifecycle

The order system manages the complete order lifecycle.

Supported order statuses:

PENDING
PAID
PROCESSING
SHIPPED
DELIVERED
CANCELLED

Features include:

Order creation
Status updates
Payment verification
Customer association
Inventory updates

---

## 💳 Payment Gateway Integration

The system integrates multiple payment providers to support global and local payments.

### Supported Gateways

Stripe
Razorpay
PhonePe

This allows:

International card payments
UPI payments
Local Indian payment options

Payment architecture includes:

Webhook verification
Transaction validation
Secure payment handling

---

## ⚡ Performance Optimization

### Redis Caching

Redis is used to cache:

Product catalogs
Store configuration
Popular queries

Benefits include:

Reduced database load
Faster API responses
Improved scalability

Average cached response time:

< 200ms

---

### Cloudinary Media Optimization

All product images are processed through Cloudinary.

Features include:

Automatic WebP conversion
AVIF optimization
Dynamic resizing
CDN delivery

This ensures:

Faster image loading
Reduced bandwidth usage
Better SEO performance

---

# 🛠 Technology Stack

| Layer          | Technology                |
| -------------- | ------------------------- |
| Framework      | NestJS                    |
| Database       | PostgreSQL                |
| ORM            | Prisma                    |
| Caching        | Redis                     |
| Authentication | JWT + Passport            |
| OTP System     | Fast2SMS + Amazon SES     |
| Payments       | Stripe, Razorpay, PhonePe |
| Media Storage  | Cloudinary                |
| Validation     | Zod + Class-validator     |

---

# 📂 Detailed Project Structure

```text
src/
```

## admin/

Handles administrative operations such as:

Product management
Store configuration
Order oversight

This module powers the **admin dashboard**.

---

## auth/

Responsible for authentication logic.

Includes:

OTP generation
JWT strategy
Session guards
User authentication flows

---

## cart/

Manages shopping cart functionality.

Handles:

Cart creation
Item updates
Cart persistence
Checkout validation

---

## categories/

Organizes product categories for the storefront.

Supports:

Nested categories
Catalog filtering
Category management

---

## common/

Shared modules used across the application.

### cache/

Redis caching integration.

### messaging/

Unified messaging service for:

Email
SMS notifications

### cloudinary.service

Handles:

Image upload
Transformation
Optimization

---

## health/

Provides system monitoring endpoints.

Includes:

Database health checks
Redis connectivity checks
Service availability monitoring

Useful for:

DevOps monitoring
Deployment checks

---

## logistics/

Handles shipping and delivery rules.

Includes:

Shipping calculations
Delivery zones
Fulfillment logic

---

## orders/

Manages order creation and lifecycle.

Handles:

Order placement
Payment confirmation
Status updates
Customer association

---

## payments/

Contains payment gateway integrations.

Modules include:

Stripe provider
Razorpay provider
PhonePe provider

Handles:

Transaction verification
Payment intents
Webhook events

---

## prisma/

Database-related functionality.

Includes:

Prisma client setup
Database migrations
Health indicators

---

## products/

Public-facing product catalog logic.

Includes:

Product discovery
Search functionality
Filtering logic
Catalog APIs

---

# ⚙️ Environment Variables

These variables must be configured for the backend to operate properly.

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/flower_fairy

# AWS SES
MY_AWS_ACCESS_KEY=your_access_key
MY_AWS_SECRET_KEY=your_secret_key
AWS_REGION=ap-south-1
AWS_SES_SOURCE=noreply@flowerfairy.com

# Fast2SMS
FAST2SMS_KEY=your_api_key

# Payments
STRIPE_SECRET_KEY=sk_test_...
RAZORPAY_KEY_ID=rzp_test_...
PHONEPE_MERCHANT_ID=...

# Authentication
OTP_EXPIRY_MINUTES=5
JWT_SECRET=your_jwt_secret
```

---

# 🚀 Getting Started

## 1. Install Dependencies

```bash
pnpm install
```

or

```bash
npm install
```

---

## 2. Setup Database

Generate Prisma client and apply schema:

```bash
pnpm exec prisma generate
pnpm run db:deploy
```

Alternative method:

```bash
npx prisma format
npx prisma db push
npx prisma generate
```

---

## 3. Run the Server

```bash
pnpm run start:dev
```

or

```bash
npm run start:dev
```

The API will start on:

```
http://localhost:4000
```

---

# 🧪 Messaging Test Endpoints (Development Only)

These endpoints help verify your messaging configuration.

### Test SMS

```
GET /api/v1/test-messaging/sms?phone=99XXXXXXXX
```

### Test Email

```
GET /api/v1/test-messaging/email?email=test@example.com
```

These should only be used in development environments.

---

# 🔄 Repository Strategy

The project follows a **dual-repository deployment workflow**.

### Development Repository

Used for active feature development and testing.

Repository:
gusainDeekshu/flower-fairy-backend

---

### Production Repository

Used for stable deployment builds.

Repository:
flowerfairydehradun-spec/flower-fairy-backend

---

# 🔐 Security Practices

Several security strategies are implemented:

OTP hashing with SHA-256
JWT-based session control
Secure environment variables
Input validation via Zod
Rate limiting for authentication endpoints

These measures help prevent:

Unauthorized access
Token misuse
Data tampering

---

# 📈 Performance Strategies

The backend is optimized for scale.

Key optimizations include:

Redis caching
Efficient database queries via Prisma
CDN image delivery
Modular NestJS architecture
Lazy-loaded modules

---

# 🔮 Future Roadmap

The system is designed to support upcoming features such as:

Advanced analytics module
Marketing automation
Inventory forecasting
Delivery partner integrations
AI-powered recommendations

---

# 👨‍💻 Author

Deekshant Gusain

GitHub
[https://github.com/gusainDeekshu](https://github.com/gusainDeekshu)

Portfolio
[https://deekshantportfoliosite.netlify.app](https://deekshantportfoliosite.netlify.app)

---

# 📄 License

This project is licensed under the **MIT License**.

You are free to:

Use
Modify
Distribute
Deploy commercially