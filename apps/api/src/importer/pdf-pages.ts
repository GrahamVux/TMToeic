import sharp from 'sharp'
import type { PdfImage } from './pdf-images'

/**
 * These scans store each page as a stack of equal-width horizontal JPEG strips; the last strip of a page is a couple of pixels
 * shorter than the others. Group strips into pages by that marker (or a width change), then stitch each page vertically.
 */
export function groupStripsIntoPages(strips: PdfImage[]): PdfImage[][] {
  const pages: PdfImage[][] = []
  let cur: PdfImage[] = []
  const modalHeight = mode(strips.map((s) => s.height))
  for (const s of strips) {
    // Full-page scans (RC book, typeset keys) are already one JPEG per page — do not stack them.
    if (s.height >= s.width * 0.75) {
      if (cur.length) {
        pages.push(cur)
        cur = []
      }
      pages.push([s])
      continue
    }
    if (cur.length && s.width !== cur[0].width) {
      pages.push(cur)
      cur = []
    }
    cur.push(s)
    if (s.height < modalHeight) {
      pages.push(cur)
      cur = []
    }
  }
  if (cur.length) pages.push(cur)
  return pages
}

function mode(values: number[]): number {
  const counts = new Map<number, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0
}

/** One JPEG for the whole page. */
export async function stitchPage(strips: PdfImage[], quality = 85): Promise<{ data: Buffer; width: number; height: number }> {
  const width = Math.max(...strips.map((s) => s.width))
  const height = strips.reduce((sum, s) => sum + s.height, 0)
  let top = 0
  const layers = strips.map((s) => {
    const layer = { input: s.data, left: 0, top }
    top += s.height
    return layer
  })
  const data = await sharp({ create: { width, height, channels: 3, background: '#ffffff' } })
    .composite(layers)
    .jpeg({ quality })
    .toBuffer()
  return { data, width, height }
}
