/** Part 3 and 4 share one recording across a group, so those questions stay on one screen. */
const GROUPED_LISTENING = new Set(['PART_3', 'PART_4'])

export function listeningScreen(questions: Array<{ partCode: string; groupId: string | null }>, index: number) {
  const current = questions[index]
  if (!current || !GROUPED_LISTENING.has(current.partCode)) return { start: index, end: index }
  if (current.groupId) {
    let start = index
    while (start > 0 && questions[start - 1]?.groupId === current.groupId && questions[start - 1]?.partCode === current.partCode) start--
    let end = index
    while (end < questions.length - 1 && questions[end + 1]?.groupId === current.groupId && questions[end + 1]?.partCode === current.partCode) end++
    return { start, end }
  }
  let runStart = index
  while (runStart > 0 && questions[runStart - 1]?.partCode === current.partCode) runStart--
  const start = runStart + Math.floor((index - runStart) / 3) * 3
  let end = start
  while (end < start + 2 && end < questions.length - 1 && questions[end + 1]?.partCode === current.partCode) end++
  return { start, end }
}

/** One chip per question, except Part 3 and 4, which stay one chip per recording. */
export function answerSheetScreens(questions: Array<{ partCode: string; groupId: string | null }>) {
  const screens: Array<{ start: number; end: number }> = []
  for (let i = 0; i < questions.length;) {
    const span = listeningScreen(questions, i)
    screens.push(span)
    i = span.end + 1
  }
  return screens
}
