import type { LoopsLmxAst, LoopsLmxElement, LoopsLmxNode } from "./schemas/ast";
import { ofetch } from "ofetch";

/** A recoverable parsing or component-expansion event. */
export type LoopsLmxDiagnostic = {
  code:
    | "invalid_lmx"
    | "malformed_tag"
    | "unmatched_closing_tag"
    | "mismatched_closing_tag"
    | "component_load_failed"
    | "invalid_component"
    | "component_cycle"
    | "component_depth_exceeded"
    | "unsupported_tag"
    | "unknown_attribute"
    | "missing_attribute"
    | "invalid_structure"
    | "invalid_self_closing";
  message: string;
  componentId?: string;
  tagName?: string;
};

/** Options for resilient LMX parsing and optional server-side component expansion. */
export type ParseLoopsLmxOptions = {
  apiKey?: string;
  maxComponentDepth?: number;
  onDiagnostic?: (diagnostic: LoopsLmxDiagnostic) => void;
};

type GetComponent = (componentId: string) => Promise<{ lmx: string } | undefined>;

const defaultMaxComponentDepth = 8;
const voidElements = new Set(["Image", "Divider", "Br", "Icon", "Style"]);
const inlineElements = new Set(["Strong", "Em", "Underline", "Strike", "Code", "Text", "Link"]);
const inlineContentParents = new Set(["H1", "H2", "H3", "Paragraph", "Quote", "ListItem"]);
const topLevelElements = new Set([
  "Style",
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
  "Section"
]);
const knownElements = new Set([
  ...topLevelElements,
  ...inlineElements,
  "Br",
  "ListItem",
  "ColumnItem",
  "Icon"
]);
const sharedBlockAttributes = new Set([
  "blockColor",
  "blockBorderRadius",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft"
]);
const textBlockAttributes = new Set(["fontSize", "lineHeight", "align", ...sharedBlockAttributes]);
const allowedAttributes: Record<string, ReadonlySet<string>> = {
  H1: textBlockAttributes,
  H2: textBlockAttributes,
  H3: textBlockAttributes,
  Paragraph: textBlockAttributes,
  Quote: textBlockAttributes,
  ListItem: new Set(["fontSize", "lineHeight", ...sharedBlockAttributes]),
  CodeBlock: new Set(["fontSize", "lineHeight", ...sharedBlockAttributes]),
  Button: new Set([
    "href",
    "bgColor",
    "textColor",
    "borderColor",
    "blockColor",
    "borderRadius",
    "borderWidth",
    "innerXPadding",
    "innerYPadding",
    "fontSize",
    "align",
    "notrack",
    ...sharedBlockAttributes
  ]),
  Image: new Set([
    "src",
    "alt",
    "href",
    "width",
    "align",
    "borderRadius",
    "borderWidth",
    "borderColor",
    "dynamicSrc",
    "notrack",
    ...sharedBlockAttributes
  ]),
  Divider: new Set(["align", "width", "borderWidth", "color", ...sharedBlockAttributes]),
  OrderedList: new Set(["start", "align"]),
  UnorderedList: new Set(["align"]),
  Columns: new Set([
    "gap",
    "widths",
    "verticalAlignment",
    "stackOnMobile",
    "reverseOnMobile",
    ...sharedBlockAttributes
  ]),
  Component: new Set(["componentId", ...sharedBlockAttributes]),
  Section: new Set(["href", "notrack", ...sharedBlockAttributes]),
  Icons: new Set(["align", "gap", "size", "color", ...sharedBlockAttributes]),
  Icon: new Set(["name", "href", "notrack"]),
  Style: new Set([
    "themeId",
    "backgroundColor",
    "backgroundXPadding",
    "backgroundYPadding",
    "bodyColor",
    "bodyXPadding",
    "bodyYPadding",
    "bodyFontFamily",
    "bodyFontCategory",
    "borderColor",
    "borderWidth",
    "borderRadius",
    "buttonBodyColor",
    "buttonBodyXPadding",
    "buttonBodyYPadding",
    "buttonBorderColor",
    "buttonBorderWidth",
    "buttonBorderRadius",
    "buttonTextColor",
    "buttonTextFontSize",
    "dividerColor",
    "dividerBorderWidth",
    "textBaseColor",
    "textBaseFontSize",
    "textBaseLineHeight",
    "textBaseLetterSpacing",
    "textLinkColor",
    "heading1Color",
    "heading1FontSize",
    "heading1LineHeight",
    "heading1LetterSpacing",
    "heading2Color",
    "heading2FontSize",
    "heading2LineHeight",
    "heading2LetterSpacing",
    "heading3Color",
    "heading3FontSize",
    "heading3LineHeight",
    "heading3LetterSpacing"
  ]),
  Strong: new Set(["textColor"]),
  Em: new Set(["textColor"]),
  Underline: new Set(["textColor"]),
  Strike: new Set(["textColor"]),
  Code: new Set(["textColor"]),
  Text: new Set(["textColor"]),
  Link: new Set(["href", "notrack", "textColor"])
};

