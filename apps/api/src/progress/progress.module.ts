import { Module } from '@nestjs/common'
import { SiteModule } from '../site/site.module'
import { DailyGoalsService } from './daily-goals.service'
import { HonorRewardsService } from './honor-rewards.service'
import { ProgressController } from './progress.controller'
import { ProgressService } from './progress.service'
import { ReportsController } from './reports.controller'

@Module({
  imports: [SiteModule],
  controllers: [ProgressController, ReportsController],
  providers: [ProgressService, DailyGoalsService, HonorRewardsService],
  exports: [ProgressService, HonorRewardsService],
})
export class ProgressModule {}
