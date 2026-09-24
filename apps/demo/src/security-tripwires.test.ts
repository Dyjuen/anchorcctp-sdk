// apps/demo/src/security-tripwires.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SRC = new URL('./', import.meta.url);

function allTsFiles(dir: URL): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? allTsFiles(new URL(e.name + '/', dir)) : e.name.endsWith('.ts') || e.name.endsWith('.tsx') ? [join(dir.pathname, e.name)] : []);
}

describe('tripwires', () => {
  it('no float amount math', () => {
    for (const f of allTsFiles(new URL('./components/', SRC))) {
      if (f.endsWith('depositMachine.test.ts')) continue;
      expect(readFileSync(f, 'utf8')).not.toMatch(/parseFloat.*1_?0{3},?0{3}/);
    }
  });
  it('no dangerouslySetInnerHTML in UI', () => {
    for (const f of allTsFiles(new URL('./components/', SRC))) {
      expect(readFileSync(f, 'utf8')).not.toMatch(/dangerouslySetInnerHTML/);
    }
  });
  it('no Math.random in server or sim path', () => {
    for (const f of allTsFiles(new URL('../server/', SRC))) {
      expect(readFileSync(f, 'utf8')).not.toMatch(/Math\.random\s*\(/);
    }
    for (const f of allTsFiles(new URL('./catalog/', SRC))) {
      if (f.endsWith('.test.ts')) continue;
      expect(readFileSync(f, 'utf8')).not.toMatch(/Math\.random\s*\(/);
    }
  });
  it('no secret material in src or server', () => {
    for (const dir of ['./components/', './wallet/', './config/', './catalog/']) {
      for (const f of allTsFiles(new URL(dir, SRC))) {
        expect(readFileSync(f, 'utf8')).not.toMatch(/S[A-Z2-7]{55}|0x[0-9a-f]{64}/);
      }
    }
    for (const f of allTsFiles(new URL('../server/', SRC))) {
      expect(readFileSync(f, 'utf8')).not.toMatch(/S[A-Z2-7]{55}/);
    }
  });
  it('no VITE_ secret-shaped values in examples', () => {
    for (const f of ['../.env.testnet.example', '../.env.mainnet.example']) {
      const text = readFileSync(new URL(f, SRC), 'utf8');
      expect(text).not.toMatch(/VITE_\w*=\s*S[A-Z2-7]{55}/);
      expect(text).not.toMatch(/VITE_\w*(SECRET|PRIVATE|SEED|MNEMONIC)/i);
    }
  });
});
