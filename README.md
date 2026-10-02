# Mealbook · Food Tracker

A mobile-friendly food tracker with a private workspace for every Google user. Track daily standard/custom meals, rupee balances, and a reversible payment history. Built with Next.js, TypeScript, Tailwind CSS, Auth.js Google login, Drizzle, and Neon Postgres.

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

### Google login for everyone

1. Create a free [Google Cloud project](https://console.cloud.google.com/) and configure the Google Auth Platform branding, audience, and OAuth client.
2. Select a **Web application** OAuth client. For local development, register `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI. For Netlify, also register `https://YOUR-SITE.netlify.app/api/auth/callback/google`.
3. Use only the basic `openid`, `email`, and `profile` scopes. Add your Google account as a test user if the consent screen is in testing. For lasting use, publish the basic sign-in consent configuration when ready; Google’s testing restrictions can affect continued access.
4. Set `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` to the client credentials. Configure an **External** audience and publish the consent configuration for production. Any verified Google account can join; no application email allowlist is required. Google Workspace administrators can still restrict access for their organization.
5. Generate `AUTH_SECRET` with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"` and copy the result into the environment file.
6. Set `AUTH_URL` to `http://localhost:3000` locally and your HTTPS site origin in production.

Only verified Google identities may sign in. First sign-in creates a private tracker automatically. Accounts use Google’s permanent subject identifier rather than a changeable email address. Every data operation checks the signed session and resolves the account’s ownership on the server. No password database or separate paid auth service is required. Auth.js currently documents its Next.js integration using the beta release; the tested package version is recorded in the lockfile.

## Deploy on Netlify

1. Push the repository to your Git provider and import it into Netlify.
2. Use the Free plan, Node 24, and build command `npm run build`. Netlify automatically supplies its Next.js adapter; this is a server application, not a static export.
3. Add all five environment variables from `.env.example` to the site’s environment, available at build and runtime. Use your production `AUTH_URL` and keep secrets private.
4. Apply migrations against the production Neon branch using `npm run db:migrate` from a trusted local environment. Migrations do not run automatically during a build.
5. Register the production Google redirect URI, deploy, and sign in with Google.
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

The database is the source of truth. Updates use service row locks, entry versions, and payment request IDs to avoid conflicting edits or duplicate settlement. A changed payment preview is rejected before anything is paid. Failed requests preserve form input; use **Reload latest data** to reconcile an uncertain result before retrying. Connectivity is required; offline editing, partial payments, automatic payment processing, and shared workspaces are not included.

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


## Multi-user development and rollout

The `accounts` table maps a unique Google account ID to a unique private ownership key. Existing service, meal, and payment tables are unchanged. Email and name are updated at sign-in; changing an email does not change ownership. Client-supplied account or owner fields are never trusted. Existing JWT sessions are invalidated once and users must sign in again.

Migration `0002_accounts.sql` is additive. When a Gmail or Google Workspace identity first signs in, an unclaimed legacy ownership key matching its verified email can be linked to that Google account. No historical records are rewritten. Other Google accounts get an empty tracker with a `google:<subject>` ownership key. Third-party email accounts are accepted for new trackers but cannot claim legacy email records automatically.

1. In Neon, create a development database branch from production and set local `DATABASE_URL` to that branch’s pooled connection string. Keep this value private. Do not test new migrations or account writes against production.
2. Run `npm run db:migrate`, then `npm run dev`. The migration runner is transactional and safely skips already-applied migrations.
3. Sign in with the existing owner: verify their services, historical meals, and payments are unchanged. Sign out and use a second Google account: verify it starts empty, add a service and meal, settle and reverse a payment, and refresh.
4. Switch between the two accounts and verify neither sees the other’s records. Repeat on a phone, including installed mode. Automated browser tests use isolated mocks and do not prove live Google OAuth or Neon behavior.
5. Commit and push `develop` after automated checks. Promote to `master` only after the live checks and release approval. Before production deployment, take a backup, apply the additive migration using the production connection, then deploy the approved code. Remove the obsolete email-allowlist variable from local and Netlify environments; the application ignores it.
6. Check deployment logs for callback/database failures and verify two-account isolation after deployment. Monitor Neon connections and Netlify usage as traffic grows; this release does not promise unlimited capacity.

Google OAuth production details: [app publishing and audience](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview), [stable account identifiers](https://developers.google.com/identity/openid-connect/openid-connect). Keep only `openid`, `email`, and `profile` scopes. Use separate Google projects for development and production as recommended by [Google’s OAuth policies](https://developers.google.com/identity/protocols/oauth2/policies). Branding/logo verification can have separate requirements from basic sign-in scopes.

### Manual linking of third-party legacy email records

A trusted operator must independently confirm both the original legacy owner and the intended Google subject. Do not link an account solely because its current Google email matches old records. Have the user sign in to create their account, then verify the `google_id` using the authenticated session and the `accounts` row. Perform the link on development first, and back up production before repeating it there.

In a database transaction, lock the target account row and ensure the target legacy `owner_key` is not assigned to another account. Check that the account’s current ownership key has **no services**; if it already contains records, stop and arrange a separately reviewed merge instead of hiding them. Change only that account’s `owner_key` to the confirmed legacy email and commit. Do not change Google ID or rewrite service ownership. Record the old key in the operator’s change log. To reverse a link, restore that recorded key after checking that no new data was added under the linked ownership. Never delete records to resolve a linking conflict.

### Rollback

Redeploy the previous `master` release and restore its former email-allowlist configuration. Leave `accounts` and its migration ledger entry intact. Existing email-owned trackers remain readable by the previous release because their ownership values never changed. New namespaced trackers remain stored but are unavailable in the old release until the multi-user code is restored. Do not drop the mapping table or edit applied migration files. Reapplying the multi-user release resumes with the existing mappings.
