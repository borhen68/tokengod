import { createClient } from "@libsql/client";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url || !authToken) throw new Error("TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required.");

const client = createClient({ url, authToken });
await client.execute(`create table if not exists schema_migrations (
  name text primary key,
  applied_at integer not null
)`);

const migrationDirectory = resolve("turso/migrations");
const files = (await readdir(migrationDirectory))
  .filter((file) => /^\d+.*\.sql$/.test(file))
  .sort();
let appliedCount = 0;

for (const file of files) {
  const applied = await client.execute({
    sql: "select 1 from schema_migrations where name = ? limit 1",
    args: [file],
  });
  if (applied.rows.length) continue;

  const sql = await readFile(resolve(migrationDirectory, file), "utf8");
  const statements = sql
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean)
    .map((statement) => ({ sql: statement, args: [] }));
  statements.push({
    sql: "insert into schema_migrations (name, applied_at) values (?, ?)",
    args: [file, Date.now()],
  });
  await client.batch(statements, "write");
  appliedCount += 1;
}

client.close();
console.log(`Applied ${appliedCount} new TokenGod migration${appliedCount === 1 ? "" : "s"}.`);
