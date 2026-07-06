import { SUPPORT_CATALOG_DATA } from '../data/support-database';

/* ─── Symptom → Goal mapping ─── */
const SYMPTOM_GOAL_MAP: Record<string, string[]> = {
  fatigue: ['energy', 'recovery'],
  liver_pain: ['liver_health', 'detox'],
  nausea: ['liver_health', 'digestion'],
  jaundice: ['liver_health'],
  headache: ['cardio_health', 'recovery'],
  dizziness: ['cardio_health', 'energy'],
  palpitations: ['cardio_health', 'stress'],
  cramps: ['recovery', 'energy'],
  edema: ['cardio_health', 'kidney'],
  joint_pain: ['joints'],
  insomnia: ['sleep'],
  anxiety: ['stress', 'mood'],
  mood_swings: ['mood', 'hormones'],
  libido_decrease: ['libido', 'hormones'],
  gynecomastia: ['hormones'],
  acne: ['skin', 'hormones'],
  hair_loss: ['hair', 'hormones'],
  sweating: ['hormones'],
  tremor: ['stress'],
  thirst: ['kidney', 'energy'],
  hypoglycemia: ['energy'],
  flushed_skin: ['cardio_health'],
  bloating: ['digestion'],
  constipation: ['digestion'],
  diarrhea: ['digestion'],
};

/* ─── Get symptom diary data ─── */
interface SymptomEntry { date: string; severity: number; }
interface SymptomDiaryData { [symptomId: string]: SymptomEntry[]; }

function loadSymptomDiary(): SymptomDiaryData {
  try { return JSON.parse(localStorage.getItem('he_symptom_diary') || '{}'); } catch { return {}; }
}

/* ─── Stack-effectiveness feedback ─── */
export interface FeedbackResult {
  overallScore: number;          // 0-100: how well is the stack working
  improvingGoals: string[];
  worseningGoals: string[];
  stableGoals: string[];
  symptomTrends: Array<{
    symptomId: string;
    label: string;
    trend: 'improving' | 'worsening' | 'stable';
    delta: number;
    startAvg: number;
    endAvg: number;
    relatedGoals: string[];
  }>;
  recommendations: string[];
  startDate: string;
  endDate: string;
}

const SYMPTOM_LABELS: Record<string, string> = {
  fatigue: 'Усталость', liver_pain: 'Боль в печени', nausea: 'Тошнота',
  jaundice: 'Желтушность', headache: 'Головная боль', dizziness: 'Головокружение',
  palpitations: 'Сердцебиение', cramps: 'Судороги', edema: 'Отёки',
  joint_pain: 'Боль в суставах', insomnia: 'Бессонница', anxiety: 'Тревожность',
  mood_swings: 'Перепады настроения', libido_decrease: 'Снижение либидо',
  gynecomastia: 'Гинекомастия', acne: 'Акне', hair_loss: 'Выпадение волос',
  sweating: 'Потливость', tremor: 'Тремор', thirst: 'Жажда',
  hypoglycemia: 'Гипогликемия', flushed_skin: 'Приливы', bloating: 'Вздутие',
  constipation: 'Запор', diarrhea: 'Диарея',
};

