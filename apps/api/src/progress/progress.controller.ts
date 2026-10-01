import { Body, Controller, Get, Patch, Req } from '@nestjs/common'
import { setGoalSchema, updateProfileSchema } from '@toeic/shared'
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
    return { user: await this.progress.setGoal(user.id, parse(setGoalSchema, body), clientIp(req)) }
  }

  @Patch('profile')
  async updateProfile(@CurrentUser() user: AuthUser, @Body() body: unknown, @Req() req: Request) {
    return { user: await this.progress.updateProfile(user.id, parse(updateProfileSchema, body), clientIp(req)) }
  }
}
