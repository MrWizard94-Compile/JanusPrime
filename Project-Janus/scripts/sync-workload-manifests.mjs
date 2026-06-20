#!/usr/bin/env node
/**
 * Sync workload manifests from workloads/registry.json into workloads/<id>/manifest.json.
 * Run from JanusPrime root: node Project-Janus/scripts/sync-workload-manifests.mjs
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const janusRoot = join(__dirname, "..", "..");
const registryPath = join(janusRoot, "workloads", "registry.json");
const workloadsDir = join(janusRoot, "workloads");

const registry = JSON.parse(await readFile(registryPath, "utf8"));

for (const entry of registry.workloads) {
  const manifest = {
    id: entry.id,
    description: entry.description,
    repository: entry.repository ?? null,
    branch: entry.branch ?? "main",
    validation_profile: entry.validation_profile,
    clone_path: "repo",
    local_root: entry.local_root ?? null,
  };

  const dir = join(workloadsDir, entry.id);
  await mkdir(dir, { recursive: true });
  const out = join(dir, "manifest.json");
  await writeFile(out, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`wrote ${entry.id}`);
}

console.log(`\n${registry.workloads.length} workload manifests synced.`);