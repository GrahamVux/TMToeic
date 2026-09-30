/**
 * Extracts JPEG images embedded in a PDF (scanned pages are stored as DCTDecode streams). No rendering, no native deps.
 * Order = order of appearance in the file, which for these scans follows the page order.
 */
export type PdfImage = { index: number; width: number; height: number; data: Buffer; colorSpace: string | null }

const DCT = Buffer.from('DCTDecode')
const STREAM = Buffer.from('stream')
const ENDSTREAM = Buffer.from('endstream')
const OBJ = Buffer.from(' obj')

function intAfter(dict: string, key: string): number | null {
  const m = new RegExp(`/${key}\\s+(\\d+)(?!\\s+\\d+\\s+R)`).exec(dict)
  return m ? Number(m[1]) : null
}

export function extractPdfJpegs(pdf: Buffer, opts: { minWidth?: number; minHeight?: number } = {}): PdfImage[] {
  const out: PdfImage[] = []
  let from = 0
  for (;;) {
    const hit = pdf.indexOf(DCT, from)
    if (hit === -1) break
    from = hit + DCT.length

    const objStart = pdf.lastIndexOf(OBJ, hit)
    const streamKw = pdf.indexOf(STREAM, hit)
    if (objStart === -1 || streamKw === -1 || streamKw - objStart > 4000) continue
    const dict = pdf.subarray(objStart, streamKw).toString('latin1')
    if (!/\/Subtype\s*\/Image/.test(dict)) continue

    let dataStart = streamKw + STREAM.length
    if (pdf[dataStart] === 0x0d) dataStart++
    if (pdf[dataStart] === 0x0a) dataStart++
    const end = pdf.indexOf(ENDSTREAM, dataStart)
    if (end === -1) continue
    let dataEnd = end
    while (dataEnd > dataStart && (pdf[dataEnd - 1] === 0x0a || pdf[dataEnd - 1] === 0x0d)) dataEnd--
    const data = pdf.subarray(dataStart, dataEnd)
    if (data[0] !== 0xff || data[1] !== 0xd8) continue // not a JPEG after all

    const width = intAfter(dict, 'Width') ?? 0
    const height = intAfter(dict, 'Height') ?? 0
    if (width < (opts.minWidth ?? 0) || height < (opts.minHeight ?? 0)) continue
    out.push({ index: out.length, width, height, data: Buffer.from(data), colorSpace: /\/ColorSpace\s*\/(\w+)/.exec(dict)?.[1] ?? null })
    from = dataEnd
  }
  return out
}
