/**
 * ck-mb-active-unit.test.ts — проход 185: КФК-МВ судится в единице лабораторий РФ.
 *
 * Класс дефекта: каталог хранил массу (нг/мл, ВГН 5), а лестница ступеней была
 * подписана активностью (U/L), но держала массовые числа 5/10/25. Один бланк
 * получал два разных ответа: «КФК-МВ 30 Ед/л» (обычное повышение после тренировки
 * или инъекции) читалось как «инфаркт, ER» по массовой шкале, а «5 нг/мл» — как
 * норма; из формы анализ не получал ни ступени, ни совета вовсе.
 *
 * Российские лаборатории печатают КФК-МВ в Ед/л с ВГН 24–25. Канон и шкала
 * переведены в Ед/л; ступени — те же кратности ВГН 1×/2×/5× (24/48/120), что были
 * у массовой шкалы, поэтому новых клинических чисел нет. Масса (нг/мл) — другой
 * способ измерения, она честно уходит в «не прочитано», а не сравнивается с нормой
 * в чужой единице. Совет больше не обещает инфаркт: КФК-МВ без тропонина не
 * судится, а на курсе ААС его повышают и тренировки, и внутримышечные инъекции.
 */
import { describe, it, expect } from 'vitest';
import { ucumInfo } from '../../core/constants';
import { unitsIncommensurable } from '../../core/labs-mapping';
import { LAB_TIERS, deriveTier } from '../lab-tier-ranges';
import { computeTierAdjustments } from '../lab-tier-recommendations';
import { readFlatLabs } from '../../engines/support-plan/engine-helpers';
import { computeMarkerDeviations } from '../../ui/screens/LabsScreen_parts/lab-marker-risks';

describe('проход 185: КФК-МВ в Ед/л', () => {
  it('каталог и лестница — одна величина, одна единица', () => {
    const info = ucumInfo('CK_MB')!;
    const row = LAB_TIERS.CK_MB;
    expect(info.prefUnit).toBe('Е/л');
    expect(info.uln).toBe(24);
    expect(row.unit).toBe('Е/л');
    expect(unitsIncommensurable(info.prefUnit, row.unit)).toBe(false);
  });

  it('ступени — кратности ВГН, а не новые числа', () => {
    const uln = ucumInfo('CK_MB')!.uln;
    const row = LAB_TIERS.CK_MB;
    expect(row.normal).toEqual([0, uln]);
    expect(row.borderline).toEqual([uln, uln * 2]);
    expect(row.treatment).toEqual([uln * 2, uln * 5]);
    expect(row.emergencyHigh).toBe(uln * 5);
  });

  it('30 Ед/л — грань, 60 — лечение, 150 — экстренно', () => {
    expect(deriveTier('CK_MB', 20, 'male')).toBe(0);
    expect(deriveTier('CK_MB', 30, 'male')).toBe(1);
    expect(deriveTier('CK_MB', 60, 'male')).toBe(2);
    expect(deriveTier('CK_MB', 150, 'male')).toBe(3);
  });

  it('совет говорит про тропонин и не ставит диагноз «инфаркт»', () => {
    const step2 = computeTierAdjustments({ CK_MB: 60 }, 'male');
    expect(step2.tierSummary.map(s => s.marker)).toContain('CK_MB');
    const text2 = step2.nutrition.map(x => `${x.action} ${x.target}`).join(' ').toLowerCase();
    expect(text2).toContain('тропонин');

    const step3 = computeTierAdjustments({ CK_MB: 150 }, 'male');
    const alert = step3.alerts.map(a => a.message).join(' ');
    expect(alert).toContain('Ед/л');
    expect(alert).not.toMatch(/U\/L/);
    expect(alert.toLowerCase()).not.toContain('инфаркт');
  });

  it('масса не выдаётся за активность: не прочитано и без вывода', () => {
    const flat = readFlatLabs([{ code: 'CK_MB', value: 5, unit: 'нг/мл' }]);
    expect(flat.values.CK_MB).toBeUndefined();
    expect(flat.unread).toEqual([{ code: 'CK_MB', value: 5, unit: 'нг/мл' }]);
    const dev = computeMarkerDeviations([{ code: 'CK_MB', value: 5, unit: 'нг/мл' }], 'male');
    expect(dev.markerDeviations).toEqual([]);
    expect(dev.unknown).toEqual([{ code: 'CK_MB', value: 5, bound: undefined, reason: 'unit' }]);
  });
});
