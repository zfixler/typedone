# TypeDone

A fast, local-first command-line todo app. Tasks, directories, settings, and command history are stored in the browser with IndexedDB.

## Development

```sh
pnpm install
pnpm dev
```

Run the release checks with:

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm deploy:check
```

On Windows, Playwright runs Chromium locally because its bundled Firefox can hang during startup in constrained Windows environments. CI runs the suite in both Chromium and Firefox on Linux.

## Deploy to Cloudflare Workers

The app deploys as a Workers Static Assets SPA named `typedone`. Authenticate Wrangler, verify the bundle, then deploy:

```sh
pnpm wrangler login
pnpm deploy:check
pnpm deploy
```

The production configuration is in `wrangler.jsonc`. It serves `dist`, falls back to the SPA for navigation requests, applies the security and cache rules from `public/_headers`, and enables Workers logs and traces.
