import { parseLabText as parseLabTextFromPdf, parseLabFile, ocrScannedPdf, type ParsedLabResult as PdfParsedLabResult } from '../engines/pdf-parser.engine';
import { parseNutritionText, type ParsedMeal } from '../engines/nutrition-ocr-parser';
import { parseLabText as parseLabTextProviderAware, detectProvider } from './lab-auto-parser';
import { parseLabResults as parseWithBiomarkerRegex, type ExtractedMarker } from '../engines/biomarker-regex-engine';
import { UCUM_MAP } from './constants';
import { mapToUcumCode, normalizeLabMeasurement } from './labs-mapping';
import { db } from './db';
import { notifyDataChange } from './data-link';
import { formatDate } from './utils/date-utils';
import type { LabPoint } from './types';

/**
 * Robust file-as-text reader. Uses Blob.text() when available (modern browsers),
 * falls back to FileReader + TextDecoder for older browsers / jsdom where
 * File.prototype.text is not implemented.
 */
async function readFileAsText(file: File | Blob): Promise<string> {
  if (typeof (file as any).text === 'function') {
    try {
      return await (file as any).text();
    } catch {
      // fall through to FileReader path
    }
  }
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const result = reader.result;
        if (typeof result === 'string') resolve(result);
        else if (result instanceof ArrayBuffer) resolve(new TextDecoder('utf-8').decode(result));
        else resolve('');
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(reader.error || new Error('FileReader error'));
    reader.readAsText(file);
  });
}

export interface OCRResult {
  text: string;
  labs: ParsedLabValue[];
  meals: ParsedMeal[];
  source: 'pdf' | 'image' | 'text';
  confidence: number;
  warnings: string[];
}

export interface ParsedLabValue {
  code: string;
  name: string;
  value: number;
  unit: string;
  refLow?: number;
  refHigh?: number;
  isAbnormal?: boolean;
  raw?: string;
  confidence?: number;
}

/**
 * Merge results from both parsers, preferring provider-aware results.
 * Auto-convert units using UCUM_MAP coefficients.
 */
function mergeParsedResults(
  pdfResults: ParsedLabValue[],
  providerResults: { marker: string; value: number; unit: string; confidence: number; refLow?: number; refHigh?: number }[],
  provider: string | undefined
): { labs: ParsedLabValue[]; warnings: string[] } {
  const warnings: string[] = [];
  const tableByCode = new Map<string, ParsedLabValue>();
  for (const pv of pdfResults) {
    const code = mapToUcumCode(pv.code);
    if (!tableByCode.has(code)) tableByCode.set(code, { ...pv, code });
  }
  const providerByCode = new Map<string, (typeof providerResults)[number]>();
  for (const pr of providerResults) {
    const code = mapToUcumCode(pr.marker);
    if (!providerByCode.has(code)) providerByCode.set(code, pr);
  }

  const codes = new Set([...tableByCode.keys(), ...providerByCode.keys()]);
  const labs = [...codes].map(code => {
    const table = tableByCode.get(code);
    const providerValue = providerByCode.get(code);
    // Provider parser is useful for split OCR rows, while the table parser
    // carries the authoritative unit and reference range when available.
    const source = table?.refLow !== undefined || table?.refHigh !== undefined
      ? table
      : providerValue || table!;
    // The unit must belong to the same candidate as the selected value. Using
    // a provider unit for a table value can silently apply the wrong factor.
    const sourceUnit = source.unit || '';
    const normalized = normalizeLabMeasurement(code, source.value, sourceUnit);
    const info = UCUM_MAP[code];
    const refUnit = table?.unit || source.unit || '';
    const refLow = table?.refLow !== undefined
      ? normalizeLabMeasurement(code, table.refLow, refUnit).value
      : providerValue?.refLow !== undefined
      ? normalizeLabMeasurement(code, providerValue.refLow, providerValue.unit || refUnit).value
      : undefined;
    const refHigh = table?.refHigh !== undefined
      ? normalizeLabMeasurement(code, table.refHigh, refUnit).value
      : providerValue?.refHigh !== undefined
      ? normalizeLabMeasurement(code, providerValue.refHigh, providerValue.unit || refUnit).value
      : undefined;
    const result = {
      code,
      name: info?.name ?? table?.name ?? code,
      value: normalized.value,
      unit: normalized.unit,
      refLow,
      refHigh,
      isAbnormal: refHigh !== undefined
        ? normalized.value > refHigh || (refLow !== undefined && normalized.value < refLow)
        : info ? normalized.value > info.uln || normalized.value < info.lln : table?.isAbnormal,
      raw: isUsefulRawLine(table?.raw) ? table?.raw : undefined,
    };
    if (table && providerValue) {
      const providerNormalized = normalizeLabMeasurement(code, providerValue.value, providerValue.unit).value;
      if (Math.abs(providerNormalized - normalized.value) > Math.max(0.01, Math.abs(normalized.value) * 0.05)) {
        warnings.push(`Разные варианты распознавания для ${result.name}; выбран табличный результат.`);
      }
    }
    return result;
  });
  return { labs, warnings };
}

