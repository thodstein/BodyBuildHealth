/**
 * symptom-priority-engine.ts — Приоритетный движок симптомов
 *
 * Из выбранных пользователем симптомов формирует:
 *   1. Список рекомендуемых веществ (из решений симптомов)
 *   2. Приоритет urgency (critical > warning > standard)
 *   3. Группировку по системам организма
 *   4. Partial<CalculatorState> для передачи в calcSupport
 */
import type { SymptomEntry, UrgencyLevel } from './symptom-solver.types';
import { resolveCatalogId, isLifestyleOnly } from './symptom-catalog-bridge';

export interface SelectedSymptom {
  symptomId: string;
  symptomName: string;
  category: string;
  urgency: UrgencyLevel;
  problemIndex: number | null; // null = все проблемы
}

export interface SymptomDerivedPlan {
  /** Уникальные catalog-ключи веществ для добавления в план */
  substanceIds: string[];
  /** Системы организма, требующие внимания */
  targetSystems: string[];
  /** Уровень тревоги (максимальный из выбранных симптомов) */
  maxUrgency: UrgencyLevel;
  /** Количество задействованных симптомов */
  symptomCount: number;
  /** Краткое описание для UI */
  description: string;
  /** Флаг: нужна ли консультация врача */
  requiresDoctor: boolean;
}

/** Веса urgency для сортировки */
const URGENCY_WEIGHT: Record<UrgencyLevel, number> = {
  critical: 3,
  warning: 2,
  standard: 1,
};

/** Из массива выбранных симптомов → план поддержки */
export function derivePlanFromSymptoms(
  symptoms: SymptomEntry[],
  selectedProblemIndices: Record<string, number[]>
): SymptomDerivedPlan {
  const substanceSet = new Set<string>();
  const systemSet = new Set<string>();
  let maxUrgency: UrgencyLevel = 'standard';
  let requiresDoctor = false;

  const catToSystem: Record<string, string[]> = {
    cardiovascular: ['cardio', 'hematologic'],
    hepatic: ['hepatic'],
    renal: ['renal'],
    cns: ['neuro', 'cns'],
    endocrine: ['endocrine', 'reproductive'],
    gastrointestinal: ['hepatic', 'renal'],
    musculoskeletal: ['musculoskeletal'],
    hematologic: ['hematologic'],
    dermatologic: ['endocrine'],
    psychological: ['neuro', 'cns'],
  };

  for (const sym of symptoms) {
    // urgency
    if (URGENCY_WEIGHT[sym.urgency || 'standard'] > URGENCY_WEIGHT[maxUrgency]) {
      maxUrgency = sym.urgency || 'standard';
    }
    if (sym.urgency === 'critical') requiresDoctor = true;

    // системы
    const sysList = catToSystem[sym.category] || [sym.category];
    for (const s of sysList) systemSet.add(s);

    // проблемы и их решения
    const indices = selectedProblemIndices[sym.id];
    const problemsToScan = indices && indices.length > 0
      ? sym.problems.filter((_, i) => indices.includes(i))
      : sym.problems;

    for (const prob of problemsToScan) {
      for (const sol of prob.solutions) {
        if (sol.type === 'lifestyle') continue;
        const catalogId = resolveCatalogId(sol.substanceId);
        if (catalogId) {
          substanceSet.add(catalogId);
        }
      }
    }
  }

  const substanceIds = Array.from(substanceSet);
  const description = buildDescription(symptoms, maxUrgency);

  return {
    substanceIds,
    targetSystems: Array.from(systemSet),
    maxUrgency,
    symptomCount: symptoms.length,
    description,
    requiresDoctor,
  };
}

/** Сформировать описание для UI */
function buildDescription(symptoms: SymptomEntry[], urgency: UrgencyLevel): string {
  const names = symptoms.map((s) => s.symptom);
  if (names.length === 0) return 'Нет выбранных симптомов';
  if (names.length <= 3) return names.join(', ');
  return `${names.slice(0, 3).join(', ')} +${names.length - 3}`;
}

/** Получить флаг срочности для UI */
export function getUrgencyLabel(urgency: UrgencyLevel): string {
  const labels: Record<UrgencyLevel, string> = {
    critical: '🔴 Требует немедленной консультации врача',
    warning: '🟡 Требует внимания',
    standard: '🟢 Стандартная коррекция',
  };
  return labels[urgency];
}

/** Сгруппировать вещества по системам для отображения */
export function groupSubstancesBySystem(
  substanceIds: string[],
  catalogData: Record<string, any>
): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  for (const id of substanceIds) {
    const entry = catalogData[id] || catalogData[id.toUpperCase()] || catalogData[id.toLowerCase()];
    const systems = entry?.systems || ['other'];
    for (const sys of systems) {
      if (!groups[sys]) groups[sys] = [];
      if (!groups[sys].includes(id)) groups[sys].push(id);
    }
  }
  return groups;
}
