import type { LabPoint } from '../core/types';
import { ucumInfo } from '../core/constants';
import { ruCount, ruAdjCount, RU_MARKERS } from './ru-plural';
import { boundsComparable, boundProvesSide, type LabBound } from '../core/lab-bound';
import { labValueLabel } from '../core/lab-value-label';

export interface LabTrendPoint {
  date: string;
  value: number;
  unit: string;
  /** Проход 145: «>1000» в точке графика — знак, а не потеря. */
  bound?: LabBound;
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
  /** Проход 145: знак границы текущей и прошлой записи. */
  currentBound?: LabBound;
  previousBound?: LabBound;
  refLow?: number;
  refHigh?: number;
  /**
   * Проход 145: `true` — отклонение доказано, `false` — норма доказана,
   * `undefined` — не доказано ни то, ни другое (обрезанное число, нет нормы).
   */
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

/**
 * Вердикт «вне нормы» по одной записи — трёхзначный.
 *
 * Нет верхней границы — судить не о чем (`undefined`). Есть граница бланка —
 * `true` только если сторона доказана (`boundProvesSide`), иначе `undefined`:
 * «>5» при верхней границе 300 не говорит, в норме значение или нет. Раньше
 * здесь стоял просто boolean, и обрезанное число попадало в «норму».
 */
function trendAbnormal(
  value: number,
  bound: LabBound | undefined,
  refLow: number | undefined,
  refHigh: number | undefined,
): boolean | undefined {
  if (refHigh === undefined) return undefined;
  if (bound) return boundProvesSide(bound, value, refLow, refHigh) ? true : undefined;
  return value > refHigh || (refLow !== undefined && value < refLow);
}

export function computeLabTrends(labs: LabPoint[]): LabTrendReport {
  const byCode = new Map<string, LabPoint[]>();
  for (const lab of labs) {
    if (!lab.date || typeof lab.date !== 'string') continue;
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

    // Проход 174: запись каталога — одним правилом (`ucumInfo`); прежний
    // кейс-инсенс перебор ключей был второй копией этого правила.
    const info = ucumInfo(code);
    const refLow = (current as any).refLow ?? info?.lln;
    const refHigh = (current as any).refHigh ?? info?.uln;

    // Проход 145: вердикт «вне нормы» — трёхзначный, как в дневнике. Обрезанное
    // число доказывает только свою сторону (`boundProvesSide`), а «>5» при
    // верхней границе 300 не доказывает ничего.
    const currentAbnormal = trendAbnormal(current.value, current.bound, refLow, refHigh);
    const previousAbnormal = previous
      ? trendAbnormal(previous.value, previous.bound, refLow, refHigh)
      : undefined;

    // Разность и процент двух точных чисел; при любой границе их нет.
    const comparable = previous != null && boundsComparable(current.bound, previous.bound);
    const absoluteChange = comparable ? current.value - previous!.value : null;
    const percentChange = comparable && previous!.value !== 0
      ? ((current.value - previous!.value) / Math.abs(previous!.value)) * 100
      : null;

    let direction: LabTrend['direction'] = 'unknown';
    if (comparable) {
      if (Math.abs(absoluteChange!) < 0.01) direction = 'stable';
      else if (absoluteChange! > 0) direction = 'up';
      else direction = 'down';
    }

    // Значимость — только по доказанным переходам. Неизвестная сторона не
    // считается ни нормой, ни отклонением: молчим (`normal`), а не заявляем.
    let significance: LabTrend['significance'] = 'normal';
    if (previous != null && refHigh !== undefined) {
      const changePct = percentChange != null ? Math.abs(percentChange) : null;
      const over = (limit: number) => changePct != null && changePct > limit;
      if (currentAbnormal === true && previousAbnormal === false) {
        significance = over(30) ? 'critical' : 'significant';
      } else if (currentAbnormal === false && previousAbnormal === true) {
        significance = over(30) ? 'significant' : 'watch';
      } else if (currentAbnormal === true && previousAbnormal === true) {
        significance = over(20) ? 'significant' : 'watch';
      } else if (currentAbnormal === false && previousAbnormal === false) {
        significance = over(50) ? 'watch' : 'normal';
      }
    }

    const trend: LabTrend = {
      code,
      name: current.name || info?.name || code,
      points: sorted.map(p => ({ date: p.date, value: p.value, unit: p.unit || info?.prefUnit || '', bound: p.bound })),
      previousValue: previous?.value ?? null,
      currentValue: current.value,
      unit: current.unit || info?.prefUnit || '',
      absoluteChange,
      percentChange,
      direction,
      significance,
      previousDate: previous?.date ?? null,
      currentDate: current.date,
      currentBound: current.bound,
      previousBound: previous?.bound,
      refLow,
      refHigh,
      currentAbnormal,
      previousAbnormal,
      // Проход 145: прогноз по обрезанным точкам — догадка о догадке, поэтому
      // при любой границе в истории предсказание не строится.
      ...(sorted.length >= 3 && sorted.every(p => !p.bound) ? predictNextValue(sorted.map(p => ({ date: p.date, value: p.value }))) : {}),
    };

    trends.push(trend);

    if (previous == null) {
      newMarkers.push(trend);
    } else if (significance === 'significant' || significance === 'critical') {
      // P0 fix: код-лист был инвертирован — LDL/HCT/CRP вверх не считались ухудшением, GLU/TG вниз не считались улучшением
      // Теперь: для маркеров где ниже лучше (LDL/HCT/CRP/TG/GLU/HbA1c) — вверх ухудшение, вниз улучшение; для остальных — наоборот, но по умолчанию считаем движение к норме
      const lowerIsBetter = ['LDL', 'HCT', 'CRP', 'TG', 'GLU', 'HBA1C', 'HB', 'ALT', 'AST', 'GGT', 'ALP', 'BIL', 'CREATININE', 'UA', 'HOMOCYSTEINE'].includes(code);
      if (direction === 'down') {
        if (lowerIsBetter) improved.push(trend);
        else if (currentAbnormal === false && previousAbnormal === true) improved.push(trend);
        else if (significance === 'critical' && currentAbnormal === false) improved.push(trend);
      } else if (direction === 'up') {
        if (lowerIsBetter) worsened.push(trend);
        else if (currentAbnormal === true && previousAbnormal === false) worsened.push(trend);
        else if (significance === 'critical' && currentAbnormal === true) worsened.push(trend);
      } else if (significance === 'critical') {
        if (currentAbnormal === true) worsened.push(trend);
        else if (currentAbnormal === false) improved.push(trend);
      }
      // фолбэк: если значимый тренд не попал ни в одну ветку, считаем по направлению к норме
      if (!improved.includes(trend) && !worsened.includes(trend) && !newMarkers.includes(trend)) {
        if (direction === 'up' && currentAbnormal === true) worsened.push(trend);
        else if (direction === 'down' && currentAbnormal === false && previousAbnormal === true) improved.push(trend);
        else if (direction === 'up') worsened.push(trend);
        else if (direction === 'down') improved.push(trend);
      }
    }
  }

  const significantCount = trends.filter(t => t.significance === 'significant' || t.significance === 'critical').length;
  const summary = buildSummary(trends.length, significantCount, improved.length, worsened.length, newMarkers.length);

  return { trends, improved, worsened, newMarkers, summary };
}

function buildSummary(total: number, significant: number, improved: number, worsened: number, newMarkers: number): string {
  const parts: string[] = [];
  parts.push(ruCount(total, RU_MARKERS));
  if (significant > 0) parts.push(`${significant} с изменением`);
  if (worsened > 0) parts.push(`↓ ${worsened}`);
  if (improved > 0) parts.push(`↑ ${improved}`);
  if (newMarkers > 0) parts.push(`+${ruAdjCount(newMarkers, ['новый', 'новых', 'новых'], RU_MARKERS)}`);
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
  // P0 fix: раньше оба списка фильтровались одинаково (только significance) → один тренд попадал и в ухудшение и в улучшение
  const lowerIsBetter = new Set(['LDL','HCT','CRP','TG','GLU','HBA1C','ALT','AST','GGT','ALP','BIL','CREATININE','UA','HOMOCYSTEINE','PRL','E2','CORTISOL']);
  const isWorsened = (t: LabTrend) => {
    if (t.significance !== 'significant' && t.significance !== 'critical') return false;
    const lower = lowerIsBetter.has(t.code);
    if (t.direction === 'up') return lower ? t.currentAbnormal === true : t.currentAbnormal === false;
    if (t.direction === 'down') return lower ? t.currentAbnormal === false && t.previousAbnormal === true : t.currentAbnormal === true;
    return false;
  };
  const isImproved = (t: LabTrend) => {
    if (t.significance !== 'significant' && t.significance !== 'critical') return false;
    const lower = lowerIsBetter.has(t.code);
    if (t.direction === 'down') return lower ? t.currentAbnormal === false || t.previousAbnormal === false : t.currentAbnormal === true;
    if (t.direction === 'up') return lower ? false : t.currentAbnormal === false && t.previousAbnormal === true;
    return false;
  };
  const worsenedSignificant = trends.filter(isWorsened);
  const improvedSignificant = trends.filter(isImproved);
  const newAbnormal = trends.filter(t => t.currentAbnormal === true && t.previousAbnormal === false);

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
    // Проход 145: «стабильное состояние» — утверждение. Если в истории есть
    // обрезанные значения, значимость изменения не доказана, и говорить нечего.
    insights.push(trends.some(t => t.currentBound || t.previousBound)
      ? '📊 Обрезанные значения: значимость изменений не доказана.'
      : '📊 Стабильное состояние — без значимых изменений.');
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
      return s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [
      escape(t.code),
      escape(t.name),
      escape(t.previousDate),
      escape(t.previousValue == null ? '' : labValueLabel(t.previousValue, t.previousBound)),
      escape(t.currentDate),
      escape(labValueLabel(t.currentValue, t.currentBound)),
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
