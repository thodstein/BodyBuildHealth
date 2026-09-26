/**
 * support-limits.ts — ЕДИНЫЙ РЕЕСТР ПРЕДЕЛОВ ПРИЁМА НУТРИЕНТОВ (`NUTRIENT_LIMITS_V2`).
 *
 * Зачем файл (закрывает E0.1/E0.2/E0.3/E0.4 плана `docs/CALCULATOR-HUBS-PROFESSIONAL-AUDIT-PLAN.md`):
 * До 26 сен 2026 в проекте было **три расходящиеся таблицы пределов**:
 *   1. `support-plan/types.ts` → `NUTRIENT_UL`      (движок, кламп в applyTitration)
 *   2. `UnifiedSynergyCalculator.tsx` → `UL_DB`     (UI хаба, ключи UPPERCASE)
 *   3. `SupportBioavailabilityData.tsx` → THERAPEUTIC_WINDOWS[].ul
 * Ключи отличались регистром (`VITAMIN_D` vs `vitamin_d3`), поэтому кросс-табличный
 * lookup молча промахивался, а сверка правок требовала ≥3 правок.
 *
 * ГЛАВНОЕ: регуляторы **пересмотрели** значения, и проект закрепил старые:
 *   • EFSA 2023 — UL витамина B6 **12 мг/сут** (в проекте было 100 = IOM) → в 8 раз мягче
 *   • EFSA 2023 — UL селена **255 мкг/сут** (в проекте было 400 = IOM) → снижен
 *   • EFSA 2024 — для **железа UL не установлен вовсе**; 40 мг — это «safe level of
 *     intake», производная от чёрного стула = НЕАБСОРБИРОВАННОГО железа в кишечнике
 *     («not adverse per se»). Рендерить 40 мг как «превышение нормы» — ложь.
 *   • EFSA 2024 — **UL витамина E не применяется** к принимающим антикоагулянты/антиагреганты
 *     (аспирин), к вторичной профилактике ССС и к мальабсорбции витамина K.
 *   • EFSA 2023 — критический эффект витамина D — **персистирующая гиперкальциурия**,
 *     а не гиперкальцемия (ранний признак).
 *   • EFSA 2024 — для **β-каротина UL не установлен**; курецам добавки с β-каротеном
 *     следует избегать; EFSA НЕ смогла исключить потенцирование токсичности преформированного A.
 *   • EFSA 2026 — для **добавкового DHA UL не установлен**; safe level 1 г/сут
 *     (только DHA-доминантные источники, EPA/DHA < 0.3, любая химическая форма).
 *
 * Политика применения: применяется **более строгое** из доступных значений
 * (для harm-reduction-аудитории), альтернативное значение другого регулятора
 * показывается рядом с явной пометкой о расхождении, а не заменяет его молча.
 */

// ═══════════════════════════════════════════════════════════════
// 1. ТИПЫ
// ═══════════════════════════════════════════════════════════════

/** Тип предела. Разные типы требуют РАЗНОЙ вёрстки в UI — это не украшение. */
export type LimitKind =
  /** Верхний допустимый уровень потребления: превышение = риск. Единственный тип, где «красный» = превышение. */
  | 'UL'
  /** «Безопасный уровень потребления»: уровень, выше которого НЕ НАБЛЮДАЛОСЬ adverse effects. НЕ идентифицирует начало риска. */
  | 'SafeLevel'
  /** Клинический ориентир из практики, не регуляторный предел. */
  | 'ClinicalGuidance'
  /** Регулятор явно заявил, что предел установить НЕЛЬЗЯ. Это находка, а не отсутствие данных. */
  | 'NotEstablished';

export type LimitJurisdiction = 'EFSA' | 'IOM' | 'Clinical';

export interface NutrientLimit {
  /** Канонический ключ нутриента (см. NUTRIENT_CANON) */
  nutrient: string;
  /** Значение для ПРИМЕНЕНИЯ (в `unit` за сутки) */
  value: number;
  unit: 'mg' | 'mcg' | 'iu';
  kind: LimitKind;
  jurisdiction: LimitJurisdiction;
  year: number;
  /** Критический эффект, выбранный регулятором как основание предела. */
  criticalEffect: string;
  /** Альтернативное значение другого регулятора — показывается рядом, НЕ применяется. */
  altValue?: number;
  altJurisdiction?: LimitJurisdiction;
  altYear?: number;
  altNote?: string;
  /**
   * Условия, при которых предел НЕ применяется (EFSA 2024, витамин E).
   * При выполнении — UI обязан показать исключение, а не молча пропустить проверку.
   */
  excludes?: Array<{ id: string; label: string }>;
  /** Суммировать ли по всему стеку. EFSA 2023 прямо называет стекеров группой риска. */
  stackSumming: boolean;
  /** Значение верифицировано по первоисточнику в раунде 26 сен 2026. false = честная плашка «не верифицировано». */
  verified: boolean;
  /** PMID первоисточника */
  source?: string;
  note?: string;
}

// ═══════════════════════════════════════════════════════════════
// 2. КАНОНИЧЕСКИЕ КЛЮЧИ + РЕЗОЛВ (закрывает E0.3 — баг «bcaa → кальций»)
// ═══════════════════════════════════════════════════════════════

/**
 * Резолв канонического нутриента по id/имени вещества.
 *
 * ЗАКРЫВАЕТ ДЕФЕКТ `doseWindowFor` (`support-hub-evidence.engine.ts:330`):
 *   if (key.includes(kl) || kl.includes(key)) return true;   // ← bidirection substring
 * при 2–3-буквенных therapeutic-ключах (`ca`, `mg`, `zn`, `fe`, `se`, `cr`)
 * это давало ложные срабатывания: `bcaa` → `'bcaa'.includes('ca')` → окно КАЛЬЦИЯ
 * (min 500 / opt 800 / max 1200 / UL 2500 мг). Тот же класс для любого id с короткой
 * подстрокой. Ни одного теста не упоминало `bcaa`.
 *
 * ЗДЕСЬ: только точное совпадение, явный алиас и **границы слова** (regex с `\b` для
 * кириллицы, либо token-split для латиницы). Никакого `includes` по сырой подстроке.
 */
