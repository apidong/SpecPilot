# Implementation Plan: SpecPilot Orchestrator

Convert the feature design into a series of prompts for a code-generation LLM that will implement each step with incremental progress. Make sure that each prompt builds on the previous prompts, and ends with wiring things together. There should be no hanging or orphaned code that isn't integrated into a previous step. Focus ONLY on tasks that involve writing, modifying, or testing code.

## Overview

Implementasi MVP SpecPilot adalah monorepo pnpm dengan empat paket: `apps/api` (NestJS Backend_API + Internal_API + WebSocket Gateway), `apps/worker` (Node.js 20 LTS + BullMQ), `apps/web` (Vue 3 + TypeScript + Vite), dan `packages/shared` (TypeScript pure functions: Tasks_Parser, Tasks_Serializer, line-based diff). Tasks disusun supaya layer fondasi (workspace pnpm, NestJS skeleton, TypeORM entity + migration, parser pure-function, redaction layer) terbangun dulu, baru tumpukan domain (versioning, concurrent guard, eksekusi worker, verifikasi, commit) dirakit di atasnya, dan akhirnya UI + cross-platform smoke + E2E menutup alur. Property-based tests (PBT) ditempatkan dekat dengan implementasi yang divalidasi sehingga regresi pada property tertangkap di wave yang sama.

## Tasks

- [ ] 1. Monorepo dan project scaffolding
  - [ ] 1.1 Inisialisasi monorepo pnpm dengan workspace `apps/*` dan `packages/*`
    - Buat `pnpm-workspace.yaml`, root `package.json` (skrip `dev:api`, `dev:worker`, `dev:web`, `build`, `test`, `lint`, `migration:run`, `migration:revert`)
    - Tambahkan `packages/eslint-config` dan `packages/tsconfig` (preset `base`, `node`, `vue`)
    - Konfigurasi `.editorconfig`, `.gitignore`, `.nvmrc` Node 20 LTS, Husky pre-commit `pnpm -r lint`
    - _Requirements: 23.5, 24.1, 24.5_

  - [ ] 1.2 Bootstrap `apps/api` NestJS app dengan TypeORM, Passport JWT, Socket.IO, Pino, Helmet, ValidationPipe global
    - `nest new apps/api --package-manager pnpm`
    - Tambah dependency: `@nestjs/typeorm typeorm pg mariadb`, `@nestjs/passport passport passport-jwt`, `@nestjs/throttler @nest-lab/throttler-storage-redis`, `@nestjs/websockets @nestjs/platform-socket.io @socket.io/redis-adapter`, `nestjs-pino pino-pretty`, `helmet`, `bullmq ioredis`, `class-validator class-transformer`, `undici`, `simple-git`, `bcrypt`
    - `main.ts`: `app.use(helmet())`, `app.enableCors({ origin: FRONTEND_ORIGIN })`, `useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, errorHttpStatusCode: 422 }))`, ganti default Logger dengan Pino
    - _Requirements: 1.10, 2.5, 13.7_

  - [ ] 1.3 Bootstrap `apps/web` Vue 3 + TypeScript + Vite + Pinia + Vue Router + Monaco + xterm.js + Mermaid + Shiki + Socket.IO client
    - `package.json` dependencies dan `vite.config.ts` dengan path alias `@/`
    - `import.meta.glob('./pages/**/*.vue')` dengan filter mengecualikan `spec-graph` dan `hooks` agar tidak masuk bundle
    - CSS variables untuk dark-mode default; `useThemeStore().init()` dipanggil sebelum `app.mount()`
    - _Requirements: 23.1, 23.4, 23.5_

  - [ ] 1.4 Bootstrap `apps/worker` Node.js 20 LTS dengan BullMQ, undici, simple-git, execa, pino, fast-check, Vitest
    - `worker/package.json`, `tsconfig.json`, Vitest config
    - Skeleton `apps/worker/src/index.ts`: BullMQ Worker `new Worker('execution', processor, { connection, concurrency: 1 })` + handler SIGTERM/SIGINT untuk graceful shutdown
    - _Requirements: 11.6, 13.1, 13.2_

  - [ ] 1.5 Bootstrap `packages/shared` TypeScript pure-function library
    - `package.json` dengan `"type": "module"`, ESM exports, Vitest config dengan fast-check
    - Skeleton `src/index.ts` mengekspor placeholder `parseTasks`, `serializeTasks`, `diff`, type `Task`, `ParseError`, `Result`, `DiffLine`, `DiffResult`
    - _Requirements: 8.1, 9.10_

- [ ] 2. Database schema dan TypeORM migrations
  - [ ] 2.1 Definisikan TypeORM entities di `apps/api/src/database/entities/`
    - `User`, `Project` (with `default_agent_id`, `ssh_key_path` `select: false`, index `(user_id, updated_at)`), `Spec`, `SpecArtifact` (declarative partial unique `is_current` untuk PostgreSQL), `Task`, `Ticket`, `Agent`, `Execution` (declarative partial unique active-status untuk PostgreSQL), `ExecutionLog`, `FileChange`, `VerificationResult`, `AuditLog`
    - **Tabel `specs` TIDAK MEMILIKI kolom `spec_type`** (Req 24.5)
    - _Requirements: 1.1, 4.1, 9.3, 11.6, 21.9, 24.3, 24.5_

  - [ ] 2.2 Buat migration `1700000010-spec-artifacts-current-unique` dialect-aware
    - PostgreSQL: `CREATE UNIQUE INDEX ... WHERE is_current = true`
    - MariaDB/MySQL: generated column `current_marker TINYINT(1) AS (CASE WHEN is_current = 1 THEN 1 ELSE NULL END) STORED` + unique key `(spec_id, type, current_marker)`
    - Implementasi `up()` dan `down()` lengkap
    - _Requirements: 9.3_

  - [ ] 2.3 Buat migration dialect-aware untuk `executions` partial unique `is_active`
    - PostgreSQL: declarative `@Index({ where: "status IN (...)" })`
    - MariaDB: generated column `is_active TINYINT(1) AS (CASE WHEN status IN ('Queued',...) THEN 1 ELSE NULL END) STORED` + unique `(project_id, is_active)`
    - _Requirements: 11.6_

  - [ ] 2.4 Buat migration dialect-aware untuk `agents.is_default` partial unique per `user_id`
    - _Requirements: 21.9, 21.10_

  - [ ] 2.5 Cross-platform `WORKSPACE_ROOT` config loader
    - `apps/api/src/config/workspace.config.ts` dan `apps/worker/src/config.ts` (Zod-validated)
    - Default Linux/macOS `/var/lib/specpilot/workspaces`, Windows `C:\specpilot\workspaces`
    - Reserved-filename validator (CON, PRN, AUX, NUL, COM1..9, LPT1..9 case-insensitive) untuk slug/title generator
    - _Requirements: 12.1, 12.4_

