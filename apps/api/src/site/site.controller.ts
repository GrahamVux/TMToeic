import { Body, Controller, Get, Put, Req } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'
import { updateSiteSettingsSchema } from '@toeic/shared'
import type { Request } from 'express'
import { clientIp, CurrentUser, Public, Roles, type AuthUser } from '../common/decorators'
import { parse } from '../common/zod'
import { SiteService } from './site.service'

@Controller('site-settings')
export class SiteController {
  constructor(private readonly site: SiteService) {}

  @Public()
  @SkipThrottle()
  @Get()
  get() {
    return this.site.get()
  }

  @Roles('ADMIN')
  @Put()
  update(@CurrentUser() user: AuthUser, @Body() body: unknown, @Req() req: Request) {
    return this.site.update({ id: user.id }, parse(updateSiteSettingsSchema, body), clientIp(req))
  }
}
