import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const host = configService.getOrThrow<string>('config.api.host');
  const port = configService.getOrThrow<number>('config.api.port');
  const environment = configService.getOrThrow<string>('config.app.environment');
  const apiVersion = configService.getOrThrow<number>('config.api.apiVersion');

  const corsOrigins = configService.getOrThrow<string[]>('config.api.corsOrigins');

  const globalPrefix = `api/v${apiVersion}`;
  app.setGlobalPrefix(globalPrefix);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'connect-src': ["'self'", ...corsOrigins],
          'default-src': ["'self'"],
        },
      },
    })
  );

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    })
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Shipping Operations & Accounting ERP - API')
    .setDescription('Phase 1 foundation API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  await app.listen(port, host);
  logger.log(`API listening on http://${host}:${port}/${globalPrefix}`);
  logger.log(`Swagger available at http://${host}:${port}/docs`);
  logger.log(`Environment: ${environment}`);
}

void bootstrap();
