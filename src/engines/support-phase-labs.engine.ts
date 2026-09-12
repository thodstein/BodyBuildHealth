// ════════════════════════════════════════════════════════════════════
//  support-phase-labs.engine.ts — КАРТОЧКИ АНАЛИЗОВ ПО ФАЗАМ КУРСА (K0–K10)
//
//  Единый источник перечней анализов для калькулятора поддержки:
//  какие анализы, когда сдавать, цели, красные флаги, преаналитика.
//  Канон: docs/SUPPORT-PHASE-LABS-PLAN.md (§3–§4, §7).
//
//  Источники: Gibbons BJGP 2024 (PMC10962511); Endocrine Society 2018 (Bhasin);
//  AAFP 2024; ICSM 2024–2025; NSW PIED Guide 2025; WHO Semen Manual 6th ed 2021;
//  EAU Male Infertility; GH-label + ADA 2024; Graham BJSM 2006 + Ebenbichler 2001 (Hcy);
//  ESC/EAS 2019 + NLA (АпоВ); JAMA 2017 + FDA (биотин); JFMPС 2023 (тренировки→ЛФТ);
//  NICE NG203 (eGFR/цистатин C); NICE PH52/QS23 + WHO 2022 (BBV); Greenland 2018 (CAC).
//
//  Чистый движок без зависимостей: флаги — структурный подтип PEDFlags
//  (совместим с ReturnType<typeof derivePEDFlags>, но не импортирует его).
//  Все тексты — данные, мутаций стора нет.
// ════════════════════════════════════════════════════════════════════════════

import type { PhaseKey } from './tz-bridge-phase';

/** Минимальные PED-флаги, нужные карточкам (структурный подтип PEDFlags). */
export interface PhaseLabFlags {
  hasAAS?: boolean;
  hasTest?: boolean;
  hasNandrolone?: boolean;
  hasTren?: boolean;
  hasBold?: boolean;
  hasDhtInject?: boolean;
  hasOral17?: boolean;
  hasOral17Count?: number;
  hasSarm?: boolean;
  hasGH?: boolean;
  hasIGF?: boolean;
  hasMGF?: boolean;
  hasInsulin?: boolean;
  hasT3?: boolean;
  hasT4?: boolean;
  hasClenbut?: boolean;
}

/** Опции контекста для выбора карточек. */
export interface PhaseLabOpts {
  /** Длинные эфиры последнего курса (PCT-ветвление: hCG-bridge vs SERM-сразу). */
  esterLong?: boolean;
  /** Инъекционный курс (для BBV-карточки K10). */
  injectable?: boolean;
  /** Лп(a) уже сдан ранее (раз в жизни — не повторять). */
  lpaDone?: boolean;
}

export interface PhaseLabItem {
  marker: string;
  target?: string;
  red?: string;
  why?: string;
}

export interface PhaseLabGroup {
  label: string;
  items: PhaseLabItem[];
}

export interface PhaseLabCard {
  id: string;
  title: string;
  when: string;
  audience: string;
  groups: PhaseLabGroup[];
  deltaRules?: string[];
  preanalytics?: string[];
  rxNote?: string;
}

function g(label: string, items: PhaseLabItem[]): PhaseLabGroup {
  return { label, items };
}

function it(marker: string, target?: string, red?: string, why?: string): PhaseLabItem {
  return { marker, target, red, why };
}

