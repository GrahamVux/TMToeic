import { Button } from '@/components/ui/Button'
import { Badge, Card, ProgressBar } from '@/components/ui/Primitives'
import { dailyVocabPlan, grammarTopics, vocabTopics } from '@/data/mock'
import { Link } from 'react-router-dom'
import { useState } from 'react'

export function StudyPage() {
  const [tab, setTab] = useState<'all' | 'vocab' | 'grammar'>('all')
  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs text-ink/50">Trang chủ / Học tập / Kho chuyên đề K42</p>
          <h1 className="serif mt-2 text-4xl">Kho học liệu & chuyên đề TOEIC Thầy Minh</h1>
          <p className="mt-2 text-sm text-ink/60">Mục tiêu 850+ • Tổng tiến độ học 32/54 bài • Vượt 12% so với lộ trình tuần</p>
        </div>
        <Link to="/study/notebook"><Button>Sổ tay từ vựng cá nhân (48)</Button></Link>
      </header>

      <div className="flex flex-wrap gap-2">
        {[
          { id: 'all', label: 'Tổng hợp' },
          { id: 'vocab', label: 'Từ vựng (Vocabulary)' },
          { id: 'grammar', label: 'Ngữ pháp (Grammar)' },
        ].map((item) => (
          <button key={item.id} className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === item.id ? 'bg-gold-deep text-white' : 'bg-paper-2 text-ink'}`} onClick={() => setTab(item.id as typeof tab)}>
            {item.label}
          </button>
        ))}
      </div>

      {(tab === 'all' || tab === 'vocab') && (
        <>
          <Card className="grid gap-6 p-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <Badge>Từ vựng của ngày • Hôm nay</Badge>
              <h2 className="serif mt-3 text-4xl">Substantial</h2>
              <p className="mt-1 text-ink/55">/səbˈstæn.ʃəl/ • adjective</p>
              <p className="mt-4 text-sm"><span className="font-semibold">Nghĩa tiếng Việt trọng tâm:</span> Đáng kể, quan trọng, lớn lao, có giá trị thực chất</p>
              <ul className="mt-4 space-y-1 text-sm text-ink/70">
                <li>• a substantial increase in profit</li>
                <li>• substantial evidence</li>
                <li>• substantial difference</li>
              </ul>
            </div>
            <div className="rounded-2xl bg-teal-soft p-5 text-ink">
              <p className="text-gold-deep">Thầy Minh nhắc nhở</p>
              <p className="mt-2 text-sm leading-6">Lưu lại để làm flashcard tối nay. Đã có 418/450 học viên hoàn thành từ này.</p>
              <p className="mt-4 text-sm italic text-ink/70">“The newly implemented marketing strategy resulted in a substantial increase in quarterly sales.”</p>
              <Button className="mt-5">Đã lưu vào sổ tay</Button>
            </div>
          </Card>

          <section>
            <h2 className="serif text-2xl">Lộ trình 30 ngày bứt phá</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {dailyVocabPlan.map((day) => (
                <Card key={day.day} className="p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold tracking-wide uppercase">Ngày {String(day.day).padStart(2, '0')}</p>
                    <Badge tone={day.status === 'DONE' ? 'olive' : day.status === 'TODAY' ? 'gold' : 'paper'}>
                      {day.status === 'DONE' ? 'Đã học' : day.status === 'TODAY' ? 'Hôm nay' : 'Chưa mở'}
                    </Badge>
                  </div>
                  <h3 className="mt-2 font-semibold">{day.title}</h3>
                  <p className="mt-1 text-xs text-ink/55">{day.words}</p>
                  {day.status === 'TODAY' ? <ProgressBar className="mt-3" value={70} /> : null}
                </Card>
              ))}
            </div>
          </section>

          <section>
            <h2 className="serif text-2xl">600 Essential Words — theo chủ đề</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {vocabTopics.map((topic) => (
                <Card key={topic.id} className="flex items-center justify-between p-4">
                  <div>
                    <h3 className="font-semibold">{topic.title}</h3>
                    <p className="text-sm text-ink/55">{topic.progress} • Master {topic.mastery}%</p>
                  </div>
                  <Button variant={topic.status === 'NEW' ? 'navy' : 'ghost'}>{topic.status === 'NEW' ? 'Bắt đầu' : 'Flashcard'}</Button>
                </Card>
              ))}
            </div>
          </section>
        </>
      )}

      {(tab === 'all' || tab === 'grammar') && (
        <section>
          <h2 className="serif text-2xl">Ngữ pháp chuyên đề & tuyệt kỹ giải đề</h2>
          <div className="mt-4 space-y-3">
            {grammarTopics.map((topic) => (
              <Card key={topic.id} className="grid gap-4 p-5 md:grid-cols-[80px_1fr_auto]">
                <div className="serif text-3xl text-gold-deep">{topic.order}</div>
                <div>
                  <h3 className="font-semibold">{topic.title}</h3>
                  <p className="mt-1 text-sm text-ink/60">{topic.note}</p>
                  <ProgressBar className="mt-3 max-w-sm" value={topic.progress} />
                </div>
                <Link to={`/grammar/${topic.id}`}>
                  <Button variant={topic.status === 'LOCKED' ? 'ghost' : 'navy'}>{topic.status === 'DONE' ? 'Học lại' : topic.status === 'LEARNING' ? 'Học tiếp' : 'Bắt đầu'}</Button>
                </Link>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
