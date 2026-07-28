import React, { useMemo } from 'react';
import { calcQualityScore } from './plan-quality-score';
import { computePlanQualityFor } from '../../../engines/manual-constructor';
import type { UserProgram } from '../../../engines/user-program/user-program.types';
import { GROUP_RU } from './program-types';
import { loadTrainingProfile } from './training-profile';
import { loadUserPrograms } from '../../../engines/user-program/program-store';

const ACCENT = '#00e68a';
const ru = (g: string) => GROUP_RU[g] || g;

/**
 * CalcQualityTab — теперь принимает UserProgram (из ProgramManagerPanel).
 * Если программы нет, пытается загрузить последнюю сохранённую.
 * Оценка идёт через computePlanQualityFor с PED/лаб-множителями.
 */
export const CalcQualityTab: React.FC<{ program?: UserProgram | null; level?: string; goal?: string; onBuildPlan: () => void }> = ({ program: propsProgram, level = 'intermediate', goal = 'hypertrophy', onBuildPlan }) => {
  const program = useMemo(() => {
    if (propsProgram) return propsProgram;
    const saved = loadUserPrograms();
    if (saved.length > 0) return saved[0];
    return null;
  }, [propsProgram]);

  const analysis = useMemo(() => {
    if (!program?.bb && !program?.pl?.customWeeks) return null;
    const prof = loadTrainingProfile();
    return computePlanQualityFor(program!, program!.meta.level || level, {
      onCourse: prof.onCourse ?? false,
      courseIntensity: prof.courseIntensity ?? 'moderate',
    });
  }, [program, level]);

  const hasData = !!(program?.bb || program?.pl?.customWeeks);
  if (!hasData) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: ACCENT, margin: '4px 0 8px' }}>🎯 Калькулятор качества программы</div>
        <div style={{ padding: 20, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>📭</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 12 }}>Нет активной ББ-программы. Создайте программу в «Планировщик» → «Мои программы» — и здесь появится полный разбор: объём по группам (MEV/MAV/MRV), оценка качества, предупреждения о перетренированности.</div>
          <button onClick={onBuildPlan} style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.08)', color: ACCENT, cursor: 'pointer', fontWeight: 700, fontSize: 11 }}>📋 Перейти к построению плана</button>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: ACCENT, margin: '4px 0 8px' }}>🎯 Калькулятор качества программы</div>
        <div style={{ padding: 20, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>📊</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 12 }}>Недостаточно данных для оценки. Добавьте упражнения в программу «{program.meta.title}».</div>
          <button onClick={onBuildPlan} style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.08)', color: ACCENT, cursor: 'pointer', fontWeight: 700, fontSize: 11 }}>📋 Редактировать программу</button>
        </div>
      </div>
    );
  }

  const sc = analysis.score >= 80 ? '#22c55e' : analysis.score >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: ACCENT, margin: '4px 0 8px' }}>🎯 Калькулятор качества программы</div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10 }}>Оценка программы «{program.meta.title}» по объёмным ориентирам (MEV/MAV/MRV) с учётом PED-адаптации и лабораторной коррекции.</div>

      <div style={{ padding: 12, borderRadius: 12, background: analysis.score >= 80 ? '#22c55e08' : analysis.score >= 50 ? '#f59e0b08' : '#ef444408', border: '1px solid ' + sc + '40', marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: sc }}>Оценка качества {analysis.grade}</span>
          <span style={{ fontSize: 22, fontWeight: 800, color: analysis.score >= 80 ? '#22c55e' : analysis.score >= 50 ? '#f59e0b' : '#ef4444' }}>{analysis.score}<span style={{ fontSize: 11, fontWeight: 600, opacity: 0.6 }}>/100</span></span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 8 }}>
          <div style={{ height: '100%', width: analysis.score + '%', background: sc }} />
        </div>
        {analysis.issues.map((iss, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, fontSize: 10, color: iss.startsWith('⚠') ? '#f59e0b' : iss.startsWith('⬇') ? '#3b82f6' : 'rgba(255,255,255,0.7)' }}>
            <span style={{ fontWeight: 700 }}>{iss}</span>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 6 }}>Объём по группам (Мышца · Сеты · MEV · MAV · MRV · %)</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {analysis.perMuscle.map(pm => {
          const st = pm.status === 'over' ? '#ef4444' : pm.status === 'low' ? '#3b82f6' : pm.status === 'high' ? '#f59e0b' : '#22c55e';
          return (
            <div key={pm.muscle} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6, background: st + '10', border: '1px solid ' + st + '30', fontSize: 11 }}>
              <span style={{ fontWeight: 700, color: '#fff' }}>{ru(pm.muscle)}</span>
              <span style={{ color: st, fontWeight: 700 }}>{pm.sets}</span>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>· MEV {pm.mev} · MAV {pm.mav} · MRV {pm.mrv} · {Math.round(pm.mrv > 0 ? (pm.sets / pm.mrv) * 100 : 0)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CalcQualityTab;