// ─── K0. До курса (Baseline) ───
const K0_BASELINE: PhaseLabCard = {
  id: 'K0',
  title: 'До курса (исходно, 0 нед)',
  when: '0 нед — за 2–4 недели до старта',
  audience: 'все',
  groups: [
    g('Кровь', [
      it('ОАК с СОЭ: HCT, HGB, RBC, WBC, PLT, ретикулоциты', 'HCT<50%, HGB<170 г/л, PLT 150–400, СОЭ<15', 'HCT>52% — старт под вопросом; HCT>60% — гематолог', 'База эритроцитоза (BJGP 2024)'),
      it('Ферритин, сыв. железо, TSAT', 'ферритин 50–200, TSAT 20–45%', undefined, 'База для флеботомий и Fe-коррекции'),
      it('Коагулограмма: МНО/АЧТВ/фибриноген/D-димер', 'фибриноген 2–4 г/л, D-димер <0.5', undefined, 'База перед фибринолитиками/антиагрегантами'),
    ]),
    g('Биохимия + липиды', [
      it('АЛТ/АСТ/ГГТ/ЩФ/билирубин общ+прям/альбумин/белок', 'АЛТ<40, АСТ<40', undefined, 'Печень; альбумин нужен для расчёта free-T (Vermeulen)'),
      it('Липидограмма: ЛПНП/ЛПВП/ТГ/холестерин общий', 'LDL<3.0, HDL>1.0, ТГ<1.7', undefined, 'База дислипидемии ААС'),
      it('АпоВ', '<80 high-risk / <65 very-high (ESC/EAS)', '≥130 — риск-энхансер (ACC/AHA)', 'Точнее LDL при ТГ/метаболизме (NLA)'),
      it('Лп(a) — ОДИН раз в жизни', '<50 мг/дл (125 нмоль/л)', '≥50 — риск-энхансер, дальше не повторять', 'Генетический маркер, стабилен'),
      it('hs-CRP', '<1 оптимум; 1–3 внимание', '>3 — персистирующее воспаление', 'Независимый ССЗ-маркер (JUPITER)'),
    ]),
    g('Почки + моча', [
      it('Креатинин + цистатин C + eGFR (CKD-EPI) + мочевина + мочевая кислота', 'eGFR>90', undefined, 'Креатинин у мышечных врёт → цистатин C решает (NICE NG203)'),
      it('Электролиты: Na⁺/K⁺/Cl⁻/CO₂/Mg²⁺/Ca²⁺/фосфор', 'K 3.5–5.0, Na 135–145, Mg 0.75–1.0', undefined, 'База для ARB/диуретиков/кленбутерола'),
      it('ОАМ + UACR', 'UACR<30, белок мочи <0.15 г/л', undefined, 'Почечный baseline'),
    ]),
    g('Гормоны', [
      it('TT утром натощак ×2 + FT + SHBG', 'TT 12–28 нмоль/л', 'TT<8 + низкие LH/FSH — гипогонадизм', 'Утро 8–10 ч (30% циркадный swing); SHBG нужен для free-T'),
      it('LH/FSH', 'ЛГ 1.7–8.6, ФСГ 1.5–12.4', 'Подавленные LH/FSH — лучший маркер употребления (89%)', 'Отличает shutdown от первичного гипогонадизма'),
      it('E2 чувствительный (LC-MS/MS)', '20–40 пг/мл', undefined, 'Иммуноанализ врёт на 50–100% — просить кодом (Rosner 2013)'),
      it('PRL', '<400 мМЕ/л (~19 нг/мл)', '>20 нг/мл — аргумент против 19-nor + МРТ гипофиза', 'Особенно перед треном/нандролоном (Melmed 2011)'),
      it('ТТГ + fT3 + fT4 (+АТ-ТПО)', 'ТТГ 0.4–4.0', undefined, 'Субклинический гипотиреоз маскируется под курс'),
      it('Кортизол (утро)', '140–690 нмоль/л', undefined, 'База стресса/перетрена'),
    ]),
    g('Метаболизм + метилирование', [
      it('Глюкоза натощак + HbA1c + инсулин (HOMA-IR)', 'глюкоза<5.6, HbA1c<5.7%, HOMA-IR<2.5', undefined, 'Обязательно при плане GH/инсулина/профицита'),
      it('Гомоцистеин + B12 + фолат', 'Hcy<10 оптимум', 'Hcy>15 — гипергомоцистеинемия (B-триада + TMG); >30 — срочно врач', 'ААС ↑Hcy (Graham BJSM 2006; Ebenbichler 2001)'),
      it('Витамин D (25-OH)', '50–80 нг/мл', undefined, 'Оптимизация до курса (Holick 2011)'),
    ]),
    g('Простата + давление + органы', [
      it('PSA (мужчины ≥40 лет или при ААС-анамнезе)', '<4.0 нг/мл', 'Прирост >1.4 или >4.0 — уролог', 'База делает будущий рост значимым (ES 2018)'),
      it('АД + ЧСС + ЭКГ', 'АД<130/85, ЧСС 60–90', 'QTc>450 или аритмия — кардиолог до курса', undefined),
      it('УЗИ печени (при плане оралов)', undefined, 'Стеатоз/фиброз — гепатолог', undefined),
      it('ИФР-1 (при плане GH/пептидов)', 'середина–верх возрастной нормы', '>300–350 нг/мл — снизить дозу', 'Главный маркер GH-оси, стабилен в течение дня'),
    ]),
  ],
  preanalytics: [
    '7 дней без тяжелых тренировок перед АЛТ/АСТ/КФК (мышцы дают трансаминазы)',
    'Биотин-стоп: 8 ч при ≤10 мг/сут, ≥72 ч при мегадозах ≥100 мг (иначе ложные ТТГ/PRL/тропонин)',
    'Утро натощак: T/LH/FSH/глюкоза/инсулин; T — два утренних замера',
    'E2 — чувствительный метод, середина недели между инъекциями (48 ч после инъекции)',
  ],
};

// ─── K1. Нед 2 (короткие эфиры/оралы) ───
const K1_WEEK2: PhaseLabCard = {
  id: 'K1',
  title: 'На курсе — ранний контроль (нед 2)',
  when: 'через 2 недели (оралы 17α / короткие эфиры / клен / трен)',
  audience: 'course',
  groups: [
    g('Печень (оралы)', [
      it('АЛТ/АСТ + КФК', 'АЛТ<40, АСТ<40', 'ALT>2×ULN — снизить/отменить орал', 'КФК разделяет мышцы/печень; при <3×ULN — повтор через 10–14 дней без тренировок'),
      it('ГГТ/ЩФ/билирубин (при оралах)', undefined, 'Холестаз — врач', 'ГГТ чувствителен к холестазу раньше АЛТ'),
    ]),
    g('Почки/электролиты (трен, клен)', [
      it('Креатинин/eGFR/UACR/K/Na/Mg (трен)', 'eGFR>60, UACR<30', undefined, 'Трен-нефротоксичность'),
      it('K⁺/Na⁺/Mg²⁺ + креатинин (кленбутерол)', 'K 3.5–5.0, Mg 0.75–1.0', 'K<3.0 — STOP клен, врач', 'Клен вымывает K и Mg'),
    ]),
  ],
};

