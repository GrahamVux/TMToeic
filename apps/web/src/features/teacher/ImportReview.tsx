import { Button } from '@/components/ui/Button'
import { FilePick } from '@/components/ui/FilePick'
import { Card, Input } from '@/components/ui/Primitives'
import { partName } from '@/features/exams/exams.queries'
import { cn } from '@/lib/cn'
import { PART_SEED, type ImportAuthoredExamInput } from '@toeic/shared'
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'

type Draft = ImportAuthoredExamInput

const DEEP_SCROLL_PX = 480

function problemsOf(draft: Draft): string[] {
  const problems: string[] = []
  if (draft.title.trim().length < 3) problems.push('Tiêu đề cần ít nhất 3 ký tự.')
  if (!/^[A-Za-z0-9._-]{3,40}$/.test(draft.code.trim())) problems.push('Mã đề chỉ dùng chữ, số, dấu chấm, gạch dưới hoặc gạch ngang.')
  draft.questions.forEach((question) => {
    const correct = question.options.filter((option) => option.correct).length
    if (correct !== 1) problems.push(`Câu ${question.number}: chọn đúng một đáp án.`)
    if (question.options.some((option) => !option.text.trim())) problems.push(`Câu ${question.number}: mỗi lựa chọn cần có chữ.`)
  })
  return problems
}

function shortPart(code: string) {
  return partName(code).split(' — ')[0]
}

function partAnchorId(code: string) {
  return `import-part-${code}`
}

function partCodesOf(draft: Draft) {
  const order = new Map(PART_SEED.map((part, index) => [part.code, index]))
  const codes = new Set<string>()
  for (const group of draft.groups) codes.add(group.partCode)
  for (const question of draft.questions) codes.add(question.partCode)
  return [...codes].sort((a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99))
}

function ReviewDock({
  parts,
  active,
  busy,
  canSave,
  showTop,
  pos,
  dockRef,
  onJump,
  onSave,
  onTop,
}: {
  parts: string[]
  active: string | null
  busy: boolean
  canSave: boolean
  showTop: boolean
  pos: { top: number; left: number; width: number }
  dockRef: RefObject<HTMLElement | null>
  onJump: (code: string) => void
  onSave: () => void
  onTop: () => void
}) {
  return (
    <nav
      ref={dockRef}
      className="fixed z-20 flex max-h-[calc(100vh-6.5rem)] flex-col gap-1 overflow-y-auto rounded-2xl border border-gold/40 bg-white/95 p-2 shadow-[0_12px_32px_rgba(30,51,60,0.14)] backdrop-blur-md"
      style={{ top: pos?.top ?? 72, left: pos?.left ?? 16, width: pos?.width ?? 148 }}
      aria-label="Đến từng part"
    >
      <p className="px-1 pb-1 text-[10px] font-semibold tracking-[0.14em] text-gold-deep uppercase">Đến part</p>
      {parts.map((code) => (
        <button
          key={code}
          type="button"
          className={cn(
            'rounded-xl px-2 py-1.5 text-left text-xs font-semibold sm:text-sm',
            active === code ? 'bg-gold-deep text-white' : 'text-ink/75 hover:bg-teal-soft',
          )}
          onClick={() => onJump(code)}
        >
          {shortPart(code)}
        </button>
      ))}
      <Button type="button" className="mt-1 w-full px-2 py-1.5 text-xs sm:text-sm" disabled={!canSave || busy} onClick={onSave}>
        {busy ? 'Đang lưu…' : 'Lưu nhanh'}
      </Button>
      {showTop ? (
        <button type="button" className="rounded-xl px-2 py-1.5 text-left text-xs font-semibold text-ink/70 hover:bg-paper sm:text-sm" onClick={onTop}>
          Lên đầu
        </button>
      ) : null}
    </nav>
  )
}

