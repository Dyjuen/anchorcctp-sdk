import { runCli } from './helpers.js';
import { createServer, Server } from 'node:http';
import { runVerifyCommand } from '../src/commands/verify.js';

describe('anchor-cctp verify', () => {
  let server: Server;
  let port: number;

  beforeAll((done) => {
    server = createServer((req, res) => {
      if (req.url?.includes('/v1/attestations/0xcomplete_tx')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            status: 'complete',
            attestation: '0xmock_attestation_signature',
            message: '0xmock_message_body',
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
      ['verify', '0xcomplete_tx', '--source-domain', '0'],
      { CIRCLE_ATTESTATION_BASE_URL: `http://127.0.0.1:${port}` }
    );
    expect(code).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.txHash).toBe('0xcomplete_tx');
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
       '--tx-hash', '0xcomplete_tx',
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
      '0xpending_timeout_tx',
      '--base-url', `http://127.0.0.1:${port}`,
      '--max-retries', '1',
      '--poll-interval', '10'
    ]);
    expect(code3).toBe(1);
    expect(JSON.parse(stdoutData).code).toBe('ATTESTATION_TIMEOUT');

    stdoutData = '';
    // Direct generic error (e.g. invalid URL)
    const code4 = await runVerifyCommand([
      '0xvalid_hash',
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
