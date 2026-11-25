/**
 * Seed 2 classes and 10 test student accounts with realistic scores, score history,
 * streaks, and reward points into the local database (idempotent on student email).
 *
 * Stop the API first when using embedded PGlite, then run from apps/api:
 *   node --liftoff-only ../../node_modules/tsx/dist/cli.mjs src/scripts/seed-test-students.ts
 */
import { hash } from '@node-rs/argon2'
import { and, asc, eq, sql } from 'drizzle-orm'
import { loadConfig, loadDotEnv } from '../config/app-config'
import { createDb } from '../db/database.module'
import {
  attemptAnswers,
  attempts,
  classMembers,
  classes,
  examParts,
  exams,
  parts,
  questionOptions,
  questions,
  rewardPointLedger,
  users,
} from '../db/schema'

const TZ = 'Asia/Ho_Chi_Minh'
const TEST_PASSWORD = process.env.TEST_STUDENT_PASSWORD ?? 'Test1234'
const ARGON_OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const

type StudentSeed = {
  fullName: string
  email: string
  className: string
  targetScore: number
  streakDays: number
  activeToday: boolean
  extraInactiveDays?: number[]
  scores: number[]
  accuracy: number
  rewardPoints: number
}

const STUDENTS: StudentSeed[] = [
  {
    fullName: 'Nguyễn Minh Anh',
    email: 'minhanh.test@tmtoeic.local',
    className: 'TOEIC 650+ K12',
    targetScore: 850,
    streakDays: 15,
    activeToday: true,
    scores: [740, 785, 820, 865],
    accuracy: 0.9,
    rewardPoints: 350,
  },
  {
    fullName: 'Trần Quốc Bảo',
    email: 'quocbao.test@tmtoeic.local',
    className: 'TOEIC 800+ K15',
    targetScore: 900,
    streakDays: 30,
    activeToday: true,
    scores: [780, 815, 845, 880, 915],
    accuracy: 0.95,
    rewardPoints: 620,
  },
  {
    fullName: 'Lê Thảo Nguyên',
    email: 'thaonguyen.test@tmtoeic.local',
    className: 'TOEIC 650+ K12',
    targetScore: 750,
    streakDays: 9,
    activeToday: true,
    scores: [620, 675, 710],
    accuracy: 0.78,
    rewardPoints: 180,
  },
  {
    fullName: 'Phạm Gia Huy',
    email: 'giahuy.test@tmtoeic.local',
    className: 'TOEIC 800+ K15',
    targetScore: 800,
    streakDays: 7,
    activeToday: true,
    scores: [690, 730, 765],
    accuracy: 0.82,
    rewardPoints: 150,
  },
  {
    fullName: 'Hoàng Khánh Linh',
    email: 'khanhlinh.test@tmtoeic.local',
    className: 'TOEIC 650+ K12',
    targetScore: 700,
    streakDays: 5,
    activeToday: true,
    scores: [560, 605, 640],
    accuracy: 0.72,
    rewardPoints: 90,
  },
  {
    fullName: 'Vũ Đức Mạnh',
    email: 'ducmanh.test@tmtoeic.local',
    className: 'TOEIC 800+ K15',
    targetScore: 750,
    streakDays: 4,
    activeToday: false,
    scores: [610, 655],
    accuracy: 0.74,
    rewardPoints: 70,
  },
  {
    fullName: 'Đỗ Hải Yến',
    email: 'haiyen.test@tmtoeic.local',
    className: 'TOEIC 650+ K12',
    targetScore: 650,
    streakDays: 3,
    activeToday: true,
    scores: [515, 550],
    accuracy: 0.65,
    rewardPoints: 45,
  },
  {
    fullName: 'Bùi Tuấn Kiệt',
    email: 'tuankiet.test@tmtoeic.local',
    className: 'TOEIC 800+ K15',
    targetScore: 600,
    streakDays: 2,
    activeToday: true,
    scores: [480, 520],
    accuracy: 0.58,
    rewardPoints: 30,
  },
  {
    fullName: 'Ngô Phương Thảo',
    email: 'phuongthao.test@tmtoeic.local',
    className: 'TOEIC 650+ K12',
    targetScore: 650,
    streakDays: 0,
    activeToday: false,
    extraInactiveDays: [10, 11],
    scores: [450, 470],
    accuracy: 0.48,
    rewardPoints: 10,
  },
  {
    fullName: 'Đặng Quang Vinh',
    email: 'quangvinh.test@tmtoeic.local',
    className: 'TOEIC 800+ K15',
    targetScore: 700,
    streakDays: 1,
    activeToday: true,
    scores: [590],
    accuracy: 0.68,
    rewardPoints: 20,
  },
]

