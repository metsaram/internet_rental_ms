<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## NetRent Project Architecture & Agent Rules

Refer to [AI_AGENT_GUIDE.md](file:///d:/Projects/internet_rental_ms/AI_AGENT_GUIDE.md) and [docs/guides/](file:///d:/Projects/internet_rental_ms/docs/guides/) for complete specifications.

### Critical Rules
1. **Never import Prisma in client components**: Never import `@prisma/client` from files under `src/components/**` or `src/lib/format.ts`.
2. **Master Entity Display Standard (Name First, Code Second)**: Across all DataTables, select options, modal titles, and sheets, always display entity `name` as the primary display (`font-medium`) and entity `code` as the secondary text (`text-[11px] text-muted-foreground` or font-mono). For data table columns representing entities with a name/code pair (Branches, Shops, Providers), set `key: "name"` so that native sorting and search operate on the primary name.
3. **Radix `<Select>` Sentinel**: Use literal string `"none"` for optional selects instead of empty string `""`.
4. **No `.forEach()` with `await`**: Always use `for (const item of items)` loop constructs.
5. **Mandatory Company Scope**: Guard all route handlers with `requireUser()` or `requireAdmin()` from `@/lib/session` and scope all queries by `user.companyId`.
6. **Audit All Mutations**: Call `writeAudit()` on every create/update/delete operation with sensitive field redaction.
7. **Mandatory Component Test Verification**: Every new component added to the codebase must be accompanied by a verifying test suite (`*.test.tsx`) asserting proper rendering, user interactions, and DOM state using Vitest, React Testing Library, and jest-dom.
8. **Documentation Updates**: Always update `AI_AGENT_GUIDE.md`, `docs/changelog/yyyy-mm.md`, and `docs/task_logs/yyyy-mm-dd.md` after completing any coding task.