- [ ] 3. Cross-cutting redaction dan sanitization
  - [ ] 3.1 Konfigurasi Pino redact paths di `nestjs-pino` dan worker logger
    - Paths: `req.headers["x-worker-secret"]`, `req.headers.authorization`, `req.headers.cookie`, `*.api_key`, `*.config_json.api_key`, `env.WORKER_SECRET`, `env.JWT_SECRET`, `env.DATABASE_URL`; censor `[REDACTED]`
    - _Requirements: 13.9, 21.8_

  - [ ] 3.2 Implementasi `RedactSensitiveInterceptor` global di `apps/api`
    - Intercept response body+header; substring `WORKER_SECRET` dan setiap `agent.config_json.api_key` aktif → `[REDACTED]`
    - Mask struktural `config_json.api_key` (4 char terakhir bila len ≥ 4, sebaliknya semua mask) sebelum response keluar
    - Daftar pola dimuat dari `ConfigService` request-scoped
    - _Requirements: 13.9, 21.6, 21.7, 21.8_

  - [ ] 3.3 Implementasi `GitStderrSanitizer` di `apps/api/src/common/git/` dan `apps/worker/src/utils/`
    - Strip `https://[^:]+:[^@]+@`, `password=...`, `token=...`, dan `project.ssh_key_path` dari pesan error Git
    - Dipakai oleh `AllExceptionsFilter` (api) dan `services/git.ts` (worker)
    - _Requirements: 3.5, 3.8, 20.6_

  - [ ]* 3.4 Write property test for secret redaction
    - **Property 8: Secret Redaction in Logs and Responses**
    - **Validates: Requirements 3.5, 3.8, 13.9, 21.8**

- [ ] 4. Authentication dan rate limiting
  - [ ] 4.1 Implementasi `AuthModule` (login/logout/register) dengan Passport JWT strategy 24 jam
    - bcrypt hash; payload `{ sub, jti: uuidv4(), iat, exp }`; HS256 default
    - Login generic-failure body byte-identical (`{statusCode:401, error:"Unauthorized", message:"Invalid email or password"}`); dummy bcrypt compare bila user tidak ditemukan
    - `RedisDenylistService` untuk logout (`auth:denylist:{jti}` dengan TTL = exp - now)
    - _Requirements: 2.1, 2.2, 2.4_

  - [ ] 4.2 Implementasi `LoginThrottleGuard` extends `ThrottlerGuard`
    - `getTracker()` mengembalikan `req.body.email`; storage `RedisThrottlerStorage`
    - 5 fail/menit → set `auth:login:block:{email}` TTL 5 menit; selama key aktif return 429
    - Dipasang hanya di `AuthController.login()`
    - _Requirements: 2.3_

  - [ ] 4.3 Implementasi `JwtAuthGuard` global (`APP_GUARD`) + `@Public()` decorator
    - Verifikasi token Passport `jwt`; `SISMEMBER auth:denylist`; `@Public()` skip via `Reflector` untuk `login`/`register`
    - 401 untuk Bearer hilang/invalid/expired/denylisted
    - _Requirements: 1.10, 2.5_

  - [ ]* 4.4 Write property test for login generic failure
    - **Property 18: Login Generic-Failure Invariant**
    - **Validates: Requirements 2.2**

  - [ ]* 4.5 Write property test for auth invariant on /api and /internal
    - **Property 12: Authentication Invariant on /api and /internal**
    - **Validates: Requirements 1.10, 2.5, 13.7, 13.8**

- [ ] 5. Tasks Parser, Serializer, dan line-based Diff (packages/shared)
  - [ ] 5.1 Implementasi `parseTasks(markdown)` di `packages/shared/src/parsers/tasks.ts`
    - Grammar EBNF dari design (TaskItem, status, code TSK-NNN, type, priority, dependsOn, acceptance)
    - Normalisasi CRLF/CR → LF dan trim trailing whitespace per baris
    - Return `Result<Task[], ParseError>` dengan `error.line` 1-indexed dan `error.kind` ∈ {Format, MissingField, LengthOutOfRange, InvalidEnum, MissingDependency, DependencyCycle}
    - Validasi DAG (topological cycle detection) dan referential integrity untuk `dependsOn`
    - Kapasitas 0..10000 item, 0..5 MB konten (Req 8.1)
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ] 5.2 Implementasi `serializeTasks(tasks)` di `packages/shared/src/parsers/tasks.ts`
    - Output kanonik: `- [ ]` prefix, indentasi 2 spasi, `Depends on: ` koma-spasi atau `none`, satu newline akhir file
    - Trailing whitespace dihilangkan; tepat satu `\n` antar item dan akhir file
    - Performa ≤ 2 detik untuk 10000 item
    - _Requirements: 8.5, 8.6, 8.7_

  - [ ] 5.3 Implementasi `diff(A, B)` line-based (Hunt–McIlroy / Myers) di `packages/shared/src/diff/line-diff.ts`
    - Return `DiffResult { lines: ({ kind: 'unchanged'|'added'|'removed', text, aLineNo?, bLineNo? })[] }` deterministik
    - `apply(D, A) === B` invariant; performa ≤ 2 detik untuk input 100k karakter
    - _Requirements: 9.10_

  - [ ]* 5.4 Write property test for tasks round-trip bijection
    - **Property 1: Tasks Parser/Serializer Round-trip (Bijection)**
    - **Validates: Requirements 7.4, 8.1, 8.2, 8.5, 8.6, 8.7**

  - [ ]* 5.5 Write property test for tasks parser error diagnosis
    - **Property 2: Tasks Parser Error Diagnosis on Invalid Input**
    - **Validates: Requirements 8.3, 8.4**

  - [ ]* 5.6 Write property test for diff reconstruction
    - **Property 4: Diff Reconstruction**
    - **Validates: Requirements 9.10**

