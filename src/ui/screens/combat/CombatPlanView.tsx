/**
 * CombatPlanView.tsx — премиальный рендер плана единоборств.
 * Стекло, градиенты, современные карточки недель/сессий/упражнений.
 */
import React from 'react';
import type { CombatPlan } from '../../../engines/combat/combat.types';
import { getCombat } from '../../../engines/combat/combat-volume';
import { buildCombatReport } from '../../../engines/combat/combat-finalize.engine';
import { ruLabel, PHASE_RU, Badge, InfoBanner, CARD, BTN, BTN_PRIMARY, BTN_SMALL, INPUT, ACCENT_GRAD, TEXT_3, Highlight } from './CombatUI';
import { CB_STRICT_GROUPS, cbStrictGroupFor } from '../../../engines/combat/combat-selection';
import { buildCombatPrintHtml, downloadCombatCsv, buildCombatPlanIcs } from '../../../engines/combat/combat-print.engine';

type Props = {
  plan: CombatPlan;
  historyLen: number;
  onUndo: () => void;
  onUpdateEx: (wkIdx: number, day: number, exId: string, patch: Partial<{ weight: number; reps: string; rir: number }>) => void;
  onMoveEx: (wkIdx: number, day: number, exId: string, dir: -1 | 1) => void;
  onSwapEx: (wkIdx: number, day: number, exId: string, newId: string) => void;
  // годовой + экспорт (опционально прокидываются из конструктора)
  annual?: any;
  annualWeeks?: number;
  setAnnualWeeks?: (n: number) => void;
  competitionName?: string;
  setCompetitionName?: (s: string) => void;
  competitionDate?: string;
  setCompetitionDate?: (s: string) => void;
  competitionWeight?: string;
  setCompetitionWeight?: (s: string) => void;
  startDate?: string;
  outside?: any;
  outsideMetrics?: any;
  diaryLoad?: number | null;
  acwr?: { ratio: number; zone: string } | null;
  msg?: string;
  setMsg?: (s: string) => void;
  onBuildATR?: () => void;
  onAddCompetition?: () => void;
  onPrintAnnual?: () => void;
  onDownloadIcs?: () => void;
  onExportProgram?: () => void;
};

