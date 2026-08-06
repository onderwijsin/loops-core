import type { LoopsLmxAst, LoopsLmxElement, LoopsLmxNode } from "../schemas/ast";
import {
  alignValues,
  allowedAttributes,
  bodyFontCategories,
  bracedValuePattern,
  childOnlyParents,
  dynamicAttributes,
  iconColors,
  inlineContentParents,
  inlineElements,
  knownElements,
  loopsImageHosts,
  requiredAttributes,
  sectionOperations,
  sectionOperationsWithValue,
  topLevelElements,
  variablePattern,
  verticalAlignmentValues,
  voidElements
} from "./constants";
import { diagnostic } from "./diagnostics";
import type { ParseLoopsLmxOptions } from "./types";

/** Maximum number of ordered or unordered list containers that may be nested. */
const maxListDepth = 12;

/** Reports value, variable, and context violations for documented LMX attributes. */
function validateAttributes(node: LoopsLmxElement, options: ParseLoopsLmxOptions): void {
  Object.entries(node.attributes).forEach(([name, value]) => {
    validateVariableValue(value, node.name, name, options);
    if (!isValidAttributeValue(node.name, name, value)) {
      diagnostic(options, {
        code: "invalid_attribute",
        message: `Invalid ${node.name} attribute value: ${name}.`,
        tagName: node.name
      });
    }
  });

  if (node.name !== "Section" || !node.attributes.if) return;
  const { if: condition, ifOperation: operation, ifValue } = node.attributes;
  if (!isSingleVariable(condition)) {
    diagnostic(options, {
      code: "invalid_variable",
      message: "Section if must be a single prefixed LMX variable.",
      tagName: node.name
    });
  }
  if (operation && !sectionOperations.has(operation)) {
    diagnostic(options, {
      code: "invalid_attribute",
      message: "Section ifOperation is not supported.",
      tagName: node.name
    });
  }
  if (operation && sectionOperationsWithValue.has(operation) && !ifValue) {
    diagnostic(options, {
      code: "missing_attribute",
      message: `Section ifOperation ${operation} requires ifValue.`,
      tagName: node.name
    });
  }
}

/** Reports invalid variables while preserving the parser's recoverable AST. */
function validateVariableValue(
  value: string,
  elementName: string,
  attributeName: string | undefined,
  options: ParseLoopsLmxOptions
): void {
  const bracedValues = value.match(bracedValuePattern) ?? [];
  if (bracedValues.length === 0) return;
  const variables = [...value.matchAll(variablePattern)];
  if (variables.length !== bracedValues.length) {
    diagnostic(options, {
      code: "invalid_variable",
      message: "LMX variables must use a supported prefixed namespace without inline fallbacks.",
      tagName: elementName
    });
    return;
  }
  if (attributeName && !dynamicAttributes[elementName]?.has(attributeName)) {
    diagnostic(options, {
      code: "invalid_dynamic_attribute",
      message: `${elementName} ${attributeName} does not support LMX variables.`,
      tagName: elementName
    });
  } else if (!attributeName && !isVariableTextParent(elementName)) {
    diagnostic(options, {
      code: "invalid_variable",
      message: `${elementName} does not support LMX variables in text content.`,
      tagName: elementName
    });
  }
  variables.forEach((match) => {
    const namespace = match[1] as "contact" | "event" | "data";
    if (!isVariableNamespaceAllowed(namespace, options.emailType)) {
      diagnostic(options, {
        code: "invalid_variable",
        message: `{${namespace}.*} is not valid in ${options.emailType} LMX.`,
        tagName: elementName
      });
    }
  });
}

/** Determines whether a variable namespace is valid for an optional email type. */
function isVariableNamespaceAllowed(
  namespace: "contact" | "event" | "data",
  emailType: ParseLoopsLmxOptions["emailType"]
): boolean {
  if (!emailType) return true;
  return (
    (emailType === "campaign" && namespace === "contact") ||
    (emailType === "workflow" && (namespace === "contact" || namespace === "event")) ||
    (emailType === "transactional" && namespace === "data")
  );
}

/** Determines whether a string is exactly one documented LMX variable. */
function isSingleVariable(value: string): boolean {
  return /^\{(?:contact|event|data)\.[A-Za-z0-9_-]+\}$/.test(value);
}

/** Validates documented scalar attribute formats and constrained value sets. */
function isValidAttributeValue(elementName: string, name: string, value: string): boolean {
  const validator = attributeValueValidators[name];
  if (validator) return validator(elementName, value);
  if (name.startsWith("padding")) return isNumberInRange(value, 0, 999);
  return !name.endsWith("Color") || isHexColor(value);
}

