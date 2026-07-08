import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { EXERCISE_CATALOG, getExerciseById, getSubstitutes } from '../../../core/exercise-catalog';
import type { Exercise } from '../../../core/types';
import { getVolumeReferences, getVolumeByMuscle } from '../../../engines/training-methodology.engine';
import { getSFRProfile, analyzeFullVolume, planVolumeProgression, findBetterExerciseSwaps, findCoverageGaps } from '../../../engines/volume-optimizer-pro.engine';
import type { ProExerciseRow, FullVolumeAnalysis, MuscleVolumeProAnaly, CNSFatigueReport, RecoveryCapacityReport, SplitQualityScore, ExerciseSwapRec, CoverageGap, SFRProfile } from '../../../engines/volume-optimizer-pro.engine';
import type { TrainingLevel } from '../../../engines/volume-landmarks.engine';
import { PopupSelect, ExpandableCard, MetricCard } from '../SRCBBScreen_parts/TrainingPopups';
import { useDataLink } from '../../../core/data-link';
import { applyToPlanner } from './planner-bridge';

const ACCENT = '#00e68a';
const DIM = 'rgba(255,255,255,0.5)';
const IN: React.CSSProperties = { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '7px 8px', width: '100%', boxSizing: 'border-box' as const, fontSize: 11, textAlign: 'center' as const };
const CARD: React.CSSProperties = { background: 'rgba(24,24,27,0.5)', borderRadius: 10, padding: 12, border: '1px solid rgba(255,255,255,0.05)' };
const BADGE = (color: string): React.CSSProperties => ({ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 9, fontWeight: 700, color: '#000', background: color });

const MUSCLE_RU: Record<string, string> = {
  chest: 'Грудь', back: 'Спина', legs: 'Ноги', shoulders: 'Плечи', arms: 'Руки', core: 'Кор',
  quads: 'Квадрицепсы', hamstrings: 'Бицепс бедра', biceps: 'Бицепс', triceps: 'Трицепс',
  calves: 'Икры', glutes: 'Ягодицы', abs: 'Пресс',
};

function muscleRu(en: string): string { return MUSCLE_RU[en] || en; }

const STATUS_COLOR: Record<string, string> = {
  below_mev: '#ef4444', optimal: '#22c55e', approaching_mrv: '#f59e0b', exceeding_mrv: '#ef4444',
};
const STATUS_LABEL: Record<string, string> = {
  below_mev: 'Ниже MEV', optimal: 'Оптимально', approaching_mrv: 'Близко к MRV', exceeding_mrv: 'Превышен MRV',
};
const SFR_TIER_COLOR: Record<string, string> = { S: '#22c55e', A: '#00e68a', B: '#f59e0b', C: '#ef4444' };

