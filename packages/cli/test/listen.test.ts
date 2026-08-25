import { runCli } from './helpers.js';
import { runListenCommand } from '../src/commands/listen.js';

describe('anchor-cctp listen', () => {
  const validAddress = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

  test('listen fails when address is missing via CLI', async () => {
    const { stdout, code } = await runCli(['listen']);
    expect(code).toBe(1);
    const parsed = JSON.parse(stdout);
    expect(parsed.error).toBeDefined();
    expect(parsed.code).toBe('MISSING_ARGUMENT');
    expect(parsed.remediation).toBeDefined();
  });

  test('listen outputs NDJSON events stream for a valid address via CLI', async () => {
    const { stdout, code } = await runCli([
      'listen',
      validAddress,
      '--limit', '2',
      '--simulate',
      '--rate-limit', '10'
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
    expect(event2.destination).toBe(validAddress);
    expect(event2.txHash).toBeDefined();
  });

  test('runListenCommand direct function execution and address validation', async () => {
    let stdoutData = '';
    const writeStdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation((str) => {
      stdoutData += str;
      return true;
    });
    const writeStderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);

    // Direct missing address
    const code1 = await runListenCommand([]);
    expect(code1).toBe(1);
    expect(JSON.parse(stdoutData).code).toBe('MISSING_ARGUMENT');

    stdoutData = '';
    // Direct invalid address
    const code2 = await runListenCommand(['invalid_addr']);
    expect(code2).toBe(1);
    expect(JSON.parse(stdoutData).code).toBe('INVALID_ADDRESS');

    stdoutData = '';
    // Direct simulate stream with rate-limit and poll-interval
    const code3 = await runListenCommand([
      '--address', validAddress,
      '--simulate',
      '--limit', '2',
      '--poll-interval', '10',
      '--rate-limit', '50'
    ]);
    expect(code3).toBe(0);
    const lines = stdoutData.trim().split('\n');
    expect(lines.length).toBe(2);

    stdoutData = '';
    // Direct non-simulate live loop with limit 0
    const code4 = await runListenCommand([
      '--address', validAddress,
      '--limit', '0'
    ]);
    expect(code4).toBe(0);

    // Direct non-simulate live loop with limit 1
    const code5 = await runListenCommand([
      '--address', validAddress,
      '--limit', '1',
      '--poll-interval', '10'
    ]);
    expect(code5).toBe(0);

    writeStdoutSpy.mockRestore();
    writeStderrSpy.mockRestore();
  });
});
