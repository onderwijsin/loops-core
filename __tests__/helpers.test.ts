import { describe, expect, it } from "vitest";
import {
  getLoopsLmxColumnsLayout,
  getLoopsLmxImageWidth,
  getLoopsLmxPixels,
  hasRenderableLoopsLmxNodes,
  hasUnsupportedLoopsLmxNodes,
  isRenderableLoopsLmxElement,
  resolveLoopsLmxVariables,
  resolveSafeLoopsLmxUrl
} from "../src/index";

describe("LMX rendering helpers", () => {
  it("resolves supported variables and preserves unresolved variables", () => {
    const variables = {
      contact: { name: "Ada", missing: null },
      event: { plan: "Pro" },
      data: { id: 42 }
    };
    expect(
      resolveLoopsLmxVariables(
        "{contact.name} {contact.missing} {other.x} {event.plan} {data.id}",
        variables
      )
    ).toBe("Ada  {other.x} Pro 42");
    expect(resolveSafeLoopsLmxUrl("https://example.test/{event.plan}", variables, "link")).toBe(
      "https://example.test/Pro"
    );
    expect(resolveSafeLoopsLmxUrl("x.com", variables, "link")).toBe("https://x.com/");
    expect(resolveSafeLoopsLmxUrl("mailto:person@example.test", variables, "link")).toBe(
      "mailto:person@example.test"
    );
    expect(resolveSafeLoopsLmxUrl("javascript:alert(1)", variables, "link")).toBeNull();
    expect(resolveSafeLoopsLmxUrl("//example.test/a", variables, "image")).toBeNull();
  });

  it("validates pixels, image widths, column layouts, and renderability", () => {
    expect(getLoopsLmxImageWidth("12")).toBe(12);
    expect(getLoopsLmxImageWidth("601")).toBeUndefined();
    expect(getLoopsLmxPixels("2.5", 0, 10)).toBeUndefined();
    expect(getLoopsLmxColumnsLayout("40,60", "12", 2)).toEqual({
      display: "grid",
      gap: "12px",
      gridTemplateColumns: "40fr 60fr"
    });
    expect(getLoopsLmxColumnsLayout("30,30", "200", 2)).toEqual({
      display: "grid",
      gap: "24px",
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))"
    });
    expect(
      isRenderableLoopsLmxElement({ type: "element", name: "Text", attributes: {}, children: [] })
    ).toBe(true);
  });

  it("distinguishes visible supported nodes from unsupported nodes", async () => {
    const { parseLoopsLmx } = await import("../src/index");
    const ast = await parseLoopsLmx("<Style>x</Style><Unknown /><Paragraph>visible</Paragraph>");
    expect(hasUnsupportedLoopsLmxNodes(ast.children)).toBe(true);
    expect(hasRenderableLoopsLmxNodes(ast.children)).toBe(true);
  });
});
