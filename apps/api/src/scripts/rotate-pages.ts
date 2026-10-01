import { readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import sharp from 'sharp'

async function main() {
  const dir = resolve(process.argv[2])
  const only = process.argv.slice(3).map(Number).filter(Number.isInteger)
  const files = readdirSync(dir).filter((f) => /^page-\d+\.jpg$/.test(f)).sort()
  const pick = only.length ? files.filter((f) => only.includes(Number(f.slice(5, 8)))) : files
  for (const f of pick) {
    const data = await sharp(join(dir, f)).rotate(180).jpeg({ quality: 85 }).toBuffer()
    writeFileSync(join(dir, f.replace('page-', 'rot-')), data)
    console.log(f)
  }
}
void main()
