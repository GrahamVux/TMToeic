import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common'
import { createBugReportSchema, listBugReportsQuerySchema, updateBugReportSchema } from '@toeic/shared'
import type { Request } from 'express'
import { clientIp, CurrentUser, Roles, type AuthUser } from '../common/decorators'
import { parse } from '../common/zod'
import { BugReportsService } from './bug-reports.service'

@Controller('bug-reports')
export class BugReportsController {
  constructor(private readonly bugs: BugReportsService) {}

  @Roles('STUDENT')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: unknown, @Req() req: Request) {
    const ua = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined
    return this.bugs.create(user.id, parse(createBugReportSchema, body), ua, clientIp(req))
  }

  @Roles('STUDENT')
  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.bugs.listMine(user.id)
  }

  @Roles('ADMIN')
  @Get('summary')
  summary() {
    return this.bugs.summary()
  }

  @Roles('ADMIN')
  @Get()
  list(@Query() query: unknown) {
    return this.bugs.list(parse(listBugReportsQuerySchema, query))
  }

  @Roles('ADMIN')
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown, @Req() req: Request) {
    return this.bugs.update(id, user.id, parse(updateBugReportSchema, body), clientIp(req))
  }
}