/**
 * Parses LMX permissively and expands reusable components when an API key is supplied.
 *
 * @param lmx - Raw LMX document.
 * @param options - Optional Loops API key, recursion limit, and diagnostic observer.
 * @returns A recoverable, renderer-neutral LMX AST.
 *
 * @example
 * const ast = await parseLoopsLmx('<Component componentId="footer" />', {
 *   apiKey: process.env.LOOPS_API_KEY,
 *   maxComponentDepth: 4
 * });
 */
export async function parseLoopsLmx(
  lmx: string,
  options: ParseLoopsLmxOptions = {}
): Promise<LoopsLmxAst> {
  const ast = parseLmx(lmx, options);
  const getComponent = options.apiKey
    ? (componentId: string) => fetchComponent(componentId, options.apiKey!)
    : undefined;
  return getComponent
    ? expandAst(ast, new Set(), 0, normalizedMaxDepth(options), options, getComponent)
    : ast;
}

/**
 * Retrieves only the LMX needed for parser component expansion.
 *
 * This deliberately is not exported as a general Loops API client. Component transport is an
 * opt-in parser capability and only runs after the caller supplies an API key.
 *
 * @param componentId - Loops component identifier.
 * @param apiKey - Loops API key sent as a bearer token.
 * @returns The component LMX, or `undefined` for an invalid response.
 */
async function fetchComponent(
  componentId: string,
  apiKey: string
): Promise<{ lmx: string } | undefined> {
  try {
    const response = await ofetch<unknown>(`/components/${encodeURIComponent(componentId)}`, {
      baseURL: "https://app.loops.so/api/v1",
      headers: { Authorization: `Bearer ${apiKey}` },
      retry: 0
    });
    if (
      !response ||
      typeof response !== "object" ||
      typeof (response as { lmx?: unknown }).lmx !== "string"
    )
      return undefined;
    return { lmx: (response as { lmx: string }).lmx };
  } catch {
    return undefined;
  }
}

/**
 * Parses tags and text while retaining malformed portions as text where possible.
 *
 * @param lmx - Candidate LMX source.
 * @param options - Diagnostic callback configuration.
 * @returns Recovered AST without component expansion.
 */
function parseLmx(lmx: unknown, options: ParseLoopsLmxOptions): LoopsLmxAst {
  const root: LoopsLmxAst = { type: "root", children: [] };
  if (typeof lmx !== "string") {
    diagnostic(options, { code: "invalid_lmx", message: "LMX must be a string." });
    return root;
  }

  const stack: Array<LoopsLmxAst | LoopsLmxElement> = [root];
  for (const token of tokenize(lmx)) {
    if (token.startsWith("<!--")) continue;
    if (token.startsWith("</")) {
      closeElement(token, stack, options);
      continue;
    }
    if (!token.startsWith("<")) {
      appendNode(stack, { type: "text", value: token });
      continue;
    }
    const element = createElement(token);
    if (!element) {
      diagnostic(options, {
        code: "malformed_tag",
        message: "Retained malformed LMX tag as text."
      });
      appendNode(stack, { type: "text", value: token });
      continue;
    }
    appendNode(stack, element);
    if (voidElements.has(element.name) && !isSelfClosing(token)) {
      diagnostic(options, {
        code: "invalid_self_closing",
        message: `${element.name} must be self-closing.`,
        tagName: element.name
      });
    }
    if (!isSelfClosing(token) && !voidElements.has(element.name)) stack.push(element);
  }
  validateLmxAst(root, options);
  return root;
}

