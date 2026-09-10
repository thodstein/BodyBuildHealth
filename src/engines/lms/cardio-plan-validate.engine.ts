/**
 * cardio-plan-validate.engine.ts — валидатор кардио-цикла (P1-2 плана).
 * Аналог MRV-валидации ББ: правило 10% (прогрессия объёма), делод-каденс,
 * HIIT-доля (поляризованный гард 20%, новичкам 10%), застой без делода,
 * taper перед стартом. Чистая функция — план не меняет.
 */

import type { CardioCycle } from './cardio.engine';

export type CardioIssueLevel = 'error' | 'warn' | 'info';
export interface CardioPlanIssue {
  level: CardioIssueLevel;
  code: string;
  text: string;
}

export interface CardioPlanValidation {
  issues: CardioPlanIssue[];
  /** 0-100: старт 100, −15 за error, −8 за warn, floor 0. */
  qualityScore: number;
  valid: boolean;
}

function weekMinutes(week: CardioCycle['weeks'][number]): number {
  return week.totalMinutes;
}

function hiitShare(week: CardioCycle['weeks'][number]): number {
  const total = weekMinutes(week);
  if (total <= 0) return 0;
  const hi = week.sessions
    .filter(s => s.type === 'hiit')
    .reduce((s, x) => s + x.durationMin * x.weeklyFrequency, 0);
  return hi / total;
}

/**
 * Проверить цикл. opts.beginner — строгий HIIT-гард (≤10%);
 * opts.competitionWeeks — недели стартов (taper-контроль).
 */
export function validateCardioCycle(
  cycle: CardioCycle,
  opts: { beginner?: boolean; competitionWeeks?: number[] } = {},
): CardioPlanValidation {
  const issues: CardioPlanIssue[] = [];
  const weeks = cycle.weeks ?? [];
  if (weeks.length === 0) {
    return { issues: [{ level: 'error', code: 'empty', text: 'Цикл без недель.' }], qualityScore: 0, valid: false };
  }
  // Правило 10%: скачок объёма между соседними рабочими неделями.
  // Абсолютный пол: +12 мин на 3 сессии (C25K-стиль) — не нарушение,
  // правило ловит только значимые скачки (>15 мин warn, >20 мин error).
  for (let i = 1; i < weeks.length; i++) {
    const prev = weeks[i - 1];
    const cur = weeks[i];
    if (cur.deload || cur.taper || prev.deload || prev.taper) continue;
    const pv = weekMinutes(prev);
    const cv = weekMinutes(cur);
    if (pv <= 0) continue;
    const jump = (cv - pv) / pv;
    const absJump = cv - pv;
    if (jump > 0.2 && absJump > 20) {
      issues.push({ level: 'error', code: 'volume_jump', text: `Нед ${cur.week}: объём +${Math.round(jump * 100)}% (+${Math.round(absJump)} мин) к прошлой (лимит +10%, >+20% — травмоопасно).` });
    } else if (jump > 0.1 && absJump > 15) {
      issues.push({ level: 'warn', code: 'volume_jump', text: `Нед ${cur.week}: объём +${Math.round(jump * 100)}% (+${Math.round(absJump)} мин) (лимит +10%/нед).` });
    }
  }
  // Делод-каденс: циклы ≥6 нед — делод минимум каждые 4 нед.
  // Исключение: низкообъёмные планы без HIIT (walk/run новичков, пик <150 мин) —
  // делод по источнику не предусмотрен, объём не требует разгрузки.
  const maxWeek = weeks.reduce((m, w) => Math.max(m, weekMinutes(w)), 0);
  const hasHiit = weeks.some(w => hiitShare(w) > 0);
  if (weeks.length >= 6 && (maxWeek >= 150 || hasHiit)) {
    const deloads = weeks.filter(w => w.deload).map(w => w.week);
    let last = 0;
    let gap = false;
    for (const d of deloads) { if (d - last > 4) gap = true; last = d; }
    if (deloads.length === 0 || weeks.length - last > 4) gap = true;
    if (gap) {
      issues.push({ level: 'warn', code: 'no_deload', text: 'Нет делода каждые ≤4 нед — добавьте разгрузочную неделю (объём −40%, без HIIT).' });
    }
  }
  // HIIT-доля: поляризованный гард.
  const hiitCap = opts.beginner ? 0.1 : 0.2;
  weeks.forEach(w => {
    if (w.deload || w.taper) return;
    const share = hiitShare(w);
    if (share > hiitCap + 0.1) {
      issues.push({ level: 'error', code: 'hiit_share', text: `Нед ${w.week}: HIIT ${Math.round(share * 100)}% объёма (лимит ${Math.round(hiitCap * 100)}%).` });
    } else if (share > hiitCap) {
      issues.push({ level: 'warn', code: 'hiit_share', text: `Нед ${w.week}: HIIT ${Math.round(share * 100)}% — выше ${Math.round(hiitCap * 100)}% (80/20).` });
    }
  });
  // Застой: ≥4 одинаковые рабочие недели подряд без прогрессии/делода.
  let flat = 0;
  for (let i = 1; i < weeks.length; i++) {
    const pv = weekMinutes(weeks[i - 1]);
    const cv = weekMinutes(weeks[i]);
    if (!weeks[i].deload && !weeks[i].taper && pv > 0 && Math.abs(cv - pv) / pv < 0.03) flat++;
    else flat = 0;
    if (flat >= 3) {
      issues.push({ level: 'info', code: 'plateau', text: `Нед ${weeks[i].week}: 4+ недели без роста объёма — запланируйте прогрессию или делод.` });
      flat = 0;
    }
  }
  // Taper перед стартами.
  const comps = opts.competitionWeeks ?? [];
  for (const cw of comps) {
    const hit = weeks.find(w => w.week === cw);
    if (!hit) continue;
    const before = weeks.filter(w => w.week < cw && w.week >= cw - 2);
    if (before.length > 0 && !before.some(w => w.taper || w.deload)) {
      issues.push({ level: 'warn', code: 'no_taper', text: `Старт на нед ${cw} без taper/deload в предшествующие 2 нед.` });
    }
  }
  let score = 100;
  for (const i of issues) score -= i.level === 'error' ? 15 : i.level === 'warn' ? 8 : 0;
  score = Math.max(0, score);
  return { issues, qualityScore: score, valid: !issues.some(i => i.level === 'error') };
}
