import sharp from 'sharp';
import { ImageContentValidator } from './image-content.validator.js';

const validator = new ImageContentValidator({
  maxDimension: 100,
  errorMessage: 'errors.files.invalidImage',
});

const blank = (width: number, height: number) =>
  sharp({
    create: { width, height, channels: 3, background: '#3366cc' },
  });

const file = (buffer: Buffer, mimetype: string) =>
  ({ buffer, mimetype, size: buffer.length }) as Express.Multer.File;

describe('ImageContentValidator', () => {
  let png: Buffer;
  let jpeg: Buffer;

  beforeAll(async () => {
    png = await blank(20, 10).png().toBuffer();
    // EXIF adds an APP1 segment, so the JPEG walk is exercised.
    jpeg = await blank(20, 10)
      .withExif({ IFD0: { Copyright: 'IMS test' } })
      .jpeg()
      .toBuffer();
  });

  it('accepts complete PNG and JPEG images', async () => {
    await expect(validator.isValid(file(png, 'image/png'))).resolves.toBe(true);
    await expect(validator.isValid(file(jpeg, 'image/jpeg'))).resolves.toBe(
      true,
    );
  });

  it('rejects data appended after the image (polyglot files)', async () => {
    const html = Buffer.from('<html><script>alert(1)</script></html>');
    await expect(
      validator.isValid(file(Buffer.concat([png, html]), 'image/png')),
    ).resolves.toBe(false);
    // Ends with an EOI marker itself, so only a real segment walk catches it.
    const sneaky = Buffer.concat([jpeg, html, Buffer.from([0xff, 0xd9])]);
    await expect(validator.isValid(file(sneaky, 'image/jpeg'))).resolves.toBe(
      false,
    );
  });

  it('rejects truncated images', async () => {
    await expect(
      validator.isValid(file(png.subarray(0, png.length - 20), 'image/png')),
    ).resolves.toBe(false);
    await expect(
      validator.isValid(file(jpeg.subarray(0, jpeg.length - 40), 'image/jpeg')),
    ).resolves.toBe(false);
  });

  it('rejects corrupted pixel data', async () => {
    const broken = Buffer.from(png);
    const idat = broken.indexOf('IDAT');
    broken[idat + 6] ^= 0xff;
    await expect(validator.isValid(file(broken, 'image/png'))).resolves.toBe(
      false,
    );
  });

  it('rejects images larger than the allowed dimensions', async () => {
    const wide = await blank(101, 5).png().toBuffer();
    await expect(validator.isValid(file(wide, 'image/png'))).resolves.toBe(
      false,
    );
  });
});
