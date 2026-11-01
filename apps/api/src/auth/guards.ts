import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ERROR_CODES, VIEW_AS_HEADER, type Role } from '@toeic/shared'
import { AppException } from '../common/app-exception'
import { ALLOW_PASSWORD_CHANGE_PENDING, type AuthedRequest, type AuthUser, IS_PUBLIC, ROLES_KEY } from '../common/decorators'
import { AuthCookies } from './auth.cookies'
import { AuthService } from './auth.service'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Authenticates every request unless the handler/controller is @Public(). Public routes still populate `req.user` from a valid cookie. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
    private readonly cookies: AuthCookies,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()])
    const req = context.switchToHttp().getRequest<AuthedRequest>()
    const token = this.cookies.accessToken(req)
    if (isPublic) {
      // Public routes still attach req.user when a valid session cookie is present
      // (e.g. POST /exams/import-draft as a logged-in teacher on production).
      if (token) {
        try {
          const { user } = await this.auth.authenticate(token)
          req.user = user
        } catch {
          // Expired/invalid cookie on a public route is ignored.
        }
      }
      return true
    }
    if (!token) throw AppException.unauthenticated()
    const { user } = await this.auth.authenticate(token)
    req.user = await this.previewTarget(req, user)
    return true
  }

  /** An admin who sends the view-as header sees the API exactly as that teacher or student would, without being able to change anything. */
  private async previewTarget(req: AuthedRequest, admin: AuthUser): Promise<AuthUser> {
    const raw = req.header(VIEW_AS_HEADER)
    if (!raw || admin.role !== 'ADMIN') return admin
    if (!UUID.test(raw)) throw AppException.badRequest('Tài khoản xem thử không hợp lệ')
    if (!SAFE_METHODS.has(req.method)) {
      throw AppException.forbidden('Đang ở chế độ xem thử nên chỉ được xem, không thể thay đổi dữ liệu.', ERROR_CODES.VIEW_ONLY)
    }
    return (await this.auth.viewAsTarget(admin, raw)).user
  }
}

/** Blocks everything except opted-in routes while the account still uses a temporary password. */
@Injectable()
export class PasswordChangeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()])) return true
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
