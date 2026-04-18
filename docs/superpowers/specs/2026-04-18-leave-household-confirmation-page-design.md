# Leave Household — Email Confirmation Page

**Date:** 2026-04-18
**Status:** Draft — awaiting review

## Background

Leaving a household is destructive: the user loses access to all shared data, and if they are the last member, the household and all its content are deleted (`executeLeaveTransaction` in [apps/api/src/routes/members.ts](../../../apps/api/src/routes/members.ts)). When a user clicks "Confirm & Leave Household" in the confirmation email, the API executes the leave immediately and redirects to `APP_URL/?left=true`. The home page ignores the query param, so the user lands on the dashboard with no feedback and no chance to abort.

## Goals

1. Insert a **confirmation step** between the email click and the destructive action for both leaving and cancelling a leave request.
2. Show a proper **success page** instead of bouncing to home with an unused query param.
3. Preserve the existing email template layout — only the target URLs change.
4. Work for both logged-in and logged-out users (the email might be opened on a different device). The one-time `confirmToken` is the authentication.
5. Full i18n in all 42 existing language files. No hardcoded text.
6. Old emails already in user inboxes must keep working.

## Non-Goals

- Redesigning the email itself (subject, buttons, layout). Out of scope.
- Any changes to the deletion-vote flow (`apps/api/src/routes/deletion.ts`). Unrelated.
- Expiration countdown UI on the confirmation page.

## High-Level Flow

```
┌─────────────┐    email click (GET)    ┌──────────────────────┐
│  Email inbox│──────────────────────▶ │  APP_URL/            │
│ [Confirm &  │                         │  leave-household?    │
│  Leave]     │                         │  token=X&mode=confirm│
└─────────────┘                         └──────────┬───────────┘
                                                   │
                                       fetches /api/members/leave-info
                                                   │
                                                   ▼
                                       ┌──────────────────────┐
                                       │ Intermediate page:   │
                                       │ "Leave {household}?" │
                                       │ [Yes, leave] [Back]  │
                                       └──────────┬───────────┘
                                                   │
                                                   │ (user clicks "Yes, leave")
                                                   ▼
                                       POST /api/members/confirm-leave
                                                   │
                                                   ▼
                                       ┌──────────────────────┐
                                       │ Success page:        │
                                       │ "You've left X"      │
                                       │ [Back to Wohnly]     │
                                       └──────────────────────┘
```

The cancel flow mirrors the same shape with `mode=cancel`, calling `POST /api/members/cancel-leave` on final confirm.

## Components

### 1. API changes ([apps/api/src/routes/members.ts](../../../apps/api/src/routes/members.ts))

**New public endpoints** (registered before `app.use("*", requireAuth)`; already-committed public pattern for the email-click GETs):

- `GET /api/members/leave-info?token=X` →
  ```ts
  // 200
  { householdName: string, expiresAt: string /* ISO */, status: "pending" }
  // 404 / 410 with { error: "invalid_token" | "expired" | "already_confirmed" | "already_cancelled" }
  ```
  Only purpose is to let the frontend render the household name before asking the user to confirm. Does not expose member IDs or anything beyond the household name.

- `POST /api/members/confirm-leave` — currently exists below `requireAuth`, will be **moved above** it. Already validates via `confirmToken` and executes the leave transaction; the `requireAuth` it sits behind is redundant because the token is the auth.

- `POST /api/members/cancel-leave` — new. Body `{ token }`. Mirrors the existing `GET /cancel-leave` logic (marks `cancelledAt`) but returns JSON.

**Legacy GET redirects** — the public GETs committed earlier today stop executing and instead 302 to the new web URL:

```ts
app.get("/confirm-leave", (c) => {
  const token = c.req.query("token");
  const appUrl = process.env.APP_URL || "https://wohnly.app";
  if (!token) return c.redirect(`${appUrl}/leave-household?error=missing_token`);
  return c.redirect(`${appUrl}/leave-household?token=${token}&mode=confirm`);
});

app.get("/cancel-leave", (c) => {
  // mirror, mode=cancel
});
```

This preserves any email already sitting in users' inboxes. Zero breakage window.

### 2. Email template ([apps/api/src/lib/email.ts](../../../apps/api/src/lib/email.ts))

Only the URL construction changes — the HTML template, translations, and subject are untouched.

At the call site (`apps/api/src/routes/members.ts` around line 180 of the current file):

```ts
const appUrl = process.env.APP_URL || "https://wohnly.app";
const confirmUrl = `${appUrl}/leave-household?token=${confirmation.confirmToken}&mode=confirm`;
const cancelUrl = `${appUrl}/leave-household?token=${confirmation.confirmToken}&mode=cancel`;
```

### 3. Frontend page ([apps/mobile/app/leave-household.tsx](../../../apps/mobile/app/leave-household.tsx))

New top-level public page (sibling of `delete-account.tsx`, `privacy-policy.tsx`).

