import { runCli } from './helpers.js';

describe('anchor-cctp domains', () => {
  test('domains command emits valid JSON array to stdout', async () => {
    const { stdout, code } = await runCli(['domains']);
    expect(code).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);
    expect(parsed.find((d: any) => d.domainId === 27)).toBeDefined();
  });
});
