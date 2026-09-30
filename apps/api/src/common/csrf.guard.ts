import { type CanActivate, type ExecutionContext, HttpStatus, Injectable } from '@nestjs/common'
import { CSRF_HEADER, CSRF_HEADER_VALUE, ERROR_CODES } from '@toeic/shared'
import type { Request } from 'express'
import { AppException } from './app-exception'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * CSRF defence for cookie-based auth: every state-changing request must carry a custom header.
 * Browsers cannot attach custom headers cross-site without a CORS preflight, which only allow-listed origins pass.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>()
    if (SAFE_METHODS.has(req.method)) return true
    if (req.header(CSRF_HEADER) !== CSRF_HEADER_VALUE) {
      throw new AppException(ERROR_CODES.CSRF_REJECTED, 'Yêu cầu không hợp lệ', HttpStatus.FORBIDDEN)
    }
    return true
  }
}
