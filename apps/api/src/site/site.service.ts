import { Inject, Injectable } from '@nestjs/common'
import { DEFAULT_SITE_SETTINGS, type SiteSettingsDto, type UpdateSiteSettingsInput } from '@toeic/shared'
import { eq } from 'drizzle-orm'
import { AuditService } from '../audit/audit.service'
import type { AuthUser } from '../common/decorators'
import { DB, type Db } from '../db/database.module'
import { siteSettings, type SiteSettingsRow } from '../db/schema'

const ID = 'default'

@Injectable()
export class SiteService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  async get(): Promise<SiteSettingsDto> {
    return this.toDto(await this.requireRow())
  }

  async update(actor: Pick<AuthUser, 'id'>, input: UpdateSiteSettingsInput, ip?: string): Promise<SiteSettingsDto> {
    await this.requireRow()
    const patch: Partial<SiteSettingsRow> = { updatedAt: new Date() }
    if (input.brandName !== undefined) patch.brandName = input.brandName
    if (input.slogan !== undefined) patch.slogan = input.slogan
    if (input.loginHeadline !== undefined) patch.loginHeadline = input.loginHeadline
    if (input.loginIntro !== undefined) patch.loginIntro = input.loginIntro
    if (input.footerAbout !== undefined) patch.footerAbout = input.footerAbout
    if (input.supportHeading !== undefined) patch.supportHeading = input.supportHeading
    if (input.supportDetail !== undefined) patch.supportDetail = input.supportDetail
    if (input.phone !== undefined) patch.phone = input.phone
    if (input.address !== undefined) patch.address = input.address
    if (input.hours !== undefined) patch.hours = input.hours
    if (input.channelHeading !== undefined) patch.channelHeading = input.channelHeading
    if (input.channelDetail !== undefined) patch.channelDetail = input.channelDetail
    if (input.legalNote !== undefined) patch.legalNote = input.legalNote
    if (input.copyright !== undefined) patch.copyright = input.copyright
    if (input.theme) {
      patch.themePrimary = input.theme.primary
      patch.themePrimarySoft = input.theme.primarySoft
      patch.themePaper = input.theme.paper
      if (input.theme.button) patch.themeButton = input.theme.button
    }
    if (input.backgroundMode !== undefined) patch.backgroundMode = input.backgroundMode
    if (input.logoUrl !== undefined) patch.logoDataUrl = input.logoUrl
    if (input.faviconUrl !== undefined) patch.faviconDataUrl = input.faviconUrl
    if (input.honorBoardEnabled !== undefined) patch.honorBoardEnabled = input.honorBoardEnabled

    const [row] = await this.db.update(siteSettings).set(patch).where(eq(siteSettings.id, ID)).returning()
    await this.audit.log({ action: 'SITE_SETTINGS_UPDATED', actorId: actor.id, entityType: 'site_settings', entityId: ID, ip })
    return this.toDto(row)
  }

  private async requireRow(): Promise<SiteSettingsRow> {
    const [row] = await this.db.select().from(siteSettings).where(eq(siteSettings.id, ID)).limit(1)
    if (row) return row
    const d = DEFAULT_SITE_SETTINGS
    const [created] = await this.db
      .insert(siteSettings)
      .values({
        id: ID,
        brandName: d.brandName,
        slogan: d.slogan,
        loginHeadline: d.loginHeadline,
        loginIntro: d.loginIntro,
        footerAbout: d.footerAbout,
        supportHeading: d.supportHeading,
        supportDetail: d.supportDetail,
        phone: d.phone,
        address: d.address,
        hours: d.hours,
        channelHeading: d.channelHeading,
        channelDetail: d.channelDetail,
        legalNote: d.legalNote,
        copyright: d.copyright,
        themePrimary: d.theme.primary,
        themePrimarySoft: d.theme.primarySoft,
        themePaper: d.theme.paper,
        themeButton: d.theme.button ?? '#1f7a8c',
        backgroundMode: d.backgroundMode,
        honorBoardEnabled: d.honorBoardEnabled,
      })
      .returning()
    return created
  }

  private toDto(row: SiteSettingsRow): SiteSettingsDto {
    return {
      brandName: row.brandName,
      slogan: row.slogan,
      loginHeadline: row.loginHeadline,
      loginIntro: row.loginIntro,
      footerAbout: row.footerAbout,
      supportHeading: row.supportHeading,
      supportDetail: row.supportDetail,
      phone: row.phone,
      address: row.address,
      hours: row.hours,
      channelHeading: row.channelHeading,
      channelDetail: row.channelDetail,
      legalNote: row.legalNote,
      copyright: row.copyright,
      theme: { primary: row.themePrimary, primarySoft: row.themePrimarySoft, paper: row.themePaper, button: row.themeButton },
      backgroundMode: row.backgroundMode === 'sky' ? 'sky' : 'fixed',
      logoUrl: row.logoDataUrl,
      faviconUrl: row.faviconDataUrl,
      honorBoardEnabled: row.honorBoardEnabled,
      updatedAt: row.updatedAt.toISOString(),
    }
  }
}
