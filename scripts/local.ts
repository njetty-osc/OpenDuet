import { randomBytes } from "node:crypto";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const platform = join(root, "openbot");
const state = join(platform, ".local");
const logs = join(platform, ".logs");
mkdirSync(state, { recursive: true });
mkdirSync(logs, { recursive: true });
const envFile = join(platform, ".env");
const pgBin =
  process.env.OPENBOT_POSTGRES_BIN ??
  (process.platform === "darwin" ? "/opt/homebrew/opt/postgresql@17/bin" : "");
const pg = (name: string) => (pgBin ? join(pgBin, name) : name);
const bun = process.execPath;
const names = ["app", "worker", "server"] as const;
const pidFile = (name: string) => join(logs, `local-${name}.pid`);
async function command(
  args: string[],
  cwd = root,
  env?: Record<string, string | undefined>,
) {
  const code = await Bun.spawn(args, {
    cwd,
    env,
    stdout: "inherit",
    stderr: "inherit",
  }).exited;
  if (code) throw new Error(`${args[0]} exited with ${code}.`);
}

if (process.argv.includes("--stop")) {
  for (const name of names) {
    if (!existsSync(pidFile(name))) continue;
    const pid = Number(readFileSync(pidFile(name), "utf8").trim());
    const probe = Bun.spawn(["ps", "-p", String(pid), "-o", "command="], {
      stdout: "pipe",
    });
    const text = await new Response(probe.stdout).text();
    // PID files may survive a reboot. Never signal an unrelated process.
    if (text.includes(platform) && Number.isInteger(pid) && pid > 1) {
      try {
        process.kill(pid, "SIGTERM");
      } catch {}
    }
  }
  const data = join(state, "postgres");
  if (existsSync(join(data, "postmaster.pid")))
    await command([pg("pg_ctl"), "-D", data, "stop", "-m", "fast"]);
  console.info("Local OpenDuet stopped; conversations and files are retained.");
  process.exit(0);
}

if (!existsSync(envFile)) {
  const text = readFileSync(join(root, ".env.example"), "utf8")
    .replace(
      /^DATABASE_URL=.*$/m,
      "DATABASE_URL=postgres://openbot@127.0.0.1:55432/openbot",
    )
    .replace(
      /^KEY_ENCRYPTION_KEY=.*$/m,
      `KEY_ENCRYPTION_KEY=${randomBytes(32).toString("base64")}`,
    )
    .replace(/^AGENT_COMPUTER_URL=.*$/m, "AGENT_COMPUTER_URL=")
    .replace(/^COMPUTER_SUPERVISOR_URL=.*$/m, "COMPUTER_SUPERVISOR_URL=")
    .replace(
      /^WORKER_SHARED_SECRET=.*$/m,
      `WORKER_SHARED_SECRET=${randomBytes(32).toString("hex")}`,
    );
  writeFileSync(envFile, text, { mode: 0o600 });
}
if (!existsSync(join(root, ".env")))
  symlinkSync("openbot/.env", join(root, ".env"));
// Let Bun parse quoted .env values, exactly as it does for the server.
const reader = Bun.spawn(
  [
    bun,
    `--env-file=${envFile}`,
    "-e",
    "process.stdout.write(JSON.stringify(process.env))",
  ],
  { cwd: state, stdout: "pipe", stderr: "inherit" },
);
const environment: Record<string, string | undefined> = JSON.parse(
  await new Response(reader.stdout).text(),
);
if (await reader.exited)
  throw new Error("Could not read the local environment.");
