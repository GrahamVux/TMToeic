import { useAuth } from '@/app/AuthContext'
import { Button } from '@/components/ui/Button'
import { CornerNotice, flashNotice, type CornerNoticeState } from '@/components/ui/CornerNotice'
import { Badge, Card, Input } from '@/components/ui/Primitives'
import { SkyBackdrop } from '@/features/site/SkyBackdrop'
import { skyClockLabel } from '@/features/site/sky'
import { applySiteTheme, buttonColors, useSiteSettings, useUpdateSiteSettings } from '@/features/site/site.queries'
import { useSite } from '@/features/site/SiteSettingsProvider'
import { cn } from '@/lib/cn'
import { DEFAULT_SITE_THEME, type SiteThemeDto, type UpdateSiteSettingsInput } from '@toeic/shared'
import { useEffect, useRef, useState } from 'react'

const field = 'mt-1 h-10 w-full rounded-xl border border-gold/40 bg-white px-3 text-sm outline-none focus:border-button focus:ring-2 focus:ring-button/30'
const area = 'mt-1 min-h-24 w-full rounded-xl border border-gold/40 bg-white px-3 py-2 text-sm outline-none focus:border-button focus:ring-2 focus:ring-button/30'

type Section = 'honor' | 'brand' | 'login' | 'contact' | 'theme'

const SECTION_KEYS: Record<Section, (keyof UpdateSiteSettingsInput)[]> = {
  honor: ['honorBoardEnabled'],
  brand: ['brandName', 'slogan', 'logoUrl', 'faviconUrl'],
  login: ['loginHeadline', 'loginIntro'],
  contact: ['phone', 'hours', 'address', 'footerAbout', 'supportHeading', 'supportDetail', 'channelHeading', 'channelDetail', 'legalNote', 'copyright'],
  theme: ['theme', 'backgroundMode'],
}

const SAVED: Record<Section, string> = {
  honor: 'Đã lưu bảng vinh danh.',
  brand: 'Đã lưu thương hiệu.',
  login: 'Đã lưu trang đăng nhập.',
  contact: 'Đã lưu liên hệ và footer.',
  theme: 'Đã lưu màu theme.',
}

function readImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('Không đọc được file'))
    r.readAsDataURL(file)
  })
}

