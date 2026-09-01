import Stripe from 'npm:stripe@17.7.0';
import { handleOptions, jsonResponse, readJson } from '../_shared/cors.ts';
import { appUrl, envGet, siteUrl } from '../_shared/config.ts';
import { getSupabase } from '../_shared/supabase.ts';

const PRICES = { plus: 'STRIPE_PRICE_APP_PLUS', complete: 'STRIPE_PRICE_APP_COMPLETE' } as const;

Deno.serve(async (req: Request) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405, req);

  try {
    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
    const sb = getSupabase();
    const { data, error: authError } = await sb.auth.getUser(token);
    if (authError || !data.user?.id || !data.user.email) return jsonResponse({ error: 'Sign in required.' }, 401, req);

    const body = await readJson<{ plan?: string }>(req);
    if (body.plan !== 'plus' && body.plan !== 'complete') return jsonResponse({ error: 'Choose Plus or Complete.' }, 400, req);
    const priceId = envGet(PRICES[body.plan]);
    if (!priceId) return jsonResponse({ error: 'App checkout is not configured yet.' }, 503, req);

    const stripe = new Stripe(envGet('STRIPE_SECRET_KEY'), { apiVersion: '2025-02-24.acacia', httpClient: Stripe.createFetchHttpClient() });
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: data.user.email,
      client_reference_id: data.user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl()}/?checkout=success#/plans`,
      cancel_url: `${appUrl()}/#/plans`,
      allow_promotion_codes: true,
      metadata: { purchase_type: 'app_plan', user_id: data.user.id, plan_id: body.plan, source: 'pravely_web' },
      custom_text: { submit: { message: 'One-time purchase. Core product updates are included; separately priced add-ons are not included.' } },
    });
    return jsonResponse({ url: session.url, returnSite: siteUrl() }, 200, req);
  } catch (error) {
    console.error('create-app-checkout error:', error);
    return jsonResponse({ error: 'Checkout could not be started.' }, 500, req);
  }
});
