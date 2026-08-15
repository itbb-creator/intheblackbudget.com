/**
 * Uploads assets/masters/*.xlsx to the private Supabase bucket
 * "workbook-masters" — the templates the pipeline personalizes.
 *
 * Usage:
 *   SUPABASE_URL=https://xxxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   node scripts/seed-masters.mjs
 *
 * (Also reads a .env file in the repo root if the vars aren't exported.)
 *
 * Run this whenever you drop a new/finished master workbook into
 * assets/masters/ — e.g. after you replace the placeholder with your real
 * product file.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---- env (process env > .env file) ----
function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnvFile(join(ROOT, '.env'));

const SUPABASE_URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !KEY) {
  console.error('✘ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set (env or .env file).');
  console.error('  Find them in the Supabase dashboard → Project Settings → API.');
  process.exit(1);
}

const mastersDir = join(ROOT, 'assets/masters');
const files = readdirSync(mastersDir).filter((f) => f.endsWith('.xlsx'));
if (files.length === 0) {
  console.error('✘ No .xlsx masters found in assets/masters/ — run "npm run masters" first.');
  process.exit(1);
}

const base = SUPABASE_URL.replace(/\/+$/, '');
let failed = 0;

for (const file of files) {
  const bytes = readFileSync(join(mastersDir, file));
  const res = await fetch(`${base}/storage/v1/object/workbook-masters/${file}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KEY}`,
      'x-upsert': 'true',
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
    body: bytes,
  });
  if (res.ok) {
    console.log(`✔ uploaded ${file} (${bytes.length} bytes) → workbook-masters/${file}`);
  } else {
    failed++;
    console.error(`✘ ${file}: HTTP ${res.status} — ${(await res.text()).slice(0, 300)}`);
  }
}

console.log(failed === 0 ? '\nMasters are live. Next: set function secrets + deploy (docs/LICENSED_DELIVERY_SETUP.md).' : `\n${failed} upload(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
