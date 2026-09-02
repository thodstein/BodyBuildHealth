/**
 * strength-sport-weight-cut.engine.ts — лайт-весогонка для ТА/стронга (порт combat-weight-cut).
 * Для ТА угли жёстко не режем (сила страдает), только вода/Na + волокно.
 * ISSN 2025, Issurin, Barley.
 * Изолировано.
 */
export type WaterMode = 'stable' | 'load_cut';
export type SodiumMode = 'stable' | 'moderate_cut';
export type CarbMode = 'stable';
export type WeighInType = 'day_before_24h' | 'same_day_2h';

export interface WeightCutProtocolSS {
  targetLossKg: number;
  weeksOut: number;
  startWeightKg?: number;
  targetWeightKg?: number;
  waterMode: WaterMode;
  sodiumMode: SodiumMode;
  carbMode: CarbMode;
  heatSessions?: boolean;
  weighInType?: WeighInType;
  fiberGPerDay?: number;
  orsSodiumMmolPerDl?: number;
  confirmedManipulation?: boolean;
  notes?: string[];
}

export function getWeighInTypeForDisciplineSS(d: string): WeighInType {
  const low = (d||'').toLowerCase();
  if (low.includes('wrest')||low.includes('борь')||low.includes('jiu')||low.includes('дзюдо')||low.includes('judo')) return 'same_day_2h';
  return 'day_before_24h';
}

export function buildWeightCutProtocolSS(lossKg:number, opts?: Partial<WeightCutProtocolSS> & {startWeightKg?:number; discipline?:string}): WeightCutProtocolSS | null {
  if (!lossKg || lossKg<=0) return null;
  const w = Math.max(2, Math.min(12, Math.round(lossKg>6?10:lossKg>3?8:6)));
  const weighInType: WeighInType = (opts?.weighInType as WeighInType) || (opts?.discipline ? getWeighInTypeForDisciplineSS(opts.discipline) : 'day_before_24h');
  const isSame = weighInType==='same_day_2h';
  let waterMode: WaterMode = (opts?.waterMode as WaterMode) ?? (isSame? 'stable' : lossKg>=4?'load_cut':'stable');
  let sodiumMode: SodiumMode = (opts?.sodiumMode as SodiumMode) ?? (isSame? 'stable' : lossKg>=3?'moderate_cut':'stable');
  if (!opts?.confirmedManipulation && lossKg>5 && waterMode==='load_cut') waterMode='stable';
  return {
    targetLossKg: lossKg,
    weeksOut: opts?.weeksOut ?? w,
    startWeightKg: opts?.startWeightKg,
    targetWeightKg: opts?.startWeightKg ? opts.startWeightKg - lossKg : undefined,
    waterMode,
    sodiumMode,
    carbMode: 'stable',
    heatSessions: opts?.heatSessions ?? (isSame? false : lossKg>=3),
    weighInType,
    fiberGPerDay: opts?.fiberGPerDay ?? (lossKg>=2?10:28),
    orsSodiumMmolPerDl: opts?.orsSodiumMmolPerDl ?? 65,
    confirmedManipulation: !!opts?.confirmedManipulation,
    notes: opts?.notes,
  };
}

export function weightCutPhaseForWeekSS(week:number,totalWeeks:number,p:WeightCutProtocolSS|null): 'camp'|'taper'|'fight_week'|null {
  if (!p) return null;
  if (week===totalWeeks) return 'fight_week';
  if (week>=totalWeeks-1) return 'taper';
  return 'camp';
}

export function weightCutFiberForWeekSS(week:number,totalWeeks:number,p:WeightCutProtocolSS|null): number {
  if (!p) return 28;
  const ph=weightCutPhaseForWeekSS(week,totalWeeks,p);
  if (ph==='fight_week') return Math.min(10, p.fiberGPerDay??10);
  if (ph==='taper') return p.fiberGPerDay??12;
  return 28;
}

