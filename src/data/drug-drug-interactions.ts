// Drug-Drug Interactions Database
// Критические и высокорисковые взаимодействия между фармакологическими препаратами
// Используется в recommendation-engine для проверки безопасности

export type DDISeverity = 'block' | 'critical' | 'high' | 'medium' | 'low';

export interface DrugDrugInteraction {
  drugA: string;
  drugB: string;
  severity: DDISeverity;
  mechanism: string;
  clinicalEffect: string;
  management: string;
  alternatives?: string[];
}

// Нормализация ID препаратов
function normId(id: string): string {
  return id.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export const DRUG_DRUG_INTERACTIONS: DrugDrugInteraction[] = [
  // ═══════════════════════════════════════════════════════════════
  // КРИТИЧЕСКИЕ (BLOCK) — не комбинировать ни при каких обстоятельствах
  // ═══════════════════════════════════════════════════════════════
  
  // PDE5-инохибиторы + Нитраты = фатальная гипотензия
  { drugA: 'tadalafil', drugB: 'nitroglycerin', severity: 'block',
    mechanism: 'PDE5-инохибитор + донор NO → аддитивная вазодилатация', 
    clinicalEffect: 'Рефрактарная гипотензия, коллапс, инфаркт, смерть',
    management: '⛔ ЗАПРЕЩЕНО. Нитраты противопоказаны при приёме ФДЭ-5. Пауза тадалафила ≥48 ч перед нитратами.',
    alternatives: ['Смену тактики ЛПНП на не-FDA5'] },
  { drugA: 'sildenafil', drugB: 'nitroglycerin', severity: 'block',
    mechanism: 'PDE5-инохибитор + донор NO', 
    clinicalEffect: 'Фатальная гипотензия', 
    management: '⛔ ЗАПРЕЩЕНО', alternatives: [] },
  { drugA: 'vardenafil', drugB: 'nitroglycerin', severity: 'block',
    mechanism: 'PDE5-инохибитор + донор NO', 
    clinicalEffect: 'Фатальная гипотензия', 
    management: '⛔ ЗАПРЕЩЕНО', alternatives: [] },

  // PDE5 + α-блокаторы = ортостатическая гипотензия
  { drugA: 'tadalafil', drugB: 'tamsulosin', severity: 'block',
    mechanism: 'PDE5 + α1-блокатор → синергическая вазодилатация', 
    clinicalEffect: 'Ортостатический коллапс, синкопе', 
    management: '⛔ Не комбинировать. Если необходимо — тадалафил 2.5 мг + α-блокатор на фоне стабильной гемодинамики, разделение приёма ≥4 ч.',
    alternatives: ['Альфа-блокатор с меньшим влиянием на АД', 'Силденафил по требованию'] },
  { drugA: 'tadalafil', drugB: 'doxazosin', severity: 'block',
    mechanism: 'PDE5 + α1-блокатор', clinicalEffect: 'Ортостатическая гипотензия',
    management: '⛔ Не комбинировать', alternatives: [] },
  { drugA: 'sildenafil', drugB: 'tamsulosin', severity: 'block',
    mechanism: 'PDE5 + α1-блокатор', clinicalEffect: 'Ортостатическая гипотензия',
    management: '⛔ Не комбинировать', alternatives: [] },

  // ═══════════════════════════════════════════════════════════════
  // HIGH — требуют строгого контроля/коррекции доз
  // ═══════════════════════════════════════════════════════════════

  // Варфарин + фибринолитики/антиагреганты = кровотечение
  { drugA: 'warfarin', drugB: 'omega3', severity: 'high',
    mechanism: 'Варфарин + Омега-3 (антиагрегация) → ↑ INR, риск кровотечения',
    clinicalEffect: 'ЖКТ/Внутричерепное кровотечение', 
    management: 'INR каждые 3-7 дней при запуске/смене дозы. Омега-3 ≤2 г/сут. Рассмотреть DOAK вместо варфарина.',
    alternatives: ['Ривароксабан', 'Апиксабан'] },
  { drugA: 'warfarin', drugB: 'serrapeptase', severity: 'high',
    mechanism: 'Варфарин + серрапептаза (фибринолиз) → аддитивное антикоагуляция',
    clinicalEffect: 'Мажоритарное кровотечение', 
    management: 'INR 2р/нед. При INR >3.5 — стоп серрапептаза + вит К1.', alternatives: [] },
  { drugA: 'warfarin', drugB: 'nattokinase', severity: 'high',
    mechanism: 'Варфарин + наттокиназа (плазмин-активация) → мощная антикоагуляция',
    clinicalEffect: 'Спонтанные кровотечения', 
    management: 'INR каждые 2-3 дня. Наттокиназа только под контролем INR ≤2.5.', alternatives: [] },
  { drugA: 'warfarin', drugB: 'bromelain', severity: 'high',
    mechanism: 'Варфарин + бромелайн (антиагрегация/фибринолиз)', clinicalEffect: 'Кровотечение',
    management: 'INR контроль, дозировка бромелайна ≤500 мг/сут', alternatives: [] },
  { drugA: 'warfarin', drugB: 'garlic', severity: 'high',
    mechanism: 'Варфарин + чеснок (аджоен, Алицин) → ↓ тромбоксан, ↑ INR',
    clinicalEffect: 'Повышение INR до опасных значений', 
    management: 'INR каждые 3-5 дней. Чеснок стандарт. экстракт ≤1200 мг/сут.', alternatives: [] },
  { drugA: 'warfarin', drugB: 'gingko', severity: 'high',
    mechanism: 'Варфарин + гинкго (гинкголиды) → плазмин/антиагрегация', clinicalEffect: 'Субдуральное/Внутричерепное кровотечение',
    management: 'Строго запрещено комбинировать без гематолога. INR ежедневно при запуске.', alternatives: [] },
  { drugA: 'warfarin', drugB: 'curcumin', severity: 'medium',
    mechanism: 'Варфарин + куркумин (COX-2/плазмин)', clinicalEffect: 'Умеренное повышение INR',
    management: 'INR 1р/нед при совмещении. Куркумин ≤1 г/сут.', alternatives: [] },

  // Прямые антикоагулянты (DOAK) + фибринолитики
  { drugA: 'rivaroxaban', drugB: 'serrapeptase', severity: 'high',
    mechanism: 'Фактор Xa ингибитор + фибринолиз', clinicalEffect: 'Мажоритарное кровотечение',
    management: 'Не рекомендуется. Если необходимо — серрапептаза ≤10 мг/сут под контролем гемоглобина/штамма', alternatives: [] },
  { drugA: 'apixaban', drugB: 'nattokinase', severity: 'high',
    mechanism: 'Фактор Xa ингибитор + плазмин-активатор', clinicalEffect: 'Кровотечение',
    management: 'Надзор Hb/штамма каждые 3-4 дня. Наттокиназа ≤50 мг/сут.', alternatives: [] },

  // NSAIDs + Литий = токсичность лития
  { drugA: 'ibuprofen', drugB: 'lithium', severity: 'high',
    mechanism: 'НПВС ↓ почечный клиренс лития → токсические уровни', clinicalEffect: 'Тремор, атаксия, судороги, коме',
    management: 'Литий + НПВС — только под контролем уровня лития каждые 3-5 дней. Предпочесть парацетамол.',
    alternatives: ['Парацетамол', 'Опиоиды (кратко)'] },
  { drugA: 'naproxen', drugB: 'lithium', severity: 'high',
    mechanism: 'НПВС ↓ клиренс лития', clinicalEffect: 'Токсичность лития',
    management: 'Уровень лития каждые 3-5 дней. Избегать хронического совмещения.', alternatives: ['Парацетамол'] },
  { drugA: 'celecoxib', drugB: 'lithium', severity: 'medium',
    mechanism: 'Коксиб-2 ↓ клиренс лития (слабее неселективных)', clinicalEffect: 'Повышение лития',
    management: 'Контроль лития 1р/нед', alternatives: [] },

  // ACEi/ARB + Калий/Калиесберегающие = гиперкалиемия
  { drugA: 'lisinopril', drugB: 'spironolactone', severity: 'high',
    mechanism: 'ACEi + калий-сберегающий диуретик → аддитивное удержание K+', clinicalEffect: 'Гиперкалиемия (K+ >6.0 = остановка сердца)',
    management: 'K+ каждые 3-5 дней при запуске. K+ >5.5 — ↓ дозу/стоп. Калий-сберегающие диуретики — с осторожностью.',
    alternatives: ['Тиазидный диуретик', 'Фуросемид'] },
  { drugA: 'losartan', drugB: 'potassium', severity: 'high',
    mechanism: 'ARB + калийные препараты → гиперкалиемия', clinicalEffect: 'Аритмия, АС',
    management: 'K+ до запуска и через 3-5 дней. Калийные добавки только при гипокалиемии под контролем.', alternatives: [] },
  { drugA: 'telmisartan', drugB: 'potassium', severity: 'high',
    mechanism: 'ARB + K+ добавки', clinicalEffect: 'Гиперкалиемия',
    management: 'K+ контроль обязателен', alternatives: [] },

  // ACEi/ARB + NSAIDs = поражение почек
  { drugA: 'lisinopril', drugB: 'ibuprofen', severity: 'high',
    mechanism: 'ACEi + НПВС → аферентное сужение → ↓ СКФ, острая почечная недостаточность',
    clinicalEffect: 'ОПН, гиперкалиемия, неврогерическая АД', 
    management: 'Избегать хронического НПВС на фоне ACEi/ARB. Если необходимо — короткий курс, мониторинг креатинина/K+ каждые 2-3 дня.',
    alternatives: ['Парацетамол', 'Тамол', 'Трамадол'] },

  // Метформин + контраст/йод = лактат-ацидоз
  { drugA: 'metformin', drugB: 'iodine_contrast', severity: 'high',
    mechanism: 'Метформин + йодсодержащий контраст → риск лактат-ацидоза', clinicalEffect: 'Лактат-ацидоз (смерть 50%)',
    management: 'Метформин стоп за 48 ч до контраста, возобновить через 48 ч при нормальном креатинине.', alternatives: [] },

  // Статины + фибраты = миопатия/рабдомиолиз
  { drugA: 'atorvastatin', drugB: 'gemfibrozil', severity: 'high',
    mechanism: 'Статин + гемиброзил (ингибитор CYP2C8/글루куронирования) → ↑ статин в 3-5 раз', clinicalEffect: 'Рабдомиолиз, ОПН',
    management: 'Не комбинировать. Использовать фенофибрат вместо гемиброзила.', alternatives: ['Фенофибрат'] },
  { drugA: 'rosuvastatin', drugB: 'gemfibrozil', severity: 'high',
    mechanism: 'Розувастатин + гемиброзил', clinicalEffect: 'Рабдомиолиз',
    management: 'Фенофибрат вместо гемиброзила.', alternatives: ['Фенофибрат'] },

  // ═══════════════════════════════════════════════════════════════
  // MEDIUM — требуют осведомлённости и контроля
  // ═══════════════════════════════════════════════════════════════

  // Статины + CYP3A4 ингибиторы
  { drugA: 'simvastatin', drugB: 'clarithromycin', severity: 'medium',
    mechanism: 'CYP3A4 ингибитор → ↑ симвастатин', clinicalEffect: 'Миопатия/рабдомиолиз',
    management: 'Симвастатин ≤10 мг/сут или смена на розувастатин/правустатин.', alternatives: ['Розувастатин', 'Правустатин'] },
  { drugA: 'atorvastatin', drugB: 'clarithromycin', severity: 'medium',
    mechanism: 'CYP3A4 ингибитор', clinicalEffect: 'Миопатия', management: 'Аторвастатин ≤20 мг/сут', alternatives: ['Розувастатин'] },

  // Тримे� préparation + АКШ/Цикл = риск гиперкалиемии (уже покрыто выше)

  // Беременность/Лактация специфичные
  { drugA: 'finasteride', drugB: 'pregnancy', severity: 'block',
    mechanism: '5α-редуктаза ингибитор → гипспалия у мужского плода', clinicalEffect: 'Тяжёлые пороки развития',
    management: '⛔ АБСОЛЮТНОЕ ПРОТИВОПОКАЗАНИЕ при беременности/планировании. Женщины не должны касаться дробленых таблеток.', alternatives: [] },

  // Антидепрессанты (SSRI) + трамадол/триптаны = серотониновый синдром
  { drugA: 'sertraline', drugB: 'tramadol', severity: 'medium',
    mechanism: 'SSRI + трамадол (SERT/5-HT) → серотониновый синдром', clinicalEffect: 'Гиперрефлексия, клонус, гипертермия',
    management: 'Избегать комбинации. При необходимости — минимальные дозы, наблюдение 24/7.', alternatives: ['Парацетамол', 'НПВС'] },

  // Кортикостероиды + НПВС = язва
  { drugA: 'prednisone', drugB: 'ibuprofen', severity: 'medium',
    mechanism: 'ГК + НПВС → синергическая гастропатия', clinicalEffect: 'Язвенное кровотечение, перфорация',
    management: 'Обязателен ИПП (омепразол 20-40 мг) на фоне комбинации.', alternatives: [] },

  // Туберкулез/ВИХ специфичные
  { drugA: 'rifampicin', drugB: 'methadone', severity: 'high',
    mechanism: 'Индуктор CYP3A4 → ↓ метадон (синдром отмены)', clinicalEffect: 'Синдром отмены, риск рецидива',
    management: 'Доза метадона ↑ 2-3x под контролем клиники.', alternatives: ['Буprenорфин'] },

  // ═══════════════════════════════════════════════════════════════
  // HELPER FUNCTIONS
  // ═══════════════════════════════════════════════════════════════

  // // Build lookup map for fast queries
];

// Построить мапу для быстрого поиска
const ddiMap = new Map<string, DrugDrugInteraction[]>();
for (const ddi of DRUG_DRUG_INTERACTIONS) {
  const a = normId(ddi.drugA);
  const b = normId(ddi.drugB);
  // Двусторонняя мапа
  if (!ddiMap.has(a)) ddiMap.set(a, []);
  if (!ddiMap.has(b)) ddiMap.set(b, []);
  ddiMap.get(a)!.push(ddi);
  ddiMap.get(b)!.push(ddi);
}

export function checkDrugDrugInteractions(
  userMeds: string[],
  candidateSubstances: string[]
): { drug: string; interactions: DrugDrugInteraction[] }[] {
  const results: { drug: string; interactions: DrugDrugInteraction[] }[] = [];
  const allSubs = [...userMeds, ...candidateSubstances].map(normId);
  
  for (const drug of allSubs) {
    const interactions = ddiMap.get(drug);
    if (!interactions) continue;
    
    const relevant = interactions.filter(ddi => {
      const other = normId(ddi.drugA) === drug ? normId(ddi.drugB) : normId(ddi.drugA);
      return allSubs.includes(other);
    });
    
    if (relevant.length > 0) {
      results.push({ drug, interactions: relevant });
    }
  }
  
  return results;
}

export function hasBlockingInteraction(
  userMeds: string[],
  candidateSubstances: string[]
): DrugDrugInteraction[] {
  const all = [...userMeds, ...candidateSubstances].map(normId);
  const blocks: DrugDrugInteraction[] = [];
  
  for (const drug of all) {
    const interactions = ddiMap.get(drug);
    if (!interactions) continue;
    for (const ddi of interactions) {
      const other = normId(ddi.drugA) === drug ? normId(ddi.drugB) : normId(ddi.drugA);
      if (all.includes(other) && ddi.severity === 'block') {
        blocks.push(ddi);
      }
    }
  }
  return blocks;
}

export function getDDIForDrug(drugId: string): DrugDrugInteraction[] {
  return ddiMap.get(normId(drugId)) || [];
}

export function getDDIForPair(drugA: string, drugB: string): DrugDrugInteraction[] {
  const a = normId(drugA);
  const b = normId(drugB);
  const interactions = ddiMap.get(a) || [];
  return interactions.filter(ddi => 
    (normId(ddi.drugA) === a && normId(ddi.drugB) === b) ||
    (normId(ddi.drugA) === b && normId(ddi.drugB) === a)
  );
}