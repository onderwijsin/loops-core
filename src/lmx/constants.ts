const sharedBlockAttributes = new Set([
  "blockColor",
  "blockBorderRadius",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft"
]);
const conditionalSectionAttributes = new Set([
  "if",
  "ifOperation",
  "ifValue",
  "blockBorderWidth",
  "blockBorderColor"
]);
const noAttributes = new Set<string>();
const textBlockAttributes = new Set(["fontSize", "lineHeight", "align", ...sharedBlockAttributes]);

/** Tags that must not contain child content. */
export const voidElements = new Set(["Image", "Divider", "Br", "Icon", "Style"]);
/** Tags that can appear in inline content. */
export const inlineElements = new Set([
  "Strong",
  "Em",
  "Underline",
  "Strike",
  "Code",
  "Text",
  "Link"
]);
/** Block tags that accept inline content. */
export const inlineContentParents = new Set(["H1", "H2", "H3", "Paragraph", "Quote", "ListItem"]);
/** Required direct parents for child-only structural tags. */
export const childOnlyParents: Record<string, ReadonlySet<string>> = {
  ListItem: new Set(["OrderedList", "UnorderedList"]),
  ColumnItem: new Set(["Columns"]),
  Icon: new Set(["Icons"])
};
/** Valid block tags at the root of an LMX document. */
export const topLevelElements = new Set([
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
/** Every LMX tag supported by the parser. */
export const knownElements = new Set([
  ...topLevelElements,
  ...inlineElements,
  "Br",
  "ListItem",
  "ColumnItem",
  "Icon"
]);
/** Attributes documented for each supported LMX tag. */
export const allowedAttributes: Record<string, ReadonlySet<string>> = {
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
  Section: new Set(["href", "notrack", ...conditionalSectionAttributes, ...sharedBlockAttributes]),
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
  Link: new Set(["href", "notrack"]),
  Br: noAttributes,
  ColumnItem: noAttributes
};
/** Attributes that may contain LMX variables. */
export const dynamicAttributes: Record<string, ReadonlySet<string>> = {
  Button: new Set(["href"]),
  Image: new Set(["alt", "href", "dynamicSrc"]),
  Link: new Set(["href"]),
  Section: new Set(["href", "if"])
};
/** Attributes that must be supplied for their element to compile. */
export const requiredAttributes: Record<string, string> = {
  Image: "src",
  Component: "componentId",
  Icon: "name",
  Link: "href"
};
export const alignValues = new Set(["left", "center", "right"]);
export const verticalAlignmentValues = new Set(["top", "middle", "bottom"]);
export const bodyFontCategories = new Set([
  "ui-sans-serif",
  "ui-serif",
  "ui-monospace",
  "sans-serif",
  "serif",
  "monospace"
]);
export const iconColors = new Set(["#000000", "#808080", "#ffffff"]);
export const sectionOperations = new Set([
  "not_empty",
  "empty",
  "equal",
  "not_equal",
  "contains",
  "not_contains",
  "numeric_equal",
  "numeric_not_equal",
  "greater_than",
  "less_than",
  "true",
  "false"
]);
export const sectionOperationsWithValue = new Set([
  "equal",
  "not_equal",
  "contains",
  "not_contains",
  "numeric_equal",
  "numeric_not_equal",
  "greater_than",
  "less_than"
]);
export const variablePattern = /\{(contact|event|data)\.([A-Za-z0-9_-]+)\}/g;
export const bracedValuePattern = /\{[^{}]*\}/g;
export const loopsImageHosts = new Set(["images.vialoops.com"]);
