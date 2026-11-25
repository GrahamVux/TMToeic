import { Button } from '@/components/ui/Button'
import { CornerNotice, flashError, flashNotice, type CornerNoticeState } from '@/components/ui/CornerNotice'
import { Card } from '@/components/ui/Primitives'
import { PageLoading } from '@/components/ui/LoadingScreen'
import { QueryErrorRedirect } from '@/features/errors/ErrorPages'
import { ApiError } from '@/lib/api'
import { NOTEBOOK_CARD_COLORS, type FlashcardDto, type NotebookCardColor } from '@toeic/shared'
import { Bookmark, BookmarkCheck, Gamepad2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { notebookSavedMessage, useFlashcards, useReviewCard, useSaveNotebookWord } from './study.queries'

export function FlashcardPage() {
  const [params, setParams] = useSearchParams()
  const deck = params.get('deck') === 'notebook' ? 'notebook' : 'catalog'
  const setId = params.get('set') ?? ''
  const unitNumber = Number(params.get('unit'))
  const topicParam = params.get('topic') ?? undefined
  const colorRaw = params.get('color') ?? undefined
  const colorParam = colorRaw && (NOTEBOOK_CARD_COLORS as readonly string[]).includes(colorRaw) ? (colorRaw as NotebookCardColor) : undefined

  const unit = deck === 'catalog' && setId && Number.isInteger(unitNumber) && unitNumber > 0 ? { setId, unit: unitNumber } : undefined
  const notebookFilter =
    deck === 'notebook'
      ? {
          ...(topicParam ? { topic: topicParam } : {}),
          ...(Number.isInteger(unitNumber) && unitNumber > 0 ? { unit: unitNumber } : {}),
          ...(colorParam ? { color: colorParam } : {}),
        }
      : undefined
  const scope = unit
    ? `${unit.setId}:${unit.unit}`
    : `${deck}:${topicParam ?? ''}:${Number.isInteger(unitNumber) ? unitNumber : 0}:${colorParam ?? ''}`

  const query = useFlashcards(deck, unit, notebookFilter)
  const review = useReviewCard()
  const saveToNotebook = useSaveNotebookWord()
  const [cards, setCards] = useState<FlashcardDto[] | null>(null)
  const [loadedScope, setLoadedScope] = useState('')
  const [flipped, setFlipped] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedIds, setSavedIds] = useState<Record<string, boolean>>({})
  const [notice, setNotice] = useState<CornerNoticeState | null>(null)

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
  const isSaved = Boolean(card && (card.savedInNotebook || savedIds[card.id]))

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

  async function handleSaveCard() {
    if (!card || card.kind !== 'CATALOG') return
    try {
      const res = await saveToNotebook.mutateAsync({ vocabEntryId: card.id })
      setSavedIds((prev) => ({ ...prev, [card.id]: true }))
      setNotice(flashNotice(notebookSavedMessage(res)))
    } catch (err) {
      setNotice(flashError(err instanceof ApiError ? err.message : 'Không lưu được vào sổ tay.'))
    }
  }

  const gameHref = unit
    ? `/study/games?source=catalog&set=${encodeURIComponent(unit.setId)}&unit=${unit.unit}`
    : '/study/games?source=notebook'

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <CornerNotice notice={notice} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.18em] text-gold-deep uppercase">Học tập / Flashcard</p>
          <h1 className="serif mt-2 text-3xl">{query.data?.title || 'Ôn từ vựng'}</h1>
        </div>
        <div className="flex items-center gap-4">
          <Link to={gameHref} className="inline-flex items-center gap-1.5 text-sm font-semibold text-olive underline underline-offset-4">
            <Gamepad2 className="size-4" /> Chơi game bộ này
          </Link>
          <Link to={deck === 'notebook' ? '/study/notebook' : '/study'} className="text-sm font-semibold text-gold-deep underline underline-offset-4">
            Quay lại
          </Link>
        </div>
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
          <div className="space-y-3">
            <button type="button" className="block w-full text-left" onClick={() => setFlipped((value) => !value)}>
              <Card className="flex min-h-68 flex-col items-center justify-center p-8 text-center">
                {flipped ? (
                  <>
                    <p className="text-xs font-semibold tracking-[0.16em] text-ink/45 uppercase">
                      Nghĩa • {card.partOfSpeech}
                    </p>
                    <p className="serif mt-3 text-3xl leading-snug text-ink">{card.meaning}</p>
                    {card.example ? (
                      <p className="mt-4 max-w-md rounded-xl bg-paper px-4 py-2.5 text-sm italic leading-relaxed text-ink/75">
                        “{card.example}”
                      </p>
                    ) : null}
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold tracking-wide text-gold-deep">{card.partOfSpeech}</p>
                    <p className="serif mt-3 text-5xl">{card.word}</p>
                    {card.topic || card.unit ? (
                      <p className="mt-3 text-xs text-ink/45">
                        {card.topic ?? ''}{card.unit ? ` · Unit ${card.unit}` : ''}
                      </p>
                    ) : null}
                    <p className="mt-6 text-sm text-ink/45">Nhấn để lật nghĩa & câu mẫu</p>
                  </>
                )}
              </Card>
            </button>

            {card.kind === 'CATALOG' ? (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant={isSaved ? 'paper' : 'ghost'}
                  disabled={saveToNotebook.isPending || isSaved}
                  onClick={() => void handleSaveCard()}
                  className="text-xs"
                >
                  {isSaved ? (
                    <>
                      <BookmarkCheck className="size-4 text-olive" /> Đã lưu vào Sổ tay cá nhân
                    </>
                  ) : (
                    <>
                      <Bookmark className="size-4 text-gold-deep" /> Lưu từ này vào Sổ tay cá nhân
                    </>
                  )}
                </Button>
              </div>
            ) : null}
          </div>

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
          <p className="mt-2 text-sm text-ink/60">
            {deck === 'notebook'
              ? 'Từ chưa có nghĩa hoặc không khớp bộ lọc sẽ không hiện. Hãy kiểm tra lại trong sổ tay.'
              : 'Bạn có thể lấy thêm từ mới hoặc chơi Mini-game để ôn phản xạ.'}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Button
              onClick={() => {
                void query.refetch().then((result) => setCards(result.data?.cards ?? []))
              }}
            >
              Lấy thêm thẻ
            </Button>
            <Link to={gameHref}>
              <Button variant="paper">
                <Gamepad2 className="size-4" /> Chơi game ôn từ
              </Button>
            </Link>
          </div>
        </Card>
      )}
    </div>
  )
}

function tab(active: boolean) {
  return active ? 'rounded-full bg-button px-4 py-2 text-sm font-semibold text-button-ink' : 'rounded-full bg-paper-2 px-4 py-2 text-sm font-semibold text-ink'
}
