/**
 * symptom-lab-link.ts — Лабораторная подсветка симптомов
 *
 * Анализирует lab-данные и автоматически подсвечивает релевантные симптомы,
 * указывая на возможную причину. Используется в SymptomSolverTab и отчётах.
 *
 * v2: + симптом → проблемная панель (symptom-panel-bridge)
 */
import type { SymptomEntry } from './symptom-solver.types';
import { findSymptomById } from './symptom-solver.engine';

export interface LabLinkedSymptom {
  symptomId: string;
  symptomName: string;
  severity: number;
  labMarker: string;
  labValue: number;
  labUnit: string;
  labStatus: 'high' | 'low' | 'normal';
  relevance: number; // 0.0–1.0 насколько сильно лаборатория объясняет симптом
  explanation: string;
}

export interface LabLinkResult {
  linked: LabLinkedSymptom[];
  alerts: string[];
}

/** Карта: labMarker → { symptomIds, direction, relevance, explanation template } */
interface LabLinkRule {
  symptomIds: string[];
  direction: 'high' | 'low';
  relevance: number;
  explanation: (val: number, uln: number) => string;
}

const LAB_LINK_RULES: Record<string, LabLinkRule> = {
  ALT: {
    symptomIds: [
      'liver_pain', 'nausea', 'jaundice', 'fatigue', 'weakness',
      'gi_discomfort', 'appetite_loss',
    ],
    direction: 'high',
    relevance: 0.7,
    explanation: (v, n) => `АЛТ ${v} (норма ${n}) — цитолиз гепатоцитов, объясняет тяжесть/тошноту/утомляемость`,
  },
  AST: {
    symptomIds: ['fatigue', 'weakness', 'liver_pain', 'nausea'],
    direction: 'high',
    relevance: 0.6,
    explanation: (v, n) => `АСТ ${v} (норма ${n}) — повреждение гепатоцитов/митохондрий`,
  },
  GGT: {
    symptomIds: ['nausea', 'gi_discomfort', 'appetite_loss', 'liver_pain', 'jaundice'],
    direction: 'high',
    relevance: 0.6,
    explanation: (v, n) => `ГГТ ${v} (норма ${n}) — холестаз/билиарная гипертензия`,
  },
  BILIRUBIN_TOTAL: {
    symptomIds: ['jaundice', 'nausea', 'fatigue', 'yellow_eyes'],
    direction: 'high',
    relevance: 0.8,
    explanation: (v, n) => `Билирубин ${v} (норма ${n}) — гипербилирубинемия, желтушность`,
  },
  CREATININE: {
    symptomIds: ['lower_back_pain', 'edema', 'fatigue', 'urine_foam'],
    direction: 'high',
    relevance: 0.6,
    explanation: (v, n) => `Креатинин ${v} (норма ${n}) — почечная дисфункция`,
  },
  UREA: {
    symptomIds: ['fatigue', 'nausea', 'appetite_loss', 'edema'],
    direction: 'high',
    relevance: 0.5,
    explanation: (v, n) => `Мочевина ${v} (норма ${n}) — азотемия, уремическая интоксикация`,
  },
  GLUCOSE: {
    symptomIds: [
      'hypoglycemia_symptoms', 'thirst', 'frequent_urination',
      'fatigue', 'blurred_vision', 'headache',
    ],
    direction: 'high',
    relevance: 0.7,
    explanation: (v, n) => `Глюкоза ${v} (норма ${n}) — гипергликемия`,
  },
  GLUCOSE_LOW: {
    symptomIds: [
      'hypoglycemia_symptoms', 'sweating', 'tremor', 'weakness',
      'anxiety', 'palpitations',
    ],
    direction: 'low',
    relevance: 0.8,
    explanation: (v, n) => `Глюкоза ${v} (норма ${n}↓) — гипогликемия`,
  },
  HEMOGLOBIN: {
    symptomIds: ['fatigue', 'weakness', 'dizziness', 'pale_skin', 'dyspnea'],
    direction: 'low',
    relevance: 0.7,
    explanation: (v, n) => `Гемоглобин ${v} (норма ${n}) — анемия`,
  },
  HEMATOCRIT: {
    symptomIds: ['fatigue', 'dizziness', 'headache', 'flushed_skin', 'hypertension_symptoms'],
    direction: 'high',
    relevance: 0.5,
    explanation: (v, n) => `Гематокрит ${v} (норма ${n}) — полицитемия, сгущение крови`,
  },
  POTASSIUM: {
    symptomIds: ['muscle_cramps', 'weakness', 'palpitations', 'fatigue'],
    direction: 'low',
    relevance: 0.6,
    explanation: (v, n) => `K+ ${v} (норма ${n}) — гипокалиемия, судороги/аритмия`,
  },
  POTASSIUM_HIGH: {
    symptomIds: ['muscle_weakness', 'palpitations', 'nausea', 'tingling'],
    direction: 'high',
    relevance: 0.6,
    explanation: (v, n) => `K+ ${v} (норма ${n}) — гиперкалиемия`,
  },
  SODIUM: {
    symptomIds: ['headache', 'nausea', 'confusion', 'fatigue', 'edema'],
    direction: 'low',
    relevance: 0.5,
    explanation: (v, n) => `Na+ ${v} (норма ${n}) — гипонатриемия, задержка воды`,
  },
  TSH: {
    symptomIds: ['fatigue', 'mood_swings', 'insomnia', 'anxiety', 'weight_general'],
    direction: 'high',
    relevance: 0.5,
    explanation: (v, n) => `ТТГ ${v} (норма ${n}) — гипотиреоз, утомляемость/апатия`,
  },
  TSH_LOW: {
    symptomIds: ['insomnia', 'anxiety', 'tachycardia', 'sweating', 'weight_loss'],
    direction: 'low',
    relevance: 0.5,
    explanation: (v, n) => `ТТГ ${v} (норма ${n}↓) — гипертиреоз`,
  },
  CRP: {
    symptomIds: ['joint_pain', 'fatigue', 'fever', 'malaise', 'sweating'],
    direction: 'high',
    relevance: 0.6,
    explanation: (v, n) => `СРБ ${v} (норма ${n}) — системное воспаление`,
  },
  LDL: {
    symptomIds: ['hypertension_symptoms', 'fatigue', 'dizziness'],
    direction: 'high',
    relevance: 0.3,
    explanation: (v, n) => `ЛПНП ${v} (норма ${n}) — дислипидемия, фактор риска ССС`,
  },
  ESTRADIOL: {
    symptomIds: ['edema', 'mood_swings', 'libido_decrease', 'gynecomastia', 'blood_pressure_increase'],
    direction: 'high',
    relevance: 0.7,
    explanation: (v, n) => `E2 ${v} (норма ${n}) — гиперэстрогения, задержка воды/гинекомастия`,
  },
  ESTRADIOL_LOW: {
    symptomIds: ['joint_pain', 'libido_decrease', 'mood_swings', 'insomnia'],
    direction: 'low',
    relevance: 0.6,
    explanation: (v, n) => `E2 ${v} (норма ${n}↓) — гипоэстрогения, сухость суставов/либидо`,
  },
  PROLACTIN: {
    symptomIds: ['libido_decrease', 'mood_swings', 'gynecomastia', 'fatigue'],
    direction: 'high',
    relevance: 0.6,
    explanation: (v, n) => `Пролактин ${v} (норма ${n}) — гиперпролактинемия`,
  },
  TROPONIN: {
    symptomIds: ['chest_pain', 'palpitations', 'syncope', 'dyspnea'],
    direction: 'high',
    relevance: 0.9,
    explanation: (v, n) => `Тропонин ${v} (норма ${n}) — повреждение миокарда, ОКС/миокардит`,
  },
  D_DIMER: {
    symptomIds: ['chest_pain', 'dyspnea', 'lower_back_pain', 'hemoptysis', 'syncope'],
    direction: 'high',
    relevance: 0.8,
    explanation: (v, n) => `D-димер ${v} (норма ${n}) — тромбоз/ТЭЛА, необходима КТ-ангиография`,
  },
  HBA1C: {
    symptomIds: ['polydipsia', 'thirst', 'frequent_urination', 'fatigue', 'hypoglycemia_symptoms'],
    direction: 'high',
    relevance: 0.7,
    explanation: (v, n) => `HbA1c ${v} (норма ${n}) — гипергликемия/СД на курсе (контринсулярный эффект GH + ААС)`,
  },
  CALCIUM: {
    symptomIds: ['fatigue', 'weakness', 'polydipsia', 'thirst', 'constipation'],
    direction: 'high',
    relevance: 0.5,
    explanation: (v, n) => `Ca++ ${v} (норма ${n}) — гиперкальциемия (мобилизация из костей, GH, гиперпаратиреоз)`,
  },
  URIC_ACID: {
    symptomIds: ['joint_pain', 'lower_back_pain', 'edema', 'hypertension_symptoms'],
    direction: 'high',
    relevance: 0.5,
    explanation: (v, n) => `МК ${v} (норма ${n}) — гиперурикемия (ААС ↑ пуриновый обмен), риск подагры/камней`,
  },
};

