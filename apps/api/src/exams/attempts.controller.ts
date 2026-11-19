import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Req } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { recordFocusSchema, saveAnswerSchema } from '@toeic/shared'
import type { Request } from 'express'
import { clientIp, CurrentUser, Roles, type AuthUser } from '../common/decorators'
import { parse } from '../common/zod'
import { AttemptsService } from './attempts.service'

const actorOf = (user: AuthUser, req: Request) => ({ id: user.id, role: user.role, ip: clientIp(req) })

@Roles('STUDENT')
@Controller('attempts')
export class AttemptsController {
  constructor(private readonly attempts: AttemptsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.attempts.list(actorOf(user, req))
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return this.attempts.getPlayer(actorOf(user, req), id)
  }

  /** Autosave one answer (idempotent upsert). `selectedKey: null` clears it. Higher ceiling than the default: a full test is ~200+ saves. */
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  @Put(':id/answers/:questionId')
  saveAnswer(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('questionId', new ParseUUIDPipe()) questionId: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.attempts.saveAnswer(actorOf(user, req), id, questionId, parse(saveAnswerSchema, body))
  }

  /** Opens or closes one "left the tab" interval. Free practice returns `{ recorded: false }`. */
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Post(':id/focus')
  @HttpCode(200)
  recordFocus(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.attempts.recordFocus(actorOf(user, req), id, parse(recordFocusSchema, body))
  }

  @Post(':id/abandon')
  @HttpCode(200)
  abandon(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return this.attempts.abandon(actorOf(user, req), id)
  }

  @Post(':id/submit')
  @HttpCode(200)
  submit(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return this.attempts.submit(actorOf(user, req), id)
  }

  @Roles('STUDENT', 'TEACHER', 'ADMIN')
  @Get(':id/result')
  result(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return this.attempts.getResult(actorOf(user, req), id)
  }

  /** Fresh signed audio URLs (the player calls this when a long untimed session outlives the previous URLs). */
  @Roles('STUDENT', 'TEACHER', 'ADMIN')
  @Get(':id/audio')
  audio(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return this.attempts.getAudio(actorOf(user, req), id)
  }

  @Roles('STUDENT', 'TEACHER', 'ADMIN')
  @Get(':id/review')
  review(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return this.attempts.getReview(actorOf(user, req), id)
  }
}
