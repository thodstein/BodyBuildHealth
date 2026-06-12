import React, { useEffect, useState, useRef } from 'react';
import { PHARMA_DB } from '../../core/pharma-database';
import { registry } from '../../core/data/registry';
import { UCUM_MAP } from '../../core/constants';

import type { MasterDB, RiskResult, ReadinessScores, CourseEntry, LabPoint } from '../../core/types';
import { calculateRisks } from '../../engines/risk.engine';
import { useV7Risk } from '../hooks/useV7Risk';
import { calcReadiness } from '../../engines/readiness.engine';

import { runMDSS } from '../../engines/mdss-engine';
import type { MDSSOutput } from '../../engines/mdss-engine';
import { dailyCheckin } from '../../engines/daily-checkin.engine';
import { loadEntries, computeStats } from '../../engines/body-composition.engine';
import { getNutritionStats } from '../../engines/nutrition-tracker.engine';
import { getTodayMetric, weightTrend } from '../../engines/profile-settings.engine';
import { db } from '../../core/db';
import { getProfile } from '../../core/profile-manager';
import { StrengthDiary } from '../../engines/strength-diary.engine';
import { interpretLabs, type LabCompositeResult } from '../../engines/lab-analysis.engine';


type ScreenId = 'dashboard' | 'pharma' | 'course' | 'peptides' | 'nutrition' | 'plan' | 'substances' | 'labs' | 'risks' | 'profile' | 'predictive' | 'marketplace' | 'articles' | 'assistant' | 'gamification' | 'fertility-pct' | 'calculators' | 'reports' | 'integrations' | 'role-management' | 'support' | 'training' | 'recovery' | 'performance' | 'toolkit';

interface Props {
  onNavigate?: (screen: ScreenId) => void;
}

function getSubstanceName(id: string): string {
  const entry = PHARMA_DB[id];
  return entry ? entry.name : id;
}

function riskColor(v: number): string {
  if (v < 20) return '#22c55e';
  if (v < 40) return '#84cc16';
  if (v < 60) return '#eab308';
  if (v < 80) return '#f97316';
  return '#ef4444';
}

function ProgressBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div style={{ background: 'var(--bg-secondary)', borderRadius: 4, height: 6, width: '100%', overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, background: color, height: '100%', borderRadius: 4, transition: 'width 0.3s' }} />
    </div>
  );
}

