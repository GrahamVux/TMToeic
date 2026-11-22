import { Module } from '@nestjs/common'
import { ClassesController } from './classes.controller'
import { AvatarController } from './avatar.controller'
import { ClassesService } from './classes.service'
import { UsersController } from './users.controller'
import { UsersService } from './users.service'

@Module({
  controllers: [UsersController, ClassesController, AvatarController],
  providers: [UsersService, ClassesService],
  exports: [UsersService],
})
export class UsersModule {}
