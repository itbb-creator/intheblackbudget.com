# Limited paid-launch readiness

## Recommendation

Run a small, invitation-style paid launch before adding a full customer portal. The
current license-based delivery flow is enough for an introductory cohort once the
production setup checklist below passes. A login system would add support burden
without materially improving the first purchase experience.

## Required before accepting live payments

- Replace all three placeholder master workbooks with production files containing
  the required personalization tokens, then run the personalization tests.
- Insert the approved Terms of Use into `terms.html` and the complete Termly policy
  into `privacy.html`. Confirm both mention digital delivery, refunds, licensing,
  support data, Stripe, Supabase, Netlify, and the email provider actually used.
- Create Stripe products/prices in test mode, configure Supabase secrets, apply the
  licensing migration, deploy the four functions, and upload the masters.
- Set `functionsBaseUrl` in `content.json` and connect the GitHub `main` branch to
  Netlify. Confirm the custom domain and HTTPS are active.
- Complete one test purchase for each product and verify: correct amount, correct
  workbook, embedded license/name/email, database record, audit events, email,
  download, expiry, and support path.
- Repeat one purchase using a real low-value live payment, then refund it. This
  validates the live webhook and email configuration.

## Introductory cohort

- Limit the first cohort to roughly 10–25 buyers and label the offer as an
  introductory release without implying the workbook is unfinished.
- Use the existing feedback form for product ideas and the footer form for support,
  billing, complaints, and other requests. Netlify Forms can receive both initially.
- The feedback form separately asks permission to contact the buyer about using
  their words as a testimonial. Obtain explicit written approval for the final quote,
  name, and attribution before publishing it.
- Do not publish sample testimonials as real customer statements. Replace or remove
  any placeholder quotes before launch unless the named customers supplied them and
  approved publication.
- Review feedback after the first 5, 10, and 25 customers. Track issue category,
  product/version, severity, resolution, and whether a workbook update is required.

## Secure videos, accounts, and updates

### Now: license-gated resources without accounts

Keep the 100 MB videos out of product downloads and the Git repository. Host them on
a streaming service that supports signed playback or domain restrictions. Add a
`resources` table keyed by product and version, and mint short-lived video access
from a server function only after validating the buyer's email plus license ID.

For the limited launch, a simpler acceptable bridge is an unlisted, non-indexed
video page reached from the delivery email. It is convenient, not strong access
control, and should not be described as secure.

### Later: customer portal

Add Supabase Auth with passwordless email sign-in. Link licenses to `auth.users.id`
after verifying the purchase email; do not authorize from user-editable metadata.
Expose a minimal customer-facing view with `security_invoker = true` and ownership
RLS based on `auth.uid()`. Keep Stripe events, license audit details, storage paths,
and service credentials private.

The portal can then show downloads, product-specific videos, a changelog, and the
latest eligible workbook version. Use versioned immutable master files and a
`product_releases` table rather than overwriting a master when existing customers
should receive updates. Notify eligible license holders by email and let the portal
mint a fresh short-lived download URL.

## Current architecture assessment

Already implemented: Stripe Checkout creation, signed webhook verification,
idempotent Stripe event storage, unique licenses, workbook personalization, private
Supabase buckets, temporary download URLs, download throttling, audit events, and a
Resend-ready welcome email.

Still configuration-dependent: live Supabase project/schema, deployed functions,
production workbooks, Stripe products and webhook, verified sending domain, Netlify
Git deployment, legal text, and end-to-end live-mode verification. Customer login,
secure video entitlements, release/version records, and update distribution are not
implemented yet and are best treated as the next phase after the limited launch.
