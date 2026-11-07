# Troubleshooting

| Symptom | Cause & fix |
|---|---|
| `npm install` fails with `'node' is not recognized` (Windows, Git Bash) | npm's install scripts run under `cmd.exe` and can't see the Git Bash PATH. Run `npm install` from PowerShell or cmd. |
| `Can't reach database server at localhost:5544` | Start the local DB: `npm run db:local` (keep it running), or point `DATABASE_URL` at your own Postgres. |
| `The table ... does not exist` | Run `npx prisma migrate deploy`. |
| Demo buttons say "Demo accounts are not seeded" | Run `npm run db:seed` (requires `DEMO_PASSWORD`). |
| `AUTH_SECRET must be set in production` | Set `AUTH_SECRET` in your production environment. |
| AI answers are labelled "Built-in guidance" | `XAI_API_KEY` is missing or invalid, or xAI is unreachable. Check `/api/health` (`ai`), **Admin → Analytics → AI usage** (errors), and the server logs (`xAI HTTP …`). Also check **Admin → Settings → AI features enabled**. |
| "Too many requests" from the assistant | The per-user hourly AI limit was reached. Change it in **Admin → Settings** (`ai.hourlyLimitPerUser`). |
| Crop-health "AI analysis unavailable" | The photo and description are saved. Use **Retry analysis** once AI is available. Vision needs a model that accepts image input (`XAI_VISION_MODEL`, default `grok-4.7`). |
| Weather says "Location needed" | The farm's district has no reference point. Add GPS to the farm (**Edit → Use my current location**). |
| Weather shows "last saved reading" | Open-Meteo is unreachable from the server. Check outbound internet access from the host. |
| Images don't upload | Use JPEG/PNG/WebP under 5 MB (JPEG/PNG for crop health). On Vercel without Supabase storage, images are stored in Postgres, which is fine for demos. |
| PWA doesn't install or `/offline` is blank offline | The service worker registers only in production (`npm run build && npm start`) over HTTPS or localhost. Visit `/offline` once while online so the farm list is cached. |
| Offline item stuck on "Sync failed" | Open `/offline` to see the reason. Validation failures (e.g. a deleted farm) need your action: retry or discard. Network failures retry automatically with backoff. |
| `Not enough stock left on this listing to confirm` | Another buyer confirmed first. The farmer can increase the quantity or the order can be cancelled. |
| Tests fail with a database error | `npm test` uses `agriflow_test` on the local DB (created by `npm run db:local`), or set `TEST_DATABASE_URL`. |
| Playwright can't find the browser | `npx playwright install chromium`. |
