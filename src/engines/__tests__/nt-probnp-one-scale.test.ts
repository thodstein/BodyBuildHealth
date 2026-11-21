/**
 * nt-probnp-one-scale.test.ts — проход 184: у NT-proBNP один ряд порогов.
 *
 * Класс дефекта: один анализ жил тремя рядами чисел. Лестница ступеней держала
 * 125/450/1800 пг/мл, механизм-ориентированная модель и верификация —
 * 125/300/900, женский протокол — 125/300, карточка «Анализы» — «>200».
 * Один и тот же бланк «NT-proBNP 1000» получал «лечение» на одном экране и
 * «выраженное отклонение» на другом, а 350 пг/мл попадал в разные ступени.
 *
 * Медицинский источник один: порог исключения 125 пг/мл, подтверждение ХСН —
 * 450 (<50 лет), 900 (50–75), 1800 (>75) пг/мл. Возраста в приложении нет,
 * поэтому берётся самый ранний порог подтверждения 450 — он не пропускает
 * молодого пациента. Возрастная стратификация — подпись, а не второе число.
 */
import { describe, it, expect } from 'vitest';
import { LAB_TIERS, deriveTier } from '../../data/lab-tier-ranges';
import { NT_PROBNP_STEPS } from '../lab-norms.engine';
import { VERIFICATION_SYSTEMS, markerThresholds } from '../risk-verification.engine';
import { getMiFromLab } from '../risk-engine-tz-spec';

const cv1 = () => VERIFICATION_SYSTEMS.flatMap(s => s.mechanisms).find(m => m.id === 'cv1')!;
const ntMarker = () => cv1().markers.find(m => m.code === 'NT_PROBNP')!;

describe('проход 184: NT-proBNP — один ряд порогов', () => {
  it('лестница, модель риска и константа держат одни числа', () => {
    const row = LAB_TIERS.NT_PROBNP;
    expect(row.normal).toEqual([0, 125]);
    expect(row.borderline).toEqual([125, 450]);
    expect(row.treatment).toEqual([450, 1800]);
    expect(row.emergencyHigh).toBe(1800);
    expect(row.unit).toBe('pg/mL');
    expect(markerThresholds(ntMarker())).toEqual([125, 450, 1800]);
    expect([...NT_PROBNP_STEPS]).toEqual([125, 450, 1800]);
  });

  it('ступени: 100 норма, 200 грань, 500 лечение, 2000 экстренно', () => {
    expect(deriveTier('NT_PROBNP', 100, 'male')).toBe(0);
    expect(deriveTier('NT_PROBNP', 200, 'male')).toBe(1);
    expect(deriveTier('NT_PROBNP', 500, 'male')).toBe(2);
    expect(deriveTier('NT_PROBNP', 2000, 'male')).toBe(3);
  });

  it('модель риска читает те же границы (m=1/2/3)', () => {
    expect(getMiFromLab('cv1', { NT_PROBNP: 200 })).toBe(1);
    expect(getMiFromLab('cv1', { NT_PROBNP: 500 })).toBe(2);
    expect(getMiFromLab('cv1', { NT_PROBNP: 2000 })).toBe(3);
  });

  it('ряд не вернулся к 300/900', () => {
    const [t1, t2, t3] = markerThresholds(ntMarker());
    expect(t1).toBe(125);
    expect(t2).not.toBe(300);
    expect(t3).not.toBe(900);
  });
});
