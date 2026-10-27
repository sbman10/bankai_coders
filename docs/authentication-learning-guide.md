# ProductVault Authentication: Step-by-Step Learning Guide

**Audience:** building the ProductVault authentication feature on the `auth` branch  
**Scope:** email one-time code login, sessions, authorization, abuse controls, caching, and production readiness  
**Research checked:** 26 October 2026

## Recommendation

Use **Supabase Auth email OTP** with the existing Next.js App Router and `@supabase/ssr`. Do not build password storage, OTP generation, session tokens, or email delivery yourself. Supabase already issues and verifies the code, creates the auth user/session, and integrates its signed user identity with Postgres Row Level Security (RLS). Next.js remains the app's server boundary; the browser must never receive a Supabase secret/service key.

“Gmail OTP” means that ProductVault emails a code to an address the user reads in Gmail. It does **not** mean ProductVault signs in to, reads, or gets permission to access the user's Gmail account. A **Continue with Google** button is a separate OAuth flow that redirects to Google and needs a Google OAuth client. Start with email OTP; add Google OAuth only if users ask for the separate button. [Supabase passwordless email](https://supabase.com/docs/guides/auth/auth-email-passwordless) · [Supabase Google sign-in](https://supabase.com/docs/guides/auth/social-login/auth-google)

## What the repository currently has

- `apps/web/src/lib/supabase/server.ts` and `client.ts` create server and browser clients with `@supabase/ssr`.
- `apps/web/src/app/api/auth/route.ts` currently supports password sign-up/sign-in and sign-out. It does not implement email OTP yet.
- The app README describes the current public UI as a fictional demo; account-backed API routes exist but are not exposed by that UI.
- No Next.js `proxy.ts` or `middleware.ts` was found. Supabase's current Next.js SSR setup uses a Proxy to refresh sessions and write refreshed cookies back to the response.
- The existing core migration creates a `profiles` table and owner policies for ProductVault data. Verify grants and RLS operation-by-operation before exposing account features; the existence of a policy alone does not prove access is correct.

This is a read-only code inspection, not proof that the live Supabase project is configured for OTP or that any auth path works end-to-end. [Current app README](../apps/web/README.md) · [Auth route](../apps/web/src/app/api/auth/route.ts) · [Supabase SSR client](../apps/web/src/lib/supabase/server.ts) · [Core migration](../supabase/migrations/20261019213317_claimforge_core.sql)

## Learn the model before coding