/** Scalar validators keyed by documented LMX attribute name. */
const attributeValueValidators: Record<string, (elementName: string, value: string) => boolean> = {
  align: (_, value) => alignValues.has(value),
  verticalAlignment: (_, value) => verticalAlignmentValues.has(value),
  notrack: (_, value) => isBooleanValue(value),
  stackOnMobile: (_, value) => isBooleanValue(value),
  reverseOnMobile: (_, value) => isBooleanValue(value),
  bodyFontCategory: (_, value) => bodyFontCategories.has(value),
  color: (elementName, value) =>
    elementName === "Icons"
      ? iconColors.has(value.toLowerCase())
      : elementName !== "Divider" || isHexColor(value),
  src: (elementName, value) => elementName !== "Image" || isLoopsHostedImageUrl(value),
  width: (elementName, value) =>
    elementName === "Image"
      ? isNumberInRange(value, 1, 600)
      : elementName !== "Divider" || isNumberInRange(value, 10, 100),
  gap: (elementName, value) =>
    elementName === "Columns"
      ? isNumberInRange(value, 12, 150)
      : elementName !== "Icons" || isNumberInRange(value, 4, 200),
  size: (elementName, value) => elementName !== "Icons" || isNumberInRange(value, 18, 48),
  borderWidth: (elementName, value) =>
    elementName === "Style" || isNumberInRange(value, elementName === "Divider" ? 1 : 0, 16),
  fontSize: (elementName, value) => isNumberInRange(value, elementName === "Button" ? 6 : 12, 64),
  lineHeight: (_, value) => isNumberInRange(value, 100, 300),
  blockBorderRadius: (_, value) => isNumberInRange(value, 0, 999),
  borderRadius: (_, value) => isNumberInRange(value, 0, 999),
  innerXPadding: (_, value) => isNumberInRange(value, 0, 100),
  innerYPadding: (_, value) => isNumberInRange(value, 0, 100),
  blockBorderWidth: (_, value) => isNumberInRange(value, 0, 999)
};

/** Reports LMX specification violations without discarding the recoverable AST. */
export function validateLmxAst(ast: LoopsLmxAst, options: ParseLoopsLmxOptions): void {
  const styles = { count: 0 };
  ast.children.forEach((node) => validateLmxNode(node, "root", options, styles, 0));
  if (styles.count > 1) {
    diagnostic(options, {
      code: "invalid_structure",
      message: "An LMX document may contain at most one Style tag.",
      tagName: "Style"
    });
  }
}

/** Validates a node and its descendants without changing the recovered AST. */
function validateLmxNode(
  node: LoopsLmxNode,
  parent: string,
  options: ParseLoopsLmxOptions,
  styles: { count: number },
  listDepth: number
): void {
  if (node.type === "text") return validateTextNode(node, parent, options);
  const currentListDepth = listDepth + (isList(node.name) ? 1 : 0);
  validateElementContext(node, parent, options, currentListDepth);
  if (node.name === "Style") styles.count += 1;
  validateElementAttributes(node, options);
  validateElementChildren(node, options);
  node.children.forEach((child) =>
    validateLmxNode(child, node.name, options, styles, currentListDepth)
  );
}

/** Validates text placement and variable syntax. */
function validateTextNode(
  node: Extract<LoopsLmxNode, { type: "text" }>,
  parent: string,
  options: ParseLoopsLmxOptions
): void {
  if (parent === "root" && node.value.trim()) {
    diagnostic(options, {
      code: "invalid_structure",
      message: "Text is not allowed at the LMX document top level."
    });
  }
  if (parent !== "CodeBlock") validateVariableValue(node.value, parent, undefined, options);
}

