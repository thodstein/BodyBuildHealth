/**
 * arm-macrocycle.engine.ts — годовой макро для арм-блока (как bb-macrocycle).
 * 4 фазы: hypertrophy → strength → peaking → transition.
 */
export type ArmMacroPhase = 'hypertrophy' | 'strength' | 'peaking' | 'transition';

export interface ArmMacroBlock {
  phase: ArmMacroPhase;
  weeks: number;
  weekOffset: number;
  description?: string;
  competitionId?: string;
  competitionPriority?: 'A'|'B'|'C';
  weightClass?: string;
}

export interface ArmMacrocycle {
  type: 'arm';
  blocks: ArmMacroBlock[];
  totalWeeks: number;
  rationale: string[];
}

export function buildArmMacrocycle(input: {
  totalWeeks: number;
  goal?: string;
  level?: string;
  competitions?: Array<{ week: number; id: string; priority?: 'A'|'B'|'C'; weightClass?: string }>;
}): ArmMacrocycle {
  const total = Math.max(4, Math.min(52, Math.round(input.totalWeeks || 12)));
  const blocks: ArmMacroBlock[] = [];
  const goal = (input.goal || 'strength').toLowerCase();
  let offset = 0;

  // WAF-приоритеты: A — главный (ЧМ) 3н taper+пик, B — контрольный 2н, C — встроен
  const hasA = input.competitions?.some(c => (c.priority || 'B') === 'A');
  const hasB = input.competitions?.some(c => (c.priority || 'B') === 'B');
  // Распределение: hypertrophy 40% → strength 35% → peaking 15% → transition 10%
  // Для peaking цели — peaking больше; для hypertrophy — hypertrophy больше; если есть A — peaking минимум 3н
  let hPct = 0.4, sPct = 0.35, pPct = 0.15, tPct = 0.1;
  if (goal === 'hypertrophy') { hPct = 0.5; sPct = 0.3; pPct = 0.1; tPct = 0.1; }
  if (goal === 'peaking' || hasA) { hPct = 0.3; sPct = 0.3; pPct = 0.3; tPct = 0.1; }
  if (hasB && !hasA) { pPct = Math.max(pPct, 0.2); }

  const hW = Math.max(2, Math.round(total * hPct));
  const sW = Math.max(2, Math.round(total * sPct));
  const pW = Math.max(hasA ? 3 : 1, Math.round(total * pPct));
  // 26.10.2026 было→стало: минимумы фаз (2/2/3) добавляли недели ПОВЕРХ бюджета —
  // при total 12 + приоритет A сумма блоков была 13 ≠ totalWeeks (annualPlanFromMacro
  // считает totalWeeks от макро, а ref.weeks от блоков → validateAnnualPlan выдавал
  // «сумма недель ≠» и outOfRange у последнего блока). Теперь бюджет делится:
  // фазы, не влезшие в total, откусываются от более поздних (peaking → transition),
  // сохраняя свои минимумы.
  const tW = Math.max(1, total - hW - sW - pW);
  const fixed: Array<{ phase: ArmMacroPhase; weeks: number }> = [
    { phase: 'hypertrophy', weeks: hW },
    { phase: 'strength', weeks: sW },
    { phase: 'peaking', weeks: pW },
    { phase: 'transition', weeks: tW },
  ];
  let sum = fixed.reduce((a, b) => a + b.weeks, 0);
  // откусываем с конца (transition → peaking → strength), пока сумма > total
  for (let i = fixed.length - 1; i >= 0 && sum > total; i--) {
    const minWeeks = i === 2 ? (hasA ? 3 : 1) : i === 3 ? 1 : 2;
    const cut = Math.min(fixed[i].weeks - minWeeks, sum - total);
    if (cut > 0) { fixed[i].weeks -= cut; sum -= cut; }
  }
  // если total слишком мал под минимумы — сжимаем пропорционально до суммы total
  if (sum > total) {
    const scale = total / sum;
    let acc = 0;
    for (let i = 0; i < fixed.length; i++) {
      const w = i === fixed.length - 1 ? total - acc : Math.max(1, Math.round(fixed[i].weeks * scale));
      fixed[i].weeks = w;
      acc += w;
    }
    sum = total;
  }

  for (const ph of fixed) {
    if (ph.weeks <= 0) continue;
    blocks.push({ phase: ph.phase, weeks: ph.weeks, weekOffset: offset, description: `${ph.phase} ${ph.weeks} нед` });
    offset += ph.weeks;
  }

  // Привязка competition → peaking с приоритетом (A главный → peaking week, C встроен в strength)
  if (input.competitions && input.competitions.length > 0) {
    // сортируем по приоритету A>B>C и по неделе
    const sorted = [...input.competitions].sort((a,b) => {
      const prio = { A:0, B:1, C:2 } as any;
      const pa = prio[a.priority||'B'], pb = prio[b.priority||'B'];
      if (pa!==pb) return pa - pb;
      return a.week - b.week;
    });
    for (const comp of sorted) {
      const prio = comp.priority || 'B';
      if (prio === 'C') {
        // C — встроен, не привязываем к peaking, находим strength блок
        const st = blocks.find(b=> b.phase==='strength');
        if (st) { st.competitionId = comp.id; (st as any).competitionPriority = 'C'; if(comp.weightClass) st.weightClass = comp.weightClass; }
        continue;
      }
      const blk = blocks.find(b => comp.week >= b.weekOffset + 1 && comp.week <= b.weekOffset + b.weeks);
      if (blk) { blk.competitionId = comp.id; blk.competitionPriority = prio as any; if(comp.weightClass) blk.weightClass = comp.weightClass; }
      else {
        // если неделя вне диапазона — привязываем к ближайшему peaking
        const peak = blocks.find(b=>b.phase==='peaking');
        if (peak) { peak.competitionId = comp.id; peak.competitionPriority = prio as any; }
      }
    }
  }

  return {
    type: 'arm' as const,
    blocks,
    totalWeeks: total,
    rationale: [`Арм-макро ${total} нед: ${blocks.map(b => `${b.phase} ${b.weeks}н`).join(' → ')}`],
  };
}

export function armMacroPhaseForWeek(macro: ArmMacrocycle, week: number): ArmMacroPhase | null {
  for (const b of macro.blocks) {
    if (week >= b.weekOffset + 1 && week <= b.weekOffset + b.weeks) return b.phase;
  }
  return null;
}

/** Маппинг ARM макро-фазы → UserWeek Phase (как bbMacroPhaseToUserPhase/macroPhaseToUserPhase). */
export function armMacroPhaseToUserPhase(phase: ArmMacroPhase): 'accumulation' | 'intensification' | 'peaking' | 'deload' {
  switch (phase) {
    case 'hypertrophy': return 'accumulation';
    case 'strength': return 'intensification';
    case 'peaking': return 'peaking';
    case 'transition': return 'deload';
    default: return 'accumulation';
  }
}
