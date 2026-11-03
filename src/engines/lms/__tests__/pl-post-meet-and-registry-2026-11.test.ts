/**
 * pl-post-meet-and-registry-2026-11.test.ts — регрессы P0 из аудита 2026-11:
 *
 *  P0-2: пост-стартовая неделя больше НЕ копирует неделю прикидов (раньше в
 *        «восстановительную» неделю уезжали синглы 102 % ПМ).
 *  P0-5: недели стартов (`competitions[].week`) фиксированы и не пересчитываются
 *        от «сегодня» при каждой гидрации реестра; пере-привязка — только при
 *        пересборке годового плана (reanchorCompetitionWeeks).
 */
import { describe, expect, it } from 'vitest';
import { buildLMSPlan, appendPLTaperWeeks, type LMSBuildOutput } from '../lms-builder.engine';
import { CYCLE_01 } from '../../../data/lms-cycles/cycle-01';
import { mergeMeetRegistry, reanchorCompetitionWeeks, type CompetitionEvent } from '../pl-meet-registry.engine';

const pmMap = { 'Присед': 180, 'Жим лежа': 120, 'Становая тяга': 220 };

function buildWithTaper(opts: { meetWeek?: boolean; postMeet?: boolean } = {}): LMSBuildOutput {
  const base = buildLMSPlan({
    template: CYCLE_01 as never, pmMap, fallbackPm: 80, mode: 'natural', weeksOverride: 6, faithful: true,
  } as never);
  return appendPLTaperWeeks(base, 2, {
    windowWeeks: 6, meetWeek: opts.meetWeek !== false, postMeet: opts.postMeet !== false,
  });
}

describe('P0-2: пост-стартовая неделя не копирует соревновательные веса', () => {
  it('в неделе прикидов действительно есть синглы (предпосылка теста)', () => {
    const out = buildWithTaper();
    const meet = out.weeks.find(w => w.meetWeek)!;
    expect(meet).toBeTruthy();
    const singles = meet.days.flatMap(d => d.exercises.flatMap(e => e.workSets.filter(ws => ws.reps === 1)));
    expect(singles.length).toBeGreaterThan(0);
    // и они тяжёлые — 90 %+ ПМ
    expect(singles.some(ws => (ws.pct ?? 0) >= 0.9)).toBe(true);
  });

  it('пост-старт: ≤70 % ПМ, без синглов, RIR ≥3 по каждому подходу', () => {
    const out = buildWithTaper();
    const post = out.weeks.find(w => w.postMeet)!;
    expect(post).toBeTruthy();
    let checked = 0;
    for (const day of post.days) {
      for (const ex of day.exercises) {
        const pm = post.pmRow[ex.name] ?? ex.pm ?? 0;
        for (const ws of ex.workSets) {
          checked++;
          expect(ws.reps).toBeGreaterThan(1);
          expect(ws.pct).toBeLessThanOrEqual(0.7);
          expect(ws.rir ?? 0).toBeGreaterThanOrEqual(3);
          // вес с округлением до блинов/шага — допускаем 72 % ПМ
          if (pm > 0) expect(ws.weight).toBeLessThanOrEqual(Math.round(pm * 0.72));
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('пост-старт остаётся разгрузкой: объём не больше половины рабочей недели-базы', () => {
    const out = buildWithTaper();
    const post = out.weeks.find(w => w.postMeet)!;
    // База пост-недели — последняя НЕ-таперная/не-прикидочная неделя плана.
    const working = [...out.weeks].reverse().find(w => !w.taperWeek && !w.mockMeet && !w.meetWeek && !w.postMeet)!;
    expect(working).toBeTruthy();
    const setsOf = (w: typeof post) => w.days.reduce((s, d) => s + d.exercises.reduce((a, e) => a + e.workSets.reduce((x, ws) => x + ws.sets, 0), 0), 0);
    expect(setsOf(post)).toBeLessThanOrEqual(Math.max(1, Math.round(setsOf(working) * 0.55)));
  });

  it('без недели соревнований пост-старт всё равно строится от рабочей недели (не от тапера)', () => {
    const out = buildWithTaper({ meetWeek: false });
    const post = out.weeks.find(w => w.postMeet)!;
    expect(post).toBeTruthy();
    for (const day of post.days) for (const ex of day.exercises) for (const ws of ex.workSets) {
      expect(ws.reps).toBeGreaterThan(1);
      expect(ws.pct).toBeLessThanOrEqual(0.7);
    }
  });
});

describe('P0-5: недели стартов не дрейфуют при гидрации', () => {
  const comps = (): CompetitionEvent[] => [
    { id: 'c1', name: 'Кубок', week: 5, date: '2026-12-20', priority: 'A' },
  ];

  it('mergeMeetRegistry не переписывает week, когда дата задана', () => {
    const input = { competitions: comps(), legacyMeets: [], mainMeetId: 'c1', todayIso: '2026-11-02' };
    const a = mergeMeetRegistry(input);
    expect(a.competitions[0].week).toBe(5);
    // «сегодня» сдвинулось на 4 недели — старый код выдал бы week=1 и записал he_pl_macro.
    const b = mergeMeetRegistry({ ...input, todayIso: '2026-11-30' });
    expect(b.competitions[0].week).toBe(5);
    expect(b.changed).toBe(false);
  });

  it('события без валидной недели получают её один раз (миграция)', () => {
    const input = { competitions: [{ id: 'c2', name: 'Первенство', week: 0, date: '2026-12-20', priority: 'B' as const }], legacyMeets: [], mainMeetId: '', todayIso: '2026-11-02' };
    const r = mergeMeetRegistry(input);
    expect(r.competitions[0].week).toBe(7); // 49 дней → неделя 7
  });

  it('reanchorCompetitionWeeks пересчитывает неделю от новой точки отсчёта', () => {
    const anchored = reanchorCompetitionWeeks(comps(), '2026-11-30');
    expect(anchored[0].week).toBe(3); // 20 дней → неделя 3
    // дата не меняется
    expect(anchored[0].date).toBe('2026-12-20');
  });

  it('reanchorCompetitionWeeks: прошедшая дата зажимается в неделю 1 (не падает)', () => {
    const past: CompetitionEvent[] = [{ id: 'c3', name: 'Прошлый', week: 9, date: '2026-01-10', priority: 'B' }];
    const anchored = reanchorCompetitionWeeks(past, '2026-11-02');
    expect(anchored[0].week).toBe(1);
  });
});
