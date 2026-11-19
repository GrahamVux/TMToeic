import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, Req } from '@nestjs/common'
import { createExamSchema, importAuthoredExamSchema, importListeningDraftSchema, listExamsQuerySchema, replaceExamContentSchema, setExamAudioSchema, startAttemptSchema } from '@toeic/shared'
import type { Request } from 'express'
import { assertTeacherGrant } from '../auth/permissions'
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
    if (user.role === 'TEACHER') assertTeacherGrant(user, 'manageAssignments')
    return this.exams.list(actorOf(user, req), parse(listExamsQuerySchema, query))
  }

  @Roles('TEACHER', 'ADMIN')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: unknown, @Req() req: Request) {
    assertTeacherGrant(user, 'manageAssignments')
    return this.exams.create(actorOf(user, req), parse(createExamSchema, body))
  }

  @Public()
  @Post('import-draft')
  importDraft(@OptionalUser() user: AuthUser | undefined, @Body() body: unknown, @Req() req: Request) {
    const input = parse(importListeningDraftSchema, body)
    if (user && (user.role === 'TEACHER' || user.role === 'ADMIN')) {
      assertTeacherGrant(user, 'manageAssignments')
      return this.exams.importListeningDraft(actorOf(user, req), input)
    }
    return this.exams.importListeningDraftFromLoopback(clientIp(req), input)
  }

  @Roles('TEACHER', 'ADMIN')
  @Post('import-authored')
  importAuthored(@CurrentUser() user: AuthUser, @Body() body: unknown, @Req() req: Request) {
    assertTeacherGrant(user, 'manageAssignments')
    return this.exams.importAuthored(actorOf(user, req), parse(importAuthoredExamSchema, body))
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    if (user.role === 'TEACHER') assertTeacherGrant(user, 'manageAssignments')
    return this.exams.get(actorOf(user, req), id)
  }

  /** Staff only — includes the answer key. */
  @Roles('TEACHER', 'ADMIN')
  @Get(':id/content')
  content(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string) {
    assertTeacherGrant(user, 'manageAssignments')
    return this.exams.getContent(id)
  }

  @Roles('TEACHER', 'ADMIN')
  @Put(':id/content')
  replaceContent(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown, @Req() req: Request) {
    assertTeacherGrant(user, 'manageAssignments')
    return this.exams.replaceContent(actorOf(user, req), id, parse(replaceExamContentSchema, body))
  }

  /** Attach / detach a Listening recording (full-length, or per part with `partCode`). */
  @Roles('TEACHER', 'ADMIN')
  @Put(':id/audio')
  setAudio(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown, @Req() req: Request) {
    assertTeacherGrant(user, 'manageAssignments')
    return this.audio.setAudio(actorOf(user, req), id, parse(setExamAudioSchema, body))
  }

  /** Upload a Listening recording (raw body, up to 80MB). Omit `partCode` for the full-length file of the exam. */
  @Roles('TEACHER', 'ADMIN')
  @Post(':id/audio/file')
  @HttpCode(200)
  uploadAudio(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('partCode') partCode: string | undefined,
    @Query('filename') filename: string | undefined,
    @Req() req: Request,
  ) {
    assertTeacherGrant(user, 'manageAssignments')
    const part = typeof partCode === 'string' && partCode.trim() ? partCode.trim() : undefined
    const name = typeof filename === 'string' && filename.trim() ? filename.trim() : 'audio.mp3'
    return this.audio.uploadFile(actorOf(user, req), id, req.body, req.header('content-type') ?? '', name, part)
  }

  @Roles('TEACHER', 'ADMIN')
  @Post(':id/publish')
  @HttpCode(200)
  publish(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    assertTeacherGrant(user, 'manageAssignments')
    return this.exams.publish(actorOf(user, req), id)
  }

  @Roles('TEACHER', 'ADMIN')
  @Post(':id/archive')
  @HttpCode(200)
  archive(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    assertTeacherGrant(user, 'manageAssignments')
    return this.exams.archive(actorOf(user, req), id)
  }

  /** Permanently removes the exam, homework built from it, and student attempts. */
  @Roles('TEACHER', 'ADMIN')
  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    assertTeacherGrant(user, 'manageAssignments')
    return this.exams.remove(actorOf(user, req), id)
  }

  @Roles('STUDENT')
  @Post(':id/attempts')
  @HttpCode(200)
  startAttempt(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown, @Req() req: Request) {
    return this.attempts.start(actorOf(user, req), id, parse(startAttemptSchema, body))
  }
}
