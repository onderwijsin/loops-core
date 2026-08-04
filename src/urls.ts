import { hasProtocol, normalizeURL, withHttps } from "ufo";
import { resolveLoopsLmxVariables, type LoopsLmxVariables } from "./variables";

/** The LMX attribute context that determines permitted URL protocols. */
export type LoopsLmxUrlKind = "link" | "image";

const allowedProtocols: Record<LoopsLmxUrlKind, ReadonlySet<string>> = {
  link: new Set(["https:", "http:", "mailto:", "tel:"]),
  image: new Set(["https:", "http:"])
};

/**
 * Resolves LMX variables then permits only absolute, non-executable URLs.
 *
 * @param value - The untrusted LMX attribute value.
 * @param variables - Values used to resolve supported LMX merge tags.
 * @param kind - Whether the destination is used as a link or image source.
 * @returns A normalized allowed URL, or `null` when the value is unsafe or invalid. Schemeless
 * hostnames are normalized to HTTPS.
 *
 * @example
 * resolveSafeLoopsLmxUrl("https://example.test/{data.id}", { data: { id: 42 } }, "link");
 * // "https://example.test/42"
 * resolveSafeLoopsLmxUrl("linkedin.com", {}, "link");
 * // "https://linkedin.com/"
 */
export function resolveSafeLoopsLmxUrl(
  value: string | undefined,
  variables: LoopsLmxVariables,
  kind: LoopsLmxUrlKind
): string | null {
  const resolved = value ? resolveLoopsLmxVariables(value, variables).trim() : "";
  if (!resolved || resolved.startsWith("//") || resolved.startsWith("/")) return null;

  try {
    const url = new URL(hasProtocol(resolved) ? resolved : withHttps(normalizeURL(resolved)));
    return allowedProtocols[kind].has(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}
