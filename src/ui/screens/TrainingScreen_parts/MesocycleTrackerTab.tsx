import React, { useMemo, useState } from 'react';
import {
  generateInterMesocycleProgression,
  generateMesocycleProgression,
  type InterMesoStep,
  type MesocycleConfig,
  type WeekProgression,
} from '../../../engines/pro/mesocycle-progression.engine';
import { applyToPlanner } from './planner-bridge';

const ACCENT = '#00e68a';
const CARD: React.CSSProperties = { background: 'rgba(24,24,27,0.6)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)', padding: '12px', margin: '6px 0' };

interface MesoEntry {
  id: string;
  name: string;
  date: string;
  goal: 'strength' | 'hypertrophy' | 'power';
  weeks: number;
  startVolumeSets: number;
  startIntensityPct: number;
  startRIR: number;
  notes: string;
}

const PHASE_COLORS: Record<string, string> = {
  base: '#22c55e',
  build: '#eab308',
  peak: '#ef4444',
  deload: '#60a5fa',
};

const PHASE_RU: Record<string, string> = {
  base: 'База',
  build: 'Накопление',
  peak: 'Пик',
  deload: 'Разгрузка',
};

const GOAL_RU: Record<string, string> = {
  strength: 'Сила',
  hypertrophy: 'Гипертрофия',
  power: 'Мощность',
};

function loadMesos(): MesoEntry[] {
  try { return JSON.parse(localStorage.getItem('he_meso_tracker') || '[]'); } catch { return []; }
}

function saveMesos(entries: MesoEntry[]) {
  localStorage.setItem('he_meso_tracker', JSON.stringify(entries.slice(0, 50)));
}

