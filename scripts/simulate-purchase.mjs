/**
 * Simulates a purchase through the real pipeline code — no Stripe needed.
 *
 * Local mode (default):
 *   generates a license id → personalizes the master → writes the customer's
 *   .xlsx and the email preview to test-output/ → prints the audit trail.
 *
 * Live mode (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set):
 *   additionally stores the license + audit events in Supabase, uploads the
 *   personalized file to the private bucket, and prints a real signed URL —
 *   i.e. everything the Stripe webhook does, minus Stripe itself.
 *
 * Usage:
 *   npm run simulate -- --product premium --name "John Smith" --email john@email.com
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateLicenseId } from '../supabase/functions/_shared/license.ts';
import { personalizeWorkbook } from '../supabase/functions/_shared/personalize.ts';
import { buildWelcomeEmail } from '../supabase/functions/_shared/email.ts';
import { PRODUCTS, getProduct, envGet } from '../supabase/functions/_shared/config.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---- args ----
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => (a.startsWith('--') ? a.slice(2).split(/=(.*)/s) : [])).filter((a) => a.length === 2),
);
const product = getProduct(args.product ?? 'premium');
if (!product) {
  console.error(`Unknown product "${args.product}". Valid: ${PRODUCTS.map((p) => p.id).join(', ')}`);
  process.exit(1);
}
const customerName = args.name ?? 'John Smith';
const customerEmail = args.email ?? 'john@email.com';

// ---- env (.env file support, same as seed-masters) ----
if (existsSync(join(ROOT, '.env'))) {
  for (const line of readFileSync(join(ROOT, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const siteUrl = envGet('SITE_URL', 'https://intheblackbudget.com');
const supportEmail = envGet('SUPPORT_EMAIL', 'ITBB@intheblackbudget.com');
const ttlSeconds = Number(envGet('DOWNLOAD_LINK_TTL_HOURS', '72')) * 3600;

const trail = [];
const audit = (step, detail, status = 'ok') => {
  trail.push({ at: new Date().toISOString(), step, detail, status });
  console.log(`  [${status.toUpperCase()}] ${step}${detail ? ' — ' + detail : ''}`);
};

console.log(`\nSimulating purchase of "${product.name}" for ${customerName} <${customerEmail}>`);

// ---- step 1: license id ----
const licenseId = generateLicenseId();
audit('license_generated', licenseId);

// ---- step 2: master ----
const masterPath = join(ROOT, 'assets/masters', product.masterPath);
const masterBytes = new Uint8Array(readFileSync(masterPath));
audit('master_fetched', `${product.masterPath} (${masterBytes.length} bytes)`);

// ---- step 3: personalize ----
const personalized = personalizeWorkbook({ masterBytes, licenseId, customerName, customerEmail });
audit(
  'workbook_personalized',
  `tokens: ${personalized.replacements.filter((r) => r.found).map((r) => r.token).join(', ')}`,
);

// ---- step 4: save locally (always) ----
const outDir = join(ROOT, 'test-output');
mkdirSync(outDir, { recursive: true });
const fileName = `${product.fileNamePrefix}_${licenseId}.xlsx`;
writeFileSync(join(outDir, fileName), personalized.bytes);
audit('workbook_saved', `test-output/${fileName}`);

// ---- step 5: email ----
const downloadPageUrl = `${siteUrl}/download.html?license=${licenseId}`;
const email = buildWelcomeEmail({
  productName: product.name,
  customerName,
  customerEmail,
  licenseId,
  downloadPageUrl,
  siteUrl,
  supportEmail,
});
writeFileSync(join(outDir, 'email-preview.html'), email.html);
audit('email_queued', `preview → test-output/email-preview.html (subject: "${email.subject}")`);

// ---- live mode: Supabase ----
const SUPABASE_URL = envGet('SUPABASE_URL');
const KEY = envGet('SUPABASE_SERVICE_ROLE_KEY');
if (SUPABASE_URL && KEY) {
  const base = SUPABASE_URL.replace(/\/+$/, '');
  const headers = {
    Authorization: `Bearer ${KEY}`,
    apikey: KEY,
    'Content-Type': 'application/json',
  };
  console.log('\nLive mode — writing to Supabase…');

  // 5a. license row
  const row = {
    license_id: licenseId,
    product: product.id,
    status: 'issued',
    stripe_session_id: `sim_${Date.now()}`,
    customer_name: customerName,
    customer_email: customerEmail,
    file_path: `${product.id}/${fileName}`,
    file_name: fileName,
    email_status: 'queued',
    email_provider: 'log',
    email_preview_html: email.html,
  };
  const r1 = await fetch(`${base}/rest/v1/licenses?on_conflict=license_id`, {
    method: 'POST', headers, body: JSON.stringify(row),
  });
  if (r1.ok) audit('license_record_created', licenseId);
  else audit('license_record_created', `HTTP ${r1.status} ${(await r1.text()).slice(0, 200)}`, 'error');

  // 5b. audit events
  const events = trail.map((t) => ({
    license_id: licenseId,
    step: t.step,
    status: t.status,
    detail: t.detail,
  }));
  const r2 = await fetch(`${base}/rest/v1/license_events`, { method: 'POST', headers, body: JSON.stringify(events) });
  if (r2.ok) audit('audit_events_written', `${events.length} events`);

  // 5c. upload to private bucket
  const up = await fetch(`${base}/storage/v1/object/licensed-workbooks/${product.id}/${fileName}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KEY}`,
      'x-upsert': 'true',
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
    body: personalized.bytes,
  });
  if (up.ok) audit('workbook_uploaded', `licensed-workbooks/${product.id}/${fileName}`);
  else audit('workbook_uploaded', `HTTP ${up.status} ${(await up.text()).slice(0, 200)}`, 'error');

  // 5d. signed URL
  const sign = await fetch(
    `${base}/storage/v1/object/sign/licensed-workbooks/${product.id}/${fileName}`,
    { method: 'POST', headers, body: JSON.stringify({ expiresIn: ttlSeconds }) },
  );
  if (sign.ok) {
    const { signedURL } = await sign.json();
    audit('signed_url_created', `${ttlSeconds}s ttl`);
    console.log(`\n  ▶ Signed URL: ${signedURL}`);
  } else {
    audit('signed_url_created', `HTTP ${sign.status}`, 'error');
  }
} else {
  console.log('\n(local mode — set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY for live mode)');
}

console.log(`\nDone. License ${licenseId} → ${downloadPageUrl}`);
