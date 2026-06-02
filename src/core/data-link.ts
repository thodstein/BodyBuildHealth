import { useState, useEffect, useCallback } from 'react';
import type { UserProfile, LabPoint, CourseEntry, InjuryRecord } from './types';
import { getProfile, updateProfile, onProfileChange } from './profile-manager';
import { db } from './db';
import { calcReadiness } from '../engines/readiness.engine';
import { calculateRisks } from '../engines/risk.engine';
import { generateSupportStack } from '../engines/support.engine';
import type { ReadinessScores, RiskCalculationResult } from './types';

export interface LinkedData {
  profile: UserProfile;
  labs: LabPoint[];
  course: CourseEntry[];
  readiness: ReadinessScores | null;
  risk: RiskCalculationResult | null;
  avgWeeklyKcal: number;
  avgWeeklyProtein: number;
  avgWeeklyFat: number;
  avgWeeklyCarbs: number;
  activeDrugs: Record<string, { dosePerWeek: number }>;
  supportCoverage: Record<string, number>;
  pal: number;
  trainingLoadRatio: number;
  refetch: () => void;
}

export function derivePAL(workoutsPerWeek?: number, avgWorkoutMinutes?: number): number {
  const wpw = workoutsPerWeek ?? 3;
  const awm = avgWorkoutMinutes ?? 60;
  let p = 1.2 + wpw * 0.075;
  if (awm > 60) p += 0.05;
  if (awm > 90) p += 0.075;
  if (wpw >= 6) p += 0.05;
  return Math.max(1.2, Math.min(1.9, Math.round(p * 100) / 100));
}

export function deriveTrainingLoad(workoutsPerWeek?: number, avgWorkoutMinutes?: number): number {
  const wpw = workoutsPerWeek ?? 3;
  const awm = avgWorkoutMinutes ?? 60;
  const weeklyMinutes = wpw * awm;
  const ratio = weeklyMinutes / 420;
  return Math.max(0.2, Math.min(1.5, Math.round(ratio * 100) / 100));
}

function getLatestLabValue(labs: LabPoint[], code: string): number | undefined {
  const sorted = labs.filter(l => l.code === code).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return sorted.length > 0 ? sorted[0].value : undefined;
}

function computeWeeklyAverages(): { kcal: number; protein: number; fat: number; carbs: number } {
  try {
    const raw = localStorage.getItem('nutrition_diary');
    if (!raw) return { kcal: 0, protein: 0, fat: 0, carbs: 0 };
    const diary = JSON.parse(raw);
    if (!diary || typeof diary !== 'object') return { kcal: 0, protein: 0, fat: 0, carbs: 0 };
    const entries = Object.values(diary) as any[];
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const recent = entries.filter((e: any) => {
      if (!e.date) return false;
      const d = new Date(e.date);
      return d >= weekAgo && d <= now;
    });
    if (recent.length === 0) return { kcal: 0, protein: 0, fat: 0, carbs: 0 };
    let totalKcal = 0, totalP = 0, totalF = 0, totalC = 0;
    recent.forEach((e: any) => {
      totalKcal += e.totalKcal ?? e.kcal ?? 0;
      totalP += e.totalProtein ?? e.protein ?? 0;
      totalF += e.totalFat ?? e.fat ?? 0;
      totalC += e.totalCarbs ?? e.carbs ?? 0;
    });
    const days = Math.max(1, recent.length);
    return { kcal: Math.round(totalKcal / days), protein: Math.round(totalP / days), fat: Math.round(totalF / days), carbs: Math.round(totalC / days) };
  } catch {
    return { kcal: 0, protein: 0, fat: 0, carbs: 0 };
  }
}

function computeActiveDrugs(course: CourseEntry[]): Record<string, { dosePerWeek: number }> {
  const map: Record<string, { dosePerWeek: number }> = {};
  course.forEach(c => {
    const freq = typeof c.frequency === 'number' ? c.frequency : 1;
    if (!map[c.substanceId]) map[c.substanceId] = { dosePerWeek: 0 };
    map[c.substanceId].dosePerWeek += c.doseValue * freq;
  });
  return map;
}

