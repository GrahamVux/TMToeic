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
  /** Primary buttons. Omitted on older saves, which keep the stored color. */
  button: hexColor.optional(),
})
export type SiteThemeDto = z.infer<typeof siteThemeSchema>

/** `fixed` paints the page with the theme paper color. `sky` follows the clock with sun/moon. `gradient` applies seasonal/holiday gradients. */
export const backgroundModeSchema = z.enum(['fixed', 'sky', 'gradient'])
export type BackgroundMode = z.infer<typeof backgroundModeSchema>

export const THEME_PRESET_IDS = [
  'classic',
  'auto',
  'spring',
  'summer',
  'autumn',
  'winter',
  'tet',
  'liberation',
  'national_day',
  'mid_autumn',
  'halloween',
  'christmas',
] as const
export type ThemePresetId = (typeof THEME_PRESET_IDS)[number]
export type ConcreteThemePresetId = Exclude<ThemePresetId, 'auto'>

export type ThemePresetDef = {
  id: ThemePresetId
  group: 'general' | 'season' | 'holiday'
  label: string
  subtitle: string
  emoji: string
  lightGradient: string
  darkGradient: string
  lightAccent: string
  darkAccent: string
  lightPaper: string
  darkPaper: string
}

export const THEME_PRESETS: readonly ThemePresetDef[] = [
  {
    id: 'classic',
    group: 'general',
    label: 'Xanh Học Thuật Chuẩn',
    subtitle: 'Khung cảnh xanh học thuật thanh lịch mặc định',
    emoji: '🌊',
    lightGradient: 'radial-gradient(at 10% 14%, #dbeafe 0%, transparent 46%), radial-gradient(at 90% 12%, #fdecee 0%, transparent 42%), linear-gradient(145deg, #f6f8fc 0%, #edf2fb 55%, #f4f7fc 100%)',
    darkGradient: 'radial-gradient(at 12% 15%, rgba(20, 56, 153, 0.34) 0%, transparent 50%), radial-gradient(at 88% 18%, rgba(217, 35, 46, 0.14) 0%, transparent 46%), linear-gradient(145deg, #080f1d 0%, #0d172a 55%, #0b1218 100%)',
    lightAccent: '#143899',
    darkAccent: '#60a5fa',
    lightPaper: '#f6f8fc',
    darkPaper: '#0b1218',
  },
  {
    id: 'auto',
    group: 'general',
    label: 'Tự động theo lịch VN',
    subtitle: 'Tự chuyển cảnh nền theo mùa & ngày lễ',
    emoji: '🗓️',
    lightGradient: 'linear-gradient(135deg, #e0f7fa 0%, #fce4ec 50%, #fff8e1 100%)',
    darkGradient: 'linear-gradient(135deg, #0e1e26 0%, #241428 50%, #241c0d 100%)',
    lightAccent: '#143899',
    darkAccent: '#7bdff2',
    lightPaper: '#f6fafc',
    darkPaper: '#0c121b',
  },
  {
    id: 'spring',
    group: 'season',
    label: 'Mùa Xuân',
    subtitle: 'Nhành hoa đào nắng ấm & cánh hoa rơi nhẹ',
    emoji: '🌸',
    lightGradient: 'radial-gradient(at 12% 18%, #ffdce8 0%, transparent 48%), radial-gradient(at 88% 15%, #d6f5df 0%, transparent 50%), linear-gradient(145deg, #fff5f8 0%, #fef9ef 50%, #f1fbf4 100%)',
    darkGradient: 'radial-gradient(at 15% 18%, rgba(235, 108, 155, 0.24) 0%, transparent 50%), radial-gradient(at 85% 20%, rgba(56, 178, 122, 0.22) 0%, transparent 48%), linear-gradient(145deg, #170d14 0%, #15141c 50%, #0c1b15 100%)',
    lightAccent: '#c94a7c',
    darkAccent: '#f48fb1',
    lightPaper: '#fff6f9',
    darkPaper: '#160d14',
  },
  {
    id: 'summer',
    group: 'season',
    label: 'Mùa Hạ',
    subtitle: 'Biển xanh hàng dừa rặng mây & hoa dâm bụt',
    emoji: '☀️',
    lightGradient: 'radial-gradient(at 18% 12%, #ffe7a3 0%, transparent 46%), radial-gradient(at 88% 22%, #bfe9ff 0%, transparent 52%), linear-gradient(145deg, #fffcf0 0%, #eef9ff 55%, #e3f5fd 100%)',
    darkGradient: 'radial-gradient(at 16% 14%, rgba(245, 179, 53, 0.24) 0%, transparent 48%), radial-gradient(at 84% 20%, rgba(28, 134, 214, 0.28) 0%, transparent 50%), linear-gradient(145deg, #0b1422 0%, #0d1d2e 55%, #161822 100%)',
    lightAccent: '#0c7bb3',
    darkAccent: '#5cc8ff',
    lightPaper: '#f5fbff',
    darkPaper: '#0b1422',
  },
  {
    id: 'autumn',
    group: 'season',
    label: 'Mùa Thu',
    subtitle: 'Con đường lá phong vàng & khung lá thu rơi',
    emoji: '🍁',
    lightGradient: 'radial-gradient(at 14% 16%, #ffe0b5 0%, transparent 48%), radial-gradient(at 86% 18%, #f8d2c6 0%, transparent 48%), linear-gradient(145deg, #fffaf3 0%, #fdf1e6 55%, #f9ebe2 100%)',
    darkGradient: 'radial-gradient(at 16% 16%, rgba(224, 128, 48, 0.26) 0%, transparent 50%), radial-gradient(at 84% 22%, rgba(188, 72, 64, 0.22) 0%, transparent 48%), linear-gradient(145deg, #1b110b 0%, #1d1410 55%, #161012 100%)',
    lightAccent: '#b85318',
    darkAccent: '#ffb26b',
    lightPaper: '#fff9f2',
    darkPaper: '#1b110b',
  },
  {
    id: 'winter',
    group: 'season',
    label: 'Mùa Đông',
    subtitle: 'Ngôi nhà gỗ tuyết trắng, thông xanh & chim cổ đỏ',
    emoji: '❄️',
    lightGradient: 'radial-gradient(at 16% 16%, #d6e4ff 0%, transparent 50%), radial-gradient(at 88% 18%, #e4dcff 0%, transparent 48%), linear-gradient(145deg, #f5f8ff 0%, #edf3ff 55%, #f2f0ff 100%)',
    darkGradient: 'radial-gradient(at 15% 15%, rgba(88, 134, 240, 0.26) 0%, transparent 50%), radial-gradient(at 85% 20%, rgba(139, 92, 246, 0.24) 0%, transparent 50%), linear-gradient(145deg, #090e1c 0%, #0f172a 55%, #131126 100%)',
    lightAccent: '#4361c4',
    darkAccent: '#8cb4ff',
    lightPaper: '#f5f8ff',
    darkPaper: '#090e1c',
  },
  {
    id: 'tet',
    group: 'holiday',
    label: 'Tết Nguyên Đán',
    subtitle: 'Hoa mai vàng, bánh chưng xanh & lồng đèn đỏ',
    emoji: '🧧',
    lightGradient: 'radial-gradient(at 15% 15%, #ffd2cc 0%, transparent 48%), radial-gradient(at 86% 16%, #ffeb99 0%, transparent 48%), linear-gradient(145deg, #fff5f3 0%, #fff8ea 55%, #ffeef0 100%)',
    darkGradient: 'radial-gradient(at 16% 16%, rgba(220, 48, 56, 0.3) 0%, transparent 50%), radial-gradient(at 85% 18%, rgba(235, 178, 36, 0.24) 0%, transparent 48%), linear-gradient(145deg, #1d0a0c 0%, #24100f 55%, #1c1409 100%)',
    lightAccent: '#c82834',
    darkAccent: '#ff7b82',
    lightPaper: '#fff7f5',
    darkPaper: '#1d0a0c',
  },
  {
    id: 'liberation',
    group: 'holiday',
    label: 'Đại lễ 30/4 – 1/5',
    subtitle: 'Cờ đỏ sao vàng tung bay, phố hoa & chim bồ câu',
    emoji: '🇻🇳',
    lightGradient: 'radial-gradient(at 14% 16%, #ffcfc9 0%, transparent 46%), radial-gradient(at 86% 18%, #c9f0ff 0%, transparent 50%), linear-gradient(145deg, #fff8f5 0%, #fffbeb 50%, #f0f9ff 100%)',
    darkGradient: 'radial-gradient(at 16% 16%, rgba(214, 52, 52, 0.28) 0%, transparent 48%), radial-gradient(at 86% 20%, rgba(234, 179, 8, 0.2) 0%, transparent 48%), linear-gradient(145deg, #1a0d10 0%, #17151f 55%, #0e1824 100%)',
    lightAccent: '#be292f',
    darkAccent: '#ff857a',
    lightPaper: '#fff9f7',
    darkPaper: '#1a0d10',
  },
  {
    id: 'national_day',
    group: 'holiday',
    label: 'Quốc Khánh 2/9',
    subtitle: 'Dải lụa cờ hoa, bản đồ Việt Nam & sao vàng rực rỡ',
    emoji: '⭐',
    lightGradient: 'radial-gradient(at 18% 14%, #ffd4cc 0%, transparent 48%), radial-gradient(at 82% 18%, #ffe9a8 0%, transparent 48%), linear-gradient(145deg, #fff6f4 0%, #fff9eb 55%, #fef2f2 100%)',
    darkGradient: 'radial-gradient(at 18% 14%, rgba(217, 45, 45, 0.3) 0%, transparent 50%), radial-gradient(at 82% 20%, rgba(245, 196, 51, 0.22) 0%, transparent 46%), linear-gradient(145deg, #1b090a 0%, #22100d 55%, #191208 100%)',
    lightAccent: '#b91c1c',
    darkAccent: '#fca5a5',
    lightPaper: '#fff6f5',
    darkPaper: '#1b090a',
  },
  {
    id: 'mid_autumn',
    group: 'holiday',
    label: 'Tết Trung Thu',
    subtitle: 'Trăng rằm vàng óng, đèn lồng trời & dải ngân hà',
    emoji: '🏮',
    lightGradient: 'radial-gradient(at 18% 14%, #fde3a7 0%, transparent 48%), radial-gradient(at 86% 18%, #d8d5ff 0%, transparent 50%), linear-gradient(145deg, #fffbef 0%, #f5f3ff 55%, #fef3c7 100%)',
    darkGradient: 'radial-gradient(at 20% 14%, rgba(245, 192, 66, 0.26) 0%, transparent 48%), radial-gradient(at 84% 22%, rgba(99, 102, 241, 0.3) 0%, transparent 52%), linear-gradient(145deg, #0e1026 0%, #151434 55%, #1d1829 100%)',
    lightAccent: '#6d4aff',
    darkAccent: '#fcd34d',
    lightPaper: '#fcfaff',
    darkPaper: '#0e1026',
  },
  {
    id: 'halloween',
    group: 'holiday',
    label: 'Halloween',
    subtitle: 'Lâu đài trăng cam bí ngô (Sáng) & Nghĩa địa tím (Tối)',
    emoji: '🎃',
    lightGradient: 'linear-gradient(180deg, #1f1109 0%, #b84b14 48%, #f4b740 100%)',
    darkGradient: 'linear-gradient(180deg, #160624 0%, #582082 55%, #12061c 100%)',
    lightAccent: '#c85012',
    darkAccent: '#c084fc',
    lightPaper: '#fff7f0',
    darkPaper: '#13071d',
  },
  {
    id: 'christmas',
    group: 'holiday',
    label: 'Giáng Sinh',
    subtitle: 'Phố tuyết rực sáng (Sáng) & Đêm cây thông sao (Tối)',
    emoji: '🎄',
    lightGradient: 'radial-gradient(at 14% 16%, #ccefdc 0%, transparent 48%), radial-gradient(at 86% 18%, #ffd6d6 0%, transparent 46%), linear-gradient(145deg, #e7f3ff 0%, #f4f9ff 55%, #fff5f5 100%)',
    darkGradient: 'radial-gradient(at 16% 16%, rgba(22, 163, 74, 0.26) 0%, transparent 50%), radial-gradient(at 84% 20%, rgba(220, 38, 38, 0.24) 0%, transparent 48%), linear-gradient(145deg, #0d1230 0%, #1a1542 55%, #1c0f1e 100%)',
    lightAccent: '#15803d',
    darkAccent: '#6ee7b7',
    lightPaper: '#f4fbf7',
    darkPaper: '#0d1230',
  },
]

