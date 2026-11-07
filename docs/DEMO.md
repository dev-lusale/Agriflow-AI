# Hackathon demo script (about 4 minutes)

## Before you present

1. `npm run db:seed` for fresh demo data. Keep `DEMO_MODE=true`.
2. Set `XAI_API_KEY` and confirm `/api/health` shows `"ai":"configured"`. Without a key, AI answers are labelled "Built-in guidance", so the demo still works.
3. Open the site and log in once with each demo button to warm up the pages.
4. Have a crop photo (JPEG/PNG under 5 MB) on the device, for example maize leaf damage.
5. Optional: install the PWA on a phone ("Add to Home screen") to show the mobile experience.

All demo people, businesses, prices and weather samples are fictional and labelled **Demo**.

---

### 0:00–0:30 · The problem
Home page, "The problem" section. Zambian farmers juggle scattered advice, opaque markets, uncoordinated inputs and transport, and invisible profit. Few extension officers reach each farmer, and pests like fall armyworm are found late.

### 0:30–1:00 · Introduce AgriFlow AI
Scroll the hero and features. One app links farm records, Grok intelligence, the marketplace, inputs, logistics and finance. The counts at the top come live from the database.

### 1:00–1:45 · Farm management (log in with **Farmer**)
- Dashboard: Joseph Mwale, Choma, 5 ha. Show active crops with growth stages, real Open-Meteo weather (source and time shown), and upcoming tasks.
- **Farms → Mwale Family Farm → Add crop**: Maize, SC 513, planting 1 Dec, expected harvest 20 Apr. A harvest reminder appears on the **Calendar** automatically.
- **Record activity** (Fertilizer application, K 1,200, "Also record as expense"). Mention that this works offline.

### 1:45–2:30 · Grok
- **AI Assistant**: "When should I plant maize this season?" The answer uses Joseph's district, crops and planting dates and is labelled "Used your farm records". Click a suggested task and confirm before it is added. The AI cannot change data by itself.
- **Crop Health**: upload the photo and describe the symptoms, then **Analyse with Grok**. Show the likely issue, confidence explanation, ranked causes, next steps, safety note, and the expert-inspection flag. Point out that this is not a definitive diagnosis.
- Explain the design: the backend computes every figure, and Grok explains it.

### 2:30–3:15 · Marketplace
- **My listings**: show the maize listing. Then sign in as **Buyer**, open **Marketplace**, search "maize", and open the listing. Send a purchase request for 20 bags with an offer of K 330.
- Sign in as **Farmer**: show the notification, open the order, **Make a counteroffer** at K 345. Sign in as **Buyer**: **Accept this offer**, then **Confirm purchase**. Stock is reserved and the status timeline updates.

### 3:15–3:40 · Logistics & finance
- As Buyer on the order: **Request transport**. Sign in as **Transporter**: **Requests → Review & accept** (fee K 2,400) → **Record pickup**. The order moves to "In transit" automatically.
- As **Farmer**: **Finances** shows income vs expenses, profit by crop, actuals vs estimates, and the PDF download. Then **Ask Grok to explain**.

### 3:40–4:00 · Administration & AI business intelligence (log in with **Admin**)
- **Overview**: farmers, farms, hectares, listings, orders, sales, and charts, all from live data.
- **AI intelligence**: "Summarise agricultural marketplace activity this month." Grok receives aggregated statistics only.
- **Reports → Generate report → Download PDF**. Close on the slogan.

## If something fails live
- AI down: answers switch to labelled built-in guidance, and crop-health assessments are saved with a **Retry** button.
- Weather down: the last saved reading is shown with a warning.
- No network: open `/offline`, record an activity, and show "Saved locally · awaiting sync".
