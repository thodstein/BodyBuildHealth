import React, { useState } from 'react';
import { INJURY_LOCATIONS } from '../../../core/constants';

const ACCENT = '#00e68a';

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 250, display: 'flex',
  alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)',
};
const sheet: React.CSSProperties = {
  width: '88%', maxWidth: 400, maxHeight: '78vh', borderRadius: 16,
  background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden',
};
const topBar: React.CSSProperties = { height: 3, background: 'linear-gradient(90deg,#00e68a,#00c853)' };
const sheetBody: React.CSSProperties = { padding: '14px 16px', maxHeight: 'calc(78vh - 3px)', overflowY: 'auto' };

export interface InjurySelectEntry {
  muscle: string;
  from: string;
  to?: string;
  exclude?: boolean;       // true = полное исключение, false = градация
  weightPct?: number;      // % от рабочего веса (0.3-1.0)
  volumePct?: number;      // % от объёма (0.3-1.0)
  repsCap?: number;        // макс повторений (8-30)
}

interface Props {
  injuries: InjurySelectEntry[];
  onChange: (injuries: InjurySelectEntry[]) => void;
}

const MUSCLE_GROUPS = [
  { id: 'chest', label: 'Грудь' },
  { id: 'back', label: 'Спина' },
  { id: 'shoulders', label: 'Плечи' },
  { id: 'legs', label: 'Ноги' },
  { id: 'arms', label: 'Руки' },
  { id: 'core', label: 'Кор' },
  { id: 'neck', label: 'Шея' },
  { id: 'forearms', label: 'Предплечья' },
  { id: 'calves', label: 'Икры' },
  { id: 'glutes', label: 'Ягодицы' },
  { id: 'quads', label: 'Квадрицепсы' },
  { id: 'hamstrings', label: 'Бицепс бедра' },
  { id: 'traps', label: 'Трапеции' },
  { id: 'delt_front', label: 'Передняя дельта' },
  { id: 'delt_mid', label: 'Средняя дельта' },
  { id: 'delt_rear', label: 'Задняя дельта' },
  { id: 'biceps', label: 'Бицепс' },
  { id: 'triceps', label: 'Трицепс' },
  { id: 'abs', label: 'Пресс' },
];

const LOCATION_TO_MUSCLE: Record<string, string> = {
  'Плечо': 'shoulders', 'Локоть': 'arms', 'Запястье': 'forearms', 'Кисть': 'forearms',
  'Грудной отдел': 'chest', 'Поясница': 'core', 'Тазобедренный': 'glutes',
  'Колено': 'legs', 'Голеностоп': 'legs', 'Стопа': 'legs', 'Шея': 'neck',
  'Предплечье': 'forearms', 'Бицепс': 'biceps', 'Трицепс': 'triceps',
  'Дельта': 'shoulders', 'Трапеция': 'traps', 'Широчайшие': 'back',
  'Пресс': 'abs', 'Квадрицепс': 'quads', 'Бицепс бедра': 'hamstrings',
};

