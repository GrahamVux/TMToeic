import { Button } from '@/components/ui/Button'
import { Badge, Card, ProgressBar } from '@/components/ui/Primitives'
import { assignments } from '@/data/mock'
import { Link } from 'react-router-dom'
import { useState } from 'react'

export function AssignmentsPage() {
  const [tab, setTab] = useState('all')
  const items = assignments.filter((item) => {
    if (tab === 'due') return item.status === 'DUE_SOON'
    if (tab === 'done') return item.status === 'COMPLETED'
    return true
  })
  return (
    <div className="space-y-6">
      <header>
        <h1 className="serif text-4xl">Bài tập Thầy giao</h1>
        <p className="mt-2 text-sm text-ink/60">Bài tập độc quyền do Thầy Minh chỉ định theo lộ trình bứt phá điểm số lớp TOEIC 800+ K42.</p>
      </header>
      <div className="flex gap-2">
        <button className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === 'all' ? 'bg-gold-deep text-white' : 'bg-paper-2'}`} onClick={() => setTab('all')}>Tất cả (3)</button>
        <button className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === 'due' ? 'bg-gold-deep text-white' : 'bg-paper-2'}`} onClick={() => setTab('due')}>Cần nộp gấp (1)</button>
        <button className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === 'done' ? 'bg-gold-deep text-white' : 'bg-paper-2'}`} onClick={() => setTab('done')}>Đã hoàn thành (1)</button>
      </div>
      <div className="space-y-4">
        {items.map((item) => (
          <Card key={item.id} className="p-6">
            <Badge tone={item.status === 'COMPLETED' ? 'olive' : item.status === 'DUE_SOON' ? 'danger' : 'warn'}>{item.dueLabel}</Badge>
            <h2 className="mt-3 text-xl font-semibold">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-ink/65">{item.description}</p>
            <p className="mt-4 font-medium">{item.progress}</p>
            <ProgressBar className="mt-2" value={item.status === 'COMPLETED' ? 96 : item.status === 'IN_PROGRESS' ? 37 : 0} />
            <Link to="/practice" className="mt-4 inline-block">
              <Button variant="navy">{item.cta}</Button>
            </Link>
          </Card>
        ))}
      </div>
    </div>
  )
}
