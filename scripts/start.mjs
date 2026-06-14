#!/usr/bin/env node
/**
 * Production server launcher — reads PORT/HOSTNAME from .env and passes them to `next start`.
 *
 * See dev.mjs for the rationale behind this approach.
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
const hostname = process.env.HOSTNAME || "0.0.0.0";

const child = spawn(
  "next",
  ["start", "-p", port, "-H", hostname],
  { stdio: "inherit", shell: true },
);

process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
child.on("exit", (code) => process.exit(code ?? 1));