function todayStr(): string {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function isActive(inj: InjurySelectEntry): boolean {
  return (!inj.from || inj.from <= todayStr()) && (!inj.to || inj.to >= todayStr());
}

/** Прогресс постинсультного восстановления (0-100%). 3 недели после to. */
function reintegrationProgress(toDate: string): number {
  const end = new Date(toDate);
  const now = new Date();
  const daysPast = Math.max(0, Math.floor((now.getTime() - end.getTime()) / 86400000));
  if (daysPast >= 21) return 100;
  if (daysPast >= 14) return 90;
  if (daysPast >= 7) return 75;
  if (daysPast >= 0) return 50;
  return 0;
}

type InjuryMode = 'exclude' | 'graded';

/** Дефолтная градация щадящего режима (мышца остаётся, нагрузка снижена). */
export function gradedDefaults(): { exclude: false; weightPct: number; volumePct: number; repsCap: number } {
  return { exclude: false, weightPct: 0.6, volumePct: 0.6, repsCap: 15 };
}

export const InjurySelectCard: React.FC<Props> = ({ injuries, onChange }) => {
  const [open, setOpen] = useState(false);
  const [customMuscle, setCustomMuscle] = useState('');
  const [customFrom, setCustomFrom] = useState(todayStr());
  const [customTo, setCustomTo] = useState('');
  // Режим, в котором добавляются НОВЫЕ травмы (переключается чипами в шапке).
  const [mode, setMode] = useState<InjuryMode>('exclude');

  const activeCount = injuries.filter(isActive).length;
  const totalCount = injuries.length;

  const addInjury = (muscle: string) => {
    if (injuries.some(i => i.muscle === muscle && isActive(i))) return;
    if (mode === 'graded') {
      onChange([...injuries, { muscle, from: todayStr(), ...gradedDefaults() }]);
    } else {
      onChange([...injuries, { muscle, from: todayStr(), exclude: true }]);
    }
  };

  const addCustom = () => {
    if (!customMuscle.trim()) return;
    if (mode === 'graded') {
      onChange([...injuries, { muscle: customMuscle.trim(), from: customFrom, to: customTo || undefined, ...gradedDefaults() }]);
    } else {
      onChange([...injuries, { muscle: customMuscle.trim(), from: customFrom, to: customTo || undefined, exclude: true }]);
    }
    setCustomMuscle('');
    setCustomTo('');
  };

  const removeInjury = (idx: number) => {
    onChange(injuries.filter((_, i) => i !== idx));
  };

  return (
    <div className="train-injury">
      <button onClick={() => setOpen(true)} style={{
        width: '100%', padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 11, fontWeight: 700,
        textAlign: 'left' as const, boxSizing: 'border-box' as const,
        background: activeCount > 0 ? 'rgba(239,68,68,0.10)' : 'rgba(255,255,255,0.03)',
        border: activeCount > 0 ? '1px solid rgba(239,68,68,0.35)' : '1px solid rgba(255,255,255,0.06)',
        color: activeCount > 0 ? '#ef4444' : '#fff',
      }}>
        <div style={{ fontSize: 10, color: '#fff', fontWeight: 600, marginBottom: 2 }}>
          🤕 Травмы / ограничения
        </div>
        <div style={{ fontSize: 12 }}>
          {activeCount > 0
            ? `${activeCount} активн. · всего ${totalCount}`
            : totalCount > 0
              ? `${totalCount} неактивных`
              : 'Нет травм'}
        </div>
      </button>

      {open && (
        <div style={overlay} onClick={() => setOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={sheet}>
            <div style={topBar} />
            <div style={sheetBody}>
              <div style={{ fontSize: 14, fontWeight: 700, color: ACCENT, marginBottom: 10 }}>🤕 Травмы и ограничения</div>
              <div style={{ padding: 8, borderRadius: 8, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: '#fff', lineHeight: 1.5 }}>
                  Отметьте травмированные мышцы — план <b style={{ color: '#f87171' }}>защитит их</b>. Два режима на каждую травму:
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => setMode('exclude')}
                    style={{
                      flex: '1 1 45%', padding: '5px 7px', borderRadius: 6, cursor: 'pointer', textAlign: 'left' as const,
                      background: mode === 'exclude' ? 'rgba(239,68,68,0.22)' : 'rgba(239,68,68,0.12)',
                      border: mode === 'exclude' ? '2px solid #ef4444' : '1px solid rgba(239,68,68,0.3)',
                      color: '#f87171', fontSize: 9, lineHeight: 1.4,
                    }}>
                    <b>⛔ Исключить</b><br />упражнения заменяются безопасными аналогами{mode === 'exclude' ? ' — выбран' : ''}
                  </button>
                  <button type="button" onClick={() => setMode('graded')}
                    style={{
                      flex: '1 1 45%', padding: '5px 7px', borderRadius: 6, cursor: 'pointer', textAlign: 'left' as const,
                      background: mode === 'graded' ? 'rgba(245,158,11,0.22)' : 'rgba(245,158,11,0.12)',
                      border: mode === 'graded' ? '2px solid #f59e0b' : '1px solid rgba(245,158,11,0.3)',
                      color: '#fbbf24', fontSize: 9, lineHeight: 1.4,
                    }}>
                    <b>⚡ Щадящая</b><br />мышца остаётся, но вес/объём/повторы снижаются{mode === 'graded' ? ' — выбран' : ''}
                  </button>
                </div>
                <div style={{ fontSize: 9, color: '#fff', lineHeight: 1.4, marginTop: 6 }}>
                  Режим применяется к <b style={{ color: '#fff' }}>новым</b> травмам (в списке ниже его можно поменять у каждой). Даты «с/до» = период активности; после заживления нагрузка плавно возвращается (50% → 75% → 100%).
                </div>
              </div>

              {/* Quick toggle: common injury locations */}
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 6 }}>🩼 Быстрый выбор</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
                {INJURY_LOCATIONS.map(loc => {
                  const muscle = LOCATION_TO_MUSCLE[loc] || loc.toLowerCase();
                  const active = injuries.some(i => i.muscle === muscle && isActive(i));
                  return (
                    <button key={loc} onClick={() => active ? removeInjury(injuries.findIndex(i => i.muscle === muscle && isActive(i))) : addInjury(muscle)}
                      style={{
                        padding: '5px 10px', borderRadius: 14, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                        background: active ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)',
                        border: active ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(255,255,255,0.08)',
                        color: active ? '#ef4444' : '#fff',
                      }}>
                      {active ? '✕ ' : ''}{loc}
                    </button>
                  );
                })}
              </div>

              {/* Muscle group quick pick */}
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 6 }}>💪 Выбор по группам</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
                {MUSCLE_GROUPS.filter(m => !INJURY_LOCATIONS.some(l => (LOCATION_TO_MUSCLE[l] || '') === m.id)).map(mg => {
                  const active = injuries.some(i => i.muscle === mg.id && isActive(i));
                  return (
                    <button key={mg.id} onClick={() => active ? removeInjury(injuries.findIndex(i => i.muscle === mg.id && isActive(i))) : addInjury(mg.id)}
                      style={{
                        padding: '5px 10px', borderRadius: 14, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                        background: active ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)',
                        border: active ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(255,255,255,0.08)',
                        color: active ? '#ef4444' : '#fff',
                      }}>
                      {active ? '✕ ' : ''}{mg.label}
                    </button>
                  );
                })}
              </div>

              {/* Custom muscle input */}
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 6 }}>✏️ Своя травма</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <input type="text" value={customMuscle} onChange={e => setCustomMuscle(e.target.value)} placeholder="Мышца/зона (на англ.)"
                  style={{
                    flex: 1, padding: '8px 10px', borderRadius: 8, fontSize: 11,
                    background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff', outline: 'none', boxSizing: 'border-box',
                  }} />
                <button onClick={addCustom} disabled={!customMuscle.trim()}
                  style={{
                    padding: '8px 14px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    background: customMuscle.trim() ? 'linear-gradient(135deg,#00e68a,#00c853)' : 'rgba(255,255,255,0.05)',
                    border: 'none', color: customMuscle.trim() ? '#000' : '#fff',
                  }}>+ Добавить</button>
              </div>

              {/* Date range for custom */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: '#fff', marginBottom: 2 }}>Начало</div>
                  <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                    style={{
                      width: '100%', padding: '6px 8px', borderRadius: 6, fontSize: 10,
                      background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                      color: '#fff', outline: 'none', boxSizing: 'border-box',
                    }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: '#fff', marginBottom: 2 }}>Окончание (необяз.)</div>
                  <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                    style={{
                      width: '100%', padding: '6px 8px', borderRadius: 6, fontSize: 10,
                      background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                      color: '#fff', outline: 'none', boxSizing: 'border-box',
                    }} />
                </div>
              </div>

              {/* Current injuries list */}
              {injuries.length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 6 }}>📋 Текущие травмы</div>
                  {injuries.map((inj, i) => {
                    const active = isActive(inj);
                    const isGraded = inj.exclude === false;
                    return (
                      <div key={i} style={{ marginBottom: 6 }}>
                        {/* Header row */}
                        <div style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '6px 8px', borderRadius: 6,
                          background: active ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.02)',
                          border: '1px solid ' + (active ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.04)'),
                        }}>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontWeight: 700, fontSize: 11, color: active ? '#ef4444' : '#fff' }}>
                              {inj.muscle}
                            </span>
                            <span style={{ fontSize: 10, color: '#fff', marginLeft: 6 }}>
                              {inj.from || '?'}{inj.to ? ' → ' + inj.to : ''}
                            </span>
                            {!active && <span style={{ fontSize: 10, color: '#22c55e', marginLeft: 6 }}>✓ истекла</span>}
                            {!active && inj.to && reintegrationProgress(inj.to) < 100 && (
                              <span style={{ fontSize: 10, color: '#60a5fa', marginLeft: 6 }}>
                                🔄 восстановление {reintegrationProgress(inj.to)}%
                              </span>
                            )}
                            {active && isGraded && <span style={{ fontSize: 10, color: '#f59e0b', marginLeft: 6 }}>⚡ градация</span>}
                          </div>
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            {active && (
                              <button onClick={() => {
                                const next = [...injuries];
                                const current = next[i];
                                if (current.exclude === false) {
                                  // ⚡ Щадящая → ⛔ Исключить: сброс градации
                                  next[i] = { ...current, exclude: true, weightPct: undefined, volumePct: undefined, repsCap: undefined };
                                } else {
                                  // ⛔ Исключить → ⚡ Щадящая: дефолтная градация
                                  next[i] = { ...current, ...gradedDefaults() };
                                }
                                onChange(next);
                              }}
                                style={{
                                  padding: '3px 8px', borderRadius: 6, fontSize: 10, cursor: 'pointer',
                                  background: isGraded ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                                  border: '1px solid ' + (isGraded ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)'),
                                  color: isGraded ? '#f59e0b' : '#ef4444',
                                }}>
                                {isGraded ? '⚡ Щадящая' : '⛔ Исключить'}
                              </button>
                            )}
                            <button onClick={() => removeInjury(i)}
                              style={{
                                padding: '3px 8px', borderRadius: 6, fontSize: 10, cursor: 'pointer',
                                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                color: '#fff',
                              }}>✕</button>
                          </div>
                        </div>
                        {/* Gradation panel for active graded injuries */}
                        {active && isGraded && (
                          <div style={{ padding: '6px 8px 2px 8px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
                            <div>
                              <div style={{ fontSize: 10, color: '#fff', marginBottom: 1 }}>Вес: {Math.round((inj.weightPct ?? 0.6) * 100)}%</div>
                              <input type="range" min={30} max={100} step={5}
                                value={Math.round((inj.weightPct ?? 0.6) * 100)}
                                onChange={e => {
                                  const next = [...injuries];
                                  next[i] = { ...next[i], weightPct: parseInt(e.target.value) / 100 };
                                  onChange(next);
                                }}
                                style={{ width: '100%', height: 3 }} />
                            </div>
                            <div>
                              <div style={{ fontSize: 10, color: '#fff', marginBottom: 1 }}>Объём: {Math.round((inj.volumePct ?? 0.6) * 100)}%</div>
                              <input type="range" min={30} max={100} step={5}
                                value={Math.round((inj.volumePct ?? 0.6) * 100)}
                                onChange={e => {
                                  const next = [...injuries];
                                  next[i] = { ...next[i], volumePct: parseInt(e.target.value) / 100 };
                                  onChange(next);
                                }}
                                style={{ width: '100%', height: 3 }} />
                            </div>
                            <div>
                              <div style={{ fontSize: 10, color: '#fff', marginBottom: 1 }}>Повт: макс {inj.repsCap ?? 15}</div>
                              <input type="range" min={8} max={30} step={1}
                                value={inj.repsCap ?? 15}
                                onChange={e => {
                                  const next = [...injuries];
                                  next[i] = { ...next[i], repsCap: parseInt(e.target.value) };
                                  onChange(next);
                                }}
                                style={{ width: '100%', height: 3 }} />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}

              <button onClick={() => setOpen(false)}
                style={{
                  width: '100%', marginTop: 12, padding: '10px', borderRadius: 8, fontSize: 12,
                  fontWeight: 700, cursor: 'pointer', border: 'none',
                  background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000',
                }}>Готово</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
