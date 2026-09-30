/** The reviewable output of an import: plain JSON + cropped images on disk. Nothing touches the database until `import:create`. */

export type DraftOption = { key: 'A' | 'B' | 'C' | 'D'; text: string }

export type DraftQuestion = {
  number: number
  partCode: string
  prompt: string
  options: DraftOption[]
  /** Correct answer from the published key; null when the key has no (legible) entry. */
  answer: 'A' | 'B' | 'C' | 'D' | null
  groupKey?: string
  /** File name (inside the draft folder) of the question's picture, e.g. a Part 1 photograph. */
  imageFile?: string
}

export type DraftGroup = {
  key: string
  partCode: string
  instructions: string
  /** File name of a shared figure (chart, table, sign…). */
  imageFile?: string
}

export type Draft = {
  schemaVersion: 1
  source: { collection: string; testNo: number; models: string[]; generatedAt: string }
  exam: { code: string; title: string; durationSeconds: number; parts: Array<{ partCode: string; questionStart: number; questionEnd: number }> }
  groups: DraftGroup[]
  questions: DraftQuestion[]
  /** Things a human should look at before publishing. Empty = every automatic check passed. */
  warnings: string[]
}

/** Listening layout of the 2018 TOEIC format. */
export const LISTENING_LAYOUT = [
  { partCode: 'PART_1', questionStart: 1, questionEnd: 6 },
  { partCode: 'PART_2', questionStart: 7, questionEnd: 31 },
  { partCode: 'PART_3', questionStart: 32, questionEnd: 70 },
  { partCode: 'PART_4', questionStart: 71, questionEnd: 100 },
] as const

export function partOfQuestion(n: number): string | null {
  return LISTENING_LAYOUT.find((p) => n >= p.questionStart && n <= p.questionEnd)?.partCode ?? null
}

/** Options a real answer sheet offers: Part 2 has three (A–C), every other part four. */
export function optionKeysFor(partCode: string): Array<'A' | 'B' | 'C' | 'D'> {
  return partCode === 'PART_2' ? ['A', 'B', 'C'] : ['A', 'B', 'C', 'D']
}
