import { Controller, Get, Inject } from '@nestjs/common'
import { asc } from 'drizzle-orm'
import { DB, type Db } from '../db/database.module'
import { parts, skills } from '../db/schema'

/** Skills & Parts are data. The web app renders whatever is `enabled` — adding Speaking/Writing is a DB flag, not a code change. */
@Controller('skills')
export class CatalogController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get()
  async list() {
    const [skillRows, partRows] = await Promise.all([
      this.db.select().from(skills).orderBy(asc(skills.displayOrder)),
      this.db.select().from(parts).orderBy(asc(parts.displayOrder)),
    ])
    return skillRows.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      enabled: s.enabled,
      parts: partRows
        .filter((p) => p.skillId === s.id)
        .map((p) => ({ id: p.id, code: p.code, name: p.name, description: p.description, displayOrder: p.displayOrder })),
    }))
  }
}
