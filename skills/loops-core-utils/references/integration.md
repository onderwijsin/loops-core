# Integration patterns

## Server webhook adapter

Keep framework work outside the package. The sequence is mandatory:

1. Read the raw request body as UTF-8.
2. Extract `webhook-id`, `webhook-timestamp`, and `webhook-signature`.
3. Call `verifyLoopsWebhookSignature(rawBody, headers, secret, options)`.
4. Only after success, parse JSON and validate the envelope/payload schemas.
5. Implement idempotency, filtering, queues, persistence, and HTTP responses in the consuming app.

Never log the signing secret, raw signature, or recipient payload.

## LMX ingestion

Fetch an email message through the client, then parse its `lmx` in a trusted server process:

```ts
const message = await createLoopsEmailCampaignClient(apiKey).getEmailMessage(messageId);
const ast = await parseLoopsLmx(message.lmx, { apiKey, onDiagnostic });
```

Store `ast` as JSON if needed. Revalidate it at the rendering boundary. Component expansion is optional: omit `apiKey` when parsing browser-side or untrusted content, or when remote component retrieval is not wanted.

## Renderer contract

The renderer owns templates, styles, accessibility, and framework details. Core owns shared safety and interpretation.

For each node:

1. Render text as an escaped text node after `resolveLoopsLmxVariables`.
2. For supported elements, map only the supported attributes needed by the renderer.
3. For `href`, `src`, or dynamic image targets, use `resolveSafeLoopsLmxUrl` with `"link"` or `"image"`.
4. Validate pixels and column layouts with exported helpers before assigning attributes/styles.
5. Omit unsupported elements and optionally show an unsupported-content notice from `getUnsupportedLoopsLmxNodes`.

Do not evaluate conditions, expressions, CSS, event handlers, or arbitrary attributes. Do not use raw HTML injection.
