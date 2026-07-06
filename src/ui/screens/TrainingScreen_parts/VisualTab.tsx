import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { EXERCISE_CATALOG, getExercisesByGroup } from '../../../core/exercise-catalog';
import { calcTraining, calcExercisePrescription, EXERCISE_DB, TRAINING_SPLITS, TRAINING_LEVEL_CONFIGS, LEVEL_VOLUMES } from '../../../engines/training.engine';
import { generateMacrocycle, generateBlockPlan, getCurrentWeekPlan, BLOCK_SEQUENCES, type MacrocyclePlan, type Microcycle, type MacrocycleInput } from '../../../engines/training-periodization.engine';
import { selectSplit, getSplitOptions, type SplitCandidate } from '../../../engines/split-selector.engine';
import { selectProgressionRule } from '../../../engines/progression.engine';
import { RIR_MATRIX, generateWeeklyPlan } from '../../../engines/rir-matrix.engine';
import { StrengthDiary, type StrengthStats, type WeeklyProgress, type ProgressionAlert } from '../../../engines/strength-diary.engine';
import type { WorkoutLog } from '../../../core/types';
import { generateWarmup } from '../../../engines/warmup.engine';
import { generateCooldown } from '../../../engines/cooldown.engine';
import { selectSetScheme } from '../../../engines/set-scheme.engine';
import { selectTempo, formatTempo } from '../../../engines/tempo.engine';
import { useDataLink } from '../../../core/data-link';
import type { TrainingInput, TrainingOutput, Exercise, MovementPattern } from '../../../core/types';
import { computeAnalytics, type AnalyticsSnapshot, type WeeklyBreakdown } from '../../../engines/analytics-engine';
import { computeConstraints } from '../../../engines/training-constraints.engine';
import { generatePeriodization, getPhaseParams } from '../../../engines/cycle-periodization.engine';
import { getTrainingMethods, getMethodsByCategory, getVolumeReferences, getVolumeByMuscle, getSplitVisuals, type TrainingMethod } from '../../../engines/training-methodology.engine';
import { buildVisualDashboard, computeWeeklyChart, computeMuscleVolume, computeProgression, type VizSessionData } from '../../../engines/training-visualization.engine';
import { getProgramById, getProgramsByGoal, FULL_PROGRAM_LIBRARY } from '../../../engines/complete-program-library.engine';
import { generateWeeklyReport, analyzeMeasurements, loadMeasurements, saveMeasurement, type BodyMeasurement } from '../../../engines/log-analytics-progression.engine';
import { getExerciseBio } from '../../../data/exercise-biomechanics-db';
import { getStrengthLevel, getNextLevelTarget } from '../../../engines/performance-analytics.engine';
import { computeStructuredAnalytics } from '../../../engines/structured-analytics.engine';
import {
  WARMUP_LABELS, GOALS, LEVELS, MUSCLE_GROUPS, GROUP_LABELS, EQUIP_LABELS, JOINT_LABELS,
  PHASE_LABELS, PHASE_HINTS, TAB_LABELS,
  type TrainingTab, type TrainingPage,
} from './shared';


