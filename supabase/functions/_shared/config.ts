/**
 * Central configuration — products, buckets, env access.
 * Portable between Deno edge runtime and Node.js (used by scripts).
 */

export interface ProductConfig {
  id: string;
  /** Display name, e.g. "In The Black Premium Toolkit". */
  name: string;
  /** Master file inside the workbook-masters bucket. */
  masterPath: string;
  /** Output file name = `${fileNamePrefix}_${licenseId}.xlsx`. */
  fileNamePrefix: string;
  /** Env var holding this product's Stripe Price ID. */
  priceEnv: string;
}

export const PRODUCTS: ProductConfig[] = [
  {
    id: 'essentials',
    name: 'In The Black Essentials',
    masterPath: 'essentials.xlsx',
    fileNamePrefix: 'ITB_Essentials',
    priceEnv: 'STRIPE_PRICE_ESSENTIALS',
  },
  {
    id: 'complete',
    name: 'In The Black Complete',
    masterPath: 'complete.xlsx',
    fileNamePrefix: 'ITB_Complete',
    priceEnv: 'STRIPE_PRICE_COMPLETE',
  },
  {
    id: 'premium',
    name: 'In The Black Premium Toolkit',
    masterPath: 'premium.xlsx',
    fileNamePrefix: 'ITB_Premium_Toolkit',
    priceEnv: 'STRIPE_PRICE_PREMIUM_FOUNDING',
  },
];

export function getProduct(id: string): ProductConfig | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

export const BUCKETS = {
  masters: 'workbook-masters',
  licensed: 'licensed-workbooks',
} as const;

/** Env access that works in both Deno (edge) and Node (scripts/tests). */
export function envGet(name: string, fallback = ''): string {
  const g = globalThis as Record<string, unknown>;
  if (g.Deno && typeof (g.Deno as { env?: unknown }).env === 'object') {
    const v = (g.Deno as { env: { get(k: string): string | undefined } }).env.get(name);
    return v ?? fallback;
  }
  const proc = (g.process ?? {}) as { env?: Record<string, string | undefined> };
  return proc.env?.[name] ?? fallback;
}

export function siteUrl(): string {
  return envGet('SITE_URL', 'https://intheblackbudget.com').replace(/\/+$/, '');
}

export function supportEmail(): string {
  return envGet('SUPPORT_EMAIL', 'ITBB@intheblackbudget.com');
}

/** Seconds a signed download URL stays valid (default 72h). */
export function downloadLinkTtlSeconds(): number {
  const hours = Number(envGet('DOWNLOAD_LINK_TTL_HOURS', '72'));
  return Math.max(1, Math.min(hours || 72, 24 * 7)) * 3600;
}

/** Max fresh signed links minted per license per rolling 24h. */
export function dailyDownloadLimit(): number {
  const n = Number(envGet('DAILY_DOWNLOAD_LIMIT', '20'));
  return Math.max(1, Math.min(n || 20, 1000));
}

/**
 * Origin allow-list for CORS. `*` when SITE_URL is unset (e.g. first-time
 * local testing); otherwise the configured site plus localhost/dev hosts.
 */
export function originAllowed(origin: string | null): boolean {
  if (!origin) return true; // non-browser callers (curl, webhooks)
  const site = siteUrl();
  if (!site) return true;
  try {
    const o = new URL(origin);
    const s = new URL(site);
    if (o.host === s.host) return true;
    return (
      o.hostname === 'localhost' ||
      o.hostname === '127.0.0.1' ||
      o.hostname.endsWith('.e2b.app') ||
      o.hostname.endsWith('.netlify.app') ||
      o.hostname.endsWith('.vercel.app')
    );
  } catch {
    return false;
  }
}
