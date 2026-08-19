/**
 * bb-prep-splits.test.ts — каталог prep-профилей по категориям.
 */
import { describe, it, expect } from 'vitest';
import { PREP_SPLIT_PROFILES, prepSplitProfile, prepSplitsForCategory, PREP_MINIMAL_MODE_LABELS } from '../bb-prep-splits';
import { getPattern } from '../bb-split-patterns';
import { CATEGORY_PROFILES, type BBContestCategory } from '../bb-contest-prep.engine';

const CATS = Object.keys(CATEGORY_PROFILES) as BBContestCategory[];

describe('bb-prep-splits: профили категорий', () => {
  it('профиль есть для каждой категории, пол совпадает с CATEGORY_PROFILES', () => {
    for (const c of CATS) {
      const p = PREP_SPLIT_PROFILES[c];
      expect(p).toBeDefined();
      expect(p.sex).toBe(CATEGORY_PROFILES[c].sex);
      expect(p.category).toBe(c);
    }
  });

  it('рекомендуемые сплиты непустые и все существуют в bb-split-patterns', () => {
    for (const c of CATS) {
      const splits = PREP_SPLIT_PROFILES[c].recommendedSplits;
      expect(splits.length).toBeGreaterThan(0);
      for (const s of splits) expect(getPattern(s)).toBeDefined();
    }
  });

  it('дефолтный акцент 1-2 мышцы, минимум валиден', () => {
    for (const c of CATS) {
      const p = PREP_SPLIT_PROFILES[c];
      expect(p.defaultAccent.length).toBeGreaterThanOrEqual(1);
      expect(p.defaultAccent.length).toBeLessThanOrEqual(2);
      expect(Array.isArray(p.defaultMinimal)).toBe(true);
    }
  });

  it('женские лёгкие категории рекомендуют glute-сплиты', () => {
    expect(PREP_SPLIT_PROFILES.bikini.recommendedSplits).toContain('glute_focus_4');
    expect(PREP_SPLIT_PROFILES.wellness.recommendedSplits).toContain('female_glute_5');
  });

  it('mens_physique — V-taper: акцент плечи/спина, минимум квадры/руки', () => {
    const p = PREP_SPLIT_PROFILES.mens_physique;
    expect(p.defaultAccent).toEqual(['shoulders', 'back']);
    expect(p.defaultMinimal).toContain('quads');
  });

  it('пресет лёгких категорий склонен к MEV-флору, массовых — к полному исключению', () => {
    expect(PREP_SPLIT_PROFILES.bikini.minimalModePreference).toBe('reduce_direct_to_floor');
    expect(PREP_SPLIT_PROFILES.mens_bb.minimalModePreference).toBe('remove_direct_when_indirect_covers_floor');
  });

  it('helpers: prepSplitProfile fallback и prepSplitsForCategory', () => {
    expect(prepSplitProfile('mens_bb')).toBe(PREP_SPLIT_PROFILES.mens_bb);
    expect(prepSplitsForCategory('figure')).toEqual(PREP_SPLIT_PROFILES.figure.recommendedSplits);
  });

  it('лейблы режимов минимальной нагрузки заданы', () => {
    expect(PREP_MINIMAL_MODE_LABELS.reduce_direct_to_floor).toContain('MEV');
    expect(PREP_MINIMAL_MODE_LABELS.remove_direct_when_indirect_covers_floor).toContain('исклю');
  });
});
