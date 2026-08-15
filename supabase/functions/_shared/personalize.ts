/**
 * Workbook personalization — portable (Deno edge runtime + Node.js).
 *
 * Strategy: an .xlsx file is a ZIP of XML parts. Instead of parsing and
 * re-serializing the workbook (which would drop styling, charts, images,
 * defined names, VBA, etc. in every mainstream xlsx library), we do surgical
 * text replacement of placeholder tokens inside the XML parts that can
 * contain cell values. Every other part of the file is copied byte-for-byte,
 * so the customer's workbook is identical to your master except for the two
 * licensed fields.
 *
 * Supported placeholder tokens (any of these will be replaced if present):
 *
 *   ITB-XXXXXXXX            → license ID       (e.g. ITB-7K4X9P2M)
 *   Customer Name / Email   → "John Smith / john@email.com"
 *   [[LICENSE_ID]]          → license ID
 *   [[CUSTOMER_NAME]]       → "John Smith"
 *   [[CUSTOMER_EMAIL]]      → "john@email.com"
 *   [[CUSTOMER_NAME_EMAIL]] → "John Smith / john@email.com"
 *   [[LICENSED_TO]]         → "John Smith / john@email.com"
 *
 * The two canonical tokens (ITB-XXXXXXXX and Customer Name / Email) are
 * required by default — if either is missing the function throws, so we can
 * never silently ship an unpersonalized file.
 *
 * Keep placeholders as plain single-run text in a cell (just type them in —
 * do not apply partial-cell formatting to the placeholder text).
 */

import { unzipSync, zipSync, strFromU8, strToU8 } from './vendor/fflate.mjs';

export interface PersonalizeInput {
  /** Raw bytes of the master .xlsx file. */
  masterBytes: Uint8Array;
  /** e.g. ITB-7K4X9P2M */
  licenseId: string;
  /** e.g. John Smith */
  customerName: string;
  /** e.g. john@email.com */
  customerEmail: string;
  /** If true (default), fail when a canonical placeholder is missing. */
  requireCanonicalTokens?: boolean;
}

export interface TokenReplacement {
  token: string;
  value: string;
  found: boolean;
}

export interface PersonalizeResult {
  /** Bytes of the personalized .xlsx — upload these. */
  bytes: Uint8Array;
  /** Per-token report, useful for the audit trail. */
  replacements: TokenReplacement[];
}

/** Escape a string for safe insertion into XML text content. */
export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function nameEmail(customerName: string, customerEmail: string): string {
  return `${customerName} / ${customerEmail}`;
}

export function buildTokenMap(input: PersonalizeInput): Array<{ token: string; value: string; canonical?: boolean }> {
  return [
    { token: 'ITB-XXXXXXXX', value: input.licenseId, canonical: true },
    { token: 'Customer Name / Email', value: nameEmail(input.customerName, input.customerEmail), canonical: true },
    { token: '[[LICENSE_ID]]', value: input.licenseId },
    { token: '[[CUSTOMER_NAME]]', value: input.customerName },
    { token: '[[CUSTOMER_EMAIL]]', value: input.customerEmail },
    { token: '[[CUSTOMER_NAME_EMAIL]]', value: nameEmail(input.customerName, input.customerEmail) },
    { token: '[[LICENSED_TO]]', value: nameEmail(input.customerName, input.customerEmail) },
  ];
}

/**
 * ZIP entries that may contain cell text. We deliberately limit replacement to
 * these to avoid corrupting binary parts (images, vbaProject.bin) and to keep
 * the change surface auditable.
 */
function shouldInspect(entryName: string): boolean {
  return (
    entryName === 'xl/sharedStrings.xml' ||
    entryName === 'xl/workbook.xml' ||
    /^xl\/worksheets\/sheet\d+\.xml$/.test(entryName)
  );
}

/**
 * Personalizes a master workbook. Throws if the master is not a zip, if a
 * canonical token is missing, or if verification fails after replacement.
 */
export function personalizeWorkbook(input: PersonalizeInput): PersonalizeResult {
  const requireCanonical = input.requireCanonicalTokens !== false;
  const tokenMap = buildTokenMap(input);

  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(input.masterBytes, {});
  } catch (err) {
    throw new Error(
      `Master workbook is not a readable .xlsx (zip) file: ${(err as Error).message ?? String(err)}`,
    );
  }

  // Track which tokens were found anywhere in the archive.
  const found = new Map<string, boolean>(tokenMap.map((t) => [t.token, false]));

  const outFiles: Record<string, Uint8Array> = {};
  for (const [entryName, entryBytes] of Object.entries(files)) {
    if (!shouldInspect(entryName)) {
      outFiles[entryName] = entryBytes; // copy byte-for-byte
      continue;
    }
    let text = strFromU8(entryBytes, false);
    for (const { token, value } of tokenMap) {
      if (text.includes(token)) {
        found.set(token, true);
        text = text.split(token).join(xmlEscape(value));
      }
    }
    outFiles[entryName] = strToU8(text, false);
  }

  // Canonical tokens must exist in the master.
  const missingCanonical = tokenMap
    .filter((t) => t.canonical && !found.get(t.token))
    .map((t) => t.token);
  if (requireCanonical && missingCanonical.length > 0) {
    throw new Error(
      `Master workbook is missing required placeholder(s): ${missingCanonical.join(', ')}. ` +
        `Add those exact strings to the cells you want personalized (see docs/MASTER_WORKBOOK_GUIDE.md).`,
    );
  }

  const replacements: TokenReplacement[] = tokenMap.map((t) => ({
    token: t.token,
    value: t.value,
    found: found.get(t.token) === true,
  }));

  const bytes = zipSync(outFiles, { level: 6 });

  // Post-write verification: re-open the produced archive and confirm the
  // canonical values are present and the placeholders are gone. This catches
  // odd cases (e.g. a placeholder stored as multiple rich-text runs).
  let verify: Record<string, Uint8Array>;
  try {
    verify = unzipSync(bytes, {});
  } catch (err) {
    throw new Error(`Verification failed — produced file is not a valid zip: ${(err as Error).message ?? String(err)}`);
  }
  const combinedText = Object.keys(verify)
    .filter(shouldInspect)
    .map((entryName) => strFromU8(verify[entryName], false))
    .join('\n');
  for (const { token, value, canonical } of tokenMap) {
    if (found.get(token) === true && combinedText.includes(token)) {
      throw new Error(`Verification failed — placeholder "${token}" still present after replacement.`);
    }
    if (canonical && !combinedText.includes(xmlEscape(value))) {
      throw new Error(
        `Verification failed — personalized value for "${token}" not found in output. ` +
          `The placeholder may be split across rich-text runs; re-type it as a single plain value in the master.`,
      );
    }
  }

  return { bytes, replacements };
}
