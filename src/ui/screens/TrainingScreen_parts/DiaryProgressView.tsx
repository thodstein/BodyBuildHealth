/** DiaryProgressView.tsx � ����� ��������� ���� �������� (������ + PR, ������� �� TrainingDiaryHub). */
import React from 'react';
import { epley1RM } from '../../../engines/e1rm';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import { migrateWeightLogLegacy } from '../../../engines/profile-store';
import { loadMeasurements } from '../../../engines/log-analytics-progression.engine';
import { Sparkline } from './Sparkline';
import { ProgressChartsCard } from './diary-cards';
import { useDiaryHub, type DiaryHubCtx } from './diary-hub-context';

export const DiaryProgressView: React.FC<{ hub: DiaryHubCtx }> = ({ hub }) => {
  const {
    measurements, setMeasurements, mWeight, setMWeight, mWaist, setMWaist, mChest, setMChest,
    mArm, setMArm, mThigh, setMThigh, mDate, setMDate, saveMeasurementHandler, measureAnalytics,
    repData, historyWorkouts,
  } = hub;
  return (
        <div>
          <div className="card" style={{ marginBottom: 8, padding: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <h4 style={{ margin: 0, fontSize: 12 }}>📏 Замеры тела</h4>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, padding: '2px 8px', borderRadius: 10, background: 'rgba(0,230,138,0.1)', color: '#00e68a', border: '1px solid rgba(0,230,138,0.3)' }}>
                🔄 Синхронизировано с дневником веса ({measurements.length})
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
              <div><label style={{ fontSize: 10 }}>Вес</label><input type="number" value={mWeight} onChange={e => setMWeight(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '4px', borderRadius: 4, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: 11, boxSizing: 'border-box' }} /></div>
              <div><label style={{ fontSize: 10 }}>Талия</label><input type="number" value={mWaist} onChange={e => setMWaist(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '4px', borderRadius: 4, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: 11, boxSizing: 'border-box' }} /></div>
              <div><label style={{ fontSize: 10 }}>Грудь</label><input type="number" value={mChest} onChange={e => setMChest(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '4px', borderRadius: 4, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: 11, boxSizing: 'border-box' }} /></div>
              <div><label style={{ fontSize: 10 }}>Бицепс</label><input type="number" value={mArm} onChange={e => setMArm(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '4px', borderRadius: 4, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: 11, boxSizing: 'border-box' }} /></div>
              <div><label style={{ fontSize: 10 }}>Бедро</label><input type="number" value={mThigh} onChange={e => setMThigh(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '4px', borderRadius: 4, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: 11, boxSizing: 'border-box' }} /></div>
              <div><label style={{ fontSize: 10 }}>Дата</label><input type="date" value={mDate || ''} onChange={e => setMDate(e.target.value)} style={{ width: '100%', padding: '4px', borderRadius: 4, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: 11, boxSizing: 'border-box' }} /></div>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button onClick={saveMeasurementHandler} style={{ flex: 1, padding: 8, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 12 }}>Сохранить замер</button>
              <button onClick={() => { migrateWeightLogLegacy(); setMeasurements(loadMeasurements()); }}
                title="Слить legacy-хранилища (he_measurements и др.) в канонический дневник веса"
                style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid rgba(0,230,138,0.35)', background: 'rgba(0,230,138,0.08)', color: '#00e68a', cursor: 'pointer', fontWeight: 600, fontSize: 11 }}>
                🔄 Синхронизировать
              </button>
            </div>
          </div>
          {measurements.length > 0 && (
            <div className="card" style={{ marginBottom: 8, padding: 10 }}>
              <h4 style={{ margin: '0 0 4px', fontSize: 12 }}>📊 История ({measurements.length})</h4>
              {measurements.slice(-5).reverse().map((m: any, i) => (
                <div key={i} style={{ fontSize: 10, padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  {m.date}: Вес {m.weightKg}кг | Талия {m.waistCm}см | Грудь {m.chestCm}см | Бицепс {m.armLeftCm || m.armRightCm}см | Бедро {m.thighLeftCm || m.thighRightCm}см
                </div>
              ))}
            </div>
          )}
          {measureAnalytics && (
            <div className="card" style={{ padding: 10 }}>
              <h4 style={{ margin: '0 0 4px', fontSize: 12 }}>📈 Аналитика тела</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 8px', fontSize: 10 }}>
                <span>FFMI:</span><span style={{ fontWeight: 600 }}>{measureAnalytics.ffmi?.toFixed(1)}</span>
                <span>LBM:</span><span style={{ fontWeight: 600 }}>{measureAnalytics.lbm?.toFixed(1)} кг</span>
                <span>BMI:</span><span style={{ fontWeight: 600 }}>{measureAnalytics.bmi?.toFixed(1)}</span>
                <span>Жир:</span><span style={{ fontWeight: 600 }}>{measureAnalytics.fatMass?.toFixed(1)} кг</span>
              </div>
            </div>
          )}
          {/* Body composition trend sparklines */}
          {measurements.length >= 3 && (
            <div className="card" style={{ padding: 10, marginBottom: 8 }}>
              <h4 style={{ margin: '0 0 6px', fontSize: 12 }}>📉 Тренды замеров</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {[
                  { label: 'Вес (кг)', data: measurements.map((m: any) => m.weightKg || 0), color: '#00e68a', unit: 'кг' },
                  { label: 'Талия (см)', data: measurements.map((m: any) => m.waistCm || 0), color: '#f59e0b', unit: 'см' },
                  { label: 'Грудь (см)', data: measurements.map((m: any) => m.chestCm || 0), color: '#60a5fa', unit: 'см' },
                  { label: 'Бицепс (см)', data: measurements.map((m: any) => m.armLeftCm || m.armRightCm || 0), color: '#a855f7', unit: 'см' },
                ].map(m => {
                  const first = m.data[0] || 0;
                  const last = m.data[m.data.length - 1] || 0;
                  const delta = first > 0 ? (last - first) : 0;
                  return (
                    <div key={m.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '4px 6px' }}>
                      <div style={{ fontSize: 9, color: '#fff', marginBottom: 2 }}>{m.label}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Sparkline data={m.data} width={60} height={18} color={m.color} />
                        <div style={{ fontSize: 10 }}>
                          <div style={{ fontWeight: 700, color: '#fff' }}>{last}{m.unit}</div>
                          <div style={{ fontSize: 9, color: delta === 0 ? '#fff' : delta > 0 ? '#22c55e' : '#ef4444' }}>
                            {delta === 0 ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}`}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {repData && (
            <div className="card" style={{ padding: 10, marginTop: 8 }}>
              <h4 style={{ margin: '0 0 4px', fontSize: 12 }}>📋 Недельный отчёт</h4>
              <div style={{ fontSize: 10, color: '#fff' }}>{repData.insights?.slice(0, 3).map((r: any, i: number) => <div key={i}>• {r}</div>)}</div>
            </div>
          )}
          {/* PR Timeline */}
          {historyWorkouts.length >= 2 && (() => {
            const prMap = new Map<string, { date: string; e1rm: number; weight: number; reps: number; exercise: string }>();
            [...historyWorkouts].sort((a, b) => a.date.localeCompare(b.date)).forEach((w: any) => {
              (w.exercises || []).forEach((e: any) => {
                const name = e.exerciseName || e.exerciseId;
                if (!name) return;
                (e.sets || []).forEach((s: any) => {
                  const e1 = epley1RM(s.weight || 0, s.reps || 0);
                  if (e1 <= 0) return;
                  const prev = prMap.get(name);
                  if (!prev || e1 > prev.e1rm) {
                    prMap.set(name, { date: w.date, e1rm: Math.round(e1), weight: s.weight || 0, reps: s.reps || 0, exercise: name });
                  }
                });
              });
            });
            const prs = [...prMap.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15);
            if (prs.length === 0) return null;
            return (
              <div className="card" style={{ padding: 10, marginTop: 8 }}>
                <h4 style={{ margin: '0 0 6px', fontSize: 12 }}>🏆 Личные рекорды</h4>
                {prs.map((pr, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#fff' }}>{pr.exercise}</div>
                      <div style={{ fontSize: 9, color: '#fff' }}>{pr.weight}кг × {pr.reps}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b' }}>e1RM {pr.e1rm}</div>
                      <div style={{ fontSize: 8, color: '#fff' }}>{pr.date.slice(0, 10)}</div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
          {/* Exercise 1RM progress sparklines */}
          {historyWorkouts.length >= 4 && (() => {
            const sorted = [...historyWorkouts].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            const exHist = new Map<string, { date: string; e1rm: number }[]>();
            sorted.forEach((w: any) => (w.exercises || []).forEach((ex: any) => {
              const id = ex.exerciseId || ex.exerciseName;
              if (!id) return;
              const bestSet = (ex.sets || []).reduce((best: any, s: any) => {
                const e = s.reps > 0 ? Math.round(s.weight * (1 + s.reps / 30)) : 0;
                return e > (best?.e1rm || 0) ? { e1rm: e, date: w.date } : best;
              }, null);
              if (bestSet) {
                if (!exHist.has(id)) exHist.set(id, []);
                exHist.get(id)!.push({ date: bestSet.date, e1rm: bestSet.e1rm });
              }
            }));
            const top = [...exHist.entries()]
              .filter(([, arr]) => arr.length >= 3)
              .map(([id, arr]) => {
                const first = arr[0].e1rm; const last = arr[arr.length - 1].e1rm;
                return { id, name: arr[0].date ? id : id, data: arr.map(a => a.e1rm), delta: last - first, last, arr };
              })
              .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
              .slice(0, 6);
            if (top.length === 0) return null;
            return (
              <div className="card" style={{ padding: 10, marginTop: 8 }}>
                <h4 style={{ margin: '0 0 6px', fontSize: 12 }}>📈 1ПМ по упражнениям</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  {top.map(ex => (
                    <div key={ex.id} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '4px 6px' }}>
                      <div style={{ fontSize: 9, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.id}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Sparkline data={ex.data} width={50} height={16} color={ex.delta >= 0 ? '#22c55e' : '#ef4444'} />
                        <div style={{ fontSize: 10, fontWeight: 700, color: ex.delta >= 0 ? '#22c55e' : '#ef4444' }}>
                          {ex.delta >= 0 ? '+' : ''}{ex.delta}кг
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
          {/* PR Calendar heatmap */}
          {historyWorkouts.length >= 5 && (() => {
            const prDays = new Set<string>();
            historyWorkouts.forEach((w: any) => (w.exercises || []).forEach((ex: any) => {
              if ((ex.sets || []).some((s: any) => s.isPR)) prDays.add(w.date.slice(0, 10));
            }));
            if (prDays.size === 0) return null;
            const weeks = 12;
            const today = new Date();
            const calStart = new Date(today);
            calStart.setDate(calStart.getDate() - (weeks * 7) + 1 - calStart.getDay());
            const days: { date: string; hasPR: boolean; dayOfWeek: number; weekIdx: number }[] = [];
            for (let w = 0; w < weeks; w++) {
              for (let d = 0; d < 7; d++) {
                const dt = new Date(calStart); dt.setDate(dt.getDate() + w * 7 + d);
                const ds = dt.toISOString().slice(0, 10);
                days.push({ date: ds, hasPR: prDays.has(ds), dayOfWeek: d, weekIdx: w });
              }
            }
            const dayLabels = ['Пн', '', 'Ср', '', 'Пт', '', 'Вс'];
            return (
              <div className="card" style={{ padding: 10, marginTop: 8 }}>
                <h4 style={{ margin: '0 0 6px', fontSize: 12 }}>🏆 Календарь PR ({prDays.size} дней за {weeks} нед)</h4>
                <div style={{ display: 'flex', gap: 2 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginRight: 2 }}>
                    {dayLabels.map((l, i) => <div key={i} style={{ height: 10, fontSize: 7, color: '#fff', display: 'flex', alignItems: 'center' }}>{l}</div>)}
                  </div>
                  {Array.from({ length: weeks }, (_, wi) => (
                    <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {days.filter(d => d.weekIdx === wi).map(d => (
                        <div key={d.date} style={{ width: 10, height: 10, borderRadius: 2, background: d.hasPR ? '#f59e0b' : 'rgba(255,255,255,0.03)' }} title={d.hasPR ? `PR: ${d.date}` : d.date} />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
          {/* Strength balance radar */}
          {historyWorkouts.length > 0 && (() => {
            const LIFTS = [
              { name: 'Жим', patterns: ['жим лёжа', 'bench', 'жим штанги'], color: '#ef4444' },
              { name: 'Присед', patterns: ['присед', 'squat'], color: '#3b82f6' },
              { name: 'Тяга', patterns: ['станов', 'deadlift', 'тяга стан'], color: '#f59e0b' },
              { name: 'Тяга верх', patterns: ['тяга верхнего', 'pull down', 'подтягивания'], color: '#22c55e' },
              { name: 'ОГЖ', patterns: ['жим стоя', 'overhead', 'жим армейский'], color: '#a855f7' },
              { name: 'Разгиб', patterns: ['разгиб', 'трицепс', 'pushdown'], color: '#60a5fa' },
            ];
            const lifts = LIFTS.map(l => {
              const sessions = historyWorkouts.flatMap((w: any) => (w.exercises || []).filter((e: any) => {
                const nm = (e.exerciseName || '').toLowerCase();
                return l.patterns.some(p => nm.includes(p));
              }));
              let best = 0;
              sessions.forEach((e: any) => (e.sets || []).forEach((s: any) => {
                const e1 = epley1RM(s.weight || 0, s.reps || 0);
                if (e1 > best) best = e1;
              }));
              return { ...l, e1rm: Math.round(best) };
            });
            const maxE1RM = Math.max(1, ...lifts.map(l => l.e1rm));
            if (lifts.filter(l => l.e1rm > 0).length < 3) return null;
            const R = 42, cx = 55, cy = 55;
            const pts = lifts.map((l, i) => {
              const angle = (Math.PI * 2 * i) / lifts.length - Math.PI / 2;
              const r = (l.e1rm / maxE1RM) * R;
              return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), l, angle };
            });
            const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z';
            return (
              <div className="card" style={{ padding: 10 }}>
                <h4 style={{ margin: '0 0 4px', fontSize: 12 }}>💪 Баланс сил</h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <svg width={110} height={110} viewBox="0 0 110 110">
                    {[0.25, 0.5, 0.75, 1].map(pct => (
                      <polygon key={pct} points={lifts.map((_, i) => {
                        const angle = (Math.PI * 2 * i) / lifts.length - Math.PI / 2;
                        return `${cx + R * pct * Math.cos(angle)},${cy + R * pct * Math.sin(angle)}`;
                      }).join(' ')} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />
                    ))}
                    <path d={pathD} fill="rgba(0,230,138,0.1)" stroke="#00e68a" strokeWidth={1.5} />
                    {pts.map((p, i) => (
                      <g key={i}>
                        <circle cx={p.x} cy={p.y} r={2.5} fill={p.l.color} />
                        <text x={cx + (R + 12) * Math.cos(p.angle)} y={cy + (R + 12) * Math.sin(p.angle)} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize={7}>{p.l.name}</text>
                        {p.l.e1rm > 0 && <text x={p.x} y={p.y - 6} textAnchor="middle" fill={p.l.color} fontSize={7} fontWeight={700}>{p.l.e1rm}</text>}
                      </g>
                    ))}
                  </svg>
                  <div style={{ flex: 1 }}>
                    {lifts.filter(l => l.e1rm > 0).map(l => (
                      <div key={l.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 10 }}>
                        <span style={{ color: l.color }}>{l.name}</span>
                        <span style={{ fontWeight: 700, color: '#fff' }}>{l.e1rm}кг</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
          {/* e1RM and tonnage charts from diary data */}
          {historyWorkouts.length > 0 && <ProgressChartsCard historyWorkouts={historyWorkouts} />}
        </div>
  );
};
