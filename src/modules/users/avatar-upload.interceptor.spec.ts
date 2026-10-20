import sharp from 'sharp';
import { avatarFilePipe } from './avatar-upload.interceptor.js';

const file = (buffer: Buffer, mimetype: string) =>
  ({ buffer, mimetype, size: buffer.length }) as Express.Multer.File;

const blank = () =>
  sharp({ create: { width: 8, height: 8, channels: 3, background: '#fff' } });

describe('avatarFilePipe', () => {
  let png: Buffer;
  let jpeg: Buffer;
  let gif: Buffer;

  beforeAll(async () => {
    png = await blank().png().toBuffer();
    jpeg = await blank().jpeg().toBuffer();
    gif = await blank().gif().toBuffer();
  });

  it('accepts a PNG and stores the type read from its bytes', async () => {
    const result = await avatarFilePipe().transform(
      file(png, 'application/octet-stream'),
    );
    expect(result.mimetype).toBe('image/png');
  });

  it('accepts a JPEG', async () => {
    const result = await avatarFilePipe().transform(file(jpeg, 'image/jpeg'));
    expect(result.mimetype).toBe('image/jpeg');
  });

  it('rejects a GIF or an HTML page claiming to be a PNG with 415', async () => {
    for (const buffer of [
      gif,
      Buffer.from('<html><script>x</script></html>'),
    ]) {
      await expect(
        avatarFilePipe().transform(file(buffer, 'image/png')),
      ).rejects.toMatchObject({
        status: 415,
        message: 'errors.files.invalidType',
      });
    }
  });

  it('rejects a real PNG carrying a hidden payload with 422', async () => {
    const polyglot = Buffer.concat([png, Buffer.from('<script>x</script>')]);
    await expect(
      avatarFilePipe().transform(file(polyglot, 'image/png')),
    ).rejects.toMatchObject({
      status: 422,
      message: 'errors.files.invalidImage',
    });
  });

  it('asks for a file when none was sent', async () => {
    await expect(avatarFilePipe().transform(undefined)).rejects.toMatchObject({
      status: 400,
      message: 'errors.files.required',
    });
  });
});
