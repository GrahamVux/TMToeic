import { Inject, Injectable } from '@nestjs/common'
import {
  grammarLessonSchema,
  grammarProgressSchema,
  reviewCardSchema,
  saveNotebookSchema,
  singleEnglishWord,
  updateNotebookSchema,
  type FlashcardDeckDto,
  type FlashcardDto,
  type GrammarLessonDto,
  type NotebookEntryDto,
  type NotebookListDto,
  type SaveNotebookResult,
  type StudyOverviewDto,
  type VocabEntryDto,
  type VocabImportResult,
  type VocabListDto,
} from '@toeic/shared'
import { and, asc, eq, ilike, isNull, lte, or, sql } from 'drizzle-orm'
import { AuditService } from '../audit/audit.service'
import { AppException } from '../common/app-exception'
import { parse } from '../common/zod'
import { DB, type Db } from '../db/database.module'
import { cardReviews, grammarLessonFiles, grammarLessons, grammarProgress, notebookEntries, vocabEntries } from '../db/schema'
import { readVocabSheet, vocabTemplate, VocabSheetError } from './vocab-sheet'

type Actor = { id: string; ip?: string }
const MAX_XLSX_BYTES = 8 * 1024 * 1024
const MAX_PDF_BYTES = 15 * 1024 * 1024

function schedule(previous: { intervalDays: number; repetitions: number } | undefined, result: 'AGAIN' | 'GOOD') {
  if (result === 'AGAIN') return { intervalDays: 0, repetitions: 0, dueAt: new Date() }
  const repetitions = (previous?.repetitions ?? 0) + 1
  const intervalDays = repetitions === 1 ? 1 : repetitions === 2 ? 3 : Math.min(60, Math.max(1, (previous?.intervalDays || 1) * 2))
  return { intervalDays, repetitions, dueAt: new Date(Date.now() + intervalDays * 86_400_000) }
}

