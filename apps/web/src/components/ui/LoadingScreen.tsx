import { useSite } from '@/features/site/SiteSettingsProvider'

/** Full-screen splash while the app restores a session, before the shell is shown. */
export function LoadingScreen({ message = 'Đang mở cổng học viên…' }: { message?: string }) {
  const site = useSite()
  return (
    <div
      className={`relative grid min-h-screen place-items-center overflow-hidden px-4 py-8 text-ink ${site.backgroundMode === 'fixed' ? 'bg-paper' : ''}`}
      role="status"
      aria-live="polite"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[3px] bg-linear-to-r from-button via-navy to-crimson" />
      {site.backgroundMode === 'fixed' ? <div className="pointer-events-none absolute inset-0 site-wash" /> : null}
      <div className="loading-medallion relative z-10 flex min-h-[320px] w-[320px] max-w-[90vw] flex-col items-center justify-center rounded-full border-2 border-gold/60 px-8 py-9 text-center shadow-[0_28px_80px_rgba(15,23,42,0.24)] sm:min-h-[376px] sm:w-[376px] sm:px-10">
        <div className="relative grid size-28 place-items-center sm:size-32">
          <span
            aria-hidden="true"
            className="absolute inset-0 animate-spin rounded-full border-[3px] border-button/20 border-t-button border-r-crimson"
            style={{ animationDuration: '1.1s' }}
          />
          <img
            src={site.logoUrl || '/logo.png'}
            alt=""
            className="size-20 rounded-full bg-[#ffffff] p-1.5 object-contain ring-2 ring-button/15 shadow-[0_10px_28px_rgba(20,56,153,0.22)] sm:size-24"
          />
        </div>
        <p className="mt-5 max-w-full font-[family-name:var(--font-display)] text-2xl font-extrabold leading-tight tracking-tight break-words text-navy sm:text-[28px]">
          {site.brandName}
        </p>
        <span className="mt-2 inline-flex max-w-full items-center rounded-full bg-crimson px-3.5 py-1 text-xs font-bold tracking-[0.16em] break-words text-white uppercase shadow-2xs dark:bg-red-600">
          {site.slogan}
        </span>
        <p className="mt-4 text-base font-semibold text-ink">{message}</p>
      </div>
    </div>
  )
}

/** Centered loader inside a page that already has the app shell. */
export function PageLoading({ message }: { message: string }) {
  return (
    <div className="grid min-h-[46vh] place-items-center px-6" role="status" aria-live="polite">
      <div className="flex flex-col items-center text-center">
        <span className="size-12 animate-spin rounded-full border-[3px] border-button/20 border-t-button border-r-crimson" style={{ animationDuration: '1.1s' }} />
        <p className="mt-4 text-base font-medium text-ink-soft">{message}</p>
      </div>
    </div>
  )
}