// ─── K2. Нед 4 + каждые 4 нед ───
const K2_WEEK4: PhaseLabCard = {
  id: 'K2',
  title: 'На курсе — регулярный контроль (нед 4, далее каждые 4 нед)',
  when: 'нед 4, затем каждые 4 недели курса',
  audience: 'course',
  groups: [
    g('Кровь + давление', [
      it('ОАК: HCT/HGB + АД/ЧСС', 'HCT<50%, HGB<170, АД<130/85', 'HCT 52–54% — флеботомия; HCT>60% — STOP + гематолог', 'HCT Δ+5 п.п. от baseline — порог вмешательства'),
      it('HCT + ферритин', 'HCT<50%, ферритин 50–200', undefined, 'Управление эритроцитозом'),
    ]),
    g('Гормоны', [
      it('E2 чувств. (титрация AI)', '20–40 пг/мл (100–200 пмоль/л)', 'E2 −30% от steady-state — AI избыточен', 'Середина недели, 48 ч после инъекции; в ноль не давить'),
      it('PRL (19-nor)', '<400 мМЕ/л', 'Подтвердить повтором + макропролактин', undefined),
    ]),
    g('Липиды/гемостаз/методичка', [
      it('Липидограмма (при дозе ≥500 мг/нед или оралах)', 'LDL<3.0, HDL>1.0', 'HDL −40% от baseline — зона событий', undefined),
      it('Коагулограмма (при фибринолитиках/антиагрегантах)', 'D-димер<0.5', 'D-димер>0.5 — оценка тромботического риска', undefined),
      it('Глюкоза + HbA1c (при GH — HbA1c q12w)', 'HbA1c<5.7%', '>6.5% — диабет-маршрут, GH-стоп', undefined),
      it('IGF-1 (при GH, q6–8w)', 'верх возрастной нормы', '>300–350 — снизить дозу', undefined),
      it('Глюкоза + K⁺ (при инсулине)', 'глюкоза 3.9–7.8, K 3.5–5.0', 'Гипогликемия — пересмотр дозы', 'Быстрые углеводы с собой, никогда перед сном'),
      it('ТТГ/fT3/fT4 (при T3/T4)', 'ТТГ 0.4–4.0', undefined, '+ Ca/PTH/D — костная защита'),
    ]),
  ],
};

// ─── K3. Нед 8/12 + каждые 12 нед ───
const K3_WEEK8_12: PhaseLabCard = {
  id: 'K3',
  title: 'Длинный курс — полный пересмотр (нед 8 и 12, далее каждые 12 нед)',
  when: 'нед 8 и 12, затем каждые 12 недель',
  audience: 'course',
  groups: [
    g('Полный набор', [
      it('ОАК с СОЭ + БХ + липидограмма + АпоВ + hs-CRP', 'ApoB<80/<65, hsCRP<3', undefined, 'АпоВ и hsCRP — динамика риска'),
      it('Гормоны: E2/PRL/ТТГ/TT/FT/LH/FSH/SHBG', 'E2 20–40, PRL<25', undefined, undefined),
      it('Почки: креатинин/eGFR/цистатин C + ОАМ + UACR', 'UACR<30', undefined, undefined),
      it('Глюкоза/HbA1c + Hcy/B12/фолат + D3/ферритин', 'Hcy<10', 'Hcy>15 — B-триада + TMG', 'Метилирование на длинном курсе'),
      it('Коагулограмма + ферритин/железо', 'D-димер<0.5', undefined, undefined),
    ]),
    g('Органы', [
      it('УЗИ печени (при ААС) + УЗИ простаты + ЭКГ', undefined, 'Отклонения — профильный врач', undefined),
      it('D-димер при HCT>52%', undefined, 'Тромботический риск', undefined),
    ]),
  ],
};

// ─── K4. Мост ───
const K4_BRIDGE: PhaseLabCard = {
  id: 'K4',
  title: 'Мост (bridge, каждые 6 нед)',
  when: 'каждые 6 недель моста',
  audience: 'bridge',
  groups: [
    g('Контроль моста', [
      it('Липиды + ОАК/HCT + АЛТ/АСТ + E2 + АД/ЧСС', 'HCT<50%, E2 20–40', 'HCT≥54% — как на курсе', 'HCT и E2 на мосту не «отпускать»'),
    ]),
  ],
};

// ─── K5. TRT ───
const K5_TRT: PhaseLabCard = {
  id: 'K5',
  title: 'TRT (после стабилизации, каждые 8–12 нед → ежегодно)',
  when: 'каждые 8–12 нед после стабилизации, затем ежегодно',
  audience: 'trt',
  groups: [
    g('TRT-контроль', [
      it('TT (цель — mid-normal) + HCT + PSA + E2 + липиды + АД', 'TT 15–30 нмоль/л, HCT<50%', 'HCT≥54% — отмена/снижение/донация; PSA прирост >1.4 или >4.0 — уролог', 'HCT 48–50% на старте — обсудить риск ДО начала (ES 2018, ICSM)'),
    ]),
  ],
};

