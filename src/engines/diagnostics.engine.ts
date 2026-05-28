import { DiagnosticEntry } from '../core/types';
import { DIAGNOSTIC_TEMPLATES } from '../core/constants';

export function validateDiagnostics(entries: DiagnosticEntry[]): DiagnosticEntry[] {
  return entries.map(entry => {
    const tpl = DIAGNOSTIC_TEMPLATES[entry.type];
    if (!tpl) return entry;

    let findings = entry.findings || '';
    const flags: string[] = [];

    for (const [metric, range] of Object.entries(tpl.refRanges)) {
      const val = entry.keyMetrics[metric];
      if (val !== undefined && (val < range[0] || val > range[1])) {
        flags.push(`${metric}: ${val} (норма ${range[0]}–${range[1]})`);
      }
    }

    if (flags.length > 0) findings += `\n🚩 Отклонения: ${flags.join(', ')}`;
    return { ...entry, findings: findings.trim() };
  });
}

export function getDiagnosticSummary(entries: DiagnosticEntry[]): Record<string, { count: number; latestDate: string; flags: number }> {
  const summary: Record<string, { count: number; latestDate: string; flags: number }> = {};
  
  entries.forEach(e => {
    if (!summary[e.type]) summary[e.type] = { count: 0, latestDate: '', flags: 0 };
    summary[e.type].count++;
    
    if (!summary[e.type].latestDate || new Date(e.date) > new Date(summary[e.type].latestDate)) {
      summary[e.type].latestDate = e.date;
    }
    
    if (e.findings?.includes('🚩')) summary[e.type].flags++;
  });

  return summary;
}