/**
 * symptom-solver.engine.ts — Профессиональный движок: Симптом → Проблема → Анализ → Решение
 * 
 * Охватывает 50+ симптомов, характерных для пользователей ААС, спортсменов и биохакеров.
 * Каждая запись: клинически обоснованные дифференциальные диагнозы, лабораторные маркеры,
 */

export type UrgencyLevel = 'critical' | 'warning' | 'standard';

export interface SymptomEntry {
  id: string;
  symptom: string;
  category: SymptomCategory;
  problems: ProblemEntry[];
  generalInfo: string;
  urgency?: UrgencyLevel;
  relatedSymptoms?: string[];
  quickFacts?: string[];
  linkedDrugs?: string[];
}

export interface ProblemEntry {
  problem: string;
  probability: 'high' | 'medium' | 'low';
  mechanism: string;
  labMarkers: LabMarker[];
  solutions: SolutionEntry[];
  expectations: ExpectationEntry[];
  /** Когда экстренно STOP — критерии немедленной отмены препарата */
  stopCriteria?: string[];
  /** Клинически значимые лекарственные взаимодействия */
  drugInteractions?: string[];
}

export interface LabMarker {
  marker: string;
  expectedChange: '↑' | '↑↑' | '↑↑↑' | '↓' | '↓↓' | '↔' | string;
  targetRange: string;
  when: string;
}

export interface SolutionEntry {
  substanceId: string;
  name: string;
  type: 'supplement' | 'pharma' | 'lifestyle';
  dose: string;
  mechanism: string;
  evidenceLevel: 'A' | 'B' | 'C';
}

export interface ExpectationEntry {
  timeline: string;
  effect: string;
  sideNote?: string;
}

export type SymptomCategory =
  | 'cardiovascular'
  | 'hepatic'
  | 'renal'
  | 'cns'
  | 'endocrine'
  | 'gastrointestinal'
  | 'musculoskeletal'
  | 'hematologic'
  | 'dermatologic'
  | 'psychological';

export const SYMPTOM_CATEGORY_LABELS: Record<SymptomCategory, string> = {
  cardiovascular: 'Сердечно-сосудистая',
  hepatic: 'Печень и гепатобилиарная',
  renal: 'Почки и мочевыделительная',
  cns: 'ЦНС и неврология',
  endocrine: 'Эндокринная и гормональная',
  gastrointestinal: 'ЖКТ и пищеварение',
  musculoskeletal: 'Опорно-двигательная',
  hematologic: 'Кровь и гемостаз',
  dermatologic: 'Кожа и дерматология',
  psychological: 'Психика и когнитивные',
};

export const SYMPTOM_CATEGORY_ICONS: Record<SymptomCategory, string> = {
  cardiovascular: '❤️',
  hepatic: '🫁',
  renal: '💧',
  cns: '🧠',
  endocrine: '⚕️',
  gastrointestinal: '🫀',
  musculoskeletal: '🦴',
  hematologic: '🩸',
  dermatologic: '🧴',
  psychological: '🧘',
};

export const PROBABILITY_LABELS: Record<string, string> = {
  high: 'Высокая',
  medium: 'Средняя',
  low: 'Низкая',
};

export const PROBABILITY_COLORS: Record<string, string> = {
  high: '#f44336',
  medium: '#ff9800',
  low: '#4caf50',
};

export const EVIDENCE_LABELS: Record<string, string> = {
  A: 'A — РКИ / мета-анализы',
  B: 'B — Когортные / суррогатные',
  C: 'C — Патофизиология / opinion',
};

export const EVIDENCE_COLORS: Record<string, string> = {
  A: '#4caf50',
  B: '#2196f3',
  C: '#ff9800',
};

export const URGENCY_LABELS: Record<UrgencyLevel, string> = {
  critical: 'Критическое — немедленно',
  warning: 'Требует внимания',
  standard: 'Стандартный',
};

export const URGENCY_COLORS: Record<UrgencyLevel, string> = {
  critical: '#f44336',
  warning: '#ff9800',
  standard: '#4caf50',
};

export const URGENCY_ICONS: Record<UrgencyLevel, string> = {
  critical: '🔴',
  warning: '🟡',
  standard: '🟢',
};