import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, Req } from '@nestjs/common'
import { createExamSchema, importListeningDraftSchema, listExamsQuerySchema, replaceExamContentSchema, setExamAudioSchema, startAttemptSchema } from '@toeic/shared'
import type { Request } from 'express'
import { clientIp, CurrentUser, OptionalUser, Public, Roles, type AuthUser } from '../common/decorators'
import { parse } from '../common/zod'
import { AttemptsService } from './attempts.service'
import { ExamAudioService } from './exam-audio'
import { ExamsService } from './exams.service'

const actorOf = (user: AuthUser, req: Request) => ({ id: user.id, role: user.role, ip: clientIp(req) })

@Controller('exams')
export class ExamsController {
  constructor(
    private readonly exams: ExamsService,
    private readonly attempts: AttemptsService,
    private readonly audio: ExamAudioService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: unknown, @Req() req: Request) {
    return this.exams.list(actorOf(user, req), parse(listExamsQuerySchema, query))
  }

  @Roles('TEACHER', 'ADMIN')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: unknown, @Req() req: Request) {
    return this.exams.create(actorOf(user, req), parse(createExamSchema, body))
  }

  @Public()
  @Post('import-draft')
  importDraft(@OptionalUser() user: AuthUser | undefined, @Body() body: unknown, @Req() req: Request) {
    const input = parse(importListeningDraftSchema, body)
    if (user && (user.role === 'TEACHER' || user.role === 'ADMIN')) {
      return this.exams.importListeningDraft(actorOf(user, req), input)
    }
    return this.exams.importListeningDraftFromLoopback(clientIp(req), input)
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return this.exams.get(actorOf(user, req), id)
  }

  /** Staff only — includes the answer key. */
  @Roles('TEACHER', 'ADMIN')
  @Get(':id/content')
  content(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.exams.getContent(id)
  }

  @Roles('TEACHER', 'ADMIN')
  @Put(':id/content')
  replaceContent(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown, @Req() req: Request) {
    return this.exams.replaceContent(actorOf(user, req), id, parse(replaceExamContentSchema, body))
  }

  /** Attach / detach a Listening recording (full-length, or per part with `partCode`). */
  @Roles('TEACHER', 'ADMIN')
  @Put(':id/audio')
  setAudio(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown, @Req() req: Request) {
    return this.audio.setAudio(actorOf(user, req), id, parse(setExamAudioSchema, body))
  }

  @Roles('TEACHER', 'ADMIN')
  @Post(':id/publish')
  @HttpCode(200)
  publish(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return this.exams.publish(actorOf(user, req), id)
  }

  @Roles('TEACHER', 'ADMIN')
  @Post(':id/archive')
  @HttpCode(200)
  archive(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return this.exams.archive(actorOf(user, req), id)
  }

  @Roles('STUDENT')
  @Post(':id/attempts')
  @HttpCode(200)
  startAttempt(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown, @Req() req: Request) {
    return this.attempts.start(actorOf(user, req), id, parse(startAttemptSchema, body))
  }
}