export function getStackEffectiveness(
  stackIds: string[],
  userGoals: string[],
  lookbackDays = 14
): FeedbackResult | null {
  if (stackIds.length === 0) return null;

  const diary = loadSymptomDiary();
  if (Object.keys(diary).length === 0) return null;

  const now = new Date();
  const endDate = now.toISOString().slice(0, 10);
  const startDate = new Date(now.getTime() - lookbackDays * 86400000).toISOString().slice(0, 10);

  const symptomTrends: FeedbackResult['symptomTrends'] = [];
  const improvingGoals = new Set<string>();
  const worseningGoals = new Set<string>();
  const stableGoals = new Set<string>();
  const recommendations: string[] = [];

  for (const [symptomId, entries] of Object.entries(diary)) {
    if (!Array.isArray(entries) || entries.length < 2) continue;

    const sorted = entries
      .filter(e => e.date >= startDate && e.date <= endDate)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (sorted.length < 2) continue;

    const half = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, half);
    const secondHalf = sorted.slice(half);

    const startAvg = firstHalf.reduce((s, e) => s + e.severity, 0) / firstHalf.length;
    const endAvg = secondHalf.reduce((s, e) => s + e.severity, 0) / secondHalf.length;
    const delta = startAvg - endAvg;

    let trend: 'improving' | 'worsening' | 'stable' = 'stable';
    if (delta > 1.0) trend = 'improving';
    else if (delta < -1.0) trend = 'worsening';

    const relatedGoals = SYMPTOM_GOAL_MAP[symptomId] || [];
    const label = SYMPTOM_LABELS[symptomId] || symptomId;

    symptomTrends.push({
      symptomId, label, trend, delta: Math.round(delta * 10) / 10,
      startAvg: Math.round(startAvg * 10) / 10,
      endAvg: Math.round(endAvg * 10) / 10,
      relatedGoals,
    });

    // Map to goals
    for (const g of relatedGoals) {
      if (trend === 'improving') improvingGoals.add(g);
      else if (trend === 'worsening') worseningGoals.add(g);
      else stableGoals.add(g);
    }
  }

  if (symptomTrends.length === 0) {
    return {
      overallScore: 50,
      improvingGoals: [], worseningGoals: [], stableGoals: [],
      symptomTrends: [],
      recommendations: ['Недостаточно данных дневника симптомов для анализа. Ведите дневник ежедневно.'],
      startDate, endDate,
    };
  }

  // Generate recommendations
  const worseningList = symptomTrends.filter(s => s.trend === 'worsening');
  const improvingList = symptomTrends.filter(s => s.trend === 'improving');

  if (worseningList.length > 0) {
    const worst = worseningList[0];
    recommendations.push(
      `⚠ ${worst.label} ухудшается (${worst.startAvg} → ${worst.endAvg}). Проверьте совместимость БАДов в стеке.`
    );
  }
  if (improvingList.length > 0) {
    const best = improvingList[0];
    recommendations.push(
      `✅ ${best.label} улучшается (${best.startAvg} → ${best.endAvg}). Стек работает по этому направлению.`
    );
  }

  // Cross-reference with stack goals
  const coveredImproving = userGoals.filter(g => improvingGoals.has(g));
  const coveredWorsening = userGoals.filter(g => worseningGoals.has(g));

  if (coveredImproving.length > 0) {
    recommendations.push(`🎯 Цели достигаются: ${coveredImproving.join(', ')}`);
  }
  if (coveredWorsening.length > 0) {
    recommendations.push(`⚠ Цели НЕ достигаются: ${coveredWorsening.join(', ')}. Пересмотрите стек в этих направлениях.`);
  }

  // Overall score: weighted by improvement/worsening
  const totalSymptoms = symptomTrends.length;
  const improvingCount = improvingList.length;
  const worseningCount = worseningList.length;
  const overallScore = Math.round(
    50 + (improvingCount / totalSymptoms) * 40 - (worseningCount / totalSymptoms) * 30
  );

  return {
    overallScore: Math.max(0, Math.min(100, overallScore)),
    improvingGoals: [...new Set(improvingGoals)],
    worseningGoals: [...new Set(worseningGoals)],
    stableGoals: [...new Set(stableGoals)],
    symptomTrends,
    recommendations,
    startDate,
    endDate,
  };
}

/* ─── Stack start date tracking ─── */
const STACK_START_KEY = 'he_biostack_start_date';

export function trackStackStart(stackIds: string[]): void {
  if (stackIds.length === 0) return;
  try {
    const existing = JSON.parse(localStorage.getItem(STACK_START_KEY) || '{}');
    const key = stackIds.slice(0, 5).join('|');
    if (!existing[key]) {
      existing[key] = new Date().toISOString().slice(0, 10);
      localStorage.setItem(STACK_START_KEY, JSON.stringify(existing));
    }
  } catch {}
}

export function getStackStartDate(stackIds: string[]): string | null {
  try {
    const existing = JSON.parse(localStorage.getItem(STACK_START_KEY) || '{}');
    const key = stackIds.slice(0, 5).join('|');
    return existing[key] || null;
  } catch { return null; }
}
