import type { GroupDto } from '@toeic/shared'

/** Shared stimulus for a question group (Part 3/4 script, Part 6 text, Part 7 single/double/triple passage). */
export function PassageView({ group }: { group: GroupDto }) {
  return (
    <div className="space-y-3">
      {group.instructions ? <p className="text-xs font-semibold text-gold-deep">{group.instructions}</p> : null}
      {group.imageUrl ? (
        <img src={group.imageUrl} alt="Hình/bảng biểu của nhóm câu hỏi" loading="lazy" className="max-h-[28rem] w-full rounded-2xl border border-ink/10 bg-white object-contain" />
      ) : null}
      {group.passages.map((p) => (
        <article key={p.label} className="rounded-2xl border border-ink/10 bg-white p-4">
          <p className="text-[11px] font-semibold tracking-wide text-ink/45 uppercase">
            {group.passages.length > 1 ? `Văn bản ${p.label}` : 'Văn bản'}
            {p.title ? ` • ${p.title}` : ''}
          </p>
          <p className="mt-2 text-sm leading-7 whitespace-pre-line text-ink/85">{p.content}</p>
        </article>
      ))}
    </div>
  )
}
