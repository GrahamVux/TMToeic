import { Button } from '@/components/ui/Button'
import { CornerNotice, flashError, flashNotice, type CornerNoticeState } from '@/components/ui/CornerNotice'
import { Modal } from '@/components/ui/Modal'
import { Card, ProgressBar } from '@/components/ui/Primitives'
import { PageLoading } from '@/components/ui/LoadingScreen'
import { QueryErrorRedirect } from '@/features/errors/ErrorPages'
import { ApiError } from '@/lib/api'
import type { VocabSetCardDto, VocabUnitDto } from '@toeic/shared'
import { Bookmark, BookmarkCheck, Gamepad2, ListChecks } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { notebookSavedMessage, useBatchSaveNotebook, useSaveNotebookWord, useVocabCourse, useVocabSearch, useVocabUnitDetail } from './study.queries'

const PAGE_SIZE = 6

export function VocabNav({ current }: { current: 'learn' | 'progress' | 'mine' | 'games' | 'grammar' }) {
  const items = [
    { id: 'learn', label: 'Học', to: '/study' },
    { id: 'progress', label: 'Tiến độ', to: '/study?view=progress' },
    { id: 'mine', label: 'Từ vựng của tôi', to: '/study/notebook' },
    { id: 'games', label: 'Trò chơi từ vựng', to: '/study/games' },
    { id: 'grammar', label: 'Ngữ pháp', to: '/study?view=grammar' },
  ] as const
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Link key={item.id} to={item.to} className={item.id === current ? 'rounded-full bg-button px-4 py-2 text-sm font-semibold text-button-ink' : 'rounded-full border border-ink/10 bg-cream px-4 py-2 text-sm font-semibold text-ink hover:border-gold-deep'}>
          {item.label}
        </Link>
      ))}
    </div>
  )
}

export function VocabCourse({ view }: { view: 'learn' | 'progress' }) {
  const course = useVocabCourse()
  const [selectedId, setSelectedId] = useState('')
  const sets = course.data?.sets ?? []
  const selected = sets.find((set) => set.id === selectedId) ?? sets[0]

  if (course.isPending) return <PageLoading message="Đang tải bộ từ vựng…" />
  if (course.error) return <QueryErrorRedirect error={course.error} />
  if (!selected) {
    return (
      <Card className="p-8">
        <h2 className="serif text-2xl">Chưa có bộ từ vựng</h2>
        <p className="mt-2 max-w-xl text-sm text-ink-soft">Khi giáo viên tải một danh sách Excel và đặt chủ đề cùng tên bộ, bộ từ sẽ hiện ở đây để bạn học theo từng unit.</p>
      </Card>
    )
  }

  return view === 'progress' ? <ProgressBoard sets={sets} /> : <LearnBoard sets={sets} selected={selected} onSelect={setSelectedId} />
}

function LearnBoard({ sets, selected, onSelect }: { sets: VocabSetCardDto[]; selected: VocabSetCardDto; onSelect: (id: string) => void }) {
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState('')
  const query = filter.trim().toLowerCase()
  const visibleSets = query ? sets.filter((set) => `${set.topic} ${set.title}`.toLowerCase().includes(query)) : sets
  const pages = Math.max(1, Math.ceil(selected.units.length / PAGE_SIZE))
  const safePage = Math.min(page, pages)
  const units = selected.units.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[17.5rem_1fr]">
      <Card className="p-4">
        <h2 className="font-semibold">Bộ từ vựng</h2>
        <p className="mt-1 text-sm text-ink-soft">Chọn bộ bạn muốn học</p>
        {sets.length > 6 ? (
          <input
            className="mt-3 h-10 w-full rounded-xl border border-ink/12 px-3 text-sm"
            value={filter}
            placeholder="Tìm bộ từ"
            onChange={(event) => setFilter(event.target.value)}
          />
        ) : null}
        <div className="mt-3 flex gap-3 overflow-x-auto pb-1 lg:max-h-[70vh] lg:flex-col lg:overflow-y-auto lg:pr-1">
          {visibleSets.map((set, index) => (
            <SetCard key={set.id} set={set} index={index} active={set.id === selected.id} onSelect={() => { onSelect(set.id); setPage(1) }} />
          ))}
          {visibleSets.length === 0 ? <p className="text-sm text-ink-soft">Không có bộ khớp.</p> : null}
        </div>
      </Card>

      <div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {units.map((unit) => (
            <UnitCard key={unit.index} set={selected} unit={unit} />
          ))}
        </div>
        {pages > 1 ? <Pager page={safePage} pages={pages} onPage={setPage} /> : null}
        <WordSearch />
      </div>
    </div>
  )
}

