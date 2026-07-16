import React from 'react';
import { ACCENT, DIM, GROUP_RU } from './types';
import { getVolumeLandmarks } from '../../../../engines/volume-landmarks.engine';

interface Props {
  generatedDays: any[];
  weeklySets: Record<string, number>;
  mrvOverride: number | null;
  level: string;
  corrections: string[];
  onCourse?: boolean;
  courseIntensity?: string;
  labMult?: number;
}

const GROUP_COLORS: Record<string, string> = {
  chest: '#ef4444', back: '#3b82f6', legs: '#22c55e', shoulders: '#f59e0b',
  arms: '#a855f7', core: '#ec4899',
};

const LEVEL_BASE_MRV: Record<string, number> = { beginner: 15, intermediate: 20, advanced: 24, enhanced: 28 };

export const PlanPreviewStep5: React.FC<Props> = ({ generatedDays, weeklySets, mrvOverride, level, corrections, onCourse, courseIntensity, labMult }) => {
  const levelBaseMrv = LEVEL_BASE_MRV[level] ?? 20;
  const mrvScale = mrvOverride != null && levelBaseMrv > 0 ? mrvOverride / levelBaseMrv : 1;
  const mrvFor = (g: string): number => {
    const lm = getVolumeLandmarks(level, g);
    let mrv = lm ? lm.mrv : levelBaseMrv;
    mrv = Math.round(mrv * mrvScale);
    if (onCourse) {
      const courseMult = courseIntensity === 'heavy' ? 1.3 : courseIntensity === 'moderate' ? 1.2 : 1.15;
      mrv = Math.round(mrv * courseMult);
    }
    if (labMult) mrv = Math.round(mrv * labMult);
    return mrv;
  };
  const totalEx = generatedDays.reduce((s: number, d: any) => s + d.exercises.length, 0);
  const totalSets = generatedDays.reduce((s: number, d: any) => s + d.exercises.reduce((ss: number, e: any) => ss + e.sets, 0), 0);
  const compoundCount = generatedDays.reduce((s: number, d: any) => s + d.exercises.filter((e: any) => e.role === 'main').length, 0);
  const avgExPerDay = Math.round(totalEx / Math.max(1, generatedDays.length));

  return (
    <>
      {/* Ключевые метрики */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
        {[
          { label: 'Упражнений', value: totalEx, unit: 'всего', color: '#60a5fa' },
          { label: 'Сетов/нед', value: totalSets, unit: '', color: ACCENT },
          { label: 'Базовых', value: compoundCount, unit: '', color: '#22c55e' },
          { label: 'Упр/день', value: avgExPerDay, unit: 'ср', color: '#a855f7' },
          { label: 'Дней', value: generatedDays.length, unit: '', color: '#f59e0b' },
        ].map((m, i) => (
          <div key={i} style={{ padding: '6px 8px', borderRadius: 8, background: m.color + '08', border: `1px solid ${m.color}15`, textAlign: 'center' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: DIM, marginBottom: 2 }}>{m.label}</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: m.color }}>{m.value}<span style={{ fontSize: 9, fontWeight: 600, opacity: 0.6 }}> {m.unit}</span></div>
          </div>
        ))}
      </div>

      {/* Объём по группам (бары) */}
      {Object.keys(weeklySets).length > 0 && (
        <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#22c55e', marginBottom: 6 }}>📊 Объём по группам (сетов/нед)</div>
          {Object.entries(weeklySets).map(([g, sets]) => {
            const mrvG = mrvFor(g);
            const pct = Math.min(100, Math.round((sets as number) / mrvG * 100));
            const color = (sets as number) > mrvG * 1.1 ? '#ef4444' : (sets as number) < mrvG * 0.4 ? '#f59e0b' : '#22c55e';
            return (
              <div key={g} style={{ marginBottom: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, marginBottom: 2 }}>
                  <span style={{ color: GROUP_COLORS[g] || DIM, fontWeight: 600 }}>{GROUP_RU[g] || g}</span>
                  <span style={{ color, fontWeight: 700 }}>{sets} сетов</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: pct + '%', borderRadius: 3, background: color, transition: 'width 0.5s' }} />
                </div>
                <div style={{ fontSize: 7, color: DIM, marginTop: 1 }}>
                  {pct < 40 ? 'Недогруз (MEV)' : pct > 110 ? 'Перегруз (MRV)' : 'Оптимум'} · MRV: {mrvG}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Превью дней */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa', marginBottom: 4 }}>📅 Распределение по дням</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {generatedDays.map((d: any, i: number) => {
            const daySets = d.exercises.reduce((s: number, e: any) => s + e.sets, 0);
            return (
              <div key={i} style={{
                padding: '6px 8px', borderRadius: 8, minWidth: 80, flex: 1,
                background: 'rgba(96,165,250,0.04)', border: '1px solid rgba(96,165,250,0.1)',
              }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#60a5fa', marginBottom: 2 }}>День {d.day}</div>
                <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginBottom: 2 }}>
                  {d.groups.map((g: string) => (
                    <span key={g} style={{ fontSize: 7, padding: '1px 4px', borderRadius: 3, background: (GROUP_COLORS[g] || '#666') + '20', color: GROUP_COLORS[g] || '#ccc', fontWeight: 600 }}>
                      {GROUP_RU[g] || g}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: 8, color: DIM }}>{d.exercises.length} упр · {daySets} сетов</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Предупреждения */}
      {corrections.filter(c => c.includes('⚠')).length > 0 && (
        <div style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', marginBottom: 8 }}>
          {corrections.filter(c => c.includes('⚠')).map((c, i) => (
            <div key={i} style={{ fontSize: 9, color: '#ef4444', lineHeight: 1.4 }}>{c}</div>
          ))}
        </div>
      )}
    </>
  );
};
