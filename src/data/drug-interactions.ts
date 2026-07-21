// ════════════════════════════════════════════════════════════════════════════
//  DRUG-INTERACTIONS — матрица критичных взаимодействий
//  block = нельзя комбинировать; warn = мониторинг; monitor = лабы
// ════════════════════════════════════════════════════════════════════════════

export interface DrugInteraction {
  a: string;
  b: string;                // второе вещество или класс ( начинается с '@' = класс)
  severity: 'block' | 'warn' | 'monitor';
  reason: string;
  action: string;
  alternatives?: string[];
}

export const DRUG_INTERACTIONS: DrugInteraction[] = [
  // ─── BLOCK (нельзя комбинировать) ───
  { a: 'tadalafil', b: 'nitrates', severity: 'block', reason: 'Фатальная гипотония (NO-каптаки)', action: '⛔ Не комбинировать. Нитраты → STOP tadalafil за 48 ч' },
  { a: 'tadalafil', b: '@alpha_blocker', severity: 'block', reason: 'Ортостатическая гипотензия', action: '⛔ Не комбинировать или разнести по времени на 4+ ч' },
  { a: 'anastrozole', b: 'tamoxifen', severity: 'block', reason: 'AI аннулирует SERM effectiveness (аддитивно ↓ E2 → ↓ SERM)', action: '⛔ Не комбинировать. Выбрать один' },
  { a: 'spironolactone', b: '@raas', severity: 'block', reason: 'Двойная K⁺-сберегающая → гиперкалиемия', action: '⛔ Не комбинировать со спиро. Уже есть telmisartan (ARB = K⁺-сберегающий)' },
  { a: 'insulin', b: '@alcohol', severity: 'block', reason: 'Тяжёлая гипогликемия (торможение глюконеогенеза)', action: '⛔ ZERO алкоголя при инсулине' },
  { a: 'cabergoline', b: '@d2_antagonist', severity: 'block', reason: 'Антагонизм D2-рецепторов (метоклопрамид, фенотиазины)', action: '⛔ Не комбинировать с прокинетиками/противорвотными D2-блокерами' },

  // ─── WARN (мониторинг, осторожно) ───
  { a: 'niacin', b: '@statin', severity: 'warn', reason: '↑ риск рабдомиолиза (редко, но серьезно)', action: '⚠ Мониторинг КФК каждые 4 нед. Бергамот — альтернатива с меньшим риском', alternatives: ['bergamot'] },
  { a: 'niacin', b: '@antidiabetic', severity: 'warn', reason: '↑ glucose (loss glycemic control)', action: '⚠ Контроль глюкозы чаще. Berberine для компенсации' },
  { a: 'berberine', b: '@macrolide', severity: 'warn', reason: 'CYP3A4 ингибирование → ↑ концентрация CYP3A4-субстратов', action: '⚠ Разнести по времени. Проконсультироваться с врачом' },
  { a: 'curcumin', b: '@anticoagulant', severity: 'warn', reason: '↑ кровотечение (↓ aggregation)', action: '⚠ Мониторинг INR/PT если на варфарине' },
  { a: 'garlic', b: '@anticoagulant', severity: 'warn', reason: '↑ INR', action: '⚠ Мониторинг. Nattokinase тоже — additive' },
  { a: 'nattokinase', b: '@anticoagulant', severity: 'warn', reason: 'Аддитивный фибринолиз → риск кровотечения', action: '⚠ Мониторинг. Снижение anticoagulant dose может потребоваться' },
  { a: 'serrapeptase', b: '@anticoagulant', severity: 'warn', reason: 'Аддитивный фибринолиз', action: '⚠ Осторожно с варфарином/DOAC' },
  { a: 'vitamin_k2', b: '@anticoagulant', severity: 'block', reason: 'K2 активирует факторы свёртывания → ↓ эффективность варфарина/DOAC', action: '⛔ Не комбинировать. K2 — антагонист варфарина. Контроль МНО каждые 2 нед' },
  { a: 'aspirin', b: '@anticoagulant', severity: 'block', reason: 'Аспирин (необратимая блокада COX-1) + антикоагулянт = высокий риск ЖК-кровотечений', action: '⛔ Избегать комбинации. Если необходимо — ИПП (омепразол 20 мг) + мониторинг гемоглобина' },
  { a: 'coq10', b: '@anticoagulant', severity: 'warn', reason: 'CoQ10 структурно похож на вит.K → может ↓ антикоагулянтный эффект', action: '⚠ Мониторинг МНО каждые 2 нед' },
  { a: 'ginkgo', b: '@anticoagulant', severity: 'warn', reason: 'Гинкго билоба ингибирует PAF → ↑ кровотечение при приёме антикоагулянтов', action: '⚠ Мониторинг. Гинкго + warfarin = ↑ риск геморрагического инсульта' },
  { a: 'fish_oil', b: '@anticoagulant', severity: 'warn', reason: 'Омега-3 (>3 г/сут) ↓ агрегацию тромбоцитов → аддитивный эффект', action: '⚠ Мониторинг. До 2 г/сут безопасно с варфарином' },
  { a: 'vitamin_e', b: '@anticoagulant', severity: 'warn', reason: 'Высокие дозы вит.E (>600 МЕ) ↓ агрегацию тромбоцитов', action: '⚠ Мониторинг. Избегать доз >400 МЕ одновременно с варфарином' },
  { a: 'tadalafil', b: '@cyp3a4_inhibitor', severity: 'warn', reason: 'CYP3A4-ингибиторы (кетоконазол, ритонавир) ↑ tadalafil', action: '⚠ Снизить tadalafil дозу до 2.5 мг. Проконсультироваться с врачом' },
  { a: 'cabergoline', b: '@macrolide', severity: 'warn', reason: 'CYP3A4 ингибирование → ↑ caber levels', action: '⚠ Мониторинг побочек (гипотония, им-пульсивность)' },
  { a: 'milk_thistle', b: '@cyp3a4_substrate', severity: 'warn', reason: 'Силимарин ингибирует CYP3A4 → ↑ tadalafil/anastrozole levels', action: '⚠ Не принимать одновременно. Разнести на 2+ ч' },
  { a: 'clenbuterol', b: 'nebivolol', severity: 'warn', reason: 'β-антагонизм (clen β2, blockers β1/β2)', action: '⚠ Небиволол может ↓ эффективность кленбутерола. Мониторинг ЧСС' },
  { a: 'berberine', b: 'metformin', severity: 'warn', reason: 'Аддитивный эффект (оба AMPK → глюкоза)', action: '⚠ Аддитивный эффект — хорошо, но риск гипогликемии при инсулине. Мониторинг глюкозы' },
  { a: 'agmatine', b: '@ssri', severity: 'warn', reason: 'Теоретический риск синдрома серотонина', action: '⚠ Будьте бдительны если на СИОЗС' },
  { a: 'metformin', b: '@contrast', severity: 'block', reason: 'ЛАКТОАЦИДОЗ после контраста', action: '⛔ STOP metformin за 48 ч до/после контрастного иссследования' },
  { a: 'metformin', b: '@alcohol', severity: 'warn', reason: '↑ лактоацидоз риск', action: '⚠ ZERO или сильное ↓ алкоголя' },
  { a: 'spironolactone', b: '@nsaid', severity: 'warn', reason: 'Снижение антигипертензивного эффекта + K⁺ риск', action: '⚠ Избегать длительных НПВС' },
  { a: 'spironolactone', b: 'potassium', severity: 'block', reason: 'Гиперкалиемия', action: '⛔ Не добавлять K⁺-добавки на спиро' },
  // ─── Тиазидные диуретики ───
  { a: 'hydrochlorothiazide', b: '@raas', severity: 'warn', reason: 'Аддитивная гипотензия (↓↓АД), но K⁺ компенсируется (тиазид вымывает + ARB сберегает)', action: '⚠ Мониторинг АД и K⁺ каждые 2 нед. Снижение дозы может потребоваться' },
  { a: 'hydrochlorothiazide', b: '@nsaid', severity: 'warn', reason: '↓ антигипертензивный эффект + ↑ K⁺ риск (НПВС ↓ диуретик efficacy)', action: '⚠ Избегать длительных НПВС. Краткие курсы + мониторинг АД' },
  { a: 'hydrochlorothiazide', b: 'chromium', severity: 'monitor', reason: 'Тиазиды ↑ глюкозу → инсулинорезистентность, Cr может ↓ этот эффект', action: 'Мониторинг глюкозы натощак каждые 4 нед' },
  { a: 'indapamide', b: '@raas', severity: 'warn', reason: 'Аддитивная гипотензия (как HCTZ), но меньше K+-потери', action: '⚠ Мониторинг АД и K⁺ каждые 2 нед' },
  { a: 'indapamide', b: 'potassium', severity: 'monitor', reason: 'Индапамид вымывает K⁺ (меньше HCTZ, но всё же)', action: 'Мониторинг K⁺ каждые 2 нед. Калийсодержащие добавки безопасны (не блок!) — восполнение' },
  { a: 'iron_bisglycinate', b: '@tetracycline', severity: 'warn', reason: '↓ всасывание обоих', action: '⚠ Разнести на 3+ ч' },
  { a: 'iron_bisglycinate', b: '@levothyroxine', severity: 'warn', reason: '↓ T4 всасывание', action: '⚠ Разнести на 4+ ч (T4 утром iron вечером)' },
  { a: 'calcium', b: '@levothyroxine', severity: 'warn', reason: '↓ T4 всасывание', action: '⚠ Разнести на 4+ ч' },
  { a: 'calcium', b: '@tetracycline', severity: 'warn', reason: 'Хелатное связывание', action: '⚠ Разнести на 2+ ч' },
  { a: 'zinc', b: 'copper', severity: 'monitor', reason: '↑ Zn → ↓ Cu всасывание (длительно >50 мг Zn)', action: '1:10-1:15 ratio Cu:Zn. Если Zn >50 мг → +1 мг Cu.' },
  { a: 'chromium', b: '@levothyroxine', severity: 'warn', reason: '↓ T4 (у 20% пациентов)', action: '⚠ Разнести на 3+ ч' },
];

