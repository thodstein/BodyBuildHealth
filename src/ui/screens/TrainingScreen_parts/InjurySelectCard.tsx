import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { INJURY_LOCATIONS } from '../../../core/constants';

const ACCENT = 'var(--accent, #00e68a)';

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 250, display: 'flex',
  alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)',
  paddingBottom: 'env(safe-area-inset-bottom, 0px)',
};
const sheet: React.CSSProperties = {
  width: '88%', maxWidth: 400, maxHeight: '78vh', borderRadius: 16,
  background: 'var(--card-bg, #18181b)', color: 'var(--text, #fff)',
  border: '1px solid var(--border, rgba(255,255,255,0.1))', overflow: 'hidden',
};
const topBar: React.CSSProperties = { height: 3, background: 'linear-gradient(90deg,#00e68a,#00c853)' };
const sheetBody: React.CSSProperties = { padding: '14px 16px', maxHeight: 'calc(78vh - 3px)', overflowY: 'auto' };

export type InjuryJointSyndrome =
  | 'lower_back'
  | 'shoulder_impingement'
  | 'knee_patellar'
  | 'elbow_epicondylitis'
  | 'wrist';

export interface InjurySelectEntry {
  muscle: string;
  from: string;
  to?: string;
  exclude?: boolean;       // true = полное исключение, false = градация
  weightPct?: number;      // % от рабочего веса (0.3-1.0)
  volumePct?: number;      // % от объёма (0.3-1.0)
  repsCap?: number;        // макс повторений (8-30)
  jointSyndrome?: InjuryJointSyndrome;
  severity?: 'mild' | 'moderate' | 'severe';
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
  { id: 'core', label: 'Пресс / Кор' },
  { id: 'lower_back', label: 'Поясница (осевые)' },
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

const JOINT_SYNDROME_PRESETS: Array<{ id: InjuryJointSyndrome; muscle: string; label: string; hint: string }> = [
  { id: 'lower_back', muscle: 'lower_back', label: 'Поясница', hint: 'Убирает осевые/тяги, не удаляя пресс' },
  { id: 'shoulder_impingement', muscle: 'shoulders', label: 'Плечо (импинджмент)', hint: 'Запрещает жимы за голову/тягу к подбородку' },
  { id: 'knee_patellar', muscle: 'quads', label: 'Колено (надколенник)', hint: 'Заменяет глубокие приседы, щадит квадрицепс' },
  { id: 'elbow_epicondylitis', muscle: 'forearms', label: 'Локоть (эпикондилит)', hint: 'Снижает стресс на сгибания/франц. жим' },
  { id: 'wrist', muscle: 'forearms', label: 'Запястье', hint: 'Убирает прямой гриф и фронтальный хват' },
];

const LOCATION_TO_MUSCLE: Record<string, string> = {
  'Плечо': 'shoulders', 'Локоть': 'arms', 'Запястье': 'forearms', 'Кисть': 'forearms',
  'Грудной отдел': 'chest', 'Поясница': 'lower_back', 'Тазобедренный': 'glutes',
  'Колено': 'legs', 'Голеностоп': 'legs', 'Стопа': 'legs', 'Шея': 'neck',
  'Предплечье': 'forearms', 'Бицепс': 'biceps', 'Трицепс': 'triceps',
  'Дельта': 'shoulders', 'Трапеция': 'traps', 'Широчайшие': 'back',
  'Пресс': 'abs', 'Квадрицепс': 'quads', 'Бицепс бедра': 'hamstrings',
};

const LOCATION_TO_SYNDROME: Record<string, InjuryJointSyndrome | undefined> = {
  'Поясница': 'lower_back',
  'Плечо': 'shoulder_impingement',
  'Колено': 'knee_patellar',
  'Локоть': 'elbow_epicondylitis',
  'Запястье': 'wrist',
};

function todayStr(): string {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function isActive(inj: InjurySelectEntry): boolean {
  return (!inj.from || inj.from <= todayStr()) && (!inj.to || inj.to >= todayStr());
}

/** Прогресс посттравматического восстановления (0-100%). 3 недели после to. */
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
type InjurySeverity = 'mild' | 'moderate' | 'severe';

/** Дефолтная градация щадящего режима (мышца остаётся, нагрузка снижена). */
export function gradedDefaults(severity: 'mild' | 'moderate' = 'moderate'): {
  exclude: false; weightPct: number; volumePct: number; repsCap: number; severity: 'mild' | 'moderate';
} {
  if (severity === 'mild') return { exclude: false, weightPct: 0.85, volumePct: 0.8, repsCap: 20, severity: 'mild' };
  return { exclude: false, weightPct: 0.65, volumePct: 0.6, repsCap: 15, severity: 'moderate' };
}

export const InjurySelectCard: React.FC<Props> = ({ injuries, onChange }) => {
  const [open, setOpen] = useState(false);
  const [customMuscle, setCustomMuscle] = useState('');
  const [customFrom, setCustomFrom] = useState(todayStr());
  const [customTo, setCustomTo] = useState('');
  // Режим и тяжесть, с которыми добавляются НОВЫЕ травмы (переключаются чипами в шапке).
  const [mode, setMode] = useState<InjuryMode>('exclude');
  const [newSeverity, setNewSeverity] = useState<InjurySeverity>('severe');

  const activeCount = injuries.filter(isActive).length;
  const totalCount = injuries.length;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const buildEntry = (muscle: string, jointSyndrome?: InjuryJointSyndrome, from?: string, to?: string): InjurySelectEntry => {
    const useExcl = mode === 'exclude' || newSeverity === 'severe';
    if (useExcl) {
      return { muscle, from: from || todayStr(), to: to || undefined, exclude: true, severity: 'severe', ...(jointSyndrome ? { jointSyndrome } : {}) };
    }
    const sev: 'mild' | 'moderate' = newSeverity === 'mild' ? 'mild' : 'moderate';
    return { muscle, from: from || todayStr(), to: to || undefined, ...gradedDefaults(sev), ...(jointSyndrome ? { jointSyndrome } : {}) };
  };

  const addInjury = (muscle: string, jointSyndrome?: InjuryJointSyndrome) => {
    if (injuries.some(i => i.muscle === muscle && i.jointSyndrome === jointSyndrome && isActive(i))) return;
    onChange([...injuries, buildEntry(muscle, jointSyndrome)]);
  };

  const addCustom = () => {
    if (!customMuscle.trim()) return;
    onChange([...injuries, buildEntry(customMuscle.trim(), undefined, customFrom, customTo)]);
    setCustomMuscle('');
    setCustomTo('');
  };

  const applySeverityToRow = (idx: number, sev: InjurySeverity) => {
    const next = [...injuries];
    const current = next[idx];
    if (!current) return;
    if (sev === 'severe') {
      next[idx] = { ...current, exclude: true, severity: 'severe', weightPct: undefined, volumePct: undefined, repsCap: undefined };
    } else {
      next[idx] = { ...current, ...gradedDefaults(sev) };
    }
    onChange(next);
  };

  const removeInjury = (idx: number) => {
    onChange(injuries.filter((_, i) => i !== idx));
  };

  return (
    <div className="train-injury">
      <button onClick={() => setOpen(true)} style={{
        width: '100%', padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 11, fontWeight: 700,
        textAlign: 'left' as const, boxSizing: 'border-box' as const,
        background: activeCount > 0 ? 'rgba(239,68,68,0.10)' : 'var(--surface-subtle, rgba(255,255,255,0.03))',
        border: activeCount > 0 ? '1px solid rgba(239,68,68,0.35)' : '1px solid var(--border, rgba(255,255,255,0.08))',
        color: activeCount > 0 ? '#ef4444' : 'var(--text, #fff)',
      }}>
        <div style={{ fontSize: 10.5, color: 'var(--text, #fff)', fontWeight: 600, marginBottom: 2 }}>
          🤕 Травмы / ограничения (мышцы и суставы)
        </div>
        <div style={{ fontSize: 12 }}>
          {activeCount > 0
            ? `${activeCount} активн. · всего ${totalCount}`
            : totalCount > 0
              ? `${totalCount} неактивн.`
              : 'Нет травм'}
        </div>
      </button>

      {open && typeof document !== 'undefined' && ReactDOM.createPortal(
        <div role="dialog" aria-modal="true" aria-label="Травмы и ограничения" style={overlay} onClick={() => setOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={sheet}>
            <div style={topBar} />
            <div style={sheetBody}>
              <div style={{ fontSize: 14, fontWeight: 700, color: ACCENT, marginBottom: 10 }}>🤕 Травмы и суставные ограничения</div>
              <div style={{ padding: 8, borderRadius: 8, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', marginBottom: 10 }}>
                <div style={{ fontSize: 10.5, color: 'var(--text, #fff)', lineHeight: 1.5 }}>
                  Отметьте суставной синдром или травмированную мышцу — план <b style={{ color: '#f87171' }}>защитит её</b>:
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => { setMode('exclude'); setNewSeverity('severe'); }}
                    style={{
                      flex: '1 1 45%', padding: '6px 8px', borderRadius: 6, cursor: 'pointer', textAlign: 'left' as const, minHeight: 40,
                      background: mode === 'exclude' ? 'rgba(239,68,68,0.22)' : 'rgba(239,68,68,0.12)',
                      border: mode === 'exclude' ? '2px solid #ef4444' : '1px solid rgba(239,68,68,0.3)',
                      color: '#f87171', fontSize: 10, lineHeight: 1.35,
                    }}>
                    <b>⛔ Исключить (тяжёлая)</b><br />упражнения заменяются безопасными аналогами{mode === 'exclude' ? ' — выбран' : ''}
                  </button>
                  <button type="button" onClick={() => { setMode('graded'); if (newSeverity === 'severe') setNewSeverity('moderate'); }}
                    style={{
                      flex: '1 1 45%', padding: '6px 8px', borderRadius: 6, cursor: 'pointer', textAlign: 'left' as const, minHeight: 40,
                      background: mode === 'graded' ? 'rgba(245,158,11,0.22)' : 'rgba(245,158,11,0.12)',
                      border: mode === 'graded' ? '2px solid #f59e0b' : '1px solid rgba(245,158,11,0.3)',
                      color: '#fbbf24', fontSize: 10, lineHeight: 1.35,
                    }}>
                    <b>⚡ Щадящая (лёгк/сред)</b><br />мышца остаётся, но вес/объём/повторы снижаются{mode === 'graded' ? ' — выбран' : ''}
                  </button>
                </div>
                {mode === 'graded' && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    {([['mild', 'Лёгкая (85% вес / 80% объём)'], ['moderate', 'Средняя (65% вес / 60% объём)']] as const).map(([sv, lbl]) => (
                      <button key={sv} type="button" onClick={() => setNewSeverity(sv)}
                        style={{
                          flex: 1, padding: '4px 6px', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                          background: newSeverity === sv ? 'rgba(245,158,11,0.25)' : 'var(--surface-subtle, rgba(255,255,255,0.03))',
                          border: newSeverity === sv ? '1px solid #f59e0b' : '1px solid var(--border, rgba(255,255,255,0.1))',
                          color: 'var(--text, #fff)',
                        }}>{lbl}</button>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: 10, color: 'var(--text-dim, rgba(255,255,255,0.82))', lineHeight: 1.4, marginTop: 6 }}>
                  Даты «с/до» действуют по неделям плана; после окончания («до») нагрузка возвращается по рампе (50% → 75% → 100%).
                </div>
              </div>

              {/* Joint & syndrome quick pick (отдельно от мышц — напр. поясница не удаляет пресс) */}
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', marginBottom: 6 }}>🦴 Суставы и синдромы</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
                {JOINT_SYNDROME_PRESETS.map(js => {
                  const activeIdx = injuries.findIndex(i => (i.jointSyndrome === js.id || i.muscle === js.muscle) && isActive(i));
                  const active = activeIdx >= 0;
                  return (
                    <button key={js.id} type="button" title={js.hint}
                      onClick={() => active ? removeInjury(activeIdx) : addInjury(js.muscle, js.id)}
                      style={{
                        padding: '5px 10px', borderRadius: 14, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                        background: active ? 'rgba(245,158,11,0.18)' : 'var(--surface-subtle, rgba(255,255,255,0.04))',
                        border: active ? '1px solid rgba(245,158,11,0.5)' : '1px solid var(--border, rgba(255,255,255,0.1))',
                        color: active ? '#fbbf24' : 'var(--text, #fff)',
                      }}>
                      {active ? '✕ ' : ''}{js.label}
                    </button>
                  );
                })}
              </div>

              {/* Quick toggle: common injury locations */}
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text, #fff)', marginBottom: 6 }}>🩼 Частые локации</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
                {INJURY_LOCATIONS.map(loc => {
                  const muscle = LOCATION_TO_MUSCLE[loc] || loc.toLowerCase();
                  const syndrome = LOCATION_TO_SYNDROME[loc];
                  const active = injuries.some(i => i.muscle === muscle && isActive(i));
                  return (
                    <button key={loc} onClick={() => active ? removeInjury(injuries.findIndex(i => i.muscle === muscle && isActive(i))) : addInjury(muscle, syndrome)}
                      style={{
                        padding: '5px 10px', borderRadius: 14, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                        background: active ? 'rgba(239,68,68,0.15)' : 'var(--surface-subtle, rgba(255,255,255,0.04))',
                        border: active ? '1px solid rgba(239,68,68,0.4)' : '1px solid var(--border, rgba(255,255,255,0.08))',
                        color: active ? '#ef4444' : 'var(--text, #fff)',
                      }}>
                      {active ? '✕ ' : ''}{loc}
                    </button>
                  );
                })}
              </div>

              {/* Muscle group quick pick */}
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text, #fff)', marginBottom: 6 }}>💪 Выбор по мышцам</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
                {MUSCLE_GROUPS.filter(m => !INJURY_LOCATIONS.some(l => (LOCATION_TO_MUSCLE[l] || '') === m.id)).map(mg => {
                  const active = injuries.some(i => i.muscle === mg.id && isActive(i));
                  return (
                    <button key={mg.id} onClick={() => active ? removeInjury(injuries.findIndex(i => i.muscle === mg.id && isActive(i))) : addInjury(mg.id)}
                      style={{
                        padding: '5px 10px', borderRadius: 14, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                        background: active ? 'rgba(239,68,68,0.15)' : 'var(--surface-subtle, rgba(255,255,255,0.04))',
                        border: active ? '1px solid rgba(239,68,68,0.4)' : '1px solid var(--border, rgba(255,255,255,0.08))',
                        color: active ? '#ef4444' : 'var(--text, #fff)',
                      }}>
                      {active ? '✕ ' : ''}{mg.label}
                    </button>
                  );
                })}
              </div>

              {/* Custom muscle input */}
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text, #fff)', marginBottom: 6 }}>✏️ Своя травма</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <input type="text" value={customMuscle} onChange={e => setCustomMuscle(e.target.value)} placeholder="Мышца/зона (на англ.)"
                  style={{
                    flex: 1, padding: '8px 10px', borderRadius: 8, fontSize: 11,
                    background: 'var(--input-bg, rgba(0,0,0,0.3))', border: '1px solid var(--border, rgba(255,255,255,0.1))',
                    color: 'var(--text, #fff)', outline: 'none', boxSizing: 'border-box',
                  }} />
                <button onClick={addCustom} disabled={!customMuscle.trim()}
                  style={{
                    padding: '8px 14px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    background: customMuscle.trim() ? 'linear-gradient(135deg,#00e68a,#00c853)' : 'var(--surface-subtle, rgba(255,255,255,0.05))',
                    border: 'none', color: customMuscle.trim() ? '#000' : 'var(--text, #fff)',
                  }}>+ Добавить</button>
              </div>

              {/* Date range for custom */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: 'var(--text, #fff)', marginBottom: 2 }}>Начало</div>
                  <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                    style={{
                      width: '100%', padding: '6px 8px', borderRadius: 6, fontSize: 10,
                      background: 'var(--input-bg, rgba(0,0,0,0.3))', border: '1px solid var(--border, rgba(255,255,255,0.1))',
                      color: 'var(--text, #fff)', outline: 'none', boxSizing: 'border-box',
                    }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: 'var(--text, #fff)', marginBottom: 2 }}>Окончание (необяз.)</div>
                  <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                    style={{
                      width: '100%', padding: '6px 8px', borderRadius: 6, fontSize: 10,
                      background: 'var(--input-bg, rgba(0,0,0,0.3))', border: '1px solid var(--border, rgba(255,255,255,0.1))',
                      color: 'var(--text, #fff)', outline: 'none', boxSizing: 'border-box',
                    }} />
                </div>
              </div>

              {/* Current injuries list */}
              {injuries.length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text, #fff)', marginBottom: 6 }}>📋 Текущие травмы</div>
                  {injuries.map((inj, i) => {
                    const active = isActive(inj);
                    const isGraded = inj.exclude === false;
                    return (
                      <div key={i} style={{ marginBottom: 6 }}>
                        {/* Header row */}
                        <div style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4, flexWrap: 'wrap',
                          padding: '6px 8px', borderRadius: 6,
                          background: active ? 'rgba(239,68,68,0.06)' : 'var(--surface-subtle, rgba(255,255,255,0.02))',
                          border: '1px solid ' + (active ? 'rgba(239,68,68,0.2)' : 'var(--border, rgba(255,255,255,0.06))'),
                        }}>
                          <div style={{ flex: 1, minWidth: 120 }}>
                            <span style={{ fontWeight: 700, fontSize: 11, color: active ? '#ef4444' : 'var(--text, #fff)' }}>
                              {inj.muscle}{inj.jointSyndrome ? ` (${inj.jointSyndrome})` : ''}
                            </span>
                            <span style={{ fontSize: 10, color: 'var(--text-dim, rgba(255,255,255,0.75))', marginLeft: 6 }}>
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
                              <>
                                <button type="button" onClick={() => applySeverityToRow(i, 'mild')}
                                  style={{ padding: '3px 6px', borderRadius: 6, fontSize: 10, cursor: 'pointer', background: inj.severity === 'mild' ? 'rgba(34,197,94,0.2)' : 'var(--surface-subtle, rgba(255,255,255,0.04))', border: '1px solid var(--border, rgba(255,255,255,0.12))', color: 'var(--text, #fff)' }}>Лёгк</button>
                                <button type="button" onClick={() => applySeverityToRow(i, 'moderate')}
                                  style={{ padding: '3px 6px', borderRadius: 6, fontSize: 10, cursor: 'pointer', background: isGraded && inj.severity !== 'mild' ? 'rgba(245,158,11,0.22)' : 'var(--surface-subtle, rgba(255,255,255,0.04))', border: '1px solid rgba(245,158,11,0.3)', color: '#fbbf24' }}>Сред</button>
                                <button type="button" onClick={() => applySeverityToRow(i, 'severe')}
                                  style={{ padding: '3px 6px', borderRadius: 6, fontSize: 10, cursor: 'pointer', background: !isGraded ? 'rgba(239,68,68,0.22)' : 'var(--surface-subtle, rgba(255,255,255,0.04))', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}>Тяж</button>
                              </>
                            )}
                            <button onClick={() => removeInjury(i)}
                              style={{
                                padding: '3px 8px', borderRadius: 6, fontSize: 10, cursor: 'pointer',
                                background: 'var(--surface-subtle, rgba(255,255,255,0.05))', border: '1px solid var(--border, rgba(255,255,255,0.1))',
                                color: 'var(--text, #fff)',
                              }}>✕</button>
                          </div>
                        </div>
                        {/* Gradation panel for active graded injuries */}
                        {active && isGraded && (
                          <div style={{ padding: '6px 8px 2px 8px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
                            <div>
                              <div style={{ fontSize: 10, color: 'var(--text, #fff)', marginBottom: 1 }}>Вес: {Math.round((inj.weightPct ?? 0.6) * 100)}%</div>
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
                              <div style={{ fontSize: 10, color: 'var(--text, #fff)', marginBottom: 1 }}>Объём: {Math.round((inj.volumePct ?? 0.6) * 100)}%</div>
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
                              <div style={{ fontSize: 10, color: 'var(--text, #fff)', marginBottom: 1 }}>Повт: макс {inj.repsCap ?? 15}</div>
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
                  width: '100%', marginTop: 12, padding: '10px', borderRadius: 8, fontSize: 12, minHeight: 44,
                  fontWeight: 700, cursor: 'pointer', border: 'none',
                  background: 'var(--accent-gradient, linear-gradient(135deg,#00e68a,#00c853))', color: 'var(--accent-contrast, #000)',
                }}>Готово</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};
