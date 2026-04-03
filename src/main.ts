import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const logger = new Logger('CORS');
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  
  app.use(cookieParser());
  app.setGlobalPrefix('api/v1');


  const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || [];
  
  app.enableCors({
    origin: (origin, callback) => {
      // 1. Logs the incoming origin for every cross-origin request
      // Note: This will be 'undefined' for direct browser navigation or server-to-server calls
      const originDisplay = origin || 'Direct/Server Request (Undefined)';

      // 2. Handle specific bypass cases
      if (!origin || origin === 'null') {
        logger.debug(`✅ Allowed Bypass: ${originDisplay}`);
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // 3. Reject and Log unauthorized attempts
      logger.error(`❌ Access Denied: ${origin}`);
      return callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Multi-Tenant E-Commerce API')
    .setDescription('Production API for Flowers, Cakes, and Apparel stores')
    .setVersion('1.0')
    .addTag('products')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/v1/docs', app, document);

  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();