export const NUTRIENT_CANON: Record<string, string> = {
  // ── канонические ──
  zinc: 'zinc', magnesium: 'magnesium', calcium: 'calcium', iron: 'iron',
  selenium: 'selenium', iodine: 'iodine', copper: 'copper', manganese: 'manganese',
  potassium: 'potassium', boron: 'boron', chromium: 'chromium',
  molybdenum: 'molybdenum',
  // ── витамины ──
  vitamin_b6: 'vitamin_b6', vitamin_b12: 'vitamin_b12', vitamin_c: 'vitamin_c',
  vitamin_a: 'vitamin_a', vitamin_d: 'vitamin_d', vitamin_e: 'vitamin_e',
  vitamin_k: 'vitamin_k', folate: 'folate', choline: 'choline', niacin: 'niacin',
  beta_carotene: 'beta_carotene',
  // ── прочее ──
  nac: 'nac', alpha_lipoic: 'alpha_lipoic', coq10: 'coq10', betaine: 'betaine',
  glycine: 'glycine', taurine: 'taurine', inositol: 'inositol', curcumin: 'curcumin',
  dha: 'dha', creatine: 'creatine',
};

/** Явные алиасы id → канонический нутриент. Только целые токены, никаких подстрок. */
const NUTRIENT_ALIAS: Record<string, string> = {
  // витамин D: проект исторически называл канон `vitamin_d3`
  vitamin_d3: 'vitamin_d', cholecalciferol: 'vitamin_d', d3: 'vitamin_d',
  ergocalciferol: 'vitamin_d', d2: 'vitamin_d',
  // витамин K
  vitamin_k2: 'vitamin_k', k2: 'vitamin_k', mk7: 'vitamin_k', mk4: 'vitamin_k',
  // B6 / фолат / B12
  pyridoxine: 'vitamin_b6', pyridoxal: 'vitamin_b6', pyridoxamine: 'vitamin_b6',
  vitamin_b: 'vitamin_b6', b6: 'vitamin_b6',
  folic_acid: 'folate', methylfolate: 'folate', '5-mthf': 'folate', b9: 'folate',
  cyanocobalamin: 'vitamin_b12', hydroxocobalamin: 'vitamin_b12', cobalamin: 'vitamin_b12',
  // `b12` — реальный id в THERAPEUTIC_WINDOWS/каталоге, обязан резолвиться
  b12: 'vitamin_b12',
  // A / E / C
  retinol: 'vitamin_a', preformed_vitamin_a: 'vitamin_a',
  tocopherol: 'vitamin_e', ascorbic_acid: 'vitamin_c',
  beta_caroten: 'beta_carotene',
  // минералы
  zn: 'zinc', mg: 'magnesium', ca: 'calcium', fe: 'iron', se: 'selenium',
  i: 'iodine', cu: 'copper', mn: 'manganese', k: 'potassium', bo: 'boron', cr: 'chromium',
  // прочее
  nac: 'nac', acetylcysteine: 'nac', ala: 'alpha_lipoic',
  'alpha-lipoic': 'alpha_lipoic', lipoic: 'alpha_lipoic', ubiquinone: 'coq10',
  curcumin: 'curcumin', turmeric: 'curcumin',
  // креатин (формы моногидрата/хлорида) — добавлен 26 сен 2026: без него форма
  // `creatine_monohydrate` не резолвилась, и `doseWindowFor` терял окно из DOSE_RANGES.
  creatine_monohydrate: 'creatine', creatine_hcl: 'creatine', 'creatine-hcl': 'creatine',
};

/** Русские синонимы (для русских названий каталога). Проверяются как СЛОВА. */
const NUTRIENT_RU: Array<[RegExp, string]> = [
  // ⚠️ 26 сен 2026: `\b` и `\w` в JS — это ASCII-классы ([A-Za-z0-9_]). Кириллица в
  // них НЕ входит, поэтому `\bцинк\w*` НИКОГДА не срабатывало: между двумя
  // кириллическими буквами границы слова не существует, и в начале строки тоже
  // (начало строки + не-\w = нет перехода). Проверено в Node: `/\bмагни\w*/i.test('магния')`
  // → false. То есть все русские названия молча НЕ резолвились (тест поймал это).
  // Ниже — явные классы границ: латиница + кириллица + ё + цифры.
  [/(^|[^a-zа-яё0-9])цинк[^a-zа-яё0-9]*/i, 'zinc'],
  [/(^|[^a-zа-яё0-9])магни[^a-zа-яё0-9]*/i, 'magnesium'],
  [/(^|[^a-zа-яё0-9])кальци[^a-zа-яё0-9]*/i, 'calcium'],
  [/(^|[^a-zа-яё0-9])желез[оа][^a-zа-яё0-9]*/i, 'iron'],
  [/(^|[^a-zа-яё0-9])селен[^a-zа-яё0-9]*/i, 'selenium'],
  [/(^|[^a-zа-яё0-9])йод[^a-zа-яё0-9]*/i, 'iodine'],
  [/(^|[^a-zа-яё0-9])мед[ьи][^a-zа-яё0-9]*/i, 'copper'],
  [/(^|[^a-zа-яё0-9])кали[^a-zа-яё0-9]*/i, 'potassium'],
  [/(^|[^a-zа-яё0-9])марганец[^a-zа-яё0-9]*/i, 'manganese'],
  [/(^|[^a-zа-яё0-9])бор[^a-zа-яё0-9]/i, 'boron'],
  [/(^|[^a-zа-яё0-9])хром[^a-zа-яё0-9]*/i, 'chromium'],
  [/(^|[^a-zа-яё0-9])витамин\s*д\s*3?[^a-zа-яё0-9]/i, 'vitamin_d'],
  [/(^|[^a-zа-яё0-9])витамин\s*b\s*6[^a-zа-яё0-9]/i, 'vitamin_b6'],
  [/(^|[^a-zа-яё0-9])витамин\s*b\s*12[^a-zа-яё0-9]/i, 'vitamin_b12'],
  [/(^|[^a-zа-яё0-9])витамин\s*с[^a-zа-яё0-9]/i, 'vitamin_c'],
  [/(^|[^a-zа-яё0-9])витамин\s*а[^a-zа-яё0-9]/i, 'vitamin_a'],
  [/(^|[^a-zа-яё0-9])витамин\s*e[^a-zа-яё0-9]/i, 'vitamin_e'],
  [/(^|[^a-zа-яё0-9])витамин\s*k\s*2?[^a-zа-яё0-9]/i, 'vitamin_k'],
  [/(^|[^a-zа-яё0-9])фолат[^a-zа-яё0-9]*/i, 'folate'],
  [/(^|[^a-zа-яё0-9])фолиев[^a-zа-яё0-9]*/i, 'folate'],
  [/(^|[^a-zа-яё0-9])ретинол[^a-zа-яё0-9]*/i, 'vitamin_a'],
  [/(^|[^a-zа-яё0-9])токоферол[^a-zа-яё0-9]*/i, 'vitamin_e'],
  [/(^|[^a-zа-яё0-9])бета.?каротин[^a-zа-яё0-9]*/i, 'beta_carotene'],
  [/(^|[^a-zа-яё0-9])холин[^a-zа-яё0-9]*/i, 'choline'],
  [/(^|[^a-zа-яё0-9])ниацин[^a-zа-яё0-9]*/i, 'niacin'],
  [/(^|[^a-zа-яё0-9])гиацин[^a-zа-яё0-9]*/i, 'niacin'],
  [/(^|[^a-zа-яё0-9])креатин[^a-zа-яё0-9]*/i, 'creatine'],
  [/(^|[^a-zа-яё0-9])инозитол[^a-zа-яё0-9]*/i, 'inositol'],
];

