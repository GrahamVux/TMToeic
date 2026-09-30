/** Dev probe: list/save the JPEGs inside a PDF, or stitched pages. `npm run import:pdf -w @toeic/api -- "<file.pdf>" [outDir] [maxSaved] [--pages]` */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { extractPdfJpegs } from '../importer/pdf-images'
import { groupStripsIntoPages, stitchPage } from '../importer/pdf-pages'

const args = process.argv.slice(2)
const pagesMode = args.includes('--pages')
const [file, outDir, maxArg] = args.filter((a) => !a.startsWith('--'))
const pdf = readFileSync(resolve(file))
const t0 = Date.now()
const images = extractPdfJpegs(pdf)
console.log(`${images.length} JPEGs in ${((Date.now() - t0) / 1000).toFixed(1)}s (${(pdf.length / 1e6).toFixed(0)} MB pdf)`)

async function main() {
  if (pagesMode) {
    const pages = groupStripsIntoPages(images)
    console.log(`${pages.length} pages; strips per page: ${pages.map((p) => p.length).join(',')}`)
    if (outDir) {
      mkdirSync(resolve(outDir), { recursive: true })
      for (const [i, strips] of pages.slice(0, Number(maxArg ?? 20)).entries()) {
        const page = await stitchPage(strips)
        writeFileSync(join(resolve(outDir), `page-${String(i + 1).padStart(2, '0')}.jpg`), page.data)
        console.log(`page ${i + 1}: ${page.width}x${page.height}`)
      }
    }
    return
  }
  for (const i of images.slice(0, 40)) console.log(`#${i.index}  ${i.width}x${i.height}  ${(i.data.length / 1e3).toFixed(0)} KB`)
  if (outDir) {
    mkdirSync(resolve(outDir), { recursive: true })
    for (const i of images.slice(0, Number(maxArg ?? 12))) writeFileSync(join(resolve(outDir), `img-${String(i.index).padStart(3, '0')}.jpg`), i.data)
  }
}
void main()
