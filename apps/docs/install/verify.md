# Verify the install

For contributors and ops staff: confirm the checkout is healthy before you change code.

```bash
npm run lint && npm run typecheck && npm run test -- --coverage
```

Expected: lint clean, typecheck clean, core line coverage at or above 90 percent. CI fails the build below that threshold. If coverage drops, add tests instead of lowering the limit in `jest.config`.

Check the CLI contract:

```bash
anchor-cctp domains | head -c 300
anchor-cctp verify --help
```

The first command should print the start of the domain JSON array. The second should print usage with flags and an example hash shape.

If tests fail on a fresh clone, confirm Node 18 or later with `node --version`, delete `node_modules`, reinstall, and rerun.

Next: [Security policy](../security/overview) before you touch money paths.
