import { Body, Controller, Get, Patch, Put, Req } from '@nestjs/common'
import { setDailyGoalsSchema, setGoalSchema, updateProfileSchema } from '@toeic/shared'
import type { Request } from 'express'
import { clientIp, CurrentUser, Roles, type AuthUser } from '../common/decorators'
import { parse } from '../common/zod'
import { DailyGoalsService } from './daily-goals.service'
import { HonorRewardsService } from './honor-rewards.service'
import { ProgressService } from './progress.service'

/** Endpoints about the signed-in student themselves. */
@Roles('STUDENT')
@Controller('me')
export class ProgressController {
  constructor(
    private readonly progress: ProgressService,
    private readonly daily: DailyGoalsService,
    private readonly honorRewards: HonorRewardsService,
  ) {}

  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthUser) {
    return this.progress.studentDashboard(user.id)
  }

  @Get('honor')
  honor(@CurrentUser() user: AuthUser) {
    return this.honorRewards.honorBoard(user.id)
  }

  @Get('progress')
  progressOverview(@CurrentUser() user: AuthUser) {
    return this.progress.studentProgress(user.id)
  }

  @Get('daily-goals')
  dailyGoals(@CurrentUser() user: AuthUser) {
    return this.daily.get(user.id)
  }

  @Put('daily-goals')
  setDailyGoals(@CurrentUser() user: AuthUser, @Body() body: unknown, @Req() req: Request) {
    return this.daily.set(user.id, parse(setDailyGoalsSchema, body), clientIp(req))
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