export function ImportReview({
  draft,
  busy,
  error,
  audioName,
  onAudio,
  onCancel,
  onSave,
}: {
  draft: Draft
  busy: boolean
  error: string | null
  audioName?: string | null
  onAudio?: (file: File | null) => void
  onCancel: () => void
  onSave: (next: Draft) => void
}) {
  const [form, setForm] = useState<Draft>(draft)
  const [activePart, setActivePart] = useState<string | null>(null)
  const [showTop, setShowTop] = useState(false)
  const [dockPos, setDockPos] = useState({ top: 72, left: 16, width: 148 })
  const reviewRef = useRef<HTMLDivElement>(null)
  const columnRef = useRef<HTMLDivElement>(null)
  const dockRef = useRef<HTMLElement>(null)
  const problems = problemsOf(form)
  const missingExplanation = form.questions.filter((question) => !question.explanation?.trim()).length
  const parts = partCodesOf(form)
  const partKey = parts.join('|')

  useEffect(() => {
    const codes = partKey.split('|').filter(Boolean)
    function onScroll() {
      setShowTop(window.scrollY > DEEP_SCROLL_PX)
      let current = codes[0] ?? null
      for (const code of codes) {
        const node = document.getElementById(partAnchorId(code))
        if (node && node.getBoundingClientRect().top <= 120) current = code
      }
      setActivePart(current)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [partKey])

  useLayoutEffect(() => {
    const pinTop = 72
    function place() {
      const column = columnRef.current
      const review = reviewRef.current
      if (!column || !review) return
      const columnBox = column.getBoundingClientRect()
      const reviewBox = review.getBoundingClientRect()
      const dockHeight = dockRef.current?.offsetHeight ?? 160
      let top = Math.max(pinTop, columnBox.top)
      if (reviewBox.bottom < top + dockHeight) top = Math.max(8, reviewBox.bottom - dockHeight)
      const next = { top: Math.round(top), left: Math.round(columnBox.left), width: Math.round(columnBox.width) }
      setDockPos((current) => (current.top === next.top && current.left === next.left && current.width === next.width ? current : next))
    }
    place()
    window.addEventListener('scroll', place, { passive: true })
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place)
      window.removeEventListener('resize', place)
    }
  }, [partKey, showTop])

  function patchQuestion(index: number, next: Draft['questions'][number]) {
    setForm((current) => ({ ...current, questions: current.questions.map((question, i) => (i === index ? next : question)) }))
  }

  function jump(code: string) {
    document.getElementById(partAnchorId(code))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActivePart(code)
  }

  return (
    <div ref={reviewRef} className="grid grid-cols-[7.25rem_minmax(0,1fr)] items-start gap-3 sm:grid-cols-[10.5rem_minmax(0,1fr)] sm:gap-4">
      <div ref={columnRef} />
      <div className="min-w-0 space-y-4">
        <ReviewDock
          parts={parts}
          active={activePart}
          busy={busy}
          canSave={problems.length === 0}
          showTop={showTop}
          pos={dockPos}
          dockRef={dockRef}
          onJump={jump}
          onSave={() => onSave(form)}
          onTop={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.18em] text-gold-deep uppercase">Chưa lưu vào ngân hàng</p>
          <h2 className="serif mt-1 text-3xl">Kiểm tra đề trước khi thêm</h2>
          <p className="mt-1 text-sm text-ink/60">Sửa câu hỏi, đáp án và lời giải. Học viên chỉ thấy lời giải sau khi nộp bài.</p>
        </div>
        <Button type="button" variant="paper" onClick={onCancel}>
          Chọn file khác
        </Button>
      </div>

      <Card className="p-5">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-sm font-medium">
            Mã đề
            <Input className="mt-1" value={form.code} onChange={(e) => setForm((current) => ({ ...current, code: e.target.value }))} />
          </label>
          <label className="block text-sm font-medium">
            Tên đề
            <Input className="mt-1" value={form.title} onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))} />
          </label>
          <label className="block text-sm font-medium md:col-span-2">
            Mô tả
            <Input className="mt-1" value={form.description ?? ''} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} />
          </label>
          <label className="block text-sm font-medium">
            Thời gian (phút)
            <Input
              className="mt-1"
              type="number"
              min={1}
              max={240}
              value={Math.round(form.durationSeconds / 60)}
              onChange={(e) => setForm((current) => ({ ...current, durationSeconds: Math.max(60, (Number(e.target.value) || 1) * 60) }))}
            />
          </label>
          <p className="self-end text-sm text-ink/55">
            {form.questions.length} câu
            {form.parts.map((part) => ` • ${shortPart(part.partCode)}`).join('')}
          </p>
        </div>
      </Card>

      {onAudio ? (
        <Card className="p-5">
          <h3 className="font-semibold">File nghe</h3>
          <div className="mt-3">
            <FilePick
              label="Chọn file nghe"
              accept="audio/mpeg,audio/mp4,audio/wav,audio/x-m4a,.mp3,.m4a,.wav"
              chosen={audioName ?? null}
              hint="Gắn cho cả phần nghe khi lưu đề."
              onFiles={(files) => onAudio(files[0] ?? null)}
            />
          </div>
        </Card>
      ) : null}

      {parts.map((code) => {
        const groups = form.groups.map((group, groupIndex) => ({ group, groupIndex })).filter(({ group }) => group.partCode === code)
        const questions = form.questions.map((question, index) => ({ question, index })).filter(({ question }) => question.partCode === code)
        return (
          <section key={code} id={partAnchorId(code)} className="scroll-mt-24 space-y-4">
            <h3 className="text-sm font-semibold tracking-[0.12em] text-gold-deep uppercase">{partName(code)}</h3>
            {groups.map(({ group, groupIndex }) => (
              <Card key={group.key} className="p-5">
                <p className="text-sm font-semibold">Nhóm {group.key} • {shortPart(group.partCode)}</p>
                <label className="mt-3 block text-sm">
                  Hướng dẫn
                  <textarea
                    value={group.instructions ?? ''}
                    rows={2}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        groups: current.groups.map((item, i) => (i === groupIndex ? { ...item, instructions: e.target.value } : item)),
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm"
                  />
                </label>
                {group.passages.map((passage, passageIndex) => (
                  <label key={passage.label} className="mt-3 block text-sm">
                    Đoạn {passage.label}{passage.title ? ` • ${passage.title}` : ''}
                    <textarea
                      value={passage.content}
                      rows={4}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          groups: current.groups.map((item, i) =>
                            i === groupIndex
                              ? { ...item, passages: item.passages.map((row, j) => (j === passageIndex ? { ...row, content: e.target.value } : row)) }
                              : item,
                          ),
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm"
                    />
                  </label>
                ))}
              </Card>
            ))}
            {questions.map(({ question, index }) => (
              <Card key={`${question.partCode}-${question.number}`} className="p-5">
                <p className="text-sm text-ink/50">
                  {shortPart(question.partCode)} • Câu {question.number}
                  {question.groupKey ? ` • nhóm ${question.groupKey}` : ''}
                </p>
                <label className="mt-3 block text-sm font-medium">
                  Đề bài
                  <textarea
                    value={question.prompt}
                    rows={2}
                    onChange={(e) => patchQuestion(index, { ...question, prompt: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <div className="mt-3 grid gap-2">
                  {question.options.map((option) => (
                    <label key={option.key} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name={`correct-${index}`}
                        checked={option.correct}
                        onChange={() => patchQuestion(index, { ...question, options: question.options.map((item) => ({ ...item, correct: item.key === option.key })) })}
                      />
                      <span className="w-5 font-bold">{option.key}</span>
                      <Input value={option.text} onChange={(e) => patchQuestion(index, { ...question, options: question.options.map((item) => (item.key === option.key ? { ...item, text: e.target.value } : item)) })} />
                    </label>
                  ))}
                </div>
                <label className="mt-3 block text-sm font-medium">
                  Lời giải thích
                  <textarea
                    value={question.explanation ?? ''}
                    rows={3}
                    placeholder="Vì sao đáp án này đúng."
                    onChange={(e) => patchQuestion(index, { ...question, explanation: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm"
                  />
                </label>
              </Card>
            ))}
          </section>
        )
      })}

      {missingExplanation > 0 ? <p className="text-sm text-ink/55">{missingExplanation} câu chưa có lời giải thích. Vẫn có thể lưu.</p> : null}
      {problems.length > 0 ? (
        <ul className="rounded-xl bg-[#f8dcd8] p-3 text-sm text-coral" role="alert">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      ) : null}
      {error ? <p className="rounded-xl bg-[#f8dcd8] p-3 text-sm text-coral" role="alert">{error}</p> : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Hủy</Button>
        <Button type="button" disabled={busy || problems.length > 0} onClick={() => onSave(form)}>
          {busy ? 'Đang lưu…' : 'Thêm đề vào ngân hàng'}
        </Button>
      </div>
      </div>
    </div>
  )
}
