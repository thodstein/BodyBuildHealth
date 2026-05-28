import { createWorker } from 'tesseract.js';
import type { ParsedLabResult } from './types';

export async function processFile(file: File): Promise<{ labs: ParsedLabResult[] }> {
  const worker = await createWorker('eng+rus');
  const { data: { text } } = await worker.recognize(file);
  await worker.terminate();

  // Простой парсинг OCR-текста
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  const labs: ParsedLabResult[] = [];
  for (const line of lines) {
    const match = line.match(/^([A-Za-z\s]+)[\s:]+([\d.,]+)[\s]+(.*)$/);
    if (match) {
      labs.push({ marker: match[1].trim().toUpperCase(), value: parseFloat(match[2].replace(',', '.')), unit: match[3].trim() });
    }
  }
  return { labs };
}

// Алиас для совместимости
export const processLabFile = processFile;
