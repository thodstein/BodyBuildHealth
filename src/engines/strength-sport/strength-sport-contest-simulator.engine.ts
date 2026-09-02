/**
 * strength-sport-contest-simulator.engine.ts — симулятор контеста стронгмена
 * Считает ожидаемые очки/место vs поле 10 атлетов + рекомендации по порядку и слабым ивентам
 * Основано на workMax vs contest weight + fatigue factor 3%/ивент + стратегия
 */

import type { StrongmanContest, SMContestEvent } from './strength-sport-contest.types';
import type { StrengthSportWorkMax } from './strength-sport.types';

export interface ContestSimEvent {
  id: string;
  weight?: number;
  ratio: number;
  effectiveRatio: number;
  points: number;
  fatigueFactor: number;
  isWeak: boolean;
}

export interface ContestSimResult {
  events: ContestSimEvent[];
  totalPoints: number;
  avgPoints: number;
  predictedPlace: number; // 1-10
  weakEvents: string[];
  strongEvents: string[];
  recOrder: string[]; // id в рекомендуемом порядке
  rationale: string[];
}

function workMaxForEvent(eventId: string, wm: StrengthSportWorkMax): number {
  const anyWm = wm as any;
  if (eventId === 'yoke_walk') return anyWm.yokeWalk || anyWm.farmersWalk || anyWm.deadlift || 180;
  if (eventId === 'farmers_walk_heavy') return anyWm.farmersWalk || anyWm.frameCarry || anyWm.deadlift || 140;
  if (eventId === 'frame_carry') return anyWm.frameCarry || anyWm.farmersWalk || anyWm.yokeWalk || 140;
  if (eventId === 'husafell_carry') return anyWm.husafellCarry || anyWm.frameCarry || anyWm.farmersWalk || 140;
  if (eventId === 'conan_wheel') return anyWm.husafellCarry || anyWm.frameCarry || 120;
  if (eventId === 'shield_carry') return anyWm.frameCarry || 100;
  if (eventId === 'duck_walk') return anyWm.yokeWalk || 180;
  if (eventId === 'atlas_stone_load' || eventId === 'atlas_stone_over_bar' || eventId === 'natural_stone_shoulder' || eventId === 'stone_lift') return anyWm.atlasStone || anyWm.sandbagLoad || anyWm.deadlift || 100;
  if (eventId === 'sandbag_load' || eventId === 'sandbag_over_bar' || eventId === 'sandbag_shoulder' || eventId === 'keg_toss' || eventId === 'keg_over_bar' || eventId === 'keg_load') return anyWm.sandbagLoad || anyWm.atlasStone || 80;
  if (eventId === 'log_press') return anyWm.logPress || anyWm.overheadPress || 60;
  if (eventId === 'axle_press') return anyWm.axlePress || anyWm.logPress || anyWm.overheadPress || 60;
  if (eventId === 'viking_press') return anyWm.axlePress || anyWm.logPress || 60;
  if (eventId === 'circus_db_press' || eventId === 'circus_db_medley') return anyWm.circusDbPress || anyWm.logPress || 60;
  if (eventId === 'axle_deadlift') return anyWm.axleDeadlift || anyWm.deadlift || 120;
  if (eventId === 'car_deadlift_18' || eventId === 'car_deadlift_side' || eventId === 'deadlift_max') return anyWm.carDeadlift || anyWm.axleDeadlift || anyWm.deadlift || 120;
  if (eventId === 'truck_pull' || eventId === 'arm_over_arm' || eventId === 'sled_drag' || eventId === 'sled_push' || eventId === 'sled_push_sprint') return anyWm.deadlift || 140;
  if (eventId === 'tire_flip') return anyWm.atlasStone || 100;
  if (eventId === 'zercher_carry' || eventId === 'sandbag_carry') return anyWm.frameCarry || anyWm.farmersWalk || 120;
  if (eventId.includes('press') || eventId.includes('ohp') || eventId.includes('bench')) return anyWm.overheadPress || anyWm.bench || 60;
  if (eventId.includes('squat')) return anyWm.backSquat || anyWm.frontSquat || 100;
  if (eventId.includes('deadlift')) return anyWm.deadlift || 120;
  return anyWm.deadlift || anyWm.backSquat || 100;
}

