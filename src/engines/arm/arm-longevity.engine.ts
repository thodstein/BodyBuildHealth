/**
 * arm-longevity.engine.ts — TOP T5a: masters/longevity-трек (Devon 50 лет).
 *
 * Источник: Larratt 2025-2026 — сдвиг max-heavy → mobility + active recovery,
 * точные rising/pronation малым объёмом, tendon > raw power, лёгкие категории,
 * extended low-volume tendon-сессии, снижение общей нагрузки против ре-травм.
 * WAF зачёты master40/grandmaster50/sgrandmaster60 — в wafAgeGroupFor (reuse идеей).
 *
 * Чистый модуль. Возвращает патч программирования, не диагноз.
 */

export type LongevityTrack = 'open' | 'master' | 'grandmaster' | 'supergrand';

export interface LongevityInput {
  ageYears?: number;
  injuriesCount?: number; // число серьёзных травм локтя/плеча в анамнезе
  elbowPain?: number; // 0-10 сейчас
}

export interface LongevityPlan {
  track: LongevityTrack;
  volumeMult: number; // множитель объёма билдера
  maxHeavyPerWeek: number; // тяжёлых сессий/нед (RPE≥8)
  mobilityMinPerSession: number;
  max singlesPerWeek: number; // максимумов/нед
  suggestLighterClass: boolean;
  rules: string[];
  note: string;
}

export function longevityTrackFor(ageYears: number): LongevityTrack {
  const a = Number.isFinite(ageYears) ? Number(ageYears) : 30;
  if (a >= 70) return 'supergrand';
  if (a >= 50) return 'grandmaster';
  if (a >= 40) return 'master';
  return 'open';
}

export function buildLongevityPlan(input: LongevityInput = {}): LongevityPlan {
  const track = longevityTrackFor(Number(input.ageYears ?? 30));
  const pain = Number(input.elbowPain ?? 0);
  const inj = Math.max(0, Math.round(Number(input.injuriesCount ?? 0) || 0));
  if (track === 'open') {
    return {
      track, volumeMult: 1, maxHeavyPerWeek: 3, mobilityMinPerSession: 5, maxsinglesPerWeek: 1,
      suggestLighterClass: false,
      rules: ['Полный объём по уровню.', 'Мобильность 5 мин/сессия минимум.'],
      note: 'Open-трек: без возрастных ограничений.',
    };
  }
  const base = track === 'master'
    ? { volumeMult: 0.9, maxHeavyPerWeek: 2, mobilityMinPerSession: 8, singles: 1 }
    : track === 'grandmaster'
      ? { volumeMult: 0.8, maxHeavyPerWeek: 1, mobilityMinPerSession: 12, singles: 1 }
      : { volumeMult: 0.7, maxHeavyPerWeek: 1, mobilityMinPerSession: 15, singles: 0 };
  // Боль и анамнез ужесточают
  const painCut = pain >= 4 ? 0.85 : 1;
  const injCut = inj >= 2 ? 0.9 : 1;
  const volumeMult = Math.round(base.volumeMult * painCut * injCut * 100) / 100;
  const rules = [
    'Tendon > raw power: extended low-volume сессии (точные rising/pronation, RPE≤7).',
    `Тяжёлых (RPE≥8) ≤${base.maxHeavyPerWeek}/нед; максимумов ≤${base.singles}/нед.`,
    `Мобильность ≥${base.mobilityMinPerSession} мин/сессия (плечо/локоть/кисть).`,
    'Снижение общей нагрузки против ре-травм — longevitiy-приоритет.',
  ];
  if (pain >= 4) rules.push('Текущая боль ≥4: side минимум, только техника+изометрия до стихания.');
  if (inj >= 1) rules.push(`Анамнез травм (${inj}): прогрев rice-bucket/band/iso обязателен.`);
  return {
    track,
    volumeMult,
    maxHeavyPerWeek: base.maxHeavyPerWeek,
    mobilityMinPerSession: base.mobilityMinPerSession,
    maxsinglesPerWeek: pain >= 6 ? 0 : base.singles,
    suggestLighterClass: track !== 'master' || inj >= 2,
    rules,
    note: `${track}-трек (Devon): объём ×${volumeMult}, тяжёлых ≤${base.maxHeavyPerWeek}/нед, мобильность ≥${base.mobilityMinPerSession} мин.`,
  };
}
