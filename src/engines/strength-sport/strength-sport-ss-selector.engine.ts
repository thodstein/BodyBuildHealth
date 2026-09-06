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
  weakPoints?: string[]; // слабые лифты/зоны — цикл с их покрытием приоритетнее
  contestEvents?: string[]; // id ивентов заявленного контеста — цикл с ними приоритетнее
  age?: number; // Masters-гейты: 40+ против 6д/нед, 50+ против daily-max
}

export interface SSCycleScore {
  cycle: SSCycleTemplate;
  score: number;
  fit: 'exact' | 'close' | 'stretch';
  reasons: string[];
  blocked?: string; // причина блокировки (болгарский без согласия и т.п.)
  fallbackNote?: string; // предупреждение про фолбэк снарядов
  weeksNote?: string; // честная пометка при расхождении длительности с запросом
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
  if ((input.age ?? 0) >= 50) return 'Болгарский daily-max — masters 50+: запрещён (суставы/восстановление)';
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
    // Masters 40+: 6-дневные циклы штрафуются (восстановление)
    if ((input.age ?? 0) >= 40 && m.sessionsPerWeek >= 6) {
      score -= 15;
      reasons.push('masters 40+: 6д/нед −15');
    }
    // Недели (+ честная пометка при сильном расхождении — план будет длиннее/короче запроса)
    const wDiff = Math.abs(m.weeks - input.weeks);
    let weeksNote: string | undefined;
    if (wDiff === 0) { score += 15; reasons.push('недели 1-в-1 +15'); }
    else if (wDiff <= 2) { score -= 5; reasons.push(`недели ±${wDiff} −5`); }
    else {
      score -= 20; reasons.push(`недели ${m.weeks} vs ${input.weeks} −20`);
      weeksNote = m.weeks > input.weeks
        ? `План длиннее запроса на ${wDiff} нед (возьмутся все ${m.weeks} нед цикла)`
        : `План короче запроса на ${wDiff} нед (цикл ${m.weeks} нед — доберите блоком)`;
    }
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
    // Слабые лифты: покрытие токенами id упражнений цикла (×2 частота у StrongmanPlan — здесь приоритетом)
    const cycleIds: string[] = [];
    try {
      for (const wk of cycle.weeks) for (const d of wk) for (const e of d.exercises) cycleIds.push(String(e.id).toLowerCase());
    } catch { /* пустой цикл */ }
    const weakTokens = (input.weakPoints || [])
      .flatMap(w => String(w).toLowerCase().split(/[^a-zа-яё]+/))
      .filter(t => t.length > 2);
    let weakCovered = 0;
    for (const tok of weakTokens) {
      if (cycleIds.some(id => id.includes(tok) || tok.includes(id))) weakCovered++;
    }
    if (weakCovered > 0) {
      const bonus = Math.min(16, weakCovered * 8);
      score += bonus;
      reasons.push(`слабые покрыты ${weakCovered} (+${bonus})`);
    }
    // Контест: ивенты заявки в цикле + тейпер/mock-якорь
    const contestIds = (input.contestEvents || []).map(s => String(s).toLowerCase());
    let contestHits = 0;
    for (const ev of contestIds) {
      if (cycleIds.some(id => id === ev || id.includes(ev) || ev.includes(id))) contestHits++;
    }
    if (contestHits > 0) {
      const bonus = Math.min(15, contestHits * 5);
      score += bonus;
      reasons.push(`контест-ивенты ${contestHits} (+${bonus})`);
      if (m.taperWeeks?.length || m.mockWeeks?.length) {
        score += 5;
        reasons.push('контест-якорь тейпер/mock +5');
      }
    }
    // Цели масса/техника/поддержание: объём и характер (циклы силовые по построению — честная дифференциация)
    if (input.goal === 'hypertrophy') {
      let w1sets = 0;
      try { for (const d of cycle.weeks[0]) for (const e of d.exercises) for (const s of e.sets) w1sets += s.sets; } catch { w1sets = 0; }
      if (w1sets >= 60) { score += 8; reasons.push(`масса: объём нед.1 ${w1sets} сетов +8`); }
    } else if (input.goal === 'technique') {
      const hasTechDay = cycle.weeks.some(wk => wk.some(d => d.tag === 'technique_day' || d.character === 'памп'));
      if (hasTechDay) { score += 8; reasons.push('техника: есть техничные дни +8'); }
      if (m.bulgarian) { score -= 10; reasons.push('техника: daily-max −10'); }
    } else if (input.goal === 'maintenance' && m.weeks <= 6) {
      score += 8; reasons.push('поддержание: короткий цикл +8');
    }
    const fit: SSCycleScore['fit'] = score >= 120 ? 'exact' : score >= 85 ? 'close' : 'stretch';
    out.push({ cycle, score, fit, reasons, fallbackNote, weeksNote });
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

export function recommendSSCycle(input: SSCycleRankInput): SSCycleTemplate | null {
  const ranked = rankSSCycle(input).filter(r => !r.blocked);
  return ranked.length ? ranked[0].cycle : null;
}

export { SS_CYCLES };
