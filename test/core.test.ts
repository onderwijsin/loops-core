import { ofetch } from "ofetch";
import { describe, expect, it, vi } from "vitest";
import {
  getLoopsLmxColumnsLayout,
  getLoopsLmxImageWidth,
  getLoopsLmxPixels,
  hasRenderableLoopsLmxNodes,
  hasUnsupportedLoopsLmxNodes,
  isRenderableLoopsLmxElement,
  loopsLmxAstSchema,
  loopsWebhookSchema,
  parseLoopsLmx,
  resolveLoopsLmxVariables,
  resolveSafeLoopsLmxUrl,
  verifyLoopsWebhookSignature
} from "../src/index";
import realWorldComponent from "./fixtures/component.json";
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
      .mockResolvedValueOnce(components.b);
    const ast = await parseLoopsLmx('<Component componentId="a" />', {
      apiKey: "key",
      onDiagnostic: ({ code }) => diagnostics.push(code)
    });
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

  it("retains explicit component content instead of fetching its default", async () => {
    vi.mocked(ofetch).mockReset();
    const ast = await parseLoopsLmx(
      '<Component componentId="a"><Paragraph>local override</Paragraph></Component>',
      { apiKey: "key" }
    );

    expect(ast.children[0]).toMatchObject({
      name: "Component",
      children: [{ name: "Paragraph", children: [{ value: "local override" }] }]
    });
    expect(ofetch).not.toHaveBeenCalled();
  });

  it("does not fetch components unless an API key is supplied", async () => {
    vi.mocked(ofetch).mockReset();
    await parseLoopsLmx('<Component componentId="footer" />');
    expect(ofetch).not.toHaveBeenCalled();
  });

  it("parses an anonymized real-world campaign and resolves its component", async () => {
    vi.mocked(ofetch).mockReset().mockResolvedValue(realWorldComponent);
    const ast = await parseLoopsLmx(realWorldLmx, {
      apiKey: "key"
    });
    const serialized = JSON.stringify(ast);
    expect(serialized).toContain('"name":"Style"');
    expect(serialized).toContain('"themeId":"theme-trainees"');
    expect(serialized).toContain('"name":"Image"');
    expect(serialized).toContain('"href":"https://example.test/{contact.userId}"');
    expect(serialized).toContain('"href":"x.com"');
    expect(hasUnsupportedLoopsLmxNodes(ast.children)).toBe(false);
  });
});

describe("safe rendering helpers", () => {
  it("resolves supported variables and safe URLs", () => {
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
    expect(getLoopsLmxColumnsLayout("50,50", "11", 2).gap).toBe("24px");
    expect(
      isRenderableLoopsLmxElement({ type: "element", name: "Text", attributes: {}, children: [] })
    ).toBe(true);
    const ast = await parseLoopsLmx("<Style>x</Style><Unknown /><Paragraph>visible</Paragraph>");
    expect(hasUnsupportedLoopsLmxNodes(ast.children)).toBe(true);
    expect(hasRenderableLoopsLmxNodes(ast.children)).toBe(true);
  });

  it("keeps CodeBlock contents raw and reports semantic LMX violations", async () => {
    const diagnostics: string[] = [];
    const ast = await parseLoopsLmx(
      "<CodeBlock><Strong>{event.plan}</Strong></CodeBlock><Image /><Paragraph><H1>bad</H1></Paragraph><Columns><ColumnItem /></Columns>",
      { onDiagnostic: ({ code }) => diagnostics.push(code) }
    );

    expect(ast.children[0]).toMatchObject({
      name: "CodeBlock",
      children: [{ type: "text", value: "<Strong>{event.plan}</Strong>" }]
    });
    expect(diagnostics).toEqual(expect.arrayContaining(["missing_attribute", "invalid_structure"]));
  });

  it("validates conditional sections, attributes, and dynamic variable contexts", async () => {
    const diagnostics: string[] = [];
    const ast = await parseLoopsLmx(
      '<Section if="{contact.plan}" ifOperation="equal" ifValue="pro" blockBorderWidth="1" blockBorderColor="#000000"><Paragraph>{contact.name}</Paragraph></Section><Image src="{contact.avatar}" width="601" /><Columns widths="80,80"><ColumnItem /><ColumnItem /></Columns><Br unexpected="true" />',
      { emailType: "campaign", onDiagnostic: ({ code }) => diagnostics.push(code) }
    );

    expect(ast.children[0]).toMatchObject({
      name: "Section",
      attributes: { if: "{contact.plan}", ifOperation: "equal", ifValue: "pro" }
    });
    expect(diagnostics).toEqual(
      expect.arrayContaining([
        "invalid_dynamic_attribute",
        "invalid_attribute",
        "unknown_attribute"
      ])
    );
  });

  it("reports malformed and unsupported LMX variable syntax", async () => {
    const diagnostics: string[] = [];
    await parseLoopsLmx("<Paragraph>{firstName} {data.resetLink}</Paragraph><Image src=x />", {
      emailType: "campaign",
      onDiagnostic: ({ code }) => diagnostics.push(code)
    });

    expect(diagnostics).toEqual(expect.arrayContaining(["invalid_variable", "malformed_tag"]));
  });

  it("matches documented variable, attribute, and placement rules", async () => {
    const diagnostics: Array<{ code: string; message: string }> = [];
    await parseLoopsLmx(
      '<Paragraph><Strong>{contact.firstName}</Strong><Link href="https://loops.so" textColor="#000000">Docs</Link></Paragraph><Divider borderWidth="0" /><Unknown><Style /><Icon name="linkedin" /></Unknown>',
      { onDiagnostic: (diagnostic) => diagnostics.push(diagnostic) }
    );

    expect(diagnostics.map((diagnostic) => diagnostic.code)).not.toContain("invalid_variable");
    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "unknown_attribute",
          message: "Unknown Link attribute: textColor."
        }),
        expect.objectContaining({
          code: "invalid_attribute",
          message: "Invalid Divider attribute value: borderWidth."
        }),
        expect.objectContaining({
          code: "invalid_structure",
          message: "Style is only allowed at the LMX document top level."
        }),
        expect.objectContaining({
          code: "invalid_structure",
          message: "Icon is not valid inside Unknown."
        })
      ])
    );
  });
});

