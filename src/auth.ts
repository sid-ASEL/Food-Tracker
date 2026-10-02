import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { authCallbacks } from "@/lib/auth-callbacks";
import { getDb } from "@/db/client";
import { Accounts } from "@/db/accounts";
import { UserError } from "@/lib/errors";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  trustHost: true,
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  pages: { signIn: "/", error: "/" },
  callbacks: authCallbacks(identity => new Accounts(getDb()).register(identity)),
});
export async function requireOwner() {
  const session = await auth();
  if (!session?.googleId) throw new UserError("Please sign in with Google to open your tracker.");
  return new Accounts(getDb()).owner(session.googleId);
}