// ─── K6. Выход/PCT ───
const K6_PCT_SERMs: PhaseLabCard = {
  id: 'K6',
  title: 'Выход / PCT (нед 2 и 6 после отмены + 3 и 6 мес)',
  when: 'нед 2 и 6 после отмены, затем 3 и 6 мес',
  audience: 'pct',
  groups: [
    g('Восстановление HPTA', [
      it('Нед 2: LH/FSH/TT/E2/PRL + липиды/ОАК/АЛТ/HCT', undefined, undefined, 'Стартовая точка восстановления'),
      it('Нед 6: LH/FSH/TT/E2', undefined, 'Нет восстановления >6 нед (LH/FSH <50% нормы) — эндокринолог', undefined),
      it('3 и 6 мес: повтор до восстановления', 'TT>15 нмоль/л', 'Правило 24 нед (BJGP): T<8 + низкие гонадотропины → 12 нед → рост >2 → еще 8–12 нед → только потом эндокринолог', 'Гормоны информативны только OFF (на курсе всегда абнормальны)'),
      it('Кортизол (утро) + липиды + HCT на выходе', 'кортизол 140–690', undefined, 'Перетрен и липидное наследие курса'),
    ]),
    g('Ветвление по эфирам', [
      it('Короткие эфиры → SERM сразу (тамоксифен 20 мг ИЛИ энкломифен 12.5–25 мг ИЛИ кломифен 25–50 мг)', undefined, 'Комбинация SERM не рекомендована (один механизм, ↑побочек)', undefined),
      it('Длинные эфиры → hCG-bridge 500–1000 МЕ 2×/нед × 2–3 нед → затем SERM', undefined, 'hCG без SERM после длинных эфиров — риск задержки восстановления', undefined),
      it('AI — только при высоком E2; каберголин 0.25×2/нед при ↑PRL', undefined, 'AI без высокого E2 давит нужный эстроген', undefined),
    ]),
  ],
  rxNote: 'SERM / hCG / AI / каберголин — 👨‍⚕️ только по назначению врача.',
};

// ─── K7. Фертильность ───
const K7_FERTILITY: PhaseLabCard = {
  id: 'K7',
  title: 'Фертильность (baseline + каждые 6–8 нед, оценка через 3–6 мес OFF)',
  when: 'baseline + каждые 6–8 нед; итоговая оценка через 3–6 мес OFF',
  audience: 'fertility',
  groups: [
    g('Сперма + гормоны', [
      it('Спермограмма по WHO-6', 'объем ≥1.4 мл, конц ≥16 млн/мл, total ≥39 млн, прогрессивная ≥30%, морфология ≥4%', 'Один тест при норме; при патологии — 2+ и андролог', '5-й перцентиль ≠ граница фертильности (WHO 2021, EAU)'),
      it('LH/FSH/TT/E2/PRL/SHBG + ингибин B', undefined, undefined, 'Ингибин B + FSH — маркеры сперматогенеза (не фертильности как таковой)'),
    ]),
  ],
  rxNote: 'hCG / рФСГ-схемы — 👨‍⚕️ только под врачом. Криоконсервация до курса — опция.',
};

// ─── K8. Экстренно ───
const K8_URGENT: PhaseLabCard = {
  id: 'K8',
  title: 'Экстренно при симптомах (немедленно)',
  when: 'немедленно при симптомах',
  audience: 'all',
  groups: [
    g('Стоп-критерии', [
      it('HCT>0.60 / АД>160/100 / ЧСС>120 в покое', undefined, 'STOP AAS + срочный врач', undefined),
      it('Боль в груди / одышка / боль-отёк одной ноги (ТГВ/ТЭЛА)', undefined, 'Срочная оценка; антикоагулянт ТОЛЬКО по назначению', undefined),
      it('Желтуха / отёки + олигурия <500 мл/сут / ALT>3×ULN + клиника', undefined, 'БХ + врач', undefined),
      it('Температура >38.5°C + боль/покраснение в месте инъекции', undefined, 'Абсцесс — дренирование у врача', undefined),
      it('Судороги / потеря сознания / нарушение зрения', undefined, 'Экстренная госпитализация (гипервязкость/неврология)', undefined),
    ]),
  ],
};

