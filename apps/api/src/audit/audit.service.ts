import { Global, Inject, Injectable, Logger, Module } from '@nestjs/common'
import { DB, type Db } from '../db/database.module'
import { auditLogs } from '../db/schema'

export type AuditEntry = {
  action: string
  actorId?: string | null
  entityType?: string
  entityId?: string
  metadata?: Record<string, unknown>
  ip?: string
}

/** Append-only audit trail (login, account changes, later: answer-key edits, publish, AI explanation edits). */
@Injectable()
export class AuditService {
  private readonly logger = new Logger('Audit')
  constructor(@Inject(DB) private readonly db: Db) {}

  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.db.insert(auditLogs).values({
        action: entry.action,
        actorId: entry.actorId ?? null,
        entityType: entry.entityType,
        entityId: entry.entityId,
        metadata: entry.metadata,
        ip: entry.ip,
      })
    } catch (err) {
      // Auditing must never take down the request path, but failures must be visible.
      this.logger.error(`Failed to write audit log "${entry.action}": ${(err as Error).message}`)
    }
  }
}

@Global()
@Module({ providers: [AuditService], exports: [AuditService] })
export class AuditModule {}
