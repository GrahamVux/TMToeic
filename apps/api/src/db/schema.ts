import { sql } from 'drizzle-orm'
import {
  bigint,
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgSequence,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { ASSET_PROVIDERS, ATTEMPT_STATUSES, EXAM_MODES, EXAM_STATUSES, ROLES, SKILLS, USER_STATUSES } from '@toeic/shared'

export const roleEnum = pgEnum('role', ROLES)
export const userStatusEnum = pgEnum('user_status', USER_STATUSES)
export const skillCodeEnum = pgEnum('skill_code', SKILLS)

/** Sequential, human-friendly student codes (TM-1000, TM-1001, ...). */
export const studentCodeSeq = pgSequence('student_code_seq', { startWith: 1000, increment: 1 })

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Always stored lowercase. Students: lowercase(student_code). */
    username: text('username').notNull(),
    studentCode: text('student_code'),
    passwordHash: text('password_hash').notNull(),
    fullName: text('full_name').notNull(),
    email: text('email'),
    phone: text('phone'),
    role: roleEnum('role').notNull(),
    status: userStatusEnum('status').notNull().default('ACTIVE'),
    avatarUrl: text('avatar_url'),
    targetScore: integer('target_score'),
    mustChangePassword: boolean('must_change_password').notNull().default(true),
    failedLoginCount: integer('failed_login_count').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdBy: uuid('created_by'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('users_username_uq').on(t.username),
    uniqueIndex('users_student_code_uq').on(t.studentCode),
    uniqueIndex('users_email_uq').on(sql`lower(${t.email})`).where(sql`${t.email} is not null`),
    index('users_role_status_idx').on(t.role, t.status),
  ],
).enableRLS()

/** One row per device/login. Refresh token is opaque; only its SHA-256 is stored and it rotates on every refresh. */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    refreshTokenHash: text('refresh_token_hash').notNull(),
    /** Hash of the previous token — presenting it again means the token was stolen/replayed. */
    previousTokenHash: text('previous_token_hash'),
    userAgent: text('user_agent'),
    ip: text('ip'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedReason: text('revoked_reason'),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
).enableRLS()

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    actorId: uuid('actor_id'),
    action: text('action').notNull(),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    ip: text('ip'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('audit_actor_idx').on(t.actorId), index('audit_action_idx').on(t.action, t.createdAt)],
).enableRLS()

export const skills = pgTable(
  'skills',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: skillCodeEnum('code').notNull(),
    name: text('name').notNull(),
    enabled: boolean('enabled').notNull().default(false),
    displayOrder: integer('display_order').notNull(),
  },
  (t) => [uniqueIndex('skills_code_uq').on(t.code)],
).enableRLS()

export const parts = pgTable(
  'parts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    skillId: uuid('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'restrict' }),
    code: text('code').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    displayOrder: integer('display_order').notNull(),
  },
  (t) => [uniqueIndex('parts_code_uq').on(t.code), index('parts_skill_idx').on(t.skillId)],
).enableRLS()

// ====================================================================== Exam domain
// Exam → ExamPart(Part) → Question(+Options), optional QuestionGroup(+Passages). No per-part columns/tables (backlog §5.3).

export const examStatusEnum = pgEnum('exam_status', EXAM_STATUSES)
export const examModeEnum = pgEnum('exam_mode', EXAM_MODES)
export const attemptStatusEnum = pgEnum('attempt_status', ATTEMPT_STATUSES)
export const assetProviderEnum = pgEnum('asset_provider', ASSET_PROVIDERS)

/** File metadata only (PDF/audio/images live in Cloudflare R2; videos on Google Drive). Wired up in the asset epic. */
export const assets = pgTable('assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  provider: assetProviderEnum('provider').notNull(),
  bucket: text('bucket'),
  objectKey: text('object_key').notNull(),
  mimeType: text('mime_type'),
  sizeBytes: bigint('size_bytes', { mode: 'number' }),
  checksum: text('checksum'),
  originalFilename: text('original_filename'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('assets_object_uq').on(t.provider, t.bucket, t.objectKey)]).enableRLS()

export const exams = pgTable(
  'exams',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    source: text('source'),
    version: integer('version').notNull().default(1),
    status: examStatusEnum('status').notNull().default('DRAFT'),
    difficulty: text('difficulty').notNull().default('MEDIUM'),
    durationSeconds: integer('duration_seconds').notNull(),
    totalQuestions: integer('total_questions').notNull().default(0),
    /** Raw-correct → scaled score lookup, configurable per exam/version: `{ listening: number[101], reading: number[101] }`. */
    scoringConfig: jsonb('scoring_config').$type<{ listening: number[]; reading: number[] } | null>(),
    /** Full-length Listening recording (Parts 1–4 in one file). Part-level audio below overrides it for split recordings. */
    audioAssetId: uuid('audio_asset_id').references(() => assets.id, { onDelete: 'set null' }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex('exams_code_uq').on(t.code), index('exams_status_idx').on(t.status)],
).enableRLS()

