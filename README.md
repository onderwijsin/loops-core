# @onderwijsin/loops-core

Use this package to safely receive, retrieve, parse, and render Loops campaign content in any
application. It provides the portable contract between Loops and your app, so a webapp campaign archive, a
webhook consumer, or a backend can use the same campaign data without inheriting framework
or presentation code.

It owns safe LMX parsing, component expansion, rendering interpretation, webhook verification, and
the Email Campaign API contract. It does not provide HTTP handlers, persistence, queues, campaign
policy, Vue components, or styling; use `@onderwijsin/nuxt-loops-renderer` for the presentation
layer.

It runs on Node.js, Nuxt/Nitro, Cloudflare Workers, and compatible browser contexts. Runtime code
uses Web Platform APIs only.

## Install

```sh
pnpm add @onderwijsin/loops-core
```

## Parse LMX

```ts
import { parseLoopsLmx } from "@onderwijsin/loops-core";

const content = await parseLoopsLmx("<Paragraph>Hello <Strong>world</Strong>.</Paragraph>");
```

Unknown nodes and attributes remain in the AST. Comments are ignored and malformed content is
recovered as far as possible. Component expansion has a finite default maximum depth of 8.

```ts
const content = await parseLoopsLmx('<Component componentId="footer" />', {
  apiKey: process.env.LOOPS_API_KEY,
  onDiagnostic: (diagnostic) => reportDiagnostic(diagnostic)
});
```

When `apiKey` is supplied, components load internally through the Loops API. Keep this call on a
trusted server because the API key must never reach the browser. Cycles, unavailable components,
and depth-limit failures retain the original component node and its local children; they do not
make the full document fail.

## Renderer utilities

This package deliberately does not render HTML or Vue components. A renderer such as
`@onderwijsin/nuxt-loops-renderer` maps the AST to its own UI and uses the shared helpers here for
the safe parts of that interpretation:

- `isRenderableLoopsLmxElement`, `hasRenderableLoopsLmxNodes`, and
  `getUnsupportedLoopsLmxNodes` identify the supported visible subset without discarding unknown
  LMX from the stored AST.
- `getLoopsLmxImageWidth`, `getLoopsLmxPixels`, and `getLoopsLmxColumnsLayout` validate the
  constrained dimensions and column data before a renderer turns them into attributes or styles.
- `resolveLoopsLmxVariables` applies to both text and string attributes.
  `resolveSafeLoopsLmxUrl` resolves variables in a URL attribute before validating it.

```ts
const href = resolveSafeLoopsLmxUrl(node.attributes.href, variables, "link");

if (href) renderLink(href, node.children);
```

The URL helper normalizes bare hostnames such as `linkedin.com` to HTTPS and rejects relative,
protocol-relative, executable, and unsupported URLs. Render text as text nodes rather than raw
HTML; this package intentionally never provides an HTML rendering escape hatch.

## Variables and URLs

```ts
import { resolveLoopsLmxVariables, resolveSafeLoopsLmxUrl } from "@onderwijsin/loops-core";

const variables = { contact: { firstName: "Ada" }, data: { invoiceId: 42 } };
resolveLoopsLmxVariables("Hello {contact.firstName}", variables); // "Hello Ada"
resolveSafeLoopsLmxUrl("https://example.test/{data.invoiceId}", variables, "link");
```

Only `contact.*` and `data.*` placeholders resolve. Links accept `https`, `http`, `mailto`, and
`tel`; images accept `https` and `http`. Relative, protocol-relative, data, JavaScript, and other
unsafe URLs return `null`.

## Verify webhooks

Verify the exact raw body before parsing JSON. Your framework adapter extracts headers.

```ts
import { verifyLoopsWebhookSignature } from "@onderwijsin/loops-core";

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

if (isValid) JSON.parse(rawBody);
```

Invalid headers, secrets, timestamps, or signatures return `false`; they never throw. The verifier
supports multiple versioned signatures and uses constant-time comparison for candidate signatures.

## Email Campaign API client

```ts
import { createLoopsEmailCampaignClient } from "@onderwijsin/loops-core";

const client = createLoopsEmailCampaignClient(process.env.LOOPS_API_KEY!);
const message = await client.getEmailMessage("email-message-id");
const component = await client.getComponent("component-id");
```

Successful responses are validated against exported Zod schemas. Transport, status, retries,
caching, credentials storage, and persistence remain application responsibilities.

## Contributing and releases

Use Conventional Commits (`fix:`, `feat:`, and breaking changes). Pull requests run formatting,
linting, type checking, tests, build, and commit validation. Successful `main` releases use
semantic-release and npm Trusted Publishing with provenance—no long-lived npm token is used.
Each release updates `CHANGELOG.md` and commits the generated changelog and `package.json` version
back to `main` with `[skip ci]`. Releases are manually dispatched from `main`; the GitHub release
app creates the protected-branch commit, tag, and GitHub Release.

## License and support

MIT. Please report issues at [onderwijsin/loops-core](https://github.com/onderwijsin/loops-core).
