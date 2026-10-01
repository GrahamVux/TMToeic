import { HttpStatus, Inject, Injectable } from '@nestjs/common'
import {
  ERROR_CODES,
  type BugReportAdminDto,
  type BugReportCategory,
  type BugReportDto,
  type BugReportListDto,
  type BugReportStatus,
  type BugReportSummaryDto,
  type CreateBugReportInput,
  type ListBugReportsQuery,
  type UpdateBugReportInput,
} from '@toeic/shared'
import { and, count, desc, eq, gte, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { AuditService } from '../audit/audit.service'
import { AppException } from '../common/app-exception'
import { DB, type Db } from '../db/database.module'
import { bugReports, users, type BugReportRow } from '../db/schema'

const HOUR_MS = 60 * 60 * 1000
const MAX_PER_HOUR = 5
const STATUSES = new Set<BugReportStatus>(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'])
const CATEGORIES = new Set<BugReportCategory>(['UI', 'EXAM', 'SCORE', 'ACCOUNT', 'OTHER'])

const reporters = users
const resolvers = alias(users, 'bug_resolvers')

@Injectable()
export class BugReportsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  async create(reporterId: string, input: CreateBugReportInput, userAgent?: string, ip?: string): Promise<BugReportDto> {
    const since = new Date(Date.now() - HOUR_MS)
    const [{ n }] = await this.db
      .select({ n: count() })
      .from(bugReports)
      .where(and(eq(bugReports.reporterId, reporterId), gte(bugReports.createdAt, since)))
    if (n >= MAX_PER_HOUR) {
      throw new AppException(
        ERROR_CODES.TOO_MANY_REQUESTS,
        'Bạn đã gửi quá nhiều báo lỗi trong một giờ. Vui lòng thử lại sau.',
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }

    const [row] = await this.db
      .insert(bugReports)
      .values({
        reporterId,
        category: input.category,
        message: input.message,
        pagePath: input.pagePath,
        userAgent: userAgent?.slice(0, 400) ?? null,
        status: 'OPEN',
      })
      .returning()
    await this.audit.log({
      action: 'BUG_REPORT_CREATED',
      actorId: reporterId,
      entityType: 'bug_report',
      entityId: row.id,
      metadata: { category: input.category, pagePath: input.pagePath },
      ip,
    })
    return this.toStudentDto(row)
  }

  async listMine(reporterId: string): Promise<{ items: BugReportDto[] }> {
    const rows = await this.db
      .select()
      .from(bugReports)
      .where(eq(bugReports.reporterId, reporterId))
      .orderBy(desc(bugReports.createdAt))
      .limit(20)
    return { items: rows.map((r) => this.toStudentDto(r)) }
  }

  async summary(): Promise<BugReportSummaryDto> {
    const [{ n }] = await this.db.select({ n: count() }).from(bugReports).where(eq(bugReports.status, 'OPEN'))
    return { openCount: n }
  }

  async list(query: ListBugReportsQuery): Promise<BugReportListDto> {
    const filter = query.status ? eq(bugReports.status, query.status) : sql`true`
    const [{ n: total }] = await this.db.select({ n: count() }).from(bugReports).where(filter)
    const [{ n: openCount }] = await this.db.select({ n: count() }).from(bugReports).where(eq(bugReports.status, 'OPEN'))
    const rows = await this.db
      .select({
        report: bugReports,
        reporterName: reporters.fullName,
        reporterCode: reporters.studentCode,
        reporterId: reporters.id,
        resolverName: resolvers.fullName,
      })
      .from(bugReports)
      .innerJoin(reporters, eq(bugReports.reporterId, reporters.id))
      .leftJoin(resolvers, eq(bugReports.resolvedBy, resolvers.id))
      .where(filter)
      .orderBy(sql`case when ${bugReports.status} = 'OPEN' then 0 when ${bugReports.status} = 'IN_PROGRESS' then 1 else 2 end`, desc(bugReports.createdAt))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize)

    return {
      items: rows.map((r) => this.toAdminDto(r.report, r.reporterId, r.reporterName, r.reporterCode, r.resolverName)),
      total,
      openCount,
      page: query.page,
      pageSize: query.pageSize,
    }
  }

  async update(id: string, actorId: string, input: UpdateBugReportInput, ip?: string): Promise<BugReportAdminDto> {
    const [existing] = await this.db.select().from(bugReports).where(eq(bugReports.id, id)).limit(1)
    if (!existing) throw AppException.notFound('Không tìm thấy báo lỗi')

    const done = input.status === 'RESOLVED' || input.status === 'CLOSED'
    const [row] = await this.db
      .update(bugReports)
      .set({
        status: input.status,
        adminNote: input.adminNote === undefined ? existing.adminNote : input.adminNote,
        resolvedBy: done ? actorId : null,
        resolvedAt: done ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(bugReports.id, id))
      .returning()

    await this.audit.log({
      action: 'BUG_REPORT_UPDATED',
      actorId,
      entityType: 'bug_report',
      entityId: id,
      metadata: { status: input.status },
      ip,
    })

    const [joined] = await this.db
      .select({
        report: bugReports,
        reporterName: reporters.fullName,
        reporterCode: reporters.studentCode,
        reporterId: reporters.id,
        resolverName: resolvers.fullName,
      })
      .from(bugReports)
      .innerJoin(reporters, eq(bugReports.reporterId, reporters.id))
      .leftJoin(resolvers, eq(bugReports.resolvedBy, resolvers.id))
      .where(eq(bugReports.id, row.id))
      .limit(1)
    return this.toAdminDto(joined.report, joined.reporterId, joined.reporterName, joined.reporterCode, joined.resolverName)
  }

  private toStudentDto(row: BugReportRow): BugReportDto {
    return {
      id: row.id,
      category: CATEGORIES.has(row.category as BugReportCategory) ? (row.category as BugReportCategory) : 'OTHER',
      message: row.message,
      pagePath: row.pagePath,
      status: STATUSES.has(row.status as BugReportStatus) ? (row.status as BugReportStatus) : 'OPEN',
      adminNote: row.adminNote,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }
  }

  private toAdminDto(
    row: BugReportRow,
    reporterId: string,
    reporterName: string,
    reporterCode: string | null,
    resolverName: string | null,
  ): BugReportAdminDto {
    return {
      ...this.toStudentDto(row),
      userAgent: row.userAgent,
      reporter: { id: reporterId, fullName: reporterName, studentCode: reporterCode },
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      resolvedByName: resolverName,
    }
  }
}
