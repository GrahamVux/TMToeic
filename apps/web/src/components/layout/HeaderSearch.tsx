import { useExams } from '@/features/exams/exams.queries'
import { cn } from '@/lib/cn'
import { Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

type Hit = { label: string; group: string; to: string }

const INDEX: Hit[] = [
  { label: 'Tổng quan', group: 'Trang', to: '/dashboard' },
  { label: 'Học tập — Từ vựng & Ngữ pháp', group: 'Trang', to: '/study' },
  { label: 'Sổ tay từ vựng', group: 'Trang', to: '/study/notebook' },
  { label: 'Flashcard từ vựng', group: 'Trang', to: '/study/flashcards' },
  { label: 'Luyện tập ETS L&R', group: 'Trang', to: '/practice' },
  { label: 'Luyện nghe (Listening)', group: 'Trang', to: '/practice/listening' },
  { label: 'Luyện đọc (Reading)', group: 'Trang', to: '/practice/reading' },
  { label: 'Bài tập được giao', group: 'Trang', to: '/assignments' },
  { label: 'Tiến độ & phân tích năng lực', group: 'Trang', to: '/progress' },
]

function normalize(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase()
}

/**
 * Ô tìm kiếm co giãn: mặc định chỉ là một nút tròn nhỏ,
 * khi bấm sẽ kéo giãn thành ô nhập và hiện gợi ý kết quả.
 */
export function HeaderSearch() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  // Real published exams, fetched only once the search box is opened.
  const exams = useExams(open)
  const index = useMemo<Hit[]>(() => [...INDEX, ...(exams.data ?? []).map((e) => ({ label: e.title, group: 'Đề thi', to: '/practice' }))], [exams.data])

  const results = useMemo(() => {
    const n = normalize(q.trim())
    if (!n) return index.slice(0, 6)
    return index.filter((h) => normalize(h.label).includes(n)).slice(0, 7)
  }, [q, index])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  function close() {
    setOpen(false)
    setQ('')
  }

  function go(hit: Hit) {
    navigate(hit.to)
    close()
  }

  return (
    <div ref={wrapRef} className="relative">
      {open ? <div className="size-10 sm:hidden" aria-hidden="true" /> : null}
      <div
        className={cn(
          'flex h-10 items-center overflow-hidden rounded-full border bg-cream transition-[width,border-color,box-shadow] duration-300 ease-out',
          open
            ? 'fixed inset-x-4 top-3 z-50 w-auto border-gold-deep ring-2 ring-button/20 sm:static sm:w-56 xl:w-72'
            : 'w-10 border-gold/40 hover:border-gold-deep',
        )}
      >
        <button
          type="button"
          aria-label="Tìm kiếm"
          onClick={() => (open ? inputRef.current?.focus() : setOpen(true))}
          className="flex size-10 shrink-0 items-center justify-center text-ink-soft hover:text-gold-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-button/50"
        >
          <Search className="size-4" />
        </button>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results[0]) go(results[0])
          }}
          tabIndex={open ? 0 : -1}
          placeholder="Tìm trang, đề thi…"
          className={cn(
            'h-full min-w-0 flex-1 bg-transparent pr-1 text-[15px] text-ink outline-none placeholder:text-ink/60',
            !open && 'pointer-events-none opacity-0',
          )}
        />
        {open && (
          <button
            type="button"
            aria-label="Đóng tìm kiếm"
            onClick={close}
            className="mr-1 flex size-9 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-teal-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-button/50"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div className="fixed inset-x-4 top-[4.25rem] z-50 overflow-hidden rounded-2xl border border-gold/30 bg-cream shadow-[0_12px_32px_rgba(15,23,42,0.16)] sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:z-40 sm:mt-2 sm:w-88">
          <p className="px-4 pt-3 pb-1 text-[13px] font-semibold tracking-[0.06em] text-gold-deep uppercase">
            {q.trim() ? 'Kết quả' : 'Gợi ý'}
          </p>
          <ul className="max-h-72 overflow-y-auto p-1.5">
            {exams.isPending ? <li className="px-3 py-2 text-xs text-ink-soft">Đang tải danh sách đề thi…</li> : null}
            {exams.isError ? <li className="px-3 py-2 text-xs text-danger">Không tải được danh sách đề thi.</li> : null}
            {!exams.isPending && results.length === 0 && (
              <li className="px-3 py-4 text-center text-sm text-ink-soft">Không tìm thấy “{q}”</li>
            )}
            {results.map((h) => (
              <li key={h.group + h.label}>
                <button
                  type="button"
                  onClick={() => go(h)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-[15px] text-ink hover:bg-teal-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-button/50"
                >
                  <span className="truncate">{h.label}</span>
                  <span className="shrink-0 rounded-full bg-paper-2 px-2 py-0.5 text-[12px] text-ink-soft">{h.group}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