- [ ] 6. Append-only Artifact Versioning
  - [ ] 6.1 Implementasi `ArtifactVersioningService.saveVersion`
    - `dataSource.transaction()` + `setLock('pessimistic_write')` baris `is_current=true`, increment version (`MAX(version)+1`), set `parent_id`, INSERT baru, demote lama
    - Validasi `generated_by ∈ {llm, user}` lempar `BadRequestException`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.7_

  - [ ] 6.2 Implementasi `pruneIfNeeded` LLM-first prune saat total > 50
    - Pass 1: hapus baris `is_current=false` dengan `generated_by='llm'` paling lama (urut `version ASC`)
    - Pass 2: hanya jika total masih > 50, hapus baris user paling lama; tidak pernah hapus `is_current=true`
    - _Requirements: 9.6, 9.12_

  - [ ] 6.3 Implementasi `restore(spec, type, version, userId)` sebagai INSERT baru
    - Byte-for-byte identik konten, `generated_by='user'`, `change_summary="Restored from version {v}"`
    - `NotFoundException` 404 jika versi sumber tidak ada
    - _Requirements: 9.8, 9.9_

  - [ ] 6.4 Implementasi `ArtifactVersionsController` endpoints
    - `GET versions`, `GET versions/{v}`, `POST versions/{v}/restore`, `GET versions/{a}/diff/{b}`
    - 404 jika versi tidak ada; performa diff ≤ 2 detik untuk konten 100k karakter (memakai shared `diff()`)
    - _Requirements: 9.10, 9.11_

  - [ ]* 6.5 Write property test for append-only versioning invariants
    - **Property 3: Append-only Artifact Versioning Invariants**
    - **Validates: Requirements 5.6, 6.3, 7.3, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.12**

- [ ] 7. Project Management dan Repository Connection
  - [ ] 7.1 Implementasi `ProjectsController` CRUD dengan `CreateProjectDto`/`UpdateProjectDto` (class-validator)
    - Validasi name 1-120, description 0-2000, repository_url https/ssh/git@ max 500, default_branch 1-100, default_agent_id optional
    - Hapus cascade Spec → Artifact_Version → Ticket → Execution → ExecutionLog → FileChange → VerificationResult dalam satu `dataSource.transaction()`; rollback bila salah satu gagal
    - Listing `(user_id, updated_at desc)`, paginasi maks 50
    - `ProjectOwnerGuard` untuk endpoint `/api/projects/{project}/*`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [ ] 7.2 Implementasi `ProjectGitLockService` Redis atomic lock
    - `SET nx ex 600` per `project_id`; tolak request kedua dengan `ConflictException` 409
    - _Requirements: 3.7_

  - [ ] 7.3 Implementasi `POST /api/projects/{project}/clone`
    - `simple-git` clone dengan timeout 300s; cleanup direktori partial `repo-main/` bila gagal
    - 409 jika `repo-main/` sudah ada non-kosong; 500 dengan stderr Git tersanitasi
    - _Requirements: 1.8, 1.9, 3.1, 3.2, 3.5, 3.6_

  - [ ] 7.4 Implementasi `POST /api/projects/{project}/sync`
    - `git fetch --all` timeout 120s; 404 jika `repo-main/` belum ada; stderr tersanitasi
    - _Requirements: 3.3, 3.4, 3.5_

  - [ ] 7.5 Implementasi SSH key handling private (`select: false` + NTFS ACL/0600 chmod)
    - `Project.ssh_key_path` tidak pernah dikembalikan ke client; `RedactSensitiveInterceptor` defense kedua
    - Worker memakai `GIT_SSH_COMMAND="ssh -i {ssh_key_path} -o StrictHostKeyChecking=accept-new"`
    - _Requirements: 3.8_

  - [ ]* 7.6 Write property test for cascade delete atomicity
    - **Property 14: Cascade Delete Atomicity**
    - **Validates: Requirements 1.4, 1.5, 4.5**

- [ ] 8. Spec Manager
  - [ ] 8.1 Implementasi `SpecsController` CRUD
    - `CreateSpecDto`/`UpdateSpecDto`: title 1-200, summary 0-2000, status enum {Draft, Ready, In Progress, Verification, Completed, Archived}
    - 422 untuk status invalid; 404/403 via `ProjectOwnerGuard` chain
    - _Requirements: 4.1, 4.2, 4.3, 4.6, 4.7_

  - [ ] 8.2 Implementasi `GET /api/specs/{spec}` mengembalikan tiga active artifacts
    - Tiga `Artifact_Version` dengan `is_current=true` per type ({requirements, design, tasks}) atau null
    - _Requirements: 4.4_

  - [ ] 8.3 Implementasi `DELETE /api/specs/{spec}` transaksi atomik
    - Hapus seluruh Artifact_Version dan Ticket terkait; rollback bila salah satu gagal
    - _Requirements: 4.5_

