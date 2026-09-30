import { type CallHandler, type ExecutionContext, HttpException, Injectable, Logger, type NestInterceptor } from '@nestjs/common'
import type { Request, Response } from 'express'
import { type Observable, tap } from 'rxjs'
import type { AuthedRequest } from './decorators'

/** One access-log line per request. Never logs bodies, cookies or headers (may contain credentials). */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Http')

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp()
    const req = http.getRequest<AuthedRequest & Request>()
    const res = http.getResponse<Response>()
    const started = Date.now()
    const done = (status: number) => {
      const user = req.user ? ` user=${req.user.id}` : ''
      this.logger.log(`${req.method} ${req.originalUrl.split('?')[0]} ${status} ${Date.now() - started}ms${user}`)
    }
    return next.handle().pipe(
      tap({
        next: () => done(res.statusCode),
        // The exception filter hasn't run yet, so res.statusCode is still 200 here — use the exception's status.
        error: (err: unknown) => done(err instanceof HttpException ? err.getStatus() : 500),
      }),
    )
  }
}
