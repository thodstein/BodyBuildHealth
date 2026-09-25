/**
 * strength-sport-contest-simulator.engine.ts — симулятор контеста стронгмена.
 *
 * ЧЕСТНОСТЬ МОДЕЛИ (ревизия): прогноз строится ТОЛЬКО по event-specific ПМ
 * (yokeWalk / farmersWalk / atlasStone / …), как и объявлено в
 * StrengthSportWorkMax: «отдельный ввод, не фолбэк через deadlift».
 * Раньше здесь стояли кросс-ивентные фолбэки (йок ← становвая, камень ←
 * станов/гантели, царапина ← йок, финиш ← atlasStone) и выдуманные дефолты
 * 180/140/100/80/60 — из-за этого прогноз места/очков выглядел правдоподобно,
 * но считался от чужого показателя. Теперь:
 *   - нет своего ПМ у ивента → `hasData:false`, очки не начисляются, ивент
 *     попадает в `noData` и в текст rationale (а не получает выдуманный ratio);
 *   - переноски на время/дистанцию без веса и тяговые (трак/арм-овер-арм/
 *     сани) → вес НЕ является нагрузкой атлета, ratio не считается вовсе;
 *   - medley по `implements` → берётся ХУДШИЙ элемент (медаль — слабейшее звено);
 *   - `Math.random()` из чистой функции удалён (поле field не использовалось).
 */

import type { StrongmanContest, SMContestEvent } from './strength-sport-contest.types';
import type { StrengthSportWorkMax } from './strength-sport.types';

export interface ContestSimEvent {
  id: string;
  weight?: number;
  ratio: number;          // 0 при hasData:false
  effectiveRatio: number; // 0 при hasData:false
  points: number;         // 0 при hasData:false
  fatigueFactor: number;
  isWeak: boolean;
  /** Есть ли честная база для оценки (свой ПМ + нагрузка или implements). */
  hasData: boolean;
  /** Почему данных нет — показывается в rationale. */
  noDataReason?: string;
}

export interface ContestSimResult {
  events: ContestSimEvent[];
  totalPoints: number;
  avgPoints: number;
  predictedPlace: number; // 1-10 (по ивентам с данными)
  weakEvents: string[];
  strongEvents: string[];
  /** Ивенты без честной базы оценки — их точки НЕ придуманы. */
  noData: string[];
  recOrder: string[]; // id в рекомендуемом порядке
  rationale: string[];
}

/**
 * Строгая карта «ивент → ключ ПМ». Кросс-ивентных фолбэков НЕТ сознательно:
 * йок не измеряется становой, камень — гантелей, царапина — йоком.
 * Отсутствие ключа = честное «нет данных», а не подмена чужого максимума.
 */
const EVENT_WM_KEY: Record<string, keyof StrengthSportWorkMax> = {
  // переноски
  yoke_walk: 'yokeWalk',
  farmers_walk_heavy: 'farmersWalk',
  frame_carry: 'frameCarry',
  husafell_carry: 'husafellCarry',
  // камни / мешки / keg
  atlas_stone_load: 'atlasStone',
  atlas_stone_over_bar: 'atlasStone',
  natural_stone_shoulder: 'atlasStone',
  stone_lift: 'atlasStone',
  sandbag_load: 'sandbagLoad',
  sandbag_over_bar: 'sandbagLoad',
  sandbag_shoulder: 'sandbagLoad',
  keg_toss: 'kegToss',
  keg_over_bar: 'kegToss',
  keg_load: 'kegToss',
  // жимы
  log_press: 'logPress',
  axle_press: 'axlePress',
  circus_db_press: 'circusDbPress',
  circus_db_medley: 'circusDbPress',
  // тяги
  axle_deadlift: 'axleDeadlift',
  car_deadlift_18: 'carDeadlift',
  car_deadlift_side: 'carDeadlift',
  deadlift_max: 'deadlift',
};

/** Тяговые/динамические ивенты: `weight` — это вес СНАРЯДА, а не нагрузка атлета. */
const WEIGHTLESS_DRAG = new Set(['truck_pull', 'arm_over_arm', 'sled_drag', 'sled_push', 'sled_push_sprint']);

