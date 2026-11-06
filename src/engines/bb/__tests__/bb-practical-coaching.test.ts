/**
 * bb-practical-coaching.test.ts — «практический бодибилдинг» для §5/§6/§8
 * плана `BB-AUTO-ORDER-DELIVERY-METHODS-PLAN-2026-11.md`.
 *
 * Закрепляет решения, которые до этого были только текстом в доке:
 *  - §6.1 методика = полный протокол (темп финишера, а не только сеты);
 *  - §6.3 «круги» только там, где есть что чередовать (2+ упражнения мышцы);
 *  - §6.4 печать: неделя на страницу + весь мезоцикл;
 *  - §6.5 новичку — один дроп-сет, никаких отказных техник;
 *  - §8.1 суперсет в плеере — блок A1→B1, а не бейдж на разнесённых упражнениях;
 *  - §8.2 объяснение «почему это упражнение здесь» по слоту.
 */
import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import {
  arrangeSupersetBlocks,
  explainSessionOrderPerExercise,
  shouldInterleave,
} from '../bb-session-order.engine';
import { buildBBPlanPrintHtml } from '../bb-visual.engine';
import { REP_SCHEMES } from '../bb-rep-schemes.engine';

const WM = {
  chest: 102.7, back: 121.3, shoulders: 61.7, quads: 141.3, hamstrings: 101.7,
  glutes: 141.3, biceps: 51.7, triceps: 61.7, calves: 81.7, traps: 71.7, forearms: 41.7,
};

const plan = (level: string, extra: Record<string, any> = {}) => buildBBPlan({
  patternId: 'upper_lower_4',
  level,
  trainingYears: level === 'beginner' ? 0.5 : level === 'intermediate' ? 3 : 9,
  goal: 'mass',
  sex: 'male',
  weeks: 2,
  workMax: WM,
  ...extra,
} as any) as any;

const exercisesOf = (p: any): any[] =>
  (p?.weeks || []).flatMap((w: any) => (w.sessions || []).flatMap((s: any) => (s.exercises || [])));

const EX = (name: string, muscle: string, extra: Record<string, any> = {}) => ({
  name, muscle, role: 'accessory', character: 'лёг', sets: 3, rir: 2,
  workSets: [{ weight: 40, reps: 12, rir: 2 }],
  ...extra,
} as any);

describe('§8.1 суперсет — один блок A1→B1 в плеере', () => {
  it('пара слот 0/1 встаёт подряд на месте первого участника', () => {
    const list = [
      { name: 'A', supersetGroup: 7, supersetSlot: 0 },
      { name: 'X' },
      { name: 'Y' },
      { name: 'B', supersetGroup: 7, supersetSlot: 1 },
    ];
    expect(arrangeSupersetBlocks(list).map(x => x.name)).toEqual(['A', 'B', 'X', 'Y']);
  });

  it('без суперсетов порядок не меняется (ни одного лишнего переупорядочивания)', () => {
    const list = [{ name: 'A' }, { name: 'B' }, { name: 'C' }];
    expect(arrangeSupersetBlocks(list).map(x => x.name)).toEqual(['A', 'B', 'C']);
  });
});

describe('§8.2 объяснение порядка по слоту', () => {
  const session = [
    EX('Жим лёжа', 'chest', { role: 'primary', character: 'тяж', sets: 4 }),
    EX('Разводка гантелей', 'chest', { role: 'accessory', character: 'памп', sets: 3 }),
    EX('Французский жим', 'triceps', { role: 'accessory', character: 'памп', sets: 3 }),
  ];

  it('на каждое упражнение — своя причина, а не общий список правил', () => {
    const out = explainSessionOrderPerExercise(session, { primaryMuscle: 'chest', sessionTag: 'Push' });
    expect(out).toHaveLength(3);
    expect(out[0].reason).toMatch(/тяжёлая база дня \(грудь\)/);
    expect(out[1].reason).toMatch(/изоляция \(грудь\)/);
    expect(out[2].reason).toMatch(/изоляция \(трицепс\)/);
    // причины различаются — иначе это не «почему здесь», а копия общих правил
    expect(new Set(out.map(o => o.reason)).size).toBe(3);
  });

  it('упражнение в суперсете говорит об этом прямо', () => {
    const out = explainSessionOrderPerExercise(
      [EX('Сгибание ног', 'hamstrings', { supersetGroup: 3, supersetSlot: 1 })],
      { primaryMuscle: 'hamstrings' },
    );
    expect(out[0].reason).toMatch(/суперсете A1→B1/);
  });

  it('пустой день — пустой список', () => {
    expect(explainSessionOrderPerExercise([])).toEqual([]);
  });
});

