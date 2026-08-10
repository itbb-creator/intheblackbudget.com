# How to edit intheblackbudget.com — the easiest way

You have 3 options, from easiest (no code) to most powerful. Pick one.

---

## OPTION 1: Just tell Arena (easiest right now)

You are in Arena. You can just say:

> "Change the price to $24, update the hero to say 'The $19 spreadsheet that replaces your $15/mo app', and swap the screenshots"

I will edit `index.html` / `content.json` and push the change live. No hosting dashboard needed.

**This repo is now your source of truth.** I built it to mirror your live site but make every piece editable in minutes.

---

## OPTION 2: Edit directly on GitHub (no install, 30 seconds)

This is the best long-term if you don't want to touch code or ask an AI.

1. Go to `https://github.com/itbb-creator/intheblackbudget.com` on your phone or laptop
2. Open `content.json` → click ✏️ pencil icon
3. Change what you want:
   ```json
   "price": "$19",
   "compareAtPrice": "$29",
   "stripePaymentLink": "https://buy.stripe.com/...paste your real link here...",
   "contactEmail": "hello@intheblackbudget.com"
   ```
4. Click **Commit changes**

If you connect this repo to **Netlify / Vercel / Cloudflare Pages** (one-time, 2 minutes), that commit auto-deploys to your live site. No FTP, no file manager.

**To change copy beyond price/email:** open `index.html`, hit pencil, search for the text you want (e.g., `Budgeting apps want`), edit it, commit.

> Pro tip: In GitHub, press `.` (period) to open a VS Code editor in your browser. It's like Google Docs for your site.

---

## OPTION 3: Edit via your current hosting dashboard

Your live site is currently on **AWS (IP 75.2.60.5 via CloudFront)** and your domain is managed at **Squarespace (formerly Google Domains)**. So:

- **Domain (Squarespace):** You do NOT need to touch this to edit the site. It just points `intheblackbudget.com` → your host's IP. Leave it.
- **Site files (AWS S3 + CloudFront):** 
  - Log into AWS Console → S3 → find your bucket → upload a new `index.html`
  - Then CloudFront → Invalidate cache `/*` so visitors see the change

This works but is slower than Option 2. **Recommended: move hosting to Vercel/Netlify/Cloudflare Pages (free) and connect this GitHub repo.** Then you never log into AWS again.

### One-time setup to make Option 2 auto-deploy (do this once):

**Vercel (recommended, free):**
1. Go to vercel.com → Add New Project → Import `itbb-creator/intheblackbudget.com`
2. Framework: `Other` (static), no build command needed
3. Deploy → copy the Vercel URL
4. In Squarespace → Domains → DNS → change A record / CNAME to point to Vercel (Vercel shows you exactly what to paste)
5. Done. Every future `content.json` edit auto-deploys in ~30 seconds.

Same steps work for **Netlify** or **Cloudflare Pages**.

---

## What to edit for common tasks

| You want to... | Edit this file | Find this text |
|---|---|---|
| Change price / Stripe link / email | `content.json` | `price`, `stripePaymentLink`, `contactEmail` |
| Change headline | `index.html` | `Budgeting apps want` |
| Swap screenshots | `index.html` | `/images/budget-input.png` — replace with real files in `/images/` |
| Add a testimonial | `index.html` | Copy one `bg-zinc-900` block in Social Proof section |
| Change FAQ | `index.html` | `Good questions` section → edit `<details>` blocks |
| Wire up forms | `EDITING_GUIDE.md` → Forms section below |  |

---

## Wiring up forms (2 minutes, free)

Your feedback & contact forms are placeholders. Connect them:

**Formspree (free tier):**
1. Go to formspree.io → create form → copy endpoint `https://formspree.io/f/xxxx`
2. In `index.html`, change `<form id="feedback-form">` to `<form action="https://formspree.io/f/xxxx" method="POST">`
3. Remove the `alert(...)` JS at bottom. Push.

**Alternative free:** Tally.so or Google Forms (embed link).

---

## Images

Create folder `/images/` and drop in:
- `budget-input.png`
- `dashboard.png`
- `charts.png`

They will auto-show where the gray placeholders are.

---

## Need help?

Just say: **"Update the site: [describe change]"** and I will do it, push it, and give you a preview link.
