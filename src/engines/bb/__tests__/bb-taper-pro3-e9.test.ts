/**
 * bb-taper-pro3-e9.test.ts — PRO-3 Э9 «женский контур»:
 *   менструальный флаг в недельном чек-ине (персист), RED-S-подсказка при ≥2 нед отсутствия,
 *   menstrualFlag в CAT2-скрине (calcRedsCAT2), RED-S-панель лабов (Triad 2025 / IOC CAT2).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadPrepWeekCheckins, savePrepWeekCheckin } from '../bb-prep-weekly-log';
import { PREP_LAB_PANEL } from '../bb-prep-process.engine';
import { calcRedsCAT2 } from '../../metabolic-hub.engine';

describe('PRO-3 Э9 — менструальный флаг в чек-ине', () => {
  beforeEach(() => { try { localStorage.clear(); } catch {} });

  it('сохраняется и читается (roundtrip), старые записи без поля читаются', () => {
    savePrepWeekCheckin('p1', { week: 3, date: '2026-10-01', weightAvg: 70, cycle: 'absent' });
    const list = loadPrepWeekCheckins('p1');
    expect(list).toHaveLength(1);
    expect(list[0].cycle).toBe('absent');
    // legacy-запись без cycle
    savePrepWeekCheckin('p1', { week: 4, date: '2026-10-08', weightAvg: 70.2 });
    expect(loadPrepWeekCheckins('p1').find(e => e.week === 4)!.cycle).toBeUndefined();
  });

  it('флаг поднимает CAT2 до orange (аменорея = primary, IOC)', () => {
    const base = calcRedsCAT2({ ea: 40, sex: 'female' });
    expect(base.light).toBe('yellow'); // только secondary (EA снижена)
    const withFlag = calcRedsCAT2({ ea: 40, sex: 'female', menstrualFlag: true });
    expect(withFlag.light).toBe('orange');
    expect(withFlag.returnToPlay).toMatch(/Ограничение объёма/);
  });
});

describe('PRO-3 Э9 — лаб-панель', () => {
  it('RED-S-маркеры в панели к шоу с пометкой «женщины» и ссылкой на CAT2', () => {
    const reds = PREP_LAB_PANEL.find(l => /RED-S/i.test(l.name));
    expect(reds).toBeTruthy();
    expect(reds!.name).toMatch(/женщины/);
    expect(reds!.why).toMatch(/CAT2|Triad|REDs/i);
    expect(reds!.name).toMatch(/IGF-1|ЛГ|ферритин/i);
  });
});

describe('PRO-3 Э9 — UI source-guard', () => {
  it('чипы цикла 44px, подсказка ≥2 нед, флаг в CAT2-карточке', () => {
    const sec = readFileSync(resolve(__dirname, '..', '..', '..', 'ui', 'screens', 'TrainingScreen_parts', 'bb-contest-prep-sections.tsx'), 'utf8');
    expect(sec).toMatch(/data-bb="wk-cycle"/);
    expect(sec).toMatch(/data-bb="reds-cycle-hint"/);
    expect(sec).toMatch(/menstrualFlag: prepPlan\.sex === 'female' && weeklyLog\[weeklyLog\.length - 1\]\?\.cycle === 'absent'/);
    expect(sec).toMatch(/minHeight:44, minWidth:36/);
  });
});
