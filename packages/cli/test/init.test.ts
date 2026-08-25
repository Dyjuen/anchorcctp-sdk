import { runCli } from './helpers.js';
import { readFileSync, unlinkSync, existsSync } from 'node:fs';
import { runInitCommand } from '../src/commands/init.js';

describe('anchor-cctp init', () => {
  const out = '/tmp/cctp-test-stellar.toml';

  afterEach(() => {
    if (existsSync(out)) {
      unlinkSync(out);
    }
  });

  test('init writes stellar.toml CCTP block with custom params via CLI', async () => {
    const { stdout, code } = await runCli([
      'init',
      '--domain', '27',
      '--usdc-issuer', 'GBISSUER1234567890123456789012345678901234567890123456789012',
      '--forwarder', 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
      '--dust-collector', 'GDDUST1234567890123456789012345678901234567890123456789012',
      '--output', out
    ]);
    expect(code).toBe(0);
    const o = JSON.parse(stdout);
    expect(o.success).toBe(true);
    expect(o.writtenPath).toBe(out);
    expect(o.configBlock).toContain('CURRENCIES');
    expect(readFileSync(out, 'utf8')).toContain('cctp_domain = 27');
    expect(readFileSync(out, 'utf8')).toContain('FORWARDER_ADDRESS');
  });

  test('init fails with invalid domain ID via CLI', async () => {
    const { stdout, code } = await runCli([
      'init',
      '--domain', '9999',
      '--output', out
    ]);
    expect(code).toBe(1);
    const o = JSON.parse(stdout);
    expect(o.error).toBeDefined();
    expect(o.code).toBe('INVALID_DOMAIN');
    expect(o.remediation).toBeDefined();
  });

  test('runInitCommand direct function execution with flags and error branches', async () => {
    let stdoutData = '';
    let stderrData = '';
    const writeStdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation((str) => {
      stdoutData += str;
      return true;
    });
    const writeStderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation((str) => {
      stderrData += str;
      return true;
    });

    // All flags
    const code = await runInitCommand([
      '--domain', '27',
      '--usdc-issuer', 'GBISSUER123',
      '--forwarder', 'CDLZFC3',
      '--dust-collector', 'GDDUST123',
      '--output', out,
    ]);
    expect(code).toBe(0);
    const o = JSON.parse(stdoutData);
    expect(o.success).toBe(true);
    expect(o.writtenPath).toBe(out);

    stdoutData = '';
    // Direct invalid domain
    const invalidDomainCode = await runInitCommand(['--domain', '9999']);
    expect(invalidDomainCode).toBe(1);
    expect(JSON.parse(stdoutData).code).toBe('INVALID_DOMAIN');

    stdoutData = '';
    // Test write error on invalid file path containing null character
    const errCode = await runInitCommand(['--output', '\0illegal_path.toml']);
    expect(errCode).toBe(1);
    const errObj = JSON.parse(stdoutData);
    expect(errObj.code).toBe('WRITE_ERROR');

    writeStdoutSpy.mockRestore();
    writeStderrSpy.mockRestore();
  });
});
