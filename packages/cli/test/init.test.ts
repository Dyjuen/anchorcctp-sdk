import { runCli } from './helpers.js';
import { readFileSync, unlinkSync, existsSync } from 'node:fs';

describe('anchor-cctp init', () => {
  const out = '/tmp/cctp-test-stellar.toml';

  afterEach(() => {
    if (existsSync(out)) {
      unlinkSync(out);
    }
  });

  test('init writes stellar.toml CCTP block', async () => {
    const { stdout, code } = await runCli([
      'init',
      '--domain', '27',
      '--usdc-issuer', 'GBISSUER1234567890123456789012345678901234567890123456789012',
      '--output', out
    ]);
    expect(code).toBe(0);
    const o = JSON.parse(stdout);
    expect(o.success).toBe(true);
    expect(o.writtenPath).toBe(out);
    expect(o.configBlock).toContain('CURRENCIES');
    expect(readFileSync(out, 'utf8')).toContain('CURRENCIES');
    expect(readFileSync(out, 'utf8')).toContain('cctp_domain = 27');
  });

  test('init fails with invalid domain ID', async () => {
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
});