export function weightCutNutritionForWeekSS(week:number,totalWeeks:number,p:WeightCutProtocolSS|null, bw?:number, sex?:'male'|'female'): {kcal:number|null; proteinG:number|null; carbsG:number|null; waterMl:number|null; sodiumMg:number|null; fiberG:number|null; notes:string[]} {
  if (!p || bw==null || bw<=30) return {kcal:null,proteinG:null,carbsG:null,waterMl:null,sodiumMg:null,fiberG:null,notes:[]};
  const ph=weightCutPhaseForWeekSS(week,totalWeeks,p);
  const notes:string[]=[];
  const prot = Math.round(bw* (ph==='taper'||ph==='fight_week'?2.3:2.2));
  let carbs = Math.round(bw * (ph==='fight_week'?4: ph==='taper'?4.5:5)); // TA: не режем до 1г
  const fiber = weightCutFiberForWeekSS(week,totalWeeks,p);
  let water = Math.round(bw * (sex==='female'?30:35));
  let sodium=5000;
  if (ph==='taper') {
    const raw=Math.round(bw*100);
    if (!p.confirmedManipulation && p.waterMode==='load_cut') { water=Math.round(bw*40); notes.push('Load-cut требует подтверждения — 40мл/кг'); }
    else water = p.waterMode==='load_cut'? Math.min(bw>110?5000:8000, raw) : Math.round(bw*30);
    sodium = p.sodiumMode==='moderate_cut'?3000:4000;
    notes.push(`Тапер SS: угли ${carbs}г (стабильно, ТА не режем), вода ${water}мл, клетчатка ${fiber}г`);
  } else if (ph==='fight_week') {
    water = p.waterMode==='load_cut'? (p.weighInType==='same_day_2h'? Math.round(bw*25):2000) : Math.round(bw*20);
    sodium = p.sodiumMode==='moderate_cut'?1500:2500;
    notes.push(`Fight week SS: вода ${water}мл Na ${sodium}мг угли ${carbs}г (TA стабильно) → рефид 4-7г/кг`);
  } else {
    water=Math.round(bw * (sex==='female'?30:35));
  }
  const fatPerKg = sex==='female'?0.8:0.6;
  let fat=Math.round(bw*fatPerKg);
  if (sex==='female'&&fat<40) fat=40;
  if (sex!=='female'&&fat<30) fat=30;
  let kcal=prot*4+carbs*4+fat*9;
  const floor=sex==='female'?1400:1500;
  if (sex && kcal<floor) { const need=Math.ceil((floor - prot*4 - fat*9)/4); if (need>carbs){ notes.push(`RED-S ${kcal}<${floor} → угли ${carbs}→${need}`); carbs=need; kcal=floor; } }
  return {kcal,proteinG:prot,carbsG:carbs,waterMl:water,sodiumMg:sodium,fiberG:fiber,notes};
}

export function weightCutVolumeMultiplierSS(week:number,totalWeeks:number,p:WeightCutProtocolSS|null): number {
  if (!p) return 1;
  const ph=weightCutPhaseForWeekSS(week,totalWeeks,p);
  if (ph==='fight_week') return 0.7;
  if (ph==='taper') return 0.85;
  return 1;
}

export function weightCutRehydrationNotesSS(lossKg:number): string[] {
  const notes=[`Регидратация после взвешивания: ${Math.max(1, Math.round(lossKg*0.75))}л электролитного раствора + 1-2г/кг углей (тапер ТА стабильно)`];
  notes.push('ORS 65 ммоль/л Na — постепенно, за 2-4ч до старта');
  return notes;
}

export function validateWeightCutProtocolSS(p:WeightCutProtocolSS, opts?:{bodyweightKg?:number; sex?:'male'|'female'}): string[] {
  const e:string[]=[];
  if (p.targetLossKg>8) e.push('>8кг — врач');
  if (p.targetLossKg/p.weeksOut>1.5) e.push(`${(p.targetLossKg/p.weeksOut).toFixed(1)}кг/нед >1.5 — агрессивно`);
  if (p.weighInType==='same_day_2h' && p.targetLossKg>3) e.push('Same-day >3кг — нет времени');
  if ((p.fiberGPerDay??28)>15 && p.targetLossKg>=4) e.push('fiber >15 — ISSN <10');
  if (!p.confirmedManipulation && p.waterMode==='load_cut' && p.targetLossKg>5) e.push('load_cut требует подтверждения');
  if (opts?.sex==='female' && p.startWeightKg && p.targetLossKg/p.startWeightKg>0.05) e.push('female >5% — консервативно');
  return e;
}
