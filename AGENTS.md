# AGENTS.md

> **Operational contract for coding agents working in this repository**

---

## Before You Start

1. Understand the user's request precisely.
2. Identify which systems or files are affected.
3. Read only the relevant documentation under `docs/` if available.
4. Inspect existing implementations before introducing new patterns.
5. Keep changes as small as possible.

---

## How to Decide

### Design Priorities

When multiple valid solutions exist, prefer:

1. Correctness
2. Small changes
3. Existing patterns
4. Readability
5. Type safety
6. Performance

### Hard Rules

- **MUST NOT** introduce breaking UX or API-shape changes without explicit request
- **MUST NOT** edit files under `.husky/**` unless explicitly requested in the current task
- **MUST NOT** edit anything under `.agents/skills/**` unless explicitly requested
- **MUST NOT** add dependencies unless explicitly requested and demonstrated to improve codebase
  health and quality
- **MUST NOT** change Vitest coverage include paths unless explicitly requested
- **MUST NOT** add tests solely to meet coverage thresholds - tests should only be added for known
  risks or regression prevention
- **MUST** invoke PNPM as `corepack pnpm ...` instead of plain `pnpm ...`
- **MUST NOT** create, configure, or use a repository-local PNPM store such as `.pnpm-store/`
- **MUST NOT** set `store-dir` to a path inside the repository, whether via config, environment
  variable, or CLI flag
- **MUST NOT** run `pnpm install` or any command that mutates `node_modules` or the lockfile unless
  the current task explicitly requires dependency or package-manager work
- **MUST** use the project-pinned package manager via Corepack when running PNPM-related commands
- **MUST** prefer inspection commands that do not modify dependency state when dependency changes
  are not part of the task
- **MUST** use Zod for boundary validation where applicable
- **MUST** preserve Node server and Cloudflare Workers runtime compatibility
- **MUST** update `README.md` and the installable agent skill under `skills/loops-core-utils/` when
  changing the package's public API; keep the skill's `SKILL.md` and relevant references synchronized
  with the exported API, behavior, and safety guidance

### Working Principles

- Prefer extending existing implementations over introducing new abstractions
- Keep presentational concerns in components and reusable logic in composables
- When repository conventions are unclear, inspect nearby code before inventing a new pattern
- Verify real runtime behavior from code before changing documentation or implementation
- Read only the documentation relevant to the files or systems you are modifying
- Keep scope tight — avoid opportunistic refactors
- Preserve existing route and file naming contracts unless explicitly asked to change them

---

## When to Ask

Ask for clarification instead of guessing when:

- Requirements are ambiguous
- Multiple architectural directions are equally valid
- The requested change could break compatibility

---

## Definition of Done

A task is **ONLY** complete when **ALL** applicable items are satisfied:

1. Formatting applied with `pnpm fmt`
2. Lint autofixes applied and lint passes with `pnpm lint:fix`
3. TypeScript checks pass with `pnpm typecheck`
4. Unit tests pass with `pnpm test`
5. Documentation updated in `README.md` and, when applicable, `docs/`; public API documentation is
   also updated in `skills/loops-core-utils/` because the installable agent skill is an exposed
   consumer of this package
6. All code written or touched has proper JSDoc where applicable
7. Runtime contracts remain backward-compatible unless explicitly requested

**Important:** After completing the above, the agent **MUST NOT** commit the changes, unless explicitly requested. Instead, the
agent **MUST** provide a summary of the work done, including:

- What changed
- Impact on contracts and behavior
- Open risks or follow-up work
- A ready to copy commit message following the conventional commit rules (eg `'feat(core): add new utility'`)

It is the responsibility of the human collaborator to review, approve, and commit the changes.

---

## Git

- **Agents MUST NOT commit changes directly.** All changes must be reviewed and committed by a human
  collaborator.
- Use Conventional Commit messages: `<type>(<scope>): <subject>` for summarizing changes
- Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`, `build`, `perf`,
  `revert`
