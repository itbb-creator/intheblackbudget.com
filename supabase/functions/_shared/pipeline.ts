/**
 * The licensing pipeline — one function that turns a paid Stripe checkout
 * session into a personalized, privately-stored, downloadable workbook.
 *
 * Steps (each logged to license_events — the audit trail):
 *   1. payment_received  (recorded by the caller)
 *   2. license_generated
 *   3. master_fetched
 *   4. workbook_personalized
 *   5. workbook_uploaded
 *   6. signed_url_created
 *   7. email_queued / email_sent
 *
 * Idempotent: safe to re-run for the same Stripe session (Stripe webhook
 * retries, manual resends from the Stripe dashboard). A completed license
 * is never regenerated; a previously failed one is retried from scratch.
 *
 * Deno edge runtime only.
 */

import { getProduct, BUCKETS, siteUrl, supportEmail, downloadLinkTtlSeconds } from './config.ts';
import { generateLicenseId } from './license.ts';
import { personalizeWorkbook, type PersonalizeResult } from './personalize.ts';
import { dispatchWelcomeEmail, type WelcomeEmailContext } from './email.ts';
import { getSupabase } from './supabase.ts';
import { logLicenseEvent, STEPS } from './audit.ts';
import { envGet } from './config.ts';

export interface PurchaseInfo {
  sessionId: string;
  customerId?: string | null;
  paymentIntent?: string | null;
  customerName: string;
  customerEmail: string;
  productId: string;
  productUpdateConsent?: boolean;
  marketingConsent?: boolean;
  consentSource?: string;
}

export interface PipelineResult {
  status: 'issued' | 'already_issued';
  licenseId: string;
  fileName: string;
  signedUrl: string;
  downloadPageUrl: string;
  email: { provider: string; messageId?: string };
  replacements: PersonalizeResult['replacements'];
}

const MAX_ID_ATTEMPTS = 5;

interface CurrentRelease {
  id: string;
  version: string;
  master_path: string;
}

