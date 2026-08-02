/**
 * MacrocyclePanel.tsx — годовое планирование ПЛ-авто (Этап T0 UI).
 * Таймлайн 5 фаз года (endurance→strength→peak→competition→transition),
 * выбор недели соревнований, клик по блоку → применить активный цикл.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildMacrocycle, buildMacrocycleMulti, rebalanceMacrocycle, macrocycleToActiveCycle,
  serializeMacro, deserializeMacro, estimateCompetitionWeek,
  PHASE_COLOR, PHASE_LABEL_RU,
  type Macrocycle, type MacroPhase, type MacroInput, type CompetitionEvent,
} from '../../../engines/lms/macrocycle.engine';
import { getCycleById, LMS_CYCLES, normalizeCycleDirection } from '../../../data/lms-cycles/lms-cycle-index';

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
const SCHEMA_VERSION = 2;

/** Миграция storage: v1 → v2 (добавлен kind в массив блоков). */
function migrateStorage(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    if (!o || !Array.isArray(o.b)) return raw; // не наш формат
    // Проверить, есть ли уже kind в блоках (v2+). Если нет — мигрировать.
    let migrated = false;
    const b = o.b.map((block: any) => {
      if (!block[3] || (block[3] !== 'SRC' && block[3] !== 'BB')) {
        // v1: kind отсутствует или невалиден → default 'SRC'
        block[3] = 'SRC';
        migrated = true;
      }
      return block;
    });
    if (migrated) {
      const updated = JSON.stringify({ ...o, b, v: SCHEMA_VERSION });
      try { localStorage.setItem(STORAGE_KEY, updated); } catch { /* ignore */ }
      return updated;
    }
    return raw;
  } catch { return raw; }
}

interface Props {
  level: string;
  goal: 'powerlifting' | 'bodybuilding' | 'general';
  onApplyCycle: (cycleId: string, weeks: number) => void;
  /** Применить весь макроцикл; если не задан, доступно только применение блока. */
  onApplyMacrocycle?: (macro: Macrocycle) => void;
  /** Опционально: callback при изменении level (для редактируемого селектора). */
  onLevelChange?: (level: string) => void;
  /** Опционально: callback при изменении goal (для редактируемого селектора). */
  onGoalChange?: (goal: 'powerlifting' | 'bodybuilding' | 'general') => void;
}

