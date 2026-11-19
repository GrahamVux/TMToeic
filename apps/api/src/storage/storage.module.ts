import { Global, Module } from '@nestjs/common'
import { AssetStoreService } from './asset-store.service'
import { StorageService } from './storage.service'

@Global()
@Module({ providers: [StorageService, AssetStoreService], exports: [StorageService, AssetStoreService] })
export class StorageModule {}
