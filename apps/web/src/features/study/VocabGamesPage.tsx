import { Button } from '@/components/ui/Button'
import { Card, ProgressBar } from '@/components/ui/Primitives'
import { PageLoading } from '@/components/ui/LoadingScreen'
import { cn } from '@/lib/cn'
import { NOTEBOOK_CARD_COLORS, UNASSIGNED_VOCAB_SET, VOCAB_GAME_DAILY_XP_CAP, type NotebookCardColor, type VocabGameKind } from '@toeic/shared'
import { Award, CheckCircle2, Flame, Gamepad2, HelpCircle, Keyboard, Layers, RotateCcw, Sparkles, Timer, Zap } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { VocabNav } from './VocabCourse'
import { useCompleteVocabGame, useNotebook, useVocabCourse, useVocabGameStatus, useVocabUnitDetail } from './study.queries'

type GameWord = {
  kind: 'CATALOG' | 'NOTEBOOK'
  id: string
  word: string
  partOfSpeech: string
  meaning: string
  example: string
}

type ReviewOutcome = { kind: 'CATALOG' | 'NOTEBOOK'; id: string; result: 'AGAIN' | 'GOOD' }

function shuffle<T>(list: readonly T[]): T[] {
  const arr = [...list]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
  }
  return arr
}

function maskWordInSentence(sentence: string, word: string): string {
  if (!sentence.trim()) return ''
  const escaped = word.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (!escaped) return sentence
  const re = new RegExp(`\\b${escaped}[a-z]*\\b`, 'gi')
  return sentence.replace(re, '_____')
}

