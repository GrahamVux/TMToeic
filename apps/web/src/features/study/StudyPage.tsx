import { Button } from '@/components/ui/Button'
import { Badge, Card, ProgressBar } from '@/components/ui/Primitives'
import { PageLoading } from '@/components/ui/LoadingScreen'
import { QueryErrorRedirect } from '@/features/errors/ErrorPages'
import { Link } from 'react-router-dom'
import { VocabCourse, VocabNav, useStudyView } from './VocabCourse'
import { useGrammarLessons } from './study.queries'

export function StudyPage() {
  const view = useStudyView()
  return (
    <div className="space-y-6">
      <VocabNav current={view} />
      {view === 'grammar' ? <GrammarHome /> : <VocabCourse view={view} />}
    </div>
  )
}

function GrammarHome() {
  const lessons = useGrammarLessons()
  if (lessons.isPending) return <PageLoading message="Đang tải ngữ pháp…" />
  if (lessons.error) return <QueryErrorRedirect error={lessons.error} />
  const items = lessons.data ?? []
  const completed = items.filter((lesson) => lesson.completed).length
  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-3">
        <h2 className="serif text-2xl">Chuyên đề ngữ pháp</h2>
        <p className="text-sm text-ink/55">
          Đã học {completed}/{items.length}
        </p>
      </div>
      <ProgressBar value={items.length === 0 ? 0 : (completed / items.length) * 100} />
      <div className="mt-4 space-y-3">
        {items.map((lesson, index) => (
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