- [ ] 9. LLM_Service dan generate-artifact endpoints
  - [ ] 9.1 Implementasi `LLMService` di `LlmModule` dengan provider abstraction
    - Provider enum {`openai_compatible`, `omniroute`, `anthropic`, `gemini`, `ollama_local`, `custom_endpoint`}
    - Timeout per metode (60s requirements/tasks, 120s design); validasi response length ≤ 200 000 char
    - _Requirements: 5.1, 5.4, 6.1, 6.5, 7.1, 7.5_

  - [ ] 9.2 Implementasi validators untuk artifact sections + LLM tasks output limit
    - Requirements: 9 heading wajib non-kosong (Req 5.3)
    - Design: 10 heading wajib (Req 6.4)
    - Tasks (LLM output): jalankan `parseTasks()` → cek length ∈ [1, 500] (Req 7.4); selain itu `LLMResponseInvalidException` 502
    - _Requirements: 5.2, 5.3, 6.4, 7.4_

  - [ ] 9.3 Implementasi `POST /api/specs/{spec}/generate-requirements`
    - DTO: prompt 1-10 000 char, 400 untuk prompt invalid (Req 5.5)
    - Save via `ArtifactVersioningService` `generated_by='llm'`; 502 untuk provider error/timeout/format invalid
    - _Requirements: 5.1, 5.2, 5.4, 5.5_

  - [ ] 9.4 Implementasi `POST /api/specs/{spec}/generate-design`
    - 409 jika requirements `is_current=true` belum ada; save sebagai versi baru `is_current=true`
    - _Requirements: 6.1, 6.2, 6.3, 6.5_

  - [ ] 9.5 Implementasi `POST /api/specs/{spec}/generate-tasks`
    - 404/409 sesuai kondisi; jalankan validator Tasks dari Task 9.2
    - _Requirements: 7.1, 7.2, 7.3, 7.5_

  - [ ] 9.6 Implementasi `PUT /api/specs/{spec}` manual edit Artifact (1-200 000 char, `generated_by='user'`)
    - _Requirements: 5.6_

- [ ] 10. Checkpoint - Foundation review
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Agent configuration management
  - [ ] 11.1 Implementasi `AgentsController` CRUD dengan `CreateAgentDto` / `AgentConfigJsonDto`
    - Validasi field wajib (`name`, `type`, `provider`, `model`, `config_json`); 400 untuk missing
    - `provider` enum check (Req 21.3); 400 untuk provider unknown
    - `config_json.timeout_seconds` ∈ [1, 600]; `api_key` non-empty; `allowed_commands` array string
    - Response API key selalu masked oleh `RedactSensitiveInterceptor`
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 21.8_

  - [ ] 11.2 Implementasi `is_default` uniqueness via partial unique constraint + 409 explicit
    - `ConflictException` mendahului DB error; pesan "default agent harus diturunkan terlebih dahulu"
    - _Requirements: 21.9, 21.10_

  - [ ] 11.3 Implementasi propagasi `Project.default_agent_id` → Ticket baru `agent_id`
    - _Requirements: 21.11_

  - [ ] 11.4 Implementasi `AgentApiKeyField.vue` dengan mask formula
    - `len ≥ 4` → `'•'.repeat(len-4) + slice(-4)`; `len < 4` → `'•'.repeat(len)`
    - Field input edit selalu kosong dengan placeholder "Enter to update"; submit kosong = tidak mengubah
    - _Requirements: 21.6, 21.7_

  - [ ]* 11.5 Write property test for API key masking formula
    - **Property 9: API Key Masking Formula**
    - **Validates: Requirements 21.6, 21.7**

  - [ ]* 11.6 Write property test for default agent uniqueness
    - **Property 17: Default Agent Uniqueness**
    - **Validates: Requirements 21.9, 21.10, 21.11**

- [ ] 12. Ticket Management
  - [ ] 12.1 Implementasi `TicketsController` CRUD
    - Create dari `task_id`: copy title (1-200) dan description (0-5000), set `branch_name = "specpilot/ticket-{id}"`, status awal `Backlog`, propagate default agent
    - Update agent_id (404/403 jika agent bukan milik user)
    - List per project paginated 50 sort `updated_at desc`
    - _Requirements: 10.1, 10.2, 10.5, 10.6, 10.7, 21.11_

  - [ ] 12.2 Implementasi Ticket transition matrix validator
    - Tabel transisi eksplisit (Backlog→{Ready, Backlog}, Ready→{Running via /run only, Backlog}, Running→{WaitingReview, Failed, Cancelled}, WaitingReview→{Approved, Rejected}, Approved→{Merged}, Rejected→{Backlog}, Failed→{Backlog}, Cancelled→{Backlog}, Merged→{})
    - 422 `UnprocessableEntityException` untuk transisi invalid
    - _Requirements: 10.3, 10.4_

  - [ ]* 12.3 Write property test for ticket status transition matrix
    - **Property 10: Ticket Status Transition Matrix**
    - **Validates: Requirements 10.3, 10.4, 18.1, 18.2, 18.3, 18.4**

- [ ] 13. Concurrent Execution Guard dan run endpoint
  - [ ] 13.1 Implementasi `ConcurrentExecutionGuardService.tryAcquire`
    - `dataSource.transaction()`: `SET LOCAL lock_timeout='5s'` (Postgres) atau `SET innodb_lock_wait_timeout=5` (MariaDB)
    - `setLock('pessimistic_write')` SELECT active execution; throw `ConflictException` 409 jika ada
    - INSERT execution Queued; push BullMQ `executionQueue.add('execute', { executionId }, { attempts: 2 })` di dalam transaksi (Req 11.3, 11.4)
    - Map `QueryFailedError` `55P03`/`1205` → `LockTimeoutException` 503 (Req 11.8)
    - Kompensasi post-COMMIT failure: `UPDATE executions SET status='Failed', error_message='Enqueue failed'` lalu `BadGatewayException` 502 (Req 11.5)
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.7, 11.8_

  - [ ] 13.2 Implementasi `TicketsController.run()` memakai Guard
    - 202 dengan `execution_id` pada sukses; map exception sesuai filter
    - _Requirements: 11.1, 11.6_

  - [ ]* 13.3 Write property test for concurrent execution guard invariant
    - **Property 5: Concurrent Execution Guard Invariant**
    - **Validates: Requirements 11.1, 11.2, 11.6**

