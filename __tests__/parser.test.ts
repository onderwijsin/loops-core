import { describe, expect, it } from "vitest";
import { loopsLmxAstSchema, parseLoopsLmx } from "../src/index";
import realWorldComponent from "./fixtures/data/component.json";
import realWorldLmx from "./fixtures/docs/campaign.lmx?raw";

const parseWithDiagnostics = async (lmx: string, options = {}) => {
  const diagnostics: Array<{ code: string; message: string; tagName?: string }> = [];
  const ast = await parseLoopsLmx(lmx, {
    ...options,
    onDiagnostic: (diagnostic) => diagnostics.push(diagnostic)
  });
  return { ast, diagnostics };
};

describe("LMX parser: document boundaries and XML recovery", () => {
  it.each([
    ["empty", ""],
    ["whitespace-only", " \t\n\r "]
  ])("returns an empty root for %s input", async (_, source) => {
    const ast = await parseLoopsLmx(source);
    expect(ast).toMatchObject({ type: "root" });
    expect(ast.children.every((node) => node.type === "text" && !node.value.trim())).toBe(true);
  });

  it("parses top-level fragments without an artificial wrapper and preserves order", async () => {
    const ast = await parseLoopsLmx(`\n<Style themeId="theme-1" />
      <H1>Welcome</H1>
      <Paragraph>Hello <Strong>world</Strong><Br />again</Paragraph>
      <Button href="https://example.test">Start</Button>
      <Divider />\n`);
    expect(ast.children.filter((node) => node.type === "element").map((node) => node.name)).toEqual(
      ["Style", "H1", "Paragraph", "Button", "Divider"]
    );
    expect(
      ast.children.find((node) => node.type === "element" && node.name === "Paragraph")
    ).toMatchObject({
      name: "Paragraph",
      children: [
        { type: "text", value: "Hello " },
        { name: "Strong" },
        { name: "Br" },
        { type: "text", value: "again" }
      ]
    });
  });

  it("ignores comments but retains meaningful text and reports malformed fragments", async () => {
    const { ast, diagnostics } = await parseWithDiagnostics(
      '<Paragraph title="hello world">Hi<!-- gone --></Paragraph><!-- between --><broken'
    );
    expect(ast.children).toEqual([
      {
        type: "element",
        name: "Paragraph",
        attributes: { title: "hello world" },
        children: [{ type: "text", value: "Hi" }]
      },
      { type: "text", value: "<broken" }
    ]);
    expect(diagnostics.map(({ code }) => code)).toContain("malformed_tag");
  });

  it.each([
    ["mismatched closing", "<Paragraph><H1>Hello</Paragraph></H1>", "mismatched_closing_tag"],
    ["extra closing", "<Paragraph>Hello</Paragraph></Paragraph>", "unmatched_closing_tag"],
    ["unterminated attribute", '<Paragraph align="center>Hello</Paragraph>', "malformed_tag"],
    ["unquoted attribute", "<Paragraph align=center>Hello</Paragraph>", "malformed_tag"],
    [
      "processing instruction",
      '<?xml version="1.0"?><Paragraph>Hello</Paragraph>',
      "malformed_tag"
    ],
    ["doctype", "<!DOCTYPE foo><Paragraph>Hello</Paragraph>", "malformed_tag"]
  ])("reports %s deterministically", async (_, source, code) => {
    const first = await parseWithDiagnostics(source);
    const second = await parseWithDiagnostics(source);
    expect(first.diagnostics.map(({ code: issue }) => issue)).toContain(code);
    expect(first).toEqual(second);
  });

  it("accepts XML quoting and attribute whitespace while retaining strings", async () => {
    const ast = await parseLoopsLmx(
      `<Paragraph align = 'center'\n fontSize = "16">Hello &amp; &lt;world&gt;</Paragraph>`
    );
    expect(ast.children[0]).toMatchObject({
      attributes: { align: "center", fontSize: "16" },
      children: [{ type: "text", value: "Hello &amp; &lt;world&gt;" }]
    });
  });

  it("retains a valid AST shape and does not share state across parses", async () => {
    const first = await parseLoopsLmx("<Paragraph>one</Paragraph>");
    const second = await parseLoopsLmx("<Paragraph>one</Paragraph>");
    expect(loopsLmxAstSchema.safeParse(first).success).toBe(true);
    expect(first).toEqual(second);
    (first.children[0] as { children: unknown[] }).children.push({ type: "text", value: "x" });
    expect(second).not.toEqual(first);
  });
});

