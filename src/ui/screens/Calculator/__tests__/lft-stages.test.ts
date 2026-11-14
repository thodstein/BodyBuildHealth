/**
 * lft-stages.test.ts — проход 57: «печёночная токсичность» была одним словом с
 * тремя числами и двумя действиями. Женщина в печати получала «немедленная
 * отмена ААС» на 78 (2.5×ВГН), женский протокол — «отмена оралов» на 93 (3×), а
 * мужчина — «отмену всего» на 200 (5×). Флоор риска у мужчины стоял на 5×ВГН, у
 * женщины на 3×ВГН.
 *
 * Контракт после прохода: ступени — `LFT_STAGES` / `LFT_STAGE_ULN`, действие
 * названо, числа считаются от ВГН пола:
 *   2×ВГН — снизить/пересмотреть орал (♂ 80 / ♀ 62)
 *   3×ВГН — отмена оралов (17α)         (♂ 120 / ♀ 93)
 *   5×ВГН — отмена всего + гепатолог    (♂ 200 / ♀ 155)
 * Сигнал 2.5×ВГН (`LFT_SIGNAL_ULN`: ♂ 100 / ♀ 78) курс сам по себе не отменяет —
 * он про повтор анализа и TUDCA.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  LFT_ULN, LFT_STAGES, LFT_STAGE_ULN, LFT_SIGNAL_ULN, FEMALE_ALT_2_5_ULN,
} from '../../../../engines/lab-norms.engine';
import { clinicalFloorsForLabs } from '../../../../engines/risk-engine-tz-spec';
import { VERIFICATION_SYSTEMS, floorThreshold } from '../../../../engines/risk-verification.engine';
import { getAllRules } from '../../../../engines/notification-engine';

const src = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

describe('LFT_STAGES: одна шкала действий, числа от ВГН пола', () => {
  it('ступени 2× / 3× / 5× и абсолютные значения (♂ 80/120/200, ♀ 62/93/155)', () => {
    expect(LFT_STAGES).toEqual({ reduce: 2, stopOral: 3, stopAll: 5 });
    expect(LFT_STAGE_ULN.reduce).toEqual({ male: LFT_ULN.ALT.male * 2, female: LFT_ULN.ALT.female * 2 });
    expect(LFT_STAGE_ULN.stopOral).toEqual({ male: 120, female: 93 });
    expect(LFT_STAGE_ULN.stopAll).toEqual({ male: 200, female: 155 });
  });

  it('2.5×ВГН — сигнал (♂ 100 / ♀ 78), а не ступень отмены', () => {
    expect(LFT_SIGNAL_ULN).toEqual({ male: 100, female: 78 });
    expect(FEMALE_ALT_2_5_ULN).toBe(LFT_SIGNAL_ULN.female);
    expect(LFT_SIGNAL_ULN.female).toBeLessThan(LFT_STAGE_ULN.stopOral.female);
    expect(LFT_SIGNAL_ULN.male).toBeLessThan(LFT_STAGE_ULN.stopOral.male);
  });
});

describe('печать протокола для врача: ступени, а не одно число', () => {
  it('строки берутся из LFT_STAGE_ULN, «сигнал» назван сигналом', () => {
    const t = src('src/ui/components/ProtocolExport.tsx');
    expect(t).toContain('LFT_STAGE_ULN');
    expect(t).toContain('сигнал гепатотоксичности');
    expect(t).toContain('отмена оралов');
    expect(t).not.toContain('немедленная отмена ААС, повторить анализ через 7 дней');
  });
});

describe('риск-движки: те же ступени, что в печати', () => {
  it('clinicalFloorsForLabs — три ступени у обоих полов', () => {
    const cases = [
      { value: 130, sex: 'male' as const, level: 40 },
      { value: 210, sex: 'male' as const, level: 50 },
      { value: 100, sex: 'female' as const, level: 40 },
      { value: 160, sex: 'female' as const, level: 50 },
    ];
    for (const c of cases) {
      const floors = clinicalFloorsForLabs({ ALT: c.value }, c.sex);
      expect(floors.some(f => f.organId === 'hepatic' && f.level === c.level), `${c.sex} ALT ${c.value}`).toBe(true);
    }
    expect(clinicalFloorsForLabs({ ALT: 81 }, 'male').some(f => f.level === 25)).toBe(true);
    expect(clinicalFloorsForLabs({ ALT: 63 }, 'female').some(f => f.level === 25)).toBe(true);
  });

  it('risk-verification.engine — floors берутся из LFT_STAGE_ULN (нет литералов 200/93)', () => {
    const hep = VERIFICATION_SYSTEMS.find(s => s.id === 'hepatic')!;
    const pairs = hep.floors.map(f => [floorThreshold(f, 'male'), floorThreshold(f, 'female')]);
    for (const stage of ['reduce', 'stopOral', 'stopAll'] as const) {
      expect(pairs).toContainEqual([LFT_STAGE_ULN[stage].male, LFT_STAGE_ULN[stage].female]);
    }
  });

  it('уведомления называют обе ступени, а не «при росте — стоп»', () => {
    const rules = getAllRules();
    const fem = rules.find(r => r.id === 'alt_critical_female')!;
    expect(fem.message).toContain(String(LFT_STAGE_ULN.stopOral.female));
    expect(fem.message).toContain(String(LFT_STAGE_ULN.stopAll.female));
    const male = rules.find(r => r.id === 'alt_critical')!;
    expect(male.message).toContain(String(LFT_STAGE_ULN.stopOral.male));
    expect(male.message).toContain(String(LFT_STAGE_ULN.stopAll.male));
  });

  it('системная панель печени печатает все три ступени', () => {
    const p = src('src/ui/screens/Calculator/CalcSystemPanel.tsx');
    expect(p).toContain('LFT_STAGE_ULN.reduce');
    expect(p).toContain('LFT_STAGE_ULN.stopOral');
    expect(p).toContain('LFT_STAGE_ULN.stopAll');
    expect(p).toContain('отмена оралов');
  });
});
