import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Req } from '@nestjs/common'
import { adjustUserPointsSchema, earlySettleHonorSchema, honorRewardConfigSchema } from '@toeic/shared'
import type { Request } from 'express'
import { assertTeacherGrant } from '../auth/permissions'
import { clientIp, CurrentUser, Roles, type AuthUser } from '../common/decorators'
import { parse } from '../common/zod'
import { HonorRewardsService } from './honor-rewards.service'
import { ProgressService } from './progress.service'

/** Teacher/admin views over student activity and honor administration. */
@Roles('TEACHER', 'ADMIN')
@Controller()
export class ReportsController {
  constructor(
    private readonly progress: ProgressService,
    private readonly honorRewards: HonorRewardsService,
  ) {}

  @Get('students/:id/progress')
  async studentProgress(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string) {
    assertTeacherGrant(user, 'viewProgress')
    await this.progress.assertStudent(id, user.role === 'TEACHER' ? user.id : undefined)
    return this.progress.studentProgress(id)
  }

  @Get('students/:id/attempts')
  async studentAttempts(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string) {
    assertTeacherGrant(user, 'viewProgress')
    await this.progress.assertStudent(id, user.role === 'TEACHER' ? user.id : undefined)
    return this.progress.listStudentAttempts(id)
  }

  @Get('reports/class')
  classReport(@CurrentUser() user: AuthUser) {
    assertTeacherGrant(user, 'viewProgress')
    return this.progress.classReport(new Date(), user.role === 'TEACHER' ? user.id : undefined)
  }

  /** Finished work grouped by exam. Teachers only see sittings from their own classes. */
  @Get('reports/exams')
  examReport(@CurrentUser() user: AuthUser) {
    assertTeacherGrant(user, 'viewProgress')
    return this.progress.examReport(user.role === 'TEACHER' ? user.id : undefined)
  }

  /** Class boards the viewer may see, plus the center-wide ranking and settlements. */
  @Get('reports/honor')
  honor(@CurrentUser() user: AuthUser) {
    return this.honorRewards.staffHonor({ id: user.id, role: user.role })
  }

  @Roles('ADMIN')
  @Put('reports/honor/config')
  updateHonorConfig(@CurrentUser() user: AuthUser, @Body() body: unknown, @Req() req: Request) {
    return this.honorRewards.updateRewardConfig(user.id, parse(honorRewardConfigSchema, body), clientIp(req))
  }

  @Roles('ADMIN')
  @Post('reports/honor/points')
  adjustPoints(@CurrentUser() user: AuthUser, @Body() body: unknown, @Req() req: Request) {
    return this.honorRewards.adjustUserPoints(user.id, parse(adjustUserPointsSchema, body), clientIp(req))
  }

  @Roles('ADMIN')
  @Post('reports/honor/settle')
  earlySettle(@CurrentUser() user: AuthUser, @Body() body: unknown, @Req() req: Request) {
    return this.honorRewards.earlySettle(user.id, parse(earlySettleHonorSchema, body), new Date(), clientIp(req))
  }
}
