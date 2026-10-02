import { auth } from "@/auth";
import { allowedEmail } from "@/lib/access";
import { todayIndia } from "@/lib/domain";
import { getDb } from "@/db/client";
import { Repository } from "@/db/repository";
import { Tracker } from "@/components/tracker";
import { InstallApp } from "@/components/install-app";
import { googleSignIn, logOut } from "./actions";
import { ArrowRight, Leaf, CalendarDays, ShieldCheck, Wallet } from "lucide-react";
import type { Snapshot } from "@/lib/types";

export const dynamic = "force-dynamic";
export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const ready = Boolean(process.env.AUTH_SECRET && process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET && process.env.ALLOWED_EMAIL && process.env.DATABASE_URL);
  const { error } = await searchParams;
  const session = ready ? await auth() : null;
  if (allowedEmail(session?.user?.email, process.env.ALLOWED_EMAIL)) {
    let data: Snapshot | null = null;
    try {
      data = await new Repository(getDb(), session!.user!.email!.toLowerCase()).snapshot();
    } catch { /* Render the reconnect view below; do not expose database errors. */ }
    if (data) return <Tracker initial={data} today={todayIndia()} userName={session?.user?.name?.split(" ")[0] || "there"} />;
    return <main className="welcome"><div className="welcome-card"><Leaf size={40} /><h1>Let’s reconnect.</h1><p>Your data could not be loaded. Check the database connection and make sure migrations have been applied.</p><form action="/"><button className="button primary">Try again</button></form><form action={logOut}><button className="button ghost">Sign out</button></form></div></main>;
  }
  return <main className="welcome">
    <div className="welcome-brand"><span className="brand-mark" aria-hidden="true" /> mealbook</div>
    <div className="welcome-card">
      <span className="eyebrow">A LITTLE LESS TO KEEP TRACK OF</span>
      <h1>Good meals.<br /><span>Clear balances.</span></h1>
      <p>A simple home for your daily meals and food payments. Made for your routine, wherever you eat.</p>
      <div className="welcome-preview"><div><CalendarDays /><strong>Every meal, remembered</strong><span>Breakfast, lunch, dinner & the little extras.</span></div><div><Wallet /><strong>Always know what’s due</strong><span>Clear service balances, all in rupees.</span></div></div>
      {!ready ? <div className="setup-note"><strong>Almost ready to serve.</strong><p>Add your Neon and Google login configuration in <code>.env.local</code>, then apply the database migration. The README has the setup steps.</p></div> : <form action={googleSignIn}><button className="button primary sign-in">Continue with Google <ArrowRight size={18} /></button></form>}
      <div className="welcome-install"><InstallApp /></div>
      {error && <p className="error" role="alert">{error === "AccessDenied" ? "This is a private tracker. Use your authorized Google account." : "Sign-in did not complete. Please try again."}</p>}
      <div className="private-note"><ShieldCheck size={16} /> Your personal tracker. Your data stays private.</div>
    </div><footer>One meal at a time.</footer>
  </main>;
}
