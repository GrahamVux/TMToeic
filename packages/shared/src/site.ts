import { z } from 'zod'

const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Màu phải dạng #RRGGBB')

const dataUrl = z
  .string()
  .refine(
    (v) => /^data:image\/(png|jpe?g|webp|gif|svg\+xml|x-icon|vnd\.microsoft\.icon);base64,/i.test(v),
    'Chỉ nhận ảnh PNG, JPEG, WEBP, GIF, SVG hoặc ICO',
  )
  .refine((v) => v.length <= 2_000_000, 'Ảnh quá lớn (tối đa khoảng 1.5MB)')

export const siteThemeSchema = z.object({
  primary: hexColor,
  primarySoft: hexColor,
  paper: hexColor,
})
export type SiteThemeDto = z.infer<typeof siteThemeSchema>

export const DEFAULT_SITE_THEME: SiteThemeDto = {
  primary: '#2b8a9c',
  primarySoft: '#b9e4ec',
  paper: '#f7fbfd',
}

export const DEFAULT_SITE_SETTINGS = {
  brandName: 'MR. MINH TOEIC',
  slogan: 'Lớp học nội bộ',
  loginHeadline: 'Cổng học viên nội bộ lớp TOEIC 800+',
  loginIntro:
    'Tài khoản do Thầy Minh cấp phát — không đăng ký công khai. Luyện Listening, Reading, từ vựng, ngữ pháp và theo dõi tiến độ theo lộ trình lớp K42.',
  footerAbout:
    'Cổng luyện đề và học tập trực tuyến độc quyền cho học viên khoá TOEIC 800+. Tài khoản do Thầy Minh cấp phát và quản lý học vụ.',
  supportHeading: 'Hỗ trợ học tập & trợ giảng',
  supportDetail: 'Thầy Minh (Trực tiếp): giải đáp bài khó & chữa đề chuyên sâu',
  phone: '0988.xxx.888',
  address: '',
  hours: '8:00 – 22:00',
  channelHeading: 'Kênh trao đổi lớp học',
  channelDetail: 'Group Zalo Lớp K42 (Nhận thông báo)\nKho tài liệu Drive độc quyền Thầy Minh',
  legalNote: 'Mã bảo mật lớp: TM-K42-INTERNAL • Hệ thống phân tích chuẩn ETS',
  copyright: '© 2026 MR. MINH TOEIC Academy • Cổng học viên nội bộ lớp học.',
  theme: DEFAULT_SITE_THEME,
  logoUrl: null as string | null,
  faviconUrl: null as string | null,
}

export type SiteSettingsDto = typeof DEFAULT_SITE_SETTINGS & { updatedAt: string }

const text = (min: number, max: number) => z.string().trim().min(min).max(max)

export const updateSiteSettingsSchema = z.object({
  brandName: text(2, 80).optional(),
  slogan: text(2, 80).optional(),
  loginHeadline: text(2, 160).optional(),
  loginIntro: text(2, 600).optional(),
  footerAbout: text(2, 600).optional(),
  supportHeading: text(2, 80).optional(),
  supportDetail: text(0, 400).optional(),
  phone: text(0, 40).optional(),
  address: text(0, 200).optional(),
  hours: text(0, 40).optional(),
  channelHeading: text(2, 80).optional(),
  channelDetail: text(0, 400).optional(),
  legalNote: text(0, 200).optional(),
  copyright: text(2, 200).optional(),
  theme: siteThemeSchema.optional(),
  /** data URL to replace; null clears back to the default logo. */
  logoUrl: z.union([dataUrl, z.null()]).optional(),
  faviconUrl: z.union([dataUrl, z.null()]).optional(),
})
export type UpdateSiteSettingsInput = z.infer<typeof updateSiteSettingsSchema>

const emptyToNull = (v: string) => {
  const t = v.trim()
  return t.length === 0 ? null : t
}

export const updateProfileSchema = z.object({
  fullName: text(2, 120),
  email: z
    .string()
    .max(254)
    .transform(emptyToNull)
    .refine((v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Email không hợp lệ'),
  phone: z
    .string()
    .max(32)
    .transform(emptyToNull)
    .refine((v) => v === null || v.length >= 8, 'Số điện thoại tối thiểu 8 ký tự'),
})
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