**Query params:** `token` (required), `mode` (`confirm` | `cancel`, required), `error` (optional — set by legacy 302s).

**State machine:**
```
loading  ── /leave-info success ──▶ confirm
loading  ── /leave-info error ────▶ error
confirm  ── user clicks primary ──▶ submitting
submitting ── POST success ───────▶ success
submitting ── POST error ─────────▶ error
```

**UI per state:**
- `loading`: centered spinner.
- `confirm`: household name as interpolated value, warning box (reusing the `leaveHousehold.page.confirmLeave.warning` copy), primary destructive button, secondary "Go back" button that navigates to `/`.
- `submitting`: primary button shows spinner; both buttons disabled.
- `success`: checkmark icon, localized success message, "Back to Wohnly" button → `/`.
- `error`: error icon, mapped localized message, "Back to Wohnly" button.

Reuses existing design tokens, button components, and typography from the broader app. No custom layout primitives.

### 4. i18n

Extend the existing `leaveHousehold` key in all 42 files under a new `page` sub-namespace:

```jsonc
"leaveHousehold": {
  // ...existing keys untouched...
  "page": {
    "title": "…",
    "confirmLeave": {
      "heading": "Leave {{household}}?",
      "body": "…",
      "warning": "…",
      "primary": "Yes, leave household"
    },
    "confirmCancel": {
      "heading": "Cancel your request to leave {{household}}?",
      "body": "…",
      "primary": "Yes, cancel request"
    },
    "secondary": "Go back",
    "success": {
      "leave":  { "heading": "…", "body": "…" },
      "cancel": { "heading": "…", "body": "…" }
    },
    "error": {
      "missingToken":     "…",
      "invalidToken":     "…",
      "expired":          "…",
      "alreadyConfirmed": "…",
      "alreadyCancelled": "…",
      "network":          "…"
    },
    "returnHome": "Back to Wohnly"
  }
}
```

All 42 language files get real translations for these keys, written in the same human tone as the existing keys in each file.

## Data Flow Details

- The `confirmToken` on `LeaveConfirmation` is already opaque and single-use (nulled/invalidated by `executeLeaveTransaction`). No schema changes.
- `GET /leave-info` must never leak sensitive fields. Only `householdName`, `expiresAt`, and a derived `status` string are returned.
- All three new endpoints are rate-limit candidates (token enumeration prevention). The existing middleware stack doesn't rate-limit per-token; we accept that since tokens are 32-byte random values — enumeration is infeasible. Not changing now.

## Error Handling

| API condition                                | `/leave-info` response | Frontend error state  |
|---------------------------------------------|------------------------|-----------------------|
| No token in query                            | —                      | `missingToken`        |
| Token not found                              | `404 invalid_token`    | `invalidToken`        |
| `expiresAt < now`                            | `410 expired`          | `expired`             |
| `confirmedAt != null`                        | `410 already_confirmed`| `alreadyConfirmed`    |
| `cancelledAt != null`                        | `410 already_cancelled`| `alreadyCancelled`    |
| Network failure / 5xx                        | —                      | `network`             |

Final `POST` calls surface the same set (plus `network`) in the same state.

## Testing

No existing test framework in this repo (per `CLAUDE.md`), so testing is manual:

1. Request a leave via the app → verify email lands with URLs pointing at `APP_URL/leave-household?...`.
2. Click confirm button from email → intermediate page renders with correct household name + locale → click "Yes, leave" → success page → navigate home → user is no longer in the household (verify via API).
3. Click cancel button from email → mirror check.
4. Click the same email link a second time → `alreadyConfirmed` or `alreadyCancelled` error state.
5. Manually expire a `LeaveConfirmation` row in Prisma Studio → `expired` error state.
6. Open an old email (sent before this change) → legacy 302 kicks in → same flow.
7. Spot-check DE + one more language (e.g. JA or FR) for correct i18n rendering.

## Rollout

Both `deploy-api` and `deploy-web` trigger in parallel on push to main. To avoid a ~1 minute window where the API redirects to a page that doesn't exist yet:

1. **Commit 1** — frontend-only: add `apps/mobile/app/leave-household.tsx` + all 42 i18n files. Page is inert (no email points at it yet).
2. **Commit 2** — API: new endpoints, legacy redirects, email URL update. Push only after the web deploy from Commit 1 is green.
3. Smoke-test with a throwaway household on production before announcing.

## Risks & Mitigations

- **Risk**: Stale email in someone's inbox hits the API the instant the API deploy lands but before the web deploy lands — user sees a 302 to a page that doesn't exist yet → 404.
  - **Mitigation**: two-commit rollout above.
- **Risk**: Locale detection on the frontend page. The user might not be logged in; we fall back to device/browser language via i18next's detector. Already the pattern for `delete-account.tsx`.
- **Risk**: Translation quality in less-common languages.
  - **Mitigation**: keep strings short and template-friendly (`{{household}}` interpolation is i18next standard).
