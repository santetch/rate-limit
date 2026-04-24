import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN || '',
    integrations: [nodeProfilingIntegration()],
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
  });

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  const logger = app.get(Logger);

  const config = new DocumentBuilder()
    .setTitle('Pokemon Rate Limiter API')
    .setDescription('Challenge implementation of a rate-limited Pokemon API client.')
    .setVersion('1.0')
    .addTag('Pokemon')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);

  logger.log({ port, url: `http://localhost:${port}` }, 'Application started');
  logger.log({ url: `http://localhost:${port}/api/docs` }, 'Swagger documentation available');
}

bootstrap();
