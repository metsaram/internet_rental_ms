# NetRent — AI Agent Guide

## Core Responsibilities & 5-Step RAG Workflow

Every AI agent operating in the NetRent repository must strictly execute the following 5-step workflow:

1. **Retrieval**
   - Always search and retrieve the most relevant context from project documents (`README.md`, `AGENTS.md`, `AI_AGENT_GUIDE.md`, and `docs/`).
   - Use vector/keyword search to assemble verified context before generating any code or configuration.

2. **Generation**
   - Produce requested output (code, config, documentation, explanation) based strictly on retrieved facts.
   - Enforce correctness via validation (linting, TypeScript compiler, schema checks).
   - **Mandatory Component Test Verification**: Every newly generated UI or shared component must include a verifying test file (`*.test.tsx`) with Vitest, `@testing-library/react`, and `@testing-library/jest-dom`. Validate with `bun run test:run`.
   - Never hallucinate APIs or structures.

3. **Database Migration**
   - When a task involves schema changes, always generate a migration file in:
     `db/yyyy-mm-dd/table_name/`
   - File must include:
     - SQL or Prisma migration script
     - Clear description of changes (columns, constraints, indexes)
   - Ensure naming convention matches `table_name` and the `yyyy-mm-dd` timestamp format.

4. **Documentation Update**
   - Always update the `docs/` folder after completing a task:
     - `docs/overview/` → Update `project.md`, `architecture.md`, or `tech_stack.md` if scope/stack changes.
     - `docs/guides/` → Update `ai_agent_guide.md`, `developer_guide.md`, or `api_guide.md` if workflows or APIs change.
     - `docs/migrations/yyyy-mm-dd/` → Add a migration doc explaining schema changes alongside the SQL/Prisma file.
     - `docs/changelog/yyyy-mm.md` → Append a monthly summary of changes.
     - `docs/task_logs/yyyy-mm-dd.md` → Append detailed task log entries.
   - Summarize the change in 2–3 sentences for quick reference.

5. **Feedback Loop**
   - Present the result and updated documentation summary to the user.
   - Store embeddings of new content so future retrieval includes updated knowledge.
   - If validation fails, retry generation with adjusted parameters.

---

## The Golden Rule
> **Every task must leave the documentation and database migrations more complete than before. No task is considered finished until both the `db/` and `docs/` folders are updated.**

---

## Critical Repository Rules
1. **Never import Prisma in client components**: Do not import `@prisma/client` from files in `src/components/**` or `src/lib/format.ts`.
2. **Radix `<Select>` Sentinel**: Use literal string `"none"` for optional selects instead of empty string `""`.
3. **No `.forEach()` with `await`**: Always use `for (const item of items)` loop constructs.
4. **Dev Server Restart on Schema Change**: Turbopack caches the generated client; restart `bun run dev` after `prisma db push` / `prisma generate`.
5. **Mandatory Company Scope**: Guard all route handlers with `requireUser()` or `requireAdmin()` from `@/lib/session` and scope all queries by `user.companyId`.
6. **Audit All Mutations**: Call `writeAudit()` on every create/update/delete operation with sensitive field redaction.
7. **Mandatory Component Test Verification**: Every new component added to the codebase must be accompanied by a verifying test suite (`*.test.tsx`) asserting proper rendering, user interactions, and DOM state using Vitest, React Testing Library, and jest-dom.
8. **Master Entity Display Standard (Name First, Code Second)**: Master entities (`Branch`, `Shop`, `Provider`) must always use entity `name` as primary display (`font-medium` / bold) and entity `code` as secondary text (`text-[11px] text-muted-foreground` / font-mono). DataTable columns must use `key: "name"`, select dropdowns must format as `${name} — ${code}`, and confirmation dialogs / sheets must prioritize name before code.

