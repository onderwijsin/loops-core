# Public API

Install with `pnpm add @onderwijsin/loops-core` and import only from `@onderwijsin/loops-core`; v1 has no subpath exports.

## LMX data and parsing

```ts
import {
  loopsLmxAstSchema,
  parseLoopsLmx,
  type LoopsLmxAst,
  type LoopsLmxDiagnostic
} from "@onderwijsin/loops-core";

const diagnostics: LoopsLmxDiagnostic[] = [];
const ast: LoopsLmxAst = await parseLoopsLmx(lmx, {
  // Optional: only trusted server code should enable component expansion.
  apiKey: process.env.LOOPS_API_KEY,
  maxComponentDepth: 8,
  onDiagnostic: (diagnostic) => diagnostics.push(diagnostic)
});
```

`parseLoopsLmx` is permissive: it retains recoverable malformed text and unknown nodes, ignores comments, and does not throw for an individual node failure. It retains the original component and local children for load failures, cycles, invalid component responses, and depth-limit failures. Without `apiKey`, it never performs network I/O. With `apiKey`, component retrieval is the parser's deliberately narrow, opt-in transport exception.

Validate persisted AST before rendering with `loopsLmxAstSchema.safeParse`. The exported node schemas are `loopsLmxTextNodeSchema`, `loopsLmxElementSchema`, and `loopsLmxNodeSchema`.

## Variables, URLs, and rendering utilities

```ts
import {
  getLoopsLmxColumnsLayout,
  getLoopsLmxImageWidth,
  hasUnsupportedLoopsLmxNodes,
  isRenderableLoopsLmxElement,
  resolveLoopsLmxVariables,
  resolveSafeLoopsLmxUrl
} from "@onderwijsin/loops-core";

const text = resolveLoopsLmxVariables("Hi {contact.firstName}", {
  contact: { firstName: "Ada" }
});
const href = resolveSafeLoopsLmxUrl(
  "example.test/{contact.userId}",
  { contact: { userId: "user-42" } },
  "link"
); // https://example.test/user-42
```

Only `{contact.name}` and `{data.name}` resolve. Missing and null values become empty strings; unknown syntax remains unchanged. Resolve every string attribute that a renderer uses. For URL attributes, call `resolveSafeLoopsLmxUrl` directly: it resolves variables first.

Links allow `https:`, `http:`, `mailto:`, and `tel:`. Images allow only `https:` and `http:`. The URL helper rejects relative, protocol-relative, executable, data, malformed, and unsupported URLs; it normalizes bare hostnames to HTTPS.

Renderer helpers:

- `isRenderableLoopsLmxElement(node)`
- `hasRenderableLoopsLmxNodes(nodes)`
- `hasUnsupportedLoopsLmxNodes(nodes)` / `getUnsupportedLoopsLmxNodes(nodes)`
- `getLoopsLmxImageWidth(value)` allows integer 12–600.
- `getLoopsLmxPixels(value, minimum, maximum)` allows bounded decimal integers.
- `getLoopsLmxColumnsLayout(widths, gap, columnCount)` validates percentages, a 0–150 gap, and safely falls back to equal columns.

`Style` is metadata: neither visible nor unsupported. Do not use it as arbitrary CSS.

## Webhooks

```ts
import {
  loopsWebhookSchema,
  loopsWebhookEnvelopeSchema,
  verifyLoopsWebhookSignature
} from "@onderwijsin/loops-core";

const valid = await verifyLoopsWebhookSignature(rawBody, headers, signingSecret, {
  timestampToleranceSeconds: 300
});
if (!valid) throw new Error("Invalid webhook signature");

const body: unknown = JSON.parse(rawBody);
const envelope = loopsWebhookEnvelopeSchema.safeParse(body);
const event = loopsWebhookSchema.safeParse(body);
```

`headers` must contain `{ id, timestamp, signature }`. Verification accepts multiple versioned signatures, validates safe integer timestamps and tolerance, uses Web Crypto HMAC-SHA256 and constant-time comparison, and returns `false` rather than throwing for invalid inputs.

`loopsWebhookSchema` is a discriminated union covering all documented contact, email-send,
delivery/engagement, and testing events. Use `loopsWebhookEnvelopeSchema` when only the shared
metadata is needed. The package does not provide an email client or campaign schemas; install the
official Loops SDK when API transport or campaign types are needed.
