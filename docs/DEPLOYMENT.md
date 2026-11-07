# Deployment guide: GitHub, Vercel and Supabase

## 1. Supabase (database + optional storage)

1. Create a Supabase project (choose a region close to Zambia, e.g. Frankfurt or Cape Town if available).
2. **Settings → Database → Connection string**:
   - `DATABASE_URL`: the **pooled** connection (Supavisor, port 6543), adding `?pgbouncer=true&connection_limit=1`.
   - `DIRECT_URL`: the **direct** connection (port 5432). Migrations use this.
3. Optional storage: **Storage → New bucket** `agriflow-uploads`, **private**. Copy `NEXT_PUBLIC_SUPABASE_URL` and the `service_role` key (`SUPABASE_SERVICE_ROLE_KEY`, server-side only). Without these, uploads are stored in Postgres.
4. Apply migrations from your machine:
   ```bash
   DATABASE_URL="<direct url>" DIRECT_URL="<direct url>" npx prisma migrate deploy
   ```
   The `row_level_security` migration enables RLS on every table and revokes the `anon` and `authenticated` roles, so Supabase's auto-generated REST and GraphQL APIs cannot read app data. The app connects as the table owner through Prisma and enforces authorisation in its services.

## 2. GitHub

```bash
git remote add origin git@github.com:<you>/agriflow-ai-zambia.git
git push -u origin main
```
`.env`, `.local-db/` and build output are git-ignored. Never commit secrets.

## 3. Vercel

1. **Import** the GitHub repository (framework: Next.js; build command `npm run build`, which runs `prisma generate`).
2. **Environment variables** (Production and Preview kept separate; use a separate database for previews):

| Variable | Example / note |
|---|---|
| `DATABASE_URL` | Supabase pooled URL |
| `DIRECT_URL` | Supabase direct URL |
| `AUTH_SECRET` | 64 random hex chars (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`). **Required in production** |
| `APP_URL` | `https://<your-domain>` |
| `XAI_API_KEY` | from console.x.ai (server only) |
| `XAI_MODEL` / `XAI_VISION_MODEL` | `grok-4.7` |
| `AI_HOURLY_LIMIT` | `30` |
| `WEATHER_PROVIDER` | `open-meteo` (no key needed). `WEATHER_API_KEY` is reserved for future providers |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` | optional storage |
| `RESEND_API_KEY`, `EMAIL_FROM` | optional email delivery |
| `DEMO_MODE` | `true` only for a judged demo deployment, `false` for real users |
| `DEMO_PASSWORD` | demo deployments only: your own strong password |

3. Deploy. Then open `https://<domain>/api/health`. You should see `"status":"ok","database":"ok"` and the expected `ai` and `storage` values.

## 4. Data

- **Demo deployment:** run the seed once against the deployment database:
  `SEED_ALLOW_PRODUCTION=true DEMO_PASSWORD=<strong> DATABASE_URL=<direct> npx tsx prisma/seed.ts`
  This **wipes all tables first**.
- **Real launch:** do **not** seed. Create the first super administrator with a one-off script or SQL, using a strong password, then create other admins in **Admin → User management**. Add crops and categories in **Admin → Crops & regions**.

## 5. Post-deploy checklist

- [ ] `/api/health` is ok; the database is reachable.
- [ ] Register a test account and confirm email behaviour (sent via Resend, or `NOT_CONFIGURED` in the admin outbound log).
- [ ] Sign in and confirm the role redirect; `/admin` is blocked for non-admins.
- [ ] Upload a photo (crop health) and confirm it displays. With Supabase, check the object in the private bucket.
- [ ] Ask the AI assistant a question. The answer should be labelled "Grok".
- [ ] Weather loads for a farm, with source and time shown.
- [ ] The PWA installs (Chrome → Install app) and `/offline` works in airplane mode.
- [ ] Security headers are present (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`).

> Only claim a deployment works after checking the deployed URL with the checklist above.

## Migrations workflow

- Development: `npm run db:migrate -- --name <change>` creates a new migration.
- Production and CI: `npm run db:deploy` applies the pending ones. Never use `migrate dev` or `db:reset` on production.