export const VolumeOptimizerTab: React.FC = () => {
  const { profile } = useDataLink();
  const [level, setLevel] = useState<TrainingLevel>((profile?.settings.trainingLevel as TrainingLevel) ?? 'intermediate');
  const [mesoWeeks, setMesoWeeks] = useState<number>(4);
  const [activeWeek, setActiveWeek] = useState<'all' | number>('all');
  const [oneRMGlobal, setOneRMGlobal] = useState<number>(100);
  const [rows, setRows] = useState<ProExerciseRow[]>([
    { id: 'r1', exerciseId: 'bench_bar', week: 1, day: 1, weight: 80, reps: 5, sets: 4, rpe: 8 },
    { id: 'r2', exerciseId: 'row_bar', week: 1, day: 2, weight: 60, reps: 8, sets: 3, rpe: 7 },
    { id: 'r3', exerciseId: 'squat', week: 1, day: 3, weight: 100, reps: 5, sets: 4, rpe: 8 },
  ]);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    muscles: true, cnsRecovery: true, quality: true, progression: false, gaps: true, swaps: false,
  });
  const weakPoints = profile?.settings.weakPoints ?? [];

  const getOneRM = useCallback((exerciseId: string): number => {
    const baseline = (profile?.settings.strengthBaselines ?? {})[exerciseId];
    if (baseline && baseline > 0) return baseline;
    return oneRMGlobal;
  }, [profile?.settings.strengthBaselines, oneRMGlobal]);

  const upd = useCallback((id: string, field: keyof ProExerciseRow, val: any) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
  }, []);

  const addRow = useCallback(() => {
    setRows(prev => [...prev, { id: 'r' + Date.now(), exerciseId: 'bench_bar', week: activeWeek === 'all' ? 1 : activeWeek, day: 1, weight: 60, reps: 8, sets: 3, rpe: 7 }]);
  }, [activeWeek]);

  const delRow = useCallback((id: string) => { setRows(prev => prev.filter(r => r.id !== id)); }, []);

  const getEx = useCallback((exerciseId: string) => getExerciseById(exerciseId) as Exercise | undefined, []);

  // Filter rows by selected week
  const visibleRows = useMemo(() => {
    if (activeWeek === 'all') return rows;
    return rows.filter(r => r.week === activeWeek);
  }, [rows, activeWeek]);

  // Full pro analysis
  const analysis: FullVolumeAnalysis | null = useMemo(() => {
    if (rows.length === 0) return null;
    return analyzeFullVolume(rows, level, weakPoints);
  }, [rows, level, weakPoints]);

  // Volume progression
  const progression = useMemo(() => {
    if (rows.length === 0) return null;
    // Use rows from week 1 as base, generate progression
    const wk1Rows = rows.filter(r => r.week === 1);
    if (wk1Rows.length === 0) return null;
    return planVolumeProgression(wk1Rows, level, mesoWeeks);
  }, [rows, level, mesoWeeks]);

  // SFR swaps
  const swaps: ExerciseSwapRec[] = useMemo(() => {
    if (rows.length === 0) return [];
    return findBetterExerciseSwaps(rows, level);
  }, [rows, level]);

  // Coverage gaps
  const gaps: CoverageGap[] = useMemo(() => {
    if (rows.length === 0) return [];
    return findCoverageGaps(rows, level);
  }, [rows, level]);

  // Generate week rows from progression
  const generateProgression = useCallback(() => {
    if (!progression) return;
    const wk1Rows = rows.filter(r => r.week === 1);
    const newRows: ProExerciseRow[] = [...wk1Rows];
    progression.weeks.forEach((w, wi) => {
      if (wi === 0) return; // week 1 already exists
      wk1Rows.forEach(r => {
        const ex = getEx(r.exerciseId);
        if (!ex) return;
        const muscle = ex.group;
        const targetSets = w.setsByMuscle[muscleRu(muscle)] ?? w.setsByMuscle[muscle] ?? 0;
        const setsScale = r.sets > 0 ? Math.max(1, Math.round(targetSets / Object.values(w.setsByMuscle).reduce((a, b) => a + b, 0) * r.sets)) : 3;
        newRows.push({
          id: 'rp' + wi + '_' + r.id + '_' + Date.now(),
          exerciseId: r.exerciseId,
          week: wi + 1,
          day: r.day,
          weight: Math.round(r.weight * (0.95 + wi * 0.02)),
          reps: r.reps,
          sets: Math.min(setsScale, r.sets + 2),
          rpe: Math.max(6, (r.rpe || 7) - 1),
          oneRM: r.oneRM,
        });
      });
    });
    setRows(newRows);
    setActiveWeek('all');
  }, [progression, rows, getEx]);

  const toggleSection = useCallback((key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const swapExercise = useCallback((rowId: string, newExerciseId: string) => {
    upd(rowId, 'exerciseId', newExerciseId);
  }, [upd]);

  // ── Helpers ──
  const renderSFRBadge = (exerciseId: string): React.ReactNode => {
    const sfr = getSFRProfile(exerciseId);
    if (!sfr) return <span style={{ fontSize: 9, color: DIM }}>—</span>;
    const color = SFR_TIER_COLOR[sfr.tier] || DIM;
    return (
      <span style={{ padding: '1px 6px', borderRadius: 3, fontSize: 9, fontWeight: 700, background: color + '22', color, border: '1px solid ' + color + '44' }}>
        {sfr.tier} · {sfr.sfrRatio.toFixed(2)}
      </span>
    );
  };

  const renderBar = (value: number, max: number, color: string): React.ReactNode => {
    const pct = Math.min(100, Math.max(0, max > 0 ? (value / max) * 100 : 0));
    return (
      <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, marginTop: 2 }}>
        <div style={{ width: pct + '%', height: '100%', borderRadius: 3, background: color, transition: 'width 0.3s' }} />
      </div>
    );
  };

  const sectionHeader = (key: string, icon: string, title: string): React.ReactNode => (
    <button onClick={() => toggleSection(key)}
      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', background: 'none', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 13, fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <span>{expandedSections[key] ? '▼' : '▶'}</span>
      <span>{icon}</span>
      <span style={{ color: ACCENT }}>{title}</span>
    </button>
  );

  // ── Render ──
  const weekTabs = [];
  for (let w = 1; w <= mesoWeeks; w++) {
    weekTabs.push(
      <button key={w} onClick={() => setActiveWeek(w)}
        style={{
          padding: '4px 10px', borderRadius: 5, border: activeWeek === w ? '1px solid ' + ACCENT : '1px solid rgba(255,255,255,0.08)',
          background: activeWeek === w ? 'rgba(0,230,138,0.1)' : 'transparent', color: activeWeek === w ? ACCENT : DIM,
          fontSize: 10, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
        }}>
        Н{w}
      </button>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: ACCENT, margin: '4px 0 10px' }}>
        📐 Расчёт объёма и оптимизация PRO
      </div>

      {/* ── Controls row ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ minWidth: 130 }}>
          <label style={{ display: 'block', fontSize: 9, color: DIM, marginBottom: 1 }}>Уровень</label>
          <select value={level} onChange={e => setLevel(e.target.value as TrainingLevel)} style={IN}>
            <option value="beginner">Начальный</option>
            <option value="intermediate">Средний</option>
            <option value="advanced">Продвинутый</option>
            <option value="enhanced">Энхансд</option>
          </select>
        </div>
        <div style={{ minWidth: 80 }}>
          <label style={{ display: 'block', fontSize: 9, color: DIM, marginBottom: 1 }}>Недель</label>
          <select value={mesoWeeks} onChange={e => setMesoWeeks(+e.target.value)} style={IN}>
            {[1, 2, 3, 4, 5, 6, 8, 12].map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>
        <div style={{ minWidth: 100 }}>
          <label style={{ display: 'block', fontSize: 9, color: DIM, marginBottom: 1 }}>1RM глоб. (кг)</label>
          <input type="number" value={oneRMGlobal} onChange={e => setOneRMGlobal(+e.target.value)} style={IN} min={0} max={500} />
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', paddingBottom: 2 }}>
          {weekTabs}
          <button onClick={() => setActiveWeek('all')}
            style={{
              padding: '4px 10px', borderRadius: 5, border: activeWeek === 'all' ? '1px solid ' + ACCENT : '1px solid rgba(255,255,255,0.08)',
              background: activeWeek === 'all' ? 'rgba(0,230,138,0.1)' : 'transparent', color: activeWeek === 'all' ? ACCENT : DIM,
              fontSize: 10, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
            Все
          </button>
        </div>
        <button onClick={generateProgression}
          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.06)', color: ACCENT, fontWeight: 700, fontSize: 10, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          Авто-прогрессия
        </button>
      </div>

      {/* ── Exercise rows ── */}
      <div style={CARD}>
        <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 8 }}>
          Упражнения {activeWeek !== 'all' ? `— Неделя ${activeWeek}` : '— Все недели'} ({visibleRows.length})
        </div>
        {visibleRows.map(row => {
          const ex = getEx(row.exerciseId);
          return (
            <div key={row.id} style={{ display: 'flex', gap: 6, alignItems: 'end', marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ flex: 2.5, minWidth: 140 }}>
                <PopupSelect label="Упражнение" value={row.exerciseId}
                  options={EXERCISE_CATALOG.map(e => ({ id: e.id, label: e.name, desc: `${e.group} · ${e.type === 'compound' ? 'Базовое' : 'Изолированное'}` }))}
                  hint="Начните вводить для поиска" onChange={v => upd(row.id, 'exerciseId', v)} />
              </div>
              <div style={{ flex: 0.5 }}>
                <label style={{ display: 'block', fontSize: 8, color: DIM }}>Нед</label>
                <input type="number" value={row.week} onChange={e => upd(row.id, 'week', +e.target.value)} style={IN} min={1} max={mesoWeeks} />
              </div>
              <div style={{ flex: 0.5 }}>
                <label style={{ display: 'block', fontSize: 8, color: DIM }}>День</label>
                <input type="number" value={row.day} onChange={e => upd(row.id, 'day', +e.target.value)} style={IN} min={1} max={7} />
              </div>
              <div style={{ flex: 0.8 }}>
                <label style={{ display: 'block', fontSize: 8, color: DIM }}>Вес</label>
                <input type="number" value={row.weight} onChange={e => upd(row.id, 'weight', +e.target.value)} style={IN} min={0} />
              </div>
              <div style={{ flex: 0.6 }}>
                <label style={{ display: 'block', fontSize: 8, color: DIM }}>Повт</label>
                <input type="number" value={row.reps} onChange={e => upd(row.id, 'reps', +e.target.value)} style={IN} min={0} />
              </div>
              <div style={{ flex: 0.6 }}>
                <label style={{ display: 'block', fontSize: 8, color: DIM }}>Подх</label>
                <input type="number" value={row.sets} onChange={e => upd(row.id, 'sets', +e.target.value)} style={IN} min={0} />
              </div>
              <div style={{ flex: 0.6 }}>
                <label style={{ display: 'block', fontSize: 8, color: DIM }}>RPE</label>
                <input type="number" value={row.rpe ?? ''} onChange={e => { const v = +e.target.value; upd(row.id, 'rpe', v >= 5 && v <= 10 ? v : undefined); }} style={IN} min={5} max={10} step={0.5} placeholder="7" />
              </div>
              <div style={{ flex: 0.8, minWidth: 45, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <label style={{ display: 'block', fontSize: 8, color: DIM }}>SFR</label>
                {renderSFRBadge(row.exerciseId)}
              </div>
              <button onClick={() => delRow(row.id)} style={{ padding: '4px 8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: 4, cursor: 'pointer', fontSize: 10, alignSelf: 'center' }}>✕</button>
            </div>
          );
        })}
        <button onClick={addRow}
          style={{ width: '100%', padding: '8px', background: 'rgba(0,230,138,0.04)', border: '1px dashed rgba(0,230,138,0.25)', color: ACCENT, borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
          + Добавить упражнение
        </button>
      </div>

      {/* ── Summary ── */}
      {analysis && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, margin: '12px 0' }}>
          <MetricCard title="Всего подходов" icon="✅" accent={ACCENT}>
            <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{analysis.totalSets}</div>
            <div style={{ fontSize: 9, color: DIM }}>за {analysis.weekCount} нед</div>
          </MetricCard>
          <MetricCard title="Тоннаж" icon="📦" accent={ACCENT}>
            <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{(analysis.totalTonnage / 1000).toFixed(1)}k</div>
            <div style={{ fontSize: 9, color: DIM }}>кг·повт</div>
          </MetricCard>
          <MetricCard title="КПШ" icon="⚡" accent={ACCENT}>
            <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{(analysis.totalKPSh / 1000).toFixed(1)}k</div>
            <div style={{ fontSize: 9, color: DIM }}>инт. ед.</div>
          </MetricCard>
          <MetricCard title="Качество" icon="🎯" accent={analysis.quality.overall >= 70 ? '#22c55e' : analysis.quality.overall >= 45 ? '#f59e0b' : '#ef4444'}>
            <div style={{ fontSize: 20, fontWeight: 800, color: analysis.quality.overall >= 70 ? '#22c55e' : analysis.quality.overall >= 45 ? '#f59e0b' : '#ef4444' }}>{analysis.quality.overall}</div>
            <div style={{ fontSize: 9, color: DIM }}>/ 100</div>
          </MetricCard>
        </div>
      )}

      {/* ── SECTION: Split Quality ── */}
      {analysis && (
        <div style={CARD}>
          {sectionHeader('quality', '🎯', 'Качество сплита')}
          {expandedSections.quality && (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {([
                  { label: 'Распределение объёма', val: analysis.quality.volumeDistribution, w: 0.3 },
                  { label: 'Частота', val: analysis.quality.frequencyOptimization, w: 0.15 },
                  { label: 'Выбор упражнений', val: analysis.quality.exerciseSelection, w: 0.25 },
                  { label: 'Управление интенсивностью', val: analysis.quality.intensityManagement, w: 0.15 },
                  { label: 'Баланс восстановления', val: analysis.quality.recoveryBalance, w: 0.15 },
                ] as { label: string; val: number; w: number }[]).map(item => {
                  const color = item.val >= 70 ? '#22c55e' : item.val >= 45 ? '#f59e0b' : '#ef4444';
                  return (
                    <div key={item.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, marginBottom: 2 }}>
                        <span style={{ color: DIM }}>{item.label}</span>
                        <span style={{ color, fontWeight: 700 }}>{item.val}</span>
                      </div>
                      {renderBar(item.val, 100, color)}
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 8, fontSize: 10, color: DIM }}>
                База/изоляция: {analysis.quality.compoundIsolationRatio}/{100 - analysis.quality.compoundIsolationRatio}
              </div>
              {analysis.quality.strengths.length > 0 && (
                <div style={{ marginTop: 6, fontSize: 10 }}>
                  {analysis.quality.strengths.slice(0, 3).map((s, i) => (
                    <div key={i} style={{ color: '#22c55e', marginBottom: 2 }}>✓ {s}</div>
                  ))}
                </div>
              )}
              {analysis.quality.issues.length > 0 && (
                <div style={{ marginTop: 4, fontSize: 10 }}>
                  {analysis.quality.issues.slice(0, 4).map((s, i) => (
                    <div key={i} style={{ color: '#ef4444', marginBottom: 2 }}>⚠ {s}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── SECTION: CNS + Recovery ── */}
      {analysis && (
        <div style={CARD}>
          {sectionHeader('cnsRecovery', '🧠', 'ЦНС и восстановление')}
          {expandedSections.cnsRecovery && (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', marginBottom: 6 }}>ЦНС-усталость</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: analysis.cnsFatigue.totalCNSScore > analysis.cnsFatigue.maxRecommended ? '#ef4444' : analysis.cnsFatigue.totalCNSScore > analysis.cnsFatigue.maxRecommended * 0.7 ? '#f59e0b' : '#22c55e' }}>
                    {analysis.cnsFatigue.totalCNSScore}
                    <span style={{ fontSize: 11, color: DIM, fontWeight: 400 }}> / {analysis.cnsFatigue.maxRecommended}</span>
                  </div>
                  {renderBar(analysis.cnsFatigue.totalCNSScore, analysis.cnsFatigue.maxRecommended * 1.5, '#a78bfa')}
                  <div style={{ marginTop: 6, fontSize: 9, color: DIM }}>
                    Тяж. компаунд: {analysis.cnsFatigue.heavyCompoundSets} · Тяж. изоляция: {analysis.cnsFatigue.heavyIsolationSets}
                  </div>
                  {analysis.cnsFatigue.warning && <div style={{ marginTop: 4, fontSize: 9, color: '#ef4444', fontWeight: 700 }}>⚠ {analysis.cnsFatigue.warning}</div>}
                  <div style={{ marginTop: 4, fontSize: 9, color: DIM }}>{analysis.cnsFatigue.recommendation}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', marginBottom: 6 }}>Ёмкость восстановления</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: analysis.recovery.utilizationPercent > 100 ? '#ef4444' : analysis.recovery.utilizationPercent > 80 ? '#f59e0b' : '#22c55e' }}>
                    {analysis.recovery.utilizationPercent}%
                  </div>
                  {renderBar(analysis.recovery.utilizationPercent, 100, '#60a5fa')}
                  <div style={{ marginTop: 6, fontSize: 9, color: DIM }}>
                    {analysis.recovery.totalWeeklySets} / {analysis.recovery.estimatedMaxRecoverable} подходов · Системная: {analysis.recovery.systemicFatigue}%
                  </div>
                  {analysis.recovery.deloadRecommended && <div style={{ marginTop: 4, fontSize: 9, color: '#ef4444', fontWeight: 700 }}>⚠ {analysis.recovery.deloadReason}</div>}
                  {Object.entries(analysis.recovery.localFatigueByMuscle).length > 0 && (
                    <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                      {Object.entries(analysis.recovery.localFatigueByMuscle).slice(0, 6).map(([m, v]) => (
                        <span key={m} style={{ fontSize: 8, padding: '2px 5px', borderRadius: 3, background: v > 100 ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)', color: v > 100 ? '#ef4444' : DIM }}>
                          {muscleRu(m)} {v}%
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SECTION: Per-Muscle Analysis ── */}
      {analysis && (
        <div style={CARD}>
          {sectionHeader('muscles', '💪', 'Анализ по группам мышц')}
          {expandedSections.muscles && (
            <div style={{ marginTop: 10 }}>
              {analysis.perMuscle.map(m => {
                const color = STATUS_COLOR[m.status];
                return (
                  <div key={m.muscle} style={{ marginBottom: 10, padding: 10, background: 'rgba(255,255,255,0.02)', borderRadius: 8, borderLeft: '3px solid ' + color }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div>
                        <span style={{ fontSize: 12, fontWeight: 700 }}>{m.muscleRu}</span>
                        <span style={{ ...BADGE(color), marginLeft: 6 }}>{STATUS_LABEL[m.status]}</span>
                      </div>
                      <div style={{ fontSize: 9, color: DIM }}>
                        SFR ср. {m.avgSFR.toFixed(2)} · Эфф. {m.efficiencyScore}%
                      </div>
                    </div>
                    {/* MEV/MAV/MRV bar */}
                    <div style={{ position: 'relative', height: 22, marginBottom: 6 }}>
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.04)', borderRadius: 4 }} />
                      {/* MEV zone */}
                      <div style={{ position: 'absolute', left: 0, width: (m.mev / m.mrv * 100) + '%', height: '100%', background: 'rgba(34,197,94,0.15)', borderRadius: '4px 0 0 4px' }} />
                      {/* MAV zone */}
                      <div style={{ position: 'absolute', left: (m.mev / m.mrv * 100) + '%', width: ((m.mav - m.mev) / m.mrv * 100) + '%', height: '100%', background: 'rgba(0,230,138,0.1)' }} />
                      {/* Current marker */}
                      <div style={{ position: 'absolute', left: Math.min(98, (m.currentSets / m.mrv * 100)) + '%', top: -3, width: 4, height: 28, background: color, borderRadius: 2, transform: 'translateX(-50%)', zIndex: 2, boxShadow: '0 0 6px ' + color }} />
                      {/* Labels */}
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px', zIndex: 1, fontSize: 8, color: DIM }}>
                        <span>MEV {m.mev}</span><span>MAV {m.mav}</span><span>MRV {m.mrv}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 9, color: DIM, flexWrap: 'wrap' }}>
                      <span>Подходов: <b style={{ color }}>{m.currentSets}</b></span>
                      <span>База: {m.compoundSets} / Изоляция: {m.isolationSets}</span>
                      <span>Тяж (&gt;85%): {m.heavySets}</span>
                      <span>Частота: {m.currentFreq}×/нед (опт: {m.optimalFreq})</span>
                      <span>Восст: ~{m.recoveryHoursEst}ч</span>
                    </div>
                    {m.actionableTips.length > 0 && (
                      <div style={{ marginTop: 4 }}>
                        {m.actionableTips.map((t, i) => (
                          <div key={i} style={{ fontSize: 9, color: '#f59e0b', marginBottom: 1 }}>💡 {t}</div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── SECTION: Progression Planner ── */}
      {progression && (
        <div style={CARD}>
          {sectionHeader('progression', '📈', 'Планировщик прогрессии')}
          {expandedSections.progression && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 9, color: DIM, marginBottom: 8 }}>Модель: {progression.progressionModel}</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9 }}>
                  <thead>
                    <tr style={{ color: ACCENT }}>
                      <th style={{ padding: 4, textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Неделя</th>
                      <th style={{ padding: 4, textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Фаза</th>
                      <th style={{ padding: 4, textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Всего подх</th>
                      <th style={{ padding: 4, textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Интенсивность</th>
                      <th style={{ padding: 4, textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>RIR</th>
                      <th style={{ padding: 4, textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>По мышцам</th>
                    </tr>
                  </thead>
                  <tbody>
                    {progression.weeks.map(w => (
                      <tr key={w.weekIndex} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: 4, fontWeight: 700 }}>{w.weekIndex + 1}</td>
                        <td style={{ padding: 4, color: w.phase === 'deload' ? '#60a5fa' : ACCENT }}>{w.phaseRu}</td>
                        <td style={{ padding: 4, textAlign: 'center' }}>{w.targetTotalSets}</td>
                        <td style={{ padding: 4, textAlign: 'center', color: DIM }}>{w.intensityZone}</td>
                        <td style={{ padding: 4, textAlign: 'center', color: '#f59e0b' }}>{w.rirTarget}</td>
                        <td style={{ padding: 4, fontSize: 7, color: DIM }}>
                          {Object.entries(w.setsByMuscle).slice(0, 5).map(([m, s]) => `${m}:${s}`).join(', ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SECTION: Coverage Gaps ── */}
      {gaps.length > 0 && (
        <div style={CARD}>
          {sectionHeader('gaps', '🔍', 'Пробелы в покрытии')}
          {expandedSections.gaps && (
            <div style={{ marginTop: 10 }}>
              {gaps.map(g => (
                <div key={g.muscle} style={{ padding: 8, marginBottom: 4, background: g.missing ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.06)', borderRadius: 6, borderLeft: '3px solid ' + (g.missing ? '#ef4444' : '#f59e0b') }}>
                  <div style={{ fontSize: 10, fontWeight: 700 }}>
                    {g.missing ? '❌' : '⚠'} {g.muscleRu} — {g.missing ? 'НЕТ упражнений' : `${g.sets}/${g.mev} подходов (ниже MEV)`}
                  </div>
                  <div style={{ fontSize: 9, color: DIM, marginTop: 2 }}>💡 {g.suggestion}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SECTION: SFR Swaps ── */}
      {swaps.length > 0 && (
        <div style={CARD}>
          {sectionHeader('swaps', '🔄', 'Рекомендации по замене (SFR-экономика)')}
          {expandedSections.swaps && (
            <div style={{ marginTop: 10 }}>
              {swaps.slice(0, 5).map(s => (
                <div key={s.currentExerciseId} style={{ marginBottom: 8, padding: 10, background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: DIM, marginBottom: 4 }}>
                    Текущее: <b style={{ color: '#fff' }}>{s.currentName}</b> <span style={{ fontSize: 9, color: '#f59e0b' }}>(SFR {s.currentSFR.toFixed(2)})</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {s.betterOptions.map((opt, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', background: 'rgba(0,230,138,0.04)', borderRadius: 4 }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: ACCENT }}>→ {opt.name}</span>
                        <span style={{ ...BADGE('#22c55e') }}>SFR {opt.sfr.toFixed(2)}</span>
                        <span style={{ fontSize: 8, color: DIM }}>{opt.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SFR Reference ── */}
      {analysis && (
        <div style={CARD}>
          {sectionHeader('reference', '📖', 'SFR-экономика упражнений (справка)')}
          {expandedSections.reference && (
            <div style={{ marginTop: 10, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9 }}>
                <thead>
                  <tr style={{ color: ACCENT }}>
                    <th style={{ padding: 3, textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Упражнение</th>
                    <th style={{ padding: 3, textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Тир</th>
                    <th style={{ padding: 3, textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>SFR</th>
                    <th style={{ padding: 3, textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Стим</th>
                    <th style={{ padding: 3, textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>ЛокУст</th>
                    <th style={{ padding: 3, textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>СисУст</th>
                    <th style={{ padding: 3, textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Лучше всего для</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 10).map(r => {
                    const sfr = getSFRProfile(r.exerciseId);
                    const ex = getEx(r.exerciseId);
                    if (!sfr || !ex) return null;
                    return (
                      <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: 3, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>{ex.name}</td>
                        <td style={{ padding: 3, textAlign: 'center', color: SFR_TIER_COLOR[sfr.tier], fontWeight: 700 }}>{sfr.tier}</td>
                        <td style={{ padding: 3, textAlign: 'center', color: '#22c55e' }}>{sfr.sfrRatio.toFixed(2)}</td>
                        <td style={{ padding: 3, textAlign: 'center' }}>{sfr.stimulus}</td>
                        <td style={{ padding: 3, textAlign: 'center' }}>{sfr.localFatigue}</td>
                        <td style={{ padding: 3, textAlign: 'center' }}>{sfr.systemicFatigue}</td>
                        <td style={{ padding: 3, fontSize: 8, color: DIM }}>{sfr.bestFor}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ fontSize: 8, color: DIM, marginTop: 6, lineHeight: 1.5 }}>
                SFR = Стимул / (ЛокУст + СисУст). Тир S — идеальный баланс, A — отличный, B — средний, C — высокоутомляемый.<br />
                Стим = гипертрофический стимул для целевой мышцы (0-100). ЛокУст = локальная мышечная усталость. СисУст = системная/ЦНС усталость.<br />
                Правило: базовые упражнения дают больше стимула, но и больше усталости. Изоляция эффективнее на единицу усталости.
              </div>
            </div>
          )}
        </div>
      )}
      {analysis && (
        <div style={{ marginTop: 8, padding: 12, borderRadius: 12, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginBottom: 8 }}>🔗 Применить оптимизированный объём к планировщику: целевые сеты по группам (MAV) → планировщик учтёт при распределении объёма.</div>
          <button onClick={() => { const sets: Record<string, number> = {}; analysis.perMuscle.forEach(m => { sets[m.muscle] = m.mav; }); applyToPlanner({ kind: 'volume', label: 'Оптимизация объёма: ' + Object.entries(sets).map(([g, s]) => g + '=' + s).join(', '), data: { sets } }); }} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 13, minHeight: 44 }}>🛠 Применить объём к планировщику</button>
        </div>
      )}
    </div>
  );
};
