#!/usr/bin/env node
/**
 * Dev server launcher — reads PORT/HOSTNAME from .env and passes them to `next dev`.
 *
 * Why this exists: Next.js bootstraps its HTTP server before loading .env,
 * so `PORT` in .env is invisible to `next dev` on its own. This script
 * loads .env manually (zero dependencies) and spawns Next.js with the right flags.
 */
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

function loadDotenv() {
  const envPath = resolve(process.cwd(), ".env");
  try {
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx <= 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  } catch {
    // .env not found — use defaults
  }
}

loadDotenv();

const port = process.env.PORT || "3000";
const hostname = process.env.HOSTNAME || "localhost";

const child = spawn(
  "next",
  ["dev", "-p", port, "-H", hostname],
  { stdio: "inherit", shell: true },
);

process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
child.on("exit", (code) => process.exit(code ?? 1));
