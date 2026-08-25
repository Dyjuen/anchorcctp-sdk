#!/usr/bin/env node
import { runDomainsCommand } from './commands/domains.js';
import { runInitCommand } from './commands/init.js';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const commandArgs = args.slice(1);

  if (command === 'domains') {
    const code = await runDomainsCommand();
    process.exit(code);
  }

  if (command === 'init') {
    const code = await runInitCommand(commandArgs);
    process.exit(code);
  }

  // Diagnostics to stderr
  process.stderr.write(`AnchorCCTP CLI v1.0.0\nUsage: anchor-cctp <init|listen|verify|domains>\n`);
  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(`Fatal error: ${err.message}\n`);
  process.exit(1);
});