export async function runLicensePipeline(purchase: PurchaseInfo): Promise<PipelineResult> {
  const sb = getSupabase();
  const product = getProduct(purchase.productId);
  if (!product) {
    throw new Error(`Unknown product id: ${purchase.productId}`);
  }

  // Idempotency gate — a session that already produced a workbook must not
  // produce a second one, no matter how many times Stripe retries.
  const { data: existing } = await sb
    .from('licenses')
    .select('license_id, status')
    .eq('stripe_session_id', purchase.sessionId)
    .maybeSingle();

  if (existing && existing.status === 'issued') {
    return {
      status: 'already_issued',
      licenseId: existing.license_id,
      fileName: '',
      signedUrl: '',
      downloadPageUrl: `${siteUrl()}/download.html?license=${existing.license_id}`,
      email: { provider: 'skipped' },
      replacements: [],
    };
  }

  // 1. License ID (uniqueness enforced by the DB; retry on the rare collision).
  let licenseId = '';
  for (let attempt = 1; attempt <= MAX_ID_ATTEMPTS; attempt++) {
    const candidate = generateLicenseId();
    const { count } = await sb
      .from('licenses')
      .select('id', { count: 'exact', head: true })
      .eq('license_id', candidate);
    if (!count) {
      licenseId = candidate;
      break;
    }
  }
  if (!licenseId) {
    throw new Error(`Could not allocate a unique license id after ${MAX_ID_ATTEMPTS} attempts.`);
  }

  // Create/refresh the license row up front so every step has an anchor.
  const rowUpsert = {
    license_id: licenseId,
    product: product.id,
    stripe_session_id: purchase.sessionId,
    stripe_customer_id: purchase.customerId ?? null,
    stripe_payment_intent: purchase.paymentIntent ?? null,
    customer_name: purchase.customerName,
    customer_email: purchase.customerEmail,
    product_update_consent: purchase.productUpdateConsent === true,
    marketing_consent: purchase.marketingConsent === true,
    consent_recorded_at: new Date().toISOString(),
    consent_source: purchase.consentSource ?? 'stripe_checkout',
    status: 'pending',
  };
  const { error: upsertErr } = existing
    ? await sb.from('licenses').update(rowUpsert).eq('license_id', licenseId)
    : await sb.from('licenses').insert(rowUpsert);
  if (upsertErr) throw new Error(`License insert failed: ${upsertErr.message}`);

  await logLicenseEvent(sb, { licenseId, step: STEPS.licenseGenerated, status: 'ok', detail: product.id });

  // 2. Current release master workbook from private storage. Before the first
  // versioned release is published, fall back to the original master path.
  const { data: currentRelease, error: releaseErr } = await sb
    .from('product_releases')
    .select('id, version, master_path')
    .eq('product', product.id)
    .eq('is_current', true)
    .maybeSingle<CurrentRelease>();
  if (releaseErr) throw new Error(`Release lookup failed: ${releaseErr.message}`);
  const masterPath = currentRelease?.master_path ?? product.masterPath;

  // 2. Master workbook from private storage.
  const { data: masterBlob, error: masterErr } = await sb.storage
    .from(BUCKETS.masters)
    .download(masterPath);
  if (masterErr || !masterBlob) {
    throw new Error(
      `Master "${masterPath}" missing from bucket "${BUCKETS.masters}" — ` +
        `run "npm run seed" to upload it (${masterErr?.message ?? 'not found'}).`,
    );
  }
  const masterBytes = new Uint8Array(await masterBlob.arrayBuffer());
  await logLicenseEvent(sb, {
    licenseId,
    step: STEPS.masterFetched,
    status: 'ok',
    detail: `${masterPath} (${masterBytes.length} bytes)`,
  });

  // 3. Personalize: swap placeholders, preserve everything else byte-for-byte.
  const personalized = personalizeWorkbook({
    masterBytes,
    licenseId,
    customerName: purchase.customerName,
    customerEmail: purchase.customerEmail,
  });
  const replaced = personalized.replacements.filter((r) => r.found).map((r) => r.token);
  await logLicenseEvent(sb, {
    licenseId,
    step: STEPS.personalized,
    status: 'ok',
    detail: `tokens replaced: ${replaced.join(', ')}`,
  });

  // 4. Upload the customer's file to private storage.
  const fileName = `${product.fileNamePrefix}_${licenseId}.xlsx`;
  const filePath = currentRelease
    ? `${product.id}/${currentRelease.version}/${fileName}`
    : `${product.id}/${fileName}`;
  const { error: uploadErr } = await sb.storage.from(BUCKETS.licensed).upload(filePath, personalized.bytes, {
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    cacheControl: 'private, no-store',
    upsert: true,
  });
  if (uploadErr) throw new Error(`Workbook upload failed: ${uploadErr.message}`);
  await logLicenseEvent(sb, {
    licenseId,
    step: STEPS.uploaded,
    status: 'ok',
    detail: `${BUCKETS.licensed}/${filePath}`,
  });

  // 5. Temporary signed download URL (expires; the download page mints fresh ones).
  const { data: signed, error: signErr } = await sb.storage
    .from(BUCKETS.licensed)
    .createSignedUrl(filePath, downloadLinkTtlSeconds());
  if (signErr || !signed?.signedUrl) {
    throw new Error(`Signed URL failed: ${signErr?.message ?? 'unknown'}`);
  }
  await logLicenseEvent(sb, {
    licenseId,
    step: STEPS.signedUrl,
    status: 'ok',
    detail: `${downloadLinkTtlSeconds()}s ttl`,
  });

  // 6. Welcome email (log provider until a provider is connected).
  const downloadPageUrl = `${siteUrl()}/download.html?license=${licenseId}`;
  const emailCtx: WelcomeEmailContext = {
    productName: product.name,
    customerName: purchase.customerName,
    customerEmail: purchase.customerEmail,
    licenseId,
    downloadPageUrl,
    siteUrl: siteUrl(),
    supportEmail: supportEmail(),
  };
  const email = await dispatchWelcomeEmail(
    {
      emailProvider: envGet('EMAIL_PROVIDER', 'log'),
      resendApiKey: envGet('RESEND_API_KEY'),
      emailFrom: envGet('EMAIL_FROM'),
    },
    emailCtx,
  );
  await logLicenseEvent(sb, {
    licenseId,
    step: email.provider === 'resend' ? STEPS.emailSent : STEPS.emailQueued,
    status: 'ok',
    detail: `${email.provider}${email.messageId ? ` (${email.messageId})` : ''}`,
  });

  // 7. Mark issued — the customer can now download.
  const { error: finalErr } = await sb
    .from('licenses')
    .update({
      status: 'issued',
      file_name: fileName,
      file_path: filePath,
      issued_release_id: currentRelease?.id ?? null,
      issued_version: currentRelease?.version ?? null,
      email_status: email.provider === 'resend' ? 'sent' : 'queued',
      email_provider: email.provider,
      email_preview_html: email.previewHtml,
      error_message: null,
    })
    .eq('license_id', licenseId);
  if (finalErr) throw new Error(`Final license update failed: ${finalErr.message}`);

  return {
    status: 'issued',
    licenseId,
    fileName,
    signedUrl: signed.signedUrl,
    downloadPageUrl,
    email: { provider: email.provider, messageId: email.messageId },
    replacements: personalized.replacements,
  };
}

/** Record a pipeline failure on the license row + audit trail. */
export async function recordPipelineFailure(
  licenseIdOrNull: string | null,
  sessionId: string,
  message: string,
): Promise<void> {
  const sb = getSupabase();
  try {
    if (licenseIdOrNull) {
      await sb
        .from('licenses')
        .update({ status: 'failed', error_message: message })
        .eq('license_id', licenseIdOrNull);
      await logLicenseEvent(sb, {
        licenseId: licenseIdOrNull,
        step: STEPS.failed,
        status: 'error',
        detail: message,
      });
    }
  } catch {
    // best effort
  }
}