const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })

function shiftDay(day: string, deltaDays: number): string {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + deltaDays)
  return d.toISOString().slice(0, 10)
}

function timestampForOffset(todayStr: string, offsetDays: number, now: Date): Date {
  if (offsetDays === 0) {
    const startOfTodayMs = new Date(`${todayStr}T00:00:05+07:00`).getTime()
    return new Date(Math.max(startOfTodayMs, now.getTime() - 60_000))
  }
  const dayStr = shiftDay(todayStr, -offsetDays)
  return new Date(`${dayStr}T14:00:00+07:00`)
}

function buildDayOffsets(seed: StudentSeed): number[] {
  if (seed.extraInactiveDays?.length) {
    return [...seed.extraInactiveDays].sort((a, b) => b - a)
  }
  const start = seed.activeToday ? 0 : 1
  const offsets: number[] = []
  for (let i = 0; i < seed.streakDays; i++) {
    offsets.push(start + i)
  }
  // Oldest first so score history progresses chronologically
  return offsets.reverse()
}

async function main() {
  loadDotEnv()
  const config = loadConfig()
  const handle = await createDb(config)
  const { db } = handle

  try {
    const now = new Date()
    const todayStr = dayFormat.format(now)
    const passwordHash = await hash(TEST_PASSWORD, ARGON_OPTIONS)

    // 1. Ensure classes exist
    const classIdByName = new Map<string, string>()
    for (const name of ['TOEIC 650+ K12', 'TOEIC 800+ K15']) {
      const [existing] = await db
        .select({ id: classes.id })
        .from(classes)
        .where(sql`lower(${classes.name}) = ${name.toLowerCase()}`)
        .limit(1)
      if (existing) {
        classIdByName.set(name, existing.id)
      } else {
        const [created] = await db.insert(classes).values({ name }).returning({ id: classes.id })
        classIdByName.set(name, created.id)
      }
    }

    // 2. Load a published exam and its questions + options
    let [exam] = await db
      .select()
      .from(exams)
      .where(and(eq(exams.code, 'DEMO-READING-01'), eq(exams.status, 'PUBLISHED')))
      .limit(1)
    if (!exam) {
      ;[exam] = await db.select().from(exams).where(eq(exams.status, 'PUBLISHED')).orderBy(asc(exams.createdAt)).limit(1)
    }
    if (!exam) {
      throw new Error('No PUBLISHED exam found in the database. Boot the API once in development mode to seed DEMO-READING-01.')
    }

    const examPartRows = await db
      .select({ examPartId: examParts.id, partCode: parts.code })
      .from(examParts)
      .innerJoin(parts, eq(parts.id, examParts.partId))
      .where(eq(examParts.examId, exam.id))
      .orderBy(asc(examParts.displayOrder))
    const partCodes = examPartRows.map((r) => r.partCode)

    const examQuestions: Array<{ questionId: string; correctOptionId: string; wrongOptionId: string }> = []
    for (const ep of examPartRows) {
      const qs = await db
        .select({ id: questions.id })
        .from(questions)
        .where(eq(questions.examPartId, ep.examPartId))
        .orderBy(asc(questions.questionNumber))
      for (const q of qs) {
        const opts = await db
          .select({ id: questionOptions.id, isCorrect: questionOptions.isCorrect })
          .from(questionOptions)
          .where(eq(questionOptions.questionId, q.id))
        const correctOpt = opts.find((o) => o.isCorrect)
        const wrongOpt = opts.find((o) => !o.isCorrect)
        if (correctOpt && wrongOpt) {
          examQuestions.push({ questionId: q.id, correctOptionId: correctOpt.id, wrongOptionId: wrongOpt.id })
        }
      }
    }
    if (examQuestions.length === 0) {
      throw new Error(`Published exam ${exam.code} has no multiple-choice questions with options.`)
    }

    const summary: Array<{
      studentCode: string
      fullName: string
      className: string
      streakDays: number
      latestScore: number | null
      rewardPoints: number
      status: string
    }> = []

    // 3. Insert each student + class membership + attempts + answers + reward points
    for (const seed of STUDENTS) {
      const [existingUser] = await db
        .select({ id: users.id, studentCode: users.studentCode })
        .from(users)
        .where(eq(users.email, seed.email))
        .limit(1)
      if (existingUser) {
        summary.push({
          studentCode: existingUser.studentCode ?? '(none)',
          fullName: seed.fullName,
          className: seed.className,
          streakDays: seed.streakDays,
          latestScore: seed.scores.at(-1) ?? null,
          rewardPoints: seed.rewardPoints,
          status: 'skipped (already exists)',
        })
        continue
      }

      const dayOffsets = buildDayOffsets(seed)
      const latestAt = timestampForOffset(todayStr, dayOffsets.at(-1) ?? 0, now)
      const scoredIndices = new Set<number>()
      for (let i = 0; i < seed.scores.length && i < dayOffsets.length; i++) {
        // Put scored FULL_TEST attempts on the earliest/evenly spaced or most recent days, ending with the latest score on the last day
        const idx =
          seed.scores.length === 1
            ? dayOffsets.length - 1
            : Math.round((i * (dayOffsets.length - 1)) / (seed.scores.length - 1))
        scoredIndices.add(idx)
      }
      const scoredIdxList = [...scoredIndices].sort((a, b) => a - b)

      const studentCode = await db.transaction(async (tx) => {
        const seq = (await tx.execute(sql`select nextval('student_code_seq') as n`)) as unknown as {
          rows: Array<{ n: string | number }>
        }
        const code = `${config.studentCodePrefix}-${seq.rows[0].n}`
        const [created] = await tx
          .insert(users)
          .values({
            username: code.toLowerCase(),
            studentCode: code,
            passwordHash,
            fullName: seed.fullName,
            email: seed.email,
            role: 'STUDENT',
            status: 'ACTIVE',
            mustChangePassword: false,
            goalTrack: 'TWO_SKILL',
            targetScore: seed.targetScore,
            targetScoreMin: Math.max(10, seed.targetScore - 50),
            rewardPoints: seed.rewardPoints,
            lastLoginAt: latestAt,
          })
          .returning({ id: users.id, studentCode: users.studentCode })

        const classId = classIdByName.get(seed.className)!
        await tx.insert(classMembers).values({ classId, userId: created.id })

        if (seed.rewardPoints > 0) {
          await tx.insert(rewardPointLedger).values({
            userId: created.id,
            delta: seed.rewardPoints,
            reason: 'Dữ liệu seed test',
            source: 'ADMIN',
          })
        }

        const totalQuestions = examQuestions.length
        const targetCorrect = Math.max(1, Math.min(totalQuestions, Math.round(totalQuestions * seed.accuracy)))

        for (let dayIdx = 0; dayIdx < dayOffsets.length; dayIdx++) {
          const submittedAt = timestampForOffset(todayStr, dayOffsets[dayIdx], now)
          const durationSeconds = 420 + (dayIdx % 5) * 45
          const startedAt = new Date(submittedAt.getTime() - durationSeconds * 1000)

          const scoreSlot = scoredIdxList.indexOf(dayIdx)
          const totalScore = scoreSlot >= 0 ? seed.scores[scoreSlot] : null
          const listeningScore = totalScore !== null ? Math.round((totalScore * 0.52) / 5) * 5 : null
          const readingScore = totalScore !== null && listeningScore !== null ? totalScore - listeningScore : null

          const [attempt] = await tx
            .insert(attempts)
            .values({
              userId: created.id,
              examId: exam.id,
              assignmentId: null,
              mode: totalScore !== null ? 'FULL_TEST' : 'PRACTICE',
              status: 'SUBMITTED',
              partCodes,
              scopeKey: 'ALL',
              startedAt,
              submittedAt,
              durationSeconds,
              totalQuestions,
              totalScore,
              listeningScore,
              readingScore,
              correctCount: targetCorrect,
              incorrectCount: totalQuestions - targetCorrect,
              unansweredCount: 0,
            })
            .returning({ id: attempts.id })

          const answerRows = examQuestions.map((q, qIdx) => {
            const isCorrect = qIdx < targetCorrect
            return {
              attemptId: attempt.id,
              questionId: q.questionId,
              selectedOptionId: isCorrect ? q.correctOptionId : q.wrongOptionId,
              isCorrect,
              answeredAt: new Date(submittedAt.getTime() - (totalQuestions - qIdx) * 1000),
              timeSpentSeconds: 22 + ((qIdx + dayIdx) % 18),
            }
          })
          await tx.insert(attemptAnswers).values(answerRows)
        }

        return created.studentCode ?? code
      })

      summary.push({
        studentCode,
        fullName: seed.fullName,
        className: seed.className,
        streakDays: seed.streakDays,
        latestScore: seed.scores.at(-1) ?? null,
        rewardPoints: seed.rewardPoints,
        status: 'created',
      })
    }

    console.log(JSON.stringify({ exam: exam.code, questionCount: examQuestions.length, password: TEST_PASSWORD, students: summary }, null, 2))
  } finally {
    await handle.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
