import { corsHeaders, handleOptions, jsonResponse } from '../_shared/cors.ts';
import { getSupabase } from '../_shared/supabase.ts';

function validToken(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

Deno.serve(async (req: Request) => {
  const options = handleOptions(req);
  if (options) return options;

  const url = new URL(req.url);
  const token = (url.searchParams.get('token') ?? '').trim();
  if (!validToken(token)) return jsonResponse({ error: 'Invalid preference link.' }, 400, req);

  const sb = getSupabase();
  const { data: license, error } = await sb
    .from('licenses')
    .select('customer_email, product_update_consent, marketing_consent, unsubscribed_at')
    .eq('unsubscribe_token', token)
    .maybeSingle();
  if (error || !license) return jsonResponse({ error: 'Preference link not found.' }, 404, req);

  if (req.method === 'GET') {
    const [name, domain] = String(license.customer_email ?? '').split('@');
    const maskedEmail = name && domain ? `${name.slice(0, 2)}***@${domain}` : '';
    return jsonResponse({
      email: maskedEmail,
      productUpdateConsent: license.product_update_consent === true,
      marketingConsent: license.marketing_consent === true,
      unsubscribed: Boolean(license.unsubscribed_at),
    }, 200, req);
  }

  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405, req);

  const contentType = req.headers.get('content-type') ?? '';
  const isOneClick = contentType.includes('application/x-www-form-urlencoded');
  let productUpdateConsent = false;
  let marketingConsent = false;
  let source = 'one_click_unsubscribe';

  if (!isOneClick) {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    productUpdateConsent = body.productUpdateConsent === true;
    marketingConsent = body.marketingConsent === true;
    source = 'email_preferences_page';
  }

  const unsubscribed = !productUpdateConsent && !marketingConsent;
  const { error: updateError } = await sb.from('licenses').update({
    product_update_consent: productUpdateConsent,
    marketing_consent: marketingConsent,
    consent_recorded_at: new Date().toISOString(),
    consent_source: source,
    unsubscribed_at: unsubscribed ? new Date().toISOString() : null,
  }).eq('unsubscribe_token', token);
  if (updateError) return jsonResponse({ error: 'Could not update email preferences.' }, 500, req);

  if (isOneClick) {
    return new Response(null, { status: 200, headers: corsHeaders(req) });
  }
  return jsonResponse({ ok: true, productUpdateConsent, marketingConsent, unsubscribed }, 200, req);
});
