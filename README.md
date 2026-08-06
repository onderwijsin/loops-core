![Stichting Onderwijs in](https://raw.githubusercontent.com/onderwijsin/.github/main/banner.png)

# Loops Core Utilities

This package provides several standalone utilities for working with [Loops](https://loops.so/docs). It can be used in any Javascript runtime and it is framework agnostic.

## ✨ Features

- Safe LMX parsing as AST and component expansion
- Renderer utilities for safe HTML and component mapping
- Webhook signature verification and validation schemas
- Variables, URL, and conditional rule resolution

This package is not a Loops Client (use [the official SDK](https://github.com/loops-so/loops-js) for that). This package also does not include a presentation layer to the parsed LMX (use `@onderwijsin/nuxt-loops-renderer` for that).

## 📥 Install

```sh
pnpm add @onderwijsin/loops-core
```

To add the `loops-core` skill:

```sh
npx skills add onderwijsin/loops-core
```

## Parse LMX

```ts
import { parseLoopsLmx } from "@onderwijsin/loops-core";

const content = await parseLoopsLmx("<Paragraph>Hello <Strong>world</Strong>.</Paragraph>");
```

Unknown nodes and attributes remain in the AST. Comments are ignored and malformed content is
recovered as far as possible. Semantic violations of the LMX specification are reported through
`onDiagnostic` while the recoverable AST is retained. Component expansion has a finite default
maximum depth of 8.

Ordered and unordered lists may nest inside list items through 12 list levels, counting the
top-level list as level 1. Deeper nesting is retained in the AST and reported through
`onDiagnostic` as an `invalid_structure` diagnostic.

```ts
const content = await parseLoopsLmx('<Component componentId="footer" />', {
  apiKey: process.env.LOOPS_API_KEY,
  emailType: "campaign",
  onDiagnostic: (diagnostic) => reportDiagnostic(diagnostic)
});
```

When `apiKey` is supplied, the parser fetches only the referenced components through the Loops API.
Keep this call on a trusted server because the API key must never reach the browser. Without an API
key, parsing never performs network I/O. Cycles, unavailable components, and depth-limit failures
retain the original component node and its local children; they do not make the full document fail.
Explicit component children are retained as the documented local override and are not fetched.
Set `emailType` to validate the variable namespaces permitted by campaign, workflow, or transactional
LMX; without it, the parser validates variable syntax and placement but permits all documented namespaces.

## Renderer utilities

This package deliberately does not render HTML or Vue components. A renderer such as
`@onderwijsin/nuxt-loops-renderer` maps the AST to its own UI and uses the shared helpers here for
the safe parts of that interpretation:

- `isRenderableLoopsLmxElement`, `hasRenderableLoopsLmxNodes`, and
  `getUnsupportedLoopsLmxNodes` identify the supported visible subset without discarding unknown
  LMX from the stored AST.
- `applyInlineStyles`, `getLoopsLmxImageWidth`, `getLoopsLmxPixels`, and `getLoopsLmxColumnsLayout`
  validate constrained values before a renderer turns them into attributes or styles.
- `resolveLoopsLmxVariables` applies to both text and string attributes and supports the
  documented `contact`, `event`, and `data` namespaces.
  `resolveSafeLoopsLmxUrl` resolves variables in a URL attribute before validating it.

```ts
const href = resolveSafeLoopsLmxUrl(node.attributes.href, variables, "link");

if (href) renderLink(href, node.children);
```

The URL helper normalizes bare hostnames such as `linkedin.com` to HTTPS and rejects relative,
protocol-relative, executable, and unsupported URLs. Render text as text nodes rather than raw
HTML; this package intentionally never provides an HTML rendering escape hatch.

Use `applyInlineStyles` to map supported presentation attributes to a framework-neutral, validated
CSS property object. It ignores unknown or malformed values and accepts an `enabled` flag for
renderers that need to disable inline styling.

## Variables and URLs

```ts
import { resolveLoopsLmxVariables, resolveSafeLoopsLmxUrl } from "@onderwijsin/loops-core";

const variables = { contact: { firstName: "Ada" }, data: { invoiceId: 42 } };
resolveLoopsLmxVariables("Hello {contact.firstName}", variables); // "Hello Ada"
resolveSafeLoopsLmxUrl("https://example.test/{data.invoiceId}", variables, "link");
```

Only explicit `contact.*`, `event.*`, and `data.*` placeholders resolve. Links accept `https`,
`http`, `mailto`, and `tel`; images accept `https` and `http`. Relative, protocol-relative, data,
JavaScript, and other unsafe URLs return `null`.

## Conditional rules

Use `evaluate` in a presentation layer when rendering a conditional
`Section`. It evaluates one documented LMX variable at a time and never throws.

```ts
import { evaluate } from "@onderwijsin/loops-core";

const visible = evaluate(
  { variable: "{contact.plan}", operation: "equal", value: "Pro" },
  variables,
  { onMissingVariable: false }
);
```

Supported operations are `not_empty`, `empty`, `equal`, `not_equal`, `contains`,
`not_contains`, `numeric_equal`, `numeric_not_equal`, `greater_than`, `less_than`,
`true`, and `false`. Equality is strict and case-sensitive; numeric operations accept
numeric strings. Missing variables and invalid rules default to `false`, with explicit
`onMissingVariable`, `onInvalidCondition`, and `onInvalidComparison` fallbacks available.

## Verify and validate webhooks

Verify the exact raw body before parsing JSON. Your framework adapter extracts headers.

```ts
import { loopsWebhookSchema, verifyLoopsWebhookSignature } from "@onderwijsin/loops-core";

const isValid = await verifyLoopsWebhookSignature(
  rawBody,
  {
    id: request.headers.get("webhook-id") ?? "",
    timestamp: request.headers.get("webhook-timestamp") ?? "",
    signature: request.headers.get("webhook-signature") ?? ""
  },
  signingSecret,
  { timestampToleranceSeconds: 300 }
);

if (isValid) {
  const event = loopsWebhookSchema.parse(JSON.parse(rawBody));
  // Route on event.eventName.
}
```

Invalid headers, secrets, timestamps, or signatures return `false`; they never throw. The verifier
supports multiple versioned signatures and uses constant-time comparison for candidate signatures.

The exported webhook schema covers contact events, campaign/workflow/transactional send events,
delivery and engagement events, and `testing.testEvent`. The package does not provide an email
client or campaign schemas; use the official [Loops SDK](https://github.com/loops-so/loops-js) for
API access and campaign types.

## Contributing and releases

Use Conventional Commits (`fix:`, `feat:`, and breaking changes). Pull requests run formatting,
linting, type checking, tests, build, and commit validation. Successful `main` releases use
semantic-release, npm Trusted Publishing, and provenance. The first publish requires an
`NPM_TOKEN` with permission to create the package; after configuring the package's trusted
publisher on npm, subsequent releases use GitHub Actions OIDC.

Each release updates `CHANGELOG.md` and commits the generated changelog and `package.json` version
back to `main` with `[skip ci]`. Releases are manually dispatched from `main`; the GitHub release
app creates the protected-branch commit, tag, and GitHub Release.

When first opening the project, make sure to run

```sh
corepack enable
pnpm husky
```

## License and support

MIT. Please report issues at [onderwijsin/loops-core](https://github.com/onderwijsin/loops-core).
