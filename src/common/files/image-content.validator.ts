import { FileValidator } from '@nestjs/common';
import sharp from 'sharp';

export interface ImageContentOptions {
  maxDimension: number;
  errorMessage: string;
}

// Run after FileTypeValidator (which only reads the first bytes). Accepts the
// file only when it is exactly one complete, decodable PNG or JPEG:
// - nothing after the image's end marker, where polyglot payloads (HTML,
//   scripts, archives) are hidden;
// - width and height within maxDimension, read from the header before
//   decoding, so a decompression bomb is refused cheaply;
// - every pixel decodes in strict mode, so truncated or corrupt data fails.
export class ImageContentValidator extends FileValidator<
  ImageContentOptions,
  Express.Multer.File
> {
  buildErrorMessage(): string {
    return this.validationOptions.errorMessage;
  }

  async isValid(file?: Express.Multer.File): Promise<boolean> {
    if (!file?.buffer) return false;
    const end =
      file.mimetype === 'image/png'
        ? pngEnd(file.buffer)
        : jpegEnd(file.buffer);
    if (end !== file.buffer.length) return false;

    const { maxDimension } = this.validationOptions;
    try {
      const image = sharp(file.buffer, {
        failOn: 'warning',
        limitInputPixels: maxDimension * maxDimension,
      });
      const { width, height } = await image.metadata();
      if (!width || !height || width > maxDimension || height > maxDimension) {
        return false;
      }
      await image.stats();
      return true;
    } catch {
      return false;
    }
  }
}

// Offset just after the IEND chunk, or null when the chunk list is broken.
function pngEnd(buffer: Buffer): number | null {
  let offset = 8;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('latin1', offset + 4, offset + 8);
    offset += 12 + length;
    if (type === 'IEND') return offset;
  }
  return null;
}

// Offset just after the EOI marker. Walks the segments (skipping the
// entropy-coded scan data) instead of trusting the last two bytes, which a
// payload could end with too.
function jpegEnd(buffer: Buffer): number | null {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let i = 2;
  while (i + 1 < buffer.length) {
    if (buffer[i] !== 0xff) return null;
    const marker = buffer[i + 1];
    if (marker === 0xff) {
      i += 1;
      continue;
    }
    if (marker === 0xd9) return i + 2;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    if (i + 4 > buffer.length) return null;
    i += 2 + buffer.readUInt16BE(i + 2);
    if (marker === 0xda) {
      // Scan data runs until the next marker that is not a stuffed 0xFF00 or
      // a restart marker.
      while (
        i + 1 < buffer.length &&
        !(
          buffer[i] === 0xff &&
          buffer[i + 1] !== 0x00 &&
          !(buffer[i + 1] >= 0xd0 && buffer[i + 1] <= 0xd7)
        )
      ) {
        i += 1;
      }
    }
  }
  return null;
}
