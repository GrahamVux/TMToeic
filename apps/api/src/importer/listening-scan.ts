import sharp from 'sharp'
import type { ListeningScanInput } from '@toeic/shared'
import { extractPdfPages } from './pdf-page-images'

/**
 * Cuts each box on the PDF page Gemini named, after that page's own /Rotate.
 * The page number comes from Gemini. The box is whatever the editor dragged, or Gemini's box until then.
 */
export async function cutListeningScan(pdf: Buffer, draft: ListeningScanInput): Promise<Map<string, Buffer>> {
  const pages = extractPdfPages(pdf)
  if (!pages.length) throw new Error('PDF không có trang ảnh.')
  const images = new Map<string, Buffer>()
  const uprights = new Map<number, Buffer>()
  const upright = async (index: number) => {
    const cached = uprights.get(index)
    if (cached) return cached
    const page = pages[index]
    if (!page) return null
    const jpeg = page.rotate ? await sharp(page.data).rotate(page.rotate).jpeg({ quality: 90 }).toBuffer() : page.data
    uprights.set(index, jpeg)
    return jpeg
  }

  for (const crop of draft.crops) {
    if (images.has(crop.file)) throw new Error(`Khung cắt ${crop.file} bị khai báo hai lần.`)
    const page = await upright(crop.page - 1)
    if (!page) throw new Error(`Trang ${crop.page} không có trong PDF. File này có ${pages.length} trang.`)
    const cut = await cropBox(page, crop.box)
    if (!cut) throw new Error(`Không cắt được ${crop.file} ở trang ${crop.page}.`)
    images.set(crop.file, cut)
  }
  return images
}

/** Smaller upright pages so an editor can drag a crop box. Coordinates stay on the 0–1000 scale. */
export async function previewListeningPages(pdf: Buffer): Promise<Buffer[]> {
  const pages = extractPdfPages(pdf)
  const previews: Buffer[] = []
  for (const page of pages) {
    const image = page.rotate ? sharp(page.data).rotate(page.rotate) : sharp(page.data)
    previews.push(await image.resize({ width: 800, withoutEnlargement: true }).jpeg({ quality: 72 }).toBuffer())
  }
  return previews
}

async function cropBox(page: Buffer, box: [number, number, number, number]): Promise<Buffer | null> {
  const meta = await sharp(page).metadata()
  const width = meta.width ?? 0
  const height = meta.height ?? 0
  const [ymin, xmin, ymax, xmax] = box.map((value) => Math.min(1000, Math.max(0, value)))
  if (ymax - ymin < 20 || xmax - xmin < 20) return null
  const pad = 8
  const left = Math.max(0, Math.round((xmin / 1000) * width) - pad)
  const top = Math.max(0, Math.round((ymin / 1000) * height) - pad)
  const cropWidth = Math.min(width - left, Math.round(((xmax - xmin) / 1000) * width) + pad * 2)
  const cropHeight = Math.min(height - top, Math.round(((ymax - ymin) / 1000) * height) + pad * 2)
  if (cropWidth < 2 || cropHeight < 2) return null
  const extracted = await sharp(page).extract({ left, top, width: cropWidth, height: cropHeight }).greyscale().raw().toBuffer({ resolveWithObject: true })
  const trimmed = trimDarkEdges(extracted.data, extracted.info.width, extracted.info.height)
  return sharp(page)
    .extract({
      left: left + trimmed.left,
      top: top + trimmed.top,
      width: trimmed.width,
      height: trimmed.height,
    })
    .jpeg({ quality: 88 })
    .toBuffer()
}

/** Drops a finger covering the top or bottom edge. A photographed page is much lighter than that strip. */
function trimDarkEdges(data: Buffer, width: number, height: number): { left: number; top: number; width: number; height: number } {
  const mean = (y: number) => {
    let sum = 0
    for (let x = 0; x < width; x += 2) sum += data[y * width + x]!
    return sum / Math.ceil(width / 2)
  }
  let light = false
  for (let y = 0; y < height; y += 4) {
    if (mean(y) > 80) {
      light = true
      break
    }
  }
  if (!light) return { left: 0, top: 0, width, height }
  const dark = (y: number) => mean(y) < 45
  let top = 0
  let bottom = height
  while (top < bottom - 8 && dark(top)) top += 1
  while (bottom - top > 8 && dark(bottom - 1)) bottom -= 1
  return { left: 0, top, width, height: bottom - top }
}
