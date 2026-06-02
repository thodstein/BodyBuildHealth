import { ParsedLabData } from '../core/types';

export function parseLabText(text: string): ParsedLabData[] {
  const results: ParsedLabData[] = [];
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter(l => l.trim());
  
  const patterns = [
    /([A-ZА-Я]{2,5})[\s:]+([\d,.]+)\s*([A-Za-z\/°%]+)/i,
    /([\d,.]+)\s*([A-Za-z\/°%]+)\s*([A-ZА-Я]{2,5})/i
  ];

  lines.forEach(line => {
    for (const pat of patterns) {
      const match = line.match(pat);
      if (match) {
        let marker = match[1] || match[3];
        const valStr = match[2];
        const unit = match[3] || match[2] || 'ед.';
        
        const normalized = normalizeMarker(marker);
        const value = parseFloat(valStr.replace(',', '.'));
        
        if (normalized && !isNaN(value) && value > 0) {
          results.push({ marker: normalized, value, unit, confidence: 0.9, rawText: line });
        }
      }
    }
  });

  return results;
}

function normalizeMarker(raw: string): string {
  const map: Record<string, string> = {
    'ALT': 'ALT', 'AST': 'AST', 'GGT': 'GGT', 'BIL': 'BIL',
    'HCT': 'HCT', 'HGB': 'HGB', 'PLT': 'PLT', 'WBC': 'WBC',
    'TT': 'TT', 'E2': 'E2', 'PRL': 'PRL', 'LH': 'LH', 'FSH': 'FSH',
    'GLU': 'GLU', 'HOMA': 'HOMA', 'LDL': 'LDL', 'HDL': 'HDL', 'TG': 'TG',
    'CRP': 'CRP', 'CREAT': 'CREATININE', 'CREA': 'CREATININE', 'UREA': 'UREA'
  };
  return map[raw.toUpperCase()] || raw.toUpperCase();
}

export async function extractTextFromFile(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(String(reader.result));
    reader.onerror = () => rej(new Error('Ошибка чтения файла'));
    reader.readAsText(file);
  });
}