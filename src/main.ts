import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { join } from 'path';
import * as express from 'express';
import * as path from 'path';
import * as fs from 'fs/promises';

async function ensureUploadDir() {
  const dir = path.join(__dirname, '..', 'uploads', 'avatars');
  await fs.mkdir(dir, { recursive: true });
}

async function bootstrap(): Promise<void> {
  await ensureUploadDir();
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Global configuration
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // CORS
  app.enableCors({
    origin: configService.get<string>('CORS_ORIGIN', 'http://localhost:3000'),
    credentials: true,
  });

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Serve static files (avatars)
  app.use(
    '/uploads/avatars',
    express.static(join(__dirname, '..', 'uploads', 'avatars')),
  );

  // Swagger/OpenAPI Documentation
  const config = new DocumentBuilder()
    .setTitle('CodeMaster API')
    .setDescription('API for CodeMaster e-learning platform')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'access-token',
    )
    .addTag('Auth')
    .addTag('Users') // <-- Ajouter
    .addTag('Courses')
    .addTag('Lessons')
    .addTag('Modules')
    .addTag('Exercises')
    .addTag('Comments')
    .addTag('Notifications')
    .addTag('Progress')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = configService.get<number>('PORT', 5000);
  await app.listen(port);

  console.log(`🚀 Application running on port ${port}`);
  console.log(`📚 Swagger documentation: http://localhost:${port}/api/docs`);
}

void bootstrap();
