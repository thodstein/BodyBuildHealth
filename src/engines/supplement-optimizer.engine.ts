/**
 * Supplement Stack Optimizer — Recommendations based on goals, risks, and course.
 *
 * Analyzes user's pharmacological course and recommends:
 *  - Organ protection (liver, kidney, heart, prostate)
 *  - Lipid management
 *  - Blood pressure control
 *  - Neuroprotection
 *  - Joint/tendon support
 *  - General health optimization
 *
 * @module supplement-optimizer
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface SupplementRec {
  name: string;
  category: 'liver' | 'kidney' | 'heart' | 'blood' | 'lipids' | 'bp' | 'cns' | 'joints' | 'prostate' | 'general' | 'sleep';
  dosage: string;
  timing: string;
  priority: 'essential' | 'recommended' | 'optional';
  reason: string;
  evidence: string;
  risks: string;
}

export interface StackInput {
  compounds: string[];     // active drugs
  riskLevels: {
    hepatic: 'low' | 'medium' | 'high';
    renal: 'low' | 'medium' | 'high';
    cardiac: 'low' | 'medium' | 'high';
    lipids: 'low' | 'medium' | 'high';
    bp: 'low' | 'medium' | 'high';
    prostate: 'low' | 'medium' | 'high';
    cns: 'low' | 'medium' | 'high';
    blood: 'low' | 'medium' | 'high';
    joints: 'low' | 'medium' | 'high';
  };
  hasOrals: boolean;
  has19nor: boolean;
  hasTren: boolean;
  hasGH: boolean;
  hasInsulin: boolean;
  goal: 'bulk' | 'cut' | 'maintenance' | 'strength';
}

export interface StackOutput {
  essential: SupplementRec[];
  recommended: SupplementRec[];
  optional: SupplementRec[];
  totalMonthlyCost: string;
  summary: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Supplement database
// ═══════════════════════════════════════════════════════════════════════════

const SUPPLEMENT_DB: SupplementRec[] = [
  // ── Liver ──
  {
    name: 'TUDCA', category: 'liver', dosage: '500-1000 мг/день', timing: 'С едой, разделить на 2 приёма',
    priority: 'essential', reason: 'Защита от холестаза при 17α-алкилированных ААС',
    evidence: 'Улучшает отток желчи, снижает GGT и ALP. Доказано в клинических исследованиях.',
    risks: 'Может вызывать диарею при дозах >1500 мг.',
  },
  {
    name: 'NAC', category: 'liver', dosage: '1200-2400 мг/день', timing: 'Разделить на 2-3 приёма',
    priority: 'essential', reason: 'Антиоксидантная защита гепатоцитов, восстановление глутатиона',
    evidence: 'Снижает ALT/AST при медикаментозном гепатите. Золотой стандарт при отравлении парацетамолом.',
    risks: 'Безопасен в указанных дозах.',
  },
  {
    name: 'Расторопша (Силимарин)', category: 'liver', dosage: '500-1000 мг/день', timing: 'С едой',
    priority: 'recommended', reason: 'Гепатопротектор растительного происхождения',
    evidence: 'Умеренные доказательства снижения трансаминаз. Мета-анализ показывает эффективность.',
    risks: 'Минимальны.',
  },

  // ── Kidney ──
  {
    name: 'Астрагал', category: 'kidney', dosage: '500-1000 мг/день', timing: 'Разделить на 2 приёма',
    priority: 'recommended', reason: 'Снижает протеинурию и KIM-1 при FSGS',
    evidence: 'Клинические исследования показывают снижение протеинурии на 30-40%.',
    risks: 'Может взаимодействовать с иммунодепрессантами.',
  },
  {
    name: 'Пикногенол', category: 'kidney', dosage: '100-200 мг/день', timing: 'С едой',
    priority: 'optional', reason: 'Антиоксидант, улучшает микроциркуляцию в почках',
    evidence: 'Снижает оксидативный стресс в подоцитах.',
    risks: 'Может усиливать действие антикоагулянтов.',
  },

  // ── Heart / BP ──
  {
    name: 'Телмисартан', category: 'heart', dosage: '40-80 мг/день', timing: 'Утро',
    priority: 'essential', reason: 'Контроль АД + PPAR-γ активация + защита почек',
    evidence: 'Снижает внутриклубочковое давление. Единственный БРА с PPAR-γ агонизмом.',
    risks: 'Только по назначению врача. Контроль калия.',
  },
  {
    name: 'Коэнзим Q10', category: 'heart', dosage: '200-400 мг/день', timing: 'С жирной пищей',
    priority: 'recommended', reason: 'Митохондриальная защита кардиомиоцитов',
    evidence: 'Улучшает фракцию выброса при кардиомиопатии. Снижает оксидативный стресс.',
    risks: 'Безопасен.',
  },
  {
    name: 'Магний (бисглицинат)', category: 'heart', dosage: '400-600 мг/день', timing: 'Перед сном',
    priority: 'essential', reason: 'Вазодилатация, антиаритмическое, снижение АД',
    evidence: 'Дефицит магния — фактор риска гипертензии. Расслабляет гладкую мускулатуру сосудов.',
    risks: 'Диарея при передозировке.',
  },

  // ── Lipids ──
  {
    name: 'Омега-3 (EPA/DHA)', category: 'lipids', dosage: '3-6 г/день', timing: 'С едой',
    priority: 'essential', reason: 'Снижение ТГ, улучшение HDL, противовоспалительное',
    evidence: 'Дозозависимое снижение триглицеридов. EPA > DHA для липидов.',
    risks: 'Разжижает кровь. Осторожно с антикоагулянтами.',
  },
  {
    name: 'Цитрусовый бергамот', category: 'lipids', dosage: '500-1000 мг/день', timing: 'С едой',
    priority: 'recommended', reason: 'Натуральный статин-подобный эффект на LDL',
    evidence: 'Клинические исследования: снижение LDL на 20-30%.',
    risks: 'Может взаимодействовать с CYP3A4.',
  },
  {
    name: 'Красный дрожжевой рис', category: 'lipids', dosage: '1200-2400 мг/день', timing: 'Вечер',
    priority: 'optional', reason: 'Содержит монаколин К (природный ловастатин)',
    evidence: 'Снижает LDL на 15-25%.',
    risks: 'Гепатотоксичность при высоких дозах. Контроль ALT.',
  },

  // ── Blood ──
  {
    name: 'Аспирин (низкодозовый)', category: 'blood', dosage: '75-100 мг/день', timing: 'С едой',
    priority: 'essential', reason: 'Снижение вязкости крови при HCT >50%',
    evidence: 'Антиагрегант. Снижает риск тромбоза при эритроцитозе.',
    risks: 'Желудочное кровотечение. Принимать с едой.',
  },
  {
    name: 'Грейпфрутовый экстракт (Нарингенин)', category: 'blood', dosage: '500 мг/день', timing: 'Утро',
    priority: 'recommended', reason: 'Снижает гематокрит через ингибирование EPO',
    evidence: 'Умеренные доказательства. Требуется больше исследований.',
    risks: 'Взаимодействует с CYP3A4.',
  },

  // ── CNS / Sleep ──
  {
    name: 'Мелатонин', category: 'sleep', dosage: '3-5 мг', timing: 'За 30-60 мин до сна',
    priority: 'recommended', reason: 'Улучшение качества сна при тренболоновой бессоннице',
    evidence: 'Доказанная эффективность при инсомнии. Антиоксидантные свойства.',
    risks: 'Сонливость утром при дозах >5 мг.',
  },
  {
    name: 'Глицин', category: 'cns', dosage: '3-5 г', timing: 'Перед сном',
    priority: 'recommended', reason: 'Снижение нейротоксичности, улучшение сна',
    evidence: 'Глициновые рецепторы — тормозные. Снижает возбуждение ЦНС.',
    risks: 'Безопасен.',
  },
  {
    name: 'L-теанин', category: 'cns', dosage: '200-400 мг', timing: 'При тревожности',
    priority: 'optional', reason: 'GABA-ергическая модуляция, снижение тревожности',
    evidence: 'Повышает альфа-волны мозга. Синергия с кофеином (фокус).',
    risks: 'Безопасен.',
  },

  // ── Joints ──
  {
    name: 'Глюкозамин + Хондроитин', category: 'joints', dosage: '1500/1200 мг', timing: 'С едой',
    priority: 'recommended', reason: 'Защита суставов при десикации от станазолола',
    evidence: 'Стимулирует синтез протеогликанов. Умеренная доказательная база.',
    risks: 'Может повышать глюкозу.',
  },
  {
    name: 'Коллаген II типа', category: 'joints', dosage: '40 мг (UC-II)', timing: 'Натощак',
    priority: 'optional', reason: 'Восстановление хрящевой ткани',
    evidence: 'Иммунологическая толерантность к коллагену. Снижает боль в суставах.',
    risks: 'Безопасен.',
  },

  // ── Prostate ──
  {
    name: 'Сереноа (Saw Palmetto)', category: 'prostate', dosage: '320 мг/день', timing: 'С едой',
    priority: 'recommended', reason: 'Ингибитор 5α-редуктазы, снижение DHT в простате',
    evidence: 'Умеренное снижение симптомов ДГПЖ.',
    risks: 'Может влиять на PSA-тест.',
  },

  // ── General ──
  {
    name: 'Витамин D3 + K2', category: 'general', dosage: '5000 МЕ D3 + 100 мкг K2', timing: 'С жирной пищей',
    priority: 'essential', reason: 'Иммунитет, костная ткань, тестостерон, кальциевый обмен',
    evidence: 'Дефицит D3 у 60-80% населения. K2 направляет кальций в кости.',
    risks: 'Токсичность при дозах >10000 МЕ/день.',
  },
  {
    name: 'Цинк (пиколинат)', category: 'general', dosage: '25-50 мг/день', timing: 'С едой',
    priority: 'essential', reason: 'AR-кофактор, иммунитет, сперматогенез',
    evidence: 'Дефицит цинка снижает тестостерон. Необходим для синтеза белка.',
    risks: 'Конкурирует с медью. Добавлять 2 мг меди.',
  },
  {
    name: 'Берберин', category: 'general', dosage: '500 мг 3×/день', timing: 'Перед едой',
    priority: 'recommended', reason: 'Инсулиносенситайзер при ГР/инсулине',
    evidence: 'Сравним с метформином по влиянию на HOMA-IR и HbA1c.',
    risks: 'Желудочно-кишечные побочки.',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════════════════════

export function optimizeStack(input: StackInput): StackOutput {
  const essential: SupplementRec[] = [];
  const recommended: SupplementRec[] = [];
  const optional: SupplementRec[] = [];

  const add = (name: string) => {
    const sup = SUPPLEMENT_DB.find(s => s.name === name);
    if (!sup) return;
    if (sup.priority === 'essential') essential.push(sup);
    else if (sup.priority === 'recommended') recommended.push(sup);
    else optional.push(sup);
  };

  // Always essential
  add('Витамин D3 + K2');
  add('Цинк (пиколинат)');
  add('Магний (бисглицинат)');

  // Liver protection
  if (input.hasOrals || input.riskLevels.hepatic === 'high') {
    add('TUDCA');
    add('NAC');
    add('Расторопша (Силимарин)');
  }

  // Kidney
  if (input.riskLevels.renal === 'high' || input.hasTren) {
    add('Астрагал');
  }
  if (input.riskLevels.renal === 'high') {
    add('Пикногенол');
  }

  // Heart/BP
  if (input.riskLevels.cardiac === 'high' || input.riskLevels.bp === 'high') {
    add('Телмисартан');
    add('Коэнзим Q10');
  }

  // Lipids
  if (input.riskLevels.lipids === 'high' || input.hasOrals) {
    add('Омега-3 (EPA/DHA)');
    add('Цитрусовый бергамот');
  }
  if (input.riskLevels.lipids === 'high') {
    add('Красный дрожжевой рис');
  }

  // Blood
  if (input.riskLevels.blood === 'high') {
    add('Аспирин (низкодозовый)');
    add('Грейпфрутовый экстракт (Нарингенин)');
  }

  // CNS / Sleep
  if (input.riskLevels.cns === 'high' || input.hasTren) {
    add('Глицин');
    add('Мелатонин');
    add('L-теанин');
  }

  // Joints
  if (input.riskLevels.joints === 'high') {
    add('Глюкозамин + Хондроитин');
    add('Коллаген II типа');
  }

  // Prostate
  if (input.riskLevels.prostate === 'high') {
    add('Сереноа (Saw Palmetto)');
  }

  // GH/Insulin specific
  if (input.hasGH || input.hasInsulin) {
    add('Берберин');
  }

  // Summary
  const summary = essential.length >= 6
    ? `${essential.length} обязательных добавок для текущего курса. Приоритет: печень, сердце, липиды.`
    : `${essential.length} обязательных, ${recommended.length} рекомендованных. Базовый стек защиты.`;

  return {
    essential,
    recommended,
    optional,
    totalMonthlyCost: '~5,000-15,000 ₽/мес',
    summary,
  };
}
