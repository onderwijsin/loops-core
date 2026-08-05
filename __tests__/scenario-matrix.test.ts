import { describe, expect, it } from "vitest";
import {
  hasUnsupportedLoopsLmxNodes,
  isRenderableLoopsLmxElement,
  parseLoopsLmx
} from "../src/index";

async function diagnosticsFor(source: string, options: Record<string, unknown> = {}) {
  const diagnostics: Array<{ code: string; message: string; tagName?: string }> = [];
  const ast = await parseLoopsLmx(source, {
    ...options,
    onDiagnostic: (diagnostic) => diagnostics.push(diagnostic)
  });
  return { ast, diagnostics };
}

const elementNames = [
  "H1",
  "H2",
  "H3",
  "Paragraph",
  "Quote",
  "CodeBlock",
  "Button",
  "Image",
  "Divider",
  "OrderedList",
  "UnorderedList",
  "Columns",
  "Component",
  "Icons",
  "Section",
  "Style"
];
const inlineNames = ["Strong", "Em", "Underline", "Strike", "Code", "Text", "Link", "Br"];
const validImage = '<Image src="https://images.vialoops.com/image.png" />';

describe("LMX scenario matrix: document and parent-child grammar", () => {
  it.each([
    ["ListItem", "<ListItem>text</ListItem>"],
    ["ColumnItem", "<ColumnItem />"],
    ["Icon", '<Icon name="github" />'],
    ...inlineNames.map((name) => [
      name,
      `<${name}${name === "Br" ? " /" : ""}>${name === "Br" ? "" : "text"}${name === "Br" ? "" : `</${name}>`}`
    ])
  ])("rejects %s at the document root", async (_, source) => {
    const { diagnostics } = await diagnosticsFor(source);
    expect(diagnostics.map(({ code }) => code)).toContain("invalid_structure");
  });

  it.each(inlineNames)("accepts %s in every inline-content parent", async (name) => {
    const closing = name === "Br" ? "" : `</${name}>`;
    const opening =
      name === "Br"
        ? `<${name} />`
        : name === "Link"
          ? `<Link href="https://example.test">x</Link>`
          : `<${name}>x${closing}`;
    const source = `<H1>${opening}</H1><Paragraph>${opening}</Paragraph><Quote>${opening}</Quote><OrderedList><ListItem>${opening}</ListItem></OrderedList>`;
    const { diagnostics } = await diagnosticsFor(source);
    expect(diagnostics).toEqual([]);
  });

  it.each(["H1", "H2", "H3", "Paragraph", "Quote", "ListItem"])(
    "rejects block content in %s",
    async (parent) => {
      const { diagnostics } = await diagnosticsFor(
        `<${parent}><Section><Paragraph>x</Paragraph></Section></${parent}>`
      );
      expect(diagnostics.map(({ code }) => code)).toContain("invalid_structure");
    }
  );

  it.each(inlineNames)("rejects every inline tag inside Button: %s", async (name) => {
    const opening =
      name === "Link"
        ? '<Link href="https://example.test">x</Link>'
        : name === "Br"
          ? "<Br />"
          : `<${name}>x</${name}>`;
    const { diagnostics } = await diagnosticsFor(`<Button>${opening}</Button>`);
    expect(diagnostics.map(({ code }) => code)).toContain("invalid_structure");
  });

  it("covers allowed structural container children and their restricted forms", async () => {
    const source = `<Columns><ColumnItem><H1>x</H1><Paragraph>x</Paragraph><Quote>x</Quote><CodeBlock>x</CodeBlock><Button>x</Button>${validImage}<Divider /><OrderedList><ListItem>x</ListItem></OrderedList><UnorderedList><ListItem>x</ListItem></UnorderedList><Component componentId="x" /><Icons><Icon name="github" /></Icons><Section><Paragraph>x</Paragraph></Section></ColumnItem><ColumnItem><Paragraph>two</Paragraph></ColumnItem></Columns>`;
    const { diagnostics } = await diagnosticsFor(source);
    expect(diagnostics).toEqual([]);
    const restricted = await diagnosticsFor(
      `<Component><Style /></Component><Section><Section /></Section><ColumnItem><Columns><ColumnItem /><ColumnItem /></Columns></ColumnItem>`
    );
    expect(
      restricted.diagnostics.filter(({ code }) => code === "invalid_structure").length
    ).toBeGreaterThanOrEqual(3);
  });

  it("exercises indirect section, component, and columns nesting paths", async () => {
    const indirectSection = await diagnosticsFor(
      "<Section><Columns><ColumnItem><Section><Paragraph>x</Paragraph></Section></ColumnItem><ColumnItem /></Columns></Section>"
    );
    const indirectComponent = await diagnosticsFor(
      '<Component componentId="outer"><Section><Component componentId="inner" /></Section></Component>'
    );
    const indirectColumns = await diagnosticsFor(
      "<Section><Columns><ColumnItem><Columns><ColumnItem /><ColumnItem /></Columns></ColumnItem><ColumnItem /></Columns></Section>"
    );
    expect(indirectSection.ast.children[0]).toMatchObject({ name: "Section" });
    expect(indirectComponent.ast.children[0]).toMatchObject({ name: "Component" });
    expect(indirectColumns.ast.children[0]).toMatchObject({ name: "Section" });
    expect(indirectSection.diagnostics).toEqual([]);
    expect(indirectComponent.diagnostics).toEqual([]);
    expect(indirectColumns.diagnostics.map(({ code }) => code)).toContain("invalid_structure");
  });

  it("keeps top-level whitespace separate from meaningful text", async () => {
    const { ast, diagnostics } = await diagnosticsFor(" \n<Paragraph>content</Paragraph>\n ");
    expect(ast.children.filter((node) => node.type === "element")).toHaveLength(1);
    expect(diagnostics).toEqual([]);
  });
});

