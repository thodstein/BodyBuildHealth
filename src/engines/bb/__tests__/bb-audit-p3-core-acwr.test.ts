/**
 * Аудит 2026-11, ядро P3-5 — ACWR больше не притворяется нормой.
 *
 * Находка: `computeAcwr` глушил любые ошибки и возвращал «здоровые» 1.0 — и при
 * отсутствии sRPE-данных, и при одной сессии, и при `ratio` = NaN (деление на
 * нулевую хроническую нагрузку). План, отчёт и тапер-план получали значение,
 * неотличимое от измеренной нормы 1.0.
 *
 * Правка: `computeAcwr(): number | null`, `null` = «данных нет»; ошибка хранилища
 * логируется (`console.warn`) и тоже даёт `null`. Потребители приведены к
 * `number | null`: гейты в сборке (`acwrRatio != null`), `PostPhaseInput`
 * (там проверка уже была null-safe) и `recommendBBTaperConfig`, где
 * `Number(null) === 0` давал ложный «недогруз: taper 2 нед».
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildBBPlan, computeAcwr, type BBBuilderInput } from '../bb-builder.engine';
import { recommendBBTaperConfig } from '../bb-contest-prep.engine';

const KEY = 'he_srpe_sessions';

const stubSessions = (sessions: Array<{ date: string; sRPE: number; durationMin: number }> | string | null) => {
  const store = new Map<string, string>();
  if (sessions != null) store.set(KEY, typeof sessions === 'string' ? sessions : JSON.stringify(sessions));
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
  });
};

const iso = (offsetDays: number) => {
  const d = new Date(Date.UTC(2026, 2, 1) + offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
};

/** Равномерная нагрузка: одна сессия в день на протяжении 28 дней. */
const uniform = () => Array.from({ length: 28 }, (_, i) => ({ date: iso(i), sRPE: 7, durationMin: 60 }));

afterEach(() => { vi.unstubAllGlobals(); });

describe('ядро P3-5: ACWR без данных — это `null`, а не «норма 1.0»', () => {
  it('нет sRPE-сессий → null', () => {
    stubSessions([]);
    expect(computeAcwr()).toBeNull();
  });

  it('одна сессия → null (окно ACWR не из чего считать)', () => {
    stubSessions([{ date: iso(0), sRPE: 8, durationMin: 60 }]);
    expect(computeAcwr()).toBeNull();
  });

  it('битый JSON в хранилище → null, а не «здоровые 1»', () => {
    stubSessions('{ это не JSON');
    expect(computeAcwr()).toBeNull();
  });

  it('сессии с нечитаемыми датами → null, а не ratio 0 («недогруз»)', () => {
    stubSessions([
      { date: 'not-a-date', sRPE: 8, durationMin: 60 },
      { date: '', sRPE: 8, durationMin: 60 },
      { date: '??', sRPE: 8, durationMin: 60 },
    ]);
    expect(computeAcwr()).toBeNull();
  });

  it('равномерная нагрузка → измеренное значение около нормы', () => {
    stubSessions(uniform());
    const ratio = computeAcwr();
    expect(ratio).not.toBeNull();
    expect(Number.isFinite(ratio as number)).toBe(true);
    expect(ratio as number).toBeGreaterThan(0.5);
    expect(ratio as number).toBeLessThan(1.5);
  });

  it('резкий скачок в последнюю неделю → зона риска (> 1.5), а не 1', () => {
    stubSessions([
      ...Array.from({ length: 25 }, (_, i) => ({ date: iso(i), sRPE: 7, durationMin: 60 })),
      { date: iso(25), sRPE: 10, durationMin: 200 },
      { date: iso(26), sRPE: 10, durationMin: 200 },
      { date: iso(27), sRPE: 10, durationMin: 200 },
    ]);
    const ratio = computeAcwr();
    expect(ratio).not.toBeNull();
    expect(ratio as number).toBeGreaterThan(1.5);
  });
});

describe('ядро P3-5: `null` в потребителях не превращается в 0', () => {
  it('рекомендация тапера: без ACWR нет ложного «недогруза»', () => {
    const rec = recommendBBTaperConfig({ fatigue: 30, acwrRatio: null, baseWeeksOut: 3 });
    expect(rec.weeksOut).toBe(3);
    expect(rec.volumeMult).toBe(1);
    expect(rec.reasons.some(r => /недогруз/i.test(r))).toBe(false);
  });

  it('рекомендация тапера: измеренный низкий ACWR по-прежнему сокращает taper', () => {
    const rec = recommendBBTaperConfig({ fatigue: 30, acwrRatio: 0.6, baseWeeksOut: 3 });
    expect(rec.weeksOut).toBe(2);
    expect(rec.reasons.some(r => /недогруз/i.test(r))).toBe(true);
  });

  it('сборка плана без sRPE-данных не пишет ACWR-строк в rationale', () => {
    stubSessions([]);
    const plan = buildBBPlan({
      patternId: 'upper_lower_4',
      level: 'intermediate',
      trainingYears: 3,
      goal: 'mass',
      weeks: 8,
      workMax: { chest: 100, back: 120, legs: 140, shoulders: 70, arms: 50 },
      equipment: ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight'],
      volumeGoal: 'mav',
    } as BBBuilderInput);
    const rationale = (plan.rationale || []).join('\n');
    expect(/ACWR/.test(rationale)).toBe(false);
    expect(/null|NaN|undefined/.test(rationale)).toBe(false);
  });
});