function workMaxKeyForEvent(eventId: string): keyof StrengthSportWorkMax | null {
  const direct = EVENT_WM_KEY[eventId];
  if (direct) return direct;
  // дженерик-хвост только для чистых олимпийских/приседательных id
  if (/\bohp\b|overhead_press/.test(eventId)) return 'overheadPress';
  if (/bench/.test(eventId)) return 'bench';
  if (/front_?squat/.test(eventId)) return 'frontSquat';
  if (/squat/.test(eventId)) return 'backSquat';
  if (/clean_?and_?jerk/.test(eventId)) return 'cleanJerk';
  if (/snatch/.test(eventId)) return 'snatch';
  if (/clean/.test(eventId)) return 'clean';
  if (/jerk/.test(eventId)) return 'jerk';
  if (/deadlift/.test(eventId)) return 'deadlift';
  return null;
}

function workMaxForEvent(eventId: string, wm: StrengthSportWorkMax): number | null {
  const key = workMaxKeyForEvent(eventId);
  if (!key) return null;
  const v = (wm as any)[key as string];
  return typeof v === 'number' && v > 0 ? v : null;
}

function eventTargetWeight(ev: SMContestEvent): number | null {
  if (WEIGHTLESS_DRAG.has(ev.id)) return null; // вес снаряда ≠ нагрузка атлета
  if (typeof ev.weight === 'number' && ev.weight > 0) return ev.weight;
  if (Array.isArray(ev.ladderWeights) && ev.ladderWeights.length) return ev.ladderWeights[ev.ladderWeights.length - 1];
  return null;
}

function pointsForRatio(r: number): number {
  if (r >= 1.05) return 10;
  if (r >= 1.0) return 9;
  if (r >= 0.95) return 7;
  if (r >= 0.90) return 5;
  if (r >= 0.85) return 3;
  if (r >= 0.80) return 2;
  return 1;
}

const CARRY_IDS = ['yoke_walk', 'farmers_walk_heavy', 'frame_carry', 'husafell_carry', 'shield_carry', 'duck_walk', 'sandbag_carry', 'zercher_carry'];

