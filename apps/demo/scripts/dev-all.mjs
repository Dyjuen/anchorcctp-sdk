// Spawns event server + vite together. Ctrl+C stops both.
// Real mode default (SIM_MODE=false): server needs STELLAR_SECRET.
// Maps repo root .env.testnet (STELLAR_TESTNET_*) when STELLAR_SECRET is unset.
import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverEnv = { ...process.env };
if ((serverEnv.SIM_MODE ?? 'false').toLowerCase() !== 'true' && !serverEnv.STELLAR_SECRET) {
  const testnetEnv = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '.env.testnet');
  if (existsSync(testnetEnv)) {
    for (const line of readFileSync(testnetEnv, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i > 0) serverEnv[t.slice(0, i)] ??= t.slice(i + 1);
    }
    serverEnv.STELLAR_SECRET ??= serverEnv.STELLAR_TESTNET_SECRET;
    serverEnv.STELLAR_DESTINATION ??= serverEnv.STELLAR_TESTNET_DESTINATION;
    serverEnv.STELLAR_NETWORK ??= 'testnet';
    serverEnv.SOROBAN_RPC_URL ??= 'https://soroban-testnet.stellar.org';
    serverEnv.HORIZON_URL ??= 'https://horizon-testnet.stellar.org';
    console.log('[dev-all] real mode: mapped STELLAR_TESTNET_* from root .env.testnet');
  }
}

const procs = [
  spawn('node', ['dist-server/serve.cjs'], {
    env: { ...serverEnv, SIM_MODE: serverEnv.SIM_MODE ?? 'false', PORT: serverEnv.PORT ?? '3001' },
    stdio: 'inherit',
  }),
  spawn('npx', ['vite'], { env: process.env, stdio: 'inherit', shell: true }),
];

const kill = () => { for (const p of procs) p.kill('SIGINT'); };
process.on('SIGINT', () => { kill(); process.exit(0); });
process.on('exit', kill);
for (const p of procs) {
  p.on('exit', (code) => {
    if (code !== 0 && code !== null) { kill(); process.exit(code); }
  });
}
