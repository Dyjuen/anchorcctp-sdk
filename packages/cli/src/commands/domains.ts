import { CCTP_DOMAINS } from '@anchor-cctp/core';

export async function runDomainsCommand(): Promise<number> {
  const domainsList = Object.values(CCTP_DOMAINS);
  process.stdout.write(JSON.stringify(domainsList, null, 2) + '\n');
  return 0;
}
