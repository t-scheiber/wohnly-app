# Wohnly - Household Manager

Wohnly is a cross-platform household management app for shared living. It helps households coordinate expenses, chores, shopping lists, events, and more — with end-to-end encryption for privacy.

Available on iOS, Android, macOS, Windows, and the web.

## Features

- **Shared Expenses** — Track who paid what and split costs equally, by percentage, or fixed amounts. Balances are calculated automatically.
- **Chore Scheduling** — Assign recurring chores (daily, weekly, biweekly, monthly) to household members.
- **Shopping Lists** — Shared shopping lists with real-time sync across all household members.
- **Calendar** — Household events, chore schedules, and subscription billing dates in one view. Syncs with device calendars.
- **Todos** — Household and personal task lists.
- **Subscriptions** — Track recurring bills and see monthly costs at a glance.
- **Home Screen Widgets** — Todos, Calendar, and Shopping List widgets for iOS, Android, macOS, and Windows.
- **End-to-End Encryption** — Sensitive data is encrypted client-side with libsodium (XChaCha20-Poly1305). Keys are distributed per-device with a multi-device approval flow.
- **42 Languages** — Localized into 42 languages including English, German, French, Spanish, Japanese, Chinese, Hindi, Arabic, and many more.
- **Premium** — Optional ad-free experience via RevenueCat (lifetime purchase).

## Tech Stack

