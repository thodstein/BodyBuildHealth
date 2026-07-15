/**
 * ProfileDataHub.tsx — Централизованная сводка всех данных пользователя.
 *
 * Единый экран «Мои данные»: агрегирует статический профиль (UnifiedSettings)
 * и живые данные из других модулей (лаборатория, дневник симптомов, план
 * поддержки, тренировки, питание) в одну обзорную панель с индикаторами
 * заполненности и быстрыми ссылками на редактирование.
 */
import React from 'react';
import type { UnifiedSettings, LabPoint, WorkoutLog } from '../../../core/types';
import { theme } from './ProfileComponents';
import { getSymptomDiaryStats } from '../../../engines/symptom-diary.engine';

export interface ProfileDataHubProps {
  settings: UnifiedSettings;
  labs: LabPoint[];
  workoutLogs: WorkoutLog[];
  foodDiaryAvg: { avgKcal: number; avgProtein: number; avgFat: number; avgCarbs: number } | null;
  onOpenProfileTab: (tab: string) => void;
  onNavigate?: (screen: string) => void;
}

interface SourceStat {
  key: string;
  label: string;
  icon: string;
  color: string;
  filled: number;
  total: number;
  detail: string;
  go: () => void;
}

const cardStyle: React.CSSProperties = {
  padding: '12px 14px',
  borderRadius: 14,
  background: 'var(--glass-bg)',
  border: '1px solid var(--glass-border)',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  cursor: 'pointer',
};

function bar(pct: number, color: string): React.CSSProperties {
  return {
    height: 6,
    borderRadius: 3,
    background: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  } as React.CSSProperties & { background: string };
}

function barFill(pct: number, color: string): React.CSSProperties {
  return {
    height: '100%',
    width: `${Math.max(4, Math.min(100, Math.round(pct)))}%`,
    borderRadius: 3,
    background: color,
    transition: 'width 0.3s',
  };
}

