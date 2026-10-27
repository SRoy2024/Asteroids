import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
process.chdir(root);
const configPath = "wrangler.cloudflare.json";
const config = JSON.parse(readFileSync(configPath, "utf8"));
const [command, databaseId, accountId] = process.argv.slice(2);
const placeholder = "00000000-0000-4000-8000-000000000000";
function validDatabase(id) { return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id) && id !== placeholder; }
function run(script, args) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: root, stdio: "inherit", env: { ...process.env, ASTEROIDS_HOST: "cloudflare" } });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const wrangler = "node_modules/wrangler/bin/wrangler.js";
function build() { run("node_modules/vinext/dist/cli.js", ["build"]); }
if (command === "configure") {
  if (!validDatabase(databaseId)) throw new Error("Pass the D1 database UUID from your Cloudflare account. See docs/DEPLOYMENT.md.");
  if (accountId && !/^[a-f0-9]{32}$/i.test(accountId)) throw new Error("Account ID must contain 32 hexadecimal characters.");
  config.d1_databases[0].database_id = databaseId;
  if (accountId) config.account_id = accountId;
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
  console.log("Cloudflare account configuration saved. IDs are not secrets; never put API tokens in this file.");
} else if (command === "build") {
  build();
} else if (command === "dev") {
  run("node_modules/vinext/dist/cli.js", ["dev", "--port", "5173"]);
} else if (command === "db:local" || command === "db:remote") {
  if (command === "db:remote" && !validDatabase(config.d1_databases[0].database_id)) throw new Error("Configure your own D1 database before applying remote migrations.");
  run(wrangler, ["d1", "migrations", "apply", "DB", command === "db:local" ? "--local" : "--remote", "--config", configPath, ...(command === "db:local" ? ["--persist-to", ".wrangler/state"] : [])]);
} else if (command === "deploy" || command === "dry-run") {
  if (command === "deploy" && !validDatabase(config.d1_databases[0].database_id)) throw new Error("Deployment stopped: configure the D1 database in YOUR Cloudflare account first. Run pnpm cloudflare:configure <database-id> <account-id>.");
  build();
  const built = JSON.parse(readFileSync("dist/server/wrangler.json", "utf8"));
  if (built.name !== config.name || built.d1_databases?.[0]?.database_id !== config.d1_databases[0].database_id || built.services?.length) throw new Error("Unexpected deployment output. Refusing to deploy.");
  run(wrangler, ["deploy", "--config", "dist/server/wrangler.json", ...(command === "dry-run" ? ["--dry-run"] : [])]);
} else {
  throw new Error("Expected configure, build, dev, db:local, db:remote, deploy, or dry-run.");
}