export const CombatPlanView: React.FC<Props> = ({
  plan, historyLen, onUndo, onUpdateEx, onMoveEx, onSwapEx,
  annual, annualWeeks, setAnnualWeeks, competitionName, setCompetitionName, competitionDate, setCompetitionDate, competitionWeight, setCompetitionWeight,
  startDate, outside, outsideMetrics, diaryLoad, acwr, msg, setMsg,
  onBuildATR, onAddCompetition, onPrintAnnual, onDownloadIcs, onExportProgram,
}) => {
  const [expandedWeek, setExpandedWeek] = React.useState<number | null>(0);
  const doMsg = (m: string) => { setMsg?.(m); setTimeout(() => setMsg?.(''), 2200); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Верхняя панель действий */}
      <div style={{ ...CARD, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={onUndo} disabled={historyLen === 0} style={{
            padding: '8px 12px', borderRadius: 10, fontSize: 11, fontWeight: 800, cursor: historyLen ? 'pointer' : 'default',
            background: historyLen ? 'linear-gradient(135deg, rgba(168,85,247,0.18), rgba(236,72,153,0.14))' : 'rgba(255,255,255,0.04)',
            color: historyLen ? '#d8b4fe' : 'rgba(255,255,255,0.32)', border: `1px solid ${historyLen ? 'rgba(168,85,247,0.28)' : 'rgba(255,255,255,0.06)'}`,
            backdropFilter: 'blur(8px)',
          }}>↩ Отменить {historyLen ? `(${historyLen})` : ''}</button>
          <span style={{ fontSize: 11, color: TEXT_3, fontWeight: 700 }}>История {historyLen}/10</span>
        </div>
        {msg && <span style={{ fontSize: 11, color: '#fff', background: 'rgba(168,85,247,0.14)', padding: '5px 10px', borderRadius: 20, border: '1px solid rgba(168,85,247,0.22)' }}>{msg}</span>}
      </div>

      {/* Отчёт */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(168,85,247,0.14), rgba(236,72,153,0.08), rgba(18,16,28,0.72))',
        border: '1px solid rgba(168,85,247,0.22)', borderRadius: 16, padding: 14, color: '#fff', fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap',
        boxShadow: '0 10px 28px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.06)', backdropFilter: 'blur(14px)',
      }}>
        <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 0.6, textTransform: 'uppercase', color: 'rgba(255,255,255,0.52)', marginBottom: 6 }}>Сводка плана</div>
        {buildCombatReport(plan)}
      </div>

      {plan.validation?.warnings.map((w, i) => (
        <InfoBanner key={i} tone="warn">{w}</InfoBanner>
      ))}

      {/* Кондиция */}
      {(plan as any).conditioning && (
        <div style={{ ...CARD, padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 28, height: 28, borderRadius: 9, background: 'linear-gradient(135deg,#3b82f6,#06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>🏃</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 900, color: '#fff' }}>Кондиция — 3 системы</div>
              <div style={{ fontSize: 11, color: TEXT_3 }}>Вне зала {outside?.sessionsPerWeek ?? 0}× · объём ×{outsideMetrics?.volumeMultiplier ?? 1}</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(plan as any).conditioning.sessions.map((week: any[], wi: number) => (
              <div key={wi} style={{ fontSize: 11, color: 'rgba(255,255,255,0.82)', background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontWeight: 800, color: '#60a5fa' }}>Нед {wi + 1} {ruLabel(PHASE_RU, plan.weeksData[wi]?.phase)}:</span>{' '}
                {week.length ? week.map((s: any) => `${s.modality} ${s.durationMin}′ ${s.intervals || ''}`).join(' · ') : <span style={{ color: TEXT_3 }}>внезал покрывает</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Карта качества */}
      <div style={CARD}>
        <div style={{ fontSize: 12, fontWeight: 900, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 28, height: 28, borderRadius: 9, background: 'linear-gradient(135deg,#a855f7,#ec4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>✦</span>
          Карта качества — сеты/нед vs MEV/MRV
        </div>
        {(['neck', 'grip', 'core'] as const).map(kind => (
          <div key={kind} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: 0.5, textTransform: 'uppercase', color: kind === 'neck' ? '#c4b5fd' : kind === 'grip' ? '#fbbf24' : '#6ee7b7', minWidth: 42 }}>{kind === 'neck' ? 'Шея' : kind === 'grip' ? 'Хват' : 'Core'}</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
              {plan.weeksData.map(wk => {
                let sets = 0;
                if (kind === 'neck') sets = wk.sessions.reduce((s, sess) => s + sess.exercises.filter(e => e.id.includes('neck')).reduce((a, e) => a + e.sets, 0), 0);
                if (kind === 'grip') sets = wk.sessions.reduce((s, sess) => s + sess.exercises.filter(e => e.id.includes('grip') || e.id.includes('pinch') || e.id.includes('wrist') || e.id.includes('farmer') || e.id.includes('towel')).reduce((a, e) => a + e.sets, 0), 0);
                if (kind === 'core') sets = wk.sessions.reduce((s, sess) => s + sess.exercises.filter(e => ['deadbug', 'hollow_hold', 'side_plank', 'ab_wheel', 'copenhagen_plank', 'pallof_rotation_press', 'suitcase_carry', 'landmine_rotation'].includes(e.id)).reduce((a, e) => a + e.sets, 0), 0);
                let col = '#a855f7';
                if (kind === 'core') col = sets < 4 ? '#f59e0b' : sets <= 10 ? '#a855f7' : '#eab308';
                else {
                  const lm = getCombat(plan.level, kind as any);
                  const st = lm ? (sets < lm.mev ? 'below' : sets <= lm.mav ? 'optimal' : sets <= lm.mrv ? 'high' : 'over') : 'optimal';
                  col = st === 'below' ? '#f59e0b' : st === 'optimal' ? '#a855f7' : st === 'high' ? '#eab308' : '#ef4444';
                }
                return (
                  <span key={wk.week} style={{ padding: '4px 8px', borderRadius: 10, background: col + '14', border: `1px solid ${col}2e`, color: col, fontSize: 10.5, fontWeight: 800 }}>
                    Н{wk.week} · {sets}{wk.deload ? ' · разгрузка' : (wk as any).taper ? ' · тапер' : ''}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {diaryLoad != null && (
        <InfoBanner tone={diaryLoad > 30 ? 'warn' : 'info'}>
          Дневник: нагрузка 7д ≈ {diaryLoad} {diaryLoad > 30 ? '— высоко, рассмотрите лёгкую неделю' : '— норма'} {acwr ? `· ACWR ${acwr.ratio} · ${acwr.zone}` : ''}
        </InfoBanner>
      )}

      {/* Недели */}
      {plan.weeksData.map(wk => {
        const isOpen = expandedWeek === wk.week - 1;
        const phaseColor = (PHASE_RU as any)[wk.phase] ? (wk.deload ? '#f59e0b' : (wk as any).taper ? '#60a5fa' : '#a855f7') : '#a855f7';
        const border = wk.deload ? 'rgba(245,158,11,0.28)' : (wk as any).taper ? 'rgba(59,130,246,0.22)' : 'rgba(168,85,247,0.16)';
        return (
          <div key={wk.week} style={{ ...CARD, padding: 0, overflow: 'hidden', borderColor: border, background: isOpen ? 'linear-gradient(180deg, rgba(26,24,38,0.82), rgba(18,16,28,0.66))' : CARD.background }}>
            <button
              onClick={() => setExpandedWeek(isOpen ? null : wk.week - 1)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 14px', background: 'transparent', border: 'none',
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              <span style={{
                width: 36, height: 36, borderRadius: 11, background: wk.deload ? 'linear-gradient(135deg,#f59e0b,#f97316)' : (wk as any).taper ? 'linear-gradient(135deg,#3b82f6,#06b6d4)' : ACCENT_GRAD,
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 13, flexShrink: 0,
                boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
              }}>{wk.week}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>
                  {ruLabel(PHASE_RU, wk.phase)}{wk.deload ? ' · разгрузка' : (wk as any).taper ? ' · тапер' : ''} · {wk.totalSets} сетов{(wk as any).totalTonnage ? ` · ${((wk as any).totalTonnage / 1000).toFixed(1)}т` : ''}
                </div>
                <div style={{ fontSize: 11, color: TEXT_3, marginTop: 1 }}>Неделя {wk.week} · {wk.sessions.length} сессий · {wk.sessions.reduce((a, s) => a + s.exercises.length, 0)} упр.</div>
              </div>
              <span style={{ width: 32, height: 32, borderRadius: 10, background: isOpen ? 'rgba(168,85,247,0.14)' : 'rgba(255,255,255,0.06)', border: `1px solid ${isOpen ? 'rgba(168,85,247,0.22)' : 'rgba(255,255,255,0.08)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, transition: 'transform 0.18s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
            </button>

            {!isOpen && (
              <div style={{ padding: '0 14px 12px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {wk.sessions.map(s => (
                  <span key={s.day} style={{ fontSize: 10.5, padding: '4px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)' }}>
                    {s.sessionTag} · {s.exercises.length}упр
                  </span>
                ))}
              </div>
            )}

            {isOpen && (
              <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={() => {
                    const txt = wk.sessions.map(s => `${s.sessionTag} (${s.character}) д${s.day}:\n` + s.exercises.map(e => `  ${e.name} ${e.sets}x${e.reps} ${e.weight ? e.weight + 'кг' : ''} RIR${e.rir} ${e.tempo} отдых${e.restSeconds}с${e.comment ? ' // ' + e.comment : ''}`).join('\n')).join('\n\n');
                    navigator.clipboard?.writeText(`Неделя ${wk.week} ${wk.phase}\n` + txt); doMsg(`Неделя ${wk.week} скопирована`);
                  }} style={{ ...BTN_SMALL, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff' }}>⎙ Копировать неделю</button>
                </div>

                {wk.sessions.map(sess => (
                  <div key={sess.day} style={{
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 10,
                    backdropFilter: 'blur(8px)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 900, color: '#fff' }}>{sess.sessionTag} <span style={{ fontWeight: 600, color: TEXT_3 }}>· {sess.character} · день {sess.day} · {sess.durationMin} мин</span></span>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.42)', background: 'rgba(0,0,0,0.18)', padding: '3px 7px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.06)' }}>
                        ⏱ {Math.round(sess.exercises.reduce((a, e) => a + e.workSets.length * (e.restSeconds || 75), 0) / 60)} мин отдыха
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {sess.exercises.map(ex => (
                        <div key={ex.id} style={{
                          background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
                          border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', gap: 7,
                        }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#fff', flex: '1 1 160px', fontFamily:'-apple-system, system-ui, sans-serif' }}>
                              {ex.name} <span style={{ fontWeight: 500, color: 'rgba(235,235,245,0.62)' }}>— <Highlight color="#a855f7">{ex.sets}×{ex.reps}</Highlight>{ex.weight ? <> · <Highlight>{ex.weight}кг</Highlight></> : ''} · <Highlight>RIR{ex.rir}</Highlight></span>
                              <span style={{ fontSize: 10.5, color: TEXT_3, marginLeft: 6, fontVariantNumeric:'tabular-nums' }}>· {ex.tempo} · {ex.restSeconds}с</span>
                              {ex.comment?.includes('Тапер') && <Highlight color="#60a5fa">тапер</Highlight>}
                              {ex.comment?.includes('Весогонка') && <Highlight color="#ff9f0a">весогонка</Highlight>}
                            </span>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '64px 64px 64px 1fr auto', gap: 6, alignItems: 'center' }}>
                            <input aria-label="вес" type="number" value={ex.weight} onChange={e => onUpdateEx(wk.week - 1, sess.day, ex.id, { weight: Number(e.target.value) || 0 })} placeholder="вес" style={{ ...INPUT, padding: '7px 8px', fontSize: 12, textAlign: 'center' }} />
                            <input aria-label="повторы" type="text" value={ex.reps} onChange={e => onUpdateEx(wk.week - 1, sess.day, ex.id, { reps: e.target.value })} placeholder="повт" style={{ ...INPUT, padding: '7px 8px', fontSize: 12, textAlign: 'center' }} />
                            <input aria-label="RIR" type="number" min={0} max={5} value={ex.rir} onChange={e => onUpdateEx(wk.week - 1, sess.day, ex.id, { rir: Number(e.target.value) || 0 })} style={{ ...INPUT, padding: '7px 8px', fontSize: 12, textAlign: 'center' }} />
                            <select aria-label="замена" value={ex.id} onChange={e => { const v = e.target.value; if (v !== ex.id) onSwapEx(wk.week - 1, sess.day, ex.id, v); }} style={{ ...INPUT, padding: '7px 8px', fontSize: 11, background: 'rgba(168,85,247,0.08)', borderColor: 'rgba(168,85,247,0.18)', color: '#d8b4fe' }}>
                              <option value={ex.id}>{ex.id} ✓</option>
                              {(cbStrictGroupFor(ex.id) ? CB_STRICT_GROUPS[cbStrictGroupFor(ex.id)!] : []).filter(id => id !== ex.id).map(id => <option key={id} value={id}>{id}</option>)}
                            </select>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button aria-label="вверх" onClick={() => onMoveEx(wk.week - 1, sess.day, ex.id, -1)} style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', cursor: 'pointer', fontSize: 12 }}>↑</button>
                              <button aria-label="вниз" onClick={() => onMoveEx(wk.week - 1, sess.day, ex.id, 1)} style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', cursor: 'pointer', fontSize: 12 }}>↓</button>
                            </div>
                          </div>

                          {ex.comment && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.58)', background: 'rgba(168,85,247,0.06)', borderLeft: '2px solid rgba(168,85,247,0.28)', padding: '6px 8px', borderRadius: 8 }}>{ex.comment}</div>}
                          {ex.warmupSets && ex.warmupSets.length > 0 && <div style={{ fontSize: 10.5, color: TEXT_3 }}>Разминка: {ex.warmupSets.map(s => `${s.reps}×${s.weight}кг`).join(' → ')} → рабочие</div>}
                          <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.36)', fontFamily: 'ui-monospace, monospace' }}>Сеты: {ex.workSets.map(s => `${s.reps}×${s.weight ? s.weight + 'кг' : '—'} RIR${s.rir}`).join(' · ')}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Годовой */}
      {annual && onBuildATR && (
        <div style={{ ...CARD, gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 30, height: 30, borderRadius: 10, background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🗓️</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 900, color: '#fff' }}>Годовой ATR — {annual.totalWeeks} нед · {annual.blocks.length} блоков {annual.discipline ? `· ${annual.discipline}` : ''}</div>
                <div style={{ fontSize: 11, color: TEXT_3 }}>Блоки с тапером строятся автоматически</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <button onClick={onBuildATR} style={{ ...BTN_SMALL, background: 'rgba(168,85,247,0.14)', color: '#d8b4fe', border: '1px solid rgba(168,85,247,0.24)' }}>↻ Построить {annualWeeks} нед</button>
              {setAnnualWeeks && (
                <select value={annualWeeks} onChange={e => setAnnualWeeks(Number(e.target.value))} style={{ ...INPUT, width: 100, padding: '7px 8px', fontSize: 12 }}>
                  <option value={12}>12 нед</option><option value={24}>24 нед</option><option value={36}>36 нед</option><option value={52}>52 нед</option>
                </select>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {annual.blocks.map((b: any) => (
              <span key={b.id} style={{
                padding: '5px 9px', borderRadius: 10, fontSize: 10.5, fontWeight: 800,
                background: b.phase === 'accumulation' ? 'rgba(59,130,246,0.12)' : b.phase === 'transmutation' ? 'rgba(168,85,247,0.12)' : b.phase === 'realization' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                border: `1px solid ${b.phase === 'accumulation' ? 'rgba(59,130,246,0.22)' : b.phase === 'transmutation' ? 'rgba(168,85,247,0.22)' : b.phase === 'realization' ? 'rgba(239,68,68,0.22)' : 'rgba(245,158,11,0.22)'}`,
                color: b.phase === 'accumulation' ? '#60a5fa' : b.phase === 'transmutation' ? '#c4b5fd' : b.phase === 'realization' ? '#f87171' : '#fbbf24',
              }}>
                Нед {b.startWeek}-{b.startWeek + b.weeks - 1}: {b.phase} · {b.weeks}нед{b.fightDate ? ' 🏁' : ''}
              </span>
            ))}
          </div>

          <div style={{ display: 'flex', height: 16, borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.18)' }}>
            {annual.blocks.map((b: any) => {
              const w = (b.weeks / annual.totalWeeks * 100).toFixed(2);
              const col = b.phase === 'accumulation' ? '#3b82f6' : b.phase === 'transmutation' ? '#a855f7' : b.phase === 'realization' ? '#ef4444' : '#f59e0b';
              return <div key={b.id} title={`${b.phase} ${b.weeks}нед`} style={{ width: `${w}%`, background: col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#fff', fontWeight: 900 }}>{b.weeks}</div>;
            })}
          </div>
          <div style={{ fontSize: 9, color: TEXT_3, display: 'flex', justifyContent: 'space-between' }}><span>Нед 1 · {startDate}</span><span>Нед {annual.totalWeeks}</span></div>

          {annual.competitions?.length > 0 && (
            <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.14)', borderRadius: 12, padding: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: '#f87171' }}>Бои ({annual.competitions.length}):</div>
              {annual.competitions.map((c: any) => <div key={c.id} style={{ fontSize: 11, color: 'rgba(255,255,255,0.82)' }}>🏁 {c.name} — {c.date} {c.weightClass ? `(${c.weightClass})` : ''}</div>)}
            </div>
          )}

          {setCompetitionName && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <input placeholder="Название боя" value={competitionName} onChange={e => setCompetitionName(e.target.value)} style={{ ...INPUT, flex: 1, minWidth: 140, padding: '8px 10px', fontSize: 11 }} />
              <input type="date" value={competitionDate} onChange={e => setCompetitionDate!(e.target.value)} style={{ ...INPUT, width: 150, padding: '8px 10px', fontSize: 11 }} />
              <input placeholder="Вес.кат." value={competitionWeight} onChange={e => setCompetitionWeight!(e.target.value)} style={{ ...INPUT, width: 110, padding: '8px 10px', fontSize: 11 }} />
              <button onClick={onAddCompetition} style={{ ...BTN_SMALL, background: '#ef4444', color: '#fff', border: 'none' }}>+ Бой</button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={onPrintAnnual} style={{ ...BTN_SMALL, background: 'rgba(255,255,255,0.06)', color: '#fff' }}>🖨 Печать года</button>
            <button onClick={onDownloadIcs} style={{ ...BTN_SMALL, background: 'rgba(255,255,255,0.06)', color: '#fff' }}>📅 .ics</button>
          </div>
        </div>
      )}

      {/* Экспорт */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
        <button onClick={() => { const txt = buildCombatReport(plan); navigator.clipboard?.writeText(txt); doMsg('Скопировано'); }} style={BTN}>⎙ Копировать отчёт</button>
        <button onClick={() => { const html = buildCombatPrintHtml(plan); const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); w.print(); } else { navigator.clipboard?.writeText(html); doMsg('HTML скопирован'); } }} style={BTN}>🖨 Печать</button>
        <button onClick={() => { downloadCombatCsv(plan); doMsg('CSV скачан'); }} style={BTN}>📊 CSV</button>
        <button onClick={() => { const ics = buildCombatPlanIcs(plan, startDate || null); const blob = new Blob([ics], { type: 'text/calendar' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `combat-plan-${plan.discipline}-${plan.weeks}w.ics`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); doMsg('ICS скачан'); }} style={BTN}>📅 План .ics</button>
        <button onClick={onExportProgram} style={BTN_PRIMARY}>✦ Экспорт в программу</button>
      </div>
    </div>
  );
};
