import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { allowedEmail } from "@/lib/access";
import { UserError } from "@/lib/errors";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  trustHost: true,
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  pages: { signIn: "/", error: "/" },
  callbacks: {
    signIn({ account, profile }) {
      return account?.provider === "google" && profile?.email_verified === true && allowedEmail(profile.email, process.env.ALLOWED_EMAIL);
    },
  },
});
export async function requireOwner() {
  const session = await auth();
  if (!allowedEmail(session?.user?.email, process.env.ALLOWED_EMAIL)) throw new UserError("Please sign in with your authorized Google account.");
  return session!.user!.email!.toLowerCase();
}
