import { Button } from '@/components/ui/Button'
import { Badge, Card } from '@/components/ui/Primitives'
import { PageLoading } from '@/components/ui/LoadingScreen'
import { QueryErrorRedirect } from '@/features/errors/ErrorPages'
import { Link, useParams } from 'react-router-dom'
import { useGrammarLesson, useGrammarProgress } from './study.queries'

export function GrammarLessonPage() {
  const { topicId } = useParams()
  const lesson = useGrammarLesson(topicId)
  const progress = useGrammarProgress()

  if (lesson.isPending) return <PageLoading message="Đang tải chuyên đề…" />
  if (lesson.error || !lesson.data) return <QueryErrorRedirect error={lesson.error} />
  const topic = lesson.data

  return (
    <div className="space-y-6">
      <p className="text-xs text-ink/50">Học tập / Ngữ pháp</p>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Badge tone={topic.completed ? 'olive' : 'gold'}>{topic.completed ? 'Đã học' : 'Chuyên đề'}</Badge>
          <h1 className="serif mt-3 text-3xl sm:text-4xl">{topic.title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/65">{topic.summary}</p>
        </div>
        <Link to="/study">
          <Button variant="ghost">Về mục học tập</Button>
        </Link>
      </div>
      <Card className="p-6">
        <h2 className="serif text-2xl">Nội dung</h2>
        <p className="mt-4 text-sm leading-7 whitespace-pre-line text-ink/80">{topic.body}</p>
        {topic.pdf ? (
          <div className="mt-6">
            <h3 className="font-semibold">Tài liệu PDF</h3>
            <p className="mt-1 text-sm text-ink/55">{topic.pdf.filename}</p>
            <a className="mt-3 inline-block" href={`/api/v1/study/grammar/${topic.id}/pdf`} target="_blank" rel="noreferrer">
              <Button>Mở tài liệu PDF</Button>
            </a>
            <iframe title={topic.pdf.filename} src={`/api/v1/study/grammar/${topic.id}/pdf`} className="mt-4 hidden h-[70vh] w-full rounded-xl border border-ink/10 bg-white md:block" />
          </div>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <Button disabled={progress.isPending} onClick={() => progress.mutate({ id: topic.id, completed: !topic.completed })}>
            {topic.completed ? 'Bỏ đánh dấu đã học' : 'Đánh dấu đã học'}
          </Button>
          <Link to="/practice/reading">
            <Button variant="navy">Luyện Part 5–7</Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}
