# Licensed Workbook Delivery — Setup Guide

This is the automated flow: **customer pays → license generated → master Excel
personalized → private storage → temporary download link → "Your toolkit is
ready" email.** No accounts, no logins — yet it's the exact plumbing your
future web/mobile app will plug into.

## The flow (your 8 steps, as built)

```
1. Customer clicks Buy Now on intheblackbudget.com
2. Site calls create-checkout (Supabase Edge Function) → Stripe Checkout opens
      Customer enters: name, email, payment
3. Stripe processes the payment
4. Stripe calls stripe-webhook (Edge Function) — signature verified
5. Pipeline:
      license id  ITB-7K4X9P2M            (unique, DB-enforced)
      license + audit records written to Supabase
6. Master workbook copied; placeholders replaced:
      "License ID"    ITB-XXXXXXXX      → ITB-7K4X9P2M
      "Licensed To"   Customer Name / Email → John Smith / john@email.com
      (every other byte of the file — styling, charts, formulas — untouched)
7. File saved to private storage as:
      ITB_Premium_Toolkit_ITB-7K4X9P2M.xlsx
      Customer is redirected to download.html?session_id=... which polls
      get-download → fresh signed URL (temporary, expires) → file downloads
8. Welcome email built ("Your In The Black Premium Toolkit is ready" +
      "Download My Workbook" button → download.html?license=ITB-7K4X9P2M)
```

Everything runs in **Supabase Edge Functions** (database + private storage +
functions in one place). Your Netlify site stays static — it only calls the
functions, and `download.html` is served by Netlify like any other page.

## What's in this repo

| Path | What it is |
|---|---|
| `supabase/functions/create-checkout/` | Buy button → Stripe Checkout session |
| `supabase/functions/stripe-webhook/` | Payment → license pipeline |
| `supabase/functions/get-download/` | Fresh signed URLs for download.html |
| `supabase/functions/preview-email/` | Admin view of the stored welcome email |
| `supabase/functions/_shared/` | License gen, personalization, email, config, audit |
| `supabase/migrations/…licensing.sql` | Tables + private buckets + RLS |
| `assets/masters/*.xlsx` | Master workbooks (placeholders — swap in yours) |
| `scripts/seed-masters.mjs` | Upload masters to Supabase |
| `scripts/simulate-purchase.mjs` | Test the whole pipeline without Stripe |
| `scripts/demo-server.mjs` | Clickable demo of the full flow (`npm run demo`) |
| `download.html` | Customer delivery page (bookmarkable, mints fresh links) |

## Setup (one-time, ~30 minutes)

### 1. Supabase project + schema

