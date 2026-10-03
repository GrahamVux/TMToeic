import { Inject, Injectable } from '@nestjs/common'
import type { AudioTrackDto, SetExamAudioInput } from '@toeic/shared'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { AuditService } from '../audit/audit.service'
import { AppException } from '../common/app-exception'
import type { AuthUser } from '../common/decorators'
import { DB, type Db } from '../db/database.module'
import { assets, examParts, exams, parts, skills } from '../db/schema'
import { StorageService } from '../storage/storage.service'

/** Signed URLs outlive the longest exam (2h) plus slack; the player refreshes them if a long untimed session outlasts this. */
export const AUDIO_URL_TTL_SECONDS = 3 * 60 * 60

type Actor = Pick<AuthUser, 'id' | 'role'> & { ip?: string }

export type PlannedTrack = { assetId: string; partCodes: string[] }
export type AudioPartInfo = { code: string; skill: string; audioAssetId: string | null }

/**
 * Decides which recording plays for which parts of an attempt. Pure, so it is unit-tested.
 * - A part's own recording always wins (split recordings; a Parts 1+2 file is attached to both rows and merges into one track).
 * - The full-length recording is offered only when the attempt covers *every* Listening part: a single file cannot be
 *   cut into parts, so drilling Part 3 alone with only a full-length file would mean scrubbing a 45-minute recording.
 */
export function planAudioTracks(input: { examAssetId: string | null; examParts: AudioPartInfo[]; scopeCodes: string[] }): PlannedTrack[] {
  const listening = input.examParts.filter((p) => p.skill === 'LISTENING')
  const scoped = listening.filter((p) => input.scopeCodes.includes(p.code))
  const fullScope = scoped.length > 0 && scoped.length === listening.length

  const byAsset = new Map<string, string[]>()
  for (const p of scoped) {
    const asset = p.audioAssetId ?? (fullScope ? input.examAssetId : null)
    if (!asset) continue
    byAsset.set(asset, [...(byAsset.get(asset) ?? []), p.code])
  }
  return [...byAsset.entries()].map(([assetId, partCodes]) => ({ assetId, partCodes }))
}

/** ["PART_1","PART_2","PART_3","PART_4"] → "Part 1–4"; ["PART_1","PART_3"] → "Part 1, 3". */
export function partsLabel(codes: string[]): string {
  const nums = codes.map((c) => Number(c.replace(/\D/g, ''))).filter(Number.isFinite).sort((a, b) => a - b)
  if (nums.length === 0) return 'Audio'
  if (nums.length === 1) return `Part ${nums[0]}`
  const contiguous = nums.every((n, i) => i === 0 || n === nums[i - 1] + 1)
  return contiguous ? `Part ${nums[0]}–${nums[nums.length - 1]}` : `Part ${nums.join(', ')}`
}