// ─── K9. Преаналитика ───
const K9_PREANALYTICS: PhaseLabCard = {
  id: 'K9',
  title: 'Преаналитика и тайминг сдачи (прочитать до любых анализов)',
  when: 'перед каждой сдачей',
  audience: 'all',
  groups: [
    g('Как сдавать, чтобы не получить мусор', [
      it('7 дней без тяжелых тренировок перед АЛТ/АСТ/КФК', undefined, undefined, 'Мышцы дают трансаминазы (JFMPС 2023); при АЛТ<3×ULN — повтор через 10–14 дней без тренировок'),
      it('Биотин-стоп: 8 ч при ≤10 мг/сут, ≥72 ч при мегадозах', undefined, undefined, 'Иначе ложные ТТГ/PRL/тропонин (JAMA 2017, FDA)'),
      it('Утро натощак: T/LH/FSH/глюкоза/инсулин; T — два утренних замера', undefined, undefined, 'Циркадный swing T ~30%'),
      it('E2 — чувствительный LC-MS/MS, называть кодом лаборатории', undefined, undefined, 'Иммуноанализ врёт на 50–100% (Rosner 2013)'),
      it('T на курсе — в trough (накануне следующей инъекции)', undefined, undefined, 'Иначе несравнимо между циклами'),
      it('Free-T — Vermeulen (TT+SHBG+альбумин); при SHBG <15 или >80 — только прямое измерение', undefined, undefined, undefined),
      it('Креатинин у мышечных врёт → решает цистатин C (eGFR-оговорка NICE NG203)', undefined, undefined, undefined),
    ]),
  ],
};

// ─── K10. BBV (инфекционный скрининг инъекционных) ───
const K10_BBV: PhaseLabCard = {
  id: 'K10',
  title: 'Инфекционный скрининг (инъекционный курс)',
  when: 'baseline + ежегодно; вакцинация HBV 0–1–6 мес',
  audience: 'injectable',
  groups: [
    g('BBV', [
      it('HIV + HBsAg/anti-HBs + anti-HCV', undefined, 'Позитив — инфекционист, linkage to care', 'NICE PH52/QS23, WHO 2022 key populations'),
      it('Вакцинация HBV (3 дозы), при риске — HAV/столбняк', undefined, undefined, 'NICE PH52'),
      it('Не делить иглы/флаконы; abscess-контроль — см. K8', undefined, undefined, undefined),
    ]),
  ],
};

export const PHASE_LAB_CARDS: PhaseLabCard[] = [
  K0_BASELINE, K1_WEEK2, K2_WEEK4, K3_WEEK8_12, K4_BRIDGE,
  K5_TRT, K6_PCT_SERMs, K7_FERTILITY, K8_URGENT, K9_PREANALYTICS, K10_BBV,
];

export function phaseLabCardById(id: string): PhaseLabCard | null {
  return PHASE_LAB_CARDS.find(c => c.id === id) ?? null;
}

// ════════════════════════════════════════════════════════════════════
//  CLASS_LAB_ADDONS — аддоны по классам препаратов.
//  Источники классов: (1) классы PHARMA_DB (testosterone/trenbolone/nandrolone/
//  boldenone/oral_17aa/drostanolone/dht/primobolan/sarm/gh/igf/insulin/
//  clenbuterol/thyroid/glp1); (2) ключи LAB_MONITOR_DB для PCT/AI/DA
//  (anastrozole/exemestane/letrozole/tamoxifen/clomiphene/enclomiphene/
//  cabergoline/hcg — живут в support-каталоге, не в pharma-db).
//  attachTo — id карточек, к которым цепляется аддон.
// ════════════════════════════════════════════════════════════════════
export interface ClassLabAddon {
  key: string;
  label: string;
  classes: string[];
  attachTo: string[];
  items: PhaseLabItem[];
}

