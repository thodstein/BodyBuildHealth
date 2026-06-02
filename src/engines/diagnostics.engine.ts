import { DiagnosticEntry } from '../core/types';
import { DIAGNOSTIC_TEMPLATES } from '../core/constants';

export function validateDiagnostics(entries: DiagnosticEntry[]): DiagnosticEntry[] {
  return entries.map(entry => {
    const tpl = DIAGNOSTIC_TEMPLATES[entry.type ?? ''];
    if (!tpl) return entry;

    let findings = entry.findings ?? '';
    const flags: string[] = [];

    if (entry.keyMetrics) {
      for (const metric in tpl.refRanges) {
        const range = tpl.refRanges[metric];
        if (!range) continue;
        const val = entry.keyMetrics[metric];
        if (val !== undefined && (val < range[0] || val > range[1])) {
          flags.push(`${metric}: ${val} (норма ${range[0]}–${range[1]})`);
        }
      }
    }

    if (flags.length > 0) findings += `\n🔎 Аномалии: ${flags.join(', ')}`;
    return { ...entry, findings: findings.trim() };
  });
}

export function getDiagnosticSummary(entries: DiagnosticEntry[]): Record<string, { count: number; latestDate: string; flags: number }> {
  const summary: Record<string, { count: number; latestDate: string; flags: number }> = {};
  
  entries.forEach(e => {
    const type = e.type;
    if (!type) return; // skip entries without type
    if (!summary[type]) {
      summary[type] = { count: 0, latestDate: '', flags: 0 };
    }
    summary[type].count++;
    
    const dateStr = e.date ?? '';
    if (dateStr) {
      const currentDate = new Date(dateStr);
      const storedDate = summary[type].latestDate ? new Date(summary[type].latestDate) : null;
      if (!storedDate || currentDate > storedDate) {
        summary[type].latestDate = dateStr;
      }
    }
    
    if (e.findings?.includes('🔎 Аномалии')) {
      summary[type].flags++;
    }
  });

  return summary;
}
