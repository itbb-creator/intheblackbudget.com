/**
 * claim-essentials — gives one verified Pravely account one licensed copy of
 * the free Essentials workbook. Every response URL is temporary; the master
 * and personalized copies remain in private Storage buckets.
 */

import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { dailyDownloadLimit, downloadLinkTtlSeconds } from '../_shared/config.ts';
import { getSupabase } from '../_shared/supabase.ts';
import { logLicenseEvent, STEPS } from '../_shared/audit.ts';
import { runLicensePipeline } from '../_shared/pipeline.ts';

interface ExistingLicense {
  license_id: string;
  status: string;
  file_path: string | null;
  file_name: string | null;
  download_count: number;
  issued_version: string | null;
}

Deno.serve(async (req: Request) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405, req);

  try {
    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
    if (!token) return jsonResponse({ error: 'Sign in required.' }, 401, req);

    const sb = getSupabase();
    const { data: authData, error: authError } = await sb.auth.getUser(token);
    const user = authData.user;
    if (authError || !user?.id || !user.email) {
      return jsonResponse({ error: 'Your session is no longer valid. Please sign in again.' }, 401, req);
    }
    if (!user.email_confirmed_at) {
      return jsonResponse({ error: 'Verify your email before downloading Essentials.' }, 403, req);
    }

    const { data: existing, error: lookupError } = await sb
      .from('licenses')
      .select('license_id,status,file_path,file_name,download_count,issued_version')
      .eq('user_id', user.id)
      .eq('product', 'essentials')
      .eq('license_source', 'account_free')
      .maybeSingle<ExistingLicense>();
    if (lookupError) throw new Error(`License lookup failed: ${lookupError.message}`);

    if (existing?.status === 'issued' && existing.file_path) {
      const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { count } = await sb.from('license_events').select('id', { count: 'exact', head: true })
        .eq('license_id', existing.license_id).eq('step', STEPS.downloadServed).gte('created_at', dayAgo);
      if ((count ?? 0) >= dailyDownloadLimit()) {
        return jsonResponse({ error: 'Download limit reached. Try again tomorrow or contact support.' }, 429, req);
      }
      const { data: signed, error: signError } = await sb.storage.from('licensed-workbooks')
        .createSignedUrl(existing.file_path, downloadLinkTtlSeconds());
      if (signError || !signed?.signedUrl) throw new Error('Could not create a temporary download link.');
      await sb.from('licenses').update({
        download_count: (existing.download_count ?? 0) + 1,
        last_download_at: new Date().toISOString(),
      }).eq('license_id', existing.license_id);
      await logLicenseEvent(sb, {
        licenseId: existing.license_id,
        step: STEPS.downloadServed,
        status: 'ok',
        detail: `${downloadLinkTtlSeconds()}s ttl · verified account ${user.id}`,
      });
      return jsonResponse({
        status: 'ready', licenseId: existing.license_id, fileName: existing.file_name,
        version: existing.issued_version, downloadUrl: signed.signedUrl,
        expiresInSeconds: downloadLinkTtlSeconds(),
      }, 200, req);
    }

    const metadata = user.user_metadata ?? {};
    const first = String(metadata.first_name ?? '').trim();
    const last = String(metadata.last_name ?? '').trim();
    const fullName = String(metadata.full_name ?? `${first} ${last}`).trim() || user.email;
    const result = await runLicensePipeline({
      sessionId: `FREE_ACCOUNT_${user.id}`,
      customerName: fullName,
      customerEmail: user.email,
      productId: 'essentials',
      userId: user.id,
      licenseSource: 'account_free',
      productUpdateConsent: false,
      marketingConsent: false,
      consentSource: 'verified_account_free_essentials',
    });
    return jsonResponse({
      status: 'ready', licenseId: result.licenseId, fileName: result.fileName,
      downloadUrl: result.signedUrl, expiresInSeconds: downloadLinkTtlSeconds(),
    }, 200, req);
  } catch (error) {
    console.error('claim-essentials error:', error);
    return jsonResponse({ error: 'We could not prepare your workbook. Please try again.' }, 500, req);
  }
});
