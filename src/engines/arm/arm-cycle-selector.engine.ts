/**
 * arm-cycle-selector.engine.ts — подбор именного цикла под атлета.
 * Зеркало lms-selector: скоринг + объяснение, чистый модуль.
 */
import { ARM_CYCLE_LIBRARY, type ArmCycleTemplate } from './arm-cycle-library.engine';

export interface ArmCycleRankInput {
  discipline?: string;
  level?: string;
  goal?: string;
  technique?: string;
  weeks?: number;
  daysPerWeek?: number;
  equipment?: string[];
  gripFocus?: string;
}

export interface ArmCycleRank {
  cycle: ArmCycleTemplate;
  score: number;
  reasons: string[];
}

const LEVEL_RANK: Record<string, number> = { beginner: 0, intermediate: 1, advanced: 2, enhanced: 3 };

export function rankArmCycles(input: ArmCycleRankInput = {}): ArmCycleRank[] {
  const disc = String(input.discipline || 'armwrestling').toLowerCase();
  const lvl = String(input.level || 'intermediate').toLowerCase();
  const goal = String(input.goal || 'strength').toLowerCase();
  const weeks = Number(input.weeks || 8);
  const dpw = Number(input.daysPerWeek || 0);
  const equip = (input.equipment || []).map((s) => String(s).toLowerCase());
  const has = (...keys: string[]) => keys.some((k) => equip.some((e) => e.includes(k)));

  const out: ArmCycleRank[] = ARM_CYCLE_LIBRARY.map((c) => {
    let score = 0;
    const reasons: string[] = [];
    // дисциплина
    if (c.discipline === disc || c.discipline === 'any') { score += 25; reasons.push('дисциплина совпадает'); }
    else if (c.discipline === 'hybrid') { score += 12; reasons.push('гибрид подходит частично'); }
    else { score -= 20; reasons.push('чужая дисциплина'); }
    // уровень
    if ((c.level as string[]).includes(lvl)) { score += 20; reasons.push('уровень подходит'); }
    else {
      const order = ['beginner', 'intermediate', 'advanced', 'enhanced'];
      const need = Math.min(...c.level.map((l) => order.indexOf(l as string)));
      const mine = LEVEL_RANK[lvl] ?? 1;
      score += mine > need ? 5 : -15;
      reasons.push(mine > need ? 'уровень выше требуемого' : 'уровень ниже требуемого');
    }
    // недели — ближе к длине цикла
    const dw = Math.abs(c.weeks - weeks);
    if (dw === 0) { score += 20; reasons.push(`длина 1-в-1 (${c.weeks} нед)`); }
    else if (dw <= 2) { score += 12; reasons.push(`длина рядом (${c.weeks} vs ${weeks})`); }
    else if (dw <= 4) { score += 4; }
    else { score -= 8; reasons.push(`длина далеко (${c.weeks} vs ${weeks})`); }
    // дни/нед
    if (dpw > 0) {
      const dd = Math.abs(c.daysPerWeek - dpw);
      if (dd === 0) { score += 10; reasons.push('частота совпадает'); }
      else if (dd === 1) score += 4;
      else score -= 6;
    }
    // цель
    if (goal === 'peaking' && (c.taperPreset !== 'none')) { score += 8; reasons.push('есть тейпер под пик'); }
    if (goal === 'hypertrophy' && (c.id === 'strengthlog_8' || c.id === 'grinder_hybrid_12')) { score += 6; reasons.push('объёмная база'); }
    if (goal === 'endurance' && (c.id === 'larratt_table_bloodflow' || c.id === 'for_7')) { score += 4; }
    // инвентарь
    if (c.id === 'src_toproll_12' && !(has('кабель') || has('cable') || has('блок'))) { score -= 10; reasons.push('нужен регулируемый блок'); }
    if ((c.id === 'coc_8' || c.id === 'coc_12') && !(has('grip') || has('эспандер') || has('coc') || has('хват'))) { score -= 4; reasons.push('желателен эспандер/хват'); }
    if (c.id.startsWith('coc_') && String(input.gripFocus || '').toLowerCase() === 'crush') { score += 6; reasons.push('crush-фокус'); }
    return { cycle: c, score, reasons };
  });
  out.sort((a, b) => b.score - a.score);
  return out;
}

export function selectBestArmCycle(input: ArmCycleRankInput = {}): ArmCycleTemplate {
  const ranked = rankArmCycles(input);
  return ranked[0]?.cycle || ARM_CYCLE_LIBRARY[0];
}

export function explainArmCycle(id: string): string {
  const c = ARM_CYCLE_LIBRARY.find((x) => x.id === id);
  if (!c) return 'Цикл не найден.';
  return `${c.name}: ${c.weeks} нед, ${c.daysPerWeek}×/нед, ${c.rpe}. ${c.note} Делоад: ${c.deloadRule}`;
}
