import { ApiError } from '@/lib/api'
import { cn } from '@/lib/cn'
import { notebookPhrase, singleEnglishWord, type ReadingMarkColor, type ReadingMarkDto } from '@toeic/shared'
import { BookPlus, Copy, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react'
import { createPortal } from 'react-dom'
import { useReadingMarksContext, type MarkTarget } from './ReadingMarks'
import { notebookSavedMessage, useSaveNotebookWord } from './study.queries'
import { textSegments } from './text-segments'

const COLOR_CLASS: Record<ReadingMarkColor, string> = {
  yellow: 'bg-[#fff3a3] text-slate-900',
  blue: 'bg-[#c4ebfb] text-slate-900',
  green: 'bg-[#d6f5d0] text-slate-900',
}

const COLORS: ReadingMarkColor[] = ['yellow', 'blue', 'green']
const COLOR_LABEL: Record<ReadingMarkColor, string> = { yellow: 'Tô vàng', blue: 'Tô xanh biển', green: 'Tô xanh lá' }

type Picked = {
  quote: string
  start: number
  end: number
  top: number
  left: number
  existing: ReadingMarkDto | null
}

/** Lets a student save a word, and on a reading text also highlight, note, or copy a phrase. */
export function SelectableText({
  text,
  className,
  as = 'p',
  markTarget,
}: {
  text: string
  className?: string
  as?: 'p' | 'h2' | 'span'
  markTarget?: MarkTarget
}) {
  const ref = useRef<HTMLElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const marksApi = useReadingMarksContext()
  const reading = Boolean(markTarget && marksApi)
  const save = useSaveNotebookWord()
  const [picked, setPicked] = useState<Picked | null>(null)
  const [noting, setNoting] = useState(false)
  const [note, setNote] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  const mine =
    reading && markTarget
      ? marksApi!.marks.filter(
          (mark) =>
            mark.targetKind === markTarget.kind &&
            mark.targetId === markTarget.id &&
            mark.passageLabel === (markTarget.passageLabel ?? '') &&
            mark.optionKey === (markTarget.optionKey ?? ''),
        )
      : []

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2800)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    function hide() {
      setPicked(null)
      setNoting(false)
    }
    function outside(event: Event) {
      if (barRef.current && event.target instanceof Node && barRef.current.contains(event.target)) return
      hide()
    }
    window.addEventListener('scroll', hide, true)
    document.addEventListener('mousedown', outside)
    document.addEventListener('touchstart', outside)
    return () => {
      window.removeEventListener('scroll', hide, true)
      document.removeEventListener('mousedown', outside)
      document.removeEventListener('touchstart', outside)
    }
  }, [])

  function show(next: Omit<Picked, 'existing'>, existing: ReadingMarkDto | null) {
    setNoting(false)
    setNote(existing?.note ?? '')
    setPicked({ ...next, existing })
  }

  function onSelect() {
    const selection = window.getSelection()
    const node = ref.current
    if (!selection || selection.isCollapsed || !node || !node.contains(selection.anchorNode) || !node.contains(selection.focusNode) || selection.rangeCount === 0) {
      return
    }
    const range = selection.getRangeAt(0)
    const a = offsetIn(node, range.startContainer, range.startOffset)
    const b = offsetIn(node, range.endContainer, range.endOffset)
    const start = Math.min(a, b)
    const end = Math.max(a, b)
    if (start < 0 || end <= start) return
    if (end - start > 120) {
      setPicked(null)
      setToast('Hãy chọn một từ hoặc một cụm từ ngắn hơn.')
      return
    }
    const quote = text.slice(start, end)
    if (!quote.trim()) return
    if (!reading && !singleEnglishWord(quote)) {
      setPicked(null)
      return
    }
    const rect = range.getBoundingClientRect()
    const existing = mine.find((mark) => mark.start === start && mark.end === end) ?? null
    show({ quote, start, end, top: rect.bottom + 8, left: rect.left }, existing)
  }

  function close() {
    setPicked(null)
    setNoting(false)
    window.getSelection()?.removeAllRanges()
  }

  async function saveMark(color: ReadingMarkColor | null, noteText: string) {
    if (!picked || !marksApi || !markTarget) return
    const { quote, start, end } = picked
    close()
    try {
      await marksApi.save({
        examId: marksApi.examId,
        targetKind: markTarget.kind,
        targetId: markTarget.id,
        passageLabel: markTarget.passageLabel,
        optionKey: markTarget.optionKey,
        start,
        end,
        quote,
        color,
        note: noteText,
      })
    } catch (error) {
      setToast(error instanceof ApiError ? error.message : 'Không lưu được.')
    }
  }

  async function removeMark() {
    const id = picked?.existing?.id
    close()
    if (!id || !marksApi) return
    try {
      await marksApi.remove(id)
    } catch (error) {
      setToast(error instanceof ApiError ? error.message : 'Không xóa được.')
    }
  }

  async function addToDictionary() {
    if (!picked) return
    const phrase = notebookPhrase(picked.quote)
    close()
    if (!phrase) {
      setToast('Chỉ thêm được từ hoặc cụm từ tiếng Anh.')
      return
    }
    try {
      setToast(notebookSavedMessage(await save.mutateAsync({ word: phrase })))
    } catch (error) {
      setToast(error instanceof ApiError ? error.message : 'Không thêm được vào từ điển.')
    }
  }

  async function copy() {
    if (!picked) return
    const quote = picked.quote
    close()
    try {
      await navigator.clipboard.writeText(quote)
      setToast('Đã sao chép.')
    } catch {
      setToast('Không sao chép được.')
    }
  }

  const Tag = as
  const segments = reading ? textSegments(text, mine) : [{ text, mark: null as ReadingMarkDto | null }]
  const currentColor = picked?.existing?.color ?? null
  return (
    <>
      <Tag ref={ref as Ref<HTMLParagraphElement>} className={cn('select-text', as !== 'span' && 'cursor-text', className)} onMouseUp={onSelect} onTouchEnd={onSelect}>
        {segments.map((segment, index) =>
          segment.mark ? (
            <mark
              key={`${segment.mark.id}-${index}`}
              className={cn(
                'cursor-pointer rounded-sm text-inherit',
                segment.mark.color ? COLOR_CLASS[segment.mark.color] : 'bg-transparent',
                segment.mark.note ? 'underline decoration-teal decoration-dotted underline-offset-4' : '',
              )}
              onClick={(event) => {
                if (!window.getSelection()?.isCollapsed) return
                event.preventDefault()
                event.stopPropagation()
                const rect = event.currentTarget.getBoundingClientRect()
                const mark = segment.mark!
                show({ quote: mark.quote, start: mark.start, end: mark.end, top: rect.bottom + 8, left: rect.left }, mark)
              }}
            >
              {segment.text}
            </mark>
          ) : (
            <span key={index}>{segment.text}</span>
          ),
        )}
      </Tag>

      {picked && reading
        ? createPortal(
            <div
              ref={barRef}
              className="fixed z-[80] rounded-2xl bg-slate-900/95 p-2 text-white shadow-xl"
              style={{ top: picked.top, left: Math.max(8, Math.min(picked.left, window.innerWidth - 340)) }}
              onMouseDown={(event) => event.preventDefault()}
            >
              {picked.existing?.note && !noting ? <p className="max-w-[320px] px-2 pb-2 text-sm text-white/90">{picked.existing.note}</p> : null}
              <div className="flex items-center gap-1">
                <ToolButton label="Ghi chú" onClick={() => setNoting(true)}>
                  <Pencil className="size-5" />
                </ToolButton>
                <ToolButton label="Từ điển" onClick={() => void addToDictionary()}>
                  <BookPlus className="size-5" />
                </ToolButton>
                <ToolButton label="Sao chép" onClick={() => void copy()}>
                  <Copy className="size-5" />
                </ToolButton>
                <span className="mx-1 h-8 w-px bg-white/25" aria-hidden="true" />
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    title={COLOR_LABEL[color]}
                    aria-label={COLOR_LABEL[color]}
                    className={cn('size-9 rounded-lg', COLOR_CLASS[color], currentColor === color && 'ring-2 ring-white')}
                    onClick={() => void saveMark(color, picked.existing?.note ?? '')}
                  />
                ))}
                {picked.existing ? (
                  <ToolButton label="Xóa" onClick={() => void removeMark()}>
                    <Trash2 className="size-5" />
                  </ToolButton>
                ) : null}
              </div>
              {noting ? (
                <form
                  className="mt-2 flex gap-1"
                  onSubmit={(event) => {
                    event.preventDefault()
                    const trimmed = note.trim()
                    if (!trimmed && !picked.existing?.color) {
                      setToast('Hãy nhập ghi chú hoặc chọn màu.')
                      return
                    }
                    void saveMark(picked.existing?.color ?? null, trimmed)
                  }}
                >
                  <input
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Ghi chú cho chỗ này"
                    className="h-9 min-w-0 flex-1 rounded-lg bg-cream px-3 text-sm text-ink"
                    autoFocus
                  />
                  <button type="submit" className="rounded-lg bg-button px-3 text-sm font-semibold text-button-ink">
                    Lưu
                  </button>
                </form>
              ) : null}
            </div>,
            document.body,
          )
        : null}

      {picked && !reading
        ? createPortal(
            <button
              ref={barRef as unknown as Ref<HTMLButtonElement>}
              type="button"
              className="fixed z-[80] rounded-full bg-button px-3 py-1.5 text-sm font-semibold text-button-ink shadow-lg"
              style={{ top: picked.top, left: Math.max(8, Math.min(picked.left, window.innerWidth - 220)) }}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => void addToDictionary()}
            >
              Thêm “{singleEnglishWord(picked.quote) ?? picked.quote}” vào sổ tay
            </button>,
            document.body,
          )
        : null}

      {toast
        ? createPortal(
            <p className="fixed bottom-20 left-1/2 z-[80] max-w-sm -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-center text-sm text-white shadow-lg" role="status">
              {toast}
            </p>,
            document.body,
          )
        : null}
    </>
  )
}

function ToolButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="flex min-w-14 flex-col items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold hover:bg-white/10" onClick={onClick}>
      {children}
      {label}
    </button>
  )
}

function offsetIn(root: HTMLElement, target: Node, targetOffset: number) {
  if (target === root) return targetOffset
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let count = 0
  let node = walker.nextNode()
  while (node) {
    if (node === target) return count + targetOffset
    count += node.textContent?.length ?? 0
    node = walker.nextNode()
  }
  return -1
}
