// ════════════════════════════════════════════════════════════════════
//  assay-interference-db.ts — как препараты/БАДы и преаналитические
//  факторы влияют на лабораторные показатели (C4):
//  ASSAY_INTERFERENCE_DB — реально изменяет/искажает assay;
//  PREANALYTIC_EFFECTS_DB — гидратация/нагрузка/голод/время суток.
//  Используется buildAssayWarnings (tz-mapper-engine) → rec.assayWarnings.
// ════════════════════════════════════════════════════════════════════

export interface AssayInterferenceEntry {
  substanceId: string;
  marker: string;
  effect: 'increases' | 'decreases' | 'distorts';
  mechanism: string;
  advice: string;
}

export const ASSAY_INTERFERENCE_DB: AssayInterferenceEntry[] = [
  {
    substanceId: 'biotin', marker: 'TSH/FT4/FT3, тропонин, гормоны (иммунохимия)',
    effect: 'distorts', mechanism: 'биотин мешает стрептавидин-биотиновым иммунохимическим тестам',
    advice: 'прекратить биотин ≥3-5 дней до сдачи, сообщить лаборатории о приёме',
  },
  {
    substanceId: 'vitamin_b7', marker: 'TSH/FT4/FT3, тропонин, гормоны (иммунохимия)',
    effect: 'distorts', mechanism: 'биотин мешает стрептавидин-биотиновым иммунохимическим тестам',
    advice: 'прекратить биотин ≥3-5 дней до сдачи, сообщить лаборатории о приёме',
  },
  {
    substanceId: 'creatine', marker: 'креатинин',
    effect: 'increases', mechanism: 'креатин повышает сывороточный креатинин без пропорционального падения функции почек',
    advice: 'интерпретировать вместе с eGFR, цистатином-C и UACR',
  },
  {
    substanceId: 'nattokinase', marker: 'коагулограмма (МНО/АЧТВ/фибриноген/D-димер)',
    effect: 'distorts', mechanism: 'фибринолитическое действие меняет коагуляционные показатели',
    advice: 'указать врачу перед коагулограммой и инвазивными процедурами',
  },
  {
    substanceId: 'serrapeptase', marker: 'коагулограмма (МНО/АЧТВ/фибриноген/D-димер)',
    effect: 'distorts', mechanism: 'фибринолитическое действие меняет коагуляционные показатели',
    advice: 'указать врачу перед коагулограммой и инвазивными процедурами',
  },
  {
    substanceId: 'bromelain', marker: 'коагулограмма (МНО/АЧТВ/фибриноген/D-димер)',
    effect: 'distorts', mechanism: 'фибринолитическое действие меняет коагуляционные показатели',
    advice: 'указать врачу перед коагулограммой и инвазивными процедурами',
  },
  {
    substanceId: 'aspirin', marker: 'агрегация тромбоцитов, МНО/АЧТВ',
    effect: 'distorts', mechanism: 'антиагрегантное действие',
    advice: 'указать врачу перед коагулограммой и операцией',
  },
  {
    substanceId: 'ginkgo', marker: 'МНО/АЧТВ',
    effect: 'distorts', mechanism: 'влияние на агрегацию и свёртывание',
    advice: 'указать врачу перед коагулограммой и операцией',
  },
  {
    substanceId: 'garlic', marker: 'МНО/АЧТВ',
    effect: 'distorts', mechanism: 'высокие дозы влияют на свёртывание',
    advice: 'указать врачу перед коагулограммой и операцией',
  },
  {
    substanceId: 'vitamin_c', marker: 'глюкоза (глюкозооксидазные тест-полоски)',
    effect: 'distorts', mechanism: 'высокие дозы аскорбиновой кислоты могут искажать глюкозу в тест-полосках',
    advice: 'учитывать при самоконтроле глюкозы',
  },
  {
    substanceId: 'iron', marker: 'ферритин, сыв. железо, TSAT',
    effect: 'distorts', mechanism: 'приём железа в день сдачи повышает сывороточное железо и TSAT',
    advice: 'сдавать железо/TSAT натощак, до приёма препаратов железа',
  },
  {
    substanceId: 'milk_thistle', marker: 'АЛТ/АСТ/ГГТ',
    effect: 'decreases', mechanism: 'гепатопротекторное действие снижает трансаминазы на фоне поражения',
    advice: 'учитывать при оценке реальной гепатотоксичности курса',
  },
  {
    substanceId: 'curcumin', marker: 'CRP',
    effect: 'decreases', mechanism: 'противовоспалительное действие снижает hs-СРБ',
    advice: 'учитывать при оценке воспалительного статуса',
  },
];

export interface PreanalyticEffectEntry {
  factor: 'hydration' | 'training' | 'fasting' | 'time_of_day' | 'stress' | 'sleep';
  marker: string;
  effect: string;
  advice: string;
}

export const PREANALYTIC_EFFECTS_DB: PreanalyticEffectEntry[] = [
  {
    factor: 'hydration', marker: 'HCT/HGB, мочевина, Na⁺, белок',
    effect: 'гемоконцентрация при дегидратации и гемодилюция при перегрузке водой',
    advice: 'сдавать в сопоставимом состоянии гидратации, сравнивать серии анализов',
  },
  {
    factor: 'training', marker: 'CK, AST, CRP, иногда тропонин',
    effect: 'временное повышение после интенсивной тренировки',
    advice: 'учитывать время последней нагрузки; при динамике — сдавать в одинаковых условиях',
  },
  {
    factor: 'fasting', marker: 'глюкоза, инсулин, липиды, ТГ, ЛПНП',
    effect: 'зависимость от приёма пищи',
    advice: 'сдавать строго натощак 8-12 ч, без алкоголя накануне',
  },
  {
    factor: 'time_of_day', marker: 'кортизол, тестостерон',
    effect: 'циркадные колебания (кортизол ↑ утром, ТТ ↓ вечером)',
    advice: 'сдавать утром в одно и то же время для сопоставимости',
  },
  {
    factor: 'stress', marker: 'кортизол, PRL, глюкоза',
    effect: 'острый стресс повышает кортизол/PRL',
    advice: 'спокойствие перед забором, не сдавать в день стресса/недосыпа',
  },
  {
    factor: 'sleep', marker: 'кортизол, ТТ, PRL',
    effect: 'недосып повышает кортизол и снижает тестостерон',
    advice: 'полноценный сон накануне сдачи',
  },
];

/** Собрать предупреждения по составу плана из обеих БД (плюс PED-baseline строка). */
export function buildAssayWarningsFromDb(subs: string[]): string[] {
  const ids = new Set(subs.map(id => id.toLowerCase()));
  const warnings: string[] = [];
  for (const e of ASSAY_INTERFERENCE_DB) {
    if (ids.has(e.substanceId)) {
      warnings.push(`${e.substanceId}: ${e.marker} — ${e.effect === 'distorts' ? 'искажает assay' : e.effect === 'increases' ? 'может повышать' : 'может снижать'} (${e.mechanism}). ${e.advice}.`);
    }
  }
  return warnings;
}
