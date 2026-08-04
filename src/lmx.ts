import type { LoopsLmxAst, LoopsLmxElement, LoopsLmxNode } from "./ast";
import { createLoopsEmailCampaignClient } from "./client";

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
    | "component_depth_exceeded";
  message: string;
  componentId?: string;
  tagName?: string;
};

/** Options for resilient LMX parsing and optional component expansion. */
export type ParseLoopsLmxOptions = {
  apiKey?: string;
  maxComponentDepth?: number;
  onDiagnostic?: (diagnostic: LoopsLmxDiagnostic) => void;
};

type GetComponent = ReturnType<typeof createLoopsEmailCampaignClient>["getComponent"];

const defaultMaxComponentDepth = 8;
const voidElements = new Set(["Image", "Divider", "Br", "Icon", "Style"]);

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
    ? createLoopsEmailCampaignClient(options.apiKey).getComponent
    : undefined;
  return getComponent
    ? expandAst(ast, new Set(), 0, normalizedMaxDepth(options), options, getComponent)
    : ast;
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
    if (!isSelfClosing(token) && !voidElements.has(element.name)) stack.push(element);
  }
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
    tokens.push(source.slice(index, end + 1));
    index = end + 1;
    textStart = index;
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
