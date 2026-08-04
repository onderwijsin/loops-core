---
name: loops-core-utils
description: Build, integrate, test, document, or release @onderwijsin/loops-core. Use when working with Loops Email Campaign API data, signed Loops webhooks, LMX parsing or component expansion, safe LMX variables and URLs, renderer-neutral LMX utilities, or this package's fixtures, CI, and semantic-release setup.
---

# Loops Core Utilities

Use `@onderwijsin/loops-core` as the portable boundary between Loops and an application. Keep HTTP adapters, secrets configuration, persistence, queues, idempotency, campaign eligibility, and UI presentation outside the package.

## Start here

1. Read [references/api.md](references/api.md) before changing or consuming public behavior.
2. Read [references/integration.md](references/integration.md) for parsing, rendering, webhooks, and client work.
3. Read [references/testing-and-release.md](references/testing-and-release.md) before modifying fixtures, tests, CI, or releases.
4. Inspect existing source and tests before adding patterns. Keep API changes backward-compatible unless explicitly requested.

## Choose the right workflow

| Task                            | Use                                                                                                                         |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Parse supplied or persisted LMX | `parseLoopsLmx` without `apiKey`; preserve unknown content and report diagnostics.                                          |
| Expand Loops components         | Call `parseLoopsLmx(lmx, { apiKey })` only in trusted server code. Do not expose a component loader callback.               |
| Render campaign content         | Traverse the AST in the renderer; use the renderer utilities and safe URL/variable helpers. Never use `v-html` or raw HTML. |
| Receive a webhook               | Extract raw body and headers in the app, verify before JSON parsing, then validate with a schema.                           |
| Fetch Loops content             | Use `createLoopsEmailCampaignClient(apiKey)`; it owns `ofetch`, base URL, response validation, and no retries.              |
| Change API schemas or parsing   | Add/adjust behavior tests using the canonical fixtures. Preserve resilience: recover, diagnose, and retain useful nodes.    |

## Non-negotiable safety rules

- Verify the exact raw webhook body before `JSON.parse`.
- Keep `LOOPS_API_KEY`, signing secrets, and `parseLoopsLmx` component expansion server-side.
- Resolve text and attributes with `resolveLoopsLmxVariables`; resolve link/image values with `resolveSafeLoopsLmxUrl` before assigning DOM properties.
- Do not render raw LMX/HTML. Unknown nodes remain in the AST but are omitted by the standard renderer.
- Do not use Node-only runtime APIs in package code; use Web Platform APIs.
- Do not add framework imports, storage, route handlers, queues, or policy to this package.

## Required verification

Use Corepack and run:

```sh
corepack pnpm fmt
corepack pnpm lint:fix
corepack pnpm check
```

Do not commit unless the user explicitly requests it. Read the release reference before changing release files.
