import React, { useEffect, useState, useRef } from 'react';
import { SummaryCard } from '../cards/SummaryCard';
import { SystemCard } from '../cards/SystemCard';
import { PHARMA_DB } from '../../core/pharma-database';
import { registry } from '../../core/data/registry';
import { UCUM_MAP } from '../../core/constants';
const SYSTEM_LABELS: Record<string, string> = {
  cardio: 'Сердечно-сосудистая', hepatic: 'Печень', renal: 'Почки',
  neuro: 'Нервная', endocrine: 'Эндокринная', hematologic: 'Кроветворная',
  reproductive: 'Репродуктивная', musculoskeletal: 'ОДА/Мышцы',
  metabolic: 'Метаболизм', ghigf: 'ГР/ИФР-1', ins_axis: 'Инсулиновая ось',
  neuro_toxicity: 'Нейротоксичность', blood: 'Кровь', vessels: 'Сосуды',
  immunity: 'Иммунная', thyroid: 'Щитовидная', prostate: 'Простата', skin: 'Кожа',
};

import type { MasterDB, RiskResult, ReadinessScores, CourseEntry, LabPoint } from '../../core/types';
import { calculateRisks } from '../../engines/risk.engine';
import { useV7Risk } from '../hooks/useV7Risk';
import { calcReadiness } from '../../engines/readiness.engine';
import { RISK_SYSTEMS, ALL_RISK_SYSTEMS } from '../../core/constants';
import { db } from '../../core/db';
import { getProfile } from '../../core/profile-manager';
import { StrengthDiary } from '../../engines/strength-diary.engine';


type ScreenId = 'dashboard' | 'pharma' | 'course' | 'peptides' | 'nutrition' | 'plan' | 'substances' | 'labs' | 'risks' | 'profile' | 'predictive' | 'marketplace' | 'articles' | 'assistant' | 'gamification' | 'fertility-pct' | 'calculators' | 'reports' | 'integrations' | 'role-management' | 'support' | 'training';

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
  { id: 'training', icon: '🏋️', label: 'Тренировки', desc: 'Планы, RIR', color: '#00e68a' },
  { id: 'support', icon: '💊', label: 'Поддержка', desc: 'БАДы, протоколы', color: '#1e90ff' },
  { id: 'nutrition', icon: '🍎', label: 'Питание', desc: 'КБЖУ, дневник', color: '#ffa502' },
  { id: 'fertility-pct', icon: '🌱', label: 'ПКТ и Фертильность', desc: 'План ПКТ, фертильность', color: '#22c55e' },
  { id: 'calculators', icon: '🧮', label: 'Калькуляторы', desc: 'Дозировки', color: '#a855f7' },
  { id: 'profile', icon: '👤', label: 'Профиль', desc: 'Настройки', color: '#6b7280' },
  { id: 'marketplace', icon: '🛒', label: 'Маркетплейс', desc: 'Препараты и БАДы', color: '#f97316' },
  { id: 'articles', icon: '📖', label: 'Статьи', desc: 'База знаний', color: '#06b6d4' },
  { id: 'assistant', icon: '🤖', label: 'Ассистент', desc: 'Чекапы и ответы', color: '#8b5cf6' },
  { id: 'reports', icon: '📊', label: 'Отчёты', desc: 'Экспорт и печать', color: '#ec4899' },
];