/** Слова, которые НЕ должны резолвиться в нутриент (защита от ложных срабатываний). */
const NUTRIENT_DENY: RegExp[] = [
  // Страховка. Основная защита от `bcaa`→кальций — граница слова в resolveNutrient
  // (проверено мутацией: возврат подстроки роняет тест, снос этой строки — нет,
  //  т.е. правило избыточно по отношению к границе, но оставлено как второй слой).
  /^bcaa$/i,        // BCAA — аминокислоты, не кальций (регрессия E0.3)
  /^eaa$/i,         // EAA — аминокислоты
  // D-глюкарат кальция — отдельная форма с иным содержанием кальция; суммировать её
  // как чистый кальций нельзя. Раньше правило было `ca[a-z]*acid`, но `_` не входил
  // в `[a-z]`, поэтому `calcium_d_glucarate` проскакивал (поймано тестом).
  /glucarate/i,
];

/**
 * Все известные ключи (канон + алиасы), отсортированные ПО УБЫВАНИЮ длины.
 * Нужно, чтобы при id вроде `vitamin_b12` выиграл длинный `vitamin_b12`, а не `b12`,
 * и чтобы `calcium_glycinate` выиграл `calcium`, а не `ca`.
 */
const KNOWN_KEYS_LONGEST_FIRST: Array<[string, string]> = [
  ...Object.entries(NUTRIENT_CANON),
  ...Object.entries(NUTRIENT_ALIAS),
].sort((a, b) => b[0].length - a[0].length);

/**
 * Резолвит канонический нутриент по произвольному id/имени/форме.
 * @returns канонический ключ или `null`, если нутриент не идентифицирован (а не «угадан»).
 *
 * 26 сен 2026: переписан после прогонов. БЫЛО: regex строился из САМОГО id и затем
 * искался в картах → `magnesium_glycinate` строил `(^|[^a-z0-9])magnesium_glycinate…`
 * (матчит только сам id) и искал в картах ключ `magnesium_glycinate` → undefined.
 * То есть граница слова проверялась, но НИЧЕГО не давала: форма нутриента никогда не
 * резолвилась в нутриент (тесты `magnesium_glycinate`/`creatine_monohydrate` падали).
 *
 * СТАЛО: граница проверяется для каждого ИЗВЕСТНОГО ключа против id, длинные первыми
 * (`vitamin_b12` до `b12`, `calcium` до `ca`). Никаких `includes` по произвольному id:
 *   `magnesium_glycinate` → ключ `magnesium`, `_` = граница → magnesium  ✔
 *   `bcaa`                → ключ `ca`: перед `ca` стоит `b` (буква) → НЕ матчится ✔
 */
export function resolveNutrient(raw?: string | null): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  for (const d of NUTRIENT_DENY) if (d.test(s)) return null;

  const norm = (x: string) => x.toLowerCase().replace(/[\s\-./]+/g, '_');
  const k = norm(s);

  // 1) точный канон / точный алиас
  if (NUTRIENT_CANON[k]) return NUTRIENT_CANON[k];
  if (NUTRIENT_ALIAS[k]) return NUTRIENT_ALIAS[k];

  // 2) известный ключ как СЛОВО внутри id (форма нутриента).
  //    `_`, `-`, `.`, пробел и любой не-алфавитный символ = граница.
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const [key, canon] of KNOWN_KEYS_LONGEST_FIRST) {
    const re = new RegExp(`(^|[^a-z0-9])${esc(key)}([^a-z0-9]|$)`, 'i');
    if (re.test(s)) return canon;
  }

  for (const [re, canon] of NUTRIENT_RU) if (re.test(s)) return canon;
  return null;
}

// ═══════════════════════════════════════════════════════════════
// 3. РЕЕСТР ПРЕДЕЛОВ
// ═══════════════════════════════════════════════════════════════

