# Mealbook · Food Tracker

A private, mobile-friendly food tracker with daily standard/custom meals, rupee balances, and a reversible payment history. Built with Next.js, TypeScript, Tailwind CSS, Auth.js Google login, Drizzle, and Neon Postgres.

## Run locally

Use Node.js 24 and npm. Install dependencies, copy the environment example, and fill in your configuration:

```powershell
npm ci
Copy-Item .env.example .env.local
npm run db:migrate
npm run dev
```

Open http://localhost:3000. Until configuration is complete, the app shows a setup screen. It does not silently store your real tracking data in the browser.

### Neon

1. Create a project on the [Neon Free plan](https://neon.com/pricing). Pick a region close to India when available.
2. Copy the pooled Postgres connection string into `DATABASE_URL` in `.env.local`. The app maps the node-postgres `prefer`, `require`, and `verify-ca` SSL aliases to `verify-full`, which preserves their current strict certificate and hostname checks while avoiding the upcoming pg 9 warning.
3. Run `npm run db:migrate`. Migrations are transactional, recorded with checksums, and safe to rerun. Do not edit migrations that have already been applied.

The application connects to Postgres only from server code. Never prefix database or auth secrets with `NEXT_PUBLIC_`.

### Private Google login

1. Create a free [Google Cloud project](https://console.cloud.google.com/) and configure the Google Auth Platform branding, audience, and OAuth client.
2. Select a **Web application** OAuth client. For local development, register `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI. For Netlify, also register `https://YOUR-SITE.netlify.app/api/auth/callback/google`.
3. Use only the basic `openid`, `email`, and `profile` scopes. Add your Google account as a test user if the consent screen is in testing. For lasting use, publish the basic sign-in consent configuration when ready; Google’s testing restrictions can affect continued access.
4. Set `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` to the client credentials. Set `ALLOWED_EMAIL` to one or more Google email addresses, separated by commas (for example, `you@gmail.com,partner@gmail.com`). Every listed account has the same full access to the shared tracker and its data.
5. Generate `AUTH_SECRET` with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"` and copy the result into the environment file.
6. Set `AUTH_URL` to `http://localhost:3000` locally and your HTTPS site origin in production.

Only configured, verified Google emails may sign in. Every data operation checks the authorized session again. No public signup, password database, or separate paid auth service is required. Auth.js currently documents its Next.js integration using the beta release; the tested package version is recorded in the lockfile.

## Deploy on Netlify

1. Push the repository to your Git provider and import it into Netlify.
2. Use the Free plan, Node 24, and build command `npm run build`. Netlify automatically supplies its Next.js adapter; this is a server application, not a static export.
3. Add all six environment variables from `.env.example` to the site’s environment, available at build and runtime. Use your production `AUTH_URL` and keep secrets private.
4. Apply migrations against the production Neon branch using `npm run db:migrate` from a trusted local environment. Migrations do not run automatically during a build.
5. Register the production Google redirect URI, deploy, and sign in using `ALLOWED_EMAIL`.
6. Verify adding a service, a standard meal, an extra meal, payment settlement, reversal, and persistence after refreshing on your phone.

Free plans have usage limits and their terms can change. Keep Neon and Netlify on their Free plans and monitor their dashboards. Neon may take a moment to wake after inactivity. Routine use by one person should be small, but there is no promise of unlimited hosting. Use a separate database branch and OAuth redirect configuration for preview deployments; previews must not share production data inadvertently.

## Install on a phone or computer

Open the deployed HTTPS site in your browser and use the **Install** button in Mealbook, or choose **Install app** / **Add to Home screen** from the browser menu. On iPhone or iPad, open the site in Safari, tap **Share**, choose **Add to Home Screen**, then tap **Add**. Launch Mealbook from its new home-screen icon. The installed app still needs an internet connection to sign in and sync meals with Neon.

## How it works

- Add a service with its category (Tiffin by default), payment phone, and three meal prices.
- Choose a month and tap a date. Only meals explicitly ticked as taken count; blank entries cost nothing.
- Override any meal’s amount, or add named extras with their own amount. All amounts are INR, stored as integer paise. Each entry is limited to ₹10,00,000.
- Price changes affect newly recorded meals. Recorded amounts remain unchanged unless you edit that unpaid meal.
- Pay externally using the displayed phone number, then mark individual meals paid or settle a service’s outstanding meals through the selected month. Bulk settlement includes arrears and opens the next month.
- A paid meal is locked. Reverse its payment before editing or removing it. Reversing a bulk payment reopens **every meal covered by that payment** and retains the original payment record.
- Archive services without losing old meals or balances. Restore them to enter more meals.
- Calendar dates use Asia/Kolkata. The month selector covers 2000–2100; in December 2100 use individual meal payments because bulk settlement advances a month.

The database is the source of truth. Updates use service row locks, entry versions, and payment request IDs to avoid conflicting edits or duplicate settlement. A changed payment preview is rejected before anything is paid. Failed requests preserve form input; use **Reload latest data** to reconcile an uncertain result before retrying. Connectivity is required; offline editing, partial payments, automatic payment processing, and multi-user access are not included.

## Verify

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run test:ui
```

`npm test` applies the real SQL migration to an isolated PGlite Postgres database and exercises the production Drizzle repository, balances, ownership, historical rates, stale edits, payment retries, reversals, and settlement. PGlite serializes connections, so its simultaneous-request test verifies duplicate prevention on that engine; live Neon multi-connection behavior should also be smoke-tested after provisioning.

`npm run test:ui` checks the actual React components at desktop and phone widths using Microsoft Edge. The isolated Vite harness substitutes server actions with test mocks and persists fixtures only to session storage. It never adds an auth bypass or demo endpoint to the production app. These tests cover custom amounts/meals, blank meals, refresh persistence in the harness, payment rollover/reversal, and failed-save recovery. If Edge is unavailable, change the Playwright channel or install Chromium with `npx playwright install chromium` and remove the channel setting.

For manual UI inspection without credentials, run `npm run preview:ui` and open http://127.0.0.1:4173. This is a **test harness**, not the deployed application. Production Google OAuth and cloud persistence require the live credentials above.

## Database maintenance

Use Neon’s database export tools or `pg_dump` to keep an independent backup before database changes. Apply new numbered SQL migrations rather than modifying old ones. The migration checksum ledger is named `food_migrations`.

`AGENTS.md` remains empty. `PROMPT.md` is the original project brief.
