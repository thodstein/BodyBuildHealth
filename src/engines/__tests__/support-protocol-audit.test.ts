/**
 * support-protocol-audit.test.ts — инварианты аудита примерных протоколов БАД (ААС-контекст).
 * Проверяет текстовые инварианты безопасности прямо по исходникам протоколов:
 * дозы-капы, гейты назначений, кросс-лимиты, вес UDCA, лестницу эзетимиб→RYR.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DRUG_INTERACTIONS } from '../../data/drug-interactions';
import { SUPPORT_DOSING } from '../../data/support-dosing';
import {
  PRE_CYCLE_LABS,
  STOP_COURSE_TABLE,
  EVIDENCE_LEGEND,
} from '../../ui/screens/SupportScreen_parts/supportProtocolsShared';

const P = (f: string) =>
  readFileSync(
    resolve(process.cwd(), 'src/ui/screens/SupportScreen_parts', f),
    'utf8',
  );

describe('support-protocol-audit: аспирин-гейт (P0-1)', () => {
  it('кардио: доза 75-100 мг + ссылка на USPSTF/ESC + ИПП', () => {
    const t = P('supportProtocolCardio.tsx');
    expect(t).toContain('75-100 мг');
    expect(t).toContain('USPSTF 2022');
    expect(t).toContain('Обязательно + ИПП');
  });
  it('кардио: донация расписана по Hct + ферритин + регидратация', () => {
    const t = P('supportProtocolCardio.tsx');
    expect(t).toContain('1-2×/нед до Hct <48%');
    expect(t).toContain('ферритин');
    expect(t).toContain('регидратация');
  });
  it('гемато: аспирин только по гейту + клопидогрель через пантопразол', () => {
    const t = P('supportProtocolHemato.tsx');
    expect(t).toContain('ТОЛЬКО при ≥2 факторах тромбориска');
    expect(t).toContain('пантопразол');
  });
  it('гемато: ферритин-мониторинг при флеботомиях', () => {
    const t = P('supportProtocolHemato.tsx');
    expect(t).toContain('Ферритин / ОЖСС');
    expect(t).toContain('реактивный тромбоцитоз');
  });
  it('постцикл и стоимость: аспирин 75-100 + ИПП', () => {
    expect(P('supportProtocolPostCycle.tsx')).toContain('75-100 мг + ИПП');
    expect(P('supportProtocolCost.tsx')).toContain('75-100 мг + ИПП');
  });
});

describe('support-protocol-audit: каберголин (P0-2)', () => {
  it('кап 1 мг 2×/нед, без схемы 2 мг 2×/нед', () => {
    const t = P('supportProtocolProlactin.tsx');
    expect(t).toContain('1 мг 2×/нед');
    expect(t).not.toContain('1-2 мг');
    expect(t).not.toContain('>2 мг/нед');
  });
  it('базовое ЭхоКГ + активный расспрос об импульсивности + ортостаз', () => {
    const t = P('supportProtocolProlactin.tsx');
    expect(t).toContain('базовая');
    expect(t).toContain('АКТИВНО');
    expect(t).toContain('Ортостатическая гипотония');
  });
});

describe('support-protocol-audit: эстрадиол (P0-3)', () => {
  it('нет онкодозы 1 мг/день как схемы в протоколе E2', () => {
    const t = P('supportProtocolE2.tsx');
    expect(t).toContain('НЕ применяется');
    expect(t).toContain('0.25-0.5 мг');
    expect(t).toContain('T/E2 10-30');
  });
  it('AI+SERM: короткая связка-исключение при острой гинекомастии', () => {
    expect(P('supportProtocolE2.tsx')).toContain('2-4 нед');
  });
  it('матрица взаимодействий фиксирует исключение', () => {
    const rows = DRUG_INTERACTIONS.filter(
      (x) => x.a === 'anastrozole' && x.b === 'tamoxifen',
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((x) => /2-4 нед|острая/i.test(x.action))).toBe(true);
  });
});

describe('support-protocol-audit: RAAS-гард (P0-4/P0-5)', () => {
  it('телмисартан: суммарный кап + K/СКФ + беременность D', () => {
    for (const f of ['supportProtocolCardio.tsx', 'supportProtocolRenal.tsx']) {
      expect(P(f)).toContain('≤80 мг/сут по всем модулям');
    }
    const raas = P('supportProtocolRAAS.tsx');
    expect(raas).toContain('K⁺ + креатинин');
    expect(raas).toContain('FDA');
  });
  it('эплеренон: без дублей + K/СКФ-мониторинг везде', () => {
    for (const f of [
      'supportProtocolRAAS.tsx',
      'supportProtocolMetabolic.tsx',
      'supportProtocolElectrolytes.tsx',
    ]) {
      const t = P(f);
      expect(t).toContain('НЕ дублировать');
      expect(t).toContain('K⁺ >5.0');
    }
  });
  it('петлевой диуретик — не базисная АГ-терапия', () => {
    expect(P('supportProtocolRAAS.tsx')).toContain('НЕ базисная АГ-терапия');
  });
});

describe('support-protocol-audit: печень UDCA (P0-7)', () => {
  it('весовая доза + с едой + разнос + продление', () => {
    const t = P('supportProtocolHepatic.tsx');
    expect(t).toContain('13-15 мг/кг');
    expect(t).toContain('3-4 ч');
    expect(t).toContain('2-4 нед');
  });
  it('стеатоз: те же правила + кап берберина + омега-предупреждение', () => {
    const t = P('supportProtocolSteatosis.tsx');
    expect(t).toContain('1500 мг/сут');
    expect(t).toContain('ФП');
  });
});

describe('support-protocol-audit: P1-лестницы и гейты', () => {
  it('RYR — вторая линия после эзетимиба', () => {
    expect(P('supportProtocolCardio.tsx')).toContain('ВТОРАЯ линия после эзетимиба');
    const pc = P('supportProtocolPostCycle.tsx');
    expect(pc.indexOf('Эзетимиб')).toBeLessThan(pc.indexOf('ферм. рис'));
  });
  it('NAC: кросс-лимит ≤4000 во всех назначающих модулях', () => {
    for (const f of [
      'supportProtocolCardio.tsx',
      'supportProtocolHemato.tsx',
      'supportProtocolRenal.tsx',
    ]) {
      expect(P(f)).toContain('≤4000 мг/сут');
    }
  });
  it('GH: инсулин — не опция вне СД', () => {
    expect(P('supportProtocolGH.tsx')).toContain('НЕ опция протокола');
  });
  it('щитовидка: L-T4 не при нормальном ТТГ', () => {
    expect(P('supportProtocolThyroid.tsx')).toContain('не при ТТГ 0.5-2.5');
  });
  it('почки: кетостерил по СКФ, бикарбонат по HCO3', () => {
    const t = P('supportProtocolRenal.tsx');
    expect(t).toContain('СКФ <60');
    expect(t).toContain('HCO3');
  });
  it('калий в ммолях, не только граммы соли', () => {
    expect(P('supportProtocolMetabolic.tsx')).toContain('ммоль');
    expect(P('supportProtocolElectrolytes.tsx')).toContain('ммоль');
  });
  it('сон: кап мелатонина, ГАМК убрана, празозин с синкопе-предупреждением', () => {
    const t = P('supportProtocolSleep.tsx');
    expect(t).not.toContain('10 мг');
    expect(t).toContain('кап 5 мг');
    expect(t).toContain('НЕ рекомендуется');
    expect(t).toContain('синкопе');
  });
  it('акне/волосы: изо-мониторинг, фин-предупреждения', () => {
    expect(P('supportProtocolAcne.tsx')).toContain('ЕЖЕМЕСЯЧНО');
    const h = P('supportProtocolHair.tsx');
    expect(h).toContain('FDA');
    expect(h).toContain('shedding');
  });
  it('мито: честные уровни C + кап берберина + CYP3A4', () => {
    const t = P('supportProtocolMito.tsx');
    expect(t).toContain('Уровень C');
    expect(t).toContain('1500 мг/сут');
    expect(t).toContain('CYP3A4');
  });
  it('экстренка: нитраты+PDE5 запрет; GLP-1 ссылается на хирургический чеклист', () => {
    expect(P('supportProtocolEmergency.tsx')).toContain('тадалафиле');
    expect(P('supportProtocolGLP1.tsx')).toContain('ASA 2023');
  });
});

describe('support-protocol-audit: P2 shared', () => {
  it('pre-cycle чеклист и стоп-таблица покрывают базу', () => {
    expect(PRE_CYCLE_LABS.length).toBeGreaterThanOrEqual(10);
    expect(STOP_COURSE_TABLE.length).toBeGreaterThanOrEqual(8);
    expect(EVIDENCE_LEGEND).toContain('C —');
  });
});

describe('support-protocol-audit: реестр доз синхронен с протоколами', () => {
  it('анастрозол: макс. 0.5 мг, без ежедневной частоты', () => {
    expect(SUPPORT_DOSING.anastrozole.doseRange.max).toBe(0.5);
    expect(SUPPORT_DOSING.anastrozole.doseRange.frequency).not.toMatch(/daily/);
    expect(SUPPORT_DOSING.anastrozole.warnings.join(' ')).toContain('no_1mg_daily');
  });
  it('каберголин: кап лейбла + эхо/импульсивность в варнингах', () => {
    const w = SUPPORT_DOSING.cabergoline.warnings.join(' ');
    expect(SUPPORT_DOSING.cabergoline.doseRange.max).toBe(1);
    expect(w).toContain('max_1mg_2x_weekly_FDA');
    expect(w).toContain('baseline_echo');
    expect(w).toContain('impulse_control');
  });
  it('TUDCA: вес, разнос, продление в варнингах; фаза 3 — не bid', () => {
    const r = SUPPORT_DOSING.tudca;
    const w = r.warnings.join(' ');
    expect(w).toContain('weight_based_13_15');
    expect(w).toContain('separate_from_oral_AAS');
    expect(w).toContain('continue_2_4_weeks');
    expect(r.phaseDosing?.Hepatic_Phase3.frequency).not.toBe('bid');
  });
  it('аспирин 75-100 + ИПП-гейт; NAC с кросс-капом; берберин кап 1500; RYR вторая линия', () => {
    expect(SUPPORT_DOSING.aspirin.doseRange.min).toBe(75);
    expect(SUPPORT_DOSING.aspirin.warnings.join(' ')).toContain('ppi_mandatory');
    expect(SUPPORT_DOSING.nac.warnings.join(' ')).toContain('cross_module_cap_4000');
    expect(SUPPORT_DOSING.berberine.warnings.join(' ')).toContain('max_1500_mg_day');
    expect(SUPPORT_DOSING.red_yeast_rice.warnings.join(' ')).toContain(
      'second_line_after_ezetimibe',
    );
  });
  it('мелатонин: старт 0.5, кап 5 без врача', () => {
    expect(SUPPORT_DOSING.melatonin.doseRange.min).toBe(0.5);
    expect(SUPPORT_DOSING.melatonin.doseRange.max).toBe(5);
    expect(SUPPORT_DOSING.melatonin.warnings.join(' ')).toContain('cap_5mg');
  });
});

describe('support-protocol-audit: добивка monitoring-дыр', () => {
  it('тиамазол: агранулоцитоз + ОАК/АЛТ', () => {
    const t = P('supportProtocolThyroid.tsx');
    expect(t).toContain('Агранулоцитоз');
    expect(t).toContain('ОАК');
  });
  it('renal-D3: курсом + Ca-контроль', () => {
    const t = P('supportProtocolRenal.tsx');
    expect(t).toContain('≤4000 МЕ/сут');
    expect(t).toContain('Ca²⁺');
  });
  it('адаптоген-ашваганда: печень + суммарный кап', () => {
    const t = P('supportProtocolAdaptogen.tsx');
    expect(t).toContain('DILI');
    expect(t).toContain('≤600 мг/сут');
  });
  it('оксандролон женщинам: не «условно», а под врачом + голос база', () => {
    const t = P('supportProtocolWomen.tsx');
    expect(t).toContain('гинекологом-эндокринологом');
    expect(t).toContain('запись голоса');
  });
});
