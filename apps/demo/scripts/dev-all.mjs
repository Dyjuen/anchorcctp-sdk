// Spawns event server (SIM_MODE) + vite together. Ctrl+C stops both.
import { spawn } from 'node:child_process';

const procs = [
  spawn('node', ['dist-server/serve.cjs'], {
    env: { ...process.env, SIM_MODE: process.env.SIM_MODE ?? 'true', PORT: process.env.PORT ?? '3001' },
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
