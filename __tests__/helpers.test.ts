import { describe, expect, it } from "vitest";
import {
  applyInlineStyles,
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
  it("maps all supported presentation attributes to CSS properties", () => {
    expect(
      applyInlineStyles({
        bgColor: "#AbC",
        blockColor: "#000000",
        textColor: "#123456",
        borderColor: "#abc",
        blockBorderColor: "#000000",
        color: "#456789",
        borderRadius: "999",
        blockBorderRadius: "6",
        borderWidth: "16",
        blockBorderWidth: "4",
        paddingTop: "0",
        paddingRight: "999",
        paddingBottom: "8",
        paddingLeft: "1",
        innerXPadding: "100",
        innerYPadding: "0",
        fontSize: "64",
        lineHeight: "300",
        align: "center",
        onclick: "alert(1)"
      })
    ).toEqual({
      backgroundColor: "#AbC",
      color: "#123456",
      borderColor: "#456789",
      borderRadius: "999px",
      borderWidth: "16px",
      paddingTop: "0px",
      paddingRight: "999px",
      paddingBottom: "8px",
      paddingLeft: "1px",
      paddingInline: "100px",
      paddingBlock: "0px",
      fontSize: "64px",
      lineHeight: "300%",
      textAlign: "center"
    });
  });

  it("uses safe aliases and precedence when specific values are absent or invalid", () => {
    expect(
      applyInlineStyles({
        bgColor: "not-a-color",
        blockColor: "#fff",
        borderColor: "#1234",
        blockBorderColor: "#123456",
        borderRadius: "1000",
        blockBorderRadius: "12",
        borderWidth: "17",
        blockBorderWidth: "2"
      })
    ).toEqual({
      backgroundColor: "#fff",
      borderColor: "#123456",
      borderRadius: "12px",
      borderWidth: "2px"
    });
  });

  it("lets divider color override the generic border color", () => {
    expect(
      applyInlineStyles({ borderColor: "#111", blockBorderColor: "#222", color: "#333" })
    ).toEqual({ borderColor: "#333" });
    expect(applyInlineStyles({ color: "#abc" })).toEqual({ borderColor: "#abc" });
  });

  it("accepts only three- or six-digit hex colors", () => {
    expect(
      applyInlineStyles({
        blockColor: "#12",
        textColor: "#abcd",
        borderColor: "red",
        blockBorderColor: "#12345g",
        color: "url(javascript:alert(1))"
      })
    ).toEqual({});
    expect(applyInlineStyles({ blockColor: "#ABCDEF", textColor: "#abc" })).toEqual({
      backgroundColor: "#ABCDEF",
      color: "#abc"
    });
  });

  it("rejects malformed and out-of-range pixel values", () => {
    expect(
      applyInlineStyles({
        borderRadius: "1.5",
        borderWidth: "-1",
        paddingTop: "+1",
        paddingRight: "1000",
        paddingBottom: " 8",
        paddingLeft: "8px",
        innerXPadding: "101",
        innerYPadding: "-1",
        fontSize: "5",
        lineHeight: "301"
      })
    ).toEqual({});
    expect(
      applyInlineStyles({
        borderRadius: "0",
        borderWidth: "0",
        paddingTop: "999",
        innerXPadding: "100",
        fontSize: "6",
        lineHeight: "100"
      })
    ).toEqual({
      borderRadius: "0px",
      borderWidth: "0px",
      paddingTop: "999px",
      paddingInline: "100px",
      fontSize: "6px",
      lineHeight: "100%"
    });
  });

  it("allows only documented alignments and ignores unknown attributes", () => {
    expect(applyInlineStyles({ align: "left", dataStyle: "color:red" })).toEqual({
      textAlign: "left"
    });
    expect(applyInlineStyles({ align: "right" })).toEqual({ textAlign: "right" });
    expect(applyInlineStyles({ align: "LEFT" })).toEqual({});
    expect(applyInlineStyles({ align: "justify", style: "color:red" })).toEqual({});
  });

  it("returns no styles when inline styling is disabled", () => {
    expect(applyInlineStyles({ blockColor: "#fff" }, false)).toEqual({});
  });

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
