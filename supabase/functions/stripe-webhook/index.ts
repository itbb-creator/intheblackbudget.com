/**
 * stripe-webhook — Stripe's entry point into the licensing pipeline.
 *
 * 1. Verifies the webhook signature (STRIPE_WEBHOOK_SECRET).
 * 2. Stores the raw event in stripe_events (idempotent — audit trail).
 * 3. On checkout.session.completed / checkout.session.async_payment_succeeded
 *    (with payment_status "paid"), runs the pipeline:
 *    license id → personalization → private upload → signed URL → email.
 *
 * Failure handling: pipeline errors are recorded on the license row + audit
 * trail, and we return 200 so Stripe doesn't retry forever. The pipeline is
 * idempotent, so a manual "Resend" from the Stripe dashboard (or a re-run of
 * the event) safely retries the same session.
 */

import Stripe from 'npm:stripe@17.7.0';

import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { envGet } from '../_shared/config.ts';
import { getSupabase } from '../_shared/supabase.ts';
import { logLicenseEvent, STEPS } from '../_shared/audit.ts';
import { runLicensePipeline, recordPipelineFailure, type PurchaseInfo } from '../_shared/pipeline.ts';

const PROCESSED_TYPES = new Set([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
]);

Deno.serve(async (req: Request) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, req);
  }

  const secret = envGet('STRIPE_WEBHOOK_SECRET');
  const signature = req.headers.get('stripe-signature');
  const payload = await req.text();

  if (!secret || !signature) {
    return jsonResponse({ error: 'Webhook secret or signature missing' }, 400, req);
  }

  let event: Stripe.Event;
  try {
    const stripe = new Stripe(envGet('STRIPE_SECRET_KEY'), {
      apiVersion: '2025-02-24.acacia',
      httpClient: Stripe.createFetchHttpClient(),
    });
    event = await stripe.webhooks.constructEventAsync(payload, signature, secret);
  } catch (err) {
    console.error('stripe-webhook: signature verification failed:', err);
    return jsonResponse({ error: 'Invalid signature' }, 400, req);
  }

  const sb = getSupabase();

  // Idempotency: same event id → never processed twice, even on retry.
  const { data: existingEvent } = await sb
    .from('stripe_events')
    .select('id')
    .eq('id', event.id)
    .maybeSingle();

  if (existingEvent) {
    return jsonResponse({ received: true, duplicate: true }, 200, req);
  }

  await sb.from('stripe_events').insert({
    id: event.id,
    type: event.type,
    payload: event as unknown as Record<string, unknown>,
    processed: false,
  });

  if (!PROCESSED_TYPES.has(event.type)) {
    return jsonResponse({ received: true, ignored: event.type }, 200, req);
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const sessionId = session.id;
  const paid =
    event.type === 'checkout.session.async_payment_succeeded' ||
    session.payment_status === 'paid';

  if (!paid) {
    console.warn(`stripe-webhook: ${event.type} for ${sessionId} was not paid (${session.payment_status}).`);
    await sb.from('stripe_events').update({ processed: true, processed_at: new Date().toISOString() }).eq('id', event.id);
    return jsonResponse({ received: true, notPaid: true }, 200, req);
  }

  const purchase: PurchaseInfo = {
    sessionId,
    customerId: typeof session.customer === 'string' ? session.customer : null,
    paymentIntent: typeof session.payment_intent === 'string' ? session.payment_intent : null,
    customerName: (session.customer_details?.name ?? '').trim() || 'Valued Customer',
    customerEmail: session.customer_details?.email ?? '',
    productId: (session.metadata?.product ?? '').trim(),
  };

  if (!purchase.customerEmail) {
    await recordPipelineFailure(null, sessionId, 'Checkout session missing customer email.');
    await sb.from('stripe_events').update({ processed: true, processed_at: new Date().toISOString() }).eq('id', event.id);
    return jsonResponse({ received: true, error: 'missing customer email' }, 200, req);
  }

  try {
    await logLicenseEvent(sb, {
      licenseId: '(pending)',
      step: STEPS.paymentReceived,
      status: 'ok',
      detail: `${sessionId} · ${purchase.productId} · ${purchase.customerEmail}`,
    });
    const result = await runLicensePipeline(purchase);
    await sb.from('stripe_events').update({
      processed: true,
      processed_at: new Date().toISOString(),
      license_id: result.licenseId,
    }).eq('id', event.id);
    console.log(`stripe-webhook: issued ${result.licenseId} for ${purchase.customerEmail} (${result.status})`);
    return jsonResponse({ received: true, licenseId: result.licenseId, status: result.status }, 200, req);
  } catch (err) {
    const message = (err as Error).message ?? String(err);
    console.error(`stripe-webhook: pipeline failed for ${sessionId}:`, err);
    await recordPipelineFailure(null, sessionId, message);
    // 200 on purpose: failure is recorded; retry via Stripe dashboard "Resend".
    return jsonResponse({ received: true, error: message }, 200, req);
  }
});
