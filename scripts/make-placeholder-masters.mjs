/**
 * Generates the three placeholder master workbooks in assets/masters/.
 *
 * These are REAL .xlsx files (Excel and Google Sheets can open them)
 * containing exactly the placeholder tokens the pipeline replaces:
 *
 *   License sheet:  License ID = ITB-XXXXXXXX
 *                   Licensed To = Customer Name / Email
 *   plus [[LICENSE_ID]], [[CUSTOMER_NAME]], [[CUSTOMER_EMAIL]] tokens
 *   elsewhere, and two defined names (LicenseID, LicensedTo) so you can
 *   verify the personalization preserves defined names.
 *
 * When your real workbook is finished, save it over these files (or add your
 * own paths in supabase/functions/_shared/config.ts) and run `npm run seed`.
 * Everything else — formatting, charts, formulas — is preserved by the
 * pipeline because it only edits the two placeholder strings.
 *
 * Usage: npm run masters
 */

import { zipSync, strToU8 } from '../supabase/functions/_shared/vendor/fflate.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

class Sst {
  constructor() { this.map = new Map(); this.list = []; }
  id(text) {
    if (!this.map.has(text)) { this.map.set(text, this.list.length); this.list.push(text); }
    return this.map.get(text);
  }
  xml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${this.list.length}" uniqueCount="${this.list.length}">
${this.list.map((t) => `  <si><t xml:space="preserve">${esc(t)}</t></si>`).join('\n')}
</sst>`;
  }
}

const cell = (sst, ref, text, { bold = false } = {}) =>
  `<c r="${ref}"${bold ? ' s="1"' : ''} t="s"><v>${sst.id(text)}</v></c>`;
const num = (ref, value) => `<c r="${ref}"><v>${value}</v></c>`;
const formula = (ref, f, cached) => `<c r="${ref}"><f>${f}</f><v>${cached}</v></c>`;

function sheetXml(sst, rows) {
  const body = rows.map((cells, i) => `<row r="${i + 1}">${cells.join('')}</row>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<dimension ref="A1:C20"/>
<sheetData>
${body}
</sheetData>
</worksheet>`;
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><name val="Calibri"/></font>
</fonts>
<fills count="2">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
</fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="2">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
</styleSheet>`;

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

function workbookXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<definedNames>
<definedName name="LicenseID">License!$B$3</definedName>
<definedName name="LicensedTo">License!$B$4</definedName>
</definedNames>
<sheets>
<sheet name="License" sheetId="1" r:id="rId1"/>
<sheet name="Budget" sheetId="2" r:id="rId2"/>
<sheet name="Dashboard" sheetId="3" r:id="rId3"/>
</sheets>
<calcPr calcId="191029" fullCalcOnLoad="1"/>
</workbook>`;
}

const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>
<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
<Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

function coreXml(title) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:title>${esc(title)}</dc:title>
<dc:creator>Pravely</dc:creator>
</cp:coreProperties>`;
}

const APP_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
<Application>Pravely</Application>
</Properties>`;

function buildWorkbook(product) {
  const sst = new Sst();
  const licenseSheet = sheetXml(sst, [
    [cell(sst, 'A1', product.name, { bold: true })],
    [],
    [cell(sst, 'A3', 'License ID', { bold: true }), cell(sst, 'B3', 'ITB-XXXXXXXX')],
    [cell(sst, 'A4', 'Licensed To', { bold: true }), cell(sst, 'B4', 'Customer Name / Email')],
    [],
    [cell(sst, 'A6', 'This copy is licensed to [[CUSTOMER_NAME]] ([[CUSTOMER_EMAIL]]). License: [[LICENSE_ID]]. Questions? ITBB@intheblackbudget.com')],
    [],
    [cell(sst, 'A8', 'Supported placeholders — replaced automatically at purchase:', { bold: true })],
    [cell(sst, 'A9', 'ITB-XXXXXXXX · Customer Name / Email · [[LICENSE_ID]] · [[CUSTOMER_NAME]] · [[CUSTOMER_EMAIL]]')],
    [cell(sst, 'A10', '[[CUSTOMER_NAME_EMAIL]] · [[LICENSED_TO]]')],
  ]);
  const budgetSheet = sheetXml(sst, [
    [cell(sst, 'A1', 'Monthly Budget', { bold: true })],
    [],
    [cell(sst, 'A3', 'Income', { bold: true })],
    [cell(sst, 'A4', 'Paycheck 1'), num('B4', 2400)],
    [cell(sst, 'A5', 'Paycheck 2'), num('B5', 2400)],
    [cell(sst, 'A6', 'Side income'), num('B6', 300)],
    [cell(sst, 'A7', 'Total income', { bold: true }), formula('B7', 'SUM(B4:B6)', 5100)],
    [],
    [cell(sst, 'A9', 'Expenses', { bold: true })],
    [cell(sst, 'A10', 'Housing'), num('B10', 1450)],
    [cell(sst, 'A11', 'Utilities'), num('B11', 220)],
    [cell(sst, 'A12', 'Groceries'), num('B12', 480)],
    [cell(sst, 'A13', 'Transport'), num('B13', 160)],
    [cell(sst, 'A14', 'Subscriptions'), num('B14', 95)],
    [cell(sst, 'A15', 'Total expenses', { bold: true }), formula('B15', 'SUM(B10:B14)', 2405)],
    [],
    [cell(sst, 'A17', 'Left to budget', { bold: true }), formula('B17', 'B7-B15', 2695)],
    [cell(sst, 'A18', 'Savings rate', { bold: true }), formula('B18', 'B17/B7', 0.5284)],
  ]);
  const dashboardSheet = sheetXml(sst, [
    [cell(sst, 'A1', 'Dashboard', { bold: true })],
    [],
    [cell(sst, 'A3', 'Left to budget', { bold: true }), formula('B3', 'Budget!B17', 2695)],
    [cell(sst, 'A4', 'Savings rate', { bold: true }), formula('B4', 'Budget!B18', 0.5284)],
    [],
    [cell(sst, 'A6', 'Licensed to [[CUSTOMER_NAME]] · [[CUSTOMER_EMAIL]] · [[LICENSE_ID]]')],
  ]);

  return zipSync({
    '[Content_Types].xml': strToU8(CONTENT_TYPES),
    '_rels/.rels': strToU8(ROOT_RELS),
    'docProps/app.xml': strToU8(APP_XML),
    'docProps/core.xml': strToU8(coreXml(product.name)),
    'xl/workbook.xml': strToU8(workbookXml()),
    'xl/_rels/workbook.xml.rels': strToU8(WORKBOOK_RELS),
    'xl/styles.xml': strToU8(STYLES),
    'xl/sharedStrings.xml': strToU8(sst.xml()),
    'xl/worksheets/sheet1.xml': strToU8(licenseSheet),
    'xl/worksheets/sheet2.xml': strToU8(budgetSheet),
    'xl/worksheets/sheet3.xml': strToU8(dashboardSheet),
  });
}

const products = [
  { id: 'essentials', name: 'Pravely Essentials' },
  { id: 'complete', name: 'Pravely Complete' },
  { id: 'premium', name: 'Pravely Premium Toolkit' },
];

const outDir = join(ROOT, 'assets/masters');
mkdirSync(outDir, { recursive: true });
for (const p of products) {
  const bytes = buildWorkbook(p);
  const path = join(outDir, `${p.id}.xlsx`);
  writeFileSync(path, bytes);
  console.log(`✔ ${path} (${bytes.length} bytes)`);
}
console.log('\nNext: npm run seed   (uploads these to the Supabase workbook-masters bucket)');