export const CLASS_LAB_ADDONS: ClassLabAddon[] = [
  {
    key: 'testosterone', label: 'Тестостерон (все эфиры)',
    classes: ['testosterone'], attachTo: ['K2', 'K3', 'K5'],
    items: [
      it('E2 q4w + HCT q4w + PSA-правило + АД', 'E2 20–40, HCT<50%', 'HCT≥54% — стоп; PSA +1.4/>4.0 — уролог', 'Суспензия — чаще (пики)'),
    ],
  },
  {
    key: 'trenbolone', label: 'Тренболон',
    classes: ['trenbolone'], attachTo: ['K1', 'K2'],
    items: [
      it('PRL q4w + E2; почки (креатинин/eGFR/UACR/K/Na/Mg) q2–4w', 'PRL<25, eGFR>60', undefined, 'АД/ЧСС ежедневно + сон/тревога-дневник; ЭКГ при симптомах'),
    ],
  },
  {
    key: 'nandrolone', label: 'Нандролон / MENT (трестолон)',
    classes: ['nandrolone'], attachTo: ['K2'],
    items: [
      it('PRL с подтверждением + E2/TT/FT/LH/FSH/SHBG q4w', 'PRL<25', undefined, 'У MENT — E2 усиленно (ароматизация 0.4); либидо/гино-дневник'),
    ],
  },
  {
    key: 'boldenone', label: 'Болденон / DHB',
    classes: ['boldenone', 'dht_inject'], attachTo: ['K2'],
    items: [
      it('ОАК q2–4w (HCT/HGB/RBC/PLT) + ферритин/Fe/TSAT', 'HCT<52%, TSAT 20–45%', 'HCT↑ — только врачебная флеботомия', undefined),
    ],
  },
  {
    key: 'oral_17aa', label: 'Оралы 17α (метан/оксана/стан/турик/гало/супердрол/анаполон)',
    classes: ['oral_17aa'], attachTo: ['K1', 'K2'],
    items: [
      it('АЛТ/АСТ q2w + ГГТ/ЩФ/билирубин + липиды q4w', 'АЛТ<40', 'АЛТ>2×ULN — снизить/отменить; курс ≤6 нед (супердрол ≤4)', 'Стан — HDL-контроль усиленно'),
    ],
  },
  {
    key: 'dht', label: 'DHT-производные (мастерон/провирон)',
    classes: ['drostanolone', 'dht_derivative'], attachTo: ['K2', 'K3'],
    items: [
      it('DHT-симптомы + PSA + липиды мягко; провирон — SHBG/FT', 'DHT — верх нормы, в ноль не давить', undefined, undefined),
    ],
  },
  {
    key: 'primobolan', label: 'Примоболан',
    classes: ['primobolan'], attachTo: ['K2'],
    items: [it('Липиды + LH/FSH', undefined, undefined, 'Мягкое подавление, но есть')],
  },
  {
    key: 'sarm', label: 'SARM (оста/ЛГД/RAD/S23)',
    classes: ['sarm'], attachTo: ['K1', 'K2'],
    items: [it('АЛТ/АСТ + липиды + LH/FSH', 'АЛТ<40', 'АЛТ/АСТ>100 — стоп', 'Мини-AAS по мониторингу')],
  },
  {
    key: 'gh', label: 'GH / GHRH/GHRP (CJC/GHRP6/ипаморелин/MK677)',
    classes: ['gh', 'peptide_ghrh', 'peptide_ghrp'], attachTo: ['K0', 'K2'],
    items: [
      it('IGF-1 baseline + q6–8w + глюкоза q4–6w + HbA1c q12w + ТТГ/fT4', 'IGF-1 — верх нормы', '>300–350 — снизить', 'GH демаскирует гипотиреоз'),
    ],
  },
  {
    key: 'igf', label: 'IGF-1 / MGF',
    classes: ['igf1', 'mgf'], attachTo: ['K2'],
    items: [it('Глюкоза 3р/сут 1-я нед → еженедельно натощак', '3.9–7.8', 'Гипогликемия — пересмотр', undefined)],
  },
  {
    key: 'insulin', label: 'Инсулин',
    classes: ['insulin'], attachTo: ['K2'],
    items: [it('Глюкоза натощак + через 2 ч + K⁺', 'K 3.5–5.0', undefined, 'Быстрые углеводы с собой, никогда перед сном')],
  },
  {
    key: 'clenbuterol', label: 'Кленбутерол',
    classes: ['clenbuterol'], attachTo: ['K1', 'K2'],
    items: [it('K/Na/Mg + креатинин q2w + ЧСС/АД ежедневно', 'Mg 0.75–1.0', 'K<3.0 — STOP', 'Не сочетать с β-блокаторами; ЭКГ при тахикардии')],
  },
  {
    key: 'thyroid', label: 'T3/T4',
    classes: ['thyroid'], attachTo: ['K2'],
    items: [it('ТТГ/fT3/fT4 q4w + Ca/PTH/D', undefined, undefined, 'Костная защита при длинном T3')],
  },
  {
    key: 'glp1', label: 'GLP-1 (семаглутид/тирзепатид)',
    classes: ['glp1'], attachTo: ['K2', 'K3'],
    items: [it('HbA1c baseline + q3m + глюкоза + липаза/амилаза + почки', 'HbA1c<5.7%', undefined, 'Липаза — при анамнезе панкреатита; почки — при рвоте')],
  },
  {
    key: 'pct_ai', label: 'AI (анастрозол/экземестан/летрозол)',
    classes: ['anastrozole', 'exemestane', 'letrozole', 'anastro', 'aromatase_inhibitor'], attachTo: ['K2', 'K6'],
    items: [it('E2 чувств. + липиды; при длинном AI — DEXA 1–2 года', 'E2 20–40', 'E2<10 — снизить', undefined)],
  },
  {
    key: 'pct_serm', label: 'SERM (тамоксифен/кломифен/энкломифен)',
    classes: ['tamoxifen', 'clomiphene', 'enclomiphene', 'clomi', 'pct_serm'], attachTo: ['K6'],
    items: [it('E2/LH/FSH + липиды + тромбо-симптомы', undefined, 'Боль в ноге/груди — STOP (тамоксифен)', undefined)],
  },
  {
    key: 'pct_da', label: 'Каберголин / hCG',
    classes: ['cabergoline', 'caberg', 'hcg', 'pct_dopamine', 'pct_gonadotropin'], attachTo: ['K2', 'K6'],
    items: [it('PRL (кабер) / TT/E2 (hCG)', 'PRL<25', 'PRL<5 — STOP кабер; ЭхоКГ ежегодно при >1 мг/нед', undefined)],
  },
];

/** PCT-ветвление по эфирам: hCG-bridge (длинные) vs SERM-сразу (короткие). */
export function pctVariantFor(esterLong?: boolean): 'hcg-bridge' | 'serm-direct' | 'unknown' {
  if (esterLong === true) return 'hcg-bridge';
  if (esterLong === false) return 'serm-direct';
  return 'unknown';
}

/** Длинный эфир: T½ > 100 ч (энантат 336, ципионат 384, дека 336, ундеканоат 1200). */
export function isLongEsterHalfLife(halfLifeHours?: number | null): boolean {
  return typeof halfLifeHours === 'number' && Number.isFinite(halfLifeHours) && halfLifeHours > 100;
}

