import type { SheetImageDto } from '@toeic/shared'
import { useState } from 'react'
import { Card } from '@/components/ui/Primitives'
import { ZoomableImage } from './ZoomableImage'

/** Scanned exam pages attached to a homework assignment. */
export function SheetGallery({ images }: { images: SheetImageDto[] }) {
  const [index, setIndex] = useState(0)
  if (images.length === 0) return null
  const current = images[Math.min(index, images.length - 1)]
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">Ảnh đề</p>
        {images.length > 1 ? (
          <div className="flex items-center gap-2 text-sm">
            <button type="button" className="rounded-full bg-paper px-3 py-1 font-semibold" onClick={() => setIndex((i) => (i - 1 + images.length) % images.length)}>
              Trước
            </button>
            <span className="text-ink/55">
              {Math.min(index, images.length - 1) + 1}/{images.length}
            </span>
            <button type="button" className="rounded-full bg-paper px-3 py-1 font-semibold" onClick={() => setIndex((i) => (i + 1) % images.length)}>
              Sau
            </button>
          </div>
        ) : null}
      </div>
      <div className="mt-3">
        <ZoomableImage src={current.url} alt={`Ảnh đề ${Math.min(index, images.length - 1) + 1}`} />
      </div>
    </Card>
  )
}
