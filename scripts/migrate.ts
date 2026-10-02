import nextEnv from "@next/env";
import { Pool } from "pg";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { normalizeConnectionString } from "../src/lib/connection-url";
nextEnv.loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL in .env.local first.");
const pool = new Pool({ connectionString: normalizeConnectionString(process.env.DATABASE_URL) });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(794125)");
  await client.query("CREATE TABLE IF NOT EXISTS food_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())");
  for (const name of (await readdir("migrations")).filter(n => n.endsWith(".sql")).sort()) {
    const contents = await readFile(`migrations/${name}`, "utf8");
    const checksum = createHash("sha256").update(contents).digest("hex");
    const existing = await client.query("SELECT checksum FROM food_migrations WHERE name = $1", [name]);
    if (existing.rows.length) {
      if (existing.rows[0].checksum !== checksum) throw new Error(`Applied migration changed: ${name}`);
      continue;
    }
    await client.query(contents);
    await client.query("INSERT INTO food_migrations(name, checksum) VALUES ($1, $2)", [name, checksum]);
    console.log(`Applied ${name}`);
  }
  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
