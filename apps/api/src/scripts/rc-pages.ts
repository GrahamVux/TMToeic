/** Extract the RC book from the zip and stitch pages. */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { extractPdfJpegs } from '../importer/pdf-images'
import { groupStripsIntoPages, stitchPage } from '../importer/pdf-pages'
import { entryBuffer, openZip, readAllEntries } from './zip-util'

async function main() {
  const zipPath = process.argv[2]
  const outDir = resolve(process.argv[3] ?? 'content/drafts/ets-2018/_rc-pages')
  mkdirSync(outDir, { recursive: true })
  const zip = await openZip(zipPath)
  const entries = await readAllEntries(zip)
  const rc = entries.find((e) => /new economy toeic rc 1000\.pdf/i.test(e.fileName))
  if (!rc) throw new Error('RC book not found in zip')
  console.log(`reading ${rc.fileName} (${(rc.uncompressedSize / 1e6).toFixed(0)} MB)…`)
  const pdf = await entryBuffer(zip, rc)
  zip.close()
  const images = extractPdfJpegs(pdf)
  console.log(`${images.length} JPEGs`)
  const sizes = new Map<string, number>()
  for (const i of images) {
    const k = `${i.width}x${i.height}`
    sizes.set(k, (sizes.get(k) ?? 0) + 1)
  }
  console.log('size histogram:')
  for (const [k, n] of [...sizes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`  ${k}  x${n}`)

  const groups = groupStripsIntoPages(images)
  console.log(`${groups.length} page groups; strips: ${groups.slice(0, 20).map((g) => g.length).join(',')}…`)
  const max = Number(process.argv[4] ?? groups.length)
  for (const [i, strips] of groups.slice(0, max).entries()) {
    const page = await stitchPage(strips)
    writeFileSync(join(outDir, `page-${String(i + 1).padStart(3, '0')}.jpg`), page.data)
    console.log(`page ${i + 1}: ${page.width}x${page.height} ${(page.data.length / 1e3).toFixed(0)}KB  strips=${strips.length}`)
  }
}
void main()