/** Инъекционный курс: есть form inject/im/subq, либо form не указан, но есть ААС
 * (типично инъекции; чисто оральный курс с явным form:'oral' у всех — не инъекционный). */
export function isInjectableCourse(
  peds: Array<{ form?: string | null; id?: string | null } | null | undefined> | null | undefined,
  flags?: PhaseLabFlags | null,
): boolean {
  const list = (peds || []).filter(Boolean) as Array<{ form?: string | null; id?: string | null }>;
  if (list.some(p => p.form === 'inject' || p.form === 'im' || p.form === 'subq')) return true;
  if (list.length > 0 && list.every(p => p.form === 'oral')) return false;
  if (list.length > 0 && !!flags?.hasAAS) return true;
  return false;
}

/**
 * Карточки для фазы: базовая K0 + преаналитика K9 всегда; дальше — по фазе.
 * Без PED-флагов (все false/undefined) — только K0 + K9 (lock: честно ничего лишнего).
 */
export function phaseCardsFor(
  flags: PhaseLabFlags | null | undefined,
  phase: PhaseKey,
  opts: PhaseLabOpts = {},
): PhaseLabCard[] {
  const out: PhaseLabCard[] = [K0_BASELINE, K9_PREANALYTICS];
  const onPed = !!flags && (
    !!flags.hasAAS || !!flags.hasSarm || !!flags.hasGH || !!flags.hasInsulin || !!flags.hasIGF
  );
  if (!onPed && phase !== 'pct' && phase !== 'fertility' && phase !== 'trt' && phase !== 'bridge') {
    return out;
  }
  switch (phase) {
    case 'course':
      out.push(K1_WEEK2, K2_WEEK4, K3_WEEK8_12, K8_URGENT);
      break;
    case 'bridge':
      out.push(K4_BRIDGE, K8_URGENT);
      break;
    case 'pct':
      out.push(K6_PCT_SERMs, K8_URGENT);
      break;
    case 'fertility':
      out.push(K7_FERTILITY, K6_PCT_SERMs, K8_URGENT);
      break;
    case 'trt':
      out.push(K5_TRT, K8_URGENT);
      break;
    default:
      out.push(K8_URGENT);
      break;
  }
  if (opts.injectable && !out.includes(K10_BBV)) out.push(K10_BBV);
  return out;
}

/**
 * Аддоны классов для текущего стека.
 * @param activeClasses — классы PHARMA_DB (testosterone/trenbolone/...) и/или ключи
 *   LAB_MONITOR_DB / support-каталога (anastrozole/tamoxifen/cabergoline/hcg/...).
 * Матчинг: точное совпадение (case-insensitive) + префиксные алиасы (anastro→anastrozole и т.п.).
 */
const CLASS_ALIASES: Record<string, string> = {
  anastro: 'anastrozole',
  caberg: 'cabergoline',
  clomi: 'clomiphene',
  test: 'testosterone',
  test_prop: 'testosterone',
  test_enan: 'testosterone',
  test_cyp: 'testosterone',
  test_undec: 'testosterone',
  test_susp: 'testosterone',
  sustanon: 'testosterone',
  tren: 'trenbolone',
  tren_acet: 'trenbolone',
  tren_enan: 'trenbolone',
  tren_hex: 'trenbolone',
  bold_undec: 'boldenone',
  prim_enan: 'primobolan',
  methenolone_acetate: 'primobolan',
  ostarine: 'sarm',
  lgd: 'sarm',
  rad140: 'sarm',
  s23: 'sarm',
  ghrp6: 'gh',
  drostanolone_prop: 'dht',
  drostanolone_enan: 'dht',
  mesterolone: 'dht',
  ins_aspart: 'insulin',
  ins_detemir: 'insulin',
  aas_test: 'testosterone',
  aas_tren: 'trenbolone',
  aas_nandrolone: 'nandrolone',
  aas_bold: 'boldenone',
  aas_dht_inject: 'dht',
  aas_oral_dbol: 'oral_17aa',
  aas_oral_oxy: 'oral_17aa',
  aas_oral_winny: 'oral_17aa',
  aas_oral_anavar: 'oral_17aa',
  aas_oral_tbol: 'oral_17aa',
  aas_oral_halo: 'oral_17aa',
  aas_oral_other: 'oral_17aa',
  nandrolone_decanoate: 'nandrolone',
  deca: 'nandrolone',
  npp: 'nandrolone',
  ment: 'nandrolone',
  trest: 'nandrolone',
  bold: 'boldenone',
  eq: 'boldenone',
  dhb: 'boldenone',
  primo: 'primobolan',
  mast: 'dht',
  proviron: 'dht',
  winny: 'oral_17aa',
  stan: 'oral_17aa',
  dbol: 'oral_17aa',
  methand: 'oral_17aa',
  oxan: 'oral_17aa',
  anadrol: 'oral_17aa',
  superdrol: 'oral_17aa',
  turinabol: 'oral_17aa',
  trena: 'oral_17aa',
  halo: 'oral_17aa',
  mk677: 'gh',
  hgh: 'gh',
  somatropin: 'gh',
  cjc: 'gh',
  ghrp: 'gh',
  ipamorelin: 'gh',
  igf1_lr3: 'igf',
  igf1_des: 'igf',
  mgf: 'igf',
  ins_short: 'insulin',
  ins_long: 'insulin',
  semaglutide: 'glp1',
  tirzepatide: 'glp1',
  t3: 'thyroid',
  t4: 'thyroid',
  clen: 'clenbuterol',
  tamox: 'pct_serm',
  nolvadex: 'pct_serm',
  clomid: 'pct_serm',
};