export const MesocycleTrackerTab: React.FC = () => {
  const [mesos, setMesos] = useState<MesoEntry[]>(loadMesos);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGoal, setNewGoal] = useState<'strength' | 'hypertrophy' | 'power'>('hypertrophy');
  const [newWeeks, setNewWeeks] = useState(12);
  const [newStartVol, setNewStartVol] = useState(18);
  const [newStartInt, setNewStartInt] = useState(0.72);
  const [newStartRIR, setNewStartRIR] = useState(3);
  const [newNotes, setNewNotes] = useState('');
  const [expandedMeso, setExpandedMeso] = useState<string | null>(null);

  const sortedMesos = [...mesos].sort((a, b) => b.date.localeCompare(a.date));

  const progression = useMemo(() => {
    if (sortedMesos.length < 1) return null;
    const last = sortedMesos[0];
    const config: MesocycleConfig = {
      weeks: last.weeks,
      startVolumeSets: last.startVolumeSets,
      startIntensityPct: last.startIntensityPct,
      startRIR: last.startRIR,
      goal: last.goal,
    };
    return {
      inter: generateInterMesocycleProgression(config, Math.max(3, sortedMesos.length + 1)),
      weekly: generateMesocycleProgression(config),
    };
  }, [sortedMesos]);

  const addMeso = () => {
    if (!newName.trim()) return;
    const entry: MesoEntry = {
      id: 'meso_' + Date.now(),
      name: newName.trim(),
      date: new Date().toISOString().slice(0, 10),
      goal: newGoal,
      weeks: newWeeks,
      startVolumeSets: newStartVol,
      startIntensityPct: newStartInt,
      startRIR: newStartRIR,
      notes: newNotes.trim(),
    };
    const upd = [entry, ...mesos];
    setMesos(upd);
    saveMesos(upd);
    setNewName('');
    setNewNotes('');
    setShowAdd(false);
  };

  const deleteMeso = (id: string) => {
    const upd = mesos.filter(m => m.id !== id);
    setMesos(upd);
    saveMesos(upd);
  };

  const weeklyProj = (m: MesoEntry) => {
    const cfg: MesocycleConfig = { weeks: m.weeks, startVolumeSets: m.startVolumeSets, startIntensityPct: m.startIntensityPct, startRIR: m.startRIR, goal: m.goal };
    return generateMesocycleProgression(cfg);
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT, marginBottom: 4 }}>📈 Трекер мезоциклов: Мезо 1→2→3</div>
      <div style={{ fontSize: 10, color: '#fff', marginBottom: 12, lineHeight: 1.5 }}>
        Отслеживайте прогрессию между мезоциклами: рост объёма, интенсивности и снижение RIR.
        Сохраняйте стартовые параметры каждого мезоцикла и наблюдайте траекторию роста.
      </div>

      {/* Добавление нового мезо */}
      <div style={CARD}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>➕ Новый мезоцикл</div>
          <button
            onClick={() => setShowAdd(v => !v)}
            style={{ padding: '4px 12px', borderRadius: 6, background: showAdd ? 'rgba(255,255,255,0.05)' : ACCENT, color: showAdd ? '#fff' : '#000', fontSize: 10, fontWeight: 700, border: 'none', cursor: 'pointer' }}
          >
            {showAdd ? 'Отмена' : 'Добавить'}
          </button>
        </div>

        {showAdd && (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <div style={{ fontSize: 10, color: '#fff', marginBottom: 2 }}>Название</div>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Например: Зимний мезо 1"
                style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: '#18181b', color: '#fff', fontSize: 11, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <div style={{ fontSize: 10, color: '#fff', marginBottom: 2 }}>Цель</div>
                <select value={newGoal} onChange={e => setNewGoal(e.target.value as any)}
                  style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: '#18181b', color: '#fff', fontSize: 11, outline: 'none' }}>
                  <option value="hypertrophy">Гипертрофия</option>
                  <option value="strength">Сила</option>
                  <option value="power">Мощность</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#fff', marginBottom: 2 }}>Недель</div>
                <input type="number" min={4} max={20} value={newWeeks} onChange={e => setNewWeeks(+e.target.value || 12)}
                  style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: '#18181b', color: '#fff', fontSize: 11, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#fff', marginBottom: 2 }}>Сетов на старте (нед 1)</div>
                <input type="number" value={newStartVol} onChange={e => setNewStartVol(+e.target.value || 18)}
                  style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: '#18181b', color: '#fff', fontSize: 11, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#fff', marginBottom: 2 }}>Интенсивность старт (%1RM)</div>
                <input type="number" min={50} max={100} value={Math.round(newStartInt * 100)} onChange={e => setNewStartInt((+e.target.value || 72) / 100)}
                  style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: '#18181b', color: '#fff', fontSize: 11, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#fff', marginBottom: 2 }}>RIR старт</div>
                <input type="number" min={0} max={5} value={newStartRIR} onChange={e => setNewStartRIR(+e.target.value || 3)}
                  style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: '#18181b', color: '#fff', fontSize: 11, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#fff', marginBottom: 2 }}>Заметки</div>
              <input value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder="Цель, особенности, результаты..."
                style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: '#18181b', color: '#fff', fontSize: 11, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <button onClick={addMeso} disabled={!newName.trim()} style={{ width: '100%', padding: 10, borderRadius: 8, border: 'none', background: newName.trim() ? 'linear-gradient(135deg,#00e68a,#00c853)' : 'rgba(255,255,255,0.05)', color: newName.trim() ? '#000' : '#fff', cursor: newName.trim() ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: 11 }}>
              Сохранить мезоцикл
            </button>
          </div>
        )}
      </div>

      {/* Прогрессия трека Мезо 1→2→3 */}
      {sortedMesos.length >= 1 && progression && (
        <div style={CARD}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8 }}>📊 Трек Мезо 1→2→3 — прогноз роста</div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: '#fff', marginBottom: 4 }}>Параметры старта каждого мезоцикла (объём / %1RM / RIR)</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {progression.inter.map((step: InterMesoStep, i: number) => {
                const color = i === 0 ? '#22c55e' : i === 1 ? '#eab308' : '#ef4444';
                const isCurrent = i === progression.inter.length - 1 && i > sortedMesos.length;
                return (
                  <div key={i} style={{
                    flex: 1, padding: '8px', borderRadius: 8,
                    background: isCurrent ? 'rgba(255,255,255,0.03)' : color + '10',
                    border: '1px solid ' + (isCurrent ? 'rgba(255,255,255,0.1)' : color + '30'),
                    textAlign: 'center' as const,
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color, marginBottom: 3 }}>
                      Мезо {i + 1}{isCurrent ? ' (прогноз)' : ''}
                    </div>
                    <div style={{ fontSize: 10, color: '#fff', fontWeight: 700 }}>
                      {step.startVolumeSets}с / {Math.round(step.startIntensityPct * 100)}% / RIR {step.startRIR}
                    </div>
                    {sortedMesos[i] && (
                      <div style={{ fontSize: 10, color: '#fff', marginTop: 2 }}>
                        {sortedMesos[i].name} · {sortedMesos[i].date}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Визуальный рост */}
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 10, color: '#fff', marginBottom: 4 }}>Траектория объёма (сетов/нед)</div>
            <div style={{ height: 60, display: 'flex', alignItems: 'flex-end', gap: 4, padding: '0 8px' }}>
              {progression.inter.map((step: InterMesoStep, i: number) => {
                const maxVol = Math.max(...progression.inter.map((s: InterMesoStep) => s.startVolumeSets), 1);
                const h = (step.startVolumeSets / maxVol) * 56;
                const color = i === 0 ? '#22c55e' : i === 1 ? '#eab308' : '#ef4444';
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, justifyContent: 'flex-end' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: step.startIntensityPct > 0.8 ? '#ef4444' : ACCENT }}>
                      {Math.round(step.startIntensityPct * 100)}%
                    </div>
                    <div style={{ width: '80%', height: Math.max(4, h), borderRadius: '4px 4px 0 0', background: color, minHeight: 4 }} />
                    <div style={{ fontSize: 10, color, fontWeight: 700 }}>М{step.mesoIndex}</div>
                    <div style={{ fontSize: 10, color: '#fff' }}>{step.startVolumeSets}с</div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 4, fontSize: 10, color: '#fff' }}>
              <span>▮ Объём (сетов/нед)</span>
              <span style={{ color: '#ef4444' }}>%1RM</span>
              <span>RIR</span>
            </div>
          </div>
        </div>
      )}

      {/* Список сохранённых мезоциклов */}
      {sortedMesos.length === 0 ? (
        <div style={{ ...CARD, textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 11, color: '#fff' }}>Нет сохранённых мезоциклов</div>
          <div style={{ fontSize: 10, color: '#fff', marginTop: 4 }}>
            Добавьте первый мезоцикл, чтобы отслеживать прогрессию Мезо 1→2→3.
          </div>
        </div>
      ) : (
        <div style={CARD}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8 }}>📋 История мезоциклов ({sortedMesos.length})</div>
          {sortedMesos.map((m, idx) => {
            const proj = weeklyProj(m);
            const isExpanded = expandedMeso === m.id;
            const maxVol = Math.max(1, ...proj.map(p => p.volumeSets));
            return (
              <div key={m.id} style={{ marginBottom: 6, overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
                <div
                  onClick={() => setExpandedMeso(isExpanded ? null : m.id)}
                  style={{
                    display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 0.6fr 0.6fr 0.6fr 0.5fr', gap: 4,
                    padding: '8px', borderRadius: 8, border: '1px solid ' + (isExpanded ? ACCENT : 'rgba(255,255,255,0.08)'),
                    background: isExpanded ? 'rgba(0,230,138,0.06)' : 'rgba(255,255,255,0.03)',
                    cursor: 'pointer', alignItems: 'center', fontSize: 10, color: '#fff',
                    transition: 'all 0.2s', minWidth: 340,
                  }}
                >
                  <span style={{ fontWeight: 700, color: '#fff' }}>{m.name}</span>
                  <span style={{ color: ACCENT }}>{GOAL_RU[m.goal] || m.goal}</span>
                  <span style={{ color: '#fff' }}>{m.weeks}н</span>
                  <span style={{ color: '#f59e0b' }}>{m.startVolumeSets}с</span>
                  <span style={{ color: '#ef4444' }}>{Math.round(m.startIntensityPct * 100)}%</span>
                  <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <span style={{ color: ACCENT }}>RIR {m.startRIR}</span>
                    <button onClick={(e: any) => { e.stopPropagation(); deleteMeso(m.id); }} style={{ padding: '2px 5px', borderRadius: 4, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>✕</button>
                  </span>
                </div>
                {isExpanded && (
                  <div style={{ marginTop: 4, padding: '10px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize: 10, color: '#fff', marginBottom: 6 }}>{m.date} · {m.notes || 'Без заметок'}</div>
                    <div style={{ overflowX: 'auto', scrollbarWidth: 'none' }}>
                      <div style={{ display: 'flex', gap: 3, minWidth: 'max-content', alignItems: 'flex-end' }}>
                        {proj.map((p: WeekProgression) => {
                          const color = PHASE_COLORS[p.phase] || '#888';
                          const barH = Math.max(10, (p.volumeSets / maxVol) * 50);
                          const isDeload = p.phase === 'deload';
                          return (
                            <div key={p.week} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 22 }}>
                              <div style={{ fontSize: 10, color: p.intensityPct > 0.85 ? '#ef4444' : '#fff', fontWeight: 600 }}>
                                {Math.round(p.intensityPct * 100)}%
                              </div>
                              <div style={{
                                width: 14, height: barH, borderRadius: '3px 3px 0 0',
                                background: isDeload ? `repeating-linear-gradient(45deg, ${color}, ${color} 2px, ${color}33 2px, ${color}33 4px)` : color,
                              }} />
                              <div style={{ fontSize: 10, color: isDeload ? '#60a5fa' : color, fontWeight: 700 }}>{p.week}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 10, color: '#fff' }}>
                      ▮{m.startVolumeSets}с старт · %1RM вверху · ▨разгрузка · {m.weeks} недель
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Инфо о стратегии */}
      <div style={{ ...CARD, background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.15)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 4 }}>💡 Стратегия прогрессии мезоциклов</div>
        <div style={{ fontSize: 10, color:'#fff', lineHeight: 1.6 }}>
          • <b>Гипертрофия:</b> +8% объёма, +2% интенсивности между мезо. Объём — главный драйвер роста.<br />
          • <b>Сила:</b> +5% объёма, +3% интенсивности. Интенсивность растёт быстрее объёма.<br />
          • <b>Мощность:</b> +2% объёма, +4% интенсивности. Минимум объёма, максимум качества движений.<br />
          • <b>После 3-4 мезоциклов:</b> проведите делод и начните новый макроцикл с обновлёнными ПМ.
        </div>
      </div>
          <div style={{ marginTop: 8, padding: 12, borderRadius: 12, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)' }}>
        <div style={{ fontSize: 10, color: '#fff', marginBottom: 8 }}>🔗 Применить конфигурацию мезоцикла к планировщику: стартовый объём и RIR.</div>
        <button onClick={() => { const m = mesos[0]; if (m) applyToPlanner({ kind: 'mrv', label: 'Мезо: ' + m.startVolumeSets + ' сет/нед, RIR ' + m.startRIR, data: { mrv: m.startVolumeSets } }); }} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 13, minHeight: 44 }}>🛠 Применить мезо к планировщику</button>
      </div>
</div>
  );
};

export default MesocycleTrackerTab;
