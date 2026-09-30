import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ERROR_CODES, type Role } from '@toeic/shared'
import { AppException } from '../common/app-exception'
import { ALLOW_PASSWORD_CHANGE_PENDING, type AuthedRequest, IS_PUBLIC, ROLES_KEY } from '../common/decorators'
import { AuthCookies } from './auth.cookies'
import { AuthService } from './auth.service'

/** Authenticates every request unless the handler/controller is @Public(). Populates `req.user` from live DB state. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
    private readonly cookies: AuthCookies,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()])) return true
    const req = context.switchToHttp().getRequest<AuthedRequest>()
    const token = this.cookies.accessToken(req)
    if (!token) throw AppException.unauthenticated()
    const { user } = await this.auth.authenticate(token)
    req.user = user
    return true
  }
}

/** Blocks everything except opted-in routes while the account still uses a temporary password. */
@Injectable()
export class PasswordChangeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthedRequest>()
    if (!req.user?.mustChangePassword) return true
    if (this.reflector.getAllAndOverride<boolean>(ALLOW_PASSWORD_CHANGE_PENDING, [context.getHandler(), context.getClass()])) return true
    throw AppException.forbidden('Bạn cần đổi mật khẩu tạm trước khi tiếp tục', ERROR_CODES.PASSWORD_CHANGE_REQUIRED)
  }
}

/** Role-based access control via @Roles(...). No decorator = any authenticated role. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [context.getHandler(), context.getClass()])
    if (!roles || roles.length === 0) return true
    const req = context.switchToHttp().getRequest<AuthedRequest>()
    if (!req.user || !roles.includes(req.user.role)) throw AppException.forbidden()
    return true
  }
}
