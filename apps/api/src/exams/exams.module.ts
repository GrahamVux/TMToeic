import { Module } from '@nestjs/common'
import { AttemptsController } from './attempts.controller'
import { AttemptsService } from './attempts.service'
import { DemoExamSeeder } from './demo-exam'
import { ExamAudioService } from './exam-audio'
import { ExamsController } from './exams.controller'
import { ExamsService } from './exams.service'

@Module({
  controllers: [ExamsController, AttemptsController],
  providers: [ExamsService, AttemptsService, ExamAudioService, DemoExamSeeder],
  exports: [ExamsService, AttemptsService],
})
export class ExamsModule {}
