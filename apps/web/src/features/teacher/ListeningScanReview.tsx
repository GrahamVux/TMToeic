import { Button } from '@/components/ui/Button'
import { Card, Input } from '@/components/ui/Primitives'
import { partName } from '@/features/exams/exams.queries'
import { cn } from '@/lib/cn'
import { PART_SEED, type ListeningScanInput } from '@toeic/shared'
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'

type Draft = ListeningScanInput

const DEEP_SCROLL_PX = 480

function shortPart(code: string) {
  return partName(code).split(' — ')[0]
}

function partAnchorId(code: string) {
  return `scan-part-${code}`
}

function partCodesOf(draft: Draft) {
  const order = new Map(PART_SEED.map((part, index) => [part.code, index]))
  const codes = new Set<string>()
  for (const group of draft.groups) codes.add(group.partCode)
  for (const question of draft.questions) codes.add(question.partCode)
  return [...codes].sort((a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99))
}

function problemsOf(draft: Draft): string[] {
  const problems: string[] = []
  if (draft.title.trim().length < 3) problems.push('Tiêu đề cần ít nhất 3 ký tự.')
  if (!/^[A-Za-z0-9._-]{3,40}$/.test(draft.code.trim())) problems.push('Mã đề chỉ dùng chữ, số, dấu chấm, gạch dưới hoặc gạch ngang.')
  const files = new Set<string>()
  draft.crops.forEach((crop) => {
    if (files.has(crop.file)) problems.push(`Khung ${crop.file} bị khai báo hai lần.`)
    files.add(crop.file)
    const [ymin, xmin, ymax, xmax] = crop.box
    if (ymin >= ymax || xmin >= xmax) problems.push(`Khung ${crop.file}: cạnh trên phải nhỏ hơn cạnh dưới, cạnh trái nhỏ hơn cạnh phải.`)
  })
  return problems
}