describe("LMX parser: nesting and content grammar", () => {
  it("accepts every documented top-level block family", async () => {
    const { ast, diagnostics } = await parseWithDiagnostics(`
      <H1>H1</H1><H2>H2</H2><H3>H3</H3><Paragraph>P</Paragraph><Quote>Q</Quote>
      <CodeBlock>const x = "{contact.name}";</CodeBlock><Button>Go</Button>
      <Image src="https://images.vialoops.com/image.png" /><Divider />
      <OrderedList><ListItem>one</ListItem></OrderedList>
      <UnorderedList><ListItem>one</ListItem></UnorderedList>
      <Columns widths="50,50"><ColumnItem><Paragraph>one</Paragraph></ColumnItem><ColumnItem><Paragraph>two</Paragraph></ColumnItem></Columns>
      <Component componentId="header" /><Icons><Icon name="github" /></Icons>
      <Section><Paragraph>section</Paragraph></Section><Style />`);
    expect(diagnostics).toEqual([]);
    expect(ast.children.filter((node) => node.type === "element")).toHaveLength(16);
  });

  it("parses the anonymized real-world campaign fixture with its component", async () => {
    const ast = await parseLoopsLmx(realWorldLmx);
    expect(JSON.stringify(ast)).toContain('"name":"Style"');
    expect(JSON.stringify(ast)).toContain('"themeId":"theme-trainees"');
    expect(JSON.stringify(ast)).toContain('"name":"Image"');
    expect(realWorldComponent).toMatchObject({ id: expect.any(String), lmx: expect.any(String) });
  });

  it.each([
    [
      "ordered inside unordered",
      "<UnorderedList><ListItem>outer<OrderedList><ListItem>inner</ListItem></OrderedList></ListItem></UnorderedList>"
    ],
    [
      "unordered inside ordered",
      "<OrderedList><ListItem>outer<UnorderedList><ListItem>inner</ListItem></UnorderedList></ListItem></OrderedList>"
    ]
  ])("accepts %s nested lists", async (_, source) => {
    const { diagnostics } = await parseWithDiagnostics(source);
    expect(diagnostics).toEqual([]);
  });

  it("accepts alternating ordered and unordered lists through twelve levels", async () => {
    let nested = "<UnorderedList><ListItem>level 12</ListItem></UnorderedList>";
    for (let level = 11; level >= 1; level -= 1) {
      const tag = level % 2 === 0 ? "UnorderedList" : "OrderedList";
      nested = `<${tag}><ListItem>level ${level}${nested}</ListItem></${tag}>`;
    }

    const { diagnostics } = await parseWithDiagnostics(nested);
    expect(diagnostics).toEqual([]);
  });

  it("reports a nested list beyond twelve levels while retaining the AST", async () => {
    let nested = "<UnorderedList><ListItem>level 13</ListItem></UnorderedList>";
    for (let level = 12; level >= 1; level -= 1) {
      const tag = level % 2 === 0 ? "UnorderedList" : "OrderedList";
      nested = `<${tag}><ListItem>level ${level}${nested}</ListItem></${tag}>`;
    }

    const { ast, diagnostics } = await parseWithDiagnostics(nested);
    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: "invalid_structure",
        message: "Lists may be nested up to 12 levels."
      })
    ]);
    expect(JSON.stringify(ast)).toContain('"name":"UnorderedList"');
  });

  it.each([
    [
      "inline at root",
      "<Strong>bad</Strong>",
      "Strong is not allowed at the LMX document top level."
    ],
    [
      "block inside paragraph",
      "<Paragraph><H1>bad</H1></Paragraph>",
      "Paragraph may only contain inline content."
    ],
    [
      "inline inside button",
      "<Button><Strong>bad</Strong></Button>",
      "Button may contain text and variables, but not inline tags."
    ],
    [
      "style inside section",
      "<Section><Style /></Section>",
      "Style is only allowed at the LMX document top level."
    ],
    [
      "nested section",
      "<Section><ColumnItem /></Section>",
      "Section may only contain permitted block tags."
    ],
    [
      "nested columns",
      "<Columns><ColumnItem><Columns /></ColumnItem><ColumnItem /></Columns>",
      "ColumnItem may only contain permitted block tags."
    ]
  ])("reports %s", async (_, source, message) => {
    const { diagnostics } = await parseWithDiagnostics(source);
    expect(diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ message })]));
  });

  it("keeps CodeBlock text literal, including tags, variables, spaces, and newlines", async () => {
    const ast = await parseLoopsLmx(
      "<CodeBlock>  <Strong>{event.plan}</Strong>\r\n  literal  </CodeBlock>"
    );
    expect(ast.children[0]).toMatchObject({
      name: "CodeBlock",
      children: [{ type: "text", value: "  <Strong>{event.plan}</Strong>\r\n  literal  " }]
    });
  });

  it.each([
    ["empty list", "<OrderedList></OrderedList>", "OrderedList requires at least one ListItem."],
    [
      "plain list text",
      "<UnorderedList>text</UnorderedList>",
      "UnorderedList may only contain ListItem children."
    ],
    [
      "one column",
      "<Columns><ColumnItem /></Columns>",
      "Columns requires two to four ColumnItem children."
    ],
    [
      "five columns",
      "<Columns><ColumnItem /><ColumnItem /><ColumnItem /><ColumnItem /><ColumnItem /></Columns>",
      "Columns requires two to four ColumnItem children."
    ],
    [
      "bad widths",
      '<Columns widths="40,40"><ColumnItem /><ColumnItem /></Columns>',
      "Columns widths must match the column count and total 100."
    ],
    ["empty icons", "<Icons />", "Icons requires one to 100 Icon children."]
  ])("validates collection boundaries: %s", async (_, source, message) => {
    const { diagnostics } = await parseWithDiagnostics(source);
    expect(diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ message })]));
  });

  it("accepts supported indirect block nesting and preserves unsupported nesting", async () => {
    const valid = await parseWithDiagnostics(
      '<Section><Columns><ColumnItem><Paragraph>x</Paragraph></ColumnItem><ColumnItem><Component componentId="x" /></ColumnItem></Columns></Section>'
    );
    expect(valid.diagnostics).toEqual([]);
    const unsupported = await parseWithDiagnostics(
      "<Section><Columns><ColumnItem><Section><Paragraph>x</Paragraph></Section></ColumnItem><ColumnItem /></Columns></Section>"
    );
    expect(unsupported.diagnostics).toEqual([]);
  });
});

