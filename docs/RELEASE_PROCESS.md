# Workbook release and update-email process

## One-time Resend setup

1. Create a Resend account and add a sending subdomain such as
   `updates.intheblackbudget.com`.
2. Add the SPF and DKIM records Resend provides to the domain's DNS. Add DMARC
   after delivery is confirmed.
3. Create a **Sending access** API key restricted to that domain.
4. Store these secrets locally and in Supabase Edge Function secrets; never
   commit their values:

   - `EMAIL_PROVIDER=resend`
   - `RESEND_API_KEY=re_...`
   - `EMAIL_FROM=In The Black <updates@updates.intheblackbudget.com>`
   - `SITE_URL=https://intheblackbudget.com`
   - `SUPPORT_EMAIL=ITBB@intheblackbudget.com`

5. Supabase secrets are available to hosted Edge Functions immediately. Deploy
   `stripe-webhook` only when its code changed, then complete a test purchase
   and confirm the welcome email arrives with the customer's stable
   licensed-download page.

For the full account, domain, test, and release-email walkthrough, see
`docs/RESEND_AND_UPDATE_EMAIL_SETUP.md`.

## Publish a workbook release

1. Assign a semantic version (`major.minor.patch`) and finish Excel and Google
   Sheets testing.
2. Add the two license placeholders required by `docs/MASTER_WORKBOOK_GUIDE.md`.
3. Upload the master to the private `workbook-masters` bucket using an immutable
   path such as `premium/1.1.0/premium.xlsx`.
4. In Supabase Table Editor, add a row to `product_releases` with the product,
   version, title, summary, Added/Changed/Fixed entries, and exact master path.
5. In one database transaction, unset the previous release's `is_current` flag
   and set the new release to `is_current = true` with `published_at = now()`.
6. Add the same public-facing notes to `changelog.html` and publish the site.
7. Confirm the recipients have `product_update_consent=true` and no
   `unsubscribed_at`, then preview the update audience without sending:

   `npm run email-release -- premium 1.1.0`

8. After reviewing the count and recipients, send:

   `npm run email-release -- premium 1.1.0 --send`

Each message contains that customer's existing
`/download.html?license=ITB-...` page. When opened, the page detects the current
release, personalizes the new master, stores the updated licensed copy, and
returns a fresh temporary download URL. Each update email also contains a
preference link and one-click unsubscribe headers. Unsubscribing does not
remove access to the licensed download page.
