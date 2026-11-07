# API & application contracts

AgriFlow uses **Next.js server actions** for mutations from the UI and **route handlers** for HTTP endpoints. Both call the domain services in `src/server/*`, which take an explicit `Actor { id, role }` and enforce ownership and roles. That's why the services can be tested directly.

## Conventions

- **Validation:** every input is parsed with the Zod schemas in `src/lib/validation/schemas.ts` on the server, even when the client also validated it.
- **Results:** server actions return `ActionResult<T>`:
  ```ts
  { ok: true, data?: T, message?: string }
  | { ok: false, error: string, code?: "UNAUTHENTICATED"|"FORBIDDEN"|"NOT_FOUND"|"VALIDATION"|"CONFLICT"|"RATE_LIMITED"|"UNAVAILABLE", fieldErrors?: Record<string,string[]> }
  ```
  Unexpected errors are logged on the server and returned as a generic message, so internals never leak.
- **HTTP errors:** route handlers return `{ error }` with the status mapped from the code (401, 403, 404, 400, 409, 429, 503).
- **Money:** `Decimal(14,2)` in ZMW, calculated with `Prisma.Decimal`. Prices and totals always come from the database, never from the client.
- **Pagination:** marketplace 12 per page (`?page=`), admin users 25, audit logs 50.

## Route handlers

| Method & path | Auth | Purpose |
|---|---|---|
| `GET /api/health` | public | Deployment check: `{status, database, ai, aiModel, weatherProvider, storage, email, demoMode}`. No secrets |
| `GET /api/uploads/:id` | public files: anyone; private: owner, admin, or delivery parties | Serves an image. Private files are sent `Cache-Control: private, no-store` |
| `POST /api/sync` | farmer | Offline queue. Body `{ ops: [{ opId, kind, payload }] }` (max 50). `kind` ∈ `activity.create`, `note.create`, `note.update`, `task.create`, `task.complete`. Returns `{ results: [{opId, status: "synced"\|"conflict"\|"failed", …}] }`. Idempotent by `opId` |
| `GET /api/me/farm-options` | farmer | Farm, field and crop names for offline forms |
| `GET /api/export/transactions` | farmer | CSV of recorded transactions (formula-injection safe) |
| `GET /api/export/orders` | any signed-in party | CSV purchase/sales history |
| `GET /api/export/inventory` | farmer, supplier | CSV inventory |
| `GET /pwa-icon/:size` | public | PNG app icons (`192`, `512`, `maskable`) |
| `GET /manifest.webmanifest`, `/sw.js` | public | PWA manifest and service worker |

## Server actions (by module)

| Module | File | Actions |
|---|---|---|
| Auth | `src/server/auth/actions.ts` | `registerAction`, `loginAction`, `demoLoginAction` (DEMO_MODE only), `logoutAction`, `forgotPasswordAction`, `resetPasswordAction`, `resendVerificationAction`, `onboardingAction`, `startPhoneVerificationAction`, `confirmPhoneAction` |
| Farms | `src/server/actions/farm.ts` | create, update and delete farm; field CRUD; crop record CRUD; `recordActivityAction`; `createTaskAction`; `setTaskStatusAction`; notes |
| AI | `src/server/actions/ai.ts` | `farmerChatAction`, `adminChatAction`, `addSuggestedTaskAction` (explicit confirmation), `assessCropHealthAction`, `retryAssessmentAction`, `cropAdviceAction`, `generateReportAction`, `generateAdminReportAction`, `explainMarketAction` |
| Marketplace & orders | `src/server/actions/market.ts` | listing create, update and status; `purchaseRequestAction`; `inputOrderAction`; `counterOfferAction`; `acceptOfferAction`; `transitionOrderAction`; `sendMessageAction`; `reportListingAction` |
| Operations | `src/server/actions/ops.ts` | inventory items and movements; supplier products; delivery request, update and decline; vehicles; transactions and estimates; notifications and preferences |
| Admin | `src/server/actions/admin.ts` | verify and suspend users; create admins and change roles (super admin only); moderate listings and products; resolve reports; crops, categories and regions; market prices; settings; resolve disputes |

## State machines (`src/server/orders/machine.ts`)

**Order:** `PENDING → ACCEPTED → CONFIRMED → PROCESSING → READY_FOR_PICKUP → IN_TRANSIT → DELIVERED → COMPLETED`. Side branches: `NEGOTIATING` (counteroffers), `REJECTED`, `CANCELLED`, and `DISPUTED` (resolved by an admin). Each transition is allowed only for a specific party (BUYER, SELLER, ADMIN, SYSTEM). `CONFIRMED` reserves stock atomically with a conditional decrement. `CANCELLED` releases it. `COMPLETED` posts the produce-sale income, or for input orders the expense plus an inventory receipt.

**Delivery:** `REQUESTED → ACCEPTED → PICKUP_SCHEDULED → PICKED_UP → IN_TRANSIT → DELIVERED` (or `CANCELLED`). Accepting claims the job atomically. `DELIVERED` requires the recipient's name as proof. Pickup and delivery move the linked order forward through the SYSTEM party.

## AI service (`src/server/ai`)

- `xai.ts`: `POST https://api.x.ai/v1/responses` with `store: false`, optional `text.format` JSON-schema structured output, timeout, and token usage capture.
- `context.ts`: builds the farmer context only from rows the farmer owns. Weather comes only from cached provider readings.
- `prompts.ts`: system rules, JSON schemas and Zod validators, `<verified_data>` and `<user_message>` delimiters, input sanitising.
- `service.ts`: guards (AI enabled setting, per-user hourly rate limit), usage logging (`AIUsage`, `AIMessage` tokens and latency), fallbacks.