describe('§6.3 круги только там, где есть что чередовать', () => {
  it('FullBody с двумя упражнениями одной мышцы — круги', () => {
    expect(shouldInterleave('FullBody', [
      { muscle: 'chest' }, { muscle: 'chest' }, { muscle: 'quads' }, { muscle: 'back' },
    ])).toBe(true);
  });

  it('FullBody, где каждая мышца один раз, — без кругов (чередовать нечего)', () => {
    expect(shouldInterleave('FullBody', [{ muscle: 'chest' }, { muscle: 'quads' }, { muscle: 'back' }])).toBe(false);
  });

  it('Torso (верх тела) — тоже круги, если есть 3+ мышцы и 2+ упражнения одной', () => {
    expect(shouldInterleave('Torso', [
      { muscle: 'chest' }, { muscle: 'chest' }, { muscle: 'back' }, { muscle: 'shoulders' },
    ])).toBe(true);
  });

  it('Torso из 1-2 мышц — без кругов (чередовать нечего)', () => {
    expect(shouldInterleave('Torso', [{ muscle: 'chest' }, { muscle: 'chest' }, { muscle: 'back' }])).toBe(false);
  });

  it('сплит-день (Push) — круги не включаются', () => {
    expect(shouldInterleave('Push', [{ muscle: 'chest' }, { muscle: 'chest' }, { muscle: 'triceps' }])).toBe(false);
  });
});

describe('§6.1 FST-7 — протокол с темпом, а не только 7 сетов', () => {
  it('финишер получает темп схемы в workSets и tempoSpec', () => {
    const p: any = plan('enhanced', {
      peds: ['AAS', 'GH'], pedDoses: { AAS: 500, GH: 2 }, courseIntensity: 'moderate',
      methodology: 'fst7',
    });
    const finishers = exercisesOf(p).filter(ex => /FST-7/.test(String(ex.comment || '')));
    expect(finishers.length, 'FST-7-финишер не назначен').toBeGreaterThan(0);
    const f = finishers[0];
    expect(f.workSets.length).toBeGreaterThan(0);
    for (const ws of f.workSets) expect(ws.tempo).toBe(REP_SCHEMES.fst7.tempo);
    expect(f.tempoSpec).toBe(REP_SCHEMES.fst7.tempo);
  });

  it('«7 в одном» не режется MRV-гейтом: это перераспределение сетов мышцы', () => {
    const p: any = plan('enhanced', {
      peds: ['AAS', 'GH'], pedDoses: { AAS: 500, GH: 2 }, courseIntensity: 'moderate',
      methodology: 'fst7',
    });
    const finishers = exercisesOf(p).filter(ex => /FST-7/.test(String(ex.comment || '')));
    expect(finishers.length, 'FST-7-финишер не назначен').toBeGreaterThan(0);
    for (const f of finishers) {
      expect(f.workSets.length, `${f.name}: финишер не 7 сетов`).toBe(7);
    }
  });
});

describe('§6.5 новичок — только дроп-сет, без отказных техник', () => {
  it('в плане новичка нет rest-pause/myo-rep, а дроп-сет — не больше одного на сессию', () => {
    const p = plan('beginner');
    const used: string[] = p.weeks.flatMap((w: any) => w.sessions)
      .flatMap((s: any) => s.exercises)
      .flatMap((e: any) => (e.workSets || []).map((ws: any) => String(ws.technique || '')))
      .filter(Boolean);
    for (const t of used) expect(['dropset'], `новичок получил ${t}`).toContain(t);
    expect(used.length, 'дроп-сет новичку не назначен ни разу — правило не работает').toBeGreaterThan(0);
    for (const w of p.weeks) {
      for (const s of w.sessions) {
        const n = s.exercises.filter((e: any) => (e.workSets || []).some((ws: any) => ws.technique)).length;
        expect(n).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('§6.4 печать: неделя на странице и весь мезоцикл', () => {
  const p = plan('intermediate', { weeks: 4 });

  it('scope=week печатает только выбранную неделю', () => {
    const html = buildBBPlanPrintHtml(p, { scope: 'week', week: 2 });
    expect(html).toContain('Неделя 2 ·');
    expect(html).not.toContain('Неделя 1 ·');
    expect(html).not.toContain('Неделя 3 ·');
  });

  it('по умолчанию — весь мезоцикл', () => {
    const html = buildBBPlanPrintHtml(p, {});
    expect(html).toContain('Неделя 1 ·');
    expect(html).toContain('Неделя 4 ·');
  });

  it('pageBreakPerWeek ставит разрыв страницы между неделями', () => {
    expect(buildBBPlanPrintHtml(p, { pageBreakPerWeek: true })).toContain('page-break-before:always');
  });
});
