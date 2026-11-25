import { z } from 'zod'
import type { Role } from './domain'

export const AVATAR_FRAME_IDS = [
  'none',
  'mint-ring',
  'dawn-compass',
  'scholar-olive',
  'class-top1',
  'class-top2',
  'class-top3',
  'center-top1',
  'center-top2',
  'center-top3',
  'streak-7',
  'streak-30',
  'streak-100',
  'staff-mentor',
] as const

export type AvatarFrameId = (typeof AVATAR_FRAME_IDS)[number]

export const FREE_FRAME_IDS: readonly AvatarFrameId[] = ['none', 'mint-ring', 'dawn-compass', 'scholar-olive']

export type FrameCategory = 'FREE' | 'CLASS_TOP' | 'CENTER_TOP' | 'STREAK' | 'STAFF'

export type AvatarFrameDef = {
  id: AvatarFrameId
  name: string
  category: FrameCategory
  badgeLabel: string
  unlockCondition: string
  durationHint: string
  accent: string
}

export const AVATAR_FRAMES: AvatarFrameDef[] = [
  {
    id: 'none',
    name: 'Mặc định',
    category: 'FREE',
    badgeLabel: 'Cơ bản',
    unlockCondition: 'Mở sẵn cho mọi tài khoản',
    durationHint: 'Vĩnh viễn',
    accent: '#2b8a9c',
  },
  {
    id: 'mint-ring',
    name: 'Vòng Ngọc Bích',
    category: 'FREE',
    badgeLabel: 'Miễn phí',
    unlockCondition: 'Mở sẵn cho mọi tài khoản',
    durationHint: 'Vĩnh viễn',
    accent: '#1f7a8c',
  },
  {
    id: 'dawn-compass',
    name: 'La Bàn Bình Minh',
    category: 'FREE',
    badgeLabel: 'Miễn phí',
    unlockCondition: 'Mở sẵn cho mọi tài khoản',
    durationHint: 'Vĩnh viễn',
    accent: '#3a6f7c',
  },
  {
    id: 'scholar-olive',
    name: 'Nguyệt Quế Học Viện',
    category: 'FREE',
    badgeLabel: 'Miễn phí',
    unlockCondition: 'Mở sẵn cho mọi tài khoản',
    durationHint: 'Vĩnh viễn',
    accent: '#2f856e',
  },
  {
    id: 'class-top1',
    name: 'Quán Quân Lớp',
    category: 'CLASS_TOP',
    badgeLabel: 'Top 1 Lớp',
    unlockCondition: 'Đạt Hạng 1 Bảng Lớp cuối Tuần hoặc cuối Tháng',
    durationHint: 'Tuần: 7 ngày • Tháng: Vĩnh viễn',
    accent: '#d99b16',
  },
  {
    id: 'class-top2',
    name: 'Á Quân Lớp',
    category: 'CLASS_TOP',
    badgeLabel: 'Top 2 Lớp',
    unlockCondition: 'Đạt Hạng 2 Bảng Lớp cuối Tuần hoặc cuối Tháng',
    durationHint: 'Tuần: 7 ngày • Tháng: Vĩnh viễn',
    accent: '#64748b',
  },
  {
    id: 'class-top3',
    name: 'Quý Quân Lớp',
    category: 'CLASS_TOP',
    badgeLabel: 'Top 3 Lớp',
    unlockCondition: 'Đạt Hạng 3 Bảng Lớp cuối Tuần hoặc cuối Tháng',
    durationHint: 'Tuần: 7 ngày • Tháng: Vĩnh viễn',
    accent: '#b46934',
  },
  {
    id: 'center-top1',
    name: 'Đế Vương Toàn Trung Tâm',
    category: 'CENTER_TOP',
    badgeLabel: 'Top 1 Trung Tâm',
    unlockCondition: 'Đạt Hạng 1 Toàn Trung Tâm (Tuần ≥ 50 EXP • Tháng ≥ 200 EXP)',
    durationHint: 'Tuần: 7 ngày • Tháng: Vĩnh viễn',
    accent: '#eab308',
  },
  {
    id: 'center-top2',
    name: 'Đại Cao Thủ Trung Tâm',
    category: 'CENTER_TOP',
    badgeLabel: 'Top 2 Trung Tâm',
    unlockCondition: 'Đạt Hạng 2 Toàn Trung Tâm (Tuần ≥ 50 EXP • Tháng ≥ 200 EXP)',
    durationHint: 'Tuần: 7 ngày • Tháng: Vĩnh viễn',
    accent: '#e11d48',
  },
  {
    id: 'center-top3',
    name: 'Tinh Anh Trung Tâm',
    category: 'CENTER_TOP',
    badgeLabel: 'Top 3 Trung Tâm',
    unlockCondition: 'Đạt Hạng 3 Toàn Trung Tâm (Tuần ≥ 50 EXP • Tháng ≥ 200 EXP)',
    durationHint: 'Tuần: 7 ngày • Tháng: Vĩnh viễn',
    accent: '#0284c7',
  },
  {
    id: 'streak-7',
    name: 'Lửa Bền Bỉ 7 Ngày',
    category: 'STREAK',
    badgeLabel: 'Streak 7N',
    unlockCondition: 'Duy trì chuỗi học liên tiếp 7 ngày',
    durationHint: 'Vĩnh viễn',
    accent: '#ea580c',
  },
  {
    id: 'streak-30',
    name: 'Chiến Thần 30 Ngày',
    category: 'STREAK',
    badgeLabel: 'Streak 30N',
    unlockCondition: 'Duy trì chuỗi học liên tiếp 30 ngày',
    durationHint: 'Vĩnh viễn',
    accent: '#dc2626',
  },
  {
    id: 'streak-100',
    name: 'Bất Diệt 100 Ngày',
    category: 'STREAK',
    badgeLabel: 'Streak 100N',
    unlockCondition: 'Duy trì chuỗi học liên tiếp 100 ngày',
    durationHint: 'Vĩnh viễn',
    accent: '#0d9488',
  },
  {
    id: 'staff-mentor',
    name: 'Cố Vấn Đào Tạo',
    category: 'STAFF',
    badgeLabel: 'Staff / Admin',
    unlockCondition: 'Khung đặc quyền dành cho Giáo viên & Quản trị viên',
    durationHint: 'Vĩnh viễn',
    accent: '#1d4ed8',
  },
]

