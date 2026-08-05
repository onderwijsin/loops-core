/** Safe values that can be interpolated into supported LMX merge tags. */
export type LoopsLmxVariables = {
  contact?: Record<string, string | number | boolean | null | undefined>;
  event?: Record<string, string | number | boolean | null | undefined>;
  data?: Record<string, string | number | boolean | null | undefined>;
};

const variablePattern = /\{(contact|event|data)\.([A-Za-z0-9_-]+)\}/g;

/**
 * Resolves only explicit contact, event, and data LMX merge tags.
 *
 * @param value - Text or an attribute value containing merge tags.
 * @param variables - Values available to the contact, event, and data namespaces.
 * @returns The value with supported tags replaced; missing values become empty strings.
 */
export function resolveLoopsLmxVariables(value: string, variables: LoopsLmxVariables): string {
  return value.replace(
    variablePattern,
    (_match, namespace: "contact" | "event" | "data", key: string) => {
      const resolved = variables[namespace]?.[key];
      return resolved === undefined || resolved === null ? "" : String(resolved);
    }
  );
}
