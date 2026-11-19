import { Injectable } from '@nestjs/common'
import { listeningScanSchema, type ExamSummaryDto, type ImportAuthoredExamInput, type ListeningScanInput } from '@toeic/shared'
import { AssetPushError, AssetStoreService } from '../storage/asset-store.service'
import { AppException } from '../common/app-exception'
import type { AuthUser } from '../common/decorators'
import { parse } from '../common/zod'
import { cutListeningScan, previewListeningPages } from '../importer/listening-scan'
import { ExamsService } from './exams.service'

type Actor = Pick<AuthUser, 'id' | 'role'> & { ip?: string }

@Injectable()
export class ListeningScanService {
  constructor(
    private readonly exams: ExamsService,
    private readonly assets: AssetStoreService,
  ) {}

  /** Cuts the PDF and returns the JPEGs. Nothing is written to the exam bank. */
  async previewPackage(body: Buffer): Promise<{ images: Record<string, string>; pages: string[] }> {
    const images = await this.cut(body)
    const encoded: Record<string, string> = {}
    for (const [file, bytes] of images) encoded[file] = bytes.toString('base64')
    const pages = await previewListeningPages(unpack(body).pdf)
    return { images: encoded, pages: pages.map((page) => page.toString('base64')) }
  }

  async importPackage(actor: Actor, body: Buffer): Promise<ExamSummaryDto> {
    const { draft } = unpack(body)
    const images = await this.cut(body)

    if (images.size && !this.assets.enabled) {
      throw AppException.badRequest('Chưa cấu hình Cloudflare để lưu ảnh cắt từ PDF. Kiểm tra các biến R2 trên API.')
    }
    const stored = new Map<string, string>()
    try {
      let sequence = 0
      for (const [file, bytes] of images) {
        const id = await this.assets.store({
          objectKey: `exams/scans/${draft.code}/${Date.now()}-${sequence++}-${file.replace(/[^A-Za-z0-9._-]/g, '')}`,
          body: bytes,
          mimeType: 'image/jpeg',
          originalFilename: file,
          uploadedBy: actor.id,
        })
        stored.set(file, id)
      }
    } catch (err) {
      await this.assets.discard([...stored.values()]).catch(() => undefined)
      if (err instanceof AssetPushError) throw AppException.badRequest('Không đẩy được ảnh cắt lên Cloudflare. Đề không được giữ lại.')
      throw err
    }

    const examInput = toExam(draft, stored)
    const publish = examInput.publish
    let created: ExamSummaryDto
    try {
      created = await this.exams.importAuthored(actor, { ...examInput, publish: false })
    } catch (err) {
      await this.assets.discard([...stored.values()]).catch(() => undefined)
      throw err
    }
    if (!publish) return created
    try {
      return await this.exams.publish(actor, created.id)
    } catch {
      return created
    }
  }

  private async cut(body: Buffer): Promise<Map<string, Buffer>> {
    const { draft, pdf } = unpack(body)
    if (draft.continued) {
      throw AppException.badRequest(`File JSON dừng ở câu ${draft.nextNumber ?? ''}. Hãy bảo Gemini trả tiếp, ghép đủ câu, rồi nộp lại.`.trim())
    }
    let images: Map<string, Buffer>
    try {
      images = await cutListeningScan(pdf, draft)
    } catch (err) {
      throw AppException.badRequest(err instanceof Error ? err.message : 'Không cắt được ảnh trong PDF.')
    }
    for (const question of draft.questions) {
      if (question.imageFile && !images.has(question.imageFile)) throw AppException.badRequest(`Câu ${question.number} trỏ tới ảnh ${question.imageFile} nhưng JSON không có khung cắt đó.`)
    }
    for (const group of draft.groups) {
      if (group.imageFile && !images.has(group.imageFile)) throw AppException.badRequest(`Nhóm ${group.key} trỏ tới ảnh ${group.imageFile} nhưng JSON không có khung cắt đó.`)
    }
    return images
  }
}

function unpack(body: Buffer): { draft: ListeningScanInput; pdf: Buffer } {
  if (!Buffer.isBuffer(body) || body.length < 16) throw AppException.badRequest('Thiếu file JSON hoặc PDF.')
  const jsonLength = body.readUInt32BE(0)
  if (jsonLength < 2 || jsonLength > 2_000_000 || 4 + jsonLength >= body.length) throw AppException.badRequest('Gói nộp không đúng định dạng JSON và PDF.')
  let parsed: unknown
  try {
    parsed = JSON.parse(body.subarray(4, 4 + jsonLength).toString('utf8'))
  } catch {
    throw AppException.badRequest('File JSON không đọc được.')
  }
  const pdf = body.subarray(4 + jsonLength)
  if (!pdf.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw AppException.badRequest('File kèm theo không phải PDF.')
  return { draft: parse(listeningScanSchema, parsed), pdf }
}

function toExam(draft: ListeningScanInput, images: Map<string, string>): ImportAuthoredExamInput {
  const byPart = new Map<string, number[]>()
  for (const question of draft.questions) {
    const numbers = byPart.get(question.partCode) ?? []
    numbers.push(question.number)
    byPart.set(question.partCode, numbers)
  }
  let complete = true
  const parts = [...byPart.entries()]
    .map(([partCode, numbers]) => {
      const questionStart = Math.min(...numbers)
      const questionEnd = Math.max(...numbers)
      if (new Set(numbers).size !== questionEnd - questionStart + 1) complete = false
      return { partCode, questionStart, questionEnd }
    })
    .sort((a, b) => a.questionStart - b.questionStart)

  const questions = draft.questions.map((question) => {
    const options = question.options.map((option) => ({ ...option, correct: question.answer === option.key }))
    if (question.answer && !options.some((option) => option.correct)) complete = false
    if (!question.answer) complete = false
    return {
      number: question.number,
      partCode: question.partCode,
      prompt: question.prompt,
      groupKey: question.groupKey,
      imageAssetId: question.imageFile ? images.get(question.imageFile) : undefined,
      options,
    }
  })

  return {
    code: draft.code,
    title: draft.title,
    source: 'ybm-pdf',
    durationSeconds: draft.durationSeconds,
    difficulty: 'MEDIUM',
    publish: complete,
    parts,
    groups: draft.groups.map((group) => ({
      key: group.key,
      partCode: group.partCode,
      instructions: group.instructions,
      passages: [],
      imageAssetId: group.imageFile ? images.get(group.imageFile) : undefined,
    })),
    questions,
  }
}
