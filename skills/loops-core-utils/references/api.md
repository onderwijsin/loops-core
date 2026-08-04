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
  // Include apiKey only in trusted server code to expand <Component> nodes.
  apiKey: process.env.LOOPS_API_KEY,
  maxComponentDepth: 8,
  onDiagnostic: (diagnostic) => diagnostics.push(diagnostic)
});
```

`parseLoopsLmx` is permissive: it retains recoverable malformed text and unknown nodes, ignores comments, and does not throw for an individual node failure. It retains the original component and local children for load failures, cycles, invalid component responses, and depth-limit failures. Do not add a user-supplied component loader; component retrieval is internal when `apiKey` is supplied.

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
  loopsCampaignWebhookSchema,
  loopsWebhookEnvelopeSchema,
  verifyLoopsWebhookSignature
} from "@onderwijsin/loops-core";

const valid = await verifyLoopsWebhookSignature(rawBody, headers, signingSecret, {
  timestampToleranceSeconds: 300
});
if (!valid) throw new Error("Invalid webhook signature");

const body: unknown = JSON.parse(rawBody);
const envelope = loopsWebhookEnvelopeSchema.safeParse(body);
const campaign = loopsCampaignWebhookSchema.safeParse(body);
```

`headers` must contain `{ id, timestamp, signature }`. Verification accepts multiple versioned signatures, validates safe integer timestamps and tolerance, uses Web Crypto HMAC-SHA256 and constant-time comparison, and returns `false` rather than throwing for invalid inputs.

Use `loopsWebhookEnvelopeSchema` to identify/ignore unrelated verified events. Use the strict campaign schema for `campaign.email.sent` only.

## Email Campaign API

```ts
import { createLoopsEmailCampaignClient } from "@onderwijsin/loops-core";

const client = createLoopsEmailCampaignClient(process.env.LOOPS_API_KEY!);
const message = await client.getEmailMessage("email-message-id");
const component = await client.getComponent("component-id");
```

The client uses `ofetch` internally with the fixed Loops API base URL and `retry: 0`, URI-encodes IDs, and validates successful responses with `loopsEmailMessageSchema` or `loopsComponentSchema`. It throws on transport failures, non-2xx responses, and invalid successful responses. Do not add a fetcher parameter.

`LoopsEmailMessage` is normalized and includes `updatedAt: Date`; `LoopsComponent` is normalized to `{ componentId, lmx }`.
