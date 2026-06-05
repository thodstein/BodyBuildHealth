import { createWorker, Worker } from 'tesseract.js';
import { parseLabText, ParsedLabResult } from './lab-auto-parser';
import { parseNutritionScreenshot, ParsedMeal } from '../engines/nutrition-ocr-parser';

let worker: Worker | null = null;

async function initTesseract() {
  if (!worker) {
    worker = await createWorker('rus+eng', 1, {
      logger: m => console.log('OCR progress:', m.progress || m.status)
    });
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789.,-<>=Рђ-РЇР°-СЏA-Za-z/В°%()[]{} '
    });
  }
  return worker;
}

export async function processFile(file: File): Promise<{ text: string; labs: ParsedLabResult[]; meals: ParsedMeal[] }> {
  let rawText = '';
  
  if (file.type.includes('text') || file.name.endsWith('.txt')) {
    rawText = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = () => rej(new Error('File read failed'));
      r.readAsText(file);
    });
  } else {
    const w = await initTesseract();
    const { data } = await w.recognize(file);
    rawText = data.text;
  }

  const labs = parseLabText(rawText);
  const meals = parseNutritionScreenshot(rawText);
  
  return { text: rawText, labs, meals };
}

export function terminateOCR() {
  if (worker) worker.terminate();
  worker = null;
}
