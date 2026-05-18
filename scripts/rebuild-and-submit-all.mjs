#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const values = process.argv.slice(2);

function valueAfter(flag, fallback) {
  const index = values.indexOf(flag);
  return index === -1 ? fallback : values[index + 1] ?? fallback;
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    stdio: options.capture ? "pipe" : "inherit",
    shell: false,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    if (options.optional) {
      return null;
    }
    process.exit(result.status ?? 1);
  }

  return options.capture ? result.stdout.trim() : "";
}

const branch = valueAfter("--branch", run("git", ["branch", "--show-current"], { capture: true }));
const requestedProfile = valueAfter("--profile", "production");
if (requestedProfile !== "production") {
  console.warn(`Ignoring --profile ${requestedProfile}; all mobile builds use production.`);
}
const profile = "production";
const submit = args.has("--no-submit") ? "false" : "true";
const allowDirty = args.has("--allow-dirty");

if (!branch) {
  console.error("Could not determine the current git branch. Pass --branch <name>.");
  process.exit(1);
}

const status = run("git", ["status", "--short"], { capture: true });
if (status && !allowDirty) {
  console.error("Working tree has uncommitted changes. Commit and push before dispatching release workflows.");
  console.error("Pass --allow-dirty only if you intentionally want to run the current remote ref.");
  process.exit(1);
}

const upstream = run("git", ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], {
  capture: true,
  optional: true,
});

if (!upstream && !allowDirty) {
  console.error(`Branch "${branch}" has no upstream. Push it before dispatching release workflows.`);
  process.exit(1);
}

if (upstream) {
  const aheadBehind = run("git", ["rev-list", "--left-right", "--count", `${upstream}...HEAD`], {
    capture: true,
  });
  const [, ahead = "0"] = aheadBehind.split(/\s+/);
  if (Number(ahead) > 0 && !allowDirty) {
    console.error(`Branch "${branch}" has ${ahead} unpushed commit(s). Push before dispatching release workflows.`);
    process.exit(1);
  }
}

const workflows = [
  {
    name: "Deploy API",
    file: "deploy-api.yml",
    fields: [],
  },
  {
    name: "Deploy Web",
    file: "deploy-web.yml",
    fields: [],
  },
  {
    name: "Build & Submit Mobile",
    file: "deploy-mobile.yml",
    fields: [`platform=all`, `profile=${profile}`, `submit=${submit}`, "skip_build=false"],
  },
  {
    name: "Build & Deploy Desktop",
    file: "deploy-desktop.yml",
    fields: ["platform=all", `submit=${submit}`],
  },
];

console.log(`Dispatching release workflows on ${branch} with profile "${profile}" (submit=${submit}).`);

for (const workflow of workflows) {
  console.log(`\n> ${workflow.name}`);
  const workflowArgs = ["workflow", "run", workflow.file, "--ref", branch];
  for (const field of workflow.fields) {
    workflowArgs.push("-f", field);
  }
  run("gh", workflowArgs);
}

console.log("\nAll workflows dispatched. Use `gh run list --limit 10` to monitor progress.");
console.log("Note: Windows desktop currently builds an MSIX artifact; Microsoft Store upload is still handled manually in Partner Center.");