@Injectable()
export class ExamAudioService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Signed tracks for an attempt scope; empty when storage is not configured or no audio is attached.
   * `assignmentAudioId` is the homework's own file: it plays for every Listening part in the attempt, even a single part.
   */
  async tracksFor(examId: string, scopeCodes: string[], assignmentAudioId?: string | null): Promise<AudioTrackDto[]> {
    if (!this.storage.enabled) return []
    const [exam] = await this.db.select({ audioAssetId: exams.audioAssetId }).from(exams).where(eq(exams.id, examId)).limit(1)
    const eps = await this.db
      .select({ code: parts.code, skill: skills.code, audioAssetId: examParts.audioAssetId })
      .from(examParts)
      .innerJoin(parts, eq(parts.id, examParts.partId))
      .innerJoin(skills, eq(skills.id, parts.skillId))
      .where(eq(examParts.examId, examId))
      .orderBy(asc(examParts.displayOrder))

    if (assignmentAudioId) {
      const listening = eps.filter((p) => p.skill === 'LISTENING' && scopeCodes.includes(p.code)).map((p) => p.code)
      return this.oneTrack(assignmentAudioId, listening)
    }

    const plan = planAudioTracks({ examAssetId: exam?.audioAssetId ?? null, examParts: eps, scopeCodes })
    if (plan.length === 0) return []

    const rows = await this.db.select().from(assets).where(inArray(assets.id, plan.map((p) => p.assetId)))
    const byId = new Map(rows.map((r) => [r.id, r]))
    const expiresAt = new Date(Date.now() + AUDIO_URL_TTL_SECONDS * 1000).toISOString()

    const tracks: AudioTrackDto[] = []
    for (const p of plan) {
      const asset = byId.get(p.assetId)
      if (!asset) continue
      tracks.push({
        id: asset.id,
        label: partsLabel(p.partCodes),
        partCodes: p.partCodes,
        url: await this.storage.signedGetUrl(asset.objectKey, AUDIO_URL_TTL_SECONDS, asset.bucket),
        expiresAt,
      })
    }
    return tracks
  }

  private async oneTrack(assetId: string, partCodes: string[]): Promise<AudioTrackDto[]> {
    if (partCodes.length === 0) return []
    const [asset] = await this.db.select().from(assets).where(eq(assets.id, assetId)).limit(1)
    if (!asset?.mimeType?.startsWith('audio/')) return []
    const expiresAt = new Date(Date.now() + AUDIO_URL_TTL_SECONDS * 1000).toISOString()
    return [
      {
        id: asset.id,
        label: partsLabel(partCodes),
        partCodes,
        url: await this.storage.signedGetUrl(asset.objectKey, AUDIO_URL_TTL_SECONDS, asset.bucket),
        expiresAt,
      },
    ]
  }

  /** Signed URLs for picture assets (question photos, group figures, homework pages). Empty map when storage is not configured. */
  async signedImageUrls(assetIds: string[]): Promise<Map<string, string>> {
    const ids = [...new Set(assetIds)]
    const out = new Map<string, string>()
    if (!this.storage.enabled || ids.length === 0) return out
    const rows = await this.db.select().from(assets).where(inArray(assets.id, ids))
    for (const a of rows) out.set(a.id, await this.storage.signedGetUrl(a.objectKey, AUDIO_URL_TTL_SECONDS, a.bucket))
    return out
  }

  /** Staff: attach/detach a recording. Audio does not affect scoring, so this is allowed on any exam status. */
  async setAudio(actor: Actor, examId: string, input: SetExamAudioInput) {
    const [exam] = await this.db.select({ id: exams.id }).from(exams).where(eq(exams.id, examId)).limit(1)
    if (!exam) throw AppException.notFound('Không tìm thấy đề thi')

    if (input.assetId) {
      const [asset] = await this.db.select({ mimeType: assets.mimeType }).from(assets).where(eq(assets.id, input.assetId)).limit(1)
      if (!asset) throw AppException.badRequest('Không tìm thấy file audio')
      if (!asset.mimeType?.startsWith('audio/')) throw AppException.badRequest('File được chọn không phải audio')
    }

    if (input.partCode) {
      const [ep] = await this.db
        .select({ id: examParts.id, skill: skills.code })
        .from(examParts)
        .innerJoin(parts, eq(parts.id, examParts.partId))
        .innerJoin(skills, eq(skills.id, parts.skillId))
        .where(and(eq(examParts.examId, examId), eq(parts.code, input.partCode)))
        .limit(1)
      if (!ep) throw AppException.badRequest(`Đề không có ${input.partCode}`)
      if (ep.skill !== 'LISTENING') throw AppException.badRequest('Chỉ part Listening mới có audio')
      await this.db.update(examParts).set({ audioAssetId: input.assetId }).where(eq(examParts.id, ep.id))
    } else {
      await this.db.update(exams).set({ audioAssetId: input.assetId, updatedAt: new Date() }).where(eq(exams.id, examId))
    }

    await this.audit.log({
      action: 'EXAM_AUDIO_SET',
      actorId: actor.id,
      entityType: 'exam',
      entityId: examId,
      metadata: { assetId: input.assetId, partCode: input.partCode ?? null },
      ip: actor.ip,
    })
    return { ok: true as const }
  }

  /**
   * Staff uploads a recording. Bytes go to object storage, an asset row is created, then the same attach rules as setAudio apply.
   * Omit `partCode` for the full Listening recording of the exam.
   */
  async uploadFile(actor: Actor, examId: string, raw: unknown, contentType: string, filename: string, partCode?: string) {
    if (!this.storage.enabled) throw AppException.badRequest('Chưa cấu hình kho file. Không lưu được audio.')
    const body = Buffer.isBuffer(raw) ? raw : null
    if (!body || body.length === 0) throw AppException.badRequest('Thiếu file nghe.')
    if (body.length > MAX_AUDIO_BYTES) throw AppException.badRequest('File nghe quá lớn (tối đa 80MB).')

    const mime = audioMime(contentType, filename)
    if (!mime) throw AppException.badRequest('Chỉ nhận file mp3, m4a hoặc wav.')

    const [exam] = await this.db.select({ id: exams.id }).from(exams).where(eq(exams.id, examId)).limit(1)
    if (!exam) throw AppException.notFound('Không tìm thấy đề thi')

    const rows = await this.db
      .select({ code: parts.code, skill: skills.code })
      .from(examParts)
      .innerJoin(parts, eq(parts.id, examParts.partId))
      .innerJoin(skills, eq(skills.id, parts.skillId))
      .where(eq(examParts.examId, examId))
    if (!rows.some((r) => r.skill === 'LISTENING')) throw AppException.badRequest('Chỉ đề Listening mới gắn được file nghe.')
    if (partCode) {
      const part = rows.find((r) => r.code === partCode)
      if (!part) throw AppException.badRequest(`Đề không có ${partCode}`)
      if (part.skill !== 'LISTENING') throw AppException.badRequest('Chỉ part Listening mới có audio')
    }

    const ext = mime === 'audio/mpeg' ? 'mp3' : mime === 'audio/mp4' ? 'm4a' : mime === 'audio/wav' ? 'wav' : 'webm'
    const objectKey = `authored/${examId}/audio/${partCode ?? 'full'}-${Date.now()}.${ext}`
    const original = filename.replace(/[/\\]/g, '').slice(0, 120) || `audio.${ext}`
    try {
      await this.storage.putObject(objectKey, body, mime)
    } catch {
      throw AppException.badRequest('Không lưu được file nghe. Kiểm tra cấu hình kho file.')
    }

    const [asset] = await this.db
      .insert(assets)
      .values({
        provider: 'CLOUDFLARE_R2',
        bucket: this.storage.bucket,
        objectKey,
        mimeType: mime,
        sizeBytes: body.length,
        originalFilename: original,
      })
      .returning({ id: assets.id })
    if (!asset) throw AppException.badRequest('Không lưu được file nghe.')
    return this.setAudio(actor, examId, { assetId: asset.id, ...(partCode ? { partCode } : {}) })
  }
}

const MAX_AUDIO_BYTES = 80 * 1024 * 1024

/** Accept common browser MIME labels and fall back to the filename when the browser sends a generic type. */
function audioMime(contentType: string, filename: string): string | null {
  const mime = contentType.split(';')[0]?.trim().toLowerCase() ?? ''
  if (mime === 'audio/mpeg' || mime === 'audio/mp3') return 'audio/mpeg'
  if (mime === 'audio/mp4' || mime === 'audio/m4a' || mime === 'audio/x-m4a') return 'audio/mp4'
  if (mime === 'audio/wav' || mime === 'audio/wave' || mime === 'audio/x-wav') return 'audio/wav'
  if (mime === 'audio/webm') return 'audio/webm'
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'mp3') return 'audio/mpeg'
  if (ext === 'm4a' || ext === 'mp4') return 'audio/mp4'
  if (ext === 'wav') return 'audio/wav'
  if (ext === 'webm') return 'audio/webm'
  return null
}
