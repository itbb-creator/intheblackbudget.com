/**
 * preview-email — admin-only view of the exact email a customer received
 * (or will receive once a provider is connected). Until EMAIL_PROVIDER=resend
 * is set, the pipeline stores the rendered HTML on the license record; this
 * endpoint lets you see it.
 *
 *   GET ?license=PRV-7K4X9P2M&key=<ADMIN_KEY>
 *
 * ADMIN_KEY is a secret you set in the function secrets.
 */

import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { envGet } from '../_shared/config.ts';
import { getSupabase } from '../_shared/supabase.ts';

Deno.serve(async (req: Request) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405, req);
  }

  const adminKey = envGet('ADMIN_KEY');
  if (!adminKey) {
    return jsonResponse({ error: 'ADMIN_KEY not configured in function secrets' }, 503, req);
  }

  const url = new URL(req.url);
  if (url.searchParams.get('key') !== adminKey) {
    return jsonResponse({ error: 'Unauthorized' }, 401, req);
  }

  const licenseId = (url.searchParams.get('license') ?? '').trim().toUpperCase();
  if (!licenseId) {
    return jsonResponse({ error: 'Pass ?license=' }, 400, req);
  }

  const sb = getSupabase();
  const { data, error } = await sb
    .from('licenses')
    .select('license_id, customer_email, email_status, email_provider, email_preview_html')
    .eq('license_id', licenseId)
    .maybeSingle();

  if (error || !data) {
    return jsonResponse({ error: 'License not found' }, 404, req);
  }
  if (!data.email_preview_html) {
    return jsonResponse({ error: 'No email preview stored for this license' }, 404, req);
  }

  return new Response(data.email_preview_html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      ...(req.headers.get('origin') ? { 'Access-Control-Allow-Origin': url.origin } : {}),
    },
  });
});