describe("LMX scenario matrix: code, images, attributes, and variables", () => {
  it.each([
    ["single line", 'const name = "{contact.name}";'],
    ["multiline", "line one\n  line two\nline three"],
    ["tabs and repeated spaces", "\tconst  value =  1;\t"],
    ["literal markup", "<Strong>{event.plan}</Strong><Br />"],
    ["blank lines", "first\n\n\nlast"]
  ])("preserves %s CodeBlock content literally", async (_, value) => {
    const ast = await parseLoopsLmx(`<CodeBlock>${value}</CodeBlock>`);
    expect(ast.children[0]).toMatchObject({ children: [{ type: "text", value }] });
  });

  it.each([
    ["https", "https://images.vialoops.com/a.png", false],
    ["http", "http://images.vialoops.com/a.png", true],
    ["external", "https://cdn.example.test/a.png", true],
    ["relative", "/a.png", true],
    ["variable", "{contact.avatar}", true],
    ["hostname suffix", "https://images.vialoops.com.attacker.test/a.png", true],
    ["userinfo", "https://images.vialoops.com@attacker.test/a.png", true]
  ])("checks static image src: %s", async (_, src, invalid) => {
    const { diagnostics } = await diagnosticsFor(`<Image src="${src}" />`);
    expect(diagnostics.some(({ code }) => code === "invalid_attribute")).toBe(invalid);
  });

  it("accepts only the documented dynamic image attributes", async () => {
    const sources = [
      `<Image src="${validImage.match(/src="([^"]+)/)?.[1]}" alt="{contact.name}" href="{contact.url}" dynamicSrc="{contact.avatar}" />`,
      `<Button href="{contact.url}">Hi {contact.name}</Button>`,
      `<Section href="{contact.url}" if="{contact.enabled}"><Paragraph>x</Paragraph></Section>`,
      `<Paragraph title="{contact.title}">x</Paragraph>`,
      `<Divider color="{contact.color}" />`
    ];
    const { diagnostics } = await diagnosticsFor(sources.join(""));
    expect(diagnostics.filter(({ code }) => code === "invalid_dynamic_attribute")).toHaveLength(2);
  });

  it.each([
    ["campaign", "contact", true],
    ["campaign", "event", false],
    ["campaign", "data", false],
    ["workflow", "contact", true],
    ["workflow", "event", true],
    ["workflow", "data", false],
    ["transactional", "contact", false],
    ["transactional", "event", false],
    ["transactional", "data", true]
  ])("applies the %s/%s variable namespace matrix", async (emailType, namespace, valid) => {
    const { diagnostics } = await diagnosticsFor(`<Paragraph>{${namespace}.property}</Paragraph>`, {
      emailType
    });
    expect(diagnostics.some(({ code }) => code === "invalid_variable")).toBe(!valid);
  });

  it("rejects legacy, malformed, nested, and fallback variable syntax", async () => {
    const { diagnostics } = await diagnosticsFor(
      "<Paragraph>{DATA_VARIABLE:name} {firstName} {contact.profile.name} {contact.name|Ada} {contact.name}</Paragraph>"
    );
    expect(diagnostics.some(({ code }) => code === "invalid_variable")).toBe(true);
  });

  it("aggregates unknown attributes across the supported element families", async () => {
    const source = elementNames
      .map((name) => {
        if (name === "Image")
          return '<Image src="https://images.vialoops.com/a.png" unexpected="x" />';
        if (name === "Component") return '<Component componentId="x" unexpected="x" />';
        if (name === "Style") return '<Style unexpected="x" />';
        if (name === "Icons") return '<Icons unexpected="x"><Icon name="github" /></Icons>';
        if (name === "OrderedList")
          return '<OrderedList unexpected="x"><ListItem>x</ListItem></OrderedList>';
        if (name === "UnorderedList")
          return '<UnorderedList unexpected="x"><ListItem>x</ListItem></UnorderedList>';
        if (name === "Columns")
          return '<Columns unexpected="x"><ColumnItem /><ColumnItem /></Columns>';
        if (name === "Section") return '<Section unexpected="x"><Paragraph>x</Paragraph></Section>';
        if (name === "Button") return '<Button unexpected="x">x</Button>';
        if (name === "CodeBlock") return '<CodeBlock unexpected="x">x</CodeBlock>';
        if (name === "Divider") return '<Divider unexpected="x" />';
        return `<${name} unexpected="x">x</${name}>`;
      })
      .join("");
    const { diagnostics } = await diagnosticsFor(source);
    expect(diagnostics.filter(({ code }) => code === "unknown_attribute").length).toBe(
      elementNames.length
    );
  });
});

