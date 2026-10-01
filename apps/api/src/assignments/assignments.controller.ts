import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common'
import { createAssignmentSchema } from '@toeic/shared'
import type { Request } from 'express'
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
    return this.assignments.list(actorOf(user, req))
  }

  @Roles('TEACHER', 'ADMIN')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: unknown, @Req() req: Request) {
    return this.assignments.create(actorOf(user, req), parse(createAssignmentSchema, body))
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return this.assignments.get(actorOf(user, req), id)
  }

  @Roles('TEACHER', 'ADMIN')
  @Post(':id/publish')
  @HttpCode(200)
  publish(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return this.assignments.publish(actorOf(user, req), id)
  }

  @Roles('TEACHER', 'ADMIN')
  @Post(':id/close')
  @HttpCode(200)
  close(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return this.assignments.close(actorOf(user, req), id)
  }

  @Roles('STUDENT')
  @Post(':id/start')
  @HttpCode(200)
  start(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return this.attempts.startFromAssignment(actorOf(user, req), id)
  }
}
