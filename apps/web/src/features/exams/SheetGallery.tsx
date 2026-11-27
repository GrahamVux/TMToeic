import type { SheetImageDto } from '@toeic/shared'
import { useState } from 'react'
import { Card } from '@/components/ui/Primitives'
import { ZoomableImage } from './ZoomableImage'

/** Scanned exam pages. Embedded pages sit inside the question frame; otherwise they get their own card. */
export function SheetGallery({ images, embedded = false, fit = 'frame' }: { images: SheetImageDto[]; embedded?: boolean; fit?: 'frame' | 'listening' }) {
  const [index, setIndex] = useState(0)
  if (images.length === 0) return null
  const current = images[Math.min(index, images.length - 1)]
  const body = (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">Ảnh đề</p>
        {images.length > 1 ? (
          <div className="flex items-center gap-2 text-sm">
            <button
              type="button"
              className="min-h-10 rounded-full bg-paper px-3.5 py-1 font-semibold transition hover:bg-paper-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-button/50"
              onClick={() => setIndex((i) => (i - 1 + images.length) % images.length)}
            >
              Trước
            </button>
            <span className="text-ink-soft tabular-nums">
              {Math.min(index, images.length - 1) + 1}/{images.length}
            </span>
            <button
              type="button"
              className="min-h-10 rounded-full bg-paper px-3.5 py-1 font-semibold transition hover:bg-paper-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-button/50"
              onClick={() => setIndex((i) => (i + 1) % images.length)}
            >
              Sau
            </button>
          </div>
        ) : null}
      </div>
      <div className="mt-3">
        <ZoomableImage src={current.url} alt={`Ảnh đề ${Math.min(index, images.length - 1) + 1}`} fit={fit} />
      </div>
    </>
  )
  if (embedded) return <div className="mb-4 min-w-0">{body}</div>
  return <Card className="min-w-0 p-4">{body}</Card>
}
