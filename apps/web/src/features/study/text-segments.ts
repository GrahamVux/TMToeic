export type SegmentMark = { start: number; end: number }

/** Splits source text into plain runs and the marks that cover them. Overlaps keep the earlier mark. */
export function textSegments<T extends SegmentMark>(text: string, marks: T[]): Array<{ text: string; mark: T | null }> {
  const usable = marks
    .filter((mark) => mark.start >= 0 && mark.end > mark.start && mark.end <= text.length)
    .sort((a, b) => a.start - b.start || a.end - b.end)
  const segments: Array<{ text: string; mark: T | null }> = []
  let cursor = 0
  for (const mark of usable) {
    if (mark.start < cursor) continue
    if (mark.start > cursor) segments.push({ text: text.slice(cursor, mark.start), mark: null })
    segments.push({ text: text.slice(mark.start, mark.end), mark })
    cursor = mark.end
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), mark: null })
  return segments
}