const PRESET_MAP = new Map<ThemePresetId, ThemePresetDef>(THEME_PRESETS.map((p) => [p.id, p]))

/** Resolves `'auto'` into a concrete Vietnamese holiday or season preset using local Vietnam time. */
export function resolveThemePreset(preset: ThemePresetId, now = new Date()): ThemePresetDef {
  if (preset !== 'auto') {
    return PRESET_MAP.get(preset) ?? THEME_PRESETS[0]!
  }
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const month = Number(parts.find((p) => p.type === 'month')?.value ?? '1')
  const day = Number(parts.find((p) => p.type === 'day')?.value ?? '1')
  let concrete: ConcreteThemePresetId
  if ((month === 1 && day >= 18) || (month === 2 && day <= 15)) concrete = 'tet'
  else if ((month === 4 && day >= 26) || (month === 5 && day <= 3)) concrete = 'liberation'
  else if ((month === 8 && day >= 28) || (month === 9 && day <= 5)) concrete = 'national_day'
  else if (month === 9 && day >= 15 && day <= 30) concrete = 'mid_autumn'
  else if (month === 10 && day >= 20 && day <= 31) concrete = 'halloween'
  else if (month === 12 && day >= 15) concrete = 'christmas'
  else if (month >= 2 && month <= 4) concrete = 'spring'
  else if (month >= 5 && month <= 7) concrete = 'summer'
  else if (month >= 8 && month <= 10) concrete = 'autumn'
  else concrete = 'winter'
  return PRESET_MAP.get(concrete) ?? THEME_PRESETS[0]!
}

export const DEFAULT_SITE_THEME: SiteThemeDto = {
  primary: '#143899',
  primarySoft: '#dbeafe',
  paper: '#f6f8fc',
  button: '#143899',
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
  backgroundMode: 'fixed' as BackgroundMode,
  themePreset: 'classic' as ThemePresetId,
  logoUrl: null as string | null,
  faviconUrl: null as string | null,
  /** Weekly honor boards on the student home. Admin can hide the whole block. */
  honorBoardEnabled: true,
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
  backgroundMode: backgroundModeSchema.optional(),
  themePreset: z.enum(THEME_PRESET_IDS).optional(),
  /** data URL to replace; null clears back to the default logo. */
  logoUrl: z.union([dataUrl, z.null()]).optional(),
  faviconUrl: z.union([dataUrl, z.null()]).optional(),
  honorBoardEnabled: z.boolean().optional(),
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
