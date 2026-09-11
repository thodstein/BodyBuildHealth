/**
 * tempo-canon.test.ts — TEMPO-REP PRO, эпики A+B (14 тестов).
 */
import { describe, it, expect } from 'vitest';
import {
  TEMPO_CANON,
  TEMPO_PRESET_LIST,
  repSecsOf,
  parseTempoCanon,
  isValidTempoCanon,
  formatTempoCanon,
  tutSecsForTempo,
  tutZoneForSecs,
  tempoForExerciseName,
  goalPreviewFor,
} from '../tempo-canon.engine';
import { isKvExcludedKey } from '../../core/cloud-kv';

describe('tempo-canon: эпик A — канон и парсер', () => {
  it('все ростовые дефолты внутри 2–8с/повт (S1-инвариант)', () => {
    for (const p of TEMPO_PRESET_LIST.filter((x) => x.growth)) {
      const s = repSecsOf(p.tempo);
      expect(s, p.id).toBeGreaterThanOrEqual(2);
      expect(s, p.id).toBeLessThanOrEqual(8);
    }
  });

  it('technique/rehab помечены growth:false (>8с — контроль, не рост)', () => {
    const tech = TEMPO_PRESET_LIST.find((x) => x.id === 'technique')!;
    const rehab = TEMPO_PRESET_LIST.find((x) => x.id === 'rehab')!;
    expect(tech.growth).toBe(false);
    expect(rehab.growth).toBe(false);
    expect(repSecsOf(tech.tempo)).toBeGreaterThan(8);
    expect(repSecsOf(rehab.tempo)).toBeGreaterThan(8);
  });

  it('парсер понимает X (взрывная концентрика)', () => {
    const t = parseTempoCanon('2-0-X-0')!;
    expect(t).not.toBeNull();
    expect(t.explosive).toBe(true);
    expect(t.ecc).toBe(2);
    expect(t.notation).toBe('2-0-X-0');
  });

  it('парсер понимает строчную x и пробелы', () => {
    expect(parseTempoCanon(' 3-1-x-0 ')?.explosive).toBe(true);
  });

  it('мусор → null (не 4 части, буквы, отрицательные)', () => {
    expect(parseTempoCanon('3-1-1')).toBeNull();
    expect(parseTempoCanon('3-1-1-0-2')).toBeNull();
    expect(parseTempoCanon('3-а-1-0')).toBeNull();
    expect(parseTempoCanon('3--1-1-0')).toBeNull();
    expect(parseTempoCanon('3-1-1-100')).toBeNull();
    expect(parseTempoCanon('')).toBeNull();
  });

  it('speed/power-дубль схлопнут: один пресет power', () => {
    const powers = TEMPO_PRESET_LIST.filter((x) => x.goal === 'power');
    expect(powers).toHaveLength(1);
    expect(powers[0].tempo.explosive).toBe(true);
  });

  it('паритет со старым formatTempo: нотация совпадает', () => {
    expect(formatTempoCanon(TEMPO_CANON.hypertrophy_compound)).toBe('3-1-1-0');
    expect(formatTempoCanon(TEMPO_CANON.conditioning)).toBe('1-0-1-0');
  });

  it('isValidTempoCanon гейтит мусор', () => {
    expect(isValidTempoCanon('3-1-1-0')).toBe(true);
    expect(isValidTempoCanon('2-0-X-0')).toBe(true);
    expect(isValidTempoCanon('быстро')).toBe(false);
  });
});

describe('tempo-canon: эпик B — TUT и per-exercise', () => {
  it('3-1-1-0 ×10 = 50с, рабочая зона', () => {
    const r = tutSecsForTempo('3-1-1-0', 10)!;
    expect(r.perRep).toBe(5);
    expect(r.perSet).toBe(50);
    expect(tutZoneForSecs(r.perSet, r.perRep).zone).toBe('work');
  });

  it('X считается как 1с + intent-флаг', () => {
    const r = tutSecsForTempo('2-0-X-0', 5)!;
    expect(r.perRep).toBe(3);
    expect(r.intent).toBe(true);
  });

  it('сеты умножают тотал; мусор → null', () => {
    expect(tutSecsForTempo('3-1-1-0', 10, 3)?.total).toBe(150);
    expect(tutSecsForTempo('мусор', 10)).toBeNull();
    expect(tutSecsForTempo('3-1-1-0', 0)).toBeNull();
  });

  it('зоны: <20 сила, >70 выносливость', () => {
    expect(tutZoneForSecs(12).zone).toBe('strength');
    expect(tutZoneForSecs(90).zone).toBe('endurance');
  });

  it('warn при повторе >8с', () => {
    const z = tutZoneForSecs(100, 10);
    expect(z.warn).toContain('>8с');
    expect(tutZoneForSecs(50, 5).warn).toBeNull();
  });

  it('goalPreviewFor: превью строго из канона', () => {
    expect(goalPreviewFor('hypertrophy')).toEqual({
      compound: TEMPO_CANON.hypertrophy_compound.notation,
      isolation: TEMPO_CANON.hypertrophy_isolation.notation,
    });
    expect(goalPreviewFor('hypertrophy').compound).toBe('3-1-1-0');
    expect(goalPreviewFor('hypertrophy').isolation).toBe('3-2-1-0');
    expect(goalPreviewFor('strength').compound).toBe('2-0-X-0');
    expect(goalPreviewFor('неизвестно-что').compound).toBe(TEMPO_CANON.technique.notation);
  });

  it('П4: ключи хаба синкаются облаком (не в исключениях cloud-kv)', () => {
    expect(isKvExcludedKey('he_tempo_prev_v1')).toBe(false);
    expect(isKvExcludedKey('he_tempo_hub_v1')).toBe(false);
  });

  it('override: румынская → 3-1-1-0, неизвестное → fallback estimated', () => {
    const hit = tempoForExerciseName('Румынская тяга со штангой');
    expect(hit.notation).toBe('3-1-1-0');
    expect(hit.estimated).toBe(false);
    const miss = tempoForExerciseName('Неизвестное упражнение 42');
    expect(miss.estimated).toBe(true);
    expect(miss.notation).toBe('3-1-1-0');
  });
});
