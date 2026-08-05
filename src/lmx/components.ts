import type { LoopsLmxAst, LoopsLmxNode } from "../schemas/ast";
import { ofetch } from "ofetch";
import { diagnostic } from "./diagnostics";
import { parseLmx } from "./syntax";
import type { GetComponent, ParseLoopsLmxOptions } from "./types";

const defaultMaxComponentDepth = 8;

/** Retrieves only the LMX needed for parser component expansion. */
export async function fetchComponent(
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
    ) {
      return undefined;
    }
    return { lmx: (response as { lmx: string }).lmx };
  } catch {
    return undefined;
  }
}

/** Expands components recursively, isolating every component failure to its own node. */
export async function expandAst(
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

/** Normalizes a caller supplied depth to the documented finite default. */
export function normalizedMaxDepth(options: ParseLoopsLmxOptions): number {
  const value = options.maxComponentDepth;
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : defaultMaxComponentDepth;
}

/** Expands all child nodes without allowing one rejected load to reject its siblings. */
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

/** Expands one component, preserving its original local children on every unsafe outcome. */
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
  if (!componentId || hasExplicitComponentContent(node.children)) return retained;
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
    const expanded = await expandAst(
      parseLmx(component.lmx, options),
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

/** Determines whether a component supplies local content that overrides its remote default. */
function hasExplicitComponentContent(children: LoopsLmxNode[]): boolean {
  return children.some((child) => child.type === "element" || child.value.trim().length > 0);
}
