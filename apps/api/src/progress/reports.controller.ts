import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common'
import { Roles } from '../common/decorators'
import { ProgressService } from './progress.service'

/** Teacher/admin read-only views over student activity. */
@Roles('TEACHER', 'ADMIN')
@Controller()
export class ReportsController {
  constructor(private readonly progress: ProgressService) {}

  @Get('students/:id/progress')
  async studentProgress(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.progress.assertStudent(id)
    return this.progress.studentProgress(id)
  }

  @Get('reports/class')
  classReport() {
    return this.progress.classReport()
  }
}
