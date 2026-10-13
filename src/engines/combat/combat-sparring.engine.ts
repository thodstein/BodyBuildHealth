/**
 * combat-sparring.engine.ts — декомпозиция внезальной нагрузки для единоборств.
 * Различает hard spar / technical / wrestling vs общий OutsideLoad.
 * Конвертирует в OutsideLoad.highIntensityDays + weeklyLoad для совместимости.
 * Источники: Boxing Science, Phil Daru, ISSN 2025 — hard spar = ЦНС-удар (RPE 9, 6мин раунд).
 */
import type { OutsideLoad } from '../outside-load.engine';
import { normalizeOutsideLoad } from '../outside-load.engine';

export interface SparringLoad {
  hardSparSessions: number; // 0-4, RPE 8-9, 3×3мин или 5×5мин
  techSparSessions: number; // 0-4, RPE 5-6, техника/лапы
  wrestlingSessions: number; // 0-4, RPE 7-8, борьба/клинч
  conditioningSessions?: number; // опционально, RPE 6, бег
  hardDays?: number[]; // 0=Пн ... 6=Вс, если не заданы — авто [1,3,5] для hard
  /** P1-18: фактическая средняя длительность сессии (из журнала: rounds×roundMinutes);
   *  если не задана — дефолты 90/60/75/40 по типам. */
  avgDurationMin?: number;
}

const DEFAULT_DURATION: Record<'hard' | 'tech' | 'wrest' | 'cond', number> = { hard: 90, tech: 60, wrest: 75, cond: 40 };

/** Кламп 0..4 — единый для обеих функций (иначе weeklyLoad и sessionsPerWeek
 *  расходились на out-of-range входе: 7 hard → нагрузка от 4, сессий 7). */
function clamp4(v: number | undefined): number { return Math.max(0, Math.min(4, Math.round(Number(v) || 0))); }

export function sparringWeeklyLoad(s: SparringLoad): number {
  // scale: hard 90×8.5=765 vs outside generic 90×7=630 — намеренно выше: hard spar RPE 8-9 (ЦНС-удар, 6мин раунд) vs тех 5.5; дельта 0.10 в volumeMultiplier обоснована Boxing Science
  const hard = clamp4(s.hardSparSessions) * 90 * 8.5;
  const tech = clamp4(s.techSparSessions) * 60 * 5.5;
  const wrest = clamp4(s.wrestlingSessions) * 75 * 7.5;
  const cond = clamp4(s.conditioningSessions) * 40 * 6;
  const base = hard + tech + wrest + cond;
  // P1-18: журнальная средняя длительность масштабирует нагрузку (факт вместо фабрики)
  if (typeof s.avgDurationMin === 'number' && Number.isFinite(s.avgDurationMin) && s.avgDurationMin > 0) {
    const counts = {
      hard: clamp4(s.hardSparSessions),
      tech: clamp4(s.techSparSessions),
      wrest: clamp4(s.wrestlingSessions),
      cond: clamp4(s.conditioningSessions),
    };
    const totalSessions = counts.hard + counts.tech + counts.wrest + counts.cond;
    if (totalSessions > 0) {
      const defaultAvg = (counts.hard * DEFAULT_DURATION.hard + counts.tech * DEFAULT_DURATION.tech + counts.wrest * DEFAULT_DURATION.wrest + counts.cond * DEFAULT_DURATION.cond) / totalSessions;
      const scale = defaultAvg > 0 ? s.avgDurationMin / defaultAvg : 1;
      return Math.round(base * scale);
    }
  }
  return Math.round(base);
}

