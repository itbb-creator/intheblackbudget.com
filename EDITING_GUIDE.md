# How to edit intheblackbudget.com — the easiest way

You have 3 options, from easiest (no code) to most powerful. Pick one.

---

## OPTION 1: Just tell Arena (easiest right now)

You are in Arena. You can just say:

> "Change Premium to $59, update the hero to say 'The $19 spreadsheet that replaces your $15/mo app', and swap the screenshots"

I will edit `index.html` / `content.json` and push the change live. No hosting dashboard needed.

**This repo is now your source of truth.** I built it to mirror your live site but make every piece editable in minutes.

---

## OPTION 2: Edit directly on GitHub (no install, 30 seconds)

This is the best long-term if you don't want to touch code or ask an AI.

1. Go to `https://github.com/itbb-creator/intheblackbudget.com` on your phone or laptop
2. Open `content.json` → click ✏️ pencil icon
3. Change what you want:
   ```json
   "contactEmail": "ITBB@intheblackbudget.com",
   "stripeLinks": {
     "essentials": "https://buy.stripe.com/...essentials",
     "complete": "https://buy.stripe.com/...complete",
     "premium": "https://buy.stripe.com/...premium"
   }
   ```
   To change prices: edit `pricing.essentials.price`, `pricing.complete.price`, `pricing.premium.price`
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

**Netlify (Recommended & pre-configured with `netlify.toml`):**
1. Go to [netlify.com](https://app.netlify.com/) → **Add new site** → **Import an existing project** → Connect to GitHub (`itbb-creator/intheblackbudget.com`)
2. Build settings: 
   - Build command: *(leave empty)*
   - Publish directory: `.`
3. Click **Deploy site**.
4. (Optional) In Netlify → Domain settings, add custom domain `intheblackbudget.com` and update DNS records in Squarespace.
5. Done! Every future edit to `content.json` or `index.html` auto-deploys in ~30 seconds.

**Vercel (Alternative, free):**
1. Go to vercel.com → Add New Project → Import `itbb-creator/intheblackbudget.com`
2. Framework: `Other` (static), no build command needed
3. Deploy → copy URL and configure DNS.

---

## What to edit for common tasks

| You want to... | Edit this file | Find this text |
|---|---|---|
| Change price / Stripe link / email | `content.json` | `pricing.*`, `stripeLinks.*`, `contactEmail` |
| Change headline | `index.html` | `Budgeting apps want` |
| Change pricing cards (features) | `index.html` | `In The Black<br>Essentials` / `Complete` / `Premium` |
| Change hook banner | `index.html` | `$49 ONCE` `still crushes $109/yr` |
| Swap screenshots | `index.html` | `/images/budget-input.png` — replace with real files in `/images/` |
| Change logo / favicon | `images/logo.svg` + `favicon.svg` + `images/logo.png` / `favicon.png` | See below |
| Change FAQ | `index.html` | `Good questions` section → edit `<details>` blocks |
| Wire up forms | This file → “How forms work now” below | — |

---

## How forms work now (Send feedback + Send message)

**Both buttons now work out-of-the-box — no Formspree needed.** They open the visitor's own email app with a pre-filled email to `ITBB@intheblackbudget.com`.

- **Get in touch → Send message:** grabs Name + Email + Message → `mailto:ITBB@intheblackbudget.com?subject=Message from [Name]&body=...` — visitor just hits Send in Apple Mail / Gmail.
- **Feedback → Send feedback:** grabs the pills they checked (Debt payoff, Home affordability…) + "Tell us more" + optional email → `mailto:ITBB@intheblackbudget.com?subject=Feedback — [picked]&body=...`

**Why mailto?** It's free, no backend, no spam database, and the email lands in your real inbox. The tradeoff: if the visitor doesn't have a mail app set up (rare on mobile, more common on desktop), it will prompt them to open one.

**Upgrade later (optional, better analytics):** If you want submissions saved automatically without opening email:
1. Go to **formspree.io** → New Form → copy endpoint `https://formspree.io/f/xxxxx`
2. In `index.html`, find `<form id="contact-form"` and add `action="https://formspree.io/f/xxxxx" method="POST"` (same for `feedback-form`)
3. Remove the `window.location.href = mailto...` JS at the bottom (or keep both — mailto will still work as fallback)
4. Push. Formspree will now email you *and* save in a dashboard.

Your current `EDITING_GUIDE.md` → Forms section still has the 2-minute Formspree steps if you decide to switch.

**To change the destination email:** edit `content.json` → `contactEmail` *and* search `ITBB@intheblackbudget.com` in `index.html` (appears in 4 places: contact section + 2 forms + JS).

---

## Logo & favicon (browser tab)

Your red/green overlapping circles are now:

- `images/logo.svg` — vector logo (used in header nav)
- `images/logo.png` — transparent PNG (3.8KB) for fallback
- `favicon.svg` + `favicon.png` (32x32) — shown in browser tab
- `images/apple-touch-icon.png` (180x180) — shown when someone bookmarks on iPhone home screen

**To replace the logo:** overwrite `images/logo.svg` and `favicon.svg` with your new file (keep same filename) and run this once if you have Pillow:
```bash
python3 -c "from PIL import Image; img=Image.open('images/logo.png'); ... # see git history"
```
Or just tell Arena: "Swap the logo for [upload file]" and I'll regenerate all favicon sizes.

In `index.html` the header uses:
```html
<img src="./images/logo.svg" ...> IN THE BLACK — BUDGET
```
and the tab uses:
```html
<link rel="icon" href="./favicon.svg">
<link rel="icon" href="./favicon.png">
```

---

## Pricing — 3 products

- **In The Black Essentials — $19** (was $29): Basic budget sheet only. Starter.
- **In The Black Complete — $39**: Advanced alone — debt snowball/avalanche, net worth, mortgage, multi-month. 
- **In The Black Premium — $49** (was $58): **Both combined + Exclusive Annual Review tab**. Marked MOST POPULAR • BEST VALUE. `$49 once still crushes $109/yr` hook is the black pill banner under the pricing title.

Edit prices/links in `content.json` → `pricing` and `stripeLinks`.

All prices are one-time. No subscription.

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
