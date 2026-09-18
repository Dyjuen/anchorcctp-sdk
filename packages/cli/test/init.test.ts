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
      '--usdc-issuer', 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      '--forwarder', 'CA66Q2WFBND6V4UEB7RD4SAXSVIWMD6RA4X3U32ELVFGXV5PJK4T4VSZ',
      '--dust-collector', 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
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

  test('init rejects invalid dust collector StrKey', async () => {
    const { stdout, code } = await runCli([
      'init',
      '--dust-collector', 'GDDUSTCOLLECTOR00000000000000000000000000000000000000000000',
      '--output', out
    ]);
    expect(code).toBe(1);
    const o = JSON.parse(stdout);
    expect(o.code).toBe('INVALID_CONFIG');
  });

  test('init rejects invalid usdc-issuer StrKey', async () => {
    const { stdout, code } = await runCli([
      'init',
      '--usdc-issuer', 'INVALIDISSUER',
      '--output', out
    ]);
    expect(code).toBe(1);
    const o = JSON.parse(stdout);
    expect(o.code).toBe('INVALID_CONFIG');
  });

  test('init rejects invalid forwarder StrKey', async () => {
    const { stdout, code } = await runCli([
      'init',
      '--forwarder', 'NOT_A_FORWARDER',
      '--output', out
    ]);
    expect(code).toBe(1);
    const o = JSON.parse(stdout);
    expect(o.code).toBe('INVALID_CONFIG');
  });

  test('init rejects quotes and newlines in address values', async () => {
    const { code: code1 } = await runCli(['init', '--usdc-issuer', 'G"INJECT', '--output', out]);
    expect(code1).toBe(1);
    const { code: code2 } = await runCli(['init', '--usdc-issuer', "G'INJECT", '--output', out]);
    expect(code2).toBe(1);
  });

  test('init blocks path traversal without --force', async () => {
    const { stdout, code } = await runCli([
      'init',
      '--output', '../../tmp/evil.toml'
    ]);
    expect(code).toBe(1);
    const o = JSON.parse(stdout);
    expect(o.code).toBe('PATH_SECURITY');
  });

  test('init refuses to overwrite existing file without --force', async () => {
    const { writeFileSync } = require('node:fs');
    writeFileSync(out, 'existing', 'utf8');
    const { stdout, code } = await runCli(['init', '--output', out]);
    expect(code).toBe(1);
    const o = JSON.parse(stdout);
    expect(o.code).toBe('FILE_EXISTS');
    const { unlinkSync } = require('node:fs');
    unlinkSync(out);
  });

  test('init uses testnet forwarder default (CA66... not CDLZ...)', async () => {
    const { stdout, code } = await runCli(['init', '--output', out]);
    expect(code).toBe(0);
    const o = JSON.parse(stdout);
    expect(o.configBlock).toContain('CA66Q2WFBND6V4UEB7RD4SAXSVIWMD6RA4X3U32ELVFGXV5PJK4T4VSZ');
    expect(o.configBlock).not.toContain('CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC');
    const { unlinkSync } = require('node:fs');
    unlinkSync(out);
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

    // All flags with valid StrKeys
    const code = await runInitCommand([
      '--domain', '27',
      '--usdc-issuer', 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      '--forwarder', 'CA66Q2WFBND6V4UEB7RD4SAXSVIWMD6RA4X3U32ELVFGXV5PJK4T4VSZ',
      '--dust-collector', 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
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
