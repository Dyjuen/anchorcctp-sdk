# Demo overview

For wallet integrators: a working reference you can copy.

`apps/demo` pairs a Freighter connected deposit UI with Vercel server functions. It covers the full lifecycle including trustline missing, attestation timeout, and replay states. It never publishes to npm.

Run both parts:

```bash
npm run dev:demo
```

The portal serves on port 5173 and the event server on port 3001. This docs site runs on port 5174 and links from the portal navbar.

Use the demo to confirm UX copy, error display, and balance refresh behavior, then implement the same `receive()` calls in your app. See [Freighter](./freighter) for wallet wiring and [Vercel API](./vercel-api) for routes.

Next: [Freighter](./freighter) if you sign in the browser.