function eventTargetWeight(ev: SMContestEvent): number | null {
  if (typeof ev.weight === 'number' && ev.weight > 0) return ev.weight;
  if (Array.isArray(ev.ladderWeights) && ev.ladderWeights.length) return ev.ladderWeights[ev.ladderWeights.length - 1];
  if (Array.isArray(ev.implements) && ev.implements.length) return null; // medley без веса
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

export function simulateContest(contest: StrongmanContest | null | undefined, workMax: StrengthSportWorkMax, strategy: 'conservative'|'balanced'|'aggressive' = 'balanced'): ContestSimResult | null {
  if (!contest || !Array.isArray(contest.events) || contest.events.length === 0) return null;
  const events = contest.events;
  const strategyMult = strategy === 'conservative' ? 0.97 : strategy === 'aggressive' ? 1.03 : 1;
  const simEvents: ContestSimEvent[] = events.map((ev, idx)=> {
    const wm = workMaxForEvent(ev.id, workMax);
    const target = eventTargetWeight(ev);
    let ratio = 1;
    if (target != null && target > 0) {
      ratio = (wm * strategyMult) / target;
      // ladder: если лестница 100-140, ratio считаем по последнему весу, но учитываем что первые легче — бонус +0.05
      if (Array.isArray(ev.ladderWeights) && ev.ladderWeights.length > 1) ratio += 0.05;
    } else {
      // дистанция — считаем по carry метрике, без веса — ratio 1 если wm есть
      ratio = wm > 0 ? 0.95 : 0.85;
    }
    // fatigue 3% per order + 2% если предыдущий был carry
    const prevIsCarry = idx>0 && ['yoke_walk','farmers_walk_heavy','frame_carry','husafell_carry','conan_wheel','shield_carry','duck_walk','sandbag_carry','zercher_carry'].includes(events[idx-1].id);
    const fatigueFactor = Math.max(0.82, 1 - idx*0.03 - (prevIsCarry ? 0.02 : 0));
    const effectiveRatio = Math.round(ratio * fatigueFactor * 100)/100;
    const pts = pointsForRatio(effectiveRatio);
    return { id: ev.id, weight: target ?? ev.weight, ratio: Math.round(ratio*100)/100, effectiveRatio, points: pts, fatigueFactor: Math.round(fatigueFactor*100)/100, isWeak: pts <= 3 };
  });
  const totalPoints = simEvents.reduce((a,e)=> a+e.points, 0);
  const avgPoints = simEvents.length ? Math.round(totalPoints / simEvents.length *10)/10 : 0;
  // предсказанное место vs 10 виртуальных соперников (средний соперник 6 очков/ивент)
  const fieldAvg = 6 * simEvents.length;
  const field = Array.from({length:9}, (_,i)=> fieldAvg + (Math.random()-0.5)*6 + (i%3-1)*2); // детерминированно чуть, но используем фиксированный sid
  // для детерминизма без random: сортировка по totalPoints vs fieldAvg ± spread
  // упростим: место по totalPoints: если total >= fieldAvg+4 → 1-2, +0 → 3-5, -4 → 6-8, меньше → 9-10
  let predictedPlace: number;
  if (totalPoints >= fieldAvg + 4) predictedPlace = totalPoints >= fieldAvg + 7 ? 1 : 2;
  else if (totalPoints >= fieldAvg) predictedPlace = 3;
  else if (totalPoints >= fieldAvg - 3) predictedPlace = 5;
  else if (totalPoints >= fieldAvg - 6) predictedPlace = 7;
  else predictedPlace = 9;
  const weakEvents = simEvents.filter(e=> e.isWeak).map(e=> e.id);
  const strongEvents = simEvents.filter(e=> e.points >= 7).map(e=> e.id);
  // recOrder: сортируем по ratio убыванию, но сохраняем carry-группу (yoke перед farmers если оба есть)
  const sorted = [...simEvents].sort((a,b)=> b.ratio - a.ratio).map(e=> e.id);
  // ensure yoke before farmers if both present (снижает fatigue farmers)
  const hasYoke = sorted.includes('yoke_walk');
  const hasFarmers = sorted.includes('farmers_walk_heavy');
  let recOrder = sorted;
  if (hasYoke && hasFarmers) {
    const yi = recOrder.indexOf('yoke_walk');
    const fi = recOrder.indexOf('farmers_walk_heavy');
    if (fi < yi) { // farmers раньше — меняем
      recOrder = recOrder.filter(id=> id!=='yoke_walk' && id!=='farmers_walk_heavy');
      recOrder.unshift('yoke_walk'); recOrder.splice(1,0,'farmers_walk_heavy');
    }
  }
  const rationale: string[] = [];
  if (weakEvents.length) rationale.push(`Слабые: ${weakEvents.join(', ')} — приоритет ×1.15 объёма`);
  if (strongEvents.length) rationale.push(`Сильные: ${strongEvents.join(', ')} — держать taper`);
  rationale.push(`Порядок fatigue 3%/ивент +2% после carry — recOrder: ${recOrder.join(' → ')}`);
  rationale.push(`Стратегия ${strategy} (×${strategyMult}) — total ${totalPoints} pts → прогноз ${predictedPlace} место из 10`);
  return { events: simEvents, totalPoints, avgPoints, predictedPlace, weakEvents, strongEvents, recOrder, rationale };
}

export function recommendOrderForContest(contest: StrongmanContest, workMax: StrengthSportWorkMax): string[] {
  const sim = simulateContest(contest, workMax);
  return sim ? sim.recOrder : contest.events.map(e=> e.id);
}
