import type { ReadingMarkDto, SaveReadingMarkInput } from '@toeic/shared'
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useDeleteReadingMark, useReadingMarks, useSaveReadingMark } from './study.queries'

type ReadingMarksApi = {
  examId: string
  marks: ReadingMarkDto[]
  save: (input: SaveReadingMarkInput) => Promise<ReadingMarkDto>
  remove: (id: string) => Promise<unknown>
}

const ReadingMarksContext = createContext<ReadingMarksApi | null>(null)

export function ReadingMarksProvider({ examId, children }: { examId: string; children: ReactNode }) {
  const query = useReadingMarks(examId)
  const save = useSaveReadingMark(examId)
  const remove = useDeleteReadingMark(examId)
  const value = useMemo<ReadingMarksApi>(
    () => ({
      examId,
      marks: query.data ?? [],
      save: (input) => save.mutateAsync(input),
      remove: (id) => remove.mutateAsync(id),
    }),
    [examId, query.data, save, remove],
  )
  return <ReadingMarksContext.Provider value={value}>{children}</ReadingMarksContext.Provider>
}

export function useReadingMarksContext() {
  return useContext(ReadingMarksContext)
}

export type MarkTarget = {
  kind: 'passage' | 'prompt' | 'option'
  id: string
  passageLabel?: string
  optionKey?: string
}
