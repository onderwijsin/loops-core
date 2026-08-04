/** Raw Loops webhook headers extracted by an application HTTP adapter. */
export type LoopsWebhookHeaders = { id: string; timestamp: string; signature: string };

/** Options for replay protection and deterministic signature verification. */
export type VerifyLoopsWebhookSignatureOptions = {
  timestampToleranceSeconds: number;
  now?: Date | number;
};

/**
 * Verifies a Loops signature using only Web Platform cryptography APIs.
 *
 * @param rawBody - Exact request body before JSON parsing.
 * @param headers - Webhook ID, timestamp, and versioned signature header.
 * @param signingSecret - Loops `whsec_` signing secret.
 * @param options - Replay-window settings and optional deterministic current time.
 * @returns `true` only when a current timestamp and at least one signature are valid; otherwise `false`.
 *
 * @example
 * await verifyLoopsWebhookSignature(rawBody, headers, signingSecret, {
 *   timestampToleranceSeconds: 300
 * });
 */
export async function verifyLoopsWebhookSignature(
  rawBody: string,
  headers: LoopsWebhookHeaders,
  signingSecret: string,
  options: VerifyLoopsWebhookSignatureOptions
): Promise<boolean> {
  try {
    if (
      !headers.id ||
      !isSafeTimestamp(headers.timestamp) ||
      !isValidTolerance(options.timestampToleranceSeconds)
    )
      return false;
    const timestamp = Number(headers.timestamp);
    const now = getNowSeconds(options.now);
    if (now === null || Math.abs(now - timestamp) > options.timestampToleranceSeconds) return false;
    const secret = decodeSigningSecret(signingSecret);
    if (!secret) return false;
    const expected = await sign(`${headers.id}.${headers.timestamp}.${rawBody}`, secret);
    return parseSignatures(headers.signature).some((candidate) =>
      timingSafeEqual(candidate, expected)
    );
  } catch {
    return false;
  }
}

/**
 * Ensures an untrusted timestamp is a decimal safe integer.
 *
 * @param value - Timestamp header value.
 * @returns Whether the value is an unsigned decimal safe integer.
 */
function isSafeTimestamp(value: string): boolean {
  return /^\d+$/.test(value) && Number.isSafeInteger(Number(value));
}

/**
 * Rejects unsafe replay-window settings.
 *
 * @param value - Caller-supplied replay tolerance in seconds.
 * @returns Whether the tolerance is finite and non-negative.
 */
function isValidTolerance(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

/**
 * Normalizes an injected time to integer seconds.
 *
 * @param value - Optional date or epoch milliseconds; absent values use the current time.
 * @returns Whole epoch seconds, or `null` for an invalid supplied time.
 */
function getNowSeconds(value: Date | number | undefined): number | null {
  const milliseconds = value instanceof Date ? value.getTime() : (value ?? Date.now());
  return Number.isFinite(milliseconds) ? Math.floor(milliseconds / 1_000) : null;
}

/**
 * Decodes the `whsec_` base64 secret without depending on Node Buffer.
 *
 * @param value - Loops signing secret.
 * @returns Secret bytes, or `null` when the prefix or base64 payload is invalid.
 */
function decodeSigningSecret(value: string): Uint8Array | null {
  const match = /^whsec_([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return null;
  try {
    const bytes = Uint8Array.from(atob(match[1]!), (character) => character.charCodeAt(0));
    return bytes.length > 0 ? bytes : null;
  } catch {
    return null;
  }
}

/**
 * Creates Loops' base64 HMAC-SHA256 signature.
 *
 * @param content - Canonical signed webhook content.
 * @param secret - Decoded signing-secret bytes.
 * @returns Base64 HMAC-SHA256 signature.
 * @throws {DOMException} When the runtime cryptography implementation rejects the key or signing operation.
 */
async function sign(content: string, secret: Uint8Array): Promise<string> {
  const secretBuffer = secret.buffer.slice(
    secret.byteOffset,
    secret.byteOffset + secret.byteLength
  ) as ArrayBuffer;
  const key = await crypto.subtle.importKey(
    "raw",
    secretBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(content));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

/**
 * Extracts versioned signatures from Loops' space-delimited header format.
 *
 * @param header - Raw `webhook-signature` header.
 * @returns Well-formed base64 signature candidates without their version prefix.
 */
function parseSignatures(header: string): string[] {
  return header
    .split(/\s+/)
    .map((entry) => /^v\d+,([A-Za-z0-9+/]+={0,2})$/.exec(entry)?.[1])
    .filter((value): value is string => value !== undefined);
}

/**
 * Compares equal-length values without returning on an early character mismatch.
 *
 * @param left - First signature candidate.
 * @param right - Expected signature.
 * @returns Whether both values have equal length and contents.
 */
function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1)
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}
