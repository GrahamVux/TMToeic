import { Global, Module } from '@nestjs/common'
import { AssetStoreService } from './asset-store.service'
import { LocalObjectController } from './local-object.controller'
import { StorageService } from './storage.service'

@Global()
@Module({ controllers: [LocalObjectController], providers: [StorageService, AssetStoreService], exports: [StorageService, AssetStoreService] })
export class StorageModule {}
