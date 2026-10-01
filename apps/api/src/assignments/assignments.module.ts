import { Module } from '@nestjs/common'
import { ExamsModule } from '../exams/exams.module'
import { AssignmentsController } from './assignments.controller'
import { AssignmentsService } from './assignments.service'

@Module({
  imports: [ExamsModule],
  controllers: [AssignmentsController],
  providers: [AssignmentsService],
})
export class AssignmentsModule {}
