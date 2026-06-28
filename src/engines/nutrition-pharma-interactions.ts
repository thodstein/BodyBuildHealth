// ============================================================
// nutrition-pharma-interactions.ts
// Food ↔ Drug interaction matrix
// How nutrition affects drug absorption, metabolism, and efficacy
// ============================================================

export interface FoodDrugInteraction {
  foodGroup: string;       // 'dairy' | 'grapefruit' | 'high_fat' | 'high_fiber' | 'alcohol' | 'caffeine' | 'tyramine' | 'vitamin_k' | 'calcium' | 'iron' | etc.
  drugClass: string;       // 'testosterone' | 'trenbolone' | 'nandrolone' | 'oral_17aa' | 'sarm' | 'pct_serm' | 'pct_aromatase' | 'support' | etc.
  effect: string;          // What happens
  mechanism: string;       // Why
  recommendation: string;  // What to do
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

// ─── Comprehensive Food ↔ Drug Interaction Table ───

export const FOOD_DRUG_INTERACTIONS: FoodDrugInteraction[] = [
  // === DAIRY / CALCIUM ===
  { foodGroup: 'dairy', drugClass: 'oral_17aa', effect: 'Снижение абсорбции 17α-алкилированных ААС', mechanism: 'Кальций связывает желчные кислоты, снижая эмульгацию', recommendation: 'Интервал 2-3 часа между молочными продуктами и оральными ААС', severity: 'MEDIUM' },
  { foodGroup: 'dairy', drugClass: 'sarm', effect: 'Снижение биодоступности SARMs', mechanism: 'Кальций и казеин связывают SARMs в ЖКТ', recommendation: 'Принимать SARMs за 30 мин до еды или через 2 часа после молочных продуктов', severity: 'MEDIUM' },
  { foodGroup: 'calcium', drugClass: 'support', effect: 'Снижение абсорбции цинка и магния', mechanism: 'Конкурентное всасывание через DMT1 и TRPM6', recommendation: 'Интервал 2 часа между кальцием и цинком/магнием', severity: 'MEDIUM' },
  { foodGroup: 'calcium', drugClass: 'pct_aromatase', effect: 'Снижение риска остеопороза от AI', mechanism: 'Ингибиторы ароматазы снижают E2 → деминерализация костей', recommendation: 'Увеличить потребление кальция до 1200 мг/сут при приёме AI', severity: 'HIGH' },

  // === GRAPEFRUIT ===
  { foodGroup: 'grapefruit', drugClass: 'oral_17aa', effect: 'Повышение гепатотоксичности', mechanism: 'Фуранокумарины грейпфрута ингибируют CYP3A4 → замедление метаболизма', recommendation: 'Полностью исключить грейпфрут на курсе оральных ААС', severity: 'CRITICAL' },
  { foodGroup: 'grapefruit', drugClass: 'pct_serm', effect: 'Повышение концентрации SERM в крови', mechanism: 'Ингибирование CYP3A4 → снижение клиренса тамоксифена/кломифена', recommendation: 'Избегать грейпфрута при приёме тамоксифена', severity: 'HIGH' },
  { foodGroup: 'grapefruit', drugClass: 'pct_dopamine', effect: 'Повышение концентрации каберголина', mechanism: 'CYP3A4 ингибирование → риск гипотензии', recommendation: 'Исключить грейпфрут при приёме каберголина', severity: 'HIGH' },

  // === HIGH FAT ===
  { foodGroup: 'high_fat', drugClass: 'testosterone', effect: 'Замедление абсорбции инъекционных эфиров', mechanism: 'Жирная пища не влияет на инъекционные формы', recommendation: 'Нет ограничений для инъекций', severity: 'LOW' },
  { foodGroup: 'high_fat', drugClass: 'oral_17aa', effect: 'Повышение биодоступности на 20-30%', mechanism: 'Жиры усиливают эмульгацию и всасывание липофильных ААС', recommendation: 'Принимать оральные ААС с пищей, содержащей жиры (10-15г)', severity: 'MEDIUM' },
  { foodGroup: 'high_fat', drugClass: 'support', effect: 'Повышение усвоения жирорастворимых витаминов', mechanism: 'Жиры необходимы для абсорбции витаминов A, D, E, K, CoQ10', recommendation: 'Принимать D3, K2, CoQ10, витамин E с жирной пищей', severity: 'MEDIUM' },

  // === HIGH FIBER ===
  { foodGroup: 'high_fiber', drugClass: 'oral_17aa', effect: 'Снижение абсорбции на 15-25%', mechanism: 'Клетчатка связывает липофильные вещества в ЖКТ', recommendation: 'Интервал 1-2 часа между клетчаткой и оральными ААС', severity: 'MEDIUM' },
  { foodGroup: 'high_fiber', drugClass: 'support', effect: 'Снижение абсорбции минералов', mechanism: 'Фитаты в клетчатке хелатируют Zn, Fe, Ca, Mg', recommendation: 'Принимать минералы отдельно от продуктов с высоким содержанием клетчатки', severity: 'LOW' },

  // === ALCOHOL ===
  { foodGroup: 'alcohol', drugClass: 'oral_17aa', effect: 'Значительное усиление гепатотоксичности', mechanism: 'Аддитивное повреждение гепатоцитов + индукция CYP2E1', recommendation: 'ПОЛНОСТЬЮ ИСКЛЮЧИТЬ алкоголь на курсе оральных ААС', severity: 'CRITICAL' },
  { foodGroup: 'alcohol', drugClass: 'testosterone', effect: 'Усиление ароматизации', mechanism: 'Алкоголь повышает активность ароматазы → рост E2', recommendation: 'Ограничить алкоголь до минимума на курсе', severity: 'HIGH' },
  { foodGroup: 'alcohol', drugClass: 'trenbolone', effect: 'Усиление нейротоксичности', mechanism: 'Алкоголь + тренболон → аддитивное повреждение нейронов', recommendation: 'Категорически исключить алкоголь с тренболоном', severity: 'CRITICAL' },

  // === CAFFEINE ===
  { foodGroup: 'caffeine', drugClass: 'oral_17aa', effect: 'Дополнительная нагрузка на печень', mechanism: 'Кофеин метаболизируется CYP1A2 → конкуренция за ферменты печени', recommendation: 'Ограничить кофеин до 200 мг/сут на оральных ААС', severity: 'MEDIUM' },
  { foodGroup: 'caffeine', drugClass: 'trenbolone', effect: 'Усиление тревожности и тахикардии', mechanism: 'Аддитивная стимуляция ЦНС', recommendation: 'Снизить потребление кофеина на тренболоне', severity: 'MEDIUM' },
  { foodGroup: 'caffeine', drugClass: 'support', effect: 'Усиление эффекта жиросжигателей', mechanism: 'Синергия с термогениками (кофеин + EGCG + капсаицин)', recommendation: 'Комбинировать с зелёным чаем для термогенеза', severity: 'LOW' },

  // === HIGH PROTEIN ===
  { foodGroup: 'high_protein', drugClass: 'testosterone', effect: 'Усиление анаболического эффекта', mechanism: 'Белок + ААС → максимальная стимуляция mTOR и синтеза белка', recommendation: '2-2.5 г/кг белка в сутки на курсе', severity: 'LOW' },
  { foodGroup: 'high_protein', drugClass: 'trenbolone', effect: 'Максимальный антикатаболический эффект', mechanism: 'Тренболон блокирует кортизол → белок идёт только в рост', recommendation: '2.5-3 г/кг белка для максимального эффекта', severity: 'LOW' },
  { foodGroup: 'high_protein', drugClass: 'nandrolone', effect: 'Усиление синтеза коллагена', mechanism: 'Нандролон + белок → синергия для соединительной ткани', recommendation: '2-2.5 г/кг белка с желатином/костным бульоном', severity: 'LOW' },

  // === SODIUM ===
  { foodGroup: 'sodium', drugClass: 'testosterone', effect: 'Усиление задержки воды и гипертензии', mechanism: 'Тестостерон повышает реабсорбцию натрия → отёки', recommendation: 'Ограничить натрий до 3-4 г/сут, увеличить калий', severity: 'MEDIUM' },
  { foodGroup: 'sodium', drugClass: 'trenbolone', effect: 'Повышение АД', mechanism: 'Тренболон + натрий → выраженная гипертензия', recommendation: 'Строго ограничить натрий до 2-3 г/сут', severity: 'HIGH' },

  // === OMEGA-3 ===
  { foodGroup: 'omega3', drugClass: 'oral_17aa', effect: 'Защита печени и липидного профиля', mechanism: 'EPA/DHA ↓ воспаление, ↑ ЛПВП, ↓ оксидативный стресс', recommendation: '3-5 г омега-3 в сутки обязательно на оральных ААС', severity: 'LOW' },
  { foodGroup: 'omega3', drugClass: 'testosterone', effect: 'Улучшение липидного профиля', mechanism: 'Омега-3 компенсирует негативное влияние ААС на липиды', recommendation: '2-3 г омега-3 в сутки', severity: 'LOW' },

  // === VITAMIN K ===
  { foodGroup: 'vitamin_k', drugClass: 'oral_17aa', effect: 'Поддержка коагуляции при нагрузке на печень', mechanism: 'Витамин K необходим для синтеза факторов свёртывания', recommendation: 'Контролировать МНО, обеспечить достаток витамина K', severity: 'MEDIUM' },

  // === IRON ===
  { foodGroup: 'iron', drugClass: 'testosterone', effect: 'Усугубление полицитемии', mechanism: 'Тестостерон ↑ эритропоэз, железо усиливает', recommendation: 'Контролировать ферритин, не принимать препараты железа без дефицита', severity: 'HIGH' },
];

// ─── Lookup functions ───

export function getInteractionsByFood(foodGroup: string): FoodDrugInteraction[] {
  return FOOD_DRUG_INTERACTIONS.filter(i => i.foodGroup === foodGroup);
}

export function getInteractionsByDrug(drugClass: string): FoodDrugInteraction[] {
  return FOOD_DRUG_INTERACTIONS.filter(i => i.drugClass === drugClass);
}

export function getInteractionsBySeverity(severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'): FoodDrugInteraction[] {
  return FOOD_DRUG_INTERACTIONS.filter(i => i.severity === severity);
}

export function getCriticalInteractions(drugClass: string): FoodDrugInteraction[] {
  return FOOD_DRUG_INTERACTIONS.filter(i => i.drugClass === drugClass && (i.severity === 'CRITICAL' || i.severity === 'HIGH'));
}

// ─── Meal interaction checker ───

export interface MealInteractionCheck {
  foodGroupsInMeal: string[];
  drugClasses: string[];
  interactions: FoodDrugInteraction[];
  criticalWarnings: string[];
  recommendations: string[];
}

export function checkMealDrugInteractions(
  foodGroups: string[],
  drugClasses: string[],
): MealInteractionCheck {
  const interactions: FoodDrugInteraction[] = [];
  const warnings: string[] = [];
  const recs: string[] = [];

  for (const fg of foodGroups) {
    for (const dc of drugClasses) {
      const matches = FOOD_DRUG_INTERACTIONS.filter(i =>
        i.foodGroup === fg && i.drugClass === dc
      );
      for (const m of matches) {
        interactions.push(m);
        if (m.severity === 'CRITICAL') warnings.push(`🚫 ${m.effect}`);
        recs.push(m.recommendation);
      }
    }
  }

  return {
    foodGroupsInMeal: foodGroups,
    drugClasses,
    interactions,
    criticalWarnings: warnings,
    recommendations: [...new Set(recs)],
  };
}
