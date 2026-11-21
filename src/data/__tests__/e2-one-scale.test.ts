/**
 * e2-one-scale.test.ts — проход 187: у эстрадиола мужчины один ряд порогов.
 *
 * Класс дефекта: один анализ судился двумя тройками. Лестница ступеней
 * (`LAB_TIERS.E2`) держала 40/60/100 пг/мл и по ней же выбирались советы (AI
 * титрацией, затем SERM при гинекомастии), а механизм-ориентированная модель и
 * верификация — 40/55/80. Один бланк «E2 90 пг/мл» получал «лечение» в лестнице
 * и m=3 (максимальное отклонение) в модели: два разных ответа на один анализ.
 *
 * Источник оставлен один — клиническая лестница на курсе ААС: цель 20–40 пг/мл,
 * усиление AI с 60, гинекомастия с 100. Дозировочный справочник тоже читал
 * собственные числа и путал пг/мл с пмоль/л («старт при >80 пмоль/л» = 21.8 пг/мл,
 * то есть на нижней половине цели). Теперь он печатает цель из того же ряда.
 */
import { describe, it, expect } from 'vitest';
import { LAB_TIERS, deriveTier } from '../lab-tier-ranges';
import { E2_MALE_BAND, E2_PG_TO_PMOL } from '../../engines/lab-norms.engine';
import { VERIFICATION_SYSTEMS, markerThresholds } from '../../engines/risk-verification.engine';
import { getMiFromLab } from '../../engines/risk-engine-tz-spec';
import { EVIDENCE_DOSAGES } from '../evidence-dosage-db';

const e2Marker = () =>
  VERIFICATION_SYSTEMS.flatMap((s) => s.mechanisms).find((m) => m.id === 'rep4')!.markers.find((m) => m.code === 'E2')!;

describe('проход 187: E2 — один ряд порогов', () => {
  it('лестница, модель и верификация держат одну тройку', () => {
    const row = LAB_TIERS.E2;
    expect(row.normal).toEqual([20, 40]);
    expect(row.borderline).toEqual([40, 60]);
    expect(row.treatment).toEqual([60, 100]);
    expect(row.emergencyHigh).toBe(100);
    expect([...E2_MALE_BAND.steps]).toEqual([40, 60, 100]);
    expect(markerThresholds(e2Marker(), 'male')).toEqual([40, 60, 100]);
  });

  it('границы модели совпадают с лестницей: 90 — ещё tier 2, не m=3', () => {
    // Старая тройка 40/55/80 давала 90 пг/мл → m=3 при tier 2 в лестнице.
    expect(getMiFromLab('rep4', { E2: 45 })).toBe(1);
    expect(getMiFromLab('rep4', { E2: 90 })).toBe(2);
    expect(getMiFromLab('rep4', { E2: 110 })).toBe(3);
    expect(deriveTier('E2', 30, 'male')).toBe(0);
    expect(deriveTier('E2', 50, 'male')).toBe(1);
    expect(deriveTier('E2', 80, 'male')).toBe(2);
    expect(deriveTier('E2', 150, 'male')).toBe(3);
  });

  it('ряд не вернулся к 55/80', () => {
    const [, t2, t3] = markerThresholds(e2Marker(), 'male');
    expect(t2).not.toBe(55);
    expect(t3).not.toBe(80);
  });

  it('справочник доз печатает цель из ряда, а не свои пмоль/л', () => {
    const a = EVIDENCE_DOSAGES.anastrozole;
    const pmolLow = Math.round(E2_MALE_BAND.targetLow * E2_PG_TO_PMOL);
    const pmolHigh = Math.round(E2_MALE_BAND.steps[0] * E2_PG_TO_PMOL);
    expect(a.duration).toContain('20–40 пг/мл');
    expect(a.duration).toContain(`${pmolLow}–${pmolHigh} пмоль/л`);
    expect(a.notes).toContain('40 пг/мл');
    expect(a.notes).not.toContain('80 пмоль');
  });
});
