import { auth } from "@/auth";
import { Accounts } from "@/db/accounts";
import { todayIndia } from "@/lib/domain";
import { getDb } from "@/db/client";
import { Repository } from "@/db/repository";
import { Tracker } from "@/components/tracker";
import { Landing } from "@/components/landing";
import { googleSignIn, logOut } from "./actions";
import { Leaf } from "lucide-react";
import type { Snapshot } from "@/lib/types";

export const dynamic = "force-dynamic";
export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const ready = Boolean(process.env.AUTH_SECRET && process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET && process.env.DATABASE_URL);
  const { error } = await searchParams;
  const session = ready ? await auth() : null;
  if (session?.googleId) {
    let data: Snapshot | null = null;
    try {
      const db = getDb();
      const owner = await new Accounts(db).owner(session.googleId);
      data = await new Repository(db, owner).snapshot();
    } catch { /* Render the reconnect view below; do not expose database errors. */ }
    if (data) return <Tracker initial={data} today={todayIndia()} userName={session?.user?.name?.split(" ")[0] || "there"} />;
    return <main className="welcome"><div className="welcome-card"><Leaf size={40} /><h1>Let’s reconnect.</h1><p>Your data could not be loaded. Check the database connection and make sure migrations have been applied.</p><form action="/"><button className="button primary">Try again</button></form><form action={logOut}><button className="button ghost">Sign out</button></form></div></main>;
  }
  return <Landing ready={ready} error={error} onSignIn={googleSignIn} />;
}