/**
 * Splits LMX without losing quoted `>` characters or unterminated tag text.
 *
 * @param source - Raw LMX source.
 * @returns Tags, comments, and text segments in document order.
 */
function tokenize(source: string): string[] {
  const tokens: string[] = [];
  let textStart = 0;
  let index = 0;
  while (index < source.length) {
    if (source[index] !== "<") {
      index += 1;
      continue;
    }
    if (source.startsWith("<!--", index)) {
      const commentEnd = source.indexOf("-->", index + 4);
      if (commentEnd === -1) {
        if (textStart < index) tokens.push(source.slice(textStart, index));
        return tokens;
      }
      if (textStart < index) tokens.push(source.slice(textStart, index));
      tokens.push(source.slice(index, commentEnd + 3));
      index = commentEnd + 3;
      textStart = index;
      continue;
    }
    const end = findTagEnd(source, index + 1);
    if (end === -1) {
      if (textStart < index) tokens.push(source.slice(textStart, index));
      tokens.push(source.slice(index));
      return tokens;
    }
    if (textStart < index) tokens.push(source.slice(textStart, index));
    const tag = source.slice(index, end + 1);
    tokens.push(tag);
    index = end + 1;
    textStart = index;
    if (/^<\s*CodeBlock(?:\s[^>]*)?>$/.test(tag) && !isSelfClosing(tag)) {
      const rawEnd = source.indexOf("</CodeBlock>", index);
      if (rawEnd === -1) {
        if (index < source.length) tokens.push(source.slice(index));
        return tokens;
      }
      if (rawEnd > index) tokens.push(source.slice(index, rawEnd));
      tokens.push("</CodeBlock>");
      index = rawEnd + "</CodeBlock>".length;
      textStart = index;
    }
  }
  if (textStart < source.length) tokens.push(source.slice(textStart));
  return tokens;
}

/**
 * Finds a tag end while respecting single and double quoted attributes.
 *
 * @param source - Raw LMX source.
 * @param start - Index immediately after a tag's opening angle bracket.
 * @returns Index of the closing bracket, or `-1` when the tag is unterminated.
 */
function findTagEnd(source: string, start: number): number {
  let quote: "'" | '"' | undefined;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === quote) quote = undefined;
    } else if (character === "'" || character === '"') quote = character;
    else if (character === ">") return index;
  }
  return -1;
}

/**
 * Reconciles a closing tag with the nearest matching open element.
 *
 * @param token - Closing-tag token.
 * @param stack - Current open AST containers.
 * @param options - Diagnostic callback configuration.
 * @returns Nothing; mutates the parsing stack when a matching element is found.
 */
function closeElement(
  token: string,
  stack: Array<LoopsLmxAst | LoopsLmxElement>,
  options: ParseLoopsLmxOptions
): void {
  const match = /^<\/\s*([A-Za-z][\w-]*)\s*>$/.exec(token);
  if (!match) {
    diagnostic(options, { code: "malformed_tag", message: "Ignored malformed LMX closing tag." });
    return;
  }
  const tagName = match[1]!;
  let index = -1;
  for (let cursor = stack.length - 1; cursor >= 0; cursor -= 1) {
    const entry = stack[cursor];
    if (entry?.type === "element" && entry.name === tagName) {
      index = cursor;
      break;
    }
  }
  if (index < 0) {
    diagnostic(options, {
      code: "unmatched_closing_tag",
      message: `Ignored unmatched LMX closing tag: ${tagName}.`,
      tagName
    });
    return;
  }
  if (index !== stack.length - 1) {
    diagnostic(options, {
      code: "mismatched_closing_tag",
      message: `Recovered from mismatched LMX closing tag: ${tagName}.`,
      tagName
    });
  }
  stack.length = index;
}

/**
 * Creates an element from a valid opening or self-closing tag.
 *
 * @param token - Opening-tag token.
 * @returns Parsed element with empty children, or `null` for invalid syntax.
 */
