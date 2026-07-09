# LAB-TIER-SYSTEM — Полный план реализации

## КОНТЕКСТ
- Протокол v4 (4 уровня: база/соло/тандем/орал) уже работает в `tz-mapper-engine.ts`
- Базовые витамины (D3+K2, Mg, B6, B12, Folate, VitC) добавлены
- Блоклисты (RAAS, STATIN, JOINT, REPRO) работают
- Проблема: analyses не влияют на дозы, нет профилактики, нет экстренных алертов

## ПРИНЦИП СИНЕРГИИ (принудительные пары)

### Обязательные пары (если выбран один — второй добавляется автоматически)

| Пара | Почему | Механизм |
|------|--------|----------|
| **Iron bisglycinate + VitC** | VitC ↑ всасывание железа в 3× | Аскорбиновая кислота восстанавливает Fe³⁺→Fe²⁺ (только Fe²⁺ всасывается в duodenum) |
| **Serrapeptase + Nattokinase** | 2 разных механизма фибринолиза | Serra: расщепление α2-макроглобулин/фибрин. Natto: прямой плазминоген→плазмин |
| **D3 + K2** | ⚠ КРИТИЧНО: D3 без K2 = кальцификация сосудов | K2 активирует GLA-белки → направляет Ca²⁺ в кости, не в артерии |
| **B6 + B12 + Folate + TMG** | Метилирование (гомоцистеин↓) | 4 кофактора метилирования: каждый ↑ эффективность остальных |
| **NAC + Glycine** | 2 лимитирующих субстрата глутатиона | NAC=N-ацетилцистеин (цистеин), Gly=глицин. Глутатион=GLU+CYSTEINE+GLY |
| **Berberine + Omega-3** | Berberine (AMPK) + Omega-3 (PPAR-α) — синергия по липидам/glucose | ↓ LDL 25%, ↑ HDL 15%, ↓ insulin resistance |
| **Curcumin + Piperine** | Piperine ↑ биодоступность куркумина ×2000% | Ингибирует глюкуронилтрансферазу в печени |
| **Telmisartan + Nebivolol** | RAS + β-блокада при АГ | Telmisartan (ARB) + Nebivolol (β1+NO) — **только при неконтролируемом АД** |
| **Bergamot + CoQ10** | Bergamot (HMG-CoA редуктаза) истощает CoQ10 → надо восполнять | Статины и фитостатины ↓ эндогенный CoQ10 синтез |
| **TUDCA + Milk thistle** при оралах | 2 разных механизма защиты печени | TUDCA: bile flow. Silymarin: мембраны |
| **Agmatine + Citrulline** | 2 пути NO: eNOS-стимуляция (agmatine) + субстрат (citrulline→arginine→NO) | Синергия по вазодилатации и ↓BP |
| **Selenium + Iodine** (при TSH↑) | 2 кофактора дейодиназы (T4→T3) | Se = кофактор D1/D2, I = субстрат T3/T4 |

### Опциональные пары (по ситуации)

| Пара | Когда |
|------|-------|
| **Aspirin + Serrapeptase** | HCT>52 + тромбоциты>450 (синергия: ↓ aggregation + ↑ fibrinolysis) |
| **Niacin + Garlic** | LDL↑ + HDL↓ (ниацин↑HDL, чеснок↓LDL) |
| **Saw palmetto + Tadalafil** | симптомы ДГПЖ (saw palmetto: ↓DHT в простате; tadalafil: ↑поток, ↓симптомы I-PSS) |
| **Berberine + Metformin** | инсулинорезистентность, бергамот = 1-я линия, метформин = когда berberine не помогает |
| **Phosphatidylserine + Theanine** | cortisol↑ + тревога/сон |

### ⚠ ОСОБОЕ ПРАВИЛО про АСПИРИН

- **НЕ назначать автоматически** только по HCT
- **Только при** PLT>450 AND HCT>50 (синергия: с serrapeptase + nattokinase)
- **Противопоказан** при: язва Ж/ДПК, H. pylori+, кровотечение в анамнезе, age>60
- В UI обязательный **warning badge**
- По умолчанию в плане НЕТ, появляется только при явных рисках

---

## СИНЕРГИЯ-ЭНЖИН (lab-synergy-engine.ts)

