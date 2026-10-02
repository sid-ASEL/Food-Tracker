import type { NextAuthConfig } from "next-auth";
import { googleIdentity, type GoogleIdentity } from "./access";
export function authCallbacks(register: (identity: GoogleIdentity) => Promise<unknown>): NonNullable<NextAuthConfig["callbacks"]> {
  return {
    signIn({ account, profile }) { return googleIdentity(account, profile) !== null; },
    async jwt({ token, account, profile }) {
      if (account) {
        const identity = googleIdentity(account, profile);
        if (!identity) return null;
        await register(identity);
        token.googleId = identity.googleId;
        token.identityVersion = 1;
      }
      // Old sessions and browser-submitted updates cannot establish identity.
      if (token.identityVersion !== 1 || typeof token.googleId !== "string" || !token.googleId) return null;
      return token;
    },
    session({ session, token }) {
      session.googleId = token.identityVersion === 1 && typeof token.googleId === "string" ? token.googleId : undefined;
      return session;
    },
  };
}