- [ ] 14. Worker core services (cross-platform abstractions)
  - [ ] 14.1 Implementasi `apps/worker/src/utils/paths.ts` dengan `pathsEqual` cross-OS
    - `path.resolve` lalu compare; case-insensitive untuk drive Windows; tolak segmen `..`
    - _Requirements: 12.1, 12.4, 22.6_

  - [ ] 14.2 Implementasi `apps/worker/src/services/process.ts` dengan `killTree(child, { graceMs })`
    - POSIX: `process.kill(-pgid, 'SIGTERM')` lalu `'SIGKILL'` setelah graceMs
    - Windows: `taskkill /T` lalu `taskkill /T /F` setelah graceMs
    - Dipakai `agent.ts` untuk timeout (Req 14) dan stop (Req 15)
    - _Requirements: 14.3, 14.4, 14.5, 15.3, 15.4_

  - [ ] 14.3 Implementasi `apps/worker/src/services/sandbox.ts` allowlist + privilege check + cwd enforce
    - Startup: load allowlist dari config; exit non-zero jika kosong/invalid (Req 22.2)
    - Privilege check: exit jika root (POSIX `process.getuid()===0`) atau Administrators (Windows SID `S-1-5-32-544` via `whoami /groups`)
    - `enforce(cmd)`: basename normalization (Windows lowercase + strip `.exe|.cmd|.bat|.ps1|.com`), POSIX case-sensitive
    - `enforceCwd(c, w)`: descendants only; reject `..`
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5, 22.6_

  - [ ] 14.4 Implementasi `apps/worker/src/services/git.ts`
    - `simple-git` wrapper: `worktreeAdd`/`worktreeRemove` (timeout 60s), `status`, `diff`
    - `gitWorktreeRemoveWithRetry` 3× dengan jeda 500ms (Windows-friendly)
    - Set `core.autocrlf=false`, `core.eol=lf`, `core.fileMode=false` setelah `worktree add`
    - Stderr melewati `GitStderrSanitizer`
    - _Requirements: 12.1, 12.2, 12.5, 12.6, 12.7, 13.4, 13.13_

  - [ ] 14.5 Implementasi `apps/worker/src/services/callback.ts` (undici exponential backoff)
    - Default policy: initialDelay=1000ms, factor=2, maxDelay=60000ms, attempts=5
    - Override policy untuk timeout-status callback: attempts=8 (Req 14.7)
    - Header `X-Worker-Secret` injected; bodyTimeout/headersTimeout 30s
    - _Requirements: 13.12, 14.7, 14.8_

  - [ ] 14.6 Implementasi `apps/worker/src/services/agent.ts` (execa + timeout + signals + log batching)
    - `resolveTimeout(v)`: integer ∈ [1, 7200] atau default 600 dengan warn log
    - `pipeStdoutBatched` interval 500ms / 100 entri / 256 KB cap
    - `execa` dengan `cwd: worktreePath`, `shell: false`, `detached` (POSIX), `windowsHide: true`, `windowsVerbatimArguments: true` untuk `.cmd` shim
    - Subscribe stop signal Redis pub/sub `execution-stop:{id}`
    - _Requirements: 13.3, 14.1, 14.2, 14.6, 15.3, 15.4_

  - [ ]* 14.7 Write property test for worker timeout resolution
    - **Property 16: Worker Timeout Resolution Function**
    - **Validates: Requirements 14.1, 14.2**

  - [ ]* 14.8 Write property test for sandbox allowlist and cwd enforcement
    - **Property 7: Sandbox Allowlist & cwd Enforcement**
    - **Validates: Requirements 22.3, 22.5, 22.6**

  - [ ]* 14.9 Write property test for workspace isolation
    - **Property 6: Workspace Isolation**
    - **Validates: Requirements 12.3, 12.4**

- [ ] 15. Internal API + Worker job lifecycle
  - [ ] 15.1 Implementasi `WorkerSecretGuard` di `InternalModule`
    - `crypto.timingSafeEqual` byte-for-byte (Req 13.7)
    - Reject 401 jika header `Authorization` atau cookie `connect.sid`/`specpilot_session` hadir (Req 13.8)
    - Handler `@Public()` agar global JWT guard di-skip
    - _Requirements: 13.7, 13.8_

  - [ ] 15.2 Implementasi `WorkerExecutionController` di `/internal/executions/{id}`
    - `PATCH` (status enum), `POST /logs` (1-500 entri, validasi level/source/message, transaksi insert all-or-nothing per Req 16.2), `POST /changes` (validasi file_path/change_type/diff ≤ 5MB), `POST /verify-result` (type/status/exit_code/output ≤ 1MiB/duration_ms)
    - DTO class-validator nested
    - _Requirements: 13.1, 13.2, 13.5, 13.6, 16.1, 16.2, 16.6, 17.1, 17.2, 19.2_

  - [ ] 15.3 Implementasi `apps/worker/src/jobs/execute.ts` orchestrator lifecycle
    - PATCH Preparing Workspace → `prepareWorktree` → PATCH Running Agent → spawn Agent → collect changes → run verification → PATCH Waiting Review → cleanup
    - Error path: PATCH Failed dengan `error_message ≤ 2000 char` dan stderr Git tersanitasi
    - BullMQ `attempts: 2` (1 retry, Req 13.10); post-mortem PATCH Failed via 8-attempt callback bila retry habis (Req 13.11)
    - _Requirements: 12.5, 12.6, 12.7, 13.1, 13.2, 13.6, 13.10, 13.11, 13.13_

  - [ ] 15.4 Implementasi stop signal Redis pub/sub channel `execution-stop:{id}`
    - Publisher di `ExecutionsService` saat `POST /api/executions/{execution}/stop`
    - Subscriber di Worker pre-spawn untuk meneruskan ke `agent.run`
    - _Requirements: 15.1, 15.3, 15.4, 15.5_

