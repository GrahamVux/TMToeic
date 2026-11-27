import { Badge, Card } from '@/components/ui/Primitives'
import { SelectableText } from '@/features/study/SelectableText'
import { cn } from '@/lib/cn'
import { FILL_QUESTION_TYPE, type GroupDto, type ReviewQuestionDto } from '@toeic/shared'
import { isListeningPart, partName } from './exams.queries'
import { PassageView } from './PassageView'
import { examTextStyle, ZoomableImage } from './ZoomableImage'

export function ReviewQuestionCards({
  questions,
  groups,
  staffView,
  textZoom,
}: {
  questions: ReviewQuestionDto[]
  groups: Map<string, GroupDto>
  staffView: boolean
  textZoom: number
}) {
  const shownGroups = new Set<string>()
  return (
    <div className="grid gap-4">
      {questions.map((q) => {
        const group = q.groupId ? groups.get(q.groupId) : undefined
        const showPassage = group && !shownGroups.has(group.id) && (group.passages.length > 0 || !!group.instructions || !!group.imageUrl)
        if (group) shownGroups.add(group.id)
        const listening = isListeningPart(q.partCode)
        const hasFigure = Boolean((showPassage && group?.imageUrl) || q.imageUrl)
        return (
          <Card key={q.id} className="min-w-0 p-5">
            <div className={listening && hasFigure ? 'grid items-start gap-4 lg:grid-cols-2' : undefined}>
              {hasFigure ? (
                <div className={cn('min-w-0', listening && 'lg:sticky lg:top-4 lg:max-h-[calc(100vh-6rem)] lg:overflow-auto')}>
                  {showPassage && group?.imageUrl ? (
                    <div className="mb-4">
                      <ZoomableImage src={group.imageUrl} alt={listening ? 'Hình của phần nghe' : 'Hình hoặc bảng biểu của đoạn'} fit={listening ? 'listening' : 'frame'} />
                    </div>
                  ) : null}
                  {q.imageUrl ? (
                    <div className="mb-4">
                      <ZoomableImage src={q.imageUrl} alt={`Hình minh họa câu ${q.number}`} fit={listening ? 'listening' : 'frame'} />
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="exam-scale" style={examTextStyle(textZoom)}>
                {showPassage && group ? (
                  <div className="mb-4">
                    <PassageView group={group} showImage={false} />
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-ink-soft">
                    {partName(q.partCode)} • Câu {q.number}
                  </span>
                  {q.isCorrect === true ? <Badge tone="olive">Đúng</Badge> : q.isCorrect === false ? <Badge tone="danger">Sai</Badge> : <Badge tone="paper">Chưa làm</Badge>}
                </div>
                {q.type === FILL_QUESTION_TYPE ? (
                  <div className="exam-copy mt-3 space-y-2 select-text cursor-text">
                    <p className="font-medium">{q.prompt}</p>
                    <p>
                      Đã điền: <strong>{q.answerText || '—'}</strong>
                    </p>
                    <p>
                      Đáp án: <strong>{q.correctText}</strong>
                    </p>
                  </div>
                ) : (
                  <>
                    {q.prompt ? (
                      <SelectableText
                        className="mt-2 max-w-[68ch] text-lg leading-8 font-medium"
                        text={q.prompt}
                        markTarget={listening ? undefined : { kind: 'prompt', id: q.id }}
                      />
                    ) : null}
                    <ul className="mt-3 grid gap-2">
                      {q.options.map((o) => {
                        const isCorrect = o.key === q.correctKey
                        const isPicked = o.key === q.selectedKey
                        return (
                          <li
                            key={o.key}
                            className={cn(
                              'rounded-xl border px-4 py-2.5 text-sm',
                              isCorrect ? 'border-success/40 bg-success-soft text-ink' : isPicked ? 'border-danger/40 bg-danger-soft text-ink' : 'border-ink/12',
                            )}
                          >
                            <span className="mr-2 font-bold">{o.key}.</span>
                            {listening || !o.text ? o.text : <SelectableText as="span" text={o.text} markTarget={{ kind: 'option', id: q.id, optionKey: o.key }} />}
                            {isCorrect ? <span className="ml-2 text-xs font-semibold text-success">Đáp án đúng</span> : null}
                            {isPicked && !isCorrect ? (
                              <span className="ml-2 text-xs font-semibold text-danger">{staffView ? 'Học viên chọn' : 'Bạn chọn'}</span>
                            ) : null}
                          </li>
                        )
                      })}
                    </ul>
                  </>
                )}
                {q.explanation ? (
                  <div className="mt-4 max-w-[68ch] rounded-xl border border-warn/25 bg-warn-soft p-3.5 text-sm text-ink">
                    <p className="text-xs font-semibold tracking-wide text-warn uppercase">Giải thích</p>
                    <p className="mt-1 select-text cursor-text leading-[1.7] whitespace-pre-line text-ink">{q.explanation}</p>
                  </div>
                ) : null}
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
