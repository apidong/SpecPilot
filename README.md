# SpecPilot

Platform berbasis web untuk mengelola pengembangan perangkat lunak dengan pendekatan **spec-driven development** — dari requirement hingga kode, terstruktur dan terlacak.

---

## Daftar Isi

- [Arsitektur](#arsitektur)
- [Prasyarat](#prasyarat)
- [Instalasi](#instalasi)
- [Konfigurasi Environment](#konfigurasi-environment)
- [Database](#database)
- [Development](#development)
- [Testing](#testing)
- [Build & Production](#build--production)
- [Struktur Proyek](#struktur-proyek)
- [API Overview](#api-overview)

---

## Arsitektur

```
┌─────────────┐    REST/WS    ┌──────────────────────────────────┐
│  Vue 3 SPA  │◄────────────►│  NestJS API (apps/api)            │
│  (apps/web) │               │  ├─ /api/*      (JWT auth)        │
└─────────────┘               │  ├─ /internal/* (Worker secret)   │
                               │  └─ /executions (Socket.IO)       │
                               └──────────┬───────────────────────┘
                                          │ BullMQ
                               ┌──────────▼───────────────────────┐
                               │  Worker (apps/worker)             │
                               │  ├─ BullMQ consumer (concurrency=1)│
                               │  ├─ Git worktree per execution    │
                               │  └─ Agent spawn + verification    │
                               └──────────────────────────────────┘
                                          │
                               ┌──────────▼───────┐  ┌──────────┐
                               │  MySQL/MariaDB    │  │  Redis   │
                               └──────────────────┘  └──────────┘
```

### Package Monorepo

| Package | Deskripsi |
|---------|-----------|
| `apps/api` | NestJS Backend_API + Internal_API + WebSocket Gateway |
| `apps/worker` | Node.js + BullMQ worker, menjalankan AI agent |
| `apps/web` | Vue 3 + TypeScript + Vite frontend |
| `packages/shared` | Pure TypeScript functions & types (parseTasks, serializeTasks, EARS validator) |

---

## Prasyarat

| Tool | Versi Minimum | Catatan |
|------|--------------|---------|
| Node.js | 20 LTS | Gunakan [nvm](https://github.com/nvm-sh/nvm) atau [fnm](https://github.com/Schniz/fnm) |
| pnpm | 9.x atau 11.x | `npm install -g pnpm` |
| MySQL / MariaDB | MySQL 8+ / MariaDB 10.6+ | Buat database kosong terlebih dahulu |
| Redis | 6+ | Windows: gunakan [Memurai](https://www.memurai.com/) atau Redis via Docker/WSL2 |
| Git | 2.x | Diperlukan untuk worktree management |

---

## Instalasi

### 1. Clone & install dependencies

```bash
git clone https://github.com/apidong/SpecPilot.git
cd SpecPilot
pnpm install
```

### 2. Buat database MySQL

```sql
CREATE DATABASE specpilot_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 3. Konfigurasi environment

```bash
# Windows PowerShell
Copy-Item apps/api/.env.example apps/api/.env

# Linux / macOS
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env` — lihat bagian [Konfigurasi Environment](#konfigurasi-environment).

> **Catatan Worker**: Secara default, worker membaca konfigurasi dari `apps/api/.env` (shared) atau environment system.
> Untuk override, buat `apps/worker/.env` dari template:
> ```bash
> cp apps/worker/.env.example apps/worker/.env
> ```
> Lihat [Konfigurasi Worker](#konfigurasi-worker) untuk detail variable.

### 4. Jalankan migrasi database

```bash
pnpm migration:run
```

Perintah ini membuat semua tabel: users, projects, specs, spec_artifacts, tickets, executions, execution_logs, file_changes, verification_results, audit_logs.

### 5. Jalankan semua service (development)

Buka 3 terminal terpisah:

```bash
# Terminal 1 — API (http://localhost:3000)
pnpm dev:api

# Terminal 2 — Worker
pnpm dev:worker

# Terminal 3 — Frontend (http://localhost:5173)
pnpm dev:web
```

---

## Konfigurasi Environment

### `apps/api/.env`

| Variable | Default | Wajib | Keterangan |
|----------|---------|:-----:|------------|
| `NODE_ENV` | `development` | | `development` atau `production` |
| `PORT` | `3000` | | Port HTTP server |
| `DB_HOST` | `localhost` | ✓ | Host MySQL |
| `DB_PORT` | `3306` | | Port MySQL |
| `DB_USERNAME` | `root` | ✓ | Username MySQL |
| `DB_PASSWORD` | _(kosong)_ | ✓ | Password MySQL |
| `DB_DATABASE` | `specpilot_db` | ✓ | Nama database |
| `DB_SYNCHRONIZE` | `false` | | Jangan `true` di production |
| `DB_LOGGING` | `false` | | Log query SQL ke console |
| `JWT_SECRET` | _(wajib diubah)_ | ✓ | Secret JWT — min 32 karakter random |
| `JWT_EXPIRES_IN` | `24h` | | Masa berlaku token |
| `REDIS_HOST` | `localhost` | ✓ | Host Redis |
| `REDIS_PORT` | `6379` | | Port Redis |
| `REDIS_PASSWORD` | _(kosong)_ | | Password Redis (jika ada) |
| `WORKER_SECRET` | _(wajib diubah)_ | ✓ | Secret autentikasi Worker ke Internal API |
| `WORKSPACE_ROOT` | `./storage/app/workspaces` | | Root path git worktrees |
| `CORS_ORIGIN` | `http://localhost:5173` | | Origin yang diizinkan CORS |
| `LLM_DEFAULT_PROVIDER` | `openai_compatible` | | Provider LLM default |
| `LLM_DEFAULT_BASE_URL` | `https://api.openai.com/v1` | | Base URL API LLM |
| `LLM_DEFAULT_API_KEY` | _(kosong)_ | ✓ | API key LLM |

> **Keamanan**: Ganti `JWT_SECRET` dan `WORKER_SECRET` dengan nilai acak yang kuat.
>
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

### `apps/worker/.env` (Opsional)

Worker secara default membaca konfigurasi dari `apps/api/.env`. Buat `apps/worker/.env` hanya jika perlu override nilai tertentu.

| Variable | Default | Wajib | Keterangan |
|----------|---------|:-----:|------------|
| `WORKER_SECRET` | _(dari api/.env)_ | ✓ | Harus sama dengan `WORKER_SECRET` di API |
| `REDIS_HOST` | `localhost` | | Host Redis |
| `REDIS_PORT` | `6379` | | Port Redis |
| `REDIS_PASSWORD` | _(kosong)_ | | Password Redis (jika ada) |
| `INTERNAL_API_URL` | `http://localhost:3000` | | URL callback ke API (Internal API) |
| `WORKSPACE_ROOT` | `./storage/app/workspaces` | | Root path git worktrees — harus sama dengan API |

> **Penting**: `WORKER_SECRET` di worker **harus sama** dengan di API untuk autentikasi berhasil.

---

## Database

### Migrasi

```bash
# Jalankan semua migrasi yang belum diterapkan
pnpm migration:run

# Rollback migrasi terakhir
pnpm migration:revert

# Generate file migrasi baru dari perubahan entity TypeORM
pnpm migration:generate
```

### Skema Tabel

| Tabel | Deskripsi |
|-------|-----------|
| `users` | Akun pengguna |
| `agents` | Konfigurasi AI agent (command, args, API key) |
| `projects` | Proyek software yang dikelola |
| `specs` | Spesifikasi per proyek |
| `spec_artifacts` | Versi artifact (requirements/design/tasks) — **append-only, tidak pernah di-UPDATE** |
| `tickets` | Tiket pekerjaan per spec |
| `executions` | Riwayat eksekusi agent per tiket |
| `execution_logs` | Log streaming dari agent |
| `file_changes` | File yang diubah agent per eksekusi |
| `verification_results` | Hasil test/lint pasca eksekusi |
| `audit_logs` | Log audit aksi pengguna |

---

## Development

### Perintah utama

```bash
pnpm dev:api      # NestJS API dengan hot reload — http://localhost:3000
pnpm dev:worker   # BullMQ Worker dengan tsx watch
pnpm dev:web      # Vite dev server — http://localhost:5173
```

### Lint & Typecheck

```bash
pnpm lint        # ESLint semua package
pnpm typecheck   # TypeScript check semua package

# Per package
pnpm --filter=@specpilot/api run lint
pnpm --filter=@specpilot/api run typecheck
pnpm --filter=@specpilot/web run lint
pnpm --filter=@specpilot/web run typecheck
```

### Swagger API Docs

Saat `NODE_ENV=development`, Swagger UI tersedia di:

```
http://localhost:3000/api/docs
```

---

## Testing

```bash
# Semua package sekaligus
pnpm test

# Per package
pnpm --filter=@specpilot/shared run test    # Vitest — pure functions
pnpm --filter=@specpilot/api run test       # Jest — NestJS services
pnpm --filter=@specpilot/worker run test    # Vitest — worker utils
pnpm --filter=@specpilot/web run test       # Vitest — Vue components

# Watch mode
pnpm --filter=@specpilot/web run test:watch
pnpm --filter=@specpilot/worker run test:watch
```

Total tests saat ini: **45 tests** (17 API + 16 shared + 10 worker + 2 web).

---

## Build & Production

### Build semua package

```bash
pnpm build
```

### Jalankan production

**API:**

```bash
pnpm --filter=@specpilot/api run start    # node dist/main (port 3000)
```

**Frontend** — deploy static files via nginx/caddy:

```bash
pnpm --filter=@specpilot/web run build    # output: apps/web/dist/
pnpm --filter=@specpilot/web run preview  # preview build lokal
```

**Worker** — wajib menggunakan PM2 dengan `instances: 1`:

```bash
pnpm --filter=@specpilot/worker run build
pm2 start apps/worker/dist/main.js --name specpilot-worker --instances 1
pm2 save
```

**Windows Service via PM2:**

```powershell
npm install -g pm2-windows-service
pm2-service-install
```

> Worker **harus** berjalan single-instance untuk menjaga invarian satu eksekusi aktif per proyek.

---

## Struktur Proyek

```
SpecPilot/
├── apps/
│   ├── api/                         # NestJS API
│   │   └── src/
│   │       ├── app.module.ts
│   │       ├── common/
│   │       │   ├── decorators/      # @CurrentUser, @Public
│   │       │   ├── filters/         # AllExceptionsFilter
│   │       │   ├── guards/          # JwtAuthGuard, WorkerSecretGuard
│   │       │   ├── interceptors/    # RedactSensitiveInterceptor
│   │       │   └── redis/           # RedisModule (InjectRedis)
│   │       ├── database/
│   │       │   ├── config/          # TypeORM config factory
│   │       │   ├── entities/        # TypeORM entities
│   │       │   └── migrations/      # TypeORM migration files
│   │       └── modules/
│   │           ├── auth/            # Register, Login, Logout + JWT strategy
│   │           ├── agents/          # AI agent CRUD
│   │           ├── projects/        # Project CRUD
│   │           ├── specs/           # Spec + artifact versioning + LLM generate
│   │           ├── tickets/         # Ticket CRUD + concurrent execution guard
│   │           ├── executions/      # Execution status, logs, file changes
│   │           ├── internal/        # /internal/* endpoints (worker callbacks)
│   │           └── websocket/       # Socket.IO gateway (/executions namespace)
│   │
│   ├── worker/                      # BullMQ Worker
│   │   └── src/
│   │       ├── config/              # Env config
│   │       ├── queue/               # consumer.ts — job processor
│   │       └── utils/               # git worktree, agent spawn, verification
│   │
│   └── web/                         # Vue 3 SPA
│       └── src/
│           ├── components/          # Vue components
│           ├── stores/              # Pinia stores (auth, executions, ...)
│           └── views/               # Page components
│
└── packages/
    └── shared/                      # Shared TypeScript library
        └── src/
            ├── tasks/               # parseTasks, serializeTasks
            ├── validators/          # EARS requirement validator
            └── types/               # Task, Execution, SpecArtifact interfaces
```

---

## API Overview

Semua endpoint `/api/*` memerlukan header `Authorization: Bearer <token>`.
Endpoint `/internal/*` memerlukan header `X-Worker-Secret: <WORKER_SECRET>`.

| Method | Path | Keterangan |
|--------|------|------------|
| POST | `/api/auth/register` | Registrasi pengguna |
| POST | `/api/auth/login` | Login — mendapatkan JWT |
| POST | `/api/auth/logout` | Revoke token (masuk Redis denylist) |
| GET | `/api/projects` | Daftar proyek milik user |
| POST | `/api/projects` | Buat proyek baru |
| GET | `/api/projects/:id/specs` | Daftar spec dalam proyek |
| POST | `/api/projects/:id/specs` | Buat spec baru |
| PUT | `/api/specs/:id/artifacts/:type` | Update artifact (requirements/design/tasks) |
| POST | `/api/specs/:id/generate-requirements` | Generate requirements via LLM |
| POST | `/api/specs/:id/generate-design` | Generate design via LLM |
| POST | `/api/specs/:id/generate-tasks` | Generate tasks via LLM |
| GET | `/api/specs/:id/artifacts/:type/versions` | Riwayat versi artifact |
| POST | `/api/specs/:id/artifacts/:type/versions/:v/restore` | Restore ke versi tertentu |
| GET | `/api/tickets` | Daftar tiket |
| POST | `/api/tickets` | Buat tiket baru |
| POST | `/api/tickets/:id/enqueue` | Enqueue eksekusi agent (202/409/503) |
| GET | `/api/executions/:id/logs` | Log eksekusi (paginated) |
| GET | `/api/executions/:id/changes` | File changes dari eksekusi |
| POST | `/api/executions/:id/stop` | Stop eksekusi yang sedang berjalan |

### WebSocket — Realtime Logs

Connect ke namespace `/executions` dengan JWT di auth handshake:

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/executions', {
  transports: ['websocket'],
  auth: { token: '<JWT_TOKEN>' },
});

socket.on('connect', () => {
  socket.emit('subscribe', { executionId: 42 });
});

socket.on('log', (log) => {
  console.log(log.level, log.message);
});
```
