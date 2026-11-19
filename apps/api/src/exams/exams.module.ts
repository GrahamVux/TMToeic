import { Module } from '@nestjs/common'
import { AttemptsController } from './attempts.controller'
import { AttemptsService } from './attempts.service'
import { DemoExamSeeder } from './demo-exam'
import { ExamAudioService } from './exam-audio'
import { ExamBundlesService } from './exam-bundles.service'
import { ExamsController } from './exams.controller'
import { ExamsService } from './exams.service'
import { ListeningScanService } from './listening-scan.service'

@Module({
  controllers: [ExamsController, AttemptsController],
  providers: [ExamsService, ExamBundlesService, ListeningScanService, AttemptsService, ExamAudioService, DemoExamSeeder],
  exports: [ExamsService, AttemptsService],
})
export class ExamsModule {}
