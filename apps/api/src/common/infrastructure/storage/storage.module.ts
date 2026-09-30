import { Global, Module } from '@nestjs/common';
import { LocalStorageService } from './local-storage.service';
import { STORAGE_ADAPTER_TOKEN } from './storage.token';

@Global()
@Module({
  providers: [{ provide: STORAGE_ADAPTER_TOKEN, useClass: LocalStorageService }],
  exports: [STORAGE_ADAPTER_TOKEN],
})
export class StorageModule {}
