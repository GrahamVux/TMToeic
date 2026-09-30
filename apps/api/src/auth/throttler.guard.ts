import { Inject, Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ThrottlerGuard } from '@nestjs/throttler'
import { AuthCookies } from './auth.cookies'

/**
 * Rate limiting keyed by the signed-in user instead of the IP.
 *
 * A whole classroom often shares one public IP (same Wi-Fi/NAT); with an IP key, autosave traffic of
 * a few students would lock everyone out mid-exam. The token signature is verified, so a forged
 * cookie cannot be used to dodge the limit. Login/refresh always stay keyed by IP so brute-force
 * protection cannot be bypassed by presenting some other valid cookie.
 */
@Injectable()
export class UserAwareThrottlerGuard extends ThrottlerGuard {
  @Inject(JwtService) private readonly jwt!: JwtService
  @Inject(AuthCookies) private readonly cookies!: AuthCookies

  protected async getTracker(req: Record<string, any>): Promise<string> {
    const ip = String(req.ip ?? 'unknown')
    if (/\/auth\/(login|refresh|logout)\/?$/.test(String(req.path ?? req.url ?? ''))) return ip
    const token = this.cookies.accessToken(req as never)
    if (!token) return ip
    try {
      const payload = await this.jwt.verifyAsync<{ sub?: string }>(token)
      return payload.sub ? `user:${payload.sub}` : ip
    } catch {
      return ip
    }
  }
}