describe("webhooks", () => {
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

  it("validates every documented event family", () => {
    const shared = { eventTime: 1, webhookSchemaVersion: "1.0.0" as const };
    const identity = { id: "contact-1", email: "test@example.com", userId: null };
    const email = { id: "email-1", emailMessageId: "message-1", subject: "Subject" };
    const list = { id: "list-1", name: "List", description: null, isPublic: true };
    const events = [
      {
        ...shared,
        eventName: "contact.created",
        contactIdentity: identity,
        contact: {
          ...identity,
          firstName: null,
          lastName: null,
          source: "API",
          subscribed: true,
          userGroup: "",
          mailingLists: { "list-1": true },
          optInStatus: "accepted",
          favoriteColor: "blue"
        }
      },
      { ...shared, eventName: "contact.unsubscribed", contactIdentity: identity },
      { ...shared, eventName: "contact.deleted", contactIdentity: identity },
      {
        ...shared,
        eventName: "contact.mailingList.subscribed",
        contactIdentity: identity,
        mailingList: list
      },
      {
        ...shared,
        eventName: "contact.mailingList.unsubscribed",
        contactIdentity: identity,
        mailingList: list
      },
      {
        ...shared,
        eventName: "campaign.email.sent",
        contactIdentity: identity,
        campaignId: "campaign-1",
        campaignName: "Campaign",
        email,
        mailingLists: [list]
      },
      {
        ...shared,
        eventName: "loop.email.sent",
        contactIdentity: identity,
        loopId: "loop-1",
        loopName: "Workflow",
        email
      },
      {
        ...shared,
        eventName: "transactional.email.sent",
        contactIdentity: identity,
        transactionalId: "transactional-1",
        transactionalName: "Transactional",
        email
      },
      ...[
        "email.delivered",
        "email.softBounced",
        "email.hardBounced",
        "email.opened",
        "email.clicked",
        "email.unsubscribed",
        "email.resubscribed",
        "email.spamReported"
      ].map((eventName) => ({
        ...shared,
        eventName,
        sourceType: "campaign",
        campaignId: "campaign-1",
        contactIdentity: identity,
        email
      })),
      { ...shared, eventName: "testing.testEvent", message: "test" }
    ];
    expect(events).toHaveLength(17);
    for (const event of events) expect(loopsWebhookSchema.safeParse(event).success).toBe(true);
    const created = loopsWebhookSchema.parse(events[0]);
    expect(
      (created as unknown as { contact: { favoriteColor: unknown } }).contact.favoriteColor
    ).toBe("blue");
    expect(
      loopsWebhookSchema.safeParse({
        ...events.find((event) => event.eventName === "email.opened"),
        sourceType: "transactional",
        transactionalId: "transactional-1"
      }).success
    ).toBe(false);
    expect(
      loopsWebhookSchema.safeParse({
        ...events.find((event) => event.eventName === "email.delivered"),
        sourceType: "campaign",
        loopId: "loop-1"
      }).success
    ).toBe(false);
  });
});
