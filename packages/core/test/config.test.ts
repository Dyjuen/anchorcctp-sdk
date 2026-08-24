import { createAnchorCCTP, AnchorCCTPConfig } from '../src/config.js';

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
});

