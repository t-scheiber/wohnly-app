#!/usr/bin/env node
// One-shot batch: ensure every locale file has the `access` and `forceUpdate`
// namespaces (using the English copies as fallback), and strip the stale
// `devices` namespace + obsolete help.* keys left over from the pre-redesign
// flow. Run once, then delete or keep under scripts/ for reference.
//
// Usage (from repo root):
//   node scripts/i18n-access-batch.js
const fs = require("node:fs");
const path = require("node:path");

const I18N_DIR = path.join(__dirname, "..", "apps", "mobile", "i18n");
const en = JSON.parse(fs.readFileSync(path.join(I18N_DIR, "en.json"), "utf8"));
const STALE_HELP_KEYS = [
  "invitingMembers",
  "invitingMembersDesc",
  "shareCode",
  "shareLink",
  "encryption",
  "encryptionDesc",
  "e2ee",
  "deviceApproval",
  "devicePendingBanner",
  "deviceApprovedBanner",
  "missingKeysBanner",
  "checkStatus",
  "checkAndKeys",
  "pendingDeviceCount",
  "approveNow",
  "enableNotificationsBanner",
  "waitingForApproval",
  "waitingForApprovalDescription",
];

const files = fs
  .readdirSync(I18N_DIR)
  .filter((f) => f.endsWith(".json") && f !== "en.json" && f !== "de.json");

let changed = 0;
for (const file of files) {
  const fullPath = path.join(I18N_DIR, file);
  const data = JSON.parse(fs.readFileSync(fullPath, "utf8"));

  // Drop the legacy devices namespace.
  if ("devices" in data && typeof data.devices === "object") {
    delete data.devices;
  }

  // Prune stale help.* keys.
  if (data.help && typeof data.help === "object") {
    for (const k of STALE_HELP_KEYS) {
      delete data.help[k];
    }
  }

  // Add access + forceUpdate namespaces if missing. Use English as fallback.
  if (!data.access) data.access = en.access;
  if (!data.forceUpdate) data.forceUpdate = en.forceUpdate;

  fs.writeFileSync(fullPath, JSON.stringify(data, null, 2) + "\n");
  changed++;
}

console.log(`Updated ${changed} locale files.`);
