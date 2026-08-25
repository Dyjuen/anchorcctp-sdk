import { runCli } from './helpers.js';

describe('anchor-cctp usage', () => {
  test('prints usage diagnostics to stderr on unknown or empty command', async () => {
    const { stderr, code } = await runCli([]);
    expect(code).toBe(0);
    expect(stderr).toContain('Usage: anchor-cctp');
  });
});