function createElement(token: string): LoopsLmxElement | null {
  const match = /^<\s*([A-Za-z][\w-]*)([^>]*)>$/.exec(token);
  if (!match) return null;
  return {
    type: "element",
    name: match[1]!,
    attributes: parseAttributes(match[2] ?? ""),
    children: []
  };
}

/**
 * Parses quoted LMX attributes while leaving malformed attributes out of the safe AST.
 *
 * @param source - Attribute substring from an opening tag.
 * @returns String attribute values indexed by their original names.
 */
function parseAttributes(source: string): Record<string, string> {
  return Object.fromEntries(
    [...source.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map((match) => [
      match[1]!,
      match[2] ?? match[3] ?? ""
    ])
  );
}

/**
 * Reports LMX specification violations without discarding the recoverable AST.
 *
 * @param ast - Parsed LMX document.
 * @param options - Diagnostic callback configuration.
 * @returns Nothing; emits semantic diagnostics for callers that need strict validation.
 */
function validateLmxAst(ast: LoopsLmxAst, options: ParseLoopsLmxOptions): void {
  let styleCount = 0;
  const visit = (node: LoopsLmxNode, parent: string): void => {
    if (node.type === "text") {
      if (parent === "root" && node.value.trim()) {
        diagnostic(options, {
          code: "invalid_structure",
          message: "Text is not allowed at the LMX document top level."
        });
      }
      return;
    }

    if (!knownElements.has(node.name)) {
      diagnostic(options, {
        code: "unsupported_tag",
        message: `Unsupported LMX tag: ${node.name}.`,
        tagName: node.name
      });
    }
    if (parent === "root" && !topLevelElements.has(node.name)) {
      diagnostic(options, {
        code: "invalid_structure",
        message: `${node.name} is not allowed at the LMX document top level.`,
        tagName: node.name
      });
    }
    if (inlineContentParents.has(parent) && !inlineElements.has(node.name) && node.name !== "Br") {
      diagnostic(options, {
        code: "invalid_structure",
        message: `${parent} may only contain inline content.`,
        tagName: parent
      });
    }
    if (parent === "Button" && node.name !== "Text") {
      diagnostic(options, {
        code: "invalid_structure",
        message: "Button may contain text and variables, but not inline tags.",
        tagName: "Button"
      });
    }
    if (parent === "CodeBlock") {
      diagnostic(options, {
        code: "invalid_structure",
        message: "CodeBlock content must be raw text.",
        tagName: "CodeBlock"
      });
    }
    if (parent === "ColumnItem" || parent === "Component" || parent === "Section") {
      const disallowed =
        node.name === "Style" ||
        (parent === "ColumnItem" && node.name === "Columns") ||
        (parent === "Component" && node.name === "Component") ||
        (parent === "Section" && node.name === "Section");
      if (disallowed || !topLevelElements.has(node.name)) {
        diagnostic(options, {
          code: "invalid_structure",
          message: `${parent} may only contain permitted block tags.`,
          tagName: parent
        });
      }
    }
    if (node.name === "Style") styleCount += 1;

    const required =
      node.name === "Image"
        ? "src"
        : node.name === "Component"
          ? "componentId"
          : node.name === "Icon"
            ? "name"
            : node.name === "Link"
              ? "href"
              : undefined;
    if (required && !node.attributes[required]) {
      diagnostic(options, {
        code: "missing_attribute",
        message: `${node.name} requires the ${required} attribute.`,
        tagName: node.name
      });
    }

    const attributes = allowedAttributes[node.name];
    if (attributes) {
      for (const attribute of Object.keys(node.attributes)) {
        if (!attributes.has(attribute)) {
          diagnostic(options, {
            code: "unknown_attribute",
            message: `Unknown ${node.name} attribute: ${attribute}.`,
            tagName: node.name
          });
        }
      }
    }
    if (voidElements.has(node.name) && node.children.length > 0) {
      diagnostic(options, {
        code: "invalid_self_closing",
        message: `${node.name} must be self-closing.`,
        tagName: node.name
      });
    }

    const childElements = node.children.filter(
      (child): child is LoopsLmxElement => child.type === "element"
    );
    const expectedChild =
      node.name === "OrderedList" || node.name === "UnorderedList"
        ? "ListItem"
        : node.name === "Columns"
          ? "ColumnItem"
          : node.name === "Icons"
            ? "Icon"
            : undefined;
    if (
      expectedChild &&
      node.children.some((child) =>
        child.type === "text" ? child.value.trim().length > 0 : child.name !== expectedChild
      )
    ) {
      diagnostic(options, {
        code: "invalid_structure",
        message: `${node.name} may only contain ${expectedChild} children.`,
        tagName: node.name
      });
    }
    if (
      (node.name === "OrderedList" || node.name === "UnorderedList") &&
      childElements.length < 1
    ) {
      diagnostic(options, {
        code: "invalid_structure",
        message: `${node.name} requires at least one ListItem.`,
        tagName: node.name
      });
    }
    if (node.name === "Columns" && (childElements.length < 2 || childElements.length > 4)) {
      diagnostic(options, {
        code: "invalid_structure",
        message: "Columns requires two to four ColumnItem children.",
        tagName: node.name
      });
    }
    if (node.name === "Icons" && (childElements.length < 1 || childElements.length > 100)) {
      diagnostic(options, {
        code: "invalid_structure",
        message: "Icons requires one to 100 Icon children.",
        tagName: node.name
      });
    }
    if (
      node.name === "ColumnItem" &&
      childElements.some(
        (child) =>
          !topLevelElements.has(child.name) || child.name === "Style" || child.name === "Columns"
      )
    ) {
      diagnostic(options, {
        code: "invalid_structure",
        message: "ColumnItem may contain block tags but not Style or nested Columns.",
        tagName: node.name
      });
    }
    if (
      node.name === "Component" &&
      childElements.some((child) => child.name === "Style" || child.name === "Component")
    ) {
      diagnostic(options, {
        code: "invalid_structure",
        message: "Components cannot contain Style or nested Component tags.",
        tagName: node.name
      });
    }
    if (
      node.name === "Section" &&
      childElements.some((child) => child.name === "Style" || child.name === "Section")
    ) {
      diagnostic(options, {
        code: "invalid_structure",
        message: "Sections cannot contain Style or nested Section tags.",
        tagName: node.name
      });
    }
    if (inlineElements.has(node.name) || node.name === "Br") {
      for (const child of childElements) {
        if (!inlineElements.has(child.name) && child.name !== "Br") {
          diagnostic(options, {
            code: "invalid_structure",
            message: `${node.name} may only contain inline content.`,
            tagName: node.name
          });
          break;
        }
      }
    }
    if (node.name === "Button" && childElements.length > 0) {
      diagnostic(options, {
        code: "invalid_structure",
        message: "Button may contain text and variables, but not inline tags.",
        tagName: node.name
      });
    }
    if (node.name === "CodeBlock" && childElements.length > 0) {
      diagnostic(options, {
        code: "invalid_structure",
        message: "CodeBlock content must be raw text.",
        tagName: node.name
      });
    }
    for (const child of node.children) visit(child, node.name);
  };

  for (const child of ast.children) visit(child, "root");
  if (styleCount > 1) {
    diagnostic(options, {
      code: "invalid_structure",
      message: "An LMX document may contain at most one Style tag.",
      tagName: "Style"
    });
  }
}

/**
 * Adds a node to the currently open element.
 *
 * @param stack - Current open AST containers.
 * @param node - Node to append to the top container.
 * @returns Nothing.
 */
function appendNode(stack: Array<LoopsLmxAst | LoopsLmxElement>, node: LoopsLmxNode): void {
  stack.at(-1)?.children.push(node);
}

/**
 * Determines whether an opening tag explicitly self-closes.
 *
 * @param token - Opening-tag token.
 * @returns Whether the token ends in self-closing syntax.
 */
function isSelfClosing(token: string): boolean {
  return /\/\s*>$/.test(token);
}

/**
 * Expands components recursively, isolating every component failure to its own node.
 *
 * @param ast - Parsed component or document AST.
 * @param ancestry - Component IDs already traversed on this branch.
 * @param depth - Current component expansion depth.
 * @param maxDepth - Maximum permitted component expansion depth.
 * @param options - Parser configuration and diagnostic callback.
 * @param getComponent - Internal Loops component retrieval method.
 * @returns AST with safely expanded component children.
 */
async function expandAst(
  ast: LoopsLmxAst,
  ancestry: ReadonlySet<string>,
  depth: number,
  maxDepth: number,
  options: ParseLoopsLmxOptions,
  getComponent: GetComponent
): Promise<LoopsLmxAst> {
  return {
    ...ast,
    children: await expandNodes(ast.children, ancestry, depth, maxDepth, options, getComponent)
  };
}

/**
 * Expands all child nodes without allowing one rejected load to reject its siblings.
 *
 * @param nodes - Sibling nodes to expand.
 * @param ancestry - Component IDs already traversed on this branch.
 * @param depth - Current component expansion depth.
 * @param maxDepth - Maximum permitted component expansion depth.
 * @param options - Parser configuration and diagnostic callback.
 * @param getComponent - Internal Loops component retrieval method.
 * @returns Expanded sibling nodes in their original order.
 */
async function expandNodes(
  nodes: LoopsLmxNode[],
  ancestry: ReadonlySet<string>,
  depth: number,
  maxDepth: number,
  options: ParseLoopsLmxOptions,
  getComponent: GetComponent
): Promise<LoopsLmxNode[]> {
  return Promise.all(
    nodes.map((node) => expandNode(node, ancestry, depth, maxDepth, options, getComponent))
  );
}

/**
 * Expands one component, preserving its original local children on every unsafe outcome.
 *
 * @param node - Node to expand.
 * @param ancestry - Component IDs already traversed on this branch.
 * @param depth - Current component expansion depth.
 * @param maxDepth - Maximum permitted component expansion depth.
 * @param options - Parser configuration and diagnostic callback.
 * @param getComponent - Internal Loops component retrieval method.
 * @returns Original text, an ordinary element with expanded children, or a safely expanded component.
 */
async function expandNode(
  node: LoopsLmxNode,
  ancestry: ReadonlySet<string>,
  depth: number,
  maxDepth: number,
  options: ParseLoopsLmxOptions,
  getComponent: GetComponent
): Promise<LoopsLmxNode> {
  if (node.type === "text") return node;
  const children = await expandNodes(
    node.children,
    ancestry,
    depth,
    maxDepth,
    options,
    getComponent
  );
  const retained = { ...node, children };
  const componentId = node.name === "Component" ? node.attributes.componentId : undefined;
  if (!componentId) return retained;
  if (ancestry.has(componentId)) {
    diagnostic(options, {
      code: "component_cycle",
      message: `Skipped cyclic component: ${componentId}.`,
      componentId
    });
    return retained;
  }
  if (depth >= maxDepth) {
    diagnostic(options, {
      code: "component_depth_exceeded",
      message: `Skipped component beyond depth limit: ${componentId}.`,
      componentId
    });
    return retained;
  }
  try {
    const component = await getComponent(componentId);
    if (!component || typeof component.lmx !== "string") {
      diagnostic(options, {
        code: "invalid_component",
        message: `Component returned invalid content: ${componentId}.`,
        componentId
      });
      return retained;
    }
    const parsed = parseLmx(component.lmx, options);
    const expanded = await expandAst(
      parsed,
      new Set([...ancestry, componentId]),
      depth + 1,
      maxDepth,
      options,
      getComponent
    );
    return { ...retained, children: expanded.children };
  } catch {
    diagnostic(options, {
      code: "component_load_failed",
      message: `Could not load component: ${componentId}.`,
      componentId
    });
    return retained;
  }
}

/**
 * Normalizes a caller supplied depth to the documented finite default.
 *
 * @param options - Parser configuration that may include a depth limit.
 * @returns A non-negative integer component depth limit.
 */
function normalizedMaxDepth(options: ParseLoopsLmxOptions): number {
  const value = options.maxComponentDepth;
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : defaultMaxComponentDepth;
}

/**
 * Emits an optional diagnostic without allowing callback failures to affect parsing.
 *
 * @param options - Parser configuration containing an optional observer.
 * @param value - Recoverable issue to report.
 * @returns Nothing.
 */
function diagnostic(options: ParseLoopsLmxOptions, value: LoopsLmxDiagnostic): void {
  try {
    options.onDiagnostic?.(value);
  } catch {
    // Diagnostics are observational and must not prevent content recovery.
  }
}
