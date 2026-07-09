/** SpecializationTab.tsx — качественная специализация на каждую группу мышц.
 * Профессиональные протоколы: упражнения, техники, питание, принципы. */
import React, { useState, useMemo } from 'react';
import { PopupSelect } from '../SRCBBScreen_parts/TrainingPopups';
import { calcSpecializationVolume, generateSpecializedWeek, formatSpecializationSummary, getSpecializationProtocol, SPECIALIZATION_GROUPS, type SpecializationInput } from '../../../engines/specialization.engine';
import { loadTrainingProfile, type TrainingProfile } from './training-profile';
import { applyToPlanner } from './planner-bridge';

const ACCENT = '#00e68a';
const DIM = 'rgba(255,255,255,0.5)';
const GLASS: React.CSSProperties = { background: 'rgba(24,24,27,0.6)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)', padding: 12, marginBottom: 10 };
const H: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: ACCENT, margin: '4px 0 8px' };
const LABEL: React.CSSProperties = { color: 'rgba(255,255,255,0.55)', fontSize: 10, margin: '6px 0 4px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.3 };

const GROUP_OPTIONS = SPECIALIZATION_GROUPS.map(g => ({ id: g.id, label: g.category + ' → ' + g.label }));

const SpecializationTab: React.FC = () => {
  const [profile] = useState<TrainingProfile>(() => loadTrainingProfile());
  const [targetGroup, setTargetGroup] = useState<string>('chest_upper');

  const input: SpecializationInput = useMemo(() => ({
    targetGroup, level: profile.level as any, equipment: profile.equipment,
    weakPoints: profile.weakPoints, injuries: profile.injuries, daysPerWeek: profile.daysPerWeek,
  }), [targetGroup, profile]);

  const protocol = useMemo(() => getSpecializationProtocol(targetGroup), [targetGroup]);
  const volPlan = useMemo(() => calcSpecializationVolume(input), [input]);
  const weekPlan = useMemo(() => generateSpecializedWeek(input), [input]);
  const summary = useMemo(() => formatSpecializationSummary(input), [input]);

  return (
    <div>
      <div style={GLASS}>
        <div style={H}>🎯 Специализация: {protocol.groupName}</div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>
          Профессиональный протокол специализации для каждой группы мышц.
        </div>
        <div style={LABEL}>Целевая группа</div>
        <PopupSelect label="Группа" value={targetGroup} onChange={setTargetGroup} options={GROUP_OPTIONS} />
      </div>

      {/* Протокол специализации */}
      <div style={GLASS}>
        <div style={H}>📋 Протокол специализации</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: DIM }}>📊 Объём: <b style={{ color: ACCENT }}>{protocol.totalSets}</b></div>
          <div style={{ fontSize: 10, color: DIM }}>🔄 Частота: <b style={{ color: ACCENT }}>{protocol.frequency}</b></div>
          <div style={{ fontSize: 10, color: DIM }}>📆 Длительность: <b style={{ color: ACCENT }}>{protocol.duration}</b></div>
        </div>
        <div style={LABEL}>🔑 Ключевые принципы</div>
        {protocol.keyPrinciples.map((p, i) => (
          <div key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', padding: '3px 0', lineHeight: 1.5 }}>• {p}</div>
        ))}
      </div>

      {/* Упражнения протокола */}
      <div style={GLASS}>
        <div style={H}>🏋️ Упражнения ({protocol.exerciseOrder.length})</div>
        {protocol.exerciseOrder.map((ex, i) => (
          <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
              <span style={{ fontSize: 11, color: '#fff', fontWeight: 700 }}>{i + 1}. {ex.name}</span>
              <span style={{ fontSize: 10, color: ACCENT, fontWeight: 700 }}>{ex.sets}×{ex.reps} · RIR {ex.rir}</span>
            </div>
            <div style={{ fontSize: 9, color: DIM, display: 'flex', gap: 12 }}>
              <span>⏱️ отдых {ex.rest}с</span>
              {ex.technique && <span style={{ color: '#a78bfa' }}>🔥 {ex.technique}</span>}
            </div>
            {ex.note && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{ex.note}</div>}
          </div>
        ))}
      </div>

      {/* Техники интенсификации */}
      <div style={GLASS}>
        <div style={H}>🔥 Техники интенсификации</div>
        {protocol.intensityTechniques.map((t, i) => (
          <div key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', padding: '4px 0', lineHeight: 1.5 }}>• {t}</div>
        ))}
      </div>

      {/* Питание */}
      <div style={GLASS}>
        <div style={H}>🍽 Питание для специализации</div>
        {protocol.nutritionTips.map((t, i) => (
          <div key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', padding: '3px 0', lineHeight: 1.5 }}>• {t}</div>
        ))}
      </div>

      {/* Распределение объёма */}
      <div style={GLASS}>
        <div style={H}>📊 Распределение объёма</div>
        {Object.entries(volPlan).map(([g, v]) => {
          const isTarget = g === targetGroup;
          const barPct = Math.min(100, v.pctOfMav);
          return (
            <div key={g} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
                <span style={{ color: isTarget ? ACCENT : 'rgba(255,255,255,0.7)', fontWeight: isTarget ? 700 : 400 }}>
                  {GROUP_OPTIONS.find(o => o.id === g)?.label || g} {isTarget ? '◀ ЦЕЛЬ' : ''}
                </span>
                <span style={{ color: DIM }}>{v.sets} сетов ({v.status})</span>
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${barPct}%`, background: isTarget ? ACCENT : 'rgba(255,255,255,0.15)', borderRadius: 3, transition: 'width 0.3s' }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Недельный план */}
      <div style={GLASS}>
        <div style={H}>📅 Недельный план</div>
        {weekPlan.map((day, i) => (
          <div key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '8px 0' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 4 }}>
              День {day.dayNumber} · {day.focus} · {day.targetVolume} сетов
            </div>
            {day.exercises.map((ex, j) => (
              <div key={j} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '2px 0' }}>
                <span style={{ color: ex.group === targetGroup ? '#fff' : 'rgba(255,255,255,0.5)' }}>
                  {ex.name}{ex.technique && <span style={{ color: '#a78bfa', marginLeft: 4 }}>🔥</span>}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>{ex.sets}×{ex.reps} · RIR {ex.rir}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Apply */}
      <div style={{ marginTop: 8, padding: 12, borderRadius: 12, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)' }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginBottom: 8 }}>🔗 Применить специализацию «{protocol.groupName}» к планировщику как приоритет.</div>
        <button onClick={() => applyToPlanner({ kind: 'weakpoints', label: 'Специализация: ' + protocol.groupName, data: { groups: [targetGroup] } })} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 13, minHeight: 44 }}>🛠 Применить специализацию к планировщику</button>
      </div>
    </div>
  );
};

export default SpecializationTab;