function SetCard({ set, index, active, onSelect }: { set: VocabSetCardDto; index: number; active: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`w-44 shrink-0 overflow-hidden rounded-2xl border bg-cream text-left lg:w-full ${active ? 'border-olive shadow-[0_8px_24px_rgba(63,154,134,0.16)]' : 'border-ink/10'}`}
    >
      <div className={`relative h-24 bg-linear-to-br px-3 py-3 ${coverClass(index)}`}>
        <p className="serif text-lg leading-tight text-ink">{set.title}</p>
        {active ? (
          <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-olive text-white" aria-hidden>
            <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M3 8.5 6.2 12 13 4" />
            </svg>
          </span>
        ) : null}
      </div>
      <div className="px-3 py-2.5">
        <p className="truncate text-sm font-semibold">{set.title}</p>
        <p className="truncate text-xs text-ink-soft">{set.topic}</p>
        <p className="mt-1 text-xs text-ink-soft">
          {set.units.length} tập · {set.wordCount} từ
        </p>
      </div>
    </button>
  )
}

function UnitCard({ set, unit }: { set: VocabSetCardDto; unit: VocabUnitDto }) {
  const [wordsOpen, setWordsOpen] = useState(false)
  const percent = unit.wordCount === 0 ? 0 : Math.round((unit.learnedCount / unit.wordCount) * 100)
  const status = unit.learnedCount === 0 ? 'Chưa học' : unit.learnedCount === unit.wordCount ? 'Đã học xong' : 'Đang học'
  const action = unit.learnedCount === 0 ? 'Bắt đầu học' : unit.learnedCount === unit.wordCount ? 'Ôn lại' : 'Học tiếp'
  return (
    <>
      <Card className="overflow-hidden p-0">
        <div className="relative h-28 bg-linear-to-br from-teal-soft to-paper px-4 py-4">
          <p className="text-center text-[13px] font-semibold tracking-[0.06em] text-gold-deep uppercase">{set.title}</p>
          <span className="absolute bottom-3 left-1/2 flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full bg-button text-sm font-semibold text-button-ink shadow-xs">
            {String(unit.index).padStart(2, '0')}
          </span>
        </div>
        <div className="px-4 pt-4 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">Unit {unit.index}</h3>
              <p className="text-sm text-ink-soft">{unit.wordCount} từ</p>
            </div>
            <p className="text-right text-xs text-ink-soft">
              {status}
              <span className="mt-0.5 block text-sm font-semibold text-ink-soft">{percent}%</span>
            </p>
          </div>
          <ProgressBar className="mt-3" value={percent} />
          <Link
            to={`/study/flashcards?deck=catalog&set=${encodeURIComponent(set.id)}&unit=${unit.index}`}
            className="mt-4 flex h-10 items-center justify-center rounded-full bg-button text-sm font-semibold text-button-ink hover:bg-button-hover"
          >
            {action}
            <span aria-hidden> ›</span>
          </Link>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setWordsOpen(true)}
              className="flex h-9 items-center justify-center gap-1 rounded-full bg-paper-2 px-2 text-xs font-semibold text-ink hover:bg-teal-soft"
            >
              <ListChecks className="size-3.5 text-gold-deep" /> Danh sách từ
            </button>
            <Link
              to={`/study/games?source=catalog&set=${encodeURIComponent(set.id)}&unit=${unit.index}`}
              className="flex h-9 items-center justify-center gap-1 rounded-full bg-teal-soft px-2 text-xs font-semibold text-gold-deep hover:opacity-90"
            >
              <Gamepad2 className="size-3.5" /> Chơi game
            </Link>
          </div>
        </div>
      </Card>
      {wordsOpen ? <UnitWordListModal set={set} unit={unit.index} onClose={() => setWordsOpen(false)} /> : null}
    </>
  )
}