Authentication answers **who is this user?** Session management remembers that identity between requests. Authorization answers **which records and actions may this user access?** A successful OTP only establishes identity; it does not by itself protect a product, claim, or document. Next.js recommends using an auth library and checking authorization close to the data source and in every Server Action or Route Handler. [Next.js authentication guide](https://nextjs.org/docs/app/guides/authentication) · [Supabase Auth overview](https://supabase.com/docs/guides/auth)

```mermaid
sequenceDiagram
    actor U as User
    participant B as ProductVault browser
    participant N as Next.js App Router
    participant A as Supabase Auth
    participant M as Email provider / Gmail inbox
    participant D as Supabase Postgres + RLS
    U->>B: Enter email
    B->>N: Request code (bounded, validated)
    N->>A: signInWithOtp(email)
    A->>M: Send one-time code
    M-->>U: Code arrives in inbox
    U->>B: Enter code
    B->>N: Verify email + code
    N->>A: verifyOtp(email, token, type=email)
    A-->>N: Verified user + session
    N-->>B: Set session cookies; return safe user DTO
    B->>N: Request a private ProductVault API
    N->>A: Validate current user/session
    N->>D: Query using that user's session
    D->>D: RLS checks auth.uid() against row owner
    D-->>B: Only rows the user may access
```

## Step 1 — Choose the sign-in experience

For the MVP, use one flow: **email → six-digit code → signed-in workspace**. Supabase's `signInWithOtp` method sends a Magic Link by default; the email template must include `{{ .Token }}` to send an entered code. Verify it with `supabase.auth.verifyOtp({ email, token, type: "email" })`. A successful send returns no session yet; the user becomes signed in only after verification. [Passwordless email sign-in](https://supabase.com/docs/guides/auth/auth-email-passwordless) · [Email templates](https://supabase.com/docs/guides/auth/auth-email-templates)

Supabase creates a user automatically on `signInWithOtp` by default. Keep that if the single email form should support both first-time sign-up and later sign-in. Set `shouldCreateUser: false` only if the product requires pre-existing accounts. Show a generic “If this address can receive a code, check your inbox” success message so the UI does not reveal whether an address has an account.

The OTP is a **first sign-in factor**, not two-factor authentication by itself. It proves access to that inbox. If the user loses the mailbox, the account recovery path is also affected; don't describe email OTP as phishing-resistant MFA. [Supabase MFA levels](https://supabase.com/docs/guides/auth/auth-mfa)

## Step 2 — Configure email safely

1. In Supabase Auth, confirm the Email provider is enabled and choose the OTP email template containing `{{ .Token }}`.
2. Configure a custom SMTP service before inviting real users. Supabase's built-in sender is for development: it sends only to authorized team addresses, is currently limited to two emails per hour, and has no delivery SLA. With custom SMTP, confirm provider limits and sender-domain setup. [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
3. Use a domain/address controlled by ProductVault and complete the email provider's sender authentication steps. Do not build production delivery around a personal Gmail password or ask users to grant Gmail access.
4. Set the Supabase Site URL to the canonical ProductVault URL and allow only the required local, preview, and production callback URLs. Keep production redirects exact; don't redirect to a URL supplied unchecked by the browser. [Redirect URL configuration](https://supabase.com/docs/guides/auth/redirect-urls)
5. Keep the OTP message plain and recognizable: ProductVault sign-in code, expiry guidance, and “If you did not request this, ignore it.” Never log the code or include it in analytics.

Supabase documents a default 60-second resend window and a one-hour email OTP expiry; both are configurable. Review and select the expiry in project settings rather than assuming a frontend countdown is the security control. [Email OTP behavior](https://supabase.com/docs/guides/auth/auth-email-passwordless)

## Step 3 — Build the OTP screens and server flow

Create an email form, then a code form with clear states: sending, check inbox, verifying, expired/invalid, resend cooldown, and success. Validate and bound request bodies on the server; trim and validate email; accept only the expected number of numeric code digits. Never trust a client-provided `user_id`.

For this Next.js SSR app, use the existing `@supabase/ssr` pattern and a request-scoped server client. A practical flow is:

1. A Next.js Route Handler accepts the send-code request and calls `signInWithOtp`.
2. The user submits the code to a verify Route Handler. It calls `verifyOtp` on a server Supabase client whose cookie adapter writes the resulting session to the response.
3. Return only a safe user DTO such as `{ id, email }`; never return access or refresh tokens in JSON.
4. After verification, redirect to the private workspace. An email-link variant instead uses a dedicated callback route that checks the `token_hash` and `type`, verifies it, and redirects only to an allowed local path.

The existing server client catches cookie writes that fail in Server Components. Cookie mutation must happen in a Route Handler or Server Function that can return `Set-Cookie`. Follow Supabase's current Next.js Proxy pattern for refreshing sessions before rendering; in Next.js 16 the convention is `proxy.ts` (older Next.js used `middleware.ts`). Create a fresh Supabase server client per request. [Supabase Next.js SSR client setup](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs&queryGroups=framework&router=app) · [Next.js cookies](https://nextjs.org/docs/app/api-reference/functions/cookies)

Security nuance: the normal `createBrowserClient` pattern lets browser JavaScript manage the Supabase cookie, so do not assume the session cookie is `HttpOnly` or XSS-proof. This SSR pattern avoids the default `localStorage` session storage, but an XSS bug can still act as the signed-in user. Keep dependencies and rendered HTML safe, use a strong Content Security Policy, and never expose secrets. If you require an `HttpOnly` session, design a server-only Backend-for-Frontend (BFF) that owns all authenticated requests; don't add `HttpOnly` to the current cookie path without checking that browser-side Supabase calls and refresh still work. [Supabase SSR package design](https://github.com/supabase/ssr) · [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)

## Step 4 — Understand sessions and “Remember me”

Supabase sessions contain a short-lived JWT access token and a rotating refresh token. The access token is commonly valid for 5 minutes to 1 hour; Supabase recommends the default one hour for most apps. Refresh tokens are long-lived and normally continue a session until sign-out or a configured session-ending event. [Supabase session guide](https://supabase.com/docs/guides/auth/sessions)

For the MVP, **do not add a Remember me checkbox unless its behavior is real and tested**. `@supabase/ssr` manages the session in cookies; shortening cookie `Max-Age` is not the same as expiring the Supabase session and can make refresh behavior unreliable. Supabase's documented session lifetime, inactivity timeout, and single-session controls apply at project level and are available on Pro plans and above, not as an independent per-user checkbox. A true per-device short-session option needs an explicit design and server-side enforcement. [Supabase SSR advanced guide](https://supabase.com/docs/guides/auth/server-side/advanced-guide) · [Session limits and plan note](https://supabase.com/docs/guides/auth/sessions#limiting-session-lifetime-and-number-of-allowed-sessions-per-user)

If you later add the label “Keep me signed in on this device,” decide and document what checked and unchecked mean, how long the session lasts, and what sign-out revokes. Do not claim “unchecked signs out when the browser closes”: browser session restoration can preserve session cookies. For MVP, use Supabase's normal session behavior plus an obvious **Sign out** action.

## Step 5 — Protect pages and data

- Use `getClaims()` to verify a JWT for server-side identity checks; use `getUser()` when you need the current user record from the Auth server. Do not rely on `getSession()`'s user object for authorization decisions. [Supabase client selection guide](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs&queryGroups=framework&router=app)
- A Proxy can redirect a signed-out visitor as an early navigation check. It is not the security boundary: every Route Handler, Server Action, and sensitive data function must independently verify the user and permission. [Next.js auth guidance](https://nextjs.org/docs/app/guides/authentication)
- Derive the owner from the verified Supabase user (`user.id` / `auth.uid()`), never from a request JSON field or URL alone.
- Keep user-owned database queries under that user's Supabase session and enforce RLS in Postgres. A policy is not a grant: verify both grants and RLS. Keep any service-role/secret key only on the server because it bypasses RLS. [Supabase RLS guide](https://supabase.com/docs/guides/database/postgres/row-level-security)
- Test cross-user denial with two synthetic users: user A cannot read, mutate, or retrieve user B's products, claim records, or document metadata. Use the same ownership rule for Storage paths.
- Distinguish authentication failure (401) from an authenticated user lacking permission (403); for private objects, a consistent 404 can avoid confirming that another user's record exists.

## Step 6 — Add abuse controls and rate limits

Supabase Auth already applies IP, per-user, project email, OTP, verification, and token-endpoint limits. A resend button countdown is only a user-experience hint; Supabase must enforce the real limit. A 429 response should give a calm retry message and honor a server-provided retry interval if available. [Supabase Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits)

Recommended layers for ProductVault:

1. Keep Supabase's built-in rate limits enabled and inspect the current project settings.
2. Apply an app-side persistent/shared rate limit to OTP-send and verify endpoints if you proxy them through Next.js. Key it by a normalized-address hash and trusted client IP, return 429, and avoid logging the address or code unnecessarily. A process-local `Map` is not a reliable production limit on serverless instances.
3. Add Supabase-supported CAPTCHA (Turnstile or hCaptcha) when bots or delivery abuse are a concern; CAPTCHA supplements, not replaces, rate limits.
4. Do not trust arbitrary `X-Forwarded-For`. Supabase's `Sb-Forwarded-For` feature has separate enablement and key requirements; configure it only after following its official setup. [CAPTCHA protection](https://supabase.com/docs/guides/auth/auth-captcha) · [IP forwarding in rate-limit docs](https://supabase.com/docs/guides/auth/rate-limits#ip-address-forwarding)

Plan for the built-in email sender's 2-per-hour cap when developing: use authorized test inboxes, avoid rapid resend loops, and configure a custom SMTP sender before a real-user pilot. Current quotas and project settings can change, so inspect the dashboard before launch.

Because cookies are sent automatically by browsers, protect state-changing auth routes with same-origin checks and an appropriate CSRF strategy. `SameSite=Lax` is useful defense in depth, not a universal substitute for CSRF protection. [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)

## Step 7 — Cache safely

Auth state and ProductVault records vary by cookie/user. Never place an auth response, OTP verify response, `Set-Cookie` response, profile, or private product/document response in a shared CDN or static cache. Use `Cache-Control: private, no-store` for sensitive auth and personalized API responses. Do not opt authenticated pages or Route Handlers into `force-static`, ISR, or a shared `use cache` scope. Keep public landing content and hashed static assets cacheable separately.

Next.js Route Handlers run at request time by default but GET handlers can be explicitly cached; Vercel distinguishes per-user `private` responses from shareable CDN responses. Supabase warns that caching responses containing refreshed `Set-Cookie` headers can give one user's session to a different visitor. [Next.js Route Handler caching](https://nextjs.org/docs/app/getting-started/route-handlers#caching) · [Vercel Cache-Control guidance](https://vercel.com/docs/caching/cache-control-headers) · [Supabase SSR cache warning](https://supabase.com/docs/guides/auth/server-side/advanced-guide#can-i-use-server-side-rendering-with-a-cdn-or-cache)

## Step 8 — Build account lifecycle and useful recovery

Implement and understand: sign out; expired/invalid code; resend; email-change confirmation; account deletion; session revoked or expired; email delivery failure; and recovery when the user cannot access their mailbox. Do not create an insecure “support can change email” bypass. For account deletion, verify ownership and decide how it affects products, claims, and private documents before writing destructive cascade logic.

Log safe event names and outcomes (e.g. `otp_requested`, `otp_verified`, `otp_rejected`, `signout`) with a correlation ID. Never log OTPs, cookies, access/refresh tokens, full authorization headers, or uploaded text. Show a generic error where account existence would otherwise be disclosed.

## Step 9 — Advanced protections after the basic flow works

- **MFA:** Supabase supports TOTP authenticator-app and phone factors. MFA assurance levels are represented by `aal1`/`aal2`; enforcement must cover app routes and, where needed, RLS policies. TOTP is the sensible next security feature if ProductVault later stores especially sensitive account information. [Supabase MFA](https://supabase.com/docs/guides/auth/auth-mfa) · [TOTP MFA](https://supabase.com/docs/guides/auth/auth-mfa/totp)
- **Passkeys:** Supabase documents passkey authentication as experimental; do not make it the first auth implementation or promise production stability yet. [Supabase passkeys](https://supabase.com/docs/guides/auth/passkeys)
- **Google OAuth:** add only as a separate user choice. It needs a Google OAuth client ID/secret and exact redirect setup; it is not required to send a one-time code to a Gmail inbox. [Google provider setup](https://supabase.com/docs/guides/auth/social-login/auth-google)
- **Session controls:** choose global timeout/single-session settings only after checking current plan availability and user impact. Supabase says those controls are Pro+; don't rely on them as per-device Remember me.

## Step 10 — Verify before merging `auth` into `main`

Use synthetic inboxes and synthetic ProductVault records. Verify these user-visible behaviors:

1. Invalid or oversized email/code is rejected without an Auth call.
2. A valid email receives a code; the UI does not reveal whether it was already registered.
3. Correct, wrong, expired, and reused codes have clear outcomes; resend is throttled.
4. A successful verification establishes a session cookie; reload and a second request still identify the same user.
5. Sign-out clears the browser session and protected requests return 401 afterward.
6. User A cannot read or change user B's products, claims, reminders, files, or search results, even by changing IDs.
7. Responses for `/api/auth`, current-user endpoints, and private data have no shared-cache behavior; inspect `Set-Cookie` and `Cache-Control` in browser devtools.
8. Email confirmation URLs work only for allowed origins in local, preview, and production configurations.
9. Supabase and SMTP failures show safe messages; logs contain no OTP, token, cookie, or private document content.
10. After implementation, run the project test, lint, and build commands and review Supabase RLS tests; test Auth behavior with a local/test project before real-user production.

Do not apply new SQL remotely, alter production Auth settings, or deploy just to make a local test pass. Record which checks used a local stack, mocks, or the actual test project.

## Study order and official references

Read in this order: [Next.js Authentication](https://nextjs.org/docs/app/guides/authentication) → [Supabase email OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless) → [Supabase Next.js SSR client](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs&queryGroups=framework&router=app) → [Supabase SSR advanced guide](https://supabase.com/docs/guides/auth/server-side/advanced-guide) → [Supabase sessions](https://supabase.com/docs/guides/auth/sessions) → [Supabase rate limits](https://supabase.com/docs/guides/auth/rate-limits) → [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) → [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod) → [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) and [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

The guide is a learning plan, not a claim that these controls are implemented or that live Supabase/SMTP settings were checked.
