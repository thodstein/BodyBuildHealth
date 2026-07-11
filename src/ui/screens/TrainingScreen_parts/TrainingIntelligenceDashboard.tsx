import React, { useState } from 'react';
import type { ManualResult } from './TrainingConstructor/types';
import type { WorkoutLog } from '../../../core/types';
import { loadSRPESessions } from '../../../engines/pro/srpe-store';
import { acuteChronicRatio, toDailyLoads } from '../../../engines/pro/training-load.engine';
import { StrengthAnalysisHub } from './StrengthAnalysisHub';
import { DiagnosticsHub } from './DiagnosticsHub';
import { SplitGenCard } from './SplitGenCard';
import { PlateCalcTab } from './PlateCalcTab';
import VolumeOptimizerTab from './VolumeOptimizerTab';
import { TonnageCalcTab } from './TonnageCalcTab';
import { PriRepPatternCard } from './PriRepPatternCard';
import { CalcQualityTab } from './CalcQualityTab';
import { PeriodizationHub } from './PeriodizationHub';
import { TrainingMixTab } from './TrainingMixTab';
import { LoadSafetyCard } from './LoadSafetyCard';
import ExerciseLabMerged from './ExerciseLabMerged';

const DIM = 'rgba(235,235,245,0.6)';
const SECTION_COLORS: Record<string, string> = {
  показатели: '#3b82f6',
  качество: '#a855f7',
  сборки: '#22c55e',
  периодизация: '#f59e0b',
  подготовка: '#ec4899',
};

function SectionHeader({ icon, label, color, expanded, onToggle }: { icon: string; label: string; color: string; expanded: boolean; onToggle: () => void }) {
  return (
    <div onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0 4px', cursor: 'pointer', userSelect: 'none' }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.4, flex: 1 }}>{label}</span>
      <span style={{ fontSize: 10, color: DIM, transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'none' }}>▼</span>
    </div>
  );
}

function MetricBar({ label, value, max = 100, color }: { label: string; value: number; max?: number; color: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
      <span style={{ fontSize: 9, color: DIM, minWidth: 52, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 4, height: 5, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 9, fontWeight: 700, color, minWidth: 30, textAlign: 'right' }}>{value}{max !== 100 ? '' : '%'}</span>
    </div>
  );
}

type ExpandableSection = 'показатели' | 'качество' | 'сборки' | 'периодизация' | 'подготовка';

