import { Button } from '@/components/ui/Button'
import { Badge, Card, ProgressBar } from '@/components/ui/Primitives'
import { PageLoading } from '@/components/ui/LoadingScreen'
import { QueryErrorRedirect } from '@/features/errors/ErrorPages'
import { ApiError } from '@/lib/api'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { notebookSavedMessage, useGrammarLessons, useSaveNotebookWord, useStudyOverview, useVocabSearch } from './study.queries'

export function StudyPage() {
  const [tab, setTab] = useState<'vocab' | 'grammar'>('vocab')
  const overview = useStudyOverview()
  if (overview.isPending) return <PageLoading message="Đang tải mục học tập…" />
  if (overview.error) return <QueryErrorRedirect error={overview.error} />
  const data = overview.data!

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.18em] text-gold-deep uppercase">Học tập</p>
          <h1 className="serif mt-2 text-3xl sm:text-4xl">Ngữ pháp và từ vựng</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink/60">Ôn flashcard từ kho từ chung, hoặc lưu từ vào sổ tay khi đang làm bài.</p>
        </div>
        <Link to="/study/notebook">
          <Button>Sổ tay ({data.notebookTotal})</Button>
        </Link>
      </header>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={tabClass(tab === 'vocab')} onClick={() => setTab('vocab')}>
          Từ vựng
        </button>
        <button type="button" className={tabClass(tab === 'grammar')} onClick={() => setTab('grammar')}>
          Ngữ pháp
        </button>
      </div>

      {tab === 'vocab' ? <VocabHome catalogDue={data.catalogDue} catalogNew={data.catalogNew} notebookDue={data.notebookDue} /> : <GrammarHome completed={data.grammarCompleted} total={data.grammarTotal} />}
    </div>
  )
}

function tabClass(active: boolean) {
  return active ? 'rounded-full bg-gold-deep px-4 py-2 text-sm font-semibold text-white' : 'rounded-full bg-paper-2 px-4 py-2 text-sm font-semibold text-ink'
}

function VocabHome({ catalogDue, catalogNew, notebookDue }: { catalogDue: number; catalogNew: number; notebookDue: number }) {
  const [draft, setDraft] = useState('')
  const [q, setQ] = useState('')
  const vocab = useVocabSearch(q)
  const save = useSaveNotebookWord()
  const [note, setNote] = useState<string | null>(null)

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <Badge>Kho từ</Badge>
          <h2 className="serif mt-3 text-2xl">Flashcard cả lớp</h2>
          <p className="mt-2 text-sm text-ink/60">
            {catalogDue} thẻ đến hạn ôn • {catalogNew} từ chưa học
          </p>
          <Link to="/study/flashcards?deck=catalog" className="mt-4 inline-block">
            <Button>Học kho từ</Button>
          </Link>
        </Card>
        <Card className="p-5">
          <Badge tone="teal">Sổ tay</Badge>
          <h2 className="serif mt-3 text-2xl">Từ của bạn</h2>
          <p className="mt-2 text-sm text-ink/60">{notebookDue} thẻ cần ôn.</p>
          <Link to="/study/flashcards?deck=notebook" className="mt-4 inline-block">
            <Button variant="navy">Ôn sổ tay</Button>
          </Link>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="serif text-2xl">Tìm trong kho từ</h2>
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            setQ(draft.trim())
          }}
        >
          <input
            className="h-10 min-w-0 flex-1 rounded-xl border border-ink/12 bg-white px-3 text-sm"
            value={draft}
            placeholder="Nhập từ hoặc nghĩa"
            onChange={(event) => setDraft(event.target.value)}
          />
          <Button type="submit" variant="navy">
            Tìm
          </Button>
        </form>
        {note ? <p className="mt-3 text-sm text-olive">{note}</p> : null}
        {vocab.isPending ? <p className="mt-4 text-sm text-ink/55">Đang tải…</p> : null}
        <ul className="mt-4 divide-y divide-ink/8">
          {(vocab.data?.items ?? []).map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-semibold">{item.word}</p>
                <p className="text-sm text-ink/55">
                  {item.partOfSpeech} • {item.meaning}
                </p>
              </div>
              <button
                type="button"
                className="text-sm font-semibold text-gold-deep underline decoration-2 underline-offset-4 hover:text-navy"
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
        {vocab.data && vocab.data.items.length === 0 ? <p className="mt-3 text-sm text-ink/55">Chưa có từ nào khớp.</p> : null}
      </Card>
    </>
  )
}

function GrammarHome({ completed, total }: { completed: number; total: number }) {
  const lessons = useGrammarLessons()
  if (lessons.error) return <QueryErrorRedirect error={lessons.error} />
  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-3">
        <h2 className="serif text-2xl">Chuyên đề ngữ pháp</h2>
        <p className="text-sm text-ink/55">
          Đã học {completed}/{total}
        </p>
      </div>
      <ProgressBar value={total === 0 ? 0 : (completed / total) * 100} />
      <div className="mt-4 space-y-3">
        {(lessons.data ?? []).map((lesson, index) => (
          <Card key={lesson.id} className="grid gap-4 p-5 md:grid-cols-[64px_1fr_auto] md:items-center">
            <div className="serif text-3xl text-gold-deep">{String(index + 1).padStart(2, '0')}</div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{lesson.title}</h3>
                {lesson.pdf ? <Badge tone="teal">Có PDF</Badge> : null}
                {lesson.completed ? <Badge tone="olive">Đã học</Badge> : null}
              </div>
              <p className="mt-1 text-sm text-ink/60">{lesson.summary}</p>
            </div>
            <Link to={`/grammar/${lesson.id}`}>
              <Button variant="navy">{lesson.completed ? 'Xem lại' : 'Học'}</Button>
            </Link>
          </Card>
        ))}
      </div>
    </section>
  )
}
