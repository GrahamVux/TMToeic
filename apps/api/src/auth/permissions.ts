import type { TeacherPermissions } from '@toeic/shared'
import { AppException } from '../common/app-exception'
import type { AuthUser } from '../common/decorators'

/** Teachers without the grant are rejected. Admin and other roles are left to the role guard. */
export function assertTeacherGrant(user: AuthUser, grant: keyof TeacherPermissions | 'assignments') {
  if (user.role !== 'TEACHER') return
  const allowed =
    grant === 'assignments' ? user.permissions.manageAssignments || user.permissions.viewProgress : user.permissions[grant]
  if (!allowed) throw AppException.forbidden('Tài khoản giáo viên chưa được cấp quyền này.')
}

export function teacherHasAnyGrant(user: AuthUser) {
  return user.role !== 'TEACHER' || user.permissions.createStudents || user.permissions.manageAssignments || user.permissions.viewProgress
}
