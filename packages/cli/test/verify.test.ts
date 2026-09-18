import { runCli } from './helpers.js';
import { createServer, Server } from 'node:http';
import { runVerifyCommand } from '../src/commands/verify.js';

const COMPLETE_HASH = '0x' + 'ab'.repeat(32);
const PENDING_HASH = '0x' + 'cd'.repeat(32);
const VALID_HASH_1 = '0x' + 'aa'.repeat(32);

describe('anchor-cctp verify', () => {
  let server: Server;
  let port: number;

  beforeAll((done) => {
    server = createServer((req, res) => {
      const url = req.url || '';
      if (url.includes('/v2/messages/') && url.includes(COMPLETE_HASH)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            messages: [
              {
                message: '0x' + 'ab'.repeat(40),
                attestation: '0x' + 'cd'.repeat(70),
                status: 'complete',
              },
            ],
          })
        );
      } else if (req.url?.includes('/v1/attestations/' + COMPLETE_HASH)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            status: 'complete',
            attestation: '0x' + 'cd'.repeat(70),
            message: '0x' + 'ab'.repeat(40),
          })
        );
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'pending' }));
      }
    });

    server.listen(0, () => {
      const addr = server.address();
      if (typeof addr === 'object' && addr !== null) {
        port = addr.port;
      }
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  test('verify returns attestation complete JSON via CLI execution', async () => {
    const { stdout, code } = await runCli(
      ['verify', COMPLETE_HASH, '--source-domain', '0'],
      { CIRCLE_ATTESTATION_BASE_URL: `http://127.0.0.1:${port}` }
    );
    expect(code).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.txHash).toBe(COMPLETE_HASH);
    expect(parsed.attested).toBe(true);
    expect(parsed.status).toBe('complete');
    expect(parsed.destinationDomain).toBe(27);
  });

  test('verify fails with error when txHash is missing via CLI', async () => {
    const { stdout, code } = await runCli(['verify']);
    expect(code).toBe(1);
    const parsed = JSON.parse(stdout);
    expect(parsed.error).toBeDefined();
    expect(parsed.code).toBe('MISSING_ARGUMENT');
    expect(parsed.remediation).toBeDefined();
  });

  test('verify rejects NaN source-domain', async () => {
    const { stdout, code } = await runCli([
      'verify', '0x' + 'aa'.repeat(32), '--source-domain', 'abc'
    ]);
    expect(code).toBe(1);
    const o = JSON.parse(stdout);
    expect(o.code).toBe('INVALID_DOMAIN');
  });

  test('verify rejects unsupported source-domain', async () => {
    const { stdout, code } = await runCli([
      'verify', '0x' + 'aa'.repeat(32), '--source-domain', '9999'
    ]);
    expect(code).toBe(1);
    const o = JSON.parse(stdout);
    expect(o.code).toBe('INVALID_DOMAIN');
  });

  test('verify rejects non-https base-url', async () => {
    const { stdout, code } = await runCli([
      'verify', '0x' + 'aa'.repeat(32), '--base-url', 'http://evil.example.com'
    ]);
    expect(code).toBe(1);
    const o = JSON.parse(stdout);
    expect(o.code).toBe('INVALID_CONFIG');
  });

  test('verify allows http localhost base-url', async () => {
    // http://127.0.0.1 is allowed for local testing — should fail with network error, not INVALID_CONFIG
    let stdoutData = '';
    const writeStdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation((str) => {
      stdoutData += str;
      return true;
    });
    const writeStderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const code = await runVerifyCommand([
      '0x' + 'aa'.repeat(32),
      '--base-url', 'http://127.0.0.1:9999',
      '--max-retries', '1',
      '--poll-interval', '10'
    ]);
    writeStdoutSpy.mockRestore();
    writeStderrSpy.mockRestore();
    // Fails with network error (VERIFY_FAILED or ATTESTATION_TIMEOUT), NOT INVALID_CONFIG
    const o = JSON.parse(stdoutData);
    expect(o.code).not.toBe('INVALID_CONFIG');
  });

  test('verify rejects malformed txHash (no 0x prefix)', async () => {
    const { stdout, code } = await runCli([
      'verify', 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      '--max-retries', '1', '--poll-interval', '10'
    ]);
    expect(code).toBe(1);
    const o = JSON.parse(stdout);
    expect(o.code).toBe('INVALID_HASH');
  });

  test('verify rejects short txHash', async () => {
    const { stdout, code } = await runCli([
      'verify', '0xabc',
      '--max-retries', '1', '--poll-interval', '10'
    ]);
    expect(code).toBe(1);
    const o = JSON.parse(stdout);
    expect(o.code).toBe('INVALID_HASH');
  });

  test('runVerifyCommand direct function execution and error handling', async () => {
    let stdoutData = '';
    const writeStdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation((str) => {
      stdoutData += str;
      return true;
    });
    const writeStderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);

    // Direct missing txHash
    const code1 = await runVerifyCommand([]);
    expect(code1).toBe(1);
    expect(JSON.parse(stdoutData).code).toBe('MISSING_ARGUMENT');

    stdoutData = '';
    // Direct success with source domain flag
    const code2 = await runVerifyCommand([
       '--tx-hash', COMPLETE_HASH,
       '--source-domain', '0',
       '--base-url', `http://127.0.0.1:${port}`,
       '--max-retries', '2',
       '--poll-interval', '10'
    ]);
    expect(code2).toBe(0);
    expect(JSON.parse(stdoutData).status).toBe('complete');

    stdoutData = '';
    // Direct timeout / not found
    const code3 = await runVerifyCommand([
      PENDING_HASH,
      '--base-url', `http://127.0.0.1:${port}`,
      '--max-retries', '1',
      '--poll-interval', '10'
    ]);
    expect(code3).toBe(1);
    expect(JSON.parse(stdoutData).code).toBe('ATTESTATION_TIMEOUT');

    stdoutData = '';
    // Direct generic error (e.g. invalid URL)
    const code4 = await runVerifyCommand([
      VALID_HASH_1,
      '--base-url', 'http://127.0.0.1:1', // invalid port -> connection refused
      '--max-retries', '1',
      '--poll-interval', '1'
    ]);
    expect(code4).toBe(1);
    expect(JSON.parse(stdoutData).code).toBe('ATTESTATION_TIMEOUT');

    writeStdoutSpy.mockRestore();
    writeStderrSpy.mockRestore();
  });
});