- [ ] 16. Realtime logs (NestJS Gateway Socket.IO)
  - [ ] 16.1 Konfigurasi `WebsocketModule` `ExecutionsGateway` namespace `/executions` + `@socket.io/redis-adapter`
    - Handler `subscribe` dengan auth JWT (token via `auth` payload Socket.IO); join channel `execution.{id}` setelah authorization check
    - _Requirements: 16.1, 16.3_

  - [ ] 16.2 Implementasi broadcast pada `WorkerExecutionController.pushLogs()` setelah insert batch sukses
    - Broadcast tiap entri dalam batch dalam ≤ 1 detik via `gw.broadcastLog(id, entries)`
    - _Requirements: 16.1_

  - [ ] 16.3 Implementasi `useExecutionStream(executionId)` composable di Frontend
    - Socket.IO client `reconnection: true, reconnectionDelay: 2000, reconnectionAttempts: 5` (Req 16.4)
    - Ring buffer 5000 entri di `useExecutionStore`; indicator status koneksi
    - _Requirements: 16.3, 16.4_

  - [ ] 16.4 Implementasi `GET /api/executions/{execution}/logs` paginated
    - Sort `created_at asc`, default 100, max 500
    - _Requirements: 16.5_

- [ ] 17. Diff Review
  - [ ] 17.1 Implementasi `ExecutionsController.changes()` dan `FileChangesController.update()`
    - `GET /api/executions/{execution}/changes` sort `file_path asc`, max 200/page, 404 jika execution tidak ada
    - `PUT /api/file-changes/{id}` untuk `review_status ∈ {pending, reviewed, approved, rejected}`
    - _Requirements: 17.3, 17.4, 17.7_

  - [ ] 17.2 Implementasi Frontend `DiffReviewPage.vue` + `FileChangeRow.vue` + `DiffPane.vue`
    - Filter `change_type` (added|modified|deleted) kombinasi; pesan kosong bila tidak ada hasil
    - Shiki/Prism syntax highlighting per ekstensi minimal `{.ts,.tsx,.js,.jsx,.vue,.php,.py,.go,.rs,.java,.json,.yaml,.yml,.md,.css,.scss,.html,.sql}`; plain-text fallback
    - Tombol mark `pending|reviewed|approved|rejected` per file → `PUT /api/file-changes/{id}`
    - _Requirements: 17.5, 17.6, 17.7_

  - [ ] 17.3 Wire shared `diff()` dari `packages/shared` ke Frontend `DiffPane`
    - _Requirements: 9.10_

- [ ] 18. Approve, Reject, Ask-Agent-Fix
  - [ ] 18.1 Implementasi `TicketsController.approve()` dan `.reject()`
    - 404 jika ticket tidak ada; 409 jika status bukan `Waiting Review`
    - Catat `approved_by`/`approved_at` atau `rejected_by`/`rejected_at`
    - _Requirements: 18.1, 18.2, 18.3, 18.4_

  - [ ] 18.2 Implementasi cleanup Worktree pada reject (timeout 30s) + retry stale
    - Pertahankan status Rejected; mark stale jika gagal; cron `@nestjs/schedule` harian membersihkan stale worktrees
    - _Requirements: 18.2, 18.7_

  - [ ] 18.3 Implementasi `POST /api/tickets/{ticket}/ask-agent-fix`
    - `AskAgentFixDto`: comments `ArrayMinSize(1) ArrayMaxSize(50)`, per entry `Length(1, 4000)`; `ValidationPipe` `errorHttpStatusCode: 400` (Req 18.6)
    - Buat Execution baru via `ConcurrentExecutionGuardService.tryAcquire`; simpan comments di `executions.ask_agent_fix_comments`
    - _Requirements: 18.5, 18.6_

- [ ] 19. Verification commands
  - [ ] 19.1 Implementasi `apps/worker/src/services/verify.ts` runner
    - Berjalan berurutan untuk type {test, lint, build, static_check, spec_compliance, security_quick_scan}
    - Per-command timeout 1800s; output 1 MiB tail; `duration_ms` direkam
    - Skip mapping: command kosong/null → `status='skipped'`, `exit_code=null`, `output="Skipped: <field>_command is empty"` dalam ≤ 5 detik tanpa spawn (Req 19.4)
    - Allowlist enforcement: command tidak di allowlist → `status='failed'`, `output="Command not allowed by sandbox"`, lanjut command berikutnya (Req 22.3)
    - _Requirements: 19.1, 19.2, 19.4_

  - [ ] 19.2 Wire verify-result callback ke `jobs/execute.ts`
    - Set `executions.verification_failed=true` dan ticket `Waiting Review` di Backend bila ada `failed`/`timeout`
    - _Requirements: 19.3_

  - [ ] 19.3 Implementasi `POST /api/executions/{execution}/verify`
    - 202 untuk re-trigger via Worker; 409 jika sudah berjalan
    - _Requirements: 19.5, 19.6_

  - [ ]* 19.4 Write property test for verification skip mapping
    - **Property 19: Verification Skip-When-Empty Mapping**
    - **Validates: Requirements 19.3, 19.4**

- [ ] 20. Manual stop endpoint
  - [ ] 20.1 Implementasi `ExecutionsController.stop()`
    - 202 untuk active stop; 200 idempotent untuk Cancelled; 409 untuk status terminal lainnya (Completed/Failed/Waiting Review)
    - Publish Redis stop signal; set status Cancelled dalam transaksi
    - _Requirements: 15.1, 15.2, 15.6_

- [ ] 21. Commit Service
  - [ ] 21.1 Implementasi `CommitService.commit(ticket)`
    - `git add` daftar file `review_status='approved'` timeout 60s
    - `git commit` dengan judul Ticket + ref `ticket-{id}` timeout 30s
    - Sanitize stderr via `GitStderrSanitizer`; 422 jika tidak ada approved files
    - Tidak pernah `git push` otomatis (Req 20.5); Worker tidak boleh `git commit`/`git push` (Req 20.7)
    - _Requirements: 20.1, 20.2, 20.3, 20.5, 20.6, 20.7_

  - [ ] 21.2 Implementasi `TicketsController.commit()` endpoint
    - 409 untuk ticket bukan `Approved`; 500 + sanitized stderr untuk error Git (`git reset` cleanup staging area bila perlu)
    - Set status Ticket → `Merged` setelah commit sukses
    - _Requirements: 20.1, 20.2, 20.4, 20.6_

  - [ ]* 21.3 Write unit tests for commit service Git stderr sanitization
    - Fixture: `https://user:token@host/...`, `password=...`, `ssh_key_path` strip
    - _Requirements: 3.5, 20.6_

