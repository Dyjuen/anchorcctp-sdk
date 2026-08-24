import { createLogger, Logger } from '../src/logger/index.js';

describe('Structured JSON Logger', () => {
  it('logs structured JSON with namespace + level', () => {
    const lines: string[] = [];
    const log = createLogger('receive', (s) => lines.push(s));
    log.info('polling', { tx: '0x1' });
    const o = JSON.parse(lines[0]);
    expect(o.level).toBe('info');
    expect(o.ns).toBe('receive');
    expect(o.msg).toBe('polling');
    expect(o.tx).toBe('0x1');
    expect(typeof o.ts).toBe('string');
  });

  it('supports warn, error, and debug levels', () => {
    const lines: string[] = [];
    const log = createLogger('test-ns', (s) => lines.push(s));
    log.warn('warning message', { code: 123 });
    log.debug('debug message');
    log.error('error message', { error: 'something broke' });

    expect(lines.length).toBe(3);
    expect(JSON.parse(lines[0]).level).toBe('warn');
    expect(JSON.parse(lines[1]).level).toBe('debug');
    expect(JSON.parse(lines[2]).level).toBe('error');
  });

  it('error log never includes secret-shaped keys (redaction)', () => {
    const lines: string[] = [];
    const log = createLogger('security-check', (s) => lines.push(s));
    log.error('boom', {
      secret: 'SECRET_TOKEN',
      apiKey: 'PRIVATE_KEY_123',
      privateKey: 'S123',
      mnemonicPhrase: 'twelve words here',
      seedValue: 'abcdef',
      tx: '0x1',
      nested: {
        secretCode: 'nested-secret',
        safeField: 'ok',
      },
    });

    const parsed = JSON.parse(lines[0]);
    expect(parsed.tx).toBe('0x1');
    expect(parsed.secret).toBe('[REDACTED]');
    expect(parsed.apiKey).toBe('[REDACTED]');
    expect(parsed.privateKey).toBe('[REDACTED]');
    expect(parsed.mnemonicPhrase).toBe('[REDACTED]');
    expect(parsed.seedValue).toBe('[REDACTED]');
    expect(parsed.nested.secretCode).toBe('[REDACTED]');
    expect(parsed.nested.safeField).toBe('ok');
    expect(lines[0]).not.toContain('SECRET_TOKEN');
    expect(lines[0]).not.toContain('PRIVATE_KEY_123');
  });

  it('uses default sink when none provided', () => {
    const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const log = createLogger('default-sink');
    log.info('hello stderr');
    expect(stderrSpy).toHaveBeenCalled();
    stderrSpy.mockRestore();
  });

  it('handles null, undefined, arrays and primitives in metadata', () => {
    const lines: string[] = [];
    const log = createLogger('edge-cases', (s) => lines.push(s));
    log.info('edge cases', {
      emptyVal: null,
      undefVal: undefined,
      arr: [1, 'two', { secretToken: 'bad', normal: 'ok' }],
      str: 'hello',
    });

    const parsed = JSON.parse(lines[0]);
    expect(parsed.emptyVal).toBeNull();
    expect(parsed.undefVal).toBeUndefined();
    expect(parsed.arr[0]).toBe(1);
    expect(parsed.arr[2].secretToken).toBe('[REDACTED]');
    expect(parsed.arr[2].normal).toBe('ok');
    expect(parsed.str).toBe('hello');
  });
});


