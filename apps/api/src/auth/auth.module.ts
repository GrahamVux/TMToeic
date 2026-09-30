import { Global, Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { APP_CONFIG, type AppConfig } from '../config/app-config'
import { AuthController } from './auth.controller'
import { AuthCookies } from './auth.cookies'
import { AuthService } from './auth.service'
import { JwtAuthGuard, PasswordChangeGuard, RolesGuard } from './guards'
import { PasswordService } from './password.service'

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        secret: config.jwtAccessSecret,
        signOptions: { algorithm: 'HS256' },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, AuthCookies, JwtAuthGuard, PasswordChangeGuard, RolesGuard],
  exports: [JwtModule, AuthService, PasswordService, AuthCookies, JwtAuthGuard, PasswordChangeGuard, RolesGuard],
})
export class AuthModule {}
