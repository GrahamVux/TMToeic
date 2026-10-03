import { SelectableText } from '@/features/study/SelectableText'
import type { GroupDto } from '@toeic/shared'
import { ZoomableImage } from './ZoomableImage'

/** Shared stimulus for a question group (Part 3/4 script, Part 6 text, Part 7 single/double/triple passage). */
export function PassageView({ group }: { group: GroupDto }) {
  return (
    <div className="space-y-3">
      {group.instructions ? <p className="text-xs font-semibold text-gold-deep">{group.instructions}</p> : null}
      {group.imageUrl ? <ZoomableImage src={group.imageUrl} alt="Hình/bảng biểu của nhóm câu hỏi" /> : null}
      {group.passages.map((p) => (
        <article key={p.label} className="rounded-2xl border border-ink/10 bg-white p-4">
          <p className="text-[11px] font-semibold tracking-wide text-ink/45 uppercase">
            {group.passages.length > 1 ? `Văn bản ${p.label}` : 'Văn bản'}
            {p.title ? ` • ${p.title}` : ''}
          </p>
          <SelectableText className="mt-2 text-sm leading-7 whitespace-pre-line text-ink/85" text={p.content} />
        </article>
      ))}
    </div>
  )
}