function AlertBanner({ messages }: { messages: string[] }) {
  if (!messages.length) return null;
  return (
    <div style={{ background: 'var(--danger-dim)', border: '1px solid var(--danger)', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
      <div style={{ fontWeight: 700, color: 'var(--danger)', fontSize: 13, marginBottom: 4 }}>⚠️ Внимание</div>
      {messages.map((m, i) => (
        <div key={i} style={{ fontSize: 12, color: 'var(--danger)', lineHeight: 1.6 }}>{m}</div>
      ))}
    </div>
  );
}

// Navigation cards for the Dashboard
const NAV_CARDS: { id: ScreenId; icon: string; label: string; desc: string; color: string }[] = [
  { id: 'training', icon: '🏋️', label: 'Тренировки', desc: 'План, дневник, упражнения', color: '#00e68a' },
  { id: 'support', icon: '🛡️', label: 'Поддержка', desc: 'БАДы, пептиды, протоколы', color: '#1e90ff' },
  { id: 'nutrition', icon: '🍎', label: 'Питание', desc: 'Дневник, КБЖУ, графики', color: '#ffa502' },
  { id: 'recovery', icon: '💤', label: 'Восстановление', desc: 'Сон, HRV, усталость', color: '#22c55e' },
  { id: 'performance', icon: '⚡', label: 'Производительность', desc: 'Маркеры, стеки, ПКТ', color: '#a855f7' },
  { id: 'toolkit', icon: '🧰', label: 'Инструменты', desc: 'Движение, биомеханика', color: '#06b6d4' },
  { id: 'calculators', icon: '🧮', label: 'Калькуляторы', desc: 'BMI, BMR, дозировки', color: '#f97316' },
  { id: 'fertility-pct', icon: '🧬', label: 'Фертильность', desc: 'ПКТ, спермограмма', color: '#8b5cf6' },
  { id: 'profile', icon: '👤', label: 'Профиль', desc: 'Настройки, антропометрия', color: '#6b7280' },
  { id: 'articles', icon: '📚', label: 'Статьи', desc: 'База знаний и руководства', color: '#ec4899' },
];

export const DashboardScreen: React.FC<Props> = ({ onNavigate }) => {
  const [masterDb, setMasterDb] = useState<MasterDB | null>(null);
  const [riskResult, setRiskResult] = useState<RiskResult | null>(null);
  const [mdssResult, setMdssResult] = useState<MDSSOutput | null>(null);
  const [readiness, setReadiness] = useState<ReadinessScores | null>(null);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [courseEntries, setCourseEntries] = useState<CourseEntry[]>([]);
  const [labData, setLabData] = useState<(LabPoint & { patientId?: string })[]>([]);
  const [abnormalLabs, setAbnormalLabs] = useState<{ code: string; name: string; value: number; unit: string; deviation: number }[]>([]);
  const [trainingVolume, setTrainingVolume] = useState(0);
  const [trainingWorkouts, setTrainingWorkouts] = useState(0);
  const [todayKcal, setTodayKcal] = useState(0);
  const [todayProtein, setTodayProtein] = useState(0);
  const [todayWater, setTodayWater] = useState(0);
  const [recoveryTrend, setRecoveryTrend] = useState<'up' | 'down' | 'stable'>('stable');
  const [combinedReadiness, setCombinedReadiness] = useState(0);
  const [trainingStreak, setTrainingStreak] = useState(0);
  const { v7Result } = useV7Risk();

  useEffect(() => {
    const loadData = async () => {
      const data = registry.getDB();
      setMasterDb(data);

      const profile = getProfile();
      const settings = profile.settings;

      let courseData: CourseEntry[] = [];
      let labData: (LabPoint & { patientId?: string })[] = [];
      try {
        await db.init();
        courseData = await db.getAll<CourseEntry>('course_log');
        labData = await db.getAll<LabPoint & { patientId?: string }>('labs_log');
        setCourseEntries(courseData);
        setLabData(labData);
        // Compute abnormal markers
        const abnormal: { code: string; name: string; value: number; unit: string; deviation: number }[] = [];
        const latestByCode = new Map<string, LabPoint & { patientId?: string }>();
        for (const lab of labData) {
          const existing = latestByCode.get(lab.code);
          if (!existing || lab.date > existing.date) latestByCode.set(lab.code, lab);
        }
        for (const [code, lab] of latestByCode) {
          const info = UCUM_MAP[code];
          if (!info) continue;
          const norm = lab.value * (info.coeff || 1);
          const isInverse = (info as any).inverse;
          if (isInverse) {
            if (norm < info.lln) abnormal.push({ code, name: info.name, value: lab.value, unit: lab.unit, deviation: Math.round(((info.lln - norm) / info.lln) * 100) });
          } else {
            if (norm > info.uln) abnormal.push({ code, name: info.name, value: lab.value, unit: lab.unit, deviation: Math.round(((norm - info.uln) / info.uln) * 100) });
          }
        }
        abnormal.sort((a, b) => b.deviation - a.deviation);
        setAbnormalLabs(abnormal);
      } catch {}

      // Load training volume
      try {
        const diary = new StrengthDiary();
        const progress = await diary.getWeeklyProgress();
        if (progress.length > 0) {
          const latest = progress[progress.length - 1];
          setTrainingVolume(Math.round(latest.totalVolume));
          setTrainingWorkouts(latest.workoutCount);
        }
      } catch {}

      // Load today's nutrition
      try {
        const raw = localStorage.getItem('nutrition_diary');
        if (raw) {
          const diary = JSON.parse(raw);
          const today = new Date().toISOString().split('T')[0];
          const dayData = diary[today];
          if (dayData?.meals) {
            let kcal = 0, protein = 0;
            Object.values(dayData.meals).flat().forEach((m: any) => {
              kcal += m.kcal || m.totalKcal || 0;
              protein += m.p || m.protein || m.totalProtein || 0;
            });
            setTodayKcal(Math.round(kcal));
            setTodayProtein(Math.round(protein));
            // Calculate water from litres/day setting
            const prof = getProfile().settings;
            setTodayWater(Math.round((prof.dailyWaterLiters ?? 2.5) * 1000));
          }
        }
      } catch {}

      // Combined readiness score (recovery + sleep + nutrition - stress)
      const recoveryScore = readiness?.recovery ?? 50;
      const sleepScore = (settings.baselineSleepQuality ?? 5) * 10;
      const nutritionScore = 70; // default
      const stressPenalty = (settings.baselineStressLevel ?? 5) * 5;
      setCombinedReadiness(Math.round(Math.min(100, Math.max(10, (recoveryScore * 0.4 + sleepScore * 0.3 + nutritionScore * 0.3 - stressPenalty)))));

      // Calculate training streak
      try {
        const diary = new StrengthDiary();
        const progress = await diary.getWeeklyProgress();
        if (progress.length >= 2) {
          const last = progress[progress.length - 1];
          const prev = progress[progress.length - 2];
          if (last.workoutCount > prev.workoutCount) setRecoveryTrend('up');
          else if (last.workoutCount < prev.workoutCount) setRecoveryTrend('down');
          else setRecoveryTrend('stable');
        }
        // Count consecutive weeks with workouts
        let streak = 0;
        for (let i = progress.length - 1; i >= 0; i--) {
          if (progress[i].workoutCount > 0) streak++;
          else break;
        }
        setTrainingStreak(streak);
      } catch {}

      // Calculate risks
      try {
        const genetics = settings.genetics ?? {};
        const activeDrugs: Record<string, { dosePerWeek: number }> = {};
        let totalDose = 0;
        for (const c of courseData) {
          const sid = c.substanceId;
          const freq = typeof c.frequency === 'number' ? c.frequency : 1;
          if (!activeDrugs[sid]) activeDrugs[sid] = { dosePerWeek: 0 };
          activeDrugs[sid].dosePerWeek += c.doseValue * freq;
          totalDose += c.doseValue * freq;
        }
        const riskInput = {
          genetics,
          nutritionFactor: settings.nutritionFactor ?? 0.8,
          trainingFactor: settings.trainingFactor ?? 0.7,
          activeDrugs,
          supportCoverage: {},
          biomarkerValues: {} as Record<string, number>,
        };
        const result = calculateRisks(riskInput);
        setRiskResult(result);

        // Compute MDSS risk from lab data
        try {
          const markers = labData.map(l => ({
            name: l.code || l.name,
            value: l.value,
            ec50: l.name === 'ALT' ? 50 : l.name === 'AST' ? 45 : l.name === 'Creatinine' ? 120 : 3,
            isInverted: l.name === 'SHBG' || l.name === 'HDL',
          }));
          const labDates = labData.map(l => l.date).filter(Boolean).sort().reverse();
          const weeksSinceLab = labDates[0]
            ? (Date.now() - new Date(labDates[0]).getTime()) / (7 * 24 * 3600 * 1000)
            : 52;
          const tWeeks = courseData.length > 0
            ? Math.max(1, courseData.reduce((max, c) => Math.max(max, (c.endWeek || 12) - (c.startWeek || 0)), 0))
            : 4;
          const mdss = runMDSS({
            tWeeks,
            weeksSinceLab,
            genetics: Object.keys(genetics).filter(k => !!(genetics as any)?.[k]),
            markers,
          });
          setMdssResult(mdss);
        } catch {}
      } catch {}

      // Calculate readiness
      try {
        const r = calcReadiness({
          sleepHours: settings.baselineSleepHours ?? 7,
          sleepQuality: settings.baselineSleepQuality ?? 5,
          nightAwakenings: settings.nightAwakenings ?? 1,
          chronotype: settings.chronotype,
          bedtime: settings.bedtime,
          wakeTime: settings.wakeTime,
          hrvRatio: settings.baselineHrvRatio ?? 1.0,
          doms: Math.min(10, (settings.fatigueLevel ?? 3) * 1.5),
          stress: settings.baselineStressLevel ?? 3,
          calRatio: settings.nutritionFactor ?? 0.8,
          proteinRatio: 0.8,
          waterRatio: Math.min(1, (settings.dailyWaterLiters ?? 2) / 3),
          fiberRatio: 0.6,
          omega3Flag: (settings.currentSupplements ?? []).some(sup => /omega|омега/i.test(sup.name)),
          trainingLoadRatio: 0.7,
          subjFatigue: settings.fatigueLevel ?? 3,
          hrIncrease: 0.1,
        });
        setReadiness(r);
      } catch {}

      // Alerts
      const newAlerts: string[] = [];
      if (settings.age && settings.age > 40) newAlerts.push('');
      if (courseData.length > 0) {
        const hasAi = courseData.some(c => /oxandrolone|stanozolol|methandienone|oxymetholone|halotestin/i.test(c.substanceId));
        if (hasAi) newAlerts.push('');
      }
      setAlerts(newAlerts);
    };

    loadData();
  }, []);

  if (!masterDb || !readiness) {
    return (
      <div className="screen screen-loading">
        <div className="loading-spinner"/>
        <span>Загрузка...</span>
      </div>
    );
  }

  const systems = (masterDb.systems || []).slice(0, 8);
  const courseStartDate = getProfile().settings.courseStartDate;
  const daysOnCourse = courseStartDate
    ? Math.max(1, Math.floor((Date.now() - new Date(courseStartDate).getTime()) / 86400000))
    : 0;

  return (
    <div className="screen">
      <h2>🏠 Главная</h2>

      <AlertBanner messages={alerts} />

      {/* ── Global Risk Card: 3 methods, each TWO big numbers ── */}
      <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
          <span>⚠️ Риск-Индекс</span>
          <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 400 }}>
            Курс: {daysOnCourse} дн · Лабы: {(() => {
              const dates = labData.map(l => l.date).filter(Boolean).sort().reverse();
              if (!dates[0]) return '';
              const d = Math.round((Date.now() - new Date(dates[0]).getTime()) / (24 * 3600 * 1000));
              return `${d} дн назад`;
            })()}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {/* V7 */}
          <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 4px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 4 }}>V7</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: riskResult ? riskColor(riskResult.overallRaw) : 'var(--text-dim)' }}>{riskResult ? Math.round(riskResult.overallRaw) : '—'}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: riskResult ? riskColor(riskResult.overallNet) : 'var(--text-dim)' }}>{riskResult ? Math.round(riskResult.overallNet) : '—'}</div>
          </div>
          {/* Monte Carlo */}
          <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 4px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 4 }}>Монте-Карло</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: v7Result?.globalRiskRaw !== undefined ? (v7Result.globalRiskRaw > 70 ? '#ef4444' : v7Result.globalRiskRaw > 40 ? '#f97316' : v7Result.globalRiskRaw > 15 ? '#eab308' : '#22c55e') : 'var(--text-dim)' }}>{v7Result?.globalRiskRaw !== undefined ? `${Math.round(v7Result.globalRiskRaw)}` : '—'}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: v7Result?.globalRiskNet !== undefined ? (v7Result.globalRiskNet > 70 ? '#ef4444' : v7Result.globalRiskNet > 40 ? '#f97316' : '#22c55e') : 'var(--text-dim)' }}>{v7Result?.globalRiskNet !== undefined ? `${Math.round(v7Result.globalRiskNet)}` : '—'}</div>
          </div>
          {/* MDSS */}
          <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 4px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 4 }}>MDSS</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: mdssResult?.overallAlertLevel !== undefined ? (mdssResult.overallAlertLevel >= 3 ? '#ef4444' : mdssResult.overallAlertLevel >= 2 ? '#f97316' : mdssResult.overallAlertLevel >= 1 ? '#eab308' : '#22c55e') : 'var(--text-dim)' }}>{mdssResult ? `${mdssResult.overallMaxRisk}` : '—'}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: mdssResult?.compliancePenalty && mdssResult.compliancePenalty > 1 ? '#ef4444' : '#22c55e' }}>{mdssResult?.compliancePenalty ? `${Math.round(mdssResult.compliancePenalty * 100)}` : '—'}</div>
          </div>
        </div>
      </div>

      {/* Lab Analysis Summary */}
      {(() => {
        if (labData.length === 0) return null;
        const la = interpretLabs(labData);
        if (!la || la.interpretations.length === 0) return null;
        return (
          <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 10, padding: '8px 10px', marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 11, marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
              <span>🧪 Сводка анализов</span>
              <span style={{ fontSize: 8, color: 'var(--text-dim)' }}>{labData.length} тестов</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2px 6px', fontSize: 9 }}>
              {la.homaIR !== null && (
                <><span style={{ color: 'var(--text-dim)' }}>HOMA-IR</span><span style={{ fontWeight: 600, color: la.homaIR > 2.5 ? '#ef4444' : la.homaIR > 1.5 ? '#f59e0b' : '#22c55e', textAlign: 'right' }}>{la.homaIR.toFixed(1)}</span><span/></>
              )}
              <span style={{ color: 'var(--text-dim)' }}>Печень</span><span style={{ fontWeight: 600, color: la.liverStress > 60 ? '#ef4444' : la.liverStress > 30 ? '#f59e0b' : '#22c55e', textAlign: 'right' }}>{la.liverStress}%</span><span/>
              <span style={{ color: 'var(--text-dim)' }}>Кардио</span><span style={{ fontWeight: 600, color: la.cardioRisk > 60 ? '#ef4444' : la.cardioRisk > 30 ? '#f59e0b' : '#22c55e', textAlign: 'right' }}>{la.cardioRisk}%</span><span/>
              <span style={{ color: 'var(--text-dim)' }}>Воспаление</span><span style={{ fontWeight: 600, color: la.inflammation > 6 ? '#ef4444' : la.inflammation > 3 ? '#f59e0b' : '#22c55e', textAlign: 'right' }}>{la.inflammation.toFixed(0)}</span><span/>
              <span style={{ color: 'var(--text-dim)' }}>Почки</span><span style={{ fontWeight: 600, color: la.kidneyStress > 60 ? '#ef4444' : la.kidneyStress > 30 ? '#f59e0b' : '#22c55e', textAlign: 'right' }}>{la.kidneyStress}%</span><span/>
              <span style={{ color: 'var(--text-dim)' }}>Гормоны</span><span style={{ fontWeight: 600, color: la.hormoneScore > 60 ? '#ef4444' : la.hormoneScore > 30 ? '#f59e0b' : '#22c55e', textAlign: 'right' }}>{la.hormoneScore}%</span><span/>
            </div>
            {la.interpretations.filter(i => i.status === 'critical_high' || i.status === 'high').length > 0 && (
              <div style={{ marginTop: 3, fontSize: 8, color: '#ef4444' }}>
                ⚠ {la.interpretations.filter(i => i.status === 'critical_high' || i.status === 'high').length} отклонений
              </div>
            )}
          </div>
        );
      })()}

      {/* Daily Check-in Card */}
      {(() => {
        const settings = getProfile().settings;
        const todayMetric = getTodayMetric();
        const checkin = dailyCheckin({
          sleepHours: todayMetric.sleepHours || (settings.baselineSleepHours ?? 7),
          sleepQuality: todayMetric.sleepQuality || (settings.baselineSleepQuality ?? 4),
          restingHR: todayMetric.restingHR || 60,
          hrvMs: todayMetric.hrvMs || Math.round((settings.baselineHrvRatio ?? 0.6) * 80),
          bodyWeight: todayMetric.weightKg || (settings.weight ?? 80),
          subjectiveEnergy: todayMetric.subjectiveEnergy || (6 - (settings.fatigueLevel ?? 3)),
          subjectiveSoreness: todayMetric.subjectiveSoreness || (settings.fatigueLevel ?? 3),
          subjectiveStress: todayMetric.subjectiveStress || (settings.baselineStressLevel ?? 3),
          waterLiters: todayMetric.waterLiters || (settings.dailyWaterLiters ?? 2.5),
          nutritionQuality: Math.round((settings.nutritionFactor ?? 0.7) * 5),
          trainingYesterday: false,
          yesterdayRPE: 5,
          sleepDebtHours: 0,
          weightTrend: weightTrend(7),
        });
        return (
          <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, textAlign: 'center' }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Готовность</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: checkin.readinessScore >= 65 ? '#22c55e' : checkin.readinessScore >= 40 ? '#eab308' : '#ef4444' }}>
                  {checkin.readinessScore}%
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>{checkin.readinessLabel}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, fontSize: 10, color: 'var(--text-dim)', alignContent: 'center' }}>
                <div>😴 Сон: <b style={{ color: checkin.metrics.sleepScore >= 60 ? '#22c55e' : '#f97316' }}>{checkin.metrics.sleepScore}</b></div>
                <div>💓 HRV: <b style={{ color: checkin.metrics.hrvScore >= 60 ? '#22c55e' : '#f97316' }}>{checkin.metrics.hrvScore}</b></div>
                <div>💧 Вода: <b style={{ color: checkin.metrics.hydrationScore >= 60 ? '#22c55e' : '#f97316' }}>{checkin.metrics.hydrationScore}</b></div>
                <div>🍽 Питание: <b style={{ color: checkin.metrics.nutritionScore >= 60 ? '#22c55e' : '#f97316' }}>{checkin.metrics.nutritionScore}</b></div>
                <div>😵 Усталость: <b style={{ color: checkin.metrics.fatigueScore <= 40 ? '#22c55e' : '#f97316' }}>{Math.round(100 - checkin.metrics.fatigueScore)}</b></div>
                <div>🔄 Восст: <b style={{ color: checkin.metrics.recoveryScore >= 60 ? '#22c55e' : '#f97316' }}>{checkin.metrics.recoveryScore}</b></div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: checkin.trainToday ? '#22c55e' : '#ef4444', marginBottom: 4 }}>
                  {checkin.trainToday ? '✅ Тренироваться' : ''}
                </div>
                {trainingStreak > 0 && (
                  <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>Стрик: {trainingStreak} нед</div>
                )}
              </div>
            </div>
            {checkin.recommendations.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 9, color: '#f97316', borderTop: '1px solid var(--border)', paddingTop: 4 }}>
                {checkin.recommendations.slice(0, 2).map((r, i) => (<div key={i}>• {r}</div>))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Body Composition quick stats */}
      {(() => {
        const entries = loadEntries();
        if (entries.length < 2) return null;
        const s = getProfile().settings;
        const stats = computeStats(entries, s.targetWeight, s.height);
        if (!stats) return null;
        return (
          <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 10, padding: '8px 10px', marginBottom: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4, textAlign: 'center' }}>
              <div>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Вес</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{stats.currentWeight} <span style={{ fontSize: 9, color: stats.weightChange >= 0 ? '#ef4444' : '#22c55e' }}>{stats.weightChange >= 0 ? '+' : ''}{stats.weightChange} кг</span></div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Тренд</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: stats.trend7Day > 0.1 ? '#ef4444' : stats.trend7Day < -0.1 ? '#22c55e' : 'var(--text-dim)' }}>
                  {stats.trend7Day > 0 ? '+' : ''}{stats.trend7Day} кг/нед
                </div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>FFMI</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: stats.ffmi >= 22 ? '#22c55e' : stats.ffmi >= 20 ? '#eab308' : 'var(--text-dim)' }}>
                  {stats.ffmi > 0 ? stats.ffmi : '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Цель</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: stats.goalProgress >= 50 ? '#22c55e' : stats.goalProgress >= 25 ? '#eab308' : 'var(--text-dim)' }}>
                  {stats.goalWeight > 0 ? `${stats.goalProgress}%` : '—'}
                </div>
                </div>
            </div>
          </div>
        );
      })()}

      {/* Nutrition quick bar */}
      {(() => {
        const nutStats = getNutritionStats();
        if (!nutStats || nutStats.today.entries === 0) return null;
        const t = nutStats.today;
        const targets = { kcal: 3000, protein: 180, fat: 80, carbs: 350 };
        return (
          <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 10, padding: '8px 10px', marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 4 }}>🍎 Сегодня · {nutStats.streak} дн streak</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4, textAlign: 'center' }}>
              {[
                { label: 'Ккал', val: t.kcal, target: targets.kcal, color: '#ffa502' },
                { label: 'Белки', val: t.protein, target: targets.protein, color: '#ef4444' },
                { label: 'Жиры', val: t.fat, target: targets.fat, color: '#f59e0b' },
                { label: 'Углеводы', val: t.carbs, target: targets.carbs, color: '#3b82f6' },
              ].map(m => {
                const pct = Math.min(100, Math.round((m.val / m.target) * 100));
                return (
                  <div key={m.label}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: m.color }}>{m.val}<span style={{ fontSize: 8, color: 'var(--text-dim)' }}>/{m.target}</span></div>
                    <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 3, height: 4, marginTop: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: m.color, borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
            </div>
            {t.waterMl > 0 && (
              <div style={{ marginTop: 4, fontSize: 9, color: '#60a5fa' }}>💧 {t.waterMl} мл воды</div>
            )}
          </div>
        );
      })()}

      {/* Quick actions */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <button onClick={() => onNavigate?.('training')} style={{
          flex: 1, padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg, #00e68a, #00c853)', color: '#000', fontWeight: 700, fontSize: 13,
        }}>🏋️ Тренировка</button>
        <button onClick={() => onNavigate?.('nutrition')} style={{
          flex: 1, padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg, #ffa502, #ff7f50)', color: '#000', fontWeight: 700, fontSize: 13,
        }}>🍎 Питание</button>
      </div>

      {/* Today's nutrition + recovery trend */}
      {(todayKcal > 0 || todayWater > 0) && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <h3 style={{ margin: 0 }}>🍎 Сегодня</h3>
            <span style={{ fontSize: 10, color: recoveryTrend === 'up' ? '#22c55e' : recoveryTrend === 'down' ? '#ef4444' : '#6b7280' }}>
              Восст: {recoveryTrend === 'up' ? '↑ Растёт' : recoveryTrend === 'down' ? '↓ Падает' : '→ Стабильно'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, fontSize: 11, flexWrap: 'wrap' }}>
            {todayKcal > 0 && (
              <>
                <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{todayKcal} ккал</span>
                <span style={{ color: 'var(--text-dim)' }}>Б: {todayProtein}г</span>
                <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{(todayProtein * 4 / Math.max(1, todayKcal) * 100).toFixed(0)}%</span>
              </>
            )}
            {todayWater > 0 && (
              <span style={{ color: '#3b82f6', fontWeight: 600, marginLeft: todayKcal > 0 ? 8 : 0 }}>
                💧 {todayWater} мл / {(getProfile().settings.dailyWaterLiters ?? 2.5) * 1000} мл цели
              </span>
            )}
          </div>
          {todayWater > 0 && (
            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 4, height: 5, marginTop: 4, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, todayWater / ((getProfile().settings.dailyWaterLiters ?? 2.5) * 1000) * 100)}%`, height: '100%', background: '#3b82f6', borderRadius: 4 }} />
            </div>
          )}
        </div>
      )}



      {/* Active course info — moved after Readiness */}
      {courseEntries.length > 0 && (
        <div className="card" style={{
          background: 'linear-gradient(135deg, rgba(0,230,138,0.08) 0%, rgba(0,230,138,0.02) 100%)',
          border: '1px solid rgba(0,230,138,0.25)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontSize: 14 }}>💊 Активный курс</h3>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: 'rgba(0,230,138,0.15)', color: '#00e68a', fontWeight: 600 }}>
              {courseEntries.length} препаратов
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(() => {
              const unique = new Map<string, { name: string; totalDose: number; unit: string }>();
              for (const c of courseEntries) {
                const key = c.substanceId;
                if (!unique.has(key)) unique.set(key, { name: getSubstanceName(key), totalDose: 0, unit: c.doseUnit });
                const entry = unique.get(key)!;
                entry.totalDose += c.doseValue;
              }
              return Array.from(unique.values()).slice(0, 6).map((item, i) => (
                <div key={i} style={{
                  background: 'rgba(0,230,138,0.1)', borderRadius: 10, padding: '6px 10px',
                  border: '1px solid rgba(0,230,138,0.15)',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#00e68a' }}>{item.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{item.totalDose}{item.unit}/нед</div>
                </div>
              ));
            })()}
            {courseEntries.length > 6 && (
              <div style={{
                background: 'var(--bg-secondary)', borderRadius: 10, padding: '6px 10px',
                display: 'flex', alignItems: 'center', fontSize: 11, color: 'var(--text-dim)',
              }}>
                +{courseEntries.length - 6}
              </div>
            )}
          </div>
          <div style={{ marginTop: 6, display: 'flex', gap: 12, fontSize: 10, color: 'var(--text-dim)' }}>
            <span>Дней на курсе: <strong style={{ color: '#00e68a' }}>{daysOnCourse}</strong></span>
            <span>Общий риск: <strong style={{ color: riskResult ? riskColor(riskResult.overallNet) : 'var(--text-dim)' }}>{riskResult ? Math.round(riskResult.overallNet) : '—'}%</strong></span>
          </div>
        </div>
      )}





      {/* Navigation cards */}
      <div className="card">
        <h3>📂 Разделы</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {NAV_CARDS.map(card => (
            <div
              key={card.id}
              style={{
                background: 'var(--bg-secondary)',
                borderRadius: 10,
                padding: '12px 10px',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'transform 0.15s, border-color 0.15s',
                border: '1px solid var(--border)',
              }}
              onClick={onNavigate ? () => onNavigate(card.id) : undefined}
            >
              <div style={{ fontSize: 26, marginBottom: 4 }}>{card.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: card.color }}>{card.label}</div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>{card.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {readiness.isConservative && (
        <div style={{ background: 'var(--warning-dim)', border: '1px solid var(--warning)', borderRadius: 8, padding: '10px 14px', marginTop: 8 }}>
          <div style={{ fontWeight: 700, color: 'var(--warning)', fontSize: 13 }}>⚠️ Консервативный режим</div>
          <div style={{ fontSize: 12, color: 'var(--warning)', marginTop: 4 }}>{readiness.conservativeReason}</div>
        </div>
      )}
    </div>
  );
};