environment.OPENBOT_AGENT_MODE ||= "acp";
environment.OPENBOT_CONVERSATION_STORE = "local";
environment.OPENBOT_HOST = "127.0.0.1";
environment.DO_NOT_TRACK = "1";
environment.COPILOTKIT_TELEMETRY_DISABLED = "true";
const serverPort = environment.SERVER_PORT || environment.PORT || "3001";
const appPort = environment.APP_PORT || "3010";
environment.PORT = environment.SERVER_PORT = serverPort;
environment.APP_PORT = appPort;
environment.SERVER_INTERNAL_URL = `http://127.0.0.1:${serverPort}`;
environment.WORKER_SHARED_SECRET ||= randomBytes(32).toString("hex");
const databaseUrl = new URL(environment.DATABASE_URL ?? "");
if (databaseUrl.hostname === "127.0.0.1" && databaseUrl.port === "55432") {
  if (pgBin && !existsSync(pg("initdb")))
    throw new Error(
      "Install PostgreSQL and pgvector: brew install postgresql@17 pgvector.",
    );
  const data = join(state, "postgres");
  if (!existsSync(join(data, "PG_VERSION")))
    await command([
      pg("initdb"),
      "-D",
      data,
      "-U",
      "openbot",
      "--auth=trust",
      "--encoding=UTF8",
      "--locale=C",
    ]);
  if (!existsSync(join(data, "postmaster.pid")))
    await command([
      pg("pg_ctl"),
      "-D",
      data,
      "-l",
      join(logs, "postgres.log"),
      "-o",
      `-h 127.0.0.1 -p 55432 -k ${state}`,
      "start",
      "-w",
    ]);
  const check = Bun.spawn(
    [
      pg("psql"),
      "-h",
      "127.0.0.1",
      "-p",
      "55432",
      "-U",
      "openbot",
      "-d",
      "postgres",
      "-tAc",
      "SELECT 1 FROM pg_database WHERE datname='openbot'",
    ],
    { stdout: "pipe", stderr: "inherit" },
  );
  const found = (await new Response(check.stdout).text()).trim();
  if (await check.exited)
    throw new Error("Local PostgreSQL could not be reached.");
  if (!found)
    await command([
      pg("createdb"),
      "-h",
      "127.0.0.1",
      "-p",
      "55432",
      "-U",
      "openbot",
      "openbot",
    ]);
}
for (const port of [serverPort, appPort]) {
  try {
    const socket = Bun.serve({
      hostname: "127.0.0.1",
      port: Number(port),
      fetch: () => new Response(),
    });
    socket.stop(true);
  } catch {
    throw new Error(
      `Port ${port} is already in use. Stop the existing process first.`,
    );
  }
}
await command(
  [bun, join(platform, "server/scripts/migrate.ts")],
  join(platform, "server"),
  environment,
);
await command(
  [bun, join(platform, "scripts/generate-app-config.ts")],
  platform,
  environment,
);
const children: ReturnType<typeof Bun.spawn>[] = [];
let ending = false;
async function shutdown() {
  if (ending) return;
  ending = true;
  for (const child of children) child.kill("SIGTERM");
  await Promise.allSettled(children.map((child) => child.exited));
}
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    void shutdown().then(() => process.exit(0));
  });
function launch(name: (typeof names)[number], args: string[], cwd: string) {
  const log = openSync(join(logs, `${name}.log`), "w", 0o600);
  const child = Bun.spawn(args, {
    cwd,
    env: environment,
    stdout: log,
    stderr: log,
  });
  closeSync(log);
  children.push(child);
  writeFileSync(pidFile(name), `${child.pid}\n`);
}
try {
  launch(
    "server",
    [bun, join(platform, "server/src/index.ts")],
    join(platform, "server"),
  );
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      if (
        (await fetch(`http://127.0.0.1:${serverPort}/api/copilotkit/info`)).ok
      )
        break;
    } catch {}
    if (attempt === 79)
      throw new Error(
        `Server did not become ready. Read ${join(logs, "server.log")}.`,
      );
    await Bun.sleep(250);
  }
  launch(
    "worker",
    [bun, join(platform, "worker/src/index.ts")],
    join(platform, "worker"),
  );
  launch(
    "app",
    [
      bun,
      "--bun",
      join(platform, "app/node_modules/vite/bin/vite.js"),
      "--host",
      "127.0.0.1",
      "--port",
      appPort,
      "--strictPort",
    ],
    join(platform, "app"),
  );
  console.info(
    `OpenDuet: http://127.0.0.1:${appPort} · local storage · ${environment.OPENBOT_ACP_PROVIDER || "codex"} ACP`,
  );
  console.info(`Logs: ${logs}. Stop with Ctrl-C or bash scripts/stop.sh.`);
  await Promise.race(
    children.map(async (child) => {
      const code = await child.exited;
      if (!ending)
        throw new Error(
          `OpenDuet process ${child.pid} exited (${code}). Check ${logs}.`,
        );
    }),
  );
} finally {
  await shutdown();
}
