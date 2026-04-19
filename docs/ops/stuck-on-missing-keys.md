# Runbook: user stuck on "awaiting_distribution"

## Symptoms
- User reports seeing "Syncing keys…" or blank encrypted content for more than a few minutes.
- `useKeyState` hook on the client returns `awaiting_distribution` at Tier 3 or above.

## Diagnosis
1. Find the user: `ssh vps 'psql $DATABASE_URL -c "SELECT id, email FROM \"User\" WHERE email = '\''<email>'\'';"'`
2. Check their devices and envelopes:

   ```sql
   SELECT d.id AS device_id, d.name, e."keyEpoch", h."keyEpoch" AS current_epoch
   FROM "Device" d
   JOIN "HouseholdMember" hm ON hm."userId" = d."userId"
   JOIN "Household" h ON h.id = hm."householdId"
   LEFT JOIN "HouseholdKeyEnvelope" e ON e."deviceId" = d.id AND e."householdId" = h.id
   WHERE d."userId" = '<user-id>' AND h.id = '<household-id>';
   ```

3. A device row with no envelope at `current_epoch` (NULL `keyEpoch` or the max `keyEpoch` on the device is less than `current_epoch`) is the broken device.

## Resolution
Ask another household member with a device already at the current epoch to open the app. The `useKeyDistribution` hook will detect the gap via `/key-state`, fetch the target device's pubkey via `/devices/:id/public-key`, seal the household key, and upload via `POST /envelopes`.

If that doesn't work within a few minutes, check likely causes:
- **Network or SSE:** the distributor's SSE connection might be dead. Have them force-reopen the app.
- **Client has an outdated household key:** if the distributor was away during a rotation, they'll not hold the current epoch either. They need to fetch their own envelope first.
- **Last resort:** the affected user taps "Re-enroll this device" in the Access screen. This discards their local device keypair, creates a new `AccessRequest`, and waits for another of their own devices to approve via the 6-digit code.

## Logs to check
`ssh vps 'pm2 logs wohnly-api --lines 200 | grep -E "envelope|distribution|access.request"'`

No verification codes or sealed keys are ever logged (enforced by `apps/api/src/lib/redact.ts`). Diagnostic logs key on `householdId`, `requestId`, `userId`.
