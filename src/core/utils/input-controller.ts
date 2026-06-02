export interface RawInput {
  substances?: any[];
  symptoms?: string[];
  goals?: string[];
  lifestyle?: any;
  medical?: any;
}

export interface NormalizedInput {
  substances: Array<{ id: string; dose: number | null; frequency: string | null; effects: string[] }>;
  symptoms: string[];
  goals: string[];
  lifestyle: { sleep_hours: number | null; stress_level: number | null; activity: string | null; diet_quality: string | null };
  medical: { blood_tests: Record<string, number>; diagnoses: string[]; medications: string[] };
}

export const InputController = {
  normalize(raw: RawInput): NormalizedInput {
    return {
      substances: this.normalizeSubstances(raw.substances),
      symptoms: this.normalizeSymptoms(raw.symptoms),
      goals: this.normalizeGoals(raw.goals),
      lifestyle: this.normalizeLifestyle(raw.lifestyle),
      medical: this.normalizeMedical(raw.medical)
    };
  },
  normalizeSubstances(list?: any[]) {
    if (!Array.isArray(list)) return [];
    return list.map(s => ({
      id: String(s.id || '').toUpperCase(),
      dose: s.dose != null ? Number(s.dose) : null,
      frequency: s.frequency != null ? String(s.frequency) : null,
      effects: Array.isArray(s.effects) ? s.effects : []
    }));
  },
  normalizeSymptoms(list?: string[]) {
    if (!Array.isArray(list)) return [];
    return list.map(s => s.trim()).filter(Boolean);
  },
  normalizeGoals(list?: string[]) {
    if (!Array.isArray(list)) return [];
    return list.map(g => g.toUpperCase().trim());
  },
  normalizeLifestyle(data?: any) {
    return {
      sleep_hours: data?.sleep_hours != null ? Number(data.sleep_hours) : null,
      stress_level: data?.stress_level != null ? Number(data.stress_level) : null,
      activity: data?.activity ? String(data.activity) : null,
      diet_quality: data?.diet_quality ? String(data.diet_quality) : null
    };
  },
  normalizeMedical(data?: any) {
    return {
      blood_tests: typeof data?.blood_tests === 'object' ? data.blood_tests : {},
      diagnoses: Array.isArray(data?.diagnoses) ? data.diagnoses : [],
      medications: Array.isArray(data?.medications) ? data.medications : []
    };
  }
};