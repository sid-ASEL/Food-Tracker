import { z } from "zod";
export type GoogleIdentity = { googleId: string; email: string; name: string | null; canClaimLegacy: boolean };
export function googleIdentity(account: { provider?: string; providerAccountId?: string } | null | undefined, profile: Record<string, unknown> | undefined): GoogleIdentity | null {
  if (account?.provider !== "google" || profile?.email_verified !== true || typeof profile.sub !== "string" || !profile.sub.trim() || profile.sub.length > 255 || account.providerAccountId !== profile.sub) return null;
  const email = z.email().safeParse(typeof profile.email === "string" ? profile.email.trim().toLowerCase() : null);
  if (!email.success) return null;
  const domain = email.data.split("@")[1];
  return { googleId: profile.sub, email: email.data, name: typeof profile.name === "string" ? profile.name.slice(0, 255) : null, canClaimLegacy: domain === "gmail.com" || (typeof profile.hd === "string" && profile.hd.toLowerCase() === domain) };
}