```ts
interface SynergyPair {
  primary: string;   // выбранный → триггер
  secondary: string;  // добавляется автоматически
  relationship: 'mandatory' | 'strong' | 'conditional';
  reason: string;
  when?: string;     // условие для conditional пар
}

const SYNERGY_PAIRS: SynergyPair[] = [
  { primary: 'iron_bisglycinate', secondary: 'vitamin_c', relationship: 'mandatory', reason: 'VitC ↑ Fe всасывание ×3' },
  { primary: 'serrapeptase', secondary: 'nattokinase', relationship: 'mandatory', reason: '2 пути фибринолиза: α2-M + плазминоген' },
  { primary: 'vitamin_d3', secondary: 'vitamin_k2', relationship: 'mandatory', reason: 'D3 без K2 = кальцификация сосудов' },
  { primary: 'nac', secondary: 'glycine', relationship: 'strong', reason: '2 субстрата глутатиона: Cys + Gly' },
  { primary: 'bergamot', secondary: 'coq10', relationship: 'mandatory', reason: 'HMG-CoA редуктаза истощает CoQ10' },
  { primary: 'curcumin', secondary: 'piperine', relationship: 'mandatory', reason: 'Piperine ↑ доступность куркумина ×20' },
  { primary: 'agmatine', secondary: 'citrulline', relationship: 'strong', reason: '2 пути NO: eNOS + субстрат' },
  { primary: 'tudca', secondary: 'milk_thistle', relationship: 'conditional', reason: 'bile flow + мембраны', when: 'oral AAS or ALT>60' },
  { primary: 'aspirin', secondary: 'serrapeptase', relationship: 'conditional', reason: '↓ aggregation + ↑ fibrinolysis', when: 'PLT>450 AND HCT>52' },
  { primary: 'niacin', secondary: 'garlic', relationship: 'conditional', reason: 'HDL↑ + LDL↓', when: 'LDL>3.5 OR HDL<0.6' },
  { primary: 'saw_palmetto', secondary: 'tadalafil', relationship: 'conditional', reason: 'ДГПЖ симптомы', when: 'prostate symptoms' },
];

function applySynergy(subs: string[], ctx: MapperCtx): { addedSubs: string[], reasons: Map<string, string> } {
  const added: string[] = [];
  const reasons = new Map<string, string>();
  for (const pair of SYNERGY_PAIRS) {
    if (pair.relationship === 'conditional' && !pair.when) continue;
    if (subs.includes(pair.primary) && !subs.includes(pair.secondary)) {
      if (pair.relationship === 'conditional') {
        if (!evalCondition(pair.when, ctx)) continue;
      }
      subs.push(pair.secondary);
      added.push(pair.secondary);
      reasons.set(pair.secondary, `Синергия с ${pair.primary}: ${pair.reason}`);
    }
  }
  return { addedSubs: added, reasons };
}

```

---

## АРХИТЕКТУРА — 4 TIER

```
TIER 0  НОРМА       → Протокол (что есть сейчас)
TIER 1  НА ГРАНИ      → +1-2 адаптива + нутри-AC (профилактика «до»)
TIER 2  ЛЕЧЕНИЕ       → Усиленный стэк, дозы↑, ↓dose AAS, кровопускание
TIER 3  ⛔ ЭКСТРЕННО  → STOP COURSE + к врачу + ER
```

---

## TIER-ПОРОГИ (lab-tier-ranges.ts)

### CARDIO
| Маркёр | Норма | Грань | Лечение | ⛔Экстрено |
|--------|------|------|--------|---------|
| LDL mmol/L | <3.0 | 3-3.5 | 3.5-5 | >5 |
| HDL mmol/L | >1.0 | 0.8-1.0 | 0.4-0.8 | <0.4 |
| Triglycer | <1.7 | 1.7-2.3 | 2.3-5.6 | >5.6 |
| BP syst | <130 | 130-140 | 140-160 | >160 |
| BP diast | <85 | 85-90 | 90-110 | >110 |
| HR | <80 | 80-90 | 90-110 | >110 |
| CK U/L | <200 | 200-1000 | 1000-5000 | >5000 рабдомиолиз |
| NT-proBNP | <125 | 125-450 | 450-1800 | >1800 |
| D-dimer | <0.5 | 0.5-1 | 1-2.5 | >2.5 тромбоэмболия |
| Fibrinogen | <4 | 4-5.5 | 5.5-8 | >8 |
| ESR | <15 | 15-30 | 30-60 | >60 |
| Troponin I | <0.04 | 0.04-0.1 | 0.1-1 | >1 инфаркт |
| CK-MB | <5 | 5-10 | 10-25 | >25 |

