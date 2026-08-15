import { NestFactory } from '@nestjs/core';
import type { Request, Response } from 'express';
import { AppModule } from './app.module';
import { SlackBoltService } from './slack/slack-bolt.service';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { Logger } from './common/logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    logger: WinstonModule.createLogger({ instance: Logger('Nest') }),
  });

  app.enableCors();
  app.use(helmet());
  app.setGlobalPrefix('/api');
  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      stopAtFirstError: true,
    }),
  );

  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  const slackBolt = app.get(SlackBoltService);
  app.use('/slack/events', slackBolt.receiver.router);

  app.getHttpAdapter().get('/', (_req: Request, res: Response) => {
    res.send('Orbit API is running!');
  });

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
void bootstrap();
