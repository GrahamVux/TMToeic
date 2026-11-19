import { Controller, Get, Query, StreamableFile } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'
import { Public } from '../common/decorators'
import { AppException } from '../common/app-exception'
import { StorageService } from './storage.service'

/** Serves a file the development server kept on disk after Cloudflare refused the upload. */
@Public()
@SkipThrottle()
@Controller('local-objects')
export class LocalObjectController {
  constructor(private readonly storage: StorageService) {}

  @Get()
  async open(@Query('key') key = '', @Query('exp') exp = '', @Query('sig') sig = '') {
    const file = await this.storage.openLocal(key, exp, sig)
    if (!file) throw AppException.notFound('Không tìm thấy file')
    return new StreamableFile(file.data, { type: file.mimeType })
  }
}