export default function TrainingIntelligenceDashboard({
  manualResult, level, historyWorkouts, tprofile, readinessRecovery, readinessFatigue, mesoLength,
  onBuildPlan,
}: {
  manualResult: ManualResult | null;
  level: string;
  historyWorkouts: WorkoutLog[];
  tprofile: any;
  readinessRecovery: number;
  readinessFatigue: number;
  mesoLength: number;
  onBuildPlan: () => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setExpanded(p => ({ ...p, [key]: !p[key] }));

  const srpe = loadSRPESessions();
  const acwr = srpe.length >= 2 ? acuteChronicRatio(toDailyLoads(srpe)) : null;
  const acwrColor = acwr ? (acwr.ratio > 1.5 ? '#ef4444' : acwr.ratio > 1.3 ? '#eab308' : acwr.ratio < 0.8 ? '#3b82f6' : '#22c55e') : DIM;
  const acwrLabel = acwr ? (acwr.ratio > 1.5 ? 'опасно' : acwr.ratio > 1.3 ? 'осторожно' : acwr.ratio < 0.8 ? 'недотрен' : 'оптимум') : '—';

  // Estimate some 1RMs from historyWorkouts
  const latest1RM: Record<string, number> = {};
  historyWorkouts.slice(-50).forEach(w => {
    (w.exercises || []).forEach((e: any) => {
      const est = e.weight && e.reps ? e.weight * (1 + (e.reps || 0) / 30) : 0;
      if (est > (latest1RM[e.name] || 0)) latest1RM[e.name] = Math.round(est);
    });
  });

  const sectionStyle: React.CSSProperties = {
    marginBottom: 6, borderRadius: 14, padding: '10px 12px',
    background: 'rgba(24,24,27,0.25)', border: '1px solid rgba(255,255,255,0.04)',
  };

  const cardStyle: React.CSSProperties = {
    padding: '8px 10px', borderRadius: 10, marginBottom: 4,
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)',
  };

  const chipStyle = (color: string): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px',
    borderRadius: 8, fontSize: 9, fontWeight: 600, color, cursor: 'pointer',
    background: color + '12', border: '1px solid ' + color + '20',
  });

  const btnStyle: React.CSSProperties = {
    padding: '3px 10px', borderRadius: 7, fontSize: 9, fontWeight: 700,
    border: 'none', cursor: 'pointer', color: '#000', background: 'var(--accent)',
  };

  return (
    <div style={{ padding: '4px 0 20px', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* ═══ 🏋️ Твои показатели ═══ */}
      <div style={sectionStyle}>
        <SectionHeader icon="🏋️" label="Твои показатели" color={SECTION_COLORS.показатели} expanded={!!expanded.показатели} onToggle={() => toggle('показатели')} />
        {!expanded.показатели ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 4 }}>
            {/* Strength mini */}
            <div style={cardStyle}>
              <div style={{ fontSize: 9, fontWeight: 700, color: SECTION_COLORS.показатели, marginBottom: 4 }}>🏋️ Сила</div>
              {latest1RM && Object.entries(latest1RM).slice(0, 3).map(([k, v]) => (
                <div key={k} style={{ fontSize: 10, color: '#fff', marginBottom: 1 }}>{k}: <b>{v} кг</b></div>
              ))}
              {!Object.keys(latest1RM).length && <div style={{ fontSize: 9, color: DIM }}>Нет данных тренировок</div>}
              <div style={{ marginTop: 4, display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                <span style={chipStyle(SECTION_COLORS.показатели)} onClick={() => toggle('показатели')}>⚙ Подробнее</span>
              </div>
            </div>
            {/* Load mini */}
            <div style={cardStyle}>
              <div style={{ fontSize: 9, fontWeight: 700, color: SECTION_COLORS.показатели, marginBottom: 4 }}>📊 Нагрузка</div>
              {acwr ? (
                <>
                  <MetricBar label="ACWR" value={Math.round(acwr.ratio * 50)} max={50} color={acwrColor} />
                  <div style={{ fontSize: 8, color: acwrColor, fontWeight: 600, marginTop: 2 }}>ACWR {acwr.ratio.toFixed(2)} · {acwrLabel}</div>
                </>
              ) : (
                <div style={{ fontSize: 9, color: DIM }}>Нет sRPE-сессий</div>
              )}
              <div style={{ marginTop: 4 }}>
                <MetricBar label="Готовность" value={readinessRecovery} color={readinessRecovery >= 70 ? '#22c55e' : '#eab308'} />
              </div>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 6 }}>
            <StrengthAnalysisHub />
          </div>
        )}
      </div>

      {/* ═══ 🎯 Качество плана ═══ */}
      <div style={sectionStyle}>
        <SectionHeader icon="🎯" label="Качество плана" color={SECTION_COLORS.качество} expanded={!!expanded.качество} onToggle={() => toggle('качество')} />
        {!expanded.качество ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 4 }}>
            {manualResult && (
              <div style={cardStyle}>
                <div style={{ fontSize: 9, fontWeight: 700, color: SECTION_COLORS.качество, marginBottom: 4 }}>⭐ Оценка плана</div>
                <CalcQualityTab plan={manualResult} level={level} onBuildPlan={onBuildPlan} />
              </div>
            )}
            {!manualResult && (
              <div style={cardStyle}>
                <div style={{ fontSize: 9, color: DIM }}>План не построен</div>
                <div style={{ marginTop: 4 }}>
                  <span style={btnStyle} onClick={onBuildPlan}>→ Построить план</span>
                </div>
              </div>
            )}
            <div style={cardStyle}>
              <div style={{ fontSize: 9, fontWeight: 700, color: SECTION_COLORS.качество, marginBottom: 4 }}>🔬 Диагностика</div>
              <DiagnosticsHub sessions={historyWorkouts} tprofile={tprofile}
                readinessRecovery={readinessRecovery} readinessFatigue={readinessFatigue}
                mesoWeeks={mesoLength} missedSessions={0}
                currentVolume={manualResult?.days?.reduce((s, d) => s + d.exercises.length, 0) ?? 18}
                currentRir={2} />
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 6 }}>
            {manualResult && <div style={{ marginBottom: 8 }}><CalcQualityTab plan={manualResult} level={level} onBuildPlan={onBuildPlan} /></div>}
            <DiagnosticsHub sessions={historyWorkouts} tprofile={tprofile}
              readinessRecovery={readinessRecovery} readinessFatigue={readinessFatigue}
              mesoWeeks={mesoLength} missedSessions={0}
              currentVolume={manualResult?.days?.reduce((s, d) => s + d.exercises.length, 0) ?? 18}
              currentRir={2} />
          </div>
        )}
      </div>

      {/* ═══ 🛠 Инструменты сборки ═══ */}
      <div style={sectionStyle}>
        <SectionHeader icon="🛠" label="Инструменты сборки" color={SECTION_COLORS.сборки} expanded={!!expanded.сборки} onToggle={() => toggle('сборки')} />
        {!expanded.сборки ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 4 }}>
            <div style={cardStyle}>
              <div style={{ fontSize: 9, fontWeight: 700, color: SECTION_COLORS.сборки, marginBottom: 4 }}>🧩 Сплиты</div>
              <SplitGenCard />
            </div>
            <div style={cardStyle}>
              <div style={{ fontSize: 9, fontWeight: 700, color: SECTION_COLORS.сборки, marginBottom: 4 }}>🏋️ Лаб. упражнений</div>
              <ExerciseLabMerged />
            </div>
            <div style={cardStyle}>
              <div style={{ fontSize: 9, fontWeight: 700, color: SECTION_COLORS.сборки, marginBottom: 4 }}>⚖️ Тоннаж</div>
              <TonnageCalcTab />
            </div>
            <div style={cardStyle}>
              <div style={{ fontSize: 9, fontWeight: 700, color: SECTION_COLORS.сборки, marginBottom: 4 }}>🔄 PRI/схема</div>
              <PriRepPatternCard />
            </div>
            <div style={cardStyle}>
              <div style={{ fontSize: 9, fontWeight: 700, color: SECTION_COLORS.сборки, marginBottom: 4 }}>🥞 Блины</div>
              <PlateCalcTab />
            </div>
            <div style={cardStyle}>
              <div style={{ fontSize: 9, fontWeight: 700, color: SECTION_COLORS.сборки, marginBottom: 4 }}>📐 Объём</div>
              <VolumeOptimizerTab />
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <SplitGenCard />
            <ExerciseLabMerged />
            <TonnageCalcTab />
            <PriRepPatternCard />
            <PlateCalcTab />
            <VolumeOptimizerTab />
          </div>
        )}
      </div>

      {/* ═══ ⚕ Периодизация ═══ */}
      <div style={sectionStyle}>
        <SectionHeader icon="⚕" label="Периодизация и восстановление" color={SECTION_COLORS.периодизация} expanded={!!expanded.периодизация} onToggle={() => toggle('периодизация')} />
        {!expanded.периодизация ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 4 }}>
            <div style={cardStyle}>
              <div style={{ fontSize: 9, fontWeight: 700, color: SECTION_COLORS.периодизация, marginBottom: 4 }}>📅 Фазы и циклы</div>
              <PeriodizationHub />
            </div>
            <div style={cardStyle}>
              <div style={{ fontSize: 9, fontWeight: 700, color: SECTION_COLORS.периодизация, marginBottom: 4 }}>🫀 Нагрузка/безопасность</div>
              <LoadSafetyCard />
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <PeriodizationHub />
            <LoadSafetyCard />
          </div>
        )}
      </div>

      {/* ═══ 💊 Подготовка ═══ */}
      <div style={sectionStyle}>
        <SectionHeader icon="💊" label="Подготовка к тренировке" color={SECTION_COLORS.подготовка} expanded={!!expanded.подготовка} onToggle={() => toggle('подготовка')} />
        {!expanded.подготовка ? (
          <div style={{ marginTop: 4 }}>
            <TrainingMixTab />
          </div>
        ) : (
          <div style={{ marginTop: 6 }}>
            <TrainingMixTab />
          </div>
        )}
      </div>
    </div>
  );
}
