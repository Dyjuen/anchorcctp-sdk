#!/usr/bin/env node
import { CCTP_DOMAINS } from '@anchor-cctp/core';

function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'domains') {
    // Machine readable JSON to stdout
    process.stdout.write(JSON.stringify(Object.values(CCTP_DOMAINS), null, 2) + '\n');
    process.exit(0);
  }

  // Diagnostics to stderr
  process.stderr.write(`AnchorCCTP CLI v1.0.0\nUsage: anchor-cctp <init|listen|verify|domains>\n`);
  process.exit(0);
}

main();