1. [supabase.com](https://supabase.com) → New project (free tier is plenty).
2. SQL Editor → paste the contents of
   `supabase/migrations/20260814000000_licensing.sql` → Run.
   This creates `licenses`, `license_events`, `stripe_events`, the two
   private storage buckets, and locks them to the service role.

### 2. Stripe products + prices

1. [dashboard.stripe.com](https://dashboard.stripe.com) → Product catalog →
   create three one-time products (`In The Black Essentials` $19,
   `Complete` $39, and `Premium` at the $36 founding price).
2. Copy each **Price ID** (`price_...`) — they go into the secrets below.

### 3. Deploy the functions

Install the Supabase CLI (`brew install supabase` / `npm i -g supabase`),
then from this repo:

```bash
supabase login
supabase link --project-ref YOUR-PROJECT-REF
cp .env.supabase.example .env.supabase      # fill in your real values
supabase secrets set --env-file .env.supabase
supabase functions deploy create-checkout
supabase functions deploy stripe-webhook
supabase functions deploy get-download
supabase functions deploy preview-email
supabase functions deploy --no-verify-jwt preview-email   # only if CLI asks
```

> The functions are public HTTP endpoints (no JWT) on purpose — the site is
> static and calls them anonymously. Security comes from: Stripe signature
> verification on the webhook, private buckets, RLS-locked tables (service
> role only), and rate-limited signed links.

### 4. Point the site at the functions

Edit `content.json`:

```json
"functionsBaseUrl": "https://YOUR-PROJECT-REF.supabase.co/functions/v1"
```

Commit. Buy buttons now open Stripe Checkout; after payment customers land on
`download.html` and get their file. (Leave `stripeLinks`/`stripePaymentLink`
in place — they're the no-JS fallback.)

### 5. Upload your master workbooks

```bash
npm run masters        # regenerates placeholder masters (optional)
npm run seed           # uploads assets/masters/*.xlsx to Supabase
```

See `docs/MASTER_WORKBOOK_GUIDE.md` for preparing your real files — drop them
into `assets/masters/` (same filenames), run `npm run seed` again, done.

### 6. Stripe webhook

Stripe dashboard → Developers → Webhooks → Add endpoint:

- URL: `https://YOUR-PROJECT-REF.supabase.co/functions/v1/stripe-webhook`
- Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`
- Copy the **signing secret** (`whsec_...`) → `STRIPE_WEBHOOK_SECRET` → redeploy secrets.

### 7. Test it end-to-end

```bash
npm run simulate -- --product premium --name "Test Buyer" --email test@example.com
```

Prints the audit trail, writes the personalized file to `test-output/`, and
(with your Supabase creds in `.env`) inserts the real records and prints a
real signed URL.

Then run a **real Stripe test**:
- Put `sk_test_...` + `whsec_...` in secrets (or a test project), create test
  prices, buy with card `4242 4242 4242 4242`, any future expiry.
- Check the download page works, then look at the audit trail:

```sql
select * from license_audit where license_id = 'ITB-XXXXXXXX';
```

### 8. Email (later — the pipeline is already ready)

Until you connect a provider, emails are **rendered and stored** on each
license record (status `queued`). See exactly what the customer would get:

```
https://YOUR-PROJECT-REF.supabase.co/functions/v1/preview-email?license=ITB-XXXXXXXX&key=YOUR_ADMIN_KEY
```

When you're ready (recommended: [resend.com](https://resend.com), free tier
3,000/mo, 1-line API):

```bash
supabase secrets set EMAIL_PROVIDER=resend RESEND_API_KEY=re_... \
  EMAIL_FROM="In The Black Budget <noreply@intheblackbudget.com>"
supabase functions deploy stripe-webhook
```

No code changes. `email_status` flips to `sent` on every new purchase.

## Operations

**A payment failed mid-pipeline (rare):** the license row shows
`status = failed` with `error_message`. The pipeline is idempotent — open the
event in Stripe dashboard → **Resend webhook**, or re-run
`npm run simulate` with the same inputs. Nothing is ever double-issued.

**Customer lost their download:** they click their email link (or you look up
their license and send them
`https://intheblackbudget.com/download.html?license=ITB-XXXXXXXX`). The page
mints a fresh signed link. Links are rate-limited per license (default 20/day).

**Workbook update:** edit your master, `npm run seed`. New purchases get the
new file. Existing customers keep their issued file (and, later, the app/email
will point them to updates via their license row).

**Audit queries:**

```sql
-- every step for one license, in order
select created_at, step, status, detail
from license_events where license_id = 'ITB-XXXXXXXX' order by created_at;

-- all issued licenses
select license_id, product, customer_name, customer_email, created_at
from licenses where status = 'issued' order by created_at desc;

-- failures needing attention
select license_id, error_message, created_at
from licenses where status = 'failed' order by created_at desc;

-- raw Stripe events (payment audit)
select id, type, processed, license_id, received_at
from stripe_events order by received_at desc;
```

## Future: web + mobile app

When you add customer registration later, this schema is the foundation:

- `licenses.customer_email` links a purchase to a future user account
  (RLS policy: `customer_email = auth.jwt()->>'email'`).
- `download.html?license=…` already works as the "my workbook" page an
  account can link to.
- `license_events` becomes the activity feed ("your workbook was updated").
- The personalization core is portable — the same code can run when the app
  ships an update or a re-download.
