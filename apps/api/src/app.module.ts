import { Module } from '@nestjs/common'
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { ThrottlerModule } from '@nestjs/throttler'
import { AllExceptionsFilter } from './common/all-exceptions.filter'
import { CsrfGuard } from './common/csrf.guard'
import { LoggingInterceptor } from './common/logging.interceptor'
import { AuditModule } from './audit/audit.service'
import { AuthModule } from './auth/auth.module'
import { JwtAuthGuard, PasswordChangeGuard, RolesGuard } from './auth/guards'
import { UserAwareThrottlerGuard } from './auth/throttler.guard'
import { CatalogController } from './catalog/catalog.controller'
import { ConfigModule } from './config/app-config'
import { DatabaseModule } from './db/database.module'
import { ExamsModule } from './exams/exams.module'
import { ProgressModule } from './progress/progress.module'
import { StorageModule } from './storage/storage.service'
import { HealthController } from './health/health.controller'
import { UsersModule } from './users/users.module'

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    AuditModule,
    StorageModule,
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
    AuthModule,
    UsersModule,
    ExamsModule,
    ProgressModule,
  ],
  controllers: [CatalogController, HealthController],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    // Guard order matters: throttle → CSRF → authenticate → force-password-change → RBAC
    { provide: APP_GUARD, useClass: UserAwareThrottlerGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PasswordChangeGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