function parseLabTextAllWays(rawText: string, extractionMethod: string): { labs: ParsedLabValue[]; provider: string; warnings: string[] } {
  const parsed = parseLabTextFromPdf(rawText);
  const pdfLabs = parsed.values.map(v => ({ ...v }));
  const providerResults = parseLabTextProviderAware(rawText);
  const provider = detectProvider(rawText);
  const merged = mergeParsedResults(pdfLabs, providerResults, provider);
  const labs = merged.labs;
  const regexResults = parseWithBiomarkerRegex(rawText, extractionMethod);

  // Build a lookup of existing labs by canonical code so the regex parser can
  // augment rather than be blocked by earlier (possibly lower-quality) results.
  const labsByCode = new Map<string, ParsedLabValue>();
  for (const l of labs) labsByCode.set(mapToUcumCode(l.code), l);

  for (const marker of regexResults.extractedMarkers) {
    const code = mapToUcumCode(marker.code);
    const normalized = normalizeLabMeasurement(code, marker.value, marker.unit);
    // ec50 from biomarker-regex is a statistical bound, NOT a clinical reference.
    // Only use it as refHigh when UCUM_MAP provides no reference (rare markers).
    const info = UCUM_MAP[code];
    const refHigh = (marker.ec50 > 0 && !info) 
      ? normalizeLabMeasurement(code, marker.ec50, marker.unit).value 
      : undefined;
    const newLab: ParsedLabValue = {
      code,
      name: marker.name,
      value: normalized.value,
      unit: normalized.unit,
      refHigh,
      isAbnormal: info
        ? normalized.value > info.uln || normalized.value < info.lln
        : refHigh !== undefined ? normalized.value > refHigh : undefined,
      raw: isUsefulRawLine(marker.sourceLine) ? marker.sourceLine : undefined,
    };
    const existing = labsByCode.get(code);
    if (!existing) {
      // New marker not found by other parsers — add it.
      labsByCode.set(code, newLab);
      labs.push(newLab);
      continue;
    }
    // Marker already found — only override if the new result is strictly better
    // (has a reference range when the existing one doesn't, or has a unit when
    // the existing one doesn't).
    const existingHasRange = existing.refLow !== undefined || existing.refHigh !== undefined;
    const newHasRange = newLab.refHigh !== undefined;
    if (newHasRange && !existingHasRange) {
      const idx = labs.indexOf(existing);
      if (idx >= 0) labs[idx] = newLab;
      labsByCode.set(code, newLab);
    }
  }
  return { labs, provider: provider || 'unknown', warnings: [...merged.warnings, ...regexResults.warnings] };
}

function shouldRetryPdfWithOcr(text: string, labs: ParsedLabValue[]): boolean {
  const cleanText = text.replace(/\s+/g, ' ').trim();
  if (!cleanText || cleanText.length < 80 || /�|\uFFFD|invalid pdf|pdf parsing/i.test(cleanText)) return true;
  if (labs.length === 0) return true;
  const headerHits = cleanText.match(/анализ|показател|результат|референ|единиц|наименование|лаборатор|гемотест|инвитро|хеликс|kdl/gi)?.length ?? 0;
  const numericTokens = cleanText.match(/\d+(?:[.,]\d+)?/g)?.length ?? 0;
  return labs.length < 2 && (headerHits === 0 || numericTokens < 2);
}

