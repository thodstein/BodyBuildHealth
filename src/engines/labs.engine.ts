import { LabPoint, LabForecast } from '../core/types';
import { UCUM_MAP } from '../core/constants';

/**
 * Нормализует значение анализа в стандартные единицы UCUM.
 * Возвращает нормализованное значение, единицу измерения и референсные границы (если известны).
 */
export function normalizeLab(
  code: string,
  value: number,
  unit: string
): { norm: number; unit: string; ref?: { uln: number; lln: number } } {
  const m = UCUM_MAP[code.toUpperCase()];
  if (!m) return { norm: value, unit };
  return {
    norm: parseFloat((value * m.coeff).toFixed(2)),
    unit: m.prefUnit,
    ref: { uln: m.uln, lln: m.lln }
  };
}

/**
 * Проверяет, выходит ли значение за референсные границы с учётом текущей фазы курса.
 * На курсе ULN повышается на 25%, на ПКТ LLN снижается на 20% (физиологическая адаптация).
 */
export function isAbnormal(code: string, value: number, phase: string = 'baseline'): boolean {
  const m = UCUM_MAP[code.toUpperCase()];
  if (!m) return false;
  
  const isCourse = phase === 'on_cycle' || phase === 'course_bridge_course';
  const isPCT = phase === 'pct' || phase === 'post_pct';
  
  const adjULN = isCourse ? m.uln * 1.25 : m.uln;
  const adjLLN = isPCT ? m.lln * 0.8 : m.lln;
  
  return value > adjULN || value < adjLLN;
}

/**
 * Строит линейный прогноз тренда маркера на 4, 8 и 12 недель вперёд.
 * Возвращает текущее значение, прогнозы и предупреждения при выходе за критические пороги.
 * Использует метод наименьших квадратов. Требует минимум 2 исторических записей.
 */
export function predictLab(points: LabPoint[], code: string): LabForecast | null {
  const sorted = points
    .filter(p => p.code.toUpperCase() === code.toUpperCase())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (sorted.length < 2) return null;

  const vals = sorted.map(p => normalizeLab(p.code, p.value, p.unit).norm);
  const n = vals.length;
  const x = Array.from({ length: n }, (_, i) => i);
  
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = vals.reduce((a, b) => a + b, 0) / n;
  
  const sxy = x.reduce((a, v, i) => a + (v - mx) * (vals[i] - my), 0);
  const sxx = x.reduce((a, v) => a + Math.pow(v - mx, 2), 0);
  
  const slope = sxx !== 0 ? sxy / sxx : 0;
  const intercept = my - slope * mx;
  const base = vals[n - 1];
  const ref = UCUM_MAP[code.toUpperCase()]?.uln || 100;
  
  const calc = (weeks: number) => parseFloat((slope * (n + weeks) + intercept).toFixed(1));
  
  const w4 = calc(4);
  const w8 = calc(8);
  const w12 = calc(12);
  
  let alert: string | undefined = undefined;
  if (w4 > ref * 1.1 || w12 > ref * 1.25) {
    alert = `⚠️ Прогноз превышения ULN (${ref}) через 4–12 нед.`;
  }
  if (code.toUpperCase() === 'HCT' && w12 > 54) {
    alert = `🔴 Гематокрит критический (>54%). Требуется мониторинг или донация.`;
  }
  if (code.toUpperCase() === 'HDL' && w12 < 0.8) {
    alert = `⚠️ Прогноз падения ЛПВП ниже LLN. Рассмотрите коррекцию жиров.`;
  }
  if (code.toUpperCase() === 'ALT' && w12 > 80) {
    alert = `🔴 АЛТ превышает норму >2x. Оцените гепатотоксичность курса.`;
  }

  return { current: base, w4, w8, w12, alert };
}