import type { SymptomEntry } from './symptom-solver.types';

export const DB_PART3: SymptomEntry[] = [

  {
    id: 'cortisol_suppression',
    symptom: 'Подавление кортизола / надпочечниковая недостаточность',
    category: 'endocrine',
    urgency: 'warning',
    linkedDrugs: ['testosterone', 'trenbolone', 'deca'],
    relatedSymptoms: ['pct_lethargy', 'fatigue', 'depression'],
    quickFacts: [
      ' На ААС-курсе кортизол ↓ до 50-70%',
      ' Резкая отмена ААС → ↑↑кортизола (синдром отмены)',
      'Фаза ПКТ —的了 "cortisol rebound" — критическая стадия',
    ],
    generalInfo: 'Подавление оси HPA (гипоталамо-гипофизарно-надпочечниковой) — ключевой механизм синдрома отмены ААС. ААС ↓кортизол через подавление ACTH, а после отмены — резкий отскок.',
    problems: [
      {
        problem: 'ААС-подавление HPA оси с последующим rebound',
        probability: 'high',
        mechanism: 'ААС ↓ACTH →↓кортизол надпочечников. После отмены — кора надпочечников истощена (застой) → ↓выработка → дополнительно ↑CRH → ↑↑↑кортизол (rebound). Может продолжаться 6-12 мес.',
        labMarkers: [
          { marker: 'Кортизол утренний', expectedChange: '↓', targetRange: '138-690 нмоль/л', when: 'На курсе + ПКТ' },
          { marker: 'АКТГ', expectedChange: '↓', targetRange: '10-60 пг/мл', when: 'При symptomsах отмены' },
          { marker: 'Кортизол вечерний', expectedChange: '↓', targetRange: '<50% утреннего', when: 'Контроль цикла' },
        ],
        solutions: [
          { substanceId: 'ashwagandha', name: 'Ашваганда (KSM-66)', type: 'supplement', dose: '300-600 мг/день', mechanism: '↓восприимчивость к кортизолу, баланс HPA', evidenceLevel: 'B' },
          { substanceId: 'rhodiola', name: 'Родиола розовая', type: 'supplement', dose: '200-400 мг/день', mechanism: 'Адаптоген, ↓усталость', evidenceLevel: 'B' },
          { substanceId: 'phosphatidylserine', name: 'Фосфатидилсерин', type: 'supplement', dose: '400-600 мг/день', mechanism: '↓кортизол после тренировок', evidenceLevel: 'A' },
          { substanceId: 'vitamin_c_high', name: 'Витамин C 1000 мг', type: 'supplement', dose: '1000 мг/день', mechanism: 'Кофактор стероидогенеза в надпочечниках', evidenceLevel: 'B' },
          { substanceId: 'taper_course', name: 'Постепенная отменя ААС (титрование)', type: 'lifestyle', dose: 'Снижение дозы 25% в неделю', mechanism: '↓синдрома отмены', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: 'На курсе', effect: 'Кортизол 138-300 нмоль/л (нижняя граница), симптомы не выражены' },
          { timeline: 'ПКТ (1-4 нед)', effect: 'Кортизол ↑↑, вимптомы: усталость, депрессия. Фосфатидилсерин + ашваганда ↓симптомы' },
          { timeline: '6-12 мес после курса', effect: 'Нормализация HPA оси' },
        ],
      },
    ],
  },

  {
    id: 'prolactin_elevation',
    symptom: 'Гиперпролактинемия (высокий пролактин)',
    category: 'endocrine',
    urgency: 'warning',
    linkedDrugs: ['trenbolone', 'deca', 'gh'],
    relatedSymptoms: ['gynecomastia', 'libido_loss', 'depression'],
    quickFacts: [
      ' 19-нор (трен/дека) ↑пролактин через ↓dopamine',
      'Пролактин >25 нг/мл — гинекомастия, ↓либидо, депрессия',
      ' Каберголин 0.25 мг 2р/нед — стандарт лечения',
    ],
    generalInfo: '19-нор-ААС (тренболон, нандролон) ↑пролактин через подавление допаминергического контроля. Высокий пролактин → гинекомастия, ↓либидо, депрессия.',
    problems: [
      {
        problem: '19-нор-индуцированная гиперпролактинемия',
        probability: 'high',
        mechanism: 'Тренболон/нандролон имеют прогестиновой активность → ↑пролактина через ↓D2-рецепторный контроль. Печёночный GH ↑пролактин через ↓соматостатин.',
        labMarkers: [
          { marker: 'Пролактин', expectedChange: '↑↑', targetRange: '4-23 нг/мл (муж.)', when: 'Каждые 4 нед на 19-нор' },
          { marker: 'Прогестерон', expectedChange: '↑', targetRange: '<1.4 нмоль/л (муж.)', when: 'Спец.' },
          { marker: 'Эстрадиол', expectedChange: '↑', targetRange: '<45 пг/мл', when: 'Контроль' },
        ],
        solutions: [
          { substanceId: 'cabergoline', name: 'Каберголин', type: 'pharma', dose: '0.25 мг 2р/нед', mechanism: 'D2-агонист → ↓пролактин', evidenceLevel: 'A' },
          { substanceId: 'vitamin_b6', name: 'Витамин B6 (P-5-P)', type: 'supplement', dose: '200-400 мг/день', mechanism: '↑dopamine → ↓пролактин', evidenceLevel: 'B' },
          { substanceId: 'mucuna_pruriens', name: 'Мукуна жгучая (L-DOPA)', type: 'supplement', dose: '500 мг/день (станд. 15% L-DOPA)', mechanism: '↑dopamine → ↓пролактин', evidenceLevel: 'C' },
        ],
        expectations: [
          { timeline: '1-2 нед', effect: 'Каберголин: ↓пролактина на 50-70%' },
          { timeline: '4-8 нед', effect: 'Нормализация <15 нг/мл, устранение симптомов' },
        ],
      },
    ],
  },

  {
    id: 'serm_side_effects',
    symptom: 'Побочные эффекты SERM (Clomid/Nolva) на ПКТ',
    category: 'endocrine',
    urgency: 'standard',
    linkedDrugs: ['clomid', 'nolvadex'],
    relatedSymptoms: ['pct_lethargy', 'depression', 'vision_changes'],
    quickFacts: [
      ' Clomid: эмоциональные перепады, депрессия, ↓зрения',
      ' Nolvadex:.vsClomid — меньше настроение, риск ВТЭО',
      'Enclomiphene более благоприятный (меньшепобочки)',
    ],
    generalInfo: 'SERM (СЭРМ) — препараты антиэстрогенной терапии, используются в ПКТ. Побочные эффекты часто мешают приверженности.',
    problems: [
      {
        problem: 'Clomid-индуцированные эмоциональные побочки',
        probability: 'high',
        mechanism: 'Кломифен имеет 2 изомера: enclomiphene (анти-E) и zuclomiphene (эстрогенный). Zuclomiphene →↑эстрогенный эффект → эмоциональные перепады, депрессия.',
        labMarkers: [
          { marker: 'Эстрадиол', expectedChange: '↑↑', targetRange: '<45 пг/мл', when: 'Контроль на SERM' },
          { marker: 'Тестостерон', expectedChange: '↑', targetRange: '10-35 нмоль/л', when: 'Ответ на SERM' },
          { marker: 'ЛГ/ФСГ', expectedChange: '↑↑', targetRange: 'Восстановление HPTA', when: 'Через 2-4 нед' },
        ],
        solutions: [
          { substanceId: 'enclomiphene', name: 'Enclomiphene (вместо кломида)', type: 'pharma', dose: '12.5-25 мг/день', mechanism: 'Чистый антиэстроген без эстрогенного изомера', evidenceLevel: 'B' },
          { substanceId: 'reduce_clomid', name: 'Снизить дозу кломида', type: 'lifestyle', dose: '25-50 мг/день (вместо 100)', mechanism: '↓zuclomiphene эффекты', evidenceLevel: 'B' },
          { substanceId: 'ashwagandha', name: 'Ашваганда', type: 'supplement', dose: '300-600 мг/день', mechanism: '↓депрессия/тревожность', evidenceLevel: 'B' },
        ],
        expectations: [
          { timeline: '1-2 нед', effect: 'Улучшение настроения при enclomiphene' },
          { timeline: '4 нед', effect: 'Полная замена кломида на enclomiphene' },
        ],
      },
      {
        problem: 'Tamoxifen-индуцированный риск ВТЭО',
        probability: 'low',
        mechanism: '↓антитромбин III, ↑фактор VIII → ↑риск венозной тромбоэмболии. Чаще при длительном применении + курение + ААС.',
        labMarkers: [
          { marker: 'Антитромбин III', expectedChange: '↓', targetRange: '80-120%', when: 'Контроль' },
          { marker: 'D-димер', expectedChange: '↔', targetRange: '<0.5 мкг/мл', when: 'Контроль' },
        ],
        solutions: [
          { substanceId: 'aspirin', name: 'Аспирин 81 мг', type: 'pharma', dose: '81 мг/день', mechanism: '↓тромбоз', evidenceLevel: 'B' },
          { substanceId: 'limit_duration', name: 'Ограничить длительность Nolvadex', type: 'lifestyle', dose: '4-6 нед ПКТ', mechanism: '↓риск', evidenceLevel: 'B' },
        ],
        expectations: [
          { timeline: '4-6 нед', effect: 'Завершение ПКТ, ↓риска' },
        ],
      },
    ],
  },

  {
    id: 'sarm_testosterone_suppression',
    symptom: 'Подавление тестостерона на SARM-курсе',
    category: 'endocrine',
    urgency: 'warning',
    linkedDrugs: ['rad140', 'lgd4033', 'ostarine'],
    relatedSymptoms: ['libido_loss', 'testicular_atrophy', 'pct_lethargy'],
    quickFacts: [
      ' RAD-140 сильнее всех подавляет HPTA',
      ' LGD-4033: 1 мг/день ↓Т на 50% за 3 нед',
      ' Ostarine (мк-2866): менее подавляющий, но всё же',
      ' Пероральные SARM часто фальсифицированы (проверять)',
    ],
    generalInfo: 'SARM (селективные модуляторы AR) подавляют HPTA в зависимости от дозы и длительности. Многие надеются на "безопасную альтернативу", но в реальности подавление сопоставимо с мягкими ААС.',
    problems: [
      {
        problem: 'SARM-индуцированное подавление HPTA',
        probability: 'high',
        mechanism: 'Андрогенный сигнал в мышцах → AР → ↓GnRH → ↓LH/FSH → ↓тестостерон. Чем выше доза, тем сильнее. RAD-140 ~4-8 нед подавляет полностью.',
        labMarkers: [
          { marker: 'Тестостерон', expectedChange: '↓↓', targetRange: '10-35 нмоль/л', when: 'До и после курса' },
          { marker: 'ЛГ', expectedChange: '↓↓', targetRange: '1.7-8.6 мЕд/мл', when: 'Контроль' },
          { marker: 'ФСГ', expectedChange: '↓', targetRange: '1.5-12.4 мЕд/мл', when: 'Контроль' },
          { marker: 'ГСПГ', expectedChange: '↔ или ↓ (RAD-140)', targetRange: '13-71 нмоль/л', when: 'Контроль' },
        ],
        solutions: [
          { substanceId: 'pct_serms', name: 'ПКТ с SERM (Nolvadex/Enclomiphene)', type: 'pharma', dose: '20 мг Nolva 4 нед или 12.5 мг Enclomiphene', mechanism: '↑GnRH/LH/FSH → ↑эндогенный T', evidenceLevel: 'A' },
          { substanceId: 'test boosters', name: 'Тестобустеры (Tongkat Ali)', type: 'supplement', dose: '200-400 мг/день', mechanism: '↓ГСПГ, ↓T→деградацию, ↑Leydig', evidenceLevel: 'C' },
          { substanceId: 'ashwagandha', name: 'Ашваганда KSM-66', type: 'supplement', dose: '300-600 мг/день', mechanism: '↓кортизола, ↑восстановление HPTA', evidenceLevel: 'B' },
          { substanceId: 'd_aspartic', name: 'D-аспарагиновая кислота', type: 'supplement', dose: '3 г/день (короткий цикл)', mechanism: '↑LH, ↑ тестостерон (умеренный)', evidenceLevel: 'C' },
        ],
        expectations: [
          { timeline: '4 нед ПКТ', effect: 'SERM: восстановление LH/FSH, ↑Т до 70-90%базового' },
          { timeline: '8-12 нед', effect: 'Полное восстановление Т у большинства' },
          { timeline: 'У некоторых при >8 нед SARM', effect: 'Долгое восстановление (3-6 мес)' },
        ],
      },
    ],
  },

  {
    id: 'gh_insulin_resistance',
    symptom: 'GH-индуцированная инсулинорезистентность',
    category: 'endocrine',
    urgency: 'warning',
    linkedDrugs: ['gh'],
    relatedSymptoms: ['insulin_resistance_progression', 'acromegaly_signs', 'abdominal_fat_gain'],
    quickFacts: [
      ' GH 2-4 МЕ/день практически не влияет на глюкозу',
      'GH >6 МЕ/день + углеводы → ↑инсулинорезистентность',
      'Гликированный Hb >6% — перерыв или снижение',
    ],
    generalInfo: 'GH повышает глюконеогенез, lipолиз и ↑FFA — все эти факторы ↓сигнал инсулина. При высоких дозах и/или углеводной диете развивается ИР.',
    problems: [
      {
        problem: 'GH-индуцированная ИР (без инсулина)',
        probability: 'high',
        mechanism: 'GH → ↑печёночный глюконеогенез, ↑липолиз → ↑FFA → ↓ транспорта глюкозы в мышцы, ↓фосфорилирование IRS-1.',
        labMarkers: [
          { marker: 'Глюкоза натощак', expectedChange: '↑', targetRange: '<5.5 ммоль/л', when: 'Каждые 4 нед' },
          { marker: 'Инсулин', expectedChange: '↑', targetRange: '<15 мкЕд/мл', when: 'Каждые 4 нед' },
          { marker: 'HOMA-IR', expectedChange: '↑', targetRange: '<2.5', when: 'Контроль' },
          { marker: 'IGF-1', expectedChange: '↑↑', targetRange: 'возрастная норма', when: 'Контроль GH-эффекта' },
          { marker: 'HbA1c', expectedChange: '↑', targetRange: '<5.7%', when: 'Каждые 12 нед' },
        ],
        solutions: [
          { substanceId: 'berberine', name: 'Берберин', type: 'supplement', dose: '500 мг 3р/день', mechanism: 'AMPK, ↓глюконеогенез', evidenceLevel: 'B' },
          { substanceId: 'metformin', name: 'Метформин', type: 'pharma', dose: '500-1000 мг 2р/день', mechanism: '↓глюконеогенез', evidenceLevel: 'A' },
          { substanceId: 'intermittent_fasting', name: 'Интервальное голодание 16:8', type: 'lifestyle', dose: '16 часов голода + 8 окно', mechanism: '↓инсулина, ↑инсулиночувствительность', evidenceLevel: 'B' },
          { substanceId: 'low_carb_diet', name: 'Низкоуглеводная диета', type: 'lifestyle', dose: '<50 г углеводов/день', mechanism: '↓потребность в инсулине', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '4-8 нед', effect: '↓HOMA-IR, стабилизация глюкозы' },
          { timeline: '12 нед', effect: '↓HbA1c на 0.3-0.5%' },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // РАСШИРЕНИЕ: cns — ЦНС и неврология
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 'steroid_mood_swings',
    symptom: 'Эмоциональная лабильность / перепады настроения',
    category: 'cns',
    urgency: 'warning',
    linkedDrugs: ['testosterone', 'trenbolone', 'anadrol'],
    relatedSymptoms: ['anxiety', 'aggression', 'depression'],
    quickFacts: [
      ' Тренболон + высокий E2 = максимальная лабильность',
      'Уровни нейромедиаторов: ↓serotonin, ↑dopamine, ↑GABA躁',
      ' Сон <6 ч → +30% к эмоциональной нестабильности',
    ],
    generalInfo: 'Эмоциональная лабильность — типичный побочный эффект ААС, особенно выс. доз. Комбинация с тренировками, диетой и стрессом ухудшает ситуацию.',
    problems: [
      {
        problem: 'ААС-опосредованные изменения нейромедиаторов',
        probability: 'high',
        mechanism: '↑Testosterone → ↑конверсия в estradiol (↑E2 → ↓serotonin/ тревожность) + ↑DHT (↓GABA-ergic тонус). Прогестерон-производные (19-нор) усиливают.',
        labMarkers: [
          { marker: 'Эстрадиол', expectedChange: '↑↑', targetRange: '<45 пг/мл', when: 'Контроль' },
          { marker: 'Пролактин', expectedChange: '↑', targetRange: '<15 нг/мл', when: 'При депрессии' },
          { marker: 'Тестостерон', expectedChange: '↑↑', targetRange: '20-40 нмоль/л', when: 'Для коррекции' },
          { marker: 'Кортизол', expectedChange: '↑', targetRange: '<500 нмоль/л', when: 'Контроль' },
        ],
        solutions: [
          { substanceId: 'l_theanine', name: 'L-теанин', type: 'supplement', dose: '200-400 мг/день', mechanism: '↑GABA, ↓возбуждение', evidenceLevel: 'B' },
          { substanceId: 'ashwagandha', name: 'Ашваганда (KSM-66)', type: 'supplement', dose: '300-600 мг/день', mechanism: '↓кортизол, баланс HPA', evidenceLevel: 'A' },
          { substanceId: 'magnesium_glycinate', name: 'Магний глицинат', type: 'supplement', dose: '400-600 мг/день', mechanism: '↑GABA-ергическая активность', evidenceLevel: 'B' },
          { substanceId: '5htp', name: '5-HTP (5-гидрокситриптофан)', type: 'supplement', dose: '100-200 мг на ночь (с осторожностью)', mechanism: '↑serotonin', evidenceLevel: 'C' },
          { substanceId: 'aromatase_inhibitor', name: 'AI контроль E2', type: 'pharma', dose: 'По результату анализа', mechanism: '↓E2 → ↓тревожность', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '2-4 нед', effect: '↑стабильность настроения, ↓тревожности' },
          { timeline: '4-8 нед', effect: 'Нормализация AI дозы (E2 20-30 пг/мл) — улучшение' },
        ],
      },
    ],
  },

  {
    id: 'peptide_bpc157_effects',
    symptom: 'Нейтропения / лейкопения от пептидов (BPC-157)',
    category: 'cns',
    urgency: 'standard',
    linkedDrugs: ['bpc157', 'tb500'],
    relatedSymptoms: ['fatigue'],
    quickFacts: [
      ' BPC-157 в высоких дозах может ↓нейтрофилы',
      ' Peptides часто производятся с примесями',
      ' Играть чистоту и дозировку',
    ],
    generalInfo: 'Пептиды (BPC-157, TB-500) имеют ограниченные данные безопасности. Существуют сообщения о лейкопении/neutropenia.',
    problems: [
      {
        problem: 'BPC-157-ассоциированная лейкопения',
        probability: 'low',
        mechanism: 'Пептид с системным действием, может взаимодействовать с иммунными сигнальными путями. Случаи нейтропении зарегистрированы, но причинность не установлена.',
        labMarkers: [
          { marker: 'Лейкоциты', expectedChange: '↓', targetRange: '4-10×10⁹/л', when: 'Каждые 4 нед при пептидах' },
          { marker: 'Нейтрофилы', expectedChange: '↓', targetRange: '>1.5×10⁹/л', when: 'Контроль' },
        ],
        solutions: [
          { substanceId: 'pause_peptide', name: 'Перерыв в пептиде', type: 'lifestyle', dose: '4 нед', mechanism: 'Восстановление гемопоэза', evidenceLevel: 'C' },
        ],
        expectations: [
          { timeline: '2-4 нед после отмены', effect: 'Восстановление лейкоцитов' },
        ],
      },
    ],
  },

  {
    id: 'serotonin_syndrome_risk',
    symptom: 'Серотониновый синдром (риска при комбинациях)',
    category: 'cns',
    urgency: 'critical',
    linkedDrugs: ['sarms', 'ssri', '5htp'],
    relatedSymptoms: ['tren_mental', 'anxiety'],
    quickFacts: [
      ' Комбинация: 5-HTP + SSRI + MAOI = серотониновый синдром',
      ' Симптомы: гипертермия, дрожь, гипертонус, спутанность',
      ' Экстренно! При гипертермии >40°C',
    ],
    generalInfo: 'Серотониновый синдром — жизнеугрожающее состояние, возникающее при избытке серотонина в ЦНС. Опасность в комбинации серотонинергических препаратов.',
    problems: [
      {
        problem: 'Избыток серотонина в ЦНС',
        probability: 'low',
        mechanism: '↑serotonin через комбинацию: SSRI (↓обратный захват) + 5-HTP (предшественник) + MAOI (↓деградация) → гипервозбуждение 5-HT рецепторов.',
        labMarkers: [
          { marker: 'Клиническая картина', expectedChange: '↑', targetRange: 'Клиника', when: 'Диагностика' },
          { marker: 'Температура', expectedChange: '↑↑↑', targetRange: '37.8-40+°C', when: 'Контроль' },
        ],
        solutions: [
          { substanceId: 'cyproheptadine', name: 'Ципрогептадин (серотониновый ант-т)', type: 'pharma', dose: '4-8 мг (острое)', mechanism: 'Блокада 5-HT2A', evidenceLevel: 'A' },
          { substanceId: 'stop_serotonergic', name: 'Отмена серотонинергических препаратов', type: 'lifestyle', dose: 'Срочно', mechanism: 'Истощение серотонина', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: 'Срочно', effect: 'Госпитализация, ОТД 12-24 ч после исчезновения симптомов', sideNote: 'НЕ амбулаторно' },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // РАСШИРЕНИЕ: gastrointestinal — ЖКТ и пищеварение
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 'gut_microbiome_dysbiosis',
    symptom: 'Дисбактериоз кишечника на высокобелковой диете',
    category: 'gastrointestinal',
    urgency: 'standard',
    linkedDrugs: ['testosterone', 'gh', 'insulin'],
    relatedSymptoms: ['bloating', 'nausea', 'fatigue'],
    quickFacts: [
      ' >3 г/кг белка/день → ↑протеолитических бактерий',
      ' ↑протеолитики → ammonemia, indole, p-cresol (токсины)',
      ' Пробиотики + клетчатка ↑бифидобактерии и молочнокислые',
    ],
    generalInfo: 'Высокобелковая диета ААС-пользователей изменяет микробный состав кишечника: ↑протеолитические бактерии, ↓сахаролитические.',
    problems: [
      {
        problem: 'Протеолитический дисбактериоз',
        probability: 'high',
        mechanism: '↑Белка диета → ↑протеолитические бактерии (Bacteroides, Clostridium) → ↑аммиак, индол, p-крезол. ↓клетчатка → ↓сахаролитических бактерий (Bifidobacterium, Lactobacillus). ↑Дыхание аммиаком.',
        labMarkers: [
          { marker: 'Калпротектин', expectedChange: '↑', targetRange: '<50 мкг/г', when: 'При симптомах' },
          { marker: 'рН кала', expectedChange: '↑', targetRange: '6.0-7.0', when: 'Спец.' },
        ],
        solutions: [
          { substanceId: 'probiotics', name: 'Пробиотики (Lactobacillus)', type: 'supplement', dose: '10-50 млрд КОЕ/день', mechanism: '↑молочнокислые бактерии', evidenceLevel: 'B' },
          { substanceId: 'prebiotic_fiber', name: 'Пребиотическая клетчатка', type: 'lifestyle', dose: '25-35 г/день (ОВС, псиллум)', mechanism: '↑SCFA, ↑бифидо', evidenceLevel: 'A' },
          { substanceId: 'butyrate', name: 'Масляная кислота (Butyrate)', type: 'supplement', dose: '300-600 мг/день', mechanism: '↑эпителий, ↓воспаление', evidenceLevel: 'B' },
          { substanceId: 'bone_broth', name: 'Костный бульон', type: 'lifestyle', dose: '250-500 мл/день', mechanism: 'Глютамин, ↑эпителиального барьера', evidenceLevel: 'C' },
          { substanceId: 'l_glutamine', name: 'L-глютамин', type: 'supplement', dose: '5-10 г/день', mechanism: 'Топливо энтероцитов', evidenceLevel: 'B' },
        ],
        expectations: [
          { timeline: '2-4 нед', effect: '↓bloating, улучшение стула' },
          { timeline: '6-8 нед', effect: '↑разнообразие микробиома (через кал-биом)' },
        ],
      },
    ],
  },

  {
    id: 'ibs_constipation_cycle',
    symptom: 'Запоры/СРК-Ц на курсе',
    category: 'gastrointestinal',
    urgency: 'standard',
    linkedDrugs: ['testosterone', 'gh'],
    relatedSymptoms: ['bloating', 'gerd', 'nausea'],
    quickFacts: [
      ' Высокая доза тестостерона + высокий белок + ↓клетчатка = запор',
      ' Постоянный приём протеиновых изолятов ↓ перистальтику',
      ' Магний цитрат 400 мг/день — мягкая профилактика',
    ],
    generalInfo: 'Запоры и синдром раздражённого кишечника с преобладанием запоров (СРК-Ц) встречаются у тяжелоатлетов на курсе. Причина: диета, ↓клетчатка, физическая нагрузка.',
    problems: [
      {
        problem: 'Диета+ААС индуцированный СРК-Ц',
        probability: 'high',
        mechanism: 'Высокий белок + ↓овощи/ фрукт+ ↓H2O витамины → ↓объём стула, ↓моторика.Тренинг + стресс (↑симпатик) ↓парасимпатик → ↓перистальтика.',
        labMarkers: [
          { marker: 'Калпротектин', expectedChange: '↔', targetRange: '<50', when: 'Дифференциальный' },
          { marker: 'Гемоглобин', expectedChange: '↔', targetRange: 'Контроль', when: 'Исключить кровотечение' },
        ],
        solutions: [
          { substanceId: 'magnesium_citrate', name: 'Магний цитрат 400 мг', type: 'supplement', dose: '400-600 мг/день', mechanism: '↑H2O в стуле, ↓тонус', evidenceLevel: 'A' },
          { substanceId: 'fiber', name: 'Псиллум', type: 'supplement', dose: '5-10 г/день + H2O', mechanism: '↑объём, моторика', evidenceLevel: 'A' },
          { substanceId: 'probiotics', name: 'Пробиотики', type: 'supplement', dose: '10-20 млрд КОЕ/день', mechanism: '↑моторика, ↓воспаление', evidenceLevel: 'B' },
          { substanceId: 'hydration', name: 'Гидратация', type: 'lifestyle', dose: '3-4 л/день', mechanism: '↑объём стула', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '3-7 дн', effect: 'Магний цитрат + псиллум: нормализация стула' },
          { timeline: '4-8 нед', effect: 'Пробиотики + диета: ↓bloating, регулярная перистальтика' },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // РАСШИРЕНИЕ: musculoskeletal — опорно-двигательная
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 'tendon_rupture_risk',
    symptom: 'Высокий риск разрыва сухожилий на ААС',
    category: 'musculoskeletal',
    urgency: 'warning',
    linkedDrugs: ['testosterone', 'trenbolone', 'winstrol'],
    relatedSymptoms: ['joint_pain', 'back_pumps'],
    quickFacts: [
      ' ААС ↑мышечную силу быстрее, чем адаптация сухожилий',
      '↓Коллаген synthesis при 17α-алкил + самплинг',
      ' Маркеры: проксимальный бицепс, ахиллово сухожилие, надостное',
    ],
    generalInfo: 'Дисбаланс между быстро растущей мышечной силой и медленно адаптирующимися сухожилиями — главная причина разрывов на ААС. Коллаген-синтез не успевает.',
    problems: [
      {
        problem: 'ААС-индуцированная дисадаптация сухожилий',
        probability: 'medium',
        mechanism: ' ↑Сила (↑мышцы) → ↑нагрузка на сухожилия, но ↓коллаген-синтез (17α-алкил) → риск микроразрывов и полного разрыва.',
        labMarkers: [
          { marker: '无明显 маркеры', expectedChange: '↔', targetRange: 'Клиника', when: 'МРТ при боли' },
          { marker: 'УЗИ сухожилия', expectedChange: '↑', targetRange: 'Контроль', when: 'При хрон. боли' },
        ],
        solutions: [
          { substanceId: 'collagen_peptides', name: 'Коллаген пептиды', type: 'supplement', dose: '10-15 г/день', mechanism: '↑синтез коллагена I типа', evidenceLevel: 'B' },
          { substanceId: 'vitamin_c', name: 'Витамин C', type: 'supplement', dose: '500-1000 мг/день', mechanism: 'Кофактор гидроксилирования пролина/лизина', evidenceLevel: 'B' },
          { substanceId: 'gh_minimal', name: 'GH мини-дose', type: 'pharma', dose: '1-2 МЕ/день', mechanism: '↑Коллаген синтез', evidenceLevel: 'C' },
          { substanceId: 'progressive_load', name: 'Прогрессивная нагрузка (вместо макс.)', type: 'lifestyle', dose: '70-80% 1ПМ', mechanism: '↓риск разрыва', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '4-8 нед', effect: 'Коллаген + витамин C: ↑синтеза коллагена на 30-60%' },
          { timeline: '12 нед', effect: 'Улучшение УЗИ-картины сухожилия' },
        ],
      },
    ],
  },

  {
    id: 'ligament_laxity_gh',
    symptom: 'Гипермобильность связок на GH- курсе',
    category: 'musculoskeletal',
    urgency: 'standard',
    linkedDrugs: ['gh', 'igf1'],
    relatedSymptoms: ['carpal_tunnel_gh', 'joint_pain'],
    quickFacts: [
      ' GH → ↑синовиальная жидкость → "рыхлые" связки',
      ' Симптом: лёгкое "щёлканье" суставов без боли',
      ' Если + боль → уменьшить дозу',
    ],
    generalInfo: 'GH повышает продукцию синовиальной жидкости и может увеличивать растяжимость капсулы сустава. Это вызывает ощущение незащищённости суставов.',
    problems: [
      {
        problem: 'GH-индуцированная мягкость связок',
        probability: 'medium',
        mechanism: 'GH → ↑IGF-1 → ↑синовиоцит пролиферация + ↑протеогликаны → ↑объём синовии, ↓плотность коллагена в капсуле. Сустав "рыхлый".',
        labMarkers: [
          { marker: 'IGF-1', expectedChange: '↑↑', targetRange: 'Возрастная норма', when: 'Контроль' },
        ],
        solutions: [
          { substanceId: 'reduce_gh', name: 'Снизить GH дозу', type: 'lifestyle', dose: '1-2 МЕ/день', mechanism: '↓синовиальная гиперпродукция', evidenceLevel: 'A' },
          { substanceId: 'collagen_peptides', name: 'Коллаген пептиды', type: 'supplement', dose: '10-15 г/день', mechanism: '↑коллаген капсулы', evidenceLevel: 'B' },
          { substanceId: 'strength_training', name: 'Силовая тренировка связок', type: 'lifestyle', dose: 'Изометрия, эксцентрика', mechanism: '↑коллаген synthesis', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '2-4 нед после снижения', effect: 'Симптомы проходят' },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // РАСШИРЕНИЕ: psychological — психика и когнитивные
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 'pct_depression',
    symptom: 'Пост-цикловая депрессия / "crash"',
    category: 'psychological',
    urgency: 'critical',
    linkedDrugs: ['testosterone', 'deca', 'trenbolone'],
    relatedSymptoms: ['pct_lethargy', 'depression', 'libido_loss'],
    quickFacts: [
      ' "Crash" — ↓↓тестостерона + ↑↑кортизола + ↓серотонин',
      ' Пик: 2-4 нед после отмены (острая фаза)',
      'Длительность: 6-12 нед без поддержки',
      ' Высокий риск рецидива ААС-использования (без поддержки)',
    ],
    generalInfo: 'Пост-цикловый краш — комплексное состояние: ↓тестостерона + ↑↑кортизола + ↓серотонин/дофамин + ↓I GF-1. Характеризуется депрессией, ↓либидо, усталостью, ↓когнитивной функции.',
    problems: [
      {
        problem: 'Гормональный дефицит + надпочечниковая недостаточность',
        probability: 'high',
        mechanism: ' Отмена ААС → ↓↓Т (истощённый HPTA) + ↑↑кортизол (rebound) + ↓серотонин/дофамин (нейроадаптация) + ↓IGF-1 (если был GH).',
        labMarkers: [
          { marker: 'Тестостерон', expectedChange: '↓↓', targetRange: '10-35 нмоль/л', when: '2-4 нед ПКТ' },
          { marker: 'Кортизол', expectedChange: '↑↑', targetRange: '138-690 нмоль/л', when: 'Контроль' },
          { marker: 'Эстрадиол', expectedChange: '↓', targetRange: '11-43 пг/мл', when: 'Падает с T' },
          { marker: 'ЛГ/ФСГ', expectedChange: '↔ или ↑', targetRange: 'Восстановление HPTA', when: 'Через 4-6 нед ПКТ' },
        ],
        solutions: [
          { substanceId: 'serm_pcт', name: 'ПЦИО с SERM (Nolvadex/Enclomiphene)', type: 'pharma', dose: '20 мг Nolva / 12.5 мг Enclom', mechanism: '↑GnRH → ↑LH/FSH → ↑эндогенный T', evidenceLevel: 'A' },
          { substanceId: 'hcg_support', name: 'hCG при необходимости', type: 'pharma', dose: '500-1000 МЕ 2р/нед за 2 нед до ПКТ', mechanism: '↑Лейдига, ↑Т', evidenceLevel: 'B' },
          { substanceId: 'ashwagandha', name: 'Ашваганда KSM-66', type: 'supplement', dose: '300-600 мг 2р/день', mechanism: '↓кортизол, ↓депрессия', evidenceLevel: 'A' },
          { substanceId: 'rhodiola', name: 'Родиола розовая', type: 'supplement', dose: '200-400 мг/день', mechanism: '↑адаптогенность, ↓усталость', evidenceLevel: 'B' },
          { substanceId: 'omega3_high', name: 'Омега-3 4 г/день', type: 'supplement', dose: '4 г/день', mechanism: '↑нейрогенез, ↓депрессия', evidenceLevel: 'A' },
          { substanceId: 'vitamin_d', name: 'Витамин D3 5000 МЕ', type: 'supplement', dose: '5000-10000 МЕ/день', mechanism: '↓депрессия, ↑иммунитет', evidenceLevel: 'B' },
          { substanceId: 'therapy', name: 'Психотерапия (когнитивная)', type: 'lifestyle', dose: '8-12 сессий', mechanism: '↓симптомы, ↑приверженность', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '2-4 нед ПКТ', effect: 'SERM: ↑T на 20-50%, ↓острых симптомов' },
          { timeline: '4-6 нед', effect: ' ashwagandha: ↓кортизол, ↑настроения' },
          { timeline: '8-12 нед', effect: 'Полное восстановление HPTA у большинства' },
        ],
      },
    ],
  },

  {
    id: 'muscle_dysmorphia',
    symptom: 'Дисморфофобия мышц / "обратная анорексия"',
    category: 'psychological',
    urgency: 'warning',
    linkedDrugs: ['testosterone', 'trenbolone', 'gh'],
    relatedSymptoms: ['aggression', 'depression', 'anxiety'],
    quickFacts: [
      ' Расстройство образа тела — "никогда не достаточно большие"',
      ' Риск: 8-15% мужчин-бодибилдеров',
      ' Прогрессирует от курса к курсу',
    ],
    generalInfo: 'Мышечная дисморфия — психическое расстройство, при котором человек不改 воспринимает своё тело как "слишком маленькое", несмотря на значительную мышечную массу.',
    problems: [
      {
        problem: 'Образ тела / одержимость размером',
        probability: 'high',
        mechanism: 'Генетика + культурные стандарты + ↑ААС-дозы. ↓Удовлетворённость телом постоянна. Компульсивное сравнение с другими.',
        labMarkers: [
          { marker: 'MAAS-q', expectedChange: '↑', targetRange: '<14 баллов', when: 'Самотест' },
        ],
        solutions: [
          { substanceId: 'cbt', name: 'Когнитивно-поведенческая терапия', type: 'lifestyle', dose: '12-16 сессий', mechanism: '↓симптомы, ↑самооценка', evidenceLevel: 'A' },
          { substanceId: 'limit_social', name: '↓соцсети (Instagram)', type: 'lifestyle', dose: '<30 мин/день', mechanism: '↓сравнения', evidenceLevel: 'B' },
          { substanceId: 'therapy_group', name: 'Групповая терапия', type: 'lifestyle', dose: 'Еженедельно', mechanism: 'Семья + родственники', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '3-6 мес КПТ', effect: '↓симптомы, ↑самооценка' },
        ],
      },
    ],
  },

  {
    id: 'roid_rage_episodic',
    symptom: 'Эпизодическая "roid rage" (вспышки гнева)',
    category: 'psychological',
    urgency: 'critical',
    linkedDrugs: ['testosterone', 'trenbolone', 'anadrol'],
    relatedSymptoms: ['aggression', 'tren_mental', 'steroid_mood_swings'],
    quickFacts: [
      ' "Roid rage" — не у всех, но у предрасположенных выражен',
      ' Тренболон в ≥200 мг/нед пиково увеличивает агрессию',
      ' Удар/преступление = запрещено + разорение отношений',
    ],
    generalInfo: 'Эпизодическая "roid rage" — внезапные вспышки гнева без существенного повода, выходящие за рамки раздражения. Чаще на тренболоне и высоких доз.',
    problems: [
      {
        problem: 'ААС-опосредованная импульсивная агрессия',
        probability: 'medium',
        mechanism: '↑Testosterone → ↑DHT → ↓serotonin- ergic контроль, дофаминовая гиперчувствительность, ↑GABA躁. Нейроадаптация в миндалине, ↓prefrontal контроль.У лиц с историей агрессии риск ↑↑↑.',
        labMarkers: [
          { marker: 'Клиника', expectedChange: '↑', targetRange: 'Клиническая картина', when: 'Контроль' },
          { marker: 'Тестостерон', expectedChange: '↑↑↑', targetRange: 'Снижение дозы', when: 'Коррекция' },
        ],
        solutions: [
          { substanceId: 'reduce_dose', name: 'Немедленно снизить дозу', type: 'lifestyle', dose: '↓25-50%', mechanism: '↓андрогенный стимул', evidenceLevel: 'A' },
          { substanceId: 'l_theanine', name: 'L-теанин', type: 'supplement', dose: '200-400 мг 2р/день', mechanism: '↑GABA, ↓возбуждение', evidenceLevel: 'B' },
          { substanceId: 'magnesium_glycinate', name: 'Магний глицинат', type: 'supplement', dose: '400-600 мг/день', mechanism: '↑GABA-ергическая активность', evidenceLevel: 'B' },
          { substanceId: 'ashwagandha', name: 'Ашваганда KSM-66', type: 'supplement', dose: '300-600 мг 2р/день', mechanism: '↓кортизол, ↓напряжение', evidenceLevel: 'A' },
          { substanceId: 'therapy', name: 'Психотерапия (thermal control)', type: 'lifestyle', dose: 'Еженедельно', mechanism: '↑control импульсов', evidenceLevel: 'A' },
          { substanceId: 'avoid_alcohol', name: 'Полный отказ от алкоголя', type: 'lifestyle', dose: '0 г/день', mechanism: '↓дисингибиция', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '2-4 нед', effect: ' ↓остроты эпизодов, ↓злости' },
          { timeline: '8-12 нед', effect: 'Стабилизация настроения с фарм + психотерапией' },
        ],
      },
    ],
  },

  // ═══ СИМПТОМЫ SARMs ═══
  {
    id: 'vision_changes_sarm',
    symptom: 'Изменение зрения / светобоязнь (на RAD-140)',
    category: 'cns',
    urgency: 'warning',
    linkedDrugs: ['rad140'],
    relatedSymptoms: ['headaches', 'tachycardia'],
    quickFacts: [
      'RAD-140 в дозах >20 мг/сут вызывает преходящую светобоязнь у 15-30%',
      'Механизм: перекрёстная активация 5-HT2B рецепторов сетчатки',
      'Обычно обратимо, но при игнорировании — риск отслойки сетчатки',
    ],
    generalInfo: 'Изменения зрения (светобоязнь, размытость, "вспышки") на фоне RAD-140 — дозозависимый эффект, связанный с 5-HT2B-агонизмом. При появлении — снижение дозы или отмена.',
    problems: [{
      problem: '5-HT2B-агонизм RAD-140 → вазоконстрикция сетчатки',
      probability: 'medium',
      mechanism: 'RAD-140 и его метаболиты активируют 5-HT2B-рецепторы (в 40× сильнее, чем тестостерон) → вазоконстрикция хориоидальных сосудов → гипоксия фоторецепторов',
      labMarkers: [
        { marker: 'Симптомы', expectedChange: '↑', targetRange: 'Нет симптомов', when: 'Ежедневно при приёме' },
      ],
      solutions: [
        { substanceId: 'reduce_dose', name: 'Снизить дозу RAD-140 до 10 мг/сут', type: 'lifestyle', dose: '10 мг/сут', mechanism: 'Линейная зависимость доза→эффект', evidenceLevel: 'C' },
        { substanceId: 'omega3', name: 'Омега-3 (EPA/DHA)', type: 'supplement', dose: '3-4 г/сут', mechanism: '↓ воспаление сетчатки, ↑ хориоидальный кровоток', evidenceLevel: 'B' },
        { substanceId: 'astaxanthin', name: 'Астаксантин', type: 'supplement', dose: '4-12 мг/сут', mechanism: 'Суперантиоксидант, защита фоторецепторов', evidenceLevel: 'B' },
      ],
      expectations: [
        { timeline: '3-7 дней', effect: 'Снижение светобоязни при уменьшении дозы' },
        { timeline: '2-4 нед', effect: 'Полное исчезновение симптомов при отмене' },
      ],
    }],
  },
  {
    id: 'sarm_lethargy',
    symptom: 'Вялость / апатия на SARMs (Ostarine/LGD-4033)',
    category: 'endocrine',
    urgency: 'standard',
    linkedDrugs: ['ostarine', 'lgd4033'],
    relatedSymptoms: ['fatigue', 'libido_drop', 'depression_mood'],
    quickFacts: [
      'SARMs подавляют HPTA в 50-70% от степени ААС (доза-зависимо)',
      'Ostarine при 25 мг/сут ↓ Т до надира на 50-70% за 4 нед',
      'LGD-4033 даже 5 мг/сут ↓ общий Т на 40-50%',
    ],
    generalInfo: 'Вялость, апатия, упадок сил на SARMs — следствие супрессии эндогенного тестостерона. Многие пользователи ошибочно считают SARMs «безопасными для гормонов» и не ожидают этого эффекта.',
    problems: [{
      problem: 'HPTA-супрессия SARMs → ↓ эндогенный тестостерон',
      probability: 'high',
      mechanism: 'SARMs активируют AR в гипоталамусе → ↓ GnRH → ↓ LH/FSH → ↓ тестостерон яичек. Степень супрессии: LGD > RAD > Ostarine',
      labMarkers: [
        { marker: 'Общий тестостерон', expectedChange: '↓↓', targetRange: '≥20 нмоль/л', when: 'Через 4 нед приёма' },
        { marker: 'LH', expectedChange: '↓', targetRange: '2-9 МЕ/л', when: 'Через 4 нед' },
        { marker: 'FSH', expectedChange: '↓', targetRange: '1.5-12 МЕ/л', when: 'Через 4 нед' },
      ],
      solutions: [
        { substanceId: 'hcg', name: 'hCG 250 МЕ 2×/нед', type: 'pharma', dose: '250 МЕ 2×/нед', mechanism: 'Аналог LH → стимуляция Лейдига', evidenceLevel: 'B' },
        { substanceId: 'enclomiphene', name: 'Энкломифен 12.5 мг/день', type: 'pharma', dose: '12.5 мг/день', mechanism: '↑ GnRH через блокаду ER в гипоталамусе', evidenceLevel: 'B' },
        { substanceId: 'vitamin_d3', name: 'Витамин D3', type: 'supplement', dose: '2000-5000 МЕ/сут', mechanism: 'Кофактор стероидогенеза', evidenceLevel: 'B' },
        { substanceId: 'zinc', name: 'Цинк пиколинат', type: 'supplement', dose: '15-30 мг/сут', mechanism: 'Кофактор 17β-HSD и 3β-HSD', evidenceLevel: 'B' },
      ],
      expectations: [
        { timeline: '2-4 нед', effect: 'Восстановление энергии на hCG/энкломифене' },
        { timeline: '4-8 нед', effect: 'Нормализация тестостерона после отмены' },
      ],
    }],
  },
  {
    id: 'sarm_joint_dryness',
    symptom: 'Сухость/скованность суставов на SARMs',
    category: 'musculoskeletal',
    urgency: 'standard',
    linkedDrugs: ['rad140', 'lgd4033', 'ostarine'],
    relatedSymptoms: ['joint_pain'],
    quickFacts: [
      'SARMs ↓ эстрадиол (из-за HPTA-супрессии) → ↓ синовиальной жидкости',
      'Эстрадиол стимулирует гиалуронан-синтазу в синовиоцитах',
      'Сухость суставов на SARMs — маркер глубокого ↓ E2',
    ],
    generalInfo: 'Сухость, скованность, хруст в суставах на SARMs без боли — следствие снижения эстрадиола, который критически важен для увлажнения суставных поверхностей.',
    problems: [{
      problem: '↓ E2 → ↓ гиалуроновой кислоты в синовии',
      probability: 'medium',
      mechanism: 'SARMs → ↓ GnRH → ↓ LH → ↓ T → ↓ E2 (ароматаза не работает при низком T). E2 стимулирует гиалуронан-синтазу 2 (HAS2) в синовиоцитах. При ↓ E2 — ↓ смазки.',
      labMarkers: [
        { marker: 'Эстрадиол (E2)', expectedChange: '↓', targetRange: '20-50 пг/мл ♂', when: 'Через 4 нед приёма' },
      ],
      solutions: [
        { substanceId: 'hyaluronic_acid', name: 'Гиалуроновая кислота (перорально)', type: 'supplement', dose: '100-200 мг/сут', mechanism: 'Субстрат для синтеза синовиальной жидкости', evidenceLevel: 'C' },
        { substanceId: 'collagen_uc2', name: 'Коллаген UC-II (неденатурир.)', type: 'supplement', dose: '40 мг/сут', mechanism: 'Иммунная толерантность к хрящу', evidenceLevel: 'B' },
        { substanceId: 'vitamin_d3', name: 'Витамин D3 + K2', type: 'supplement', dose: '2000-5000 МЕ + 100 мкг', mechanism: 'Кальциевый обмен + GI-белки', evidenceLevel: 'B' },
      ],
      expectations: [
        { timeline: '2-4 нед', effect: 'Улучшение подвижности на гиалуронате' },
        { timeline: '4-8 нед', effect: 'Восстановление синовии после отмены SARMs' },
      ],
    }],
  },

  // ═══ СИМПТОМЫ GH / ПЕПТИДЫ ═══
  {
    id: 'gh_carpal_tunnel',
    symptom: 'Синдром запястного канала (онемение пальцев) на GH',
    category: 'musculoskeletal',
    urgency: 'warning',
    linkedDrugs: ['gh', 'igf1'],
    relatedSymptoms: ['edema', 'gh_joint_pain'],
    quickFacts: [
      'Классический побочный эффект GH — карпальный туннель: 20-40% при 4-6 МЕ/сут',
      'Механизм: ↑IGF-1 → пролиферация синовии → сдавление n.medianus',
      'При ↓ дозы GH на 30-50% симптомы регрессируют за 2-4 нед',
    ],
    generalInfo: 'Онемение, покалывание, боль в I-III пальцах кисти (n.medianus). Усиливается ночью. Типично для доз GH >4 МЕ/сут (1.3 мг/сут). У пользователей с ожирением/СД риск выше.',
    problems: [{
      problem: 'IGF-1-опосредованная гипертрофия синовии',
      probability: 'high',
      mechanism: 'GH → ↑IGF-1 → стимуляция пролиферации фибробластов и хондроцитов → утолщение связки запястья → ↓ объём карпального канала → компрессия n.medianus',
      labMarkers: [
        { marker: 'IGF-1', expectedChange: '↑↑', targetRange: '150-350 нг/мл', when: 'Через 2 нед от старта' },
        { marker: 'GH сыворотка (утро)', expectedChange: '↑', targetRange: '<5 нг/мл', when: 'При симптомах' },
      ],
      solutions: [
        { substanceId: 'reduce_gh_dose', name: 'Снизить дозу GH 30-50%', type: 'lifestyle', dose: '-30-50%', mechanism: '↓IGF-1 → ↓ гипертрофии', evidenceLevel: 'A' },
        { substanceId: 'vitamin_b6', name: 'Витамин B6 (пиридоксин)', type: 'supplement', dose: '50-100 мг/сут', mechanism: '↑ ГАМК-ергическое торможение, нейропротекция', evidenceLevel: 'B' },
        { substanceId: 'nsaids', name: 'НПВС местно (диклофенак-гель)', type: 'pharma', dose: '1-2% 2-3р/день', mechanism: '↓ локального воспаления', evidenceLevel: 'B' },
        { substanceId: 'night_splint', name: 'Ночной ортез кисти', type: 'lifestyle', dose: 'На ночь', mechanism: 'Фиксация кисти в нейтральном положении', evidenceLevel: 'A' },
      ],
      expectations: [
        { timeline: '1-2 нед', effect: 'Снижение симптомов при ↓ дозы GH', sideNote: 'При сохранении — тиразид по ночам' },
        { timeline: '4-6 нед', effect: 'Полный регресс при отмене/снижении дозы' },
      ],
    }],
  },
  {
    id: 'gh_acromegaly_signs',
    symptom: 'Акромегалоидные изменения (увеличение стоп/носа/челюсти)',
    category: 'endocrine',
    urgency: 'critical',
    linkedDrugs: ['gh', 'igf1', 'cjc1295', 'ipamorelin', 'ghrp2', 'ghrp6', 'hexarelin', 'tesamorelin'],
    relatedSymptoms: ['gh_carpal_tunnel', 'edema', 'gh_joint_pain'],
    quickFacts: [
      'IGF-1 >400 нг/мл в сочетании с курсом >6 мес → необратимые костные изменения',
      'Первые признаки: увеличение размера обуви (ширина стопы), грубые черты лица',
      'Прогрессия: утолщение челюсти (прогнатизм), огрубение голоса',
    ],
    generalInfo: 'Необратимые костные изменения при хронически высоком IGF-1. Начинаются с мягких тканей (нос, уши, губы), затем кости. Критически важно выявить на ранней стадии.',
    problems: [{
      problem: 'Хроническая гиперстимуляция IGF-1 рецепторов → пролиферация хряща',
      probability: 'medium',
      mechanism: 'GH → ↑IGF-1 → активация IGF-1R → ↑ пролиферация хондроцитов в эпифизарных пластинках (ещё не закрытых) и периостальный рост костей. После закрытия пластинок — утолщение костей.',
      labMarkers: [
        { marker: 'IGF-1', expectedChange: '↑↑', targetRange: '<350 нг/мл', when: 'Каждые 4 нед на GH' },
        { marker: 'GH (ночной, пиковый)', expectedChange: '↑', targetRange: '<10 нг/мл', when: 'При IGF-1 >400' },
        { marker: 'Размер обуви', expectedChange: '↑', targetRange: 'Без изменений', when: 'Каждые 3 мес' },
      ],
      solutions: [
        { substanceId: 'stop_gh', name: 'НЕМЕДЛЕННО прекратить GH/пептиды', type: 'lifestyle', dose: '0 МЕ/сут', mechanism: 'Прекращение стимуляции IGF-1', evidenceLevel: 'A' },
        { substanceId: 'hospital', name: 'Консультация эндокринолога', type: 'lifestyle', dose: 'Срочно', mechanism: 'Исключение акромегалии', evidenceLevel: 'A' },
      ],
      expectations: [
        { timeline: '2-4 нед', effect: '↓ IGF-1 после отмены GH', sideNote: 'Пептиды — 1-2 нед' },
        { timeline: '3-6 мес', effect: 'Регресс мягких тканей; кости — необратимо' },
      ],
    }],
  },
  {
    id: 'gh_insulin_resistance',
    symptom: 'Инсулинорезистентность / ↑ глюкозы на GH',
    category: 'endocrine',
    urgency: 'warning',
    linkedDrugs: ['gh', 'igf1', 'cjc1295', 'ipamorelin', 'tesamorelin'],
    relatedSymptoms: ['insulin_sensitivity_down'],
    quickFacts: [
      'GH ↑ глюконеогенез в печени + ↓ захват глюкозы мышцами (контринсулярный)',
      'Глюкоза натощак >6.1 ммоль/л — ранний маркер',
      'У бодибилдеров на GH + инсулин риск ↑ глюкозы в 3× выше',
    ],
    generalInfo: 'GH повышает глюкозу через контринсулярный эффект (↑ глюконеогенез, ↓ утилизация глюкозы). При длительном приёме + буфферная еда → метаболический синдром.',
    problems: [{
      problem: 'GH-опосредованная ↓ захвата глюкозы мышечной тканью',
      probability: 'high',
      mechanism: 'GH → ↓ IRS-1/PI3K → ↓ транслокация GLUT4 в мышцах + ↑ глюконеогенез из аминокислот в печени через PEPCK.',
      labMarkers: [
        { marker: 'Глюкоза натощак', expectedChange: '↑', targetRange: '3.9-5.6 ммоль/л', when: 'Еженедельно' },
        { marker: 'HbA1c', expectedChange: '↑', targetRange: '<5.7%', when: 'Каждые 3 мес' },
        { marker: 'Инсулин натощак', expectedChange: '↑', targetRange: '<10 мкМЕ/мл', when: 'При ↑ глюкозы' },
        { marker: 'HOMA-IR', expectedChange: '↑', targetRange: '<2.5', when: 'Рассчётно' },
      ],
      solutions: [
        { substanceId: 'berberine', name: 'Берберин', type: 'supplement', dose: '500 мг 3р/день', mechanism: 'AMPK-активатор, ↑ GLUT4 транслокацию', evidenceLevel: 'A' },
        { substanceId: 'metformin', name: 'Метформин', type: 'pharma', dose: '500-1000 мг/сут', mechanism: '↓ глюконеогенез в печени', evidenceLevel: 'A' },
        { substanceId: 'chromium', name: 'Хром пиколинат', type: 'supplement', dose: '200-400 мкг/сут', mechanism: '↑ инсулин-рецепторную тирозинкиназу', evidenceLevel: 'B' },
        { substanceId: 'meal_spacing', name: 'Интервальное питание (16/8)', type: 'lifestyle', dose: '16 ч голод / 8 ч еда', mechanism: '↓ базального инсулина, ↑ чувствительности', evidenceLevel: 'A' },
        { substanceId: 'reduce_gh', name: 'Снизить дозу GH', type: 'lifestyle', dose: '-30%', mechanism: '↓ контринсулярный эффект', evidenceLevel: 'A' },
      ],
      expectations: [
        { timeline: '1-3 дня', effect: 'Берберин ↓ глюкозы на 15-25%' },
        { timeline: '2-4 нед', effect: 'Метформин + берберин: ↓ HbA1c на 0.5-1%' },
      ],
    }],
  },

  // ═══ СИМПТОМЫ ИНСУЛИН ═══
  {
    id: 'insulin_hypoglycemia',
    symptom: 'Гипогликемия (тремор, потливость, голод, спутанность)',
    category: 'endocrine',
    urgency: 'critical',
    linkedDrugs: ['insulin', 'insulin_rapid', 'lantus'],
    relatedSymptoms: ['tachycardia', 'insulin_sensitivity_down'],
    quickFacts: [
      'Гипогликемия <3.0 ммоль/л — неотложное состояние',
      'Симптомы: тремор, холодный пот, голод, тахикардия, спутанность',
      'При <2.5 ммоль/л — риск потери сознания и гипогликемической комы',
    ],
    generalInfo: 'Гипогликемия — самый опасный побочный эффект инсулина. Причины: передозировка, пропуск приёма пищи, нерасчёт времени пика/базы. У спортсменов на PED + инсулин риск кратно выше.',
    problems: [{
      problem: 'Передозировка инсулина / несовпадение пика с едой',
      probability: 'high',
      mechanism: 'Инсулин → ↓ глюкоза плазмы через ↑ захват мышцами/печенью + ↓ глюконеогенез. При превышении дозы или смещении пика → глюкоза падает <3.3 ммоль/л → нейрогликопения.',
      labMarkers: [
        { marker: 'Глюкоза (капиллярная)', expectedChange: '↓↓', targetRange: '4.0-5.5 ммоль/л', when: 'Через 15-30 мин после укола' },
      ],
      solutions: [
        { substanceId: 'glucose_urgent', name: '15 г быстрых углеводов (3 куска сахара, 150 мл сока)', type: 'lifestyle', dose: '15 г глюкозы', mechanism: 'Немедленный подъём глюкозы', evidenceLevel: 'A' },
        { substanceId: 'hospital', name: 'При потере сознания — глюкагон в/м', type: 'lifestyle', dose: '1 мг в/м', mechanism: 'Гликогенолиз', evidenceLevel: 'A' },
        { substanceId: 'reduce_insulin', name: 'Пересчёт дозы инсулина', type: 'lifestyle', dose: 'Коррекция -30-50%', mechanism: 'Предотвращение рецидива', evidenceLevel: 'A' },
      ],
      expectations: [
        { timeline: '5-15 мин', effect: 'Углеводы: подъём глюкозы на 2-3 ммоль/л' },
        { timeline: '30-60 мин', effect: 'Стабилизация состояния', sideNote: 'мониторинг глюкозы каждые 15 мин' },
      ],
    }],
  },
  {
    id: 'insulin_lipodystrophy',
    symptom: 'Липодистрофия (атрофия жира / уплотнения в местах инъекций)',
    category: 'dermatologic',
    urgency: 'standard',
    linkedDrugs: ['insulin', 'insulin_rapid', 'lantus'],
    quickFacts: [
      'Повторные инъекции в одно место → липоатрофия или гипертрофия',
      'Ротация мест инъекции — главная профилактика',
      'Липогипертрофия нарушает всасывание инсулина → нестабильный эффект',
    ],
    generalInfo: 'Липодистрофия — изменение подкожно-жировой клетчатки в местах частых инъекций. Липоатрофия (ямки) или липогипертрофия (уплотнения). Ухудшает предсказуемость действия инсулина.',
    problems: [{
      problem: 'Хроническая травматизация подкожной клетчатки инъекциями',
      probability: 'medium',
      mechanism: 'Повторные инъекции → локальное воспаление → активация макрофагов/фибробластов → или атрофия (липоатрофия) или фиброз (гипертрофия). ЛС-опосредованный липолиз.',
      labMarkers: [
        { marker: 'Осмотр мест инъекции', expectedChange: '↔', targetRange: 'Без уплотнений', when: 'Еженедельно' },
      ],
      solutions: [
        { substanceId: 'site_rotation', name: 'Ротация мест инъекции', type: 'lifestyle', dose: 'Каждый раз новое место', mechanism: '↓ травматизации', evidenceLevel: 'A' },
        { substanceId: 'more_frequent_inj', name: 'Уменьшить объём на точку', type: 'lifestyle', dose: '≤1 мл/место', mechanism: '↓ объёма травмы', evidenceLevel: 'B' },
        { substanceId: 'topical_retinoid', name: 'Мази с гепарином/троксевазином', type: 'lifestyle', dose: '2р/день', mechanism: '↓ фиброза, ↑ микроциркуляции', evidenceLevel: 'C' },
      ],
      expectations: [
        { timeline: '2-4 нед', effect: 'Уменьшение уплотнений при ротации' },
        { timeline: '3-6 мес', effect: 'Полное рассасывание при правильной ротации' },
      ],
    }],
  },

  // ═══ СИМПТОМЫ ДИУРЕТИКИ ═══
  {
    id: 'diuretic_electrolyte',
    symptom: 'Нарушение электролитов на диуретиках (слабость, судороги, аритмия)',
    category: 'hematologic',
    urgency: 'critical',
    linkedDrugs: ['diuretics'],
    relatedSymptoms: ['cramps', 'arrhythmia', 'fatigue'],
    quickFacts: [
      '↓K⁺ <3.0 ммоль/л — жизнеугрожающая аритмия',
      '↓Na⁺ <125 ммоль/л — отёк мозга, судороги, кома',
      'Дихлотиазид + кетогенная диета = двойной риск ↓K⁺',
    ],
    generalInfo: 'Диуретики — мощные препараты, часто используемые для «сушки». Нарушение электролитного баланса — самое частое и опасное осложнение. Может протекать бессимптомно до критического уровня.',
    problems: [{
      problem: 'Калийурез и гипокалиемия',
      probability: 'high',
      mechanism: 'Тиазидные (дихлотиазид) и петлевые (фуросемид) диуретики → ↓ реабсорбция Na⁺/Cl⁻ в дистальных канальцах/петле Генле → ↑ доставка Na⁺ к дистальным отделам → ↑ Na⁺/K⁺ обмен → ↑ экскреция K⁺ + Mg²⁺',
      labMarkers: [
        { marker: 'K⁺ сыворотки', expectedChange: '↓↓', targetRange: '3.5-5.1 ммоль/л', when: 'Ежедневно на диуретиках' },
        { marker: 'Na⁺ сыворотки', expectedChange: '↓', targetRange: '135-145 ммоль/л', when: 'Каждые 3 дня' },
        { marker: 'Mg²⁺ сыворотки', expectedChange: '↓', targetRange: '0.7-1.0 ммоль/л', when: 'Каждые 3 дня' },
        { marker: 'ЭКГ (QTc, зубец U)', expectedChange: '↑', targetRange: 'QTc <440 мс ♂', when: 'При K⁺ <3.5' },
      ],
      solutions: [
        { substanceId: 'potassium', name: 'Калия цитрат/хлорид', type: 'supplement', dose: '1000-2000 мг/сут', mechanism: 'Восполнение K⁺, профилактика аритмии', evidenceLevel: 'A' },
        { substanceId: 'magnesium', name: 'Магний глицинат/цитрат', type: 'supplement', dose: '400-600 мг/сут', mechanism: 'Mg ко-фактор Na⁺/K⁺-ATPазы', evidenceLevel: 'A' },
        { substanceId: 'hydration_forced', name: 'Контроль гидратации (пить по жажде)', type: 'lifestyle', dose: '30-40 мл/кг/сут', mechanism: 'Профилактика дегидратации', evidenceLevel: 'A' },
        { substanceId: 'reduce_ai', name: 'При K⁺ <3.5 — прекратить диуретик', type: 'lifestyle', dose: 'Прекращение', mechanism: 'Экстренная мера', evidenceLevel: 'A' },
      ],
      expectations: [
        { timeline: '1-2 ч', effect: 'Калий внутрь: начало подъёма K⁺' },
        { timeline: '24-48 ч', effect: 'Нормализация K⁺ на пероральном K⁺+Mg', sideNote: 'При K⁺ <3.0 — в/в коррекция' },
      ],
    }],
  },
  {
    id: 'diuretic_dehydration',
    symptom: 'Дегидратация / сухость кожи и слизистых на диуретиках',
    category: 'renal',
    urgency: 'warning',
    linkedDrugs: ['diuretics'],
    relatedSymptoms: ['diuretic_electrolyte', 'hypertension'],
    quickFacts: [
      'Потеря 5% массы тела за 1-2 дня = тяжёлая дегидратация',
      'Жажда — ненадёжный маркер, особенно на стимуляторах',
      'Вертикальное АД + тахикардия = ранний маркер гиповолемии',
    ],
    generalInfo: 'Дегидратация при приёме диуретиков — следствие ↓ ОЦК. Проявляется жаждой, сухостью кожи/языка, ↓ тургора, ↓ диуреза. В сочетании с высокими дозами — риск коллапса.',
    problems: [{
      problem: 'Гиповолемия (↓ ОЦК) на диуретиках',
      probability: 'high',
      mechanism: 'Диуретики блокируют реабсорбцию Na⁺ → осмотический диурез → ↓ ОЦК → барорецепторы → компенсаторная тахикардия + вазоконстрикция.',
      labMarkers: [
        { marker: 'Вертикальное АД', expectedChange: '↓', targetRange: 'САД >100 мм рт.ст.', when: 'Ежедневно' },
        { marker: 'ЧСС стоя', expectedChange: '↑', targetRange: '<90 уд/мин', when: 'Ежедневно' },
        { marker: 'Na⁺ сыворотки', expectedChange: '↑', targetRange: '135-145', when: 'Каждые 3 дня' },
        { marker: 'Мочевина/креатинин', expectedChange: '↑', targetRange: 'Мочевина <8', when: 'Каждые 3 дня' },
      ],
      solutions: [
        { substanceId: 'hydration', name: 'Увеличение приёма воды', type: 'lifestyle', dose: '+0.5-1 л/сут', mechanism: 'Восполнение ОЦК', evidenceLevel: 'A' },
        { substanceId: 'potassium', name: 'Электролиты (K⁺, Na⁺, Mg²⁺)', type: 'supplement', dose: 'По анализам', mechanism: 'Восполнение потерь', evidenceLevel: 'A' },
        { substanceId: 'reduce_diuretic', name: 'Снизить или отменить диуретик', type: 'lifestyle', dose: '-25-50%', mechanism: 'Прекращение потери жидкости', evidenceLevel: 'A' },
      ],
      expectations: [
        { timeline: '1-2 ч', effect: 'Вода + электролиты: улучшение самочувствия' },
        { timeline: '24-48 ч', effect: 'Нормализация ОЦК при отмене диуретика' },
      ],
    }],
  },

  // ═══ СИМПТОМЫ: ДРУГИЕ ПРЕПАРАТЫ ═══
  {
    id: 'finasteride_sides',
    symptom: 'Пост-финастеридный синдром (↓ либидо, депрессия, усталость)',
    category: 'endocrine',
    urgency: 'warning',
    linkedDrugs: ['finasteride', 'dutasteride'],
    relatedSymptoms: ['libido_drop', 'depression_mood', 'fatigue'],
    quickFacts: [
      'PFS — редкий (1-3%), но тяжёлый побочный эффект',
      '↑ DHT не восстанавливается даже после отмены у части пациентов',
      'Механизм: ингибиция 5α-редуктазы → ↑ аллопрегнанолон → нейростероидный дисбаланс',
    ],
    generalInfo: 'Пост-финастеридный синдром (PFS) — персистирующие симптомы даже после отмены финастерида/дутастерида. Включает ↓ либидо, ЭД, депрессию, туман в голове, хроническую усталость.',
    problems: [{
      problem: 'Нейростероидный дисбаланс из-за ингибиции 5α-редуктазы',
      probability: 'low',
      mechanism: 'Финастерид ингибирует 5α-редуктазу 2 → ↓ DHT + ↓ аллопрегнанолон (нейростероид, модулирующий ГАМК-A). Длительная блокада → адаптация рецепторов → симптомы сохраняются после отмены.',
      labMarkers: [
        { marker: 'DHT', expectedChange: '↓↓', targetRange: '250-990 пг/мл ♂', when: 'На фоне приёма' },
        { marker: 'Аллопрегнанолон', expectedChange: '↓', targetRange: 'Не стандартизован', when: 'Специализированные лаб' },
      ],
      solutions: [
        { substanceId: 'stop_finasteride', name: 'Немедленная отмена финастерида/дутастерида', type: 'lifestyle', dose: '0 мг/сут', mechanism: 'Прекращение блокады 5α-редуктазы', evidenceLevel: 'A' },
        { substanceId: 'hcg', name: 'hCG 500 МЕ 2×/нед + энкломифен', type: 'pharma', dose: '500 МЕ 2×/нед', mechanism: 'LH-стимуляция Лейдига → ↑ T', evidenceLevel: 'C' },
        { substanceId: 'ashwagandha', name: 'Ашваганда KSM-66', type: 'supplement', dose: '600 мг/сут', mechanism: '↑ ГАМК, ↓ кортизол', evidenceLevel: 'B' },
        { substanceId: 'theanine', name: 'L-теанин', type: 'supplement', dose: '200 мг 2×/день', mechanism: 'α-волны, ↓ тревоги', evidenceLevel: 'B' },
      ],
      expectations: [
        { timeline: '1-2 нед', effect: 'Улучшение после отмены; не у всех', sideNote: 'PFS может длиться месяцами' },
        { timeline: '3-6 мес', effect: 'Постепенное восстановление у 50%' },
      ],
    }],
  },
  {
    id: 'melatonin_overuse',
    symptom: 'Злоупотребление мелатонином (утренняя сонливость, кошмары, ↓ эндогенного)',
    category: 'psychological',
    urgency: 'standard',
    linkedDrugs: [],
    relatedSymptoms: ['insomnia', 'depression_mood', 'cognitive_difficulty'],
    quickFacts: [
      'Мелатонин — не снотворное, а сигнал темноты',
      'Дозы >5 мг вызывают утреннюю сонливость (t½ = 40-60 мин, но рецепторы)', 
      'Длительный приём → ↓ эндогенной продукции',
    ],
    generalInfo: 'Мелатонин — гормон шишковидной железы, регулирующий циркадианные ритмы. При злоупотреблении (каждую ночь, высокие дозы) — утренняя сонливость, ↓ эндогенной продукции, яркие/кошмарные сны.',
    problems: [{
      problem: 'Супрафизиологические дозы → рецепторная десенситизация',
      probability: 'medium',
      mechanism: 'Экзогенный мелатонин >0.3 мг → активация MT1/MT2 рецепторов. При ежедневном приёме высоких доз → ↓ чувствительность рецепторов + ↓ эндогенной продукции через ↓ активность AANAT.',
      labMarkers: [
        { marker: 'Субъективная оценка', expectedChange: '↔', targetRange: 'Нет утренней сонливости', when: 'Ежедневно' },
      ],
      solutions: [
        { substanceId: 'reduce_melatonin', name: 'Снизить дозу до 0.3-1 мг', type: 'lifestyle', dose: '0.3-1 мг/ночь', mechanism: 'Физиологическая доза', evidenceLevel: 'A' },
        { substanceId: 'sleep_hygiene', name: 'Гигиена сна (синий свет, режим)', type: 'lifestyle', dose: '22:30-07:00', mechanism: 'Естественная регуляция', evidenceLevel: 'A' },
        { substanceId: 'glycine', name: 'Глицин', type: 'supplement', dose: '3 г перед сном', mechanism: '↓ температура тела, ↑ качество сна', evidenceLevel: 'B' },
        { substanceId: 'magnesium', name: 'Магний глицинат', type: 'supplement', dose: '200-400 мг вечером', mechanism: 'ГАМК-ергический эффект', evidenceLevel: 'B' },
      ],
      expectations: [
        { timeline: '3-7 дней', effect: 'Уменьшение утренней сонливости' },
        { timeline: '1-2 нед', effect: 'Восстановление собственного ритма', sideNote: 'Не использовать каждую ночь' },
      ],
    }],
  },
  {
    id: 'metformin_gi',
    symptom: 'ЖКТ-непереносимость метформина (диарея, тошнота, ↓ B12)',
    category: 'gastrointestinal',
    urgency: 'standard',
    linkedDrugs: ['metformin'],
    relatedSymptoms: ['diarrhea', 'nausea'],
    quickFacts: [
      '30-40% пользователей имеют ЖКТ-побочки от метформина',
      'Витамин B12 ↓ на 10-20% при приёме >6 мес',
      'MR (extended release) формы снижают GI-побочки в 2×',
    ],
    generalInfo: 'Метформин — первый препарат для метаболической коррекции на курсе. GI-побочки (диарея, тошнота, газообразование) связаны с ↑ серотонина в кишечнике и ↓ всасывания B12.',
    problems: [{
      problem: 'Метформин-индуцированная диарея и мальабсорбция B12',
      probability: 'high',
      mechanism: 'Метформин → ↑ серотонина в энтерохромаффинных клетках → ↑ перистальтика (диарея). + ↓ кальций-зависимый IF-B12 рецептор в подвздошной → ↓ B12 на 10-20%/год.',
      labMarkers: [
        { marker: 'B12 сыворотки', expectedChange: '↓', targetRange: '200-700 пг/мл', when: 'Каждые 3 мес' },
        { marker: 'Голотранскобаламин', expectedChange: '↓', targetRange: '>50 пмоль/л', when: 'При ↓ B12' },
      ],
      solutions: [
        { substanceId: 'metformin_mr', name: 'Метформин пролонг (MR)', type: 'pharma', dose: '500-1000 мг/сут', mechanism: 'Медленное высвобождение, ↓ GI', evidenceLevel: 'A' },
        { substanceId: 'vitamin_b12', name: 'B12 (метилкобаламин)', type: 'supplement', dose: '500-1000 мкг/сут', mechanism: 'Восполнение дефицита', evidenceLevel: 'A' },
        { substanceId: 'probiotics', name: 'Пробиотики (Lactobacillus)', type: 'supplement', dose: '10-20 млрд КОЕ/сут', mechanism: '↓ GI-побочек', evidenceLevel: 'B' },
      ],
      expectations: [
        { timeline: '3-7 дней', effect: '↓ диареи при приёме с едой' },
        { timeline: '2-4 нед', effect: 'Адаптация к MR-форме' },
      ],
    }],
  },
  // ═══ НОВЫЕ СИМПТОМЫ (Jul 08) ═══
  {
    id: 'chest_pain',
    symptom: 'Боль в груди / за грудиной / жжение в груди',
    category: 'cardiovascular',
    urgency: 'critical',
    linkedDrugs: ['all_aas', 'trenbolone', 'gh', 'clenbuterol', 't3', 'testosterone'],
    relatedSymptoms: ['tachycardia', 'hypertension', 'syncope', 'dyspnea'],
    quickFacts: ['Любая боль в груди на курсе ААС — red flag до исключения кардиальной патологии', 'Инфаркт миокарда у спортсменов на ААС описан даже в 25 лет', 'Причина может быть не только в сердце: ГЭРБ, межрёберная невралгия, ТЭЛА'],
    generalInfo: 'Боль в груди на фоне приёма ААС требует немедленной дифференциальной диагностики. Наиболее опасные причины: инфаркт миокарда (атеротромбоз на фоне дислипидемии + ↑ гематокрит), ТЭЛА (наследственная тромбофилия + эритроцитоз), расслоение аорты (гипертензия + ремоделирование сосудистой стенки). Менее опасные: ГЭРБ (дисфункция НПС на ААС), межрёберная невралгия, перикардит. Правило: сначала исключить самое опасное.',
    problems: [
      {
        problem: 'Инфаркт миокарда / ОКС (атеротромбоз коронарных артерий)', probability: 'medium',
        mechanism: 'ААС → ↓ ЛПВП, ↑ ЛПНП → ускорение атеросклероза. + ↑ гематокрит → ↑ вязкость крови → ↑ риск тромбоза. + ↑ АД → ↑ напряжение сдвига → дестабилизация бляшки. + тромбоксан A2 → ↑ агрегация тромбоцитов.',
        stopCriteria: ['ЭКГ с подъёмом ST — НЕМЕДЛЕННАЯ госпитализация', 'Тропонин >0.1 нг/мл — ИМпST, экстренное ЧКВ', 'Гемодинамическая нестабильность — вызов скорой'],
        labMarkers: [
          { marker: 'Тропонин I/T', expectedChange: '↑↑↑', targetRange: '<0.04 нг/мл', when: 'НЕМЕДЛЕННО (в покое)' },
          { marker: 'ЭКГ в 12 отведениях', expectedChange: '↑', targetRange: 'Без ишемии', when: 'НЕМЕДЛЕННО' },
          { marker: 'D-димер', expectedChange: '↔', targetRange: '<500 нг/мл', when: 'Для исключения ТЭЛА' },
          { marker: 'CK-MB', expectedChange: '↑↑', targetRange: '<24 Ед/л', when: 'Через 6-8 ч после боли' },
          { marker: 'Гематокрит, вязкость', expectedChange: '↑', targetRange: '<52%', when: 'Контроль' },
        ],
        solutions: [
          { substanceId: 'emergency_call', name: 'НЕМЕДЛЕННО вызвать скорую', type: 'lifestyle', dose: '103', mechanism: 'Время — миокард. Каждая минута задержки = больше некроза', evidenceLevel: 'A' },
          { substanceId: 'aspirin_300', name: 'Аспирин 300 мг разжевать (если нет противопоказаний)', type: 'pharma', dose: '300 мг', mechanism: 'Ингибирование ЦОГ-1 → ↓ тромбоксан A2 → ↓ агрегация', evidenceLevel: 'A' },
          { substanceId: 'nitroglycerin', name: 'Нитроглицерин сублингвально', type: 'pharma', dose: '0.5 мг каждые 5 мин до 3 доз', mechanism: 'Вазодилатация коронарных артерий', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '0-1 час', effect: 'ЭКГ + тропонин — диагноз' },
          { timeline: '1-6 час', effect: 'ЧКВ (стентирование) или тромболизис' },
        ],
      },
      {
        problem: 'ТЭЛА (тромбоэмболия лёгочной артерии)', probability: 'medium',
        mechanism: 'ААС → ↑ тромбофилия (↓ протеин S/C, ↑ фактор VIII) + эритроцитоз + иммобилизация → тромбоз глубоких вен → эмболизация лёгочных артерий.',
        stopCriteria: ['D-димер >1000 нг/мл + одышка — КТ-ангиография экстренно', 'Массивная ТЭЛА (гипотензия) — госпитализация'],
        labMarkers: [
          { marker: 'D-димер', expectedChange: '↑↑', targetRange: '<500 нг/мл', when: 'НЕМЕДЛЕННО' },
          { marker: 'РаО₂', expectedChange: '↓', targetRange: '>80 мм рт.ст.', when: 'НЕМЕДЛЕННО' },
          { marker: 'Эхо-КГ', expectedChange: '↑', targetRange: 'Без перегрузки ПЖ', when: 'НЕМЕДЛЕННО' },
        ],
        solutions: [
          { substanceId: 'hospitalization', name: 'Срочная госпитализация', type: 'lifestyle', dose: '—', mechanism: 'Антикоагуляция + тромболизис', evidenceLevel: 'A' },
          { substanceId: 'heparin', name: 'НФГ или НМГ по весу', type: 'pharma', dose: 'По протоколу', mechanism: 'Антикоагуляция', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '0-24 час', effect: 'Диагностика (D-димер → КТ-ангиограмма)' },
        ],
      },
    ],
  },
  {
    id: 'hypertensive_crisis',
    symptom: 'Гипертонический криз / резкий скачок АД',
    category: 'cardiovascular',
    urgency: 'critical',
    linkedDrugs: ['all_aas', 'trenbolone', 'clenbuterol', 't3', 'gh', 'methandienone', 'oxymetholone', 'nandrolone'],
    relatedSymptoms: ['hypertension', 'chest_pain', 'syncope', 'headache', 'vision_changes'],
    quickFacts: ['Гипертонический криз = АД ≥180/120 — жизнеугрожающее состояние', 'Наиболее частая причина на курсе: кленбутерол + T3 + ААС (синергия)', 'Криз может быть первым проявлением феохромоцитомы (исключить)'],
    generalInfo: 'Гипертонический криз — резкий подъём АД ≥180/120 мм рт.ст. с или без поражения органов-мишеней. На курсе ААС возникает на фоне синергизма: вазоконстрикция (ААС + стимуляторы) + ↑ ОЦК (задержка Na/H₂O) + ↑ вязкость (эритроцитоз). КРИТИЧЕСКИ важно: снижать АД плавно (не >25% за первые 2 ч), чтобы избежать ишемии мозга.',
    problems: [
      {
        problem: 'Неотложная гипертоническая ситуация (HUI без поражения органов)', probability: 'high',
        mechanism: 'ААС + симпатомиметики (кленбутерол, эфедрин) + ↑ ОЦК → АД ≥180/120. Органы-мишени не повреждены.',
        stopCriteria: ['АД ≥220/130 — неотложное состояние, переходить к Problem 2'],
        labMarkers: [
          { marker: 'АД (каждые 15 мин)', expectedChange: '↑↑', targetRange: '<180/120', when: 'НЕМЕДЛЕННО' },
          { marker: 'ЭКГ', expectedChange: '↑', targetRange: 'Без ишемии', when: 'НЕМЕДЛЕННО' },
          { marker: 'Креатинин сыворотки', expectedChange: '↔', targetRange: '<110 мкмоль/л', when: 'НЕМЕДЛЕННО' },
          { marker: 'Мочевина', expectedChange: '↔', targetRange: '2.5-8.3 ммоль/л', when: 'НЕМЕДЛЕННО' },
        ],
        solutions: [
          { substanceId: 'stop_stimulants', name: 'НЕМЕДЛЕННО прекратить стимуляторы (кленбутерол, T3, эфедрин, кофеин)', type: 'lifestyle', dose: '—', mechanism: 'Устранение причины криза', evidenceLevel: 'A' },
          { substanceId: 'stop_harmful_aas', name: 'Прекратить андрогенные ААС', type: 'lifestyle', dose: '—', mechanism: '↓ РААС и симпатического тонуса', evidenceLevel: 'C' },
          { substanceId: 'captopril_25', name: 'Каптоприл 25 мг сублингвально', type: 'pharma', dose: '25 мг', mechanism: 'Ингибитор АПФ → ↓ периферическое сопротивление', evidenceLevel: 'A' },
          { substanceId: 'nifedipine_10', name: 'Нифедипин 10 мг сублингвально (осторожно: рефлекторная тахикардия)', type: 'pharma', dose: '10 мг', mechanism: 'Блокатор Ca²⁺-каналов → вазодилатация', evidenceLevel: 'A' },
          { substanceId: 'telmisartan_80', name: 'Телмисартан 80 мг + небиволол 5 мг (перевод на регулярную терапию)', type: 'pharma', dose: '40-80 мг + 2.5-5 мг', mechanism: 'ARB + β1-блокада', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '15-30 мин', effect: 'Снижение АД на 15-20%' },
          { timeline: '2-4 ч', effect: 'АД <160/100' },
          { timeline: '24-48 ч', effect: 'Подбор плановой терапии' },
        ],
      },
      {
        problem: 'Гипертоническая ургентная ситуация с поражением органов-мишеней', probability: 'low',
        mechanism: 'Продолжительный криз → поражение органов: гипертоническая энцефалопатия (головная боль, рвота, ↓ сознания), расслоение аорты (рвущая боль в груди/спине), ОКС, острая почечная недостаточность.',
        stopCriteria: ['Снижение сознания/судороги — гипертоническая энцефалопатия', 'Рвущая боль в груди/спине — расслоение аорты', 'Анурия/олигурия — острая почечная недостаточность'],
        labMarkers: [
          { marker: 'МРТ/КТ головы', expectedChange: '↑', targetRange: 'Без отёка/кровоизлияния', when: 'При ↓ сознания' },
          { marker: 'КТ грудной аорты', expectedChange: '↑', targetRange: 'Без расслоения', when: 'При рвущей боли' },
          { marker: 'Мочевина/креатинин', expectedChange: '↑', targetRange: 'Креатинин <110', when: 'Контроль' },
        ],
        solutions: [
          { substanceId: 'emergency_hospitalization', name: 'ЭКСТРЕННАЯ ГОСПИТАЛИЗАЦИЯ', type: 'lifestyle', dose: '103', mechanism: 'Требуется внутривенная гипотензивная терапия', evidenceLevel: 'A' },
          { substanceId: 'iv_labels', name: 'Лабеталол в/в или нитропруссид натрия', type: 'pharma', dose: 'Лабеталол 20 мг в/в, затем 0.5-2 мг/мин', mechanism: 'αβ-блокада (лабеталол) / донатор NO (нитропруссид)', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '0-6 ч', effect: 'Снижение АД на 25% от исходного' },
          { timeline: '24-48 ч', effect: 'АД <160/100, стабилизация' },
        ],
      },
    ],
  },
  {
    id: 'syncope',
    symptom: 'Обморок / синкопе / потеря сознания',
    category: 'cardiovascular',
    urgency: 'critical',
    linkedDrugs: ['clenbuterol', 't3', 'trenbolone', 'gh', 'insulin', 'diuretics', 'all_aas', 'telmisartan', 'nebivolol'],
    relatedSymptoms: ['chest_pain', 'palpitations', 'hypoglycemia', 'hypotension_symptoms', 'tachycardia'],
    quickFacts: ['Обморок на курсе — всегда опасен до доказательства обратного', 'Три главных причины: аритмия/ИМ, гипогликемия, ортостаз (ААС + диуретики)', 'Инсулин + GH + кленбутерол — летальная комбинация для гликемии'],
    generalInfo: 'Обморок (синкопе) — внезапная кратковременная потеря сознания из-за ↓ перфузии головного мозга. На курсе ААС причины разнообразны: кардиальные (аритмия, ИМ, аортальный стеноз), гипогликемические (инсулин, GH, голодание), ортостатические (диуретики, ААС, ↓ АД), нейро-рефлекторные (вазовагальные, триггерные). Красный флаг: обморок при нагрузке = кардиальный генез до опровержения.',
    problems: [
      {
        problem: 'Кардиогенный синкопе (аритмия / ИМ / аортальный стеноз)', probability: 'medium',
        mechanism: 'ААС → ↑ масса миокарда + ↓ коронарный резерв + электролитный дисбаланс (↓K⁺, ↑Na⁺). Кленбутерол/T3 → ↑ ЧСС → ↓ наполнение ЛЖ → ↓ сердечный выброс. + Риск ИМ на фоне протромботического состояния.',
        stopCriteria: ['Обморок на фоне нагрузки — кардиогенный до опровержения', 'ЭКГ с аритмией — экстренная госпитализация', 'Тропонин ↑ — ОКС'],
        labMarkers: [
          { marker: 'ЭКГ в 12 отв.', expectedChange: '↑', targetRange: 'Без аритмии/ишемии', when: 'НЕМЕДЛЕННО' },
          { marker: 'Тропонин', expectedChange: '↔', targetRange: '<0.04 нг/мл', when: 'НЕМЕДЛЕННО' },
          { marker: 'Эхо-КГ', expectedChange: '↔', targetRange: 'ФВ >50%, без ГКМП', when: 'Планово' },
          { marker: 'Холтер 24 ч', expectedChange: '↔', targetRange: 'Без жизнеугрожающих аритмий', when: 'Планово' },
        ],
        solutions: [
          { substanceId: 'emergency_call', name: 'Вызвать скорую (при первом эпизоде на курсе)', type: 'lifestyle', dose: '103', mechanism: 'Исключить ИМ/аритмию', evidenceLevel: 'A' },
          { substanceId: 'stop_clen_t3', name: 'Прекратить кленбутерол и T3', type: 'lifestyle', dose: '—', mechanism: 'Устранение хронотропного стресса', evidenceLevel: 'B' },
          { substanceId: 'ecg_monitoring', name: 'Холтер-мониторинг + Эхо-КГ', type: 'lifestyle', dose: '—', mechanism: 'Структурная оценка сердца', evidenceLevel: 'A' },
          { substanceId: 'electrolytes', name: 'Коррекция электролитов (K⁺, Mg²⁺)', type: 'supplement', dose: 'K⁺ 4-5.5, Mg 400-600 мг', mechanism: 'Стабилизация мембранного потенциала кардиомиоцитов', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '0-4 ч', effect: 'Исключение ИМ + аритмии' },
          { timeline: '1-2 нед', effect: 'Эхо-КГ + Холтер' },
        ],
      },
    ],
  },
  {
    id: 'hemoptysis',
    symptom: 'Кровохарканье / кашель с кровью',
    category: 'cardiovascular',
    urgency: 'critical',
    linkedDrugs: ['all_aas', 'trenbolone', 'nandrolone', 'testosterone', 'gh', 'clenbuterol', 'diuretics'],
    relatedSymptoms: ['chest_pain', 'dyspnea', 'tren_cough', 'nosebleeds', 'edema'],
    quickFacts: ['Кровохарканье на курсе ААС — красный флаг ТЭЛА/инфаркта лёгкого', 'Причина: тромбоэмболия лёгочных артерий на фоне ↑ тромбофилии', 'Исключить туберкулёз, рак лёгкого, бронхоэктазы (не связаны с ААС)'],
    generalInfo: 'Кровохарканье — выделение крови из дыхательных путей при кашле. На курсе ААС наиболее вероятная причина — ТЭЛА (тромбоэмболия лёгочной артерии) с геморрагическим инфарктом лёгкого на фоне протромботического состояния. ААС ↓ протеин S/C, ↑ фактор VIII, ↑ гематокрит → тромбофилия. Тренболон и нандролон особенно ↑ тромбогенный риск.',
    problems: [
      {
        problem: 'ТЭЛА с геморрагическим инфарктом лёгкого', probability: 'medium',
        mechanism: 'ААС ↑ синтез факторов свёртывания в печени + ↓ протеин S/C → гиперкоагуляция → тромбоз глубоких вен → эмбол в лёгочную артерию → инфаркт лёгкого с кровохарканьем. Тренболон: ↑ тромбоксан A₂ → вазоконстрикция + агрегация.',
        stopCriteria: ['D-димер >1000 + кровохарканье — КТ-ангиография экстренно', 'Сатурация <92% — кислород + госпитализация', 'Массивное кровохарканье (>100 мл/сут) — экстренная помощь'],
        labMarkers: [
          { marker: 'D-димер', expectedChange: '↑↑', targetRange: '<500 нг/мл', when: 'НЕМЕДЛЕННО' },
          { marker: 'КТ-ангиография грудной клетки', expectedChange: '↑', targetRange: 'Без тромба', when: 'НЕМЕДЛЕННО' },
          { marker: 'SpO₂', expectedChange: '↓', targetRange: '>94%', when: 'НЕМЕДЛЕННО' },
          { marker: 'Рентгенография лёгких', expectedChange: '↑', targetRange: 'Без инфильтрата', when: 'НЕМЕДЛЕННО' },
        ],
        solutions: [
          { substanceId: 'emergency_hospitalization', name: 'НЕМЕДЛЕННАЯ госпитализация', type: 'lifestyle', dose: '103', mechanism: 'Исключение массивной ТЭЛА', evidenceLevel: 'A' },
          { substanceId: 'stop_all_aas', name: 'Прекратить все ААС (особенно тренболон/нандролон)', type: 'lifestyle', dose: '—', mechanism: '↓ тромбогенного риска', evidenceLevel: 'B' },
          { substanceId: 'anticoagulation', name: 'Антикоагуляция (НМГ/варфарин)', type: 'pharma', dose: 'По протоколу', mechanism: 'Предотвращение рецидива ТЭЛА', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '0-24 ч', effect: 'Диагностика (КТ-ангиограмма, D-димер)' },
          { timeline: '1-7 дн', effect: 'Антикоагуляция + стабилизация' },
          { timeline: '3-6 мес', effect: 'Полный курс антикоагуляции' },
        ],
      },
      {
        problem: 'Лёгочная гипертензия (ААС-индуцированная ремоделирование сосудов)', probability: 'low',
        mechanism: 'Хронический приём ААС → ↑ пролиферация гладкомышечных клеток лёгочных артерий (андроген-опосредованная) → ↓ просвет → ↑ лёгочное АД → разрыв капилляров → кровохарканье.',
        stopCriteria: ['Сист. давление в лёгочной артерии >60 мм рт.ст. по Эхо-КГ'],
        labMarkers: [
          { marker: 'Эхо-КГ с оценкой давления в лёгочной артерии', expectedChange: '↑', targetRange: '<35 мм рт.ст.', when: 'При рецидивирующем кровохарканье' },
        ],
        solutions: [
          { substanceId: 'pulmonary_workup', name: 'Полный пульмонологический чекап', type: 'lifestyle', dose: '—', mechanism: 'Исключить все причины', evidenceLevel: 'B' },
        ],
        expectations: [
          { timeline: '1-2 нед', effect: 'Эхо-КГ + КТ' },
        ],
      },
    ],
  },
  {
    id: 'polydipsia',
    symptom: 'Постоянная жажда / сухость во рту / полидипсия',
    category: 'endocrine',
    urgency: 'warning',
    linkedDrugs: ['gh', 'insulin', 'clenbuterol', 't3', 'testosterone', 'trenbolone', 'metformin'],
    relatedSymptoms: ['insulin_resistance_progression', 'hypoglycemia', 'fatigue', 'thyroid_dysfunction', 'acromegaly_signs'],
    quickFacts: ['Жажда на курсе — ранний маркер нарушений углеводного обмена', 'GH + ААС → контринсулярный эффект → гипергликемия → жажда', 'Исключить несахарный диабет (очень редко на ААС)'],
    generalInfo: 'Полидипсия (патологическая жажда) на курсе ААС чаще всего указывает на гипергликемию (контринсулярный эффект GH, ААС, кленбутерола). Второй механизм — гиперкальциемия (GH ↑ кальцитриол). При жажде + частое мочеиспускание — срочно проверить HbA1c + глюкозу натощак.',
    problems: [
      {
        problem: 'Гипергликемия/диабет (контринсулярный эффект GH + ААС)', probability: 'high',
        mechanism: 'GH → ↑ соматомедин C → ↑ липолиз → ↑ FFA → ↓ сигнал инсулина. + ААС → ↓ транспорта GLUT4 → ↓ утилизация глюкозы. + Кленбутерол → ↑ гликогенолиз + ↑ глюконеогенез. Итог: ↑ глюкоза крови → осмотический диурез → жажда.',
        stopCriteria: ['Глюкоза >15 ммоль/л — прекратить GH/кленбутерол', 'HbA1c >7% — начать метформин/прекратить курс', 'Глюкоза >20 ммоль/л или кетоны + — неотложная помощь'],
        labMarkers: [
          { marker: 'Глюкоза натощак', expectedChange: '↑', targetRange: '<5.5 ммоль/л', when: 'НЕМЕДЛЕННО' },
          { marker: 'HbA1c', expectedChange: '↑', targetRange: '<5.7%', when: 'НЕМЕДЛЕННО' },
          { marker: 'Инсулин натощак', expectedChange: '↑', targetRange: '<15 мкЕд/мл', when: 'Контроль' },
          { marker: 'HOMA-IR', expectedChange: '↑', targetRange: '<2.5', when: 'Расчёт' },
          { marker: 'Кетоны мочи/крови', expectedChange: '↔', targetRange: 'Отрицательно', when: 'При глюкозе >15' },
        ],
        solutions: [
          { substanceId: 'reduce_gh_dose', name: 'Снизить дозу GH или перерыв', type: 'lifestyle', dose: 'GH <2 МЕ/день или стоп', mechanism: '↓ контринсулярного эффекта', evidenceLevel: 'A' },
          { substanceId: 'metformin', name: 'Метформин 500-1000 мг/сут', type: 'pharma', dose: '500-1000 мг с едой', mechanism: 'AMPK → ↑ инсулиночувствительность, ↓ глюконеогенез', evidenceLevel: 'A' },
          { substanceId: 'berberine', name: 'Берберин', type: 'supplement', dose: '500 мг 2-3р/день', mechanism: 'AMPK, ↓ глюконеогенез', evidenceLevel: 'B' },
          { substanceId: 'low_carb_diet', name: 'Низкоуглеводная диета (<100 г/день)', type: 'lifestyle', dose: '<100 г углеводов', mechanism: '↓ гликемической нагрузки', evidenceLevel: 'A' },
          { substanceId: 'intermittent_fasting', name: 'Интервальное голодание 16:8', type: 'lifestyle', dose: '16ч голод', mechanism: '↓ инсулин, ↑ глюкозотолерантность', evidenceLevel: 'B' },
        ],
        expectations: [
          { timeline: '2-4 нед', effect: 'Глюкоза ↓ 1-2 ммоль/л' },
          { timeline: '8-12 нед', effect: 'HbA1c ↓ 0.3-0.5%' },
          { timeline: 'При отмене GH', effect: 'Глюкоза нормализуется через 1-2 нед' },
        ],
      },
    ],
  },
];