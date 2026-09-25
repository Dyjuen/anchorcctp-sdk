# CLI overview

For ops staff and anchor engineers: run CCTP checks from a terminal without writing code.

The `anchor-cctp` binary ([`@anchor-cctp/cli`](https://www.npmjs.com/package/@anchor-cctp/cli)) calls the same core SDK the demo uses. A domain check, a verification, or a streamed transfer returns the same result in all three.

```bash
npx @anchor-cctp/cli <subcommand> [options]
```

Or install once:

```bash
npm install -g @anchor-cctp/cli
anchor-cctp <subcommand> [options]
```

Each subcommand prints its own examples:

```bash
anchor-cctp <subcommand> --help
```

Output contract for all four commands:

* Stdout holds valid JSON, or newline delimited JSON for `listen`. Pipe it to `jq` or your scripts.
* Stderr holds human diagnostics and progress. Safe to ignore when scripting.
* Failures return a non zero exit with `{ error, code, remediation }`. `code` matches the SDK taxonomy.

Commands: [init](./init) for `stellar.toml`, [verify](./verify) for attestation state, [listen](./listen) for streams, [domains](./domains) for the ID table. Start with [Reading output](./reading-output) if you script the CLI.