function UnitWordListModal({ set, unit, onClose }: { set: VocabSetCardDto; unit: number; onClose: () => void }) {
  const detail = useVocabUnitDetail(set.id, unit, true)
  const saveOne = useSaveNotebookWord()
  const saveBatch = useBatchSaveNotebook()
  const [notice, setNotice] = useState<CornerNoticeState | null>(null)
  const items = detail.data?.items ?? []
  const unsavedIds = items.filter((w) => !w.savedInNotebook).map((w) => w.id)

  async function saveAll() {
    if (unsavedIds.length === 0) return
    try {
      const res = await saveBatch.mutateAsync(unsavedIds)
      setNotice(flashNotice(`Đã bỏ ${res.added} từ vào Sổ tay cá nhân (tự động gắn Chủ đề “${set.topic}” · Unit ${unit}).`))
    } catch (err) {
      setNotice(flashError(err instanceof ApiError ? err.message : 'Không lưu được cả Unit.'))
    }
  }

  return (
    <Modal title={`${set.title} · Unit ${unit}`} onClose={onClose}>
      <CornerNotice notice={notice} />
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gold/25 pb-3">
        <p className="text-xs text-ink-soft">
          Chủ đề: <strong className="text-gold-deep">{set.topic}</strong> • {items.length} từ
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="paper"
            className="px-3 py-1.5 text-xs"
            disabled={saveBatch.isPending || unsavedIds.length === 0}
            onClick={() => void saveAll()}
          >
            <Bookmark className="size-3.5 text-gold-deep" />
            {unsavedIds.length === 0 ? 'Đã lưu cả Unit ✓' : `Lưu cả Unit (${unsavedIds.length}) vào sổ tay`}
          </Button>
        </div>
      </div>

      <div className="mt-3 max-h-[60vh] space-y-2.5 overflow-y-auto pr-1">
        {detail.isPending ? (
          <p className="py-6 text-center text-sm text-ink-soft">Đang tải danh sách từ…</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-gold/25 bg-paper p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-ink">
                  {item.word} <span className="font-medium text-gold-deep">({item.partOfSpeech})</span>
                </p>
                <p className="mt-0.5 text-sm text-ink">{item.meaning}</p>
                {item.example ? <p className="mt-1 text-xs italic text-ink-soft">“{item.example}”</p> : null}
              </div>
              <button
                type="button"
                disabled={saveOne.isPending || item.savedInNotebook}
                onClick={() => {
                  void saveOne.mutateAsync({ vocabEntryId: item.id }).then(
                    (res) => setNotice(flashNotice(notebookSavedMessage(res))),
                    (err) => setNotice(flashError(err instanceof ApiError ? err.message : 'Không lưu được.')),
                  )
                }}
                className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  item.savedInNotebook ? 'bg-success-soft text-success' : 'bg-button text-button-ink hover:opacity-90'
                }`}
              >
                {item.savedInNotebook ? <BookmarkCheck className="size-3.5" /> : <Bookmark className="size-3.5" />}
                {item.savedInNotebook ? 'Đã trong sổ tay' : 'Lưu vào sổ tay'}
              </button>
            </div>
          ))
        )}
      </div>
    </Modal>
  )
}

function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (page: number) => void }) {
  return (
    <div className="mt-5 flex items-center justify-center gap-2">
      <button type="button" className="h-9 w-9 rounded-full border border-ink/10 bg-cream text-ink disabled:opacity-40" disabled={page === 1} onClick={() => onPage(page - 1)} aria-label="Trang trước">
        ‹
      </button>
      {pageWindow(page, pages).map((number) => (
        <button key={number} type="button" className={number === page ? 'h-9 w-9 rounded-full bg-button text-sm font-semibold text-button-ink' : 'h-9 w-9 rounded-full border border-ink/10 bg-cream text-sm font-semibold text-ink'} onClick={() => onPage(number)}>
          {number}
        </button>
      ))}
      <button type="button" className="h-9 w-9 rounded-full border border-ink/10 bg-cream text-ink disabled:opacity-40" disabled={page === pages} onClick={() => onPage(page + 1)} aria-label="Trang sau">
        ›
      </button>
    </div>
  )
}

function ProgressBoard({ sets }: { sets: VocabSetCardDto[] }) {
  const learned = sets.reduce((sum, set) => sum + set.learnedCount, 0)
  const total = sets.reduce((sum, set) => sum + set.wordCount, 0)
  const percent = total === 0 ? 0 : Math.round((learned / total) * 100)
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <p className="text-sm text-ink-soft">Đã học {learned}/{total} từ · {percent}%</p>
        <ProgressBar className="mt-3" value={percent} />
      </Card>
      <div className="grid gap-3">
        {sets.map((set) => {
          const done = set.wordCount === 0 ? 0 : Math.round((set.learnedCount / set.wordCount) * 100)
          const finishedUnits = set.units.filter((unit) => unit.wordCount > 0 && unit.learnedCount === unit.wordCount).length
          return (
            <Card key={set.id} className="p-4">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{set.title}</h3>
                  <p className="text-sm text-ink-soft">
                    {set.topic} · {finishedUnits}/{set.units.length} tập · {set.learnedCount}/{set.wordCount} từ
                  </p>
                </div>
                <p className="text-sm font-semibold text-ink-soft">{done}%</p>
              </div>
              <ProgressBar className="mt-3" value={done} />
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function WordSearch() {
  const [draft, setDraft] = useState('')
  const [q, setQ] = useState('')
  const vocab = useVocabSearch(q)
  const save = useSaveNotebookWord()
  const [note, setNote] = useState<string | null>(null)
  return (
    <Card className="mt-6 p-5">
      <h2 className="serif text-2xl">Tìm trong kho từ</h2>
      <form
        className="mt-3 flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          setQ(draft.trim())
        }}
      >
        <input className="h-10 min-w-0 flex-1 rounded-xl border border-ink/12 bg-cream px-3 text-sm" value={draft} placeholder="Nhập từ hoặc nghĩa" onChange={(event) => setDraft(event.target.value)} />
        <Button type="submit" variant="navy">Tìm</Button>
      </form>
      {note ? <p className="mt-3 text-sm text-olive">{note}</p> : null}
      <ul className="mt-4 divide-y divide-ink/8">
        {(vocab.data?.items ?? []).map((item) => (
          <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div>
              <p className="font-semibold">{item.word}</p>
              <p className="text-sm text-ink-soft">{item.partOfSpeech} • {item.meaning}</p>
              {item.set ? <p className="text-xs text-ink-soft">{item.set.topic} · {item.set.title} · Unit {item.set.unit}</p> : null}
            </div>
            <button
              type="button"
              className="text-sm font-semibold text-gold-deep underline decoration-2 underline-offset-4"
              disabled={save.isPending}
              onClick={() => {
                void save.mutateAsync({ vocabEntryId: item.id }).then(
                  (result) => setNote(notebookSavedMessage(result)),
                  (error) => setNote(error instanceof ApiError ? error.message : 'Không thêm được.'),
                )
              }}
            >
              Thêm vào sổ tay
            </button>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function pageWindow(page: number, pages: number) {
  const start = Math.max(1, Math.min(page - 2, pages - 4))
  return Array.from({ length: Math.min(5, pages) }, (_, index) => start + index)
}

function coverClass(index: number) {
  return [
    'from-[#d9f3ea] to-[#f4fbf8] dark:from-teal-950/60 dark:to-slate-900',
    'from-[#d7eef6] to-[#f4fbfd] dark:from-sky-950/60 dark:to-slate-900',
    'from-[#e5f4d4] to-[#f7fbf2] dark:from-emerald-950/60 dark:to-slate-900',
    'from-[#e7f1ea] to-[#f6fbf8] dark:from-slate-800 dark:to-slate-900',
  ][index % 4]
}

export function studyView(params: URLSearchParams): 'learn' | 'progress' | 'grammar' {
  const view = params.get('view')
  if (view === 'progress' || view === 'grammar') return view
  return 'learn'
}

export function useStudyView() {
  const [params] = useSearchParams()
  return studyView(params)
}
