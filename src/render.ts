import type { LoopsLmxElement, LoopsLmxNode } from "./schemas/ast";

const inlineElements = new Set([
  "Strong",
  "Em",
  "Underline",
  "Strike",
  "Code",
  "Text",
  "Link",
  "Br"
]);
const blockElements = new Set([
  "H1",
  "H2",
  "H3",
  "Paragraph",
  "Quote",
  "UnorderedList",
  "OrderedList",
  "ListItem",
  "Button",
  "CodeBlock",
  "Image",
  "Divider",
  "Component",
  "Icons",
  "Icon",
  "Section",
  "Columns",
  "ColumnItem"
]);
/**
 * Returns whether an element belongs to the safe shared renderer subset.
 *
 * @param node - LMX element to inspect.
 * @returns `true` when the standard renderer supports the element name.
 */
export function isRenderableLoopsLmxElement(node: LoopsLmxElement): boolean {
  return inlineElements.has(node.name) || blockElements.has(node.name);
}

/**
 * Returns whether a tree contains elements omitted by the standard renderer.
 *
 * @param nodes - Nodes to inspect recursively.
 * @returns `true` when at least one non-Style element is unsupported.
 */
export function hasUnsupportedLoopsLmxNodes(nodes: LoopsLmxNode[]): boolean {
  return getUnsupportedLoopsLmxNodes(nodes).length > 0;
}

/**
 * Lists unsupported elements while treating Style as non-visible metadata.
 *
 * @param nodes - Nodes to inspect recursively.
 * @returns Unsupported LMX elements in document order.
 */
export function getUnsupportedLoopsLmxNodes(nodes: LoopsLmxNode[]): LoopsLmxElement[] {
  return nodes.flatMap((node) => {
    if (node.type === "text") return [];
    if (node.name === "Style") return [];
    return isRenderableLoopsLmxElement(node) ? getUnsupportedLoopsLmxNodes(node.children) : [node];
  });
}

/**
 * Parses a valid native image width from an LMX attribute.
 *
 * @param value - Untrusted width attribute value.
 * @returns An integer from 12 through 600, or `undefined` when invalid.
 */
export function getLoopsLmxImageWidth(value: string | undefined): number | undefined {
  return getLoopsLmxPixels(value, 12, 600);
}

/**
 * Parses a bounded decimal integer before it reaches a renderer attribute.
 *
 * @param value - Untrusted pixel attribute value.
 * @param minimum - Inclusive lower pixel bound.
 * @param maximum - Inclusive upper pixel bound.
 * @returns A validated integer, or `undefined` when the value is out of range or malformed.
 */
export function getLoopsLmxPixels(
  value: string | undefined,
  minimum: number,
  maximum: number
): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const pixels = Number(value);
  return Number.isSafeInteger(pixels) && pixels >= minimum && pixels <= maximum
    ? pixels
    : undefined;
}

/**
 * Produces a validated, renderer-neutral columns layout.
 *
 * @param widths - Comma-separated percentage widths from LMX.
 * @param gap - Pixel gap from LMX.
 * @param columnCount - Number of rendered columns.
 * @returns A plain grid layout using validated widths or equal-width fallback columns.
 *
 * @example
 * getLoopsLmxColumnsLayout("40,60", "16", 2);
 * // { display: "grid", gap: "16px", gridTemplateColumns: "40fr 60fr" }
 */
export function getLoopsLmxColumnsLayout(
  widths: string | undefined,
  gap: string | undefined,
  columnCount: number
): { display: "grid"; gap: string; gridTemplateColumns: string } {
  const safeColumnCount = Number.isSafeInteger(columnCount) && columnCount > 0 ? columnCount : 1;
  const parsed = widths?.split(",").map((width) => Number(width.trim()));
  const validWidths =
    parsed?.length === safeColumnCount &&
    parsed.every((width) => Number.isFinite(width) && width > 0) &&
    Math.abs(parsed.reduce((total, width) => total + width, 0) - 100) < 0.01;
  return {
    display: "grid",
    gap: `${getLoopsLmxPixels(gap, 12, 150) ?? 24}px`,
    gridTemplateColumns: validWidths
      ? parsed.map((width) => `${width}fr`).join(" ")
      : `repeat(${safeColumnCount}, minmax(0, 1fr))`
  };
}

/**
 * Returns whether a tree contains content the standard renderer can visibly render.
 *
 * @param nodes - Nodes to inspect recursively.
 * @returns `true` when visible text or a supported element is present.
 */
export function hasRenderableLoopsLmxNodes(nodes: LoopsLmxNode[]): boolean {
  return nodes.some((node) => {
    if (node.type === "text") return node.value.trim().length > 0;
    if (node.name === "Style") return false;
    return node.name === "Component"
      ? hasRenderableLoopsLmxNodes(node.children)
      : isRenderableLoopsLmxElement(node);
  });
}
