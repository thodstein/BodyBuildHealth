import React, { useState, useMemo } from 'react';
import { PopupSelect } from '../SRCBBScreen_parts/TrainingPopups';
import { calcSpecializationVolume, generateSpecializedWeek, formatSpecializationSummary, type SpecializationInput } from '../../../engines/specialization.engine';
import { loadTrainingProfile, type TrainingProfile } from './training-profile';

const ACCENT = '#00e68a';
const GLASS: React.CSSProperties = { background: 'rgba(24,24,27,0.6)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)', padding: 12, marginBottom: 10 };
const H: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: ACCENT, margin: '4px 0 8px' };
const LABEL: React.CSSProperties = { color: 'rgba(255,255,255,0.55)', fontSize: 10, margin: '6px 0 4px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.3 };

const GROUP_OPTIONS = [
  { id: 'chest', label: 'Грудь' },
  { id: 'back', label: 'Спина' },
  { id: 'legs', label: 'Ноги' },
  { id: 'shoulders', label: 'Плечи' },
  { id: 'arms', label: 'Руки' },
  { id: 'core', label: 'Кор' },
];

const SpecializationTab: React.FC = () => {
  const [profile] = useState<TrainingProfile>(() => loadTrainingProfile());
  const [targetGroup, setTargetGroup] = useState<string>('chest');

  const input: SpecializationInput = useMemo(() => ({
    targetGroup,
    level: profile.level as 'beginner' | 'intermediate' | 'advanced',
    equipment: profile.equipment,
    weakPoints: profile.weakPoints,
    injuries: profile.injuries,
    daysPerWeek: profile.daysPerWeek,
  }), [targetGroup, profile]);

  const volPlan = useMemo(() => calcSpecializationVolume(input), [input]);
  const weekPlan = useMemo(() => generateSpecializedWeek(input), [input]);
  const summary = useMemo(() => formatSpecializationSummary(input), [input]);

  return (
    <div>
      <div style={GLASS}>
        <div style={H}>🎯 Режим специализации (оверлоад отстающих)</div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>
          Целевая группа получает 1.3-1.5× MAV, остальные — MEV (минимум). Длительность: 8-12 нед, делод на 5-6 нед.
        </div>
        <div style={LABEL}>Целевая группа</div>
        <PopupSelect label="Группа" value={targetGroup} onChange={setTargetGroup} options={GROUP_OPTIONS} />
      </div>

      <div style={GLASS}>
        <div style={H}>📊 Распределение объёма (сетов/нед)</div>
        {Object.entries(volPlan).map(([g, v]) => {
          const isTarget = g === targetGroup;
          const barPct = Math.min(100, v.pctOfMav);
          return (
            <div key={g} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
                <span style={{ color: isTarget ? ACCENT : 'rgba(255,255,255,0.7)', fontWeight: isTarget ? 700 : 400 }}>
                  {GROUP_OPTIONS.find(o => o.id === g)?.label || g} {isTarget ? '◀ ЦЕЛЬ' : ''}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>{v.sets} сетов ({v.status})</span>
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${barPct}%`, background: isTarget ? ACCENT : 'rgba(255,255,255,0.15)', borderRadius: 3, transition: 'width 0.3s' }} />
              </div>
            </div>
          );
        })}
      </div>

      <div style={GLASS}>
        <div style={H}>📅 Недельный план (день за днём)</div>
        {weekPlan.map((day, i) => (
          <div key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '8px 0' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 4 }}>
              День {day.dayNumber} · {day.targetVolume} сетов
            </div>
            {day.exercises.map((ex, j) => (
              <div key={j} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '2px 0' }}>
                <span style={{ color: ex.group === targetGroup ? '#fff' : 'rgba(255,255,255,0.5)' }}>
                  {ex.name}
                  {ex.group === targetGroup && <span style={{ color: ACCENT, marginLeft: 4 }}>◀</span>}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>{ex.sets}×{ex.reps} @ RIR {ex.rir}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div style={GLASS}>
        <div style={H}>📝 Сводка</div>
        {summary.map((s, i) => (
          <div key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginBottom: 2 }}>{s}</div>
        ))}
      </div>
    </div>
  );
};

export default SpecializationTab;
