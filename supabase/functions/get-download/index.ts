/**
 * get-download — the customer-facing lookup behind download.html.
 *
 *   GET ?license=ITB-7K4X9P2M    → the email link (stable, bookmarkable)
 *   GET ?session_id=cs_test_...  → the post-checkout redirect (polls until
 *                                   the webhook has issued the license)
 *
 * Never returns a permanent public URL: it mints a fresh *temporary* signed
 * URL on each call (default 72h TTL) and hands it to the browser. Access is
 * rate-limited per license (rolling 24h) so a leaked license id can't be
 * farmed into a download service.
 */

import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { dailyDownloadLimit, downloadLinkTtlSeconds, getProduct, siteUrl } from '../_shared/config.ts';
import { getSupabase } from '../_shared/supabase.ts';
import { logLicenseEvent, STEPS } from '../_shared/audit.ts';

interface LicenseRow {
  license_id: string;
  product: string;
  status: string;
  customer_name: string | null;
  customer_email: string | null;
  file_path: string | null;
  file_name: string | null;
  download_count: number;
  last_download_at: string | null;
  error_message: string | null;
}

Deno.serve(async (req: Request) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405, req);
  }

  try {
    const url = new URL(req.url);
    const licenseParam = url.searchParams.get('license');
    const sessionParam = url.searchParams.get('session_id');
    const sb = getSupabase();

    let query = sb.from('licenses').select('*').limit(1);
    if (licenseParam) {
      query = query.eq('license_id', licenseParam.trim().toUpperCase());
    } else if (sessionParam) {
      query = query.eq('stripe_session_id', sessionParam.trim());
    } else {
      return jsonResponse({ error: 'Pass ?license= or ?session_id=' }, 400, req);
    }

    const { data: row, error } = await query.maybeSingle<LicenseRow>();
    if (error || !row) {
      // Most likely: the customer landed here seconds after paying and the
      // webhook hasn't finished yet. The page polls until it does.
      return jsonResponse({ status: 'processing', retryInSeconds: 3 }, 200, req);
    }

    if (row.status === 'failed') {
      return jsonResponse({
        status: 'failed',
        message: row.error_message ?? 'Something went wrong preparing your workbook.',
        contact: 'ITBB@intheblackbudget.com',
      }, 200, req);
    }
    if (row.status !== 'issued' || !row.file_path) {
      return jsonResponse({ status: 'processing', retryInSeconds: 3 }, 200, req);
    }

    // Rolling-24h rate limit on minting fresh links.
    const limit = dailyDownloadLimit();
    const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count } = await sb
      .from('license_events')
      .select('id', { count: 'exact', head: true })
      .eq('license_id', row.license_id)
      .eq('step', STEPS.downloadServed)
      .gte('created_at', dayAgo);
    if ((count ?? 0) >= limit) {
      return jsonResponse({
        status: 'rate_limited',
        message: 'Download limit reached — please try again tomorrow or contact support.',
        contact: 'ITBB@intheblackbudget.com',
      }, 429, req);
    }

    const { data: signed, error: signErr } = await sb.storage
      .from('licensed-workbooks')
      .createSignedUrl(row.file_path, downloadLinkTtlSeconds());
    if (signErr || !signed?.signedUrl) {
      console.error('get-download: signed url failed:', signErr);
      return jsonResponse({ status: 'error', message: 'Could not prepare your download. Please try again.' }, 500, req);
    }

    const { error: updErr } = await sb
      .from('licenses')
      .update({ download_count: (row.download_count ?? 0) + 1, last_download_at: new Date().toISOString() })
      .eq('license_id', row.license_id);
    if (updErr) console.error('get-download: count update failed:', updErr);

    await logLicenseEvent(sb, {
      licenseId: row.license_id,
      step: STEPS.downloadServed,
      status: 'ok',
      detail: `${downloadLinkTtlSeconds()}s ttl · download #${(row.download_count ?? 0) + 1}`,
    });

    const product = getProduct(row.product);
    return jsonResponse({
      status: 'ready',
      licenseId: row.license_id,
      productName: product?.name ?? row.product,
      customerName: row.customer_name ?? '',
      fileName: row.file_name ?? '',
      downloadUrl: signed.signedUrl,
      expiresInSeconds: downloadLinkTtlSeconds(),
      siteUrl: siteUrl(),
    }, 200, req);
  } catch (err) {
    console.error('get-download error:', err);
    return jsonResponse({ status: 'error', message: 'Something went wrong. Please try again.' }, 500, req);
  }
});