function finalizeLabCandidates(labs: ParsedLabValue[]): ParsedLabValue[] {
  const byCode = new Map<string, ParsedLabValue>();
  for (const lab of labs) {
    const code = mapToUcumCode(lab.code);
    if (!code || !Number.isFinite(lab.value) || lab.value < 0) continue;
    // Reject OCR fragments (units, footer words, order numbers) that are not
    // canonical marker codes. Real canonical codes are ASCII identifiers;
    // Cyrillic/space/slash fragments must never reach the diary.
    if (!/^[A-Z][A-Z0-9_]*$/i.test(code)) continue;
    // Zero is a valid result for urine microscopy and test-strip markers
    // (e.g. "лейкоциты: 0", "белок: отрицательно"). It used to be removed
    // here after the parsers had already recognized it.
    const isUrineMarker = code.startsWith('URINE_') || code.startsWith('NECHIP_')
      || code === 'UROBILINOGEN' || code === 'UROBILINOGEN_QR'
      || code === 'PROTEIN_24H' || code === 'CREATININE_URINE';
    const explicitZero = lab.value === 0 && /(?:^|\s)0(?:[.,]0*)?\s*[+*]*\s*(?:%|[а-яa-z]+\s*\/\s*[а-яa-z]+|[а-яa-z]+\s*[а-яa-z]+)/i.test(lab.raw || '');
    if (lab.value === 0 && !isUrineMarker && !explicitZero) continue;
    // Skip false-positive codes from combined-line parsing: section headers
    // concatenated with marker names (e.g. "ОБЩИЙ АНАЛИЗ КРОВИ ГЕМОГЛОБИН")
    // produce codes that are clearly not canonical marker identifiers.
    if (code.includes(' ') || code.length > 30) continue;
    // Infer unit from canonical defaults when OCR couldn't extract one.
    // Previously, labs without a unit were silently dropped, which caused
    // many valid markers to be lost when the OCR split units into separate
    // columns or failed to recognize abbreviated unit forms.
    let unit = lab.unit;
    if (!unit) {
      const info = UCUM_MAP[code.toUpperCase()];
      if (info?.prefUnit) unit = info.prefUnit;
      else {
        // Fall back to the biomarker-regex UNIT_MAP defaults by canonical code.
        const biomarkerUnit = INFERRED_UNITS_BY_CODE[code.toUpperCase()];
        if (biomarkerUnit) unit = biomarkerUnit;
      }
    }
    if (unit === undefined || unit === null) continue; // truly unknown marker with no known unit (empty string is valid for dimensionless markers like INR)
    const current = byCode.get(code);
    if (!current) {
      byCode.set(code, { ...lab, code, unit });
      continue;
    }
    const currentHasRange = current.refLow !== undefined || current.refHigh !== undefined;
    const nextHasRange = lab.refLow !== undefined || lab.refHigh !== undefined;
    if (nextHasRange && !currentHasRange) byCode.set(code, { ...lab, code, unit });
    else if (nextHasRange === currentHasRange && lab.value === current.value && !current.isAbnormal && lab.isAbnormal) {
      byCode.set(code, { ...lab, code, unit });
    }
  }
  return [...byCode.values()];
}

// Fallback unit lookup for codes that are in the biomarker dictionary but
// not in UCUM_MAP. This keeps markers alive even when OCR loses the unit.
const INFERRED_UNITS_BY_CODE: Record<string, string> = {
  'TSH': 'mIU/L', 'E2': 'pmol/L', 'PRL': 'mIU/L', 'LH': 'IU/L', 'FSH': 'IU/L',
  'IGF-1': 'ng/mL', 'PSA': 'ng/mL', 'HGB': 'g/L', 'HCT': '%', 'WBC': '10^9/L',
  'RBC': '10^12/L', 'PLT': '10^9/L', 'FERRITIN': 'ng/mL', 'VITD': 'ng/mL',
  'B12': 'pg/mL', 'FOL': 'ng/mL', 'INS': 'mIU/L', 'HbA1c': '%',
  'D_DIMER': 'ng/mL', 'FIBRINOGEN': 'g/L', 'TROPONIN': 'ng/mL',
  'HOMOCYSTEINE': 'mcmol/L', 'CORTISOL': 'nmol/L', 'AMYLASE': 'U/L',
  'LIPASE': 'U/L', 'C_PEPTIDE': 'ng/mL', 'ACTH': 'pg/mL',
  'ALDOSTERONE': 'pg/mL', 'PTH': 'pg/mL', 'MPV': 'fL',
  'TPO_AB': 'IU/mL', 'TG_AB': 'IU/mL', 'APTT': 's', 'PT': 's', 'INR': '',
};

