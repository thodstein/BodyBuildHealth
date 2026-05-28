export interface CSVRow { [key: string]: string; }

export function parseCSV(text: string): CSVRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];

  const cleanHeader = (h: string) => h.trim().toLowerCase().replace(/\s+/g, '_').replace(/["']/g, '');
  const cleanValue = (v: string) => v.trim().replace(/^["']|["']$/g, '').trim();

  const headers = parseLine(lines[0]).map(cleanHeader);
  const rows: CSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    if (cols.length === 0) continue;
    const row: CSVRow = {};
    headers.forEach((h, idx) => { row[h] = cleanValue(cols[idx] || ''); });
    rows.push(row);
  }
  return rows;
}

function parseLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if ((ch === ',' || ch === ';') && !inQuotes) {
      result.push(current); current = '';
    } else current += ch;
  }
  result.push(current);
  return result;
}

export function cleanRecord<T extends Record<string, any>>(obj: T): T {
  const cleaned: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    const cleanK = k.trim().toLowerCase().replace(/\s+/g, '_');
    cleaned[cleanK] = typeof v === 'string' ? v.trim() : v;
  }
  return cleaned as T;
}