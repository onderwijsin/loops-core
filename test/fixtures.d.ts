/** Allows Vitest to import LMX fixtures as raw source text. */
declare module "*.lmx?raw" {
  const source: string;
  export default source;
}
