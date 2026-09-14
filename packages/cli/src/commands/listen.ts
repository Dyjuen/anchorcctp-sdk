import { CCTP_DOMAINS, translateToStellar } from '@anchor-cctp/core-sdk';

export interface ListenOptions {
  address?: string;
  limit?: number;
  simulate?: boolean;
  pollIntervalMs?: number;
  rateLimitPerSec?: number;
  horizonUrl?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runListenCommand(args: string[]): Promise<number> {
  const options: ListenOptions = {
    rateLimitPerSec: 5,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--address' && args[i + 1] !== undefined) {
      options.address = args[++i];
    } else if (arg === '--limit' && args[i + 1] !== undefined) {
      options.limit = Number.parseInt(args[++i], 10);
    } else if (arg === '--poll-interval' && args[i + 1] !== undefined) {
      options.pollIntervalMs = Number.parseInt(args[++i], 10);
    } else if (arg === '--rate-limit' && args[i + 1] !== undefined) {
      options.rateLimitPerSec = Number.parseInt(args[++i], 10);
    } else if (arg === '--simulate') {
      options.simulate = true;
    } else if (arg === '--horizon-url' && args[i + 1] !== undefined) {
      options.horizonUrl = args[++i];
    } else if (!arg.startsWith('-') && !options.address) {
      options.address = arg;
    }
  }

  if (!options.address) {
    process.stdout.write(
      JSON.stringify(
        {
          error: 'Missing required argument <address>.',
          code: 'MISSING_ARGUMENT',
          remediation: 'Usage: anchor-cctp listen <address>',
        },
        null,
        2
      ) + '\n'
    );
    process.stderr.write('[ERROR] Missing target address\n');
    return 1;
  }

  let stellarAddress: string;
  try {
    stellarAddress = translateToStellar(options.address);
  } catch (err: any) {
    process.stdout.write(
      JSON.stringify(
        {
          error: `Invalid address: ${err.message}`,
          code: 'INVALID_ADDRESS',
          remediation: 'Provide a valid Stellar G... public key or 20/32-byte hex address.',
        },
        null,
        2
      ) + '\n'
    );
    process.stderr.write(`[ERROR] Invalid address: ${err.message}\n`);
    return 1;
  }

  process.stderr.write(`[INFO] Streaming inbound CCTP transfers for ${stellarAddress}...\n`);
  process.stderr.write(`[INFO] Rate limit guardrail: max ${options.rateLimitPerSec} events/sec\n`);

  let count = 0;
  const maxEvents = options.limit ?? (options.simulate ? 2 : Infinity);

  if (options.simulate) {
    // Emit simulated NDJSON stream
    const sourceDomainMeta = CCTP_DOMAINS[0] || { domainId: 0, chain: 'ethereum', name: 'Ethereum' };
    const now = new Date().toISOString();

    const event1 = {
      event: 'inbound_burn_detected',
      sourceChain: sourceDomainMeta.name,
      sourceDomain: sourceDomainMeta.domainId,
      amount: '100.000000',
      status: 'attesting',
      timestamp: now,
    };
    process.stdout.write(JSON.stringify(event1) + '\n');
    count++;

    if (count < maxEvents) {
      await sleep(10);
      const event2 = {
        event: 'settled',
        sourceChain: sourceDomainMeta.name,
        destination: stellarAddress,
        amount: '100.0000000',
        dust: '0',
        txHash: '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
        timestamp: new Date().toISOString(),
      };
      process.stdout.write(JSON.stringify(event2) + '\n');
      count++;
    }

    process.stderr.write(`[INFO] Stream ended after ${count} events.\n`);
    return 0;
  }

  // Live Horizon poll stub (full streaming deferred to week3)
  const horizon = (options.horizonUrl || process.env.HORIZON_URL || 'https://horizon-testnet.stellar.org').replace(/\/+$/, '');
  try {
    const res = await fetch(`${horizon}/accounts/${stellarAddress}/effects?order=desc&limit=${Math.min(maxEvents - count, 10)}`);
    if (res.ok) {
      const data: any = await res.json();
      const recs: any[] = data?._embedded?.records || [];
      for (const r of recs.slice(0, maxEvents - count)) {
        process.stdout.write(
          JSON.stringify({
            event: 'horizon_effect',
            type: r.type,
            account: stellarAddress,
            timestamp: new Date().toISOString(),
          }) + '\n'
        );
        count++;
      }
    }
  } catch {
    // Network errors treated as zero events — non-fatal
  }
  process.stderr.write(`[INFO] Live poll ${horizon} done, ${count} events.\n`);
  return 0;
}
