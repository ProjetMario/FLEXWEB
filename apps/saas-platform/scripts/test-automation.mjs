import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";
const cwd = dirname(dirname(fileURLToPath(import.meta.url)));
const folder = mkdtempSync(join(tmpdir(), "flexweb-tests-"));
const listener = net.createServer();
await new Promise((resolve) => listener.listen(0, "127.0.0.1", resolve));
const port = listener.address().port;
await new Promise((resolve) => listener.close(resolve));
const env = {
  ...process.env,
  DATABASE_PROVIDER: "postgres",
  DATABASE_URL: `postgresql://flexweb_test@127.0.0.1:${port}/postgres`,
  AUTH_SECRET: "local-test-secret-do-not-use-in-production",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_ROOT_DOMAIN: "localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "local-test",
  SUPABASE_SERVICE_ROLE_KEY: "local-test",
  EMAIL_FROM: "no-reply@example.com",
  AUTOMATION_SHARED_SECRET: "a".repeat(64),
  AUTOMATION_EMAILS_ENABLED: "false",
  AUTOMATION_PAYMENTS_ENABLED: "false",
  BREVO_API_KEY: "",
  STRIPE_SECRET_KEY: "",
  STRIPE_WEBHOOK_SECRET: "",
  AUTOMATION_TEST_DATABASE: "true",
  OUTREACH_SEND_ENABLED: "false",
  IONOS_MAIL_PASSWORD: "",
};
const run = (cmd, args, stdio = "pipe") =>
  execFileSync(cmd, args, { cwd, env, stdio });
let started = false;
try {
  run("initdb", [
    "-D",
    join(folder, "db"),
    "-A",
    "trust",
    "-U",
    "flexweb_test",
    "--no-locale",
    "-E",
    "UTF8",
  ]);
  run("pg_ctl", [
    "-D",
    join(folder, "db"),
    "-l",
    join(folder, "postgres.log"),
    "-o",
    `-p ${port} -h 127.0.0.1`,
    "start",
  ]);
  started = true;
  const migrations=join(cwd,"netlify/database/migrations");
  for(const name of readdirSync(migrations).sort())run("psql",[env.DATABASE_URL,"-X","-v","ON_ERROR_STOP=1","-f",join(migrations,name,"migration.sql")]);
  if(process.argv[2]!=="crm"){
    run("npx", ["tsx", "--test", "tests/automation.test.ts"], "inherit");
    run("npx", ["tsx", "--test", "tests/outreach.test.ts"], "inherit");
    run("npx", ["tsx", "--test", "tests/sms.test.ts"], "inherit");
  }
  run("npx", ["tsx", "--test", "tests/crm.test.ts"], "inherit");
} catch (e) {
  console.error(e.stderr?.toString() || e.message);
  process.exitCode = 1;
} finally {
  if (started) run("pg_ctl", ["-D", join(folder, "db"), "-m", "fast", "stop"]);
  rmSync(folder, { recursive: true, force: true });
}
