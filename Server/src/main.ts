import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.startsWith('replace-')) throw new Error('Set JWT_SECRET to a random secret of at least 32 characters');
  app.enableCors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:3000', credentials: true });
  app.enableShutdownHooks();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  // Bounded, expiring per-IP auth limit. Use a shared gateway limit for multiple replicas.
  const attempts = new Map<string, { count: number; reset: number }>();
  app.use((req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'POST' && ['/auth/login', '/auth/register'].includes(req.path)) {
      const now = Date.now();
      for (const [key, value] of attempts) if (value.reset < now) attempts.delete(key);
      const key = req.ip ?? 'unknown';
      const value = attempts.get(key) ?? { count: 0, reset: now + 60000 };
      value.count++; attempts.set(key, value);
      if (value.count > 15 || attempts.size > 10000) { res.status(429).json({ message: 'Too many attempts. Try again in a minute.' }); return; }
    }
    next();
  });
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('Ledgerflow API').setVersion('1.0').addBearerAuth().build()));
  await app.listen(process.env.PORT ?? 4000);
}
await bootstrap();
