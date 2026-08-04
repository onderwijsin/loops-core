import { ofetch } from "ofetch";
import { describe, expect, it, vi } from "vitest";
import {
  createLoopsEmailCampaignClient,
  getLoopsLmxColumnsLayout,
  getLoopsLmxImageWidth,
  getLoopsLmxPixels,
  hasRenderableLoopsLmxNodes,
  hasUnsupportedLoopsLmxNodes,
  loopsCampaignWebhookSchema,
  loopsEmailMessageSchema,
  loopsLmxAstSchema,
  parseLoopsLmx,
  resolveLoopsLmxVariables,
  resolveSafeLoopsLmxUrl,
  verifyLoopsWebhookSignature
} from "../src/index";
import realWorldComponent from "./fixtures/component.json";
import realWorldEmailMessage from "./fixtures/email-message.json";
import realWorldTheme from "./fixtures/theme.json";
import realWorldCampaignWebhook from "./fixtures/campaign-webhook.json";
import realWorldLmx from "./fixtures/campaign.lmx?raw";

vi.mock("ofetch", () => ({ ofetch: vi.fn() }));

describe("LMX", () => {
  it("parses text, quoted attributes, comments, self closing nodes, and malformed text", async () => {
    const ast = await parseLoopsLmx(
      '<Paragraph title="hello world">Hi<!-- gone --><Image src="https://x.test/a" /></Paragraph><broken'
    );
    expect(ast.children).toEqual([
      {
        type: "element",
        name: "Paragraph",
        attributes: { title: "hello world" },
        children: [
          { type: "text", value: "Hi" },
          { type: "element", name: "Image", attributes: { src: "https://x.test/a" }, children: [] }
        ]
      },
      { type: "text", value: "<broken" }
    ]);
    expect(loopsLmxAstSchema.safeParse(ast).success).toBe(true);
    expect(
      loopsLmxAstSchema.safeParse({ type: "root", children: [{ type: "text" }] }).success
    ).toBe(false);
  });

  it("expands components and preserves failed, cyclic, and depth-limited nodes", async () => {
    const diagnostics: string[] = [];
    const components = {
      a: { id: "a", name: "A", lmx: '<Paragraph>A</Paragraph><Component componentId="b" />' },
      b: { id: "b", name: "B", lmx: '<Component componentId="a" />' }
    };
    vi.mocked(ofetch)
      .mockReset()
      .mockResolvedValueOnce(components.a)
      .mockResolvedValueOnce(components.b)
      .mockResolvedValueOnce(undefined);
    const ast = await parseLoopsLmx(
      '<Component componentId="a"><Paragraph>fallback</Paragraph></Component>',
      {
        apiKey: "key",
        onDiagnostic: ({ code }) => diagnostics.push(code)
      }
    );
    expect(ast.children[0]).toMatchObject({
      name: "Component",
      children: [{ name: "Paragraph" }, { name: "Component" }]
    });
    expect(diagnostics).toContain("component_cycle");

    const missing = await parseLoopsLmx(
      '<Component componentId="missing"><Paragraph>local</Paragraph></Component>',
      {
        apiKey: "key"
      }
    );
    expect(missing.children[0]).toMatchObject({
      name: "Component",
      children: [{ name: "Paragraph" }]
    });
    const limited = await parseLoopsLmx('<Component componentId="a" />', {
      apiKey: "key",
      maxComponentDepth: 0
    });
    expect(limited.children[0]).toMatchObject({ name: "Component" });
  });

  it("parses an anonymized real-world campaign and resolves its component", async () => {
    vi.mocked(ofetch).mockReset().mockResolvedValue(realWorldComponent);
    const ast = await parseLoopsLmx(realWorldLmx, {
      apiKey: "key"
    });
    const serialized = JSON.stringify(ast);
    expect(serialized).toContain('"name":"Style"');
    expect(serialized).toContain(`"themeId":"${realWorldTheme.id}"`);
    expect(serialized).toContain('"name":"Image"');
    expect(serialized).toContain('"href":"https://example.test/{contact.userId}"');
    expect(serialized).toContain('"href":"x.com"');
    expect(hasUnsupportedLoopsLmxNodes(ast.children)).toBe(true);
  });
});

