# Runbook: rotation stuck at PENDING

## Symptoms
- `EpochRotation.status = 'PENDING'` for more than 10 minutes.
- Household members can't encrypt new content at the new epoch (the `Household.keyEpoch` has not been bumped yet).

## Diagnosis

```sql
SELECT * FROM "EpochRotation"
WHERE "householdId" = '<household-id>'
ORDER BY "createdAt" DESC LIMIT 5;
```

Look at the `createdAt` and `status`. A PENDING row older than 10 minutes is stuck.

Possible causes:
1. The client that received the `household.key.rotation.requested` SSE crashed or went offline before running `POST /epochs/commit`.
2. All remaining devices are currently offline.
3. The commit request raced and lost (`409 Epoch already committed` but in that case some row should be `COMMITTED`, not `PENDING` — if not, something weirder is going on).

## Resolution

**First try:** ask any approved member with a current-epoch key to open the app. The `household.key.rotation.requested` SSE event re-fires on reconnect via the client's catch-up `/access/requests` + `/key-state` refetch, and `useKeyDistribution` will retry the commit.

**If that fails:** mark the rotation FAILED so a new trigger can replace it:

```sql
UPDATE "EpochRotation" SET status = 'FAILED'
WHERE "householdId" = '<household-id>' AND status = 'PENDING';
```

Then trigger a manual rotation from the Access screen (owner only), which creates a new `EpochRotation` with `toEpoch = fromEpoch + 1`. The `@@unique([householdId, toEpoch])` constraint prevents replay; since the old row is now FAILED (not PENDING), the new one can be created cleanly.

## Logs to check

`ssh vps 'pm2 logs wohnly-api --lines 200 | grep -E "rotation|epoch"'`

If you see the `household.key.rotation.requested` event firing but no `household.key.rotated` follow-up, it confirms no client picked up the work.
