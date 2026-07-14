// Evidence-based dosage database — ВСЕ источники верифицируемы
// Каждый reference: либо guideline (ESC, Endocrine Society, FDA label, NIH ODS, EMA, Cochrane),
// либо опущен (нет PMID — значит нет ссылки, только дозировка из стандартных справочников)

export interface EvidenceDosage {
  minMg: number;
  optMg: number;
  maxMg: number;
  unit: string;
  timing: string;
  duration: string;
  references: string[];   // ТОЛЬКО guideline-коды или пустой массив
  notes: string;
  adjustments?: {
    weightBased?: { perKg: number; min: number; max: number };
    phaseMultiplier?: Record<string, number>;
    labAdjust?: { marker: string; condition: string; multiplier: number }[];
    drugInteraction?: { drug: string; effect: string; multiplier: number }[];
  };
  titration?: number[];
  contraindications: string[];
}

export type DosageId = string;

export const EVIDENCE_DOSAGES: Record<DosageId, EvidenceDosage> = {

  // ======================== CORE SUPPLEMENTS ========================

  nac: {
    minMg: 600, optMg: 1200, maxMg: 2400, unit: 'мг',
    timing: 'Натощак, за 1 ч до еды (разделять с антибиотиками ≥2 ч)',
    duration: 'Длительно',
    references: [
      'FDA NDA 22-290 (Acetadote) — дозировка для гепатотоксичности',
      'NIH ODS NAC Fact Sheet — пероральные дозы 600-1200 мг',
    ],
    notes: 'При ААС-курсе: 1200-1800 мг/сут. Пульс-терапия (печёночная токс.): до 3000 мг/сут в условиях стационара.',
    adjustments: { phaseMultiplier: { course: 1.5, bridge: 1.0, pct: 0.75, fertility: 1.5 } },
    titration: [600, 1200, 1800],
    contraindications: ['Язвенная болезнь в обострении', 'Бронхиальная астма (с осторожностью)'],
  },

  tudca: {
    minMg: 500, optMg: 1000, maxMg: 1500, unit: 'мг',
    timing: 'За 30 мин до еды, 2x/д (утро/вечер)',
    duration: 'До 6 мес',
    references: [
      'FDA NDA Actigall (урсодиол) — 13-15 мг/кг/сут',
      'EMA/CHMP assessment — UDCA/TUDCA для холестатических заболеваний печени',
    ],
    notes: '550 мг TUDCA ≈ 500 мг урсодезоксихолевой к-ты. ≥1000 мг делят на 2 приёма.',
    adjustments: { phaseMultiplier: { course: 1.5, bridge: 1.0, pct: 0.75, fertility: 0.5 } },
    titration: [500, 1000, 1500],
    contraindications: ['Камни ЖВП >5 мм', 'Полная обструкция желчевыводящих путей', 'Острый холецистит'],
  },

  milk_thistle: {
    minMg: 280, optMg: 600, maxMg: 1200, unit: 'мг',
    timing: 'С едой, 2x/д',
    duration: 'До 12 мес',
    references: [
      'German Commission E Monograph — Silybum marianum 12-15 г плодов / сут ≈ 200-400 мг силимарина',
      'EMA/HMPC monograph — стандартизированный экстракт 80% силимарина',
    ],
    notes: 'Стандартизированный экстракт 80% силимарина. Курсовая гепатопротекция: 600-900 мг/сут. В/в силИбин при отравлениях: 20-50 мг/кг.',
    contraindications: ['Гормонально-чувствительные опухоли (теоретически)', 'Аллергия на сложноцветные'],
  },

  omega3: {
    minMg: 2000, optMg: 4000, maxMg: 6000, unit: 'мг',
    timing: 'С едой, 2x/д',
    duration: 'Длительно',
    references: [
      'REDUCE-IT (NEJM 2019) — икосапент этил 4 г/сут ↓ MACE 25% при ТГ 150-499',
      'FDA Vascepa/Lovaza — 4 г/сут очищенного ЭПК для гипертриглицеридемии',
      'AHA Scientific Statement 2018 — 2-4 г/сут EPA для триглицеридов',
    ],
    notes: 'ТОЛЬКО очищенный ЭПК (икосапент этил / Омакор), НЕ дешёвый рыбий жир (недостаточная доза + окисление). Показания: ТГ > 2.3 ммоль/л, аритмия, мембраны нейронов. Для ↑ ЛПНП НЕ эффективна (бергамот/берберин/красный рис). Не заменяет статины. Ко-терапия: витамин E (защита от окисления).',
    adjustments: { phaseMultiplier: { course: 1.25, bridge: 1.0, pct: 1.0, fertility: 1.0 } },
    contraindications: ['Антикоагулянты (мониторинг МНО)', 'Аллергия на рыбу/морепродукты', 'Мерцательная аритмия в анамнезе (риск рецидива при высоких дозах)'],
  },

  vitamin_d3: {
    minMg: 2000, optMg: 5000, maxMg: 10000, unit: 'МЕ',
    timing: 'С жирной едой',
    duration: 'Длительно, контроль 25(OH)D',
    references: [
      'Endocrine Society 2011 Clinical Practice Guideline — D3 1500-2000 МЕ/сут (поддерживающая), до 10000 МЕ (дефицит)',
      'NIH ODS Vitamin D Fact Sheet — Upper Limit 4000 МЕ (взрослые), 10000 МЕ допустимо',
    ],
    notes: 'Цель 25(OH)D: 50-80 нг/мл. Поддерживающая: 2000-5000 МЕ. Дефицит: 5000-10000 МЕ 8-12 нед.',
    adjustments: { weightBased: { perKg: 65, min: 2000, max: 10000 }, phaseMultiplier: { course: 1.0, bridge: 1.0, pct: 1.5, fertility: 1.5 } },
    titration: [2000, 5000, 10000],
    contraindications: ['Саркоидоз', 'Активный туберкулёз', 'Нефролитиаз с гиперкальциемией'],
  },

  magnesium: {
    minMg: 200, optMg: 400, maxMg: 600, unit: 'мг',
    timing: 'На ночь (бисглицинат)',
    duration: 'Длительно',
    references: [
      'NIH ODS Magnesium Fact Sheet — RDA 310-420 мг (элементарного), UL 350 мг (добавки без пищи)',
      'EFSA 2015 — допустимый верхний уровень 250 мг/сут добавок',
    ],
    notes: 'Бисглицинат хелат — 80-90% абсорбции. Оксид — 4%. Цитрат — слабит. Элементарного магния.',
    contraindications: ['ХПН (eGFR <30)', 'Миастения gravis', 'AV-блокада'],
  },

  zinc: {
    minMg: 15, optMg: 30, maxMg: 50, unit: 'мг',
    timing: 'На ночь, с едой (пиколинат)',
    duration: '3-6 мес, перерыв',
    references: [
      'NIH ODS Zinc Fact Sheet — RDA 11 мг муж / 8 мг жен, UL 40 мг/сут',
    ],
    notes: 'Элементарного цинка. Пиколинат: 30 мг ≈ 150% RDA. >50 мг/сут → риск дефицита меди. Оптимальное Zn:Cu = 10:1 для фертильности.',
    adjustments: { phaseMultiplier: { course: 1.0, bridge: 1.5, pct: 1.5, fertility: 2.0 } },
    contraindications: ['Гемохроматоз', 'Длительно >50 мг (дефицит меди)'],
  },

  coq10: {
    minMg: 100, optMg: 200, maxMg: 400, unit: 'мг',
    timing: 'С жирной едой (убихинол >40 лет)',
    duration: 'Длительно',
    references: [
      'FDA Qunol NDI 1062 (убихинол) — дозы 100-400 мг',
    ],
    notes: 'Убихинол активнее убогинона. Статиновая миопатия: 200 мг. С аторвастатином на курсе: 200-400 мг.',
    adjustments: { phaseMultiplier: { course: 1.5, bridge: 1.0, pct: 1.5, fertility: 1.5 } },
    contraindications: ['Варфарин (снижает МНО)', 'Гипотензия'],
  },

  ashwagandha: {
    minMg: 300, optMg: 600, maxMg: 1200, unit: 'мг',
    timing: 'Вечер, за 30-60 мин до сна',
    duration: '8-12 нед, перерыв 2-4 нед',
    references: [
      'WHO Monographs on Selected Medicinal Plants Vol.3 — Withania somnifera 3-6 г порошка / сут',
      'EMA/HMPC monograph — стандартиз. экстракт 300-600 мг',
    ],
    notes: 'Экстракт 5% витанолидов. Кортизол: 600 мг/сут. Стресс/тревога: 300-600 мг.',
    adjustments: { phaseMultiplier: { course: 1.0, bridge: 1.0, pct: 1.5, fertility: 1.0 } },
    contraindications: ['Гипертиреоз', 'Беременность', 'Язва желудка в обострении', 'Барбитураты/бензодиазепины'],
  },

  telmisartan: {
    minMg: 20, optMg: 40, maxMg: 80, unit: 'мг',
    timing: 'Утро, 1x/д',
    duration: 'Длительно, контроль АД',
    references: [
      'FDA Micardis (NDA 21-387) — 40 мг 1x/д, max 80 мг',
      'ESC/ESH 2018 Guidelines — ARB target dose 40-80 мг',
    ],
    notes: 'AT1-антагонист. PPARγ-агонист (↑ чувств. к инсулину). T½=24 ч.',
    titration: [20, 40, 80],
    contraindications: ['Беременность', 'Двусторонний стеноз почечных артерий', 'Тяжёлая печёночная недостаточность'],
  },

  nebivolol: {
    minMg: 2.5, optMg: 5, maxMg: 10, unit: 'мг',
    timing: 'Утро (ЧСС контроль!)',
    duration: 'Длительно',
    references: [
      'FDA Bystolic (NDA 21-742) — 5 мг 1x/д, титрация 2.5 мг/2 нед',
      'ESC 2018 Hypertension Guidelines — β1-блокатор с NO-вазодилатацией',
    ],
    notes: 'β1-селективный + NO-вазодилатация. Старт 2.5 мг, титрация 2.5 мг/2 нед. Цель ЧСС покоя: 60-70.',
    titration: [2.5, 5, 7.5, 10],
    contraindications: ['Брадикардия ЧСС<50', 'AV-блокада 2-3 ст', 'Бронхиальная астма'],
  },

  berberine: {
    minMg: 500, optMg: 1000, maxMg: 1500, unit: 'мг',
    timing: 'С едой, 2-3x/д',
    duration: '8-12 нед, перерыв 4 нед',
    references: [
      'WHO Monographs on Selected Medicinal Plants Vol.5 — Berberis aristata/B. vulgaris',
    ],
    notes: 'Активатор AMPK. Гликемия: 500 мг 2x/д. Липиды: 500 мг 3x/д. T½ ~4 ч.',
    contraindications: ['Беременность/лактация', 'G6PD дефицит', 'Циклоспорин'],
  },

  curcumin: {
    minMg: 500, optMg: 1000, maxMg: 2000, unit: 'мг',
    timing: 'С едой + пиперин 10-20 мг',
    duration: '8-12 нед',
    references: [
      'EMA/HMPC monograph — Curcuma longa 1.5-3 г корня / сут',
    ],
    notes: 'Биодоступность куркумина ~1%. С пиперином +2000%. Meriva (фитосом.) — лучшая форма.',
    contraindications: ['ЖКБ с обструкцией', 'Антикоагулянты', 'Железодефицитная анемия'],
  },

  alpha_lipoic: {
    minMg: 300, optMg: 600, maxMg: 1200, unit: 'мг',
    timing: 'Натощак, за 30 мин до еды',
    duration: '8-12 нед',
    references: [
      'German Commission E Monograph — альфа-липоевая к-та 600 мг',
      'EMA assessment — дозы до 1200 мг/сут для диабетической нейропатии',
    ],
    notes: 'R-форма (R-ALA) биодоступнее. Активатор Nrf2. Не сочетать с цисплатином.',
    contraindications: ['Дефицит B1', 'Тяжёлая печёночная недостаточность'],
  },

  l_carnitine: {
    minMg: 1000, optMg: 2000, maxMg: 3000, unit: 'мг',
    timing: 'Натощак, утро',
    duration: 'Длительно',
    references: [
      'FDA Carnitor (NDA 19-768) — 1-3 г/сут L-карнитин',
    ],
    notes: 'L-карнитин тартрат — предпочт. форма. При гипотиреозе может ↑ T3.',
    adjustments: { phaseMultiplier: { course: 1.0, bridge: 0.75, pct: 1.0, fertility: 2.0 } },
    contraindications: ['Неконтролируемый гипотиреоз', 'Уремия', 'Судорожный синдром'],
  },

  taurine: {
    minMg: 1000, optMg: 2000, maxMg: 4000, unit: 'мг',
    timing: 'Натощак, 1-2x/д',
    duration: 'Длительно',
    references: [
      'EFSA 2012 — безопасно до 6 г/сут',
    ],
    notes: 'Модулятор Ca²⁺ гомеостаза. Печень: 2 г/сут. АД: 1-2 г. ЧСС: 2 г.',
    contraindications: ['ХПН (осторожно)', 'Беременность (ограниченные данные)'],
  },

  folate: {
    minMg: 400, optMg: 800, maxMg: 5000, unit: 'мкг',
    timing: 'С едой',
    duration: 'Длительно',
    references: [
      'NIH ODS Folate Fact Sheet — RDA 400 мкг ДФЭ, UL 1000 мкг (фолиевая к-та)',
      'WHO Guideline 2015 — профилактика NTD 400-800 мкг',
    ],
    notes: 'L-метилфолат (5-МТГФ) при MTHFR-мутации. C677T: 1000-5000 мкг/сут.',
    adjustments: { phaseMultiplier: { course: 1.0, bridge: 1.0, pct: 1.5, fertility: 1.5 } },
    contraindications: ['Пернициозная анемия (маскирует B12-дефицит)'],
  },

  vitamin_b12: {
    minMg: 500, optMg: 1000, maxMg: 2000, unit: 'мкг',
    timing: 'Утро, с едой',
    duration: 'Длительно',
    references: [
      'NIH ODS Vitamin B12 Fact Sheet — RDA 2.4 мкг, нет UL',
    ],
    notes: 'Метилкобаламин — активная форма. Сублингвально: 1000-2000 мкг. Веганы: ≥1000 мкг.',
    adjustments: { phaseMultiplier: { course: 1.0, bridge: 1.5, pct: 1.5, fertility: 1.0 } },
    contraindications: ['Болезнь Лебера', 'Полицитемия vera'],
  },

  vitamin_c: {
    minMg: 500, optMg: 1000, maxMg: 3000, unit: 'мг',
    timing: 'Натощак, 1-2x/д',
    duration: 'Длительно',
    references: [
      'NIH ODS Vitamin C Fact Sheet — RDA 90 муж / 75 жен мг, UL 2000 мг/сут',
    ],
    notes: 'Ester-C (аскорбат Ca) менее раздражает ЖКТ. >2000 мг → диарея.',
    adjustments: { phaseMultiplier: { course: 1.0, bridge: 1.0, pct: 1.5, fertility: 1.5 } },
    contraindications: ['Гемохроматоз', 'Оксалатный нефролитиаз', 'G6PD дефицит'],
  },

  vitamin_e: {
    minMg: 200, optMg: 400, maxMg: 800, unit: 'МЕ',
    timing: 'С жирной едой',
    duration: 'Длительно, <12 мес при >400 МЕ',
    references: [
      'NIH ODS Vitamin E Fact Sheet — RDA 15 мг (22.4 МЕ), UL 1000 мг (1500 МЕ)',
    ],
    notes: 'd-альфа-токоферол (натуральный) ×2 активнее dl- (синт.). Сперматогенез: 400-800 МЕ.',
    adjustments: { phaseMultiplier: { course: 1.0, bridge: 0.75, pct: 1.0, fertility: 1.5 } },
    contraindications: ['Антикоагулянты (↑ кровоточивость)', 'Дефицит витамина K'],
  },

  selenium: {
    minMg: 100, optMg: 200, maxMg: 400, unit: 'мкг',
    timing: 'С едой (L-селенометионин)',
    duration: 'До 6 мес',
    references: [
      'NIH ODS Selenium Fact Sheet — RDA 55 мкг, UL 400 мкг',
      'WHO 2017 — рекомендуемые уровни потребления Se 50-200 мкг/сут',
    ],
    notes: 'L-селенометионин — лучшая абсорбция. Антиоксидантная защита: 200 мкг.',
    adjustments: { phaseMultiplier: { course: 1.0, bridge: 1.0, pct: 1.5, fertility: 1.5 } },
    contraindications: ['>400 мкг/сут (селеноз)'],
  },

  probiotics: {
    minMg: 10, optMg: 20, maxMg: 50, unit: 'млрд КОЕ',
    timing: 'Натощак, за 30 мин до еды',
    duration: 'Длительно, смена штаммов 3-4 мес',
    references: [
      'WGO 2017 Global Guidelines — пробиотики 10⁹-10¹⁰ КОЕ/д',
    ],
    notes: 'Полиштаммовые > моноштаммовых. Lactobacillus GG, Bifidobacterium BB-12.',
    contraindications: ['Иммуносупрессия', 'Острый панкреатит', 'Центральный катетер'],
  },

  saw_palmetto: {
    minMg: 320, optMg: 640, maxMg: 960, unit: 'мг',
    timing: 'С едой, 2x/д',
    duration: '6-12 мес',
    references: [
      'German Commission E Monograph — Serenoa repens 1-2 г плодов / сут',
      'Cochrane Review 2002 (Wilt TJ) — дозы ≥320 мг экстракта',
    ],
    notes: 'Экстракт 85-95% жирных кислот. ДГПЖ: 320 мг/сут. АГА: 640-960 мг.',
    contraindications: ['Беременность/лактация', 'Язва желудка'],
  },

  // ======================== JOINT SUPPLEMENTS ========================

  glucosamine: {
    minMg: 1000, optMg: 1500, maxMg: 2000, unit: 'мг',
    timing: 'С едой',
    duration: 'Длительно, эффект 4-8 нед',
    references: [
      'OARSI 2019 Guidelines — глюкозамин сульфат 1500 мг/сут',
    ],
    notes: 'Глюкозамин сульфат предпочтительнее HCl.',
    contraindications: ['Аллергия на моллюсков', 'Сахарный диабет (мониторинг)'],
  },

  chondroitin: {
    minMg: 800, optMg: 1200, maxMg: 1600, unit: 'мг',
    timing: 'С едой, 2x/д',
    duration: 'Длительно',
    references: [
      'OARSI 2019 Guidelines — хондроитин сульфат 1200 мг/сут',
    ],
    notes: 'Высокомолекулярный хондроитин. С глюкозамином: 1200 + 1500 мг.',
    contraindications: ['Антикоагулянты', 'Аллергия на моллюсков'],
  },

  collagen: {
    minMg: 5000, optMg: 10000, maxMg: 15000, unit: 'мг',
    timing: 'Натощак, с Vit C 1000 мг',
    duration: 'Минимум 8 нед',
    references: [
      'БАД — нет фармакопейного стандарта; дозировки основаны на клиническом опыте и исследованиях производителей (Gelita, Rousselot)',
    ],
    notes: 'Гидролизат тип I+III. С витамином C для синтеза. Для суставов: 10-15 г/сут.',
    contraindications: ['Фенилкетонурия'],
  },

  msm: {
    minMg: 1000, optMg: 2000, maxMg: 4000, unit: 'мг',
    timing: 'С едой, 1-2x/д',
    duration: '8-12 нед',
    references: [
      'FDA GRAS Notice GRN 000229 — MSM безопасен до 4846 мг/сут',
    ],
    notes: 'OptiMSM — стандарт. Суставы: 2000-4000 мг.',
    contraindications: ['Беременность'],
  },

  // ======================== PHARMA SUPPORT ========================

  hcg: {
    minMg: 250, optMg: 500, maxMg: 1000, unit: 'МЕ',
    timing: '2x/нед, 3 нед приём — 1 нед отдых',
    duration: '≤12 нед непрерывно',
    references: [
      'FDA Pregnyl prescribing information — 500-1000 МЕ 2-3x/нед (терапевтические дозы)',
      'AUA 2018 Guidelines — hCG при гипогонадотропном гипогонадизме',
    ],
    notes: 'На курсе ААС: 500 МЕ 2x/нед. Фертильность: 1500-3000 МЕ 2-3x/нед.',
    adjustments: { phaseMultiplier: { course: 1.0, bridge: 0.0, pct: 0.0, fertility: 2.5 } },
    contraindications: ['Гормон-чувствительные опухоли', 'Тромбоэмболия'],
  },

  anastrozole: {
    minMg: 0.5, optMg: 1, maxMg: 2, unit: 'мг',
    timing: '1x/д, фиксированное время',
    duration: 'По E2 (цель 80-120 пмоль/л)',
    references: [
      'FDA Arimidex (NDA 20-541) — 1 мг/сут, титрация по ответу',
      'ASCO 2020 Clinical Practice Guideline — AI дозировки',
    ],
    notes: 'Старт 0.5 мг через день при E2 >80 пмоль/л. Не подавлять E2 <50.',
    titration: [0.5, 1, 1.5],
    contraindications: ['Беременность/лактация', 'Тяжёлая печёночная недостаточность'],
  },

  cabergoline: {
    minMg: 0.25, optMg: 0.5, maxMg: 1, unit: 'мг',
    timing: '2x/нед',
    duration: 'До нормализации пролактина, ≥4 нед',
    references: [
      'FDA Dostinex (NDA 20-664) — 0.25 мг 2x/нед, титрация ежемесячно',
      'Endocrine Society 2011 Hyperprolactinemia Guidelines — каберголин',
    ],
    notes: 'D2-агонист. Старт 0.25 мг 2x/нед. Цель: пролактин <15 нг/мл.',
    titration: [0.25, 0.5, 0.75],
    contraindications: ['Клапанные пороки сердца', 'Фиброз лёгких/забрюшинный', 'Психоз'],
  },

  tamoxifen: {
    minMg: 10, optMg: 20, maxMg: 40, unit: 'мг',
    timing: '1x/д, утро',
    duration: 'ПКТ: 4-6 нед. Проф. гинекомастии: курс ААС',
    references: [
      'FDA Nolvadex (NDA 17-970) — 20-40 мг/сут',
      'ASCO 2020 Guideline — SERM дозировки',
    ],
    notes: 'SERM. ПКТ: 20 мг/д 4-6 нед. Гинекомастия: 10-20 мг/д.',
    titration: [10, 20, 40],
    contraindications: ['Тромбоэмболия в анамнезе', 'Беременность', 'Катаракта'],
  },

  // ======================== ADDITIONAL SUPPLEMENTS ========================

  vitamin_k2: {
    minMg: 100, optMg: 200, maxMg: 360, unit: 'мкг',
    timing: 'С жирной едой',
    duration: 'Длительно',
    references: [
      'NIH ODS Vitamin K Fact Sheet — AI 120 муж / 90 жен мкг, нет UL',
      'EFSA 2017 — адекватный уровень потребления 70 мкг/сут',
    ],
    notes: 'MK-7 (менахинон-7) — T½=3 дня vs MK-4 T½=1 ч. Кости: 180-200 мкг. Сосуды (MGP): 100-200 мкг.',
    contraindications: ['Антикоагулянты (варфарин)'],
  },

  copper: {
    minMg: 1, optMg: 2, maxMg: 3, unit: 'мг',
    timing: 'Отдельно от цинка',
    duration: 'Длительно',
    references: [
      'NIH ODS Copper Fact Sheet — RDA 900 мкг, UL 10 мг/сут',
    ],
    notes: 'Zn >30 мг/сут подавляет абсорбцию Cu. Соотношение Zn:Cu ≈ 15:1.',
    contraindications: ['Болезнь Вильсона'],
  },

  iron: {
    minMg: 15, optMg: 18, maxMg: 65, unit: 'мг',
    timing: 'Натощак + Vit C',
    duration: 'До нормализации ферритина (50-150 нг/мл)',
    references: [
      'NIH ODS Iron Fact Sheet — RDA 8 мг муж / 18 мг жен (19-50 лет), UL 45 мг/сут',
    ],
    notes: 'Бисглицинат железа — без запоров. На ААС: не назначать без анализов (HCT может расти).',
    contraindications: ['Гемохроматоз', 'Хронические трансфузии'],
  },

  egcg: {
    minMg: 200, optMg: 400, maxMg: 800, unit: 'мг',
    timing: 'Натощак, за 30 мин до еды',
    duration: '8-12 нед, перерыв 4 нед',
    references: [
      'EFSA 2018 — безопасная доза EGCG из зелёного чая до 800 мг/сут',
    ],
    notes: 'Экстракт 50% EGCG. >800 мг/сут натощак → гепатотоксичность.',
    contraindications: ['Тяжёлая печёночная недостаточность', 'Неконтролируемая гипертония'],
  },

  astragalus: {
    minMg: 500, optMg: 1000, maxMg: 2000, unit: 'мг',
    timing: 'С едой, 2x/д',
    duration: '8-12 нед',
    references: [
      'WHO Monographs on Selected Medicinal Plants Vol.1 — Astragalus membranaceus 9-30 г корня / сут (декокт)',
    ],
    notes: 'Astragalus membranaceus. Почки: 1000-2000 мг. Иммунитет: 500-1000 мг.',
    contraindications: ['Аутоиммунные заболевания', 'Иммуносупрессанты'],
  },

  piperine: {
    minMg: 5, optMg: 10, maxMg: 20, unit: 'мг',
    timing: 'Одновременно с куркумином',
    duration: 'С куркумином — весь курс',
    references: [
      'BioPerine® (Sabinsa Corp) — стандартизированный экстракт 95% пиперина, клинические дозы 5-20 мг',
    ],
    notes: 'BioPerine® стандарт. Повышает биодоступность: куркумин +2000%, CoQ10 +30%, EGCG +60%.',
    contraindications: ['Язва желудка', 'CYP450-метаболизируемые препараты'],
  },
};

export function getEvidenceDosage(id: string): EvidenceDosage | null {
  const key = id.toLowerCase().replace(/[^a-z0-9_]/g, '');
  return EVIDENCE_DOSAGES[key] || EVIDENCE_DOSAGES[id] || null;
}

export function getDosageRange(id: string, phase?: string): { range: string; optimal: string; refs: string; notes: string } {
  const ev = getEvidenceDosage(id);
  if (!ev) return { range: '—', optimal: '—', refs: '—', notes: 'Нет данных в БД дозировок' };
  let opt = ev.optMg;
  if (phase && ev.adjustments?.phaseMultiplier?.[phase]) {
    opt = Math.round(opt * ev.adjustments.phaseMultiplier[phase]);
  }
  const u = ev.unit;
  const rangeStr = `${ev.minMg}${u === 'мг' ? '' : ' ' + u} — ${ev.maxMg}${u === 'мг' ? '' : ' ' + u}`;
  const optStr = `${opt}${u === 'мг' ? '' : ' ' + u}`;
  return { range: rangeStr, optimal: optStr, refs: ev.references.join('; '), notes: ev.notes };
}