export const NUTRIENT_LIMITS_V2: Record<string, NutrientLimit> = {
  // ── EFSA 2023: пересмотрены, в проекте стояли значения IOM ──
  vitamin_b6: {
    nutrient: 'vitamin_b6', value: 12, unit: 'mg', kind: 'UL',
    jurisdiction: 'EFSA', year: 2023, criticalEffect: 'периферическая нейропатия',
    altValue: 100, altJurisdiction: 'IOM', altYear: 1998,
    altNote: 'EFSA в 8 раз строже. EFSA прямо называет группу риска: «regular users of food supplements containing high doses of vitamin B6».',
    stackSumming: true, verified: true, source: 'PMID 37207271',
    note: 'Суммировать по ВСЕМ продуктам стека: мультивитамины, отдельные добавки, пиридоксин в магниевых формах, энергетики. LOAEL у человека установить НЕ удалось — предел опирается на case-control RP и экстраполяцию с вида.',
  },
  selenium: {
    nutrient: 'selenium', value: 255, unit: 'mcg', kind: 'UL',
    jurisdiction: 'EFSA', year: 2023, criticalEffect: 'алопеция (ранний наблюдаемый признак)',
    altValue: 400, altJurisdiction: 'IOM', altYear: 2000,
    altNote: 'EFSA снизил: LOAEL 330 мкг из РКИ SELECT, UF 1.3. Стека на 400+ мкг превышает НОВЫЙ EU UL, оставаясь «легальной» по старому/US числу.',
    stackSumming: true, verified: true, source: 'PMID 36698500',
    note: 'Считать из бразильских орехов и любых антиоксидантных blends. «Выпадение волос/ногти» — именованный стоп-триггер (выбранный регулятором эффект).',
  },
  vitamin_d: {
    nutrient: 'vitamin_d', value: 4000, unit: 'iu', kind: 'UL',
    jurisdiction: 'EFSA', year: 2023, criticalEffect: 'персистирующая гиперкальциурия',
    altValue: 100, altJurisdiction: 'EFSA', altYear: 2023,
    altNote: 'EFSA задаёт 100 мкг VDE/сут = 4000 МЕ. VDE = сумма D2 + D3 + кальцидиола. Кальцидиол (25-OH-D3) имеет коэффициент пересчёта 2.5.',
    stackSumming: true, verified: true, source: 'PMID 37560437',
    note: 'Мониторинг: КАЛЬЦИЙ МОЧИ, а не только сырая кальция — EFSA прямо называет гиперкальциурию более ранним признаком избытка. Для пользователя на AAS повышенная кальциурия мочевины правдоподобна (подавленный эндогенный тестостерон → сниженный костный оборот).',
  },
  vitamin_a: {
    nutrient: 'vitamin_a', value: 3000, unit: 'mcg', kind: 'UL',
    jurisdiction: 'EFSA', year: 2024, criticalEffect: 'тератогенность',
    stackSumming: true, verified: true, source: 'PMID 38846679',
    note: 'Только преформированный ретинол, в мкг RE. Планирующим беременность/беременным — избегать продуктов печени (UL превышается только при печени чаще 1 раза в месяц).',
  },
  beta_carotene: {
    nutrient: 'beta_carotene', value: 0, unit: 'mcg', kind: 'NotEstablished',
    jurisdiction: 'EFSA', year: 2024, criticalEffect: 'рак лёгкого',
    stackSumming: true, verified: true, source: 'PMID 38846679',
    note: '⚠️ UL НЕ УСТАНОВЛЕН — это находка регулятора, а не отсутствие данных. EFSA: курецм следует избегать добавок с β-каротеном; данные не позволили оценить, УСИЛИВАЕТ ли β-каротин токсичность преформированного A. ⇒ НЕЛЬЗЯ предлагать «β-каротин вместо витамина A» как обход UL. Неофициальный порог «>20 мг/сут» в этом заключении ОТСУТСТВУЕТ.',
  },
  vitamin_e: {
    nutrient: 'vitamin_e', value: 300, unit: 'mg', kind: 'UL',
    jurisdiction: 'EFSA', year: 2024, criticalEffect: 'нарушение свёртываемости / кровотечение',
    excludes: [
      { id: 'anticoagulant', label: 'приём антикоагулянтов' },
      { id: 'antiplatelet', label: 'приём антиагрегантов (аспирин и пр.)' },
      { id: 'cvd_secondary', label: 'вторичная профилактика ССС' },
      { id: 'vk_malabsorption', label: 'синдромы мальабсорбции витамина K' },
    ],
    stackSumming: true, verified: true, source: 'PMID 39099617',
    note: 'Применяется ко всем стереоизомерам α-токоферола и ко всем пищевым источникам. ⚠️ Регулятор САМ исключает перечисленные группы — единая проверка «300 мг» для них неверна. Для аудитории проекта (ААС + статины/аспирин) это не крайний случай.',
  },
  folate: {
    nutrient: 'folate', value: 1000, unit: 'mcg', kind: 'UL',
    jurisdiction: 'EFSA', year: 2023, criticalEffect: 'прогрессия неврологических симптомов при дефиците B12',
    stackSumming: true, verified: true, source: 'PMID 37965303',
    note: 'Суммировать фолиевую кислоту + соли 5-метил-ТГФ. «Метилированная форма не ограничена» — ложное утверждение: она ВНУТРИ UL. Проверить B12 при высокой дозе фолата.',
  },
  iron: {
    nutrient: 'iron', value: 40, unit: 'mg', kind: 'SafeLevel',
    jurisdiction: 'EFSA', year: 2024, criticalEffect: 'чёрный стул = неабсорбированное Fe в кишечнике (не adverse per se)',
    altValue: 45, altJurisdiction: 'IOM', altYear: 2001,
    altNote: '⚠️ EFSA 2024 НЕ смогла установить UL для железа. 40 мг — «safe level of intake»: уровень, выше которого НЕ НАБЛЮДАЛОСЬ adverse effects; он НЕ идентифицирует начало риска. EFSA прямо: применение safe level ограничено именно поэтому.',
    stackSumming: true, verified: true, source: 'PMID 38868106',
    note: 'Для пользователя на AAS перегрузка — это вопрос HCT/ферритина/трансферрина, НЕ дозы. Никогда не рендерить «превышение нормы железа» как токсичность: маршрутизировать в лабораторный контур.',
  },
  dha: {
    nutrient: 'dha', value: 1000, unit: 'mg', kind: 'SafeLevel',
    jurisdiction: 'EFSA', year: 2026, criticalEffect: 'спонтанные кровотечения (рассмотрено, референсная точка не выводима)',
    stackSumming: true, verified: true, source: 'PMID 41542352',
    note: '⚠️ UL для добавкового DHA НЕ установлен. Safe level 1 г/сут — ТОЛЬКО для DHA-доминантных источников (EPA/DHA < 0.3), в любой химической форме. НЕ применять к смесям EPA+DHA: «3 г омега-3» как предел этим заключением не поддержан.',
  },
  creatine: {
    nutrient: 'creatine', value: 0, unit: 'mg', kind: 'NotEstablished',
    jurisdiction: 'EFSA', year: 2015, criticalEffect: 'оценка безопасности 3 г/сут у здоровых взрослых',
    stackSumming: false, verified: false,
    note: '[НЕ ПЕРЕПРОВЕРЕНО 26 сен 2026] EFSA не устанавливала UL для креатина (оценка '
      + 'безопасности 3 г/сут), поэтому value = 0 и kind = NotEstablished: система НЕ рисует '
      + '«превышение предела». Риск-группы (ХБП) в записи НЕ отражены — это осознанная '
      + 'граница, а не утверждение о безопасности для всех. Запись добавлена только чтобы '
      + 'формы (`creatine_monohydrate`) резолвились в нутриент.',
  },

  // ── значения, НЕ верифицированные в раунде 26 сен 2026 (серия EFSA 2023–2026 активно
  //    пересматривалась; легаси-числа вероятно устарели) — применяются с честной пометкой ──
  zinc: {
    nutrient: 'zinc', value: 40, unit: 'mg', kind: 'UL', jurisdiction: 'IOM', year: 2001,
    criticalEffect: 'подавление иммунитета / нарушение гематопоэза при длительном избытке',
    stackSumming: true, verified: false,
    note: '[НЕ ВЕРИФИЦИРОВАНО] Актуальный EFSA/IOM UL не выверен в раунде 26 сен 2026.',
  },
  magnesium: {
    nutrient: 'magnesium', value: 350, unit: 'mg', kind: 'UL', jurisdiction: 'IOM', year: 1997,
    criticalEffect: 'диарея (добавки, не пища)',
    stackSumming: true, verified: false,
    note: '[НЕ ВЕРИФИЦИРОВАНО] Серия EFSA 2023–2026 пересмотрела 10 нутриентов; магний, вероятно, тоже. Значение 350 мг относится ТОЛЬКО к добавкам.',
  },
  calcium: {
    nutrient: 'calcium', value: 2500, unit: 'mg', kind: 'UL', jurisdiction: 'IOM', year: 2011,
    criticalEffect: 'гиперкальциурия, камни в почках',
    stackSumming: true, verified: false,
    note: '[НЕ ВЕРИФИЦИРОВАНО] Актуальный UL не выверен в раунде 26 сен 2026.',
  },
  potassium: {
    nutrient: 'potassium', value: 3700, unit: 'mg', kind: 'ClinicalGuidance', jurisdiction: 'Clinical', year: 2024,
    criticalEffect: 'гиперкалиемия (критично при ACEi/ARB + калийсберегающих диуретиках)',
    stackSumming: true, verified: false,
    note: '[НЕ ВЕРИФИЦИРОВАНО] Применяется только к добавкам. ⚠️ Для пациента на ACEi/ARB это вопрос лаборатории, а не дозы.',
  },
  vitamin_c: {
    nutrient: 'vitamin_c', value: 2000, unit: 'mg', kind: 'UL', jurisdiction: 'IOM', year: 2000,
    criticalEffect: 'железо-медные оксидазы, диарея, оксалатные камни',
    stackSumming: true, verified: false, note: '[НЕ ВЕРИФИЦИРОВАНО]',
  },
  iodine: {
    nutrient: 'iodine', value: 1100, unit: 'mcg', kind: 'UL', jurisdiction: 'IOM', year: 2001,
    criticalEffect: 'нарушение функции щитовидной железы',
    stackSumming: true, verified: false, note: '[НЕ ВЕРИФИЦИРОВАНО]',
  },
  copper: {
    nutrient: 'copper', value: 10, unit: 'mg', kind: 'UL', jurisdiction: 'IOM', year: 2001,
    criticalEffect: 'печёночные повреждения',
    stackSumming: true, verified: false, note: '[НЕ ВЕРИФИЦИРОВАНО]',
  },
  manganese: {
    nutrient: 'manganese', value: 11, unit: 'mg', kind: 'UL', jurisdiction: 'IOM', year: 2001,
    criticalEffect: 'нейротоксичность при накоплении',
    stackSumming: false, verified: false, note: '[НЕ ВЕРИФИЦИРОВОАНО] EFSA 2023 (PMID 38075631) — значение не извлечено в раунде.',
  },
  boron: {
    nutrient: 'boron', value: 20, unit: 'mg', kind: 'UL', jurisdiction: 'IOM', year: 2001,
    criticalEffect: 'тестикулярная токсичность', stackSumming: false, verified: false,
    note: '[НЕ ПЕРЕПРОВЕРЕНО 26 сен 2026] Значение 20 мг — легаси IOM. В плане упоминалось '
      + '«EFSA 12 мг», но первоисточник в этом раунде открыть НЕ удалось (websearch 403), '
      + 'поэтому число НЕ заменялось на непроверенное: остаётся легаси + verified:false. '
      + 'Обязательное действие следующего раунда: открыть EFSA 2018 (E 338) и поставить '
      + 'реальное значение с verified:true.',
  },
  molybdenum: {
    nutrient: 'molybdenum', value: 2000, unit: 'mcg', kind: 'UL', jurisdiction: 'IOM', year: 2001,
    criticalEffect: 'медный дефицит (вторичный) при длительном превышении',
    stackSumming: false, verified: false,
    note: '[НЕ ПЕРЕПРОВЕРЕНО 26 сен 2026] Легаси IOM. Добавлено, чтобы каждый ключ '
      + 'NUTRIENT_CANON имел запись предела (инвариант реестра, ловится тестом).',
  },
  chromium: {
    nutrient: 'chromium', value: 1000, unit: 'mcg', kind: 'ClinicalGuidance', jurisdiction: 'Clinical', year: 2024,
    criticalEffect: 'почечная/печёночная недостаточность при длительном избытке',
    stackSumming: false, verified: false, note: '[НЕ ВЕРИФИЦИРОВАНО] Регуляторного UL нет — клинический ориентир.',
  },
  vitamin_b12: {
    nutrient: 'vitamin_b12', value: 2000, unit: 'mcg', kind: 'ClinicalGuidance', jurisdiction: 'Clinical', year: 2024,
    criticalEffect: 'установленного UL нет', stackSumming: false, verified: false,
    note: 'Регуляторного UL не существует; 2000 мкг — ориентир из практики.',
  },
  vitamin_k: {
    nutrient: 'vitamin_k', value: 1000, unit: 'mcg', kind: 'ClinicalGuidance', jurisdiction: 'Clinical', year: 2024,
    criticalEffect: 'установленного UL нет', stackSumming: false, verified: false,
    note: 'Регуляторного UL не существует. ВАЖНО: взаимодействие с варфарином — клинически значимое, но числовая величина эффекта [НЕ ВЕРИФИЦИРОВАНА] в этом раунде.',
  },
  nac: {
    nutrient: 'nac', value: 2400, unit: 'mg', kind: 'ClinicalGuidance', jurisdiction: 'Clinical', year: 2024,
    criticalEffect: 'тошнота/головная боль', stackSumming: true, verified: false, note: 'Клинический ориентир, не регуляторный предел.',
  },
  alpha_lipoic: {
    nutrient: 'alpha_lipoic', value: 1800, unit: 'mg', kind: 'ClinicalGuidance', jurisdiction: 'Clinical', year: 2024,
    criticalEffect: 'GI-симптомы', stackSumming: true, verified: false, note: 'Клинический ориентир.',
  },
  coq10: {
    nutrient: 'coq10', value: 3000, unit: 'mg', kind: 'ClinicalGuidance', jurisdiction: 'Clinical', year: 2024,
    criticalEffect: 'GI-симптомы', stackSumming: true, verified: false, note: 'Клинический ориентир.',
  },
  curcumin: {
    nutrient: 'curcumin', value: 8000, unit: 'mg', kind: 'ClinicalGuidance', jurisdiction: 'Clinical', year: 2024,
    criticalEffect: 'гепатотоксичность при длительном высоком приёме',
    stackSumming: true, verified: false,
    note: '⚠️ НЕ путать с зелёным чаем/EGCG: гепатотоксичность EGCG — идиосинкратическая, зависит от генотипа (COMT/UGT1A1) и HLA-B*35:01, т.е. НЕ предсказуема дозой (PMID 36178169, 38055372). Порог «до 800 мг EGCG безопасно» — ложная уверенность; вводить классовую предосторожность, а не дозовую линию.',
  },
  betaine: {
    nutrient: 'betaine', value: 4000, unit: 'mg', kind: 'ClinicalGuidance', jurisdiction: 'Clinical', year: 2024,
    criticalEffect: 'не установлен', stackSumming: false, verified: false, note: 'Клинический ориентир.',
  },
  glycine: {
    nutrient: 'glycine', value: 60000, unit: 'mg', kind: 'ClinicalGuidance', jurisdiction: 'Clinical', year: 2024,
    criticalEffect: 'не установлен', stackSumming: false, verified: false, note: 'Клинический ориентир (~1 г/кг).',
  },
  taurine: {
    nutrient: 'taurine', value: 10000, unit: 'mg', kind: 'ClinicalGuidance', jurisdiction: 'Clinical', year: 2024,
    criticalEffect: 'не установлен', stackSumming: false, verified: false, note: 'Клинический ориентир.',
  },
  inositol: {
    nutrient: 'inositol', value: 18000, unit: 'mg', kind: 'ClinicalGuidance', jurisdiction: 'Clinical', year: 2024,
    criticalEffect: 'не установлен', stackSumming: false, verified: false, note: 'Клинический ориентир.',
  },
  niacin: {
    nutrient: 'niacin', value: 35, unit: 'mg', kind: 'ClinicalGuidance', jurisdiction: 'Clinical', year: 2024,
    criticalEffect: 'приливы, гипергликемия, гепатотоксичность при граммовых дозах',
    stackSumming: true, verified: false,
    note: '[НЕ ВЕРИФИЦИРОВАНО] Пороговые величины при 1–2 г (приливы/гипергликемия) в раунде 26 сен 2026 не выверены. Суммировать: ниацин из мультивитаминов + отдельных добавок.',
  },
  choline: {
    nutrient: 'choline', value: 3500, unit: 'mg', kind: 'ClinicalGuidance', jurisdiction: 'Clinical', year: 2024,
    criticalEffect: 'рыбный запах/потливость, гипотония при больших дозах',
    stackSumming: true, verified: false, note: '[НЕ ВЕРИФИЦИРОВАНО]',
  },
};