export const ProfileDataHub: React.FC<ProfileDataHubProps> = ({
  settings,
  labs,
  workoutLogs,
  foodDiaryAvg,
  onOpenProfileTab,
  onNavigate,
}) => {
  const us = settings;

  // ── Статический профиль ──
  const personal = us.personal || {};
  const training = us.training || {};
  const pharma = us.pharma || {};
  const health = us.health || {};
  const nutrition = us.nutrition || {};
  const lifestyle = us.lifestyle || {};

  const personalFields = [
    personal.age, personal.sex, personal.height, personal.weight, personal.bodyFat,
  ].filter((v) => v !== undefined && v !== null && v !== '');

  const trainingFields = [
    training.daysPerWeek, training.level, training.primaryGoal,
    training.pmSquat, training.pmBench, training.pmDeadlift,
  ].filter((v) => v !== undefined && v !== null && v !== '');
  const trainingExtra = (training.weakPoints?.length ? 1 : 0) + (training.workMax && Object.keys(training.workMax).length ? 1 : 0);

  const pharmaFields = [
    pharma.phase, pharma.totalCycles, pharma.trainingCycleType, pharma.trainingCycleWeeks,
  ].filter((v) => v !== undefined && v !== null && v !== '');

  const healthFields = [
    health.chronicConditions?.length, health.injuries?.length,
    health.drugAllergies, health.dopamineScore, health.bpStage,
  ].filter((v) => v !== undefined && v !== null && (typeof v === 'number' ? true : (v as any).length > 0));
  const healthContra = health.contraindications ? Object.values(health.contraindications).filter(Boolean).length : 0;

  const nutritionFields = [
    nutrition.dietType, nutrition.mealsPerDay, nutrition.proteinPerKg,
    nutrition.currentSupplements?.length, nutrition.currentMedications?.length,
  ].filter((v) => v !== undefined && v !== null && (typeof v === 'number' ? true : (v as any).length > 0));

  const lifestyleFields = [
    lifestyle.sleepHours, lifestyle.stressLevel, lifestyle.dailySteps,
    lifestyle.dailyWaterLiters, lifestyle.chronotype,
  ].filter((v) => v !== undefined && v !== null && v !== '');

  // ── Живые данные ──
  const labCount = labs?.length || 0;
  const lastLab = labCount > 0 ? labs.map((l) => l.date).sort().slice(-1)[0] : null;

  const workoutCount = workoutLogs?.length || 0;

  const supportPlanRaw = (() => {
    try { return JSON.parse(localStorage.getItem('he_support_plan_result') || '[]'); } catch { return []; }
  })();
  const supportPlanCount = Array.isArray(supportPlanRaw) ? supportPlanRaw.length : 0;

  const symptomStats = getSymptomDiaryStats();

  // ── Ещё живые источники ──
  const readArr = (k: string): any[] => {
    try { const v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
  };
  const sleepDiary = readArr('he_sleep_diary');
  const bpDiary = readArr('he_bp_diary');
  const injectionDiary = readArr('he_injection_diary');
  const autoCalc = (() => { try { return JSON.parse(localStorage.getItem('he_autocalc_state') || '{}'); } catch { return {}; } })();
  const bioProfile = (() => { try { return JSON.parse(localStorage.getItem('he_biostack_profile') || '{}'); } catch { return {}; } })();

  const lastSleep = sleepDiary.length ? sleepDiary.map((d: any) => d.date).sort().slice(-1)[0] : null;
  const lastBp = bpDiary.length ? bpDiary.map((d: any) => d.date).sort().slice(-1)[0] : null;
  const lastInj = injectionDiary.length ? injectionDiary.map((d: any) => d.date).sort().slice(-1)[0] : null;
  const bioFilled = (bioProfile.goals?.length ? 1 : 0) + (bioProfile.healthConditions?.length ? 1 : 0) + (bioProfile.aasStatus ? 1 : 0);
  const autoFilled = (autoCalc.neuro ? 1 : 0) + (autoCalc.cardio ? 1 : 0) + (autoCalc.gi ? 1 : 0) + (autoCalc.health ? 1 : 0);


  const sources: SourceStat[] = [
    {
      key: 'personal', label: 'Персональные данные', icon: '👤', color: '#00e68a',
      filled: personalFields.length, total: 5,
      detail: personal.age ? `${personal.age} лет · ${personal.sex === 'female' ? 'ж' : 'м'} · ${personal.weight || '—'} кг` : 'Не заполнено',
      go: () => onOpenProfileTab('anthropometry'),
    },
    {
      key: 'training', label: 'Тренировки', icon: '🏋️', color: '#f59e0b',
      filled: trainingFields.length + trainingExtra, total: 8,
      detail: training.level ? `${training.level} · ${training.daysPerWeek || '—'}×/нед` : 'Не заполнено',
      go: () => onOpenProfileTab('training'),
    },
    {
      key: 'pharma', label: 'Фарма / курс', icon: '💉', color: '#ec4899',
      filled: pharmaFields.length, total: 4,
      detail: pharma.phase ? `Фаза: ${pharma.phase}` : 'Не заполнено',
      go: () => onOpenProfileTab('health'),
    },
    {
      key: 'health', label: 'Здоровье', icon: '🩺', color: '#3b82f6',
      filled: healthFields.length + healthContra, total: 7,
      detail: health.chronicConditions?.length ? `Хрон. состояний: ${health.chronicConditions.length}` : 'Без особенностей',
      go: () => onOpenProfileTab('health'),
    },
    {
      key: 'nutrition', label: 'Питание', icon: '🥗', color: '#10b981',
      filled: nutritionFields.length, total: 5,
      detail: nutrition.dietType ? `Диета: ${nutrition.dietType}` : 'Не заполнено',
      go: () => onOpenProfileTab('diet'),
    },
    {
      key: 'lifestyle', label: 'Образ жизни', icon: '🌿', color: '#8b5cf6',
      filled: lifestyleFields.length, total: 5,
      detail: lifestyle.sleepHours ? `Сон: ${lifestyle.sleepHours} ч` : 'Не заполнено',
      go: () => onOpenProfileTab('lifestyle'),
    },
    {
      key: 'labs', label: 'Лаборатория', icon: '🧪', color: '#06b6d4',
      filled: labCount > 0 ? 1 : 0, total: 1,
      detail: labCount > 0 ? `${labCount} маркеров · последний ${lastLab}` : 'Нет данных',
      go: () => onNavigate?.('labs'),
    },
    {
      key: 'symptoms', label: 'Дневник симптомов', icon: '📝', color: '#f43f5e',
      filled: symptomStats.activeSymptoms > 0 ? 1 : 0, total: 1,
      detail: symptomStats.activeSymptoms > 0
        ? `Активных: ${symptomStats.activeSymptoms} · ухудш.: ${symptomStats.worsening}`
        : 'Нет записей',
      go: () => onNavigate?.('support'),
    },
    {
      key: 'support', label: 'План поддержки', icon: '💊', color: '#84cc16',
      filled: supportPlanCount > 0 ? 1 : 0, total: 1,
      detail: supportPlanCount > 0 ? `${supportPlanCount} веществ в плане` : 'План не рассчитан',
      go: () => onNavigate?.('support'),
    },
    {
      key: 'workouts', label: 'Тренировки (дневник)', icon: '📊', color: '#eab308',
      filled: workoutCount > 0 ? 1 : 0, total: 1,
      detail: workoutCount > 0 ? `${workoutCount} записей` : 'Нет записей',
      go: () => onNavigate?.('training'),
    },
    {
      key: 'food', label: 'Питание (дневник)', icon: '🍽️', color: '#14b8a6',
      filled: foodDiaryAvg ? 1 : 0, total: 1,
      detail: foodDiaryAvg ? `~${foodDiaryAvg.avgKcal} ккал/день` : 'Нет записей',
      go: () => onNavigate?.('nutrition'),
    },
    {
      key: 'sleep', label: 'Сон', icon: '😴', color: '#6366f1',
      filled: sleepDiary.length > 0 ? 1 : 0, total: 1,
      detail: sleepDiary.length > 0 ? `${sleepDiary.length} записей · ${lastSleep}` : 'Нет записей',
      go: () => onOpenProfileTab('diaries'),
    },
    {
      key: 'bp', label: 'Давление', icon: '💓', color: '#ef4444',
      filled: bpDiary.length > 0 ? 1 : 0, total: 1,
      detail: bpDiary.length > 0 ? `${bpDiary.length} измерений · ${lastBp}` : 'Нет записей',
      go: () => onOpenProfileTab('diaries'),
    },
    {
      key: 'injections', label: 'Инъекции', icon: '💉', color: '#f97316',
      filled: injectionDiary.length > 0 ? 1 : 0, total: 1,
      detail: injectionDiary.length > 0 ? `${injectionDiary.length} записей · ${lastInj}` : 'Нет записей',
      go: () => onOpenProfileTab('diaries'),
    },
    {
      key: 'biostack', label: 'BioStack профиль', icon: '🧬', color: '#a855f7',
      filled: bioFilled, total: 3,
      detail: bioProfile.aasStatus ? `Статус: ${bioProfile.aasStatus}` : 'Не заполнено',
      go: () => onNavigate?.('biostack'),
    },
    {
      key: 'autocalc', label: 'Калькулятор подбора', icon: '🧮', color: '#0ea5e9',
      filled: autoFilled, total: 4,
      detail: autoFilled > 0 ? `${autoFilled}/4 блоков заполнено` : 'Не заполнено',
      go: () => onNavigate?.('support'),
    },
  ];

  const totalFilled = sources.reduce((s, x) => s + x.filled, 0);
  const totalAvail = sources.reduce((s, x) => s + x.total, 0);
  const overallPct = totalAvail > 0 ? (totalFilled / totalAvail) * 100 : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Общая полнота профиля */}
      <div style={{ ...cardStyle, cursor: 'default', background: 'linear-gradient(135deg, rgba(0,230,138,0.12), rgba(59,130,246,0.10))', border: '1px solid rgba(0,230,138,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>📂 Мои данные</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#00e68a' }}>{Math.round(overallPct)}%</div>
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
          Заполнено {totalFilled} из {totalAvail} блоков данных. Нажмите на карточку, чтобы дополнить.
        </div>
        <div style={bar(overallPct, '#00e68a')}>
          <div style={barFill(overallPct, '#00e68a')} />
        </div>
      </div>

      {/* Сетка источников */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {sources.map((s) => {
          const pct = s.total > 0 ? (s.filled / s.total) * 100 : 0;
          const isBinary = s.total === 1;
          const fillColor = pct >= 80 ? '#00e68a' : pct >= 40 ? s.color : '#f59e0b';
          return (
            <div
              key={s.key}
              style={cardStyle}
              onClick={s.go}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: s.color + '1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{s.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>{s.label}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.detail}</div>
                </div>
                <span style={{ color: s.color, fontSize: 14, opacity: 0.7 }}>→</span>
              </div>
              <div style={bar(pct, fillColor)}>
                <div style={barFill(pct, fillColor)} />
              </div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', textAlign: 'right' }}>
                {isBinary ? (s.filled > 0 ? 'есть данные' : 'пусто') : `${s.filled}/${s.total}`}
              </div>
            </div>
          );
        })}
      </div>

      {(() => {
        const missing = sources.filter((s) => s.filled < s.total);
        if (missing.length === 0) {
          return (
            <div style={{ ...cardStyle, cursor: 'default', borderColor: 'rgba(16,185,129,0.4)', background: 'rgba(16,185,129,0.08)' }}>
              <div style={{ fontSize: 13, color: '#34d399', fontWeight: 600 }}>
                ✅ Все источники данных заполнены — профиль максимально полный
              </div>
            </div>
          );
        }
        return (
          <div style={{ ...cardStyle, cursor: 'default', borderColor: 'rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.07)' }}>
            <div style={{ fontSize: 13, color: '#fbbf24', fontWeight: 600, marginBottom: 6 }}>
              ⚠ Заполните для полноты профиля ({missing.length}):
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {missing.map((m) => (
                <span
                  key={m.key}
                  onClick={m.go}
                  style={{
                    fontSize: 11.5, padding: '4px 9px', borderRadius: 10, cursor: 'pointer',
                    background: 'rgba(245,158,11,0.14)', color: '#fcd34d',
                    border: '1px solid rgba(245,158,11,0.3)',
                  }}
                >
                  {m.icon} {m.label}
                </span>
              ))}
            </div>
          </div>
        );
      })()}

      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', textAlign: 'center', padding: '4px 0' }}>
        Все данные хранятся локально на устройстве и используются для расчётов рисков и подбора поддержки.
      </div>
    </div>
  );
};
