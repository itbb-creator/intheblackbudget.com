/**
 * CORS + response helpers for the edge functions.
 * The static site calls these functions cross-origin (Netlify → supabase.co),
 * so every endpoint needs proper CORS handling.
 */

import { originAllowed } from './config.ts';

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin');
  if (origin && originAllowed(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Vary': 'Origin',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    };
  }
  return {};
}

export function jsonResponse(
  body: unknown,
  status = 200,
  req?: Request,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...(req ? corsHeaders(req) : {}),
    },
  });
}

export function handleOptions(req: Request): Response | null {
  if (req.method !== 'OPTIONS') return null;
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

export function readJson<T>(req: Request): Promise<T> {
  return req.json() as Promise<T>;
}
