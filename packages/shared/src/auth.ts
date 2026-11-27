import { z } from 'zod'
import { ROLES, USER_STATUSES, type Role, type UserStatus } from './domain'
import type { GoalDto } from './progress'
import type { ThemePresetId } from './site'

/** Machine-readable error codes returned by the API (`{ error: { code, message } }`). */
export const ERROR_CODES = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  FORBIDDEN: 'FORBIDDEN',
  PASSWORD_CHANGE_REQUIRED: 'PASSWORD_CHANGE_REQUIRED',
  CSRF_REJECTED: 'CSRF_REJECTED',
  /** An admin previewing another account tried to change data. */
  VIEW_ONLY: 'VIEW_ONLY',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  /** Attempt already submitted/expired — answers can no longer change. */
  ATTEMPT_CLOSED: 'ATTEMPT_CLOSED',
  /** Publish blocked: `details.problems` lists what to fix. */
  EXAM_NOT_READY: 'EXAM_NOT_READY',
  INTERNAL: 'INTERNAL',
} as const
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

export type ApiErrorBody = {
  error: { code: ErrorCode; message: string; details?: unknown }
}

/** Header that every state-changing request must carry (CSRF defence for cookie auth). */
export const CSRF_HEADER = 'x-toeic-client'
export const CSRF_HEADER_VALUE = 'web'

/** An admin sends this with the id of the teacher or student whose screens they preview. The preview is read-only. */
export const VIEW_AS_HEADER = 'x-toeic-view-as'

export const viewAsSchema = z.object({
  userId: z.string().uuid(),
})
export type ViewAsInput = z.infer<typeof viewAsSchema>

export const PASSWORD_MIN_LENGTH = 10

export const AVATAR_MAX_BYTES = 4 * 1024 * 1024
export const AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export type AccountAvatarDto = Pick<UserDto, 'id' | 'avatarUrl'>
export type AccountFrameDto = Pick<UserDto, 'id' | 'avatarFrame'>

/** Password given to every account created by an admin or teacher. The user must change it at first login. */
export const DEFAULT_NEW_ACCOUNT_PASSWORD = '123456'

export const teacherPermissionsSchema = z.object({
  /** Tạo học viên (từng người hoặc bằng Excel). */
  createStudents: z.boolean(),
  /** Kho đề, tạo và giao bài tập. */
  manageAssignments: z.boolean(),
  /** Xem tiến độ và bài làm của học viên. */
  viewProgress: z.boolean(),
})
export type TeacherPermissions = z.infer<typeof teacherPermissionsSchema>

export const FULL_TEACHER_PERMISSIONS: TeacherPermissions = {
  createStudents: true,
  manageAssignments: true,
  viewProgress: true,
}

/** Admin always has every teacher grant. Students have none. Teachers use the flags stored on the account. */
export function teacherGrants(role: Role, stored?: Partial<TeacherPermissions> | null): TeacherPermissions {
  if (role === 'ADMIN') return { ...FULL_TEACHER_PERMISSIONS }
  if (role !== 'TEACHER') return { createStudents: false, manageAssignments: false, viewProgress: false }
  return {
    createStudents: stored?.createStudents ?? false,
    manageAssignments: stored?.manageAssignments ?? false,
    viewProgress: stored?.viewProgress ?? false,
  }
}

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Mật khẩu tối thiểu ${PASSWORD_MIN_LENGTH} ký tự`)
  .max(128, 'Mật khẩu quá dài')
  .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), 'Mật khẩu phải có cả chữ và số')

export const loginSchema = z.object({
  /** username or student code (case-insensitive) */
  identifier: z.string().trim().min(1, 'Vui lòng nhập mã học viên / tên đăng nhập').max(64),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu').max(128),
})
export type LoginInput = z.infer<typeof loginSchema>

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại').max(128),
    newPassword: passwordSchema,
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    path: ['newPassword'],
    message: 'Mật khẩu mới phải khác mật khẩu hiện tại',
  })
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>

/** Admin forgot the password: the recovery code is checked server-side, then the new password replaces it. */
export const recoverAdminPasswordSchema = z.object({
  identifier: z.string().trim().min(1, 'Vui lòng nhập tên đăng nhập').max(64),
  recoveryCode: z.string().trim().min(1, 'Vui lòng nhập mã khôi phục').max(128),
  newPassword: passwordSchema,
})
export type RecoverAdminPasswordInput = z.infer<typeof recoverAdminPasswordSchema>

export const createStudentSchema = z.object({
  fullName: z.string().trim().min(2, 'Họ tên quá ngắn').max(120),
  email: z.string().trim().email('Email không hợp lệ').max(254).optional(),
  phone: z.string().trim().min(6).max(20).optional(),
  targetScore: z.number().int().min(10).max(990).optional(),
  /** Class the new student joins. Teachers may omit this only when they manage exactly one class. */
  classId: z.string().uuid().optional(),
})
export type CreateStudentInput = z.infer<typeof createStudentSchema>

export const createStaffSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(32)
    .regex(/^[a-z0-9._-]+$/, 'Chỉ dùng chữ thường, số, . _ -'),
  fullName: z.string().trim().min(2).max(120),
  role: z.enum(['TEACHER', 'ADMIN']),
  email: z.string().trim().email().max(254).optional(),
  /** Omitted grants default to all three, so older clients keep creating a full teacher. */
  permissions: teacherPermissionsSchema.optional(),
})
export type CreateStaffInput = z.infer<typeof createStaffSchema>

export const updateTeacherPermissionsSchema = z.object({
  permissions: teacherPermissionsSchema,
})
export type UpdateTeacherPermissionsInput = z.infer<typeof updateTeacherPermissionsSchema>

export const listUsersQuerySchema = z.object({
  role: z.enum(ROLES).optional(),
  status: z.enum(USER_STATUSES).optional(),
  q: z.string().trim().max(64).optional(),
  classId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>

/** Public user shape returned by the API — never contains password hash. */
export type UserDto = {
  id: string
  username: string
  studentCode: string | null
  fullName: string
  email: string | null
  phone: string | null
  role: Role
  status: UserStatus
  avatarUrl: string | null
  avatarFrame: string
  themePreset: ThemePresetId | null
  rewardPoints: number
  targetScore: number | null
  /** 2-skill or 4-skill band the student chose; null when no goal is set. */
  goal: GoalDto
  mustChangePassword: boolean
  /** What this teacher is allowed to do. Admin is always fully granted; students are always empty. */
  permissions: TeacherPermissions
  lastLoginAt: string | null
  createdAt: string
  /** Student's class. Null for staff and for a student who has not been placed. */
  classId: string | null
  className: string | null
}

export type SessionDto = {
  user: UserDto
  /** Set while an admin previews another account. `user` is then the previewed account and this is the admin. */
  viewingAs?: { admin: UserDto }
}

export type CredentialsIssuedDto = {
  user: UserDto
  /** Temporary password — shown exactly once to the teacher/admin. */
  temporaryPassword: string
}

export type StudentStatsDto = {
  total: number
  active: number
  disabled: number
  /** Students who still use the temporary password handed over by the teacher. */
  pendingFirstLogin: number
}

export type Paginated<T> = { items: T[]; total: number; page: number; pageSize: number }

/** Where each role lands after login. */
export function homePathForRole(role: Role): string {
  return role === 'STUDENT' ? '/dashboard' : '/admin'
}
