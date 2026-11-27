import { cn } from '@/lib/cn'
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react'

const EXT_COLORS: Record<string, string> = {
  pdf: '#E5484D',
  png: '#8E4EC6',
  jpg: '#0090FF',
  jpeg: '#0090FF',
  webp: '#0090FF',
  gif: '#0090FF',
  svg: '#8E4EC6',
  ico: '#8E4EC6',
  xlsx: '#119C72',
  xls: '#119C72',
  csv: '#119C72',
  doc: '#2B63D9',
  docx: '#2B63D9',
  json: '#D6731E',
  mp3: '#6A57F2',
  m4a: '#6A57F2',
  wav: '#6A57F2',
  zip: '#C27A12',
}

function formatBytes(bytes: number): string {
  if (bytes < 1_048_576) return `${Math.max(1, Math.round(bytes / 1024))}KB`
  return `${(bytes / 1_048_576).toFixed(1)}MB`
}

function extensionOf(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name)
  return (m?.[1] ?? 'file').toLowerCase()
}

/**
 * Animated drag-and-drop file uploader adapted from Lucian UX/UI Prompt #432.
 * Preserves full dropzone, extension tag animation, ring progress, and checkmark feedback.
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
  const inputRef = useRef<HTMLInputElement>(null)
  const depthRef = useRef(0)
  const [drag, setDrag] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'up' | 'done' | 'out'>('idle')
  const [progress, setProgress] = useState(0)
  const [meta, setMeta] = useState<{ name: string; ext: string; sizeText: string } | null>(null)
  const timerRef = useRef<number[]>([])
  const rafRef = useRef<number>(0)

  function clearTimers() {
    timerRef.current.forEach((id) => window.clearTimeout(id))
    timerRef.current = []
    if (rafRef.current) window.cancelAnimationFrame(rafRef.current)
  }

  useEffect(() => () => clearTimers(), [])

  function startAnimation(files: File[]) {
    if (files.length === 0) return
    clearTimers()
    const first = files[0]!
    const ext = extensionOf(first.name)
    const displayName = files.length > 1 ? `${first.name} (+${files.length - 1} file)` : first.name
    setMeta({ name: displayName, ext, sizeText: formatBytes(first.size) })
    setPhase('up')
    setProgress(0)

    const rm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const t0 = performance.now() + (rm ? 0 : 300)
    const dur = rm ? 180 : 950

    const step = (now: number) => {
      const k = Math.max(0, Math.min(1, (now - t0) / dur))
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
      setProgress(Math.round(e * 100))
      if (k < 1) {
        rafRef.current = window.requestAnimationFrame(step)
        return
      }
      setPhase('done')
      timerRef.current.push(
        window.setTimeout(() => {
          setPhase('out')
          timerRef.current.push(window.setTimeout(() => setPhase('idle'), 320))
        }, rm ? 700 : 1200),
      )
    }
    rafRef.current = window.requestAnimationFrame(step)
  }

  function handleFiles(files: File[]) {
    if (disabled || files.length === 0) return
    startAnimation(files)
    onFiles(files)
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])]
    if (files.length) handleFiles(files)
    e.target.value = ''
  }

  function onDragEnter(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    depthRef.current += 1
    if (!disabled) setDrag(true)
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  }

  function onDragLeave() {
    depthRef.current = Math.max(0, depthRef.current - 1)
    if (depthRef.current === 0) setDrag(false)
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    depthRef.current = 0
    setDrag(false)
    if (!disabled && e.dataTransfer?.files?.length) {
      handleFiles([...e.dataTransfer.files])
    }
  }

  const isUp = phase !== 'idle'
  const isDone = phase === 'done' || phase === 'out'
  const isOut = phase === 'out'
  const dashOffset = (289 * (1 - progress / 100)).toFixed(1)
  const extColor = EXT_COLORS[meta?.ext ?? 'file'] ?? 'var(--color-button)'

  return (
    <div
      className={cn(
        'ux u432-wrap',
        drag && 'is-drag',
        isUp && 'is-up',
        isDone && 'is-done',
        isOut && 'is-out',
        disabled && 'opacity-70',
      )}
    >
      <div
        className="u432-dz"
        tabIndex={disabled ? -1 : 0}
        role="button"
        aria-label={label}
        aria-disabled={disabled}
        onClick={(e) => {
          if (!disabled && e.target !== inputRef.current) inputRef.current?.click()
        }}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <div className="u432-idle px-4 py-3">
          <span className="u432-ar" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M12 16V5M7 9.5 12 4.5l5 5" />
              <path d="M5 15v2.5A2.5 2.5 0 0 0 7.5 20h9a2.5 2.5 0 0 0 2.5-2.5V15" />
            </svg>
          </span>
          <b>{label}</b>
          <b aria-hidden="true">Thả file để tải lên</b>
          <small>
            Kéo thả hoặc{' '}
            <span className="u432-br" aria-hidden="true">
              chọn file từ máy
            </span>
          </small>
          {chosen ? (
            <span className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full bg-teal-soft px-3 py-1 text-xs font-semibold text-gold-deep">
              <span className="truncate">Đã chọn: {chosen}</span>
            </span>
          ) : null}
          {hint ? <p className="mt-1.5 max-w-md text-[13px] leading-snug text-ink-soft">{hint}</p> : null}
        </div>

        <div className="u432-up px-4 py-3" aria-hidden="true">
          <div className="u432-st">
            <svg className="u432-ring" viewBox="0 0 100 100">
              <circle className="tk" cx="50" cy="50" r="46" />
              <circle className="pg" cx="50" cy="50" r="46" style={{ strokeDashoffset: dashOffset }} />
            </svg>
            <svg className="u432-doc" viewBox="0 0 50 62">
              <path className="pp" d="M6 1h26l15 15v39a6 6 0 0 1-6 6H6a6 6 0 0 1-6-6V7a6 6 0 0 1 6-6z" />
              <path className="fd" d="M32 1v10a5 5 0 0 0 5 5h10z" />
              <rect className="ln" x="9" y="22" width="24" height="3" rx="1.5" />
              <rect className="ln" x="9" y="29" width="30" height="3" rx="1.5" />
              <rect className="tg" x="-4" y="40" width="28" height="14" rx="3.5" style={{ ['--c' as string]: extColor }} />
              <text x="10" y="50" textAnchor="middle">
                {(meta?.ext ?? 'FILE').slice(0, 4).toUpperCase()}
              </text>
            </svg>
            <span className="u432-ok">
              <svg viewBox="0 0 24 24">
                <path d="m5 12.5 4.5 4.5L19 7.5" />
              </svg>
            </span>
          </div>
          <p className="u432-nm">
            {meta?.name} <small>{isDone ? `· ${meta?.sizeText ?? ''}` : `· ${progress}%`}</small>
          </p>
        </div>

        <input
          ref={inputRef}
          className="u432-file"
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          tabIndex={-1}
          aria-hidden="true"
          onChange={onInputChange}
        />
      </div>
    </div>
  )
}
