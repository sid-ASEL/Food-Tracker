"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="welcome"><div className="welcome-card"><h1>Something went wrong.</h1><p>Please try loading your tracker again.</p><button className="button primary" onClick={reset}>Try again</button></div></main>;
}
