import { Badge, Card } from '@/components/ui/Primitives'
import { SelectableText } from '@/features/study/SelectableText'
import { cn } from '@/lib/cn'
import { FILL_QUESTION_TYPE, type GroupDto, type ReviewQuestionDto } from '@toeic/shared'
import { ChevronLeft, ChevronRight, Grid3X3, LayoutList, SquareSplitHorizontal } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { isListeningPart, partName } from './exams.queries'
import { listeningScreen } from './listening-screen'
import { PassageView } from './PassageView'
import { examTextStyle, ZoomableImage } from './ZoomableImage'

export type ReviewScreen = { start: number; end: number }

/** Groups consecutive review questions that share a non-null stimulus groupId (Part 3, 4, 6, 7), keeping standalone items 1 per screen. */
export function reviewScreens(questions: ReadonlyArray<{ partCode: string; groupId: string | null }>): ReviewScreen[] {
  const screens: ReviewScreen[] = []
  for (let i = 0; i < questions.length;) {
    const q = questions[i]!
    if (q.groupId !== null) {
      let end = i
      while (end + 1 < questions.length && questions[end + 1]?.groupId === q.groupId) {
        end += 1
      }
      screens.push({ start: i, end })
      i = end + 1
    } else {
      const span = listeningScreen(questions as Array<{ partCode: string; groupId: string | null }>, i)
      screens.push(span)
      i = span.end + 1
    }
  }
  return screens
}

function screenStatusTone(items: ReviewQuestionDto[]): 'correct' | 'wrong' | 'blank' {
  if (items.some((q) => q.isCorrect === false)) return 'wrong'
  if (items.every((q) => q.isCorrect === true)) return 'correct'
  return 'blank'
}