| Layer | Technology |
| --- | --- |
| Backend | [Hono](https://hono.dev) + Node.js + TypeScript |
| Database | PostgreSQL + [Prisma](https://prisma.io) |
| Auth | [Better Auth](https://www.better-auth.com) (email, Google, Apple) |
| Mobile | React Native + [Expo](https://expo.dev) (iOS & Android) |
| Web | Expo web export (static SPA) |
| Desktop | [Tauri](https://tauri.app) (macOS & Windows) |
| Encryption | libsodium (client), AES-256-GCM (server) |
| Payments | RevenueCat + Stripe |
| State | TanStack React Query |
| Validation | Zod (shared between API and clients) |
| i18n | i18next (42 languages) |
| CI/CD | GitHub Actions + EAS Build |

## Project Structure

```text
wohnly-app/
├── apps/
│   ├── api/               # Hono REST API (Node.js)
│   │   ├── src/
│   │   │   ├── routes/    # API endpoints
│   │   │   ├── middleware/ # Auth, validation
│   │   │   └── lib/       # Crypto, email, push notifications
│   │   └── prisma/        # Database schema & migrations
│   ├── mobile/            # Expo app (iOS, Android, Web)
│   │   ├── app/           # File-based routes (Expo Router)
│   │   ├── lib/           # API client, auth, crypto, widgets
│   │   ├── components/    # Shared UI components
│   │   ├── i18n/          # 42 language files
│   │   └── targets/       # iOS widget extension (Swift/WidgetKit)
│   └── desktop/           # Tauri desktop wrapper
│       ├── tauri/         # Rust backend + config
│       └── manifest.json  # PWA manifest (Windows widgets)
├── packages/
│   └── shared/            # Shared Zod schemas, types, utilities
├── deploy/
│   └── Caddyfile.wohnly   # Reverse proxy config
└── .github/workflows/     # CI/CD pipelines
```

This is an npm workspaces monorepo. The `packages/shared` package provides Zod validation schemas and TypeScript types used by both the API and mobile app.

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Xcode 15+ (for iOS development)
- Android Studio (for Android development)
- Rust toolchain (for desktop builds)

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up the Database

Create a PostgreSQL database and configure the connection:

```bash
cp apps/api/.env.example apps/api/.env
# Edit .env with your database URL and secrets
```

Then push the schema:

```bash
cd apps/api
npx prisma generate
npx prisma db push
```

### 3. Start the API

```bash
cd apps/api
npm run dev
```

The API runs at `http://localhost:3001`.

### 4. Start the Mobile App

```bash
cd apps/mobile
npx expo start
```

From there you can open the app in:

- iOS Simulator (press `i`)
- Android Emulator (press `a`)
- Web browser (press `w`)
- Expo Go on a physical device (scan the QR code)

### 5. Build the Desktop App

```bash
cd apps/desktop
npm run tauri dev
```

## Environment Variables

The API requires the following environment variables (see `apps/api/.env.example`):

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Secret for session signing |
| `BETTER_AUTH_URL` | API base URL |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth credentials |
| `APPLE_CLIENT_ID` / `APPLE_CLIENT_SECRET` | Apple Sign-In credentials |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | Email sending (nodemailer) |
| `ENCRYPTION_KEY` | Base64-encoded AES-256 key for server-side encryption |
| `REVENUECAT_WEBHOOK_SECRET` | RevenueCat webhook verification |

## Deployment

### API

Deployed to a VPS via SSH. Managed by PM2.

```text
Trigger: Push to main (apps/api/ or packages/shared/ changes)
Workflow: .github/workflows/deploy-api.yml
```

The API runs behind Caddy as a reverse proxy at `api.wohnly.app`.

### Web

Static export from Expo, deployed to a VPS.

```text
Trigger: Push to main (apps/mobile/ or packages/shared/ changes)
Workflow: .github/workflows/deploy-web.yml
```

Served by Caddy at `wohnly.app`.

### Mobile (iOS & Android)

Built and submitted via [EAS Build](https://docs.expo.dev/build/introduction/).

```text
Trigger: Version change on main or manual dispatch
Workflow: .github/workflows/deploy-mobile.yml
```

- **iOS** — Submitted to the App Store via `eas submit --platform ios`
- **Android** — Submitted to the Google Play `First Test` closed track by default

### Desktop (macOS & Windows)

Built with Tauri. The web frontend is the same Expo web export used for the web app.

```text
Trigger: Push to main or manual dispatch
Workflow: .github/workflows/deploy-desktop.yml
```

- **macOS** — Code-signed, notarized, and submitted to the Mac App Store when the Tauri app version changes
- **Windows** — Built as an MSIX artifact for manual Microsoft Store submission

#### Submitting to the Microsoft Store

GitHub Actions builds `windows-msix` and retains the artifact for 30 days. Download
`Wohnly.msix` from the workflow run and upload it manually through the Microsoft
Partner Center dashboard. Automated Partner Center publication is intentionally
disabled because the Store account is an individual developer account without a
Microsoft Entra tenant/application.

#### macOS Signing Setup (one-time)

The CI workflow signs, notarizes, and (optionally) submits to the Mac App Store. Before it can do that, you need to export your signing certificate and configure GitHub secrets.

**On your Mac:**

1. **Export the signing certificate**
   - Open Keychain Access > My Certificates > `Developer ID Application: ...`
   - Right-click > Export Items > Save as `.p12` with a password

2. **Get your signing identity name**

   ```bash
   security find-identity -v -p codesigning
   ```

   Copy the line that says `Developer ID Application: Your Name (TEAMID)`.

3. **Generate an app-specific password**
   - Go to [appleid.apple.com](https://appleid.apple.com) > Sign-In and Security > App-Specific Passwords
   - Generate one named "Wohnly CI"

**Then add these as GitHub repo secrets:**

| Secret | Value |
| --- | --- |
| `APPLE_CERTIFICATE` | `base64 -i certificate.p12 \| pbcopy` (paste the output) |
| `APPLE_CERTIFICATE_PASSWORD` | The password you set when exporting the `.p12` |
| `KEYCHAIN_PASSWORD` | Any random string, e.g. `wohnly-ci-keychain-2026` |
| `APPLE_SIGNING_IDENTITY` | The identity string from step 2 |
| `APPLE_ID` | Your Apple ID email |
| `APPLE_APP_PASSWORD` | The app-specific password from step 3 |
| `APPLE_TEAM_ID` | Your team ID (the part in parentheses from step 2) |
| `ASC_API_KEY_ID` | `C5QRM2S8XQ` |
| `ASC_API_ISSUER_ID` | `5f00ed40-b6d3-4426-8584-9fcd845087cd` |

Once those secrets are set, the workflow will sign, notarize, and submit to the Mac App Store automatically when you dispatch with `submit: true`.

## Widgets

Home screen widgets are available on all platforms:

| Widget | iOS / macOS | Android | Windows |
| --- | --- | --- | --- |
| Todos | WidgetKit (Swift) | react-native-android-widget | PWA Adaptive Cards |
| Calendar | WidgetKit (Swift) | react-native-android-widget | PWA Adaptive Cards |
| Shopping List | WidgetKit (Swift) | react-native-android-widget | PWA Adaptive Cards |

- **iOS/macOS**: Widgets are built with SwiftUI + WidgetKit. Data is synced from the app via App Group shared storage. The same widget extension serves both iOS and macOS (Apple Silicon).
- **Android**: Widgets use `react-native-android-widget` with data stored in AsyncStorage.
- **Windows**: Widgets are served as Adaptive Cards via the PWA manifest, fetched from the API.

All widgets support localization in all 42 languages. Widget UI strings are synced through the widget bridge when the app's language changes.

## Localization

The app supports 42 languages. Translation files are in `apps/mobile/i18n/`. Each file is a flat JSON structure organized by feature area (common, auth, dashboard, todos, shopping, chores, events, expenses, settings, etc.).

To add a new language:

1. Create a new `{code}.json` file with all keys translated
2. Import it in `apps/mobile/i18n/index.ts`
3. Add the language to the `LANGUAGES` array

## Pending Tasks

- [ ] **macOS signing secrets** — Export certificate and configure GitHub secrets (see [macOS Signing Setup](#macos-signing-setup-one-time) above)
- [ ] **Desktop ads** — Set up Google AdSense or an alternative ad provider for the desktop platform (AdMob is mobile-only, not available in Tauri/web context)
- [ ] **Store screenshots** — Take screenshots and add them to all app store listings:
  - [ ] iOS (iPhone 6.7", 6.5", 5.5")
  - [ ] iPadOS (12.9", 11")
  - [ ] macOS (Mac App Store screenshots)
  - [ ] Android (Google Play — phone + tablet)
  - [ ] Windows (Microsoft Store screenshots)
- [ ] **Submit for review** — Submit builds for store review on all platforms (iOS, iPadOS, macOS, Windows, Android)

## License

Proprietary. All rights reserved.
