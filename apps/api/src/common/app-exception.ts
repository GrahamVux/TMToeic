import { HttpException, HttpStatus } from '@nestjs/common'
import { ERROR_CODES, type ErrorCode } from '@toeic/shared'

export class AppException extends HttpException {
  constructor(
    readonly code: ErrorCode,
    message: string,
    status: HttpStatus,
    readonly details?: unknown,
  ) {
    super({ code, message, details }, status)
  }

  static unauthenticated(message = 'Bạn chưa đăng nhập', code: ErrorCode = ERROR_CODES.UNAUTHENTICATED) {
    return new AppException(code, message, HttpStatus.UNAUTHORIZED)
  }
  static forbidden(message = 'Bạn không có quyền thực hiện thao tác này', code: ErrorCode = ERROR_CODES.FORBIDDEN) {
    return new AppException(code, message, HttpStatus.FORBIDDEN)
  }
  static notFound(message = 'Không tìm thấy dữ liệu') {
    return new AppException(ERROR_CODES.NOT_FOUND, message, HttpStatus.NOT_FOUND)
  }
  static conflict(message: string) {
    return new AppException(ERROR_CODES.CONFLICT, message, HttpStatus.CONFLICT)
  }
  static badRequest(message: string, details?: unknown) {
    return new AppException(ERROR_CODES.VALIDATION_FAILED, message, HttpStatus.BAD_REQUEST, details)
  }
}