/** Обратная совместимость: плоские числа для потребителей, которым нужно только значение. */
export function nutrientLimitValue(nutrientOrId: string): number | null {
  const c = resolveNutrient(nutrientOrId);
  if (!c) return null;
  return NUTRIENT_LIMITS_V2[c]?.value ?? null;
}

// ═══════════════════════════════════════════════════════════════
// 4. ОЦЕНКА ПРЕДЕЛА (разная вёрстка по типу)
// ═══════════════════════════════════════════════════════════════

/** Контекст пользователя — нужен для проверки исключений (EFSA 2024, витамин E). */
export interface LimitContext {
  onAnticoagulant?: boolean;
  onAntiplatelet?: boolean;
  cvdSecondaryPrevention?: boolean;
  vitaminKMalabsorption?: boolean;
}

export interface LimitVerdict {
  nutrient: string;
  /** `null`, если нутриент не идентифицирован — НЕ «ноль» и НЕ «нарушение». */
  total: number | null;
  limit: NutrientLimit | null;
  kind: LimitKind | 'Unknown';
  /** Превышен ли ПРИМЕНЯЕМЫЙ предел. Для SafeLevel/NotEstablished — `false` всегда (см. kind). */
  over: boolean;
  /** `null`, если предел формально есть, но НЕ применяется к этому пользователю. */
  limitNotApplicable: boolean;
  /** Правильная формулировка для UI, с учётом типа. */
  message: string;
  /** true, если значение в реестре не верифицировано первоисточником. */
  unverified: boolean;
  color: 'ok' | 'warn' | 'over' | 'na';
}