describe("LMX parser: attributes, variables, and conditional sections", () => {
  it("retains attributes as strings and accepts documented scalar boundaries", async () => {
    const { ast, diagnostics } = await parseWithDiagnostics(
      '<Style bodyXPadding="0" bodyYPadding="32" borderWidth="16" bodyFontCategory="sans-serif" backgroundColor="#abc" />'
    );
    expect(diagnostics).toEqual([]);
    expect(ast.children[0]).toMatchObject({
      attributes: {
        bodyXPadding: "0",
        bodyYPadding: "32",
        borderWidth: "16",
        bodyFontCategory: "sans-serif",
        backgroundColor: "#abc"
      }
    });
  });

  it("reports unknown, duplicate-like, and invalid attributes without dropping known values", async () => {
    const { ast, diagnostics } = await parseWithDiagnostics(
      '<Paragraph align="middle" textColor="#000" onclick="bad">text</Paragraph><Paragraph align="left" align="right">x</Paragraph>'
    );
    expect(ast.children[0]).toMatchObject({
      attributes: { align: "middle", textColor: "#000", onclick: "bad" }
    });
    expect(diagnostics.map(({ code }) => code)).toEqual(
      expect.arrayContaining(["unknown_attribute", "invalid_attribute"])
    );
  });

  it.each([
    ["campaign", "<Paragraph>{contact.name}</Paragraph>", true],
    ["campaign rejects event", "<Paragraph>{event.plan}</Paragraph>", false],
    ["workflow accepts event", "<Paragraph>{event.plan}</Paragraph>", true],
    ["workflow rejects data", "<Paragraph>{data.id}</Paragraph>", false],
    ["transactional accepts data", "<Paragraph>{data.id}</Paragraph>", true],
    ["transactional rejects contact", "<Paragraph>{contact.name}</Paragraph>", false]
  ])("applies message-type variable rules: %s", async (_, source, valid) => {
    const { diagnostics } = await parseWithDiagnostics(source, {
      emailType: _.includes("campaign")
        ? "campaign"
        : _.includes("workflow")
          ? "workflow"
          : "transactional"
    });
    expect(diagnostics.some(({ code }) => code === "invalid_variable")).toBe(!valid);
  });

  it("only permits variables in documented dynamic attributes", async () => {
    const { diagnostics } = await parseWithDiagnostics(
      '<Image src="{contact.image}" alt="{contact.name}" dynamicSrc="{contact.image}" width="{contact.width}" /><Button href="{contact.url}" bgColor="{contact.color}">Hi {contact.name}</Button>'
    );
    expect(diagnostics.map(({ code }) => code)).toContain("invalid_dynamic_attribute");
  });

  it("validates conditional section operators and required values", async () => {
    const { diagnostics } = await parseWithDiagnostics(
      '<Section if="{contact.plan}" ifOperation="equal" ifValue="pro"><Paragraph>yes</Paragraph></Section><Section if="{contact.plan}" ifOperation="greater_than"><Paragraph>missing</Paragraph></Section><Section if="{contact.plan}" ifOperation="wat"><Paragraph>bad</Paragraph></Section><Section if="plan"><Paragraph>bad</Paragraph></Section>'
    );
    expect(diagnostics.map(({ code }) => code)).toEqual(
      expect.arrayContaining(["missing_attribute", "invalid_attribute", "invalid_variable"])
    );
  });

  it("does not treat malformed or unprefixed braces as valid variables", async () => {
    const { diagnostics } = await parseWithDiagnostics(
      "<Paragraph>{firstName} {contact.} {contact.name|fallback}</Paragraph>"
    );
    expect(diagnostics.map(({ code }) => code)).toContain("invalid_variable");
  });
});