@Injectable()
export class StudyService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  async overview(userId: string): Promise<StudyOverviewDto> {
    const [vocabTotal, catalogDue, catalogNew, notebook, grammarTotal, grammarCompleted] = await Promise.all([
      this.count(vocabEntries),
      this.catalogCounts(userId),
      this.catalogNewCount(userId),
      this.notebookSummary(userId),
      this.count(grammarLessons),
      this.completedLessons(userId),
    ])
    return {
      vocabTotal,
      catalogDue,
      catalogNew,
      notebookTotal: notebook.total,
      notebookDue: notebook.dueCount,
      notebookMissingMeaning: notebook.missingMeaning,
      grammarTotal,
      grammarCompleted,
    }
  }

  async listVocab(query: string): Promise<VocabListDto> {
    const q = query.trim().slice(0, 80)
    const where = q
      ? or(ilike(vocabEntries.word, `%${q.replace(/[%_]/g, '')}%`), ilike(vocabEntries.meaning, `%${q.replace(/[%_]/g, '')}%`))
      : undefined
    const [total, items] = await Promise.all([
      this.count(vocabEntries),
      this.db.select().from(vocabEntries).where(where).orderBy(asc(vocabEntries.word)).limit(40),
    ])
    return { total, items: items.map(toVocab) }
  }

  template() {
    return vocabTemplate()
  }

  async importVocab(actor: Actor, raw: unknown): Promise<VocabImportResult> {
    if (!Buffer.isBuffer(raw) || raw.length === 0) throw AppException.badRequest('Hãy chọn một file .xlsx.')
    if (raw.length > MAX_XLSX_BYTES) throw AppException.badRequest('File Excel quá lớn (tối đa 8MB).')
    let parsed: Awaited<ReturnType<typeof readVocabSheet>>
    try {
      parsed = await readVocabSheet(raw)
    } catch (error) {
      if (error instanceof VocabSheetError) throw AppException.badRequest(error.message)
      throw AppException.badRequest('Không đọc được file Excel. Hãy dùng định dạng .xlsx.')
    }
    const existing = await this.db.select({ wordKey: vocabEntries.wordKey, partOfSpeech: vocabEntries.partOfSpeech }).from(vocabEntries)
    const known = new Set(existing.map((row) => `${row.wordKey}\0${row.partOfSpeech.toLowerCase()}`))
    let imported = 0
    let updated = 0
    for (const row of parsed.rows) {
      const key = `${row.word.toLowerCase()}\0${row.partOfSpeech.toLowerCase()}`
      if (known.has(key)) updated++
      else {
        imported++
        known.add(key)
      }
      await this.db
        .insert(vocabEntries)
        .values({
          word: row.word,
          wordKey: row.word.toLowerCase(),
          partOfSpeech: row.partOfSpeech,
          meaning: row.meaning,
          createdBy: actor.id,
        })
        .onConflictDoUpdate({
          target: [vocabEntries.wordKey, vocabEntries.partOfSpeech],
          set: { word: sql`excluded.word`, meaning: sql`excluded.meaning`, updatedAt: new Date() },
        })
    }
    await this.audit.log({
      action: 'VOCAB_IMPORTED',
      actorId: actor.id,
      entityType: 'vocab',
      metadata: { imported, updated, skipped: parsed.skipped },
      ip: actor.ip,
    })
    return { imported, updated, skipped: parsed.skipped }
  }

  async deleteVocab(actor: Actor, id: string) {
    const [row] = await this.db.delete(vocabEntries).where(eq(vocabEntries.id, id)).returning({ id: vocabEntries.id })
    if (!row) throw AppException.notFound('Không tìm thấy từ này.')
    await this.audit.log({ action: 'VOCAB_DELETED', actorId: actor.id, entityType: 'vocab', entityId: id, ip: actor.ip })
    return { ok: true as const }
  }

  async listNotebook(userId: string): Promise<NotebookListDto> {
    const items = await this.notebookRows(userId)
    return {
      total: items.length,
      dueCount: items.filter((item) => item.due).length,
      missingMeaning: items.filter((item) => !item.meaning).length,
      items,
    }
  }

  async saveNotebook(userId: string, body: unknown): Promise<SaveNotebookResult> {
    const input = parse(saveNotebookSchema, body)
    if (input.vocabEntryId) {
      const [vocab] = await this.db.select().from(vocabEntries).where(eq(vocabEntries.id, input.vocabEntryId)).limit(1)
      if (!vocab) throw AppException.notFound('Không tìm thấy từ trong kho.')
      const inserted = await this.insertNotebook(userId, vocab.word, vocab.partOfSpeech, vocab.meaning, 'CATALOG', vocab.id)
      const entries = await this.notebookRows(userId, vocab.word.toLowerCase())
      return { word: vocab.word, alreadySaved: !inserted, entries }
    }
    const word = singleEnglishWord(input.word ?? '')
    if (!word) throw AppException.badRequest('Chỉ thêm được một từ tiếng Anh.')
    const matches = await this.db.select().from(vocabEntries).where(eq(vocabEntries.wordKey, word.toLowerCase()))
    if (matches.length === 0) {
      const inserted = await this.insertNotebook(userId, word, '', '', 'EXAM', null)
      const entries = await this.notebookRows(userId, word.toLowerCase())
      return { word, alreadySaved: !inserted, entries }
    }
    let added = 0
    for (const vocab of matches) {
      if (await this.insertNotebook(userId, vocab.word, vocab.partOfSpeech, vocab.meaning, 'EXAM', vocab.id)) added++
    }
    const entries = await this.notebookRows(userId, word.toLowerCase())
    return { word, alreadySaved: added === 0, entries }
  }

  async updateNotebook(userId: string, id: string, body: unknown): Promise<NotebookEntryDto> {
    const input = parse(updateNotebookSchema, body)
    try {
      const [row] = await this.db
        .update(notebookEntries)
        .set({ partOfSpeech: input.partOfSpeech, meaning: input.meaning, updatedAt: new Date() })
        .where(and(eq(notebookEntries.id, id), eq(notebookEntries.userId, userId)))
        .returning({ id: notebookEntries.id })
      if (!row) throw AppException.notFound('Không tìm thấy từ trong sổ tay.')
    } catch (error) {
      if (error instanceof AppException) throw error
      if (!isUniqueViolation(error)) throw error
      throw AppException.badRequest('Từ này đã có trong sổ tay với loại từ đó.')
    }
    const found = (await this.notebookRows(userId)).find((item) => item.id === id)
    if (!found) throw AppException.notFound('Không tìm thấy từ trong sổ tay.')
    return found
  }

  async deleteNotebook(userId: string, id: string) {
    const [row] = await this.db
      .delete(notebookEntries)
      .where(and(eq(notebookEntries.id, id), eq(notebookEntries.userId, userId)))
      .returning({ id: notebookEntries.id })
    if (!row) throw AppException.notFound('Không tìm thấy từ trong sổ tay.')
    return { ok: true as const }
  }

  async flashcards(userId: string, deck: string): Promise<FlashcardDeckDto> {
    if (deck === 'notebook') return this.notebookDeck(userId)
    return this.catalogDeck(userId)
  }

  async review(userId: string, body: unknown) {
    const input = parse(reviewCardSchema, body)
    if (input.kind === 'CATALOG') {
      const [vocab] = await this.db.select({ id: vocabEntries.id }).from(vocabEntries).where(eq(vocabEntries.id, input.id)).limit(1)
      if (!vocab) throw AppException.notFound('Không tìm thấy thẻ từ vựng.')
      await this.writeReview(userId, { vocabEntryId: input.id }, input.result)
    } else {
      const [note] = await this.db
        .select({ id: notebookEntries.id, meaning: notebookEntries.meaning, partOfSpeech: notebookEntries.partOfSpeech })
        .from(notebookEntries)
        .where(and(eq(notebookEntries.id, input.id), eq(notebookEntries.userId, userId)))
        .limit(1)
      if (!note) throw AppException.notFound('Không tìm thấy thẻ trong sổ tay.')
      if (!note.meaning || !note.partOfSpeech) throw AppException.badRequest('Hãy điền loại từ và nghĩa trước khi ôn thẻ này.')
      await this.writeReview(userId, { notebookEntryId: input.id }, input.result)
    }
    return { ok: true as const }
  }

  async listGrammar(userId: string): Promise<GrammarLessonDto[]> {
    const lessons = await this.lessonRows()
    const done = new Set(
      (await this.db.select({ lessonId: grammarProgress.lessonId }).from(grammarProgress).where(eq(grammarProgress.userId, userId))).map((row) => row.lessonId),
    )
    return lessons.map((lesson) => toLesson(lesson, done.has(lesson.id)))
  }

  async getGrammar(userId: string, id: string): Promise<GrammarLessonDto> {
    const lesson = await this.lessonRow(id)
    if (!lesson) throw AppException.notFound('Không tìm thấy chuyên đề.')
    const [progress] = await this.db
      .select({ lessonId: grammarProgress.lessonId })
      .from(grammarProgress)
      .where(and(eq(grammarProgress.userId, userId), eq(grammarProgress.lessonId, id)))
      .limit(1)
    return toLesson(lesson, Boolean(progress))
  }

  async setGrammarPdf(actor: Actor, id: string, raw: unknown, filename: string): Promise<GrammarLessonDto> {
    if (!(await this.lessonRow(id))) throw AppException.notFound('Không tìm thấy chuyên đề.')
    const body = Buffer.isBuffer(raw) ? raw : null
    if (!body || body.length === 0) throw AppException.badRequest('Thiếu file PDF.')
    if (body.length > MAX_PDF_BYTES) throw AppException.badRequest('File PDF quá lớn (tối đa 15MB).')
    const name = pdfFilename(filename)
    if (!name || !body.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw AppException.badRequest('Chỉ nhận file PDF.')
    await this.db
      .insert(grammarLessonFiles)
      .values({ lessonId: id, filename: name, pdfBytes: body, sizeBytes: body.length })
      .onConflictDoUpdate({
        target: grammarLessonFiles.lessonId,
        set: { filename: name, pdfBytes: body, sizeBytes: body.length, createdAt: new Date() },
      })
    await this.audit.log({ action: 'GRAMMAR_PDF_SET', actorId: actor.id, entityType: 'grammar', entityId: id, metadata: { filename: name, sizeBytes: body.length }, ip: actor.ip })
    return this.getGrammar(actor.id, id)
  }

  async clearGrammarPdf(actor: Actor, id: string) {
    if (!(await this.lessonRow(id))) throw AppException.notFound('Không tìm thấy chuyên đề.')
    const [row] = await this.db.delete(grammarLessonFiles).where(eq(grammarLessonFiles.lessonId, id)).returning({ lessonId: grammarLessonFiles.lessonId })
    if (!row) throw AppException.notFound('Chuyên đề này chưa có file PDF.')
    await this.audit.log({ action: 'GRAMMAR_PDF_CLEARED', actorId: actor.id, entityType: 'grammar', entityId: id, ip: actor.ip })
    return { ok: true as const }
  }

  async readGrammarPdf(id: string) {
    const [row] = await this.db
      .select({ filename: grammarLessonFiles.filename, pdfBytes: grammarLessonFiles.pdfBytes })
      .from(grammarLessonFiles)
      .where(eq(grammarLessonFiles.lessonId, id))
      .limit(1)
    if (!row) throw AppException.notFound('Chuyên đề này chưa có file PDF.')
    return { filename: row.filename, bytes: row.pdfBytes }
  }

  async createGrammar(actor: Actor, body: unknown): Promise<GrammarLessonDto> {
    const input = parse(grammarLessonSchema, body)
    const [lesson] = await this.db
      .insert(grammarLessons)
      .values({ ...input, displayOrder: input.displayOrder ?? 0 })
      .returning()
    await this.audit.log({ action: 'GRAMMAR_CREATED', actorId: actor.id, entityType: 'grammar', entityId: lesson!.id, ip: actor.ip })
    return toLesson({ ...lesson!, filename: null, sizeBytes: null }, false)
  }

  async updateGrammar(actor: Actor, id: string, body: unknown): Promise<GrammarLessonDto> {
    const input = parse(grammarLessonSchema, body)
    const [lesson] = await this.db
      .update(grammarLessons)
      .set({ ...input, displayOrder: input.displayOrder ?? 0, updatedAt: new Date() })
      .where(eq(grammarLessons.id, id))
      .returning()
    if (!lesson) throw AppException.notFound('Không tìm thấy chuyên đề.')
    await this.audit.log({ action: 'GRAMMAR_UPDATED', actorId: actor.id, entityType: 'grammar', entityId: id, ip: actor.ip })
    return this.getGrammar(actor.id, id)
  }

  async deleteGrammar(actor: Actor, id: string) {
    const [row] = await this.db.delete(grammarLessons).where(eq(grammarLessons.id, id)).returning({ id: grammarLessons.id })
    if (!row) throw AppException.notFound('Không tìm thấy chuyên đề.')
    await this.audit.log({ action: 'GRAMMAR_DELETED', actorId: actor.id, entityType: 'grammar', entityId: id, ip: actor.ip })
    return { ok: true as const }
  }

  async setGrammarProgress(userId: string, id: string, body: unknown) {
    const input = parse(grammarProgressSchema, body)
    const [lesson] = await this.db.select({ id: grammarLessons.id }).from(grammarLessons).where(eq(grammarLessons.id, id)).limit(1)
    if (!lesson) throw AppException.notFound('Không tìm thấy chuyên đề.')
    if (input.completed) {
      await this.db.insert(grammarProgress).values({ userId, lessonId: id }).onConflictDoNothing()
    } else {
      await this.db.delete(grammarProgress).where(and(eq(grammarProgress.userId, userId), eq(grammarProgress.lessonId, id)))
    }
    return this.getGrammar(userId, id)
  }

  private async catalogDeck(userId: string): Promise<FlashcardDeckDto> {
    const due = await this.db
      .select({ entry: vocabEntries })
      .from(vocabEntries)
      .innerJoin(cardReviews, and(eq(cardReviews.vocabEntryId, vocabEntries.id), eq(cardReviews.userId, userId)))
      .where(lte(cardReviews.dueAt, new Date()))
      .orderBy(asc(cardReviews.dueAt))
      .limit(20)
    const fresh =
      due.length >= 20
        ? []
        : await this.db
            .select({ entry: vocabEntries })
            .from(vocabEntries)
            .leftJoin(cardReviews, and(eq(cardReviews.vocabEntryId, vocabEntries.id), eq(cardReviews.userId, userId)))
            .where(isNull(cardReviews.id))
            .orderBy(asc(vocabEntries.word))
            .limit(20 - due.length)
    return {
      deck: 'catalog',
      dueCount: await this.catalogCounts(userId),
      newCount: await this.catalogNewCount(userId),
      cards: [...due.map((row) => toCard('CATALOG', row.entry)), ...fresh.map((row) => toCard('CATALOG', row.entry))],
    }
  }

  private async notebookDeck(userId: string): Promise<FlashcardDeckDto> {
    const ready = and(eq(notebookEntries.userId, userId), sql`${notebookEntries.meaning} <> ''`, sql`${notebookEntries.partOfSpeech} <> ''`)
    const due = await this.db
      .select({ entry: notebookEntries })
      .from(notebookEntries)
      .innerJoin(cardReviews, and(eq(cardReviews.notebookEntryId, notebookEntries.id), eq(cardReviews.userId, userId)))
      .where(and(ready, lte(cardReviews.dueAt, new Date())))
      .orderBy(asc(cardReviews.dueAt))
      .limit(20)
    const fresh =
      due.length >= 20
        ? []
        : await this.db
            .select({ entry: notebookEntries })
            .from(notebookEntries)
            .leftJoin(cardReviews, and(eq(cardReviews.notebookEntryId, notebookEntries.id), eq(cardReviews.userId, userId)))
            .where(and(ready, isNull(cardReviews.id)))
            .orderBy(asc(notebookEntries.word))
            .limit(20 - due.length)
    const summary = await this.notebookSummary(userId)
    return {
      deck: 'notebook',
      dueCount: summary.dueCount,
      newCount: summary.newCount,
      cards: [...due.map((row) => toCard('NOTEBOOK', row.entry)), ...fresh.map((row) => toCard('NOTEBOOK', row.entry))],
    }
  }

  private async writeReview(userId: string, target: { vocabEntryId: string } | { notebookEntryId: string }, result: 'AGAIN' | 'GOOD') {
    const where =
      'vocabEntryId' in target
        ? and(eq(cardReviews.userId, userId), eq(cardReviews.vocabEntryId, target.vocabEntryId))
        : and(eq(cardReviews.userId, userId), eq(cardReviews.notebookEntryId, target.notebookEntryId))
    const [current] = await this.db
      .select({ intervalDays: cardReviews.intervalDays, repetitions: cardReviews.repetitions, id: cardReviews.id })
      .from(cardReviews)
      .where(where)
      .limit(1)
    const next = schedule(current, result)
    if (current) {
      await this.db.update(cardReviews).set({ ...next, updatedAt: new Date() }).where(eq(cardReviews.id, current.id))
      return
    }
    await this.db.insert(cardReviews).values({ userId, ...target, ...next })
  }

  private async insertNotebook(userId: string, word: string, partOfSpeech: string, meaning: string, source: 'CATALOG' | 'EXAM', vocabEntryId: string | null) {
    const inserted = await this.db
      .insert(notebookEntries)
      .values({ userId, word, wordKey: word.toLowerCase(), partOfSpeech, meaning, source, vocabEntryId })
      .onConflictDoNothing()
      .returning({ id: notebookEntries.id })
    return inserted.length > 0
  }

  private async notebookRows(userId: string, wordKey?: string): Promise<NotebookEntryDto[]> {
    const rows = await this.db
      .select({ entry: notebookEntries, dueAt: cardReviews.dueAt })
      .from(notebookEntries)
      .leftJoin(cardReviews, and(eq(cardReviews.notebookEntryId, notebookEntries.id), eq(cardReviews.userId, userId)))
      .where(wordKey ? and(eq(notebookEntries.userId, userId), eq(notebookEntries.wordKey, wordKey)) : eq(notebookEntries.userId, userId))
      .orderBy(asc(notebookEntries.word))
    const now = Date.now()
    return rows.map((row) => ({
      id: row.entry.id,
      word: row.entry.word,
      partOfSpeech: row.entry.partOfSpeech || null,
      meaning: row.entry.meaning || null,
      source: row.entry.source as NotebookEntryDto['source'],
      due: Boolean(row.entry.meaning && row.entry.partOfSpeech && (row.dueAt == null || row.dueAt.getTime() <= now)),
      createdAt: row.entry.createdAt.toISOString(),
    }))
  }

  private async notebookSummary(userId: string) {
    const items = await this.notebookRows(userId)
    const ready = items.filter((item) => item.meaning && item.partOfSpeech)
    const reviewed = await this.db
      .select({ id: cardReviews.notebookEntryId })
      .from(cardReviews)
      .where(and(eq(cardReviews.userId, userId), sql`${cardReviews.notebookEntryId} is not null`))
    const reviewedIds = new Set(reviewed.map((row) => row.id))
    return {
      total: items.length,
      dueCount: items.filter((item) => item.due).length,
      missingMeaning: items.filter((item) => !item.meaning || !item.partOfSpeech).length,
      newCount: ready.filter((item) => !reviewedIds.has(item.id)).length,
    }
  }

  private async catalogCounts(userId: string) {
    const [row] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(vocabEntries)
      .innerJoin(cardReviews, and(eq(cardReviews.vocabEntryId, vocabEntries.id), eq(cardReviews.userId, userId)))
      .where(lte(cardReviews.dueAt, new Date()))
    return row?.n ?? 0
  }

  private async catalogNewCount(userId: string) {
    const [row] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(vocabEntries)
      .leftJoin(cardReviews, and(eq(cardReviews.vocabEntryId, vocabEntries.id), eq(cardReviews.userId, userId)))
      .where(isNull(cardReviews.id))
    return row?.n ?? 0
  }

  private async completedLessons(userId: string) {
    const [row] = await this.db.select({ n: sql<number>`count(*)::int` }).from(grammarProgress).where(eq(grammarProgress.userId, userId))
    return row?.n ?? 0
  }

  private lessonRows() {
    return this.db
      .select({
        id: grammarLessons.id,
        title: grammarLessons.title,
        summary: grammarLessons.summary,
        body: grammarLessons.body,
        displayOrder: grammarLessons.displayOrder,
        filename: grammarLessonFiles.filename,
        sizeBytes: grammarLessonFiles.sizeBytes,
      })
      .from(grammarLessons)
      .leftJoin(grammarLessonFiles, eq(grammarLessonFiles.lessonId, grammarLessons.id))
      .orderBy(asc(grammarLessons.displayOrder), asc(grammarLessons.title))
  }

  private async lessonRow(id: string) {
    const [row] = await this.lessonRows().where(eq(grammarLessons.id, id)).limit(1)
    return row
  }

  private async count(table: typeof vocabEntries | typeof grammarLessons) {
    const [row] = await this.db.select({ n: sql<number>`count(*)::int` }).from(table)
    return row?.n ?? 0
  }
}