- [ ] 22. Phase 2 rejection layer
  - [ ] 22.1 Implementasi `Phase2RejectController` catch-all + `Phase2RejectService.audit()`
    - Endpoints: `/api/hooks/*`, `/api/marketplace/*`, `/api/spec-graph/*`, `/api/billing/*`, `/api/workflows/*`, dst
    - Eight hook events ({before|after}_spec_generate, {before|after}_task_execute, {before|after}_commit, verification_failed, ticket_approved) tidak punya listener
    - 410 Gone (atau 404) ≤ 2 detik; satu baris `audit_logs` per request; tanpa state mutation
    - Feature flag `PHASE2_REJECT_DISABLED` (default `false`) untuk integration test future-feature
    - _Requirements: 24.1, 24.2, 24.3, 24.4_

  - [ ] 22.2 Implementasi penolakan Spec Categorization payload (sniffer di middleware/guard)
    - Tolak request dengan `?spec_type=...`, body `{"spec_type"|"category"|"kind": ...}`, atau header `X-Spec-Type` → 410 Gone tanpa membuat Spec
    - Tabel `specs` tanpa kolom `spec_type`; `LLMService` hanya satu set template per Artifact
    - _Requirements: 24.5_

  - [ ]* 22.3 Write property test for Phase 2 rejection invariant
    - **Property 15: Phase 2 Rejection Invariant**
    - **Validates: Requirements 23.5, 23.6, 24.1, 24.2, 24.3, 24.4, 24.5**

