import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common'
import { assertTeacherGrant } from '../auth/permissions'
import { CurrentUser, Roles, type AuthUser } from '../common/decorators'
import { ProgressService } from './progress.service'

/** Teacher/admin read-only views over student activity. */
@Roles('TEACHER', 'ADMIN')
@Controller()
export class ReportsController {
  constructor(private readonly progress: ProgressService) {}

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

  /** Class boards the viewer may see, plus the center-wide class ranking. */
  @Get('reports/honor')
  honor(@CurrentUser() user: AuthUser) {
    return this.progress.staffHonor({ id: user.id, role: user.role })
  }
}
