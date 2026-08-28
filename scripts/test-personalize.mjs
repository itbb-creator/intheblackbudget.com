/**
 * Tests the personalization core end-to-end on the placeholder masters:
 *   - license id + name/email tokens replaced
 *   - every other zip entry byte-identical to the master (formatting/charts/
 *     formulas/defined names are preserved by design)
 *   - output re-opens as a valid zip; XML stays well-formed
 *
 * Usage: npm test
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { personalizeWorkbook } from '../supabase/functions/_shared/personalize.ts';
import { generateLicenseId, isLicenseId } from '../supabase/functions/_shared/license.ts';
import { buildWelcomeEmail } from '../supabase/functions/_shared/email.ts';
import { unzipSync, strFromU8, zipSync, strToU8 } from '../supabase/functions/_shared/vendor/fflate.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(ROOT, 'test-output');
mkdirSync(outDir, { recursive: true });

let failures = 0;
const check = (cond, label) => {
  console.log(`${cond ? '✔' : '✘'} ${label}`);
  if (!cond) failures++;
};

// --- license id generation ---
check(isLicenseId('PRV-7K4X9P2M'), 'license id format check passes for PRV-7K4X9P2M');
check(isLicenseId('ITB-7K4X9P2M'), 'legacy ITB license ids remain valid during the rebrand');
check(!isLicenseId('PRV-0O1IL234'), 'license id format rejects ambiguous chars');
const generated = new Set(Array.from({ length: 200 }, () => generateLicenseId()));
check(generated.size === 200, '200 generated license ids are all unique');

// --- personalization on each product master ---
for (const product of ['essentials', 'complete', 'premium']) {
  const master = readFileSync(join(ROOT, 'assets/masters', `${product}.xlsx`));
  const result = personalizeWorkbook({
    masterBytes: new Uint8Array(master),
    licenseId: 'PRV-7K4X9P2M',
    customerName: 'John Smith',
    customerEmail: 'john@email.com',
  });

  const outPath = join(outDir, `Pravely_${product === 'premium' ? 'Premium_Toolkit' : product[0].toUpperCase() + product.slice(1)}_PRV-7K4X9P2M.xlsx`);
  writeFileSync(outPath, result.bytes);

  const before = unzipSync(new Uint8Array(master));
  const after = unzipSync(result.bytes);
  const entries = Object.keys(before);

  const foundTokens = result.replacements.filter((r) => r.found).map((r) => r.token);
  check(
    (foundTokens.includes('PRV-XXXXXXXX') || foundTokens.includes('ITB-XXXXXXXX')) &&
      foundTokens.includes('Customer Name / Email'),
    `${product}: required license tokens found and replaced in master`,
  );

  // Every non-inspected entry must be byte-identical (preservation guarantee).
  const inspected = new Set(entries.filter((e) => e === 'xl/sharedStrings.xml' || e === 'xl/workbook.xml' || /^xl\/worksheets\/sheet\d+\.xml$/.test(e)));
  const unchanged = entries.filter((e) => !inspected.has(e));
  const identical = unchanged.every((e) => {
    const a = before[e], b = after[e];
    return a.length === b.length && a.every((v, i) => v === b[i]);
  });
  check(identical, `${product}: ${unchanged.length} untouched zip entries byte-identical (styles, content-types, props)`);

  // New values present, placeholders gone, across inspected entries.
  const text = [...inspected]
    .map((e) => strFromU8(after[e]))
    .join('\n');
  check(text.includes('PRV-7K4X9P2M'), `${product}: license id present in output`);
  check(text.includes('John Smith / john@email.com'), `${product}: licensed-to present in output`);
  check(!text.includes('PRV-XXXXXXXX'), `${product}: PRV-XXXXXXXX placeholder gone`);
  check(!text.includes('Customer Name / Email'), `${product}: name/email placeholder gone`);
  check(!text.includes('[[LICENSE_ID]]') && !text.includes('[[CUSTOMER_NAME]]'), `${product}: bracket tokens gone`);
  const definedNames = (bytes) => strFromU8(bytes['xl/workbook.xml']).match(/<definedNames[\s\S]*?<\/definedNames>/)?.[0] ?? '';
  check(definedNames(before) === definedNames(after), `${product}: defined names preserved`);
  const formulas = (files) => entries.filter((e) => /^xl\/worksheets\/sheet\d+\.xml$/.test(e)).flatMap((e) => strFromU8(files[e]).match(/<f(?:\s[^>]*)?>[\s\S]*?<\/f>/g) ?? []);
  check(JSON.stringify(formulas(before)) === JSON.stringify(formulas(after)), `${product}: formulas preserved`);

  // No raw ampersands / stray angle brackets in text nodes (XML safety).
  const xmlSafe = !/&(?!amp;|lt;|gt;|quot;|apos;|#)/.test(text);
  check(xmlSafe, `${product}: no unescaped XML entities after replacement`);
}

// --- xmlEscape edge cases ---
const tricky = personalizeWorkbook({
  masterBytes: new Uint8Array(readFileSync(join(ROOT, 'assets/masters', 'premium.xlsx'))),
  licenseId: 'PRV-7K4X9P2M',
  customerName: "O'Brien & Sons <LLC>",
  customerEmail: 'obrien@sons.com',
});
const afterText = strFromU8(unzipSync(tricky.bytes)['xl/sharedStrings.xml']);
check(
  afterText.includes('O&apos;Brien &amp; Sons &lt;LLC&gt;'),
  'customer name with quotes/ampersands/angle brackets is XML-escaped correctly',
);

// --- canonical token enforcement ---
let threw = false;
try {
  personalizeWorkbook({
    masterBytes: new Uint8Array(zipLikeWithoutToken()),
    licenseId: 'PRV-ABCDEFGH',
    customerName: 'X',
    customerEmail: 'x@x.com',
  });
} catch {
  threw = true;
}
check(threw, 'missing canonical placeholder throws instead of shipping an unpersonalized file');

function zipLikeWithoutToken() {
  return zipSync({ 'xl/sharedStrings.xml': strToU8('<sst/>'), 'xl/workbook.xml': strToU8('<workbook/>') });
}

// --- email template ---
const email = buildWelcomeEmail({
  productName: 'Pravely Premium Toolkit',
  customerName: 'John Smith',
  customerEmail: 'john@email.com',
  licenseId: 'PRV-7K4X9P2M',
  downloadPageUrl: 'https://pravely.com/download.html?license=PRV-7K4X9P2M',
  siteUrl: 'https://pravely.com',
  supportEmail: 'support@pravely.com',
});
check(email.subject.includes('ready'), 'email subject mentions ready');
check(email.html.includes('Your Pravely Toolkit Is Ready') && email.html.includes('PRV-7K4X9P2M'), 'email html has button + license id');
writeFileSync(join(outDir, 'email-preview.html'), email.html);

console.log(`\n${failures === 0 ? 'ALL TESTS PASSED' : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
