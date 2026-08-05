import { describe, expect, it } from "vitest";
import { evaluate, evaluateLoopsLmxCondition, type LoopsLmxCondition } from "../src/index";

const variables = {
  contact: { plan: "Pro", age: "42", empty: "", enabled: true, disabled: false },
  event: { name: "signup" },
  data: { code: 42 }
};

function evalCondition(condition: Omit<LoopsLmxCondition, "variable"> & { variable?: string }) {
  return evaluateLoopsLmxCondition(
    { variable: "{contact.plan}", ...condition } as LoopsLmxCondition,
    variables
  );
}

describe("evaluateLoopsLmxCondition", () => {
  it("exports the concise evaluate name", () => {
    expect(evaluate).toBe(evaluateLoopsLmxCondition);
  });

  it.each([
    [{ operation: "not_empty" }, true],
    [{ operation: "empty", variable: "{contact.empty}" }, true],
    [{ operation: "equal", value: "Pro" }, true],
    [{ operation: "not_equal", value: "Basic" }, true],
    [{ operation: "contains", value: "r" }, true],
    [{ operation: "not_contains", value: "x" }, true],
    [{ operation: "numeric_equal", variable: "{contact.age}", value: "42" }, true],
    [{ operation: "numeric_not_equal", variable: "{contact.age}", value: "41" }, true],
    [{ operation: "greater_than", variable: "{contact.age}", value: 41 }, true],
    [{ operation: "less_than", variable: "{contact.age}", value: "43" }, true],
    [{ operation: "true", variable: "{contact.enabled}" }, true],
    [{ operation: "false", variable: "{contact.disabled}" }, true]
  ])("evaluates %j as %s", (condition, expected) => {
    expect(evalCondition(condition as Parameters<typeof evalCondition>[0])).toBe(expected);
  });

  it("defaults an omitted operation to not_empty", () => {
    expect(evalCondition({})).toBe(true);
  });

  it("is case-sensitive and uses strict equality", () => {
    expect(evalCondition({ operation: "equal", value: "pro" })).toBe(false);
    expect(evalCondition({ operation: "equal", variable: "{contact.age}", value: 42 })).toBe(false);
  });

  it("returns configured fallbacks without throwing", () => {
    expect(
      evaluateLoopsLmxCondition({ variable: "{contact.missing}", operation: "true" }, variables)
    ).toBe(false);
    expect(
      evaluateLoopsLmxCondition({ variable: "{contact.missing}", operation: "true" }, variables, {
        onMissingVariable: true
      })
    ).toBe(true);
    expect(
      evaluateLoopsLmxCondition({ variable: "{contact.company.name}" }, variables, {
        onInvalidCondition: true
      })
    ).toBe(true);
    expect(
      evaluateLoopsLmxCondition(
        { variable: "{contact.age}", operation: "contains", value: 4 },
        variables,
        { onInvalidComparison: true }
      )
    ).toBe(true);
  });

  it("rejects unsupported namespaces and invalid numeric or boolean comparisons", () => {
    expect(evalCondition({ variable: "{profile.plan}" })).toBe(false);
    expect(evalCondition({ operation: "greater_than", variable: "{contact.plan}", value: 1 })).toBe(
      false
    );
    expect(evalCondition({ operation: "true", variable: "{contact.plan}" })).toBe(false);
  });
});