function normClass(raw: string): string {
  const k = String(raw || '').toLowerCase();
  return CLASS_ALIASES[k] ?? k;
}

export function addonsFor(activeClasses: Array<string | null | undefined>): ClassLabAddon[] {
  const norm = new Set((activeClasses || []).filter(Boolean).map(c => normClass(c as string)));
  if (norm.size === 0) return [];
  return CLASS_LAB_ADDONS.filter(a =>
    a.classes.some(c => {
      const nc = normClass(c);
      if (norm.has(nc)) return true;
      // класс-префикс: 'trenbolone' покрывает 'tren_acet' и наоборот
      for (const n of norm) {
        if (n.startsWith(nc) || nc.startsWith(n)) return true;
      }
      return false;
    }),
  );
}

/** Лп(a) сдается один раз в жизни: true — еще не сдан, нужен baseline. */
export function needsLpaBaseline(lpaDone?: boolean): boolean {
  return !lpaDone;
}

// ════════════════════════════════════════════════════════════════════
//  ДЕДУП ИСТОЧНИКОВ МОНИТОРИНГА (§2-дефект №8 плана).
//  Один и тот же препарат описан в трех местах: catalog.monitoring,
//  LAB_MONITOR_DB (+LAB_TOP20), SUBSTANCE_MONITORING_DB.
//  mergeMonitoringLists сливает их с приоритетом первого списка:
//  существующие what не перезаписываются, пустые when/target добиваются.
// ════════════════════════════════════════════════════════════════════
export interface UnifiedMonitor {
  what: string;
  when: string;
  target: string;
}

export function mergeMonitoringLists(
  primary: UnifiedMonitor[],
  ...rest: UnifiedMonitor[][]
): UnifiedMonitor[] {
  const map = new Map<string, UnifiedMonitor>();
  const key = (w: string) => String(w || '').trim().toLowerCase();
  for (const list of [primary, ...rest]) {
    for (const m of list || []) {
      const k = key(m.what);
      if (!k) continue;
      const cur = map.get(k);
      if (!cur) {
        map.set(k, { what: m.what, when: m.when || '', target: m.target || '' });
      } else {
        if (!cur.when && m.when) cur.when = m.when;
        if (!cur.target && m.target) cur.target = m.target;
      }
    }
  }
  return [...map.values()];
}

/**
 * Тайминг маркера: когда сдавать (для подписей «когда» в UI).
 * Возвращает null, если маркер неизвестен движку (честно, без выдумки).
 */
const MARKER_TIMING: Array<{ re: RegExp; when: string }> = [
  { re: /лп\(a\)|lp\(a\)/i, when: 'Один раз в жизни (baseline K0)' },
  { re: /гомоцистеин|homocysteine|hcy/i, when: 'Baseline K0 + каждые 8–12 нед (K3) + PCT (K6)' },
  { re: /апов|apob/i, when: 'Baseline K0 + каждые 8–12 нед (K3)' },
  { re: /hs-crp|срб/i, when: 'Baseline K0 + каждые 8–12 нед (K3)' },
  { re: /hct|гематокрит/i, when: 'Baseline K0 + каждые 4 нед (K2); TRT — каждые 8–12 нед (K5)' },
  { re: /e2|эстрадиол|estradiol/i, when: 'Каждые 4 нед (K2); середина недели, 48 ч после инъекции' },
  { re: /prl|пролактин|prolactin/i, when: 'Каждые 4 нед при 19-nor (K2)' },
  { re: /алт|аст|alt|ast/i, when: 'Оралы — каждые 2 нед (K1); иначе каждые 4 нед (K2)' },
  { re: /psa|пса/i, when: 'Baseline K0 (≥40 лет); TRT — каждые 8–12 нед (K5)' },
  { re: /спермограмма|semen/i, when: 'Baseline + каждые 6–8 нед; итог через 3–6 мес OFF (K7)' },
  { re: /igf-?1|ифр/i, when: 'Baseline + каждые 6–8 нед при GH (K2)' },
  { re: /hba1c|гликирован/i, when: 'Baseline + каждые 12 нед при GH/GLP-1 (K2/K3)' },
  { re: /lh|fsh|лг|фсг/i, when: 'Baseline K0 + PCT нед 2/6 (K6); на курсе не сдавать' },
  { re: /d-?димер|d-?dimer/i, when: 'При HCT>52% и в K3; экстренно при ТГВ-симптомах (K8)' },
];

export function labTimingFor(marker: string): string | null {
  const m = String(marker || '');
  if (!m) return null;
  for (const t of MARKER_TIMING) {
    if (t.re.test(m)) return t.when;
  }
  return null;
}
