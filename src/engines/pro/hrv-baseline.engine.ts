/**
 * hrv-baseline.engine.ts — P2: персональная HRV-база по науке (Plews 2013; Buchheit 2014; Sensors 2026).
 * Абсолютные пороги RMSSD запрещены: 20–100 мс — всё норма, сравнение только с собственной базой.
 * Метрика — lnRMSSD (лог нормализует скошенное распределение), SWC = 0.5×SD, интерпретация + CV.
 * Хранилище — тот же `he_hrv_log`, что у strength-sport/combat (REUSE, толерантный парсинг обоих форматов).
 */

export interface HrvReading { date: string; rmssd: number; }
export interface HrvBaseline {
  n: number; meanRmssd: number; meanLn: number; sdLn: number; cvPct: number; swc: number;
  from: string; to: string;
}
export type HrvStatus = 'need_base' | 'normal' | 'reduced' | 'low' | 'elevated';

const KEY = 'he_hrv_log';
const CAP = 90;

export const HRV_PROTOCOL_NOTE = 'Замер утром после пробуждения, сидя, 1 мин стабилизация + 1 мин запись (Plews/Buchheit). ≥3 замеров для базы, ≥5 дн/нед для точности.';

function todayIso(): string {
  try { return new Date().toISOString().slice(0, 10); } catch { return ''; }
}

/** Толерантное чтение: {date,hrvMs} (SS/combat) | {date,rmssd} | {date,hrv} | plain number[] (legacy-тесты). */
export function loadHrvReadings(): HrvReading[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    const out: HrvReading[] = [];
    arr.forEach((it: unknown, i: number) => {
      if (typeof it === 'number') {
        if (Number.isFinite(it) && it > 0) out.push({ date: `legacy-${i}`, rmssd: it });
        return;
      }
      if (it && typeof it === 'object') {
        const o = it as Record<string, unknown>;
        const v = (o.hrvMs ?? o.rmssd ?? o.hrv) as unknown;
        if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
          out.push({ date: typeof o.date === 'string' ? o.date : `legacy-${i}`, rmssd: v });
        }
      }
    });
    return out;
  } catch { return []; }
}

export function appendHrvReading(rmssd: number, date = todayIso()): HrvReading[] {
  const v = Math.round(rmssd * 10) / 10;
  if (!Number.isFinite(v) || v <= 0 || v > 300) return loadHrvReadings();
  const arr = loadHrvReadings().filter(r => r.date !== date);
  arr.push({ date, rmssd: v });
  arr.sort((a, b) => (a.date < b.date ? -1 : 1));
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(KEY, JSON.stringify(arr.slice(-CAP).map(r => ({ date: r.date, hrvMs: r.rmssd }))));
    }
  } catch { /* ignore */ }
  return arr.slice(-CAP);
}

/** База по последним `window` замерам (минимум 3). Возвращает null без базы — красную зону не ставим. */
export function buildHrvBaseline(readings?: HrvReading[], window = 14): HrvBaseline | null {
  const all = (readings ?? loadHrvReadings()).filter(r => r.rmssd > 0);
  const vals = all.slice(-Math.max(3, window));
  if (vals.length < 3) return null;
  const lns = vals.map(r => Math.log(r.rmssd));
  const meanLn = lns.reduce((s, v) => s + v, 0) / lns.length;
  const sdLn = Math.sqrt(lns.reduce((s, v) => s + (v - meanLn) ** 2, 0) / lns.length);
  const meanRmssd = vals.reduce((s, r) => s + r.rmssd, 0) / vals.length;
  const sdRaw = Math.sqrt(vals.reduce((s, r) => s + (r.rmssd - meanRmssd) ** 2, 0) / vals.length);
  // Пол SWC: при сверхплотной базе 0.5×SD вырождается и любой чих — «красная зона». 0.03 ln ≈ 3% — минимальное
  // физиологически значимое изменение (Plews: типичный SWC lnRMSSD 0.05–0.10).
  const swc = Math.max(sdLn * 0.5, 0.03);
  return {
    n: vals.length,
    meanRmssd: Math.round(meanRmssd * 10) / 10,
    meanLn: Math.round(meanLn * 1000) / 1000,
    sdLn: Math.round(sdLn * 1000) / 1000,
    cvPct: meanRmssd > 0 ? Math.round((sdRaw / meanRmssd) * 1000) / 10 : 0,
    swc: Math.round(swc * 1000) / 1000,
    from: vals[0].date,
    to: vals[vals.length - 1].date,
  };
}

export interface HrvReadiness { status: HrvStatus; deltaSwc: number; note: string; }

/** Готовность по отклонению сегодняшнего lnRMSSD от базы в единицах SWC. */
export function hrvReadiness(rmssdToday: number, baseline: HrvBaseline | null): HrvReadiness {
  if (!baseline || baseline.n < 3 || !(rmssdToday > 0)) {
    return { status: 'need_base', deltaSwc: 0, note: 'Недостаточно базы (нужно ≥3 утренних замеров) — оценка по популяционной норме запрещена.' };
  }
  const swc = baseline.swc > 0 ? baseline.swc : 0.05;
  const d = (Math.log(rmssdToday) - baseline.meanLn) / swc;
  const deltaSwc = Math.round(d * 10) / 10;
  if (d <= -2) return { status: 'low', deltaSwc, note: `lnRMSSD −${Math.abs(deltaSwc)} SWC от базы — красная зона, только восстановление.` };
  if (d <= -1) return { status: 'reduced', deltaSwc, note: `lnRMSSD −${Math.abs(deltaSwc)} SWC — снижение, лёгкая сессия.` };
  if (d >= 2) return { status: 'elevated', deltaSwc, note: `lnRMSSD +${deltaSwc} SWC — парасимпатический всплеск (возможна суперкомпенсация или недовосстановление после объёма).` };
  return { status: 'normal', deltaSwc, note: 'Внутри SWC-коридора базы — норма.' };
}

/** ratio для авторегуляции: против собственной базы; без базы — честный фолбэк с пометкой. */
export function hrvRatioToBaseline(rmssdToday: number, baseline: HrvBaseline | null): { ratio: number; hasBase: boolean } {
  if (baseline && baseline.meanRmssd > 0) {
    return { ratio: Math.round((rmssdToday / baseline.meanRmssd) * 100) / 100, hasBase: true };
  }
  return { ratio: Math.round((rmssdToday / 60) * 100) / 100, hasBase: false };
}