describe("safe rendering helpers", () => {
  it("resolves supported variables and safe URLs", () => {
    const variables = { contact: { name: "Ada", missing: null }, data: { id: 42 } };
    expect(
      resolveLoopsLmxVariables("{contact.name} {contact.missing} {other.x} {data.id}", variables)
    ).toBe("Ada  {other.x} 42");
    expect(resolveSafeLoopsLmxUrl("https://example.test/{data.id}", variables, "link")).toBe(
      "https://example.test/42"
    );
    expect(
      resolveSafeLoopsLmxUrl("https://example.test?utm_source={contact.name}", variables, "link")
    ).toBe("https://example.test/?utm_source=Ada");
    expect(resolveSafeLoopsLmxUrl("x.com", variables, "link")).toBe("https://x.com/");
    expect(resolveSafeLoopsLmxUrl("linkedin.com", variables, "link")).toBe("https://linkedin.com/");
    expect(resolveSafeLoopsLmxUrl("mailto:person@example.test", variables, "link")).toBe(
      "mailto:person@example.test"
    );
    expect(resolveSafeLoopsLmxUrl("tel:+31612345678", variables, "link")).toBe("tel:+31612345678");
    expect(resolveSafeLoopsLmxUrl("javascript:alert(1)", variables, "link")).toBeNull();
    expect(resolveSafeLoopsLmxUrl("//example.test/a", variables, "image")).toBeNull();
  });

  it("validates pixels, layouts, and visible/unsupported nodes", async () => {
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
    const ast = await parseLoopsLmx("<Style>x</Style><Unknown /><Paragraph>visible</Paragraph>");
    expect(hasUnsupportedLoopsLmxNodes(ast.children)).toBe(true);
    expect(hasRenderableLoopsLmxNodes(ast.children)).toBe(true);
  });
});

describe("webhooks and API client", () => {
  it("verifies valid and multiple webhook signatures", async () => {
    const secretBytes = "a signing secret";
    const secret = `whsec_${btoa(secretBytes)}`;
    const body = '{"eventName":"campaign.email.sent"}';
    const timestamp = "1000";
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secretBytes),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signed = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`event-1.${timestamp}.${body}`)
    );
    const signature = btoa(String.fromCharCode(...new Uint8Array(signed)));
    const options = { timestampToleranceSeconds: 10, now: 1_000_000 };
    await expect(
      verifyLoopsWebhookSignature(
        body,
        { id: "event-1", timestamp, signature: `v1,bad v1,${signature}` },
        secret,
        options
      )
    ).resolves.toBe(true);
    await expect(
      verifyLoopsWebhookSignature(
        `${body}x`,
        { id: "event-1", timestamp, signature: `v1,${signature}` },
        secret,
        options
      )
    ).resolves.toBe(false);
    await expect(
      verifyLoopsWebhookSignature(
        body,
        { id: "event-1", timestamp: "bad", signature: `v1,${signature}` },
        secret,
        options
      )
    ).resolves.toBe(false);
  });

  it("validates successful campaign API responses", async () => {
    expect(loopsCampaignWebhookSchema.parse(realWorldCampaignWebhook).campaignId).toBe(
      "campaign-anonymized"
    );
    vi.mocked(ofetch)
      .mockReset()
      .mockResolvedValueOnce(realWorldComponent)
      .mockResolvedValueOnce(realWorldEmailMessage);
    const client = createLoopsEmailCampaignClient("key");
    await expect(client.getComponent("c/id")).resolves.toEqual({
      componentId: "component-logo",
      lmx: realWorldComponent.lmx
    });
    await expect(client.getEmailMessage("m")).resolves.toMatchObject({
      subject: realWorldEmailMessage.subject
    });
    expect(loopsEmailMessageSchema.parse(realWorldEmailMessage).lmx).toBe(realWorldLmx);
    expect(ofetch).toHaveBeenLastCalledWith("/email-messages/m", {
      baseURL: "https://app.loops.so/api/v1",
      headers: { Authorization: "Bearer key" },
      retry: 0
    });
  });
});
