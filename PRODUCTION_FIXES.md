# 🛠️ Production Fixes - Quick Implementation Guide

This guide provides step-by-step instructions to fix critical production issues.

---

## 🔴 FIX 1: CORS Configuration (5 minutes)

### Step 1: Update `src/main.ts`

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ✅ FIXED: Restrict CORS to specific origin
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  
  app.enableCors({
    origin: process.env.NODE_ENV === 'production' 
      ? frontendUrl 
      : true, // Allow all in development
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400, // 24 hours
  });

  // ... rest of code
}
```

### Step 2: Add to `.env`

```env
FRONTEND_URL=https://your-frontend-domain.com
```

---

## 🔴 FIX 2: Rate Limiting (15 minutes)

### Step 1: Install Package

```bash
npm install @nestjs/throttler
```

### Step 2: Update `src/app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot([{
      ttl: 60000, // 1 minute
      limit: 100, // 100 requests per minute
    }]),
    // ... other imports
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // ... other providers
  ],
})
export class AppModule {}
```

### Step 3: Add Custom Rate Limits to Auth Endpoints

```typescript
// src/auth/auth.controller.ts
import { Throttle } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  async login(@Body() loginDto: LoginDto) {
    // ...
  }

  @Post('signup')
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 requests per hour
  async signup(@Body() signupDto: SignupDto) {
    // ...
  }

  @Post('forgot-password')
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 requests per hour
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    // ...
  }
}
```

---

## 🔴 FIX 3: Security Headers (5 minutes)

### Step 1: Install Package

```bash
npm install helmet
npm install --save-dev @types/helmet
```

### Step 2: Update `src/main.ts`

```typescript
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ✅ Add security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  // ... rest of code
}
```

---

## 🟡 FIX 4: Global Exception Filter (10 minutes)

### Step 1: Create `src/filters/http-exception.filter.ts`

```typescript
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    // Log error (don't expose stack trace to client)
    this.logger.error(
      `${request.method} ${request.url}`,
      exception instanceof Error ? exception.stack : JSON.stringify(exception),
    );

    // Don't expose stack trace in production
    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message: typeof message === 'string' ? message : (message as any).message || 'An error occurred',
    };

    // Include stack trace only in development
    if (process.env.NODE_ENV !== 'production') {
      (errorResponse as any).stack = exception instanceof Error ? exception.stack : undefined;
    }

    response.status(status).json(errorResponse);
  }
}
```

### Step 2: Update `src/main.ts`

```typescript
import { AllExceptionsFilter } from './filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ✅ Add global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // ... rest of code
}
```

---

## 🟡 FIX 5: Health Check Endpoint (5 minutes)

### Step 1: Create `src/health/health.controller.ts`

```typescript
import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(
    @InjectConnection()
    private connection: Connection,
  ) {}

  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    };
  }

  @Get('db')
  async checkDb() {
    try {
      await this.connection.query('SELECT 1');
      return {
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'error',
        database: 'disconnected',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
```

### Step 2: Create `src/health/health.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
```

### Step 3: Add to `src/app.module.ts`

```typescript
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    // ... other imports
    HealthModule,
  ],
})
export class AppModule {}
```

---

## 🟡 FIX 6: Environment Variable Validation (10 minutes)

### Step 1: Install Package

```bash
npm install joi
```

### Step 2: Create `src/config/validation.schema.ts`

```typescript
import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  DATABASE_URL: Joi.string().required(),
  FRONTEND_URL: Joi.string().uri().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  SMTP_HOST: Joi.string().required(),
  SMTP_PORT: Joi.number().required(),
  SMTP_USER: Joi.string().required(),
  SMTP_PASS: Joi.string().required(),
  SMTP_SECURE: Joi.string().valid('true', 'false', '1', '0').default('true'),
  SMTP_FROM: Joi.string().email().optional(),
});
```

### Step 3: Update `src/app.module.ts`

```typescript
import { validationSchema } from './config/validation.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
    // ... other imports
  ],
})
export class AppModule {}
```

---

## 🟡 FIX 7: Request Logging Middleware (10 minutes)

### Step 1: Create `src/middleware/logger.middleware.ts`

```typescript
import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, ip } = req;
    const userAgent = req.get('user-agent') || '';
    const startTime = Date.now();

    res.on('finish', () => {
      const { statusCode } = res;
      const duration = Date.now() - startTime;
      const contentLength = res.get('content-length');

      this.logger.log(
        `${method} ${originalUrl} ${statusCode} ${duration}ms - ${contentLength} - ${ip} - ${userAgent}`,
      );
    });

    next();
  }
}
```

### Step 2: Update `src/app.module.ts`

```typescript
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { LoggerMiddleware } from './middleware/logger.middleware';

@Module({
  // ...
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .forRoutes('*');
  }
}
```

---

## 🟡 FIX 8: SSL Configuration (5 minutes)

### Update `src/app.module.ts`

```typescript
import * as fs from 'fs';

TypeOrmModule.forRootAsync({
  // ...
  useFactory: (configService: ConfigService) => {
    // ... existing code ...

    const sslConfig = process.env.NODE_ENV === 'production' && process.env.DB_CA_CERT_PATH
      ? {
          rejectUnauthorized: true,
          ca: fs.readFileSync(process.env.DB_CA_CERT_PATH),
        }
      : {
          rejectUnauthorized: false, // OK for development
        };

    return {
      // ... existing config ...
      ssl: sslConfig,
    };
  },
})
```

---

## 📋 Complete Installation Command

Run this to install all required packages:

```bash
npm install @nestjs/throttler helmet joi
npm install --save-dev @types/helmet
```

---

## ✅ Testing After Fixes

### 1. Test CORS

```bash
curl -H "Origin: https://unauthorized-site.com" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS \
     http://localhost:3000/api/auth/login
# Should be rejected in production
```

### 2. Test Rate Limiting

```bash
# Try 6 login attempts in 1 minute
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}'
  echo ""
done
# 6th request should be rate limited
```

### 3. Test Health Check

```bash
curl http://localhost:3000/health
curl http://localhost:3000/health/db
```

### 4. Test Security Headers

```bash
curl -I http://localhost:3000/api/health
# Should see security headers like X-Content-Type-Options, X-Frame-Options, etc.
```

---

## 🚀 Deployment Checklist

After implementing fixes:

- [ ] All tests pass
- [ ] Health check endpoint works
- [ ] Rate limiting works
- [ ] CORS is properly configured
- [ ] Security headers are present
- [ ] Environment variables validated
- [ ] Error handling works correctly
- [ ] Logging is working
- [ ] SSL configuration is correct
- [ ] Build succeeds: `npm run build`
- [ ] Production build runs: `NODE_ENV=production npm run start:prod`

---

## 📝 Environment Variables Template

Create `.env.production.example`:

```env
# Application
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://your-frontend-domain.com

# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# Email
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_USER=your-email@example.com
SMTP_PASS=your-password
SMTP_SECURE=true
SMTP_FROM=noreply@yourdomain.com

# Database SSL (Optional - for production)
DB_CA_CERT_PATH=/path/to/ca-certificate.crt
```

---

**Estimated Total Time:** ~1.5 hours  
**Priority:** Fix all 🔴 Critical issues before deployment

