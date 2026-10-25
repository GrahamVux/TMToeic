import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common'
import { assignClassSchema, createClassBodySchema, renameClassSchema, setClassTeachersSchema } from '@toeic/shared'
import { CurrentUser, Roles, type AuthUser } from '../common/decorators'
import { parse } from '../common/zod'
import { ClassesService } from './classes.service'

@Controller('classes')
export class ClassesController {
  constructor(private readonly classes: ClassesService) {}

  @Roles('TEACHER', 'ADMIN')
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.classes.list(user)
  }

  @Roles('ADMIN')
  @Post()
  create(@Body() body: unknown) {
    return this.classes.create(parse(createClassBodySchema, body))
  }

  @Roles('ADMIN')
  @Patch(':id')
  rename(@Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown) {
    return this.classes.rename(id, parse(renameClassSchema, body))
  }

  @Roles('ADMIN')
  @Put('members')
  async assign(@Body() body: unknown) {
    await this.classes.assign(parse(assignClassSchema, body))
    return { ok: true }
  }

  @Roles('ADMIN')
  @Post(':id/honor-reset')
  resetHonor(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.classes.resetHonor(id)
  }

  @Roles('ADMIN')
  @Put(':id/teachers')
  setTeachers(@Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown) {
    return this.classes.setTeachers(id, parse(setClassTeachersSchema, body))
  }
}
