# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Wohnly is a cross-platform household management app (expenses, chores, shopping lists, calendar, todos, subscriptions) with end-to-end encryption and 42-language localization.

## Monorepo Structure

npm workspaces monorepo with three apps and one shared package:

- **apps/api/** — Hono REST API + Prisma ORM + Better Auth + Node.js (port 3001)
- **apps/mobile/** — React Native + Expo 54 + Expo Router v6 (iOS, Android, Web)
- **apps/desktop/** — Tauri wrapper that serves the Expo web export as a desktop app (macOS, Windows)
- **packages/shared/** — Zod validation schemas and TypeScript types shared between API and mobile

## Common Commands

```bash
# Development
npm run dev:api            # Start API with tsx watch (auto-reload)
npm run dev:mobile         # Start Expo dev server (mobile + web)

# Database (all proxy to apps/api)
npm run db:generate        # Generate Prisma client
npm run db:migrate         # Run pending migrations (prisma migrate deploy)
npm run db:push            # Push schema changes (prisma db push)
npx prisma studio          # Visual DB editor (run from apps/api/)

# Linting (no test framework configured)
npm run lint               # ESLint across all workspaces

# Building
npm run build:api          # TypeScript compile API to dist/
npx expo export --platform web  # Build web export (run from apps/mobile/)

# Mobile builds (EAS)
eas build --profile preview --platform ios
eas build --profile production --platform android

# Desktop (Tauri)
npx tauri build            # Run from apps/desktop/
```

## Architecture

### API (apps/api/)
- **Framework:** Hono with typed middleware (`AppEnv` context carries `session`, `userId`, `user`)
- **Auth:** Better Auth handles `/api/auth/**` routes (email, Google, Apple OAuth)
- **Routes:** `src/routes/` — modular route files (households, todos, chores, expenses, etc.)
- **Middleware:** `src/middleware/auth.ts` (session validation), `src/middleware/validation.ts` (Zod body validation)
- **Services:** `src/lib/` — crypto (AES-256-GCM), push notifications (Expo SDK), email (Nodemailer), expense/finance calculations
- **Database:** PostgreSQL with Prisma; schema at `prisma/schema.prisma`

### Mobile (apps/mobile/)
- **Routing:** Expo Router v6 file-based routing in `app/` directory. Tabs: Dashboard, Lists, Chores, Finances, More
- **State:** TanStack React Query for server state; Better Auth `authClient.useSession()` for auth
- **API Client:** `lib/api/client.ts` — thin fetch wrapper (`api()`, `apiPost()`, `apiPatch()`, `apiDelete()`) with auto cookie/auth injection
- **Query Hooks:** `lib/api/queries.ts` — React Query hooks for all entities
- **E2E Encryption:** `lib/crypto/` — libsodium XChaCha20-Poly1305 for client-side encryption
  - `keys.ts` — X25519 device key pairs, household symmetric keys
  - `encrypt-service.ts` — entity-specific encrypt/decrypt
  - `device-storage.ts` — secure key storage
  - Multi-device key distribution with approval flow via `useKeyDistribution()` hook
- **Custom Hooks:** `lib/hooks/` — `useHousehold()`, `useHouseholdKey()`, `usePremium()`, `useCalendarData()`, etc.
- **Widgets:** `lib/widgets/widget-bridge.ts` — cross-platform widget data sync (iOS WidgetKit, Android react-native-android-widget, Windows PWA Adaptive Cards)
- **i18n:** i18next with 42 language JSON files in `i18n/` directory; flat key structure by feature area

### Desktop (apps/desktop/)
- Tauri (Rust) wraps the Expo web export from `apps/mobile/dist/`
- Dev mode proxies to `http://localhost:8081` (Expo web dev server)
- PWA manifest and service worker for Windows widget support

### Shared Package (packages/shared/)
- Zod schemas in `src/validations/` — imported by both API (server validation) and mobile (form validation)
- TypeScript types in `src/types/` — shared entity interfaces
- Utilities in `src/utils/` — currency, dates, chore scheduling, split calculations

## Key Conventions

- **ESM:** All packages use `"type": "module"`
- **TypeScript strict mode** across all workspaces
- **Path aliases:** API uses `@/*` → `./src/*`; both API and mobile use `@wohnly/shared` → `packages/shared/src`
- **Encrypted fields:** Entities that support E2EE have optional `nonce` + `cipher` fields; decryption happens in React Query transformations
- **Platform detection:** `Platform` from react-native for runtime checks; platform-specific files use `.ios.tsx`/`.android.tsx` suffixes

## Deployment

- **API:** VPS via SSH, PM2 process manager, Caddy reverse proxy at `api.wohnly.app`
- **Web:** Static Expo export on VPS, Caddy at `wohnly.app`
- **Mobile:** EAS Build → App Store (iOS) / Google Play (Android)
- **Desktop:** Tauri builds, macOS code-signed/notarized, Windows .msi/.exe
- **CI/CD:** GitHub Actions workflows in `.github/workflows/` (deploy-api, deploy-web, deploy-mobile, deploy-desktop)
