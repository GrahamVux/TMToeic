/** One photographed page, in the order a PDF viewer shows. Orphan images that no page uses are left out. */
export type PdfPageImage = { page: number; rotate: 0 | 90 | 180 | 270; data: Buffer }

/**
 * Reads the page tree and returns each page's JPEG. File order is not page order: an updated PDF can
 * keep older images that no longer belong to a page, and Gemini numbers pages the way a viewer does.
 */
export function extractPdfPages(pdf: Buffer): PdfPageImage[] {
  const xref = readXref(pdf)
  const rootOffset = xref.objects.get(xref.rootId)
  if (rootOffset === undefined) return []
  const root = readObject(pdf, rootOffset)
  const pagesId = refId(root.dict, '/Pages')
  if (!pagesId) return []
  const pages: PdfPageImage[] = []
  walk(pdf, xref.objects, pagesId, pages)
  return pages
}

function walk(pdf: Buffer, objects: Map<number, number>, id: number, out: PdfPageImage[]) {
  const offset = objects.get(id)
  if (offset === undefined) return
  const obj = readObject(pdf, offset)
  if (/\/Type\s*\/Pages\b/.test(obj.dict)) {
    for (const child of refIds(obj.dict.match(/\/Kids\s*\[([\s\S]*?)\]/)?.[1] ?? '')) walk(pdf, objects, child, out)
    return
  }
  if (!/\/Type\s*\/Page\b/.test(obj.dict)) return
  const image = pageImage(pdf, objects, obj.dict)
  if (!image) return
  out.push({ page: out.length + 1, rotate: rotation(obj.dict), data: image })
}

function pageImage(pdf: Buffer, objects: Map<number, number>, pageDict: string): Buffer | null {
  let resources = pageDict
  const resourceId = refId(pageDict, '/Resources')
  if (resourceId) {
    const offset = objects.get(resourceId)
    if (offset === undefined) return null
    resources = readObject(pdf, offset).dict
  }
  let xobjects = resources
  const xobjectId = refId(resources, '/XObject')
  if (xobjectId) {
    const offset = objects.get(xobjectId)
    if (offset === undefined) return null
    xobjects = readObject(pdf, offset).dict
  } else {
    xobjects = resources.match(/\/XObject\s*<<([\s\S]*?)>>/)?.[1] ?? ''
  }
  for (const id of refIds(xobjects)) {
    const offset = objects.get(id)
    if (offset === undefined) continue
    const image = readObject(pdf, offset)
    if (/\/Subtype\s*\/Image/.test(image.dict) && /DCTDecode/.test(image.dict) && image.stream) return image.stream
  }
  return null
}

function rotation(dict: string): 0 | 90 | 180 | 270 {
  const value = Number(/\/Rotate\s+(-?\d+)/.exec(dict)?.[1] ?? 0)
  const turn = ((value % 360) + 360) % 360
  return turn === 90 || turn === 180 || turn === 270 ? turn : 0
}

function refId(dict: string, key: string): number | null {
  const match = new RegExp(`${key}\\s+(\\d+)\\s+\\d+\\s+R`).exec(dict)
  return match ? Number(match[1]) : null
}

function refIds(dict: string): number[] {
  return [...dict.matchAll(/(\d+)\s+\d+\s+R/g)].map((match) => Number(match[1]))
}

type Xref = { rootId: number; objects: Map<number, number> }

function readXref(pdf: Buffer): Xref {
  const objects = new Map<number, number>()
  let rootId = 0
  let cursor = startXref(pdf)
  const seen = new Set<number>()
  while (cursor >= 0 && !seen.has(cursor)) {
    seen.add(cursor)
    if (pdf.subarray(cursor, cursor + 4).toString('latin1') !== 'xref') break
    let pos = cursor + 4
    pos = skipSpace(pdf, pos)
    let prev = -1
    while (pos < pdf.length) {
      const head = pdf.subarray(pos, Math.min(pdf.length, pos + 32)).toString('latin1')
      if (head.startsWith('trailer')) {
        const trailer = pdf.subarray(pos, Math.min(pdf.length, pos + 600)).toString('latin1')
        if (!rootId) rootId = Number(/\/Root\s+(\d+)\s+\d+\s+R/.exec(trailer)?.[1] ?? 0)
        prev = Number(/\/Prev\s+(\d+)/.exec(trailer)?.[1] ?? -1)
        break
      }
      const section = /^(\d+)\s+(\d+)/.exec(head)
      if (!section) break
      const first = Number(section[1])
      const count = Number(section[2])
      pos += section[0].length
      pos = skipSpace(pdf, pos)
      for (let i = 0; i < count; i++) {
        const line = pdf.subarray(pos, pos + 20).toString('latin1')
        if (line[17] === 'n' && !objects.has(first + i)) objects.set(first + i, Number(line.slice(0, 10)))
        pos += 20
      }
    }
    cursor = prev
  }
  return { rootId, objects }
}

function startXref(pdf: Buffer): number {
  const marker = Buffer.from('startxref')
  const at = pdf.lastIndexOf(marker)
  if (at < 0) return -1
  const digits = /^(\d+)/.exec(pdf.subarray(at + marker.length, at + marker.length + 30).toString('latin1').trim())
  return digits ? Number(digits[1]) : -1
}

function skipSpace(pdf: Buffer, pos: number): number {
  while (pos < pdf.length && (pdf[pos] === 0x20 || pdf[pos] === 0x0a || pdf[pos] === 0x0d || pdf[pos] === 0x09)) pos++
  return pos
}

function readObject(pdf: Buffer, offset: number): { dict: string; stream: Buffer | null } {
  const obj = pdf.indexOf(Buffer.from('obj'), offset)
  if (obj < 0 || obj - offset > 40) return { dict: '', stream: null }
  let i = skipSpace(pdf, obj + 3)
  if (pdf[i] !== 0x3c || pdf[i + 1] !== 0x3c) return { dict: '', stream: null }
  const dictStart = i
  let depth = 0
  for (; i < pdf.length - 1; i++) {
    if (pdf[i] === 0x3c && pdf[i + 1] === 0x3c) {
      depth++
      i++
      continue
    }
    if (pdf[i] === 0x3e && pdf[i + 1] === 0x3e) {
      depth--
      i += 2
      if (depth === 0) break
    }
  }
  const dict = pdf.subarray(dictStart, i).toString('latin1')
  const look = pdf.subarray(i, Math.min(pdf.length, i + 16)).toString('latin1')
  const streamAt = look.indexOf('stream')
  if (streamAt < 0) return { dict, stream: null }
  let start = i + streamAt + 'stream'.length
  if (pdf[start] === 0x0d) start++
  if (pdf[start] === 0x0a) start++
  const length = Number(/\/Length\s+(\d+)/.exec(dict)?.[1] ?? 0)
  if (!length) return { dict, stream: null }
  return { dict, stream: pdf.subarray(start, start + length) }
}
