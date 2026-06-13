/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");

const clientDir = path.join(process.cwd(), "node_modules", ".prisma", "client");
const clientIndexPath = path.join(clientDir, "index.js");

if (!fs.existsSync(clientIndexPath)) {
  fail(
    [
      "Prisma client has not been generated yet.",
      "Run `npm run prisma:generate` before starting the app.",
    ].join("\n"),
  );
}

const clientSource = fs.readFileSync(clientIndexPath, "utf8");

if (!clientSource.includes('"copyEngine": true')) {
  fail(
    [
      "Prisma client was generated without a local query engine (`copyEngine: false`).",
      "That switches the client into Accelerate/Data Proxy mode and breaks this MySQL app.",
      "Run `npm run prisma:generate` and make sure no `--no-engine` flag or Prisma no-engine env var is being used.",
    ].join("\n"),
  );
}

const hasWindowsEngine = fs.existsSync(path.join(clientDir, "query_engine-windows.dll.node"));
const hasNativeLibraryEngine = fs.readdirSync(clientDir).some((fileName) => fileName.startsWith("libquery_engine"));

if (!hasWindowsEngine && !hasNativeLibraryEngine) {
  fail(
    [
      "Prisma client generation completed, but no local query engine binary was found.",
      "Run `npm run prisma:generate` again and verify the install is not forcing a no-engine Prisma client.",
    ].join("\n"),
  );
}

function fail(message) {
  console.error(`\n[prisma:verify-client] ${message}\n`);
  process.exit(1);
}
