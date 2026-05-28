import fs from 'fs';
import path from 'path';
import type { MasterDB } from '../types';

export function cleanKey(key: string): string {
  return key.trim().toLowerCase().replace(/\s+/g, '_').replace(/["']/g, '');
}

export function cleanValue(val: string): string {
  return val.trim().replace(/^["']|["']$/g, '').trim();
}

export function parseCSVLine(line: string): string[] {
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

export function loadCSV(filePath: string): Record<string, string>[] {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map(cleanKey);
  return lines.slice(1).map(line => {
    const cols = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => row[h] = cleanValue(cols[i] || ''));
    return row;
  });
}

export async function initializeMasterDB(dataDir: string): Promise<MasterDB> {
  const readJSON = (name: string) => JSON.parse(fs.readFileSync(path.join(dataDir, `${name}.json`), 'utf8'));
  const readCSV = (name: string) => loadCSV(path.join(dataDir, `${name}.csv`));

  // Здесь мы собираем базу из твоих файлов. В реальном проекте это делается через import.meta.glob или fetch
  // Для TypeScript/Vite структуры данные уже должны быть в `master-db.ts`, 
  // но этот загрузчик нужен для динамического обновления или серверной обработки.
  const db: MasterDB = {
    effects: [], substances: [], interactions: [], goals: [], stackTemplates: [], stacks: [],
    analyses: [], organs: [], systems: [], mechanisms: [], axes: [], risks: [],
    recommendations: [], tags: [], brands: [], aliases: {}, substanceGroups: {}, effectGroups: {},
    synergyMatrix: {}, conflictMatrix: {}
  };

  try {
    const subRows = readCSV('substances');
    db.substances = subRows.map(r => ({
      id: r.id || '', name: r.name || '', category: r.category || '', route: (r.route || '').split(';'),
      effects: [], tHalfHours: parseFloat(r.t_half_hours) || 0, bioavailability: {},
      mechanisms: (r.mechanisms || '').split(';'), risks: (r.risks || '').split(';')
    }));
  } catch {}

  try {
    const mechRows = readCSV('mechanisms_map');
    db.mechanisms = mechRows.map(r => ({
      id: r.effect_id || r.id || '', name: r.name || '', level: 1, category: r.class || '',
      description: r.description || '', organs: (r.organs_up || '').split(';'), systems: [],
      biomarkers: [], effectsPositive: (r.effects_up || '').split(';'), effectsNegative: (r.effects_down || '').split(';'), riskWeight: 1
    }));
  } catch {}

  try {
    const intRows = readCSV('interpretations');
    db.interactions = intRows.map(r => ({
      substanceA: r.substance_a || '', substanceB: r.substance_b || '',
      type: (r.type as any) || 'caution', severity: r.severity === 'HIGH' ? 3 : r.severity === 'MEDIUM' ? 2 : 1,
      mechanisms: (r.mechanisms || '').split(';'), description: r.notes || ''
    }));
  } catch {}

  console.log('✅ MasterDB initialized with dynamic loader');
  return db;
}