import type { LoopsLmxVariables } from "./variables";

/** Operations supported by conditional LMX rules. */
export type LoopsLmxConditionOperation =
  | "not_empty"
  | "empty"
  | "equal"
  | "not_equal"
  | "contains"
  | "not_contains"
  | "numeric_equal"
  | "numeric_not_equal"
  | "greater_than"
  | "less_than"
  | "true"
  | "false";

/** A single variable-based conditional rule. */
export type LoopsLmxCondition = {
  variable: string;
  operation?: LoopsLmxConditionOperation;
  value?: string | number | boolean;
};

/** Fallbacks used when a conditional rule cannot be evaluated. */
export type EvaluateLoopsLmxOptions = {
  /** Result for a valid variable whose value is null or undefined. */
  onMissingVariable?: boolean;
  /** Result for malformed rules, unsupported variables, or unknown operations. */
  onInvalidCondition?: boolean;
  /** Result when an operation cannot compare the resolved value. */
  onInvalidComparison?: boolean;
};

const variablePattern = /^\{(contact|event|data)\.([A-Za-z0-9_-]+)\}$/;

/**
 * Evaluates one conditional rule against the variables available to a renderer.
 *
 * Missing values, invalid rules, and invalid comparisons are handled through
 * explicit boolean fallbacks and never throw.
 *
 * @param condition - The variable, operation, and optional comparison value.
 * @param variables - Contact, event, and data values available to the renderer.
 * @param options - Optional fallbacks for unevaluable rules.
 * @returns Whether the condition matches.
 */
export function evaluate(
  condition: LoopsLmxCondition,
  variables: LoopsLmxVariables,
  options: EvaluateLoopsLmxOptions = {}
): boolean {
  const invalidCondition = options.onInvalidCondition ?? false;
  const invalidComparison = options.onInvalidComparison ?? invalidCondition;

  if (!condition || typeof condition !== "object" || typeof condition.variable !== "string") {
    return invalidCondition;
  }
  const variable = condition.variable.match(variablePattern);
  if (!variable) return invalidCondition;

  const namespace = variable[1] as "contact" | "event" | "data";
  const key = variable[2]!;
  const resolved = variables[namespace]?.[key];
  if (resolved === null || resolved === undefined) return options.onMissingVariable ?? false;

  const operation = condition.operation ?? "not_empty";
  const value = condition.value;

  switch (operation) {
    case "not_empty":
      return resolved !== "";
    case "empty":
      return resolved === "";
    case "equal":
    case "not_equal":
      if (value === undefined) return invalidCondition;
      if (typeof value !== typeof resolved) return invalidComparison;
      return operation === "equal" ? resolved === value : resolved !== value;
    case "contains":
    case "not_contains": {
      if (typeof resolved !== "string" || typeof value !== "string") return invalidComparison;
      const contains = resolved.includes(value);
      return operation === "contains" ? contains : !contains;
    }
    case "numeric_equal":
    case "numeric_not_equal":
    case "greater_than":
    case "less_than": {
      const resolvedNumber = toFiniteNumber(resolved);
      const valueNumber = toFiniteNumber(value);
      if (resolvedNumber === undefined || valueNumber === undefined) return invalidComparison;
      if (operation === "numeric_equal") return resolvedNumber === valueNumber;
      if (operation === "numeric_not_equal") return resolvedNumber !== valueNumber;
      if (operation === "greater_than") return resolvedNumber > valueNumber;
      return resolvedNumber < valueNumber;
    }
    case "true":
      return typeof resolved === "boolean" ? resolved : invalidComparison;
    case "false":
      return typeof resolved === "boolean" ? !resolved : invalidComparison;
    default:
      return invalidCondition;
  }
}

/** Descriptive alias for the public conditional evaluator. */
export const evaluateLoopsLmxCondition = evaluate;

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "string" && value.trim() === "") return undefined;
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}