export function getFrameDef(frameId?: string | null): AvatarFrameDef {
  return AVATAR_FRAMES.find((f) => f.id === frameId) ?? AVATAR_FRAMES[0]!
}

export function isFreeFrame(frameId: string): boolean {
  return (FREE_FRAME_IDS as readonly string[]).includes(frameId)
}

/** Resolves the visible frame for any account, falling back to 'none' once a student's 7-day frame expires. */
export function effectiveAvatarFrame(
  role: Role | string,
  frameId: string | null | undefined,
  expiresAt: Date | string | null | undefined,
  now = new Date(),
): AvatarFrameId {
  const valid = AVATAR_FRAMES.find((f) => f.id === frameId)?.id
  if (!valid || valid === 'none') return 'none'
  if (role === 'ADMIN' || role === 'TEACHER') return valid
  if (valid === 'staff-mentor') return 'none'
  if (isFreeFrame(valid)) return valid
  if (!expiresAt) return valid
  const exp = expiresAt instanceof Date ? expiresAt : new Date(expiresAt)
  return !Number.isNaN(exp.getTime()) && exp.getTime() > now.getTime() ? valid : 'none'
}

export const equipFrameSchema = z.object({
  frameId: z.enum(AVATAR_FRAME_IDS),
})
export type EquipFrameInput = z.infer<typeof equipFrameSchema>
