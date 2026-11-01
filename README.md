# ERP System

TypeScript workspace for an ERP: a Next.js client and a NestJS API on PostgreSQL.

## Overview

The repository is two applications that share no root workspace file. `Client` is the web app. `Server` is the HTTP API and owns the database tooling.

The client is a Next.js App Router project. `src/app/layout.tsx` loads Geist and Geist Mono, and `src/app/page.tsx` is the home route. Global styles come from Tailwind CSS in `src/app/globals.css`. `next.config.ts` turns on cache components and partial prefetching.

The API is a NestJS application that runs as ES modules. `AppModule` imports a global `ConfigModule` and a global `PrismaModule`. `PrismaService` extends `PrismaClient`, connects in `onModuleInit`, and disconnects in `onModuleDestroy`. `GET /` is handled by `AppController`, which returns the string from `AppService`. The Prisma schema targets PostgreSQL through `DATABASE_URL` and does not declare models yet.

PostgreSQL 16 is defined in `Server/docker-compose.yml`. `Server/Dockerfile` builds the API on Node 22, generates the Prisma client, and starts `dist/main`.

## Key features

- Next.js App Router client with TypeScript, Tailwind CSS, and the Geist font family
- NestJS API with a root `GET` handler, covered by a Vitest unit test and an end-to-end test
- Global configuration through `@nestjs/config`
- Prisma client connected for the life of the Nest process
- PostgreSQL 16 Compose service named `erp-system-db`, using database `erp_system`
- API image that installs dependencies, runs `prisma generate`, and serves the compiled build
- ESLint on the client and oxlint on the server

## Tech stack

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![React](https://img.shields.io/badge/React-19-149ECA)
![TypeScript](https://img.shields.io/badge/TypeScript-5%2F6-3178C6)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38BDF8)
![NestJS](https://img.shields.io/badge/NestJS-12-E0234E)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1)
![Docker](https://img.shields.io/badge/Docker-Node%2022-2496ED)

| App | In use | Also declared in `package.json` |
| --- | --- | --- |
| Client | Next.js 16, React 19, TypeScript 5, Tailwind CSS 4 | Redux Toolkit, TanStack Query, TanStack Table, axios, React Hook Form, Zod, Radix UI, Recharts, Framer Motion, date-fns, react-day-picker, Sonner, clsx, tailwind-merge |
| Server | NestJS 12, Prisma 6, PostgreSQL 16, TypeScript 6, Vitest | JWT, Passport, bcrypt, class-validator, class-transformer, Swagger |

## Project structure

```text
.
├── Client
│   ├── public                 static assets
│   ├── src/app                App Router layout, home page, global styles
│   ├── eslint.config.mjs
│   ├── next.config.ts
│   ├── package.json
│   └── tsconfig.json
└── Server
    ├── prisma                 Prisma schema (PostgreSQL, DATABASE_URL)
    ├── src                    Nest module, root controller, Prisma module
    ├── test                   end-to-end test for GET /
    ├── docker-compose.yml     PostgreSQL 16
    ├── Dockerfile             API image
    ├── nest-cli.json
    ├── package.json
    ├── prisma.config.ts
    └── tsconfig.json
```

## Getting started

### Prerequisites

- Node.js 22 (the version in `Server/Dockerfile`)
- npm
- Docker, for the Postgres service under `Server`

### Environment

Create a gitignored `.env` file in `Server`. `@nestjs/config` and the Prisma config both read it.

| Variable | Role |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string. Required by `prisma/schema.prisma` and `prisma.config.ts`. Match `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` in `Server/docker-compose.yml`. Compose publishes port `5432`. |
| `PORT` | Optional. `Server/src/main.ts` listens on `PORT` and falls back to `3000` when it is unset. The client `dev` and `start` scripts also honor `PORT`. |

The API and the client both fall back to port `3000`. Set `PORT` on one of them when you run both at the same time.

Export `DATABASE_URL` before `npm install` in `Server`. The postinstall script loads `prisma.config.ts`, which requires that variable.

### Client

```bash
cd Client
npm install
npm run dev
```

```bash
npm run build
npm run start
npm run lint
```

`npm run build` typechecks the app and writes the production output. `npm run lint` runs ESLint.

### Server

```bash
cd Server
npm install
npx prisma generate
docker compose up -d
npm run start:dev
```

```bash
npm run build
npm run start:prod
npm run lint
npm test
npm run test:e2e
```

`npm run build` compiles with the Nest CLI. `npm run lint` runs oxlint on `src` and `test`. `npm test` runs unit tests. `npm run test:e2e` boots `AppModule`, which connects Prisma, so `DATABASE_URL` must point at a database the process can reach.

## Author

[Amitav Roy Chowdhury](https://github.com/amitavrchy)