export const DashboardScreen: React.FC<Props> = ({ onNavigate }) => {
  const [masterDb, setMasterDb] = useState<MasterDB | null>(null);
  const [riskResult, setRiskResult] = useState<RiskResult | null>(null);
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

      // Calculate recovery trend (compare last 2 weeks)
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
      if (settings.age && settings.age > 40) newAlerts.push('Возраст > 40: рекомендуется расширенный чекап');
      if (courseData.length > 0) {
        const hasAi = courseData.some(c => /oxandrolone|stanozolol|methandienone|oxymetholone|halotestin/i.test(c.substanceId));
        if (hasAi) newAlerts.push('Оральные ААС: обязательный мониторинг печени (АЛТ, АСТ, ГГТ)');
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

      {/* Quick stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
        <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 10, padding: '6px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Готовность</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: readiness.recovery >= 70 ? '#22c55e' : readiness.recovery >= 50 ? '#eab308' : '#ef4444' }}>{Math.round(readiness.recovery)}%</div>
        </div>
        <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 10, padding: '6px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Риск</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: riskResult ? riskColor(riskResult.overallNet) : 'var(--text-dim)' }}>{riskResult ? Math.round(riskResult.overallNet) : '—'}%</div>
        </div>
        <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 10, padding: '6px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Курс</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{daysOnCourse} дн</div>
        </div>
        <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 10, padding: '6px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Лабы</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{labData.length}</div>
        </div>
        {trainingWorkouts > 0 && (
          <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 10, padding: '6px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Объём/нед</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#00e68a' }}>{trainingVolume.toLocaleString()} кг</div>
          </div>
        )}
      </div>

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

      {/* Readiness details */}
      <div className="card">
        <h3>📊 Готовность к тренировке</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { label: 'Восстановление', value: readiness.recovery, color: readiness.recovery >= 70 ? '#22c55e' : '#eab308' },
            { label: 'Энергия', value: readiness.nutrition, color: readiness.nutrition >= 70 ? '#22c55e' : '#eab308' },
            { label: 'Сон', value: (readiness.sleep ?? 0), color: (readiness.sleep ?? 0) >= 70 ? '#22c55e' : '#eab308' },
            { label: 'Стресс', value: 100 - (readiness.stress ?? 50), color: (readiness.stress ?? 0) < 30 ? '#22c55e' : '#ef4444' },
          ].map(item => (
            <div key={item.label} style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '6px 8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{item.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: item.color }}>{Math.round(item.value)}%</span>
              </div>
              <ProgressBar value={item.value} color={item.color} />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8, display: 'flex', gap: 12, fontSize: 10, color: 'var(--text-dim)' }}>
          <span>Качество сна: {getProfile().settings.baselineSleepQuality ?? 5}/10</span>
          <span>Часы сна: {getProfile().settings.baselineSleepHours ?? 7}ч</span>
        </div>
      </div>

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

      {/* Lab markers */}
      {labData.length > 0 && (
        <div className="card" style={{ cursor: 'pointer' }} onClick={onNavigate ? () => onNavigate('labs') : undefined}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>🧪 Последние анализы</h3>
            <span style={{ fontSize: 11, color: 'var(--accent)' }}>{'Подробнее >'}</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 6 }}>
            {(() => {
              const latestByCode = new Map<string, LabPoint & { patientId?: string }>();
              for (const lab of labData) {
                const existing = latestByCode.get(lab.code);
                if (!existing || lab.date > existing.date) latestByCode.set(lab.code, lab);
              }
              return Array.from(latestByCode.values()).slice(0, 12).map(lab => {
                const info = UCUM_MAP[lab.code];
                const norm = lab.value * (info?.coeff || 1);
                const isAbnormal = info && (norm > info.uln || norm < info.lln);
                return (
                  <span key={lab.code} style={{
                    background: isAbnormal ? 'rgba(239,68,68,0.12)' : 'rgba(0,230,138,0.08)',
                    color: isAbnormal ? '#ef4444' : 'var(--accent)',
                    padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 600,
                  }}>
                    {info?.name || lab.code} {lab.value}{lab.unit}
                  </span>
                );
              });
            })()}
          </div>
          {abnormalLabs.length > 0 && (
            <div style={{ marginTop: 6, fontSize: 9, color: '#ef4444' }}>
              {abnormalLabs.length} отклонений — {abnormalLabs.slice(0, 3).map(a => `${a.name} (↑${a.deviation}%)`).join(', ')}
            </div>
          )}
        </div>
      )}

      {/* System summary */}
      <div className="card" style={{ cursor: 'pointer' }} onClick={onNavigate ? () => onNavigate('risks') : undefined}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>🫀 Системы организма</h3>
          <span style={{ fontSize: 11, color: 'var(--accent)' }}>{'Подробнее >'}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 8 }}>
          {riskResult && Object.entries(riskResult.systemBreakdown).map(([sys, vals]) => (
            <div key={sys} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: 12 }}>
              <span style={{ color: 'var(--text-dim)' }}>{SYSTEM_LABELS[sys] ?? sys}</span>
              <span style={{ fontWeight: 600, color: riskColor(vals.net) }}>{Math.round(vals.net)}%</span>
            </div>
          ))}
        </div>
      </div>

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