- [ ] 23. UI Pages MVP (Vue 3)
  - [ ] 23.1 Implementasi router dengan auth guard + redirect ke `/login`
    - Routes per tabel design; `/spec-graph/*` dan `/hooks/*` TIDAK didefinisikan
    - Route guard `auth` memeriksa `useAuthStore().isAuthenticated`
    - _Requirements: 23.1, 23.2, 23.5, 23.6_

  - [ ] 23.2 Implementasi `AppLayout.vue` (TopBar, SideNav 240px collapsible, ContextPanel 320px collapsible, LogPanel resizable collapsible)
    - _Requirements: 23.3_

  - [ ] 23.3 Implementasi `useThemeStore().init()` dipanggil di `main.ts` sebelum mount untuk dark mode default
    - Preferensi disimpan di `localStorage`; default `dark` jika tidak ada
    - _Requirements: 23.4_

  - [ ] 23.4 Implementasi LoginPage, DashboardPage, ProjectListPage, ProjectDetailPage
    - Login submit memanggil `useAuthStore.login()`; logout mengirim `POST /api/auth/logout`
    - _Requirements: 23.1_

  - [ ] 23.5 Implementasi SpecRequirementsPage, SpecDesignPage, SpecTasksPage dengan Monaco Editor
    - SpecDesignPage mode preview merender block ` ```mermaid ` via `marked` + `mermaid.run({ querySelector: '.mermaid' })`
    - _Requirements: 6.6, 23.1_

  - [ ] 23.6 Implementasi ArtifactVersionHistoryPage (list + diff viewer + restore)
    - Diff viewer memakai shared `diff()` + Shiki highlighting
    - _Requirements: 9.10, 23.1_

  - [ ] 23.7 Implementasi TicketDetailPage dan ExecutionDetailPage (subscribe `useExecutionStream`)
    - _Requirements: 16.3, 23.1_

  - [ ] 23.8 Implementasi AgentSettingsPage, RepositorySettingsPage, UserSettingsPage
    - AgentSettingsPage memakai `AgentApiKeyField.vue` dari Task 11.4
    - _Requirements: 23.1_

  - [ ]* 23.9 Smoke test: dist bundle tidak memuat `spec-graph` atau `hooks` chunk filename
    - Asersi tambahan: tidak ada literal `spec_type|specType|Bugfix workflow|Quick Plan` di compiled bundle
    - _Requirements: 23.5, 24.5_

- [ ] 24. Cross-cutting properties (validation + listing)
  - [ ]* 24.1 Write property test for validation no side effects
    - **Property 11: Validation Failures Have No Side Effects**
    - **Validates: Requirements 1.2, 4.6, 5.5, 11.4, 17.2, 18.6, 21.2, 21.4, 21.5, 24.3**

  - [ ]* 24.2 Write property test for listing endpoint shape
    - **Property 13: Listing Endpoint Shape**
    - **Validates: Requirements 1.7, 10.7, 16.5, 17.3**

- [ ] 25. Cross-platform Windows compatibility
  - [ ] 25.1 Implementasi installer/setup script `scripts/install-worker-service.ps1`
    - NSSM-based default (atau `pm2-windows-service`); verifikasi `LongPathsEnabled=1` dan `git config --system core.longpaths true`
    - Cek `git --version ≥ 2.40`
    - _Requirements: 12.1, 12.4_

  - [ ] 25.2 Implementasi reserved-filename validator hook untuk `Project.slug`, `Spec.slug`, `Ticket.title`
    - Reject CON, PRN, AUX, NUL, COM1..9, LPT1..9 (case-insensitive)
    - _Requirements: 1.2, 4.6_

  - [ ]* 25.3 Smoke test: `killTree` di Windows mengakhiri proses dummy ≤ 2 detik via `taskkill /T /F`
    - Target: `node -e "setInterval(()=>{},1000)"`
    - _Requirements: 14.4, 15.3_

  - [ ]* 25.4 Smoke test: Worker startup sebagai Administrator → exit non-zero (Windows)
    - _Requirements: 22.4_

  - [ ]* 25.5 Smoke test: Worker startup sebagai root → exit non-zero (Linux/macOS)
    - _Requirements: 22.4_

  - [ ]* 25.6 Smoke test: Worker startup dengan empty/invalid allowlist → exit non-zero
    - _Requirements: 22.2_

  - [ ]* 25.7 Smoke test: BullMQ `attempts: 2` (1 retry) terkonfigurasi
    - _Requirements: 13.10_

- [ ] 26. Final integration dan E2E
  - [ ] 26.1 Wire Pinia stores ke seluruh halaman dan composable
    - `useAuthStore`, `useProjectStore`, `useSpecStore`, `useArtifactVersionStore`, `useTicketStore`, `useExecutionStore`, `useAgentStore`, `useThemeStore`
    - _Requirements: 23.1, 23.3_

  - [ ] 26.2 Konfigurasi CI pipeline `.github/workflows/ci.yml`
    - Tahap: Lint (eslint + prettier + vue-tsc) → Unit (parallel: api/web/worker/shared) → PBT (≥100 iter) → Integration (Testcontainers MariaDB+PostgreSQL+Redis, fake LLM via nock) → Smoke (matrix Ubuntu 22.04 / macOS 13 / Windows Server 2022) → Build → E2E
    - Counter-example PBT yang gagal disimpan sebagai regression fixture di `tests/regressions/`
    - _Requirements: NFR (CI matrix di Testing Strategy)_

  - [ ]* 26.3 E2E Cypress test: full happy path
    - Login → create Project → connect repo (mocked) → create Spec → generate requirements/design/tasks (mocked LLM) → create Ticket → run (mocked Agent_CLI) → realtime logs → review diff → approve → commit
    - Plus: unauthenticated `/projects` redirect ke `/login` (Req 23.2); dark-mode no-flash (Req 23.4)
    - _Requirements: 1, 4, 5, 6, 7, 10, 11, 13, 16, 17, 18, 20, 23_

  - [ ]* 26.4 Integration test: Socket.IO broadcast ≤ 1 detik setelah insert
    - Testcontainers Redis + supertest + Socket.IO client
    - _Requirements: 16.1, 16.3_

  - [ ]* 26.5 Integration test: BullMQ retry behavior pada simulated worker crash
    - _Requirements: 13.10, 13.11_

  - [ ]* 26.6 Integration test: 10 paralel `POST /api/tickets/{id}/run` via `Promise.all` → tepat 1 sukses 202, 9 dapat 409/503
    - Verifikasi runtime untuk Property 5
    - _Requirements: 11.1, 11.2, 11.6, 11.8_

- [ ] 27. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks dengan postfix `*` bersifat opsional (PBT, smoke test, integration test, E2E) dan dapat dilewati untuk MVP cepat tanpa memengaruhi fungsionalitas inti.
- Setiap task merujuk requirement spesifik di `requirements.md` untuk traceability.
- 19 property-based tests memetakan satu-satu ke 19 Correctness Properties di `design.md`. Setiap PBT WAJIB ≥ 100 iterasi (`fc.assert(prop, { numRuns: 100 })`) dengan shrinking aktif.
- Stack seragam Node.js + TypeScript: `apps/api` (NestJS + Jest), `apps/worker` (Node + Vitest), `apps/web` (Vue 3 + Vitest), `packages/shared` (TS pure functions + Vitest). PBT memakai `fast-check` di seluruh paket.
- Tasks markdown grammar berada di `packages/shared` agar dipakai bersama Backend_API dan Worker; round-trip property P1 berlaku end-to-end.
- Cross-platform constraints (Linux/macOS/Windows) dibungkus dalam abstraksi `pathsEqual`, `killTree`, dan basename-normalization sandbox; PBT P5/P6/P7/P8 bekerja sama di semua OS karena memanggil abstraksi tersebut.
- TypeORM migrations dialect-aware: PostgreSQL pakai partial unique index native (`@Index({ where })`), MariaDB pakai generated column `STORED` + unique index karena tidak mendukung partial unique.
- Checkpoint ditempatkan setelah blok foundation (task 10) dan di akhir (task 27) untuk validasi inkremental.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "1.5"] },
    { "id": 2, "tasks": ["2.1", "2.5", "3.1", "3.3", "5.1", "5.3", "14.1", "14.2"] },
    { "id": 3, "tasks": ["2.2", "2.3", "2.4", "3.2", "5.2", "5.6", "14.3", "14.4", "14.5"] },
    { "id": 4, "tasks": ["3.4", "4.1", "4.2", "5.4", "5.5", "6.1", "14.6", "15.1"] },
    { "id": 5, "tasks": ["4.3", "6.2", "6.3", "7.1", "7.2", "11.1", "14.7", "14.8", "14.9", "15.2"] },
    { "id": 6, "tasks": ["4.4", "4.5", "6.4", "7.3", "7.4", "7.5", "8.1", "11.2", "11.3", "11.4", "13.1", "15.3", "15.4", "16.1"] },
    { "id": 7, "tasks": ["6.5", "8.2", "8.3", "9.1", "11.5", "12.1", "13.2", "16.2", "16.4", "17.1", "19.1", "20.1", "22.1", "22.2", "25.1", "25.2"] },
    { "id": 8, "tasks": ["7.6", "9.2", "11.6", "12.2", "13.3", "16.3", "17.3", "18.1", "18.3", "19.2", "21.1", "22.3", "25.3", "25.4", "25.5", "25.6", "25.7"] },
    { "id": 9, "tasks": ["9.3", "9.4", "9.5", "9.6", "12.3", "17.2", "18.2", "19.3", "21.2"] },
    { "id": 10, "tasks": ["19.4", "21.3", "23.1", "23.2", "23.3"] },
    { "id": 11, "tasks": ["23.4", "23.5", "23.6", "23.7", "23.8", "24.1", "24.2"] },
    { "id": 12, "tasks": ["23.9", "26.1"] },
    { "id": 13, "tasks": ["26.2", "26.3", "26.4", "26.5", "26.6"] }
  ]
}
```
