# AgriFlow AI Zambia

**Grow Smarter. Trade Better. Harvest More.**

AgriFlow AI Zambia is an AI-powered agricultural ecosystem for Zambian farmers and agribusinesses. In one Progressive Web App it combines farm management, Grok-powered agricultural intelligence, a produce marketplace with negotiation, an input-supply marketplace, logistics, inventory, farm finances, notifications and an administrator console.

Built for the Agriculture & Agribusiness hackathon challenge. Grok (xAI) is the AI engine.

---

## What's inside

| Area | Highlights |
|---|---|
| **Farm management** | Multiple farms (Zambian province/district selectors, optional GPS), fields, crop records (variety, planting, growth stage, yield), activities with costs, calendar with automatic harvest reminders, notes |
| **Grok intelligence** | Context-aware assistant using the farmer's own records; crop-health photo assessment (structured output, confidence, expert-inspection flag); crop advisor; profitability answers from backend-computed figures; AI farm reports with PDF export; admin business intelligence over aggregated stats; market-price explanations |
| **Weather** | Real forecasts from Open-Meteo through a provider adapter, 30-minute caching in Postgres, source and fetch time always shown, model analysis labelled separately from forecasts, rule-based risk flags |
| **Marketplace** | Listings with photos, search and filters (crop, province, district, price, quantity, sort), purchase requests, counteroffers with history, full order lifecycle (PENDING → … → COMPLETED, plus cancel, reject and dispute), atomic stock reservation |
| **Input supply** | Supplier products linked to inventory, safety information required for crop protection, admin registration verification, completed purchases post to the farmer's books and inventory |
| **Logistics** | Delivery requests (linked to orders or standalone), transporters matched by service province, first-to-accept claiming, status updates, proof of delivery with photo, vehicles, map-ready coordinates and event log |
| **Inventory** | Movements history, low-stock alerts, valuation, expiry, no negative stock without an authorised adjustment |
| **Finance** | Decimal-safe income, expenses, gross and net profit; breakdowns by crop, field, category and month; estimates kept separate from actuals; CSV and PDF export |
| **Notifications & messaging** | In-app notifications with per-type preferences; SMS, WhatsApp and email queued honestly as `NOT_CONFIGURED` until a provider is connected; buyer–farmer messaging with order threads |
| **Admin** | Live analytics (no hard-coded numbers), user verification and suspension, super-admin role management, listing and product moderation, content reports, crops, categories and regions, verified market prices, settings, outbound message log, audit logs |
| **Offline-first PWA** | Installable app, service worker with offline shell, IndexedDB queue for activities, notes and tasks, idempotent sync with retry/backoff and conflict detection, clear per-item status, no private pages cached |

## Tech stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS v4 · shadcn-style components on Radix UI · Lucide · Recharts · React Hook Form + Zod · Prisma 6 + PostgreSQL · xAI Responses API (Grok) · Open-Meteo · jsPDF · idb · Vitest · Playwright

**Authentication.** The app uses its own server-side auth instead of Supabase Auth, so it runs on any PostgreSQL, including Supabase. Passwords are hashed with bcrypt. Sessions are stored in the database, and the cookie holds a random token (only its HMAC hash is stored), marked `httpOnly`, `SameSite=Lax` and `Secure` in production. Email verification and password reset use single-use tokens; phone verification uses OTP codes. Every page, action and route handler checks the role on the server.

