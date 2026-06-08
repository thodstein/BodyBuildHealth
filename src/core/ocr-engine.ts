import { parseLabText as parseLabTextFromPdf, parseLabFile, type ParsedLabResult as PdfParsedLabResult } from '../engines/pdf-parser.engine';
import { parseNutritionScreenshot, parseFatSecretText, type ParsedMeal } from '../engines/nutrition-ocr-parser';
import { db } from './db';
import { notifyDataChange } from './data-link';
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

  const isPDF = file.type === 'application/pdf' || file.name.endsWith('.pdf');
  const isImage = file.type.startsWith('image/') || /\.(png|jpg|jpeg|webp|bmp|gif)$/i.test(file.name);
  const isText = file.type.includes('text') || /\.(txt|csv)$/i.test(file.name);

  if (isPDF) {
    source = 'pdf';
    try {
      const result = await parseLabFile(file);
      rawText = result.rawText;
      labs = result.values.map(v => ({
        code: v.code,
        name: v.name,
        value: v.value,
        unit: v.unit,
        refLow: v.refLow,
        refHigh: v.refHigh,
        isAbnormal: v.isAbnormal,
      }));
      confidence = labs.length > 0 ? 0.85 : 0.3;
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
      const result = await Tesseract.recognize(file, 'rus+eng', {
        logger: () => {}, // suppress logs
      });
      rawText = result.data.text || '';
      
      if (rawText.length > 20) {
        // Try to parse as lab results
        const labResult = parseLabFile(file);
        // Since parseLabFile is async and we already have text, parse directly
        const { parseLabText } = await import('../engines/pdf-parser.engine');
        const parsed = parseLabText(rawText);
        labs = parsed.values.map(v => ({
          code: v.code,
          name: v.name,
          value: v.value,
          unit: v.unit,
          refLow: v.refLow,
          refHigh: v.refHigh,
          isAbnormal: v.isAbnormal,
        }));

        // Also try nutrition parsing
        let mealItems = parseNutritionScreenshot(rawText);
        if (mealItems.length === 0) {
          mealItems = parseFatSecretText(rawText);
        }
        meals = mealItems;

        confidence = (labs.length > 0 || meals.length > 0) ? 0.75 : 0.3;
        if (labs.length === 0 && meals.length === 0) {
          warnings.push('Текст распознан, но данные не найдены. Проверьте формат изображения.');
        }
      } else {
        warnings.push('Не удалось распознать текст на изображении. Попробуйте более чёткое фото.');
      }
    } catch (err: any) {
      warnings.push('Ошибка OCR: ' + (err?.message || String(err)));
      // Fallback: try without Tesseract
      try {
        const { parseLabText } = await import('../engines/pdf-parser.engine');
        // At least try with empty text
      } catch {}
    }
  } else if (isText) {
    source = 'text';
    try {
      rawText = await file.text();
      const { parseLabText } = await import('../engines/pdf-parser.engine');
      const parsed = parseLabText(rawText);
      labs = parsed.values.map(v => ({
        code: v.code,
        name: v.name,
        value: v.value,
        unit: v.unit,
        refLow: v.refLow,
        refHigh: v.refHigh,
        isAbnormal: v.isAbnormal,
      }));

      let mealItems = parseNutritionScreenshot(rawText);
      if (mealItems.length === 0) {
        mealItems = parseFatSecretText(rawText);
      }
      meals = mealItems;

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
        date: new Date().toISOString().split('T')[0],
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
export function saveParsedMeals(meals: ParsedMeal[]): number {
  let saved = 0;
  try {
    const raw = localStorage.getItem('nutrition_diary');
    const diary = raw ? JSON.parse(raw) : {};
    
    for (const meal of meals) {
      const date = meal.date || new Date().toISOString().split('T')[0];
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
  } catch (e) {
    console.error('Error saving parsed meals:', e);
  }
  return saved;
}
