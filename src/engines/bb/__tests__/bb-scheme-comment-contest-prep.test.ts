/**
 * bb-scheme-comment-contest-prep.test.ts — итерация I.
 *
 * Движок подготовки к соревнованиям меняет число сетов ПОСЛЕ buildBBPlan:
 *  - `planTwoShowSequence` — overreach перед тапером, объём ×1.12 (РОСТ),
 *  - `applyTrainingTaperToBBPlan` — тапер ББ (снижение объёма),
 *  - `applyContestPrepToBBPlan` — режим подготовки (prepVolumeMult 0.75…1).
 *
 * До фикса комментарий схемы объёма («GVT 10×10 (5×10…)», «Gironda 8×8 (5×8…)»,
 * «FST-7 (7×8-12…)») продолжал обещать исходное число, а в плане стояло другое —
 * ровно тот же обман, что G/H закрыли для билдера и авто-регуляции.
 */
import { describe, expect, it } from 'vitest';
import { buildBBPlan, type BBPlan } from '../bb-builder.engine';
import {
  applyContestPrepToBBPlan,
  applyTrainingTaperToBBPlan,
  planTwoShowSequence,
  type BBContestPrepConfig,
} from '../bb-contest-prep.engine';

const WM = {
  chest: 110, back: 130, shoulders: 65, quads: 150, hamstrings: 105, glutes: 145,
  biceps: 52, triceps: 62, calves: 85, traps: 75, forearms: 42,
};

/** Обещание схемы в комментарии: «<метка> (N×…». */
const CLAIM = /(GVT 10×10|FST-7|Gironda 8×8) \((\d+)×/;

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function baseConfig(over: Partial<BBContestPrepConfig> = {}): BBContestPrepConfig {
  return {
    sex: 'male',
    category: 'mens_physique',
    weightKg: 80,
    bodyFatPct: 7,
    experienceLevel: 'intermediate',
    enhanced: false,
    prepCount: 2,
    showDate: addDaysIso(todayIso(), 90),
    weeksOut: 2,
    trainingProtocol: 'bb',
    carbLoadStrategy: 'moderate',
    waterStrategy: 'minimal',
    sodiumStrategy: 'constant',
    ...over,
  };
}

function planWithScheme(scheme: 'gvt' | 'gironda' | 'fst7'): BBPlan {
  return buildBBPlan({
    patternId: 'ppl_6',
    level: 'advanced',
    trainingYears: 6,
    goal: 'mass',
    sex: 'male',
    weeks: 12,
    workMax: WM,
    volumeScheme: scheme,
  } as any) as BBPlan;
}

/** Все расхождения «обещание схемы ≠ факт» + склейка комментариев. */
function audit(plan: { weeks: Array<{ week: number; sessions: Array<{ exercises: any[] }> }> }) {
  const lies: string[] = [];
  let checked = 0;
  for (const w of plan.weeks) {
    for (const s of w.sessions) for (const e of s.exercises) {
      const m = CLAIM.exec(String(e.comment || ''));
      if (!m) continue;
      checked += 1;
      if (Number(m[2]) !== Number(e.sets)) {
        lies.push(`нед ${w.week}: «${m[1]} ${m[2]}×» → ${e.sets} сетов (${e.name})`);
      }
    }
  }
  const joined = plan.weeks
    .flatMap((w) => w.sessions)
    .flatMap((s) => s.exercises)
    .map((e) => String(e.comment || ''))
    .join('\n');
  return { lies, checked, joined };
}

describe('I: overreach перед тапером не оставляет схему с чужим числом сетов', () => {
  for (const scheme of ['gvt', 'gironda'] as const) {
    it(`${scheme}: рост объёма ×1.12 приводит цифру к факту`, () => {
      const base: any = planWithScheme(scheme);

      // Берём реальную неделю со схемой и ставим шоу так, чтобы overreach попал
      // именно на неё (условие кода: show.weekNumber === индекс_недели + 3).
      let targetWeek = 0;
      let targetHasScheme = false;
      for (let i = base.weeks.length - 3; i >= 0; i -= 1) {
        const has = base.weeks[i].sessions.some((s: any) =>
          s.exercises.some((e: any) => CLAIM.test(String(e.comment || ''))));
        if (has) { targetWeek = i + 1; targetHasScheme = true; break; }
      }
      expect(targetHasScheme, 'в плане нет ни одной недели со схемой объёма').toBe(true);

      const out: any = planTwoShowSequence(base, [{ weekNumber: targetWeek + 2 }]);
      const { lies, checked, joined } = audit(out.plan);

      expect(checked).toBeGreaterThan(0);
      expect(lies, lies.slice(0, 5).join('; ')).toEqual([]);
      // Причина названа именно overreach-проходом, а не «бюджетом недели».
      expect(joined).toMatch(/overreach перед тапером: \d+ из \d+ сетов/);
    });
  }
});

describe('I: подготовка к соревнованиям не оставляет схему с чужим числом сетов', () => {
  it('applyContestPrepToBBPlan: prepVolumeMult ×0.85 приводит цифру к факту', () => {
    const base = planWithScheme('gvt');
    const out: any = applyContestPrepToBBPlan(base, baseConfig(), {
      prepWeeks: 5, taperWeeks: 2, prepVolumeMult: 0.85,
    });
    const { lies, checked, joined } = audit(out);

    expect(checked).toBeGreaterThan(0);
    expect(lies, lies.slice(0, 5).join('; ')).toEqual([]);
    expect(joined).toMatch(/режим подготовки: \d+ из \d+ сетов/);
  });

  it('applyTrainingTaperToBBPlan: объём тапера тоже согласован с комментарием', () => {
    const base = planWithScheme('gironda');
    const out: any = applyTrainingTaperToBBPlan(base, baseConfig({ weeksOut: 3 }));
    const { lies, checked } = audit(out);

    expect(checked).toBeGreaterThan(0);
    expect(lies, lies.slice(0, 5).join('; ')).toEqual([]);
  });
});
