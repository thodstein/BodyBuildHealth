import type { LabPoint } from '../core/types';
import { UCUM_MAP } from '../core/constants';

export interface LabTrendPoint {
  date: string;
  value: number;
  unit: string;
}

export interface LabTrend {
  code: string;
  name: string;
  points: LabTrendPoint[];
  previousValue: number | null;
  currentValue: number;
  unit: string;
  absoluteChange: number | null;
  percentChange: number | null;
  direction: 'up' | 'down' | 'stable' | 'unknown';
  significance: 'normal' | 'watch' | 'significant' | 'critical';
  previousDate: string | null;
  currentDate: string;
  refLow?: number;
  refHigh?: number;
  currentAbnormal?: boolean;
  previousAbnormal?: boolean;
  predictedValue?: number;
  predictionConfidence?: number;
}

export interface LabTrendReport {
  trends: LabTrend[];
  improved: LabTrend[];
  worsened: LabTrend[];
  newMarkers: LabTrend[];
  summary: string;
}

export function computeLabTrends(labs: LabPoint[]): LabTrendReport {
  const byCode = new Map<string, LabPoint[]>();
  for (const lab of labs) {
    const code = lab.code.toUpperCase();
    if (!byCode.has(code)) byCode.set(code, []);
    byCode.get(code)!.push(lab);
  }

  const trends: LabTrend[] = [];
  const improved: LabTrend[] = [];
  const worsened: LabTrend[] = [];
  const newMarkers: LabTrend[] = [];

  for (const [code, points] of byCode) {
    const sorted = points
      .filter(p => p.value != null && Number.isFinite(p.value))
      .sort((a, b) => a.date.localeCompare(b.date));

    if (sorted.length === 0) continue;

    const current = sorted[sorted.length - 1];
    const previous = sorted.length >= 2 ? sorted[sorted.length - 2] : null;

    const info = UCUM_MAP[code];
    const refLow = (current as any).refLow ?? info?.lln;
    const refHigh = (current as any).refHigh ?? info?.uln;

    const currentAbnormal = refHigh !== undefined
      ? current.value > refHigh || (refLow !== undefined && current.value < refLow)
      : undefined;

    const previousAbnormal = previous && refHigh !== undefined
      ? previous.value > refHigh || (refLow !== undefined && previous.value < refLow)
      : undefined;

    const absoluteChange = previous != null ? current.value - previous.value : null;
    const percentChange = previous != null && previous.value !== 0
      ? ((current.value - previous.value) / Math.abs(previous.value)) * 100
      : null;

    let direction: LabTrend['direction'] = 'unknown';
    if (previous != null) {
      if (Math.abs(absoluteChange!) < 0.01) direction = 'stable';
      else if (absoluteChange! > 0) direction = 'up';
      else direction = 'down';
    }

    let significance: LabTrend['significance'] = 'normal';
    if (previous != null && refHigh !== undefined) {
      const changePct = percentChange != null ? Math.abs(percentChange) : 0;
      if (currentAbnormal && !previousAbnormal) {
        significance = changePct > 30 ? 'critical' : 'significant';
      } else if (!currentAbnormal && previousAbnormal) {
        significance = changePct > 30 ? 'significant' : 'watch';
      } else if (currentAbnormal && previousAbnormal) {
        significance = changePct > 20 ? 'significant' : 'watch';
      } else {
        significance = changePct > 50 ? 'watch' : 'normal';
      }
    }

    const trend: LabTrend = {
      code,
      name: current.name || info?.name || code,
      points: sorted.map(p => ({ date: p.date, value: p.value, unit: p.unit || info?.prefUnit || '' })),
      previousValue: previous?.value ?? null,
      currentValue: current.value,
      unit: current.unit || info?.prefUnit || '',
      absoluteChange,
      percentChange,
      direction,
      significance,
      previousDate: previous?.date ?? null,
      currentDate: current.date,
      refLow,
      refHigh,
      currentAbnormal,
      previousAbnormal,
      ...(sorted.length >= 3 ? predictNextValue(sorted.map(p => ({ date: p.date, value: p.value }))) : {}),
    };

    trends.push(trend);

    if (previous == null) {
      newMarkers.push(trend);
    } else if (significance === 'significant' || significance === 'critical') {
      if (direction === 'down' && !['GLU', 'TG'].includes(code)) {
        improved.push(trend);
      } else if (direction === 'up' && !['LDL', 'TG', 'GLU', 'CRP', 'HCT'].includes(code)) {
        worsened.push(trend);
      } else if (significance === 'critical') {
        if (currentAbnormal) worsened.push(trend);
        else improved.push(trend);
      }
    }
  }

  const significantCount = trends.filter(t => t.significance === 'significant' || t.significance === 'critical').length;
  const summary = buildSummary(trends.length, significantCount, improved.length, worsened.length, newMarkers.length);

  return { trends, improved, worsened, newMarkers, summary };
}