/** Проверяет, применим ли предел к пользователю (исключения регулятора). */
export function limitNotApplicable(nutrientOrId: string, ctx?: LimitContext): boolean {
  const c = resolveNutrient(nutrientOrId);
  const lim = c ? NUTRIENT_LIMITS_V2[c] : null;
  if (!lim?.excludes?.length || !ctx) return false;
  const flags: Record<string, boolean | undefined> = {
    anticoagulant: ctx.onAnticoagulant,
    antiplatelet: ctx.onAntiplatelet,
    cvd_secondary: ctx.cvdSecondaryPrevention,
    vk_malabsorption: ctx.vitaminKMalabsorption,
  };
  return lim.excludes.some(e => flags[e.id]);
}

function fmtUnit(n: number, unit: NutrientLimit['unit']): string {
  if (unit === 'iu') return `${n.toLocaleString('ru-RU')} МЕ`;
  return `${n.toLocaleString('ru-RU')} ${unit}`;
}

/**
 * Оценивает суммарный приём по нутриенту против реестра.
 *
 * КЛЮЧЕВОЕ: тип предела меняет СМЫСЛ «нарушения».
 *   UL              → превышение = риск (красный)
 *   SafeLevel       → превышение НЕ означает риск; EFSA прямо: safe level не идентифицирует
 *                     начало риска. Никогда не рендерить красным «превышение нормы».
 *   NotEstablished  → регулятор заявил, что предел не выводим. Это находка, не пробел.
 *   ClinicalGuidance → ориентир из практики, не регуляторный предел.
 */