function ReviewDock({
  parts,
  active,
  busy,
  canSave,
  stale,
  showTop,
  pos,
  dockRef,
  onJump,
  onRecut,
  onSave,
  onTop,
}: {
  parts: string[]
  active: string | null
  busy: boolean
  canSave: boolean
  stale: boolean
  showTop: boolean
  pos: { top: number; left: number; width: number }
  dockRef: RefObject<HTMLElement | null>
  onJump: (code: string) => void
  onRecut: () => void
  onSave: () => void
  onTop: () => void
}) {
  return (
    <nav
      ref={dockRef}
      className="fixed z-20 flex max-h-[calc(100vh-6.5rem)] flex-col gap-1 overflow-y-auto rounded-2xl border border-gold/40 bg-cream/95 p-2 shadow-[0_12px_32px_rgba(30,51,60,0.14)] backdrop-blur-md"
      style={{ top: pos?.top ?? 72, left: pos?.left ?? 16, width: pos?.width ?? 148 }}
      aria-label="Đến từng part"
    >
      <p className="px-1 pb-1 text-[12px] font-semibold tracking-[0.14em] text-gold-deep uppercase">Đến part</p>
      {parts.map((code) => (
        <button
          key={code}
          type="button"
          className={cn(
            'rounded-xl px-2 py-1.5 text-left text-xs font-semibold sm:text-sm',
            active === code ? 'bg-button text-button-ink' : 'text-ink/75 hover:bg-teal-soft',
          )}
          onClick={() => onJump(code)}
        >
          {shortPart(code)}
        </button>
      ))}
      {stale ? (
        <Button type="button" variant="paper" className="mt-1 w-full px-2 py-1.5 text-xs sm:text-sm" disabled={busy} onClick={onRecut}>
          {busy ? 'Đang cắt…' : 'Cắt lại ảnh'}
        </Button>
      ) : null}
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

function numberValue(value: string, fallback: number) {
  const next = Number(value)
  return Number.isFinite(next) ? next : fallback
}

type Box = [number, number, number, number]
type DragMode = 'move' | 'draw' | 'n' | 's' | 'e' | 'w'

function clampScale(value: number) {
  return Math.max(0, Math.min(1000, Math.round(value)))
}

function orderBox(box: Box): Box {
  let [ymin, xmin, ymax, xmax] = box.map(clampScale) as Box
  if (ymax < ymin) [ymin, ymax] = [ymax, ymin]
  if (xmax < xmin) [xmin, xmax] = [xmax, xmin]
  if (ymax - ymin < 20) ymax = Math.min(1000, ymin + 20)
  if (xmax - xmin < 20) xmax = Math.min(1000, xmin + 20)
  return [ymin, xmin, ymax, xmax]
}

function PageCropper({ pageImage, box, onBox }: { pageImage: string; box: Box; onBox: (next: Box) => void }) {
  const frame = useRef<HTMLDivElement>(null)
  const drag = useRef<{ mode: DragMode; x: number; y: number; box: Box } | null>(null)
  const [ymin, xmin, ymax, xmax] = box

  function at(event: ReactPointerEvent) {
    const rect = frame.current?.getBoundingClientRect()
    if (!rect || rect.width < 1 || rect.height < 1) return { x: 0, y: 0 }
    return {
      x: clampScale(((event.clientX - rect.left) / rect.width) * 1000),
      y: clampScale(((event.clientY - rect.top) / rect.height) * 1000),
    }
  }

  function begin(event: ReactPointerEvent, mode: DragMode) {
    event.preventDefault()
    event.stopPropagation()
    frame.current?.setPointerCapture(event.pointerId)
    const point = at(event)
    const origin = mode === 'draw' ? orderBox([point.y, point.x, point.y + 20, point.x + 20]) : box
    if (mode === 'draw') onBox(origin)
    drag.current = { mode, x: point.x, y: point.y, box: origin }
  }

  function move(event: ReactPointerEvent) {
    const current = drag.current
    if (!current) return
    const point = at(event)
    if (current.mode === 'move') {
      const dx = point.x - current.x
      const dy = point.y - current.y
      const [top, left, bottom, right] = current.box
      const height = bottom - top
      const width = right - left
      let nextTop = top + dy
      let nextLeft = left + dx
      if (nextTop < 0) nextTop = 0
      if (nextLeft < 0) nextLeft = 0
      if (nextTop + height > 1000) nextTop = 1000 - height
      if (nextLeft + width > 1000) nextLeft = 1000 - width
      onBox([Math.round(nextTop), Math.round(nextLeft), Math.round(nextTop + height), Math.round(nextLeft + width)])
      return
    }
    const [top, left, bottom, right] = current.box
    const next: Box = [top, left, bottom, right]
    if (current.mode === 'draw' || current.mode === 's') next[2] = point.y
    if (current.mode === 'draw' || current.mode === 'e') next[3] = point.x
    if (current.mode === 'n') next[0] = point.y
    if (current.mode === 'w') next[1] = point.x
    onBox(orderBox(next))
  }

  return (
    <div
      ref={frame}
      className="relative touch-none overflow-hidden rounded-xl border border-ink/10 bg-cream"
      onPointerDown={(event) => begin(event, 'draw')}
      onPointerMove={move}
      onPointerUp={() => {
        drag.current = null
      }}
    >
      <img src={`data:image/jpeg;base64,${pageImage}`} alt="Trang PDF" draggable={false} className="block h-auto w-full select-none" />
      <div
        className="absolute border-2 border-button bg-button/25"
        style={{ top: `${ymin / 10}%`, left: `${xmin / 10}%`, width: `${(xmax - xmin) / 10}%`, height: `${(ymax - ymin) / 10}%` }}
        onPointerDown={(event) => begin(event, 'move')}
      >
        {(['n', 's', 'e', 'w'] as const).map((edge) => (
          <span
            key={edge}
            className={cn(
              'absolute bg-button',
              edge === 'n' && 'inset-x-0 top-0 h-2 cursor-ns-resize',
              edge === 's' && 'inset-x-0 bottom-0 h-2 cursor-ns-resize',
              edge === 'w' && 'inset-y-0 left-0 w-2 cursor-ew-resize',
              edge === 'e' && 'inset-y-0 right-0 w-2 cursor-ew-resize',
            )}
            onPointerDown={(event) => begin(event, edge)}
          />
        ))}
      </div>
    </div>
  )
}

function CropEditor({
  crop,
  image,
  pageImage,
  onChange,
}: {
  crop: Draft['crops'][number]
  image: string | undefined
  pageImage: string | undefined
  onChange: (next: Draft['crops'][number]) => void
}) {
  const [ymin, xmin, ymax, xmax] = crop.box
  function setBox(index: 0 | 1 | 2 | 3, value: string) {
    const box = [...crop.box] as Box
    box[index] = numberValue(value, box[index])
    onChange({ ...crop, manual: true, box })
  }
  return (
    <div className="mt-3 space-y-3">
      {pageImage ? (
        <>
          <p className="text-xs text-ink-soft">Trang {crop.page} do Gemini chọn. Kéo giữa khung để dời, kéo cạnh để đổi cỡ, hoặc kéo trên chỗ trống để vẽ khung mới.</p>
          <PageCropper pageImage={pageImage} box={crop.box} onBox={(box) => onChange({ ...crop, manual: true, box })} />
        </>
      ) : null}
      {image ? <img src={`data:image/jpeg;base64,${image}`} alt={crop.file} className="h-auto w-full rounded-xl border border-ink/10 bg-[#ffffff]" /> : <p className="text-sm text-coral">Chưa có ảnh cho {crop.file}.</p>}
      <div className="grid gap-2 sm:grid-cols-6">
        <label className="text-xs font-medium">
          Trang PDF
          <Input className="mt-1" type="number" min={1} max={80} value={crop.page} onChange={(e) => onChange({ ...crop, manual: true, page: Math.max(1, numberValue(e.target.value, crop.page)) })} />
        </label>
        <label className="text-xs font-medium">
          Loại
          <select
            className="mt-1 h-10 w-full rounded-xl border border-ink/12 bg-cream px-2 text-sm"
            value={crop.kind ?? 'photo'}
            onChange={(e) => onChange({ ...crop, kind: e.target.value === 'graphic' ? 'graphic' : 'photo' })}
          >
            <option value="photo">Ảnh</option>
            <option value="graphic">Biểu đồ</option>
          </select>
        </label>
        {(
          [
            ['Trên', ymin, 0],
            ['Trái', xmin, 1],
            ['Dưới', ymax, 2],
            ['Phải', xmax, 3],
          ] as const
        ).map(([label, value, index]) => (
          <label key={label} className="text-xs font-medium">
            {label}
            <Input className="mt-1" type="number" min={0} max={1000} value={value} onChange={(e) => setBox(index, e.target.value)} />
          </label>
        ))}
      </div>
    </div>
  )
}

export function ListeningScanReview({
  draft,
  images,
  pages,
  busy,
  onCancel,
  onRecut,
  onSave,
}: {
  draft: Draft
  images: Record<string, string>
  pages: string[]
  busy: boolean
  onCancel: () => void
  onRecut: (next: Draft) => Promise<Record<string, string> | null>
  onSave: (next: Draft) => void
}) {
  const [form, setForm] = useState<Draft>(draft)
  const [shown, setShown] = useState(images)
  const [freshCrops, setFreshCrops] = useState(JSON.stringify(draft.crops))
  const [activePart, setActivePart] = useState<string | null>(null)
  const [showTop, setShowTop] = useState(false)
  const [dockPos, setDockPos] = useState({ top: 72, left: 16, width: 148 })
  const reviewRef = useRef<HTMLDivElement>(null)
  const columnRef = useRef<HTMLDivElement>(null)
  const dockRef = useRef<HTMLElement>(null)
  const stale = JSON.stringify(form.crops) !== freshCrops
  const problems = problemsOf(form)
  const missingAnswer = form.questions.filter((question) => !question.answer).length
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
  }, [partKey, showTop, stale])

  function jump(code: string) {
    document.getElementById(partAnchorId(code))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActivePart(code)
  }

  function patchCrop(file: string, next: Draft['crops'][number]) {
    setForm((current) => ({ ...current, crops: current.crops.map((crop) => (crop.file === file ? next : crop)) }))
  }

  function patchQuestion(index: number, next: Draft['questions'][number]) {
    setForm((current) => ({ ...current, questions: current.questions.map((question, i) => (i === index ? next : question)) }))
  }

  async function recut() {
    const next = await onRecut(form)
    if (!next) return
    setShown(next)
    setFreshCrops(JSON.stringify(form.crops))
  }

  return (
    <div ref={reviewRef} className="grid grid-cols-[7.25rem_minmax(0,1fr)] items-start gap-3 sm:grid-cols-[10.5rem_minmax(0,1fr)] sm:gap-4">
      <div ref={columnRef} />
      <div className="min-w-0 space-y-4">
        <ReviewDock
          parts={parts}
          active={activePart}
          busy={busy}
          canSave={problems.length === 0 && !stale}
          stale={stale}
          showTop={showTop}
          pos={dockPos}
          dockRef={dockRef}
          onJump={jump}
          onRecut={() => void recut()}
          onSave={() => onSave(form)}
          onTop={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.18em] text-gold-deep uppercase">Chưa lưu vào ngân hàng</p>
          <h2 className="serif mt-1 text-3xl">Kiểm tra đề Listening trước khi lưu</h2>
          <p className="mt-1 text-sm text-ink/60">Trang là trang Gemini đã chọn. Kéo khung trên trang đó để tự cắt. Ảnh bên dưới khung là ảnh sẽ gắn vào đề khi lưu.</p>
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
          <p className="self-end text-sm text-ink-soft">{form.questions.length} câu</p>
        </div>
      </Card>

      {form.warnings && form.warnings.length > 0 ? (
        <ul className="rounded-xl bg-gold/10 p-3 text-sm text-ink/70">
          {form.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}

      {parts.map((code) => {
        const groups = form.groups.map((group, groupIndex) => ({ group, groupIndex })).filter(({ group }) => group.partCode === code)
        const questions = form.questions.map((question, index) => ({ question, index })).filter(({ question }) => question.partCode === code)
        return (
          <section key={code} id={partAnchorId(code)} className="scroll-mt-24 space-y-4">
            <h3 className="text-sm font-semibold tracking-[0.12em] text-gold-deep uppercase">{partName(code)}</h3>
            {groups.map(({ group, groupIndex }) => {
              const crop = group.imageFile ? form.crops.find((item) => item.file === group.imageFile) : undefined
              return (
                <Card key={group.key} className="p-5">
                  <p className="text-sm font-semibold">Nhóm {group.key}</p>
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
                      className="mt-1 w-full rounded-xl border border-ink/10 bg-cream px-3 py-2 text-sm"
                    />
                  </label>
                  {crop ? <CropEditor crop={crop} image={shown[crop.file]} pageImage={pages[crop.page - 1]} onChange={(next) => patchCrop(crop.file, next)} /> : null}
                </Card>
              )
            })}
            {questions.map(({ question, index }) => {
              const crop = question.imageFile ? form.crops.find((item) => item.file === question.imageFile) : undefined
              return (
                <Card key={`${question.partCode}-${question.number}`} className="p-5">
                  <p className="text-sm text-ink-soft">
                    {shortPart(question.partCode)} • Câu {question.number}
                    {question.groupKey ? ` • nhóm ${question.groupKey}` : ''}
                  </p>
                  <label className="mt-3 block text-sm font-medium">
                    Đề bài
                    <textarea value={question.prompt} rows={2} onChange={(e) => patchQuestion(index, { ...question, prompt: e.target.value })} className="mt-1 w-full rounded-xl border border-ink/10 bg-cream px-3 py-2 text-sm" />
                  </label>
                  {crop ? <CropEditor crop={crop} image={shown[crop.file]} pageImage={pages[crop.page - 1]} onChange={(next) => patchCrop(crop.file, next)} /> : null}
                  <div className="mt-3 grid gap-2">
                    {question.options.map((option) => (
                      <label key={option.key} className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name={`scan-answer-${index}`}
                          checked={question.answer === option.key}
                          onChange={() => patchQuestion(index, { ...question, answer: option.key })}
                        />
                        <span className="w-5 font-bold">{option.key}</span>
                        <Input value={option.text} onChange={(e) => patchQuestion(index, { ...question, options: question.options.map((item) => (item.key === option.key ? { ...item, text: e.target.value } : item)) })} />
                      </label>
                    ))}
                  </div>
                </Card>
              )
            })}
          </section>
        )
      })}

      {stale ? <p className="text-sm text-ink/70">Khung cắt đã đổi. Bấm Cắt lại ảnh để xem ảnh mới trước khi lưu.</p> : null}
      {missingAnswer > 0 ? <p className="text-sm text-ink-soft">{missingAnswer} câu chưa có đáp án. Đề sẽ được lưu ở dạng bản nháp.</p> : null}
      {problems.length > 0 ? (
        <ul className="rounded-xl border border-danger/25 bg-danger-soft p-3 text-sm text-danger" role="alert">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Hủy</Button>
        {stale ? (
          <Button type="button" variant="paper" disabled={busy} onClick={() => void recut()}>
            {busy ? 'Đang cắt…' : 'Cắt lại ảnh'}
          </Button>
        ) : null}
        <Button type="button" disabled={busy || stale || problems.length > 0} onClick={() => onSave(form)}>
          {busy ? 'Đang lưu…' : 'Lưu đề vào ngân hàng'}
        </Button>
      </div>
      </div>
    </div>
  )
}
