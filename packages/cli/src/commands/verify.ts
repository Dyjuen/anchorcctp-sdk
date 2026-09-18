import { AttestationClient, AnchorCCTPError, assertSupportedDomain } from '@anchor-cctp/core-sdk';

export async function runVerifyCommand(args: string[]): Promise<number> {
  let txHash: string | undefined;
  let sourceDomain: number | undefined;
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

  // Validate txHash: 0x + 64 hex chars
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    process.stdout.write(
      JSON.stringify(
        {
          error: `Invalid txHash format: "${txHash}". Must be 0x + 64 hex characters.`,
          code: 'INVALID_HASH',
          remediation: 'Provide EVM transaction hash as 0x + 64 hex characters.',
        },
        null,
        2
      ) + '\n'
    );
    process.stderr.write(`[ERROR] Invalid txHash format: ${txHash}\n`);
    return 1;
  }

  // Validate sourceDomain: must be integer in CCTP allowlist
  const resolvedDomain = sourceDomain ?? 0;
  try {
    assertSupportedDomain(resolvedDomain);
  } catch {
    process.stdout.write(
      JSON.stringify(
        {
          error: `Unsupported source domain: ${resolvedDomain}.`,
          code: 'INVALID_DOMAIN',
          remediation: 'Provide a supported sourceDomain (e.g. 0 for Ethereum, 6 for Base, 27 for Stellar).',
        },
        null,
        2
      ) + '\n'
    );
    process.stderr.write(`[ERROR] Unsupported source domain: ${resolvedDomain}\n`);
    return 1;
  }

  // Validate baseUrl: https-only (allow http for localhost)
  if (baseUrl !== undefined) {
    const isLocalhost = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(baseUrl);
    if (!/^https:\/\//.test(baseUrl) && !isLocalhost) {
      process.stdout.write(
        JSON.stringify(
          {
            error: `baseUrl must use HTTPS: "${baseUrl}"`,
            code: 'INVALID_CONFIG',
            remediation: 'Use https:// for attestation API URLs. http:// is only allowed for localhost.',
          },
          null,
          2
        ) + '\n'
      );
      process.stderr.write(`[ERROR] Non-HTTPS baseUrl rejected: ${baseUrl}\n`);
      return 1;
    }
  }

  const resolvedBase = baseUrl ?? (testnet ? 'https://iris-api-sandbox.circle.com' : undefined);
  const client = new AttestationClient({
    baseUrl: resolvedBase,
    maxRetries,
    pollIntervalMs,
  });

  try {
    process.stderr.write(`[INFO] Polling attestation for ${txHash}...\n`);
    const result = await client.pollAttestationByTx(resolvedDomain, txHash, (attempt, elapsedMs) => {
      process.stderr.write(`[DEBUG] Attempt ${attempt} (${elapsedMs}ms elapsed)...\n`);
    });

    const isVerified = client.verifyAttestation(result.message, result.signature);

    const output = {
      txHash,
      attested: result.status === 'complete' && isVerified,
      status: result.status,
      sourceDomain: resolvedDomain,
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
