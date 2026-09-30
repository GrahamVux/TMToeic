import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Req, Res } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { changePasswordSchema, loginSchema, type SessionDto } from '@toeic/shared'
import type { Request, Response } from 'express'
import { AllowPasswordChangePending, clientIp, CurrentUser, Public, type AuthUser } from '../common/decorators'
import { parse } from '../common/zod'
import { toUserDto } from '../users/user.mapper'
import { AuthCookies } from './auth.cookies'
import { AuthService, type ClientContext } from './auth.service'

const ctxOf = (req: Request): ClientContext => ({ ip: clientIp(req), userAgent: req.header('user-agent') })

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookies: AuthCookies,
  ) {}

  @Public()
  @Throttle({ default: { limit: () => Number(process.env.LOGIN_RATE_LIMIT ?? 10), ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  async login(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<SessionDto> {
    const input = parse(loginSchema, body)
    const { session, tokens } = await this.auth.login(input.identifier, input.password, ctxOf(req))
    this.cookies.set(res, tokens)
    return session
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<SessionDto> {
    try {
      const { session, tokens } = await this.auth.refresh(this.cookies.refreshToken(req), ctxOf(req))
      this.cookies.set(res, tokens)
      return session
    } catch (err) {
      this.cookies.clear(res)
      throw err
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(this.cookies.refreshToken(req), ctxOf(req))
    this.cookies.clear(res)
  }

  @AllowPasswordChangePending()
  @Post('change-password')
  @HttpCode(200)
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionDto> {
    const input = parse(changePasswordSchema, body)
    const { session, tokens } = await this.auth.changePassword(user, input.currentPassword, input.newPassword, ctxOf(req))
    this.cookies.set(res, tokens)
    return session
  }

  @AllowPasswordChangePending()
  @Get('me')
  async me(@CurrentUser() user: AuthUser): Promise<SessionDto> {
    return { user: toUserDto(await this.auth.getUserRow(user.id)) }
  }

  @Get('sessions')
  listSessions(@CurrentUser() user: AuthUser) {
    return this.auth.listSessions(user.id, user.sessionId)
  }

  @Delete('sessions/:id')
  @HttpCode(204)
  async revokeSession(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request): Promise<void> {
    await this.auth.revokeOwnSession(user.id, id, ctxOf(req))
  }
}
