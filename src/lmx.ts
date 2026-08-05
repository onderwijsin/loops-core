import { expandAst, fetchComponent, normalizedMaxDepth } from "./lmx/components";
import type { LoopsLmxAst } from "./schemas/ast";
import { parseLmx } from "./lmx/syntax";
import type { ParseLoopsLmxOptions } from "./lmx/types";

export type { LoopsLmxDiagnostic, ParseLoopsLmxOptions } from "./lmx/types";

/**
 * Parses LMX permissively and expands reusable components when an API key is supplied.
 *
 * @param lmx - Raw LMX document.
 * @param options - Optional Loops API key, recursion limit, and diagnostic observer.
 * @returns A recoverable, renderer-neutral LMX AST.
 */
export async function parseLoopsLmx(
  lmx: string,
  options: ParseLoopsLmxOptions = {}
): Promise<LoopsLmxAst> {
  const ast = parseLmx(lmx, options);
  if (!options.apiKey) return ast;

  return expandAst(ast, new Set(), 0, normalizedMaxDepth(options), options, (componentId) =>
    fetchComponent(componentId, options.apiKey!)
  );
}
