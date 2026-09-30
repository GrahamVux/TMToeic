import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common'
import type { CreateExamInput, ReplaceExamContentInput } from '@toeic/shared'
import { eq } from 'drizzle-orm'
import { APP_CONFIG, type AppConfig } from '../config/app-config'
import { DB, type Db } from '../db/database.module'
import { exams, users } from '../db/schema'
import { ExamsService } from './exams.service'

export const DEMO_EXAM_CODE = 'DEMO-READING-01'

const KEYS = ['A', 'B', 'C', 'D'] as const

/** q(number, part, prompt, options, index of the correct option) */
function q(number: number, partCode: string, prompt: string, options: [string, string, string, string], correct: number, groupKey?: string) {
  return {
    partCode,
    number,
    prompt,
    ...(groupKey ? { groupKey } : {}),
    options: options.map((text, i) => ({ key: KEYS[i], text, correct: i === correct })),
  }
}

const definition: CreateExamInput = {
  code: DEMO_EXAM_CODE,
  title: 'Demo Mini Test — Reading (Part 5–7)',
  description: 'Đề mẫu để thử luồng làm bài. Không phải đề ETS thật.',
  source: 'demo',
  difficulty: 'EASY',
  durationSeconds: 20 * 60,
  parts: [
    { partCode: 'PART_5', questionStart: 101, questionEnd: 110 },
    { partCode: 'PART_6', questionStart: 131, questionEnd: 134 },
    { partCode: 'PART_7', questionStart: 147, questionEnd: 151 },
  ],
}

const content: ReplaceExamContentInput = {
  groups: [
    {
      key: 'p6',
      partCode: 'PART_6',
      instructions: 'Read the text that follows. A word, phrase, or sentence is missing in parts of the text. Select the best answer.',
      passages: [
        {
          label: 'A',
          title: 'Email',
          content:
            'To: All staff\nSubject: New parking policy\n\nStarting next month, the company will introduce a new parking policy. Employees must register their vehicles at the front desk (131) ______. Each registered vehicle will receive a permit that must be displayed on the windshield. Visitors may park in the north lot, (132) ______ spaces are limited. (133) ______. Please contact the facilities office if you have any questions (134) ______ the new policy.',
        },
      ],
    },
    {
      key: 'p7a',
      partCode: 'PART_7',
      instructions: 'Questions 147–149 refer to the following notice.',
      passages: [
        {
          label: 'A',
          title: 'Notice',
          content:
            'NOTICE — BUILDING MAINTENANCE\n\nThe elevators in Building B will be out of service on Saturday, October 12, from 8:00 A.M. to 2:00 P.M. for routine inspection. Staff members who need to reach offices on the upper floors should use the stairs or the service elevator located near the loading dock. We apologize for any inconvenience.\n\n— Facilities Management',
        },
      ],
    },
    {
      key: 'p7b',
      partCode: 'PART_7',
      instructions: 'Questions 150–151 refer to the following email.',
      passages: [
        {
          label: 'A',
          title: 'Email',
          content:
            'From: Daniel Cho\nTo: Priya Nair\nSubject: Catering order\n\nHi Priya,\n\nI would like to confirm the catering order for Thursday’s client luncheon. We expect 25 guests, including 4 vegetarians. Could you also arrange for coffee and tea to be served at 12:30 P.M.? Please send me the final invoice by Wednesday.\n\nThanks,\nDaniel',
        },
      ],
    },
  ],
  questions: [
    q(101, 'PART_5', 'The quarterly report must be ------- to the finance department by Friday.', ['submit', 'submitted', 'submitting', 'submission'], 1),
    q(102, 'PART_5', 'Ms. Tanaka was ------- for her outstanding contribution to the project.', ['recognition', 'recognize', 'recognized', 'recognizing'], 2),
    q(103, 'PART_5', '------- the heavy rain, the outdoor concert went ahead as planned.', ['Despite', 'Although', 'However', 'Because'], 0),
    q(104, 'PART_5', 'Employees who wish to take leave should notify their supervisors at least two weeks in -------.', ['advanced', 'advancing', 'advance', 'advances'], 2),
    q(105, 'PART_5', 'The new software is ------- easier to use than the previous version.', ['so', 'very', 'most', 'much'], 3),
    q(106, 'PART_5', 'Please keep your receipt as ------- of purchase.', ['prove', 'proof', 'proven', 'provable'], 1),
    q(107, 'PART_5', 'Mr. Lee is responsible ------- training all new staff members.', ['to', 'at', 'for', 'with'], 2),
    q(108, 'PART_5', 'The conference room is available ------- Monday and Wednesday only.', ['at', 'in', 'by', 'on'], 3),
    q(109, 'PART_5', 'Our customer service team responds to inquiries ------- and professionally.', ['prompt', 'promptly', 'promptness', 'prompted'], 1),
    q(110, 'PART_5', 'The merger is expected to be ------- by the end of the year.', ['completing', 'complete', 'completed', 'completion'], 2),

    q(131, 'PART_6', 'Choose the best option for blank (131).', ['since last week', 'during last month', 'by the end of this week', 'yet'], 2, 'p6'),
    q(132, 'PART_6', 'Choose the best option for blank (132).', ['if', 'but', 'so', 'as though'], 1, 'p6'),
    q(
      133,
      'PART_6',
      'Choose the best sentence for blank (133).',
      ['The cafeteria will close early on Fridays.', 'Parking was free last year.', 'We hope you enjoyed the holiday.', 'Vehicles without a permit may be towed at the owner’s expense.'],
      3,
      'p6',
    ),
    q(134, 'PART_6', 'Choose the best option for blank (134).', ['regarded', 'regarding', 'regardless', 'regard'], 1, 'p6'),

    q(147, 'PART_7', 'What is the purpose of the notice?', ['To announce a new building', 'To request feedback', 'To inform staff of a temporary elevator closure', 'To schedule a meeting'], 2, 'p7a'),
    q(148, 'PART_7', 'When will the elevators be unavailable?', ['Friday morning', 'Saturday morning and early afternoon', 'All weekend', 'Sunday afternoon'], 1, 'p7a'),
    q(149, 'PART_7', 'Where is the service elevator?', ['Near the lobby', 'On the top floor', 'In Building A', 'Near the loading dock'], 3, 'p7a'),
    q(150, 'PART_7', 'How many guests are expected?', ['4', '21', '25', '29'], 2, 'p7b'),
    q(151, 'PART_7', 'What does Daniel ask Priya to do by Wednesday?', ['Confirm the menu', 'Send the final invoice', 'Book a room', 'Call the guests'], 1, 'p7b'),
  ],
}

/** Dev convenience: a small published exam so the student flow can be tried without authoring one first. */
@Injectable()
export class DemoExamSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger('DemoExam')

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly examsService: ExamsService,
  ) {}

  async onApplicationBootstrap() {
    if (!this.config.seedDemoExam) return
    const [existing] = await this.db.select({ id: exams.id }).from(exams).where(eq(exams.code, DEMO_EXAM_CODE)).limit(1)
    if (existing) return
    // Runs after every module's onModuleInit, so the bootstrap admin exists by now.
    const [admin] = await this.db.select({ id: users.id, role: users.role }).from(users).where(eq(users.role, 'ADMIN')).limit(1)
    if (!admin) return
    const actor = { id: admin.id, role: admin.role }
    const exam = await this.examsService.create(actor, definition)
    await this.examsService.replaceContent(actor, exam.id, content)
    await this.examsService.publish(actor, exam.id)
    this.logger.log(`Seeded demo exam ${DEMO_EXAM_CODE}`)
  }
}