/** Дефолтные нормы для маркеров */
const LAB_NORMS: Record<string, { low: number; high: number; unit: string }> = {
  ALT: { low: 0, high: 40, unit: 'Ед/л' },
  AST: { low: 0, high: 40, unit: 'Ед/л' },
  GGT: { low: 0, high: 55, unit: 'Ед/л' },
  BILIRUBIN_TOTAL: { low: 0, high: 21, unit: 'мкмоль/л' },
  CREATININE: { low: 60, high: 110, unit: 'мкмоль/л' },
  UREA: { low: 2.5, high: 8.3, unit: 'ммоль/л' },
  GLUCOSE: { low: 3.3, high: 5.5, unit: 'ммоль/л' },
  GLUCOSE_LOW: { low: 2.5, high: 3.9, unit: 'ммоль/л' },
  HEMOGLOBIN: { low: 130, high: 170, unit: 'г/л' },
  HEMATOCRIT: { low: 40, high: 50, unit: '%' },
  POTASSIUM: { low: 3.5, high: 5.1, unit: 'ммоль/л' },
  POTASSIUM_HIGH: { low: 3.5, high: 5.1, unit: 'ммоль/л' },
  SODIUM: { low: 136, high: 145, unit: 'ммоль/л' },
  TSH: { low: 0.4, high: 4.0, unit: 'мМЕ/л' },
  TSH_LOW: { low: 0.4, high: 4.0, unit: 'мМЕ/л' },
  CRP: { low: 0, high: 5, unit: 'мг/л' },
  LDL: { low: 0, high: 3.0, unit: 'ммоль/л' },
  ESTRADIOL: { low: 0, high: 200, unit: 'пмоль/л' },
  ESTRADIOL_LOW: { low: 60, high: 200, unit: 'пмоль/л' },
  PROLACTIN: { low: 80, high: 400, unit: 'мМЕ/л' },
  TROPONIN: { low: 0, high: 0.04, unit: 'нг/мл' },
  D_DIMER: { low: 0, high: 500, unit: 'нг/мл' },
  HBA1C: { low: 0, high: 6.0, unit: '%' },
  CALCIUM: { low: 2.15, high: 2.55, unit: 'ммоль/л' },
  URIC_ACID: { low: 200, high: 420, unit: 'мкмоль/л' },
};

