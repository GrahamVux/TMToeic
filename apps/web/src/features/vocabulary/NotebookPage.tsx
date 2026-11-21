import { Button } from '@/components/ui/Button'
import { FilePick } from '@/components/ui/FilePick'
import { Card } from '@/components/ui/Primitives'
import { PageLoading } from '@/components/ui/LoadingScreen'
import { QueryErrorRedirect } from '@/features/errors/ErrorPages'
import { ApiError, downloadApiFile } from '@/lib/api'
import type { NotebookEntryDto } from '@toeic/shared'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { VocabNav } from '@/features/study/VocabCourse'
import { notebookSavedMessage, useDeleteNotebook, useImportNotebook, useNotebook, useSaveNotebookWord, useUpdateNotebook } from '@/features/study/study.queries'

export function NotebookPage() {
  const notebook = useNotebook()
  const [filter, setFilter] = useState<'all' | 'due' | 'missing'>('all')
  if (notebook.isPending) return <PageLoading message="Đang tải sổ tay…" />
  if (notebook.error || !notebook.data) return <QueryErrorRedirect error={notebook.error} />
  const data = notebook.data
  const visible = data.items.filter((item) => {
    if (filter === 'due') return item.due
    if (filter === 'missing') return !item.meaning || !item.partOfSpeech
    return true
  })

  return (
    <div className="space-y-6">
      <VocabNav current="mine" />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.18em] text-gold-deep uppercase">Học tập / Sổ tay</p>
          <h1 className="serif mt-2 text-3xl sm:text-4xl">Sổ tay cá nhân</h1>
          <p className="mt-2 text-sm text-ink/60">Từ điển của bạn: từ take note khi làm bài đọc, từ bạn tự thêm, hoặc cả danh sách trong file Excel.</p>
        </div>
        <Link to="/study/flashcards?deck=notebook">
          <Button>Luyện flashcard ({data.dueCount})</Button>
        </Link>
      </header>

      <div className="flex flex-wrap gap-6 text-sm">
        <Metric label="Đã lưu" value={data.total} />
        <Metric label="Cần ôn" value={data.dueCount} />
        <Metric label="Chưa có nghĩa" value={data.missingMeaning} />
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['all', `Tất cả (${data.total})`],
            ['due', `Cần ôn (${data.dueCount})`],
            ['missing', `Chưa có nghĩa (${data.missingMeaning})`],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" className={`rounded-full px-4 py-2 text-sm font-semibold ${filter === id ? 'bg-gold-deep text-white' : 'bg-paper-2'}`} onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </div>

      <AddTakeNote />

      {filter === 'all' ? (
        <>
          <section className="space-y-4">
            <h2 className="serif text-2xl">Các từ take note</h2>
            <p className="text-sm text-ink/55">Từ lấy từ bài đọc hoặc bạn tự thêm. Điền loại từ và nghĩa để tự học.</p>
            <NoteGrid items={visible.filter((item) => item.source !== 'CATALOG')} empty="Chưa có từ take note. Bạn có thể thêm ở form phía trên." />
          </section>
          <section className="space-y-4">
            <h2 className="serif text-2xl">Từ lấy từ kho</h2>
            <NoteGrid items={visible.filter((item) => item.source === 'CATALOG')} empty="Chưa lưu từ nào từ kho từ chung." />
          </section>
        </>
      ) : (
        <NoteGrid items={visible} empty="Chưa có từ nào trong mục này." />
      )}
    </div>
  )
}