describe("LMX scenario matrix: conditions and collection boundaries", () => {
  it.each([
    ["not_empty", false],
    ["empty", false],
    ["equal", true],
    ["not_equal", true],
    ["contains", true],
    ["not_contains", true],
    ["numeric_equal", true],
    ["numeric_not_equal", true],
    ["greater_than", true],
    ["less_than", true],
    ["true", false],
    ["false", false]
  ])("validates conditional operator %s", async (operation, needsValue) => {
    const value = needsValue ? ' ifValue="pro"' : "";
    const { diagnostics } = await diagnosticsFor(
      `<Section if="{contact.plan}" ifOperation="${operation}"${value}><Paragraph>x</Paragraph></Section>`
    );
    expect(
      diagnostics.some(({ code }) => code === "invalid_attribute" || code === "missing_attribute")
    ).toBe(false);
  });

  it("reports invalid condition shapes and missing comparison values", async () => {
    const { diagnostics } = await diagnosticsFor(
      '<Section if="{contact.plan}" ifOperation="greater_than"><Paragraph>x</Paragraph></Section><Section if="{contact.plan}" ifOperation="unknown" ifValue="x"><Paragraph>x</Paragraph></Section><Section if="{contact.plan} extra" ifOperation="equal" ifValue="x"><Paragraph>x</Paragraph></Section>'
    );
    expect(diagnostics.map(({ code }) => code)).toEqual(
      expect.arrayContaining(["missing_attribute", "invalid_attribute", "invalid_variable"])
    );
  });

  it.each([
    ["two columns", 2],
    ["three columns", 3],
    ["four columns", 4]
  ])("accepts %s with matching widths", async (_, count) => {
    const widths = count === 2 ? "50,50" : count === 3 ? "33,33,34" : "25,25,25,25";
    const columns = Array.from({ length: count }, () => "<ColumnItem />").join("");
    const { diagnostics } = await diagnosticsFor(
      `<Columns widths="${widths}">${columns}</Columns>`
    );
    expect(diagnostics).toEqual([]);
  });

  it.each([0, 1, 5])("rejects Columns with %s children", async (count) => {
    const columns = Array.from({ length: count }, () => "<ColumnItem />").join("");
    const { diagnostics } = await diagnosticsFor(`<Columns>${columns}</Columns>`);
    expect(diagnostics.map(({ code }) => code)).toContain("invalid_structure");
  });

  it.each(["40,40", "40,30,30", "50,50,1", "50,foo"])(
    "rejects invalid width declaration %s",
    async (widths) => {
      const { diagnostics } = await diagnosticsFor(
        `<Columns widths="${widths}"><ColumnItem /><ColumnItem /></Columns>`
      );
      expect(diagnostics.map(({ code }) => code)).toContain("invalid_attribute");
    }
  );

  it.each([0, 1, 100, 101])("checks Icons count boundary %s", async (count) => {
    const icons = Array.from({ length: count }, () => '<Icon name="github" />').join("");
    const { diagnostics } = await diagnosticsFor(`<Icons>${icons}</Icons>`);
    expect(diagnostics.some(({ code }) => code === "invalid_structure")).toBe(
      count === 0 || count === 101
    );
  });
});

