# AgriFlow mobile API (v1)

REST API used by the Flutter app. Base URL: `https://agriflow-ai-wheat.vercel.app/api/v1`.
Implemented in `src/server/mobile/` (router + routes) on top of the **same service layer and
authorisation as the website** — a farmer sees exactly the same data in the app and on the web.

## Conventions

- JSON in and out. Uploads use `multipart/form-data`.
- Errors: `{ "error": { "code": "VALIDATION" | "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "RATE_LIMITED" | …, "message": "…", "fieldErrors": { "email": ["…"] } } }`
- Amounts are Zambian Kwacha (ZMW). Decimals are returned as strings (`"1250.50"`), dates as ISO 8601.
- Every route declares who may call it: public, any signed-in user, or a list of roles. The server
  checks it; hiding a button in the app is never the only protection.

## Authentication

| Endpoint | Body | Notes |
|---|---|---|
| `POST /auth/register` | fullName, email, phone, password, confirmPassword, country `ZM`, province, district, role, acceptTerms, deviceName | role ∈ FARMER, BUYER, SUPPLIER, TRANSPORTER, EXPERT, DISTRIBUTOR. Returns tokens + user + e-mail code delivery status |
| `POST /auth/login` | email, password, deviceName | 10 attempts / 15 min per e-mail |
| `POST /auth/refresh` | refreshToken | Rotates the refresh token |
| `POST /auth/logout` | refreshToken | Ends this device's session immediately |
| `POST /auth/logout-all` | — | Signs out every device and browser |
| `POST /auth/verify-email/send` · `POST /auth/verify-email` | — · code | 6-digit code, 10 min, 5 tries / 15 min |
| `POST /auth/forgot-password` · `POST /auth/reset-password` | email · email, code, password, confirmPassword | Same reply whether or not the account exists |
| `GET /auth/config` | — | Which social providers are configured, whether e-mail delivery is configured |

Tokens:
- **Access token**: HS256 JWT, 15 minutes, key derived from `AUTH_SECRET`. Send as `Authorization: Bearer …`.
- **Refresh token**: random 48 bytes, stored only as a SHA-256 hash, 30 days, **rotated on every use**.
  Presenting an already-used refresh token revokes the whole session family (theft detection), and
  revoked sessions stop working immediately (each request checks the family is still active).

## Resources (summary)

| Area | Endpoints |
|---|---|
| Me | `GET/PATCH /me`, `POST /me/onboarding`, `POST /me/avatar`, `POST /me/password`, `POST/DELETE /me/push-token` |
| Dashboard | `GET /dashboard` (greeting, location, weather + advice, farm overview, tasks, transactions, prices, notifications) |
| Reference | `GET /meta/regions` (public), `GET /meta/product-categories`, `GET /crops` |
| Farms | `GET/POST /farms`, `GET/PATCH/DELETE /farms/:id`, `/fields`, `/crop-records`, `/activities`, `/tasks`, `POST /tasks/:id/status`, `POST /sync` (offline queue) |
| Weather | `GET /weather?farmId=` · `?lat=&lng=` · `?province=&district=` (Open-Meteo, with source + fetch time) |
| AI | `GET /ai/status`, `GET /ai/conversations`, `GET/DELETE /ai/conversations/:id`, `POST /ai/chat`, `POST /ai/messages/:id/suggested-tasks/:i`, `POST /crop-records/:id/advice` |
| Crop health | `GET /crop-health`, `GET /crop-health/:id`, `POST /crop-health` (multipart: image, cropId, farmId?, symptoms), `POST /crop-health/:id/retry`, `POST /crop-health/:id/expert-review` |
| Experts | `GET /expert/status`, `GET /expert/cases`, `POST /expert/cases/:id/review` (verified experts only; no farmer identity exposed) |
| Marketplace | `GET /marketplace/listings` (q, crop, province, sort…), `GET /marketplace/listings/:id`, `GET /marketplace/my-listings`, `POST /marketplace/listings` (multipart photos), `PATCH …/:id`, `POST …/:id/status`, `GET /marketplace/products`, `GET /marketplace/products/:id`, `GET /marketplace/suppliers`, `POST /marketplace/report` |
| Sellers | `GET/POST /seller/products`, `PATCH /seller/products/:id`, `GET /seller/sales` |
| Prices | `GET /market-prices` (admin-recorded observations with source; farmers' asking prices separately), `GET /market-prices/:cropId/history` |
| Orders | `GET /orders?as=buyer|seller`, `GET /orders/:id` (+ `availableActions`), `POST /orders/purchase-request`, `POST /orders/input-order`, `POST /orders/:id/counter-offer`, `POST /orders/:id/accept-offer`, `POST /orders/:id/transition` |
| Messages | `GET /conversations`, `GET /conversations/:id`, `POST /messages` |
| Inventory | `GET/POST /inventory`, `PATCH/DELETE /inventory/:id`, `GET/POST /inventory/movements` |
| Logistics | `GET /deliveries`, `GET /deliveries/open`, `GET /deliveries/:id`, `POST /deliveries`, `POST /deliveries/:id/update` (multipart proof photo), `POST /deliveries/:id/decline`, `GET/POST /vehicles`, `GET /deliveries/transporters` |
| Finance | `GET /finance/summary?from=&to=`, `GET/POST /finance/transactions`, `DELETE /finance/transactions/:id`, `GET /finance/transactions.csv`, `GET/POST /finance/estimates` |
| Notifications | `GET /notifications`, `POST /notifications/read-all`, `POST /notifications/:id/read`, `GET /notification-preferences`, `PUT /notification-preferences/:type` |
| Uploads | `GET /uploads/:id` (owner, admin, delivery parties, or verified expert for shared cases) |
| Admin | `GET /admin/overview`, `/admin/analytics`, `/admin/users`, `POST /admin/users/:id/verify`, `POST /admin/users/:id/status`, `/admin/listings`, `POST /admin/listings/:id/moderate`, `POST /admin/products/:id/moderate`, `/admin/reports`, `POST /admin/reports/:id/resolve`, `POST /admin/market-prices`, `POST /admin/crops`, `/admin/ai-usage`, `/admin/transactions` |

Tests: `tests/integration/mobile-api.test.ts` (registration, codes, login, refresh rotation and reuse
detection, logout, password reset, role enforcement, data isolation, expert flow, distributor permissions).