function AddTakeNote() {
  const save = useSaveNotebookWord()
  const [word, setWord] = useState('')
  const [partOfSpeech, setPartOfSpeech] = useState('')
  const [meaning, setMeaning] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  return (
    <Card className="p-5">
      <h2 className="serif text-2xl">Tự thêm từ</h2>
      <form
        className="mt-4 grid gap-2 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault()
          setError(null)
          setDone(null)
          void save
            .mutateAsync({ word, partOfSpeech, meaning, manual: true })
            .then((result) => {
              setDone(notebookSavedMessage(result))
              setWord('')
              setPartOfSpeech('')
              setMeaning('')
            })
            .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Không thêm được.'))
        }}
      >
        <input className="h-10 rounded-xl border border-ink/12 px-3 text-sm sm:col-span-2" value={word} placeholder="Từ hoặc cụm từ tiếng Anh" onChange={(event) => setWord(event.target.value)} />
        <input className="h-10 rounded-xl border border-ink/12 px-3 text-sm" value={partOfSpeech} placeholder="Loại từ, ví dụ noun" onChange={(event) => setPartOfSpeech(event.target.value)} />
        <input className="h-10 rounded-xl border border-ink/12 px-3 text-sm" value={meaning} placeholder="Nghĩa tiếng Việt" onChange={(event) => setMeaning(event.target.value)} />
        {error ? <p className="text-sm text-coral sm:col-span-2">{error}</p> : null}
        {done ? <p className="text-sm text-olive sm:col-span-2">{done}</p> : null}
        <div className="sm:col-span-2">
          <Button type="submit" disabled={save.isPending}>Thêm vào từ điển của tôi</Button>
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
      <h3 className="font-semibold">Thêm cả danh sách từ Excel</h3>
      <p className="mt-1 text-sm text-ink/60">Ba cột: từ vựng, loại từ, nghĩa. Dòng đã có trong sổ tay được cập nhật nghĩa.</p>
      <button
        type="button"
        className="mt-2 text-sm font-semibold text-gold-deep underline underline-offset-4"
        onClick={() => {
          setError(null)
          void downloadApiFile('/study/notebook/template', 'mau-so-tay.xlsx').catch((err: unknown) => {
            setError(err instanceof ApiError ? err.message : 'Không tải được file mẫu.')
          })
        }}
      >
        Tải file mẫu
      </button>
      <div className="mt-3">
        <FilePick
          label={importList.isPending ? 'Đang nhập…' : 'Chọn file .xlsx'}
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          disabled={importList.isPending}
          hint="Tối đa 8MB, 2000 từ. Chỉ từ hoặc cụm tiếng Anh."
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

function NoteGrid({ items, empty }: { items: NotebookEntryDto[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-ink/55">{empty}</p>
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {items.map((item) => (
        <NoteCard key={item.id} item={item} />
      ))}
    </div>
  )
}

function NoteCard({ item }: { item: NotebookEntryDto }) {
  const update = useUpdateNotebook()
  const remove = useDeleteNotebook()
  const [partOfSpeech, setPartOfSpeech] = useState(item.partOfSpeech ?? '')
  const [meaning, setMeaning] = useState(item.meaning ?? '')
  const [error, setError] = useState<string | null>(null)
  const takeNote = item.source !== 'CATALOG'
  const incomplete = !item.meaning || !item.partOfSpeech
  const [editing, setEditing] = useState(incomplete)

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="serif text-3xl">{item.word}</h2>
          {item.partOfSpeech ? <p className="text-sm text-gold-deep">{item.partOfSpeech}</p> : <p className="text-sm text-ink/45">Chưa có loại từ</p>}
          {takeNote ? <p className="mt-1 text-xs text-ink/40">{item.source === 'MANUAL' ? 'Tự thêm' : 'Lấy từ bài đọc'}</p> : null}
        </div>
        <button type="button" className="text-sm font-semibold text-coral underline underline-offset-4" disabled={remove.isPending} onClick={() => void remove.mutateAsync(item.id)}>
          Xóa
        </button>
      </div>
      {takeNote && !editing && item.meaning ? (
        <div className="mt-3">
          <p className="text-sm leading-6">{item.meaning}</p>
          <button type="button" className="mt-2 text-sm font-semibold text-gold-deep underline underline-offset-4" onClick={() => setEditing(true)}>
            Sửa loại từ và nghĩa
          </button>
        </div>
      ) : editing ? (
        <form
          className="mt-4 space-y-2"
          onSubmit={(event) => {
            event.preventDefault()
            setError(null)
            void update.mutateAsync({ id: item.id, partOfSpeech, meaning }).then(() => setEditing(false)).catch((err) => {
              setError(err instanceof ApiError ? err.message : 'Không lưu được.')
            })
          }}
        >
          <input className="h-10 w-full rounded-xl border border-ink/12 px-3 text-sm" value={partOfSpeech} placeholder="Loại từ, ví dụ noun" onChange={(event) => setPartOfSpeech(event.target.value)} />
          <input className="h-10 w-full rounded-xl border border-ink/12 px-3 text-sm" value={meaning} placeholder="Nghĩa tiếng Việt" onChange={(event) => setMeaning(event.target.value)} />
          {error ? <p className="text-sm text-coral">{error}</p> : null}
          <Button type="submit" disabled={update.isPending}>
            Lưu để học flashcard
          </Button>
        </form>
      ) : item.meaning ? (
        <p className="mt-3 text-sm leading-6">{item.meaning}</p>
      ) : null}
    </Card>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs text-ink/45">{label}</p>
      <p className="serif text-2xl">{value}</p>
    </div>
  )
}
