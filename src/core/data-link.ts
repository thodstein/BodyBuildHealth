import { useState, useEffect, useCallback, useMemo } from 'react';
import type { UserProfile, LabPoint, CourseEntry, InjuryRecord } from './types';
import { getProfile, updateProfile, onProfileChange } from './profile-manager';
import { db } from './db';
import { UCUM_MAP, ALL_RISK_SYSTEMS } from './constants';
import { calcReadiness } from '../engines/readiness.engine';
import { loadSRPESessions } from '../engines/pro/srpe-store';
import { acuteChronicRatio, toDailyLoads } from '../engines/pro/training-load.engine';
import { calculateRisks } from '../engines/risk.engine';
import { calculateSupport, type SupportInput } from '../engines/support.engine';
import { interpretLabs, type LabCompositeResult } from '../engines/lab-analysis.engine';
import { readRiskBridge } from '../engines/risk-bridge';
import type { ReadinessScores, RiskCalculationResult } from './types';

let globalTick = 0;
const listeners = new Set<() => void>();

export function notifyDataChange() {
  globalTick++;
  listeners.forEach(fn => fn());
}

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
  labAnalysis: LabCompositeResult | null;
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
    listeners.add(refetch);
    return () => { listeners.delete(refetch); };
  }, [refetch]);

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
  const pal = derivePAL(s.training.daysPerWeek, s.training.minutesPerSession);
  const trainingLoad = deriveTrainingLoad(s.training.daysPerWeek, s.training.minutesPerSession);

  // sRPE-оверлей: реальная тренировочная нагрузка из дневника sRPE → корректирует readiness
  const _srpe = loadSRPESessions();
  const _acwr = _srpe.length >= 2 ? acuteChronicRatio(toDailyLoads(_srpe)) : null;
  const sRpeFatigueAdj = _acwr ? Math.max(0, (_acwr.ratio - 1.3) * 4) : 0;  // доп. пункты усталости при ACWR>1.3
  const sRpeLoadAdj = _acwr ? (_acwr.ratio < 0.8 ? -0.15 : _acwr.ratio > 1.5 ? 0.2 : 0) : 0; // коррекция trainingLoad

  const readiness = useMemo(() => {
    const altVal = getLatestLabValue(labs, 'ALT');
    const astVal = getLatestLabValue(labs, 'AST');
    const crpVal = getLatestLabValue(labs, 'CRP');
    const hgbVal = getLatestLabValue(labs, 'HGB');
    const altUcum = UCUM_MAP['ALT'];
    const astUcum = UCUM_MAP['AST'];
    const crpUcum = UCUM_MAP['CRP'];
    const hgbUcum = UCUM_MAP['HGB'];
    const normLab = (val: number | undefined, ucum: typeof altUcum, threshold: number): number => {
      if (val === undefined) return 0.5;
      const norm = val * (ucum?.coeff || 1);
      return Math.min(1, norm / (ucum?.uln || threshold));
    };
    const altNorm = normLab(altVal, altUcum, 120);
    const astNorm = normLab(astVal, astUcum, 80);
    const crpNorm = normLab(crpVal, crpUcum, 10);
    const hgbNorm = hgbVal !== undefined
      ? (() => { const n = hgbVal * (hgbUcum?.coeff || 1); return n >= (hgbUcum?.lln || 130) && n <= (hgbUcum?.uln || 170) ? 0.8 : 0.4; })()
      : 0.7;

    // Mix quality: последняя сохранённая оценка тренировочного микса → readiness
    const lastMix: { score?: number } | null = (() => {
      try {
        const arr: { score: number }[] = JSON.parse(localStorage.getItem('he_training_mixes') || '[]');
        const last = arr[arr.length - 1];
        return last?.score ? { score: last.score } : null;
      } catch { return null; }
    })();

    return calcReadiness({
      sleepHours: s.lifestyle.sleepHours ?? 7,
      sleepQuality: (s.lifestyle.sleepQuality === 'good' || s.lifestyle.sleepQuality === 'fair' || s.lifestyle.sleepQuality === 'poor') ? (
        s.lifestyle.sleepQuality === 'good' ? 8 : s.lifestyle.sleepQuality === 'fair' ? 5 : 3
      ) : 5,
      nightAwakenings: s.lifestyle.nightAwakenings ?? 1,
      chronotype: s.lifestyle.chronotype, bedtime: s.lifestyle.bedtime, wakeTime: s.lifestyle.wakeTime,
      hrvRatio: s.lifestyle.baselineHrvRatio ?? 1.0,
      doms: Math.min(10, (s.lifestyle.fatigueLevel ?? 3) * 1.5 + sRpeFatigueAdj),
      stress: s.lifestyle.stressLevel ?? 3,
      calRatio: s.system.nutritionFactor ?? 0.8,
      proteinRatio: 0.8,
      waterRatio: Math.min(1, (s.lifestyle.dailyWaterLiters ?? 2) / 3),
      fiberRatio: 0.6,
      omega3Flag: (s.nutrition.currentSupplements ?? []).some((sup: any) => /omega|омега/i.test(sup.name)),
      trainingLoadRatio: Math.max(0.2, Math.min(1.5, trainingLoad + sRpeLoadAdj)),
      subjFatigue: Math.min(10, (s.lifestyle.fatigueLevel ?? 3) + sRpeFatigueAdj),
      hrIncrease: crpNorm > 0.6 ? 0.3 : 0.1,
      mixQualityScore: lastMix?.score ?? undefined,
    });
  }, [labs, profile, sRpeFatigueAdj, sRpeLoadAdj, trainingLoad]);

  const risk = useMemo(() => {
    // Default risk result for error fallback
    const defaultRisk = {
      overallRaw: 5, overallNet: 5,
      coverageMap: {} as Record<string, number>,
      systemBreakdown: {} as Record<string, { raw: number; net: number }>,
    };
    try {
      const genetics = s.health.genetics ?? {};
      // Compute support coverage first, then pass to risk calculation
      const supportIds = (s.nutrition.currentSupplements ?? []).map((sup: any) => sup.id).filter(Boolean);
      let coverage: Record<string, number> = {};
      try {
        const supportResult = calculateSupport({
          substances: supportIds,
          labs: labs.slice(-10).map(l => ({ code: l.code, value: l.value })),
          demographics: { age: s.personal.age ?? 30, weight: s.personal.weight ?? 80, sex: s.personal.sex ?? 'male' },
          genetics,
          nutritionFactor: s.system.nutritionFactor ?? 0.8,
          trainingFactor: s.system.trainingFactor ?? 0.7,
          drugDoses: Object.fromEntries(Object.entries(activeDrugs).map(([k, v]) => [k, v.dosePerWeek])),
        });
        if (supportResult.systemSupport) {
          Object.entries(supportResult.systemSupport).forEach(([k, v]) => {
            coverage[k] = v / 100;
            for (let m = 1; m <= 9; m++) coverage[`${k}_${m}`] = v / 100;
          });
        }
      } catch {}
      const riskResult = calculateRisks({
        genetics,
        nutritionFactor: s.system.nutritionFactor ?? 0.8,
        trainingFactor: s.system.trainingFactor ?? 0.7,
        activeDrugs,
        supportCoverage: coverage,
      });
      // C18: Merge bridge data from SupportScreen for consistent cross-screen risk
      const bridge = readRiskBridge();
      let finalRisk = { ...riskResult, coverageMap: coverage } as RiskCalculationResult;
      if (bridge && bridge.systemBreakdown) {
        const bd: Record<string, { raw: number; net: number }> = {};
        for (const [sys, v] of Object.entries(bridge.systemBreakdown)) {
          bd[sys] = { raw: v.raw, net: v.net };
        }
        finalRisk = {
          ...finalRisk,
          overallRaw: bridge.riskBefore,
          overallNet: bridge.riskAfter,
          systemBreakdown: { ...(finalRisk.systemBreakdown || {}), ...bd },
        } as RiskCalculationResult;
      }
      return finalRisk;
    } catch (e) {
      console.warn('Risk calculation failed:', e);
      const fallbackCoverage: Record<string, number> = {};
      for (const sys of ALL_RISK_SYSTEMS) {
        fallbackCoverage[sys] = 0.5;
        for (let m = 1; m <= 9; m++) fallbackCoverage[`${sys}_${m}`] = 0.5;
      }
      return { ...defaultRisk, coverageMap: fallbackCoverage } as RiskCalculationResult;
    }
  }, [profile, activeDrugs, labs]);

  const avg = useMemo(() => computeWeeklyAverages(), []);
  const labAnalysisMemo = useMemo(() => labs.length > 0 ? interpretLabs(labs) : null, [labs]);

  return useMemo(() => ({
    profile, labs, course, readiness, risk, labAnalysis: labAnalysisMemo,
    avgWeeklyKcal: avg.kcal, avgWeeklyProtein: avg.protein,
    avgWeeklyFat: avg.fat, avgWeeklyCarbs: avg.carbs,
    activeDrugs,
    supportCoverage: (risk as any)?.coverageMap ?? {},
    pal,
    trainingLoadRatio: Math.max(0.2, Math.min(1.5, trainingLoad + sRpeLoadAdj)),
    refetch,
  }), [profile, labs, course, readiness, risk, labAnalysisMemo, avg, activeDrugs, pal, sRpeLoadAdj, trainingLoad, refetch]);
}

export { getLatestLabValue };