import React, { useMemo } from 'react';
import {
  generateMesocycleProgression,
  generateInterMesocycleProgression,
  phaseDistribution,
  type MesocycleConfig,
  type WeekProgression,
  type InterMesoStep,
} from '../../../engines/pro/mesocycle-progression.engine';
import type { MesocyclePhase } from '../../../engines/rir-matrix.engine';
import { applyToPlanner } from './planner-bridge';

const ACCENT = '#00e68a';

const PHASE_COLORS: Record<MesocyclePhase, string> = {
  base: '#22c55e',
  build: '#eab308',
  peak: '#ef4444',
  deload: '#60a5fa',
};

const PHASE_RU: Record<MesocyclePhase, string> = {
  base: 'База',
  build: 'Накопление',
  peak: 'Пик',
  deload: 'Разгрузка',
};

const CARD: React.CSSProperties = { background: 'rgba(24,24,27,0.6)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)', padding: '12px', margin: '6px 0' };

export interface MesocycleProgressionCardProps {
  weeks?: number;
  startVolumeSets?: number;
  startIntensityPct?: number;
  startRIR?: number;
  goal?: 'strength' | 'hypertrophy' | 'power';
  fatigueTrajectory?: number[];
  title?: string;
}

export const MesocycleProgressionCard: React.FC<MesocycleProgressionCardProps> = ({
  weeks = 12,
  startVolumeSets = 18,
  startIntensityPct = 0.72,
  startRIR = 3,
  goal = 'hypertrophy',
  fatigueTrajectory,
  title,
}) => {
  const config: MesocycleConfig = { weeks, startVolumeSets, startIntensityPct, startRIR, goal, fatigueTrajectory };

  const progression = useMemo(() => generateMesocycleProgression(config), [weeks, startVolumeSets, startIntensityPct, startRIR, goal, fatigueTrajectory]);
  const interMeso = useMemo(() => generateInterMesocycleProgression(config, 3), [weeks, startVolumeSets, startIntensityPct, startRIR, goal]);
  const dist = useMemo(() => phaseDistribution(weeks), [weeks]);

  const maxVolSets = Math.max(1, ...progression.map(p => p.volumeSets));
  const phases = Object.keys(PHASE_COLORS) as MesocyclePhase[];

  return (
    <div style={CARD}>
      <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>
        📈 {title || 'Прогрессия мезоцикла'}
        <div style={{ marginLeft: 8, fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 400, marginTop: 2 }}>
          Трек Мезо 1→2→3: {interMeso.map((m, i) => `${m.mesoIndex}: ${m.startVolumeSets}с / ${Math.round(m.startIntensityPct * 100)}%`).join(' → ')}
        </div>
      </div>

      {/* Распределение фаз */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 10 }}>
        {phases.map(phase => {
          const count = dist[phase] || 0;
          const pct = Math.round((count / weeks) * 100);
          const color = PHASE_COLORS[phase];
          return (
            <div key={phase} style={{ padding: 8, borderRadius: 8, background: `${color}10`, border: `1px solid ${color}25`, textAlign: 'center' }}>
              <div style={{ fontSize: 9, color, fontWeight: 700 }}>{PHASE_RU[phase]}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{count}н</div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>{pct}%</div>
              <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', marginTop: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: pct + '%', borderRadius: 2, background: color }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Визуальный таймлайн прогрессии */}
      <div style={{ overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
        <div style={{ display: 'flex', gap: 3, minWidth: 'max-content', alignItems: 'flex-end' }}>
          {progression.map((p, i) => {
            const color = PHASE_COLORS[p.phase];
            const barH = Math.max(12, (p.volumeSets / maxVolSets) * 60);
            const isDeload = p.phase === 'deload';
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 22 }}>
                <div style={{ fontSize: 9, color: p.intensityPct > 0.85 ? '#ef4444' : 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
                  {Math.round(p.intensityPct * 100)}%
                </div>
                <div style={{
                  width: 16, height: barH, borderRadius: '3px 3px 0 0',
                  background: isDeload ? `repeating-linear-gradient(45deg, ${color}, ${color} 2px, ${color}33 2px, ${color}33 4px)` : color,
                  border: isDeload ? '1px solid #60a5fa55' : 'none',
                }} />
                <div style={{ fontSize: 9, color: isDeload ? '#60a5fa' : color, fontWeight: 700 }}>{p.week}</div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 4, fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>
        <span>▮ Объём (сетов)</span>
        <span style={{ color: '#ef4444' }}>% 1RM</span>
        <span>— разгрузка</span>
      </div>

      {/* Таблица прогрессии */}
      <div style={{ marginTop: 10 }}>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
         <div style={{ display: 'grid', gridTemplateColumns: '0.4fr 1fr 0.6fr 0.6fr 0.5fr 0.6fr', gap: 2, padding: '4px 8px', fontSize:9, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', minWidth: 340 }}>
          <span>Нед</span><span>Фаза</span><span>Объём×</span><span>Сетов</span><span>%1RM</span><span>RIR</span>
        </div>
        {progression.map((p, i) => {
          const color = PHASE_COLORS[p.phase];
          const isDeload = p.phase === 'deload';
          return (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '0.4fr 1fr 0.6fr 0.6fr 0.5fr 0.6fr', gap: 2,
              padding: '4px 8px', fontSize: 10, color: 'rgba(255,255,255,0.85)',
              borderTop: '1px solid rgba(255,255,255,0.04)',
              background: isDeload ? 'rgba(96,165,250,0.06)' : p.fatigueAdjusted ? 'rgba(245,158,11,0.04)' : 'transparent',
              borderLeft: `3px solid ${color}55`,
              minWidth: 340,
            }}>
              <span style={{ fontWeight: 700, color }}>{p.week}</span>
              <span style={{ color, fontWeight: 600, fontSize: 9 }}>{PHASE_RU[p.phase]}{p.fatigueAdjusted ? ' ⚡' : ''}</span>
              <span style={{ color: 'rgba(255,255,255,0.7)' }}>{p.volumeMultiplier.toFixed(2)}</span>
              <span style={{ fontWeight: 600 }}>{p.volumeSets}</span>
              <span style={{ color: p.intensityPct > 0.85 ? '#ef4444' : '#f59e0b', fontWeight: 700 }}>{Math.round(p.intensityPct * 100)}%</span>
              <span style={{ color: p.rir <= 1 ? '#ef4444' : p.rir >= 4 ? '#60a5fa' : ACCENT, fontWeight: 700 }}>{p.rir}</span>
            </div>
          );
        })}
        </div>
      </div>

      {/* Сводка роста между мезоциклами */}
      <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.12)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>📊 Рост между мезоциклами</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          {(() => {
            const baseWeeks = dist.base > 0 ? progression.filter(p => p.phase === 'base') : [];
            const buildWeeks = dist.build > 0 ? progression.filter(p => p.phase === 'build') : [];
            const peakWeeks = dist.peak > 0 ? progression.filter(p => p.phase === 'peak') : [];

            const baseToBuild = buildWeeks.length > 0 && baseWeeks.length > 0
              ? { vol: buildWeeks[0].volumeSets, volStart: baseWeeks[0].volumeSets, int: buildWeeks[0].intensityPct, intStart: baseWeeks[0].intensityPct }
              : null;
            const buildToPeak = peakWeeks.length > 0 && buildWeeks.length > 0
              ? { vol: peakWeeks[0].volumeSets, volStart: buildWeeks[buildWeeks.length - 1].volumeSets, int: peakWeeks[0].intensityPct, intStart: buildWeeks[buildWeeks.length - 1].intensityPct }
              : null;

            return (
              <>
                {baseToBuild && (
                  <div style={{ padding: 8, borderRadius: 8, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', textAlign: 'center' }}>
                    <div style={{ fontSize: 8, color: '#22c55e', fontWeight: 700 }}>База → Накопление</div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
                      Объём: {baseToBuild.volStart} → {baseToBuild.vol} сет ({baseToBuild.vol > baseToBuild.volStart ? '+' : ''}{baseToBuild.vol - baseToBuild.volStart})<br />
                      Инт: {Math.round(baseToBuild.intStart * 100)}% → {Math.round(baseToBuild.int * 100)}%
                    </div>
                  </div>
                )}
                {buildToPeak && (
                  <div style={{ padding: 8, borderRadius: 8, background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.15)', textAlign: 'center' }}>
                    <div style={{ fontSize: 8, color: '#eab308', fontWeight: 700 }}>Накопление → Пик</div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
                      Объём: {buildToPeak.volStart} → {buildToPeak.vol} сет<br />
                      Инт: {Math.round(buildToPeak.intStart * 100)}% → {Math.round(buildToPeak.int * 100)}%
                    </div>
                  </div>
                )}
                <div style={{ padding: 8, borderRadius: 8, background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.15)', textAlign: 'center' }}>
                  <div style={{ fontSize: 8, color: '#60a5fa', fontWeight: 700 }}>Пик → Делод</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
                    Объём: −50% от пика<br />
                    Инт: 50-60% 1RM<br />
                    RIR 4 · 2-3 сессии
                  </div>
                </div>
              </>
            );
          })()}
        </div>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 8, lineHeight: 1.4 }}>
          После делода — старт нового мезоцикла с возросшей работоспособностью.
          Объём и интенсивность сбрасываются к базовым значениям начала нового мезоцикла,
          но с поправкой на прогресс ПМ за предыдущий цикл.
        </div>
      </div>
      <div style={{ marginTop: 8, padding: 12, borderRadius: 12, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)' }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginBottom: 8 }}>🔗 Применить стартовую прогрессию мезо к планировщику: {startVolumeSets} сет/нед, {Math.round(startIntensityPct * 100)}% интенсивность, RIR {startRIR}.</div>
        <button onClick={() => applyToPlanner({ kind: 'mrv', label: 'Прогрессия мезо: старт ' + startVolumeSets + ' сет/нед, ' + Math.round(startIntensityPct * 100) + '%, RIR ' + startRIR, data: { mrv: startVolumeSets } })} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 13, minHeight: 44 }}>🛠 Применить прогрессию к планировщику</button>
      </div>
    </div>
  );
};

export default MesocycleProgressionCard;