function buildSummary(total: number, significant: number, improved: number, worsened: number, newMarkers: number): string {
  const parts: string[] = [];
  parts.push(`${total} маркеров`);
  if (significant > 0) parts.push(`${significant} с изменением`);
  if (worsened > 0) parts.push(`↓ ${worsened}`);
  if (improved > 0) parts.push(`↑ ${improved}`);
  if (newMarkers > 0) parts.push(`+${newMarkers} новых`);
  return parts.join(' · ');
}

export function getTrendColor(significance: LabTrend['significance']): string {
  switch (significance) {
    case 'critical': return '#ef4444';
    case 'significant': return '#f97316';
    case 'watch': return '#eab308';
    default: return 'var(--text-dim)';
  }
}

export function getTrendIcon(direction: LabTrend['direction'], significance: LabTrend['significance']): string {
  if (significance === 'normal') return '→';
  switch (direction) {
    case 'up': return significance === 'critical' ? '↑↑' : '↑';
    case 'down': return significance === 'critical' ? '↓↓' : '↓';
    case 'stable': return '→';
    default: return '?';
  }
}

export function getTrendInsights(trends: LabTrend[]): string[] {
  const insights: string[] = [];
  const worsenedSignificant = trends.filter(t => t.significance === 'significant' || t.significance === 'critical');
  const improvedSignificant = trends.filter(t => t.significance === 'significant' || t.significance === 'critical');
  const newAbnormal = trends.filter(t => t.currentAbnormal && !t.previousAbnormal);

  if (worsenedSignificant.length > 0) {
    const names = worsenedSignificant.slice(0, 3).map(t => t.name).join(', ');
    insights.push(`⚠️ Ухудшение: ${names} — требуются корректировки.`);
  }
  if (improvedSignificant.length > 0) {
    const names = improvedSignificant.slice(0, 3).map(t => t.name).join(', ');
    insights.push(`✅ Улучшение: ${names} — текущая стратегия работает.`);
  }
  if (newAbnormal.length > 0) {
    const names = newAbnormal.slice(0, 3).map(t => t.name).join(', ');
    insights.push(`🚨 Новые отклонения: ${names} — обратитесь к врачу.`);
  }
  if (insights.length === 0 && trends.length > 0) {
    insights.push('📊 Стабильное состояние — без значимых изменений.');
  }
  return insights;
}

function predictNextValue(points: { date: string; value: number }[]): { predictedValue: number; predictionConfidence: number } | {} {
  if (points.length < 3) return {};
  const n = points.length;
  const xMean = (n - 1) / 2;
  const yMean = points.reduce((s, p) => s + p.value, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = i - xMean;
    num += dx * (points[i].value - yMean);
    den += dx * dx;
  }
  if (den === 0) return {};
  const slope = num / den;
  const intercept = yMean - slope * xMean;
  const nextX = n;
  const predicted = slope * nextX + intercept;
  const residuals = points.map((p, i) => p.value - (slope * i + intercept));
  const ssRes = residuals.reduce((s, r) => s + r * r, 0);
  const ssTot = points.reduce((s, p) => s + (p.value - yMean) ** 2, 0);
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
  const confidence = Math.max(0, Math.min(1, r2));
  return {
    predictedValue: Number(predicted.toFixed(2)),
    predictionConfidence: Number(confidence.toFixed(2)),
  };
}

export function exportTrendsToCSV(report: LabTrendReport): string {
  const header = 'Code,Name,Previous Date,Previous Value,Current Date,Current Value,Unit,Absolute Change,Percent Change,Direction,Significance,Ref Low,Ref High,Current Abnormal,Previous Abnormal\n';
  const rows = report.trends.map(t => {
    const escape = (v: any) => {
      if (v === undefined || v === null) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [
      escape(t.code),
      escape(t.name),
      escape(t.previousDate),
      escape(t.previousValue),
      escape(t.currentDate),
      escape(t.currentValue),
      escape(t.unit),
      escape(t.absoluteChange),
      escape(t.percentChange),
      escape(t.direction),
      escape(t.significance),
      escape(t.refLow),
      escape(t.refHigh),
      escape(t.currentAbnormal),
      escape(t.previousAbnormal),
    ].join(',');
  }).join('\n');
  return header + rows;
}

export function downloadCSV(csv: string, filename: string) {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
