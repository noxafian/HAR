# Keryvion StudyHub

Keryvion StudyHub is a collaborative GATE preparation workspace for CS and DA, with a shared General Aptitude area. It uses Next.js App Router, React, TypeScript, Supabase Auth/PostgreSQL, and private Cloudflare R2 object storage.

## Local development

1. Install Node.js 22+ and npm.
2. Run `npm ci`.
3. Copy `.env.example` to `.env.local` and configure local Supabase environment values.
4. Start local Supabase: `npm run db:start`.
5. Copy the local API URL, anon key, and service-role key from `npx supabase status -o env` into `.env.local`.
6. Apply migrations and seed local data: `npm run db:reset`.
7. Run the application: `npm run dev`.

See [Phase C setup and verification](docs/phase-c/SETUP_AND_VERIFICATION.md) for the full local database, owner-bootstrap, R2 and verification workflow.

## Available scripts

- `npm run dev` — Next.js development server.
- `npm run build` — production build.
- `npm run lint` — ESLint.
- `npm test` — Vitest suite.
- `npm run db:start` / `npm run db:stop` — local Supabase stack.
- `npm run db:reset` — reset local database, apply migrations and seed.
- `npm run db:test` — run pgTAP database tests.
- `npm run db:status` — show local Supabase status.

## Security notes

- Never expose `SUPABASE_SERVICE_ROLE_KEY`, `ENCRYPTION_MASTER_KEY`, `ADMIN_BOOTSTRAP_SECRET`, or R2 credentials to client-side code.
- `private` schema tables are not exposed by PostgREST; narrowly scoped public RPC wrappers are used where required.
- Exam answers and results are persisted and scored by PostgreSQL, not by browser-side calculations.
- R2 is intended to remain private; the API issues short-lived signed URLs after authorization.
- No fake users, results, discussion posts, provider keys, or mock tests are seeded.

## Current implementation status

This is an implementation handoff, not a production-ready deployment. The working copy contains 15 proposed Supabase migrations, 54 API route handlers, and 4 pgTAP test files with 41 designed assertions. The database, pgTAP suite, full TypeScript check, lint, unit tests, and production build still require local execution.

See [Phase C implementation status](docs/phase-c/IMPLEMENTATION_STATUS.md). This uploaded working copy still requires local database execution, full npm validation, environment configuration, and end-to-end verification before production deployment.
