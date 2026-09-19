import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  // bodyParser disabled here and applied manually below with an explicit limit --
  // Nest's automatic body parser sets its own default (~100kb) first, and
  // body-parser's re-parse guard (`req._body`) would silently make a
  // second app.use(json(...)) a no-op otherwise.
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const config = app.get(ConfigService);
  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  // File bytes go through multer's own fileSize limit (see FileInterceptor config);
  // this bounds ordinary JSON/form request bodies so a large payload can't tie up
  // memory before validation even runs.
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));
  app.enableCors({
    origin: config.getOrThrow<string>('CORS_ORIGINS').split(','),
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  if (config.get('NODE_ENV') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('ZimMarket API')
      .setDescription('Secure multi-tenant marketplace API')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));
  }
  await app.listen(config.get<number>('PORT', 3000), '0.0.0.0');
}
void bootstrap();
