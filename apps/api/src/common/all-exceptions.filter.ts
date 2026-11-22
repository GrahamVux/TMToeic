import { ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common'
import { AVATAR_MAX_BYTES, ERROR_CODES, type ApiErrorBody, type ErrorCode } from '@toeic/shared'
import type { Response } from 'express'
import { ThrottlerException } from '@nestjs/throttler'
import { AppException } from './app-exception'

/** Uniform error envelope: `{ error: { code, message, details? } }`. Never leaks stack traces. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Http')

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>()

    let status = HttpStatus.INTERNAL_SERVER_ERROR
    let code: ErrorCode = ERROR_CODES.INTERNAL
    let message = 'Lỗi hệ thống, vui lòng thử lại sau'
    let details: unknown

    if (exception instanceof AppException) {
      status = exception.getStatus()
      code = exception.code
      message = exception.message
      details = exception.details
    } else if (exception instanceof ThrottlerException) {
      status = HttpStatus.TOO_MANY_REQUESTS
      code = ERROR_CODES.TOO_MANY_REQUESTS
      message = 'Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút'
    } else if (exception instanceof HttpException) {
      status = exception.getStatus()
      code = status === 404 ? ERROR_CODES.NOT_FOUND : status === 401 ? ERROR_CODES.UNAUTHENTICATED : status === 403 ? ERROR_CODES.FORBIDDEN : ERROR_CODES.VALIDATION_FAILED
      message = exception.message
    } else if (exception instanceof Error && (exception as { type?: string }).type === 'entity.too.large') {
      status = HttpStatus.PAYLOAD_TOO_LARGE
      code = ERROR_CODES.VALIDATION_FAILED
      message = (exception as { limit?: number }).limit === AVATAR_MAX_BYTES
        ? 'Ảnh đại diện tối đa 4 MB.'
        : 'File nghe quá lớn (tối đa 80MB)'
    } else {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception))
    }

    const body: ApiErrorBody = { error: { code, message, ...(details !== undefined ? { details } : {}) } }
    res.status(status).json(body)
  }
}
