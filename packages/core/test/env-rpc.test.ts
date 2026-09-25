import { Account, Asset, Keypair, Networks, Operation, TransactionBuilder, rpc } from '@stellar/stellar-sdk';
import {
  createHorizonTrustlineProvider,
  createSorobanTransport,
  HorizonTrustlineServer,
} from '../src/env-rpc.js';
import { buildChangeTrustXdr } from '../src/trustline/index.js';

const ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

/** A real, passphrase-encoded XDR — the adapters must parse what core builds. */
function changeTrustXdr(sourceSecret: string): string {
  const kp = Keypair.fromSecret(sourceSecret);
  const tx = buildChangeTrustXdr(kp.publicKey(), ISSUER, Networks.TESTNET);
  return tx;
}

function fakeServer(over: Partial<Record<string, jest.Mock>> = {}) {
  return {
    simulateTransaction: jest.fn(async (tx: unknown) => ({ tx, ok: true })),
    sendTransaction: jest.fn(async () => ({ status: 'PENDING', hash: 'abc123' })),
    getTransaction: jest.fn(async () => ({ status: 'SUCCESS' })),
    ...over,
  };
}

describe('createSorobanTransport', () => {
  it('parses the XDR with the threaded passphrase and delegates every call', async () => {
    const kp = Keypair.random();
    const server = fakeServer();
    const transport = createSorobanTransport(server as unknown as rpc.Server, Networks.TESTNET);
    const xdr = changeTrustXdr(kp.secret());

    const sim = await transport.simulateTransaction(xdr);
    expect(sim).toEqual({ tx: expect.anything(), ok: true });
    // fromXDR succeeded → the passphrase matched the encoding
    expect(server.simulateTransaction).toHaveBeenCalledTimes(1);

    const sent = await transport.sendTransaction(xdr);
    expect(sent).toEqual({ status: 'PENDING', hash: 'abc123' });

    const got = await transport.getTransaction('abc123');
    expect(got).toEqual({ status: 'SUCCESS' });
    expect(server.getTransaction).toHaveBeenCalledWith('abc123');
  });

  it('assembles through rpc.assembleTransaction (a bogus sim response cannot assemble)', () => {
    const kp = Keypair.random();
    const transport = createSorobanTransport(
      fakeServer() as unknown as rpc.Server,
      Networks.TESTNET
    );
    // Real rpc.assembleTransaction needs a genuine simulation result; the point here
    // is that the adapter parses the XDR before assembling it.
    expect(() => transport.assembleTransaction(changeTrustXdr(kp.secret()), {} as never)).toThrow();
  });

  it('threads the deployment passphrase into every parsed transaction', async () => {
    const kp = Keypair.random();
    const server = fakeServer();
    const transport = createSorobanTransport(server as unknown as rpc.Server, Networks.PUBLIC);

    await transport.sendTransaction(
      buildChangeTrustXdr(kp.publicKey(), ISSUER, Networks.PUBLIC)
    );

    // Parsed under PUBLIC → a testnet-encoded XDR would be re-encoded as PUBLIC and
    // rejected by the network instead of silently riding the testnet default.
    const parsed = server.sendTransaction.mock.calls[0][0] as { networkPassphrase: string };
    expect(parsed.networkPassphrase).toBe(Networks.PUBLIC);
  });
});

describe('createHorizonTrustlineProvider', () => {
  const keypair = Keypair.random();

  function provider(horizon: Partial<HorizonTrustlineServer>) {
    return createHorizonTrustlineProvider({
      horizon: horizon as HorizonTrustlineServer,
      issuer: ISSUER,
      networkPassphrase: Networks.TESTNET,
      keypair,
    });
  }

  it('reports an existing USDC trustline for the configured issuer', async () => {
    const p = provider({
      loadAccount: async () => ({
        balances: [
          { asset_type: 'native' },
          { asset_code: 'USDC', asset_issuer: ISSUER },
        ],
      }),
    });
    await expect(p.hasTrustline(keypair.publicKey())).resolves.toBe(true);
  });

  it('reports false when the balance is another issuer or another asset', async () => {
    const other = Keypair.random().publicKey();
    const p = provider({
      loadAccount: async () => ({
        balances: [
          { asset_code: 'USDC', asset_issuer: other },
          { asset_code: 'EURC', asset_issuer: ISSUER },
        ],
      }),
    });
    await expect(p.hasTrustline(keypair.publicKey())).resolves.toBe(false);
  });

  it('reports false for an unfunded account (loadAccount 404)', async () => {
    const p = provider({
      loadAccount: async () => {
        throw new Error('Request failed with status code 404');
      },
    });
    await expect(p.hasTrustline(keypair.publicKey())).resolves.toBe(false);
  });

  it('signs and submits the change-trust built by core', async () => {
    const submitted: Array<{ type: string; signed: boolean }> = [];
    const p = provider({
      loadAccount: async () => ({ balances: [] }),
      submitTransaction: async (tx: unknown) => {
        const t = tx as { operations: Array<{ type: string }>; signatures: unknown[] };
        submitted.push({ type: t.operations[0].type, signed: t.signatures.length > 0 });
        return { hash: 'TRUSTLINE_HASH' };
      },
    });

    await expect(p.createTrustline(changeTrustXdr(keypair.secret()))).resolves.toBe(
      'TRUSTLINE_HASH'
    );
    expect(submitted).toEqual([{ type: 'changeTrust', signed: true }]);
  });

  it('refuses an XDR that is not a single changeTrust', async () => {
    const p = provider({ submitTransaction: async () => ({ hash: 'x' }) });
    const tx = new TransactionBuilder(new Account(keypair.publicKey(), '0'), {
      fee: '100',
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        Operation.payment({
          destination: Keypair.random().publicKey(),
          asset: Asset.native(),
          amount: '1',
        })
      )
      .setTimeout(30)
      .build();

    await expect(p.createTrustline(tx.toXDR())).rejects.toThrow(/changeTrust/);
  });

  it('refuses a change-trust sourced from another account', async () => {
    const other = Keypair.random();
    const p = provider({ submitTransaction: async () => ({ hash: 'x' }) });
    await expect(
      p.createTrustline(buildChangeTrustXdr(other.publicKey(), ISSUER, Networks.TESTNET))
    ).rejects.toThrow(/not the signing account/);
  });
});
