import type { LoopsLmxDiagnostic, ParseLoopsLmxOptions } from "./types";

/** Emits an optional diagnostic without allowing callback failures to affect parsing. */
export function diagnostic(options: ParseLoopsLmxOptions, value: LoopsLmxDiagnostic): void {
  try {
    options.onDiagnostic?.(value);
  } catch {
    // Diagnostics are observational and must not prevent content recovery.
  }
}
