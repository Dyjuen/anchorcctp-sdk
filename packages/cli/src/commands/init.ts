import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { CCTP_DOMAINS, getDomainMeta, InvalidDomainError, TESTNET_FORWARDER, TESTNET_USDC_ISSUER } from '@anchor-cctp/core-sdk';

function isValidStrKey(value: string): boolean {
  if (/[\r\n"']/.test(value)) return false;
  return /^(G[A-Z2-7]{55}|C[A-Z2-7]{55})$/.test(value);
}

export interface InitOptions {
  domain?: number;
  usdcIssuer?: string;
  forwarder?: string;
  dustCollector?: string;
  output?: string;
  force?: boolean;
}

export async function runInitCommand(args: string[]): Promise<number> {
  const options: InitOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--domain' && args[i + 1] !== undefined) {
      options.domain = Number.parseInt(args[++i], 10);
    } else if (arg === '--usdc-issuer' && args[i + 1] !== undefined) {
      options.usdcIssuer = args[++i];
    } else if (arg === '--forwarder' && args[i + 1] !== undefined) {
      options.forwarder = args[++i];
    } else if (arg === '--dust-collector' && args[i + 1] !== undefined) {
      options.dustCollector = args[++i];
    } else if (arg === '--output' && args[i + 1] !== undefined) {
      options.output = args[++i];
    } else if (arg === '--force') {
      options.force = true;
    }
  }

  const domainId = options.domain !== undefined ? options.domain : 27;

  try {
    getDomainMeta(domainId);
  } catch (err) {
    if (err instanceof InvalidDomainError) {
      process.stdout.write(JSON.stringify({
        error: err.message,
        code: err.code,
        remediation: err.remediation
      }, null, 2) + '\n');
      process.stderr.write(`[ERROR] ${err.message}\n`);
      return 1;
    }
    throw err;
  }

  const usdcIssuer = options.usdcIssuer || TESTNET_USDC_ISSUER;
  const forwarderAddress = options.forwarder || TESTNET_FORWARDER;
  const outputPath = options.output || './stellar.toml';

  // Validate StrKey for usdcIssuer
  if (!isValidStrKey(usdcIssuer)) {
    process.stdout.write(JSON.stringify({
      error: `Invalid usdc-issuer address: "${usdcIssuer}"`,
      code: 'INVALID_CONFIG',
      remediation: 'Provide a valid Stellar G... public key (55 base32 chars).'
    }, null, 2) + '\n');
    process.stderr.write(`[ERROR] Invalid usdc-issuer address\n`);
    return 1;
  }

  // Validate StrKey for forwarder (C... contract or G... key)
  if (!isValidStrKey(forwarderAddress)) {
    process.stdout.write(JSON.stringify({
      error: `Invalid forwarder address: "${forwarderAddress}"`,
      code: 'INVALID_CONFIG',
      remediation: 'Provide a valid Stellar C... contract or G... public key.'
    }, null, 2) + '\n');
    process.stderr.write(`[ERROR] Invalid forwarder address\n`);
    return 1;
  }

  // Validate dust collector if provided (optional — omit if not given)
  if (options.dustCollector !== undefined) {
    if (!isValidStrKey(options.dustCollector)) {
      process.stdout.write(JSON.stringify({
        error: `Invalid dust-collector address: "${options.dustCollector}"`,
        code: 'INVALID_CONFIG',
        remediation: 'Provide a valid Stellar G... public key or omit --dust-collector.'
      }, null, 2) + '\n');
      process.stderr.write(`[ERROR] Invalid dust-collector address\n`);
      return 1;
    }
  }

  // Path security: block relative paths with .. segments (traversal)
  const fullPath = resolve(outputPath);
  if (outputPath.includes('..') && !options.force) {
    process.stdout.write(JSON.stringify({
      error: `Output path contains traversal: "${outputPath}"`,
      code: 'PATH_SECURITY',
      remediation: 'Use a safe path or pass --force to override.'
    }, null, 2) + '\n');
    process.stderr.write(`[ERROR] Path traversal blocked\n`);
    return 1;
  }

  // Refuse to overwrite existing file without --force
  if (existsSync(fullPath) && !options.force) {
    process.stdout.write(JSON.stringify({
      error: `File already exists: "${outputPath}". Refusing to overwrite without --force.`,
      code: 'FILE_EXISTS',
      remediation: 'Pass --force to overwrite, or choose a different --output path.'
    }, null, 2) + '\n');
    process.stderr.write(`[ERROR] File exists, use --force to overwrite\n`);
    return 1;
  }

  const supportedDomains = Object.values(CCTP_DOMAINS)
    .map((d) => d.domainId)
    .filter((id) => id !== domainId);

  const lines: string[] = [
    '# Auto-generated CCTP configuration for Stellar Anchor',
    '[[CURRENCIES]]',
    'code = "USDC"',
    `issuer = "${usdcIssuer}"`,
    `cctp_domain = ${domainId}`,
    `cctp_forwarder = "${forwarderAddress}"`,
    '',
    '[CCTP]',
    `CCTP_DOMAIN = ${domainId}`,
    `FORWARDER_ADDRESS = "${forwarderAddress}"`,
    `SUPPORTED_SOURCE_DOMAINS = [${supportedDomains.join(', ')}]`,
    'DUST_HANDLING = "collector_sweep"',
  ];

  if (options.dustCollector) {
    lines.push(`DUST_COLLECTOR_ACCOUNT = "${options.dustCollector}"`);
  }

  lines.push('');

  const configBlock = lines.join('\n');

  try {
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, configBlock, 'utf8');

    const result = {
      success: true,
      configBlock,
      writtenPath: outputPath
    };

    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.stderr.write(`[INFO] stellar.toml CCTP block generated at ${outputPath}\n`);
    return 0;
  } catch (err: unknown) {
    process.stdout.write(JSON.stringify({
      error: `Failed to write file: ${(err as Error).message}`,
      code: 'WRITE_ERROR',
      remediation: 'Check output directory permissions and path.'
    }, null, 2) + '\n');
    process.stderr.write(`[ERROR] Failed to write file: ${(err as Error).message}\n`);
    return 1;
  }
}
