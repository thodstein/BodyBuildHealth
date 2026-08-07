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
}

/**
 * Merge results from both parsers, preferring provider-aware results.
 * Auto-convert units using UCUM_MAP coefficients.
 */
function mergeParsedResults(
  pdfResults: ParsedLabValue[],
  providerResults: { marker: string; value: number; unit: string; confidence: number }[],
  provider: string | undefined
): ParsedLabValue[] {
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
  return [...codes].map(code => {
    const table = tableByCode.get(code);
    const providerValue = providerByCode.get(code);
    // Provider parser is useful for split OCR rows, while the table parser
    // carries the authoritative unit and reference range when available.
    const source = providerValue || table!;
    const sourceUnit = providerValue?.unit || table?.unit || '';
    const normalized = normalizeLabMeasurement(code, source.value, sourceUnit);
    const info = UCUM_MAP[code];
    const refLow = table?.refLow !== undefined
      ? normalizeLabMeasurement(code, table.refLow, table.unit).value
      : undefined;
    const refHigh = table?.refHigh !== undefined
      ? normalizeLabMeasurement(code, table.refHigh, table.unit).value
      : undefined;
    return {
      code,
      name: info?.name ?? table?.name ?? code,
      value: normalized.value,
      unit: normalized.unit,
      refLow,
      refHigh,
      isAbnormal: refHigh !== undefined
        ? normalized.value > refHigh || (refLow !== undefined && normalized.value < refLow)
        : info ? normalized.value > info.uln || normalized.value < info.lln : table?.isAbnormal,
    };
  });
}

function parseLabTextAllWays(rawText: string, extractionMethod: string): { labs: ParsedLabValue[]; provider: string; warnings: string[] } {
  const parsed = parseLabTextFromPdf(rawText);
  const pdfLabs = parsed.values.map(v => ({ ...v }));
  const providerResults = parseLabTextProviderAware(rawText);
  const provider = detectProvider(rawText);
  const labs = mergeParsedResults(pdfLabs, providerResults, provider);
  const regexResults = parseWithBiomarkerRegex(rawText, extractionMethod);
  const existingCodes = new Set(labs.map(l => mapToUcumCode(l.code)));
  for (const marker of regexResults.extractedMarkers) {
    const code = mapToUcumCode(marker.code);
    if (existingCodes.has(code)) continue;
    existingCodes.add(code);
    const normalized = normalizeLabMeasurement(code, marker.value, marker.unit);
    labs.push({
      code,
      name: marker.name,
      value: normalized.value,
      unit: normalized.unit,
      refHigh: marker.ec50 > 0 ? normalizeLabMeasurement(code, marker.ec50, marker.unit).value : undefined,
    });
  }
  return { labs, provider: provider || 'unknown', warnings: regexResults.warnings };
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
      const result = await parseLabFile(file);
      rawText = result.rawText;
      let parsedAll = parseLabTextAllWays(rawText, 'pdf-parse');
      // Scanned PDFs have no text layer. Render their pages and run the same
      // Russian/English OCR pipeline used for uploaded photos.
      if (parsedAll.labs.length === 0) {
        const ocrText = await ocrScannedPdf(file);
        if (ocrText) {
          rawText = ocrText;
          parsedAll = parseLabTextAllWays(rawText, 'tesseract.js');
        }
      }
      labs = parsedAll.labs;
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
    } catch (err: any) {
      warnings.push('Ошибка чтения PDF: ' + (err?.message || String(err)));
    }
  } else if (isImage) {
    source = 'image';
    try {
      // Try Tesseract OCR for image
      const Tesseract = await import('tesseract.js');
      let result;
      try {
        result = await Tesseract.recognize(file, 'rus+eng', {
          logger: (m: any) => { if (m.status === 'recognizing text') confidence = m.progress ?? 0.5; },
        });
      } catch (langErr) {
        // Fallback to English-only if Russian language data isn't available
        console.warn('rus+eng OCR failed, trying eng only:', langErr);
        result = await Tesseract.recognize(file, 'eng', {
          logger: (m: any) => { if (m.status === 'recognizing text') confidence = m.progress ?? 0.5; },
        });
      }
      rawText = result.data.text || '';
      
      // Short food labels such as "рис 150 г" are valid OCR input too.
      if (rawText.trim().length > 2) {
        const parsedAll = parseLabTextAllWays(rawText, 'tesseract.js');
        labs = parsedAll.labs;
        const providerName = parsedAll.provider;
        if (providerName !== 'unknown') warnings.push(`Распознан бланк: ${providerName}`);

        warnings.push(...parsedAll.warnings);

        // Also try nutrition parsing
        meals = parseNutritionText(rawText);

        confidence = (labs.length > 0 || meals.length > 0) ? 0.75 : 0.3;
        if (labs.length === 0 && meals.length === 0) {
          warnings.push('Текст распознан, но данные не найдены. Проверьте формат изображения.');
        }
      } else {
        warnings.push('Не удалось распознать текст на изображении. Попробуйте более чёткое фото.');
      }
    } catch (err: any) {
      warnings.push('Ошибка OCR: ' + (err?.message || String(err)));
      // Fallback silently
    }
  } else if (isText) {
    source = 'text';
    try {
      rawText = await file.text();
       const parsedAll = parseLabTextAllWays(rawText, 'text');
       labs = parsedAll.labs;
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
    const raw = localStorage.getItem('nutrition_diary');
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
        });
        saved++;
      }
    }
    
    localStorage.setItem('nutrition_diary', JSON.stringify(diary));
    onSaved?.();
  } catch (e) {
    console.error('Error saving parsed meals:', e);
  }
  return saved;
}
