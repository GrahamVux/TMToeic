import { Button } from '@/components/ui/Button'
import { CornerNotice, flashError, flashNotice, type CornerNoticeState } from '@/components/ui/CornerNotice'
import { FilePick } from '@/components/ui/FilePick'
import { Card } from '@/components/ui/Primitives'
import { PageLoading } from '@/components/ui/LoadingScreen'
import { QueryErrorRedirect } from '@/features/errors/ErrorPages'
import { VocabNav } from '@/features/study/VocabCourse'
import { notebookSavedMessage, useDeleteNotebook, useImportNotebook, useNotebook, useSaveNotebookWord, useUpdateNotebook } from '@/features/study/study.queries'
import { ApiError, downloadApiFile } from '@/lib/api'
import { cn } from '@/lib/cn'
import type { NotebookCardColor, NotebookEntryDto } from '@toeic/shared'
import { Gamepad2, Palette, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

const CARD_PALETTE: ReadonlyArray<{
  id: NotebookCardColor
  label: string
  dot: string
  cardClass: string
}> = [
  { id: 'default', label: 'Mặc định', dot: '#94a3b8', cardClass: 'ui-card border-gold/35 bg-cream' },
  { id: 'rose', label: 'Hay quên', dot: '#e11d48', cardClass: 'border-rose-300 bg-rose-50/85 dark:border-rose-500/40 dark:bg-rose-950/55' },
  { id: 'amber', label: 'Cần chú ý', dot: '#d97706', cardClass: 'border-amber-300 bg-amber-50/85 dark:border-amber-500/40 dark:bg-amber-950/55' },
  { id: 'emerald', label: 'Đã thuộc', dot: '#10b981', cardClass: 'border-emerald-300 bg-emerald-50/85 dark:border-emerald-500/40 dark:bg-emerald-950/55' },
  { id: 'sky', label: 'Từ bẫy ETS', dot: '#0284c7', cardClass: 'border-sky-300 bg-sky-50/85 dark:border-sky-500/40 dark:bg-sky-950/55' },
  { id: 'violet', label: 'Cụm từ / Collocation', dot: '#7c3aed', cardClass: 'border-violet-300 bg-violet-50/85 dark:border-violet-500/40 dark:bg-violet-950/55' },
]

function paletteOf(color: NotebookCardColor) {
  return CARD_PALETTE.find((c) => c.id === color) ?? CARD_PALETTE[0]!
}

export function NotebookPage() {
  const notebook = useNotebook()
  const [filter, setFilter] = useState<'all' | 'due' | 'missing'>('all')
  const [topicFilter, setTopicFilter] = useState('')
  const [unitFilter, setUnitFilter] = useState('')
  const [colorFilter, setColorFilter] = useState<NotebookCardColor | 'all'>('all')
  const [notice, setNotice] = useState<CornerNoticeState | null>(null)

  if (notebook.isPending) return <PageLoading message="Đang tải sổ tay…" />
  if (notebook.error || !notebook.data) return <QueryErrorRedirect error={notebook.error} />
  const data = notebook.data

  const topics = [...new Set(data.items.map((i) => i.topic.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'))
  const units = [...new Set(data.items.map((i) => i.unit).filter((u): u is number => u != null))].sort((a, b) => a - b)

  const visible = data.items.filter((item) => {
    if (filter === 'due' && !item.due) return false
    if (filter === 'missing' && !(!item.meaning || !item.partOfSpeech)) return false
    if (topicFilter === '__none__' && item.topic.trim() !== '') return false
    if (topicFilter && topicFilter !== '__none__' && item.topic.trim() !== topicFilter) return false
    if (unitFilter === '__none__' && item.unit !== null) return false
    if (unitFilter && unitFilter !== '__none__' && String(item.unit) !== unitFilter) return false
    if (colorFilter !== 'all' && item.color !== colorFilter) return false
    return true
  })

  const flashParams = new URLSearchParams({ deck: 'notebook' })
  if (topicFilter && topicFilter !== '__none__') flashParams.set('topic', topicFilter)
  if (unitFilter && unitFilter !== '__none__') flashParams.set('unit', unitFilter)
  if (colorFilter !== 'all') flashParams.set('color', colorFilter)

  const gameParams = new URLSearchParams({ source: 'notebook' })
  if (topicFilter && topicFilter !== '__none__') gameParams.set('topic', topicFilter)
  if (unitFilter && unitFilter !== '__none__') gameParams.set('unit', unitFilter)
  if (colorFilter !== 'all') gameParams.set('color', colorFilter)

  return (
    <div className="space-y-6">
      <CornerNotice notice={notice} />
      <VocabNav current="mine" />

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] font-semibold tracking-[0.06em] text-gold-deep uppercase">Học tập / Sổ tay cá nhân</p>
          <h1 className="serif mt-2 text-3xl sm:text-4xl">Sổ tay từ vựng theo Chủ đề & Màu sắc</h1>
          <p className="mt-2 text-sm text-ink-soft">
            Phân nhóm theo Chủ đề, Unit và tô màu từng ô từ vựng để nhớ lâu hơn khi ôn tập & chơi Mini-game.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/study/games?${gameParams}`}>
            <Button variant="paper">
              <Gamepad2 className="size-4 text-gold-deep" /> Chơi game ({visible.length})
            </Button>
          </Link>
          <Link to={`/study/flashcards?${flashParams}`}>
            <Button>Luyện flashcard ({data.dueCount})</Button>
          </Link>
        </div>
      </header>

      <div className="flex flex-wrap gap-6 text-sm">
        <Metric label="Đã lưu" value={data.total} />
        <Metric label="Cần ôn" value={data.dueCount} />
        <Metric label="Chưa có nghĩa" value={data.missingMeaning} />
        <Metric label="Đang lọc" value={visible.length} />
      </div>

      {/* Filters: Status + Topic + Unit + Color */}
      <Card className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ['all', `Tất cả (${data.total})`],
              ['due', `Cần ôn (${data.dueCount})`],
              ['missing', `Chưa có nghĩa (${data.missingMeaning})`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={cn('rounded-full px-3.5 py-1.5 text-xs font-semibold transition', filter === id ? 'bg-button text-button-ink' : 'bg-paper-2 text-ink-soft')}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_180px_auto] lg:items-end">
          <label className="block text-xs font-semibold text-ink-soft">
            Lọc theo Chủ đề
            <select
              className="mt-1 h-9 w-full rounded-xl border border-gold/35 bg-cream px-3 text-sm font-medium"
              value={topicFilter}
              onChange={(e) => setTopicFilter(e.target.value)}
            >
              <option value="">Tất cả chủ đề ({topics.length})</option>
              {topics.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
              <option value="__none__">Chưa gắn chủ đề</option>
            </select>
          </label>

          <label className="block text-xs font-semibold text-ink-soft">
            Lọc theo Unit
            <select
              className="mt-1 h-9 w-full rounded-xl border border-gold/35 bg-cream px-3 text-sm font-medium"
              value={unitFilter}
              onChange={(e) => setUnitFilter(e.target.value)}
            >
              <option value="">Tất cả Unit</option>
              {units.map((u) => (
                <option key={u} value={String(u)}>
                  Unit {u}
                </option>
              ))}
              <option value="__none__">Chưa gắn Unit</option>
            </select>
          </label>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 inline-flex items-center gap-1 text-xs font-semibold text-ink-soft">
              <Palette className="size-3.5" /> Màu ô:
            </span>
            <button
              type="button"
              onClick={() => setColorFilter('all')}
              className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', colorFilter === 'all' ? 'bg-button text-button-ink' : 'bg-paper-2 text-ink-soft')}
            >
              Tất cả
            </button>
            {CARD_PALETTE.map((c) => (
              <button
                key={c.id}
                type="button"
                title={c.label}
                aria-label={`Lọc màu ${c.label}`}
                onClick={() => setColorFilter(c.id)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[13px] font-semibold transition',
                  colorFilter === c.id ? 'border-button bg-cream ring-2 ring-button/40' : 'border-gold/30 bg-paper',
                )}
              >
                <span className="size-2.5 rounded-full" style={{ background: c.dot }} />
                <span className="hidden xl:inline">{c.label}</span>
              </button>
            ))}
          </div>
        </div>
      </Card>

      <AddTakeNote existingTopics={topics} onNotice={setNotice} />

      {filter === 'all' && !topicFilter && !unitFilter && colorFilter === 'all' ? (
        <>
          <section className="space-y-4">
            <h2 className="serif text-2xl">Từ take note & Tự thêm</h2>
            <NoteGrid items={visible.filter((item) => item.source !== 'CATALOG')} empty="Chưa có từ take note. Bạn có thể thêm ở form phía trên." onNotice={setNotice} />
          </section>
          <section className="space-y-4">
            <h2 className="serif text-2xl">Từ lưu từ Kho bài giảng</h2>
            <NoteGrid items={visible.filter((item) => item.source === 'CATALOG')} empty="Chưa lưu từ nào từ kho từ chung. Mở bất kỳ Unit hoặc Flashcard để bấm Lưu vào sổ tay." onNotice={setNotice} />
          </section>
        </>
      ) : (
        <NoteGrid items={visible} empty="Không có từ nào khớp bộ lọc hiện tại." onNotice={setNotice} />
      )}
    </div>
  )
}

function AddTakeNote({ existingTopics, onNotice }: { existingTopics: string[]; onNotice: (n: CornerNoticeState) => void }) {
  const save = useSaveNotebookWord()
  const [word, setWord] = useState('')
  const [partOfSpeech, setPartOfSpeech] = useState('')
  const [meaning, setMeaning] = useState('')
  const [example, setExample] = useState('')
  const [topic, setTopic] = useState('')
  const [unitStr, setUnitStr] = useState('')
  const [color, setColor] = useState<NotebookCardColor>('default')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  return (
    <Card className="p-5">
      <h2 className="serif text-2xl">Tự thêm từ vào sổ tay</h2>
      <form
        className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault()
          setError(null)
          setDone(null)
          const unitNum = unitStr.trim() ? Math.max(1, Math.trunc(Number(unitStr))) : null
          void save
            .mutateAsync({
              word,
              partOfSpeech,
              meaning,
              example,
              topic: topic.trim(),
              unit: Number.isInteger(unitNum) ? unitNum : null,
              color,
              manual: true,
            })
            .then((result) => {
              const msg = notebookSavedMessage(result)
              setDone(msg)
              onNotice(flashNotice(msg))
              setWord('')
              setPartOfSpeech('')
              setMeaning('')
              setExample('')
            })
            .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Không thêm được.'))
        }}
      >
        <input className="h-10 rounded-xl border border-ink/12 px-3 text-sm sm:col-span-2" value={word} placeholder="Từ hoặc cụm từ tiếng Anh" onChange={(e) => setWord(e.target.value)} />
        <input className="h-10 rounded-xl border border-ink/12 px-3 text-sm" value={partOfSpeech} placeholder="Loại từ (VD: noun)" onChange={(e) => setPartOfSpeech(e.target.value)} />
        <input className="h-10 rounded-xl border border-ink/12 px-3 text-sm" value={meaning} placeholder="Nghĩa tiếng Việt" onChange={(e) => setMeaning(e.target.value)} />
        <input className="h-10 rounded-xl border border-ink/12 px-3 text-sm sm:col-span-2" value={example} placeholder="Câu mẫu minh họa (tuỳ chọn)" onChange={(e) => setExample(e.target.value)} />
        <div>
          <input list="notebook-topic-list" className="h-10 w-full rounded-xl border border-ink/12 px-3 text-sm" value={topic} placeholder="Chủ đề (VD: Công sở)" onChange={(e) => setTopic(e.target.value)} />
          <datalist id="notebook-topic-list">
            {existingTopics.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>
        <input type="number" min={1} max={500} className="h-10 rounded-xl border border-ink/12 px-3 text-sm" value={unitStr} placeholder="Số Unit (VD: 1)" onChange={(e) => setUnitStr(e.target.value)} />

        <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-4">
          <span className="text-xs font-semibold text-ink-soft">Chọn màu ô:</span>
          {CARD_PALETTE.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setColor(c.id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition',
                color === c.id ? 'border-button bg-button-soft ring-2 ring-button/35' : 'border-gold/30 bg-paper',
              )}
            >
              <span className="size-2.5 rounded-full" style={{ background: c.dot }} />
              {c.label}
            </button>
          ))}
        </div>

        {error ? <p className="text-sm text-coral sm:col-span-2 lg:col-span-4">{error}</p> : null}
        {done ? <p className="text-sm text-olive sm:col-span-2 lg:col-span-4">{done}</p> : null}
        <div className="sm:col-span-2 lg:col-span-4">
          <Button type="submit" disabled={save.isPending}>
            <Plus className="size-4" /> Thêm vào từ điển của tôi
          </Button>
        </div>
      </form>
      <ExcelList />
    </Card>
  )
}

function ExcelList() {
  const importList = useImportNotebook()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  return (
    <div className="mt-5 border-t border-gold/30 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">Thêm cả danh sách từ Excel</h3>
          <p className="mt-0.5 text-sm text-ink-soft">Hỗ trợ cột Chủ đề, Unit, Từ vựng, Loại từ, Nghĩa, Câu mẫu.</p>
        </div>
        <button
          type="button"
          className="text-sm font-semibold text-gold-deep underline underline-offset-4"
          onClick={() => {
            setError(null)
            void downloadApiFile('/study/notebook/template', 'mau-so-tay.xlsx').catch((err: unknown) => {
              setError(err instanceof ApiError ? err.message : 'Không tải được file mẫu.')
            })
          }}
        >
          Tải file mẫu
        </button>
      </div>
      <div className="mt-3">
        <FilePick
          label={importList.isPending ? 'Đang nhập…' : 'Chọn hoặc kéo thả file .xlsx'}
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          disabled={importList.isPending}
          hint="Tối đa 8MB, 2000 từ. Tự động nhận Chủ đề & Unit nếu có."
          onFiles={(files) => {
            const file = files[0]
            if (!file) return
            setError(null)
            setDone(null)
            void importList.mutateAsync(file).then(
              (result) => setDone(`Đã thêm ${result.added} từ, cập nhật ${result.updated} từ${result.skipped ? `, bỏ qua ${result.skipped} dòng` : ''}.`),
              (err: unknown) => setError(err instanceof ApiError ? err.message : 'Không nhập được file.'),
            )
          }}
        />
      </div>
      {error ? <p className="mt-3 text-sm text-coral" role="alert">{error}</p> : null}
      {done ? <p className="mt-3 text-sm text-olive">{done}</p> : null}
    </div>
  )
}

function NoteGrid({ items, empty, onNotice }: { items: NotebookEntryDto[]; empty: string; onNotice: (n: CornerNoticeState) => void }) {
  if (items.length === 0) return <p className="text-sm text-ink-soft">{empty}</p>
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {items.map((item) => (
        <NoteCard key={item.id} item={item} onNotice={onNotice} />
      ))}
    </div>
  )
}

function NoteCard({ item, onNotice }: { item: NotebookEntryDto; onNotice: (n: CornerNoticeState) => void }) {
  const update = useUpdateNotebook()
  const remove = useDeleteNotebook()
  const [partOfSpeech, setPartOfSpeech] = useState(item.partOfSpeech ?? '')
  const [meaning, setMeaning] = useState(item.meaning ?? '')
  const [example, setExample] = useState(item.example ?? '')
  const [topic, setTopic] = useState(item.topic ?? '')
  const [unitStr, setUnitStr] = useState(item.unit != null ? String(item.unit) : '')
  const [error, setError] = useState<string | null>(null)
  const incomplete = !item.meaning || !item.partOfSpeech
  const [editing, setEditing] = useState(incomplete)
  const palette = paletteOf(item.color)

  function changeColor(nextColor: NotebookCardColor) {
    if (nextColor === item.color) return
    void update.mutateAsync({ id: item.id, color: nextColor }).catch((err) => {
      onNotice(flashError(err instanceof ApiError ? err.message : 'Không đổi được màu ô.'))
    })
  }

  return (
    <section className={cn('rounded-2xl border-2 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)] transition-colors', palette.cardClass)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {item.topic ? <span className="rounded-full bg-cream/80 px-2.5 py-0.5 text-[13px] font-semibold text-gold-deep dark:bg-slate-900/60">{item.topic}</span> : null}
            {item.unit != null ? <span className="rounded-full bg-cream/80 px-2.5 py-0.5 text-[13px] font-semibold text-ink dark:bg-slate-900/60">Unit {item.unit}</span> : null}
            <span className="rounded-full bg-cream/70 px-2 py-0.5 text-[13px] font-semibold text-ink-soft dark:bg-slate-900/55">
              {item.source === 'CATALOG' ? 'Từ kho' : item.source === 'MANUAL' ? 'Tự thêm' : 'Bài đọc'}
            </span>
          </div>
          <h2 className="serif mt-1.5 text-3xl text-ink">{item.word}</h2>
          {item.partOfSpeech ? <p className="text-sm font-semibold text-gold-deep">{item.partOfSpeech}</p> : <p className="text-sm text-ink-soft">Chưa có loại từ</p>}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <button
            type="button"
            aria-label="Xóa từ khỏi sổ tay"
            className="rounded-lg p-1.5 text-danger hover:bg-danger-soft"
            disabled={remove.isPending}
            onClick={() => void remove.mutateAsync(item.id)}
          >
            <Trash2 className="size-4" />
          </button>
          <div className="flex items-center gap-1 rounded-full border border-ink/10 bg-cream/85 px-2 py-1 dark:bg-slate-900/65" title="Đổi màu ô từ vựng">
            {CARD_PALETTE.map((c) => (
              <button
                key={c.id}
                type="button"
                title={c.label}
                aria-label={`Đổi màu ${c.label}`}
                onClick={() => changeColor(c.id)}
                className={cn('size-3.5 rounded-full transition-transform hover:scale-125', item.color === c.id && 'ring-2 ring-ink ring-offset-1')}
                style={{ background: c.dot }}
              />
            ))}
          </div>
        </div>
      </div>

      {!editing && item.meaning ? (
        <div className="mt-3">
          <p className="text-sm font-medium leading-6 text-ink">{item.meaning}</p>
          {item.example ? <p className="mt-1.5 rounded-xl bg-cream/75 px-3 py-2 text-xs italic text-ink dark:bg-slate-900/55">“{item.example}”</p> : null}
          <button type="button" className="mt-2.5 text-xs font-semibold text-gold-deep underline underline-offset-4" onClick={() => setEditing(true)}>
            Chỉnh sửa nghĩa, câu mẫu, Unit
          </button>
        </div>
      ) : (
        <form
          className="mt-4 space-y-2"
          onSubmit={(event) => {
            event.preventDefault()
            setError(null)
            const unitNum = unitStr.trim() ? Math.max(1, Math.trunc(Number(unitStr))) : null
            void update
              .mutateAsync({
                id: item.id,
                partOfSpeech,
                meaning,
                example,
                topic: topic.trim(),
                unit: Number.isInteger(unitNum) ? unitNum : null,
              })
              .then(() => {
                setEditing(false)
                onNotice(flashNotice(`Đã cập nhật “${item.word}”.`))
              })
              .catch((err) => {
                setError(err instanceof ApiError ? err.message : 'Không lưu được.')
              })
          }}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <input className="h-9 w-full rounded-xl border border-ink/12 bg-cream px-3 text-sm" value={partOfSpeech} placeholder="Loại từ (VD: noun)" onChange={(e) => setPartOfSpeech(e.target.value)} required />
            <input className="h-9 w-full rounded-xl border border-ink/12 bg-cream px-3 text-sm" value={topic} placeholder="Chủ đề (VD: Công sở)" onChange={(e) => setTopic(e.target.value)} />
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_96px]">
            <input className="h-9 w-full rounded-xl border border-ink/12 bg-cream px-3 text-sm" value={meaning} placeholder="Nghĩa tiếng Việt" onChange={(e) => setMeaning(e.target.value)} required />
            <input type="number" min={1} max={500} className="h-9 w-full rounded-xl border border-ink/12 bg-cream px-2.5 text-sm" value={unitStr} placeholder="Unit" onChange={(e) => setUnitStr(e.target.value)} />
          </div>
          <input className="h-9 w-full rounded-xl border border-ink/12 bg-cream px-3 text-sm" value={example} placeholder="Câu mẫu minh họa" onChange={(e) => setExample(e.target.value)} />
          {error ? <p className="text-sm text-coral">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={update.isPending} className="h-9 px-3 text-xs">
              Lưu thay đổi
            </Button>
            {!incomplete ? (
              <Button type="button" variant="ghost" className="h-9 px-3 text-xs" onClick={() => setEditing(false)}>
                Hủy
              </Button>
            ) : null}
          </div>
        </form>
      )}
    </section>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs text-ink-soft">{label}</p>
      <p className="serif text-2xl">{value}</p>
    </div>
  )
}
