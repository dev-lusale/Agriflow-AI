# Security & privacy design

> AgriFlow AI has **not** been independently audited or certified. This document describes the controls that are implemented, as preparation for a review under Zambia's Data Protection Act No. 3 of 2021 and the consumer-protection and electronic-transactions laws.

## Authentication & sessions
- Passwords are hashed with bcrypt (cost 11). The policy is 8+ characters with letters and numbers.
- A session is a random 256-bit token in an `httpOnly`, `SameSite=Lax` cookie (`Secure` in production). Only an HMAC-SHA256 of the token (keyed by `AUTH_SECRET`) is stored, so a leaked database cannot be used to forge sessions.
- Login is rate-limited per IP and per email, with a uniform error message and constant-time-ish verification to limit account enumeration. Password-reset requests always return the same message.
- Reset and verification tokens are single-use and expire (reset 1 h, email 48 h, OTP 10 min). A password reset revokes all sessions. Suspending an account revokes its sessions.

## Authorisation
- Roles: FARMER, BUYER, SUPPLIER, TRANSPORTER, ADMIN, SUPER_ADMIN. Self-registration cannot create admin roles.
- The proxy (`src/proxy.ts`) only redirects anonymous users. **Every** layout, server action and route handler re-checks the session and role on the server (`requirePageRole`, `requireRole`).
- Domain services check ownership on every record (farm, field, crop, inventory, order party, delivery party, conversation participant). The integration tests cover cross-user access.
- Only super admins can manage administrator accounts and permissions. Admins cannot suspend other admins.
- Supabase RLS: all tables have RLS enabled and `anon` and `authenticated` are revoked, so the auto-generated APIs expose nothing.

## Input & output safety
- Zod validation runs on the server for every action. Prices, totals and ownership IDs are never trusted from the client.
- Stock reservation uses conditional atomic updates, so concurrent buyers cannot oversell.
- Uploads: magic-byte type detection (JPEG, PNG, WebP; JPEG and PNG for AI), 4 MB limit, content-type mismatch rejection, per-user upload rate limit. Files are served with `nosniff` and a restrictive CSP. Private files are served `no-store` after an authorisation check.
- CSV exports neutralise spreadsheet formulas. AI Markdown is rendered as React elements with no raw HTML.
- Security headers: `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`. `X-Powered-By` is disabled.

## AI safety
- Grok is only called from the server, and `XAI_API_KEY` never reaches the browser.
- Requests use `store: false`. Farmer context contains only the farmer's own records and no emails or phone numbers. Admin BI receives aggregated statistics only.
- Prompt-injection defences: a system rule hierarchy, data and user text wrapped in `<verified_data>` and `<user_message>` delimiters with tag stripping, control-character removal, length caps, strict JSON-schema output validated with Zod, and no tools that change data.
- The AI can only *suggest* tasks. The user confirms, and the server validates the suggestion against the stored AI message before creating anything. Financial transactions are never triggered by AI.
- Per-user hourly rate limits, an admin kill switch (`ai.enabled`), and usage and token logging.
- Pesticide guidance rule: no dosages; refer to registered products, labels, PPE, pre-harvest intervals and extension officers. Diagnoses are never presented as definitive.

## Privacy
- Data minimisation: no NRC numbers, bank details or mobile-money PINs are collected. Phone numbers are optional.
- Consent is recorded at registration (`dataConsentAt`) and linked to the privacy notice.
- Contact details between buyer and seller are only shown once an order is confirmed.
- Offline drafts live in the user's own IndexedDB, are limited to low-risk records, and are cleared on sign-out. The service worker never caches API responses or authenticated pages.
- Audit logs record important actions (registration, moderation, verification, role and status changes, settings, orders, deliveries).

## Secrets
- Secrets come only from server environment variables (`src/lib/env.ts`). Nothing secret uses a `NEXT_PUBLIC_` prefix. `.env` is git-ignored. `/api/health` reports configuration status without revealing values.

## Reporting a vulnerability
Email the maintainers (see the support address in Admin → Settings). Please don't disclose publicly until a fix is available.
