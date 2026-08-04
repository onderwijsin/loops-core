---
name: loops-core-utils
description: Integrate @onderwijsin/loops-core into an application or backend. Use when consuming Loops Email Campaign API data, receiving signed Loops webhooks, parsing or expanding LMX, rendering LMX safely, or resolving LMX variables and URLs in a Nuxt app, Cloudflare Worker, browser renderer, or other JavaScript/TypeScript consumer.
---

# Loops Core Utilities

Use this skill only to consume `@onderwijsin/loops-core`. Treat the package as a framework-neutral utility library; do not infer permission to modify its source, tests, fixtures, CI, release setup, or package API.

## Choose an integration

| Need                                 | Read                                               | Use                                           |
| ------------------------------------ | -------------------------------------------------- | --------------------------------------------- |
| Parse/store LMX or expand components | [references/api.md](references/api.md)             | `parseLoopsLmx`                               |
| Build a safe renderer                | [references/rendering.md](references/rendering.md) | AST types, rendering helpers, variables, URLs |
| Receive Loops webhooks               | [references/api.md](references/api.md)             | verification and webhook schemas              |
| Retrieve campaigns/components        | [references/api.md](references/api.md)             | `createLoopsEmailCampaignClient`              |

## Consumer workflow

1. Install the package: `pnpm add @onderwijsin/loops-core`.
2. Keep HTTP extraction, authentication, persistence, idempotency, queues, campaign policy, and presentation in the consumer application.
3. Keep signing secrets and Loops API keys server-side.
4. Use exported schemas at external boundaries; use `safeParse` where an invalid payload should become an application error response.
5. Render only the supported subset, escape text, resolve variables before presentation, and validate every destination URL.

## Boundaries and safety

- Verify the exact raw webhook body before parsing JSON.
- Call component-expanding `parseLoopsLmx` with `apiKey` only from trusted server code. Omit it in browser code.
- Do not pass custom fetch or component-loader callbacks: the package owns `ofetch` and component fetching.
- Do not render LMX through `v-html`, `innerHTML`, or an equivalent raw HTML API.
- Treat unsupported nodes as omitted presentation data, not as a parsing failure.
- Do not use `Style` metadata as untrusted CSS.

For framework-specific implementation, adapt these outputs to that framework rather than importing the framework into the package.
