/**
 * Supabase client (Deno edge runtime only).
 * Functions use the service-role key; all tables/buckets are locked down
 * to the service role via RLS and private buckets.
 */

import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.49.4';

import { envGet } from './config.ts';

let cached: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (cached) return cached;
  const url = envGet('SUPABASE_URL');
  const key = envGet('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not configured.');
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
