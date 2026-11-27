import { useSite } from '@/features/site/SiteSettingsProvider'

/** Full-screen splash while the app restores a session, before the shell is shown. */
export function LoadingScreen({ message = 'Đang mở cổng học viên…' }: { message?: string }) {
  const site = useSite()
  return (
    <div className={`relative grid min-h-screen place-items-center overflow-hidden text-ink ${site.backgroundMode === 'fixed' ? 'bg-paper' : ''}`} role="status" aria-live="polite">
      {site.backgroundMode === 'fixed' ? <div className="pointer-events-none absolute inset-0 site-wash" /> : null}
      <div className="relative flex flex-col items-center px-6 text-center">
        <div className="relative grid size-24 place-items-center">
          <span className="absolute inset-0 animate-spin rounded-full border-2 border-gold border-t-gold-deep" style={{ animationDuration: '1.1s' }} />
          <img
            src={site.logoUrl || '/logo.png'}
            alt=""
            className="size-16 rounded-full bg-cream object-contain ring-1 ring-ink/8 shadow-[0_8px_28px_rgba(20,56,153,0.20)]"
          />
        </div>
        <p className="mt-6 max-w-full font-[family-name:var(--font-display)] text-lg font-bold tracking-tight break-words text-ink">{site.brandName}</p>
        <p className="mt-1 max-w-full text-[12px] font-semibold tracking-[0.14em] break-words text-crimson uppercase sm:tracking-[0.22em]">{site.slogan}</p>
        <p className="mt-6 text-sm text-ink-soft">{message}</p>
      </div>
    </div>
  )
}

/** Centered loader inside a page that already has the app shell. */
export function PageLoading({ message }: { message: string }) {
  return (
    <div className="grid min-h-[46vh] place-items-center px-6" role="status" aria-live="polite">
      <div className="flex flex-col items-center text-center">
        <span className="size-11 animate-spin rounded-full border-2 border-gold border-t-gold-deep" style={{ animationDuration: '1.1s' }} />
        <p className="mt-4 text-sm text-ink-soft">{message}</p>
      </div>
    </div>
  )
}
