import sharp from 'sharp'
import { extractPdfPages } from './pdf-page-images'
import { cutListeningScan } from './listening-scan'
import type { ListeningScanInput } from '@toeic/shared'

function singlePagePdf(jpeg: Buffer, rotate: number): Buffer {
  const chunks: Buffer[] = []
  const offsets = [0]
  const length = () => chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const push = (chunk: Buffer | string) => chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  const add = (chunk: Buffer | string) => {
    offsets.push(length())
    push(chunk)
  }
  push('%PDF-1.4\n')
  add('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')
  add('2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n')
  add(`3 0 obj\n<< /Type /Page /Parent 2 0 R /Rotate ${rotate} /MediaBox [0 0 40 80] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`)
  add(Buffer.concat([
    Buffer.from(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width 40 /Height 80 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`),
    jpeg,
    Buffer.from('\nendstream\nendobj\n'),
  ]))
  add('5 0 obj\n<< /Length 0 >>\nstream\n\nendstream\nendobj\n')
  add('6 0 obj\n<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length 4 >>\nstream\nxxxx\nendstream\nendobj\n')
  const xrefAt = length()
  let xref = 'xref\n0 7\n'
  xref += '0000000000 65535 f \n'
  for (let id = 1; id <= 6; id++) xref += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`
  xref += `trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`
  push(xref)
  return Buffer.concat(chunks)
}

const draft = {
  code: 'YBM-LC-TEST-01',
  title: 'YBM Listening Test 1',
  durationSeconds: 2700,
  pages: [{ page: 1, rotationDegrees: 0 }],
  groups: [],
  questions: [],
  crops: [{ file: 'q001.jpg', page: 1, box: [0, 0, 1000, 500] as [number, number, number, number] }],
} as unknown as ListeningScanInput

describe('Listening PDF page cuts', () => {
  it('ignores an image that no page uses and reads the page rotation', async () => {
    const jpeg = await sharp({ create: { width: 40, height: 80, channels: 3, background: 'red' } }).jpeg().toBuffer()
    const pages = extractPdfPages(singlePagePdf(jpeg, 180))
    expect(pages).toHaveLength(1)
    expect(pages[0]?.rotate).toBe(180)
    expect(pages[0]?.data.equals(jpeg)).toBe(true)
  })

  it('cuts the box from the upright page', async () => {
    const jpeg = await sharp({ create: { width: 40, height: 80, channels: 3, background: 'navy' } }).jpeg().toBuffer()
    const images = await cutListeningScan(singlePagePdf(jpeg, 0), draft)
    const cut = images.get('q001.jpg')
    expect(cut?.[0]).toBe(0xff)
    const meta = await sharp(cut!).metadata()
    expect(meta.width).toBeLessThan(40)
    expect(meta.height).toBeGreaterThan(40)
  })
})