/** Validates whether an element is allowed at its current nesting level. */
function validateElementContext(
  node: LoopsLmxElement,
  parent: string,
  options: ParseLoopsLmxOptions,
  listDepth: number
): void {
  if (!knownElements.has(node.name)) {
    diagnostic(options, {
      code: "unsupported_tag",
      message: `Unsupported LMX tag: ${node.name}.`,
      tagName: node.name
    });
  }
  if (parent === "root" && !topLevelElements.has(node.name)) {
    reportInvalidStructure(
      options,
      `${node.name} is not allowed at the LMX document top level.`,
      node.name
    );
  }
  validateDeclaredParent(node.name, parent, options);
  const nestedList = parent === "ListItem" && isList(node.name);
  if (nestedList && listDepth > maxListDepth) {
    reportInvalidStructure(options, `Lists may be nested up to ${maxListDepth} levels.`, node.name);
  }
  if (inlineContentParents.has(parent) && !isInlineContent(node.name) && !nestedList) {
    reportInvalidStructure(options, `${parent} may only contain inline content.`, parent);
  }
  if (parent === "Button" && node.name !== "Text") {
    reportInvalidStructure(
      options,
      "Button may contain text and variables, but not inline tags.",
      "Button"
    );
  }
  if (parent === "CodeBlock")
    reportInvalidStructure(options, "CodeBlock content must be raw text.", "CodeBlock");
  if (isInvalidBlockChild(parent, node.name)) {
    reportInvalidStructure(options, `${parent} may only contain permitted block tags.`, parent);
  }
}

/** Validates elements whose documented placement is more specific than a block container. */
function validateDeclaredParent(name: string, parent: string, options: ParseLoopsLmxOptions): void {
  if (parent === "root") return;
  if (name === "Style")
    return reportInvalidStructure(
      options,
      "Style is only allowed at the LMX document top level.",
      name
    );
  if (isInlineContent(name) && !isInlineContentParent(parent)) {
    return reportInvalidStructure(options, `${name} is only valid inside inline content.`, name);
  }
  const allowedParents = childOnlyParents[name];
  if (allowedParents && !allowedParents.has(parent)) {
    reportInvalidStructure(options, `${name} is not valid inside ${parent}.`, name);
  }
}

/** Validates required, known, dynamic, and scalar attributes. */
function validateElementAttributes(node: LoopsLmxElement, options: ParseLoopsLmxOptions): void {
  const required = requiredAttributes[node.name];
  if (required && !node.attributes[required]) {
    diagnostic(options, {
      code: "missing_attribute",
      message: `${node.name} requires the ${required} attribute.`,
      tagName: node.name
    });
  }
  const allowed = allowedAttributes[node.name];
  if (allowed) {
    Object.keys(node.attributes)
      .filter((attribute) => !allowed.has(attribute))
      .forEach((attribute) => {
        diagnostic(options, {
          code: "unknown_attribute",
          message: `Unknown ${node.name} attribute: ${attribute}.`,
          tagName: node.name
        });
      });
  }
  validateAttributes(node, options);
}

/** Validates element-specific child content rules. */
function validateElementChildren(node: LoopsLmxElement, options: ParseLoopsLmxOptions): void {
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
  validateCollectionChildren(node, childElements, options);
  validateBlockChildren(node, childElements, options);
  if (
    isInlineContent(node.name) &&
    childElements.some(
      (child) => !isInlineContent(child.name) && !(node.name === "ListItem" && isList(child.name))
    )
  ) {
    reportInvalidStructure(options, `${node.name} may only contain inline content.`, node.name);
  }
  if (node.name === "Button" && childElements.length > 0)
    reportInvalidStructure(
      options,
      "Button may contain text and variables, but not inline tags.",
      "Button"
    );
  if (node.name === "CodeBlock" && childElements.length > 0)
    reportInvalidStructure(options, "CodeBlock content must be raw text.", "CodeBlock");
}

/** Validates list, column, and icon collection structures. */
function validateCollectionChildren(
  node: LoopsLmxElement,
  childElements: LoopsLmxElement[],
  options: ParseLoopsLmxOptions
): void {
  const expectedChild = expectedChildName(node.name);
  if (expectedChild && hasUnexpectedCollectionChild(node.children, expectedChild))
    reportInvalidStructure(
      options,
      `${node.name} may only contain ${expectedChild} children.`,
      node.name
    );
  if (isList(node.name) && childElements.length < 1)
    reportInvalidStructure(options, `${node.name} requires at least one ListItem.`, node.name);
  if (node.name === "Columns") {
    if (childElements.length < 2 || childElements.length > 4)
      reportInvalidStructure(
        options,
        "Columns requires two to four ColumnItem children.",
        node.name
      );
    if (
      node.attributes.widths &&
      !hasValidColumnWidths(node.attributes.widths, childElements.length)
    ) {
      diagnostic(options, {
        code: "invalid_attribute",
        message: "Columns widths must match the column count and total 100.",
        tagName: node.name
      });
    }
  }
  if (node.name === "Icons" && (childElements.length < 1 || childElements.length > 100))
    reportInvalidStructure(options, "Icons requires one to 100 Icon children.", node.name);
}

