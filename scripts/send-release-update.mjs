/**
 * Email every issued license holder for a product release.
 * Dry-run by default. Add --send only after reviewing the recipient list.
 *
 * Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY,
 * EMAIL_FROM. Optional: SITE_URL, SUPPORT_EMAIL.
 * Usage: npm run email-release -- premium 1.1.0 [--send]
 */
import { buildReleaseUpdateEmail } from '../supabase/functions/_shared/email.ts';

const [product, version] = process.argv.slice(2).filter((arg) => arg !== '--send');
const send = process.argv.includes('--send');
const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'RESEND_API_KEY', 'EMAIL_FROM'];
for (const name of required) if (!process.env[name]) throw new Error(`Missing ${name}`);
if (!product || !version) throw new Error('Usage: npm run email-release -- <product> <version> [--send]');

const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
const query = async (path) => {
  const response = await fetch(`${base}/rest/v1/${path}`, { headers });
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${await response.text()}`);
  return response.json();
};

const releases = await query(`product_releases?product=eq.${encodeURIComponent(product)}&version=eq.${encodeURIComponent(version)}&select=*`);
if (releases.length !== 1) throw new Error(`Release ${product} ${version} was not found.`);
const release = releases[0];
const licenses = await query(`licenses?product=eq.${encodeURIComponent(product)}&status=eq.issued&product_update_consent=eq.true&unsubscribed_at=is.null&customer_email=not.is.null&select=license_id,customer_name,customer_email,unsubscribe_token&order=created_at.asc`);
const siteUrl = (process.env.SITE_URL || 'https://intheblackbudget.com').replace(/\/+$/, '');

console.log(`${send ? 'SEND' : 'DRY RUN'}: ${product} ${version} → ${licenses.length} customer(s)`);
for (const license of licenses) {
  const message = buildReleaseUpdateEmail({
    productName: product === 'premium' ? 'Pravely Premium Toolkit' : `Pravely ${product[0].toUpperCase()}${product.slice(1)}`,
    customerName: license.customer_name || 'there',
    licenseId: license.license_id,
    version,
    summary: release.summary,
    added: release.added || [],
    changed: release.changed || [],
    fixed: release.fixed || [],
    downloadPageUrl: `${siteUrl}/download.html?license=${encodeURIComponent(license.license_id)}`,
    changelogUrl: `${siteUrl}/changelog`,
    preferencesUrl: `${siteUrl}/email-preferences.html?token=${encodeURIComponent(license.unsubscribe_token)}`,
    supportEmail: process.env.SUPPORT_EMAIL || 'ITBB@intheblackbudget.com',
  });
  console.log(`- ${license.customer_email} · ${license.license_id}`);
  if (!send) continue;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [license.customer_email],
      ...message,
      headers: {
        'List-Unsubscribe': `<${siteUrl}/.netlify/functions/email-preferences?token=${encodeURIComponent(license.unsubscribe_token)}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    }),
  });
  if (!response.ok) throw new Error(`Resend ${response.status}: ${await response.text()}`);
}
