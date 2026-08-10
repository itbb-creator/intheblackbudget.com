# intheblackbudget.com — Editable Site + Marketing Hooks

This repo is now your **editable source of truth** for intheblackbudget.com. No more hunting through hosting dashboards.

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
1. vercel.com → Import `itbb-creator/intheblackbudget.com`
2. Framework: Other, no build command
3. In Squarespace Domains → DNS → point to Vercel (they give you the record)
4. Future edits auto-deploy in 30s

See `EDITING_GUIDE.md` for full steps + how to wire forms with Formspree (free).

## 💳 When you're ready to sell

1. Create Stripe Payment Link in Stripe Dashboard
2. Paste it into `content.json` → `stripePaymentLink`
3. Commit. Buy button goes live everywhere.

## 📣 Marketing

Open `MARKETING_HOOKS.md` — Tier 1 hooks are your first 3 ads. Copy-paste into Meta/TikTok Ads Manager today.

---
Built by Arena. Tell me what to change next.
