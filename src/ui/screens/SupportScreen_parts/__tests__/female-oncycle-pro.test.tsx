/**
 * female-oncycle-pro.test.tsx — раунд «Женские проблемы на курсе» (железо/цикл/кости/RED-S).
 *
 * Э1: табы «🩸 Железо и ферритин» и «🦴 Цикл, кости, RED-S», FG-шкала в «Вирилизацию»,
 * уро-блок, AMH, ферритин/TSAT в лабах.
 * Э2 (данные): протоколы «Железо (по анализам)» и «Кости (Ca/D3/K2/Mg)».
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { SupportProtocolWomen } from '../supportProtocolWomen';
import {
  FEMALE_IRON_THRESHOLDS, FEMALE_IRON_SCHEME, FEMALE_IRON_DIAGNOSTICS, FEMALE_IRON_GATES,
  FEMALE_AMENORRHEA_ALGO, FEMALE_BONE_HONESTY, FEMALE_REDS_SIGNS, redsTrafficLight,
  FEMALE_UROGENITAL_SUPPORT, FERRIMAN_GALLWEY_ZONES, ferrimanGallweyTotal, ferrimanGallweyBand,
  FEMALE_LAB_GROUPS, FEMALE_FERTILITY_PLAN, FEMALE_TIMELINE, FEMALE_SUPPORT_PROTOCOLS,
} from '../supportProtocolWomenData';

afterEach(cleanup);

const P = () => render(<SupportProtocolWomen s={{}} />);

describe('iron: данные', () => {
  it('пороги атлеток: <30 дефицит, 30–50 функциональный, >100 достаточно, TSAT<20, CRP-оговорка', () => {
    expect(FEMALE_IRON_THRESHOLDS.length).toBe(6);
    const all = FEMALE_IRON_THRESHOLDS.map((x) => `${x.band} ${x.value} ${x.meaning} ${x.action}`).join(' ');
    for (const needle of ['<30', '30–50', '>100', 'TSAT', '<20%', 'CRP']) {
      expect(all, needle).toContain(needle);
    }
  });
  it('схема: 40–60 мг/сут ИЛИ 60–100 мг через день, бисглицинат, вит. C, разнос, контроль 4–8 нед', () => {
    const all = FEMALE_IRON_SCHEME.map((r) => `${r.name} ${r.dose} ${r.timing} ${r.note}`).join(' ');
    for (const needle of ['40–60', '60–100', 'через день', 'бисглицинат', 'Витамин C', '1–2 ч', '4–8 нед']) {
      expect(all, needle).toContain(needle);
    }
  });
  it('гейты: HCT≥48 — стоп, Hb<100 — врач, без анализов — нет, в/в — только врач', () => {
    expect(FEMALE_IRON_GATES.map((g) => g.id)).toEqual(['hct48', 'hb100', 'no_blind', 'iv_only']);
    const stops = FEMALE_IRON_GATES.filter((g) => g.level === 'stop').map((g) => g.text).join(' ');
    expect(stops).toContain('HCT ≥48');
    expect(stops).toContain('на всякий случай');
    const doctor = FEMALE_IRON_GATES.filter((g) => g.level === 'doctor').map((g) => g.text).join(' ');
    expect(doctor).toContain('<100');
    expect(doctor).toContain('только клиника');
  });
  it('диагностика: ОАК/ферритин/TSAT/CRP + частота', () => {
    expect(FEMALE_IRON_DIAGNOSTICS.length).toBe(5);
    const all = FEMALE_IRON_DIAGNOSTICS.map((d) => d.what + ' ' + d.action).join(' ');
    for (const needle of ['ОАК', 'Ферритин', 'TSAT', 'CRP', '8–12 нед']) expect(all, needle).toContain(needle);
  });
});

describe('cycle/bones/RED-S: данные', () => {
  it('аменорея: беременности-тест первым → панель → >3 мес врач → >6 мес/BSI DXA z-score → последовательные циклы', () => {
    expect(FEMALE_AMENORRHEA_ALGO.length).toBe(6);
    expect(FEMALE_AMENORRHEA_ALGO[0].step).toContain('беременности');
    const all = FEMALE_AMENORRHEA_ALGO.map((x) => x.step + ' ' + x.action).join(' ');
    for (const needle of ['E2', 'FSH', 'LH', 'PRL', 'ТТГ', '>3 мес', '>6 мес', 'BSI', 'z-score', 'последовательные', 'КОК']) {
      expect(all, needle).toContain(needle);
    }
  });
  it('честность костей: КОК не улучшают BMD, z-score, энергобаланс', () => {
    const all = FEMALE_BONE_HONESTY.join(' ');
    expect(all).toContain('КОК');
    expect(all).toContain('BMD');
    expect(all).toContain('z-score');
    expect(all).toContain('энергобаланс');
  });
  it('RED-S: 6 признаков, 3 первичных (Triad-2025), без EA-порогов', () => {
    expect(FEMALE_REDS_SIGNS.length).toBe(6);
    expect(FEMALE_REDS_SIGNS.filter((s) => s.primary).length).toBe(3);
    const all = FEMALE_REDS_SIGNS.map((s) => s.label).join(' ');
    expect(all).toContain('Менструальные');
    expect(all).toContain('BSI');
    expect(all).toContain('РПП');
  });
  it('RED-S светофор: пусто → green, 1 признак → yellow, 2 первичных → red', () => {
    expect(redsTrafficLight({}).level).toBe('green');
    expect(redsTrafficLight({ amenorrhea: true }).level).toBe('yellow');
    expect(redsTrafficLight({ amenorrhea: true, bsi: true }).level).toBe('red');
    // 1 первичный + 2 вторичных → red (кумуляция)
    expect(redsTrafficLight({ amenorrhea: true, low_bmi: true, stress: true }).level).toBe('red');
    const red = redsTrafficLight({ bsi: true, weight_loss_rpp: true });
    expect(red.label).toContain('RED-S');
    expect(red.advice).toContain('энергобаланс');
    expect(red.positive.length).toBe(2);
  });
  it('уро-блок: лубриканты/гигиена/D-манноза/пробиотик/локальный эстроген (врач)', () => {
    expect(FEMALE_UROGENITAL_SUPPORT.length).toBe(5);
    const all = FEMALE_UROGENITAL_SUPPORT.map((r) => r.name + ' ' + r.note).join(' ');
    for (const needle of ['лубрикант', 'Гигиена', 'D-манноза', 'Пробиотик', 'эстроген']) {
      expect(all.toLowerCase(), needle).toContain(needle.toLowerCase());
    }
    const estriol = FEMALE_UROGENITAL_SUPPORT.find((r) => r.name.includes('эстроген'))!;
    expect(estriol.dose).toContain('ВРАЧ');
  });
  it('лабы: ферритин с атлетическими порогами + строка TSAT', () => {
    const rows = FEMALE_LAB_GROUPS.flatMap((g) => g.rows);
    const ferritin = rows.find((r) => r.marker === 'Ферритин')!;
    expect(ferritin.normal).toContain('<30');
    expect(ferritin.normal).toContain('30–50');
    expect(ferritin.normal).toContain('>100');
    const tsat = rows.find((r) => r.marker.includes('TSAT'))!;
    expect(tsat.normal).toContain('20–45%');
    expect(tsat.symptom!).toContain('<20%');
  });
  it('фертильность: AMH-строка до курса; таймлайн: аменорея >3 мес с тестом беременности', () => {
    const fert = FEMALE_FERTILITY_PLAN.map((x) => x.when + ' ' + x.action).join(' ');
    expect(fert).toContain('AMH');
    const off = FEMALE_TIMELINE.find((p) => p.id === 'off')!;
    const amenorrhea = off.rows.find((r) => r.what.includes('Аменорея >3 мес'))!;
    expect(amenorrhea).toBeTruthy();
    expect(amenorrhea.action).toContain('БЕРЕМЕННОСТИ');
    const dxa = off.rows.find((r) => r.action.includes('DXA'))!;
    expect(dxa.action).toContain('z-score');
  });
  it('Э2-протоколы: «Железо (по анализам)» с гейтом HCT≥48 и «Кости (Ca/D3/K2/Mg)»', () => {
    const iron = FEMALE_SUPPORT_PROTOCOLS.find((p) => p.id === 'iron')!;
    expect(iron.indication).toContain('<30');
    expect(iron.indication).toContain('HCT <48');
    expect(iron.footer!).toContain('HCT ≥48%');
    expect(iron.rows.map((r) => r.dose).join(' ')).toContain('60–100');
    const bones = FEMALE_SUPPORT_PROTOCOLS.find((p) => p.id === 'bones')!;
    const bonesAll = bones.rows.map((r) => `${r.name} ${r.dose} ${r.note}`).join(' ');
    for (const needle of ['Кальций', '1000–1500', 'D3', 'K2', 'Магний']) expect(bonesAll, needle).toContain(needle);
    expect(bones.footer!).toContain('КОК');
  });
});

describe('FG-шкала (Ферриман–Голлвей)', () => {
  it('9 зон; сумма клампится 0–4 на зону и игнорирует мусор', () => {
    expect(FERRIMAN_GALLWEY_ZONES.length).toBe(9);
    expect(new Set(FERRIMAN_GALLWEY_ZONES.map((z) => z.id)).size).toBe(9);
    expect(ferrimanGallweyTotal([4, 4, 4, 4, 4, 4, 4, 4, 4])).toBe(36);
    expect(ferrimanGallweyTotal([9, -3, 2, NaN as any, undefined, null, 1, 1, 1])).toBe(4 + 0 + 2 + 0 + 0 + 0 + 1 + 1 + 1);
    expect(ferrimanGallweyTotal([])).toBe(0);
    expect(ferrimanGallweyTotal(null as any)).toBe(0);
  });
  it('пороги: ≤5 норма, 6–8 погранично, >8 гирсутизм; менее чувствительный порог >6', () => {
    expect(ferrimanGallweyBand(0).level).toBe('ok');
    expect(ferrimanGallweyBand(5).level).toBe('ok');
    expect(ferrimanGallweyBand(6).level).toBe('borderline');
    expect(ferrimanGallweyBand(8).level).toBe('borderline');
    expect(ferrimanGallweyBand(9).level).toBe('hirsutism');
    expect(ferrimanGallweyBand(9).advice).toContain('врач');
    expect(ferrimanGallweyBand(7, { lessSensitiveCutoff: true }).level).toBe('hirsutism');
  });
});

describe('Э1: UI — новые табы и FG-шкала', () => {
  it('таб «🩸 Железо и ферритин»: гейты, пороги, схема, диагностика', () => {
    const { container, getByText } = P();
    fireEvent.click(getByText('🩸 Железо и ферритин'));
    for (const needle of ['ГЕЙТЫ ЖЕЛЕЗА НА КУРСЕ', 'HCT ≥48', 'TSAT', 'через день', '60–100', 'Диагностика и контроль']) {
      expect(container.textContent, needle).toContain(needle);
    }
  });
  it('таб «🦴 Цикл, кости, RED-S»: алгоритм, светофор, кости, уро-блок', () => {
    const { container, getByText } = P();
    fireEvent.click(getByText('🦴 Цикл, кости, RED-S'));
    for (const needle of ['Тест беременности — ПЕРВЫМ', 'DXA', 'z-score', 'КОК', 'RED-S', 'Урогенитальное', 'D-манноза']) {
      expect(container.textContent, needle).toContain(needle);
    }
  });
  it('RED-S светофор живой: 1 признак → жёлтый, 2 первичных → красный', () => {
    const { container, getByText, getByLabelText } = P();
    fireEvent.click(getByText('🦴 Цикл, кости, RED-S'));
    fireEvent.click(getByLabelText(/Менструальные нарушения/));
    expect(container.querySelector('[data-reds="result"]')!.textContent).toContain('Пограничная зона');
    fireEvent.click(getByLabelText(/Костные стресс-повреждения/));
    expect(container.querySelector('[data-reds="result"]')!.textContent).toContain('Высокий риск RED-S');
  });
  it('FG-шкала в «Вирилизации»: клик по зонам обновляет итог и порог >8', () => {
    const { container, getByLabelText } = P();
    expect(container.querySelector('[data-fg="result"]')!.textContent).toContain('Норма: 0');
    // 9 зон × 1 = 9 > 8 → гирсутизм
    for (const [zone, n] of [
      ['Верхняя губа', 1], ['Подбородок', 1], ['Грудь', 1], ['Верх живота', 1], ['Низ живота', 1],
      ['Верх рук', 1], ['Верх спины', 1], ['Поясница', 1], ['Бёдра', 1],
    ] as Array<[string, number]>) {
      fireEvent.click(getByLabelText(`${zone}: ${n}`));
    }
    const res = container.querySelector('[data-fg="result"]')!.textContent || '';
    expect(res).toContain('Итог: 9');
    expect(res).toContain('Гирсутизм');
  });
});
