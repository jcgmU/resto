import fs from 'node:fs';
import path from 'node:path';

const serviceDir = process.cwd();
const source = path.join(serviceDir, 'src', 'generated');
const target = path.join(serviceDir, 'dist', 'generated');

if (!fs.existsSync(source)) {
  console.error(`[copy-generated-client] No existe ${source}: ejecuta "prisma generate" primero.`);
  process.exit(1);
}

fs.cpSync(source, target, { recursive: true });
console.log(`[copy-generated-client] ${path.relative(serviceDir, source)} -> ${path.relative(serviceDir, target)}`);
