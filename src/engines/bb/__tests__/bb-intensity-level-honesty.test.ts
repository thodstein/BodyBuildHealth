/**
 * bb-intensity-level-honesty.test.ts (M-3, итерация F)
 *
 * M-3 из аудита: техники интенсивности назначались regex'ом в финализаторе, но
 * НЕ сверялись с данными `INTENSITY_TECHNIQUES` (у каждой техники свой список
 * уровней). Из-за этого intermediate-план мог получить rest-pause/myo-rep,
 * которые в данных помечены как advanced+ — то есть в одном репо жили две
 * противоречащие правды.
 *
 * Здесь фиксируем: уровень решает данные, а не догадка; и план объясняет, ЗАЧЕМ
 * техника стоит (в комментарии к упражнению есть причина, а не только название).
 */
import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import { INTENSITY_TECHNIQUES } from '../bb-intensity-techniques';

const WM = {
  chest: 100, back: 120, shoulders: 60, quads: 140, hamstrings: 100,
  glutes: 140, biceps: 50, triceps: 60, calves: 80, traps: 70, forearms: 40,
};

const planFor = (level: string) => buildBBPlan({
  patternId: 'ppl_6', level, trainingYears: level === 'beginner' ? 0.5 : level === 'intermediate' ? 3 : 9,
  goal: 'mass', sex: 'male', weeks: 8, workMax: WM,
} as any) as any;

const techniquesOf = (p: any): string[] =>
  p.weeks.flatMap((w: any) => w.sessions).flatMap((s: any) => s.exercises)
    .flatMap((e: any) => (e.workSets || []).map((ws: any) => String(ws.technique || '')))
    .filter(Boolean);

/** Техники, которые данные разрешают для уровня (независимо от характера дня). */
const allowedFor = (level: string): Set<string> => new Set(
  INTENSITY_TECHNIQUES.filter(t => t.level.includes(level)).map(t => t.technique),
);

describe('M-3: уровень техник берётся из данных, а не из догадки', () => {
  it('новичок: только дроп-сет, без отказных техник', () => {
    // §6.5 (практический бодибилдинг): новичку допустим один дроп-сет в конце
    // изоляции — он не требует отказа и не ломает технику. Rest-pause/myo-rep/21s
    // остаются закрытыми: это отказные протоколы.
    const used = techniquesOf(planFor('beginner'));
    for (const t of used) expect(['dropset'], `новичок получил ${t}`).toContain(t);
    expect(used).not.toContain('rest_pause');
    expect(used).not.toContain('myo_rep');
  });

  it('intermediate: только техники, разрешённые данными (без rest-pause/myo-rep)', () => {
    const allowed = allowedFor('intermediate');
    // twenty_ones — не элемент INTENSITY_TECHNIQUES (это техника специализации
    // бицепса из другого файла), она допустима для intermediate по своей природе.
    const extraOk = new Set(['twenty_ones']);
    const used = techniquesOf(planFor('intermediate'));
    expect(used.length, 'intermediate вообще не получил техник').toBeGreaterThan(0);
    for (const t of used) {
      expect(allowed.has(t) || extraOk.has(t), `intermediate получил ${t}`).toBe(true);
    }
    expect(used).not.toContain('rest_pause');
    expect(used).not.toContain('myo_rep');
  });

  it('advanced: техники разрешены данными и не более 3 на сессию', () => {
    const p = planFor('advanced');
    const allowed = allowedFor('advanced');
    const extraOk = new Set(['twenty_ones']);
    for (const t of techniquesOf(p)) expect(allowed.has(t) || extraOk.has(t), `advanced получил ${t}`).toBe(true);
    for (const w of p.weeks) {
      if ((w as any).deload) continue;
      for (const s of w.sessions) {
        const n = s.exercises.filter((e: any) => (e.workSets || []).some((ws: any) => ws.technique)).length;
        expect(n, `сессия ${w.week}/${s.day || s.sessionTag}`).toBeLessThanOrEqual(3);
      }
    }
  });

  it('план объясняет причину техники, а не только её название', () => {
    const p = planFor('advanced');
    const marked = p.weeks.flatMap((w: any) => w.sessions).flatMap((s: any) => s.exercises)
      .filter((e: any) => (e.workSets || []).some((ws: any) => ws.technique));
    expect(marked.length).toBeGreaterThan(0);
    for (const e of marked) {
      expect(String(e.comment || ''), e.name).toMatch(/почему:/);
    }
  });
});
