# Exit codes

For script authors: what the process exit means.

| Code | Meaning | Stdout holds |
|---|---|---|
| `0` | Success | The documented JSON shape for the command |
| `1` | Failure | `{ error, code, remediation }` |

`code` matches the SDK taxonomy: `INVALID_DOMAIN`, `INVALID_AMOUNT`, `ATTESTATION_TIMEOUT`, `TRUSTLINE_MISSING`, `TRUSTLINE_CREATION_FAILED`, `MINT_FAILED`, `REPLAY_TRANSFER`, `INVALID_ADDRESS`.

Each failure includes a `remediation` string with the next step. Example: trustline missing suggests you add a trustline first or pass creation with a cap at 2 XLM. Show that string to the operator and log the full object for audit.

Next: [init](./init) if you publish anchor metadata.
