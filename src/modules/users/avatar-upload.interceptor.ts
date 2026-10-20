import {
  CallHandler,
  ExecutionContext,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { i18nMessage } from '../../common/i18n/i18n-message.js';

// The only check on an avatar: no type check and no resizing (the client sends
// a ready image).
export const AVATAR_MAX_BYTES = 500 * 1024;

// Multer stops reading at the limit, so an oversized upload is never held in
// memory in full. Its English 413 is re-thrown with a translatable message.
@Injectable()
export class AvatarUploadInterceptor extends FileInterceptor('file', {
  limits: { fileSize: AVATAR_MAX_BYTES, files: 1 },
}) {
  async intercept(context: ExecutionContext, next: CallHandler) {
    try {
      return await super.intercept(context, next);
    } catch (error) {
      if (error instanceof PayloadTooLargeException) {
        throw new PayloadTooLargeException(
          i18nMessage('errors.files.tooLarge', {
            maxKb: AVATAR_MAX_BYTES / 1024,
          }),
        );
      }
      throw error;
    }
  }
}