export function useDataLink(): LinkedData {
  const [profile, setProfile] = useState<UserProfile>(getProfile());
  const [labs, setLabs] = useState<LabPoint[]>([]);
  const [course, setCourse] = useState<CourseEntry[]>([]);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    return onProfileChange(() => setProfile(getProfile()));
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        await db.init();
        const allLabs = await db.getAll<LabPoint>('labs_log');
        const pid = profile.id || 'current-user';
        const userLabs = allLabs.filter(l => l.patientId === pid || !l.patientId);
        setLabs(userLabs);

        const allCourse = await db.getAll<CourseEntry>('course_log');
        setCourse(allCourse);

        try {
          const idbProfile = await db.get<UserProfile>('profile', 'current-user');
          if (idbProfile && idbProfile.settings) {
            const lsProfile = getProfile();
            const lsUpdated = lsProfile.settings;
            const idbUpdated = idbProfile.settings;
            const merged = { ...idbProfile, ...lsProfile, settings: { ...idbUpdated, ...lsUpdated } };
            await db.put('profile', merged);
          } else {
            await db.put('profile', profile);
          }
        } catch {}
      } catch {}
    };
    load();
  }, [profile.id, tick]);

  const s = profile.settings;
  const activeDrugs = computeActiveDrugs(course);
  const pal = derivePAL(s.workoutsPerWeek, s.avgWorkoutMinutes);
  const trainingLoad = deriveTrainingLoad(s.workoutsPerWeek, s.avgWorkoutMinutes);

  const readiness = (() => {
    const altVal = getLatestLabValue(labs, 'ALT');
    const astVal = getLatestLabValue(labs, 'AST');
    const crpVal = getLatestLabValue(labs, 'CRP');
    const hgbVal = getLatestLabValue(labs, 'HGB');
    const altNorm = altVal !== undefined ? Math.min(1, altVal / 120) : 0.5;
    const astNorm = astVal !== undefined ? Math.min(1, astVal / 80) : 0.5;
    const crpNorm = crpVal !== undefined ? Math.min(1, crpVal / 10) : 0.3;
    const hgbNorm = hgbVal !== undefined ? (hgbVal >= 130 && hgbVal <= 170 ? 0.8 : 0.4) : 0.7;

    return calcReadiness({
      sleepHours: s.baselineSleepHours ?? 7,
      sleepQuality: s.baselineSleepQuality ?? 5,
      nightAwakenings: s.nightAwakenings ?? 1,
      chronotype: s.chronotype, bedtime: s.bedtime, wakeTime: s.wakeTime,
      hrvRatio: s.baselineHrvRatio ?? 1.0,
      doms: Math.min(10, (s.fatigueLevel ?? 3) * 1.5),
      stress: s.baselineStressLevel ?? 3,
      calRatio: s.nutritionFactor ?? 0.8,
      proteinRatio: 0.8,
      waterRatio: Math.min(1, (s.dailyWaterLiters ?? 2) / 3),
      fiberRatio: 0.6,
      omega3Flag: (s.currentSupplements ?? []).some(sup => /omega|омега/i.test(sup.name)),
      trainingLoadRatio: trainingLoad,
      subjFatigue: s.fatigueLevel ?? 3,
      hrIncrease: crpNorm > 0.6 ? 0.3 : 0.1,
    });
  })();

  const risk = (() => {
    try {
      const genetics = s.genetics ?? {};
      const riskResult = calculateRisks(genetics);
      const goal = s.primaryGoal ?? s.goal ?? 'health';
      const stack = generateSupportStack(goal);
      const coverage: Record<string, number> = {};
      stack.forEach(su => {
        const cov = (su as any).coverage as Record<string, number> | undefined;
        if (cov) Object.entries(cov).forEach(([k, v]) => { coverage[k] = (coverage[k] ?? 0) + v; });
      });
      return { ...riskResult, coverageMap: coverage } as RiskCalculationResult;
    } catch { return null; }
  })();

  const avg = computeWeeklyAverages();

  return {
    profile, labs, course, readiness, risk,
    avgWeeklyKcal: avg.kcal, avgWeeklyProtein: avg.protein,
    avgWeeklyFat: avg.fat, avgWeeklyCarbs: avg.carbs,
    activeDrugs,
    supportCoverage: (risk as any)?.coverageMap ?? {},
    pal,
    trainingLoadRatio: trainingLoad,
    refetch,
  };
}

export { getLatestLabValue };