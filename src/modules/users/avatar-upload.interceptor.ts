import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  FileTypeValidator,
  Injectable,
  ParseFilePipe,
  PayloadTooLargeException,
  UnprocessableEntityException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImageContentValidator } from '../../common/files/image-content.validator.js';
import { i18nMessage } from '../../common/i18n/i18n-message.js';

// No resizing or compression: the client sends a ready image.
export const AVATAR_MAX_BYTES = 500 * 1024;
export const AVATAR_TYPES = /^image\/(png|jpeg)$/;
export const AVATAR_MAX_DIMENSION = 4096;

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

// The type is read from the file's bytes (magic numbers), not from the
// client's Content-Type, and the detected type replaces the client's: blobs are
// served with it. ImageContentValidator then checks the whole content.
export function avatarFilePipe(): ParseFilePipe {
  return new ParseFilePipe({
    validators: [
      new FileTypeValidator({
        fileType: AVATAR_TYPES,
        overrideMimeType: true,
        errorMessage: 'errors.files.invalidType',
      }),
      new ImageContentValidator({
        maxDimension: AVATAR_MAX_DIMENSION,
        errorMessage: 'errors.files.invalidImage',
      }),
    ],
    exceptionFactory: (error) => {
      if (error === 'errors.files.invalidType') {
        return new UnsupportedMediaTypeException(i18nMessage(error));
      }
      if (error === 'errors.files.invalidImage') {
        return new UnprocessableEntityException(
          i18nMessage(error, { maxPx: AVATAR_MAX_DIMENSION }),
        );
      }
      return new BadRequestException(i18nMessage('errors.files.required'));
    },
  });
}
