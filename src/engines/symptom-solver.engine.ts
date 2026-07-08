import type { SymptomEntry, SymptomCategory } from './symptom-solver.types';
import { SYMPTOM_DB } from './symptom-solver.data';
// Реэкспорт для внешних потребителей
export { SYMPTOM_DB } from './symptom-solver.data';
export type { SymptomEntry, SymptomCategory, UrgencyLevel, ProblemEntry, LabMarker, SolutionEntry, ExpectationEntry } from './symptom-solver.types';
export function findSymptomById(id: string): SymptomEntry | undefined {
  return SYMPTOM_DB.find((s) => s.id === id);
}

/** Поиск симптомов по категории */
export function findSymptomsByCategory(cat: SymptomCategory): SymptomEntry[] {
  return SYMPTOM_DB.filter((s) => s.category === cat);
}

/** Поиск симптомов по тексту (название, проблемы, механизмы) */
export function searchSymptoms(query: string): SymptomEntry[] {
  const q = query.toLowerCase();
  return SYMPTOM_DB.filter(
    (s) =>
      s.symptom.toLowerCase().includes(q) ||
      s.generalInfo.toLowerCase().includes(q) ||
      s.problems.some(
        (p) =>
          p.problem.toLowerCase().includes(q) ||
          p.mechanism.toLowerCase().includes(q)
      )
  );
}

/** Поиск симптомов по препарату (linkedDrugs) */
export function findSymptomsByDrug(drugId: string): SymptomEntry[] {
  return SYMPTOM_DB.filter(
    (s) => s.linkedDrugs && s.linkedDrugs.includes(drugId)
  );
}

/** Получить все уникальные препараты, связанные с симптомами */
export function getAllLinkedDrugs(): string[] {
  const set = new Set<string>();
  for (const s of SYMPTOM_DB) {
    if (s.linkedDrugs) for (const d of s.linkedDrugs) set.add(d);
  }
  return Array.from(set).sort();
}

/** Сгруппировать симптомы по препаратам (Drug → Symptom[]) */
export function getDrugSymptomMap(): Record<string, SymptomEntry[]> {
  const map: Record<string, SymptomEntry[]> = {};
  for (const s of SYMPTOM_DB) {
    if (s.linkedDrugs) {
      for (const d of s.linkedDrugs) {
        if (!map[d]) map[d] = [];
        map[d].push(s);
      }
    }
  }
  return map;
}

/** Статистика базы */
export function getSymptomStats(): { totalSymptoms: number; totalProblems: number; totalSolutions: number; criticalCount: number; warningCount: number } {
  let totalProblems = 0;
  let totalSolutions = 0;
  let criticalCount = 0;
  let warningCount = 0;
  for (const s of SYMPTOM_DB) {
    totalProblems += s.problems.length;
    totalSolutions += s.problems.reduce((acc, p) => acc + p.solutions.length, 0);
    if (s.urgency === 'critical') criticalCount++;
    if (s.urgency === 'warning') warningCount++;
  }
  return {
    totalSymptoms: SYMPTOM_DB.length,
    totalProblems,
    totalSolutions,
    criticalCount,
    warningCount,
  };
}