import { Inject, Injectable, Logger } from '@nestjs/common';
import { BlobServiceClient, type ContainerClient } from '@azure/storage-blob';
import {
  STORAGE_OPTIONS,
  type StorageOptions,
} from './storage.module-definition.js';

@Injectable()
export class BlobStorageService {
  private readonly logger = new Logger(BlobStorageService.name);
  private readonly container: ContainerClient;
  private readonly baseUrl: string;
  private containerReady?: Promise<unknown>;

  constructor(@Inject(STORAGE_OPTIONS) options: StorageOptions) {
    this.container = BlobServiceClient.fromConnectionString(
      options.connectionString,
    ).getContainerClient(options.container);
    this.baseUrl = options.publicUrl
      ? `${options.publicUrl.replace(/\/+$/, '')}/${options.container}`
      : this.container.url;
  }

  // Names must be unique: browsers cache each blob for a year.
  async upload(
    name: string,
    data: Buffer,
    contentType: string,
  ): Promise<string> {
    await this.ensureContainer();
    await this.container.getBlockBlobClient(name).uploadData(data, {
      blobHTTPHeaders: {
        blobContentType: contentType,
        blobCacheControl: 'public, max-age=31536000, immutable',
      },
    });
    return `${this.baseUrl}/${name}`;
  }

  // Best effort: a leftover blob is harmless, a failed request because of it is not.
  async deleteByUrl(url: string): Promise<void> {
    if (!url.startsWith(`${this.baseUrl}/`)) return;
    const name = decodeURIComponent(url.slice(this.baseUrl.length + 1));
    try {
      await this.container.deleteBlob(name, { deleteSnapshots: 'include' });
    } catch (error) {
      this.logger.warn(
        `Could not delete blob ${name}: ${(error as Error).message}`,
      );
    }
  }

  async ping(abortSignal: AbortSignal): Promise<void> {
    await this.container.exists({ abortSignal });
  }

  // Lazily, so the API starts even when storage is down. In production create the
  // container beforehand with anonymous read access for blobs: the stored URLs are
  // opened directly by browsers.
  private ensureContainer(): Promise<unknown> {
    this.containerReady ??= this.container
      .createIfNotExists({ access: 'blob' })
      .catch((error: unknown) => {
        this.containerReady = undefined;
        throw error;
      });
    return this.containerReady;
  }
}
