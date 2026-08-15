/**
 * create-checkout — POST { product: 'essentials'|'complete'|'premium' }
 * Creates a Stripe Checkout Session and returns its URL. The static site's
 * Buy buttons call this, then redirect the customer to Stripe.
 *
 * Note: the customer's name + email are collected inside Stripe Checkout
 * itself, so they land in the webhook with the payment.
 */

import Stripe from 'npm:stripe@17.7.0';

import { corsHeaders, handleOptions, jsonResponse, readJson } from '../_shared/cors.ts';
import { envGet, getProduct, siteUrl } from '../_shared/config.ts';

Deno.serve(async (req: Request) => {
  const options = handleOptions(req);
  if (options) return options;

  try {
    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405, req);
    }

    const body = await readJson<{ product?: string }>(req);
    const product = getProduct(body.product ?? '');
    if (!product) {
      return jsonResponse(
        { error: `Unknown product "${body.product}". Valid: essentials, complete, premium` },
        400,
        req,
      );
    }

    const secretKey = envGet('STRIPE_SECRET_KEY');
    const priceId = envGet(product.priceEnv);
    if (!secretKey || !priceId) {
      return jsonResponse(
        {
          error: 'Checkout is not configured yet',
          detail: `Set STRIPE_SECRET_KEY and ${product.priceEnv} in the Supabase function secrets.`,
        },
        503,
        req,
      );
    }

    const stripe = new Stripe(secretKey, {
      apiVersion: '2025-02-24.acacia',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl()}/download.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl()}/#pricing`,
      metadata: { product: product.id, source: 'intheblackbudget.com' },
      // Let customers type their name + email at checkout (drives personalization).
      allow_promotion_codes: true,
    });

    return jsonResponse({ url: session.url }, 200, req);
  } catch (err) {
    console.error('create-checkout error:', err);
    return jsonResponse({ error: 'Could not start checkout. Please try again.' }, 500, req);
  }
});
