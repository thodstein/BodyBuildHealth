/**
 * strength-sport-ss-selector.engine.ts — подбор интернет-цикла ТА/стронга.
 * Аналог lms-selector для ss-cycles: скоринг по режиму/уровню/дням/неделям/
 * оборудованию/цели + гейт болгарского daily-max (согласие + advanced/enhanced
 * + ACWR не caution/dangerous).
 */
import { SS_CYCLES, getSSCyclesByMode } from '../../data/ss-cycles/ss-cycle-index';
import type { SSCycleTemplate } from '../../data/ss-cycles/ss-types';

export interface SSCycleRankInput {
  mode: 'weightlifting' | 'strongman' | 'hybrid';
  level: string;
  daysPerWeek: number;
  weeks: number;
  equipment?: string[];
  goal?: string;
  acwrZone?: string | null;
  cycleConsent?: boolean; // явное согласие на daily-max (болгарский)
}

export interface SSCycleScore {
  cycle: SSCycleTemplate;
  score: number;
  fit: 'exact' | 'close' | 'stretch';
  reasons: string[];
  blocked?: string; // причина блокировки (болгарский без согласия и т.п.)
  fallbackNote?: string; // предупреждение про фолбэк снарядов
}

const LEVEL_RANK: Record<string, number> = { beginner: 0, intermediate: 1, advanced: 2, enhanced: 3 };

function hasSpecialty(equipment?: string[]): boolean {
  if (!equipment || equipment.length === 0) return true; // пусто = доступно всё
  const eq = equipment.map(s => String(s).toLowerCase());
  return eq.includes('other') || eq.includes('specialty');
}

export function bulgarianGate(input: SSCycleRankInput): string | null {
  const lvl = LEVEL_RANK[input.level] ?? 1;
  if (lvl < 2) return 'Болгарский daily-max — только advanced/enhanced';
  if (!input.cycleConsent) return 'Болгарский daily-max — нужно явное согласие (чекбокс)';
  if (input.acwrZone === 'caution' || input.acwrZone === 'dangerous') return `Болгарский daily-max заблокирован: ACWR ${input.acwrZone}`;
  return null;
}

export function rankSSCycle(input: SSCycleRankInput): SSCycleScore[] {
  const pool = getSSCyclesByMode(input.mode);
  const specialty = hasSpecialty(input.equipment);
  const out: SSCycleScore[] = [];
  for (const cycle of pool) {
    const m = cycle.meta;
    const reasons: string[] = [];
    let score = 100;
    // Болгарский гейт
    if (m.bulgarian) {
      const block = bulgarianGate(input);
      if (block) {
        out.push({ cycle, score: -1000, fit: 'stretch', reasons: [], blocked: block });
        continue;
      }
      reasons.push('согласие daily-max есть');
    }
    // Уровень
    if (!m.level.includes(input.level as any)) {
      // соседний уровень — штраф, не блок
      score -= 25;
      reasons.push(`уровень ${m.level.join('/')} (у вас ${input.level}) −25`);
    } else {
      score += 10;
      reasons.push('уровень совпал +10');
    }
    // Дни (с учётом вилки sessionsPerWeek..Max для циклов 3→4)
    const lo = m.sessionsPerWeek;
    const hi = m.sessionsPerWeekMax ?? m.sessionsPerWeek;
    const inRange = input.daysPerWeek >= lo && input.daysPerWeek <= hi;
    const dDiff = inRange ? 0 : Math.min(Math.abs(lo - input.daysPerWeek), Math.abs(hi - input.daysPerWeek));
    if (dDiff === 0) { score += 20; reasons.push(`дни 1-в-1 (${lo}${hi !== lo ? `→${hi}` : ''}×) +20`); }
    else if (dDiff === 1) { score -= 10; reasons.push('дни ±1 −10'); }
    else { score -= 30; reasons.push(`дни ${lo}${hi !== lo ? `→${hi}` : ''}× vs ${input.daysPerWeek}× −30`); }
    // Недели
    const wDiff = Math.abs(m.weeks - input.weeks);
    if (wDiff === 0) { score += 15; reasons.push('недели 1-в-1 +15'); }
    else if (wDiff <= 2) { score -= 5; reasons.push(`недели ±${wDiff} −5`); }
    else { score -= 20; reasons.push(`недели ${m.weeks} vs ${input.weeks} −20`); }
    // Снаряды
    let fallbackNote: string | undefined;
    if (m.needsSpecialty && !specialty) {
      score -= 15;
      fallbackNote = 'Нет спец-снарядов — фолбэк ивентов: йок→фермер ×0.73, камень→мешок ×0.66';
      reasons.push('без снарядов −15 (фолбэк)');
    } else if (m.needsSpecialty) {
      score += 5;
      reasons.push('снаряды есть +5');
    }
    // Цель пик → циклы с тейпером/mock
    if (input.goal === 'peaking' && (m.taperWeeks?.length || m.mockWeeks?.length)) {
      score += 10;
      reasons.push('пик: есть тейпер/mock +10');
    }
    const fit: SSCycleScore['fit'] = score >= 120 ? 'exact' : score >= 85 ? 'close' : 'stretch';
    out.push({ cycle, score, fit, reasons, fallbackNote });
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

export function recommendSSCycle(input: SSCycleRankInput): SSCycleTemplate | null {
  const ranked = rankSSCycle(input).filter(r => !r.blocked);
  return ranked.length ? ranked[0].cycle : null;
}

export { SS_CYCLES };
