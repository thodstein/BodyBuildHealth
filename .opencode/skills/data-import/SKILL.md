---
name: Data Import
description: Parsers and importers for CSV, XLSX, lab PDFs/photos, InBody, cardio FIT/TCX/GPX and nutrition labels
---

# Data import (`src/data`, `src/core`, `src/engines`)

`src/data/` holds **datasets only** (`support-*`, `recipe-db-p1..p39`, `lab-*`, `lms-cycles/`, `cardio-cycles/`,
`ss-cycles/`, `usda-foods.ts`). Parsing code lives in `src/core` and `src/engines`.

| Format          | Parser                                                                                                                                                                                                                | Notes                                                                                                                                  |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| CSV             | `src/core/data/csv-parser.ts` (`parseCSV`)                                                                                                                                                                            | accepts both `,` and `;` delimiters                                                                                                    |
| XLSX / XLSM     | `scripts/lms-batch-parse.cjs` (+ `lms-import-parser.cjs`) — **offline only**                                                                                                                                          | `xlsx` inside the app is export-only (`combat/combat-xlsx.engine.ts`, `manual-export-pro.engine.ts`, `SRCBBScreen_parts/pl-export.ts`) |
| Lab text        | `src/core/lab-auto-parser.ts` (`parseLabText`, `detectProvider`, `extractTextFromFile`)                                                                                                                               | provider detection before field extraction                                                                                             |
| Lab PDF         | `src/engines/pdf-parser.engine.ts` (`parsePDF`, `ocrScannedPdf`, `parseLabFile`, `PROVIDER_HEADERS`)                                                                                                                  | scanned PDFs fall back to OCR                                                                                                          |
| Lab photo / OCR | `src/core/ocr-engine.ts` (`recognizeImageTextOffline`, `processUploadedFile`) + `src/engines/biomarker-regex-engine.ts`                                                                                               | Tesseract assets must be in `public/` (see `asset-sync`)                                                                               |
| Cardio          | `src/engines/cardio-import.engine.ts` — `CARDIO_IMPORT_FORMATS = ['gpx','tcx','apple_health','csv','json','fit','zip']`, `parseCardioFitAsync` (`fit-file-parser`), `parseCardioZipAsync` (`fflate`), `fitDecoupling` | FIT/TCX/GPX/Apple Health/ZIP                                                                                                           |
| Nutrition label | `src/engines/nutrition-label-parser.ts` (`parseNutritionLabel`, basis `100g / serving / unknown`) + `src/engines/nutrition-ocr-parser.ts`                                                                             |                                                                                                                                        |
| Barcode         | `src/engines/openfoodfacts.engine.ts`, `food-barcode-catalog.engine.ts`                                                                                                                                               | catalog table `supabase/migrations/20260824_food_barcode_catalog.sql`                                                                  |

## Lab flow (import → core → engine)

`ocr-engine.processUploadedFile` → `pdf-parser parseLabFile` / `lab-auto-parser parseLabText` /
`biomarker-regex-engine` → `core/labs-mapping normalizeLabMeasurement` + `mapToUcumCode` → `core/lab-bound` →
`engines/lab-norms.engine getLabNorm` → `ocr-engine.saveParsedLabs` (writes IndexedDB, emits
`notifyDataChange`). Units are canonicalised through UCUM (`src/core/constants.ts` `UCUM_MAP`) — never store raw
units without mapping.

## Adding a format or provider

1. Put extraction in a parser module (`src/engines/*-parser*.ts` for formats, `src/core/` when the result feeds
   IndexedDB), and keep UI out of it.
2. Normalise every numeric value to the canonical unit before saving; add the provider header/regex to the
   existing table (`PROVIDER_HEADERS`, biomarker regex list) instead of a new ad-hoc branch.
3. Prefer `async` parsers for anything > a few hundred KB (FIT/ZIP already are) so the UI thread stays responsive.
4. Add a test next to the existing ones: lab → `src/core/__tests__/ocr-*.test.ts` / `lab-*.test.ts` and
   `src/engines/__tests__/lab-*.test.ts`; cardio → `src/engines/cardio/__tests__`; datasets →
   `src/data/__tests__/`.
5. Run `npm run type-check` plus the matching suite (`test:core` / `test:bb` / `test:ui`); `project_verify` picks
   the suite from the changed paths.

## Gotchas

- OCR/PDF workers are served from `public/` (`sync-ocr-assets.mjs` on `postinstall` and at the start of `build`).
  If recognition suddenly 404s, re-run `npm run sync-ocr-assets` instead of editing `public/`.
- Encoding fixes for imported datasets go through `scripts/fix-nutrition-encoding.mjs` (iconv-lite); never patch
  mojibake by hand.
- `scripts/render-*.mjs` and `scripts/verify-*.mts` are throwaway harnesses, not part of the app or CI.
