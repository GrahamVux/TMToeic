import { SelectableText } from '@/features/study/SelectableText'
import type { GroupDto } from '@toeic/shared'
import { isListeningPart } from './exams.queries'
import { ZoomableImage } from './ZoomableImage'

/** Shared stimulus for a question group (Part 3/4 script, Part 6 text, Part 7 single/double/triple passage). */
export function PassageView({ group, showImage = true }: { group: GroupDto; showImage?: boolean }) {
  return (
    <div className="space-y-3">
      {showImage && group.imageUrl ? <ZoomableImage src={group.imageUrl} alt="Hình/bảng biểu của nhóm câu hỏi" /> : null}
      {group.instructions ? <p className="text-xs font-semibold text-gold-deep">{group.instructions}</p> : null}
      {group.passages.map((p) => (
        <article key={p.label} className="rounded-2xl border border-gold/30 bg-paper/75 p-4 sm:p-5">
          <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
            {group.passages.length > 1 ? `Văn bản ${p.label}` : 'Văn bản'}
            {p.title ? ` • ${p.title}` : ''}
          </p>
          <SelectableText
            className="exam-passage mt-2.5 max-w-[68ch] text-base leading-[1.72] whitespace-pre-line text-ink"
            text={p.content}
            markTarget={isListeningPart(group.partCode) ? undefined : { kind: 'passage', id: group.id, passageLabel: p.label }}
          />
        </article>
      ))}
    </div>
  )
}
