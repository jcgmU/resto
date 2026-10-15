import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { createCatalogApp } from '../../src/app';
import {
  ensureContractEnv,
  getTestPrisma,
  disconnectTestPrisma,
} from './contract-helper';
import { PrismaCategoryRepository } from '../../src/infrastructure/persistence/PrismaCategoryRepository';
import { PrismaProductRepository } from '../../src/infrastructure/persistence/PrismaProductRepository';
import { PrismaModifierGroupRepository } from '../../src/infrastructure/persistence/PrismaModifierGroupRepository';

describe('Uploads Contract Tests (POST /uploads & GET /uploads/:file)', () => {
  let app: any;
  const testUploadDir = path.join(__dirname, '../../test-uploads-contract');

  beforeAll(async () => {
    await ensureContractEnv();
    const prisma = getTestPrisma();

    // Limpiar dir de prueba si existe
    if (fs.existsSync(testUploadDir)) {
      fs.rmSync(testUploadDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testUploadDir, { recursive: true });

    app = await createCatalogApp({
      categoryRepo: new PrismaCategoryRepository(prisma),
      productRepo: new PrismaProductRepository(prisma),
      modifierGroupRepo: new PrismaModifierGroupRepository(prisma),
      uploadDir: testUploadDir,
    });
  });

  afterAll(async () => {
    if (fs.existsSync(testUploadDir)) {
      fs.rmSync(testUploadDir, { recursive: true, force: true });
    }
    await disconnectTestPrisma();
  });

  it('1. Subida de imagen PNG por ADMIN guarda archivo y devuelve URL relativa /uploads/<filename>', async () => {
    const pngBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // Header PNG
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    ]);

    const res = await request(app)
      .post('/uploads')
      .set('x-user-role', 'ADMIN')
      .attach('file', pngBuffer, 'test-image.png');

    expect(res.status).toBe(201);
    expect(res.body.url).toMatch(/^\/uploads\/[a-zA-Z0-9-]+\.png$/);

    const filename = path.basename(res.body.url);
    const savedPath = path.join(testUploadDir, filename);
    expect(fs.existsSync(savedPath)).toBe(true);
  });

  it('2. Subida de imagen WebP por MANAGER guarda archivo y devuelve URL relativa', async () => {
    const webpBuffer = Buffer.from('RIFF....WEBPVP8 ');

    const res = await request(app)
      .post('/uploads')
      .set('x-user-role', 'MANAGER')
      .attach('file', webpBuffer, 'plato.webp');

    expect(res.status).toBe(201);
    expect(res.body.url).toMatch(/^\/uploads\/[a-zA-Z0-9-]+\.webp$/);
  });

  it('3. GET /uploads/:file público sirve el contenido estático con el mimetype correcto', async () => {
    const testContent = Buffer.from('fake-jpeg-data-content-12345');
    const resUpload = await request(app)
      .post('/uploads')
      .set('x-user-role', 'ADMIN')
      .attach('file', testContent, 'hamburguesa.jpg');

    expect(resUpload.status).toBe(201);
    const url = resUpload.body.url;

    // GET público sin headers de auth ni internal token
    const resGet = await request(app).get(url);
    expect(resGet.status).toBe(200);
    expect(resGet.headers['content-type']).toMatch(/image\/jpeg/);
    expect(resGet.body).toEqual(testContent);
  });

  it('4. Archivos mayores a 2 MB son rechazados con HTTP 400 BAD_REQUEST', async () => {
    // 2.2 MB buffer
    const largeBuffer = Buffer.alloc(2.2 * 1024 * 1024, 0xaa);

    const res = await request(app)
      .post('/uploads')
      .set('x-user-role', 'ADMIN')
      .attach('file', largeBuffer, 'huge-photo.png');

    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe('BAD_REQUEST');
  });

  it('5. Mimetypes no permitidos (ej. text/plain, application/pdf) responden HTTP 400 BAD_REQUEST', async () => {
    const textBuffer = Buffer.from('console.log("malicious code");');

    const res = await request(app)
      .post('/uploads')
      .set('x-user-role', 'ADMIN')
      .attach('file', textBuffer, 'script.txt');

    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe('BAD_REQUEST');
  });

  it('6. Solicitud sin archivo adjunto responde HTTP 400 BAD_REQUEST', async () => {
    const res = await request(app)
      .post('/uploads')
      .set('x-user-role', 'ADMIN');

    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe('BAD_REQUEST');
  });

  it('7. Solicitud sin rol o con rol STAFF es rechazada con HTTP 403 FORBIDDEN', async () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

    // Guest / sin rol
    const resGuest = await request(app)
      .post('/uploads')
      .attach('file', pngBuffer, 'test.png');

    expect(resGuest.status).toBe(403);
    expect(resGuest.body.error?.code).toBe('FORBIDDEN');

    // Rol STAFF
    const resStaff = await request(app)
      .post('/uploads')
      .set('x-user-role', 'STAFF')
      .attach('file', pngBuffer, 'test.png');

    expect(resStaff.status).toBe(403);
    expect(resStaff.body.error?.code).toBe('FORBIDDEN');
  });

  it('8. GET /uploads/:file de archivo inexistente responde HTTP 404 NOT_FOUND', async () => {
    const res = await request(app).get('/uploads/no-existe-12345.png');
    expect(res.status).toBe(404);
    expect(res.body.error?.code).toBe('NOT_FOUND');
  });
});
