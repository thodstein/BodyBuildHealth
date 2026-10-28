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
  it('RYR — НЕ ступень лестницы (нет CV-пользы по ESC/EAS)', () => {
    const t = P('supportProtocolCardio.tsx');
    expect(t).not.toContain('ВТОРАЯ линия после эзетимиба');
    expect(t).toContain('НЕ ступень лестницы');
    const pc = P('supportProtocolPostCycle.tsx');
    expect(pc).not.toContain('вторая линия');
    expect(pc).toContain('НЕ ступень');
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
  it('аспирин 75-100 + ИПП-гейт; NAC с кросс-капом; берберин кап 1500; RYR не ступень', () => {
    expect(SUPPORT_DOSING.aspirin.doseRange.min).toBe(75);
    expect(SUPPORT_DOSING.aspirin.warnings.join(' ')).toContain('ppi_mandatory');
    expect(SUPPORT_DOSING.nac.warnings.join(' ')).toContain('cross_module_cap_4000');
    expect(SUPPORT_DOSING.berberine.warnings.join(' ')).toContain('max_1500_mg_day');
    expect(SUPPORT_DOSING.red_yeast_rice.warnings.join(' ')).toContain(
      'not_a_ladder_step_no_cv_benefit',
    );
    expect(SUPPORT_DOSING.red_yeast_rice.evidenceLevel).toBe('C');
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

describe('support-protocol-audit: раунд SUPPORT-PROTOCOLS-AUDIT-PLAN (P1-P6)', () => {
  it('шелл: фазы 3-4 только врач + в/в только стационар', () => {
    const t = P('SupportProtocols.tsx');
    expect(t).toContain('Фазы 3–4');
    expect(t).toContain('только стационар');
  });
  it('shared: единые гейты экспортируются', async () => {
    const shared = await import(
      '../../ui/screens/SupportScreen_parts/supportProtocolsShared'
    );
    expect(shared.PROTOCOL_DISCLAIMER_TEXT).toContain('Фазы 3–4 — только врач');
    expect(typeof shared.ProtocolDisclaimer).toBe('function');
    expect(typeof shared.Phase34RxGate).toBe('function');
    expect(typeof shared.IvStationaryGate).toBe('function');
  });
  it('печень: TUDCA больше не «единственный доказанный», UDCA первее', () => {
    const t = P('supportProtocolHepatic.tsx');
    expect(t).not.toContain('единственный доказанный антихолестатик');
    expect(t).toContain('экстраполяция');
  });
  it('печень: bland-холестаз паттерн + отмена первой', () => {
    const t = P('supportProtocolHepatic.tsx');
    expect(t).toContain('Bland-холестаз');
    expect(t).toContain('ОТМЕНА оралки');
  });
  it('берберин: CYP3A4-разнос во всех назначающих файлах', () => {
    for (const f of [
      'supportProtocolHepatic.tsx',
      'supportProtocolMetabolic.tsx',
      'supportProtocolSteatosis.tsx',
      'supportProtocolMito.tsx',
    ]) {
      expect(P(f)).toContain('CYP3A4');
    }
  });
  it('кардио: омега-честность (STRENGTH, без JELIS/REDUCE-IT)', () => {
    const t = P('supportProtocolCardio.tsx');
    expect(t).not.toContain('Доказано в JELIS, REDUCE-IT');
    expect(t).toContain('STRENGTH');
  });
  it('кардио: иерархия Hct — доза первее донации/аспирина', () => {
    const t = P('supportProtocolCardio.tsx');
    expect(t).not.toContain('Донорство крови НЕ заменяет аспирин');
    expect(t).toContain('ни аспирин, ни донорство');
  });
  it('гемато: Zone 2-базис + покой-замер после HIIE', () => {
    const t = P('supportProtocolHemato.tsx');
    expect(t).toContain('Zone 2');
    expect(t).toContain('24 ч после HIIE');
  });
  it('гемато: аспирин без «30-40%», омега без «двойной защиты»', () => {
    const t = P('supportProtocolHemato.tsx');
    expect(t).not.toContain('30-40%');
    expect(t).not.toContain('Двойная кардио+гемато защита');
  });
  it('женщины: все препараты + клен-QT + дневник', () => {
    const t = P('supportProtocolWomen.tsx');
    for (const s of [
      'Метенолон',
      'Метандростенолон',
      'Болденон',
      'Дростанолон',
      'Тренболон',
      'Флуоксиместерон',
      'Гестринон',
      'torsades',
      'virilism-дневник',
    ]) {
      expect(t).toContain(s);
    }
  });
  it('суставы: тендинозный баннер (фторхинолоны)', () => {
    expect(P('supportProtocolJoints.tsx')).toContain('фторхинолоны');
  });
  it('в/в-гейты: дома не вводить', () => {
    expect(P('supportProtocolImmune.tsx')).toContain('только стационар');
    expect(P('supportProtocolHepatic.tsx')).toContain('Дома не вводить');
    expect(P('supportProtocolElectrolytes.tsx')).toContain('только в стационаре');
  });
});

describe('support-protocol-audit: раунд-2 (гармонизация + гейты в фазах)', () => {
  it('detox: TUDCA едино с Печенью (с едой), без «строго натощак»', () => {
    const t = P('supportProtocolDetox.tsx');
    expect(t).toContain('едино с протоколом Печени');
    expect(t).not.toContain('TUDCA строго натощак перед сном');
    expect(t).not.toContain('Строго натощак (2-3 ч после еды)');
  });
  it('glp1: берберин с CYP3A4-разносом', () => {
    expect(P('supportProtocolGLP1.tsx')).toContain('CYP3A4-ингибитор: разнос 2+ ч');
  });
  it('phase34-гейт живёт в фазах кардио и печени', () => {
    expect(P('supportProtocolCardio.tsx')).toContain('Phase34RxGate');
    expect(P('supportProtocolHepatic.tsx')).toContain('Phase34RxGate');
  });
  it('постцикл: HCT — доза первее донации', () => {
    expect(P('supportProtocolPostCycle.tsx')).toContain('ни донация, ни аспирин');
  });
  it('постцикл: кабергейт со ссылкой на Пролактин', () => {
    expect(P('supportProtocolPostCycle.tsx')).toContain('строго по протоколу «Пролактин»');
  });
  it('женщины: финастерид/дутастерид запрещены', () => {
    expect(P('supportProtocolWomen.tsx')).toContain('Финастерид / дутастерид');
  });
  it('эпик тегов: легенда квалифицирует омегу/RYR + теги в карточках', () => {
    expect(EVIDENCE_LEGEND).toContain('только ↓ТГ');
    expect(EVIDENCE_LEGEND).toContain('красный рис');
    expect(EVIDENCE_LEGEND).toContain('Теги [A]/[B]/[C]');
    expect(P('supportProtocolCardio.tsx')).toContain('[A]');
    expect(P('supportProtocolCardio.tsx')).toContain('[B — только ТГ]');
    expect(P('supportProtocolCardio.tsx')).toContain('[C — нет CV-пользы]');
    expect(P('supportProtocolPostCycle.tsx')).toContain('[B]');
    expect(P('supportProtocolPostCycle.tsx')).toContain('[C]');
    expect(P('supportProtocolWomen.tsx')).toContain('[A — вирилизация');
  });
  it('glp1: запрет off-label «на массу»', () => {
    expect(P('supportProtocolGLP1.tsx')).toContain('чтобы есть больше на массе');
  });
  it('пептиды: WADA-метка', () => {
    expect(P('supportProtocolPeptide.tsx')).toContain('лист WADA');
  });
  it('инъекции: HBV/ВИЧ-блок', () => {
    const t = P('supportProtocolInjections.tsx');
    expect(t).toContain('гепатита B');
    expect(t).toContain('ВИЧ/HCV');
  });
  it('постцикл: ашваганда с DILI-капом', () => {
    const t = P('supportProtocolPostCycle.tsx');
    expect(t).toContain('≤600 мг/сут');
    expect(t).toContain('DILI');
  });
  it('гейты смонтированы: ProtocolDisclaimer ×3, IvStationaryGate ×3', () => {
    for (const f of [
      'supportProtocolWomen.tsx',
      'supportProtocolThyroid.tsx',
      'supportProtocolAcne.tsx',
    ]) {
      expect(P(f)).toContain('ProtocolDisclaimer');
    }
    for (const f of [
      'supportProtocolImmune.tsx',
      'supportProtocolHepatic.tsx',
      'supportProtocolElectrolytes.tsx',
    ]) {
      expect(P(f)).toContain('IvStationaryGate');
    }
  });
  it('phase34-гейт в 8 фазовых протоколах', () => {
    for (const f of [
      'supportProtocolCardio.tsx',
      'supportProtocolHepatic.tsx',
      'supportProtocolE2.tsx',
      'supportProtocolThyroid.tsx',
      'supportProtocolAcne.tsx',
      'supportProtocolProlactin.tsx',
      'supportProtocolMetabolic.tsx',
      'supportProtocolGLP1.tsx',
    ]) {
      expect(P(f)).toContain('Phase34RxGate');
    }
  });
  it('%эффекты захеджированы (не РКИ-гарантия)', () => {
    expect(P('supportProtocolPostCycle.tsx')).toContain('не гарантия');
    expect(P('supportProtocolWomen.tsx')).not.toContain('вирилизация 30%+');
    expect(P('supportProtocolSteatosis.tsx')).toContain('по РКИ (индивидуально');
    expect(P('supportProtocolProlactin.tsx')).toContain('не РКИ');
  });
});

describe('support-protocol-audit: волна 2 (фактические пороги и единицы)', () => {
  it('статины: порог 3×ВГН, а не 2× (ACC/AHA 2022, AASLD)', () => {
    const t = P('supportProtocolCardio.tsx');
    expect(t).toContain('3×ВГН');
    expect(t).toContain('ACC/AHA 2022');
    expect(t).not.toContain('КОНТРАИНДИЦИРОВАНЫ при АЛТ/АСТ >2×ВГН');
    expect(t).toContain('КФК >10×ВГН');
  });
  it('TUDCA: не «противопоказан» в фазе 4, УДХК предпочтительна', () => {
    const t = P('supportProtocolHepatic.tsx');
    expect(t).not.toContain('TUDCA — ПРОТИВОПОКАЗАН');
    expect(t).toContain('УДХК предпочтительна');
    expect(t).toContain('ОТМЕНА оральных ААС');
    expect(t).not.toContain('ВСЕ пероральные БАДы/гепатопротекторы — ОТМЕНИТЬ');
  });
  it('УДХК: приём с едой, а не «на ночь»', () => {
    const t = P('supportProtocolHepatic.tsx');
    expect(t).toContain('С едой 2-3×/день');
    expect(t).not.toContain("timing:'На ночь', note:'Золотой стандарт");
  });
  it('ашваганда: снижает ТТГ (направление), DILI + кейсы тиреотоксикоза', () => {
    const t = P('supportProtocolThyroid.tsx');
    expect(t).toContain('СНИЖАЕТ');
    expect(t).not.toContain('Повышает ТТГ, T4 и T3');
    expect(t).toContain('DILI');
    expect(t).toContain('Curry 2019');
    expect(t).toContain('6 нед');
  });
  it('E2: единый порог 60 + целевой 20-40 + канон единиц пг/мл', () => {
    const t = P('supportProtocolE2.tsx');
    expect(t).toContain('20-40 пг/мл');
    expect(t).not.toContain('ТОЛЬКО при E2 {\'>\'}80');
    expect(t).toContain('3.67');
    expect(t).toContain('LC-MS/MS');
  });
  it('постцикл: E2 в пг/мл с пересчётом, кортизол/PRL с единицами', () => {
    const t = P('supportProtocolPostCycle.tsx');
    expect(t).toContain('пмоль/л');
    expect(t).toContain('нмоль/л');
    expect(t).toContain('мМЕ/л');
  });
  it('биотин: интерференция анализа + пауза 72 ч', () => {
    const t = P('supportProtocolHair.tsx');
    expect(t).toContain('72 ч');
    expect(t).toContain('стрептавидин');
    expect(t).not.toContain('5000-10000 мкг');
  });
  it('креатин→креатинин: причина в почечном мониторинге', () => {
    const t = P('supportProtocolRenal.tsx');
    expect(t).toContain('5-15%');
    expect(t).toContain('Naeini 2025');
    expect(t).toContain('цистатином C');
  });
  it('цинк: медь 1-2 мг обязательна при Zn ≥25 мг, 50 мг — 8-12 нед', () => {
    for (const f of [
      'supportProtocolAcne.tsx',
      'supportProtocolHair.tsx',
      'supportProtocolImmune.tsx',
      'supportProtocolE2.tsx',
    ]) {
      expect(P(f)).toContain('1-2 мг');
    }
    expect(P('supportProtocolImmune.tsx')).toContain('8-12 нед');
    expect(SUPPORT_DOSING.zinc.warnings.join(' ')).toContain(
      'copper_1_2mg_mandatory_at_25mg',
    );
  });
  it('B6: 10-25 мг база, кап 100 мг, нейропатия >200 мг', () => {
    const t = P('supportProtocolProlactin.tsx');
    expect(t).toContain('10-25 мг');
    expect(t).toContain('100 мг');
    expect(t).toContain('нейропати');
    expect(SUPPORT_DOSING.vitamin_b6.warnings.join(' ')).toContain(
      'cap_100mg_short_course',
    );
  });
  it('флеботомия: интервалы вместо «вплоть до ежедневно»', () => {
    const t = P('supportProtocolCardio.tsx');
    expect(t).toContain('1-2×/нед до Hct <48%');
    expect(t).toContain('Assi 2014');
  });
  it('pre-cycle: креатин в базисе, метод T/E2, пауза биотина, условия забора', () => {
    const m = PRE_CYCLE_LABS.map((x) => `${x.marker} ${x.target}`).join(' ');
    expect(m).toContain('Креатин моногидрат');
    expect(m).toContain('LC-MS/MS');
    expect(m).toContain('Биотин');
    expect(m).toContain('Забор крови');
  });
  it('GH: метформин — по глюкозе, а не «обязательно»', () => {
    const t = P('supportProtocolGH.tsx');
    expect(t).toContain('НЕ обязателен');
    expect(t).not.toContain('Обязательно на GH');
  });
  it('реестр: медь/биотин/креатин + новые варнинги', () => {
    expect(SUPPORT_DOSING.copper.doseRange.max).toBe(2);
    expect(SUPPORT_DOSING.creatine.doseRange.max).toBe(5);
    expect(SUPPORT_DOSING.biotin.warnings.join(' ')).toContain('pause_72h');
    expect(SUPPORT_DOSING.tudca.warnings.join(' ')).toContain(
      'not_contraindicated_at_alt_5x_uln_but_udca_preferred',
    );
    expect(SUPPORT_DOSING.ashwagandha.warnings.join(' ')).toContain(
      'lowers_tsh_not_raises',
    );
  });
  it('кросс-капы: медь и B6 добавлены, предупреждение «Zn без Cu»', () => {
    const t = P('supportProtocolsShared.tsx');
    expect(t).toContain("key: 'cu'");
    expect(t).toContain("key: 'b6'");
    expect(t).toContain('cu-missing');
  });
  it('стоп-таблица: Hct >54% — сначала доза, флеботомия по ситуации', () => {
    const hct = STOP_COURSE_TABLE.find((x) => x.cond.includes('Hct'));
    expect(hct?.action).toContain('Дозу');
    expect(hct?.action).toContain('по ситуации');
  });
});

describe('support-protocol-audit: волна 3 (остаточные единицы и пробелы)', () => {
  it('нейро: PRL в мМЕ/л + макропролактин, кортизол с нмоль/л и условием забора', () => {
    const t = P('supportProtocolNeuro.tsx');
    expect(t).toContain('мМЕ/л');
    expect(t).not.toContain("target:'< 15 нг/мл'");
    expect(t).toContain('макропролактин');
    expect(t).toContain('нмоль/л');
    expect(t).toContain('утренний забор');
  });
  it('нейро: DHEA/прегненолон — показание по DHEA-S, а не «всем»', () => {
    const t = P('supportProtocolNeuro.tsx');
    expect(t).toContain('DHEA-S <150');
    expect(t).toContain('прегненолон-сульфат');
  });
  it('E2: PRL в мМЕ/л с макропролактин-гейтом', () => {
    const t = P('supportProtocolE2.tsx');
    expect(t).toContain('600 мМЕ/л');
    expect(t).toContain('макропролактин');
  });
  it('пролактин: референс 2.8-28 нг/мл, макропролактин до каберголина', () => {
    const t = P('supportProtocolProlactin.tsx');
    expect(t).toContain('60-600 мМЕ/л (2.8-28 нг/мл)');
    expect(t).toContain('сначала макропролактин');
  });
  it('GLP-1: потеря мышц + белок 1.6-2.2 г/кг + креатин + сохранение силы', () => {
    const t = P('supportProtocolGLP1.tsx');
    expect(t).toContain('1.6-2.2 г/кг');
    expect(t).toContain('тощая');
    expect(t).toContain('Креатин моногидрат 3-5 г');
    expect(t).toContain('сила');
    expect(t).toContain('Альбумин');
  });
  it('тирео: цинк с медью; без опечатки «тре Moupe»', () => {
    const t = P('supportProtocolThyroid.tsx');
    expect(t).toContain('медь 1-2 мг');
    expect(t).not.toContain('Moupe');
  });
  it('печень: цинк с медью, а не «30-50 мг» без пары', () => {
    const t = P('supportProtocolHepatic.tsx');
    expect(t).toContain('медь 1-2 мг');
  });
  it('GI: цинк-карнозин считается как элементарный Zn + медь', () => {
    const t = P('supportProtocolGI.tsx');
    expect(t).toContain('элементарного Zn');
    expect(t).toContain('медь 1-2 мг');
  });
  it('постцикл: цинк 30 мг + медь', () => {
    const t = P('supportProtocolPostCycle.tsx');
    expect(t).toContain('медь 1-2 мг');
  });
  it('интеракции: Zn+Cu — HIGH при ≥25 мг, а не «только >50 мг»', () => {
    const t = P('supportProtocolInteractions.tsx');
    expect(t).toContain('Zn ≥25 мг');
    expect(t).toContain('ОБЯЗАТЕЛЬНА');
    expect(t).not.toContain('При длительном приёме Zn >50 мг');
  });
  it('ферритин: единая цель 40-100 (донации 40-70), острофазность', () => {
    for (const f of [
      'supportProtocolHemato.tsx',
      'supportProtocolHepatic.tsx',
      'supportProtocolNeuro.tsx',
    ]) {
      expect(P(f), f).toContain('40-100');
    }
    expect(P('supportProtocolHair.tsx')).not.toContain("action:'{'<'}70 — дефицит железа. Ассоциирован");
  });
  it('кросс-капы: селен и омега-3 добавлены', () => {
    const t = P('supportProtocolsShared.tsx');
    expect(t).toContain("key: 'se'");
    expect(t).toContain("key: 'omega'");
  });
  it('мито/стеатоз: омега-3 >4 г не превышать вслепую', () => {
    expect(P('supportProtocolSteatosis.tsx')).toContain('риск ФП');
  });
});