export function VocabGamesPage() {
  const [params] = useSearchParams()
  const initialSource = params.get('source') === 'notebook' ? 'notebook' : 'catalog'
  const initialSet = params.get('set') ?? ''
  const initialUnit = Number(params.get('unit')) || 1
  const initialTopic = params.get('topic') ?? ''
  const initialColor = (NOTEBOOK_CARD_COLORS as readonly string[]).includes(params.get('color') ?? '')
    ? (params.get('color') as NotebookCardColor)
    : 'all'

  const [source, setSource] = useState<'catalog' | 'notebook'>(initialSource)
  const [setId, setSetId] = useState(initialSet)
  const [unit, setUnit] = useState(initialUnit)
  const [nbTopic, setNbTopic] = useState(initialTopic)
  const [nbColor, setNbColor] = useState<NotebookCardColor | 'all'>(initialColor)
  const [gameKind, setGameKind] = useState<VocabGameKind>('MATCH')
  const [sessionId, setSessionId] = useState(1)

  const course = useVocabCourse()
  const notebook = useNotebook()
  const status = useVocabGameStatus()
  const complete = useCompleteVocabGame()

  const sets = (course.data?.sets ?? []).filter((s) => s.id !== UNASSIGNED_VOCAB_SET)
  const selectedSet = sets.find((s) => s.id === setId) ?? sets[0]

  useEffect(() => {
    if (selectedSet && !selectedSet.units.some((u) => u.index === unit)) {
      setUnit(selectedSet.units[0]?.index ?? 1)
    }
  }, [selectedSet, unit])

  const unitDetail = useVocabUnitDetail(selectedSet?.id ?? '', unit, source === 'catalog' && Boolean(selectedSet))

  const [lastResult, setLastResult] = useState<{ score: number; total: number; xpAwarded: number } | null>(null)

  const deckWords: GameWord[] = useMemo(() => {
    if (source === 'catalog') {
      return (unitDetail.data?.items ?? []).map((w) => ({
        kind: 'CATALOG',
        id: w.id,
        word: w.word,
        partOfSpeech: w.partOfSpeech,
        meaning: w.meaning,
        example: w.example,
      }))
    }
    return (notebook.data?.items ?? [])
      .filter((n) => n.meaning && n.partOfSpeech)
      .filter((n) => !nbTopic || n.topic === nbTopic)
      .filter((n) => nbColor === 'all' || n.color === nbColor)
      .map((n) => ({
        kind: 'NOTEBOOK',
        id: n.id,
        word: n.word,
        partOfSpeech: n.partOfSpeech ?? '',
        meaning: n.meaning ?? '',
        example: n.example ?? '',
      }))
  }, [source, unitDetail.data?.items, notebook.data?.items, nbTopic, nbColor])

  const deckLabel =
    source === 'catalog'
      ? `${selectedSet?.title ?? 'Kho từ'} · Unit ${unit}`
      : `Sổ tay${nbTopic ? ` · ${nbTopic}` : ''}`

  const nbTopics = [...new Set((notebook.data?.items ?? []).map((i) => i.topic.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'))

  if (course.isPending || notebook.isPending) return <PageLoading message="Đang chuẩn bị phòng chơi từ vựng…" />

  function finishSession(kind: VocabGameKind, score: number, totalItems: number, reviewedCards: ReviewOutcome[]) {
    void complete
      .mutateAsync({ gameKind: kind, deckLabel, score, totalItems, reviewedCards })
      .then((res) => setLastResult({ score, total: totalItems, xpAwarded: res.xpAwarded }))
  }

  function restart(nextKind?: VocabGameKind) {
    if (nextKind) setGameKind(nextKind)
    setLastResult(null)
    setSessionId((s) => s + 1)
  }

  const todayXp = status.data?.todayGameXp ?? 0
  const capPct = Math.min(100, Math.round((todayXp / VOCAB_GAME_DAILY_XP_CAP) * 100))

  return (
    <div className="space-y-6">
      <VocabNav current="games" />

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.18em] text-gold-deep uppercase">Học tập qua trò chơi</p>
          <h1 className="serif mt-2 text-3xl sm:text-4xl">Đấu trường Từ vựng TOEIC</h1>
          <p className="mt-1.5 text-sm text-ink/60">
            Chơi ghép cặp, phản xạ 4 đáp án hoặc chính tả để ghi nhớ từ vựng và nhận tối đa {VOCAB_GAME_DAILY_XP_CAP} EXP/ngày cho Bảng xếp hạng.
          </p>
        </div>

        <Card className="min-w-[230px] px-4 py-3">
          <div className="flex items-center justify-between gap-3 text-xs font-semibold">
            <span className="inline-flex items-center gap-1.5 text-gold-deep">
              <Zap className="size-4 text-amber-500" /> EXP Game hôm nay
            </span>
            <span className="tabular-nums text-ink">{todayXp} / {VOCAB_GAME_DAILY_XP_CAP} EXP</span>
          </div>
          <ProgressBar className="mt-2" value={capPct} />
        </Card>
      </header>

      {/* Deck + Mode Picker */}
      <Card className="p-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => { setSource('catalog'); restart() }}
                className={cn('rounded-full px-4 py-1.5 text-xs font-semibold', source === 'catalog' ? 'bg-button text-button-ink' : 'bg-paper-2 text-ink/75')}
              >
                <Layers className="mr-1 inline size-3.5" /> Bộ từ & Unit có sẵn
              </button>
              <button
                type="button"
                onClick={() => { setSource('notebook'); restart() }}
                className={cn('rounded-full px-4 py-1.5 text-xs font-semibold', source === 'notebook' ? 'bg-button text-button-ink' : 'bg-paper-2 text-ink/75')}
              >
                <Sparkles className="mr-1 inline size-3.5" /> Sổ tay cá nhân
              </button>
            </div>

            {source === 'catalog' ? (
              <div className="flex flex-wrap gap-2.5">
                <select
                  className="h-9 rounded-xl border border-gold/35 bg-white px-3 text-xs font-semibold"
                  value={selectedSet?.id ?? ''}
                  onChange={(e) => { setSetId(e.target.value); setLastResult(null); setSessionId((s) => s + 1) }}
                >
                  {sets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title} ({s.topic})
                    </option>
                  ))}
                </select>
                <div className="flex flex-wrap gap-1.5">
                  {(selectedSet?.units ?? []).map((u) => (
                    <button
                      key={u.index}
                      type="button"
                      onClick={() => { setUnit(u.index); setLastResult(null); setSessionId((s) => s + 1) }}
                      className={cn('rounded-full px-3 py-1 text-xs font-semibold', unit === u.index ? 'bg-ink text-white' : 'bg-paper-2 text-ink/70')}
                    >
                      Unit {u.index} ({u.wordCount})
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2.5">
                <select
                  className="h-9 rounded-xl border border-gold/35 bg-white px-3 text-xs font-semibold"
                  value={nbTopic}
                  onChange={(e) => { setNbTopic(e.target.value); setLastResult(null); setSessionId((s) => s + 1) }}
                >
                  <option value="">Tất cả chủ đề</option>
                  {nbTopics.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <select
                  className="h-9 rounded-xl border border-gold/35 bg-white px-3 text-xs font-semibold"
                  value={nbColor}
                  onChange={(e) => { setNbColor(e.target.value as NotebookCardColor | 'all'); setLastResult(null); setSessionId((s) => s + 1) }}
                >
                  <option value="all">Tất cả màu ô</option>
                  <option value="rose">Đỏ — Hay quên</option>
                  <option value="amber">Vàng — Cần chú ý</option>
                  <option value="emerald">Xanh lá — Đã thuộc</option>
                  <option value="sky">Xanh dương — Từ bẫy</option>
                  <option value="violet">Tím — Cụm từ</option>
                  <option value="default">Mặc định</option>
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ['MATCH', 'Ghép cặp', Gamepad2],
                ['QUIZ', 'Đấu trí 4 đáp án', HelpCircle],
                ['SPELL', 'Gõ chính tả', Keyboard],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => restart(id)}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 rounded-2xl border px-3 py-2.5 text-xs font-semibold transition',
                  gameKind === id ? 'border-button bg-button text-button-ink shadow-xs' : 'border-gold/30 bg-paper text-ink/75 hover:border-gold-deep',
                )}
              >
                <Icon className="size-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </Card>

      {source === 'catalog' && unitDetail.isPending ? (
        <PageLoading message="Đang nạp bộ từ cho trò chơi…" />
      ) : deckWords.length < 4 ? (
        <Card className="p-8 text-center">
          <h2 className="serif text-2xl">Cần ít nhất 4 từ có đủ nghĩa</h2>
          <p className="mt-2 text-sm text-ink/60">
            Bộ lọc “{deckLabel}” hiện chỉ có {deckWords.length} từ đủ nghĩa & loại từ. Hãy chọn Unit khác hoặc bổ sung nghĩa trong Sổ tay cá nhân.
          </p>
        </Card>
      ) : lastResult ? (
        <Card className="mx-auto max-w-xl p-8 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-teal-soft text-gold-deep">
            <Award className="size-7" />
          </div>
          <h2 className="serif mt-4 text-3xl text-ink">Hoàn thành ván chơi!</h2>
          <p className="mt-2 text-sm text-ink/65">
            Bộ từ: <strong>{deckLabel}</strong> • Đạt <strong>{lastResult.score}/{lastResult.total}</strong> điểm chính xác
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-2 text-sm font-bold text-amber-800 border border-amber-200">
            <Sparkles className="size-4 text-amber-500" />
            {lastResult.xpAwarded > 0
              ? `+${lastResult.xpAwarded} EXP đã cộng vào Bảng xếp hạng`
              : `Bạn đã đạt trần ${VOCAB_GAME_DAILY_XP_CAP} EXP/ngày (tiến độ SRS vẫn được ghi nhận)`}
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button onClick={() => restart()}>
              <RotateCcw className="size-4" /> Chơi ván mới
            </Button>
            <Button variant="paper" onClick={() => restart(gameKind === 'MATCH' ? 'QUIZ' : gameKind === 'QUIZ' ? 'SPELL' : 'MATCH')}>
              Đổi trò chơi khác
            </Button>
          </div>
        </Card>
      ) : gameKind === 'MATCH' ? (
        <MatchGameBoard key={`match-${sessionId}-${deckLabel}`} words={deckWords} onFinish={(score, total, reviews) => finishSession('MATCH', score, total, reviews)} />
      ) : gameKind === 'QUIZ' ? (
        <QuizGameBoard key={`quiz-${sessionId}-${deckLabel}`} words={deckWords} onFinish={(score, total, reviews) => finishSession('QUIZ', score, total, reviews)} />
      ) : (
        <SpellGameBoard key={`spell-${sessionId}-${deckLabel}`} words={deckWords} onFinish={(score, total, reviews) => finishSession('SPELL', score, total, reviews)} />
      )}
    </div>
  )
}

function MatchGameBoard({
  words,
  onFinish,
}: {
  words: GameWord[]
  onFinish: (score: number, total: number, reviews: ReviewOutcome[]) => void
}) {
  const sample = useMemo(() => shuffle(words).slice(0, Math.min(6, words.length)), [words])
  const [leftItems] = useState(() => shuffle(sample))
  const [rightItems] = useState(() => shuffle(sample))
  const [pickedWord, setPickedWord] = useState<string | null>(null)
  const [pickedMeaning, setPickedMeaning] = useState<string | null>(null)
  const [matched, setMatched] = useState<Set<string>>(() => new Set())
  const [missedIds, setMissedIds] = useState<Set<string>>(() => new Set())
  const [combo, setCombo] = useState(0)
  const [wrongFlash, setWrongFlash] = useState(false)
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => window.clearInterval(id)
  }, [])

  function tryMatch(wId: string | null, mId: string | null) {
    if (!wId || !mId) return
    if (wId === mId) {
      const next = new Set(matched)
      next.add(wId)
      setMatched(next)
      setCombo((c) => c + 1)
      setPickedWord(null)
      setPickedMeaning(null)
      if (next.size === sample.length) {
        const reviews: ReviewOutcome[] = sample.map((item) => ({
          kind: item.kind,
          id: item.id,
          result: missedIds.has(item.id) ? 'AGAIN' : 'GOOD',
        }))
        const cleanCount = sample.filter((item) => !missedIds.has(item.id)).length
        onFinish(cleanCount, sample.length, reviews)
      }
    } else {
      setCombo(0)
      setMissedIds((prev) => new Set(prev).add(wId))
      setWrongFlash(true)
      window.setTimeout(() => {
        setWrongFlash(false)
        setPickedWord(null)
        setPickedMeaning(null)
      }, 360)
    }
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gold/25 pb-3">
        <p className="text-sm font-semibold">Ghép {sample.length} cặp Từ vựng — Nghĩa đúng</p>
        <div className="flex items-center gap-3 text-xs font-bold">
          <span className="inline-flex items-center gap-1 text-orange-600">
            <Flame className="size-3.5" /> Combo x{combo}
          </span>
          <span className="inline-flex items-center gap-1 tabular-nums text-gold-deep">
            <Timer className="size-3.5" /> {seconds}s
          </span>
          <span>{matched.size}/{sample.length} cặp</span>
        </div>
      </div>

      <div className={cn('mt-4 grid gap-4 md:grid-cols-2 transition', wrongFlash && 'animate-pulse')}>
        <div className="space-y-2">
          <p className="text-xs font-bold text-ink/50 uppercase">Từ tiếng Anh</p>
          {leftItems.map((item) => {
            const done = matched.has(item.id)
            const active = pickedWord === item.id
            return (
              <button
                key={item.id}
                type="button"
                disabled={done}
                onClick={() => {
                  setPickedWord(item.id)
                  tryMatch(item.id, pickedMeaning)
                }}
                className={cn(
                  'flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition',
                  done
                    ? 'border-emerald-200 bg-emerald-50/70 text-emerald-700 opacity-60'
                    : active
                      ? 'border-button bg-button text-button-ink shadow-xs'
                      : 'border-gold/30 bg-paper hover:border-button/70',
                )}
              >
                <span className="font-bold">{item.word}</span>
                <span className="text-xs opacity-75">{item.partOfSpeech}</span>
              </button>
            )
          })}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-bold text-ink/50 uppercase">Nghĩa tiếng Việt</p>
          {rightItems.map((item) => {
            const done = matched.has(item.id)
            const active = pickedMeaning === item.id
            return (
              <button
                key={item.id}
                type="button"
                disabled={done}
                onClick={() => {
                  setPickedMeaning(item.id)
                  tryMatch(pickedWord, item.id)
                }}
                className={cn(
                  'flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition',
                  done
                    ? 'border-emerald-200 bg-emerald-50/70 text-emerald-700 opacity-60'
                    : active
                      ? 'border-button bg-button text-button-ink shadow-xs'
                      : 'border-gold/30 bg-paper hover:border-button/70',
                )}
              >
                <span className="line-clamp-2 font-medium">{item.meaning}</span>
                {done ? <CheckCircle2 className="size-4 shrink-0" /> : null}
              </button>
            )
          })}
        </div>
      </div>
    </Card>
  )
}