**Storage.** Supabase Storage is used when `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set; otherwise images are stored in PostgreSQL. Uploads are checked by magic bytes, limited to 4 MB, and served through an authorisation check.

---

## Quick start (local)

Requirements: Node.js 20.9+ (tested on 24), npm. No PostgreSQL install is needed.

```bash
npm install
cp .env.example .env            # then set AUTH_SECRET and DEMO_PASSWORD
npm run db:local                # terminal 1: private Postgres on :5544 (data in ./.local-db)
npx prisma migrate deploy       # terminal 2
npm run db:seed                 # fictional demo data
npm run dev                     # http://localhost:3000
```

To use your own PostgreSQL instead, set `DATABASE_URL` and `DIRECT_URL` and skip `db:local`.

### Enable Grok

Set `XAI_API_KEY` (from https://console.x.ai) and optionally `XAI_MODEL` / `XAI_VISION_MODEL` (default `grok-4.7`, which accepts image input). Without a key, every AI feature keeps working in a clearly labelled fallback mode: built-in extension guidance, backend-computed figures, and saved crop-health assessments that can be retried later.

### Demo accounts (local and controlled demos only)

All seeded accounts are fictional and use the password in your `DEMO_PASSWORD` env var. With `DEMO_MODE=true` the login page also shows one-click demo buttons.

| Role | Email |
|---|---|
| Farmer (Choma, maize/soy + tomatoes) | `demo.farmer@agriflow.demo` |
| Buyer | `demo.buyer@agriflow.demo` |
| Supplier | `demo.supplier@agriflow.demo` |
| Transporter | `demo.transporter@agriflow.demo` |
| Administrator | `demo.admin@agriflow.demo` |
| Super administrator | `superadmin@agriflow.demo` |

> **Never deploy publicly with demo accounts or a shared demo password.** For a real launch set `DEMO_MODE=false`, don't run the seed, and create administrators with your own credentials (see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)).

The seed creates 30 farmers, 10 buyers, 5 suppliers, 5 transporters, 20 farms, 40 crop records, 30 listings, 20 supplier products, 15 orders, 10 deliveries, 54 inventory movements, transactions, crop-health samples, notifications, and weather and market-price records. All demo weather and prices are flagged `isDemo` / `DEMO` and labelled in the UI.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run db:local` | Embedded PostgreSQL for development |
| `npm run db:migrate` / `db:deploy` | Create (dev) / apply (prod) migrations |
| `npm run db:seed` | Reset and seed demo data (refuses in production unless `SEED_ALLOW_PRODUCTION=true`) |
| `npm run typecheck` · `npm run lint` | TypeScript · ESLint |
| `npm test` | Unit + integration tests (uses the `agriflow_test` database) |
| `npm run test:e2e` | Playwright workflows A–F, security and offline (needs a seeded DB and a running or built server) |

## Testing

- **Unit** (`tests/unit`): decimal finance maths, order and delivery state machines, inventory arithmetic, upload validation, Zod schemas, role areas, offline queue logic, Open-Meteo adapter, xAI client, prompt-injection sanitising, fallback matching.
- **Integration** (`tests/integration`, real Postgres): registration, login, password reset, onboarding; farm, field, crop and activity with data isolation; offline sync idempotency and conflicts; listings and search; negotiation and the full order lifecycle; overselling prevention; cancellation stock restore; supplier products and input orders posting to finance and inventory; logistics updating linked orders; AI authorisation, context isolation, fallback, rate limits, suggested-task confirmation, structured crop-health output, reports, admin BI data boundaries.
- **End-to-end** (`tests/e2e`): workflows A (onboarding → farm → field → maize), B (assistant + crop health), C (listing → request → accept → confirm), D (transport → accept → pickup → delivered), E (expenses + sale → finances → AI explanation), F (admin overview, moderation, AI BI, report), role enforcement, and offline save → sync (production server).

```bash
npm test
E2E_BASE_URL=http://localhost:3000 npx playwright test tests/e2e/workflows.spec.ts   # against npm run dev
npm run build && npx playwright test                                                 # starts next start on :3100
```

## Documentation

- [docs/DEMO.md](docs/DEMO.md): the 4-minute judging demo script
- [docs/API.md](docs/API.md): route handlers, server actions and data contracts
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): Vercel + Supabase deployment
- [docs/SECURITY.md](docs/SECURITY.md): security and privacy design
- [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)

## Project structure

```
prisma/            schema, migrations (incl. RLS hardening), seed
src/app/           routes: (public) site, auth, onboarding, farmer|buyer|supplier|transporter|admin areas,
                   (shared) messages/notifications/deliveries, offline, api/*
src/components/    ui primitives, layout shell, forms, charts, ai, marketplace, orders, …
src/lib/           db, env, auth (sessions, roles), validation (zod), money, labels, zambia, offline queue
src/server/        domain services: auth, farms, ai, weather, marketplace, orders, suppliers, inventory,
                   logistics, finance, notifications, messaging, analytics, admin, storage, sync
                   + actions/* (thin "use server" wrappers)
tests/             unit, integration, e2e
```

## Honest limitations

- Payments are not processed. Buyers and sellers settle directly, and orders say so.
- SMS, WhatsApp and email delivery need a provider. Email works with `RESEND_API_KEY`; otherwise messages are logged as `NOT_CONFIGURED`.
- Market prices in the demo are fictional. Real use requires administrators to enter verified observations.
- District reference coordinates are approximate town locations, used only for area weather when a farm has no GPS, and labelled as such.
- AI output is advisory and can be wrong. Diagnoses are never presented as definitive.
- The platform has not been certified or audited for compliance with Zambia's Data Protection Act, 2021. It is designed to be ready for that review.