function isUniqueViolation(error: unknown) {
  let current: unknown = error
  for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth++) {
    if ('code' in current && (current as { code?: string }).code === '23505') return true
    current = 'cause' in current ? (current as { cause?: unknown }).cause : undefined
  }
  return false
}

function toVocab(row: typeof vocabEntries.$inferSelect): VocabEntryDto {
  return { id: row.id, word: row.word, partOfSpeech: row.partOfSpeech, meaning: row.meaning }
}

function toCard(kind: FlashcardDto['kind'], row: { id: string; word: string; partOfSpeech: string; meaning: string }): FlashcardDto {
  return { kind, id: row.id, word: row.word, partOfSpeech: row.partOfSpeech, meaning: row.meaning }
}

function pdfFilename(raw: string) {
  const base = raw.replace(/[/\\]/g, '').replace(/[\u0000-\u001f"]/g, '').trim().slice(0, 120)
  if (!base.toLowerCase().endsWith('.pdf')) return null
  return base
}

function toLesson(
  row: { id: string; title: string; summary: string; body: string; displayOrder: number; filename: string | null; sizeBytes: number | null },
  completed: boolean,
): GrammarLessonDto {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    body: row.body,
    displayOrder: row.displayOrder,
    completed,
    pdf: row.filename && row.sizeBytes != null ? { filename: row.filename, sizeBytes: row.sizeBytes } : null,
  }
}
