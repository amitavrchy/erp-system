# Ledgerflow client

Next.js App Router with TypeScript, Tailwind CSS, Redux Toolkit, React Query, axios, RHF/Zod, Radix dialogs, TanStack Table, Recharts and Framer Motion. See the [root setup guide](../README.md).

- `npm run dev`: development server.
- `npm run build`: production build and route/type validation.
- `npm start`: production server after building.
- `npm run lint` / `npm run typecheck`: static validation.
- `npm run test:e2e`: Playwright browser acceptance tests against running services.

`NEXT_PUBLIC_API_URL` is a build-time public API origin. Secrets never belong in NEXT_PUBLIC variables. The default API origin is `http://localhost:4000`.

Server lists are owned by React Query with organization-scoped keys; Redux holds auth, active organization and UI preferences. Access tokens remain in memory; an HTTP-only refresh cookie restores sessions after reload. Workspace switching clears the query cache. A hydration flag prevents initial rendering from overwriting stored theme and density preferences.

All text is at least 14px. Dialogs trap focus and support Escape, the shell has a skip link, and reduced-motion preferences disable nonessential motion. Cmd/Ctrl-K and `/` open navigation and document search. CSV exports neutralize spreadsheet formula prefixes. Table sorting applies to the currently loaded page; search, status and pagination are server-backed.

The Dockerfile builds a standalone Next server. Build with an API origin reachable by browsers, and deploy behind HTTPS on the same site as the API so strict refresh cookies work.
