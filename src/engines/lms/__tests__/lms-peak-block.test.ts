/**
 * lms-peak-block.test.ts — раскладка пик-блока ПЛ по окну «недель до старта».
 * A1: «Недель до старта» = окно блока (вход в пик + mock + глубокий тапер + соревнования [+ пост]).
 */
import { describe, expect, it } from 'vitest';
import { buildPLPeakBlockLayout } from '../lms-peak-block.engine';

describe('buildPLPeakBlockLayout', () => {
  it('окно 8, глубокий тапер 2, mock+meet+post: вход 4 + mock 1 + тапер 2 + соревнования 1 + пост 1', () => {
    const l = buildPLPeakBlockLayout({ windowWeeks: 8, taperWeeks: 2, mockMeet: true, meetWeek: true, postMeet: true });
    expect(l.windowWeeks).toBe(8);
    expect(l.rampWeeks).toBe(4);   // 8 - 1(mock) - 1(meet) - 2(taper)
    expect(l.taperWeeks).toBe(2);
    expect(l.totalWeeks).toBe(9);  // окно + пост
    expect(l.warnings).toEqual([]);
    expect(l.curve.length).toBe(6); // ramp 4 + taper 2
    expect(l.summary).toContain('вход 4');
    expect(l.summary).toContain('mock 1');
    expect(l.summary).toContain('тапер 2');
    expect(l.summary).toContain('соревнования 1');
    expect(l.summary).toContain('пост 1');
  });

  it('окно 8 без mock и meet: вся кривая = ramp + taper, блока 8', () => {
    const l = buildPLPeakBlockLayout({ windowWeeks: 8, taperWeeks: 2 });
    expect(l.rampWeeks).toBe(6);
    expect(l.taperWeeks).toBe(2);
    expect(l.totalWeeks).toBe(8);
    expect(l.curve.length).toBe(8);
  });

  it('окно короче глубокого тапера: тапер урезан до окна + предупреждение', () => {
    const l = buildPLPeakBlockLayout({ windowWeeks: 3, taperWeeks: 4, mockMeet: true, meetWeek: true });
    // доступно = 3 - 1 - 1 = 1 → тапер урезан до 1
    expect(l.taperWeeks).toBe(1);
    expect(l.rampWeeks).toBe(0);
    expect(l.warnings.length).toBeGreaterThan(0);
    expect(l.warnings[0]).toContain('длиннее окна');
  });

  it('окно = глубокому таперу (без mock/meet): вход отсутствует', () => {
    const l = buildPLPeakBlockLayout({ windowWeeks: 3, taperWeeks: 3 });
    expect(l.rampWeeks).toBe(0);
    expect(l.taperWeeks).toBe(3);
    expect(l.totalWeeks).toBe(3);
  });

  it('окно 1: минимальный блок (1 неделя тапера)', () => {
    const l = buildPLPeakBlockLayout({ windowWeeks: 1, taperWeeks: 4 });
    expect(l.windowWeeks).toBe(1);
    expect(l.taperWeeks).toBe(1);
    expect(l.totalWeeks).toBe(1);
  });

  it('весовая цель lose снижает объём кривой (×0.9)', () => {
    const a = buildPLPeakBlockLayout({ windowWeeks: 6, taperWeeks: 2, weightGoal: 'maintain' });
    const b = buildPLPeakBlockLayout({ windowWeeks: 6, taperWeeks: 2, weightGoal: 'lose' });
    // Последняя точка (глубокий тапер) у lose ниже.
    const lastA = a.curve[a.curve.length - 1].volumePct;
    const lastB = b.curve[b.curve.length - 1].volumePct;
    expect(lastB).toBeLessThan(lastA);
  });

  it('ramp-кривая: объём от ~1.0 плавно падает, интенсивность сохранена, RIR без сдвига', () => {
    const l = buildPLPeakBlockLayout({ windowWeeks: 8, taperWeeks: 2 });
    const ramp = l.curve.slice(0, 6);
    expect(ramp[0].volumePct).toBeCloseTo(1, 2);
    expect(ramp[ramp.length - 1].volumePct).toBeLessThan(0.9);
    for (const pt of ramp) {
      expect(pt.intensityMode).toBe('preserve');
      expect(pt.rirShift).toBe(0);
    }
  });

  it('тайпер-часть кривой заканчивается самой глубокой точкой (финал — минимум объёма)', () => {
    const l = buildPLPeakBlockLayout({ windowWeeks: 8, taperWeeks: 2 });
    const vols = l.curve.map(p => p.volumePct);
    expect(vols[vols.length - 1]).toBeLessThan(vols[vols.length - 2]);
  });

  it('недели окна клампятся к 1..52', () => {
    expect(buildPLPeakBlockLayout({ windowWeeks: 0, taperWeeks: 2 }).windowWeeks).toBe(1);
    expect(buildPLPeakBlockLayout({ windowWeeks: 99, taperWeeks: 2 }).windowWeeks).toBe(52);
  });

  it('wholeWindowAsTaper: весь окно = непрерывный тапер (без входа в пик)', () => {
    const l = buildPLPeakBlockLayout({ windowWeeks: 8, taperWeeks: 2, wholeWindowAsTaper: true, mockMeet: true, meetWeek: true });
    // доступно = 8 - 1(mock) - 1(meet) = 6 → весь тапер, ramp 0
    expect(l.rampWeeks).toBe(0);
    expect(l.taperWeeks).toBe(6);
    expect(l.curve.length).toBe(6);
    expect(l.curve[0].label).not.toContain('Вход в пик');
    // Кривая плавно падает к финалу.
    expect(l.curve[l.curve.length - 1].volumePct).toBeLessThan(l.curve[0].volumePct);
  });

  it('wholeWindowAsTaper для classic на 8 нед: кривая длинная (более 4 точек)', () => {
    const l = buildPLPeakBlockLayout({ windowWeeks: 8, taperWeeks: 2, wholeWindowAsTaper: true });
    expect(l.taperWeeks).toBe(8);
    expect(l.curve.length).toBe(8);
  });
});
