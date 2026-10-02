import "server-only";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { normalizeConnectionString } from "@/lib/connection-url";
const globalDb = globalThis as unknown as { foodPool?: Pool };
export function getDb() {
  if (!process.env.DATABASE_URL) throw new Error("Database setup is incomplete.");
  const pool = globalDb.foodPool ??= new Pool({ connectionString: normalizeConnectionString(process.env.DATABASE_URL), max: 3, idleTimeoutMillis: 10000, connectionTimeoutMillis: 10000 });
  return drizzle(pool, { schema });
}
