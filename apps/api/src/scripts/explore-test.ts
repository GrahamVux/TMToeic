/** Dev probe: what is actually inside one test's PDFs / answer key? `npm run import:explore -w @toeic/api -- "<zip>" 7` */
import { loadDotEnv } from '../config/app-config'
import { generateJson, inlineFile } from '../importer/gemini'
import { loadTestSource } from '../importer/ets-source'

const STR = { type: 'STRING' }
const INT = { type: 'INTEGER' }

async function main() {
  loadDotEnv()
  const apiKey = process.env.AI_API_KEY
  if (!apiKey) throw new Error('AI_API_KEY is not set')
  const model = process.env.AI_MODEL ?? 'gemini-3.8-flash'
  const [zipPath, testArg] = process.argv.slice(2)
  const src = await loadTestSource(zipPath, Number(testArg))

  console.log('Question PDFs:', src.questionPdfs.map((f) => `${f.name} (${(f.data.length / 1e6).toFixed(1)} MB)`))
  console.log('Transcripts  :', src.transcripts.map((f) => f.name))
  console.log('Answer images:', src.answerImages.map((f) => `${f.name} ${f.mimeType} ${(f.data.length / 1e3).toFixed(0)} KB`), ' sheets:', src.answerSheets.map((f) => f.name))

  const pdf = src.questionPdfs[0]
  const inv = await generateJson<{ pages: Array<{ page: number; contents: string; parts: string[]; firstQuestion: number | null; lastQuestion: number | null }> }>({
    apiKey,
    model,
    parts: [
      inlineFile('application/pdf', pdf.data),
      { text: 'This is a scanned TOEIC Listening & Reading test paper. For EVERY page, in order, report: the page number, the TOEIC Part numbers (1-7) whose questions or directions appear on it, the first and last question number printed on it (null if none), and one short sentence on what the page contains (e.g. "Part 5 questions 101-110", "photographs", "cover"). Do not invent anything that is not visible.' },
    ],
    schema: {
      type: 'OBJECT',
      properties: {
        pages: {
          type: 'ARRAY',
          items: { type: 'OBJECT', properties: { page: INT, contents: STR, parts: { type: 'ARRAY', items: INT }, firstQuestion: { type: 'INTEGER', nullable: true }, lastQuestion: { type: 'INTEGER', nullable: true } }, required: ['page', 'contents', 'parts'] },
        },
      },
      required: ['pages'],
    },
  })
  console.log(`\n[${model}] inventory of "${pdf.name}" — tokens in/out/think:`, inv.usage)
  for (const p of inv.data.pages) console.log(`p${String(p.page).padStart(2)}  parts[${p.parts.join(',')}]  Q${p.firstQuestion ?? '-'}..${p.lastQuestion ?? '-'}  ${p.contents}`)

  const key = src.answerImages[0]
  if (key) {
    const ans = await generateJson<{ answers: Array<{ number: number; answer: string }> }>({
      apiKey,
      model,
      parts: [
        inlineFile(key.mimeType, key.data),
        { text: 'This image is an answer key for a 200-question TOEIC test. Transcribe every question number with its correct answer letter (A, B, C or D). Include only what is printed; if a number has no legible answer, omit it.' },
      ],
      schema: { type: 'OBJECT', properties: { answers: { type: 'ARRAY', items: { type: 'OBJECT', properties: { number: INT, answer: STR }, required: ['number', 'answer'] } } }, required: ['answers'] },
    })
    const a = ans.data.answers
    const nums = new Set(a.map((x) => x.number))
    const missing = Array.from({ length: 200 }, (_, i) => i + 1).filter((n) => !nums.has(n))
    console.log(`\nAnswer key: ${a.length} answers, letters=${[...new Set(a.map((x) => x.answer))].join('')}, missing=${missing.length ? missing.join(',') : 'none'}, tokens:`, ans.usage)
    console.log('first 12:', a.slice(0, 12).map((x) => `${x.number}${x.answer}`).join(' '))
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
