# Master Workbook Guide

The pipeline personalizes **your master .xlsx** by replacing placeholder
strings — nothing else in the file is touched (styling, charts, images,
formulas, defined names, sheets, everything survives byte-for-byte). So the
only requirement is that your master contains the right placeholder strings
in the cells you want personalized.

## The two required placeholders

| Cell you want | Type exactly | Becomes at purchase |
|---|---|---|
| License ID | `PRV-XXXXXXXX` | `PRV-7K4X9P2M` |
| Licensed To | `Customer Name / Email` | `John Smith / john@email.com` |

For example, a "License" sheet:

```
A3:  License ID      B3:  PRV-XXXXXXXX
A4:  Licensed To     B4:  Customer Name / Email
```

If either string is missing from the master, the pipeline **fails loudly**
(rather than ship an unpersonalized file) and the error names the missing
placeholder — that's intentional.

## Optional tokens (all replaced automatically)

You can use any of these anywhere else in the workbook — title pages,
welcome sheets, dashboard headers, chart notes:

| Token | Becomes |
|---|---|
| `[[LICENSE_ID]]` | `PRV-7K4X9P2M` |
| `[[CUSTOMER_NAME]]` | `John Smith` |
| `[[CUSTOMER_EMAIL]]` | `john@email.com` |
| `[[CUSTOMER_NAME_EMAIL]]` | `John Smith / john@email.com` |
| `[[LICENSED_TO]]` | `John Smith / john@email.com` |

The placeholder masters in `assets/masters/` contain every token — open one
in Excel to see them in context (the License sheet doubles as a reference).

## Rules for placeholders

1. **Plain text in a single cell.** Type the token as one normal text value.
2. **No partial formatting of the token.** Don't bold *half* of
   `PRV-XXXXXXXX` inside the cell (Excel splits such strings into multiple
   runs internally). Whole-cell formatting is fine — that's stored separately
   from the text.
3. **Exact match.** Uppercase, same punctuation, no trailing spaces.
4. You can put a token inside a longer sentence, e.g.
   `This copy is licensed to [[CUSTOMER_NAME]] ([[CUSTOMER_EMAIL]]).`

## File format

- `.xlsx` is the standard. `.xlsm` (with macros) also works — the pipeline
  copies `vbaProject.bin` untouched. Note customers will get Excel's standard
  macro warning on open; that's an Excel security prompt, not a file problem.
- Google Sheets: export your final workbook via **File → Download →
  Microsoft Excel (.xlsx)** before using it as the master.

## Swapping in your real workbook

1. Save your finished master as one of (or all of):
   - `assets/masters/essentials.xlsx`
   - `assets/masters/complete.xlsx`
   - `assets/masters/premium.xlsx`
2. `npm run seed` — uploads to the private `workbook-masters` bucket.
3. `npm run simulate -- --product premium` — sanity check; open
   `test-output/Pravely_Premium_Toolkit_*.xlsx` and confirm the two fields.
4. Optionally check the email preview in `test-output/email-preview.html`.

## Naming & paths (if you want different ones)

`supabase/functions/_shared/config.ts` maps each product to its master path
and output filename prefix:

```ts
{ id: 'premium', masterPath: 'premium.xlsx',
  fileNamePrefix: 'Pravely_Premium_Toolkit' }
// → customer file: Pravely_Premium_Toolkit_PRV-7K4X9P2M.xlsx
```

Change the prefix there (and redeploy the functions) if you settle on a
different final product file name.
