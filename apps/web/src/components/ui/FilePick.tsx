import type { ChangeEvent } from 'react'

/**
 * File chooser that stays visually separate from text fields and pill buttons.
 * `chosen === null` shows “Chưa chọn”. Omit `chosen` when the pick uploads immediately.
 */
export function FilePick({
  label,
  accept,
  multiple,
  disabled,
  chosen,
  hint,
  onFiles,
}: {
  label: string
  accept: string
  multiple?: boolean
  disabled?: boolean
  chosen?: string | null
  hint?: string
  onFiles: (files: File[]) => void
}) {
  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])]
    if (files.length) onFiles(files)
    e.target.value = ''
  }

  return (
    <div className="rounded-xl bg-teal-soft px-3 py-2.5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <label className={disabled ? 'pointer-events-none opacity-50' : 'group cursor-pointer'}>
          <input className="sr-only" type="file" accept={accept} multiple={multiple} disabled={disabled} onChange={onChange} />
          <span className="text-sm font-semibold text-gold-deep underline decoration-2 underline-offset-4 transition-colors group-hover:text-navy group-hover:decoration-navy group-focus-within:text-navy">
            {label}
          </span>
        </label>
        {chosen === undefined ? null : (
          <span className={chosen ? 'text-sm text-ink' : 'text-sm text-ink/45'}>{chosen || 'Chưa chọn'}</span>
        )}
      </div>
      {hint ? <p className="mt-1 text-xs text-ink/55">{hint}</p> : null}
    </div>
  )
}