export function evaluateLimit(
  nutrientOrId: string,
  totalAmount: number,
  ctx?: LimitContext,
): LimitVerdict {
  const c = resolveNutrient(nutrientOrId);
  const lim = c ? NUTRIENT_LIMITS_V2[c] : null;

  if (!lim) {
    return {
      nutrient: c ?? String(nutrientOrId), total: totalAmount, limit: null, kind: 'Unknown',
      over: false, limitNotApplicable: false,
      message: 'Предел для этого нутриента в реестре не задан — оценка не производится.',
      unverified: true, color: 'na',
    };
  }

  const na = limitNotApplicable(lim.nutrient, ctx);
  if (na) {
    const ex = lim.excludes!.find(e => {
      const f: Record<string, boolean | undefined> = {
        anticoagulant: ctx?.onAnticoagulant, antiplatelet: ctx?.onAntiplatelet,
        cvd_secondary: ctx?.cvdSecondaryPrevention, vk_malabsorption: ctx?.vitaminKMalabsorption,
      };
      return f[e.id];
    });
    return {
      nutrient: lim.nutrient, total: totalAmount, limit: lim, kind: lim.kind,
      over: false, limitNotApplicable: true,
      message: `${lim.jurisdiction} ${lim.year}: предел ${fmtUnit(lim.value, lim.unit)} НЕ применяется — ${ex?.label}. `
        + `Критический эффект: ${lim.criticalEffect}. Требуется индивидуальная оценка, не дозовая линия.`,
      unverified: !lim.verified, color: 'na',
    };
  }

  if (lim.kind === 'NotEstablished') {
    return {
      nutrient: lim.nutrient, total: totalAmount, limit: lim, kind: lim.kind,
      over: false, limitNotApplicable: false,
      message: `${lim.jurisdiction} ${lim.year}: предел НЕ УСТАНОВЛЕН. ${lim.note}`,
      unverified: false, color: 'na',
    };
  }

  const over = lim.value > 0 && totalAmount > lim.value;
  const overBy = Math.round((totalAmount - lim.value) * 100) / 100;

  if (lim.kind === 'SafeLevel') {
    return {
      nutrient: lim.nutrient, total: totalAmount, limit: lim, kind: lim.kind,
      over: false, limitNotApplicable: false,
      message: over
        ? `Выше ${lim.jurisdiction} ${lim.year} safe level ${fmtUnit(lim.value, lim.unit)} (на ${overBy} ${lim.unit}), `
          + `но это НЕ порог токсичности: предел для этого нутриента не установлен, а safe level `
          + `не идентифицирует начало риска. ${lim.criticalEffect}.`
        : `В пределах ${lim.jurisdiction} ${lim.year} safe level ${fmtUnit(lim.value, lim.unit)}. `
          + `Предел (UL) не установлен — риск оценивается по лаборатории, не по дозе.`,
      unverified: !lim.verified, color: over ? 'warn' : 'ok',
    };
  }

  if (lim.kind === 'ClinicalGuidance') {
    return {
      nutrient: lim.nutrient, total: totalAmount, limit: lim, kind: lim.kind,
      over: false, limitNotApplicable: false,
      message: `${totalAmount} ${lim.unit} против клинического ориентира ${fmtUnit(lim.value, lim.unit)} — `
        + `это НЕ регуляторный предел.`,
      unverified: !lim.verified, color: totalAmount > lim.value ? 'warn' : 'ok',
    };
  }

  // UL
  const alt = lim.altValue != null
    ? ` (${lim.altJurisdiction} ${lim.altYear}: ${fmtUnit(lim.altValue, lim.unit)}${lim.altNote ? ' — ' + lim.altNote : ''})`
    : '';
  return {
    nutrient: lim.nutrient, total: totalAmount, limit: lim, kind: lim.kind,
    over, limitNotApplicable: false,
    message: over
      ? `⚠️ Превышен ${lim.jurisdiction} ${lim.year} UL ${fmtUnit(lim.value, lim.unit)} на ${overBy} ${lim.unit}. `
        + `Критический эффект: ${lim.criticalEffect}.${alt}`
      : `${totalAmount} ${lim.unit} из ${fmtUnit(lim.value, lim.unit)} (${lim.jurisdiction} ${lim.year}). `
        + `Критический эффект: ${lim.criticalEffect}.${alt}`,
    unverified: !lim.verified, color: over ? 'over' : 'ok',
  };
}

