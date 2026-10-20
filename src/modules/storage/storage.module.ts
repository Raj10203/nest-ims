import { Module } from '@nestjs/common';
import { BlobStorageService } from './blob-storage.service.js';
import { StorageConfigurableModule } from './storage.module-definition.js';

// Global: features inject BlobStorageService without importing this module.
@Module({
  providers: [BlobStorageService],
  exports: [BlobStorageService],
})
export class StorageModule extends StorageConfigurableModule {}
