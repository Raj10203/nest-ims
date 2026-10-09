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

### Migrations and seeding

The only npm script is `npm run migration` (runs pending migrations; it does not build first, so `dist/` must be current, and it works inside the production image too). For everything else run the tools directly, usually inside the container (`docker compose exec app <command>`, or `docker compose exec app sh` for a shell). `synchronize` is off, so every schema change needs a migration. The TypeORM CLI needs the compiled data source, so run `npx nest build` first and re-run it after changing entities or migrations.

```bash
npx nest build
npx typeorm migration:generate -d dist/database/data-source.js src/database/migrations/<Name>  # diff entities against the DB (add --check to only detect drift)
npx typeorm migration:create src/database/migrations/<Name>                                      # empty migration
npx typeorm migration:run -d dist/database/data-source.js
npx typeorm migration:revert -d dist/database/data-source.js
npx typeorm migration:show -d dist/database/data-source.js

node dist/cli/cli.js seed              # roles, permissions, first super admin (idempotent); add --dry-run to preview
```

## Architecture notes

- **ESM project** (`"type": "module"`, `module: nodenext`). Relative imports must use the `.js` extension, even from `.ts` files (e.g. `import { HealthController } from './health.controller.js'`). Top-level `await` is used in `main.ts`.
- **URL prefix.** This is an API-only app: every route is served under `/api` except `GET /health` (public, no prefix). The prefix is configured in `src/app.setup.ts` (`configureApp`), which both `main.ts` and the e2e tests call, so new test apps must call it too. New routes need no extra work; never hard-code `/api` in controllers.
- **Roles and hierarchy.** Five roles with numeric levels (`src/common/enums/role-name.enum.ts`): `super_admin` 100 > `admin` 80 > `manager` 60 > `site_incharge` 40 > `site_technician` 20. A user can only create or manage users with a strictly lower level. Only `super_admin` has `manage all`, so only it can create other super admins or admins. Everyone except `admin` can only manage accounts they themselves created (`createdById`). Any role can read itself.
- **Permissions are data, scoping is code.** `src/database/seeds/role-permissions.ts` is the single source of truth for each role's `(action, subject)` pairs. The seeder syncs them into the `roles`, `permissions` and `role_permissions` tables. `CaslAbilityFactory` (`modules/authorization/`) reads the actor's role permissions and attaches the hierarchy conditions (`role.level`, `createdById`). To change what a role can do, edit `role-permissions.ts`, rebuild and run the seed command. To change the scoping rules, edit the factory. `readableUsersWhere` in the same file is the TypeORM version of the 'read' rule for list queries, so keep the two in sync.
- **Two layers of authorization.** `@CheckAbility('create', 'User')` plus `PoliciesGuard` answer "does this role have the permission at all". Services then check the specific record with `ability.can(action, subject('User', target))`. Out-of-scope records return 404, not 403, so ids are not revealed.
- **Auth.** `JwtAuthGuard` is registered globally (`APP_GUARD` in `AuthModule`), so every route needs a bearer access token unless marked `@Public()`. It loads the user fresh on each request, so role changes apply immediately. Access and refresh tokens use separate secrets and expiries from env. The refresh token is rotated on each use and stored hashed (`users.refreshTokenHash`). Logout clears it. Passwords and refresh tokens are hashed with Node's built-in scrypt (`common/security/secret-hash.ts`). `password` and `refreshTokenHash` are `select: false`, so queries must opt in with `addSelect`. Email verification is stored (`emailVerifiedAt`) but not enforced at login.
- **Custom commands** use `nest-commander`. `src/cli/cli.ts` is the CLI entry point (like `main.ts`), `src/cli/cli.module.ts` lists the commands, and each command is a `@Command()` class extending `CommandRunner` in `src/cli/`. Commands get normal dependency injection (e.g. `DataSource`). To add one: write the class and add it to `providers` in `CliModule`. Production runs the compiled file: `node dist/cli/cli.js <command>`. Deployment order: `npx nest build`, `npx typeorm migration:run -d dist/database/data-source.js`, then `node dist/cli/cli.js seed`. The seed logic itself lives in `src/database/seeds/seed.ts`. It never auto-generates migrations: after changing an entity, run `migration:generate`, review the file, then run it.
- **Docker.** `docker-compose.yml` is development only (bind mount, watch mode, MySQL). The `Dockerfile` is production only and copies no `.env`, `node_modules` or `dist` from the host (see `.dockerignore`): dependencies are installed (`npm ci`) and the app is compiled inside the image, in three stages (compile, prod-only `node_modules`, runtime). It runs as the non-root `node` user with `node dist/main.js`, has a `HEALTHCHECK` on `/health`, and relies on `app.enableShutdownHooks()` (in `app.setup.ts`) so `docker stop` is instant (without it a PID 1 Node process ignores SIGTERM and is killed after 10s). All configuration comes from environment variables at run time; with none set the container exits with `Invalid environment variables`. The same image runs the other tasks by overriding the command: `node node_modules/typeorm/cli.js migration:run -d dist/database/data-source.js` and `node dist/cli/cli.js seed`. `typescript` and `prettier` appear in the runtime `node_modules` only because `nest-commander` depends on them.
- **Deployment** is not set up yet; there is no CI/CD configuration in the repo. Only the production `Dockerfile` exists. Migrations must stay backward compatible because an old version keeps serving while the schema changes.
- **Folder layout** (`src/`):
  - `entities/`: every TypeORM entity, one `<name>.entity.ts` per table, all extending `BaseEntity` (`base.entity.ts`: id and timestamps). Entities are never placed inside feature folders.
  - `modules/<feature>/`: everything a feature needs, kept together: `<feature>.module.ts`, `.controller.ts`, `.service.ts`, `dto/` (zod DTOs via `createZodDto`), and its specs. A feature imports the entities it needs with `TypeOrmModule.forFeature([...])` and is registered in `AppModule`.
  - `common/`: cross-feature code (zod pipe and DTO helper; future guards, filters, decorators). `config/`: validated env. `database/`: data source and `migrations/`.
