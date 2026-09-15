import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Keypair, StrKey } from '@stellar/stellar-sdk';
import {
  parseTestnetConfig,
  loadTestnetConfigFromFile,
  createAnchorCCTPFromEnv,
} from '../src/testnet-config.js';
import { InvalidConfigError } from '../src/errors/index.js';

const dest = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 0x55));
const dust = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 0x66));

function valid(): Record<string, unknown> {
  return {
    network: 'testnet',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
    attestationBaseUrl: 'https://iris-api-sandbox.circle.com',
    forwarderContractId: 'CA66Q2WFBND6V4UEB7RD4SAXSVIWMD6RA4X3U32ELVFGXV5PJK4T4VSZ',
    usdcIssuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    destinationAddress: dest,
    dustCollectorAddress: dust,
  };
}

describe('testnet public config loader', () => {
  it('parses valid public config, exposes no secrets', () => {
    const cfg = parseTestnetConfig(valid());
    expect(cfg.destinationAddress).toBe(dest);
    expect(cfg.network).toBe('testnet');
    expect('secret' in (cfg as object)).toBe(false);
  });

  it('refuses files containing secret-like keys or S... values', () => {
    expect(() =>
      parseTestnetConfig({ ...valid(), STELLAR_TESTNET_SECRET: 'S' + 'A'.repeat(55) })
    ).toThrow(InvalidConfigError);
    expect(() =>
      parseTestnetConfig({ ...valid(), privateKey: 'xxx' })
    ).toThrow(InvalidConfigError);
  });

  it('rejects missing destination and malformed addresses', () => {
    const { destinationAddress: _omit, ...rest } = valid();
    expect(() => parseTestnetConfig(rest)).toThrow(InvalidConfigError);
    expect(() => parseTestnetConfig({ ...valid(), destinationAddress: 'NOT_A_KEY' })).toThrow(
      InvalidConfigError
    );
  });

  it('loads JSON from disk', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cctp-'));
    const p = join(dir, 'testnet.public.json');
    writeFileSync(p, JSON.stringify(valid()));
    expect(loadTestnetConfigFromFile(p).usdcIssuer).toBe(
      'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'
    );
  });
});

describe('createAnchorCCTPFromEnv', () => {
  it('builds public-only client without secret', () => {
    const r = createAnchorCCTPFromEnv({ STELLAR_DESTINATION: dest } as any);
    expect(r.destinationAddress).toBe(dest);
    expect(r.hasSigner).toBe(false);
    expect(r.network).toBe('testnet');
  });

  it('wires Keypair signer when STELLAR_TESTNET_SECRET present', () => {
    const kp = Keypair.random();
    const r = createAnchorCCTPFromEnv({
      STELLAR_TESTNET_DESTINATION: kp.publicKey(),
      STELLAR_TESTNET_SECRET: kp.secret(),
    } as any);
    expect(r.hasSigner).toBe(true);
    expect(r.destinationAddress).toBe(kp.publicKey());
  });

  it('rejects malformed destination and secret', () => {
    expect(() => createAnchorCCTPFromEnv({ STELLAR_DESTINATION: 'NOPE' } as any)).toThrow(
      InvalidConfigError
    );
    expect(() =>
      createAnchorCCTPFromEnv({ STELLAR_DESTINATION: dest, STELLAR_SECRET: 'NOPE' } as any)
    ).toThrow(InvalidConfigError);
  });
});
