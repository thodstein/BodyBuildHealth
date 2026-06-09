export interface SubstitutionResult {
  originalExerciseId: string;
  substituteExerciseId: string;
  substituteName: string;
  matchScore: number;
  reason: string;
}

interface SubstitutionRule {
  fromEquipment: string[];
  toEquipment: string[];
  pattern: string;
  examples: { from: string; to: string; name: string }[];
}

const SUBSTITUTION_RULES: SubstitutionRule[] = [
  { fromEquipment: ['barbell'], toEquipment: ['dumbbell'], pattern: 'barbell_to_dumbbell', examples: [{ from: 'bench_bar', to: 'bench_db', name: 'Жим штанги → Жим гантелей' }] },
  { fromEquipment: ['barbell', 'rack'], toEquipment: ['dumbbell'], pattern: 'squat_sub', examples: [{ from: 'squat', to: 'bulgarian_split', name: 'Приседания → Болгарские сплит' }] },
  { fromEquipment: ['barbell'], toEquipment: ['bodyweight'], pattern: 'barbell_to_bw', examples: [{ from: 'bench_bar', to: 'pushup', name: 'Жим штанги → Отжимания' }] },
  { fromEquipment: ['cable'], toEquipment: ['dumbbell'], pattern: 'cable_to_db', examples: [{ from: 'pulldown', to: 'row_db', name: 'Тяга блока → Тяга гантели' }] },
  { fromEquipment: ['machine'], toEquipment: ['barbell', 'dumbbell'], pattern: 'machine_to_free', examples: [{ from: 'hack_squat', to: 'front_squat', name: 'Гакк → Фронтальные приседания' }] },
  { fromEquipment: ['barbell'], toEquipment: ['bodyweight'], pattern: 'pull_sub', examples: [{ from: 'row_bar', to: 'pullup', name: 'Тяга штанги → Подтягивания' }] },
];

const EQUIPMENT_PRIORITY: Record<string, number> = {
  bodyweight: 0, band: 1, dumbbell: 2, kettlebell: 2, cable: 3,
  machine: 3, barbell: 4, specialty_bar: 4,
};

export function findSubstitute(
  exerciseId: string,
  pattern: string,
  equipmentAvailable: string[],
  requiredEquipment: string[]
): SubstitutionResult | null {
  const hasRequired = requiredEquipment.every(e => equipmentAvailable.includes(e));
  if (hasRequired) return null;

  for (const rule of SUBSTITUTION_RULES) {
    const match = rule.examples.find(ex => ex.from === exerciseId);
    if (match) {
      const canUse = rule.toEquipment.every(e => equipmentAvailable.includes(e));
      if (canUse) {
        return {
          originalExerciseId: exerciseId,
          substituteExerciseId: match.to,
          substituteName: match.name,
          matchScore: 70,
          reason: `Нет ${requiredEquipment.join(', ')} → замена на ${match.to}`,
        };
      }
    }
  }

  return {
    originalExerciseId: exerciseId,
    substituteExerciseId: 'bodyweight_alt',
    substituteName: 'Bodyweight-аналог',
    matchScore: 40,
    reason: 'Нет подходящего оборудования — bodyweight fallback',
  };
}

export function scoreEquipmentMatch(
  requiredEquipment: string[],
  availableEquipment: string[]
): number {
  if (requiredEquipment.length === 0) return 100;
  let score = 0;
  for (const req of requiredEquipment) {
    if (availableEquipment.includes(req)) { score += 100 / requiredEquipment.length; }
    else {
      const bestAlt = Object.entries(EQUIPMENT_PRIORITY)
        .filter(([eq]) => availableEquipment.includes(eq))
        .sort(([, a], [, b]) => b - a)[0];
      if (bestAlt) score += (50 / requiredEquipment.length);
    }
  }
  return Math.round(score);
}
