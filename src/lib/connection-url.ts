const strictSslAliases = new Set(["prefer", "require", "verify-ca"]);

/** Preserve node-postgres's current strict TLS behavior explicitly across the pg 9 transition. */
export function normalizeConnectionString(connectionString: string): string {
  const url = new URL(connectionString);
  const sslmode = url.searchParams.get("sslmode")?.toLowerCase();
  if (sslmode && strictSslAliases.has(sslmode)) {
    url.searchParams.set("sslmode", "verify-full");
  }
  return url.toString();
}
