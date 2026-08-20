# Resend and customer update email setup

The codebase already sends two kinds of transactional email:

1. A purchase email after Stripe confirms payment. It contains the customer's stable licensed download page.
2. A release-update email for an eligible workbook version. It reuses that same licensed download page, which prepares the latest eligible version and creates a fresh temporary file link.

## 1. Create and secure the Resend account

1. Create the account at https://resend.com using the business owner's email address.
2. Turn on multi-factor authentication.
3. Add the sending subdomain `updates.intheblackbudget.com` under **Domains**.
4. Add every SPF and DKIM record Resend provides to the domain's DNS provider.
5. Return to Resend and wait for the domain to show **Verified**.
6. Add DMARC after test messages are arriving correctly. Start with a monitoring policy before enforcing quarantine or rejection.

Use a sender such as:

`In The Black Budget <updates@updates.intheblackbudget.com>`

Make sure replies reach `ITBB@intheblackbudget.com`. Either configure forwarding for the sender or add a reply-to address in the sending code before telling customers to reply.

## 2. Create a restricted API key

1. In Resend, open **API Keys** and create `itb-production-supabase`.
2. Choose sending access and restrict the key to `updates.intheblackbudget.com` when available.
3. Copy the key once and store it in a password manager. Never commit it to this repository.

## 3. Add Supabase Edge Function secrets

In the Supabase dashboard, open **Edge Functions → Secrets** and add:

```text
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_...
EMAIL_FROM=In The Black Budget <updates@updates.intheblackbudget.com>
SITE_URL=https://intheblackbudget.com
SUPPORT_EMAIL=ITBB@intheblackbudget.com
```

Also create the Stripe $36 one-time Premium price and add its Price ID as:

```text
STRIPE_PRICE_PREMIUM_FOUNDING=price_...
```

Supabase makes secret changes available to hosted Edge Functions immediately; changing secrets alone does not require a redeploy. Redeploy only when function code has changed.

## 4. Test the purchase email

1. Use Stripe test mode and the $36 founding Price ID.
2. Complete a Premium purchase with an email address you control.
3. In Stripe, confirm the Checkout Session is paid and the webhook succeeded.
4. In Supabase, confirm a license row was issued and `email_provider` is `resend`.
5. In Resend, confirm the message was accepted and delivered.
6. Open the message and verify the customer name, product, license ID, and download button.
7. Open the licensed page. Confirm it creates a fresh temporary download and the workbook opens.
8. Reply to the message and verify the reply reaches the support inbox.
9. Repeat with at least one Gmail address and one Outlook address before launch.

## 5. Publish a workbook update

1. Assign the release a semantic version, such as `1.1.0`.
2. Test the workbook in Excel and Google Sheets.
3. Upload the new master to the private `workbook-masters` bucket using an immutable path, for example `premium/1.1.0/premium.xlsx`.
4. Add a `product_releases` row with the exact storage path, public title and summary, and `added`, `changed`, and `fixed` items.
5. Mark the new release current and unmark the previous release in one database transaction.
6. Add the same customer-facing notes to `/changelog` and deploy the website.
7. Load `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `SITE_URL`, and `SUPPORT_EMAIL` into a private local environment.
8. Preview the audience without sending:

```text
npm run email-release -- premium 1.1.0
```

9. Review the count and recipients. Send a test message to yourself before emailing the cohort.
10. Send the release message:

```text
npm run email-release -- premium 1.1.0 --send
```

Each message contains the customer's existing link in this form:

`https://intheblackbudget.com/download.html?license=ITB-...`

That stable page checks the current eligible release, personalizes the new workbook when needed, stores the licensed copy privately, and issues a new time-limited download URL.

## 6. Consent and unsubscribe behavior

The checkout page presents two separate, optional boxes. Both are unchecked by
default:

1. Workbook release notices and founding-customer check-ins.
2. Promotional marketing such as tips, product news, and offers.

The purchase receipt and licensed-download email are fulfillment messages and
are sent regardless of those choices. Stripe Checkout metadata carries the two
choices into the license record together with the time and consent source.

The release-update script selects only issued licenses where
`product_update_consent=true` and `unsubscribed_at` is empty. Every message
contains the customer's preference page and the RFC 8058 `List-Unsubscribe`
headers used by supporting email clients. A one-click unsubscribe clears both
optional categories. The preference page can turn either category back on.

Before the first update campaign:

1. Deploy the `email-preferences` Edge Function and the website rewrite.
2. Complete a test purchase with update consent selected.
3. Open the email preference link and clear workbook updates.
4. Run the release-email dry run and confirm that license is excluded.
5. Re-enable workbook updates, rerun the dry run, and confirm it is included.

For promotional campaigns, use a Resend Broadcast scoped to a marketing Topic,
but add only customers whose license record has `marketing_consent=true` and no
`unsubscribed_at`. Never use the release-update recipient query as a marketing
list. Keep consent evidence in Supabase as the source of truth even when Resend
also records the Topic preference.

## 7. Founding cohort communication terms

- The $36 Premium founding price is a one-time purchase, not a subscription.
- The offer can close or change for future purchasers.
- Feedback is appreciated but is not a condition of receiving the price.
- The 7- and 14-day invitations are sent only to buyers who select the workbook
  update/check-in choice.
- Testimonial publication requires a separate explicit permission.
- Withdrawing email consent never removes a license or download access.
