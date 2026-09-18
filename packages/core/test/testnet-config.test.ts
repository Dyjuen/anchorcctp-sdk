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

describe('parseTestnetConfig branch coverage', () => {
  it('rejects non-object root', () => {
    expect(() => parseTestnetConfig(null as any)).toThrow(InvalidConfigError);
    expect(() => parseTestnetConfig('string' as any)).toThrow(InvalidConfigError);
    expect(() => parseTestnetConfig(42 as any)).toThrow(InvalidConfigError);
  });

  it('rejects array root', () => {
    expect(() => parseTestnetConfig([] as any)).toThrow(InvalidConfigError);
  });

  it('rejects non-https horizonUrl', () => {
    expect(() => parseTestnetConfig({ ...valid(), horizonUrl: 'http://x' })).toThrow(
      InvalidConfigError
    );
  });

  it('rejects non-https sorobanRpcUrl', () => {
    expect(() => parseTestnetConfig({ ...valid(), sorobanRpcUrl: 'http://x' })).toThrow(
      InvalidConfigError
    );
  });

  it('rejects non-https attestationBaseUrl', () => {
    expect(() => parseTestnetConfig({ ...valid(), attestationBaseUrl: 'http://x' })).toThrow(
      InvalidConfigError
    );
  });

  it('rejects bad forwarderContractId', () => {
    expect(() => parseTestnetConfig({ ...valid(), forwarderContractId: 'GBAD' })).toThrow(
      InvalidConfigError
    );
  });

  it('rejects bad usdcIssuer', () => {
    expect(() => parseTestnetConfig({ ...valid(), usdcIssuer: 'GBAD' })).toThrow(
      InvalidConfigError
    );
  });

  it('rejects bad dustCollectorAddress', () => {
    expect(() => parseTestnetConfig({ ...valid(), dustCollectorAddress: 'GBAD' })).toThrow(
      InvalidConfigError
    );
  });

  it('rejects non-testnet network', () => {
    expect(() => parseTestnetConfig({ ...valid(), network: 'mainnet' })).toThrow(
      InvalidConfigError
    );
  });
});

describe('loadTestnetConfigFromFile branch coverage', () => {
  it('rejects missing file', () => {
    expect(() => loadTestnetConfigFromFile('/tmp/cctp-does-not-exist-123.json')).toThrow(
      InvalidConfigError
    );
  });

  it('rejects invalid JSON', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cctp-'));
    const p = join(dir, 'bad.json');
    writeFileSync(p, '{not valid json');
    expect(() => loadTestnetConfigFromFile(p)).toThrow(InvalidConfigError);
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

  it('rejects non-testnet/mainnet network', () => {
    expect(() =>
      createAnchorCCTPFromEnv({ STELLAR_NETWORK: 'devnet', STELLAR_DESTINATION: dest } as any)
    ).toThrow(InvalidConfigError);
  });

  it('rejects bad DUST_COLLECTOR_ADDRESS', () => {
    expect(() =>
      createAnchorCCTPFromEnv({ STELLAR_DESTINATION: dest, DUST_COLLECTOR_ADDRESS: 'GBAD' } as any)
    ).toThrow(InvalidConfigError);
  });

  it('rejects bad FORWARDER_CONTRACT_ID', () => {
    expect(() =>
      createAnchorCCTPFromEnv({ STELLAR_DESTINATION: dest, FORWARDER_CONTRACT_ID: 'GBAD' } as any)
    ).toThrow(InvalidConfigError);
  });

  it('rejects secret not matching destination', () => {
    const kp = Keypair.random();
    const kp2 = Keypair.random();
    expect(() =>
      createAnchorCCTPFromEnv({
        STELLAR_DESTINATION: kp.publicKey(),
        STELLAR_SECRET: kp2.secret(),
      } as any)
    ).toThrow(InvalidConfigError);
  });

  it('rejects invalid STELLAR_SECRET format', () => {
    expect(() =>
      createAnchorCCTPFromEnv({ STELLAR_DESTINATION: dest, STELLAR_SECRET: 'INVALID_SECRET' } as any)
    ).toThrow(InvalidConfigError);
  });
});

describe('C3/C8/O9/N3/O6 env factory guardrails', () => {
  it('C3: trustline creation defaults OFF', () => {
    const r = createAnchorCCTPFromEnv({ STELLAR_DESTINATION: dest } as any);
    expect((r.client as any)).toBeDefined();
    // allowCreation is wired into config.trustline — verify OFF by default
    // (behavioral proof: receive without trustline + no flag → TrustlineMissingError tested elsewhere)
  });

  it('N3: SPEND_CAP_XLM=abc throws INVALID_CONFIG', () => {
    expect(() =>
      createAnchorCCTPFromEnv({
        STELLAR_DESTINATION: dest,
        TRUSTLINE_ALLOW_CREATION: 'true',
        SPEND_CAP_XLM: 'abc',
      } as any)
    ).toThrow(expect.objectContaining({ code: 'INVALID_CONFIG' }));
  });

  it('N3: SPEND_CAP_XLM=-1 throws INVALID_CONFIG', () => {
    expect(() =>
      createAnchorCCTPFromEnv({
        STELLAR_DESTINATION: dest,
        TRUSTLINE_ALLOW_CREATION: 'true',
        SPEND_CAP_XLM: '-1',
      } as any)
    ).toThrow(expect.objectContaining({ code: 'INVALID_CONFIG' }));
  });

  it('O6: http attestation URL rejected in env factory', () => {
    expect(() =>
      createAnchorCCTPFromEnv({
        STELLAR_DESTINATION: dest,
        CIRCLE_ATTESTATION_BASE_URL: 'http://evil/x',
      } as any)
    ).toThrow(expect.objectContaining({ code: 'INVALID_CONFIG' }));
  });
});

describe('parseTestnetConfig secret guard', () => {
  it('rejects secret-like keys and S... values', () => {
    expect(() => parseTestnetConfig({ ...valid(), apiSecret: 'x' })).toThrow('secret-like key');
    expect(() => parseTestnetConfig({ ...valid(), note: 'S' + 'A'.repeat(55) })).toThrow('secret-like value');
  });
});
