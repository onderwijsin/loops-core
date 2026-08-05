import type { LoopsLmxAst, LoopsLmxElement, LoopsLmxNode } from "../schemas/ast";
import { voidElements } from "./constants";
import { diagnostic } from "./diagnostics";
import type { ParseLoopsLmxOptions } from "./types";
import { validateLmxAst } from "./validation";

/** Parses LMX syntax while retaining malformed portions as text where possible. */
export function parseLmx(lmx: unknown, options: ParseLoopsLmxOptions): LoopsLmxAst {
  const root: LoopsLmxAst = { type: "root", children: [] };
  if (typeof lmx !== "string") {
    diagnostic(options, { code: "invalid_lmx", message: "LMX must be a string." });
    return root;
  }

  const stack: Array<LoopsLmxAst | LoopsLmxElement> = [root];
  tokenize(lmx).forEach((token) => parseToken(token, stack, options));
  validateLmxAst(root, options);
  return root;
}

/** Applies a token to the current stack of unclosed LMX elements. */
function parseToken(
  token: string,
  stack: Array<LoopsLmxAst | LoopsLmxElement>,
  options: ParseLoopsLmxOptions
): void {
  if (token.startsWith("<!--")) return;
  if (token.startsWith("</")) return closeElement(token, stack, options);
  if (!token.startsWith("<")) return appendNode(stack, { type: "text", value: token });

  const element = createElement(token, options);
  if (!element) {
    diagnostic(options, { code: "malformed_tag", message: "Retained malformed LMX tag as text." });
    return appendNode(stack, { type: "text", value: token });
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

/** Splits LMX without losing quoted `>` characters or unterminated tag text. */
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

/** Finds a tag end while respecting single and double quoted attributes. */
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

/** Reconciles a closing tag with the nearest matching open element. */
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
  const index = findOpenElement(stack, tagName);
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

/** Finds the nearest matching open element in the parsing stack. */
function findOpenElement(stack: Array<LoopsLmxAst | LoopsLmxElement>, tagName: string): number {
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    const entry = stack[index];
    if (entry?.type === "element" && entry.name === tagName) return index;
  }
  return -1;
}

/** Creates an element from a valid opening or self-closing tag. */
function createElement(token: string, options: ParseLoopsLmxOptions): LoopsLmxElement | null {
  const match = /^<\s*([A-Za-z][\w-]*)([^>]*)>$/.exec(token);
  if (!match) return null;
  const parsedAttributes = parseAttributes(match[2] ?? "");
  if (parsedAttributes.malformed) {
    diagnostic(options, {
      code: "malformed_tag",
      message: "Ignored malformed or unquoted LMX attribute.",
      tagName: match[1]!
    });
  }
  return {
    type: "element",
    name: match[1]!,
    attributes: parsedAttributes.attributes,
    children: []
  };
}

/** Parses quoted LMX attributes while leaving malformed attributes out of the safe AST. */
function parseAttributes(source: string): {
  attributes: Record<string, string>;
  malformed: boolean;
} {
  const attributes: Record<string, string> = {};
  const attributeSource = source.replace(/\/\s*$/, "");
  const pattern = /\s+([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/y;
  let index = 0;
  while (index < attributeSource.length) {
    pattern.lastIndex = index;
    const match = pattern.exec(attributeSource);
    if (!match) return { attributes, malformed: attributeSource.slice(index).trim().length > 0 };
    attributes[match[1]!] = match[2] ?? match[3] ?? "";
    index = pattern.lastIndex;
  }
  return { attributes, malformed: false };
}

/** Adds a node to the currently open element. */
function appendNode(stack: Array<LoopsLmxAst | LoopsLmxElement>, node: LoopsLmxNode): void {
  stack.at(-1)?.children.push(node);
}

/** Determines whether an opening tag explicitly self-closes. */
function isSelfClosing(token: string): boolean {
  return /\/\s*>$/.test(token);
}
