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
}

export function sparringWeeklyLoad(s: SparringLoad): number {
  // scale: hard 90×8.5=765 vs outside generic 90×7=630 — намеренно выше: hard spar RPE 8-9 (ЦНС-удар, 6мин раунд) vs тех 5.5; дельта 0.10 в volumeMultiplier обоснована Boxing Science
  const hard = Math.max(0, Math.min(4, Math.round(s.hardSparSessions || 0))) * 90 * 8.5;
  const tech = Math.max(0, Math.min(4, Math.round(s.techSparSessions || 0))) * 60 * 5.5;
  const wrest = Math.max(0, Math.min(4, Math.round(s.wrestlingSessions || 0))) * 75 * 7.5;
  const cond = Math.max(0, Math.min(4, Math.round(s.conditioningSessions || 0))) * 40 * 6;
  return Math.round(hard + tech + wrest + cond);
}

export function sparringToOutsideLoad(s: SparringLoad | null | undefined, discipline?: string): OutsideLoad | null {
  if (!s) return null;
  const totalSessions = (s.hardSparSessions || 0) + (s.techSparSessions || 0) + (s.wrestlingSessions || 0) + (s.conditioningSessions || 0);
  if (totalSessions === 0) return null;
  const wl = sparringWeeklyLoad(s);
  const avgDuration = totalSessions > 0 ? Math.round(( (s.hardSparSessions||0)*90 + (s.techSparSessions||0)*60 + (s.wrestlingSessions||0)*75 + (s.conditioningSessions||0)*40) / totalSessions) : 70;
  const avgRPE = totalSessions > 0 ? ((s.hardSparSessions||0)*8.5 + (s.techSparSessions||0)*5.5 + (s.wrestlingSessions||0)*7.5 + (s.conditioningSessions||0)*6) / totalSessions : 6;
  // high дни — hard spar дни + wrestling (если >=2)
  let highDays: number[] = [];
  if (Array.isArray(s.hardDays) && s.hardDays.length) highDays = [...s.hardDays];
  else {
    if ((s.hardSparSessions || 0) >= 2) highDays = [1, 4];
    else if ((s.hardSparSessions || 0) === 1) highDays = [2];
    if ((s.wrestlingSessions || 0) >= 2) highDays = [...new Set([...highDays, 0, 3])].sort((a,b)=>a-b);
  }
  highDays = [...new Set(highDays.map(n=> Math.max(0, Math.min(6, Math.round(Number(n))))))].sort((a,b)=>a-b);
  const interference: OutsideLoad['interference'] = wl >= 1500 || (s.hardSparSessions||0) >= 2 ? 'high' : wl >= 800 ? 'medium' : 'low';
  const type: OutsideLoad['type'] = (() => {
    const d = (discipline||'').toLowerCase();
    if (d.includes('box') || d.includes('kick')) return 'ring';
    if (d.includes('mma') || d.includes('wrest') || d.includes('борь')) return 'mat';
    // эвристика по составу: ударный спарринг без борьбы → ring
    if ((s.hardSparSessions||0) > 0 && (s.wrestlingSessions||0) === 0) return 'ring';
    return 'mat';
  })();
  return {
    sessionsPerWeek: totalSessions,
    avgDurationMin: avgDuration,
    avgSRPE: Math.round(avgRPE * 10) / 10,
    type,
    highIntensityDays: highDays,
    interference,
    note: `sparring hard${s.hardSparSessions||0}/tech${s.techSparSessions||0}/wrest${s.wrestlingSessions||0}`,
  };
}

export function sparringSummary(s: SparringLoad | null | undefined): string {
  if (!s) return 'Спарринг: не задан';
  const wl = sparringWeeklyLoad(s);
  return `Спарринг ${wl} load: hard ${s.hardSparSessions||0}× (RPE 8.5) / tech ${s.techSparSessions||0}× / борьба ${s.wrestlingSessions||0}× → вне зала ${ (s.hardSparSessions||0)+(s.techSparSessions||0)+(s.wrestlingSessions||0)}×`;
}

export function validateSparringLoad(s: SparringLoad): string[] {
  const errs: string[] = [];
  const total = (s.hardSparSessions||0)+(s.techSparSessions||0)+(s.wrestlingSessions||0)+(s.conditioningSessions||0);
  if (total > 7) errs.push(`Суммарно ${total} спарринг-сессий >7 — перегруз`);
  if ((s.hardSparSessions||0) > 3) errs.push('Hard spar >3×/нед — риск ЦНС, снизьте до 2×');
  if ((s.hardSparSessions||0) >= 2 && (s.wrestlingSessions||0) >= 3) errs.push('Hard spar 2× + борьба 3× — высокая нагрузка, нужен делод 2× зал');
  return errs;
}

export function normalizeSparringLoad(input: SparringLoad | null | undefined): SparringLoad | null {
  if (!input) return null;
  const hs = Math.max(0, Math.min(4, Math.round(Number(input.hardSparSessions) || 0)));
  const ts = Math.max(0, Math.min(4, Math.round(Number(input.techSparSessions) || 0)));
  const ws = Math.max(0, Math.min(4, Math.round(Number(input.wrestlingSessions) || 0)));
  const cs = Math.max(0, Math.min(4, Math.round(Number(input.conditioningSessions) || 0)));
  if (hs+ts+ws+cs === 0) return null;
  return { hardSparSessions: hs, techSparSessions: ts, wrestlingSessions: ws, conditioningSessions: cs, hardDays: Array.isArray(input.hardDays) ? input.hardDays : undefined };
}
