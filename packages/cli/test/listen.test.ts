import { runCli } from './helpers.js';

describe('anchor-cctp listen', () => {
  test('listen fails when address is missing', async () => {
    const { stdout, code } = await runCli(['listen']);
    expect(code).toBe(1);
    const parsed = JSON.parse(stdout);
    expect(parsed.error).toBeDefined();
    expect(parsed.code).toBe('MISSING_ARGUMENT');
    expect(parsed.remediation).toBeDefined();
  });

  test('listen outputs NDJSON events stream for a valid address', async () => {
    const address = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
    const { stdout, code } = await runCli([
      'listen',
      address,
      '--limit', '2',
      '--simulate'
    ]);
    expect(code).toBe(0);
    const lines = stdout.trim().split('\n').filter((l) => l.trim().length > 0);
    expect(lines.length).toBeGreaterThanOrEqual(2);

    const event1 = JSON.parse(lines[0]);
    expect(event1.event).toBe('inbound_burn_detected');
    expect(event1.sourceChain).toBeDefined();
    expect(event1.sourceDomain).toBeDefined();
    expect(event1.amount).toBeDefined();

    const event2 = JSON.parse(lines[1]);
    expect(event2.event).toBe('settled');
    expect(event2.destination).toBe(address);
    expect(event2.txHash).toBeDefined();
  });
});
