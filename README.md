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

## 🚀 First-time setup & Netlify Deployment (do once)

Connect to **Netlify** (recommended & configured via `netlify.toml`):
1. Go to [netlify.com](https://app.netlify.com/) → **Add new site** → **Import an existing project** → Connect to GitHub
2. Select repository `itbb-creator/intheblackbudget.com`
3. Branch: `arena/019fede1-intheblackbudget-com` (or `main`)
4. Build settings: 
   - Build command: *(leave blank)*
   - Publish directory: `.` (or root)
5. Click **Deploy site**.
6. (Optional) In Netlify → Domain settings → Custom domains, add `intheblackbudget.com` and update your DNS records at Squarespace / your registrar.
7. Future edits to `content.json` or `index.html` auto-deploy in ~30 seconds!

*(Alternatively works with Vercel or Cloudflare Pages using same settings).*

## 💳 When you're ready to sell

1. Create Stripe Payment Link in Stripe Dashboard
2. Paste it into `content.json` → `stripePaymentLink`
3. Commit. Buy button goes live everywhere.

## 📣 Marketing

Open `MARKETING_HOOKS.md` — Tier 1 hooks are your first 3 ads. Copy-paste into Meta/TikTok Ads Manager today.

---
Built by Arena. Tell me what to change next.
