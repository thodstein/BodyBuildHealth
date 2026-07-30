/**
 * MacrocyclePanel.tsx — годовое планирование ПЛ-авто (Этап T0 UI).
 * Таймлайн 5 фаз года (endurance→strength→peak→competition→transition),
 * выбор недели соревнований, клик по блоку → применить активный цикл.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  buildMacrocycle, rebalanceMacrocycle, macrocycleToActiveCycle,
  serializeMacro, deserializeMacro, estimateCompetitionWeek,
  PHASE_COLOR, PHASE_LABEL_RU,
  type Macrocycle, type MacroPhase, type MacroInput,
} from '../../../engines/lms/macrocycle.engine';
import { getCycleById } from '../../../data/lms-cycles/lms-cycle-index';

const CARD: React.CSSProperties = { background: 'rgba(24,24,27,0.6)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)', padding: 12, margin: '6px 0' };
const SMALL: React.CSSProperties = { color: 'rgba(255,255,255,0.55)', fontSize: 11, lineHeight: 1.4 };
const H: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginBottom: 8 };
const IN: React.CSSProperties = { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px', minHeight: 38, width: '100%', boxSizing: 'border-box' as const };
const SEL: React.CSSProperties = { ...IN, minHeight: 40 };
const LABEL: React.CSSProperties = { color: 'rgba(255,255,255,0.6)', fontSize: 11, margin: '4px 0 2px' };
const BTN: React.CSSProperties = { background: 'var(--accent)', color: '#0a0a0a', border: 'none', borderRadius: 8, padding: '10px 14px', fontWeight: 600, fontSize: 12, minHeight: 40, cursor: 'pointer' };
const BTN_GHOST: React.CSSProperties = { ...BTN, background: 'transparent', color: 'var(--accent)', border: '1px solid var(--accent-dim)' };

const PHASES: MacroPhase[] = ['endurance', 'strength', 'peak', 'competition', 'transition'];
const PHASE_ICON: Record<MacroPhase, string> = {
  endurance: '🏃', strength: '🏋️', peak: '⛰️', competition: '🏁', transition: '🧘',
};

const STORAGE_KEY = 'he_pl_macro';

interface Props {
  level: string;
  goal: 'powerlifting' | 'bodybuilding' | 'general';
  onApplyCycle: (cycleId: string, weeks: number) => void;
}

export const MacrocyclePanel: React.FC<Props> = ({ level, goal, onApplyCycle }) => {
  const [macro, setMacro] = useState<Macrocycle | null>(() => {
    try { const s = localStorage.getItem(STORAGE_KEY); return s ? deserializeMacro(s) : null; } catch { return null; }
  });
  const [compWeek, setCompWeek] = useState<number>(macro?.competitionWeek ?? 44);
  const [totalWeeks, setTotalWeeks] = useState<number>(macro?.totalWeeks ?? 52);
  const [selectedBlockIdx, setSelectedBlockIdx] = useState<number>(-1);
  const [editWeeks, setEditWeeks] = useState<Record<string, number>>({});

  useEffect(() => {
    if (macro) { try { localStorage.setItem(STORAGE_KEY, serializeMacro(macro)); } catch { /* ignore */ } }
  }, [macro]);

  const build = () => {
    const input: MacroInput = { level, goal, competitionWeek: compWeek, totalWeeks };
    const m = buildMacrocycle(input);
    setMacro(m);
    setSelectedBlockIdx(-1);
    setEditWeeks({});
  };

  const applyEdit = () => {
    if (!macro) return;
    const edits = PHASES.map(p => ({ phase: p, weeks: editWeeks[p] ?? macro.blocks.find(b => b.phase === p)?.weeks ?? 0 })).filter(e => e.weeks > 0);
    setMacro(rebalanceMacrocycle(macro, edits));
  };

  const applyBlock = (idx: number) => {
    if (!macro) return;
    const block = macro.blocks[idx];
    if (!block || !block.cycleId) return;
    onApplyCycle(block.cycleId, block.weeks);
  };

  const activeBlock = useMemo(() => {
    if (!macro) return null;
    // "сегодня" = неделя 1 (начало макро). Пользователь может кликнуть блок.
    if (selectedBlockIdx >= 0) return macro.blocks[selectedBlockIdx];
    return null;
  }, [macro, selectedBlockIdx]);

  return (
    <div>
      {/* Параметры */}
      <div style={CARD}>
        <div style={H}>🗓 Годовое планирование ПЛ</div>
        <div style={{ ...SMALL, marginBottom: 8 }}>Последовательность фаз: выносливость → силовой → выход на пик → соревнования → переход. Клик по блоку → применить цикл.</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <div style={LABEL}>Уровень</div>
            <select style={SEL} value={level} disabled>
              <option value={level}>{level}</option>
            </select>
          </div>
          <div>
            <div style={LABEL}>Цель</div>
            <select style={SEL} value={goal} disabled>
              <option value="powerlifting">Пауэрлифтинг</option>
              <option value="bodybuilding">Бодибилдинг</option>
              <option value="general">Общее</option>
            </select>
          </div>
          <div>
            <div style={LABEL}>Длительность, нед</div>
            <input style={IN} type="number" min={12} max={104} value={totalWeeks} onChange={e => setTotalWeeks(+e.target.value)} />
          </div>
          <div>
            <div style={LABEL}>Неделя соревнований</div>
            <input style={IN} type="number" min={1} max={totalWeeks} value={compWeek} onChange={e => setCompWeek(+e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button onClick={build} style={BTN}>Построить макроцикл</button>
          {macro && <button onClick={() => { setMacro(null); try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ } }} style={BTN_GHOST}>Сбросить</button>}
        </div>
      </div>

      {/* Таймлайн */}
      {macro && (
        <div style={CARD}>
          <div style={H}>📅 Таймлайн ({macro.totalWeeks} нед)</div>
          {/* Горизонтальная полоса с блоками */}
          <div style={{ display: 'flex', height: 56, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 8 }}>
            {macro.blocks.map((b, i) => {
              const pct = (b.weeks / macro.totalWeeks) * 100;
              const isSel = selectedBlockIdx === i;
              const isComp = macro.competitionWeek != null && macro.competitionWeek >= b.weekOffset && macro.competitionWeek < b.weekOffset + b.weeks;
              return (
                <div
                  key={i}
                  onClick={() => setSelectedBlockIdx(i)}
                  style={{
                    flex: `${pct} 1 0`,
                    background: PHASE_COLOR[b.phase] + (isSel ? 'cc' : '44'),
                    borderRight: '1px solid rgba(0,0,0,0.2)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2px 4px',
                    position: 'relative',
                  }}
                  title={`${PHASE_LABEL_RU[b.phase]}: нед ${b.weekOffset}-${b.weekOffset + b.weeks - 1}`}
                >
                  <span style={{ fontSize: 16 }}>{PHASE_ICON[b.phase]}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: isSel ? '#000' : '#fff', textAlign: 'center', lineHeight: 1.1 }}>{PHASE_LABEL_RU[b.phase]}</span>
                  <span style={{ fontSize: 8, color: isSel ? '#000' : 'rgba(255,255,255,0.7)' }}>{b.weeks}н</span>
                  {isComp && <span style={{ position: 'absolute', top: 0, right: 2, fontSize: 10 }}>🏁</span>}
                </div>
              );
            })}
          </div>

          {/* Линейка недель */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>
            <span>Нед 1</span>
            <span>Нед {Math.round(macro.totalWeeks / 4)}</span>
            <span>Нед {Math.round(macro.totalWeeks / 2)}</span>
            <span>Нед {Math.round(macro.totalWeeks * 3 / 4)}</span>
            <span>Нед {macro.totalWeeks}</span>
          </div>

          {/* Детали выбранного блока */}
          {activeBlock && (
            <div style={{ padding: 10, borderRadius: 8, background: PHASE_COLOR[activeBlock.phase] + '15', border: `1px solid ${PHASE_COLOR[activeBlock.phase]}40`, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: PHASE_COLOR[activeBlock.phase] }}>{PHASE_ICON[activeBlock.phase]} {PHASE_LABEL_RU[activeBlock.phase]}</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Нед {activeBlock.weekOffset}–{activeBlock.weekOffset + activeBlock.weeks - 1} ({activeBlock.weeks} нед)</span>
              </div>
              <div style={{ ...SMALL, marginBottom: 6 }}>{activeBlock.description}</div>
              {activeBlock.cycleId && (() => {
                const cyc = getCycleById(activeBlock.cycleId);
                return (
                  <div style={{ ...SMALL, marginBottom: 8 }}>
                    {cyc ? (
                      <>
                        <div><b style={{ color: '#fff' }}>Цикл:</b> «{cyc.meta.title}»</div>
                        <div style={{ marginTop: 2, color: 'rgba(255,255,255,0.5)' }}>{cyc.meta.sessionsPerWeek} дн/нед · {cyc.meta.level} · {cyc.meta.period}</div>
                        {cyc.meta.howItWorks && <div style={{ marginTop: 4, color: 'rgba(255,255,255,0.45)', fontSize: 10 }}>{cyc.meta.howItWorks.slice(0, 160)}{cyc.meta.howItWorks.length > 160 ? '…' : ''}</div>}
                      </>
                    ) : <div style={{ color: '#ef4444' }}>Цикл {activeBlock.cycleId} не найден</div>}
                  </div>
                );
              })()}
              {activeBlock.cycleId && (
                <button onClick={() => applyBlock(selectedBlockIdx)} style={{ ...BTN, fontSize: 11, padding: '8px 12px', minHeight: 34 }}>
                  ✓ Применить как активный цикл
                </button>
              )}
            </div>
          )}

          {/* Правка длительности фаз */}
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>⚙️ Правка длительности фаз</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
              {macro.blocks.map((b, i) => (
                <div key={i}>
                  <div style={{ fontSize: 9, color: PHASE_COLOR[b.phase], textAlign: 'center', fontWeight: 700 }}>{PHASE_ICON[b.phase]} {PHASE_LABEL_RU[b.phase]}</div>
                  <input
                    style={{ ...IN, padding: '4px', fontSize: 11, textAlign: 'center', minHeight: 30, marginTop: 2 }}
                    type="number" min={1} max={52}
                    value={editWeeks[b.phase] ?? b.weeks}
                    onChange={e => setEditWeeks(prev => ({ ...prev, [b.phase]: +e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <button onClick={applyEdit} style={{ ...BTN_GHOST, fontSize: 11, padding: '6px 12px', minHeight: 32, marginTop: 6 }}>Пересчитать</button>
          </div>

          {/* Rationale */}
          <div style={{ marginTop: 12, padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>Обоснование:</div>
            {macro.rationale.map((r, i) => <div key={i} style={{ ...SMALL, fontSize: 10 }}>• {r}</div>)}
          </div>
        </div>
      )}
    </div>
  );
};

export default MacrocyclePanel;