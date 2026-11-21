import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Primitives'
import { PageLoading } from '@/components/ui/LoadingScreen'
import { QueryErrorRedirect } from '@/features/errors/ErrorPages'
import { ApiError } from '@/lib/api'
import type { FlashcardDto } from '@toeic/shared'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useFlashcards, useReviewCard } from './study.queries'

export function FlashcardPage() {
  const [params, setParams] = useSearchParams()
  const deck = params.get('deck') === 'notebook' ? 'notebook' : 'catalog'
  const setId = params.get('set') ?? ''
  const unitNumber = Number(params.get('unit'))
  const unit = deck === 'catalog' && setId && Number.isInteger(unitNumber) && unitNumber > 0 ? { setId, unit: unitNumber } : undefined
  const scope = unit ? `${unit.setId}:${unit.unit}` : deck
  const query = useFlashcards(deck, unit)
  const review = useReviewCard()
  const [cards, setCards] = useState<FlashcardDto[] | null>(null)
  const [loadedScope, setLoadedScope] = useState('')
  const [flipped, setFlipped] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loadedScope !== scope) {
    setLoadedScope(scope)
    setCards(null)
    setFlipped(false)
  }

  useEffect(() => {
    if (!query.data || query.data.deck !== deck || loadedScope !== scope) return
    setCards((current) => current ?? query.data.cards)
  }, [query.data, deck, loadedScope, scope])

  function switchDeck(next: 'catalog' | 'notebook') {
    setCards(null)
    setFlipped(false)
    setParams({ deck: next })
  }

  if (query.isPending || cards === null) return <PageLoading message="Đang mở flashcard…" />
  if (query.error) return <QueryErrorRedirect error={query.error} />

  const card = cards[0]
  async function grade(result: 'AGAIN' | 'GOOD') {
    if (!card) return
    setError(null)
    try {
      await review.mutateAsync({ kind: card.kind, id: card.id, result })
      setFlipped(false)
      setCards((queue) => {
        const [current, ...rest] = queue ?? []
        if (!current) return []
        return result === 'AGAIN' ? [...rest, current] : rest
      })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không lưu được kết quả ôn.')
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.18em] text-gold-deep uppercase">Học tập / Flashcard</p>
          <h1 className="serif mt-2 text-3xl">{query.data?.title || 'Ôn từ vựng'}</h1>
        </div>
        <Link to={deck === 'notebook' ? '/study/notebook' : '/study'} className="text-sm font-semibold text-gold-deep underline underline-offset-4">
          Quay lại
        </Link>
      </div>
      {unit ? null : (
        <div className="flex gap-2">
          <button type="button" className={tab(deck === 'catalog')} onClick={() => switchDeck('catalog')}>
            Kho từ
          </button>
          <button type="button" className={tab(deck === 'notebook')} onClick={() => switchDeck('notebook')}>
            Sổ tay
          </button>
        </div>
      )}
      <p className="text-sm text-ink/55">
        {query.data?.dueCount ?? 0} thẻ đến hạn • {query.data?.newCount ?? 0} từ mới • còn {cards.length} thẻ trong lượt này
      </p>
      {error ? <p className="text-sm text-coral">{error}</p> : null}
      {card ? (
        <>
          <button type="button" className="block w-full text-left" onClick={() => setFlipped((value) => !value)}>
            <Card className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
              {flipped ? (
                <>
                  <p className="text-xs font-semibold tracking-[0.16em] text-ink/45 uppercase">Nghĩa</p>
                  <p className="serif mt-4 text-3xl leading-snug">{card.meaning}</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold tracking-wide text-gold-deep">{card.partOfSpeech}</p>
                  <p className="serif mt-3 text-5xl">{card.word}</p>
                  <p className="mt-6 text-sm text-ink/45">Nhấn để lật nghĩa</p>
                </>
              )}
            </Card>
          </button>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="paper" disabled={review.isPending} onClick={() => void grade('AGAIN')}>
              Chưa nhớ
            </Button>
            <Button disabled={review.isPending} onClick={() => void grade('GOOD')}>
              Đã nhớ
            </Button>
          </div>
        </>
      ) : (
        <Card className="p-8 text-center">
          <h2 className="serif text-2xl">Hết thẻ trong lượt này</h2>
          <p className="mt-2 text-sm text-ink/60">{deck === 'notebook' ? 'Từ chưa có nghĩa không vào flashcard. Hãy điền trong sổ tay.' : 'Bạn có thể lấy thêm từ mới hoặc quay lại sau khi đến hạn ôn.'}</p>
          <Button
            className="mt-5"
            onClick={() => {
              void query.refetch().then((result) => setCards(result.data?.cards ?? []))
            }}
          >
            Lấy thêm thẻ
          </Button>
        </Card>
      )}
    </div>
  )
}

function tab(active: boolean) {
  return active ? 'rounded-full bg-gold-deep px-4 py-2 text-sm font-semibold text-white' : 'rounded-full bg-paper-2 px-4 py-2 text-sm font-semibold text-ink'
}
