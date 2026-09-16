import { AttestationClient, AnchorCCTPError } from '@anchor-cctp/core-sdk';

export async function runVerifyCommand(args: string[]): Promise<number> {
  let txHash: string | undefined;
  let sourceDomain = 0;
  let baseUrl: string | undefined;
  let maxRetries = 30;
  let pollIntervalMs = 1000;
  let testnet = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--source-domain' && args[i + 1] !== undefined) {
      sourceDomain = Number.parseInt(args[++i], 10);
    } else if (arg === '--base-url' && args[i + 1] !== undefined) {
      baseUrl = args[++i];
    } else if (arg === '--max-retries' && args[i + 1] !== undefined) {
      maxRetries = Number.parseInt(args[++i], 10);
    } else if (arg === '--poll-interval' && args[i + 1] !== undefined) {
      pollIntervalMs = Number.parseInt(args[++i], 10);
    } else if (arg === '--tx-hash' && args[i + 1] !== undefined) {
      txHash = args[++i];
    } else if (arg === '--testnet') {
      testnet = true;
    } else if (!arg.startsWith('-') && !txHash) {
      txHash = arg;
    }
  }

  if (!txHash) {
    process.stdout.write(
      JSON.stringify(
        {
          error: 'Missing required argument <txHash>.',
          code: 'MISSING_ARGUMENT',
          remediation: 'Usage: anchor-cctp verify <txHash>',
        },
        null,
        2
      ) + '\n'
    );
    process.stderr.write('[ERROR] Missing required argument <txHash>\n');
    return 1;
  }

  const resolvedBase = baseUrl ?? (testnet ? 'https://iris-api-sandbox.circle.com' : undefined);
  const client = new AttestationClient({
    baseUrl: resolvedBase,
    maxRetries,
    pollIntervalMs,
  });

  try {
    process.stderr.write(`[INFO] Polling attestation for ${txHash}...\n`);
    const result = await client.pollAttestationByTx(sourceDomain, txHash, (attempt, elapsedMs) => {
      process.stderr.write(`[DEBUG] Attempt ${attempt} (${elapsedMs}ms elapsed)...\n`);
    });

    const isVerified = client.verifyAttestation(result.message, result.signature);

    const output = {
      txHash,
      attested: result.status === 'complete' && isVerified,
      status: result.status,
      sourceDomain,
      destinationDomain: 27,
      attestation: result.attestation,
      message: result.message,
    };

    process.stdout.write(JSON.stringify(output, null, 2) + '\n');
    return 0;
  } catch (err: unknown) {
    if (err instanceof AnchorCCTPError) {
      process.stdout.write(
        JSON.stringify(
          {
            error: err.message,
            code: err.code,
            remediation: err.remediation,
          },
          null,
          2
        ) + '\n'
      );
    process.stderr.write(`[ERROR] ${err instanceof Error ? err.message : String(err)}\n`);
      return 1;
    }

    process.stdout.write(
      JSON.stringify(
        {
          error: err instanceof Error ? err.message : String(err),
          code: 'VERIFY_FAILED',
          remediation: 'Verify Circle Iris API availability or check burn transaction hash.',
        },
        null,
        2
      ) + '\n'
    );
    process.stderr.write(`[ERROR] ${err instanceof Error ? err.message : String(err)}\n`);
    return 1;
  }
}