export const examParts = pgTable(
  'exam_parts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    examId: uuid('exam_id')
      .notNull()
      .references(() => exams.id, { onDelete: 'cascade' }),
    partId: uuid('part_id')
      .notNull()
      .references(() => parts.id, { onDelete: 'restrict' }),
    displayOrder: integer('display_order').notNull(),
    questionStart: integer('question_start').notNull(),
    questionEnd: integer('question_end').notNull(),
    /** Recording for just this part (a file covering Parts 1+2 is attached to both rows). */
    audioAssetId: uuid('audio_asset_id').references(() => assets.id, { onDelete: 'set null' }),
  },
  (t) => [uniqueIndex('exam_parts_uq').on(t.examId, t.partId), index('exam_parts_exam_idx').on(t.examId)],
).enableRLS()

export const questionGroups = pgTable(
  'question_groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    examPartId: uuid('exam_part_id')
      .notNull()
      .references(() => examParts.id, { onDelete: 'cascade' }),
    groupKey: text('group_key').notNull(),
    instructions: text('instructions'),
    audioAssetId: uuid('audio_asset_id').references(() => assets.id, { onDelete: 'set null' }),
    imageAssetId: uuid('image_asset_id').references(() => assets.id, { onDelete: 'set null' }),
    displayOrder: integer('display_order').notNull().default(0),
  },
  (t) => [uniqueIndex('question_groups_uq').on(t.examPartId, t.groupKey)],
).enableRLS()

/** Single / double / triple passage = 1..3 rows here, same schema for every part. */
export const passages = pgTable(
  'passages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => questionGroups.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    title: text('title'),
    content: text('content').notNull(),
    imageAssetId: uuid('image_asset_id').references(() => assets.id, { onDelete: 'set null' }),
    displayOrder: integer('display_order').notNull().default(0),
  },
  (t) => [index('passages_group_idx').on(t.groupId)],
).enableRLS()

export const questions = pgTable(
  'questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    examPartId: uuid('exam_part_id')
      .notNull()
      .references(() => examParts.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id').references(() => questionGroups.id, { onDelete: 'set null' }),
    questionNumber: integer('question_number').notNull(),
    type: text('type'),
    prompt: text('prompt').notNull().default(''),
    imageAssetId: uuid('image_asset_id').references(() => assets.id, { onDelete: 'set null' }),
    audioAssetId: uuid('audio_asset_id').references(() => assets.id, { onDelete: 'set null' }),
    videoAssetId: uuid('video_asset_id').references(() => assets.id, { onDelete: 'set null' }),
    explanationStatus: text('explanation_status').notNull().default('NONE'),
    difficulty: text('difficulty'),
    ...timestamps,
  },
  (t) => [uniqueIndex('questions_number_uq').on(t.examPartId, t.questionNumber), index('questions_group_idx').on(t.groupId)],
).enableRLS()

export const questionOptions = pgTable(
  'question_options',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    optionKey: text('option_key').notNull(),
    optionText: text('option_text').notNull().default(''),
    imageAssetId: uuid('image_asset_id').references(() => assets.id, { onDelete: 'set null' }),
    isCorrect: boolean('is_correct').notNull().default(false),
  },
  (t) => [uniqueIndex('question_options_uq').on(t.questionId, t.optionKey)],
).enableRLS()

// ====================================================================== Attempts
export const attempts = pgTable(
  'attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    examId: uuid('exam_id')
      .notNull()
      .references(() => exams.id, { onDelete: 'restrict' }),
    mode: examModeEnum('mode').notNull(),
    status: attemptStatusEnum('status').notNull().default('IN_PROGRESS'),
    /** Part codes in scope (whole exam when it lists every part). */
    partCodes: jsonb('part_codes').$type<string[]>().notNull(),
    /** 'ALL' or sorted part codes — used to keep one in-progress attempt per (user, exam, mode, scope). */
    scopeKey: text('scope_key').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    deadlineAt: timestamp('deadline_at', { withTimezone: true }),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    durationSeconds: integer('duration_seconds'),
    totalQuestions: integer('total_questions').notNull(),
    totalScore: integer('total_score'),
    listeningScore: integer('listening_score'),
    readingScore: integer('reading_score'),
    correctCount: integer('correct_count'),
    incorrectCount: integer('incorrect_count'),
    unansweredCount: integer('unanswered_count'),
  },
  (t) => [
    index('attempts_user_idx').on(t.userId, t.startedAt),
    index('attempts_exam_idx').on(t.examId),
    // One live attempt per (user, exam, mode, scope): starting again resumes instead of duplicating.
    uniqueIndex('attempts_one_active_uq')
      .on(t.userId, t.examId, t.mode, t.scopeKey)
      .where(sql`${t.status} = 'IN_PROGRESS'`),
  ],
).enableRLS()

/** Answer-level data (not just totals) so analytics by part / question type / time can be built later. */
export const attemptAnswers = pgTable(
  'attempt_answers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    attemptId: uuid('attempt_id')
      .notNull()
      .references(() => attempts.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'restrict' }),
    selectedOptionId: uuid('selected_option_id').references(() => questionOptions.id, { onDelete: 'set null' }),
    isCorrect: boolean('is_correct'),
    answeredAt: timestamp('answered_at', { withTimezone: true }).notNull().defaultNow(),
    timeSpentSeconds: integer('time_spent_seconds'),
  },
  (t) => [uniqueIndex('attempt_answers_uq').on(t.attemptId, t.questionId)],
).enableRLS()

export type ExamRow = typeof exams.$inferSelect
export type AttemptRow = typeof attempts.$inferSelect
export type UserRow = typeof users.$inferSelect
export type NewUserRow = typeof users.$inferInsert
export type SessionRow = typeof sessions.$inferSelect
