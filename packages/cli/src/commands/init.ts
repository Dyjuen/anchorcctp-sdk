import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { CCTP_DOMAINS, getDomainMeta, InvalidDomainError } from '@anchor-cctp/core';

export interface InitOptions {
  domain?: number;
  usdcIssuer?: string;
  forwarder?: string;
  dustCollector?: string;
  output?: string;
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

  const usdcIssuer = options.usdcIssuer || 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
  const forwarderAddress = options.forwarder || 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
  const dustCollector = options.dustCollector || 'GDDUSTCOLLECTOR00000000000000000000000000000000000000000000';
  const outputPath = options.output || './stellar.toml';

  const supportedDomains = Object.values(CCTP_DOMAINS)
    .map((d) => d.domainId)
    .filter((id) => id !== domainId);

  const configBlock = [
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
    `DUST_COLLECTOR_ACCOUNT = "${dustCollector}"`,
    ''
  ].join('\n');

  try {
    const fullPath = resolve(outputPath);
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
  } catch (err: any) {
    process.stdout.write(JSON.stringify({
      error: `Failed to write file: ${err.message}`,
      code: 'WRITE_ERROR',
      remediation: 'Check output directory permissions and path.'
    }, null, 2) + '\n');
    process.stderr.write(`[ERROR] Failed to write file: ${err.message}\n`);
    return 1;
  }
}
