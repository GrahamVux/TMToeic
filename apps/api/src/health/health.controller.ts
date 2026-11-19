import { Controller, Get, Inject } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'
import { sql } from 'drizzle-orm'
import { Public } from '../common/decorators'
import { DB, type Db } from '../db/database.module'
import { StorageService } from '../storage/storage.service'

@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly storage: StorageService,
  ) {}

  @Get()
  async check() {
    await this.db.execute(sql`select 1`)
    return { status: 'ok', storage: this.storage.enabled }
  }
}
