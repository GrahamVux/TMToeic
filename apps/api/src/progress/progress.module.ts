import { Module } from '@nestjs/common'
import { ProgressController } from './progress.controller'
import { ProgressService } from './progress.service'
import { ReportsController } from './reports.controller'

@Module({ controllers: [ProgressController, ReportsController], providers: [ProgressService], exports: [ProgressService] })
export class ProgressModule {}
