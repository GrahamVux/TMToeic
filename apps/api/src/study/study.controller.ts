import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res, StreamableFile } from '@nestjs/common'
import { vocabImportTargetSchema } from '@toeic/shared'
import type { Request, Response } from 'express'
import { clientIp, CurrentUser, Roles, type AuthUser } from '../common/decorators'
import { parse } from '../common/zod'
import { StudyService } from './study.service'

const actorOf = (user: AuthUser, req: Request) => ({ id: user.id, ip: clientIp(req) })

function inlinePdfName(filename: string) {
  const ascii = filename.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '')
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}

@Controller('study')
export class StudyController {
  constructor(private readonly study: StudyService) {}

  @Get('overview')
  overview(@CurrentUser() user: AuthUser) {
    return this.study.overview(user.id)
  }

  @Get('vocab/sets')
  vocabSets(@CurrentUser() user: AuthUser) {
    return this.study.vocabCourse(user.id)
  }

  @Get('vocab/sets/:setId/units/:unit')
  vocabUnitDetail(
    @CurrentUser() user: AuthUser,
    @Param('setId') setId: string,
    @Param('unit') unit: string,
  ) {
    return this.study.unitDetail(user.id, setId, unit)
  }

  @Get('vocab')
  listVocab(@Query('q') q: string | undefined) {
    return this.study.listVocab(typeof q === 'string' ? q : '')
  }

  @Roles('ADMIN')
  @Get('vocab/template')
  async template(@Res() res: Response) {
    const file = await this.study.template()
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename="mau-tu-vung.xlsx"')
    res.send(file)
  }

  @Roles('ADMIN')
  @Post('vocab/preview')
  @HttpCode(200)
  previewVocab(@Req() req: Request) {
    return this.study.previewVocab(req.body)
  }

  @Roles('ADMIN')
  @Post('vocab/commit')
  @HttpCode(200)
  commitVocab(@CurrentUser() user: AuthUser, @Body() body: unknown, @Req() req: Request) {
    return this.study.commitVocab(actorOf(user, req), body)
  }

  @Roles('ADMIN')
  @Post('vocab/import')
  @HttpCode(200)
  importVocab(
    @CurrentUser() user: AuthUser,
    @Query('mode') mode: string | undefined,
    @Query('topic') topic: string | undefined,
    @Query('title') title: string | undefined,
    @Query('setId') setId: string | undefined,
    @Req() req: Request,
  ) {
    const target = mode ? parse(vocabImportTargetSchema, { mode, topic, title, setId }) : null
    return this.study.importVocab(actorOf(user, req), req.body, target)
  }

  @Roles('ADMIN')
  @Post('vocab/sets/:setId/entries')
  createVocabEntry(
    @CurrentUser() user: AuthUser,
    @Param('setId', new ParseUUIDPipe()) setId: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.study.createVocabEntry(actorOf(user, req), setId, body)
  }

  @Roles('ADMIN')
  @Patch('vocab/:id')
  updateVocab(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.study.updateVocab(actorOf(user, req), id, body)
  }

  @Roles('ADMIN')
  @Delete('vocab/:id')
  deleteVocab(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return this.study.deleteVocab(actorOf(user, req), id)
  }

  @Get('reading-marks')
  readingMarks(@CurrentUser() user: AuthUser, @Query('examId') examId: string | undefined) {
    return this.study.listReadingMarks(user.id, typeof examId === 'string' ? examId : '')
  }

  @Post('reading-marks')
  @HttpCode(200)
  saveReadingMark(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.study.saveReadingMark(user.id, body)
  }

  @Delete('reading-marks/:id')
  deleteReadingMark(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.study.deleteReadingMark(user.id, id)
  }

  @Get('notebook/template')
  async notebookTemplate(@Res() res: Response) {
    const file = await this.study.notebookTemplate()
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename="mau-so-tay.xlsx"')
    res.send(file)
  }

  @Post('notebook/import')
  @HttpCode(200)
  importNotebook(@CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.study.importNotebook(user.id, req.body)
  }

  @Get('notebook')
  notebook(@CurrentUser() user: AuthUser) {
    return this.study.listNotebook(user.id)
  }

  @Post('notebook')
  @HttpCode(200)
  saveNotebook(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.study.saveNotebook(user.id, body)
  }

  @Post('notebook/batch')
  @HttpCode(200)
  batchSaveNotebook(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.study.batchSaveNotebook(user.id, body)
  }

  @Patch('notebook/:id')
  updateNotebook(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown) {
    return this.study.updateNotebook(user.id, id, body)
  }

  @Delete('notebook/:id')
  deleteNotebook(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.study.deleteNotebook(user.id, id)
  }

  @Get('flashcards')
  flashcards(
    @CurrentUser() user: AuthUser,
    @Query('deck') deck: string | undefined,
    @Query('setId') setId: string | undefined,
    @Query('unit') unit: string | undefined,
    @Query('topic') topic: string | undefined,
    @Query('color') color: string | undefined,
  ) {
    return this.study.flashcards(user.id, deck === 'notebook' ? 'notebook' : 'catalog', setId, unit, topic, color)
  }

  @Post('flashcards/review')
  @HttpCode(200)
  review(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.study.review(user.id, body)
  }

  @Get('games/status')
  gameStatus(@CurrentUser() user: AuthUser) {
    return this.study.gameStatus(user.id)
  }

  @Post('games/complete')
  @HttpCode(200)
  completeGame(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.study.completeGame(user.id, body)
  }

  @Get('grammar')
  grammar(@CurrentUser() user: AuthUser) {
    return this.study.listGrammar(user.id)
  }

  @Roles('ADMIN')
  @Post('grammar')
  createGrammar(@CurrentUser() user: AuthUser, @Body() body: unknown, @Req() req: Request) {
    return this.study.createGrammar(actorOf(user, req), body)
  }

  @Get('grammar/:id')
  grammarOne(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.study.getGrammar(user.id, id)
  }

  @Roles('ADMIN')
  @Patch('grammar/:id')
  updateGrammar(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown, @Req() req: Request) {
    return this.study.updateGrammar(actorOf(user, req), id, body)
  }

  @Roles('ADMIN')
  @Delete('grammar/:id')
  deleteGrammar(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return this.study.deleteGrammar(actorOf(user, req), id)
  }

  @Roles('TEACHER', 'ADMIN')
  @Post('grammar/:id/pdf')
  @HttpCode(200)
  setPdf(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('filename') filename: string | undefined,
    @Req() req: Request,
  ) {
    const name = typeof filename === 'string' && filename.trim() ? filename.trim() : 'tai-lieu.pdf'
    return this.study.setGrammarPdf(actorOf(user, req), id, req.body, name)
  }

  @Roles('TEACHER', 'ADMIN')
  @Delete('grammar/:id/pdf')
  clearPdf(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return this.study.clearGrammarPdf(actorOf(user, req), id)
  }

  @Get('grammar/:id/pdf')
  async pdf(@Param('id', new ParseUUIDPipe()) id: string, @Res({ passthrough: true }) res: Response) {
    const file = await this.study.readGrammarPdf(id)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', inlinePdfName(file.filename))
    res.setHeader('Cache-Control', 'private, no-store')
    return new StreamableFile(file.bytes)
  }

  @Roles('STUDENT')
  @Post('grammar/:id/progress')
  @HttpCode(200)
  progress(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown) {
    return this.study.setGrammarProgress(user.id, id, body)
  }
}
