import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

export interface CliResult {
  stdout: string;
  stderr: string;
  code: number;
}

export function runCli(args: string[], env: Record<string, string> = {}): Promise<CliResult> {
  const cliPath = resolve(__dirname, '../dist/index.js');
  return new Promise((res) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      env: { ...process.env, ...env }
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    child.on('close', (code) => {
      res({ stdout, stderr, code: code ?? 0 });
    });
  });
}
