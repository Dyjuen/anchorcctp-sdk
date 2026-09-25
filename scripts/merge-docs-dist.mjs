// Merge built docs (apps/docs/.vitepress/dist) into demo dist at /docs.
// Cross-platform. Run after both builds. Fails loud on missing dist.
import { cpSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(root, 'apps', 'docs', '.vitepress', 'dist');
const to = join(root, 'apps', 'demo', 'dist', 'docs');

if (!existsSync(from)) {
  console.error(`[merge-docs] missing docs dist: ${from}. Run build:docs first.`);
  process.exit(1);
}
cpSync(from, to, { recursive: true });
console.log(`[merge-docs] docs merged: ${from} -> ${to}`);
