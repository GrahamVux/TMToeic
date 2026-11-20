import { Inject, Injectable } from '@nestjs/common'
import type { CookieOptions, Request, Response } from 'express'
import { APP_CONFIG, type AppConfig } from '../config/app-config'

export const ACCESS_COOKIE = 'toeic_at'
export const REFRESH_COOKIE = 'toeic_rt'
/** Refresh cookie is only ever sent to the auth endpoints. */
export const REFRESH_COOKIE_PATH = '/api/v1/auth'

@Injectable()
export class AuthCookies {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  private base(): CookieOptions {
    // Production web (pages.dev) and the API (onrender.com) are different sites.
    // Lax cookies are not sent on that cross-site fetch, so the browser never stays signed in.
    const crossSite = this.config.isProd
    return {
      httpOnly: true,
      secure: crossSite || this.config.cookieSecure,
      sameSite: crossSite ? 'none' : this.config.cookieSameSite,
      ...(crossSite ? { partitioned: true } : {}),
    }
  }

  set(res: Response, tokens: { accessToken: string; refreshToken: string }) {
    res.cookie(ACCESS_COOKIE, tokens.accessToken, { ...this.base(), path: '/', maxAge: this.config.accessTtlSeconds * 1000 })
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      ...this.base(),
      path: REFRESH_COOKIE_PATH,
      maxAge: this.config.refreshTtlDays * 24 * 3600 * 1000,
    })
  }

  clear(res: Response) {
    res.clearCookie(ACCESS_COOKIE, { ...this.base(), path: '/' })
    res.clearCookie(REFRESH_COOKIE, { ...this.base(), path: REFRESH_COOKIE_PATH })
  }

  accessToken(req: Request): string | undefined {
    return req.cookies?.[ACCESS_COOKIE]
  }

  refreshToken(req: Request): string | undefined {
    return req.cookies?.[REFRESH_COOKIE]
  }
}
