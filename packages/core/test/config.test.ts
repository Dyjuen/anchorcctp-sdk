import { createAnchorCCTP, AnchorCCTPConfig } from '../src/config.js';
import { InvalidConfigError } from '../src/errors/index.js';

describe('AnchorCCTP Configuration & Factory', () => {
  it('createAnchorCCTP returns object with receive(), on(), once(), and off()', () => {
    const sdk = createAnchorCCTP({
      signer: async (x) => x,
      dustCollectorAddress: 'G'.repeat(56),
    });
    expect(typeof sdk.receive).toBe('function');
    expect(typeof sdk.on).toBe('function');
    expect(typeof sdk.once).toBe('function');
    expect(typeof sdk.off).toBe('function');
  });

  it('proxies events to underlying event emitter', () => {
    const sdk = createAnchorCCTP({
      signer: async (x) => x,
    });

    let receivedCount = 0;
    sdk.on('onReceiving', () => {
      receivedCount++;
    });

    // Test that on/once/off return sdk instance for chaining
    expect(sdk.on('onError', () => {})).toBe(sdk);
    expect(sdk.once('onError', () => {})).toBe(sdk);
    expect(sdk.off('onError', () => {})).toBe(sdk);
  });

  it('supports custom Logger instance and function sink in createAnchorCCTP', () => {
    const customLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    const sdk1 = createAnchorCCTP({ logger: customLogger });
    expect(sdk1).toBeDefined();

    const logs: string[] = [];
    const sdk2 = createAnchorCCTP({ logger: (s) => logs.push(s) });
    expect(sdk2).toBeDefined();
  });

  it('N1: _test overrides forbidden in production', () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(() =>
        createAnchorCCTP({ _test: { fake: true } } as any)
      ).toThrow(InvalidConfigError);
    } finally {
      process.env.NODE_ENV = original;
    }
  });

  it('B5: trustlineProvider is accepted as a first-class config key', () => {
    const provider = {
      hasTrustline: async () => true,
      createTrustline: async (xdr: string) => xdr,
    };
    const sdk = createAnchorCCTP({
      signer: async (x) => x,
      trustlineProvider: provider,
    } satisfies AnchorCCTPConfig);
    expect(sdk).toBeDefined();
  });

  it('B5: trustlineProvider is allowed in production (unlike _test)', () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const sdk = createAnchorCCTP({
        signer: async (x) => x,
        trustlineProvider: {
          hasTrustline: async () => true,
          createTrustline: async (xdr: string) => xdr,
        },
      } satisfies AnchorCCTPConfig);
      expect(sdk).toBeDefined();
    } finally {
      process.env.NODE_ENV = original;
    }
  });

  it('N1: _test allowed outside production', () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    try {
      const sdk = createAnchorCCTP({ _test: { fake: true } } as any);
      expect(sdk).toBeDefined();
    } finally {
      process.env.NODE_ENV = original;
    }
  });
});

