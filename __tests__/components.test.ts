import { ofetch } from "ofetch";
import { describe, expect, it, vi } from "vitest";
import { parseLoopsLmx } from "../src/index";

vi.mock("ofetch", () => ({ ofetch: vi.fn() }));

describe("LMX component expansion", () => {
  it("expands components, detects cycles, and preserves fallback nodes", async () => {
    const diagnostics: string[] = [];
    vi.mocked(ofetch)
      .mockReset()
      .mockResolvedValueOnce({
        id: "a",
        name: "A",
        lmx: '<Paragraph>A</Paragraph><Component componentId="b" />'
      })
      .mockResolvedValueOnce({ id: "b", name: "B", lmx: '<Component componentId="a" />' });
    const ast = await parseLoopsLmx('<Component componentId="a" />', {
      apiKey: "key",
      onDiagnostic: ({ code }) => diagnostics.push(code)
    });
    expect(ast.children[0]).toMatchObject({
      name: "Component",
      children: [{ name: "Paragraph" }, { name: "Component" }]
    });
    expect(diagnostics).toContain("component_cycle");
  });

  it("uses explicit component content and skips the fetch", async () => {
    vi.mocked(ofetch).mockReset();
    const ast = await parseLoopsLmx(
      '<Component componentId="a"><Paragraph>local override</Paragraph></Component>',
      { apiKey: "key" }
    );
    expect(ast.children[0]).toMatchObject({
      children: [{ name: "Paragraph", children: [{ value: "local override" }] }]
    });
    expect(ofetch).not.toHaveBeenCalled();
  });

  it("does not fetch without an API key and reports depth limits", async () => {
    vi.mocked(ofetch).mockReset();
    await parseLoopsLmx('<Component componentId="footer" />');
    expect(ofetch).not.toHaveBeenCalled();
    const diagnostics: string[] = [];
    await parseLoopsLmx('<Component componentId="footer" />', {
      apiKey: "key",
      maxComponentDepth: 0,
      onDiagnostic: ({ code }) => diagnostics.push(code)
    });
    expect(diagnostics).toContain("component_depth_exceeded");
  });
});
