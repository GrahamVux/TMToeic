import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common'
import { createStaffSchema, createStudentSchema, listUsersQuerySchema } from '@toeic/shared'
import type { Request } from 'express'
import { clientIp, CurrentUser, Roles, type AuthUser } from '../common/decorators'
import { parse } from '../common/zod'
import { UsersService } from './users.service'

@Roles('TEACHER', 'ADMIN')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  private actor(user: AuthUser, req: Request) {
    return { id: user.id, role: user.role, ip: clientIp(req) }
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: unknown, @Req() req: Request) {
    return this.users.list(this.actor(user, req), parse(listUsersQuerySchema, query))
  }

  @Get('stats/students')
  studentStats() {
    return this.users.studentStats()
  }

  @Post('students')
  createStudent(@CurrentUser() user: AuthUser, @Body() body: unknown, @Req() req: Request) {
    return this.users.createStudent(this.actor(user, req), parse(createStudentSchema, body))
  }

  @Roles('ADMIN')
  @Post('staff')
  createStaff(@CurrentUser() user: AuthUser, @Body() body: unknown, @Req() req: Request) {
    return this.users.createStaff(this.actor(user, req), parse(createStaffSchema, body))
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return this.users.get(this.actor(user, req), id)
  }

  @Post(':id/reset-password')
  @HttpCode(200)
  resetPassword(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return this.users.resetPassword(this.actor(user, req), id)
  }

  @Post(':id/disable')
  @HttpCode(200)
  disable(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return this.users.setStatus(this.actor(user, req), id, 'DISABLED')
  }

  @Post(':id/enable')
  @HttpCode(200)
  enable(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return this.users.setStatus(this.actor(user, req), id, 'ACTIVE')
  }
}