/** Основная функция: лаборатория → подсвеченные симптомы */
export function linkSymptomsToLabs(
  labValues: Record<string, number>,
  activeSymptomIds: string[]
): LabLinkResult {
  const linked: LabLinkedSymptom[] = [];
  const alerts: string[] = [];

  for (const [marker, value] of Object.entries(labValues)) {
    // Прямой маркер
    const directKey = marker.toUpperCase();
    const rule = LAB_LINK_RULES[directKey];
    if (rule) {
      const norm = LAB_NORMS[directKey];
      if (!norm) continue;
      const isOutOfRange = rule.direction === 'high'
        ? value > norm.high
        : value < norm.low;
      if (!isOutOfRange) continue;

      // Подсвечиваем только активные симптомы
      for (const symId of rule.symptomIds) {
        if (!activeSymptomIds.includes(symId)) continue;
        linked.push({
          symptomId: symId,
          symptomName: findSymptomById(symId)?.symptom || symId,
          severity: 5,
          labMarker: directKey,
          labValue: value,
          labUnit: norm.unit,
          labStatus: rule.direction,
          relevance: rule.relevance,
          explanation: rule.explanation(value, norm.high),
        });
      }

      alerts.push(
        `${directKey} ${value} ${norm.unit} — ${rule.direction === 'high' ? '↑' : '↓'} ` +
        `(норма ${norm.low}–${norm.high})`
      );
    }

    // Обратный маркер (GLUCOSE_LOW для низкой глюкозы)
    const reverseKey = `${directKey}_LOW`;
    const reverseRule = LAB_LINK_RULES[reverseKey];
    if (reverseRule) {
      const norm = LAB_NORMS[reverseKey];
      if (!norm) continue;
      const isLow = value < norm.low;
      if (!isLow) continue;

      for (const symId of reverseRule.symptomIds) {
        if (!activeSymptomIds.includes(symId)) continue;
        linked.push({
          symptomId: symId,
          symptomName: findSymptomById(symId)?.symptom || symId,
          severity: 5,
          labMarker: directKey,
          labValue: value,
          labUnit: norm.unit,
          labStatus: 'low',
          relevance: reverseRule.relevance,
          explanation: reverseRule.explanation(value, norm.high),
        });
      }
    }
  }

  // Дедупликация (один симптом может быть подсвечен несколькими маркерами — берём макс relevance)
  const dedup = new Map<string, LabLinkedSymptom>();
  for (const item of linked) {
    const existing = dedup.get(item.symptomId);
    if (!existing || item.relevance > existing.relevance) {
      dedup.set(item.symptomId, item);
    }
  }

  return {
    linked: Array.from(dedup.values()).sort((a, b) => b.relevance - a.relevance),
    alerts: [...new Set(alerts)],
  };
}

