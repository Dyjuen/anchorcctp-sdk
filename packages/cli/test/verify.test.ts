import { runCli } from './helpers.js';
import { createServer, Server } from 'node:http';

describe('anchor-cctp verify', () => {
  let server: Server;
  let port: number;

  beforeAll((done) => {
    server = createServer((req, res) => {
      if (req.url?.includes('/v1/attestations/0xcomplete_tx')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'complete',
          attestation: '0xmock_attestation_signature',
          message: '0xmock_message_body'
        }));
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

  test('verify returns attestation complete JSON', async () => {
    const { stdout, code } = await runCli(
      ['verify', '0xcomplete_tx'],
      { CIRCLE_ATTESTATION_BASE_URL: `http://127.0.0.1:${port}` }
    );
    expect(code).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.txHash).toBe('0xcomplete_tx');
    expect(parsed.attested).toBe(true);
    expect(parsed.status).toBe('complete');
    expect(parsed.destinationDomain).toBe(27);
  });

  test('verify fails with error when txHash is missing', async () => {
    const { stdout, code } = await runCli(['verify']);
    expect(code).toBe(1);
    const parsed = JSON.parse(stdout);
    expect(parsed.error).toBeDefined();
    expect(parsed.code).toBe('MISSING_ARGUMENT');
    expect(parsed.remediation).toBeDefined();
  });
});