describe("LMX parser: required elements and security-sensitive inputs", () => {
  it("requires static Loops-hosted image sources and validates image boundaries", async () => {
    const { diagnostics } = await parseWithDiagnostics(
      '<Image /><Image src="https://images.vialoops.com/a.png" width="600" /><Image src="https://images.vialoops.com/a.png" width="601" /><Image src="https://images.vialoops.com/a.png" dynamicSrc="{contact.avatar}" />'
    );
    expect(diagnostics.map(({ code }) => code)).toEqual(
      expect.arrayContaining(["missing_attribute", "invalid_attribute"])
    );
  });

  it("does not let image-host lookalikes pass validation", async () => {
    const { diagnostics } = await parseWithDiagnostics(
      '<Image src="https://images.vialoops.com.attacker.example/x.png" /><Image src="https://images.vialoops.com@attacker.example/x.png" />'
    );
    expect(diagnostics.filter(({ code }) => code === "invalid_attribute")).toHaveLength(2);
  });

  it("reports missing required attributes across nested tags", async () => {
    const { diagnostics } = await parseWithDiagnostics(
      "<Component /><Icons><Icon /></Icons><Paragraph><Link>missing href</Link></Paragraph>"
    );
    expect(diagnostics.filter(({ code }) => code === "missing_attribute")).toHaveLength(3);
  });

  it("retains hostile text without evaluating entities, markup, or external declarations", async () => {
    const { ast, diagnostics } = await parseWithDiagnostics(
      '<Paragraph>&lt;script&gt;alert(1)&lt;/script&gt; &amp; {contact.name}</Paragraph><!ENTITY xxe SYSTEM "file:///etc/passwd">'
    );
    expect(JSON.stringify(ast)).not.toContain("root:");
    expect(ast.children[0]).toMatchObject({ type: "element", name: "Paragraph" });
    expect(diagnostics.map(({ code }) => code)).toContain("malformed_tag");
  });

  it("handles large sibling input and deep nesting without changing order", async () => {
    const source = Array.from(
      { length: 1000 },
      (_, index) => `<Paragraph>${index}</Paragraph>`
    ).join("");
    const ast = await parseLoopsLmx(source);
    expect(ast.children).toHaveLength(1000);
    expect(ast.children.at(-1)).toMatchObject({ children: [{ value: "999" }] });
  });
});