export function sparringToOutsideLoad(s: SparringLoad | null | undefined, discipline?: string): OutsideLoad | null {
  if (!s) return null;
  // PRO-3: те же клампы, что у sparringWeeklyLoad — раньше totalSessions/avgRPE
  // считались по СЫРЫМ значениям, и вход 7 hard давал load от 4 сессий, но
  // sessionsPerWeek=7 и средний RPE от семи «восьми с половиной».
  const hard = clamp4(s.hardSparSessions);
  const tech = clamp4(s.techSparSessions);
  const wrest = clamp4(s.wrestlingSessions);
  const cond = clamp4(s.conditioningSessions);
  const totalSessions = hard + tech + wrest + cond;
  if (totalSessions === 0) return null;
  const wl = sparringWeeklyLoad(s);
  // P1-18: длительность из журнала, иначе — взвешенные дефолты
  const avgDuration = (typeof s.avgDurationMin === 'number' && Number.isFinite(s.avgDurationMin) && s.avgDurationMin > 0)
    ? Math.round(s.avgDurationMin)
    : Math.round((hard * 90 + tech * 60 + wrest * 75 + cond * 40) / totalSessions);
  const avgRPE = totalSessions > 0 ? ((hard * 8.5 + tech * 5.5 + wrest * 7.5 + cond * 6) / totalSessions) : 6;
  // high дни — hard spar дни + wrestling (если >=2)
  let highDays: number[] = [];
  if (Array.isArray(s.hardDays) && s.hardDays.length) highDays = [...s.hardDays];
  else {
    if (hard >= 2) highDays = [1, 4];
    else if (hard === 1) highDays = [2];
    if (wrest >= 2) highDays = [...new Set([...highDays, 0, 3])].sort((a,b)=>a-b);
  }
  highDays = [...new Set(highDays.map(n=> Math.max(0, Math.min(6, Math.round(Number(n))))))].sort((a,b)=>a-b);
  const interference: OutsideLoad['interference'] = wl >= 1500 || hard >= 2 ? 'high' : wl >= 800 ? 'medium' : 'low';
  const type: OutsideLoad['type'] = (() => {
    const d = (discipline||'').toLowerCase();
    if (d.includes('box') || d.includes('kick')) return 'ring';
    if (d.includes('mma') || d.includes('wrest') || d.includes('борь')) return 'mat';
    // эвристика по составу: ударный спарринг без борьбы → ring
    if (hard > 0 && wrest === 0) return 'ring';
    return 'mat';
  })();
  return {
    sessionsPerWeek: totalSessions,
    avgDurationMin: avgDuration,
    avgSRPE: Math.round(avgRPE * 10) / 10,
    type,
    highIntensityDays: highDays,
    interference,
    note: `sparring hard${hard}/tech${tech}/wrest${wrest}`,
  };
}

export function sparringSummary(s: SparringLoad | null | undefined): string {
  if (!s) return 'Спарринг: не задан';
  const wl = sparringWeeklyLoad(s);
  return `Спарринг ${wl} load: hard ${clamp4(s.hardSparSessions)}× (RPE 8.5) / tech ${clamp4(s.techSparSessions)}× / борьба ${clamp4(s.wrestlingSessions)}× → вне зала ${clamp4(s.hardSparSessions)+clamp4(s.techSparSessions)+clamp4(s.wrestlingSessions)}×`;
}

export function validateSparringLoad(s: SparringLoad): string[] {
  const errs: string[] = [];
  const total = clamp4(s.hardSparSessions)+clamp4(s.techSparSessions)+clamp4(s.wrestlingSessions)+clamp4(s.conditioningSessions);
  if (total > 7) errs.push(`Суммарно ${total} спарринг-сессий >7 — перегруз`);
  if (clamp4(s.hardSparSessions) > 3) errs.push('Hard spar >3×/нед — риск ЦНС, снизьте до 2×');
  if (clamp4(s.hardSparSessions) >= 2 && clamp4(s.wrestlingSessions) >= 3) errs.push('Hard spar 2× + борьба 3× — высокая нагрузка, нужен делод 2× зал');
  return errs;
}

export function normalizeSparringLoad(input: SparringLoad | null | undefined): SparringLoad | null {
  if (!input) return null;
  const hs = Math.max(0, Math.min(4, Math.round(Number(input.hardSparSessions) || 0)));
  const ts = Math.max(0, Math.min(4, Math.round(Number(input.techSparSessions) || 0)));
  const ws = Math.max(0, Math.min(4, Math.round(Number(input.wrestlingSessions) || 0)));
  const cs = Math.max(0, Math.min(4, Math.round(Number(input.conditioningSessions) || 0)));
  if (hs+ts+ws+cs === 0) return null;
  const avg = Number(input.avgDurationMin);
  return { hardSparSessions: hs, techSparSessions: ts, wrestlingSessions: ws, conditioningSessions: cs, hardDays: Array.isArray(input.hardDays) ? input.hardDays : undefined, ...(Number.isFinite(avg) && avg > 0 ? { avgDurationMin: avg } : {}) };
}