/** Получить норму для маркера */
export function getLabNorm(marker: string): { low: number; high: number; unit: string } | null {
  const key = marker.toUpperCase();
  return LAB_NORMS[key] || null;
}

/** Все известные lab-маркеры */
export function getAllLabMarkers(): string[] {
  return Object.keys(LAB_NORMS);
}

// ═══════════════════════════════════════════════════════════
//  СИМПТОМ → ПРОБЛЕМНАЯ ПАНЕЛЬ (v2)
// ═══════════════════════════════════════════════════════════

/** Карта: symptomId → рекомендуемые problemPanel ids */
const SYMPTOM_PANEL_MAP: Record<string, string[]> = {
  liver_pain: ['hepatotoxicity_workup'],
  nausea: ['hepatotoxicity_workup'],
  jaundice: ['hepatotoxicity_workup'],
  yellow_eyes: ['hepatotoxicity_workup'],
  appetite_loss: ['hepatotoxicity_workup'],
  gi_discomfort: ['hepatotoxicity_workup'],

  gynecomastia: ['gynecomastia_workup'],
  edema: ['gynecomastia_workup', 'hypertension_workup', 'renal_workup'],

  hypertension_symptoms: ['hypertension_workup', 'cardio_full'],
  headache: ['hypertension_workup', 'polycythemia_workup'],
  dizziness: ['hypertension_workup', 'polycythemia_workup'],
  dyspnea: ['cardio_full', 'polycythemia_workup'],
  chest_pain: ['cardio_full', 'emergency_chest_pain'],
  syncope: ['cardio_full', 'emergency_syncope'],
  hemoptysis: ['cardio_full', 'emergency_hemoptysis'],
  hypertensive_crisis: ['hypertension_workup', 'emergency_hypertension'],
  polydipsia: ['hormone_passport', 'nutritional_passport'],
  palpitations: ['cardio_full', 'ed_libido_workup'],

  flushed_skin: ['polycythemia_workup'],
  fatigue: ['hepatotoxicity_workup', 'renal_workup', 'neurotoxicity_workup', 'hpta_recovery_fail', 'hormone_passport', 'nutritional_passport'],
  weakness: ['hpta_recovery_fail', 'nutritional_passport'],

  lower_back_pain: ['renal_workup'],
  urine_foam: ['renal_workup'],

  libido_decrease: ['ed_libido_workup', 'hpta_recovery_fail', 'hormone_passport'],
  mood_swings: ['hpta_recovery_fail', 'neurotoxicity_workup', 'gynecomastia_workup'],

  anxiety: ['neurotoxicity_workup'],
  insomnia: ['neurotoxicity_workup', 'ed_libido_workup'],

  muscle_cramps: ['nutritional_passport'],
  joint_pain: ['joint_pain_workup'],
};

/**
 * Получить рекомендуемые проблемные панели для симптома
 */
export function getProblemPanelsForSymptom(symptomId: string): string[] {
  return SYMPTOM_PANEL_MAP[symptomId] || [];
}

/**
 * Получить рекомендуемые панели для списка симптомов (дедуплицированные)
 */
export function getProblemPanelsForSymptoms(symptomIds: string[]): string[] {
  const panels = new Set<string>();
  for (const id of symptomIds) {
    for (const p of getProblemPanelsForSymptom(id)) {
      panels.add(p);
    }
  }
  return Array.from(panels);
}
