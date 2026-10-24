import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export type CornerNoticeState = { id: number; text: string }

const VISIBLE_MS = 5000

let noticeSeq = 0

export function flashNotice(text: string): CornerNoticeState {
  noticeSeq += 1
  return { id: noticeSeq, text }
}

/** Success popup in the top-left corner. Stays about 5 seconds. */
export function CornerNotice({ notice }: { notice: CornerNoticeState | null }) {
  const [shown, setShown] = useState<CornerNoticeState | null>(null)

  useEffect(() => {
    setShown(notice)
    if (!notice) return
    const timer = window.setTimeout(() => {
      setShown((current) => (current?.id === notice.id ? null : current))
    }, VISIBLE_MS)
    return () => window.clearTimeout(timer)
  }, [notice])

  if (!shown) return null
  return createPortal(
    <p
      className="fixed top-4 left-4 z-[80] max-w-sm rounded-2xl border border-[#b7d4c8] bg-white px-4 py-3 text-sm font-medium text-olive shadow-[0_12px_32px_rgba(30,51,60,0.16)]"
      role="status"
    >
      {shown.text}
    </p>,
    document.body,
  )
}