- **One shared data source config.** `src/database/data-source.ts` exports `dataSourceOptions`, which `TypeOrmModule.forRoot` in `AppModule` uses. Its default export is the `DataSource` that the TypeORM CLI loads. Entities and migrations are found by globs over the **compiled** output: `entities/*.entity.js` and `database/migrations/*.js`, resolved from `import.meta.dirname`. So entity files must be named `*.entity.ts` and live directly in `src/entities/`, and the app has to be built before running the CLI.
- **Env vars are validated at import time, split by what needs them** (zod, no fallback defaults; a missing or invalid variable throws and names it). `src/config/parse-env.ts` loads `.env` from the working directory if it exists (variables already in the process environment win) and parses. `db-env.ts` (`DB_*` incl. `DB_SSL`) is used by the data source, so migrations and the seed command need only `DB_*`. `env.ts` adds the `JWT_*` settings and is used by the API only. `seed-env.ts` (`SEED_SUPER_ADMIN_*`) is read lazily, only when no super admin exists yet. Add each new variable to the schema that owns it and to `.env.example`. `DB_SSL=true` turns on TLS for managed databases that require it. Optional `DB_SSL_CA` is the path to a PEM file with the CA certificate(s) used to verify the server (without it, Node's built-in trusted authorities are used).pem`. `PORT` is read directly in `main.ts` and defaults to 3000.
- **Request validation uses zod, not class-validator.** `ZodValidationPipe` (`src/common/zod/`) is registered globally through `APP_PIPE` in `AppModule`. Build DTOs with `createZodDto(schema)`, e.g. `export class CreateItemDto extends createZodDto(createItemSchema) {}`. The pipe validates any `@Body()`/`@Query()`/`@Param()` whose type carries a static zod `schema`. It returns the parsed output, so coercions and transforms apply. On failure it throws a 400 with `{ message, errors: [{ path, message }] }`. Parameters with other types pass through unchanged.
- **TypeScript**: `strict` is on and `strictPropertyInitialization` is off, so entity and DTO class properties don't need initializers. Vitest globals are enabled (`describe`/`it`/`expect` need no import).
- **Lint**: oxlint treats `typescript/no-floating-promises` as an error, so every promise must be awaited or handled. `any` is allowed. A Claude Code `PostToolUse` hook (`.claude/settings.json` → `.claude/hooks/lint.sh`) runs `oxlint --type-aware` on every `.ts` file under `src/` or `test/` after a Write or Edit. Lint errors come back as blocking feedback, so fix them before moving on.
- **Prettier**: single quotes, trailing commas everywhere.
