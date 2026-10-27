# ProductVault authentication provider setup

The app implements passwordless email magic links and Google OAuth through Supabase Auth. Email links use Supabase's built-in sender; no custom SMTP provider is configured. The application uses its existing server-only `APP_BASE_URL` setting; no Google client secret belongs in the app's `.env.local` file.

## Supabase URL settings

In Supabase Dashboard → **Authentication → URL Configuration**:

1. Set the local Site URL to `http://localhost:3000` while developing locally.
2. Add `http://localhost:3000/auth/callback` to Redirect URLs.
3. Add the exact deployed app callback URL and any specific preview callback URLs before testing those environments. Keep the allowlist narrow.

`APP_BASE_URL` in `apps/web/.env.local` must match the app origin (currently `http://localhost:3000` for local development). After changing environment values, restart the Next.js dev server.

## Email sign-in links

In Supabase Dashboard → **Authentication → Providers → Email**:

1. Enable email sign-in and allow new users if first-time users should be able to create an account from the link.
2. No template change should be needed with Supabase's default magic-link email. If the template is editable, it must use `{{ .ConfirmationURL }}`; a template using `{{ .Token }}` sends a code instead. Do not set up SMTP just to change the template.
3. The app sends users to `http://localhost:3000/auth/callback`; the callback exchanges Supabase's one-time auth code and stores the session in server-managed cookies. Keep the matching callback in URL Configuration above.
4. The app shows the same confirmation after a valid email is submitted, then offers resend and change-email actions. Supabase enforces its own resend/expiry limits.
5. The built-in sender is for development and demos: Supabase currently restricts it to project team email addresses and two messages per hour, with no delivery SLA. It will not reliably deliver to arbitrary users. This setup deliberately adds no Resend or other SMTP provider.

Email magic links accept regular email addresses. They do not restrict sign-in to Gmail domains.

## Google OAuth

1. In Google Cloud Console, configure the OAuth consent screen. For development, keep the app in testing mode and add the intended test accounts.
2. Create an OAuth client of type **Web application**.
3. In Supabase Dashboard → **Authentication → Providers → Google**, enable Google and copy the callback URL shown there.
4. In Google Cloud Console, add that Supabase callback URL as an **Authorized redirect URI**. It is the Supabase Auth callback, usually shaped like `https://<project-ref>.supabase.co/auth/v1/callback`; copy the exact value from the dashboard.
5. Enter the Google client ID and client secret directly in Supabase's Google provider settings. Do not add the secret to app source, `.env.local`, or chat.
6. Save and test “Continue with Google” from `http://localhost:3000`.

## Session behavior

The app exchanges the OAuth code at `/auth/callback`, stores the Supabase SSR session in secure cookies, refreshes the session in Next.js `proxy.ts`, and clears the current browser session through sign-out. **Keep me signed in on this device** keeps the auth cookie for 30 days; leaving it unchecked creates a browser-session cookie. Browser session restoration can preserve session cookies after closing a window, so this is a convenience setting rather than a guaranteed server-side session revocation timer. Supabase Auth's configured session expiry remains authoritative.

## Cookie choices

The first visit shows a consent panel. Necessary sign-in, security, and consent-choice cookies are always active. Visitors can opt into saving preferences (the display theme) and optional analytics, change those choices later through **Cookie settings**, or reject optional storage. This MVP does not load an analytics provider, so selecting analytics does not currently send analytics data. Rejecting preferences removes the persisted theme choice; theme changes remain temporary for that browser session.

The default Supabase Auth rate limits protect sign-in-link requests and verification. This app does not add an in-memory per-IP limiter because that would not be reliable across serverless instances. If abuse protection beyond Supabase's limits is needed, add a shared rate-limit store (for example, Upstash Redis) in a separate reviewed change.
