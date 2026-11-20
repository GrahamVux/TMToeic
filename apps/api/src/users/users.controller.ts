import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res } from '@nestjs/common'
import { createStaffSchema, createStudentSchema, listUsersQuerySchema, updateTeacherPermissionsSchema } from '@toeic/shared'
import { z } from 'zod'
import type { Request, Response } from 'express'
import { clientIp, CurrentUser, Roles, type AuthUser } from '../common/decorators'
import { parse } from '../common/zod'
import { UsersService } from './users.service'

@Roles('TEACHER', 'ADMIN')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  private actor(user: AuthUser, req: Request) {
    return { id: user.id, role: user.role, permissions: user.permissions, ip: clientIp(req) }
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: unknown, @Req() req: Request) {
    return this.users.list(this.actor(user, req), parse(listUsersQuerySchema, query))
  }

  @Get('stats/students')
  studentStats(@CurrentUser() user: AuthUser, @Query('classId') classId: string | undefined, @Req() req: Request) {
    const id = classId ? parse(z.uuid('Mã lớp không hợp lệ'), classId) : undefined
    return this.users.studentStats(this.actor(user, req), id)
  }

  @Get('students/template')
  async template(@CurrentUser() user: AuthUser, @Req() req: Request, @Res() res: Response) {
    const file = await this.users.template(this.actor(user, req))
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename="mau-hoc-vien.xlsx"')
    res.send(file)
  }

  @Post('students/import')
  @HttpCode(200)
  async importStudents(@CurrentUser() user: AuthUser, @Query('classId') classId: string | undefined, @Req() req: Request, @Res() res: Response) {
    const result = await this.users.importStudents(this.actor(user, req), req.body, classId || undefined)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename="tai-khoan-hoc-vien.xlsx"')
    res.setHeader('X-Students-Created', String(result.created))
    res.setHeader('X-Students-Skipped', String(result.skipped))
    res.send(result.file)
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

  @Roles('ADMIN')
  @Patch(':id/permissions')
  updatePermissions(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown, @Req() req: Request) {
    return this.users.updateTeacherPermissions(this.actor(user, req), id, parse(updateTeacherPermissionsSchema, body))
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