function QuizGameBoard({
  words,
  onFinish,
}: {
  words: GameWord[]
  onFinish: (score: number, total: number, reviews: ReviewOutcome[]) => void
}) {
  const questions = useMemo(() => {
    const picked = shuffle(words).slice(0, Math.min(10, words.length))
    return picked.map((target) => {
      const distractors = shuffle(words.filter((w) => w.id !== target.id)).slice(0, 3)
      const options = shuffle([target, ...distractors])
      return { target, options }
    })
  }, [words])

  const [idx, setIdx] = useState(0)
  const [chosenId, setChosenId] = useState<string | null>(null)
  const [reviews, setReviews] = useState<ReviewOutcome[]>([])
  const [score, setScore] = useState(0)
  const current = questions[idx]!

  function choose(optionId: string) {
    if (chosenId) return
    setChosenId(optionId)
    const correct = optionId === current.target.id
    const nextScore = correct ? score + 1 : score
    const nextReviews: ReviewOutcome[] = [...reviews, { kind: current.target.kind, id: current.target.id, result: correct ? 'GOOD' : 'AGAIN' }]
    setScore(nextScore)
    setReviews(nextReviews)

    window.setTimeout(() => {
      if (idx + 1 >= questions.length) {
        onFinish(nextScore, questions.length, nextReviews)
      } else {
        setIdx((i) => i + 1)
        setChosenId(null)
      }
    }, 650)
  }

  return (
    <Card className="mx-auto max-w-2xl p-6">
      <div className="flex items-center justify-between text-xs font-semibold text-ink/60">
        <span>Câu {idx + 1} / {questions.length}</span>
        <span className="text-gold-deep">Đúng: {score}</span>
      </div>
      <ProgressBar className="mt-2" value={Math.round(((idx + 1) / questions.length) * 100)} />

      <div className="mt-6 text-center">
        <p className="text-xs font-bold tracking-widest text-gold-deep uppercase">{current.target.partOfSpeech}</p>
        <h2 className="serif mt-2 text-4xl text-ink">{current.target.word}</h2>
        {current.target.example ? (
          <p className="mt-2 text-xs italic text-ink/55">“{maskWordInSentence(current.target.example, current.target.word)}”</p>
        ) : null}
      </div>

      <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
        {current.options.map((opt, i) => {
          const picked = chosenId === opt.id
          const isTarget = opt.id === current.target.id
          return (
            <button
              key={opt.id}
              type="button"
              disabled={Boolean(chosenId)}
              onClick={() => choose(opt.id)}
              className={cn(
                'flex items-start gap-2.5 rounded-2xl border p-4 text-left text-sm font-medium transition',
                chosenId
                  ? isTarget
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-900'
                    : picked
                      ? 'border-rose-400 bg-rose-50 text-rose-900'
                      : 'border-gold/25 bg-paper opacity-60'
                  : 'border-gold/35 bg-paper hover:border-button',
              )}
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-gold-deep">
                {i + 1}
              </span>
              <span>{opt.meaning}</span>
            </button>
          )
        })}
      </div>
    </Card>
  )
}

