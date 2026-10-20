import { Injectable, Logger } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { BlobStorageService } from '../storage/blob-storage.service.js';
import { HEALTH_TIMEOUT_MS } from './health.constants.js';

@Injectable()
export class StorageHealthIndicator {
  private readonly logger = new Logger(StorageHealthIndicator.name);

  constructor(
    private readonly health: HealthIndicatorService,
    private readonly storage: BlobStorageService,
  ) {}

  check() {
    return this.health
      .check('storage')
      .attempt(async ({ signal }) => {
        try {
          await this.storage.ping(signal);
        } catch (error) {
          // The health response is public, so the details only go to the log.
          this.logger.warn(`Storage check failed: ${(error as Error).message}`);
          throw new Error('Blob storage is unreachable');
        }
      })
      .withTimeout(HEALTH_TIMEOUT_MS);
  }
}
