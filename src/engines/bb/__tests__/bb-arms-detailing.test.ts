import { describe, it, expect } from 'vitest';
import {
  STRICT_EXERCISE_GROUPS,
  strictGroupForExercise,
  strictGroupMembersOf,
} from '../bb-exercise-selection.engine';
import { rankCorrectionsForWeak } from '../bb-correction-rank.engine';

/** Руки: строгие группы + пиковая в топ-3 коррекций (сечка чинится заменой, не словами). */
describe('bb-arms-detailing', () => {
  it('строгие группы рук: бицепс 3 + трицепс 3', () => {
    expect(STRICT_EXERCISE_GROUPS.biceps.length).toBe(3);
    expect(STRICT_EXERCISE_GROUPS.triceps.length).toBe(3);
  });
  it('бицепс: база/молот/пик, кросс в трицепс запрещён', () => {
    expect(strictGroupForExercise({ id: 'curl_bar', name: 'Сгибания со штангой' }, 'biceps')?.key).toBe('bicep_base');
    expect(strictGroupForExercise({ id: 'hammer_curl', name: 'Молотки' }, 'biceps')?.key).toBe('bicep_hammer');
    expect(strictGroupForExercise({ id: 'preacher_curl', name: 'Сгибания на скамье Скотта' }, 'biceps')?.key).toBe('bicep_peak');
    const members = strictGroupMembersOf({ id: 'curl_bar', name: 'Сгибания со штангой' }, 'biceps').map((c: any) => c.id);
    expect(members.length).toBeGreaterThan(0);
    expect(members.some((id: string) => /tricep|pushdown|dip/i.test(id))).toBe(false);
  });
  it('трицепс: блок/из-за головы/база, кросс в бицепс запрещён', () => {
    expect(strictGroupForExercise({ id: 'tricep_pushdown_rope', name: 'Разгибания на блоке с канатом' }, 'triceps')?.key).toBe('tricep_push');
    expect(strictGroupForExercise({ id: 'overhead_tricep_ext', name: 'Разгибания из-за головы в блоке' }, 'triceps')?.key).toBe('tricep_overhead');
    expect(strictGroupForExercise({ id: 'dips_tricep', name: 'Отжимания на брусьях' }, 'triceps')?.key).toBe('tricep_press');
    const members = strictGroupMembersOf({ id: 'tricep_pushdown_rope', name: 'Разгибания на блоке' }, 'triceps').map((c: any) => c.id);
    expect(members.some((id: string) => /curl|hammer|preacher/i.test(id))).toBe(false);
  });
  it('ранжир: при missingShort пиковая всплывает с пометкой сечки', () => {
    const ranked = rankCorrectionsForWeak('biceps', null, { missingShort: true });
    expect(ranked.length).toBeGreaterThan(0);
    const peak = ranked.find((r) => /пиковая \(сечка\)/.test(r.reason));
    expect(peak).toBeTruthy();
    expect(ranked.slice(0, 3).some((r) => /пиковая \(сечка\)/.test(r.reason))).toBe(true);
  });
  it('ранжир: без missingShort пиковой пометки нет', () => {
    const ranked = rankCorrectionsForWeak('biceps', null, {});
    expect(ranked.every((r) => !/пиковая \(сечка\)/.test(r.reason))).toBe(true);
  });
});