describe("LMX scenario matrix: security, limits, and parser-renderer contract", () => {
  it("does not expand entities or access external resources", async () => {
    const { ast } = await diagnosticsFor(
      '<Paragraph>&lt;script&gt;not markup&lt;/script&gt; &amp; text</Paragraph><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>'
    );
    expect(JSON.stringify(ast)).toContain("file:///etc/passwd");
    expect(ast.children.some((node) => node.type === "element" && node.name === "ENTITY")).toBe(
      false
    );
  });

  it("handles a 100KB document and deep valid nesting without crashing", async () => {
    const large = `<Paragraph>${"x".repeat(100_000)}</Paragraph>`;
    const largeAst = await parseLoopsLmx(large);
    expect(largeAst.children).toHaveLength(1);
    let nested = "text";
    for (let index = 0; index < 50; index += 1) nested = `<Strong>${nested}</Strong>`;
    const deepAst = await parseLoopsLmx(`<Paragraph>${nested}</Paragraph>`);
    expect(deepAst.children[0]).toMatchObject({ name: "Paragraph" });
  });

  it("keeps parser and renderer tag grammars aligned for documented visible elements", async () => {
    const source =
      '<H1>h</H1><Paragraph>p</Paragraph><Quote>q</Quote><CodeBlock>c</CodeBlock><Button>b</Button><Image src="https://images.vialoops.com/a.png" /><Divider /><OrderedList><ListItem>i</ListItem></OrderedList><UnorderedList><ListItem>i</ListItem></UnorderedList><Columns><ColumnItem /><ColumnItem /></Columns><Component componentId="x" /><Icons><Icon name="github" /></Icons><Section><Paragraph>s</Paragraph></Section>';
    const { ast, diagnostics } = await diagnosticsFor(source);
    expect(diagnostics).toEqual([]);
    const elements = ast.children.filter(
      (node) => node.type === "element" && node.name !== "Style"
    );
    expect(
      elements
        .filter((node) => node.type === "element" && !isRenderableLoopsLmxElement(node))
        .map((node) => node.type === "element" && node.name)
    ).toEqual(["Quote"]);
    expect(hasUnsupportedLoopsLmxNodes(ast.children)).toBe(true);
  });
});
