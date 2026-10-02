export function allowedEmail(email: string | null | undefined, allowed: string | undefined): boolean {
  if (!email || !allowed) return false;
  const permitted = allowed.split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
  return permitted.includes(email.trim().toLowerCase());
}