### HEPATIC
| Маркёр | Норма | Грань | Лечение | ⛔Экстрено |
|--------|------|------|--------|---------|
| ALT | <40 | 40-80 | 80-200 | >200 (3×ULN) |
| AST | <40 | 40-100 | 100-200 | >200 |
| GGT | <55 | 55-110 | 110-200 | >200 |
| Bilirubin | <21 | 21-40 | 40-100 | >100 |
| ALP | <120 | 120-200 | 200-400 | >400 |
| Ammonia | <50 | 50-80 | 80-150 | >150 |

### RENAL
| Маркёр | Норма | Грань | Лечение | ⛔Экстрено |
|--------|------|------|--------|---------|
| Creatinine mcmol/L | <105 | 105-130 | 130-200 | >200 |
| eGFR | >90 | 60-90 | 30-60 | <30 ХБП ст.4 |
| Cystatin C | <1.0 | 1.0-1.3 | 1.3-2 | >2 |
| Urea | <8 | 8-12 | 12-20 | >20 |
| Protein urine | <0.15 | 0.15-0.5 | 0.5-1.0 | >1.0 |
| Uric acid | <420 | 420-480 | 480-600 | >600 |

### HEMATOLOGIC
| Маркёр | Норма | Грань | Лечение | ⛔Экстрено |
|--------|------|------|--------|---------|
| HCT % | <50 | 50-54 | 54-58 | >60 кровопускание |
| Hemoglobin | <175 | 175-185 | 185-200 | >200 полицитемия |
| Platelets | <350 | 350-450 | 450-600 | >600 тромбоцитоз |
| RBC | <5.5 | 5.5-6 | 6-6.5 | >6.5 |
| WBC | 4-10 | 10-12 | 12-20 | >20 лейкоцитоз |

### HORMONAL
| Маркёр | Норма | Грань | Лечение | ⛔Экстрено |
|--------|------|------|--------|---------|
| E2 pg/mL | 20-40 | 40-60 | 60-100 | >100 гинекомастия |
| Prolactin ng/mL | <15 | 15-25 | 25-50 | >50 пролактинома |
| TSH mU/L | 0.4-4 | 4-6 | 6-10 | >10 / <0.1 |
| Cortisol nmol/L | 100-535 | 535-700 | 700-1000 | >1000 Кушингоид |
| LH | 1.7-9 | 1-1.7 | 0.5-1 | <0.5 HPTA dead |
| Testosterone | >15 | 10-15 | 5-10 | <5 |
| DHT | >1.0 | 0.5-1.0 | 0.2-0.5 | <0.2 |
| DHEA-S | >200 | 150-200 | 100-150 | <100 |

### METABOLIC
| Маркёр | Норма | Грань | Лечение | ⛔Экстрено |
|--------|------|------|--------|---------|
| Glucose | <5.6 | 5.6-6.1 | 6.1-11 | >11 кетоз |
| HbA1c | <5.7 | 5.7-6.4 | 6.4-8 | >8 декомпенсация |
| Insulin | <10 | 10-15 | 15-25 | >25 |
| HOMA-IR | <2.5 | 2.5-3.5 | 3.5-5 | >5 |
| Homocysteine | <10 | 10-15 | 15-30 | >30 тромбоз |
| CRP mg/L | <3 | 3-10 | 10-20 | >20 сепсис? |
| Ferritin | 30-400 | 20-30 / 400-600 | 10-20 / 600-1000 | <10 / >1000 |

### VITAMINS/MINERALS
| Маркёр | Норма | Грань | Лечение | ⛔Экстрено |
|--------|------|------|--------|---------|
| Vitamin D ng/mL | >30 | 20-30 | 10-20 | <10 рахит |
| B12 pg/mL | >200 | 150-200 | 100-150 | <100 нейропатия |
| Folate ng/mL | >7 | 5-7 | 3-5 | <3 |
| Iron | >13 | 10-13 | 5-10 | <5 анемия |
| Mg serum | >0.85 | 0.7-0.85 | 0.5-0.7 | <0.5 судороги |
| Zinc | >11 | 9-11 | 7-9 | <7 иммунодефицит |
| Selenium | >80 | 60-80 | 40-60 | <40 кардиомиопатия |
| Potassium | 3.5-5.0 | 3.0-3.5 / 5.0-5.5 | 2.5-3 / 5.5-6.5 | <2.5 />6.5 cardiac arrest |
| Sodium | 135-145 | 130-135 / 145-150 | 125-130 / 150-155 | <125 />155 ЦНС |
| Calcium | 2.2-2.6 | 2.0-2.2 / 2.6-2.8 | 1.8-2.0 / 2.8-3.0 | <1.8 />3.0

