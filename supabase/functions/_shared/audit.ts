/**
 * Audit-trail helpers. Every meaningful pipeline step is appended to
 * license_events — the record of what happened, when, for each license.
 * (Deno edge runtime only — requires the Supabase client.)
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.49.4';

import { getSupabase } from './supabase.ts';

export interface LicenseEventInput {
  licenseId: string;
  step: string;
  status?: 'info' | 'ok' | 'error';
  detail?: string;
}

export async function logLicenseEvent(
  sb: SupabaseClient | null,
  input: LicenseEventInput,
): Promise<void> {
  const client = sb ?? getSupabase();
  try {
    await client.from('license_events').insert({
      license_id: input.licenseId,
      step: input.step,
      status: input.status ?? 'info',
      detail: input.detail ?? null,
    });
  } catch {
    // Audit logging must never take down the pipeline.
  }
}

/** Standard pipeline steps — keep names stable for reporting queries. */
export const STEPS = {
  paymentReceived: 'payment_received',
  licenseGenerated: 'license_generated',
  masterFetched: 'master_fetched',
  personalized: 'workbook_personalized',
  uploaded: 'workbook_uploaded',
  signedUrl: 'signed_url_created',
  emailQueued: 'email_queued',
  emailSent: 'email_sent',
  downloadServed: 'download_served',
  releaseRefreshed: 'release_refreshed',
  failed: 'pipeline_failed',
} as const;