export const VisualTab: React.FC<{ sessions: any[] }> = ({ sessions }) => {
  const vizSessions: VizSessionData[] = React.useMemo(() => sessions.map((s:any) => ({
    week: s.weekNumber || 1, date: s.date || '', exercises: (s.exercises || []).map((e:any) => ({
      name: e.exerciseName || e.name || '', sets: e.sets?.length || 0, reps: Math.max(...(e.sets||[{reps:0}]).map((st:any)=>st.reps||0), 0),
      weight: Math.max(...(e.sets||[{weight:0}]).map((st:any)=>st.weight||0), 0), rpe: 7, volume: e.totalVolume || 0,
    }))
  })), [sessions]);
  const dashboard = React.useMemo(() => { try { return sessions.length > 2 ? buildVisualDashboard(vizSessions) : null; } catch { return null; } }, [sessions, vizSessions]);
  const weekly = React.useMemo(() => { try { return computeWeeklyChart(vizSessions); } catch { return []; } }, [vizSessions]);
  const muscleVol = React.useMemo(() => { try { return computeMuscleVolume(vizSessions); } catch { return []; } }, [vizSessions]);
  const prog = React.useMemo(() => { try { return computeProgression(vizSessions); } catch { return []; } }, [vizSessions]);

  if (sessions.length < 2) return (
    <div style={{ padding:24, textAlign:'center', background:'rgba(24,24,27,0.08)', borderRadius:16, border:'1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ fontSize:28, marginBottom:6 }}>📊</div>
      <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)' }}>Нужно минимум 2 тренировки для визуализации</div>
    </div>
  );

  const glassCard: React.CSSProperties = { padding:12, borderRadius:14, background:'rgba(24,24,27,0.12)', border:'1px solid rgba(255,255,255,0.04)', marginBottom:10 };
  const gLabel: React.CSSProperties = { fontSize:10, color:'rgba(255,255,255,0.35)', fontWeight:500, letterSpacing:'0.3px', textTransform:'uppercase', marginBottom:8 };

  return (<div style={{ display:'flex', flexDirection:'column', gap:4 }}>
    {/* Weekly Volume - Apple Bar Chart */}
    {dashboard && <div style={glassCard}>
      <div style={gLabel}>📈 Недельный объём</div>
      <div style={{ display:'flex', alignItems:'flex-end', gap:3, height:90, padding:'4px 2px' }}>
        {weekly.map((w,i) => { const maxV = Math.max(...weekly.map(x=>x.volume),1); return <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center' }}>
          <div style={{ width:'80%', borderRadius:'6px 6px 2px 2px', height:`${Math.max(6, (w.volume/maxV)*100)}%`, background:'linear-gradient(180deg,#00e68a,rgba(0,230,138,0.3))', transition:'height 0.4s cubic-bezier(0.22,1,0.36,1)' }} />
          <span style={{ fontSize:7, color:'rgba(255,255,255,0.35)', marginTop:4, fontWeight:500 }}>Н{w.week}</span>
        </div>})}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4, fontSize:9, marginTop:6, padding:'6px 4px', background:'rgba(255,255,255,0.03)', borderRadius:8 }}>
        <span style={{ color:'rgba(255,255,255,0.4)' }}>Пик <b style={{color:'#fff'}}>{(dashboard.summary as any).peakVolume || dashboard.summary.totalVolume}</b></span>
        <span style={{ color:'rgba(255,255,255,0.4)' }}>Интенс. <b style={{color:'#fff'}}>{dashboard.summary.avgIntensity}%</b></span>
        <span style={{ color:'rgba(255,255,255,0.4)' }}>Тренд <b style={{color:(dashboard.summary as any).trend==='up'?'#34d399':(dashboard.summary as any).trend==='down'?'#f87171':'#9ca3af'}}>{(dashboard.summary as any).trend==='up'?'↑ +':(dashboard.summary as any).trend==='down'?'↓ ':'→'}</b></span>
      </div>
    </div>}

    {/* Muscle volume - pill bars */}
    {muscleVol.length > 0 && <div style={glassCard}>
      <div style={gLabel}>💪 Объём по группам</div>
      {muscleVol.map((mv,i) => <div key={i} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
        <span style={{ width:55, fontSize:9, color:'rgba(255,255,255,0.5)', fontWeight:500, textAlign:'right' }}>{mv.muscle}</span>
        <div style={{ flex:1, background:'rgba(255,255,255,0.04)', borderRadius:8, height:10, overflow:'hidden', position:'relative' }}>
          <div style={{ width:`${mv.percent}%`, height:'100%', borderRadius:8, background:'linear-gradient(90deg,#3b82f6,#60a5fa)', transition:'width 0.5s cubic-bezier(0.22,1,0.36,1)' }} />
        </div>
        <span style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.7)', minWidth:32, textAlign:'right' }}>{mv.percent}%</span>
      </div>)}
    </div>}

    {/* 1RM Progression - sparkline mini cards */}
    {prog.length > 0 && <div style={glassCard}>
      <div style={gLabel}>📈 Прогрессия 1RM</div>
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {prog.slice(0,5).map((p,i) => {
          const maxRM = Math.max(...p.weeks.map(x=>x.estimated1RM),1);
          const latest = p.weeks[p.weeks.length-1]?.estimated1RM || 0;
          const first = p.weeks[0]?.estimated1RM || 0;
          const change = first > 0 ? Math.round((latest - first) / first * 100) : 0;
          return <div key={i} style={{ background:'rgba(255,255,255,0.03)', borderRadius:10, padding:'6px 8px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
              <span style={{ fontSize:9, fontWeight:600, color:'rgba(255,255,255,0.7)' }}>{p.exercise}</span>
              <span style={{ fontSize:9, fontWeight:700, color: change >= 0 ? '#34d399' : '#f87171' }}>{change >= 0 ? `+${change}` : change}%</span>
            </div>
            <div style={{ display:'flex', gap:2, alignItems:'flex-end', height:24 }}>
              {p.weeks.map((w,wi) => (
                <div key={wi} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center' }}>
                  <div style={{ width:'100%', borderRadius:'3px 3px 1px 1px', height:`${Math.max(3, (w.estimated1RM/maxRM)*24)}px`,
                    background: w.estimated1RM > (p.weeks[wi-1]?.estimated1RM||0) ? 'linear-gradient(180deg,#34d399,#059669)' : 'linear-gradient(180deg,#f87171,#dc2626)',
                    transition:'height 0.3s cubic-bezier(0.22,1,0.36,1)' }} />
                  <span style={{ fontSize:6, color:'rgba(255,255,255,0.25)', marginTop:1 }}>Н{w.week}</span>
                </div>
              ))}
            </div>
          </div>;
        })}
      </div>
    </div>}
  </div>);
};

// ── Analytics Tab Component ──
