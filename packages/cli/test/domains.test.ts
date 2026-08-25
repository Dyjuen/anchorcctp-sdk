import { runCli } from './helpers.js';
import { runDomainsCommand } from '../src/commands/domains.js';

describe('anchor-cctp domains', () => {
  test('domains command emits valid JSON array to stdout via CLI execution', async () => {
    const { stdout, code } = await runCli(['domains']);
    expect(code).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);
    expect(parsed.find((d: any) => d.domainId === 27)).toBeDefined();
    expect(parsed[0]).toHaveProperty('domainId');
    expect(parsed[0]).toHaveProperty('chain');
    expect(parsed[0]).toHaveProperty('name');
  });

  test('runDomainsCommand direct function execution', async () => {
    let stdoutData = '';
    const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation((str) => {
      stdoutData += str;
      return true;
    });

    const code = await runDomainsCommand();
    expect(code).toBe(0);
    const parsed = JSON.parse(stdoutData);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);

    writeSpy.mockRestore();
  });
});
