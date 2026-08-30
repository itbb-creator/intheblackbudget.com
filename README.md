# pravely.com — Editable Site + Marketing Hooks

This repo is now your **editable source of truth** for pravely.com. No more hunting through hosting dashboards.

## ⚡ Quick Edit (30 seconds, no code)

1. Open `content.json` → click ✏️ on GitHub → change price, Stripe link, or email → **Commit**
2. If connected to Vercel/Netlify/Cloudflare Pages, site auto-deploys. Done.

Or just tell your Arena agent: **"Change the price to $X"** — I'll do it.

## 📁 What's in here

- `index.html` — Full site (hero, 3 tabs, pricing, FAQ, forms). Search for text to edit.
- `content.json` — **Change price, Stripe link, email here.** No HTML needed.
- `EDITING_GUIDE.md` — 3 ways to edit, from easiest to most powerful. How to connect auto-deploy and wire forms.
- `MARKETING_HOOKS.md` — 27 research-backed ad hooks that make it *hard not to click* + 3 copy-paste ad packages for Meta/TikTok/YouTube + testing plan.
- `images/` — Drop your 3 screenshots here: `budget-input.png`, `dashboard.png`, `charts.png`

## 🚀 First-time setup (do once)

Connect to Vercel (free):
1. vercel.com → Import `itbb-creator/pravely.com`
2. Framework: Other, no build command
3. In Squarespace Domains → DNS → point to Vercel (they give you the record)
4. Future edits auto-deploy in 30s

See `EDITING_GUIDE.md` for full steps + how to wire forms with Formspree (free).

## 💳 Selling — licensed workbook delivery (automated)

Buy buttons → Stripe Checkout → webhook → license ID (`PRV-7K4X9P2M`) →
your master workbook personalized ("Licensed To: John Smith / john@email.com")
→ private storage → temporary download link → "Your toolkit is ready" email.

It runs on **Supabase Edge Functions** (this site stays static). Full walkthrough:
**`docs/LICENSED_DELIVERY_SETUP.md`**.

```bash
npm test              # verifies personalization on all three masters
npm run simulate -- --product premium --name "Test Buyer" --email test@example.com
```

Quick checklist when you're ready to go live:
1. Run `supabase/migrations/20260814000000_licensing.sql` in Supabase SQL Editor
2. Create your Stripe products/prices → deploy functions + secrets (guide has commands)
3. Drop your real master into `assets/masters/` → `npm run seed`
4. Set `functionsBaseUrl` in `content.json` → commit
5. Email: flip `EMAIL_PROVIDER=resend` later — the pipeline already renders & stores every email

## 📣 Marketing

Open `MARKETING_HOOKS.md` — Tier 1 hooks are your first 3 ads. Copy-paste into Meta/TikTok Ads Manager today.

---
Built by Arena. Tell me what to change next.
