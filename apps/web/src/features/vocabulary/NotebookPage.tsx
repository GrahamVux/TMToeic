import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Primitives'
import { PageLoading } from '@/components/ui/LoadingScreen'
import { QueryErrorRedirect } from '@/features/errors/ErrorPages'
import { ApiError } from '@/lib/api'
import type { NotebookEntryDto } from '@toeic/shared'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDeleteNotebook, useNotebook, useUpdateNotebook } from '@/features/study/study.queries'

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
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.18em] text-gold-deep uppercase">Học tập / Sổ tay</p>
          <h1 className="serif mt-2 text-3xl sm:text-4xl">Sổ tay cá nhân</h1>
          <p className="mt-2 text-sm text-ink/60">Từ bạn lưu khi làm bài, hoặc lấy từ kho từ chung.</p>
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

      {visible.length === 0 ? <p className="text-sm text-ink/55">Chưa có từ nào trong mục này.</p> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {visible.map((item) => (
          <NoteCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  )
}

function NoteCard({ item }: { item: NotebookEntryDto }) {
  const update = useUpdateNotebook()
  const remove = useDeleteNotebook()
  const [partOfSpeech, setPartOfSpeech] = useState(item.partOfSpeech ?? '')
  const [meaning, setMeaning] = useState(item.meaning ?? '')
  const [error, setError] = useState<string | null>(null)
  const incomplete = !item.meaning || !item.partOfSpeech

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="serif text-3xl">{item.word}</h2>
          {item.partOfSpeech ? <p className="text-sm text-gold-deep">{item.partOfSpeech}</p> : <p className="text-sm text-ink/45">Chưa có loại từ</p>}
        </div>
        <button type="button" className="text-sm font-semibold text-coral underline underline-offset-4" disabled={remove.isPending} onClick={() => void remove.mutateAsync(item.id)}>
          Xóa
        </button>
      </div>
      {incomplete ? (
        <form
          className="mt-4 space-y-2"
          onSubmit={(event) => {
            event.preventDefault()
            setError(null)
            void update.mutateAsync({ id: item.id, partOfSpeech, meaning }).catch((err) => {
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
      ) : (
        <p className="mt-3 text-sm leading-6">{item.meaning}</p>
      )}
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
