import { describe, expect, it } from 'vitest';
import { ANGLE_CLASSES, lengthenedBonus, lengthenedBonusForExercise } from '../bb-exercise-selection.engine';
import { tempoFor, catalogTempoHints } from '../bb-tempo-rest';
import { cooldownBlockedNames, recordCooldownUse, type CooldownHistory } from '../bb-exercise-rotation.engine';
import { buildBBPlan } from '../bb-builder.engine';

/** Волна-1 (аудит 2026-09): отбор упражнений — флаг-осведомлённый lengthened
 *  и живые угловые классы (seated_curl больше не перехватывается curl). */
describe('Волна-1 — lengthenedBonusForExercise (флаг каталога stretchPhase)', () => {
  it('regex-имя → бонус как раньше', () => {
    expect(lengthenedBonus('Румынская тяга', 'hypertrophy')).toBe(10);
    expect(lengthenedBonusForExercise({ name: 'Румынская тяга' }, 'hypertrophy')).toBe(10);
  });

  it('флаг stretchPhase без regex-имени → бонус выдаётся (раньше флаг не читался)', () => {
    expect(lengthenedBonus('Неизвестное упражнение', 'hypertrophy')).toBe(0);
    expect(lengthenedBonusForExercise({ name: 'Неизвестное упражнение', stretchPhase: true }, 'hypertrophy')).toBe(10);
  });

  it('focus модулирует: strength ×0.5, endurance ×1.5', () => {
    expect(lengthenedBonusForExercise({ name: 'x', stretchPhase: true }, 'strength')).toBe(5);
    expect(lengthenedBonusForExercise({ name: 'x', stretchPhase: true }, 'endurance')).toBe(15);
  });

  it('без флага и без имени → 0', () => {
    expect(lengthenedBonusForExercise({ name: 'Жим штанги лёжа' }, 'hypertrophy')).toBe(0);
  });
});

describe('Волна-1 — углы хамстрингов: seated_curl достижим', () => {
  it('«Сгибания ног сидя» → класс seated_curl (раньше перехватывал curl)', () => {
    const cls = ANGLE_CLASSES.hamstrings.find(ac => ac.match({ name: 'Сгибания ног сидя', id: 'leg_curl_seated' } as any));
    expect(cls?.name).toBe('seated_curl');
  });

  it('«Сгибания ног лёжа» → класс curl', () => {
    const cls = ANGLE_CLASSES.hamstrings.find(ac => ac.match({ name: 'Сгибания ног в тренажёре лёжа', id: 'leg_curl' } as any));
    expect(cls?.name).toBe('curl');
  });
});

describe('Волна-1 — темпы: чистка tempoFor (deload доминирует, override работает)', () => {
  it('per-exercise override применяется вне deload', () => {
    expect(tempoFor('тяж', undefined, 'accumulation', 'Румынская тяга').notation).toBe('3-1-1-0');
  });

  it('deload подавляет override — фазовый темп 4-1-1-0', () => {
    expect(tempoFor('тяж', undefined, 'deload', 'Румынская тяга').notation).toBe('4-1-1-0');
  });

  it('интенс-техника negatives → 4-0-1-0', () => {
    expect(tempoFor('тяж', 'negatives', 'accumulation').notation).toBe('4-0-1-0');
  });
});

describe('Волна-1.9 — pauseSeconds каталога садятся в свою позицию нотации', () => {
  it('растянутая позиция (stretchPhase) → 2-я цифра', () => {
    const t = tempoFor('тяж', undefined, 'accumulation', 'Подъёмы на носки стоя');
    expect(t.notation).toBe('3-2-1-0');
    expect(t.tutPerRep).toBe(6);
  });

  it('пиковое сокращение (peakContraction) → 4-я цифра (поверх фазового темпа)', () => {
    expect(tempoFor('тяж', undefined, 'accumulation', 'Разгибания ног в тренажёре').notation).toBe('3-1-1-2');
  });

  it('короткая пауза (<2с) не меняет фазовый темп', () => {
    expect(tempoFor('тяж', undefined, 'accumulation', 'Жим штанги лёжа').notation).toBe('2-0-1-0');
  });

  it('deload игнорирует паузы каталога (восстановление важнее)', () => {
    expect(tempoFor('тяж', undefined, 'deload', 'Подъёмы на носки стоя').notation).toBe('4-1-1-0');
  });

  it('catalogTempoHints отдаёт флаги записи каталога', () => {
    const hint = catalogTempoHints('Подъёмы на носки стоя');
    expect(hint?.pauseSeconds).toBe(2);
    expect(hint?.stretchPhase).toBe(true);
  });
});

