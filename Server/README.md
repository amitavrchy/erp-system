# ERP System server

NestJS API for the ERP System. Overview, environment variables, and setup for both apps are in the [repository README](../README.md).

## Scripts

Set `DATABASE_URL` before install and before Prisma commands. `PORT` is optional. `src/main.ts` listens on `PORT`, or on `3000` when `PORT` is unset.

```bash
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

`test:e2e` boots `AppModule`, which connects Prisma, so `DATABASE_URL` must point at a reachable database.
