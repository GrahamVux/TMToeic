import { Button } from '@/components/ui/Button'
import { Badge, Card } from '@/components/ui/Primitives'
import { notebookWords } from '@/data/mock'
import { useState } from 'react'

export function NotebookPage() {
  const [filter, setFilter] = useState('all')
  const [flipped, setFlipped] = useState<string | null>(null)
  const visible = notebookWords.filter((word) => {
    if (filter === 'review') return word.tag === 'REVIEW'
    if (filter === 'mastered') return word.tag === 'MASTERED'
    if (filter === 'weak') return word.tag === 'WEAK'
    return true
  })

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs text-ink/50">Học tập / Sổ tay từ vựng cá nhân</p>
          <h1 className="serif mt-2 text-4xl">Sổ tay từ vựng cá nhân</h1>
        </div>
        <div className="flex gap-6 text-sm">
          <Metric label="Tổng từ đã lưu" value="48" />
          <Metric label="Cần ôn hôm nay" value="9" />
          <Metric label="Đã nhớ vững" value="27" />
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {[
          { id: 'all', label: 'Tất cả (48)' },
          { id: 'review', label: 'Cần ôn (9)' },
          { id: 'mastered', label: 'Đã thuộc (27)' },
          { id: 'weak', label: 'Hay sai (6)' },
        ].map((item) => (
          <button key={item.id} className={`rounded-full px-4 py-2 text-sm font-semibold ${filter === item.id ? 'bg-gold-deep text-white' : 'bg-paper-2'}`} onClick={() => setFilter(item.id)}>
            {item.label}
          </button>
        ))}
        <Button className="ml-auto">Luyện flashcard (9)</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {visible.map((word) => (
          <button key={word.word} type="button" onClick={() => setFlipped(flipped === word.word ? null : word.word)} className="text-left">
            <Card className="h-full p-5 transition hover:-translate-y-0.5">
              {flipped === word.word ? (
                <div>
                  <p className="text-xs tracking-widest text-gold-deep uppercase">Mẹo Thầy Minh</p>
                  <p className="mt-3 text-sm leading-6">{word.tip}</p>
                  <p className="mt-4 text-xs text-ink/50">Nhấn để lật lại</p>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="serif text-3xl">{word.word}</h2>
                      <p className="text-sm text-ink/50">{word.ipa}</p>
                    </div>
                    <Badge tone={word.tag === 'MASTERED' ? 'olive' : word.tag === 'WEAK' ? 'danger' : 'warn'}>{word.pos}</Badge>
                  </div>
                  <p className="mt-3 font-medium">{word.meaning}</p>
                  <p className="mt-3 text-xs tracking-wide text-ink/45 uppercase">Collocation ETS</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {word.collocations.map((item) => (
                      <Badge key={item} tone="paper">{item}</Badge>
                    ))}
                  </div>
                </>
              )}
            </Card>
          </button>
        ))}
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-ink/45">{label}</p>
      <p className="serif text-2xl">{value}</p>
    </div>
  )
}
