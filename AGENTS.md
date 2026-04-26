# AGENTS.md

## Project purpose
This repository is for building and operating the **LLM Startup** application and its supporting services. The code should prioritize reliability, clear architecture, and fast iteration for product features.

## Folder conventions
- Keep production application code under `src/` (or existing app module roots).
- Keep tests under `tests/` or alongside source files when the framework prefers co-located tests.
- Keep scripts/automation under `scripts/`.
- Keep static/public assets under `public/` or framework-standard static directories.
- Keep docs and runbooks under `docs/`.
- Avoid adding one-off files in the repository root unless they are standard project files.

## Naming conventions
- Use descriptive, intent-revealing names.
- Prefer `kebab-case` for file names unless the framework requires otherwise.
- Prefer `camelCase` for JavaScript/TypeScript variables and functions.
- Prefer `PascalCase` for classes, React components, and type/interface names.
- Prefer `UPPER_SNAKE_CASE` for constants that are truly constant and environment variable names.

## How API providers are called
- Access external AI/API providers only through a dedicated provider abstraction layer (for example, client modules/services), not directly from UI handlers.
- Centralize provider configuration (model names, base URLs, retries, and timeouts).
- Add sane timeouts, retries with backoff, and structured error handling for all provider calls.
- Log provider failures with enough context for debugging, but never log secrets or sensitive user data.

## How environment variables are handled
- Read environment variables only through a single configuration module.
- Validate required variables at startup and fail fast with clear error messages.
- Store secrets in environment variables or the deployment platform secret manager; never hardcode them.
- Commit only `.env.example` templates; never commit real `.env` files with secrets.

## Testing commands
Use the commands that match the stack in this repository:
- `npm test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

If the project uses a different package manager/runtime, use the equivalent commands and keep this section updated.

## Deployment target (Render)
- Primary deployment target is **Render**.
- Keep deployment configuration compatible with Render services (web service and background workers if applicable).
- Ensure required env vars are documented for Render environment setup.
- Avoid introducing infrastructure assumptions that only work on other platforms unless explicitly planned.

## Things never to change
- Do not remove or bypass authentication/authorization controls.
- Do not disable security checks, input validation, or rate limiting without explicit approval.
- Do not commit secrets, tokens, or private keys.
- Do not silently change public API contracts without documenting and versioning.
- Do not modify database schema/migrations in destructive ways without a migration and rollback plan.

## Preferred code style
- Prefer small, composable functions with single responsibilities.
- Keep modules focused and avoid large “god files.”
- Use explicit typing where supported (TypeScript types/interfaces, etc.).
- Handle errors explicitly and return actionable messages.
- Write or update tests for behavior changes.
- Keep formatting consistent with project tooling (Prettier/ESLint or language-equivalent formatters/linters).
