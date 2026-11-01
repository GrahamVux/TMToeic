import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common'
import type { Role, TeacherPermissions } from '@toeic/shared'
import type { Request } from 'express'

export type AuthUser = {
  id: string
  role: Role
  sessionId: string
  mustChangePassword: boolean
  permissions: TeacherPermissions
  /** Set while an admin previews this account: the admin's id. All writes are refused in that state. */
  viewingAsBy?: string
}

export type AuthedRequest = Request & { user?: AuthUser }

export const IS_PUBLIC = 'isPublic'
/** Route needs no authentication. */
export const Public = () => SetMetadata(IS_PUBLIC, true)

export const ROLES_KEY = 'roles'
/** Restrict a route to the given roles (RBAC). Default for authenticated routes is "any role". */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles)

export const ALLOW_PASSWORD_CHANGE_PENDING = 'allowPasswordChangePending'
/** Route stays reachable while the account still has a temporary password. */
export const AllowPasswordChangePending = () => SetMetadata(ALLOW_PASSWORD_CHANGE_PENDING, true)

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest<AuthedRequest>().user!
})

export const OptionalUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser | undefined => {
  return ctx.switchToHttp().getRequest<AuthedRequest>().user
})

export function clientIp(req: Request): string | undefined {
  return req.ip || req.socket?.remoteAddress || undefined
}
