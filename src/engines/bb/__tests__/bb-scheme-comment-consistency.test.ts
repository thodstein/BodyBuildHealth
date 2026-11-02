/**
 * bb-scheme-comment-consistency.test.ts — итерация A/C, инвариант честности:
 * комментарий схемы не может обещать больше сетов, чем есть в плане.
 *
 * Реальный дефект до фикса: FST-7 назначал финишеру 7 сетов, бюджет недели
 * урезал его до 4, а комментарий продолжал писать «FST-7 (7×8-12, отдых 40с)» —
 * пользователь видел противоречие в одном и том же упражнении. Теперь цифра в
 * комментарии равна фактической, а причина урезания названа.
 */
import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';

const WM = {
  chest: 102.7, back: 121.3, shoulders: 61.7, quads: 141.3, hamstrings: 101.7,
  glutes: 141.3, biceps: 51.7, triceps: 61.7, calves: 81.7, traps: 71.7, forearms: 41.7,
};

const plan = (o: any = {}) => buildBBPlan({
  patternId: 'ppl_6', level: 'enhanced', trainingYears: 9, goal: 'mass', sex: 'male', weeks: 2, workMax: WM,
  peds: ['AAS', 'GH'], pedDoses: { AAS: 500, GH: 2 }, courseIntensity: 'moderate', methodology: 'fst7', ...o,
} as any) as any;

const exsOf = (p: any) => p.weeks.flatMap((w: any) => w.sessions.flatMap((s: any) => s.exercises as any[]));

const claimedSets = (comment: string): number | null => {
  const m = /FST-7 \((\d+)×/.exec(String(comment || ''));
  return m ? Number(m[1]) : null;
};

describe('FST-7: комментарий не обещает больше, чем есть', () => {
  it('число сетов в «FST-7 (N×…)» совпадает с фактическим', () => {
    const p = plan();
    const marked = exsOf(p).filter(e => claimedSets(e.comment) != null);
    expect(marked.length).toBeGreaterThan(0);
    for (const e of marked) {
      expect(claimedSets(e.comment), `${e.name}: ${String(e.comment).slice(0, 90)}`).toBe(e.sets);
    }
  });

  it('если финишер урезан — причина названа и в упражнении, и в rationale', () => {
    const p = plan();
    const trimmed = exsOf(p).filter(e => /урезан бюджетом недели/.test(String(e.comment || '')));
    if (trimmed.length > 0) {
      expect(p.rationale.join('\n')).toMatch(/FST-7: финишер урезан бюджетом недели/);
    } else {
      // Полный финишер прошёл — тогда 7 сетов действительно есть.
      expect(exsOf(p).some(e => (e.sets || 0) >= 7)).toBe(true);
    }
  });

  it('инвариант держится и при схеме по умолчанию', () => {
    const p = plan({ methodology: 'compound_first' });
    for (const e of exsOf(p)) {
      const claimed = claimedSets(e.comment);
      if (claimed != null) expect(claimed).toBe(e.sets);
    }
  });
});
