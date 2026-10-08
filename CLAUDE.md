# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

NestJS 12 API on Express, TypeORM 1.x with MySQL 8 (`mysql2` driver), zod 4 for env and request validation, `@nestjs/jwt` for auth, `@casl/ability` for authorization, TypeScript 6, Vitest for tests, oxlint for linting, Prettier for formatting.

## Setup

Copy `.env.example` to `.env` before running anything on the host. The defaults there point at the MySQL container from `docker-compose.yml` (host port 3308).

## Commands

```bash
npm run start:dev          # watch mode
npm run build              # nest build -> dist/
npm run lint               # oxlint --type-aware src/ test/
npm run format             # prettier --write on src/ and test/

npm test                   # unit tests (**/*.spec.ts)
npm run test:e2e           # e2e tests (**/*.e2e-spec.ts), separate vitest config
npx vitest run src/health.controller.spec.ts  # single file
npx vitest run -t "test name"               # single test by name

docker compose up          # app (host :3001 -> 3000) + MySQL (host :3308 -> 3306)
```

### Migrations

`synchronize` is off, so every schema change needs a migration. Each migration script except `migration:create` runs `nest build` first and points the TypeORM CLI at the compiled `dist/database/data-source.js`.

```bash
npm run migration:generate -- src/database/migrations/<Name>   # diff entities against the DB
npm run migration:create -- src/database/migrations/<Name>     # empty migration
npm run migration:run
npm run migration:revert
npm run migration:show

npm run db:setup          # run pending migrations -> fail on schema drift -> seed (see below)
```

## Architecture notes

- **ESM project** (`"type": "module"`, `module: nodenext`). Relative imports must use the `.js` extension, even from `.ts` files (e.g. `import { HealthController } from './health.controller.js'`). Top-level `await` is used in `main.ts`.
- **URL prefix.** This is an API-only app: every route is served under `/api` except `GET /health` (public, no prefix). The prefix is configured in `src/app.setup.ts` (`configureApp`), which both `main.ts` and the e2e tests call, so new test apps must call it too. New routes need no extra work; never hard-code `/api` in controllers.
- **Roles and hierarchy.** Five roles with numeric levels (`src/common/enums/role-name.enum.ts`): `super_admin` 100 > `admin` 80 > `manager` 60 > `site_incharge` 40 > `site_technician` 20. A user can only create or manage users with a strictly lower level. Only `super_admin` has `manage all`, so only it can create other super admins or admins. Everyone except `admin` can only manage accounts they themselves created (`createdById`). Any role can read itself.
- **Permissions are data, scoping is code.** `src/database/seeds/role-permissions.ts` is the single source of truth for each role's `(action, subject)` pairs. The seeder syncs them into the `roles`, `permissions` and `role_permissions` tables. `CaslAbilityFactory` (`modules/authorization/`) reads the actor's role permissions and attaches the hierarchy conditions (`role.level`, `createdById`). To change what a role can do, edit `role-permissions.ts` and run `npm run db:setup`. To change the scoping rules, edit the factory. `readableUsersWhere` in the same file is the TypeORM version of the 'read' rule for list queries, so keep the two in sync.
- **Two layers of authorization.** `@CheckAbility('create', 'User')` plus `PoliciesGuard` answer "does this role have the permission at all". Services then check the specific record with `ability.can(action, subject('User', target))`. Out-of-scope records return 404, not 403, so ids are not revealed.
- **Auth.** `JwtAuthGuard` is registered globally (`APP_GUARD` in `AuthModule`), so every route needs a bearer access token unless marked `@Public()`. It loads the user fresh on each request, so role changes apply immediately. Access and refresh tokens use separate secrets and expiries from env. The refresh token is rotated on each use and stored hashed (`users.refreshTokenHash`). Logout clears it. Passwords and refresh tokens are hashed with Node's built-in scrypt (`common/security/secret-hash.ts`). `password` and `refreshTokenHash` are `select: false`, so queries must opt in with `addSelect`. Email verification is stored (`emailVerifiedAt`) but not enforced at login.
- **`npm run db:setup`** (`src/database/setup.ts`): runs pending migrations, then compares the entities with the live schema and exits non-zero (with the SQL that differs) if they don't match, then runs the idempotent seed (permissions and roles synced to the definitions, stale permission rows removed, first super admin created from `SEED_SUPER_ADMIN_*` only if missing). It never auto-generates migrations. After changing an entity, run `migration:generate`, review the file, then `db:setup`.
- **Folder layout** (`src/`):
  - `entities/`: every TypeORM entity, one `<name>.entity.ts` per table, all extending `BaseEntity` (`base.entity.ts`: id and timestamps). Entities are never placed inside feature folders.
  - `modules/<feature>/`: everything a feature needs, kept together: `<feature>.module.ts`, `.controller.ts`, `.service.ts`, `dto/` (zod DTOs via `createZodDto`), and its specs. A feature imports the entities it needs with `TypeOrmModule.forFeature([...])` and is registered in `AppModule`.
  - `common/`: cross-feature code (zod pipe and DTO helper; future guards, filters, decorators). `config/`: validated env. `database/`: data source and `migrations/`.
- **One shared data source config.** `src/database/data-source.ts` exports `dataSourceOptions`, which `TypeOrmModule.forRoot` in `AppModule` uses. Its default export is the `DataSource` that the TypeORM CLI loads. Entities and migrations are found by globs over the **compiled** output: `entities/*.entity.js` and `database/migrations/*.js`, resolved from `import.meta.dirname`. So entity files must be named `*.entity.ts` and live directly in `src/entities/`, and the app has to be built before running the CLI.
- **Env vars are validated at import time** in `src/config/env.ts`. It loads `.env` from the current working directory if the file exists (with `process.loadEnvFile`; variables already in the process environment win), then parses `process.env` with a zod schema. If any required variable is missing or invalid, it throws. There are no fallback defaults. Import `env` from there instead of reading `process.env` directly, and add each new required variable to both the schema and `.env.example`. Inside docker-compose, the app container gets its `DB_*` values from the `environment:` block, which points at the `mysql` service. `PORT` is still read directly in `main.ts` and defaults to 3000.
- **Request validation uses zod, not class-validator.** `ZodValidationPipe` (`src/common/zod/`) is registered globally through `APP_PIPE` in `AppModule`. Build DTOs with `createZodDto(schema)`, e.g. `export class CreateItemDto extends createZodDto(createItemSchema) {}`. The pipe validates any `@Body()`/`@Query()`/`@Param()` whose type carries a static zod `schema`. It returns the parsed output, so coercions and transforms apply. On failure it throws a 400 with `{ message, errors: [{ path, message }] }`. Parameters with other types pass through unchanged.
- **TypeScript**: `strict` is on and `strictPropertyInitialization` is off, so entity and DTO class properties don't need initializers. Vitest globals are enabled (`describe`/`it`/`expect` need no import).
- **Lint**: oxlint treats `typescript/no-floating-promises` as an error, so every promise must be awaited or handled. `any` is allowed. A Claude Code `PostToolUse` hook (`.claude/settings.json` → `.claude/hooks/lint.sh`) runs `oxlint --type-aware` on every `.ts` file under `src/` or `test/` after a Write or Edit. Lint errors come back as blocking feedback, so fix them before moving on.
- **Prettier**: single quotes, trailing commas everywhere.
