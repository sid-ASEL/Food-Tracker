import { describe, expect, it, vi } from "vitest";
import { encode, getToken } from "next-auth/jwt";
import type { NextAuthConfig } from "next-auth";
import { googleIdentity } from "@/lib/access";
import { authCallbacks } from "@/lib/auth-callbacks";

const account = { provider: "google", providerAccountId: "123456", type: "oidc" as const };
const profile = { sub: "123456", email: "newperson@gmail.com", email_verified: true, name: "New Person" };
type Callbacks = NonNullable<NextAuthConfig["callbacks"]>;
type JwtArgs = Parameters<NonNullable<Callbacks["jwt"]>>[0];
const jwtArgs = (values: Partial<JwtArgs>): JwtArgs => ({ token: {}, user: { id: "123456" }, ...values });

describe("public Google authentication", () => {
  it("accepts verified identities without an email allowlist", () => {
    expect(googleIdentity(account, profile)).toMatchObject({ googleId: "123456", email: profile.email, canClaimLegacy: true });
    expect(googleIdentity(account, { ...profile, email: "person@example.com" })?.canClaimLegacy).toBe(false);
    expect(googleIdentity(account, { ...profile, email: "person@company.com", hd: "company.com" })?.canClaimLegacy).toBe(true);
    expect(googleIdentity(account, { ...profile, email: "person@company.com", hd: "wrong.com" })?.canClaimLegacy).toBe(false);
  });
  it("rejects unverified, missing, mismatched, and non-Google identities", () => {
    for (const bad of [{ ...profile, email_verified: false }, { ...profile, email_verified: "true" }, { ...profile, sub: "" }, { ...profile, sub: "other" }, { ...profile, email: "invalid" }, { ...profile, email: undefined }]) expect(googleIdentity(account, bad)).toBeNull();
    expect(googleIdentity({ ...account, provider: "other" }, profile)).toBeNull();
    expect(googleIdentity(null, profile)).toBeNull();
    expect(googleIdentity(account, undefined)).toBeNull();
  });
  it("registers only a validated sign-in and ignores browser-submitted ownership", async () => {
    const register = vi.fn().mockResolvedValue({});
    const callbacks = authCallbacks(register);
    expect(await callbacks.signIn!({ user: {}, account, profile })).toBe(true);
    const token = await callbacks.jwt!(jwtArgs({ account, profile }));
    expect(token).toMatchObject({ googleId: "123456", identityVersion: 1 });
    expect(register).toHaveBeenCalledOnce();
    const updated = await callbacks.jwt!(jwtArgs({ token: token!, trigger: "update", session: { googleId: "victim", owner: "victim@gmail.com" } }));
    expect(updated?.googleId).toBe("123456");
    expect(register).toHaveBeenCalledOnce();
    await expect(callbacks.jwt!(jwtArgs({ account, profile: { ...profile, email_verified: false } }))).resolves.toBeNull();
  });
  it("rejects old sessions and failed account creation", async () => {
    const callbacks = authCallbacks(vi.fn().mockRejectedValue(new Error("Database unavailable")));
    await expect(callbacks.jwt!(jwtArgs({ token: { sub: "123456", email: profile.email } }))).resolves.toBeNull();
    await expect(callbacks.jwt!(jwtArgs({ token: {}, trigger: "update", session: { googleId: "123456", identityVersion: 1 } }))).resolves.toBeNull();
    await expect(callbacks.jwt!(jwtArgs({ account, profile }))).rejects.toThrow("Database unavailable");
  });
  it("Auth.js rejects absent, forged, and expired session cookies", async () => {
    const secret = "test-secret-for-mealbook-auth-only", salt = "authjs.session-token";
    const read = (value?: string) => getToken({ req: new Request("http://localhost", { headers: value ? { cookie: `${salt}=${value}` } : {} }), secret, salt, cookieName: salt });
    expect(await read()).toBeNull();
    expect(await read("forged.payload.signature")).toBeNull();
    const expired = await encode({ secret, salt, maxAge: -120, token: { googleId: "123456", identityVersion: 1 } });
    expect(await read(expired)).toBeNull();
    const valid = await encode({ secret, salt, token: { googleId: "123456", identityVersion: 1 } });
    expect(await read(valid)).toMatchObject({ googleId: "123456" });
  });
});