describe('Волна-1.4 — cooldown-правила ротации (enforced)', () => {
  const seed = (): CooldownHistory => {
    const h: CooldownHistory = new Map();
    recordCooldownUse(h, 'chest', 'Разводка гантелей лёжа', 1);
    return h;
  };

  it('та же неделя и gap 1–3 заблокированы, gap 4 — снова доступен', () => {
    const h = seed();
    expect(cooldownBlockedNames(h, 'chest', 1)).toContain('Разводка гантелей лёжа');
    expect(cooldownBlockedNames(h, 'chest', 2)).toContain('Разводка гантелей лёжа');
    expect(cooldownBlockedNames(h, 'chest', 4)).toContain('Разводка гантелей лёжа');
    expect(cooldownBlockedNames(h, 'chest', 5)).not.toContain('Разводка гантелей лёжа');
  });

  it('лимит 3 использования за мезоцикл блокирует и после окна тишины', () => {
    const h = seed();
    recordCooldownUse(h, 'chest', 'Разводка гантелей лёжа', 5);
    recordCooldownUse(h, 'chest', 'Разводка гантелей лёжа', 9);
    expect(cooldownBlockedNames(h, 'chest', 13)).toContain('Разводка гантелей лёжа');
  });

  it('повторная запись в ту же неделю не накручивает счётчик', () => {
    const h = seed();
    recordCooldownUse(h, 'chest', 'Разводка гантелей лёжа', 1);
    recordCooldownUse(h, 'chest', 'Разводка гантелей лёжа', 1);
    recordCooldownUse(h, 'chest', 'Разводка гантелей лёжа', 5);
    // 3-го использования нет → не заблокирован в неделе 9
    expect(cooldownBlockedNames(h, 'chest', 9)).not.toContain('Разводка гантелей лёжа');
  });

  it('незнакомая мышца → пустой список', () => {
    expect(cooldownBlockedNames(seed(), 'quads', 2)).toEqual([]);
  });
});

describe('Волна-1.4 — cooldown живёт в генерации (окно тишины истекает)', () => {
  it('12-нед план: accessory переиспользуется только после окна (gap ≥ 4)', () => {
    const WM = { chest: 100, back: 120, shoulders: 60, biceps: 50, triceps: 60, quads: 140, hamstrings: 100, glutes: 140, calves: 80, abs: 60, traps: 80, forearms: 40 };
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', trainingYears: 3, goal: 'mass', weeks: 12, workMax: WM } as any);
    const byMuscle = new Map<string, Map<string, number[]>>();
    for (const w of plan.weeks) for (const s of w.sessions) for (const e of s.exercises) {
      if (e.role !== 'accessory' || (e as any).warmupActivator) continue;
      if (!byMuscle.has(e.muscle)) byMuscle.set(e.muscle, new Map());
      const mm = byMuscle.get(e.muscle)!;
      const key = String(e.name);
      if (!mm.has(key)) mm.set(key, []);
      if (!mm.get(key)!.includes(w.week)) mm.get(key)!.push(w.week);
    }
    let reuseAfterCooldown = 0;
    for (const mm of byMuscle.values()) {
      for (const ws of mm.values()) {
        const sorted = [...ws].sort((a, b) => a - b);
        for (let i = 1; i < sorted.length; i++) if (sorted[i] - sorted[i - 1] >= 4) reuseAfterCooldown++;
      }
    }
    expect(reuseAfterCooldown).toBeGreaterThan(0);
  });
});

describe('Волна-1.7 — темп-конвейер держит оба канала (workSets ↔ tempoSpec)', () => {
  it('техника negative: tempoSpec синхронизирован с workSets[0].tempo', () => {
    const WM = { chest: 100, back: 120, shoulders: 60, biceps: 50, triceps: 60, quads: 140, hamstrings: 100, glutes: 140, calves: 80, abs: 60, traps: 80, forearms: 40 };
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', trainingYears: 3, goal: 'mass', weeks: 4, workMax: WM, intensityTechnique: 'negative' } as any);
    let checked = 0;
    for (const w of plan.weeks) for (const s of w.sessions) for (const e of s.exercises) {
      if (!String((e as any).comment || '').includes('Негативы')) continue;
      if (!(e as any).workSets?.length) continue;
      expect((e as any).tempoSpec).toBe((e as any).workSets[0].tempo);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });
});
