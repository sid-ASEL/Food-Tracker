import { ArrowRight, Check, Coffee, ShieldCheck, Store, Wallet } from "lucide-react";
import { InstallApp } from "./install-app";
import { ThemeToggle } from "./theme-toggle";

export function Landing({ ready, error, onSignIn }: { ready: boolean; error?: string; onSignIn: () => Promise<void> }) {
  return <main className="landing">
    <div className="landing-content">
      <header className="landing-header"><div className="landing-brand"><span className="brand-mark" aria-hidden="true" /><span>mealbook</span></div><ThemeToggle /></header>
      <section className="landing-hero" aria-labelledby="landing-title">
        <span className="landing-eyebrow">YOUR DAILY TABLE, SIMPLIFIED</span>
        <h1 id="landing-title">Good meals.<br /><span>One less thing<br />to keep track of.</span></h1>
        <p className="landing-description">Keep your tiffin, mess, and everyday food expenses in one place. Log what you eat, see what you owe, and keep every payment clear.</p>
        <div className="landing-actions">
          {ready ? <form action={onSignIn}><button className="button primary landing-sign-in" type="submit">Get started with Google <ArrowRight size={20} aria-hidden="true" /></button></form> : <p className="setup-note">Mealbook is getting ready. Please check back soon.</p>}
          <div className="landing-install"><InstallApp /></div>
        </div>
        {error && <p className="error" role="alert">{error === "AccessDenied" ? "Use a verified Google account to open your private tracker." : "Sign-in did not complete. Please try again."}</p>}
        <p className="landing-trust"><ShieldCheck size={15} aria-hidden="true" />Your tracker is yours. Your data stays private.</p>
      </section>
      <section className="landing-preview" aria-label="Example of a Mealbook tracker">
        <div className="landing-preview-heading"><div><span className="landing-eyebrow">A PEEK INSIDE · EXAMPLE</span><h2>A day at your table</h2></div><span className="landing-preview-icon"><Coffee size={23} aria-hidden="true" /></span></div>
        <div className="landing-example-meal"><span className="landing-meal-icon"><Coffee size={18} aria-hidden="true" /></span><div><strong>Lunch dabba</strong><span>Your favourite tiffin</span></div><strong>₹80</strong><span className="landing-paid"><Check size={13} aria-hidden="true" />Paid</span></div>
        <div className="landing-example-meal"><span className="landing-meal-icon"><Store size={18} aria-hidden="true" /></span><div><strong>Dinner thali</strong><span>Your regular kitchen</span></div><strong>₹100</strong><span className="landing-due">Due</span></div>
        <div className="landing-example-total"><span>A clear picture, at a glance</span><strong>₹100 left to pay</strong></div>
      </section>
      <section className="landing-features" aria-labelledby="landing-features-title">
        <span className="landing-eyebrow">A SMALL ROUTINE. A CLEARER DAY.</span><h2 id="landing-features-title">Less mental maths.<br />More peace of mind.</h2>
        <div className="landing-feature"><span><Store size={21} aria-hidden="true" /></span><div><h3>Add your regular spots</h3><p>Save your food services and usual prices once.</p></div></div>
        <div className="landing-feature"><span><Coffee size={21} aria-hidden="true" /></span><div><h3>Log a meal in a few taps</h3><p>Breakfast, lunch, dinner, or a little extra. Set your own name and amount.</p></div></div>
        <div className="landing-feature"><span><Wallet size={21} aria-hidden="true" /></span><div><h3>Know exactly what’s due</h3><p>Pay your service as usual, then record it here. Your balance and history stay together.</p></div></div>
      </section>
      <aside className="landing-home-screen"><span className="brand-mark" aria-hidden="true" /><div><h2>A little home on your home screen.</h2><p>Install Mealbook for quick access on your phone. Stay online to sign in and sync your meals.</p></div></aside>
      <footer className="landing-footer"><span>mealbook</span><p>Made for your everyday. All amounts in Indian rupees.</p></footer>
    </div>
  </main>;
}
