import { sql } from 'drizzle-orm'
import {
  bigint,
  bigserial,
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgSequence,
  pgTable,
  text,
  timestamp,
  primaryKey,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { ASSET_PROVIDERS, ASSIGNMENT_LIFECYCLES, ATTEMPT_STATUSES, EXAM_MODES, EXAM_STATUSES, ROLES, SKILLS, USER_STATUSES, type AssetStatus } from '@toeic/shared'

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
    /** Upper bound of the student's score band; kept for list/sort compatibility. */
    targetScore: integer('target_score'),
    /** TWO_SKILL | FOUR_SKILL; null when the student has no goal. */
    goalTrack: text('goal_track'),
    targetScoreMin: integer('target_score_min'),
    mustChangePassword: boolean('must_change_password').notNull().default(true),
    /** Teacher grants. Ignored for ADMIN (always allowed) and STUDENT. Existing teachers default to all three. */
    permCreateStudents: boolean('perm_create_students').notNull().default(true),
    permManageAssignments: boolean('perm_manage_assignments').notNull().default(true),
    permViewProgress: boolean('perm_view_progress').notNull().default(true),
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

export const classes = pgTable(
  'classes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    /** When set, the class takes no new students and drops off the staff boards. Accounts stay. */
    closedAt: timestamp('closed_at', { withTimezone: true }),
    /** When set, that class's own board counts EXP only after this moment. The center board stays on the calendar year. */
    honorResetAt: timestamp('honor_reset_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex('classes_name_uq').on(sql`lower(${t.name})`)],
).enableRLS()

/** One class per student. Staff are not members. */
export const classMembers = pgTable(
  'class_members',
  {
    classId: uuid('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.userId] }), index('class_members_class_idx').on(t.classId)],
).enableRLS()

/** Teachers allowed to manage the students of a class. A teacher may cover several classes. */
export const classTeachers = pgTable(
  'class_teachers',
  {
    classId: uuid('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.classId, t.userId] }), index('class_teachers_user_idx').on(t.userId)],
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
export const assignmentLifecycleEnum = pgEnum('assignment_lifecycle', ASSIGNMENT_LIFECYCLES)

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
  /** PENDING until the bytes reach object storage. Rows registered for objects already in the bucket are STORED. */
  status: text('status').$type<AssetStatus>().notNull().default('STORED'),
  /** Why the push to object storage failed. Null unless status is FAILED. */
  error: text('error'),
  uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
  storedAt: timestamp('stored_at', { withTimezone: true }),
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
    /** The uploaded JSON this exam was built from, kept in object storage. Null for exams typed in by hand. */
    sourceAssetId: uuid('source_asset_id').references(() => assets.id, { onDelete: 'set null' }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex('exams_code_uq').on(t.code), index('exams_status_idx').on(t.status)],
).enableRLS()

/** A full test made by pairing one Listening exam with one Reading exam. The playable paper is `examId`. */
export const examBundles = pgTable(
  'exam_bundles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    examId: uuid('exam_id')
      .notNull()
      .references(() => exams.id, { onDelete: 'cascade' }),
    listeningExamId: uuid('listening_exam_id')
      .notNull()
      .references(() => exams.id, { onDelete: 'restrict' }),
    readingExamId: uuid('reading_exam_id')
      .notNull()
      .references(() => exams.id, { onDelete: 'restrict' }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('exam_bundles_exam_uq').on(t.examId), uniqueIndex('exam_bundles_pair_uq').on(t.listeningExamId, t.readingExamId)],
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
    /** Written solution shown after the student submits. */
    explanation: text('explanation'),
    difficulty: text('difficulty'),
    /** Accepted cloze answers for this blank. Never sent to the player. */
    acceptedAnswers: jsonb('accepted_answers').$type<string[] | null>(),
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

// ====================================================================== Homework assignments (composed from exam parts in the bank)
export const assignments = pgTable(
  'assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    description: text('description'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    examId: uuid('exam_id')
      .notNull()
      .references(() => exams.id, { onDelete: 'restrict' }),
    partCodes: jsonb('part_codes').$type<string[]>().notNull(),
    durationSeconds: integer('duration_seconds').notNull(),
    dueAt: timestamp('due_at', { withTimezone: true }),
    status: assignmentLifecycleEnum('status').notNull().default('DRAFT'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    /** Recording students hear while doing this homework. Wins over the exam's own audio. */
    audioAssetId: uuid('audio_asset_id').references(() => assets.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [index('assignments_exam_idx').on(t.examId), index('assignments_status_idx').on(t.status, t.dueAt)],
).enableRLS()

/** Scanned exam pages shown to students while they do this homework. */
export const assignmentImages = pgTable(
  'assignment_images',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    assignmentId: uuid('assignment_id')
      .notNull()
      .references(() => assignments.id, { onDelete: 'cascade' }),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'restrict' }),
    displayOrder: integer('display_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('assignment_images_assignment_idx').on(t.assignmentId, t.displayOrder)],
).enableRLS()

export const assignmentStudents = pgTable(
  'assignment_students',
  {
    assignmentId: uuid('assignment_id')
      .notNull()
      .references(() => assignments.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [
    uniqueIndex('assignment_students_uq').on(t.assignmentId, t.userId),
    index('assignment_students_user_idx').on(t.userId),
  ],
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
    assignmentId: uuid('assignment_id').references(() => assignments.id, { onDelete: 'set null' }),
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
    index('attempts_assignment_idx').on(t.assignmentId),
    uniqueIndex('attempts_one_active_uq')
      .on(t.userId, t.examId, t.mode, t.scopeKey)
      .where(sql`${t.status} = 'IN_PROGRESS' AND ${t.assignmentId} is null`),
    uniqueIndex('attempts_one_assignment_active_uq')
      .on(t.userId, t.assignmentId)
      .where(sql`${t.status} = 'IN_PROGRESS' AND ${t.assignmentId} is not null`),
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
    /** Typed cloze answer. Null on a multiple-choice question. */
    answerText: text('answer_text'),
    isCorrect: boolean('is_correct'),
    answeredAt: timestamp('answered_at', { withTimezone: true }).notNull().defaultNow(),
    timeSpentSeconds: integer('time_spent_seconds'),
  },
  (t) => [uniqueIndex('attempt_answers_uq').on(t.attemptId, t.questionId)],
).enableRLS()

/** One row per time the student left a watched sitting (tab hidden or window unfocused). */
export const attemptFocusLeaves = pgTable(
  'attempt_focus_leaves',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    attemptId: uuid('attempt_id')
      .notNull()
      .references(() => attempts.id, { onDelete: 'cascade' }),
    leftAt: timestamp('left_at', { withTimezone: true }).notNull(),
    returnedAt: timestamp('returned_at', { withTimezone: true }),
    awaySeconds: integer('away_seconds'),
  },
  (t) => [
    index('attempt_focus_attempt_idx').on(t.attemptId),
    uniqueIndex('attempt_focus_one_open_uq').on(t.attemptId).where(sql`${t.returnedAt} is null`),
  ],
).enableRLS()

export const siteSettings = pgTable('site_settings', {
  id: text('id').primaryKey(),
  brandName: text('brand_name').notNull(),
  slogan: text('slogan').notNull(),
  loginHeadline: text('login_headline').notNull(),
  loginIntro: text('login_intro').notNull(),
  footerAbout: text('footer_about').notNull(),
  supportHeading: text('support_heading').notNull(),
  supportDetail: text('support_detail').notNull(),
  phone: text('phone').notNull(),
  address: text('address').notNull(),
  hours: text('hours').notNull(),
  channelHeading: text('channel_heading').notNull(),
  channelDetail: text('channel_detail').notNull(),
  legalNote: text('legal_note').notNull(),
  copyright: text('copyright').notNull(),
  logoDataUrl: text('logo_data_url'),
  faviconDataUrl: text('favicon_data_url'),
  themePrimary: text('theme_primary').notNull(),
  themePrimarySoft: text('theme_primary_soft').notNull(),
  themePaper: text('theme_paper').notNull(),
  honorBoardEnabled: boolean('honor_board_enabled').notNull().default(true),
  ...timestamps,
}).enableRLS()

/** Student-submitted issues for the admin inbox. */
export const bugReports = pgTable(
  'bug_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reporterId: uuid('reporter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    category: text('category').notNull(),
    message: text('message').notNull(),
    pagePath: text('page_path').notNull(),
    userAgent: text('user_agent'),
    status: text('status').notNull().default('OPEN'),
    adminNote: text('admin_note'),
    resolvedBy: uuid('resolved_by').references(() => users.id, { onDelete: 'set null' }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index('bug_reports_status_created_idx').on(t.status, t.createdAt),
    index('bug_reports_reporter_idx').on(t.reporterId, t.createdAt),
  ],
).enableRLS()

/** Shared vocabulary bank imported by an admin from Excel. */
export const vocabEntries = pgTable(
  'vocab_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    word: text('word').notNull(),
    wordKey: text('word_key').notNull(),
    partOfSpeech: text('part_of_speech').notNull(),
    meaning: text('meaning').notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [uniqueIndex('vocab_entries_word_pos_uq').on(t.wordKey, t.partOfSpeech), index('vocab_entries_word_idx').on(t.wordKey)],
).enableRLS()

/** A student's personal word. Meaning may be empty until they fill it in. */
export const notebookEntries = pgTable(
  'notebook_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    word: text('word').notNull(),
    wordKey: text('word_key').notNull(),
    partOfSpeech: text('part_of_speech').notNull().default(''),
    meaning: text('meaning').notNull().default(''),
    source: text('source').notNull(),
    vocabEntryId: uuid('vocab_entry_id').references(() => vocabEntries.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [uniqueIndex('notebook_entries_user_word_uq').on(t.userId, t.wordKey, t.partOfSpeech), index('notebook_entries_user_idx').on(t.userId, t.createdAt)],
).enableRLS()

/** A student's highlight or note on one span of a reading passage, prompt, or option. */
export const readingMarks = pgTable(
  'reading_marks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    examId: uuid('exam_id')
      .notNull()
      .references(() => exams.id, { onDelete: 'cascade' }),
    targetKind: text('target_kind').notNull(),
    targetId: uuid('target_id').notNull(),
    passageLabel: text('passage_label').notNull().default(''),
    optionKey: text('option_key').notNull().default(''),
    startOffset: integer('start_offset').notNull(),
    endOffset: integer('end_offset').notNull(),
    quote: text('quote').notNull(),
    color: text('color'),
    note: text('note').notNull().default(''),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('reading_marks_span_uq').on(t.userId, t.examId, t.targetKind, t.targetId, t.passageLabel, t.optionKey, t.startOffset, t.endOffset),
    index('reading_marks_user_exam_idx').on(t.userId, t.examId),
  ],
).enableRLS()

/** Spaced-repetition state for one catalog card or one notebook card. */
export const cardReviews = pgTable(
  'card_reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    vocabEntryId: uuid('vocab_entry_id').references(() => vocabEntries.id, { onDelete: 'cascade' }),
    notebookEntryId: uuid('notebook_entry_id').references(() => notebookEntries.id, { onDelete: 'cascade' }),
    dueAt: timestamp('due_at', { withTimezone: true }).notNull().defaultNow(),
    intervalDays: integer('interval_days').notNull().default(0),
    repetitions: integer('repetitions').notNull().default(0),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('card_reviews_vocab_uq').on(t.userId, t.vocabEntryId).where(sql`${t.vocabEntryId} is not null`),
    uniqueIndex('card_reviews_notebook_uq').on(t.userId, t.notebookEntryId).where(sql`${t.notebookEntryId} is not null`),
    index('card_reviews_due_idx').on(t.userId, t.dueAt),
  ],
).enableRLS()

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea'
  },
  toDriver(value) {
    return value
  },
  fromDriver(value: unknown) {
    return pdfBuffer(value)
  },
})

function pdfBuffer(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) return value
  if (value instanceof Uint8Array) return Buffer.from(value)
  if (typeof value === 'string') {
    const hex = value.startsWith('\\x') ? value.slice(2) : value
    if (hex.length % 2 === 0 && /^[0-9a-fA-F]*$/.test(hex)) return Buffer.from(hex, 'hex')
  }
  return Buffer.from(value as ArrayBuffer)
}

export const grammarLessons = pgTable(
  'grammar_lessons',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    body: text('body').notNull(),
    displayOrder: integer('display_order').notNull().default(0),
    ...timestamps,
  },
  (t) => [index('grammar_lessons_order_idx').on(t.displayOrder)],
).enableRLS()

/** One handout PDF per grammar lesson. Bytes stay out of the lesson list query. */
export const grammarLessonFiles = pgTable('grammar_lesson_files', {
  lessonId: uuid('lesson_id')
    .primaryKey()
    .references(() => grammarLessons.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  pdfBytes: bytea('pdf_bytes').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}).enableRLS()

export const grammarProgress = pgTable(
  'grammar_progress',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    lessonId: uuid('lesson_id')
      .notNull()
      .references(() => grammarLessons.id, { onDelete: 'cascade' }),
    completedAt: timestamp('completed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('grammar_progress_user_lesson_uq').on(t.userId, t.lessonId)],
).enableRLS()

/** A student's own targets for one day of study. 0 turns that target off. */
export const dailyGoals = pgTable('daily_goals', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  readingTarget: integer('reading_target').notNull().default(0),
  listeningTarget: integer('listening_target').notNull().default(0),
  vocabTarget: integer('vocab_target').notNull().default(0),
  ...timestamps,
}).enableRLS()

export type ExamRow = typeof exams.$inferSelect
export type AttemptRow = typeof attempts.$inferSelect
export type AssignmentRow = typeof assignments.$inferSelect
export type UserRow = typeof users.$inferSelect
export type NewUserRow = typeof users.$inferInsert
export type SessionRow = typeof sessions.$inferSelect
export type SiteSettingsRow = typeof siteSettings.$inferSelect
export type BugReportRow = typeof bugReports.$inferSelect
