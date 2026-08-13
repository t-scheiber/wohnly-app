# macOS App Review notes

Use the text below for the current 1.3.9 marketing-version submission with
replacement build 1.3.12. The normal desktop release remains 1.3.10 in
`tauri.conf.json`; `tauri.appstore.conf.json` overrides the Mac App Store
marketing version and monotonically increasing build number.

## Notes for App Review

This build resolves the Guideline 2.1(a) issue reported on August 10, where
Continue with Apple displayed "Sign-in failed. Please try again."

1. Sign in with Apple is presented through the native macOS
   AuthenticationServices authorization sheet and never opens Safari. After
   Apple returns the credential, the app's native Rust layer exchanges the
   identity token with our authentication server. It verifies the resulting
   session through Better Auth's official bearer-token plugin before returning
   it to the webview. If AuthenticationServices cannot present or complete the
   native sheet, the app retries through ASWebAuthenticationSession, which also
   remains inside the app. The webview uses the same supported bearer bridge
   for all subsequent authenticated requests.
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
| August 6 | 1.3.5 (1.3.8) | Guideline 2.1(a): "session could not be verified" | The native exchange succeeded, but verification still depended on a custom request-header-to-cookie rewrite. Version/build 1.3.9 replaces it with Better Auth's official bearer bridge and verifies the token natively before returning it to the webview. |
| August 10 | 1.3.9 (1.3.9) | Guideline 2.1(a): "Sign-in failed. Please try again." | The native AuthenticationServices invocation could reject with a string before returning a credential. The UI discarded string error details and the macOS path had no in-app fallback. Build 1.3.11 successfully completed Apple authentication during live MacBook testing, but its Settings screen relied on a browser `confirm()` dialog that WKWebView did not present, leaving Sign Out nonfunctional. Replacement build 1.3.12 uses an accessible in-app confirmation and guarantees local session cleanup. |

## Pre-submission checklist

- Keep the rejected App Store marketing version selected and confirm the
  `tauri.appstore.conf.json` build number is newer than every prior upload.
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
