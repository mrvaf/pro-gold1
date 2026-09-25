import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkgRoot = path.resolve(__dirname, '..');

const srcMigrations = path.join(pkgRoot, 'src', 'migrations');
const distMigrations = path.join(pkgRoot, 'dist', 'migrations');

if (fs.existsSync(distMigrations)) {
  fs.rmSync(distMigrations, { recursive: true, force: true });
}

if (fs.existsSync(srcMigrations)) {
  fs.cpSync(srcMigrations, distMigrations, { recursive: true });
}