---

## TIER 1 — ГРАНЬ: АДАПТИВ (профилактика «до»)

| Маркёр | + Препарат | Доза |
|--------|-----------|------|
| HDL < 1.0 | +Niacin | 500 мг на ночь |
| LDL > 3.0 | Bergamot ×2 | 1000 мг |
| ALT > 40 | +Milk thistle 280 (если нет) | - |
| HCT > 50 | +Serrapeptase 10 + Bromelain 500 | - |
| E2 > 40 | ↑Anastrozole 3р/нед | - |
| Prolactin > 15 | +Cabergoline 0.25 2р/нед | - |
| Glucose > 5.6 | +Berberine 1500 | - |
| Insulin > 10 | +Berberine + L-Carnitine 2 г | - |
| TSH > 4 | +Selenium 200 мкг | - |
| Cortisol > 535 | +Phosphatidylserine 300 | - |
| Ferritin < 30 | +Iron bisglycinate 30 мг + VitC | - |
| VitD < 30 | D3 ↑10000 МЕ + K2 200 | - |
| HOMA-IR > 2.5 | +L-Carnitine 2 г + Berberine 2000 | - |
| Homocysteine > 10 | TMG ↑1500 + B6 ↑50 + B12 ↑2000 | - |
| Creatinine > 105 | +Astragalus 500 (если нет) | - |

## TIER 2 — ЛЕЧЕНИЕ: ТИТРАЦИЯ

| Маркёр | Действие |
|--------|---------|
| ALT 80-200 | TUDCA ↑1000 мг, silymarin ↑600, **отменить оральные AAS** |
| HCT 54-58 | **кровопускание 300-450 мл**, serra 20 + aspirin 100 |
| LDL 3.5-5 | Bergamot 1000 + Niacin 1000 + Garlic 1200 + omega3 4 г |
| HDL < 0.6 | Niacin 1500 + L-Carnitine 2 г |
| E2 60-100 | **Anastrozole 1 мг/день** немедленно + рассмотреть SERM |
| Prolactin 25-50 | Cabergoline ↑0.5 мг 2р/нед |
| Glucose 6.1-11 | Berberine 2000 + **STOP GH** + lowcarb |
| HbA1c 6.4-8 | **STOP GH + GO TO endo** |
| TSH 6-10 | Selenium 200 + D3↑ + проверить ferritin/folate |
| Creatinine 130-200 | Astragalus↑1000 + Cordyceps↑2000 + ↓dose AAS |
| Proteinuria 0.5-1 | Telmisartan↑80 + ↓ protein 1.8 г/кг |
| Fibrinogen > 5.5 | Nattokinase↑200 + serra 20 + omega3 4 |
| D-dimer 1-2.5 | +Aspirin 100 + serra 20 + ⚠ врач |
| HOMA-IR 3.5-5 | +Metformin 500-1000 (через врача) |
| Platelets > 450 | +Aspirin 100 мг |

## TIER 3 — ⛔ ЭКСТРЕННО

