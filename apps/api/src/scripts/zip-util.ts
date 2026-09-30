import type { Readable } from 'node:stream'
import yauzl from 'yauzl'

export function openZip(path: string): Promise<yauzl.ZipFile> {
  return new Promise((res, rej) => yauzl.open(path, { lazyEntries: true, autoClose: false }, (e, z) => (e ? rej(e) : res(z))))
}

export function readAllEntries(zip: yauzl.ZipFile): Promise<yauzl.Entry[]> {
  return new Promise((res, rej) => {
    const all: yauzl.Entry[] = []
    zip.on('entry', (e: yauzl.Entry) => {
      all.push(e)
      zip.readEntry()
    })
    zip.on('end', () => res(all))
    zip.on('error', rej)
    zip.readEntry()
  })
}

export function openEntry(zip: yauzl.ZipFile, entry: yauzl.Entry): Promise<Readable> {
  return new Promise((res, rej) => zip.openReadStream(entry, (e, s) => (e ? rej(e) : res(s))))
}

export async function entryBuffer(zip: yauzl.ZipFile, entry: yauzl.Entry): Promise<Buffer> {
  const stream = await openEntry(zip, entry)
  const chunks: Buffer[] = []
  for await (const c of stream) chunks.push(c as Buffer)
  return Buffer.concat(chunks)
}

/** Files inside an in-memory zip (used for .docx, which is a zip). */
export async function unzipBuffer(data: Buffer): Promise<Array<{ name: string; data: Buffer }>> {
  const zip = await new Promise<yauzl.ZipFile>((res, rej) => yauzl.fromBuffer(data, { lazyEntries: true }, (e, z) => (e ? rej(e) : res(z))))
  const entries = await readAllEntries(zip)
  const out: Array<{ name: string; data: Buffer }> = []
  for (const e of entries) {
    if (e.fileName.endsWith('/')) continue
    out.push({ name: e.fileName, data: await entryBuffer(zip, e) })
  }
  zip.close()
  return out
}
