const STORAGE_KEY = 'he_bp_diary';

export interface BPEntry {
  date: string;
  systolic: number;
  diastolic: number;
  hr: number;
  notes?: string;
}

export function getBpEntries(): BPEntry[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

export function saveBpEntry(entry: BPEntry) {
  const entries = getBpEntries();
  entries.push(entry);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); } catch {}
}

export function getLatestBp(): { systolic: number; diastolic: number; hr: number } | null {
  const entries = getBpEntries();
  if (entries.length === 0) return null;
  const sorted = entries.sort((a, b) => b.date.localeCompare(a.date));
  const latest = sorted[0];
  return { systolic: latest.systolic, diastolic: latest.diastolic, hr: latest.hr };
}

export function getAvgBp(days: number = 7): { systolic: number; diastolic: number; hr: number } | null {
  const entries = getBpEntries();
  if (entries.length === 0) return null;
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
  const recent = entries.filter(e => e.date >= cutoff);
  if (recent.length === 0) return null;
  return {
    systolic: Math.round(recent.reduce((s, e) => s + e.systolic, 0) / recent.length),
    diastolic: Math.round(recent.reduce((s, e) => s + e.diastolic, 0) / recent.length),
    hr: Math.round(recent.reduce((s, e) => s + e.hr, 0) / recent.length),
  };
}

export function getBpRiskLevel(): 'low' | 'medium' | 'high' {
  const avg = getAvgBp(7);
  if (!avg) return 'low';
  if (avg.systolic > 140 || avg.diastolic > 90) return 'high';
  if (avg.systolic > 130 || avg.diastolic > 80) return 'medium';
  return 'low';
}