| Маркёр | Действие | Баннер |
|--------|---------|--------|
| ALT > 200 | STOP AAS немедленно | ⛔ «3×ULN. Отмена. Повтор через 7 дней. Желтуха → ER» |
| AST > 200 | STOP | ⛔ |
| HCT > 60 | Кровопускание 450 мл СРОЧНО + STOP | ⛔ Полицитемия. Гипервязкость |
| Hemoglobin > 200 | STOP + врач | ⛔ Полицитемия |
| D-dimer > 2.5 | STOP + ER | ⛔ Тромбоэмболия |
| Creatinine > 200 | STOP + нефролог | ⛔ ОПН risk |
| eGFR < 30 | STOP + нефролог | ⛔ ХБП ст.4 |
| Bilirubin > 100 | STOP + infectious diseases | ⛔ Гепатит? |
| Glucose > 11 | GO TO endo | ⛔ Кетоз, insulin |
| HbA1c > 8 | GO TO endo | ⛔ Декомпенсация |
| Cortisol > 1000 | GO TO endo | ⛔ Кушингоид? |
| Prolactin > 50 | GO TO endo | ⛔ Пролактинома? |
| E2 > 100 | ↑AI до 1 мг/д + SERM | ⛔ Гинекомастия risk |
| Potassium < 2.5 / > 6.5 | GO TO ER | ⛔ Cardiac arrest risk |
| Sodium < 125 / > 155 | GO TO ER | ⛔ ЦНС депрессия |
| TSH < 0.1 / > 10 | GO TO endo | ⛔ Тиреотоксикоз/гипотиреоз |
| CK > 5000 | STOP + врача | ⛔ Рабдомиолиз |
| Platelets < 100 / > 600 | STOP + врача | ⛔ Кровотечение/тромбоз |
| Troponin > 1 | GO TO ER | ⛔ Инфаркт |

---

## НУТРИЦИОЛОГИЧЕСКИЕ КОРРЕКТИРОВКИ (auto-apply)

### TIER 1
| Маркёр | Нутри-действие |
|--------|---------------|
| ALT↑ | ↓ fructose, ↓ alcohol ZERO, ↑ cruciferous (sulforaphane → Nrf2) |
| LDL↑ | ↓ sat-fat <7% kcal, +псиллиум 30 г (soluble fiber) |
| HDL↓ | ↓ trans-ZERO, + aerobic 30 мин 5×/нед |
| HCT↑ | +hydration 40+ мл/кг, ↓ iron ZERO |
| Glucose↑ | ↓ fast carbs, +fiber 30+ г, time-restricted eating 12 ч |
| BP↑ | ↓ sodium 2-3 г, ↑ potassium, +beetroot 500 г/нед |
| Creatinine↑ | ↓ protein 1.8 г/кг, ↓ creatine ZERO |
| CRP↑ | +curcumin, +omega3 4 г, + рыб 3×/нед |
| Homocysteine↑ | TMG↑ + ↑ овощи (folate) |
| Cortisol↑ | +phosphatidylserine, ↓ caffeine, sleep 8+ ч |

### TIER 2
| Маркёр | Нутри-действие |
|--------|---------------|
| ALT 80-200 | ↓ protein 1.8, ↓ iron, ↓ Vitamin A ZERO, STOP alcohol ZERO |
| HCT 54-58 | **сдай кровь 300-450 мл**, hydration 45+ мл/кг, ZERO iron |
| LDL 3.5-5 | sat-fat <5% kcal, soluble fiber 50 г, omega3 4 г, STOP trans ZERO |
| HDL < 0.6 | aerobic 60 мин 5×/нед, STOP trans, niacin 1500 |
| Glucose > 6 | **lowcarb <50 г/день**, 2-3 meals spacing, morning walks |
| Insulin > 15 | **lowcarb <30 г**, intermittent fasting 16:8 |
| Creatinine > 130 | protein 1.6, STOP creatine, STOP NSAIDs, hydration 45+ |
| HbA1c 6.4-8 | full lowcarb + metformin (с врачом) |
| BP > 140 | DASH-diet, sodium 1.5-2 г, magnesium↑600, +beetroot 1 кг/нед |
| CRP > 10 | curcumin 1000, omega3 5 г, STOP alcohol, sleep 8+ |
| Homocysteine > 15 | +B6 100, +B12 2000, ↑ TMG 1500-3000 |

---

## НОВЫЕ ПРЕПАРАТЫ В SUPPORT_CATALOG_DATA

| # | substanceId | Название | Категория | Когда |
|---|-------------|---------|-----------|-------|
| 1 | niacin | Ниацин (B3) | vitamin | HDL↓ first-line |
| 2 | l_carnitine | L-Карнитин | amino | липиды, митохондрии |
| 3 | phosphatidylserine | Фосфатидилсерин | other | кортизол↑ |
| 4 | glycine | Глицин | amino | сон, глутатион |
| 5 | theanine | L-Теанин | amino | тревога, сон |
| 6 | saw_palmetto | Saw Palmetto | pharma | простата (по симптомам) |
| 7 | quercetin | Кверцетин | antioxidant | Nrf2, ↓ CRP |
| 8 | garlic | Чеснок (экстракт) | cardioprotector | BP, липиды |
| 9 | beetroot | Beetroot extract | cardioprotector | NO nitrates |
| 10 | aspirin | Аспирин | pharma | тромбоциты, TIER 2-3 |
| 11 | lecithin | Лецитин (ФХ) | hepatoprotector | bile, мембраны |
| 12 | iron_bisglycinate | Iron bisglycinate | mineral | ferritin low |

