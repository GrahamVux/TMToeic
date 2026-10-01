import { z } from 'zod'

export const BUG_REPORT_CATEGORIES = ['UI', 'EXAM', 'SCORE', 'ACCOUNT', 'OTHER'] as const
export type BugReportCategory = (typeof BUG_REPORT_CATEGORIES)[number]

export const BUG_REPORT_CATEGORY_LABEL: Record<BugReportCategory, string> = {
  UI: 'Giao diện',
  EXAM: 'Đề thi / bài làm',
  SCORE: 'Điểm số / tiến độ',
  ACCOUNT: 'Tài khoản',
  OTHER: 'Khác',
}

export const BUG_REPORT_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const
export type BugReportStatus = (typeof BUG_REPORT_STATUSES)[number]

export const BUG_REPORT_STATUS_LABEL: Record<BugReportStatus, string> = {
  OPEN: 'Mới gửi',
  IN_PROGRESS: 'Đang xử lý',
  RESOLVED: 'Đã sửa',
  CLOSED: 'Đã đóng',
}

export type BugReportDto = {
  id: string
  category: BugReportCategory
  message: string
  pagePath: string
  status: BugReportStatus
  adminNote: string | null
  createdAt: string
  updatedAt: string
}

export type BugReportAdminDto = BugReportDto & {
  userAgent: string | null
  reporter: { id: string; fullName: string; studentCode: string | null }
  resolvedAt: string | null
  resolvedByName: string | null
}

export type BugReportListDto = {
  items: BugReportAdminDto[]
  total: number
  openCount: number
  page: number
  pageSize: number
}

export type BugReportSummaryDto = { openCount: number }

export const createBugReportSchema = z.object({
  category: z.enum(BUG_REPORT_CATEGORIES).default('OTHER'),
  message: z
    .string()
    .trim()
    .min(10, 'Mô tả tối thiểu 10 ký tự để quản trị viên hiểu sự cố')
    .max(2000, 'Mô tả tối đa 2000 ký tự'),
  pagePath: z
    .string()
    .trim()
    .max(300)
    .transform((v) => (v.startsWith('/') ? v : `/${v}`))
    .default('/'),
})
export type CreateBugReportInput = z.infer<typeof createBugReportSchema>

export const updateBugReportSchema = z.object({
  status: z.enum(BUG_REPORT_STATUSES),
  adminNote: z
    .string()
    .trim()
    .max(2000, 'Ghi chú tối đa 2000 ký tự')
    .transform((v) => (v.length === 0 ? null : v))
    .optional(),
})
export type UpdateBugReportInput = z.infer<typeof updateBugReportSchema>

export const listBugReportsQuerySchema = z.object({
  status: z.enum(BUG_REPORT_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
})
export type ListBugReportsQuery = z.infer<typeof listBugReportsQuerySchema>
