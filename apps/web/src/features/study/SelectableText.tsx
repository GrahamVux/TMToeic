import { ApiError } from '@/lib/api'
import { singleEnglishWord } from '@toeic/shared'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { notebookSavedMessage, useSaveNotebookWord } from './study.queries'

/** Lets a student highlight one English word and save it to their notebook. */
export function SelectableText({ text, className, as = 'p' }: { text: string; className?: string; as?: 'p' | 'h2' }) {
  const ref = useRef<HTMLParagraphElement | HTMLHeadingElement>(null)
  const save = useSaveNotebookWord()
  const [chip, setChip] = useState<{ word: string; top: number; left: number } | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2800)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    function hide() {
      setChip(null)
    }
    window.addEventListener('scroll', hide, true)
    return () => window.removeEventListener('scroll', hide, true)
  }, [])

  function onSelect() {
    const selection = window.getSelection()
    const node = ref.current
    if (!selection || selection.isCollapsed || !node || !node.contains(selection.anchorNode) || !node.contains(selection.focusNode)) {
      setChip(null)
      return
    }
    const word = singleEnglishWord(selection.toString())
    if (!word || selection.rangeCount === 0) {
      setChip(null)
      return
    }
    const rect = selection.getRangeAt(0).getBoundingClientRect()
    setChip({ word, top: rect.bottom + 8, left: Math.min(rect.left, window.innerWidth - 220) })
  }

  async function add(word: string) {
    setChip(null)
    window.getSelection()?.removeAllRanges()
    try {
      const result = await save.mutateAsync({ word })
      setToast(notebookSavedMessage(result))
    } catch (error) {
      setToast(error instanceof ApiError ? error.message : 'Không thêm được vào sổ tay.')
    }
  }

  const Tag = as
  return (
    <>
      <Tag ref={ref} className={className} onMouseUp={onSelect} onTouchEnd={onSelect}>
        {text}
      </Tag>
      {chip
        ? createPortal(
            <button
              type="button"
              className="fixed z-[80] rounded-full bg-gold-deep px-3 py-1.5 text-sm font-semibold text-white shadow-lg"
              style={{ top: chip.top, left: Math.max(8, chip.left) }}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => void add(chip.word)}
            >
              Thêm “{chip.word}” vào sổ tay
            </button>,
            document.body,
          )
        : null}
      {toast
        ? createPortal(
            <p className="fixed bottom-20 left-1/2 z-[80] max-w-sm -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-center text-sm text-white shadow-lg" role="status">
              {toast}
            </p>,
            document.body,
          )
        : null}
    </>
  )
}
