import { getLoopsLmxPixels } from "./render";

const alignments = new Set(["left", "center", "right"]);
const colorPattern = /^#[\da-f]{3}(?:[\da-f]{3})?$/i;

/**
 * A framework-neutral collection of validated inline CSS declarations.
 */
export type LoopsLmxInlineStyles = Record<string, string>;

/**
 * Converts documented LMX presentation attributes to safe inline CSS properties.
 *
 * Unknown attributes and malformed values are ignored so persisted AST data
 * cannot become an arbitrary CSS injection point.
 *
 * @param attributes - Wire-format attributes from one LMX AST element.
 * @param enabled - Whether inline style application is enabled for this render.
 * @returns Validated CSS properties suitable for adaptation to a framework style binding.
 */
export function applyInlineStyles(
  attributes: Record<string, string>,
  enabled = true
): LoopsLmxInlineStyles {
  if (!enabled) return {};

  const styles: LoopsLmxInlineStyles = {};
  const color = (attribute: string): string | undefined =>
    isLoopsLmxColor(attributes[attribute]) ? attributes[attribute] : undefined;
  const pixels = (attribute: string, minimum: number, maximum: number): string | undefined => {
    const value = getLoopsLmxPixels(attributes[attribute], minimum, maximum);
    return value === undefined ? undefined : `${value}px`;
  };

  const backgroundColor = color("bgColor") ?? color("blockColor");
  if (backgroundColor) styles.backgroundColor = backgroundColor;

  const textColor = color("textColor");
  if (textColor) styles.color = textColor;

  const borderColor = color("borderColor") ?? color("blockBorderColor");
  if (borderColor) styles.borderColor = borderColor;

  const dividerColor = color("color");
  if (dividerColor) styles.borderColor = dividerColor;

  const blockBorderRadius = pixels("blockBorderRadius", 0, 999);
  const borderRadius = pixels("borderRadius", 0, 999) ?? blockBorderRadius;
  if (borderRadius) styles.borderRadius = borderRadius;

  const borderWidth = pixels("borderWidth", 0, 16) ?? pixels("blockBorderWidth", 0, 16);
  if (borderWidth) styles.borderWidth = borderWidth;

  const paddingTop = pixels("paddingTop", 0, 999);
  const paddingRight = pixels("paddingRight", 0, 999);
  const paddingBottom = pixels("paddingBottom", 0, 999);
  const paddingLeft = pixels("paddingLeft", 0, 999);
  const innerXPadding = pixels("innerXPadding", 0, 100);
  const innerYPadding = pixels("innerYPadding", 0, 100);

  if (paddingTop) styles.paddingTop = paddingTop;
  if (paddingRight) styles.paddingRight = paddingRight;
  if (paddingBottom) styles.paddingBottom = paddingBottom;
  if (paddingLeft) styles.paddingLeft = paddingLeft;
  if (innerXPadding) styles.paddingInline = innerXPadding;
  if (innerYPadding) styles.paddingBlock = innerYPadding;

  const fontSize = pixels("fontSize", 6, 64);
  if (fontSize) styles.fontSize = fontSize;

  const lineHeight = getLoopsLmxPixels(attributes.lineHeight, 100, 300);
  if (lineHeight !== undefined) styles.lineHeight = `${lineHeight}%`;

  const align = attributes.align;
  if (align && alignments.has(align)) styles.textAlign = align;

  return styles;
}

/** Checks the LMX hex-color format before it reaches a style binding. */
function isLoopsLmxColor(value: string | undefined): value is string {
  return value !== undefined && colorPattern.test(value);
}