// Классы — краткие lookupuffixы
const CLASS_MAP: Record<string, string[]> = {
  '@statin':         ['atorvastatin', 'rosuvastatin', 'simvastatin', 'fluvastatin', 'pravastatin', 'bergamot'],
  '@raas':           ['telmisartan', 'losartan', 'irbesartan', 'olmesartan', 'valsartan', 'candesartan', 'ramipril', 'enalapril', 'lisinopril'],
  '@antidiabetic':   ['metformin', 'insulin_rapid', 'insulin_lantus', 'glimepiride', 'gliclazide'],
  '@macrolide':      ['erythromycin', 'azithromycin', 'clarithromycin'],
  '@anticoagulant':  ['warfarin', 'rivaroxaban', 'apixaban', 'dabigatran', 'heparin', 'enoxaparin'],
  '@cyp3a4_inhibitor': ['ketoconazole', 'itraconazole', 'ritonavir', 'clarithromycin', 'grapefruit'],
  '@cyp3a4_substrate': ['tadalafil', 'anastrozole', 'simvastatin', 'midazolam'],
  '@alpha_blocker':  ['doxazosin', 'tamsulosin', 'silodosin', 'alfuzosin'],
  '@d2_antagonist':  ['metoclopramide', 'chlorpromazine', 'haloperidol', 'prochlorperazine'],
  '@alcohol':        ['alcohol', 'ethanol'],
  '@nsaid':          ['ibuprofen', 'naproxen', 'diclofenac', 'celecoxib', 'ketorolac', 'meloxicam'],
  '@contrast':       ['iodixanol', 'iohexol', 'gadolinium'],
  '@ssri':           ['fluoxetine', 'sertraline', 'citalopram', 'escitalopram', 'paroxetine'],
  '@tetracycline':   ['doxycycline', 'tetracycline', 'minocin'],
  '@levothyroxine':  ['levothyroxine', 'liothyronine', 't4', 't3'],
};

