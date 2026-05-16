# SpecPilot

SpecPilot adalah platform berbasis web untuk mengelola pengembangan perangkat lunak dengan pendekatan *spec-driven development*.

## Architecture

- `apps/api` — NestJS Backend_API + Internal_API + WebSocket Gateway
- `apps/worker` — Node.js 20 LTS + BullMQ Worker
- `apps/web` — Vue 3 + TypeScript + Vite Frontend
- `packages/shared` — TypeScript pure functions shared library

## Stack

- **Backend**: NestJS 10+ TypeScript, Node.js 20 LTS
- **Frontend**: Vue 3, TypeScript, Vite, Pinia
- **Worker**: Node.js 20 LTS, BullMQ, PM2
- **Database**: MySQL/MariaDB via TypeORM
- **Queue**: Redis + BullMQ
- **Realtime**: Socket.IO + Redis Adapter

## Setup

```bash
# Install dependencies
pnpm install

# Setup environment
cp apps/api/.env.example apps/api/.env
cp apps/worker/.env.example apps/worker/.env

# Run migrations
pnpm migration:run

# Start development
pnpm dev:api
pnpm dev:worker
pnpm dev:web
```

## Development

```bash
# Lint all
pnpm lint

# Typecheck all
pnpm typecheck

# Test all
pnpm test

# Build all
pnpm build
```
