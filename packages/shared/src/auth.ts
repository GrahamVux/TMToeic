import { z } from 'zod'
import { ROLES, USER_STATUSES, type Role, type UserStatus } from './domain'

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

export const PASSWORD_MIN_LENGTH = 10

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

export const createStudentSchema = z.object({
  fullName: z.string().trim().min(2, 'Họ tên quá ngắn').max(120),
  email: z.string().trim().email('Email không hợp lệ').max(254).optional(),
  phone: z.string().trim().min(6).max(20).optional(),
  targetScore: z.number().int().min(10).max(990).optional(),
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
})
export type CreateStaffInput = z.infer<typeof createStaffSchema>

export const listUsersQuerySchema = z.object({
  role: z.enum(ROLES).optional(),
  status: z.enum(USER_STATUSES).optional(),
  q: z.string().trim().max(64).optional(),
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
  targetScore: number | null
  mustChangePassword: boolean
  lastLoginAt: string | null
  createdAt: string
}

export type SessionDto = {
  user: UserDto
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
