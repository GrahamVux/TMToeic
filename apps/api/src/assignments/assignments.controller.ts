import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, Res } from '@nestjs/common'
import { createAssignmentSchema, createFillAssignmentSchema } from '@toeic/shared'
import type { Request, Response } from 'express'
import { assertTeacherGrant } from '../auth/permissions'
import { clientIp, CurrentUser, Roles, type AuthUser } from '../common/decorators'
import { parse } from '../common/zod'
import { AttemptsService } from '../exams/attempts.service'
import { AssignmentsService } from './assignments.service'

const actorOf = (user: AuthUser, req: Request) => ({ id: user.id, role: user.role, ip: clientIp(req) })

@Controller('assignments')
export class AssignmentsController {
  constructor(
    private readonly assignments: AssignmentsService,
    private readonly attempts: AttemptsService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Req() req: Request) {
    assertTeacherGrant(user, 'assignments')
    return this.assignments.list(actorOf(user, req))
  }

  @Roles('TEACHER', 'ADMIN')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: unknown, @Req() req: Request) {
    assertTeacherGrant(user, 'manageAssignments')
    return this.assignments.create(actorOf(user, req), parse(createAssignmentSchema, body))
  }

  @Roles('TEACHER', 'ADMIN')
  @Post('fill')
  createFill(@CurrentUser() user: AuthUser, @Body() body: unknown, @Req() req: Request) {
    assertTeacherGrant(user, 'manageAssignments')
    return this.assignments.createFill(actorOf(user, req), parse(createFillAssignmentSchema, body))
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    assertTeacherGrant(user, 'assignments')
    return this.assignments.get(actorOf(user, req), id)
  }

  /** Class workbook for a full-paper assignment, once every assigned student has finished. */
  @Roles('TEACHER', 'ADMIN')
  @Get(':id/report')
  async report(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request, @Res() res: Response) {
    assertTeacherGrant(user, 'assignments')
    const file = await this.assignments.report(actorOf(user, req), id)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`)
    res.send(file.body)
  }

  @Roles('TEACHER', 'ADMIN')
  @Post(':id/bank')
  @HttpCode(200)
  saveToBank(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    assertTeacherGrant(user, 'manageAssignments')
    return this.assignments.saveToBank(actorOf(user, req), id)
  }

  @Roles('TEACHER', 'ADMIN')
  @Post(':id/publish')
  @HttpCode(200)
  publish(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    assertTeacherGrant(user, 'manageAssignments')
    return this.assignments.publish(actorOf(user, req), id)
  }

  @Roles('TEACHER', 'ADMIN')
  @Post(':id/close')
  @HttpCode(200)
  close(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    assertTeacherGrant(user, 'manageAssignments')
    return this.assignments.close(actorOf(user, req), id)
  }

  /** Listening file students hear while doing this homework. */
  @Roles('TEACHER', 'ADMIN')
  @Post(':id/audio/file')
  @HttpCode(200)
  uploadAudio(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('filename') filename: string | undefined,
    @Req() req: Request,
  ) {
    assertTeacherGrant(user, 'manageAssignments')
    const name = typeof filename === 'string' && filename.trim() ? filename.trim() : 'audio.mp3'
    return this.assignments.uploadAudio(actorOf(user, req), id, req.body, req.header('content-type') ?? '', name)
  }

  /** One scanned exam page shown to students during this homework. */
  @Roles('TEACHER', 'ADMIN')
  @Post(':id/images')
  @HttpCode(200)
  uploadImage(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('filename') filename: string | undefined,
    @Req() req: Request,
  ) {
    assertTeacherGrant(user, 'manageAssignments')
    const name = typeof filename === 'string' && filename.trim() ? filename.trim() : 'anh-de.jpg'
    return this.assignments.uploadImage(actorOf(user, req), id, req.body, req.header('content-type') ?? '', name)
  }

  @Roles('STUDENT')
  @Post(':id/start')
  @HttpCode(200)
  start(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return this.attempts.startFromAssignment(actorOf(user, req), id)
  }
}