export function SiteSettingsPage() {
  const { user } = useAuth()
  const remote = useSiteSettings()
  const site = useSite()
  const save = useUpdateSiteSettings()
  const [form, setForm] = useState<UpdateSiteSettingsInput>({})
  const [notice, setNotice] = useState<CornerNoticeState | null>(null)
  const [saving, setSaving] = useState<Section | null>(null)
  const [err, setErr] = useState<{ section: Section; text: string } | null>(null)
  const loaded = useRef(false)

  useEffect(() => {
    if (!remote.data || loaded.current) return
    loaded.current = true
    setForm({
      brandName: remote.data.brandName,
      slogan: remote.data.slogan,
      loginHeadline: remote.data.loginHeadline,
      loginIntro: remote.data.loginIntro,
      footerAbout: remote.data.footerAbout,
      supportHeading: remote.data.supportHeading,
      supportDetail: remote.data.supportDetail,
      phone: remote.data.phone,
      address: remote.data.address,
      hours: remote.data.hours,
      channelHeading: remote.data.channelHeading,
      channelDetail: remote.data.channelDetail,
      legalNote: remote.data.legalNote,
      copyright: remote.data.copyright,
      theme: { ...remote.data.theme },
      backgroundMode: remote.data.backgroundMode,
      honorBoardEnabled: remote.data.honorBoardEnabled,
    })
  }, [remote.data])

  if (user?.role !== 'ADMIN') {
    return (
      <Card className="p-6">
        <h1 className="serif text-2xl">Cài đặt giao diện</h1>
        <p className="mt-2 text-sm text-ink/60">Chỉ quản trị viên mới được đổi logo, khẩu hiệu, footer và màu theme.</p>
      </Card>
    )
  }

  function set<K extends keyof UpdateSiteSettingsInput>(key: K, value: UpdateSiteSettingsInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function onFile(kind: 'logoUrl' | 'faviconUrl', file: File | undefined) {
    if (!file) return
    setErr(null)
    try {
      const url = await readImage(file)
      set(kind, url)
    } catch {
      setErr({ section: 'brand', text: 'Không đọc được ảnh. Dùng PNG, JPEG, WEBP hoặc ICO, dưới 1.5MB.' })
    }
  }

  async function saveSection(section: Section) {
    const patch: UpdateSiteSettingsInput = {}
    for (const key of SECTION_KEYS[section]) {
      const value = form[key]
      if (value !== undefined) (patch as Record<string, unknown>)[key] = value
    }
    setErr(null)
    setSaving(section)
    try {
      const next = await save.mutateAsync(patch)
      applySiteTheme(next)
      setNotice(flashNotice(SAVED[section]))
    } catch {
      setErr({ section, text: 'Không lưu được. Kiểm tra ảnh (định dạng/kích thước) và các ô bắt buộc.' })
    } finally {
      setSaving(null)
    }
  }

  const previewLogo = (form.logoUrl === undefined ? site.logoUrl : form.logoUrl) || '/logo.png'
  const theme = form.theme ?? site.theme
  const backgroundMode = form.backgroundMode ?? site.backgroundMode
  const buttonLook = buttonColors(theme.button ?? DEFAULT_SITE_THEME.button!)

  function paintTheme(next: SiteThemeDto) {
    set('theme', next)
    applySiteTheme({ ...site, theme: next, backgroundMode })
  }

  return (
    <div className="space-y-6">
      <CornerNotice notice={notice} />
      <header>
        <p className="text-xs tracking-[0.18em] text-gold-deep uppercase">Cài đặt cổng học</p>
        <h1 className="serif mt-2 text-3xl sm:text-4xl">Logo, khẩu hiệu, footer & màu theme</h1>
        <p className="mt-2 text-sm text-ink/60">Thay đổi được lưu vào hệ thống và hiện ngay trên trang học viên, không cần sửa database.</p>
      </header>

      <Card className="p-6">
        <h2 className="serif text-2xl">Bảng vinh danh</h2>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.honorBoardEnabled ?? true}
            onChange={(e) => set('honorBoardEnabled', e.target.checked)}
          />
          Hiện bảng vinh danh năm trên trang học viên
        </label>
        <p className="mt-2 text-xs text-ink/55">Tắt thì cả hai bảng (trong lớp và trong trung tâm) biến mất, kể cả hạng EXP.</p>
        <SectionSave section="honor" saving={saving} error={err} onSave={saveSection} />
      </Card>

      <Card className="p-6">
        <h2 className="serif text-2xl">Thương hiệu</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">
            Tên thương hiệu
            <Input className={field} value={form.brandName ?? ''} onChange={(e) => set('brandName', e.target.value)} />
          </label>
          <label className="text-sm font-medium">
            Khẩu hiệu
            <Input className={field} value={form.slogan ?? ''} onChange={(e) => set('slogan', e.target.value)} />
          </label>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm font-medium">Logo</p>
            <div className="mt-2 flex items-center gap-3">
              <img src={previewLogo} alt="" className="size-14 rounded-full bg-white object-contain shadow" />
              <label className="inline-flex cursor-pointer rounded-full bg-paper-2 px-3 py-2 text-sm font-semibold">
                Chọn ảnh
                <input className="hidden" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,.ico" onChange={(e) => void onFile('logoUrl', e.target.files?.[0])} />
              </label>
              {form.logoUrl || site.logoUrl ? (
                <Button variant="ghost" type="button" onClick={() => set('logoUrl', null)}>
                  Dùng logo mặc định
                </Button>
              ) : null}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium">Favicon (icon tab trình duyệt)</p>
            <label className="mt-2 inline-flex cursor-pointer rounded-full bg-paper-2 px-3 py-2 text-sm font-semibold">
              Chọn icon
              <input className="hidden" type="file" accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/jpeg,image/webp,.ico" onChange={(e) => void onFile('faviconUrl', e.target.files?.[0])} />
            </label>
            {form.faviconUrl || site.faviconUrl ? (
              <Button className="ml-2" variant="ghost" type="button" onClick={() => set('faviconUrl', null)}>
                Xóa
              </Button>
            ) : null}
          </div>
        </div>
        <SectionSave section="brand" saving={saving} error={err} onSave={saveSection} />
      </Card>

      <Card className="p-6">
        <h2 className="serif text-2xl">Trang đăng nhập</h2>
        <label className="mt-4 block text-sm font-medium">
          Tiêu đề
          <Input className={field} value={form.loginHeadline ?? ''} onChange={(e) => set('loginHeadline', e.target.value)} />
        </label>
        <label className="mt-3 block text-sm font-medium">
          Đoạn giới thiệu
          <textarea className={area} value={form.loginIntro ?? ''} onChange={(e) => set('loginIntro', e.target.value)} />
        </label>
        <SectionSave section="login" saving={saving} error={err} onSave={saveSection} />
      </Card>

      <Card className="p-6">
        <h2 className="serif text-2xl">Liên hệ & footer</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">
            Số điện thoại
            <Input className={field} value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
          </label>
          <label className="text-sm font-medium">
            Giờ hỗ trợ
            <Input className={field} value={form.hours ?? ''} onChange={(e) => set('hours', e.target.value)} />
          </label>
        </div>
        <label className="mt-3 block text-sm font-medium">
          Địa chỉ
          <Input className={field} value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} />
        </label>
        <label className="mt-3 block text-sm font-medium">
          Mô tả cột trái (footer)
          <textarea className={area} value={form.footerAbout ?? ''} onChange={(e) => set('footerAbout', e.target.value)} />
        </label>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">
            Tiêu đề cột hỗ trợ
            <Input className={field} value={form.supportHeading ?? ''} onChange={(e) => set('supportHeading', e.target.value)} />
          </label>
          <label className="text-sm font-medium">
            Nội dung hỗ trợ
            <textarea className={area} value={form.supportDetail ?? ''} onChange={(e) => set('supportDetail', e.target.value)} />
          </label>
        </div>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">
            Tiêu đề kênh lớp
            <Input className={field} value={form.channelHeading ?? ''} onChange={(e) => set('channelHeading', e.target.value)} />
          </label>
          <label className="text-sm font-medium">
            Nội dung kênh lớp
            <textarea className={area} value={form.channelDetail ?? ''} onChange={(e) => set('channelDetail', e.target.value)} />
          </label>
        </div>
        <label className="mt-3 block text-sm font-medium">
          Ghi chú pháp lý
          <Input className={field} value={form.legalNote ?? ''} onChange={(e) => set('legalNote', e.target.value)} />
        </label>
        <label className="mt-3 block text-sm font-medium">
          Dòng bản quyền
          <Input className={field} value={form.copyright ?? ''} onChange={(e) => set('copyright', e.target.value)} />
        </label>
        <SectionSave section="contact" saving={saving} error={err} onSave={saveSection} />
      </Card>

      <Card className="p-6">
        <h2 className="serif text-2xl">Màu theme</h2>
        <p className="mt-1 text-sm text-ink/55">Màu chủ đạo áp dụng liên kết, banner và thanh tiến độ. Màu nút áp dụng nút chính, mục đang chọn và điểm nhấn.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {([['fixed', 'Màu cố định'], ['sky', 'Theo thời gian']] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => set('backgroundMode', id)}
              className={cn('rounded-full px-4 py-2 text-sm font-semibold', backgroundMode === id ? 'bg-button text-button-ink' : 'bg-paper-2 text-ink/70')}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-ink/60">
          {backgroundMode === 'sky'
            ? `Mặt trời đi sát mép trái, mặt trăng đi sát mép phải, đối nhau theo giờ Việt Nam, hiện ${skyClockLabel()}. Nửa trái là nắng vàng nhẹ, nửa phải là ánh trăng.`
            : 'Toàn trang dùng một màu nền. Đổi màu ở ô Màu nền cố định.'}
        </p>
        <div className="relative mt-3 h-64 overflow-hidden rounded-2xl border border-gold/30">
          {backgroundMode === 'sky' ? <SkyBackdrop embedded /> : <div className="absolute inset-0" style={{ background: theme.paper }} />}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <ColorField label="Màu chủ đạo" value={theme.primary} onChange={(primary) => paintTheme({ ...theme, primary })} />
          <ColorField label="Màu nhấn nhạt" value={theme.primarySoft} onChange={(primarySoft) => paintTheme({ ...theme, primarySoft })} />
          <ColorField label="Màu nền cố định" value={theme.paper} onChange={(paper) => paintTheme({ ...theme, paper })} />
          <ColorField label="Màu nút chính" value={theme.button ?? DEFAULT_SITE_THEME.button!} onChange={(button) => paintTheme({ ...theme, button })} />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge>Xem thử</Badge>
          <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: buttonLook.background, color: buttonLook.ink }}>Nút chính</span>
          <span className="rounded-full bg-teal-soft px-3 py-1 text-xs font-semibold text-gold-deep">Nhấn nhạt</span>
        </div>
        <SectionSave section="theme" saving={saving} error={err} onSave={saveSection} />
      </Card>
    </div>
  )
}

function SectionSave({
  section,
  saving,
  error,
  onSave,
}: {
  section: Section
  saving: Section | null
  error: { section: Section; text: string } | null
  onSave: (section: Section) => void
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <Button type="button" disabled={saving !== null} onClick={() => onSave(section)}>
        {saving === section ? 'Đang lưu…' : 'Lưu'}
      </Button>
      {error?.section === section ? (
        <p className="text-sm text-coral" role="alert">
          {error.text}
        </p>
      ) : null}
    </div>
  )
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="text-sm font-medium">
      {label}
      <span className="mt-1 flex items-center gap-2">
        <input className="h-10 w-14 cursor-pointer rounded-lg border border-gold/40 bg-white" type="color" value={value} onChange={(e) => onChange(e.target.value)} />
        <Input className={cn(field, 'font-mono')} value={value} onChange={(e) => onChange(e.target.value)} />
      </span>
    </label>
  )
}
