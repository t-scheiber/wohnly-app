# macOS App Review notes

Use the text below for the next macOS submission after uploading build 1.3.8
or later. Do not reuse build 1.3.7.

## Notes for App Review

This build resolves the Guideline 2.1(a) issue reported on July 30 and August 4,
where Sign in with Apple did not progress beyond the login screen.

1. Sign in with Apple is presented through the native macOS
   AuthenticationServices authorization sheet and never opens Safari. After
   Apple returns the credential, the app's native Rust layer exchanges the
   identity token with our authentication server. The app then verifies the
   resulting session before navigating away from the login screen. A failed
   exchange now displays a visible error instead of appearing not to progress.
2. Google sign-in uses ASWebAuthenticationSession and remains inside the
   system-managed in-app authentication session, as confirmed acceptable in
   App Review's June 28 message.
3. A reviewer can create a new account with Sign in with Apple; no existing
   account or invitation is required. After signing in, choose **Create a new
   household** to exercise the primary features.
4. This is a dedicated Mac App Store build. It does not register the
   direct-download updater and contains no GitHub update endpoint. Updates are
   delivered exclusively through the Mac App Store.
5. Account deletion is available in **More > Settings > Account > Delete
   Account** and completes inside the app.

Suggested review path: Sign in with Apple > Create a new household > add a
shopping item > create a todo > create an event > record an expense > More >
Settings.

## Rejection history and root cause

| Review | Build | Result | What remained wrong |
| --- | --- | --- | --- |
| May 29 | 1.3.3 (1.3.3) | Guideline 4: browser opened for sign-in | Authentication left the app. |
| June 22-23 | 1.3.4 (1.3.4) | Same Guideline 4 rejection | The submitted behavior still did not match the reply claiming a native/system-managed flow. |
| June 28 | 1.3.4 | Apple clarification | Google may use ASWebAuthenticationSession; Apple must complete without leaving the app. |
| July 30 | 1.3.5 (1.3.6) | Guideline 2.1(a): Apple sign-in did not proceed | The native Apple sheet was added, but the webview session exchange was not proven to succeed. |
| August 4 | 1.3.5 (1.3.7) | Same Guideline 2.1(a) rejection | Build 1.3.7 hardened OS detection but did not replace the failing credential-to-session handoff. |

## Pre-submission checklist

- Confirm `bundleVersion` is 1.3.8 or later; do not reuse build 1.3.7.
- Run the desktop deployment workflow and confirm the `macos-mas-app` artifact
  was used by the submission job.
- Confirm the MAS verification step found no external updater URL.
- Install the processed build from TestFlight on a clean macOS user account.
- Revoke Wohnly's prior Apple authorization before testing account creation, so
  the first-authorization name payload and returning-user path are both tested.
- Verify that Apple sign-in reaches the household chooser and remains signed in
  after quitting and reopening the app.
- Verify Google sign-in, household creation, add/edit/delete flows, purchase
  restoration, support/privacy links, and account deletion.
- Replace the existing App Store Connect review notes with the text above.
