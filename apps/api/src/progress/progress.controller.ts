import { Body, Controller, Get, Patch, Req } from '@nestjs/common'
import { setGoalSchema } from '@toeic/shared'
import type { Request } from 'express'
import { clientIp, CurrentUser, Roles, type AuthUser } from '../common/decorators'
import { parse } from '../common/zod'
import { ProgressService } from './progress.service'

/** Endpoints about the signed-in student themselves. */
@Roles('STUDENT')
@Controller('me')
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthUser) {
    return this.progress.studentDashboard(user.id)
  }

  @Get('progress')
  progressOverview(@CurrentUser() user: AuthUser) {
    return this.progress.studentProgress(user.id)
  }

  @Patch('goal')
  async setGoal(@CurrentUser() user: AuthUser, @Body() body: unknown, @Req() req: Request) {
    const { targetScore } = parse(setGoalSchema, body)
    return { user: await this.progress.setGoal(user.id, targetScore, clientIp(req)) }
  }
}
