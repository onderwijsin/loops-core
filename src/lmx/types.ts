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
    | "invalid_self_closing"
    | "invalid_attribute"
    | "invalid_variable"
    | "invalid_dynamic_attribute";
  message: string;
  componentId?: string;
  tagName?: string;
};

/** Options for resilient LMX parsing and optional server-side component expansion. */
export type ParseLoopsLmxOptions = {
  apiKey?: string;
  /** The Loops email type used to validate variable namespaces. */
  emailType?: "campaign" | "workflow" | "transactional";
  maxComponentDepth?: number;
  onDiagnostic?: (diagnostic: LoopsLmxDiagnostic) => void;
};

/** Retrieves the LMX body of a reusable component. */
export type GetComponent = (componentId: string) => Promise<{ lmx: string } | undefined>;
