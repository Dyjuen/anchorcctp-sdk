# Try it in one command

For first time visitors: confirm the tools run on your machine. Nothing settles on chain. Time: under 2 minutes.

Prerequisite: Node.js 18 or later.

```bash
npx @anchor-cctp/cli domains
```

You should see a JSON array with entries like `{"domainId": 0, "chain": "ethereum"}`, `{"domainId": 6, "chain": "base"}`, and `{"domainId": 27, "chain": "stellar"}`. Stellar is always 27.

Check the other contracts without running them:

```bash
npx @anchor-cctp/cli --help
npx @anchor-cctp/cli verify --help
npx @anchor-cctp/cli listen --help
npx @anchor-cctp/cli init --help
```

If `npx` fails with a network error, check your npm registry access and Node version with `node --version`. The command needs outbound HTTPS to npm only.

Next: [Requirements](./requirements) for accounts and keys, then [Quick setup](./quick-setup) for a real testnet settlement.
