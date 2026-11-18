import fs from 'fs';
import path from 'path';

interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
}

const publicDir = path.resolve(__dirname, '../public');
const manifest = JSON.parse(fs.readFileSync(path.join(publicDir, 'manifest.json'), 'utf8'));
const icons: ManifestIcon[] = manifest.icons;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function pngSize(file: string): { width: number; height: number } {
  const header = fs.readFileSync(file).subarray(0, 24);
  expect(header.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
  expect(header.subarray(12, 16).toString('ascii')).toBe('IHDR');
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
}

const purposes = (icon: ManifestIcon) => (icon.purpose ?? 'any').split(/\s+/);
const filePath = (icon: ManifestIcon) => path.join(publicDir, icon.src.replace(/^\//, ''));

describe('manifest de la PWA', () => {
  test('identidad estable y alcance coherente', () => {
    expect(manifest.id).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(manifest.start_url).toBe('/');
    expect(manifest.start_url.startsWith(manifest.scope)).toBe(true);
    expect(manifest.display).toBe('standalone');
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.background_color).toBe('#ECEEE6');
    expect(manifest.theme_color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  test('todos los iconos existen y las rutas son absolutas', () => {
    for (const icon of icons) {
      expect(icon.src.startsWith('/')).toBe(true);
      expect(fs.existsSync(filePath(icon))).toBe(true);
    }
  });

  test('los tamaños declarados coinciden con la cabecera real de cada PNG', () => {
    const pngs = icons.filter((icon) => icon.type === 'image/png');
    expect(pngs.length).toBeGreaterThanOrEqual(4);
    for (const icon of pngs) {
      const { width, height } = pngSize(filePath(icon));
      expect(icon.sizes).toBe(`${width}x${height}`);
      expect(width).toBe(height);
    }
  });

  test('192 y 512 existen como any y como maskable, nunca combinados', () => {
    for (const icon of icons) {
      const list = purposes(icon);
      expect(list.includes('any') && list.includes('maskable')).toBe(false);
    }
    for (const size of ['192x192', '512x512']) {
      for (const purpose of ['any', 'maskable']) {
        const match = icons.filter((i) => i.type === 'image/png' && i.sizes === size && purposes(i).includes(purpose));
        expect(match).toHaveLength(1);
      }
    }
  });

  test('el icono maskable es un archivo distinto del any', () => {
    for (const size of ['192x192', '512x512']) {
      const any = icons.find((i) => i.sizes === size && purposes(i).includes('any') && i.type === 'image/png')!;
      const maskable = icons.find((i) => i.sizes === size && purposes(i).includes('maskable') && i.type === 'image/png')!;
      expect(any.src).not.toBe(maskable.src);
      expect(fs.readFileSync(filePath(any)).equals(fs.readFileSync(filePath(maskable)))).toBe(false);
    }
  });

  test('el layout enlaza el manifest y usa iconos que existen', () => {
    const layout = fs.readFileSync(path.resolve(__dirname, '../src/app/layout.tsx'), 'utf8');
    expect(layout).toContain("manifest: '/manifest.json'");
    for (const match of layout.matchAll(/(?:icon|apple): '(\/[^']+)'/g)) {
      expect(fs.existsSync(path.join(publicDir, match[1].replace(/^\//, '')))).toBe(true);
    }
  });
});