// ════════════════════════════════════════════════════════════════════════════
//  checkInteractions — проверка списка препаратов на взаимодействия
//  Поддерживает: точные имена, class-based матчинг, substring fallback,
//  Unicode whitespace, нормализацию регистра.
// ════════════════════════════════════════════════════════════════════════════
function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[_-]+/g, '-');
}

export function checkInteractions(substanceIds: string[]): DrugInteraction[] {
  if (!substanceIds?.length) return [];
  const idSet = new Set(substanceIds.map(normalize));
  const results: DrugInteraction[] = [];
  const seen = new Set<string>();

  for (const interaction of DRUG_INTERACTIONS) {
    const a = normalize(interaction.a);
    const b = normalize(interaction.b);
    const isBClass = b.startsWith('@');
    const bMembers = isBClass ? (CLASS_MAP[interaction.b] || []).map(normalize) : [];

    // matchA: точное совпадение ИЛИ substring (для 'warfarin' vs 'warfarin sodium')
    // ИЛИ class-match (если a — имя класса)
    const matchA = idSet.has(a)
      || (CLASS_MAP[interaction.a] ? CLASS_MAP[interaction.a].map(normalize).some(m => idSet.has(m)) : false)
      || Array.from(idSet).some(id => a.length >= 4 && id.includes(a));
    const matchB = isBClass
      ? bMembers.some(m => idSet.has(m) || Array.from(idSet).some(id => m.length >= 4 && id.includes(m)))
      : (idSet.has(b) || Array.from(idSet).some(id => b.length >= 4 && id.includes(b)));

    if (matchA && matchB) {
      const key = [a, b].sort().join('+');
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(interaction);
    }
  }
  return results;
}