import { chmod, cp, mkdir, readdir, realpath, rm, stat, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

const root = process.cwd();
const standaloneDir = join(root, ".next", "standalone");
const staticDir = join(root, ".next", "static");
const publicDir = join(root, "public");
const resourceDir = join(root, "src-tauri", "resources", "desktop-server");
const nodeResourceDir = join(root, "src-tauri", "resources", "node");

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function copyRequiredDir(from: string, to: string, label: string) {
  if (!(await exists(from))) {
    throw new Error(`Missing ${label} at ${from}. Run the Next standalone build first.`);
  }
  await cp(from, to, { recursive: true });
}

async function copyNodeRuntime() {
  const nodePath = await realpath(process.execPath);
  if (!(await exists(nodePath))) {
    throw new Error(`Could not find the build Node runtime at ${nodePath}.`);
  }
  const binName = process.platform === "win32" ? "node.exe" : "node";
  const binDir = join(nodeResourceDir, "bin");
  const target = join(binDir, binName);
  await rm(nodeResourceDir, { recursive: true, force: true });
  await mkdir(binDir, { recursive: true });
  await cp(nodePath, target, { dereference: true });
  if (process.platform !== "win32") await chmod(target, 0o755);
  await writeFile(
    join(nodeResourceDir, "runtime.json"),
    JSON.stringify({
      copiedFrom: nodePath,
      sourceName: basename(nodePath),
      platform: process.platform,
      arch: process.arch,
      version: process.version,
      bin: `bin/${binName}`,
    }, null, 2),
  );
}

async function pruneHostedOnlyPackages() {
  const packages = [
    "googleapis",
    "google-auth-library",
    "googleapis-common",
    "gaxios",
    "gcp-metadata",
    "gtoken",
    "google-logging-utils",
    "bignumber.js",
    "json-bigint",
    "jwa",
    "jws",
    "ecdsa-sig-formatter",
    "url-template",
  ];
  for (const name of packages) {
    await rm(join(resourceDir, "node_modules", name), { recursive: true, force: true });
  }
}

await rm(resourceDir, { recursive: true, force: true });
await mkdir(resourceDir, { recursive: true });

await copyRequiredDir(standaloneDir, resourceDir, "Next standalone server");
await copyRequiredDir(staticDir, join(resourceDir, ".next", "static"), "Next static assets");
await copyRequiredDir(publicDir, join(resourceDir, "public"), "public assets");
await pruneHostedOnlyPackages();

for (const name of await readdir(resourceDir)) {
  if (name === ".env" || name.startsWith(".env.")) {
    await rm(join(resourceDir, name), { recursive: true, force: true });
  }
}

await copyNodeRuntime();

console.log(`Prepared Tauri desktop server resources at ${resourceDir}`);
console.log(`Prepared bundled Node runtime at ${nodeResourceDir}`);
