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
  raw?: string;
  confidence?: number;
}

/**
 * Merge results from both parsers, preferring provider-aware results.
 * Auto-convert units using UCUM_MAP coefficients.
 */
function mergeParsedResults(
  pdfResults: ParsedLabValue[],
  providerResults: { marker: string; value: number; unit: string; confidence: number }[],
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
    const selectedUnit = source.unit || table?.unit || '';
    const refLow = table?.refLow !== undefined
      ? normalizeLabMeasurement(code, table.refLow, selectedUnit).value
      : undefined;
    const refHigh = table?.refHigh !== undefined
      ? normalizeLabMeasurement(code, table.refHigh, selectedUnit).value
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
      raw: isUsefulRawLine(marker.sourceLine) ? marker.sourceLine : undefined,
    });
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
    if (!code || !Number.isFinite(lab.value) || lab.value <= 0 || !lab.unit) continue;
    const current = byCode.get(code);
    if (!current) {
      byCode.set(code, { ...lab, code });
      continue;
    }
    const currentHasRange = current.refLow !== undefined || current.refHigh !== undefined;
    const nextHasRange = lab.refLow !== undefined || lab.refHigh !== undefined;
    if (nextHasRange && !currentHasRange) byCode.set(code, { ...lab, code });
    else if (nextHasRange === currentHasRange && lab.value === current.value && !current.isAbnormal && lab.isAbnormal) {
      byCode.set(code, { ...lab, code });
    }
  }
  return [...byCode.values()];
}

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
      const result = await parseLabFile(file, arrayBuffer);
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
          }
        } catch (ocrError: any) {
          warnings.push(`OCR PDF недоступен: ${ocrError?.message || 'неизвестная ошибка'}`);
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
      if (!rawText.trim()) warnings.push('Не удалось обработать изображение через улучшенный режим, использован прямой OCR.');
      
      // Short food labels such as "рис 150 г" are valid OCR input too.
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
          category: item.category,
          foodId: item.foodId,
          micros: item.micros,
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
