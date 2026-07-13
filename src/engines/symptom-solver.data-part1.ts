import type { SymptomEntry } from './symptom-solver.types';

export const DB_PART1: SymptomEntry[] = [
  // ═══ СЕРДЕЧНО-СОСУДИСТАЯ ═══
  {
    id: 'hypertension', symptom: 'Повышенное АД (гипертензия)', category: 'cardiovascular',
    generalInfo: 'Наиболее частый кардиоваскулярный побочный эффект ААС. Обусловлен задержкой Na⁺/H₂O (минералокортикоидный эффект), активацией РААС, ↑ эритроцитарной массы. Распространённость: 40-60% на курсе.',
    problems: [
      {
        problem: 'Задержка Na⁺ и воды (минералокортикоидный эффект ААС)', probability: 'high',
        mechanism: 'Активация РААС → альдостерон ↑ → ↑ реабсорбция Na⁺ в дистальных канальцах → ↑ ОЦК → ↑ АД. Наиболее выражено у тестостерона, оксиметолона, нандролона.',
        stopCriteria: ['АД ≥180/110 мм рт.ст. — НЕМЕДЛЕННО прекратить стимуляторы (кленбутерол, T3, эфедрин)', 'АД ≥160/100 + головная боль/тошнота/нарушение зрения — прекратить все ААС + срочно АД-контроль', 'Гипертонический криз (АД ≥180/120) — экстренная госпитализация'],
        labMarkers: [
          { marker: 'АД (сист./диаст.)', expectedChange: '↑', targetRange: '<130/85 мм рт.ст.', when: 'Ежедневно утром и вечером' },
          { marker: 'Ренин плазмы', expectedChange: '↑', targetRange: '2.8-39.9 мкМЕ/мл', when: 'До курса, каждые 8 нед' },
          { marker: 'Альдостерон', expectedChange: '↑', targetRange: '40-310 пг/мл', when: 'При стойкой гипертензии' },
          { marker: 'Na⁺, K⁺ сыворотки', expectedChange: '↑', targetRange: 'Na⁺ 135-145, K⁺ 3.5-5.1 ммоль/л', when: 'Каждые 4 нед' },
        ],
        solutions: [
          { substanceId: 'telmisartan', name: 'Телмисартан', type: 'pharma', dose: '40-80 мг/сут', mechanism: 'ARB + PPARγ-агонизм', evidenceLevel: 'A' },
          { substanceId: 'nebivolol', name: 'Небиволол', type: 'pharma', dose: '2.5-5 мг/сут', mechanism: 'β1-блокада + NO-вазодилатация', evidenceLevel: 'A' },
          { substanceId: 'magnesium', name: 'Магния цитрат/глицинат', type: 'supplement', dose: '400-600 мг/сут', mechanism: 'Природный Ca²⁺-блокатор, кофактор eNOS', evidenceLevel: 'A' },
          { substanceId: 'omega3', name: 'Омега-3 (EPA/DHA)', type: 'supplement', dose: '2-4 г/сут', mechanism: '↓ тромбоксан A2, улучшение FMD', evidenceLevel: 'A' },
          { substanceId: 'potassium', name: 'Калия цитрат', type: 'supplement', dose: '1000-2000 мг/сут', mechanism: '↑ экскреция Na⁺, вазодилатация', evidenceLevel: 'B' },
          { substanceId: 'cardio_lifestyle', name: 'LISS-кардио + ↓ Na', type: 'lifestyle', dose: '30-45 мин 4-5×/нед + <3 г Na/сут', mechanism: '↓ ОЦК, улучшение барорефлекса', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '24-48 ч', effect: 'Телмисартан: начало снижения АД (пик через 4 нед)', sideNote: 'Контроль K⁺ — риск гиперкалиемии' },
          { timeline: '1-2 нед', effect: 'LISS-кардио: снижение resting АД на 5-10 мм рт.ст.' },
          { timeline: '4-8 нед', effect: 'Омега-3: улучшение FMD на 2-4%' },
        ],
      },
      {
        problem: 'Эритроцитоз и ↑ вязкость крови', probability: 'high',
        mechanism: 'ААС стимулируют эритропоэз через ↑ эндогенного EPO и чувствительности костного мозга → ↑ Hct >50% → ↑ периферическое сопротивление + риск тромбоза.',
        labMarkers: [
          { marker: 'Гематокрит (Hct)', expectedChange: '↑', targetRange: '40-50%', when: 'До курса, каждые 4-8 нед' },
          { marker: 'Гемоглобин (Hb)', expectedChange: '↑', targetRange: '130-170 г/л ♂', when: 'До курса, каждые 4-8 нед' },
          { marker: 'Ферритин', expectedChange: '↓', targetRange: '30-300 мкг/л', when: 'При Hct >52%' },
          { marker: 'D-димер', expectedChange: '↔', targetRange: '<500 нг/мл', when: 'При Hct >54%' },
        ],
        solutions: [
          { substanceId: 'aspirin', name: 'Аспирин', type: 'pharma', dose: '75-100 мг/сут', mechanism: '↓ агрегация тромбоцитов', evidenceLevel: 'A' },
          { substanceId: 'nattokinase', name: 'Наттокиназа', type: 'supplement', dose: '2000-4000 FU/сут', mechanism: 'Прямой фибринолиз', evidenceLevel: 'B' },
          { substanceId: 'therapeutic_phlebotomy', name: 'Флеботомия (при Hct>54%)', type: 'lifestyle', dose: '1×/8-12 нед', mechanism: 'Механическое ↓ эритроцитарной массы', evidenceLevel: 'A' },
          { substanceId: 'hydration', name: 'Гидратация 3-4 л/сут', type: 'lifestyle', dose: '3-4 л/сут', mechanism: 'Гемодилюция', evidenceLevel: 'B' },
        ],
        expectations: [
          { timeline: 'Немедленно', effect: 'Гидратация: ↓ вязкость на 5-8%', sideNote: 'Не пить >1 л за раз' },
          { timeline: '24-48 ч', effect: 'Флеботомия: Hct ↓ на 3-5%', sideNote: 'Риск гиповолемии' },
          { timeline: '2-4 нед', effect: 'Наттокиназа: D-димер ↓, вязкость ↓' },
        ],
      },
    ],
  },
  {
    id: 'tachycardia', symptom: 'Тахикардия / учащённое сердцебиение в покое', category: 'cardiovascular',
    generalInfo: 'Повышение ЧСС покоя >90 уд/мин на курсе. Может быть обусловлено симпатической активацией (кленбутерол, T3), электролитным дисбалансом (↓K⁺, ↓Mg²⁺), компенсаторным ответом на ↑ ОЦК.',
    problems: [
      {
        problem: 'Симпатическая гиперактивация (β2-агонисты / T3 / стимуляторы)', probability: 'high',
        mechanism: 'Кленбутерол — β2-агонист → ↑ cAMP → ↑ ЧСС. T3/T4 ↑ плотность β-рецепторов. Кофеин/эфедрин → ↑ катехоламинов.',
        labMarkers: [
          { marker: 'ЧСС покоя', expectedChange: '↑', targetRange: '60-80 уд/мин', when: 'Ежедневно утром' },
          { marker: 'FT3, FT4', expectedChange: '↔', targetRange: 'FT3 3.1-6.8, FT4 9-22 пмоль/л', when: 'При приёме тиреоидов' },
          { marker: 'K⁺, Mg²⁺', expectedChange: '↓', targetRange: 'K⁺ 3.5-5.1, Mg²⁺ 0.7-1.0', when: 'Каждые 4 нед' },
          { marker: 'ЭКГ (QTc)', expectedChange: '↔', targetRange: 'QTc <440 мс ♂', when: 'При ЧСС >100' },
        ],
        solutions: [
          { substanceId: 'nebivolol', name: 'Небиволол', type: 'pharma', dose: '2.5-5 мг/сут', mechanism: 'β1-селективная блокада', evidenceLevel: 'A' },
          { substanceId: 'magnesium', name: 'Магния таурат/глицинат', type: 'supplement', dose: '400-600 мг/сут', mechanism: 'Ca²⁺-антагонист в кардиомиоцитах', evidenceLevel: 'B' },
          { substanceId: 'taurine', name: 'Таурин', type: 'supplement', dose: '2-3 г/сут', mechanism: 'Модуляция Ca²⁺-гомеостаза', evidenceLevel: 'B' },
        ],
        expectations: [
          { timeline: '1-2 ч', effect: 'Небиволол: начало ↓ ЧСС, пик через 2-4 ч' },
          { timeline: '3-7 дней', effect: 'Магний + таурин: ↓ ЧСС покоя на 8-12 уд/мин' },
        ],
      },
    ],
  },
  {
    id: 'edema', symptom: 'Отёки (лицо, лодыжки, голени)', category: 'cardiovascular',
    generalInfo: 'Отёки на курсе ААС — признак задержки Na⁺/H₂O. Наиболее выражены у тестостерона, оксиметолона, нандролона. Дифференцировать с СН и патологией почек.',
    problems: [
      {
        problem: 'Минералокортикоидный эффект ААС', probability: 'high',
        mechanism: 'Активация РААС → альдостерон ↑ → ↑ реабсорбция Na⁺ и воды. Эстрогенный компонент также способствует задержке жидкости.',
        labMarkers: [
          { marker: 'Альдостерон', expectedChange: '↑', targetRange: '40-310 пг/мл', when: 'При выраженных отёках' },
          { marker: 'Na⁺ сыворотки', expectedChange: '↑', targetRange: '135-145 ммоль/л', when: 'Каждые 4 нед' },
          { marker: 'Креатинин', expectedChange: '↔', targetRange: '62-106 мкмоль/л', when: 'Каждые 4 нед' },
          { marker: 'E2 (эстрадиол)', expectedChange: '↑', targetRange: '20-50 пг/мл ♂', when: 'Каждые 4 нед' },
        ],
        solutions: [
          { substanceId: 'telmisartan', name: 'Телмисартан', type: 'pharma', dose: '40-80 мг/сут', mechanism: '↓ альдостерон через AT1-блокаду', evidenceLevel: 'A' },
          { substanceId: 'anastro', name: 'Анастрозол (при ↑ E2)', type: 'pharma', dose: '0.25-0.5 мг 2×/нед', mechanism: '↓ эстроген-опосредованная задержка H₂O', evidenceLevel: 'A' },
          { substanceId: 'potassium', name: 'Калия цитрат', type: 'supplement', dose: '1000-2000 мг/сут', mechanism: 'Na⁺/K⁺-обмен → натрийурез', evidenceLevel: 'B' },
          { substanceId: 'low_sodium', name: 'Ограничение Na⁺ <3 г/сут', type: 'lifestyle', dose: '<3 г/сут Na⁺', mechanism: '↓ осмоляльность плазмы → ↓ ОЦК', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '1-2 ч', effect: 'Анастрозол: начало ↓ E2 (пик 48-72 ч)', sideNote: 'Не крашить E2 в ноль' },
          { timeline: '3-7 дней', effect: 'Телмисартан + ↓ Na⁺: видимое уменьшение отёков', sideNote: 'Контроль АД и K⁺' },
        ],
      },
    ],
  },
  {
    id: 'nosebleeds', symptom: 'Носовые кровотечения', category: 'cardiovascular',
    generalInfo: 'Спонтанные носовые кровотечения на курсе — следствие ↑ АД + ↑ хрупкости капилляров. Высокое АД → разрыв сосудов в зоне Киссельбаха. ↑ Hct → ↑ вязкость → ↑ давление в микроциркуляции.',
    problems: [
      {
        problem: 'Гипертензия-индуцированное носовое кровотечение', probability: 'medium',
        mechanism: 'ААС-гипертензия + ↑ Hct → ↑ давление в капиллярах → разрыв поверхностных сосудов носовой перегородки.',
        labMarkers: [
          { marker: 'АД', expectedChange: '↑', targetRange: '<130/85 мм рт.ст.', when: 'Измерить немедленно' },
          { marker: 'Гематокрит (Hct)', expectedChange: '↑', targetRange: '40-50%', when: 'При рецидивах' },
          { marker: 'Коагулограмма (ПВ, АЧТВ)', expectedChange: '↔', targetRange: 'ПВ 11-13.5 с', when: 'При частых кровотечениях' },
        ],
        solutions: [
          { substanceId: 'bp_control', name: 'Контроль АД (см. Гипертензия)', type: 'pharma', dose: 'Телмисартан 40-80 мг', mechanism: '↓ АД → ↓ гидростатическое давление', evidenceLevel: 'A' },
          { substanceId: 'vitamin_c', name: 'Витамин C + биофлавоноиды', type: 'supplement', dose: '1000-2000 мг/сут', mechanism: 'Укрепление капиллярной стенки', evidenceLevel: 'B' },
          { substanceId: 'rutin', name: 'Рутин / Троксерутин', type: 'supplement', dose: '500-1000 мг/сут', mechanism: '↓ проницаемость капилляров', evidenceLevel: 'B' },
        ],
        expectations: [
          { timeline: '1-3 дня', effect: 'Контроль АД + вит. C: ↓ частота кровотечений' },
          { timeline: 'Немедленно', effect: 'Hct >54% + носовые кровотечения → флеботомия + контроль АД', sideNote: 'Кровотечения + головная боль + ↑ АД = риск инсульта' },
        ],
      },
    ],
  },

  // ═══ ПЕЧЕНЬ ═══
  {
    id: 'liver_pain', symptom: 'Боль / тяжесть в правом подреберье', category: 'hepatic',
    generalInfo: 'Серьёзный симптом на курсе ААС. Частая причина — холестаз от 17α-алкилированных ААС (оксиметолон, метандиенон, станозолол). Реже — гепатит, стеатоз. Требует немедленного обследования.',
    problems: [
      {
        problem: 'Холестаз (17α-алкилированные ААС)', probability: 'high',
        mechanism: '17α-алкилирование ингибирует BSEP (bile salt export pump) → нарушение оттока желчи → внутрипечёночный холестаз → цитолиз + боль.',
        labMarkers: [
          { marker: 'АЛТ', expectedChange: '↑', targetRange: '<40 Ед/л ♂', when: 'До курса, каждые 2-4 нед на ор. ААС' },
          { marker: 'АСТ', expectedChange: '↑', targetRange: '<40 Ед/л ♂', when: 'До курса, каждые 2-4 нед' },
          { marker: 'ГГТ', expectedChange: '↑↑↑', targetRange: '<55 Ед/л ♂', when: 'Каждые 4 нед' },
          { marker: 'ЩФ', expectedChange: '↑↑', targetRange: '<150 Ед/л', when: 'Каждые 4 нед' },
          { marker: 'Билирубин общий', expectedChange: '↑', targetRange: '<21 мкмоль/л', when: 'Каждые 4 нед' },
          { marker: 'УЗИ печени + желчного', expectedChange: '↔', targetRange: 'Норма', when: 'До курса, при болях' },
        ],
        solutions: [
          { substanceId: 'tudca', name: 'TUDCA', type: 'supplement', dose: '500-1000 мг/сут', mechanism: '↑ BSEP → улучшение желчеоттока + ↓ ER-стресс', evidenceLevel: 'A' },
          { substanceId: 'nac', name: 'NAC', type: 'supplement', dose: '1200-2400 мг/сут', mechanism: 'Предшественник глутатиона → детоксикация', evidenceLevel: 'A' },
          { substanceId: 'milk_thistle', name: 'Расторопша (силимарин 80%)', type: 'supplement', dose: '280-560 мг/сут', mechanism: 'Стабилизация мембран гепатоцитов + регенерация', evidenceLevel: 'A' },
          { substanceId: 'alpha_lipoic', name: 'R-ALA', type: 'supplement', dose: '300-600 мг/сут', mechanism: 'Активатор Nrf2/ARE', evidenceLevel: 'B' },
        ],
        expectations: [
          { timeline: '3-7 дней', effect: 'TUDCA 500 мг: ↓ ГГТ на 15-25%', sideNote: 'Может послабить стул первые 2 нед' },
          { timeline: '1-2 нед', effect: 'NAC 1200 мг: нормализация АЛТ/АСТ', sideNote: 'Интервал с антибиотиками ≥2 ч' },
          { timeline: '2-4 нед', effect: 'Силимарин: ↓ АЛТ на 30-40%', sideNote: 'Влияет на CYP3A4' },
          { timeline: 'Немедленно', effect: 'АЛТ >3× ВГН — ОТМЕНИТЬ 17α-алкилированные ААС. Боль + желтуха → urgent care' },
        ],
      },
    ],
  },
  {
    id: 'jaundice', symptom: 'Желтушность склер / кожи / тёмная моча', category: 'hepatic',
    urgency: 'critical',
    generalInfo: 'ЭКСТРЕННЫЙ симптом. Указывает на тяжёлый холестаз или гепатоцеллюлярное повреждение. Тёмная моча = ↑ прямой билирубин (холестаз). Обесцвеченный стул = обструкция. Немедленная отмена гепатотоксичных препаратов + врач.',
    problems: [
      {
        problem: 'Выраженный холестаз / лекарственный гепатит', probability: 'medium',
        mechanism: 'Массивное повреждение гепатоцитов или блокада желчеоттока → ↑ билирубин. ГГТ >5× ВГН. АЛТ >5-10× ВГН с ↑ билирубина — тяжёлое повреждение.',
        labMarkers: [
          { marker: 'Билирубин общий + прямой', expectedChange: '↑↑', targetRange: 'Общий <21, прямой <5 мкмоль/л', when: 'НЕМЕДЛЕННО' },
          { marker: 'АЛТ, АСТ, ГГТ, ЩФ', expectedChange: '↑↑↑', targetRange: 'АЛТ <40, ГГТ <55', when: 'НЕМЕДЛЕННО' },
          { marker: 'УЗИ печени', expectedChange: '↔', targetRange: 'Без обструкции', when: 'НЕМЕДЛЕННО' },
        ],
        solutions: [
          { substanceId: 'tudca', name: 'TUDCA (под контролем врача)', type: 'supplement', dose: '1000-1500 мг/сут', mechanism: 'Замещение токсичных желчных кислот', evidenceLevel: 'A' },
          { substanceId: 'stop_aas', name: 'НЕМЕДЛЕННАЯ ОТМЕНА всех ААС', type: 'lifestyle', dose: '—', mechanism: 'Устранение источника гепатотоксичности', evidenceLevel: 'A' },
          { substanceId: 'hospital', name: 'Госпитализация', type: 'lifestyle', dose: '—', mechanism: 'Мониторинг, инфузия, исключение ОПечН', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '24-72 ч', effect: 'После отмены ААС + TUDCA: ↓ ГГТ, ↓ билирубин', sideNote: 'Билирубин может расти 1-2 дня после отмены' },
          { timeline: '1-2 нед', effect: 'Нормализация билирубина при холестатической картине' },
          { timeline: 'Немедленно', effect: 'Тёмная моча + обесцвеченный стул + боль = обструкция → скорую' },
        ],
      },
    ],
  },

  // ═══ ПОЧКИ ═══
  {
    id: 'foamy_urine', symptom: 'Пенистая моча (протеинурия)', category: 'renal',
    generalInfo: 'Классический признак протеинурии. На курсе ААС — следствие гиперфильтрации (↑ СКФ), повреждения подоцитов (тренболон), либо ФСГС. Требует количественной оценки.',
    problems: [
      {
        problem: 'Гиперфильтрация и протеинурия на курсе ААС', probability: 'medium',
        mechanism: 'ААС ↑ СКФ через ↑ сердечного выброса и ↑ мышечной массы. Хроническая гиперфильтрация → ↑ внутриклубочковое давление → повреждение подоцитов. Наиболее нефротоксичны: тренболон, оксиметолон.',
        labMarkers: [
          { marker: 'ОАМ (белок)', expectedChange: '↑', targetRange: '<0.033 г/л', when: 'До курса, каждые 4-8 нед' },
          { marker: 'Суточная протеинурия', expectedChange: '↑', targetRange: '<30 мг/сут (альбумин)', when: 'При + белке в ОАМ' },
          { marker: 'СКФ (CKD-EPI)', expectedChange: '↔', targetRange: '>90 мл/мин', when: 'До курса, каждые 8 нед' },
          { marker: 'Цистатин C', expectedChange: '↔', targetRange: '0.6-1.0 мг/л', when: 'При сомнительном креатинине' },
        ],
        solutions: [
          { substanceId: 'telmisartan', name: 'Телмисартан', type: 'pharma', dose: '40-80 мг/сут', mechanism: '↓ внутриклубочковое давление → нефропротекция', evidenceLevel: 'A' },
          { substanceId: 'astragalus', name: 'Астрагал', type: 'supplement', dose: '500-1000 мг/сут', mechanism: '↓ TGF-β1 → защита подоцитов', evidenceLevel: 'B' },
          { substanceId: 'cordyceps', name: 'Кордицепс', type: 'supplement', dose: '1000-2000 мг/сут', mechanism: '↓ креатинин, ↑ СКФ', evidenceLevel: 'B' },
          { substanceId: 'bp_control', name: 'Контроль АД <130/85', type: 'lifestyle', dose: 'АД <130/85', mechanism: '↓ гидравлическое давление в клубочках', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '2-4 нед', effect: 'Телмисартан: ↓ протеинурия на 30-50%' },
          { timeline: 'Немедленно', effect: 'Протеинурия >1 г/сут — консультация нефролога, отмена нефротоксичных ААС', sideNote: 'ФСГС — потенциально необратимо' },
        ],
      },
    ],
  },
  {
    id: 'kidney_pain', symptom: 'Боль в пояснице (область почек)', category: 'renal',
    generalInfo: 'Может быть почечного или мышечного происхождения. Почечная боль: глубокая, не связана с движением, иррадиирует в пах. Мышечная: поверхностная, усиливается при наклонах.',
    problems: [
      {
        problem: 'Почечная колика (нефролитиаз / камень)', probability: 'medium',
        mechanism: 'Гиперкальциемия + дегидратация + ↑ потребление белка → ↑ экскреция Ca²⁺ и мочевой кислоты → камни. Риск ↑ при высоких дозах D3, дегидратации.',
        labMarkers: [
          { marker: 'ОАМ + pH', expectedChange: '↔', targetRange: 'pH 5.5-7.0', when: 'Немедленно при боли' },
          { marker: 'УЗИ почек', expectedChange: '↔', targetRange: 'Без конкрементов', when: 'Немедленно' },
          { marker: 'Ca²⁺ сыворотки', expectedChange: '↔', targetRange: '2.15-2.55 ммоль/л', when: 'При подозрении' },
          { marker: 'Мочевая кислота', expectedChange: '↑', targetRange: '200-420 мкмоль/л', when: 'При подозрении' },
        ],
        solutions: [
          { substanceId: 'potassium_citrate', name: 'Калия цитрат', type: 'supplement', dose: '2000-3000 мг/сут', mechanism: '↑ pH мочи → растворение уратных камней', evidenceLevel: 'A' },
          { substanceId: 'magnesium', name: 'Магния цитрат', type: 'supplement', dose: '400-600 мг/сут', mechanism: 'Связывает оксалат в кишечнике', evidenceLevel: 'A' },
          { substanceId: 'hydration_forced', name: 'Форсированная гидратация', type: 'lifestyle', dose: '3-4 л/сут', mechanism: 'Разведение мочи', evidenceLevel: 'A' },
          { substanceId: 'vitamin_b6', name: 'Витамин B6', type: 'supplement', dose: '50-100 мг/сут', mechanism: '↓ эндогенный синтез оксалата', evidenceLevel: 'B' },
        ],
        expectations: [
          { timeline: '24-72 ч', effect: 'Острая колика: консультация уролога, НПВС, УЗИ', sideNote: 'Камень <5 мм — консервативно. >5 мм — литотрипсия' },
          { timeline: 'Постоянно', effect: 'Профилактика: гидратация + цитрат + Mg ↓ риск рецидива на 40-60%' },
        ],
      },
    ],
  },

  // ═══ ЦНС ═══
  {
    id: 'insomnia', symptom: 'Бессонница / нарушения сна', category: 'cns',
    generalInfo: 'Инсомния на курсе ААС — 30-50% пользователей. Связана с симпатической активностью (тренболон, кленбутерол), ночной гипогликемией, тревожностью, апноэ сна.',
    problems: [
      {
        problem: 'Симпатическая гиперактивация (ААС)', probability: 'high',
        mechanism: 'Тренболон, оксиметолон ↑ норадреналин/дофамин → ↑ arousal. Кленбутерол — β2-агонист. T3/T4 ↑ метаболизм.',
        labMarkers: [
          { marker: 'Кортизол (слюна, вечер)', expectedChange: '↑', targetRange: '<2.0 нмоль/л (23:00)', when: 'При хронической бессоннице' },
          { marker: 'FT3, FT4', expectedChange: '↔', targetRange: 'FT3 3.1-6.8, FT4 9-22 пмоль/л', when: 'Исключить тиреотоксикоз' },
        ],
        solutions: [
          { substanceId: 'magnesium', name: 'Магния глицинат/треонат', type: 'supplement', dose: '400-600 мг за 1 ч до сна', mechanism: 'Агонист GABA-рецепторов, ↓ кортизол', evidenceLevel: 'A' },
          { substanceId: 'glycine', name: 'Глицин', type: 'supplement', dose: '3-5 г за 30 мин до сна', mechanism: 'Ингибиторный нейромедиатор → ↓ t° тела', evidenceLevel: 'B' },
          { substanceId: 'ashwagandha', name: 'Ашваганда (сенсорил)', type: 'supplement', dose: '300-600 мг/сут', mechanism: '↓ кортизол на 20-30%, GABA-миметик', evidenceLevel: 'A' },
          { substanceId: 'sleep_hygiene', name: 'Гигиена сна', type: 'lifestyle', dose: 'Без экранов за 2 ч, t° 18-20°C', mechanism: 'Естественный мелатонин ↑', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '1-2 ч', effect: 'Магний + глицин: ↓ латентность засыпания на 10-15 мин' },
          { timeline: '1-2 нед', effect: 'Ашваганда: ↓ кортизол, улучшение сна к 10-14 дню' },
        ],
      },
    ],
  },
  {
    id: 'anxiety', symptom: 'Тревожность / панические атаки / раздражительность', category: 'cns',
    generalInfo: 'Частый, но недооценённый эффект ААС. Механизмы: глутамат-эргическая гиперактивация (тренболон), ГАМК-супрессия (↓ нейростероиды), эстрогенный дисбаланс.',
    problems: [
      {
        problem: 'Глутамат/GABA-дисбаланс (ААС-индуцированный)', probability: 'high',
        mechanism: 'ААС ↓ аллопрегнанолон (GABA-A модулятор) → ↓ GABA-тонус → ↑ тревожность. Тренболон активирует NMDA-рецепторы → ↑ глутамат → нейротоксичность + тревога.',
        labMarkers: [
          { marker: 'Кортизол (слюна, утро)', expectedChange: '↑', targetRange: '5-20 нмоль/л', when: 'При тревожности' },
          { marker: 'E2', expectedChange: '↔', targetRange: '20-50 пг/мл ♂', when: 'Каждые 4 нед' },
        ],
        solutions: [
          { substanceId: 'ashwagandha', name: 'Ашваганда (KSM-66)', type: 'supplement', dose: '600 мг/сут', mechanism: '↓ кортизол, GABA-миметик', evidenceLevel: 'A' },
          { substanceId: 'l_theanine', name: 'L-теанин', type: 'supplement', dose: '200-400 мг 2×/день', mechanism: '↑ GABA, ↑ α-волны, ↑ дофамин', evidenceLevel: 'A' },
          { substanceId: 'magnesium', name: 'Магния треонат', type: 'supplement', dose: '1000-2000 мг/сут', mechanism: '↓ пресинаптический глутамат', evidenceLevel: 'B' },
          { substanceId: 'breath_work', name: 'Дыхание 4-7-8', type: 'lifestyle', dose: '5 мин 2×/д', mechanism: '↑ парасимпатический тонус', evidenceLevel: 'B' },
        ],
        expectations: [
          { timeline: '30-60 мин', effect: 'L-теанин 200 мг: ↓ тревожность, ↑ α-волны' },
          { timeline: 'Немедленно', effect: 'Панические атаки → исключить сердечную патологию. Дыхание 4-7-8 купирует за 2-3 мин', sideNote: 'Панические атаки на тренболоне — повод для отмены' },
        ],
      },
    ],
  },
  {
    id: 'brain_fog', symptom: 'Мозговой туман / снижение когнитивных функций', category: 'cns',
    generalInfo: '"Brain fog" — снижение концентрации, ухудшение памяти, замедление мышления. На курсе: гормональные колебания, нейровоспаление, гипогликемия, электролитные нарушения.',
    problems: [
      {
        problem: 'Нейровоспаление + оксидативный стресс', probability: 'medium',
        mechanism: 'ААС (тренболон, нандролон) активируют микроглию → ↑ TNF-α, IL-1β в ЦНС. Окислительный стресс → повреждение нейронов.',
        labMarkers: [
          { marker: 'E2', expectedChange: '↔', targetRange: '20-50 пг/мл', when: 'Каждые 4 нед' },
          { marker: 'ТТГ', expectedChange: '↔', targetRange: '0.4-4.0 мМЕ/л', when: 'Исключить гипотиреоз' },
          { marker: 'Витамин B12', expectedChange: '↔', targetRange: '200-900 пг/мл', when: 'При когнитивных жалобах' },
          { marker: 'CRP-hs', expectedChange: '↑', targetRange: '<3 мг/л', when: 'Оценка воспаления' },
        ],
        solutions: [
          { substanceId: 'alpha_lipoic', name: 'R-ALA', type: 'supplement', dose: '300-600 мг/сут', mechanism: 'Проникает ГЭБ → антиоксидант', evidenceLevel: 'B' },
          { substanceId: 'nac', name: 'NAC', type: 'supplement', dose: '1200-2400 мг/сут', mechanism: 'Предшественник GSH в ЦНС', evidenceLevel: 'B' },
          { substanceId: 'omega3', name: 'Омега-3 (DHA 1+ г)', type: 'supplement', dose: '2-4 г/сут', mechanism: 'DHA — структурный липид мозга', evidenceLevel: 'A' },
          { substanceId: 'creatine', name: 'Креатин', type: 'supplement', dose: '5 г/сут', mechanism: '↑ фосфокреатин в ЦНС', evidenceLevel: 'A' },
          { substanceId: 'lions_mane', name: 'Ежовик гребенчатый', type: 'supplement', dose: '1000-3000 мг/сут', mechanism: 'Стимуляция NGF → нейрогенез', evidenceLevel: 'B' },
        ],
        expectations: [
          { timeline: '1-2 ч', effect: 'Креатин 5 г: ↑ рабочая память', sideNote: 'Эффект заметнее при депривации сна' },
          { timeline: '2-4 нед', effect: 'NAC + R-ALA: ↓ нейровоспаление, улучшение ясности' },
          { timeline: '4-8 нед', effect: 'Lions Mane: начало нейрогенеза' },
        ],
      },
    ],
  },

  // ═══ ЭНДОКРИННАЯ ═══
  {
    id: 'libido_loss', symptom: 'Потеря либидо / сексуальной функции', category: 'endocrine',
    generalInfo: 'Многофакторная проблема: ↑ E2, ↑ пролактин, ↓ DHT, подавление ГГТ-оси, дофаминовая супрессия, сосудистый компонент.',
    problems: [
      {
        problem: 'Гиперпролактинемия', probability: 'high',
        mechanism: 'Нандролон, тренболон ↑ пролактин через PR-агонизм. Пролактин ↓ дофамин → ↓ либидо + ↓ GnRH → ↓ ЛГ → ↓ тестостерон.',
        labMarkers: [
          { marker: 'Пролактин', expectedChange: '↔', targetRange: '86-324 мкМЕ/мл', when: 'При ↓ либидо' },
          { marker: 'E2', expectedChange: '↔', targetRange: '20-50 пг/мл ♂', when: 'Каждые 4 нед' },
          { marker: 'DHT', expectedChange: '↓', targetRange: '0.4-2.5 нмоль/л', when: 'При нормальном T и ↓ либидо' },
        ],
        solutions: [
          { substanceId: 'cabergoline', name: 'Каберголин (D2-агонист)', type: 'pharma', dose: '0.25-0.5 мг 2×/нед', mechanism: '↓ секреция пролактина', evidenceLevel: 'A' },
          { substanceId: 'p5p', name: 'P5P (пиридоксаль-5-фосфат)', type: 'supplement', dose: '50-100 мг/сут', mechanism: 'Кофактор DOPA-декарбоксилазы → ↑ дофамин', evidenceLevel: 'B' },
          { substanceId: 'vitamin_e', name: 'Витамин E', type: 'supplement', dose: '400-800 МЕ/сут', mechanism: 'Защита дофаминергических нейронов', evidenceLevel: 'B' },
          { substanceId: 'zinc', name: 'Цинк', type: 'supplement', dose: '30-50 мг/сут', mechanism: '↓ пролактин', evidenceLevel: 'C' },
        ],
        expectations: [
          { timeline: '2-4 ч', effect: 'Каберголин 0.25 мг: начало ↓ пролактина', sideNote: 'Избегать при клапанных пороках сердца' },
          { timeline: '2-4 нед', effect: 'P5P + вит.E: ↓ пролактина на 20-40%', sideNote: 'B6 >200 мг/сут — риск нейропатии' },
        ],
      },
      {
        problem: 'Эстрогенный дисбаланс (↑ или ↓ E2)', probability: 'high',
        mechanism: 'Ароматизация T → ↑ E2 → ↓ либидо. Избыточное подавление AI → ↓ E2 <15 пг/мл тоже убивает либидо.',
        labMarkers: [
          { marker: 'E2', expectedChange: '↔', targetRange: '20-50 пг/мл ♂', when: 'Каждые 4 нед' },
        ],
        solutions: [
          { substanceId: 'anastro', name: 'Анастрозол (при ↑ E2)', type: 'pharma', dose: '0.25 мг 2×/нед', mechanism: 'Ингибитор ароматазы', evidenceLevel: 'A' },
          { substanceId: 'zinc', name: 'Цинк', type: 'supplement', dose: '30-50 мг/сут', mechanism: 'Умеренный ингибитор ароматазы', evidenceLevel: 'C' },
        ],
        expectations: [
          { timeline: '24-48 ч', effect: 'Анастрозол: начало ↓ E2', sideNote: 'Корректировать дозу по анализам' },
          { timeline: '1-2 нед', effect: 'Нормализация либидо при E2 20-50 пг/мл' },
        ],
      },
    ],
  },
  {
    id: 'gynecomastia', symptom: 'Гинекомастия / зуд / припухлость сосков', category: 'endocrine',
    generalInfo: 'Результат гормонального дисбаланса: ↑ E2 (ароматизация) + ↑ прогестерон (19-нор) + ↑ пролактин. Ранние признаки: зуд сосков. Поздние: пальпируемая ткань. Обратима на ранних стадиях.',
    problems: [
      {
        problem: 'Эстроген-опосредованная гинекомастия', probability: 'high',
        mechanism: 'Ароматизация → ↑ E2 → стимуляция ER-α в молочной железе → пролиферация железистой ткани.',
        stopCriteria: ['E2 >80 пг/мл + грудь болит/отекает — немедленно начать AI', 'Сформированная фиброзная ткань (1+ год) — AI/тамоксифен не работают, только хирургия'],
        drugInteractions: ['Тамоксифен + AI → риск ↓ IGF-1 + ↓ либидо (E2 слишком низкий)', 'Витамин E + AI → аддитивный антиэстрогенный эффект'],
        labMarkers: [
          { marker: 'E2', expectedChange: '↑', targetRange: '20-50 пг/мл ♂', when: 'Немедленно при симптомах' },
          { marker: 'Пролактин', expectedChange: '↔', targetRange: '86-324 мкМЕ/мл', when: 'Немедленно' },
          { marker: 'Прогестерон', expectedChange: '↔', targetRange: '<1.2 нмоль/л', when: 'Исключить прогестагенную гин.' },
        ],
        solutions: [
          { substanceId: 'tamox', name: 'Тамоксифен', type: 'pharma', dose: '20-40 мг/сут до ↓ симптомов', mechanism: 'Блокада ER в молочной железе', evidenceLevel: 'A' },
          { substanceId: 'anastro', name: 'Анастрозол', type: 'pharma', dose: '0.5-1 мг/нед', mechanism: '↓ ароматизация', evidenceLevel: 'A' },
          { substanceId: 'ralox', name: 'Ралоксифен', type: 'pharma', dose: '60 мг/сут', mechanism: 'Более селективная ER-блокада', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '24-48 ч', effect: 'Тамоксифен 20 мг: ↓ зуд и чувствительность', sideNote: 'Не злоупотреблять — ↓ IGF-1' },
          { timeline: '3-7 дней', effect: 'Анастрозол: ↓ E2 на 50-70%', sideNote: 'Не крашить E2' },
          { timeline: 'Немедленно', effect: 'При прогестагенных ААС (нандролон) гинекомастия может быть менее чувствительна к тамоксифену — добавить ралоксифен (селективная ER-блокада в груди)' },
        ],
      },
    ],
  },
  {
    id: 'testicular_atrophy', symptom: 'Уменьшение размера яичек / атрофия', category: 'endocrine',
    generalInfo: 'Неизбежный эффект экзогенных андрогенов: подавление ГГТ-оси → ↓ ЛГ → клетки Лейдига не стимулируются → атрофия. Частично обратима. Профилактика: hCG на курсе.',
    problems: [
      {
        problem: 'Подавление ГГТ-оси и атрофия клеток Лейдига', probability: 'high',
        mechanism: 'ААС → негативная обратная связь → ↓ GnRH → ↓ ЛГ → ↓ стимуляция клеток Лейдига → ↓ трофика → атрофия.',
        labMarkers: [
          { marker: 'ЛГ', expectedChange: '↓', targetRange: '1.7-8.6 МЕ/л', when: 'Каждые 4-8 нед' },
          { marker: 'ФСГ', expectedChange: '↓', targetRange: '1.5-12.4 МЕ/л', when: 'Каждые 4-8 нед' },
          { marker: 'Ингибин B', expectedChange: '↓', targetRange: '25-325 пг/мл', when: 'При оценке фертильности' },
        ],
        solutions: [
          { substanceId: 'hcg', name: 'hCG 500 МЕ 2×/нед', type: 'pharma', dose: '500 МЕ 2×/нед (п/к)', mechanism: 'Аналог ЛГ → поддержание клеток Лейдига', evidenceLevel: 'A' },
          { substanceId: 'hmg', name: 'hMG (при подготовке к зачатию)', type: 'pharma', dose: '75-150 МЕ 2-3×/нед', mechanism: 'ФСГ + ЛГ → поддержание сперматогенеза', evidenceLevel: 'A' },
          { substanceId: 'zinc', name: 'Цинк', type: 'supplement', dose: '30-50 мг/сут', mechanism: 'Необходим для синтеза T и сперматогенеза', evidenceLevel: 'B' },
        ],
        expectations: [
          { timeline: '1-2 нед', effect: 'hCG: остановка атрофии, восстановление объёма', sideNote: 'Начинать с 1-й недели курса' },
          { timeline: 'Постоянно', effect: 'Без hCG: атрофия может быть длительной, но обычно обратима после ПКТ' },
        ],
      },
    ],
  },
  {
    id: 'night_sweats', symptom: 'Ночная потливость', category: 'endocrine',
    generalInfo: 'Следствие гормональных колебаний. Причины: пики/спады уровней гормонов между инъекциями (короткие эфиры), андрогенная терморегуляция, тиреоиды, ночная гипогликемия.',
    problems: [
      {
        problem: 'Гормональные флуктуации (пик-спад между инъекциями)', probability: 'medium',
        mechanism: 'Короткие эфиры создают резкие пики и спады → гипоталамус интерпретирует падение как "сигнал опасности" → ↑ симпатическая активность → потливость.',
        labMarkers: [
          { marker: 'T общий (trough)', expectedChange: '↔', targetRange: '12.1-34.7 нмоль/л', when: 'Перед инъекцией' },
          { marker: 'ТТГ', expectedChange: '↔', targetRange: '0.4-4.0', when: 'Исключить гипертиреоз' },
        ],
        solutions: [
          { substanceId: 'more_frequent_inj', name: 'Более частые инъекции', type: 'lifestyle', dose: 'Переход на ежедневные', mechanism: 'Стабилизация уровня гормонов', evidenceLevel: 'C' },
          { substanceId: 'long_ester', name: 'Замена на длинные эфиры', type: 'lifestyle', dose: '—', mechanism: 'Более стабильный PK-профиль', evidenceLevel: 'C' },
        ],
        expectations: [
          { timeline: '1-2 нед', effect: 'Стабилизация протокола: ↓ потливость на 70-80%' },
          { timeline: 'Немедленно', effect: 'Ночные поты + потеря веса + лихорадка → исключить лимфому' },
        ],
      },
    ],
  },

  // ═══ ЖКТ ═══
  {
    id: 'gerd', symptom: 'Изжога / ГЭРБ / кислотный рефлюкс', category: 'gastrointestinal',
    generalInfo: 'ГЭРБ на курсе: расслабление НПС (прогестероновый эффект), ↑ внутрибрюшное давление, НПВС-гастропатия, высокобелковая диета → ↑ кислотность.',
    problems: [
      {
        problem: 'НПВС-индуцированный рефлюкс / гастрит', probability: 'medium',
        mechanism: 'НПВС ингибируют COX-1 → ↓ PGE2 → ↓ защитная слизь → повреждение слизистой → рефлюкс. ААС ↓ тонус НПС. Комбинация → эзофагит.',
        labMarkers: [
          { marker: 'ФГДС', expectedChange: '↔', targetRange: 'Норма', when: 'При хронической изжоге >4 нед' },
          { marker: 'H. pylori (дых. тест)', expectedChange: '↔', targetRange: 'Отрицательно', when: 'При подозрении' },
        ],
        solutions: [
          { substanceId: 'ppi', name: 'Омепразол / Пантопразол', type: 'pharma', dose: '20-40 мг/сут за 30 мин до еды', mechanism: 'Ингибирование H⁺/K⁺-ATPазы', evidenceLevel: 'A' },
          { substanceId: 'dgl', name: 'DGL (деглицирр. солодка)', type: 'supplement', dose: '400-800 мг за 20 мин до еды', mechanism: '↑ защитная слизь, ↑ PGE2', evidenceLevel: 'B' },
          { substanceId: 'glutamine', name: 'L-глутамин', type: 'supplement', dose: '5-10 г/сут', mechanism: 'Топливо для энтероцитов', evidenceLevel: 'B' },
          { substanceId: 'meal_spacing', name: 'Интервалы между едой', type: 'lifestyle', dose: '3-4 ч, последний приём за 3 ч до сна', mechanism: '↓ желудочное содержимое в горизонтальном положении', evidenceLevel: 'B' },
        ],
        expectations: [
          { timeline: '1-3 дня', effect: 'ИПП 20 мг: ↓ изжога на 80-90%', sideNote: 'Не >8 нед без перерыва — риск SIBO, дефицита B12' },
          { timeline: '1-2 нед', effect: 'DGL + глутамин: восстановление слизистой' },
        ],
      },
    ],
  },
  {
    id: 'bloating', symptom: 'Вздутие живота / газообразование', category: 'gastrointestinal',
    generalInfo: 'Метеоризм при высокобелковой диете (200-300+ г белка). Причины: ферментативная недостаточность, FODMAP-ферментация, дисбиоз, задержка жидкости.',
    problems: [
      {
        problem: 'Ферментативная недостаточность при высокобелковой диете', probability: 'high',
        mechanism: '300+ г белка/день → нагрузка на протеазы. Неполное переваривание → бактериальная ферментация → H₂, CH₄, CO₂ → вздутие.',
        labMarkers: [
          { marker: 'Фекальная эластаза-1', expectedChange: '↓', targetRange: '>200 мкг/г', when: 'При хроническом вздутии' },
        ],
        solutions: [
          { substanceId: 'digestive_enzymes', name: 'Панкреатин / пищ. ферменты', type: 'supplement', dose: '10000-25000 ЕД/приём', mechanism: 'Протеазы, липазы, амилазы', evidenceLevel: 'A' },
          { substanceId: 'probiotics', name: 'Пробиотики (Lacto + Bifido)', type: 'supplement', dose: '10-50 млрд КОЕ/сут', mechanism: '↓ газообразующие бактерии', evidenceLevel: 'A' },
          { substanceId: 'betaine_hcl', name: 'Бетаин HCl + пепсин', type: 'supplement', dose: '500-1000 мг с приёмом', mechanism: '↑ кислотность → активация пепсина', evidenceLevel: 'B' },
          { substanceId: 'ginger', name: 'Имбирь', type: 'supplement', dose: '500-1000 мг 2×/день', mechanism: 'Прокинетик: ↑ моторика ЖКТ', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '1-3 дня', effect: 'Ферменты + бетаин: ↓ вздутие на 50-70%', sideNote: 'Бетаин не при язве/гастрите' },
          { timeline: '1-2 нед', effect: 'Пробиотики: нормализация стула, ↓ газообразование' },
        ],
      },
    ],
  },

  // ═══ ОПОРНО-ДВИГАТЕЛЬНАЯ ═══
  {
    id: 'joint_pain', symptom: 'Боль в суставах / артралгии', category: 'musculoskeletal',
    generalInfo: 'Парадокс: ААС улучшают синтез белка, но часто вызывают суставные боли. Причины: ↓ E2 (чрезмерный AI), ↓ кортизол, быстрый набор силы, дегидратация хрящей.',
    problems: [
      {
        problem: 'Гипоэстрогения (crushed estrogen)', probability: 'high',
        mechanism: 'Избыточный приём AI → E2 <15 пг/мл. E2 критичен для синтеза коллагена II, синовиальной жидкости, эластичности связок.',
        labMarkers: [
          { marker: 'E2 (чувствительный)', expectedChange: '↓↓', targetRange: '20-50 пг/мл ♂', when: 'Немедленно при болях' },
        ],
        solutions: [
          { substanceId: 'reduce_ai', name: 'СНИЗИТЬ дозу AI', type: 'pharma', dose: '↓ на 50% или отменить', mechanism: 'Восстановление E2 до 20-50 пг/мл', evidenceLevel: 'A' },
          { substanceId: 'collagen_type2', name: 'Коллаген II (UC-II)', type: 'supplement', dose: '40 мг/сут', mechanism: 'Oral tolerance → защита хряща', evidenceLevel: 'A' },
          { substanceId: 'glucosamine_chondroitin', name: 'Глюкозамин + Хондроитин', type: 'supplement', dose: '1500 + 1200 мг/сут', mechanism: 'Субстраты для протеогликанов', evidenceLevel: 'B' },
          { substanceId: 'curcumin', name: 'Куркумин + пиперин', type: 'supplement', dose: '500-1000 мг + 5 мг', mechanism: '↓ NF-κB → ↓ TNF-α, IL-1β', evidenceLevel: 'B' },
          { substanceId: 'omega3', name: 'Омега-3', type: 'supplement', dose: '3-4 г/сут', mechanism: '↓ провоспалительные эйкозаноиды', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '3-7 дней', effect: 'Снижение AI + восстановление E2: ↓ боли', sideNote: 'Анастрозол восстанавливает E2 быстрее (T½ ~50 ч), летрозол дольше (T½ 2-4 дня)' },
          { timeline: '2-4 нед', effect: 'UC-II коллаген: ↓ утренняя скованность, ↓ боль по WOMAC на 33%' },
          { timeline: '4-8 нед', effect: 'Глюкозамин/хондроитин: регенерация хряща' },
        ],
      },
    ],
  },
  {
    id: 'muscle_cramps', symptom: 'Мышечные судороги / крампи', category: 'musculoskeletal',
    generalInfo: 'Классический признак электролитного дисбаланса (↓ Mg²⁺, ↓ K⁺) и дегидратации. Часто ночью (икроножные) или на тренировке. Усугубляются диуретиками, кленбутеролом, кофеином.',
    problems: [
      {
        problem: 'Гипомагниемия + гипокалиемия', probability: 'high',
        mechanism: 'Интенсивный тренинг + ААС → ↑ потери Mg²⁺ и K⁺ с потом. ↓ Mg²⁺ → sustained contraction → судорога.',
        labMarkers: [
          { marker: 'Mg²⁺ сыворотки', expectedChange: '↓', targetRange: '0.7-1.0 ммоль/л', when: 'При судорогах' },
          { marker: 'K⁺ сыворотки', expectedChange: '↓', targetRange: '3.5-5.1 ммоль/л', when: 'При судорогах' },
        ],
        solutions: [
          { substanceId: 'magnesium', name: 'Магния глицинат', type: 'supplement', dose: '400-600 мг/сут + 200 мг перед сном', mechanism: '↓ возбудимость NMJ', evidenceLevel: 'A' },
          { substanceId: 'potassium', name: 'Калия цитрат', type: 'supplement', dose: '1000-3000 мг/сут', mechanism: 'Реполяризация мембраны', evidenceLevel: 'A' },
          { substanceId: 'taurine', name: 'Таурин', type: 'supplement', dose: '2-3 г/сут', mechanism: 'Стабилизация мембран, Ca²⁺-гомеостаз', evidenceLevel: 'B' },
          { substanceId: 'hydration', name: 'Гидратация ≥3 л/сут', type: 'lifestyle', dose: '3-4 л/сут', mechanism: 'Поддержание электролитного баланса', evidenceLevel: 'B' },
        ],
        expectations: [
          { timeline: '1-2 ч', effect: 'Магний 200 мг: ↓ ночные судороги' },
          { timeline: '2-7 дней', effect: 'Комплексная коррекция: судороги исчезают' },
        ],
      },
    ],
  },
  {
    id: 'back_pumps', symptom: 'Болезненные "пампы" поясницы', category: 'musculoskeletal',
    generalInfo: 'Характерный симптом на пероральных ААС (дианобол, оксиметолон). Болезненное напряжение мышц нижней части спины при ходьбе/стоянии. Механизм: задержка жидкости + электролитный дисбаланс + ↑ внутрифасциальное давление.',
    problems: [
      {
        problem: 'ААС-индуцированные мышечные спазмы + задержка жидкости', probability: 'medium',
        mechanism: 'ААС ↑ синтез гликогена и задержку воды в мышцах. Дефицит Mg²⁺ и таурина → неконтролируемые сокращения → ишемия → боль.',
        labMarkers: [
          { marker: 'Mg²⁺, K⁺', expectedChange: '↓', targetRange: 'Mg 0.7-1.0, K 3.5-5.1', when: 'При back pumps' },
          { marker: 'КФК', expectedChange: '↔', targetRange: '<200 Ед/л', when: 'Исключить рабдомиолиз' },
        ],
        solutions: [
          { substanceId: 'taurine', name: 'Таурин', type: 'supplement', dose: '3-5 г/сут (2 г до тренировки)', mechanism: 'Стабилизация мембран, осмолит', evidenceLevel: 'B' },
          { substanceId: 'magnesium', name: 'Магния глицинат', type: 'supplement', dose: '400-600 мг/сут', mechanism: 'Мышечная релаксация', evidenceLevel: 'A' },
          { substanceId: 'potassium', name: 'Калия цитрат', type: 'supplement', dose: '1000-2000 мг/сут', mechanism: 'Восполнение K⁺', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '24-48 ч', effect: 'Таурин 3-5 г + Mg: значительное уменьшение болей', sideNote: 'Таурин — наиболее эффективное средство' },
        ],
      },
    ],
  },

  // ═══ КРОВЬ ═══
  {
    id: 'fatigue', symptom: 'Хроническая усталость / слабость', category: 'hematologic',
    generalInfo: 'Неспецифический, но важный симптом. Причины: дефицит Fe/B12/фолата (↑ эритропоэз), субклинический гипотиреоз, overtraining, гипогликемия, гепатотоксичность.',
    problems: [
      {
        problem: 'Дефицит Fe / B12 / фолата (анемия)', probability: 'medium',
        mechanism: 'ААС ↑ эритропоэз → ↑ потребление Fe, B12, фолата. При недостатке → анемия → слабость, ↓ производительность.',
        labMarkers: [
          { marker: 'ОАК (Hb, MCV)', expectedChange: '↔', targetRange: 'Hb 130-170, MCV 80-100', when: 'При усталости' },
          { marker: 'Ферритин', expectedChange: '↓', targetRange: '30-300 (оптимум >100)', when: 'При усталости' },
          { marker: 'B12', expectedChange: '↓', targetRange: '200-900 (оптимум >400)', when: 'При усталости' },
          { marker: 'Фолат', expectedChange: '↓', targetRange: '3-17 нг/мл', when: 'При усталости' },
          { marker: 'ТТГ', expectedChange: '↔', targetRange: '0.4-4.0', when: 'Исключить гипотиреоз' },
        ],
        solutions: [
          { substanceId: 'iron', name: 'Железа бисглицинат', type: 'supplement', dose: '25-50 мг/сут', mechanism: 'Восполнение дефицита Fe', evidenceLevel: 'A' },
          { substanceId: 'b12', name: 'Метилкобаламин', type: 'supplement', dose: '1000-5000 мкг/сут', mechanism: 'Кофактор синтеза ДНК', evidenceLevel: 'A' },
          { substanceId: 'folate', name: '5-МТГФ (активный фолат)', type: 'supplement', dose: '400-800 мкг/сут', mechanism: 'Метилирование + эритропоэз', evidenceLevel: 'A' },
          { substanceId: 'vitamin_c', name: 'Витамин C', type: 'supplement', dose: '500-1000 мг/сут', mechanism: '↑ абсорбция Fe', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '1-2 нед', effect: 'Fe + вит. C: начало ↑ ферритина', sideNote: 'Не принимать Fe с Ca²⁺/Zn²⁺' },
          { timeline: '4-8 нед', effect: '↑ Hb на 10-20 г/л', sideNote: 'Не принимать Fe профилактически без дефицита' },
        ],
      },
    ],
  },

  // ═══ КОЖА ═══
  {
    id: 'acne', symptom: 'Акне / угревая сыпь (спина, плечи, лицо)', category: 'dermatologic',
    generalInfo: '"Steroid acne" — наиболее частый дерматологический эффект (50-70%). ААС ↑ активность сальных желёз через AR → ↑ себум → закупорка пор → воспаление. Наиболее акнегенны: тренболон, тестостерон, оксиметолон.',
    problems: [
      {
        problem: 'Андроген-индуцированная гиперсеборея и акне', probability: 'high',
        mechanism: 'ААС → AR в себоцитах → ↑ липогенез → ↑ себум + кератинизация → комедоны. P. acnes ферментирует себум → воспаление.',
        labMarkers: [
          { marker: 'E2', expectedChange: '↔', targetRange: '20-50 пг/мл', when: 'При акне' },
          { marker: 'DHT', expectedChange: '↔', targetRange: '0.4-2.5 нмоль/л', when: 'При тяжёлом акне' },
        ],
        solutions: [
          { substanceId: 'isotretinoin', name: 'Изотретиноин (низкодозный)', type: 'pharma', dose: '10-20 мг/сут', mechanism: '↓ размер сальных желёз на 90%', evidenceLevel: 'A' },
          { substanceId: 'zinc', name: 'Цинк пиколинат', type: 'supplement', dose: '50-100 мг/сут', mechanism: '↓ 5α-редуктазу, ↓ воспаление', evidenceLevel: 'A' },
          { substanceId: 'pantothenic_acid', name: 'Витамин B5', type: 'supplement', dose: '2-5 г/сут', mechanism: '↓ синтез жирных кислот → ↓ себум', evidenceLevel: 'B' },
          { substanceId: 'topical_retinoid', name: 'Адапален / Третиноин местно', type: 'pharma', dose: '1×/день на ночь', mechanism: '↓ кератинизация фолликулов', evidenceLevel: 'A' },
          { substanceId: 'skin_hygiene', name: 'Гигиена кожи', type: 'lifestyle', dose: 'Душ 2×/день, салициловый гель', mechanism: 'Удаление себума, антибактериально', evidenceLevel: 'B' },
        ],
        expectations: [
          { timeline: '2-4 нед', effect: 'Цинк + B5: ↓ высыпания на 30-50%', sideNote: 'Цинк >50 мг → добавить Cu 1-2 мг' },
          { timeline: '4-8 нед', effect: 'Изотретиноин: ↓ себум, сухость кожи (нормально)', sideNote: 'Изотретиноин + ААС = двойная нагрузка на печень!' },
        ],
      },
    ],
  },
  {
    id: 'hair_loss', symptom: 'Выпадение волос / андрогенная алопеция', category: 'dermatologic',
    generalInfo: 'АГА на курсе: DHT связывается с AR в волосяных фолликулах → миниатюризация → выпадение. Генетическая предрасположенность. Наиболее алопецигенны: мастерон, тренболон, провирон, высокие дозы тестостерона.',
    problems: [
      {
        problem: 'DHT-опосредованная АГА', probability: 'medium',
        mechanism: '5α-редуктаза конвертирует T в DHT в фолликулах. DHT в 5× аффиннее к AR → ↓ анагеновая фаза → миниатюризация фолликула.',
        labMarkers: [
          { marker: 'DHT', expectedChange: '↔', targetRange: '0.4-2.5 нмоль/л', when: 'При выпадении' },
          { marker: 'Ферритин', expectedChange: '↔', targetRange: '>70 мкг/л', when: 'Исключить телогеновую алопецию' },
          { marker: 'ТТГ', expectedChange: '↔', targetRange: '0.4-4.0', when: 'Исключить гипотиреоз' },
        ],
        solutions: [
          { substanceId: 'finasteride', name: 'Финастерид', type: 'pharma', dose: '1 мг/сут', mechanism: 'Ингибитор 5α-R II типа → ↓ DHT на 60-70%', evidenceLevel: 'A' },
          { substanceId: 'dutasteride', name: 'Дутастерид', type: 'pharma', dose: '0.5 мг/сут', mechanism: 'Ингибитор 5α-R I+II → ↓ DHT на 90-95%', evidenceLevel: 'A' },
          { substanceId: 'minoxidil', name: 'Миноксидил 5%', type: 'pharma', dose: '1 мл 2×/день', mechanism: '↑ кровоток в фолликулах', evidenceLevel: 'A' },
          { substanceId: 'ketoconazole', name: 'Кетоконазол 2% шампунь', type: 'pharma', dose: '2-3×/нед', mechanism: 'Местный антиандроген', evidenceLevel: 'B' },
          { substanceId: 'biotin', name: 'Биотин', type: 'supplement', dose: '5000-10000 мкг/сут', mechanism: 'Кофактор синтеза кератина', evidenceLevel: 'C' },
        ],
        expectations: [
          { timeline: 'Немедленно', effect: 'Финастерид: начало ↓ DHT через 24 ч', sideNote: '↓ либидо у 1-2%' },
          { timeline: '3-6 мес', effect: 'Миноксидил: ↑ плотность волос', sideNote: 'Начальный shed в первые 2-4 нед — нормально' },
          { timeline: 'Сразу', effect: 'Избегать мастерона, тренболона, высоких доз T при предрасположенности', sideNote: 'Нандролон → DHN — менее алопецигенен' },
        ],
      },
    ],
  },

  // ═══ ПСИХИКА ═══
  {
    id: 'aggression', symptom: 'Повышенная агрессивность / "ройд-рейдж"', category: 'psychological',
    generalInfo: 'ААС влияют на миндалевидное тело (↑ реактивность), орбитофронтальную кору (↓ контроль), серотонин (↓ 5-HT1A → ↑ агрессия). Наиболее агрессиогенные: тренболон, станозолол, оксиметолон.',
    problems: [
      {
        problem: 'ААС-индуцированная агрессия (серотонин + миндалина)', probability: 'medium',
        mechanism: 'ААС ↓ серотонин (5-HT) → растормаживание агрессии. ↑ активность миндалевидного тела (fMRI). ↑ дофамин → ↑ импульсивность.',
        labMarkers: [
          { marker: 'E2', expectedChange: '↔', targetRange: '20-50 пг/мл', when: 'При агрессии' },
        ],
        solutions: [
          { substanceId: 'l_theanine', name: 'L-теанин', type: 'supplement', dose: '200-400 мг 2-3×/день', mechanism: '↑ α-волны, ↑ GABA, ↑ серотонин', evidenceLevel: 'A' },
          { substanceId: 'ashwagandha', name: 'Ашваганда', type: 'supplement', dose: '600 мг/сут', mechanism: '↓ кортизол, улучшение контроля', evidenceLevel: 'A' },
          { substanceId: 'nac', name: 'NAC', type: 'supplement', dose: '1200-2400 мг/сут', mechanism: 'Модуляция глутамата → ↓ импульсивность', evidenceLevel: 'B' },
          { substanceId: 'cbt', name: 'КПТ', type: 'lifestyle', dose: 'Сессии 1×/нед', mechanism: 'Осознанное управление эмоциями', evidenceLevel: 'A' },
          { substanceId: 'reduce_dose', name: 'Снижение дозы / смена препарата', type: 'lifestyle', dose: '↓ на 30-50%', mechanism: 'Устранение первопричины', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '30-60 мин', effect: 'L-теанин 200 мг: ↓ реактивность, ↑ спокойствие' },
          { timeline: '1-2 нед', effect: 'Ашваганда: ↓ baseline-раздражительность' },
          { timeline: 'Немедленно', effect: 'При агрессии, угрожающей окружающим — отмена ААС, психиатр' },
        ],
      },
    ],
  },
  {
    id: 'depression', symptom: 'Депрессивное настроение / апатия / ангедония', category: 'psychological', urgency: 'critical',
    generalInfo: 'На курсе: гормональные колебания → аффективная нестабильность. После курса (PCT): гипогонадизм → ↓ дофамин/серотонин/норадреналин → "post-cycle crash". Особенно высок риск после 19-нор-производных.',
    problems: [
      {
        problem: 'Постцикловая депрессия (гипогонадизм-индуцированная)', probability: 'high',
        mechanism: 'После отмены ААС: ГГТ-ось подавлена → ↓ ЛГ/ФСГ → ↓ тестостерон → ↓ нейростероиды (аллопрегнанолон) → ↓ GABA-A → депрессия + тревога.',
        stopCriteria: ['Суицидальные мысли — НЕМЕДЛЕННО психиатр + скорая помощь (103)', 'Нарастающая депрессия/ангедония >2 нед — обратиться к врачу'],
        labMarkers: [
          { marker: 'T общий', expectedChange: '↓↓', targetRange: '12.1-34.7 нмоль/л', when: 'Через 2-4 нед после последней инъекции' },
          { marker: 'ЛГ, ФСГ', expectedChange: '↓', targetRange: 'ЛГ 1.7-8.6, ФСГ 1.5-12.4', when: 'Через 2-4 нед' },
          { marker: 'E2', expectedChange: '↓', targetRange: '20-50 пг/мл', when: 'Одновременно с T' },
          { marker: 'Витамин D (25-OH)', expectedChange: '↓', targetRange: '50-80 нг/мл', when: 'При депрессии' },
        ],
        solutions: [
          { substanceId: 'pct_proper', name: 'ПРАВИЛЬНЫЙ ПКТ (SERM + hCG)', type: 'pharma', dose: 'Тамоксифен 20 мг + кломифен 50 мг 4-6 нед', mechanism: 'SERM ↑ ЛГ/ФСГ → ↑ тестостерон', evidenceLevel: 'A' },
          { substanceId: 'hcg', name: 'hCG', type: 'pharma', dose: '500-1000 МЕ 2-3×/нед', mechanism: 'Стимуляция клеток Лейдига', evidenceLevel: 'A' },
          { substanceId: 'vitamin_d', name: 'Витамин D3', type: 'supplement', dose: '5000-10000 МЕ/сут', mechanism: '↑ синтез серотонина', evidenceLevel: 'A' },
          { substanceId: 'omega3', name: 'Омега-3 (EPA ≥1 г)', type: 'supplement', dose: '2-4 г/сут', mechanism: 'Антидепрессантный эффект, сравнимый с СИОЗС', evidenceLevel: 'A' },
          { substanceId: 'exercise', name: 'Аэробные тренировки', type: 'lifestyle', dose: '30-45 мин 3-5×/нед', mechanism: '↑ BDNF, ↑ эндорфины, ↑ нейрогенез', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '2-4 нед', effect: 'ПКТ: начало ↑ T, улучшение настроения', sideNote: 'При тяжёлом гипогонадизме может потребоваться TRT' },
          { timeline: 'Немедленно', effect: 'Суицидальные мысли — СРОЧНАЯ консультация психиатра. Отмена ААС', sideNote: 'Постцикловая депрессия — медицинская проблема' },
        ],
      },
    ],
  },

  // ═══ ДОПОЛНИТЕЛЬНЫЕ СИМПТОМЫ (краткие) ═══
  {
    id: 'hypoglycemia', symptom: 'Гипогликемия / головокружение / холодный пот', category: 'endocrine',
    generalInfo: 'Характерна для пользователей инсулина, IGF-1. Симптомы: внезапная слабость, холодный пот, тремор, спутанность сознания. Тяжёлая → потеря сознания.',
    problems: [
      {
        problem: 'Инсулин-индуцированная гипогликемия', probability: 'medium',
        mechanism: 'Экзогенный инсулин ↑ GLUT4 → ↑ захват глюкозы → ↓ глюкоза крови.',
        labMarkers: [
          { marker: 'Глюкоза крови', expectedChange: '↓↓', targetRange: '4.0-5.9 ммоль/л (натощак)', when: 'При каждом подозрении' },
        ],
        solutions: [
          { substanceId: 'glucose_fast', name: 'Быстрые углеводы', type: 'lifestyle', dose: '15-20 г немедленно', mechanism: 'Прямое ↑ глюкозы', evidenceLevel: 'A' },
          { substanceId: 'chromium', name: 'Хром пиколинат', type: 'supplement', dose: '200-400 мкг/сут', mechanism: '↑ чувствительность → ↓ доза инсулина', evidenceLevel: 'B' },
          { substanceId: 'glucagon', name: 'Глюкагон (экстренный)', type: 'pharma', dose: '1 мг в/м при потере сознания', mechanism: 'Гликогенолиз', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '5-15 мин', effect: '15 г глюкозы: ↑ глюкоза на 1.5-2 ммоль/л' },
          { timeline: 'Немедленно', effect: 'Потеря сознания: глюкагон 1 мг в/м + скорая', sideNote: 'Инсулин без глюкометра = игра в русскую рулетку' },
        ],
      },
    ],
  },
  {
    id: 'injection_pain', symptom: 'Боль / уплотнение / воспаление в месте инъекции', category: 'musculoskeletal',
    urgency: 'warning', relatedSymptoms: ['edema', 'nosebleeds'],
    quickFacts: ['Частота: 15-30% при в/м инъекциях', 'Основная причина: неправильная техника или объём >3 мл', 'Риск абсцесса <1%'],
    generalInfo: 'Постинъекционные реакции — частая проблема при внутримышечном введении масляных растворов ААС. Могут проявляться как локальная боль (PIP — post-injection pain), уплотнение (стерильный абсцесс), покраснение, отёк. Дифференцировать инфекционный абсцесс от стерильного воспаления.',
    problems: [
      {
        problem: 'Стерильное воспаление / "PIP" (post-injection pain)', probability: 'high',
        mechanism: 'Масляный депо-эффект: масляный раствор создаёт депо в мышце → локальное растяжение фасции → воспалительная реакция. Высокая концентрация бензилового спирта или пропиленгликоля в препарате → раздражение тканей. Объём >3 мл в одну точку — фактор риска.',
        labMarkers: [
          { marker: 'Визуальный осмотр', expectedChange: '↔', targetRange: 'Без флюктуации, без гноя', when: 'При каждом симптоме' },
          { marker: 'Температура тела', expectedChange: '↔', targetRange: '<37.5°C', when: 'При покраснении (исключить инфекцию)' },
          { marker: 'СРБ (C-реактивный белок)', expectedChange: '↔', targetRange: '<5 мг/л', when: 'При подозрении на абсцесс' },
        ],
        solutions: [
          { substanceId: 'proper_technique', name: 'Правильная техника инъекции', type: 'lifestyle', dose: 'Менять места, объём ≤3 мл, игла 23-25G × 1-1.5"', mechanism: 'Минимизация травматизации тканей', evidenceLevel: 'A' },
          { substanceId: 'warm_compress', name: 'Тёплый компресс + массаж', type: 'lifestyle', dose: '15-20 мин 2-3×/день', mechanism: '↑ кровоток → ускорение абсорбции масляного депо', evidenceLevel: 'B' },
          { substanceId: 'ibuprofen', name: 'Ибупрофен (НПВС)', type: 'pharma', dose: '400-600 мг при боли', mechanism: '↓ COX-1/2 → ↓ простагландины → ↓ воспаление', evidenceLevel: 'A' },
          { substanceId: 'smaller_volume', name: 'Разделение инъекции на 2 точки', type: 'lifestyle', dose: '≤2.5 мл на точку', mechanism: '↓ локальное давление в мышце → меньше PIP', evidenceLevel: 'C' },
        ],
        expectations: [
          { timeline: '24-72 ч', effect: 'PIP проходит самостоятельно в большинстве случаев', sideNote: 'Если боль НАРАСТАЕТ через 3 дня — подозрение на инфекцию' },
          { timeline: '1-2 нед', effect: 'Уплотнение ("стерильный абсцесс"): медленно рассасывается', sideNote: 'Не пытаться выдавить или вскрыть стерильное уплотнение' },
          { timeline: 'Немедленно', effect: 'Покраснение + горячая кожа + лихорадка >38°C + флюктуация = ИНФЕКЦИОННЫЙ АБСЦЕСС → хирург', sideNote: 'Инфекционный абсцесс требует дренирования и антибиотиков' },
        ],
      },
    ],
  },
  {
    id: 'erectile_dysfunction', symptom: 'Эректильная дисфункция (ЭД) / невозможность достичь эрекции', category: 'endocrine',
    urgency: 'warning', relatedSymptoms: ['libido_loss', 'testicular_atrophy'],
    quickFacts: ['Распространённость на курсе: 20-35%', 'Основные причины: ↑ E2, ↑ пролактин, ↓ DHT', 'Обратима при коррекции гормонального фона'],
    generalInfo: 'ЭД на курсе ААС — многофакторная проблема. Отличается от простой потери либидо: либидо — желание, ЭД — механика. Причины: 1) эстрогенный дисбаланс (E2 ↓ или ↑), 2) гиперпролактинемия (↓ дофамин), 3) ↓ DHT, 4) сосудистый компонент (эндотелиальная дисфункция + ↑ Hct), 5) психогенный компонент.',
    problems: [
      {
        problem: 'Эндотелиальная дисфункция + гемореологические нарушения', probability: 'medium',
        mechanism: 'ААС ↓ eNOS → ↓ NO → ↓ вазодилатация кавернозных тел. ↑ Hct → ↑ вязкость → ↓ микроциркуляция. Эндотелиальная дисфункция — ранний и потенциально необратимый эффект длительного применения.',
        labMarkers: [
          { marker: 'E2 (эстрадиол)', expectedChange: '↔', targetRange: '20-50 пг/мл ♂', when: 'Немедленно' },
          { marker: 'Пролактин', expectedChange: '↔', targetRange: '86-324 мкМЕ/мл', when: 'Немедленно' },
          { marker: 'DHT', expectedChange: '↓', targetRange: '0.4-2.5 нмоль/л', when: 'При нормальном T' },
          { marker: 'Гематокрит', expectedChange: '↑', targetRange: '40-50%', when: 'Каждые 4-8 нед' },
          { marker: 'Гомоцистеин', expectedChange: '↔', targetRange: '<15 мкмоль/л', when: 'При ЭД (маркер эндотелиальной дисфункции)' },
        ],
        solutions: [
          { substanceId: 'tadalafil', name: 'Тадалафил (Cialis)', type: 'pharma', dose: '5 мг/сут (ежедневно) или 20 мг по требованию', mechanism: 'Ингибитор PDE5 → ↑ cGMP → вазодилатация кавернозных тел', evidenceLevel: 'A' },
          { substanceId: 'citrulline', name: 'L-цитруллин', type: 'supplement', dose: '3-6 г/сут', mechanism: 'Предшественник аргинина → ↑ NO → улучшение эндотелиальной функции', evidenceLevel: 'A' },
          { substanceId: 'pycnogenol', name: 'Пикногенол (кора сосны)', type: 'supplement', dose: '100-200 мг/сут', mechanism: '↑ eNOS, ↓ окислительный стресс в эндотелии', evidenceLevel: 'B' },
          { substanceId: 'omega3', name: 'Омега-3 (EPA/DHA)', type: 'supplement', dose: '3-4 г/сут', mechanism: 'Улучшение эндотелиальной функции', evidenceLevel: 'A' },
          { substanceId: 'cabergoline', name: 'Каберголин (при ↑ пролактина)', type: 'pharma', dose: '0.25-0.5 мг 2×/нед', mechanism: 'D2-агонист → ↓ пролактин → ↑ дофамин', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '30-60 мин', effect: 'Тадалафил 20 мг: улучшение эрекции (через NO-путь)', sideNote: 'Не действует без сексуальной стимуляции' },
          { timeline: '2-4 нед', effect: 'Цитруллин 6 г: ↑ NO, улучшение качества эрекции на 20-30%' },
          { timeline: 'Немедленно', effect: 'ЭД + боль в груди при нагрузке → исключить ИБС. PDE5-ингибиторы + нитраты = смертельная гипотензия!', sideNote: 'Органическая ЭД на курсе — повод для кардиологического обследования' },
        ],
      },
    ],
  },
  {
    id: 'prostate_issues', symptom: 'Частое / затруднённое мочеиспускание (симптомы простаты)', category: 'endocrine',
    urgency: 'warning', relatedSymptoms: ['libido_loss', 'testicular_atrophy'],
    quickFacts: ['ДГПЖ на ААС — результат ↑ DHT и E2', 'Учащённое ночное мочеиспускание (никтурия) — ранний признак', 'ПСА может быть ↓ на фоне ААС (ложноотрицательный)'],
    generalInfo: 'Симптомы нижних мочевых путей (СНМП) на курсе: учащённое мочеиспускание, слабая струя, никтурия, чувство неполного опорожнения. Причина — ДГПЖ (доброкачественная гиперплазия) под действием DHT + E2. Важно: ПСА может быть ложно низким на фоне ААС из-за подавления андрогеновой сигнализации в простате.',
    problems: [
      {
        problem: 'Андроген/эстроген-индуцированная гиперплазия простаты', probability: 'medium',
        mechanism: 'DHT (из тестостерона через 5α-редуктазу) — основной фактор роста простаты. E2 через ER-α также стимулирует пролиферацию стромы. ААС ↑ оба фактора → ↑ объём простаты → компрессия уретры → СНМП.',
        labMarkers: [
          { marker: 'ПСА общий + свободный', expectedChange: '↔', targetRange: '<4 нг/мл, своб/общ >25%', when: 'До курса, каждые 6 мес' },
          { marker: 'DHT', expectedChange: '↔', targetRange: '0.4-2.5 нмоль/л', when: 'При СНМП' },
          { marker: 'E2', expectedChange: '↑', targetRange: '20-50 пг/мл', when: 'Каждые 4 нед' },
          { marker: 'УЗИ простаты (ТРУЗИ)', expectedChange: '↔', targetRange: 'Объём <30 см³', when: 'До курса, при СНМП' },
          { marker: 'IPSS (опросник)', expectedChange: '↔', targetRange: '0-7 баллов (лёгкая)', when: 'При СНМП' },
        ],
        solutions: [
          { substanceId: 'finasteride', name: 'Финастерид', type: 'pharma', dose: '5 мг/сут', mechanism: 'Ингибитор 5α-R II типа → ↓ DHT в простате на 80%', evidenceLevel: 'A' },
          { substanceId: 'tamsulosin', name: 'Тамсулозин (α1-блокатор)', type: 'pharma', dose: '0.4 мг/сут', mechanism: '↓ тонус гладкой мускулатуры шейки мочевого пузыря и простаты → ↑ поток', evidenceLevel: 'A' },
          { substanceId: 'saw_palmetto', name: 'Пальма сереноа', type: 'supplement', dose: '320 мг/сут (жирные кислоты)', mechanism: 'Слабый ингибитор 5α-R + ↓ AR в простате', evidenceLevel: 'B' },
          { substanceId: 'zinc', name: 'Цинк', type: 'supplement', dose: '30-50 мг/сут', mechanism: '↓ 5α-редуктазу, ↓ воспаление в простате', evidenceLevel: 'B' },
          { substanceId: 'pygeum', name: 'Пигеум (Pygeum africanum)', type: 'supplement', dose: '100-200 мг/сут', mechanism: '↓ пролиферация фибробластов, ↓ воспаление', evidenceLevel: 'B' },
        ],
        expectations: [
          { timeline: '2-4 нед', effect: 'Тамсулозин: улучшение потока мочи, ↓ никтурия', sideNote: 'Ретроградная эякуляция у 5-10% (обратимо)' },
          { timeline: '3-6 мес', effect: 'Финастерид: ↓ объём простаты на 20-30%', sideNote: '↓ ПСА на 50% — учитывать при скрининге (удваивать значение)' },
          { timeline: 'Немедленно', effect: 'Острая задержка мочи → катетеризация → уролог. Это неотложное состояние.', sideNote: 'Острая задержка мочи = ургентная урология' },
        ],
      },
    ],
  },
  {
    id: 'vision_changes', symptom: 'Нарушения зрения / пятна / "снег" в глазах (SERM-токсичность)', category: 'cns',
    urgency: 'critical', relatedSymptoms: ['insomnia', 'anxiety'],
    quickFacts: ['Классический SERM-эффект: тамоксифен, кломифен', 'Механизм: кристаллическая ретинопатия', 'При появлении — НЕМЕДЛЕННАЯ отмена препарата'],
    generalInfo: 'Нарушения зрения при приёме SERM (тамоксифен, кломифен) или высоких доз ААС — ПОТЕНЦИАЛЬНО НЕОБРАТИМЫЙ побочный эффект. SERM вызывают кристаллическую ретинопатию (отложения в макуле), проявляющуюся как "снег", пятна, искажение линий, ↓ остроты зрения. Требует немедленной отмены препарата и консультации офтальмолога.',
    problems: [
      {
        problem: 'SERM-индуцированная кристаллическая ретинопатия', probability: 'medium',
        mechanism: 'Тамоксифен накапливается в тканях глаза, образуя кристаллические отложения в слое нервных волокон сетчатки и макуле → искажение зрения. Дозозависимый эффект (выше при дозах >20 мг/сут и длительном приёме). Кломифен — аналогичный, но более редкий эффект.',
        labMarkers: [
          { marker: 'Офтальмоскопия (глазное дно)', expectedChange: '↔', targetRange: 'Без кристаллов', when: 'НЕМЕДЛЕННО при симптомах' },
          { marker: 'ОКТ (оптическая когерентная томография)', expectedChange: '↔', targetRange: 'Норма', when: 'При симптомах' },
          { marker: 'Острота зрения', expectedChange: '↔', targetRange: '1.0 (100%)', when: 'При симптомах' },
        ],
        solutions: [
          { substanceId: 'stop_serm', name: 'НЕМЕДЛЕННАЯ ОТМЕНА SERM', type: 'lifestyle', dose: '—', mechanism: 'Устранение токсического агента', evidenceLevel: 'A' },
          { substanceId: 'switch_to_ai', name: 'Замена на ингибитор ароматазы', type: 'pharma', dose: 'Анастрозол 0.25 мг 2×/нед', mechanism: 'Альтернативный контроль E2 без ретинальной токсичности', evidenceLevel: 'A' },
          { substanceId: 'ophthalmologist', name: 'Консультация офтальмолога', type: 'lifestyle', dose: '—', mechanism: 'Оценка степени повреждения, прогноз восстановления', evidenceLevel: 'A' },
          { substanceId: 'nac', name: 'NAC', type: 'supplement', dose: '1200-2400 мг/сут', mechanism: 'Антиоксидант → ↓ окислительное повреждение сетчатки', evidenceLevel: 'C' },
        ],
        expectations: [
          { timeline: 'Немедленно', effect: 'ОТМЕНИТЬ SERM. Не ждать ухудшения.', sideNote: 'Кристаллическая ретинопатия может быть НЕОБРАТИМОЙ при продолжении приёма' },
          { timeline: '1-4 нед', effect: 'После отмены: частичное восстановление зрения у 60-70%', sideNote: 'У 30% изменения персистируют — профилактика важнее лечения' },
          { timeline: '3-6 мес', effect: 'Контрольная ОКТ: оценка динамики кристаллов', sideNote: 'Офтальмологический контроль 1×/год при длительном приёме SERM' },
        ],
      },
    ],
  },
  {
    id: 'insulin_resistance_signs', symptom: 'Постоянный голод / тяга к сладкому / сонливость после еды', category: 'endocrine',
    urgency: 'warning', relatedSymptoms: ['fatigue', 'bloating'],
    quickFacts: ['↑ на курсе гормона роста и некоторых ААС', 'Инсулинорезистентность развивается за 4-8 нед', 'Ранний маркер: HOMA-IR >2.5'],
    generalInfo: 'Инсулинорезистентность (ИР) — метаболический побочный эффект ААС, особенно гормона роста и оксиметолона. Симптомы: постоянный голод (даже после еды), тяга к сладкому, сонливость после углеводной нагрузки, трудности с похудением. Хроническая ИР → метаболический синдром → диабет 2 типа.',
    problems: [
      {
        problem: 'ААС/GH-индуцированная инсулинорезистентность', probability: 'high',
        mechanism: 'Гормон роста (GH) — мощный диабетогенный гормон: стимулирует липолиз → ↑ СЖК → ↓ чувствительность к инсулину. Некоторые ААС (оксиметолон) ↓ GLUT4-транслокацию. Андрогены ↓ адипонектин → ↑ ИР.',
        labMarkers: [
          { marker: 'Глюкоза натощак', expectedChange: '↑', targetRange: '4.1-5.9 ммоль/л', when: 'Каждые 4 нед' },
          { marker: 'Инсулин натощак', expectedChange: '↑', targetRange: '2.6-24.9 мкМЕ/мл', when: 'Каждые 4-8 нед' },
          { marker: 'HOMA-IR', expectedChange: '↑', targetRange: '<2.5', when: 'Каждые 8 нед' },
          { marker: 'HbA1c', expectedChange: '↑', targetRange: '4.5-5.7%', when: 'Каждые 8-12 нед' },
          { marker: 'Липидограмма', expectedChange: '↔', targetRange: 'ЛПНП <3.0, ТГ <1.7', when: 'Каждые 8 нед' },
        ],
        solutions: [
          { substanceId: 'metformin', name: 'Метформин', type: 'pharma', dose: '500-1000 мг 2×/день с едой', mechanism: '↓ глюконеогенез в печени + ↑ GLUT4-транслокацию → ↓ ИР', evidenceLevel: 'A' },
          { substanceId: 'berberine', name: 'Берберин', type: 'supplement', dose: '500 мг 3×/день перед едой', mechanism: 'Активация AMPK → ↓ глюконеогенез, ↑ захват глюкозы (аналог метформина)', evidenceLevel: 'A' },
          { substanceId: 'alpha_lipoic', name: 'R-ALA', type: 'supplement', dose: '300-600 мг/сут', mechanism: '↑ GLUT4-транслокацию, инсулин-миметик', evidenceLevel: 'A' },
          { substanceId: 'chromium', name: 'Хром пиколинат', type: 'supplement', dose: '400-1000 мкг/сут', mechanism: '↑ чувствительность к инсулину (хромодулин)', evidenceLevel: 'B' },
          { substanceId: 'low_gi_diet', name: 'Низкогликемическая диета', type: 'lifestyle', dose: 'Сложные углеводы, клетчатка ≥30 г/сут', mechanism: '↓ постпрандиальная гипергликемия', evidenceLevel: 'A' },
          { substanceId: 'cardio', name: 'Аэробные нагрузки', type: 'lifestyle', dose: '30-45 мин 4-5×/нед', mechanism: '↑ GLUT4, ↑ чувствительность к инсулину на 24-48 ч', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '1-2 нед', effect: 'Метформин 500 мг: начало ↓ глюкозы натощак и постпрандиальной', sideNote: 'Начинать с 500 мг вечером — минимизировать GI-побочки' },
          { timeline: '2-4 нед', effect: 'Берберин 1500 мг/сут: ↓ HOMA-IR на 25-30%', sideNote: 'Не комбинировать с метформином без контроля — риск гипогликемии' },
          { timeline: '4-8 нед', effect: 'Комплексный подход: снижение HOMA-IR в норму, ↓ голод', sideNote: 'GH + инсулин вместе — экстремально высокий риск ИР. Обязателен мониторинг' },
        ],
      },
    ],
  },
  {
    id: 'thyroid_dysfunction', symptom: 'Симптомы дисфункции щитовидной: усталость / зябкость / сухость кожи (гипо) или потливость / тремор / тахикардия (гипер)', category: 'endocrine',
    urgency: 'warning', relatedSymptoms: ['fatigue', 'tachycardia', 'brain_fog'],
    quickFacts: ['T3/T4 часто используются на курсе для ↑ метаболизма', 'После отмены T3: rebound-гипотиреоз (2-6 нед)', '"T3-курс" без тестостерона = катаболизм мышц'],
    generalInfo: 'Тиреоидные гормоны (T3, T4) часто используются в бодибилдинге для ускорения метаболизма и сушки. Гипертиреоз на курсе: тахикардия, потливость, тремор, потеря веса. После отмены — rebound-гипотиреоз: вялость, набор веса, отёки. Лабораторный контроль обязателен — TT3, TT4, ТТГ.',
    problems: [
      {
        problem: 'Экзогенный гипертиреоз (T3/T4-курс)', probability: 'medium',
        mechanism: 'Приём T3 (25-100 мкг/сут) или T4 подавляет ТТГ → ↓ эндогенная продукция → при отмене — временный гипотиреоз до восстановления оси (2-6 нед). Гипертиреоз ↑ метаболизм → ↑ ЧСС, ↑ термогенез, ↑ катаболизм (при недостатке ААС).',
        labMarkers: [
          { marker: 'ТТГ', expectedChange: '↓', targetRange: '0.4-4.0 мМЕ/л', when: 'До курса, каждые 4 нед' },
          { marker: 'FT3', expectedChange: '↑', targetRange: '3.1-6.8 пмоль/л', when: 'Каждые 4 нед' },
          { marker: 'FT4', expectedChange: '↓', targetRange: '9-22 пмоль/л', when: 'Каждые 4 нед (↓ из-за подавления ТТГ)' },
        ],
        solutions: [
          { substanceId: 'taper_t3', name: 'Постепенное снижение T3 (титрация вниз)', type: 'lifestyle', dose: '↓ на 12.5-25 мкг каждые 3-4 дня', mechanism: 'Дать время гипофизу восстановить ТТГ', evidenceLevel: 'B' },
          { substanceId: 'selenium', name: 'Селен', type: 'supplement', dose: '200 мкг/сут', mechanism: 'Кофактор дейодиназы D1 (конверсия T4→T3)', evidenceLevel: 'A' },
          { substanceId: 'zinc', name: 'Цинк', type: 'supplement', dose: '30-50 мг/сут', mechanism: 'Необходим для синтеза ТТГ и тиреоидных гормонов', evidenceLevel: 'B' },
          { substanceId: 'tyrosine', name: 'L-тирозин', type: 'supplement', dose: '500-1000 мг/сут', mechanism: 'Предшественник тиреоидных гормонов (неэффективен при подавленном ТТГ)', evidenceLevel: 'C' },
          { substanceId: 'ashwagandha', name: 'Ашваганда', type: 'supplement', dose: '300-600 мг/сут', mechanism: 'Может ↑ T4 (осторожно при приёме T3/T4)', evidenceLevel: 'B' },
        ],
        expectations: [
          { timeline: 'Немедленно', effect: 'Т3 дозы >50 мкг/сут + ЧСС >100 = снизить дозу', sideNote: 'Т3 без ААС — катаболизм мышц! Минимальная защита — тестостерон 200-300 мг/нед' },
          { timeline: '2-6 нед', effect: 'После отмены Т3: rebound-гипотиреоз. Симптомы: вялость, набор веса, отёки. Проходит самостоятельно.' },
          { timeline: '4-8 нед', effect: 'Селен + цинк: поддержка восстановления тиреоидной оси', sideNote: 'При ТТГ >10 через 8 нед после отмены — консультация эндокринолога' },
        ],
      },
    ],
  },
  {
    id: 'pct_lethargy', symptom: 'Вялость / апатия / "туман" на ПКТ', category: 'psychological',
    urgency: 'warning', relatedSymptoms: ['depression', 'libido_loss', 'brain_fog'],
    quickFacts: ['Пик симптомов: 2-4 нед после начала ПКТ', 'Причина: гормональная перестройка + ↓ нейростероиды', 'Обычно проходит к 6-8 нед ПКТ'],
    generalInfo: 'Постцикловая вялость — изнуряющий симптом на ПКТ, связанный с гормональной нестабильностью: ↓ тестостерон, ↓ E2 (SERM), ↓ нейростероиды, колебания кортизола. Это НЕ "лень" — это физиологический дефицит нейротрансмиттеров. Адаптация занимает 4-8 нед.',
    problems: [
      {
        problem: 'Гормональная депривация на ПКТ (low T + low E2 + low нейростероиды)', probability: 'high',
        mechanism: 'SERM (тамоксифен, кломифен) блокируют ER в ЦНС → несмотря на ↑ Т, мозг "не видит" эстрогены → симптомы гипоэстрогении: вялость, апатия, brain fog. + ↓ аллопрегнанолон (↓ GABA) → тревога + усталость. SERM также ↓ IGF-1 на 20-30% (печёночный эффект).',
        labMarkers: [
          { marker: 'Тестостерон общий', expectedChange: '↔', targetRange: '12.1-34.7 нмоль/л', when: 'Каждые 2-4 нед' },
          { marker: 'E2', expectedChange: '↔', targetRange: '20-50 пг/мл ♂', when: 'Каждые 2-4 нед' },
          { marker: 'ЛГ, ФСГ', expectedChange: '↑', targetRange: 'ЛГ 1.7-8.6', when: 'Каждые 2-4 нед (оценка ответа на SERM)' },
          { marker: 'IGF-1', expectedChange: '↓', targetRange: 'Возрастная норма', when: 'При выраженной вялости' },
          { marker: 'Кортизол (утро)', expectedChange: '↔', targetRange: '5-20 нмоль/л', when: 'При вялости' },
        ],
        solutions: [
          { substanceId: 'hcg', name: 'hCG (до начала SERM)', type: 'pharma', dose: '500-1000 МЕ 2-3×/нед 2-3 нед', mechanism: 'Стимуляция клеток Лейдига → ↑ T + ↑ E2 (через ароматизацию) → ↓ SERM-индуцированная вялость', evidenceLevel: 'A' },
          { substanceId: 'dhea', name: 'DHEA', type: 'supplement', dose: '25-50 мг/сут', mechanism: 'Предшественник T и E2 → ↑ нейростероиды → улучшение настроения', evidenceLevel: 'B' },
          { substanceId: 'ashwagandha', name: 'Ашваганда (KSM-66)', type: 'supplement', dose: '600 мг/сут', mechanism: '↓ кортизол, адаптоген, ↑ устойчивость к стрессу', evidenceLevel: 'A' },
          { substanceId: 'vitamin_d', name: 'Витамин D3', type: 'supplement', dose: '5000-10000 МЕ/сут', mechanism: '↑ дофамин, ↑ серотонин, нейростероидогенез', evidenceLevel: 'A' },
          { substanceId: 'enclomiphene', name: 'Энкломифен (вместо кломифена)', type: 'pharma', dose: '25 мг/сут', mechanism: 'Чистый транс-изомер → меньше ER-блокады в ЦНС → меньше вялости', evidenceLevel: 'A' },
          { substanceId: 'exercise_moderate', name: 'Умеренные тренировки', type: 'lifestyle', dose: '3-4×/нед, объём -20%', mechanism: '↑ BDNF, ↑ эндорфины, без перегрузки ЦНС', evidenceLevel: 'B' },
        ],
        expectations: [
          { timeline: '2-4 нед', effect: 'Пик вялости: адаптация к SERM, гормональные колебания', sideNote: 'Это НОРМАЛЬНО. Не повышать дозу SERM — усугубит ЭД и вялость' },
          { timeline: '4-6 нед', effect: 'Начало улучшения: стабилизация гормонального фона, ↑ толерантность к SERM' },
          { timeline: '6-8 нед', effect: 'Значительное улучшение: возвращение энергии, ясности мышления', sideNote: 'При отсутствии улучшения через 8 нед — проверить кортизол, DHEA-S, IGF-1' },
          { timeline: 'Немедленно', effect: 'hCG до ПКТ (2-3 нед): ↓ тяжесть ПКТ-симптомов, ↑ плавность перехода', sideNote: 'Оптимальный протокол: hCG последние 2-3 нед курса + 2 нед после → ПКТ' },
        ],
      },
    ],
  },
  {
    id: 'nausea', symptom: 'Тошнота / рвота / отвращение к пище', category: 'gastrointestinal',
    urgency: 'warning', relatedSymptoms: ['liver_pain', 'appetite_loss'],
    quickFacts: ['Наиболее частая причина: ор. ААС на голодный желудок', 'Гепатотоксичность → тошнота — серьёзный признак', 'Отвращение к белковой пище — классический признак печёночной перегрузки'],
    generalInfo: 'Тошнота на курсе — от банальной (пероральные ААС на голодный желудок) до серьёзной (гепатотоксичность). Ключевой дифференциальный признак: тошнота после приёма таблеток vs постоянная тошнота + отвращение к мясу. Второе — признак печёночной недостаточности, требует немедленного обследования.',
    problems: [
      {
        problem: 'Пероральные ААС / добавки на голодный желудок', probability: 'high',
        mechanism: '17α-алкилированные ААС и некоторые добавки (цинк натощак, АЛЬК, NAC высокие дозы) раздражают слизистую желудка → тошнота. Причина: прямой контакт с mucosa + стимуляция хеморецепторов.',
        labMarkers: [
          { marker: 'АЛТ, АСТ (исключить гепатотоксичность)', expectedChange: '↔', targetRange: '<40 Ед/л', when: 'При постоянной тошноте' },
        ],
        solutions: [
          { substanceId: 'with_food', name: 'Принимать препараты С ЕДОЙ', type: 'lifestyle', dose: '—', mechanism: 'Буферизация слизистой желудка пищей', evidenceLevel: 'A' },
          { substanceId: 'ginger', name: 'Имбирь (свежий / экстракт)', type: 'supplement', dose: '500-1000 мг за 30 мин до приёма', mechanism: '5-HT3 антагонист → ↓ тошнота', evidenceLevel: 'A' },
          { substanceId: 'vitamin_b6', name: 'Витамин B6', type: 'supplement', dose: '50-100 мг', mechanism: '↓ тошнота через ЦНС-механизм (используется при токсикозе беременных)', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: 'Немедленно', effect: 'Приём с едой: ↓ тошнота на 90% при лекарственной природе' },
          { timeline: '30-60 мин', effect: 'Имбирь 500 мг: ↓ тошнота через 30 мин, пик через 60 мин' },
        ],
      },
      {
        problem: 'Гепатотоксичность + уремия (тошнота как признак печёночной/почечной недостаточности)', probability: 'low',
        mechanism: 'Тяжёлая гепатотоксичность (АЛТ >5× ВГН) → ↓ детоксикация → накопление токсинов → тошнота + отвращение к мясу. Почечная недостаточность → ↑ мочевина → уремическая тошнота.',
        labMarkers: [
          { marker: 'АЛТ, АСТ, ГГТ', expectedChange: '↑↑', targetRange: '<40, <40, <55', when: 'НЕМЕДЛЕННО' },
          { marker: 'Мочевина, креатинин', expectedChange: '↑', targetRange: 'Мочевина 2.5-8.3, креатинин 62-106', when: 'НЕМЕДЛЕННО' },
        ],
        solutions: [
          { substanceId: 'stop_aas', name: 'ОТМЕНИТЬ все ААС', type: 'lifestyle', dose: '—', mechanism: 'Устранение источника', evidenceLevel: 'A' },
          { substanceId: 'doctor', name: 'Срочная консультация врача', type: 'lifestyle', dose: '—', mechanism: 'Диагностика, исключение ОПечН/ОПН', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: 'Немедленно', effect: 'Тошнота + отвращение к мясу = печёночная недостаточность до исключения. Срочно АЛТ/АСТ + врач.', sideNote: 'Не принимать противорвотные — маскировка симптома' },
        ],
      },
    ],
  },
  {
    id: 'excessive_sweating', symptom: 'Повышенная потливость днём / гипергидроз', category: 'cns',
    relatedSymptoms: ['anxiety', 'night_sweats', 'thyroid_dysfunction'],
    quickFacts: ['Симпатическая активация — основная причина', 'Тренболон — наиболее потогенный ААС', 'Дифференцировать с гипогликемией и гипертиреозом'],
    generalInfo: 'Повышенная потливость (гипергидроз) на курсе — результат симпатической гиперактивации и ↑ термогенеза. ААС ↑ базальный метаболизм на 5-15%. Тренболон и кленбутерол особенно потогенны. Важно исключить гипогликемию (инсулин) и гипертиреоз (T3).',
    problems: [
      {
        problem: 'ААС-индуцированный гипергидроз (симпатическая активация + ↑ метаболизм)', probability: 'high',
        mechanism: 'ААС ↑ базальный метаболизм → ↑ теплопродукция → компенсаторное потоотделение. Симпатическая активация (тренболон, кленбутерол) → ↑ холинергическая стимуляция потовых желёз. ↑ катехоламинов → термогенез в бурой жировой ткани.',
        labMarkers: [
          { marker: 'TT3, ТТГ', expectedChange: '↔', targetRange: 'ТТГ 0.4-4.0', when: 'Исключить гипертиреоз' },
          { marker: 'Глюкоза', expectedChange: '↔', targetRange: '4.0-5.9 ммоль/л', when: 'Исключить гипогликемию' },
        ],
        solutions: [
          { substanceId: 'magnesium', name: 'Магния глицинат', type: 'supplement', dose: '400-600 мг/сут', mechanism: '↓ симпатический тонус через ↓ выброс катехоламинов', evidenceLevel: 'B' },
          { substanceId: 'l_theanine', name: 'L-теанин', type: 'supplement', dose: '200-400 мг 2×/день', mechanism: '↑ α-волны → ↓ симпатическая активность → ↓ потоотделение', evidenceLevel: 'C' },
          { substanceId: 'sage', name: 'Шалфей (экстракт)', type: 'supplement', dose: '300-600 мг/сут', mechanism: 'Антихолинергический эффект на потовые железы', evidenceLevel: 'B' },
          { substanceId: 'reduce_stimulants', name: '↓ кофеин / стимуляторы', type: 'lifestyle', dose: 'Кофеин ≤200 мг/сут', mechanism: '↓ симпатическая стимуляция потовых желёз', evidenceLevel: 'C' },
        ],
        expectations: [
          { timeline: '1-2 нед', effect: 'L-теанин + Mg: ↓ baseline-потливость, особенно при тревожности-связанной' },
          { timeline: 'Немедленно', effect: 'Потливость + тремор + тахикардия + потеря веса → исключить гипертиреоз', sideNote: 'При нормальном ТТГ — адаптивная реакция, не патология' },
        ],
      },
    ],
  },
  {
    id: 'water_retention_face', symptom: 'Одутловатость лица / "лунное лицо" (кушингоидные черты)', category: 'endocrine',
    urgency: 'warning', relatedSymptoms: ['edema', 'hypertension'],
    quickFacts: ['Классический признак задержки воды', 'Наиболее выражен на оксиметолоне, тестостероне', 'Проходит через 1-2 нед после отмены или коррекции E2'],
    generalInfo: 'Одутловатость лица ("moon face") — результат задержки Na⁺ и воды в подкожно-жировой клетчатке лица. Напоминает кушингоидный тип (но без перераспределения жира). Наиболее выражен на высоких дозах тестостерона, оксиметолоне, при ↑ E2. Может сопровождаться повышением АД.',
    problems: [
      {
        problem: 'Эстроген/минералокортикоид-индуцированная задержка воды в мягких тканях лица', probability: 'high',
        mechanism: '↑ E2 (ароматизация) → ↑ гиалуроновая кислота в коже → ↑ связывание воды → отёчность. Активация РААС → ↑ Na⁺ → ↑ вода во внеклеточном пространстве → одутловатость. Наиболее заметно утром после горизонтального положения.',
        labMarkers: [
          { marker: 'E2', expectedChange: '↑', targetRange: '20-50 пг/мл ♂', when: 'Каждые 4 нед' },
          { marker: 'АД', expectedChange: '↑', targetRange: '<130/85', when: 'Ежедневно' },
          { marker: 'Na⁺ сыворотки', expectedChange: '↔', targetRange: '135-145 ммоль/л', when: 'Каждые 4 нед' },
        ],
        solutions: [
          { substanceId: 'anastro', name: 'Анастрозол (контроль E2)', type: 'pharma', dose: '0.25-0.5 мг 2×/нед', mechanism: '↓ ароматизация → ↓ E2 → ↓ задержка воды', evidenceLevel: 'A' },
          { substanceId: 'telmisartan', name: 'Телмисартан', type: 'pharma', dose: '40-80 мг/сут', mechanism: 'ARB → ↓ альдостерон → натрийурез', evidenceLevel: 'A' },
          { substanceId: 'potassium', name: 'Калия цитрат', type: 'supplement', dose: '1000-2000 мг/сут', mechanism: 'Na⁺/K⁺-баланс → ↓ задержка воды', evidenceLevel: 'B' },
          { substanceId: 'low_sodium', name: '↓ Na⁺ до <3 г/сут', type: 'lifestyle', dose: '<3 г/сут', mechanism: '↓ осмотическая задержка воды', evidenceLevel: 'A' },
          { substanceId: 'cardio', name: 'LISS-кардио', type: 'lifestyle', dose: '30-45 мин/день', mechanism: 'Потоотделение → ↓ ОЦК → ↓ отёчность лица', evidenceLevel: 'B' },
        ],
        expectations: [
          { timeline: '24-48 ч', effect: 'Анастрозол: начало ↓ E2 → уменьшение одутловатости через 3-5 дней' },
          { timeline: '1-2 нед', effect: 'Контроль E2 + ↓ Na⁺ + кардио: видимое улучшение контуров лица' },
          { timeline: 'Немедленно', effect: 'Одутловатость лица + ↑ АД + головная боль = риск гипертонического криза. Измерить АД.', sideNote: 'Отёк лица, не спадающий после отмены ААС >2 нед → исключить СН, нефротический синдром' },
        ],
      },
    ],
  },
  {
    id: 'sleep_apnea_signs', symptom: 'Храп / остановки дыхания во сне / утренняя головная боль', category: 'cns',
    urgency: 'warning', relatedSymptoms: ['insomnia', 'hypertension', 'fatigue'],
    quickFacts: ['↑ риск на курсе: набор массы тела и шеи', 'GH ↑ риск апноэ через ↑ тканей глотки', 'Утренняя головная боль — классический симптом'],
    generalInfo: 'Апноэ сна (СОАС) на курсе ААС/GH: ↑ масса тела и окружность шеи → механическая обструкция дыхательных путей. GH ↑ мягкие ткани глотки → усугубление. Симптомы: громкий храп, остановки дыхания (со слов партнёра), пробуждения с чувством удушья, утренняя головная боль, дневная сонливость.',
    problems: [
      {
        problem: 'Обструктивное апноэ сна (СОАС) на фоне набора массы', probability: 'medium',
        mechanism: '↑ мышечная масса → ↑ окружность шеи >43 см ♂ → сужение просвета глотки в горизонтальном положении. GH/IGF-1 → ↑ мягкие ткани (язык, нёбо) → усугубление обструкции. Жидкость перераспределяется в верхнюю половину тела ночью (rostral fluid shift).',
        labMarkers: [
          { marker: 'Окружность шеи', expectedChange: '↔', targetRange: '<43 см ♂', when: 'Измерить' },
          { marker: 'Полисомнография', expectedChange: '↔', targetRange: 'ИАГ <5/ч (норма)', when: 'При подозрении' },
          { marker: 'SpO₂ ночью (пульсоксиметр)', expectedChange: '↓', targetRange: 'SpO₂ >90% всю ночь', when: 'При подозрении (скрининг)' },
        ],
        solutions: [
          { substanceId: 'cpap', name: 'CPAP-терапия', type: 'lifestyle', dose: '—', mechanism: 'Постоянное положительное давление → шинирование дыхательных путей', evidenceLevel: 'A' },
          { substanceId: 'weight_loss', name: 'Снижение веса', type: 'lifestyle', dose: '↓ окружность шеи <43 см', mechanism: 'Механическое уменьшение обструкции', evidenceLevel: 'A' },
          { substanceId: 'side_sleeping', name: 'Сон на боку', type: 'lifestyle', dose: '—', mechanism: '↓ гравитационный коллапс мягких тканей глотки', evidenceLevel: 'B' },
          { substanceId: 'reduce_gh', name: 'Снижение дозы GH', type: 'lifestyle', dose: '↓ на 30-50%', mechanism: '↓ гиперплазия мягких тканей', evidenceLevel: 'C' },
        ],
        expectations: [
          { timeline: 'Немедленно', effect: 'Сон на боку: ↓ ИАГ на 20-30% у части пациентов' },
          { timeline: '1-2 нед', effect: 'CPAP: устранение апноэ, ↓ утренняя головная боль, ↑ качество сна', sideNote: 'Требуется подбор давления в sleep-лаборатории' },
          { timeline: 'Постоянно', effect: 'Нелеченное апноэ → ↑ риск АГ, ИБС, инсульта, аритмий', sideNote: 'Апноэ = медицинская проблема. Требует диагностики и лечения, а не БАДов' },
        ],
      },
    ],
  },
  {
    id: 'hot_flashes', symptom: 'Приливы жара / внезапное покраснение лица / жар', category: 'endocrine',
    relatedSymptoms: ['anxiety', 'night_sweats'],
    quickFacts: ['Характерны при ↓ E2 (AI-передоз или ПКТ)', 'Механизм: дисрегуляция терморегуляции гипоталамуса', '"Hot flashes" — классический симптом менопаузы (низкий E2)'],
    generalInfo: 'Приливы жара — результат эстрогенной депривации в гипоталамусе. Характерны при низком E2 (передозировка AI, ПКТ с SERM, постцикловый период). Внезапное ощущение жара, покраснение лица и шеи, потоотделение, длятся 30 сек – 5 мин. Проходят при нормализации E2.',
    problems: [
      {
        problem: 'Гипоэстрогения (↓ E2) и дисфункция центра терморегуляции', probability: 'medium',
        mechanism: 'E2 модулирует центр терморегуляции в гипоталамусе (преоптическая область). При резком ↓ E2 → сужение термонейтральной зоны → ложное ощущение перегрева → вазодилатация (покраснение) + потоотделение (охлаждение). SERM (тамоксифен) блокируют ER в ЦНС, имитируя гипоэстрогению.',
        labMarkers: [
          { marker: 'E2 (чувствительный)', expectedChange: '↓', targetRange: '20-50 пг/мл ♂', when: 'Немедленно' },
        ],
        solutions: [
          { substanceId: 'reduce_ai', name: 'Снизить дозу AI / приостановить SERM', type: 'pharma', dose: '—', mechanism: 'Восстановление E2-сигнализации в ЦНС', evidenceLevel: 'A' },
          { substanceId: 'dhea', name: 'DHEA', type: 'supplement', dose: '25-50 мг/сут', mechanism: 'Субстрат для эндогенного синтеза E2', evidenceLevel: 'C' },
          { substanceId: 'soy_isoflavones', name: 'Изофлавоны сои (генистеин)', type: 'supplement', dose: '50-100 мг/сут', mechanism: 'Фитоэстрогены → слабая ER-активация → ↓ приливы', evidenceLevel: 'B' },
        ],
        expectations: [
          { timeline: '1-3 дня', effect: 'Коррекция AI: ↓ приливы по мере восстановления E2', sideNote: 'E2 восстанавливается 3-7 дней после снижения дозы AI' },
          { timeline: '2-4 нед', effect: 'На ПКТ: приливы обычно проходят после завершения SERM', sideNote: 'Приливы на ПКТ — признак, что SERM работает (↓ E2-сигнал в ЦНС)' },
        ],
      },
    ],
  },
  {
    id: 'appetite_loss', symptom: 'Потеря аппетита / отвращение к пище / невозможность есть', category: 'gastrointestinal',
    urgency: 'warning', relatedSymptoms: ['nausea', 'liver_pain', 'depression'],
    quickFacts: ['Наиболее частая причина: ор. ААС + гепатотоксичность', 'Потеря аппетита к мясу — красный флаг печени', 'Длительная потеря → катаболизм → потеря результатов курса'],
    generalInfo: 'Потеря аппетита на курсе — парадоксальное и опасное состояние. ААС обычно повышают аппетит, поэтому его потеря сигнализирует о проблеме: гепатотоксичность, передозировка AI (↓ E2), депрессия (постцикловая), ЖКТ-проблемы. Длительная потеря аппетита → дефицит калорий → катаболизм мышц.',
    problems: [
      {
        problem: 'Гепатотоксичность-индуцированная анорексия', probability: 'medium',
        mechanism: 'Повреждение гепатоцитов → ↓ синтез белков плазмы → ↑ аммиак → тошнота + анорексия. Нарушение метаболизма желчных кислот → диспепсия → отвращение к жирной пище. Характерный признак: отвращение к мясу/белковой пище (специфично для печёночного генеза).',
        labMarkers: [
          { marker: 'АЛТ, АСТ, ГГТ', expectedChange: '↑', targetRange: '<40, <40, <55', when: 'НЕМЕДЛЕННО' },
          { marker: 'Билирубин', expectedChange: '↔', targetRange: '<21 мкмоль/л', when: 'НЕМЕДЛЕННО' },
          { marker: 'Аммиак', expectedChange: '↑', targetRange: '15-45 мкмоль/л', when: 'При выраженной анорексии' },
        ],
        solutions: [
          { substanceId: 'tudca', name: 'TUDCA', type: 'supplement', dose: '500-1000 мг/сут', mechanism: 'Гепатопротекция → ↓ апоптоз + ↑ желчеотток', evidenceLevel: 'A' },
          { substanceId: 'nac', name: 'NAC', type: 'supplement', dose: '1200-2400 мг/сут', mechanism: 'Детоксикация, восстановление глутатиона', evidenceLevel: 'A' },
          { substanceId: 'stop_orals', name: 'ОТМЕНИТЬ пероральные ААС', type: 'lifestyle', dose: '—', mechanism: 'Устранение гепатотоксического агента', evidenceLevel: 'A' },
          { substanceId: 'liquid_calories', name: 'Жидкие калории (протеин + углеводы)', type: 'lifestyle', dose: 'Гейнер / смузи вместо твёрдой пищи', mechanism: 'Обход анорексии через жидкое питание', evidenceLevel: 'C' },
        ],
        expectations: [
          { timeline: '24-72 ч', effect: 'Отмена ор. ААС + TUDCA: начало улучшения аппетита', sideNote: 'Если аппетит не возвращается через 3 дня — исключить другое заболевание' },
          { timeline: 'Немедленно', effect: 'Потеря аппетита к мясу + тошнота + утомляемость = печёночная недостаточность до исключения. Срочно АЛТ/АСТ!', sideNote: 'Не force-feed при печёночной недостаточности — это опасно' },
        ],
      },
    ],
  },
  {
    id: 'varicocele_like', symptom: 'Расширение вен / тяжесть в мошонке / "червивый мешок"', category: 'cardiovascular',
    relatedSymptoms: ['edema', 'testicular_atrophy'],
    quickFacts: ['Может имитировать варикоцеле из-за ↑ венозного давления', 'Дифференцировать с истинным варикоцеле', '↑ чувствительность яичек — частый симптом на ПКТ'],
    generalInfo: 'Ощущение тяжести в мошонке и расширенных вен (симптом "червивого мешка") может быть как истинным варикоцеле (расширение вен гроздевидного сплетения), так и следствием ↑ внутрибрюшного давления + задержки жидкости. Варикоцеле — частая причина мужского бесплодия (↑ температура яичек → ↓ сперматогенез).',
    problems: [
      {
        problem: 'Венозный застой в мошонке (↑ внутрибрюшное давление + задержка жидкости)', probability: 'medium',
        mechanism: 'ААС-индуцированная задержка жидкости + ↑ внутрибрюшное давление (тяжёлые приседания/становая) → затруднение венозного оттока от яичек → венозный стаз → ощущение тяжести. hCG ↑ кровоток в яичках → временное усиление симптома.',
        labMarkers: [
          { marker: 'УЗИ мошонки с допплером', expectedChange: '↔', targetRange: 'Вены <2 мм без рефлюкса', when: 'При симптомах' },
          { marker: 'Спермограмма', expectedChange: '↔', targetRange: 'Нормозооспермия (ВОЗ 2021)', when: 'Если планируется фертильность' },
        ],
        solutions: [
          { substanceId: 'diosmin', name: 'Диосмин + гесперидин', type: 'supplement', dose: '600-1200 мг/сут', mechanism: 'Флеботоник: ↑ тонус вен → ↓ венозный застой', evidenceLevel: 'A' },
          { substanceId: 'horse_chestnut', name: 'Конский каштан (эсцин)', type: 'supplement', dose: '300-600 мг/сут', mechanism: '↓ проницаемость капилляров, ↑ венозный тонус', evidenceLevel: 'A' },
          { substanceId: 'supportive_underwear', name: 'Поддерживающее бельё', type: 'lifestyle', dose: 'На тренировках и в течение дня', mechanism: 'Механическая поддержка → ↓ венозный стаз', evidenceLevel: 'C' },
          { substanceId: 'reduce_valsalva', name: '↓ приёмы Вальсальвы', type: 'lifestyle', dose: 'Ремень на становой, выдох на усилии', mechanism: '↓ внутрибрюшное давление', evidenceLevel: 'C' },
        ],
        expectations: [
          { timeline: '2-4 нед', effect: 'Диосмин 600 мг: ↓ ощущение тяжести, улучшение венозного оттока' },
          { timeline: 'Немедленно', effect: 'Острая боль + отёк мошонки → исключить перекрут яичка. Это ургентная ситуация!', sideNote: 'Перекрут яичка требует операции в течение 6 часов' },
        ],
      },
    ],
  },
  // ═══ ААС/GH/ИНСУЛИН — СПЕЦИФИЧНЫЕ СИМПТОМЫ ═══
  {
    id: 'tren_cough', symptom: '"Трен-кашель" / приступ кашля после инъекции', category: 'cardiovascular',
    urgency: 'warning', linkedDrugs: ['trenbolone'],
    quickFacts: ['Патогномоничный симптом тренболона', 'Частота: 20-30% инъекций', 'Механизм: эмболия масляного раствора в лёгочные капилляры'],
    generalInfo: '"Трен-кашель" — характерный симптом попадания микрокапли масляного раствора тренболона в кровеносный сосуд → эмболия лёгочных капилляров → рефлекторный кашель. Проявляется через 5-30 сек после инъекции: внезапный, неконтролируемый кашель, металлический привкус во рту, чувство жжения в груди. Длится 30 сек – 5 мин. Опасен при частом повторении (микроэмболизация лёгких).',
    problems: [
      {
        problem: 'Микроэмболия масляного раствора в лёгочную артерию', probability: 'medium',
        mechanism: 'При попадании иглы в кровеносный сосуд масляный раствор образует микроэмболы → окклюзия лёгочных капилляров → рефлекторный кашель через J-рецепторы. Масло метаболизируется лёгочными липазами за минуты.',
        stopCriteria: ['Кашель + одышка + цианоз — прекратить инъекцию НЕМЕДЛЕННО', 'Потеря сознания/судороги — экстренная госпитализация', 'После эпизода — не использовать масляный носитель этого производителя'],
        labMarkers: [
          { marker: 'Пульсоксиметрия (SpO₂)', expectedChange: '↔', targetRange: '>95%', when: 'Во время приступа' },
          { marker: 'Аускультация лёгких', expectedChange: '↔', targetRange: 'Чистое дыхание', when: 'После приступа' },
        ],
        solutions: [
          { substanceId: 'aspirate', name: 'Аспирационная проба перед инъекцией', type: 'lifestyle', dose: 'Потянуть поршень на себя на 5 сек', mechanism: 'Если кровь в шприце — игла в сосуде → переколоть', evidenceLevel: 'A' },
          { substanceId: 'z_track', name: 'Z-трак метод инъекции', type: 'lifestyle', dose: 'Сместить кожу перед уколом', mechanism: 'Перекрытие инъекционного канала → ↓ риск утечки в сосуд', evidenceLevel: 'B' },
          { substanceId: 'ventrogluteal', name: 'Инъекция в вентро-ягодичную область', type: 'lifestyle', dose: 'Вместо дорсо-ягодичной', mechanism: 'Меньше крупных сосудов → ↓ риск внутрисосудистой инъекции', evidenceLevel: 'B' },
          { substanceId: 'stay_calm', name: 'Сохранять спокойствие во время приступа', type: 'lifestyle', dose: 'Дышать медленно, не паниковать', mechanism: 'Кашель пройдёт самостоятельно через 1-5 мин (липазы метаболизируют масло)', evidenceLevel: 'C' },
        ],
        expectations: [
          { timeline: '5-30 сек', effect: 'Начало кашля после инъекции — классический трен-кашель', sideNote: 'Не паниковать. Дышать. Пройдёт.' },
          { timeline: '1-5 мин', effect: 'Кашель прекращается самостоятельно', sideNote: 'Если кашель >10 мин + одышка + боль в груди → ОТЁК ЛЁГКИХ → скорую' },
          { timeline: 'Постоянно', effect: 'Аспирационная проба перед КАЖДОЙ инъекцией — профилактика', sideNote: 'Даже с аспирацией трен-кашель возможен. Это не ваша ошибка — это свойство препарата' },
        ],
      },
    ],
  },
  {
    id: 'carpal_tunnel_gh', symptom: 'Онемение / покалывание в пальцах / боль в запястье (GH-индуцированный карпальный туннель)', category: 'musculoskeletal',
    urgency: 'warning', linkedDrugs: ['gh', 'igf1'],
    quickFacts: ['Классический GH-побочный эффект', 'Механизм: отёк мягких тканей → компрессия n. medianus', 'Проходит при снижении дозы GH на 30-50%'],
    generalInfo: 'Карпальный туннельный синдром (КТС) на GH — результат задержки воды и отёка мягких тканей в запястном канале → компрессия срединного нерва. Симптомы: онемение I-III пальцев, боль в запястье, усиливающаяся ночью, слабость хвата, "утренняя скованность" кистей. Первый признак того, что доза GH превышает индивидуальный порог переносимости.',
    problems: [
      {
        problem: 'GH-индуцированный отёк мягких тканей запястного канала', probability: 'high',
        mechanism: 'GH ↑ синтез коллагена и гиалуроновой кислоты → ↑ гидратация соединительной ткани → отёк синовиальных оболочек в запястном канале → компрессия n. medianus. Дозозависимый эффект: чаще при дозах >4 МЕ/сут.',
        labMarkers: [
          { marker: 'IGF-1', expectedChange: '↑', targetRange: 'Возрастная норма (верхняя граница)', when: 'При симптомах КТС' },
          { marker: 'Тест Тинеля / Фалена', expectedChange: '↔', targetRange: 'Отрицательный', when: 'При симптомах' },
          { marker: 'ЭНМГ (при хроническом)', expectedChange: '↔', targetRange: 'Норма', when: 'При стойких симптомах >4 нед' },
        ],
        solutions: [
          { substanceId: 'reduce_gh_dose', name: 'СНИЗИТЬ дозу GH на 30-50%', type: 'lifestyle', dose: 'С 4-6 МЕ до 2-3 МЕ/сут', mechanism: '↓ отёк мягких тканей → декомпрессия нерва', evidenceLevel: 'A' },
          { substanceId: 'wrist_splint', name: 'Ортез на запястье (ночной)', type: 'lifestyle', dose: 'Носить каждую ночь', mechanism: 'Предотвращение сгибания запястья во сне → ↓ компрессия', evidenceLevel: 'A' },
          { substanceId: 'vitamin_b6', name: 'P5P (пиридоксаль-5-фосфат)', type: 'supplement', dose: '100-200 мг/сут', mechanism: 'Нейротрофический эффект, ↓ отёк нерва', evidenceLevel: 'B' },
          { substanceId: 'alpha_lipoic', name: 'R-ALA', type: 'supplement', dose: '600 мг/сут', mechanism: 'Антиоксидант → защита нерва от компрессионной ишемии', evidenceLevel: 'B' },
          { substanceId: 'split_dose', name: 'Разделение дозы GH на 2 инъекции', type: 'lifestyle', dose: '2×/день вместо 1×', mechanism: '↓ пиковая концентрация → ↓ отёк', evidenceLevel: 'C' },
        ],
        expectations: [
          { timeline: '3-7 дней', effect: 'Снижение дозы GH: ↓ отёк, ↓ онемение', sideNote: 'КТС обратим — не требует хирургии при своевременной коррекции' },
          { timeline: '1-2 нед', effect: 'Ортез + P5P: значительное уменьшение ночных симптомов', sideNote: 'Если КТС не проходит после снижения GH — пересмотреть препарат (возможно контаминация?)' },
          { timeline: 'Немедленно', effect: 'КТС + слабость хвата >2 нед → консультация невролога (ЭНМГ)', sideNote: 'Хроническая компрессия без лечения → необратимое повреждение нерва' },
        ],
      },
    ],
  },
];