export function simulateContest(contest: StrongmanContest | null | undefined, workMax: StrengthSportWorkMax, strategy: 'conservative'|'balanced'|'aggressive' = 'balanced'): ContestSimResult | null {
  if (!contest || !Array.isArray(contest.events) || contest.events.length === 0) return null;
  const events = contest.events;
  const strategyMult = strategy === 'conservative' ? 0.97 : strategy === 'aggressive' ? 1.03 : 1;
  const simEvents: ContestSimEvent[] = events.map((ev, idx)=> {
    const wm = workMaxForEvent(ev.id, workMax);
    const target = eventTargetWeight(ev);
    let ratio = 0;
    let hasData = false;
    let noDataReason: string | undefined;

    if (Array.isArray(ev.implements) && ev.implements.length) {
      // medley: ограничивает СЛАБЕЙШИЙ элемент (нетривиально для своего ПМ)
      const impls = ev.implements;
      const ratios = impls.map(id => {
        const iw = workMaxForEvent(id, workMax);
        const it = (events.find(e => e.id === id) as SMContestEvent | undefined);
        const itarget = it ? eventTargetWeight(it) : null;
        if (iw == null || itarget == null || itarget <= 0) return null;
        return (iw * strategyMult) / itarget;
      }).filter((r): r is number => r != null);
      if (ratios.length) { ratio = Math.min(...ratios); hasData = true; }
      else noDataReason = `medley «${ev.id}»: нет данных по элементам ${impls.join('/')}`;
    } else if (wm == null) {
      noDataReason = `нет своего ПМ по «${ev.id}» — добавьте его в рабочие максимумы (прогноз не выдумывается)`;
    } else if (target == null || target <= 0) {
      noDataReason = `«${ev.id}»: нет нагрузки для сравнения (дистанция/время без веса)`;
    } else {
      ratio = (wm * strategyMult) / target;
      if (Array.isArray(ev.ladderWeights) && ev.ladderWeights.length > 1) ratio += 0.05; // лестница: первые веса легче
      hasData = true;
    }

    // fatigue 3% по порядку + 2% если предыдущий был carry
    const prevIsCarry = idx > 0 && CARRY_IDS.includes(events[idx-1].id);
    const fatigueFactor = Math.max(0.82, 1 - idx * 0.03 - (prevIsCarry ? 0.02 : 0));
    const effectiveRatio = hasData ? Math.round(ratio * fatigueFactor * 100) / 100 : 0;
    const pts = hasData ? pointsForRatio(effectiveRatio) : 0;
    return {
      id: ev.id, weight: target ?? ev.weight,
      ratio: hasData ? Math.round(ratio * 100) / 100 : 0,
      effectiveRatio, points: pts,
      fatigueFactor: Math.round(fatigueFactor * 100) / 100,
      isWeak: hasData && pts <= 3,
      hasData, noDataReason,
    };
  });

  const scored = simEvents.filter(e => e.hasData);
  // Нет ни одного ивента с честной базой — прогноз не выдумываем (было бы число из воздуха).
  if (!scored.length) return null;

  const totalPoints = scored.reduce((a, e) => a + e.points, 0);
  const avgPoints = Math.round(totalPoints / scored.length * 10) / 10;
  // Место vs поле: средний соперник — 6 очков на ивент
  const fieldAvg = 6 * scored.length;
  let predictedPlace: number;
  if (totalPoints >= fieldAvg + 4) predictedPlace = totalPoints >= fieldAvg + 7 ? 1 : 2;
  else if (totalPoints >= fieldAvg) predictedPlace = 3;
  else if (totalPoints >= fieldAvg - 3) predictedPlace = 5;
  else if (totalPoints >= fieldAvg - 6) predictedPlace = 7;
  else predictedPlace = 9;

  const weakEvents = scored.filter(e => e.isWeak).map(e => e.id);
  const strongEvents = scored.filter(e => e.points >= 7).map(e => e.id);
  const noData = simEvents.filter(e => !e.hasData).map(e => e.id);

  // Порядок: известные по ratio (сильнейшие первыми), неизвестные — в конец
  const known = [...scored].sort((a, b) => b.ratio - a.ratio).map(e => e.id);
  const unknown = simEvents.filter(e => !e.hasData).map(e => e.id);
  let recOrder = [...known, ...unknown];
  // йок перед фермером, если оба есть (снижает утомление переноски)
  const yi = recOrder.indexOf('yoke_walk');
  const fi = recOrder.indexOf('farmers_walk_heavy');
  if (yi >= 0 && fi >= 0 && fi < yi) {
    recOrder = recOrder.filter(id => id !== 'yoke_walk' && id !== 'farmers_walk_heavy');
    recOrder.unshift('yoke_walk');
    recOrder.splice(1, 0, 'farmers_walk_heavy');
  }

  const rationale: string[] = [];
  if (weakEvents.length) rationale.push(`Слабые: ${weakEvents.join(', ')} — приоритет ×1.15 объёма`);
  if (strongEvents.length) rationale.push(`Сильные: ${strongEvents.join(', ')} — держать taper`);
  if (noData.length) rationale.push(`⚠ Без честной базы (очки не начислены): ${noData.join(', ')} — задайте свой ПМ по этим ивентам`);
  rationale.push(`Порядок fatigue 3%/ивент +2% после carry — recOrder: ${recOrder.join(' → ')}`);
  rationale.push(`Стратегия ${strategy} (×${strategyMult}) — ${totalPoints} pts по ${scored.length} ив. → прогноз ${predictedPlace} место из 10`);
  return { events: simEvents, totalPoints, avgPoints, predictedPlace, weakEvents, strongEvents, noData, recOrder, rationale };
}

export function recommendOrderForContest(contest: StrongmanContest, workMax: StrengthSportWorkMax): string[] {
  const sim = simulateContest(contest, workMax);
  return sim ? sim.recOrder : contest.events.map(e=> e.id);
}