function SpellGameBoard({
  words,
  onFinish,
}: {
  words: GameWord[]
  onFinish: (score: number, total: number, reviews: ReviewOutcome[]) => void
}) {
  const queue = useMemo(() => shuffle(words).slice(0, Math.min(8, words.length)), [words])
  const [idx, setIdx] = useState(0)
  const [typed, setTyped] = useState('')
  const [hintLevel, setHintLevel] = useState(0)
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [score, setScore] = useState(0)
  const [reviews, setReviews] = useState<ReviewOutcome[]>([])

  const current = queue[idx]!
  const targetClean = current.word.trim()

  function checkAnswer(e: React.FormEvent) {
    e.preventDefault()
    if (feedback) return
    const ok = typed.trim().toLowerCase() === targetClean.toLowerCase()
    setFeedback(ok ? 'correct' : 'wrong')
    const nextScore = ok ? score + 1 : score
    const nextReviews: ReviewOutcome[] = [...reviews, { kind: current.kind, id: current.id, result: ok ? 'GOOD' : 'AGAIN' }]
    setScore(nextScore)
    setReviews(nextReviews)

    window.setTimeout(() => {
      if (idx + 1 >= queue.length) {
        onFinish(nextScore, queue.length, nextReviews)
      } else {
        setIdx((i) => i + 1)
        setTyped('')
        setHintLevel(0)
        setFeedback(null)
      }
    }, 950)
  }

  return (
    <Card className="mx-auto max-w-xl p-6">
      <div className="flex items-center justify-between text-xs font-semibold text-ink/60">
        <span>Chính tả {idx + 1} / {queue.length}</span>
        <span className="text-gold-deep">Đúng: {score}</span>
      </div>
      <ProgressBar className="mt-2" value={Math.round(((idx + 1) / queue.length) * 100)} />

      <div className="mt-6 rounded-2xl bg-paper p-5 text-center">
        <p className="text-xs font-bold tracking-wider text-gold-deep uppercase">{current.partOfSpeech}</p>
        <h2 className="serif mt-2 text-2xl text-ink">{current.meaning}</h2>
        {current.example ? (
          <p className="mt-3 text-sm italic text-ink/65">“{maskWordInSentence(current.example, targetClean)}”</p>
        ) : null}
        {hintLevel > 0 ? (
          <p className="mt-3 font-mono text-sm font-bold tracking-widest text-olive">
            Gợi ý: {targetClean.slice(0, Math.min(targetClean.length, hintLevel * 2))}
            {'_'.repeat(Math.max(0, targetClean.length - hintLevel * 2))} ({targetClean.length} ký tự)
          </p>
        ) : null}
      </div>

      <form onSubmit={checkAnswer} className="mt-5 space-y-3">
        <input
          autoFocus
          value={typed}
          disabled={Boolean(feedback)}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="Gõ chính xác từ tiếng Anh…"
          className={cn(
            'h-12 w-full rounded-2xl border-2 px-4 text-center text-lg font-bold outline-none',
            feedback === 'correct'
              ? 'border-emerald-400 bg-emerald-50 text-emerald-900'
              : feedback === 'wrong'
                ? 'border-rose-400 bg-rose-50 text-rose-900'
                : 'border-gold/45 bg-white focus:border-button',
          )}
        />
        {feedback === 'wrong' ? (
          <p className="text-center text-sm font-semibold text-rose-700">
            Đáp án đúng: <span className="underline">{targetClean}</span>
          </p>
        ) : null}
        <div className="flex flex-wrap justify-between gap-2">
          <Button type="button" variant="paper" disabled={Boolean(feedback) || hintLevel >= 3} onClick={() => setHintLevel((h) => h + 1)}>
            Gợi ý chữ cái
          </Button>
          <Button type="submit" disabled={Boolean(feedback) || !typed.trim()}>
            Kiểm tra
          </Button>
        </div>
      </form>
    </Card>
  )
}
