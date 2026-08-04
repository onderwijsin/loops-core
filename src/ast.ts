import { z } from "zod";

/** A literal text fragment in a parsed Loops LMX document. */
export type LoopsLmxTextNode = { type: "text"; value: string };

/** A renderer-neutral LMX element with wire-format string attributes. */
export type LoopsLmxElement = {
  type: "element";
  name: string;
  attributes: Record<string, string>;
  children: LoopsLmxNode[];
};

/** A node in a parsed LMX document. */
export type LoopsLmxNode = LoopsLmxTextNode | LoopsLmxElement;

/** The JSON-serializable root of a parsed LMX document. */
export type LoopsLmxAst = { type: "root"; children: LoopsLmxNode[] };

/** Validates a persisted LMX text node. */
export const loopsLmxTextNodeSchema: z.ZodType<LoopsLmxTextNode> = z.strictObject({
  type: z.literal("text"),
  value: z.string()
});

/** Validates a persisted recursive LMX element. */
export const loopsLmxElementSchema: z.ZodType<LoopsLmxElement> = z.strictObject({
  type: z.literal("element"),
  name: z.string(),
  attributes: z.record(z.string(), z.string()),
  children: z.array(z.lazy(() => loopsLmxNodeSchema))
});

/** Validates a persisted LMX node. */
export const loopsLmxNodeSchema: z.ZodType<LoopsLmxNode> = z.union([
  loopsLmxTextNodeSchema,
  loopsLmxElementSchema
]);

/** Validates a persisted LMX AST root. */
export const loopsLmxAstSchema: z.ZodType<LoopsLmxAst> = z.strictObject({
  type: z.literal("root"),
  children: z.array(loopsLmxNodeSchema)
});