export const MacrocyclePanel: React.FC<Props> = ({ level, goal, onApplyCycle, onApplyMacrocycle, onLevelChange, onGoalChange }) => {
  // Локальные редактируемые значения (если onLevelChange/onGoalChange не переданы — селекторы disabled)
  const [localLevel, setLocalLevel] = useState<string>(level);
  const [localGoal, setLocalGoal] = useState<'powerlifting' | 'bodybuilding' | 'general'>(goal);
  const effLevel = onLevelChange ? level : localLevel;
  const effGoal = onGoalChange ? goal : localGoal;
  const [macro, setMacro] = useState<Macrocycle | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const migrated = migrateStorage(raw);
      return migrated ? deserializeMacro(migrated) : null;
    } catch { return null; }
  });
  const macroSerializedRef = useRef<string | null>(null);
  const [compWeek, setCompWeek] = useState<number>(macro?.competitionWeek ?? 44);
  const [totalWeeks, setTotalWeeks] = useState<number>(macro?.totalWeeks ?? 52);
  const [selectedBlockIdx, setSelectedBlockIdx] = useState<number>(-1);
  const [editWeeks, setEditWeeks] = useState<Record<string, number>>({});
  // Маркер текущей недели (1-индекс). По умолчанию неделя 1 = "сегодня" (начало макро).
  const [currentWeekIdx, setCurrentWeekIdx] = useState<number>(1);
  // Несколько соревнований: восстанавливаем из macro.competitions (если есть) или одиночное compWeek.
  const [competitions, setCompetitions] = useState<CompetitionEvent[]>(macro?.competitions ?? []);
  const [buildError, setBuildError] = useState<string | null>(null);
  const competitionValidation = useMemo(() => {
    const seen = new Set<number>();
    for (const competition of competitions) {
      if (!Number.isFinite(competition.week) || competition.week < 1 || competition.week > totalWeeks) {
        return 'Неделя соревнования должна быть внутри макроцикла.';
      }
      if (seen.has(competition.week)) return 'Нельзя назначить два соревнования на одну неделю.';
      seen.add(competition.week);
    }
    return null;
  }, [competitions, totalWeeks]);

  useEffect(() => {
    if (macro) {
      try {
        const serialized = serializeMacro(macro);
        macroSerializedRef.current = serialized;
        localStorage.setItem(STORAGE_KEY, serialized);
        window.dispatchEvent(new CustomEvent('he-pl-macrocycle-updated', { detail: serialized }));
      } catch { /* ignore */ }
    }
  }, [macro]);

  useEffect(() => {
    const sync = (raw?: string | null) => {
      const serialized = raw ?? localStorage.getItem(STORAGE_KEY);
      if (!serialized) return;
      if (serialized === macroSerializedRef.current) return;
      const restored = deserializeMacro(serialized);
      if (!restored) return;
      setMacro(restored);
      setTotalWeeks(restored.totalWeeks);
      setCompWeek(restored.competitionWeek ?? 44);
      setCompetitions(restored.competitions ?? []);
      setSelectedBlockIdx(-1);
      setEditWeeks({});
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) sync(event.newValue);
    };
    const onMacroUpdated = (event: Event) => {
      sync((event as CustomEvent<string>).detail);
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('he-pl-macrocycle-updated', onMacroUpdated);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('he-pl-macrocycle-updated', onMacroUpdated);
    };
  }, []);

  const build = () => {
    if (competitionValidation) {
      setBuildError(competitionValidation);
      return;
    }
    try {
      // Если есть список соревнований — мульти-режим, иначе одиночный (обратно-совместимый).
      if (competitions.length > 0) {
        const m = buildMacrocycleMulti(competitions, { level: effLevel, goal: effGoal, totalWeeks });
        setMacro(m);
      } else {
        const input: MacroInput = { level: effLevel, goal: effGoal, competitionWeek: compWeek, totalWeeks };
        const m = buildMacrocycle(input);
        setMacro(m);
      }
      setBuildError(null);
      setSelectedBlockIdx(-1);
      setEditWeeks({});
    } catch (error) {
      setBuildError((error as Error).message || 'Не удалось построить макроцикл.');
    }
  };

  const applyEdit = () => {
    if (!macro) return;
    const edits = PHASES.map(phase => ({
      phase,
      weeks: editWeeks[phase] ?? macro.blocks.filter(block => block.phase === phase).reduce((sum, block) => sum + block.weeks, 0),
    })).filter(edit => edit.weeks > 0);
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
            <select style={SEL} value={effLevel}
              disabled={!onLevelChange}
              onChange={e => {
                if (onLevelChange) onLevelChange(e.target.value);
                else setLocalLevel(e.target.value);
              }}>
              {onLevelChange ? (
                <option value={effLevel}>{effLevel}</option>
              ) : (
                ['beginner', 'novice', 'III-KMS', 'II-KMS', 'I-KMS', 'MS', 'intermediate', 'advanced', 'enhanced'].map(lvl => (
                  <option key={lvl} value={lvl}>{lvl}</option>
                ))
              )}
            </select>
          </div>
          <div>
            <div style={LABEL}>Цель</div>
            <select style={SEL} value={effGoal}
              disabled={!onGoalChange}
              onChange={e => {
                const v = e.target.value as 'powerlifting' | 'bodybuilding' | 'general';
                if (onGoalChange) onGoalChange(v);
                else setLocalGoal(v);
                // Сбросить cycleId/cycleIds в соревнованиях, не подходящих под новое направление.
                const newWantStrength = v === 'powerlifting';
                const newWantBB = v === 'bodybuilding';
                const dropBad = (cid?: string): string | undefined => {
                  if (!cid) return undefined;
                  const cyc = getCycleById(cid);
                  if (!cyc) return undefined;
                  const nd = normalizeCycleDirection(cyc.meta.direction);
                  if (newWantStrength && nd !== 'strength') return undefined;
                  if (newWantBB && nd !== 'bodybuilding') return undefined;
                  return cid;
                };
                setCompetitions(prev => prev.map(comp => {
                  const cleanCycleIds = comp.cycleIds
                    ? (comp.cycleIds.map(dropBad).filter((x): x is string => Boolean(x)))
                    : undefined;
                  const cleanCycleId = cleanCycleIds && cleanCycleIds.length > 0
                    ? cleanCycleIds[0]
                    : dropBad(comp.cycleId);
                  return { ...comp, cycleId: cleanCycleId, cycleIds: cleanCycleIds && cleanCycleIds.length > 0 ? cleanCycleIds : undefined };
                }));
              }}>
              <option value="powerlifting">Пауэрлифтинг</option>
              <option value="bodybuilding">Бодибилдинг</option>
              <option value="general">Общее</option>
            </select>
          </div>
          <div>
            <div style={LABEL}>Длительность, нед</div>
            <input style={IN} type="number" min={12} max={104} value={totalWeeks} onChange={e => setTotalWeeks(+e.target.value)} />
          </div>
        </div>

        {/* Менеджер соревнований (несколько) */}
        <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>🏁 Соревнования ({competitions.length})</span>
            <button
               onClick={() => {
                 const newId = 'comp_' + Date.now().toString(36);
                 const usedWeeks = new Set(competitions.map(competition => competition.week));
                 const preferredWeek = Math.min(totalWeeks, compWeek + competitions.length * 8);
                 const week = Array.from({ length: totalWeeks }, (_, index) => index + 1)
                   .find(candidate => candidate >= preferredWeek && !usedWeeks.has(candidate))
                   ?? Array.from({ length: totalWeeks }, (_, index) => index + 1).find(candidate => !usedWeeks.has(candidate));
                 const newComp: CompetitionEvent = {
                   id: newId,
                   name: 'Соревнование ' + (competitions.length + 1),
                   week: week ?? 1,
                  priority: competitions.length === 0 ? 'A' : 'B',
                };
                setCompetitions([...competitions, newComp]);
              }}
              style={{ ...BTN_GHOST, padding: '4px 10px', fontSize: 10, minHeight: 30 }}
            >+ Добавить</button>
          </div>
          <div style={{ fontSize: 10, color: SMALL.color, marginBottom: 6 }}>
            {competitions.length === 0
              ? 'Одиночный режим: укажите неделю соревнований ниже. Для нескольких — добавьте события (A — главное, B — контрольное, C — тренировочное).'
              : 'A — главное (полный пик), B — контрольное (короткий пик), C — тренировочное (встроено в подготовку).'}
          </div>
          {competitions.length === 0 && (
            <div>
              <div style={LABEL}>Неделя соревнований</div>
              <input style={IN} type="number" min={1} max={totalWeeks} value={compWeek} onChange={e => setCompWeek(+e.target.value)} />
            </div>
          )}
          {competitions.map((c, i) => {
            // Фильтр циклов по направлению: powerlifting → strength, bodybuilding → bodybuilding, general → все.
            const wantStrength = effGoal === 'powerlifting';
            const wantBB = effGoal === 'bodybuilding';
            const filteredCycles = LMS_CYCLES.filter(cyc => {
              const nd = normalizeCycleDirection(cyc.meta.direction);
              if (wantStrength) return nd === 'strength';
              if (wantBB) return nd === 'bodybuilding';
              return true; // general — все
            });
            // Проверка соответствия выбранного цикла уровню
            const selectedCycle = c.cycleId ? getCycleById(c.cycleId) : undefined;
            const levelMismatch = selectedCycle && selectedCycle.meta.level !== effLevel;
            return (
            <div key={c.id}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 50px 60px 28px', gap: 4, marginBottom: 3, alignItems: 'center' }}>
                <input style={{ ...IN, padding: '4px 8px', fontSize: 10, minHeight: 32 }}
                  value={c.name} placeholder="Название"
                  onChange={e => setCompetitions(competitions.map((cc, j) => j === i ? { ...cc, name: e.target.value } : cc))} />
                <input style={{ ...IN, padding: '4px', fontSize: 10, minHeight: 32, textAlign: 'center' }}
                  type="number" min={1} max={totalWeeks} value={c.week} title="Неделя"
                  onChange={e => setCompetitions(competitions.map((cc, j) => j === i ? { ...cc, week: Math.max(1, Math.min(totalWeeks, +e.target.value || 1)) } : cc))} />
                <select style={{ ...IN, padding: '4px', fontSize: 10, minHeight: 32 }}
                  value={c.priority} title="Приоритет"
                  onChange={e => setCompetitions(competitions.map((cc, j) => j === i ? { ...cc, priority: e.target.value as CompetitionEvent['priority'] } : cc))}>
                  <option value="A">A главн</option>
                  <option value="B">B контр</option>
                  <option value="C">C трен</option>
                </select>
                <button onClick={() => setCompetitions(competitions.filter((_, j) => j !== i))}
                  style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: 14, padding: 4, minHeight: 32 }}
                  title="Удалить">✕</button>
              </div>
              {/* Мульти-цикл: список циклов для пика соревнования (только A и B).
                  Пользователь может назначить несколько циклов — пик делится на под-блоки. */}
              {c.priority !== 'C' && (
                <div style={{ marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>
                      Циклы на пик: {((c.cycleIds && c.cycleIds.length > 0) ? c.cycleIds.length : (c.cycleId ? 1 : 0))}
                    </span>
                    <button
                      onClick={() => {
                        // Добавить ещё один цикл (по умолчанию — пустой = автоподбор)
                        const current = c.cycleIds && c.cycleIds.length > 0
                          ? c.cycleIds
                          : (c.cycleId ? [c.cycleId] : []);
                        setCompetitions(competitions.map((cc, j) => j === i ? { ...cc, cycleIds: [...current, ''] } : cc));
                      }}
                      style={{ ...BTN_GHOST, padding: '2px 6px', fontSize: 9, minHeight: 22, lineHeight: 1 }}
                      title="Добавить ещё один цикл на пик"
                    >+ Цикл</button>
                  </div>
                  {(() => {
                    // Список циклов: либо cycleIds[] (новое), либо [cycleId] (legacy) для отображения
                    const list: string[] = c.cycleIds && c.cycleIds.length > 0
                      ? c.cycleIds
                      : (c.cycleId ? [c.cycleId] : []);
                    // Если list пустой — показать один пустой селектор (автоподбор)
                    const display = list.length > 0 ? list : [''];
                    return display.map((cid, k) => {
                      const sel = cid ? getCycleById(cid) : undefined;
                      const mismatch = sel && sel.meta.level !== effLevel;
                      return (
                        <div key={k} style={{ display: 'flex', gap: 4, marginBottom: 3, alignItems: 'center' }}>
                          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', minWidth: 14, textAlign: 'center' }}>{k + 1}.</span>
                          <select
                            style={{ ...IN, padding: '3px 6px', fontSize: 9, minHeight: 26, flex: 1 }}
                            value={cid}
                            onChange={e => {
                              const val = e.target.value;
                              setCompetitions(competitions.map((cc, j) => {
                                if (j !== i) return cc;
                                const cur = cc.cycleIds && cc.cycleIds.length > 0
                                  ? [...cc.cycleIds]
                                  : (cc.cycleId ? [cc.cycleId] : ['']);
                                cur[k] = val;
                                const cleaned = cur.filter((x): x is string => Boolean(x));
                                return { ...cc, cycleIds: cleaned.length > 0 ? cleaned : undefined, cycleId: cleaned[0] };
                              }));
                            }}
                            title={filteredCycles.length === 0 ? 'Нет циклов под выбранное направление' : 'Цикл на под-фазу пика'}
                          >
                            <option value="">Авто</option>
                            {filteredCycles.map(cyc => (
                              <option key={cyc.meta.id} value={cyc.meta.id}>
                                {cyc.meta.title} ({cyc.meta.level}, {cyc.meta.sessionsPerWeek}д/нед, {cyc.meta.weeks}нед)
                              </option>
                            ))}
                          </select>
                          {mismatch && (
                            <span style={{ fontSize: 9, color: '#f59e0b', fontWeight: 700 }}
                              title={`Уровень цикла не совпадает с ${effLevel}`}>⚠</span>
                          )}
                          {display.length > 1 && (
                            <button
                              onClick={() => {
                                setCompetitions(competitions.map((cc, j) => {
                                  if (j !== i) return cc;
                                  const cur = (cc.cycleIds && cc.cycleIds.length > 0 ? [...cc.cycleIds] : (cc.cycleId ? [cc.cycleId] : []));
                                  cur.splice(k, 1);
                                  const cleaned = cur.filter((x): x is string => Boolean(x));
                                  return { ...cc, cycleIds: cleaned.length > 0 ? cleaned : undefined, cycleId: cleaned[0] };
                                }));
                              }}
                              style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: 11, padding: 2, minHeight: 22, lineHeight: 1 }}
                              title="Удалить цикл"
                            >✕</button>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button onClick={build} style={BTN}>Построить макроцикл</button>
          {macro && <button onClick={() => { setMacro(null); try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ } }} style={BTN_GHOST}>Сбросить</button>}
        </div>
        {competitionValidation && (
          <div role="alert" style={{ marginTop: 8, color: '#fca5a5', fontSize: 11 }}>
            ⚠ {competitionValidation}
          </div>
        )}
        {buildError && !competitionValidation && (
          <div role="alert" style={{ marginTop: 8, color: '#fca5a5', fontSize: 11 }}>
            ⚠ {buildError}
          </div>
        )}
      </div>

      {/* Таймлайн */}
      {macro && (
        <div style={CARD}>
          <div style={H}>📅 Таймлайн ({macro.totalWeeks} нед)</div>
          {/* Горизонтальная полоса с блоками + маркер текущей недели */}
          <div style={{ display: 'flex', height: 56, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 8, position: 'relative' }}>
            {macro.blocks.map((b, i) => {
              const pct = (b.weeks / macro.totalWeeks) * 100;
              const isSel = selectedBlockIdx === i;
              // Маркер соревнования: блок является competition-фазой ИЛИ попадает на неделю соревнования.
              const isCompBlock = b.phase === 'competition';
              const compForThisBlock = isCompBlock && b.competitionId
                ? macro.competitions?.find(c => c.id === b.competitionId)
                : undefined;
              const isCompWeek = macro.competitionWeek != null && macro.competitionWeek >= b.weekOffset && macro.competitionWeek < b.weekOffset + b.weeks;
              const isComp = isCompBlock || isCompWeek;
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
                  title={`${PHASE_LABEL_RU[b.phase]}: нед ${b.weekOffset}-${b.weekOffset + b.weeks - 1}${compForThisBlock ? ' · 🏁 ' + compForThisBlock.name : ''}`}
                >
                  <span style={{ fontSize: 16 }}>{PHASE_ICON[b.phase]}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: isSel ? '#000' : '#fff', textAlign: 'center', lineHeight: 1.1 }}>{PHASE_LABEL_RU[b.phase]}</span>
                  <span style={{ fontSize: 8, color: isSel ? '#000' : 'rgba(255,255,255,0.7)' }}>{b.weeks}н</span>
                  {isComp && <span style={{ position: 'absolute', top: 0, right: 2, fontSize: 10 }} title={compForThisBlock?.name}>🏁{compForThisBlock?.priority}</span>}
                </div>
              );
            })}
            {/* Маркер текущей недели (неделя 1 = "сегодня", начало макроцикла).
                Показывает вертикальную линию на позиции currentWeekIdx. */}
            {currentWeekIdx >= 1 && currentWeekIdx <= macro.totalWeeks && (() => {
              const posPct = ((currentWeekIdx - 1) / macro.totalWeeks) * 100;
              return (
                <div style={{
                  position: 'absolute', top: 0, bottom: 0, left: `${posPct}%`, width: 2,
                  background: '#fff', boxShadow: '0 0 4px rgba(255,255,255,0.8)', pointerEvents: 'none', zIndex: 5,
                }} title={`Текущая неделя ${currentWeekIdx}`}>
                  <span style={{ position: 'absolute', top: -14, left: -8, fontSize: 8, color: '#fff', fontWeight: 700, background: 'rgba(0,0,0,0.6)', padding: '1px 3px', borderRadius: 3 }}>●{currentWeekIdx}</span>
                </div>
              );
            })()}
          </div>

          {/* Линейка недель */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>
            <span>Нед 1</span>
            <span>Нед {Math.round(macro.totalWeeks / 4)}</span>
            <span>Нед {Math.round(macro.totalWeeks / 2)}</span>
            <span>Нед {Math.round(macro.totalWeeks * 3 / 4)}</span>
            <span>Нед {macro.totalWeeks}</span>
          </div>
          {/* Маркер текущей недели — редактор */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>
            <span>📍 Текущая неделя:</span>
            <input style={{ ...IN, padding: '3px 6px', fontSize: 11, width: 50, minHeight: 30, textAlign: 'center' }}
              type="number" min={1} max={macro.totalWeeks}
              value={currentWeekIdx}
              onChange={e => setCurrentWeekIdx(Math.max(1, Math.min(macro.totalWeeks, +e.target.value || 1)))} />
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>(маркер на таймлайне)</span>
          </div>

          {/* Обзор соревнований (если есть) */}
          {macro.competitions && macro.competitions.length > 0 && (
            <div style={{ marginBottom: 10, padding: 8, borderRadius: 8, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', marginBottom: 4 }}>🏁 Соревнования в макроцикле:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {macro.competitions.map(c => {
                  const block = macro.blocks.find(b => b.competitionId === c.id && b.phase === 'competition');
                  const priorityColor = c.priority === 'A' ? '#ef4444' : c.priority === 'B' ? '#f59e0b' : '#a78bfa';
                  return (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'rgba(255,255,255,0.8)' }}>
                      <span style={{ color: priorityColor, fontWeight: 700 }}>[{c.priority}]</span>
                      <span style={{ fontWeight: 600 }}>{c.name}</span>
                      <span style={{ color: 'rgba(255,255,255,0.5)' }}>· нед {c.week}{block ? ` (блок ${block.weekOffset})` : ''}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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

          {onApplyMacrocycle && (
            <button onClick={() => onApplyMacrocycle(macro)} style={{ ...BTN_GHOST, fontSize: 11, padding: '8px 12px', minHeight: 34, marginTop: 6, width: '100%' }}>
              🗓 Применить весь макроцикл
            </button>
          )}

          {/* Правка длительности фаз */}
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>⚙️ Правка длительности фаз</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
              {PHASES.map(phase => {
                const phaseWeeks = macro.blocks.filter(block => block.phase === phase).reduce((sum, block) => sum + block.weeks, 0);
                if (phaseWeeks === 0) return null;
                return (
                <div key={phase}>
                  <div style={{ fontSize: 9, color: PHASE_COLOR[phase], textAlign: 'center', fontWeight: 700 }}>{PHASE_ICON[phase]} {PHASE_LABEL_RU[phase]}</div>
                  <input
                    style={{ ...IN, padding: '4px', fontSize: 11, textAlign: 'center', minHeight: 30, marginTop: 2 }}
                    type="number" min={1} max={52}
                    value={editWeeks[phase] ?? phaseWeeks}
                    onChange={e => setEditWeeks(prev => ({ ...prev, [phase]: +e.target.value }))}
                  />
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>сумма блоков</div>
                </div>
                );
              })}
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
