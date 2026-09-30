import { Button } from '@/components/ui/Button'
import { Badge, Card, ProgressBar } from '@/components/ui/Primitives'
import { grammarTopics } from '@/data/mock'
import { Link, useParams } from 'react-router-dom'

export function GrammarLessonPage() {
  const { topicId } = useParams()
  const topic = grammarTopics.find((item) => item.id === topicId) ?? grammarTopics[2]

  return (
    <div className="space-y-6">
      <p className="text-xs text-ink/50">Học tập / Ngữ pháp / {topic.order}</p>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Badge>{topic.status === 'DONE' ? 'Đã học • 100%' : topic.status === 'LEARNING' ? 'Đang học' : 'Chuyên đề mới'}</Badge>
          <h1 className="serif mt-3 text-4xl">{topic.title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/65">{topic.note}</p>
        </div>
        <Link to="/study">
          <Button variant="ghost">Về kho chuyên đề</Button>
        </Link>
      </div>

      <Card className="overflow-hidden">
        <div className="aspect-video bg-teal-soft text-ink">
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <p className="text-gold-deep">Video bài giảng • Google Drive iframe</p>
            <p className="text-sm text-ink/60">VideoPlayer abstraction — provider = google_drive</p>
          </div>
        </div>
        <div className="p-6">
          <h2 className="serif text-2xl">Nội dung bài học</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-ink/70">
            <li>Nhận diện dấu hiệu trong 10 giây, không dịch toàn câu.</li>
            <li>Các bẫy ETS hay gặp trong Part 5 & Part 6 gắn với chuyên đề này.</li>
            <li>20 câu củng cố chấm tự động + video chữa của Thầy Minh.</li>
          </ul>
          <ProgressBar className="mt-5" value={topic.progress} />
          <div className="mt-5 flex gap-3">
            <Link to="/practice">
              <Button variant="navy">Làm 20 câu củng cố</Button>
            </Link>
            <Button variant="ghost">Đánh dấu đã học</Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