---

## АРХИТЕКТУРА КОДА

### 1. Новый файл `src/data/lab-tier-ranges.ts`
```ts
export interface LabTierThreshold {
  marker: string;
  normal: [number, number];
  borderline: [number, number];
  treatment: [number, number];
  emergencyLow?: number;
  emergencyHigh?: number;
  direction: 'high' | 'low' | 'both';
  unit?: string;
}

export const LAB_TIERS: Record<string, LabTierThreshold> = {
  ALT: { normal:[0,40], borderline:[40,80], treatment:[80,200], emergencyHigh:200, direction:'high', unit:'U/L' },
  // ... ~60 маркёров
};

export function deriveTier(marker: string, value: number): 0|1|2|3 { /* ... */ }
```

### 2. Новый файл `src/data/lab-tier-recommendations.ts`
```ts
export interface TierTreatment {
  marker: string;
  tier: 0|1|2|3;
  addSubs?: Array<{ id: string; dose?: string; reason: string }>;
  titrateSubs?: Array<{ id: string; factor: number; reason: string }>;
  nutrition?: Array<{ action: string; target: string }>;
  alerts?: string[];
  stopCourse?: boolean;
}

export const TIER_TREATMENTS: TierTreatment[] = [ /* ... */ ];
export function getTierTreatments(marker: string, tier: 0|1|2|3): TierTreatment | null { /* ... */ }
```

### 3. `tz-mapper-engine.ts` — `computeTierAdjustments(labs)`
```ts
export interface TierAdjustmentResult {
  addSubs: Array<{ id: string; reason: string; tier: 0|1|2|3 }>;
  titrationFactors: Map<string, number>;  // substanceId → dose multiplier
  nutritionTips: string[];
  alerts: string[];
  stopCourse: boolean;
}

function computeTierAdjustments(labs: Record<string, number>): TierAdjustmentResult { /* ... */ }
```

### 4. `buildRecommendation` обогащение
- Вызвать `computeTierAdjustments(ctx.labs)`
- Добавить `addSubs` в `subs` с пометкой tier
- Применить `titrationFactors` к дозам протокольных subs
- `rec.alerts` для TIER 3
- `rec.stopCourse` flag

### 5. `Calc.mapper.tsx` — UI
- TIER-3 баннер красным (если `rec.alerts.length > 0`)
- Дозы `↑150%` badge рядом с веществом при titration
- Нутри-блок «Корректировки по анализам» (nutrition tips)
- Per-marker клик → объяснение

### 6. `AutoCalculator.tsx` — одна кнопка
- «Выдать поддержку» (интеллектуальный режим) → resolvePlan + tier adjustments + base
- «Усилить» (boost) → отдельно (суставы, связки)

---

## ПРИМЕР ВЫВОДА (HCT 56 + ALT 95 + E2 72, TEST+TREN)

```
Протокол: 28 препаратов (тест+трен)

   TIER-2 АДАПТАЦИЯ по анализам:
   ─────────────────────────────
   HCT 56 → +Serra 20 + Bromelain 1000 + Aspirin 100
            + кровопускание 300 мл (рекомендация)
            + hydration 45 мл/кг, STOP iron
   ALT 95 → TUDCA ↑1000 мг (было 500)
            + Milk thistle 280 мг
            + ↓ fructose, ↓ alcohol ZERO
   E2  72 → Anastrozole ↑1 мг/день (было 0.5 2р/нед)

⛔ КРИТИЧНО: нет
```

---

## ПОРЯДОК РЕАЛИЗАЦИИ

1. `src/data/lab-tier-ranges.ts` — пороги + deriveTier
2. `src/data/lab-tier-recommendations.ts` — TIER_TREATMENTS
3. `tz-mapper-engine.ts` — computeTierAdjustments + buildRecommendation обогащение
4. 12 новых препаратов в `SUPPORT_CATALOG_DATA`
5. `Calc.mapper.tsx` — TIER-3 баннеры, titration badges, нутри-блок
6. `AutoCalculator.tsx` — одна кнопка
7. `AGENTS.md` — документация