/** Validates restrictions on containers that otherwise hold block elements. */
function validateBlockChildren(
  node: LoopsLmxElement,
  childElements: LoopsLmxElement[],
  options: ParseLoopsLmxOptions
): void {
  const invalidChild = blockChildValidator(node.name);
  const message = blockChildMessage(node.name);
  if (invalidChild && message && childElements.some(invalidChild))
    reportInvalidStructure(options, message, node.name);
}

/** Returns the direct-child rule for block containers that add nesting restrictions. */
function blockChildValidator(name: string): ((child: LoopsLmxElement) => boolean) | undefined {
  if (name === "ColumnItem")
    return (child) =>
      !topLevelElements.has(child.name) || child.name === "Style" || child.name === "Columns";
  if (name === "Component") return (child) => child.name === "Style" || child.name === "Component";
  if (name === "Section") return (child) => child.name === "Style" || child.name === "Section";
  return undefined;
}

/** Returns the matching direct-child diagnostic for restricted block containers. */
function blockChildMessage(name: string): string | undefined {
  if (name === "ColumnItem")
    return "ColumnItem may contain block tags but not Style or nested Columns.";
  if (name === "Component") return "Components cannot contain Style or nested Component tags.";
  return name === "Section" ? "Sections cannot contain Style or nested Section tags." : undefined;
}

/** Reports a semantic structure violation. */
function reportInvalidStructure(
  options: ParseLoopsLmxOptions,
  message: string,
  tagName?: string
): void {
  diagnostic(options, { code: "invalid_structure", message, tagName });
}

/** Determines whether a name may appear as inline content. */
function isInlineContent(name: string): boolean {
  return inlineElements.has(name) || name === "Br";
}

/** Determines whether a tag accepts variable-bearing inline text. */
function isVariableTextParent(name: string): boolean {
  return inlineContentParents.has(name) || inlineElements.has(name) || name === "Button";
}

/** Determines whether a tag can directly contain documented inline elements. */
function isInlineContentParent(name: string): boolean {
  return inlineContentParents.has(name) || inlineElements.has(name);
}

/** Determines whether a block child is prohibited by its special container. */
function isInvalidBlockChild(parent: string, name: string): boolean {
  if (parent !== "ColumnItem" && parent !== "Component" && parent !== "Section") return false;
  return (
    !topLevelElements.has(name) ||
    name === "Style" ||
    (parent === "ColumnItem" && name === "Columns") ||
    (parent === "Component" && name === "Component") ||
    (parent === "Section" && name === "Section")
  );
}

/** Returns the only allowed direct child element for collection containers. */
function expectedChildName(name: string): string | undefined {
  if (isList(name)) return "ListItem";
  if (name === "Columns") return "ColumnItem";
  return name === "Icons" ? "Icon" : undefined;
}

/** Determines whether a collection contains non-whitespace text or an unexpected element. */
function hasUnexpectedCollectionChild(nodes: LoopsLmxNode[], expectedName: string): boolean {
  return nodes.some((child) =>
    child.type === "text" ? child.value.trim().length > 0 : child.name !== expectedName
  );
}

/** Determines whether a name identifies an ordered or unordered list. */
function isList(name: string): boolean {
  return name === "OrderedList" || name === "UnorderedList";
}

/** Validates that declared column widths align with the number of columns and total 100. */
function hasValidColumnWidths(value: string, columnCount: number): boolean {
  const widths = value.split(",").map((width) => Number(width.trim()));
  return (
    widths.length === columnCount &&
    widths.every((width) => Number.isFinite(width) && width > 0) &&
    Math.abs(widths.reduce((total, width) => total + width, 0) - 100) <= 0.01
  );
}

/** Determines whether a documented boolean attribute has a valid string value. */
function isBooleanValue(value: string): boolean {
  return value === "true" || value === "false";
}

/** Determines whether a string is a three- or six-digit hexadecimal color. */
function isHexColor(value: string): boolean {
  return /^#[\da-fA-F]{3}(?:[\da-fA-F]{3})?$/.test(value);
}

/** Determines whether a numeric LMX attribute falls within its inclusive bounds. */
function isNumberInRange(value: string, minimum: number, maximum: number): boolean {
  if (!/^\d+(?:\.\d+)?$/.test(value)) return false;
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum;
}

/** Determines whether an image source is a static URL hosted by Loops. */
function isLoopsHostedImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && loopsImageHosts.has(url.hostname);
  } catch {
    return false;
  }
}
