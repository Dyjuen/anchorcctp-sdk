# Reading output

For script authors: how to parse CLI results reliably.

* Read stdout as JSON. For `listen`, read each line as one JSON object. Example: `anchor-cctp domains | jq '.[] | select(.domainId==27)'`.
* Ignore stderr in scripts. It holds progress, spinners, and human notes that may change.
* Amount shapes differ by stage. `inbound_burn_detected` shows 6 decimal source units such as `"100.000000"`. `settled` shows 7 decimal stroops such as `"100.0000000"` plus a `dust` field.
* Treat records without a real network `txHash` as non settlements. Simulated and offline records carry explicit markers such as `simulate:true`, sentinel hashes, or `offline:true`.
* Keys never appear in args or outputs. Signing uses env or callbacks only.

If JSON parsing fails, confirm you read stdout only and did not merge stderr into the pipe. Use `2>/dev/null` or your runner split for stdout and stderr when you test.

Next: [Exit codes](./exit-codes) for failure handling.