function isUsefulRawLine(raw: string | undefined): boolean {
  if (!raw) return false;
  const line = raw.replace(/\s+/g, ' ').trim();
  return line.length >= 3 && !/^(?:error|warning|invalid pdf|pdf parsing)/i.test(line);
}

/**
 * Process an uploaded file (PDF, image, or text) for lab analysis or nutrition data.
 * Returns parsed labs and meals ready for auto-input.
 */
export async function processUploadedFile(file: File): Promise<OCRResult> {
  const warnings: string[] = [];
  let labs: ParsedLabValue[] = [];
  let meals: ParsedMeal[] = [];
  let rawText = '';
  let source: 'pdf' | 'image' | 'text' = 'text';
  let confidence = 0.5;

  const isPDF = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  const isImage = file.type.startsWith('image/') || /\.(png|jpg|jpeg|webp|bmp|gif)$/i.test(file.name);
  const isText = file.type.includes('text') || /\.(txt|csv)$/i.test(file.name);

  if (isPDF) {
    source = 'pdf';
    try {
      const arrayBuffer = await file.arrayBuffer();
      let result;
      try {
        result = await parseLabFile(file, arrayBuffer);
      } catch (pdfParseError: any) {
        // parseLabFile can throw when pdfjs worker fails to load. Fall back to
        // direct OCR of the rendered pages so a broken PDF text-layer pipeline
        // does not turn a valid scanned PDF into "nothing recognized".
        warnings.push(`PDF text-layer extraction failed: ${pdfParseError?.message || String(pdfParseError)}. Пробую OCR страниц.`);
        result = { values: [], rawText: '', source: 'pdf' as const, warnings: [] };
      }
      rawText = result.rawText;
      let parsedAll = parseLabTextAllWays(rawText, 'pdf-parse');
      // Scanned PDFs have no text layer. Render their pages and run the same
      // Russian/English OCR pipeline used for uploaded photos.
      if (shouldRetryPdfWithOcr(rawText, parsedAll.labs)) {
        try {
          const ocrText = await ocrScannedPdf(arrayBuffer);
          if (ocrText.trim()) {
            const ocrParsed = parseLabTextAllWays(ocrText, 'tesseract.js');
            // Keep valid text-layer rows and use page OCR to fill missing rows.
            // Replacing the text layer would discard correctly extracted values.
            parsedAll = {
              labs: finalizeLabCandidates([...parsedAll.labs, ...ocrParsed.labs]),
              provider: parsedAll.provider !== 'unknown' ? parsedAll.provider : ocrParsed.provider,
              warnings: [...parsedAll.warnings, ...ocrParsed.warnings],
            };
            rawText = `${rawText}\n${ocrText}`.trim();
            warnings.push('PDF обработан через OCR страниц.');
          } else {
            warnings.push('OCR PDF вернул пустой текст. Возможно, файл защищён или изображение неразборчиво.');
          }
        } catch (ocrError: any) {
          warnings.push(`OCR PDF недоступен: ${ocrError?.message || 'неизвестная ошибка'}. Проверьте подключение к интернету или попробуйте скриншот.`);
        }
      }
      labs = finalizeLabCandidates(parsedAll.labs);
      const providerName = parsedAll.provider;
      confidence = labs.length > 0 ? 0.85 : 0.3;
      if (providerName !== 'unknown') {
        warnings.push(`Распознан бланк: ${providerName}`);
      }
      warnings.push(...parsedAll.warnings);
      if (result.warnings) warnings.push(...result.warnings);
      if (labs.length === 0 && rawText.length > 50) {
        warnings.push('PDF распознан, но показатели не найдены. Попробуйте скриншот или ручной ввод.');
      }
      if (labs.length === 0 && /ошибка|error|invalid pdf|pdf parsing/i.test(rawText)) {
        warnings.push('PDF не удалось открыть или прочитать. Проверьте, что файл не защищён паролем и не повреждён.');
      }
    } catch (err: any) {
      warnings.push('Ошибка чтения PDF: ' + (err?.message || String(err)));
    }
  } else if (isImage) {
    source = 'image';
    try {
      const imageResult = await parseLabFile(file);
      rawText = imageResult.rawText || '';
      const originalText = imageResult.originalText || rawText;
      
      if (rawText.trim().length > 2) {
        const parsedAll = parseLabTextAllWays(rawText, 'tesseract.js');
        labs = finalizeLabCandidates(parsedAll.labs);
        const providerName = parsedAll.provider;
        if (providerName !== 'unknown') warnings.push(`Распознан бланк: ${providerName}`);

        warnings.push(...parsedAll.warnings);

        // Also try nutrition parsing on original OCR text to preserve table alignment
        meals = parseNutritionText(originalText);

        confidence = (labs.length > 0 || meals.length > 0) ? 0.75 : 0.3;
        if (labs.length === 0 && meals.length === 0) {
          if (rawText.trim().length > 20) {
            warnings.push(`Текст распознан (${rawText.trim().length} символов), но показатели не найдены. Возможно, это не бланк анализов.`);
          } else {
            warnings.push('Текст распознан, но данных недостаточно. Попробуйте более чёткое фото.');
          }
        }
      } else {
        warnings.push('Не удалось распознать текст на изображении. Попробуйте более чёткое фото при хорошем освещении.');
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      warnings.push(`Ошибка обработки изображения: ${msg}`);
      rawText = '';
    }
  } else if (isText) {
    source = 'text';
    try {
      rawText = await readFileAsText(file);
       const parsedAll = parseLabTextAllWays(rawText, 'text');
       labs = finalizeLabCandidates(parsedAll.labs);
       const providerName = parsedAll.provider;
       warnings.push(...parsedAll.warnings);

      if (providerName !== 'unknown') warnings.push(`Распознан бланк: ${providerName}`);

      meals = parseNutritionText(rawText);

      confidence = (labs.length > 0 || meals.length > 0) ? 0.9 : 0.3;
    } catch (err: any) {
      warnings.push('Ошибка чтения текстового файла: ' + (err?.message || String(err)));
    }
  }

  return { text: rawText, labs, meals, source, confidence, warnings };
}

/**
 * Save parsed lab results to IndexedDB
 */
export async function saveParsedLabs(labs: ParsedLabValue[], phase: string): Promise<number> {
  let saved = 0;
  try {
    await db.init();
    for (const lab of labs) {
      const point: LabPoint = {
        id: crypto.randomUUID(),
        code: lab.code,
        name: lab.name,
        value: lab.value,
        unit: lab.unit,
        date: formatDate(new Date()),
        phase,
        refLow: lab.refLow,
        refHigh: lab.refHigh,
        isAbnormal: lab.isAbnormal,
      };
      await db.put('labs_log', point);
      saved++;
    }
    if (saved > 0) notifyDataChange();
  } catch (e) {
    console.error('Error saving parsed labs:', e);
  }
  return saved;
}

/**
 * Save parsed meals to localStorage nutrition diary
 */
export function saveParsedMeals(meals: ParsedMeal[], onSaved?: () => void): number {
  let saved = 0;
  try {
    const raw = localStorage.getItem('nutrition_diary_v2');
    const diary = raw ? JSON.parse(raw) : {};
    
    for (const meal of meals) {
      const date = meal.date || formatDate(new Date());
      if (!diary[date]) diary[date] = { meals: {} };
      
      const mealKey = meal.mealType || 'Приём пищи';
      if (!diary[date].meals[mealKey]) diary[date].meals[mealKey] = [];
      
      for (const item of meal.items) {
        diary[date].meals[mealKey].push({
          name: item.name,
          qty: item.qty,
          kcal: item.kcal,
          p: item.p,
          f: item.f,
          c: item.c,
          category: item.category,
          foodId: item.foodId,
          micros: item.micros,
        });
        saved++;
      }
    }
    
    localStorage.setItem('nutrition_diary_v2', JSON.stringify({ ...diary, __version: 2 }));
    onSaved?.();
  } catch (e) {
    console.error('Error saving parsed meals:', e);
  }
  return saved;
}