// ═══════════════════════════════════════════════════════════════
// 5. СУММИРОВАНИЕ ПО СТЕКУ (закрывает E0.4 — карточка считала СЧЁТ, а не дозу)
// ═══════════════════════════════════════════════════════════════

export interface StackItem {
  id: string;
  nameRu?: string;
  name?: string;
  /** Разовая доза в мг (или мкг/МЕ — приводит вызывающий). */
  doseMg?: number;
  /** Сколько раз в сутки. */
  timesPerDay?: number;
}

/** Что внёс один продукт в сумму по нутриентам. */
export interface NutrientContribution {
  nutrient: string;
  amountPerDay: number;
  sources: string[];
}

/**
 * Считает РЕАЛЬНУЮ сумму по нутриентам (мг/сут) по стеку.
 *
 * ЗАКРЫВАЕТ ДЕФЕКТ карточки «Суммарная нагрузка» (`UnifiedSynergyCalculator.tsx:504`):
 *   loads[nutrLower].total += 1;   // qualitative marker   ← СЧЁТ продуктов
 *   ... isOverUL: v.total > v.ul    // ← сравнение счёта 1–3 с UL в мг (цинк 40) ⇒ ВСЕГДА false
 * Теперь суммируется `doseMg × timesPerDay` и сравнивается с пределом реестра.
 *
 * Нутриент, не идентифицированный через `resolveNutrient`, в сумму НЕ попадает
 * (лучше «нет данных», чем угаданный нутриент).
 */
export function sumStackByNutrient(items: StackItem[]): NutrientContribution[] {
  const acc = new Map<string, NutrientContribution>();
  for (const it of items) {
    const canon = resolveNutrient(it.id) ?? resolveNutrient(it.nameRu) ?? resolveNutrient(it.name);
    if (!canon) continue;
    const per = Number(it.doseMg ?? 0) * Math.max(1, Number(it.timesPerDay ?? 1));
    if (!Number.isFinite(per) || per <= 0) continue;
    const cur = acc.get(canon) ?? { nutrient: canon, amountPerDay: 0, sources: [] };
    cur.amountPerDay += per;
    const label = it.nameRu || it.name || it.id;
    if (!cur.sources.includes(label)) cur.sources.push(label);
    acc.set(canon, cur);
  }
  return [...acc.values()]
    .map(c => ({ ...c, amountPerDay: Math.round(c.amountPerDay * 100) / 100 }))
    .sort((a, b) => b.amountPerDay - a.amountPerDay);
}

/**
 * Сумма стека + вердикт по каждому нутриенту, у которого есть предел.
 * `over` означает нарушение ТОЛЬКО для типа UL (см. `evaluateLimit`).
 */
export function stackLimitVerdicts(
  items: StackItem[],
  ctx?: LimitContext,
): Array<NutrientContribution & { verdict: LimitVerdict }> {
  return sumStackByNutrient(items)
    .map(c => ({ ...c, verdict: evaluateLimit(c.nutrient, c.amountPerDay, ctx) }))
    .filter(c => c.verdict.kind !== 'Unknown')
    .sort((a, b) => (b.verdict.over === a.verdict.over ? b.amountPerDay - a.amountPerDay : b.verdict.over ? 1 : -1));
}

// ═══════════════════════════════════════════════════════════════
// 6. ЧЕСТНАЯ ИНВЕНТАРИЗАЦИЯ НЕВЕРИФИЦИРОВАННЫХ ЗНАЧЕНИЙ
// ═══════════════════════════════════════════════════════════════

/** Нутриенты, значение которых в раунде 26 сен 2026 не подтверждено первоисточником. */
export function unverifiedLimits(): NutrientLimit[] {
  return Object.values(NUTRIENT_LIMITS_V2).filter(l => !l.verified);
}

/** Нутриенты, для которых регулятор явно заявил, что предел установить нельзя. */
export function notEstablishedLimits(): NutrientLimit[] {
  return Object.values(NUTRIENT_LIMITS_V2).filter(l => l.kind === 'NotEstablished');
}

/** Нутриенты с условиями исключения — обязательны к отображению. */
export function conditionalLimits(): NutrientLimit[] {
  return Object.values(NUTRIENT_LIMITS_V2).filter(l => (l.excludes?.length ?? 0) > 0);
}

/** Сводка по реестру — для диагностики/тестов. */
export function limitsSummary(): {
  total: number; verified: number; unverified: number;
  notEstablished: number; conditional: number; byKind: Record<string, number>;
} {
  const all = Object.values(NUTRIENT_LIMITS_V2);
  const byKind: Record<string, number> = {};
  for (const l of all) byKind[l.kind] = (byKind[l.kind] ?? 0) + 1;
  return {
    total: all.length,
    verified: all.filter(l => l.verified).length,
    unverified: all.filter(l => !l.verified).length,
    notEstablished: all.filter(l => l.kind === 'NotEstablished').length,
    conditional: all.filter(l => (l.excludes?.length ?? 0) > 0).length,
    byKind,
  };
}