export function ReviewQuestionCards({
  questions,
  groups,
  staffView,
  textZoom,
}: {
  questions: ReviewQuestionDto[]
  groups: Map<string, GroupDto>
  staffView: boolean
  textZoom: number
}) {
  const [viewMode, setViewMode] = useState<'step' | 'all'>('step')
  const [screenIdx, setScreenIdx] = useState(0)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const railRef = useRef<HTMLDivElement>(null)

  const screens = useMemo(() => reviewScreens(questions), [questions])
  const scopeKey = useMemo(() => questions.map((q) => q.id).join(','), [questions])

  useEffect(() => {
    setScreenIdx(0)
  }, [scopeKey])

  const safeIdx = Math.min(screenIdx, Math.max(0, screens.length - 1))

  useEffect(() => {
    if (viewMode !== 'step' || screens.length <= 1) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
      const target = e.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable]')) return
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        setScreenIdx((i) => Math.min(screens.length - 1, i + 1))
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setScreenIdx((i) => Math.max(0, i - 1))
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [viewMode, screens.length])

  useEffect(() => {
    const activeChip = railRef.current?.querySelector<HTMLElement>(`[data-screen-chip="${safeIdx}"]`)
    activeChip?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [safeIdx])

  function jumpTo(nextIdx: number, scrollTopIfNeeded = false) {
    const clamped = Math.max(0, Math.min(screens.length - 1, nextIdx))
    setScreenIdx(clamped)
    if (scrollTopIfNeeded && containerRef.current) {
      const top = containerRef.current.getBoundingClientRect().top
      if (top < 16) {
        containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
  }

  const currentSpan = screens[safeIdx]
  const visibleQuestions =
    viewMode === 'step' && currentSpan ? questions.slice(currentSpan.start, currentSpan.end + 1) : questions

  const screenFirst = visibleQuestions[0]
  const screenLast = visibleQuestions[visibleQuestions.length - 1]
  const screenLabel =
    screenFirst && screenLast && screenFirst.number !== screenLast.number
      ? `Câu ${screenFirst.number}–${screenLast.number}`
      : screenFirst
        ? `Câu ${screenFirst.number}`
        : ''

  const shownGroups = new Set<string>()
  return (
    <div ref={containerRef} className="space-y-4 scroll-mt-20">
      {screens.length > 1 ? (
        <Card className="space-y-3 p-3.5 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex rounded-full bg-paper-2 p-1">
              <button
                type="button"
                onClick={() => setViewMode('step')}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-button/50',
                  viewMode === 'step' ? 'bg-button text-button-ink shadow-xs' : 'text-ink-soft hover:text-ink',
                )}
              >
                <SquareSplitHorizontal className="size-3.5" /> Từng câu ({safeIdx + 1}/{screens.length})
              </button>
              <button
                type="button"
                onClick={() => setViewMode('all')}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-button/50',
                  viewMode === 'all' ? 'bg-button text-button-ink shadow-xs' : 'text-ink-soft hover:text-ink',
                )}
              >
                <LayoutList className="size-3.5" /> Xem tất cả ({questions.length})
              </button>
            </div>

            {viewMode === 'step' ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPaletteOpen((v) => !v)}
                  className={cn(
                    'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-button/50',
                    paletteOpen ? 'border-button bg-button-soft text-button' : 'border-gold/35 bg-cream text-ink-soft hover:border-gold-deep hover:text-ink',
                  )}
                >
                  <Grid3X3 className="size-3.5" /> Bảng câu
                </button>
                <button
                  type="button"
                  disabled={safeIdx === 0}
                  onClick={() => jumpTo(safeIdx - 1)}
                  className="inline-flex min-h-10 items-center gap-1 rounded-full border border-gold/35 bg-cream px-3.5 py-1.5 text-xs font-semibold text-ink transition hover:border-gold-deep disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-button/50"
                >
                  <ChevronLeft className="size-4" /> Câu trước
                </button>
                <button
                  type="button"
                  disabled={safeIdx >= screens.length - 1}
                  onClick={() => jumpTo(safeIdx + 1)}
                  className="inline-flex min-h-10 items-center gap-1 rounded-full bg-button px-4 py-1.5 text-xs font-semibold text-button-ink shadow-xs transition hover:bg-button-hover disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-button/50"
                >
                  Câu tiếp theo <ChevronRight className="size-4" />
                </button>
              </div>
            ) : null}
          </div>

          {viewMode === 'step' ? (
            <div className="min-w-0">
              <div ref={railRef} className={cn('ux-scroll flex gap-1.5 pb-1.5', paletteOpen ? 'flex-wrap overflow-visible' : 'overflow-x-auto')}>
                {screens.map((span, idx) => {
                  const items = questions.slice(span.start, span.end + 1)
                  const first = items[0]
                  const last = items[items.length - 1]
                  const chipLabel = first && last && first.number !== last.number ? `${first.number}-${last.number}` : `${first?.number ?? idx + 1}`
                  const tone = screenStatusTone(items)
                  const active = idx === safeIdx
                  return (
                    <button
                      key={`${first?.id ?? idx}`}
                      type="button"
                      data-screen-chip={idx}
                      onClick={() => jumpTo(idx)}
                      aria-current={active ? 'step' : undefined}
                      title={
                        tone === 'correct'
                          ? `Câu ${chipLabel}: Đúng`
                          : tone === 'wrong'
                            ? `Câu ${chipLabel}: Có câu sai`
                            : `Câu ${chipLabel}: Chưa làm`
                      }
                      className={cn(
                        'min-w-9 shrink-0 rounded-xl border px-2.5 py-1.5 text-xs font-semibold tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-button/50',
                        tone === 'correct'
                          ? 'border-success/40 bg-success-soft text-success'
                          : tone === 'wrong'
                            ? 'border-danger/40 bg-danger-soft text-danger'
                            : 'border-gold/30 bg-paper text-ink-soft',
                        active && 'ring-2 ring-button ring-offset-1 font-bold',
                      )}
                    >
                      {chipLabel}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
        </Card>
      ) : null}

      <div className="grid gap-4">
        {visibleQuestions.map((q) => {
          const group = q.groupId ? groups.get(q.groupId) : undefined
          const showPassage = group && !shownGroups.has(group.id) && (group.passages.length > 0 || !!group.instructions || !!group.imageUrl)
          if (group) shownGroups.add(group.id)
          const listening = isListeningPart(q.partCode)
          const hasFigure = Boolean((showPassage && group?.imageUrl) || q.imageUrl)
          return (
            <Card key={q.id} className="min-w-0 p-5">
              <div className={listening && hasFigure ? 'grid items-start gap-4 lg:grid-cols-2' : undefined}>
                {hasFigure ? (
                  <div className={cn('min-w-0', listening && 'lg:sticky lg:top-4 lg:max-h-[calc(100vh-6rem)] lg:overflow-auto')}>
                    {showPassage && group?.imageUrl ? (
                      <div className="mb-4">
                        <ZoomableImage src={group.imageUrl} alt={listening ? 'Hình của phần nghe' : 'Hình hoặc bảng biểu của đoạn'} fit={listening ? 'listening' : 'frame'} />
                      </div>
                    ) : null}
                    {q.imageUrl ? (
                      <div className="mb-4">
                        <ZoomableImage src={q.imageUrl} alt={`Hình minh họa câu ${q.number}`} fit={listening ? 'listening' : 'frame'} />
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className="exam-scale" style={examTextStyle(textZoom)}>
                  {showPassage && group ? (
                    <div className="mb-4">
                      <PassageView group={group} showImage={false} />
                    </div>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-ink-soft">
                      {partName(q.partCode)} • Câu {q.number}
                    </span>
                    {q.isCorrect === true ? <Badge tone="olive">Đúng</Badge> : q.isCorrect === false ? <Badge tone="danger">Sai</Badge> : <Badge tone="paper">Chưa làm</Badge>}
                  </div>
                  {q.type === FILL_QUESTION_TYPE ? (
                    <div className="exam-copy mt-3 space-y-2 select-text cursor-text">
                      <p className="font-medium">{q.prompt}</p>
                      <p>
                        Đã điền: <strong>{q.answerText || '—'}</strong>
                      </p>
                      <p>
                        Đáp án: <strong>{q.correctText}</strong>
                      </p>
                    </div>
                  ) : (
                    <>
                      {q.prompt ? (
                        <SelectableText
                          className="mt-2 max-w-[68ch] text-lg leading-8 font-medium"
                          text={q.prompt}
                          markTarget={listening ? undefined : { kind: 'prompt', id: q.id }}
                        />
                      ) : null}
                      <ul className="mt-3 grid gap-2">
                        {q.options.map((o) => {
                          const isCorrect = o.key === q.correctKey
                          const isPicked = o.key === q.selectedKey
                          return (
                            <li
                              key={o.key}
                              className={cn(
                                'rounded-xl border px-4 py-2.5 text-sm',
                                isCorrect ? 'border-success/40 bg-success-soft text-ink' : isPicked ? 'border-danger/40 bg-danger-soft text-ink' : 'border-ink/12',
                              )}
                            >
                              <span className="mr-2 font-bold">{o.key}.</span>
                              {listening || !o.text ? o.text : <SelectableText as="span" text={o.text} markTarget={{ kind: 'option', id: q.id, optionKey: o.key }} />}
                              {isCorrect ? <span className="ml-2 text-xs font-semibold text-success">Đáp án đúng</span> : null}
                              {isPicked && !isCorrect ? (
                                <span className="ml-2 text-xs font-semibold text-danger">{staffView ? 'Học viên chọn' : 'Bạn chọn'}</span>
                              ) : null}
                            </li>
                          )
                        })}
                      </ul>
                    </>
                  )}
                  {q.explanation ? (
                    <div className="mt-4 max-w-[68ch] rounded-xl border border-warn/25 bg-warn-soft p-3.5 text-sm text-ink">
                      <p className="text-xs font-semibold tracking-wide text-warn uppercase">Giải thích</p>
                      <p className="mt-1 select-text cursor-text leading-[1.7] whitespace-pre-line text-ink">{q.explanation}</p>
                    </div>
                  ) : null}
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {viewMode === 'step' && screens.length > 1 ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-gold/25 bg-cream p-3">
          <button
            type="button"
            disabled={safeIdx === 0}
            onClick={() => jumpTo(safeIdx - 1, true)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-gold/35 bg-cream px-4 py-2 text-sm font-semibold text-ink transition hover:border-gold-deep disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-button/50"
          >
            <ChevronLeft className="size-4" /> Câu trước
          </button>
          <span className="text-center text-xs font-semibold text-ink-soft">
            {screenLabel} <span className="hidden sm:inline">• Màn hình {safeIdx + 1}/{screens.length}</span>
          </span>
          <button
            type="button"
            disabled={safeIdx >= screens.length - 1}
            onClick={() => jumpTo(safeIdx + 1, true)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-button px-5 py-2 text-sm font-semibold text-button-ink shadow-sm transition hover:bg-button-hover disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-button/50"
          >
            Câu tiếp theo <ChevronRight className="size-4" />
          </button>
        </div>
      ) : null}
    </div>
  )
}
