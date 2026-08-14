/**
 * MacrocyclePanel.tsx — годовое планирование ПЛ-авто (Этап T0 UI).
 * Таймлайн 5 фаз года (endurance→strength→peak→competition→transition),
 * выбор недели соревнований, клик по блоку → применить активный цикл.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildMacrocycle, buildMacrocycleMulti, rebalanceMacrocycle, macrocycleToActiveCycle,
  serializeMacro, deserializeMacro, estimateCompetitionWeek,
  buildBbMacrocycle, rebalanceBbMacrocycle, serializeBbMacro, deserializeBbMacro,
  PHASE_COLOR, PHASE_LABEL_RU, BB_PHASE_COLOR, BB_PHASE_LABEL_RU, BB_PHASE_ICON,
  type Macrocycle, type MacroBlock, type MacroPhase, type MacroInput, type BBMacrocycle, type BBMacroBlock, type BBMacroPhase, type CompetitionEvent,
} from '../../../engines/lms/macrocycle.engine';
import type { BBTrainingFocus } from '../../../engines/bb/bb-goal-types';
import { getCycleById, LMS_CYCLES, normalizeCycleDirection } from '../../../data/lms-cycles/lms-cycle-index';
import { CARD, SMALL, H, IN, BTN, BTN_GHOST } from '../TrainingScreen_parts/training-ui';
import { PL_PHASE_VISUAL, BB_PHASE_VISUAL, COMPETITION_PRIORITY_VISUAL } from '../TrainingScreen_parts/phase-visual-tokens';

const SEL: React.CSSProperties = { ...IN, minHeight: 44 };
const LABEL: React.CSSProperties = { ...SMALL, fontSize: 11, margin: '4px 0 2px' };

const PL_PHASES: MacroPhase[] = ['endurance', 'strength', 'peak', 'competition', 'transition'];
const BB_PHASES: BBMacroPhase[] = ['hypertrophy', 'strength', 'contest_prep', 'transition'];
const PHASE_ICON: Record<MacroPhase, string> = {
  endurance: '🏃', strength: '🏋️', peak: '⛰️', competition: '🏁', transition: '🧘',
};
const PL_VISUAL = PL_PHASE_VISUAL as Record<MacroPhase, { color: string; icon: string; label: string }>;
const BB_VISUAL = BB_PHASE_VISUAL as Record<BBMacroPhase, { color: string; icon: string; label: string }>;

const STORAGE_KEY = 'he_pl_macro';
const BB_STORAGE_KEY = 'he_bb_macro';
const UI_PREFS_KEY = 'he_macrocycle_ui_prefs';
const SCHEMA_VERSION = 2;

interface MacrocycleUiPrefs {
  density: 'comfortable' | 'compact';
  contrast: 'normal' | 'high';
  showIcons: boolean;
}

const DEFAULT_UI_PREFS: MacrocycleUiPrefs = { density: 'comfortable', contrast: 'normal', showIcons: true };

export function normalizeMacrocycleUiPrefs(value: unknown): MacrocycleUiPrefs {
  const parsed = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    density: parsed.density === 'compact' ? 'compact' : DEFAULT_UI_PREFS.density,
    contrast: parsed.contrast === 'high' ? 'high' : DEFAULT_UI_PREFS.contrast,
    showIcons: parsed.showIcons !== false,
  };
}

function loadUiPrefs(): MacrocycleUiPrefs {
  try {
    const parsed = JSON.parse(localStorage.getItem(UI_PREFS_KEY) || 'null');
    return normalizeMacrocycleUiPrefs(parsed);
  } catch { return DEFAULT_UI_PREFS; }
}

/** Миграция storage: v1 → v2 (добавлен kind в массив блоков). */
function migrateStorage(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    if (!o || !Array.isArray(o.b)) return raw; // не наш формат
    // Проверить, есть ли уже kind в блоках (v2+). Если нет — мигрировать.
    let migrated = false;
    const b = o.b.map((block: any) => {
      const next = Array.isArray(block) ? [...block] : block;
      if (Array.isArray(next) && (!next[3] || (next[3] !== 'SRC' && next[3] !== 'BB'))) {
        // v1: kind отсутствует или невалиден → default 'SRC'
        next[3] = 'SRC';
        migrated = true;
      }
      return next;
    });
    if (migrated) {
      // Не понижать уже мигрированную запись v3-v6 до v2: десериализатор
      // поддерживает все эти версии, а новые поля должны сохраниться.
      const version = Number.isInteger(o.v) && o.v >= SCHEMA_VERSION ? o.v : SCHEMA_VERSION;
      const updated = JSON.stringify({ ...o, b, v: version });
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
  onApplyMacrocycle?: (macro: Macrocycle | BBMacrocycle) => void;
  /** Опционально: callback при изменении level (для редактируемого селектора). */
  onLevelChange?: (level: string) => void;
  /** Опционально: callback при изменении goal (для редактируемого селектора). */
  onGoalChange?: (goal: 'powerlifting' | 'bodybuilding' | 'general') => void;
  /** MC-4: Storage key для изоляции storage контекстов (по умолчанию he_pl_macro / he_bb_macro). */
  storageKey?: string;
}

export const MacrocyclePanel: React.FC<Props> = ({ level, goal, onApplyCycle, onApplyMacrocycle, onLevelChange, onGoalChange, storageKey }) => {
  // Локальные редактируемые значения (если onLevelChange/onGoalChange не переданы — селекторы disabled)
  const [localLevel, setLocalLevel] = useState<string>(level);
  const [localGoal, setLocalGoal] = useState<'powerlifting' | 'bodybuilding' | 'general'>(goal);
  const effLevel = onLevelChange ? level : localLevel;
  const effGoal = onGoalChange ? goal : localGoal;
  const isBB = effGoal === 'bodybuilding';
  // MC-4: use storageKey prop for isolation (default to STORAGE_KEY/BB_STORAGE_KEY)
  const plKey = storageKey ?? STORAGE_KEY;
  const bbKey = isBB ? (storageKey ?? BB_STORAGE_KEY) : BB_STORAGE_KEY;
  const [macro, setMacro] = useState<Macrocycle | null>(() => {
    try {
      const raw = localStorage.getItem(plKey);
      const migrated = migrateStorage(raw);
      return migrated ? deserializeMacro(migrated) : null;
    } catch { return null; }
  });
  const [bbMacro, setBbMacro] = useState<BBMacrocycle | null>(() => {
    try {
      const raw = localStorage.getItem(bbKey);
      return raw ? deserializeBbMacro(raw) : null;
    } catch { return null; }
  });
  const macroSerializedRef = useRef<string | null>(null);
  const bbSerializedRef = useRef<string | null>(null);
  const [compWeek, setCompWeek] = useState<number>(macro?.competitionWeek ?? 44);
  const [totalWeeks, setTotalWeeks] = useState<number>(macro?.totalWeeks ?? 52);
  const [trainingFocus, setTrainingFocus] = useState<BBTrainingFocus>('hypertrophy');
  const [selectedBlockIdx, setSelectedBlockIdx] = useState<number>(-1);
  const [editWeeks, setEditWeeks] = useState<Record<string, number>>({});
  // Явное сохранение: кратковременный флеш «Сохранено» (автосохранение уже есть).
  const [macroSavedFlash, setMacroSavedFlash] = useState(false);
  // Маркер текущей недели (1-индекс). По умолчанию неделя 1 = "сегодня" (начало макро).
  const [currentWeekIdx, setCurrentWeekIdx] = useState<number>(1);
  // Несколько соревнований: восстанавливаем из macro.competitions (если есть) или одиночное compWeek.
  const [competitions, setCompetitions] = useState<CompetitionEvent[]>(macro?.competitions ?? bbMacro?.competitions ?? []);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [uiPrefs, setUiPrefs] = useState<MacrocycleUiPrefs>(loadUiPrefs);
  const [showUiPrefs, setShowUiPrefs] = useState(false);
  const [activePopup, setActivePopup] = useState<'level' | 'goal' | 'duration' | 'focus' | 'competition' | null>(null);
  const isCompact = uiPrefs.density === 'compact';
  const isHighContrast = uiPrefs.contrast === 'high';
  const cardStyle = { ...CARD, padding: isCompact ? 8 : 12 };
  const levelOptions = ['beginner', 'novice', 'III-KMS', 'II-KMS', 'I-KMS', 'MS', 'intermediate', 'advanced', 'enhanced'];
  const levelLabel = effLevel || 'Не выбран';
  const goalLabel = effGoal === 'powerlifting' ? 'Пауэрлифтинг' : effGoal === 'bodybuilding' ? 'Бодибилдинг' : 'Общее';
  const focusLabel = trainingFocus === 'strength' ? 'Сила' : trainingFocus === 'endurance' ? 'Выносливость' : 'Гипертрофия';
  useEffect(() => {
    // The panel can stay mounted while the user switches PL/BB. Reload the
    // matching persisted plan instead of keeping the previous direction's state.
    try {
      if (isBB) {
        const raw = localStorage.getItem(bbKey);
        const restored = raw ? deserializeBbMacro(raw) : null;
        setBbMacro(restored);
        setTotalWeeks(restored?.totalWeeks ?? 52);
        setTrainingFocus(restored?.trainingFocus ?? 'hypertrophy');
        setCompetitions(restored?.competitions ?? []);
      } else {
        const raw = localStorage.getItem(plKey);
        const migrated = migrateStorage(raw);
        const restored = migrated ? deserializeMacro(migrated) : null;
        setMacro(restored);
        setTotalWeeks(restored?.totalWeeks ?? 52);
        setCompWeek(restored?.competitionWeek ?? 44);
        setCompetitions(restored?.competitions ?? []);
      }
      setSelectedBlockIdx(-1);
      setEditWeeks({});
    } catch {
      setMacro(null);
      setBbMacro(null);
    }
  }, [isBB, plKey, bbKey]);

  useEffect(() => {
    try { localStorage.setItem(UI_PREFS_KEY, JSON.stringify(uiPrefs)); } catch { /* ignore */ }
  }, [uiPrefs]);
  useEffect(() => {
    if (isBB && bbMacro) {
      setTrainingFocus(bbMacro.trainingFocus);
      setTotalWeeks(bbMacro.totalWeeks);
      setCompetitions(bbMacro.competitions ?? []);
    }
  }, [bbMacro, isBB]);
  const competitionValidation = useMemo(() => {
    const seen = new Set<number>();
    let mainCount = 0;
    for (const competition of competitions) {
      if (!competition.name.trim()) return 'Укажите название каждого соревнования.';
      if (!Number.isFinite(competition.week) || competition.week < 1 || competition.week > totalWeeks) {
        return 'Неделя соревнования должна быть внутри макроцикла.';
      }
      if (seen.has(competition.week)) return 'Нельзя назначить два соревнования на одну неделю.';
      seen.add(competition.week);
      if (competition.priority === 'A') mainCount += 1;
    }
    if (mainCount > 1) return 'Можно назначить только одно главное соревнование (приоритет A).';
    return null;
  }, [competitions, totalWeeks]);

  useEffect(() => {
    if (macro && !isBB) {
      try {
        const serialized = serializeMacro(macro);
        macroSerializedRef.current = serialized;
        localStorage.setItem(plKey, serialized);
        window.dispatchEvent(new CustomEvent('he-pl-macrocycle-updated', { detail: serialized }));
      } catch { /* ignore */ }
    }
  }, [macro, isBB, plKey]);
  useEffect(() => {
    if (bbMacro && isBB) {
      try {
        const serialized = serializeBbMacro(bbMacro);
        bbSerializedRef.current = serialized;
        localStorage.setItem(bbKey, serialized);
        window.dispatchEvent(new CustomEvent('he-bb-macrocycle-updated', { detail: serialized }));
      } catch { /* ignore */ }
    }
  }, [bbMacro, isBB, bbKey]);

  useEffect(() => {
    const sync = (raw?: string | null) => {
      const serialized = raw ?? localStorage.getItem(plKey);
      if (!serialized) return;
      if (serialized === macroSerializedRef.current) return;
      const restored = deserializeMacro(serialized);
      if (!restored) return;
      if (isBB) return;
      setMacro(restored);
      setTotalWeeks(restored.totalWeeks);
      setCompWeek(restored.competitionWeek ?? 44);
      setCompetitions(restored.competitions ?? []);
      setSelectedBlockIdx(-1);
      setEditWeeks({});
    };
    const syncBb = (raw?: string | null) => {
      const serialized = raw ?? localStorage.getItem(bbKey);
      if (!serialized || serialized === bbSerializedRef.current) return;
      const restored = deserializeBbMacro(serialized);
      if (!restored || !isBB) return;
      setBbMacro(restored);
      setTotalWeeks(restored.totalWeeks);
      setTrainingFocus(restored.trainingFocus);
      setCompetitions(restored.competitions ?? []);
      setSelectedBlockIdx(-1);
      setEditWeeks({});
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === plKey) sync(event.newValue);
      if (event.key === bbKey) syncBb(event.newValue);
    };
    const onMacroUpdated = (event: Event) => {
      sync((event as CustomEvent<string>).detail);
    };
    const onBbMacroUpdated = (event: Event) => {
      syncBb((event as CustomEvent<string>).detail);
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('he-pl-macrocycle-updated', onMacroUpdated);
    window.addEventListener('he-bb-macrocycle-updated', onBbMacroUpdated);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('he-pl-macrocycle-updated', onMacroUpdated);
      window.removeEventListener('he-bb-macrocycle-updated', onBbMacroUpdated);
    };
  }, [isBB, plKey, bbKey]);

  const build = () => {
    if (competitionValidation) {
      setBuildError(competitionValidation);
      return;
    }
    try {
      if (isBB) {
        const m = buildBbMacrocycle({
          level: effLevel, totalWeeks,
          competitions: competitions.length > 0 ? competitions : undefined,
          trainingFocus,
        });
        setBbMacro(m);
      } else if (competitions.length > 0) {
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
      setCurrentWeekIdx(1);
    } catch (error) {
      setBuildError((error as Error).message || 'Не удалось построить макроцикл.');
    }
  };

  const applyEdit = () => {
    if (isBB && bbMacro) {
      setBbMacro(rebalanceBbMacrocycle(bbMacro, editWeeks));
      setEditWeeks({});
      return;
    }
    if (!macro) return;
    const edits = PL_PHASES.map((phase: MacroPhase) => ({
      phase,
      weeks: editWeeks[phase] ?? macro.blocks.filter(block => block.phase === phase).reduce((sum, block) => sum + block.weeks, 0),
    })).filter(edit => edit.weeks > 0);
    setMacro(rebalanceMacrocycle(macro, edits));
  };

  const applyBlock = (idx: number) => {
    if (isBB && bbMacro) {
      onApplyMacrocycle?.(bbMacro);
      return;
    }
    if (!macro) return;
    const block = macro.blocks[idx];
    if (!block || !block.cycleId) return;
    onApplyCycle(block.cycleId, block.weeks);
  };

  const activeBlock = useMemo(() => {
    const src = isBB ? bbMacro : macro;
    if (!src) return null;
    if (selectedBlockIdx >= 0) return src.blocks[selectedBlockIdx] ?? null;
    return null;
  }, [macro, bbMacro, selectedBlockIdx, isBB]);

  return (
    <div className="macrocycle-panel" style={{ '--macro-card-border': isHighContrast ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.04)' } as React.CSSProperties}>
      {/* Параметры */}
      <div style={{ ...cardStyle, borderColor: isHighContrast ? 'rgba(255,255,255,0.14)' : 'var(--glass-border, rgba(255,255,255,0.09))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div style={H}>🗓 Годовое планирование {isBB ? 'ББ' : 'ПЛ'}</div>
          <button type="button" onClick={() => setShowUiPrefs(value => !value)} style={{ ...BTN_GHOST, minHeight: 44, padding: '5px 8px', fontSize: 10 }} aria-expanded={showUiPrefs}>
            ⚙ Вид
          </button>
        </div>
        {showUiPrefs && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 6, marginBottom: 8, padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <label style={LABEL}>Плотность
              <select style={{ ...SEL, minHeight: 44, marginTop: 2 }} value={uiPrefs.density} onChange={e => setUiPrefs(prev => ({ ...prev, density: e.target.value as MacrocycleUiPrefs['density'] }))}>
                <option value="comfortable">Комфортная</option>
                <option value="compact">Компактная</option>
              </select>
            </label>
            <label style={LABEL}>Контраст
              <select style={{ ...SEL, minHeight: 44, marginTop: 2 }} value={uiPrefs.contrast} onChange={e => setUiPrefs(prev => ({ ...prev, contrast: e.target.value as MacrocycleUiPrefs['contrast'] }))}>
                <option value="normal">Обычный</option>
                <option value="high">Высокий</option>
              </select>
            </label>
            <label style={{ ...LABEL, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={uiPrefs.showIcons} onChange={e => setUiPrefs(prev => ({ ...prev, showIcons: e.target.checked }))} /> Иконки фаз
            </label>
          </div>
        )}
        <div style={{ ...SMALL, marginBottom: 8 }}>{isBB
          ? 'Последовательность фаз ББ: гипертрофия → сила → contest prep → переход. Клик по блоку → применить макроцикл.'
          : 'Последовательность фаз ПЛ: выносливость → силовой → выход на пик → соревнования → переход. Клик по блоку → применить цикл.'}</div>
        <div className="macrocycle-control-cards">
          <button type="button" className="macrocycle-control-card" onClick={() => setActivePopup('level')}>
            <span>🎓 Уровень спортсмена</span><strong>{levelLabel}</strong><small>Изменить</small>
          </button>
          <button type="button" className="macrocycle-control-card" onClick={() => setActivePopup('goal')}>
            <span>🎯 Направление</span><strong>{goalLabel}</strong><small>Изменить</small>
          </button>
          <button type="button" className="macrocycle-control-card" onClick={() => setActivePopup('duration')}>
            <span>🗓 Горизонт</span><strong>{totalWeeks} недель</strong><small>Ввести значение</small>
          </button>
          {isBB && <button type="button" className="macrocycle-control-card" onClick={() => setActivePopup('focus')}>
            <span>💪 Фокус ББ</span><strong>{focusLabel}</strong><small>Изменить</small>
          </button>}
        </div>
        {activePopup && (
          <div className="macrocycle-control-popup" role="dialog" aria-label="Настройка параметра">
            <div className="macrocycle-control-popup__header">
              <strong>{activePopup === 'level' ? '🎓 Уровень спортсмена' : activePopup === 'goal' ? '🎯 Направление' : activePopup === 'duration' ? '🗓 Горизонт планирования' : '💪 Фокус ББ'}</strong>
              <button type="button" aria-label="Закрыть" onClick={() => setActivePopup(null)}>✕</button>
            </div>
            {activePopup === 'level' && <div className="macrocycle-popup-options">
              {levelOptions.map(option => <button type="button" key={option} className={option === effLevel ? 'is-active' : ''} onClick={() => { onLevelChange?.(option); setLocalLevel(option); setActivePopup(null); }}>{option}</button>)}
            </div>}
            {activePopup === 'goal' && <div className="macrocycle-popup-options">
              {(['powerlifting', 'bodybuilding', 'general'] as const).map(option => <button type="button" key={option} className={option === effGoal ? 'is-active' : ''} onClick={() => {
                const v = option;
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
                setActivePopup(null);
              }}>{option === 'powerlifting' ? 'Пауэрлифтинг' : option === 'bodybuilding' ? 'Бодибилдинг' : 'Общее'}</button>)}
            </div>}
            {activePopup === 'duration' && <label className="macrocycle-popup-input">Недель (12–104)
              <input autoFocus type="number" min={12} max={104} value={totalWeeks} onChange={e => { const value = Number(e.target.value); if (Number.isFinite(value)) setTotalWeeks(Math.max(12, Math.min(104, Math.round(value)))); }} />
              <button type="button" onClick={() => setActivePopup(null)}>Готово</button>
            </label>}
            {activePopup === 'focus' && <div className="macrocycle-popup-options">
              {(['hypertrophy', 'strength', 'endurance'] as BBTrainingFocus[]).map(option => <button type="button" key={option} className={option === trainingFocus ? 'is-active' : ''} onClick={() => { setTrainingFocus(option); setActivePopup(null); }}>{option === 'hypertrophy' ? 'Гипертрофия' : option === 'strength' ? 'Сила' : 'Выносливость / детализация'}</button>)}
            </div>}
          </div>
        )}

        {/* Менеджер соревнований (несколько) */}
        <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>🏁 Соревнования ({competitions.length})</span>
            <button
               onClick={() => {
                 const newId = 'comp_' + Date.now().toString(36);
                 const usedWeeks = new Set(competitions.map(competition => competition.week));
                  const lastCompetitionWeek = competitions.reduce(
                    (latest, competition) => Math.max(latest, competition.week),
                    compWeek,
                  );
                  const preferredWeek = Math.min(totalWeeks, lastCompetitionWeek + 8);
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
               style={{ ...BTN_GHOST, padding: '4px 10px', fontSize: 10, minHeight: 44 }}
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
                <input aria-label="Неделя главного соревнования" style={IN} type="number" min={1} max={totalWeeks} value={compWeek} onChange={e => {
                 const value = Number(e.target.value);
                 setCompWeek(Number.isFinite(value) ? Math.max(1, Math.min(totalWeeks, Math.round(value))) : 1);
               }} />
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
              <div className="macrocycle-competition-row" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 50px 60px 28px', gap: 4, marginBottom: 3, alignItems: 'center' }}>
                <input aria-label="Название соревнования" style={{ ...IN, padding: '4px 8px', fontSize: 10, minHeight: 44 }}
                  value={c.name} placeholder="Название"
                  onChange={e => setCompetitions(competitions.map((cc, j) => j === i ? { ...cc, name: e.target.value } : cc))} />
                <input aria-label={`Неделя соревнования ${c.name}`} style={{ ...IN, padding: '4px', fontSize: 10, minHeight: 44, textAlign: 'center' }}
                  type="number" min={1} max={totalWeeks} value={c.week} title="Неделя"
                  onChange={e => setCompetitions(competitions.map((cc, j) => j === i ? { ...cc, week: Math.max(1, Math.min(totalWeeks, +e.target.value || 1)) } : cc))} />
                <select aria-label={`Приоритет соревнования ${c.name}`} style={{ ...IN, padding: '4px', fontSize: 10, minHeight: 44 }}
                  value={c.priority} title="Приоритет"
                  onChange={e => setCompetitions(competitions.map((cc, j) => j === i ? { ...cc, priority: e.target.value as CompetitionEvent['priority'] } : cc))}>
                  <option value="A">A — главное</option>
                  <option value="B">B — контрольное</option>
                  <option value="C">C — тренировочное</option>
                </select>
                <button aria-label={`Удалить соревнование ${c.name}`} onClick={() => setCompetitions(competitions.filter((_, j) => j !== i))}
                  style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: 14, padding: 4, minHeight: 44, minWidth: 44 }}
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
                       style={{ ...BTN_GHOST, padding: '2px 6px', fontSize: 9, minHeight: 44, lineHeight: 1 }}
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
                             style={{ ...IN, padding: '3px 6px', fontSize: 9, minHeight: 44, flex: 1 }}
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
                               style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: 11, padding: 2, minHeight: 44, minWidth: 44, lineHeight: 1 }}
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

        <div className="macrocycle-actions" style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button onClick={build} style={BTN}>Построить макроцикл</button>
          {(isBB ? bbMacro : macro) && <button onClick={() => { if (isBB) { setBbMacro(null); try { localStorage.removeItem(bbKey); } catch {} } else { setMacro(null); try { localStorage.removeItem(plKey); } catch {} } }} style={BTN_GHOST}>Сбросить</button>}
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
      {(isBB ? bbMacro : macro) && (
        <div style={CARD}>
          <div style={H}>📅 Таймлайн ({(isBB ? bbMacro!.totalWeeks : macro!.totalWeeks)} нед)</div>
          {/* Горизонтальная полоса с блоками + маркер текущей недели */}
          <div className="macrocycle-timeline-scroll" style={{ borderRadius: 8, overflowX: 'auto', overflowY: 'hidden', border: `1px solid ${isHighContrast ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)'}`, marginBottom: 8, minWidth: 0 }}>
           <div className="macrocycle-timeline-track" style={{ display: 'flex', height: isCompact ? 48 : 64, position: 'relative', minWidth: Math.max(100, (isBB ? bbMacro!.totalWeeks : macro!.totalWeeks) * 56) }}>
            {(isBB ? bbMacro!.blocks : macro!.blocks).map((b: MacroBlock | BBMacroBlock, i: number) => {
              const src = isBB ? bbMacro! : macro!;
              const pct = (b.weeks / src.totalWeeks) * 100;
              const isSel = selectedBlockIdx === i;
              const isCompBlock = b.phase === 'competition' || b.phase === 'contest_prep';
              const compForThisBlock = isCompBlock && b.competitionId
                ? src.competitions?.find(c => c.id === b.competitionId)
                : undefined;
              const isCompWeek = 'competitionWeek' in src && src.competitionWeek != null && src.competitionWeek >= b.weekOffset && src.competitionWeek < b.weekOffset + b.weeks;
              const isComp = isCompBlock || isCompWeek;
               const phaseVisual = isBB ? BB_VISUAL[b.phase as BBMacroPhase] : PL_VISUAL[b.phase as MacroPhase];
               const phaseColor = phaseVisual?.color ?? (isBB ? BB_PHASE_COLOR[b.phase as BBMacroPhase] : PHASE_COLOR[b.phase as MacroPhase]) ?? '#888';
               const phaseLabel = phaseVisual?.label ?? (isBB ? BB_PHASE_LABEL_RU[b.phase as BBMacroPhase] : PHASE_LABEL_RU[b.phase as MacroPhase]) ?? b.phase;
               const phaseIcon = phaseVisual?.icon ?? (isBB ? BB_PHASE_ICON[b.phase as BBMacroPhase] : PHASE_ICON[b.phase as MacroPhase]) ?? '';
              return (
                <div
                  key={i}
                  onClick={() => setSelectedBlockIdx(i)}
                  role="button"
                  tabIndex={0}
                  aria-label={`${phaseLabel}: недели ${b.weekOffset}-${b.weekOffset + b.weeks - 1}`}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedBlockIdx(i);
                    }
                  }}
                  style={{
                    flex: `0 0 ${pct}%`,
                   background: phaseColor + (isSel ? 'cc' : (isHighContrast ? '70' : '44')),
                    borderRight: '1px solid rgba(0,0,0,0.2)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2px 4px',
                    position: 'relative',
                  }}
                  title={`${phaseLabel}: нед ${b.weekOffset}-${b.weekOffset + b.weeks - 1}${compForThisBlock ? ' · 🏁 ' + compForThisBlock.name : ''}`}
                >
                   {uiPrefs.showIcons && <span style={{ fontSize: isCompact ? 13 : 16 }}>{phaseIcon}</span>}
                    <span style={{ fontSize: 9, fontWeight: 700, color: isSel ? 'var(--accent-contrast, #06281c)' : 'var(--text, #fff)', textAlign: 'center', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{phaseLabel}</span>
                   <span style={{ fontSize: 8, color: isSel ? 'var(--accent-contrast, #06281c)' : 'var(--text-dim, rgba(255,255,255,0.7))' }}>{b.weeks}н</span>
                     {isComp && <span aria-label={compForThisBlock ? `Соревнование ${compForThisBlock.name}, приоритет ${compForThisBlock.priority}` : 'Соревновательный блок'} className="macrocycle-competition-badge" style={{ position: 'absolute', top: 2, right: 3, fontSize: 10, lineHeight: 1, color: compForThisBlock ? COMPETITION_PRIORITY_VISUAL[compForThisBlock.priority].color : '#ef4444' }} title={compForThisBlock?.name}>{compForThisBlock ? COMPETITION_PRIORITY_VISUAL[compForThisBlock.priority].icon : '🏁'}<b>{compForThisBlock?.priority ?? ''}</b></span>}
                 </div>
               );
             })}
            {/* Маркер текущей недели (неделя 1 = "сегодня", начало макроцикла).
                Показывает вертикальную линию на позиции currentWeekIdx. */}
            {currentWeekIdx >= 1 && currentWeekIdx <= (isBB ? bbMacro!.totalWeeks : macro!.totalWeeks) && (() => {
              const src = isBB ? bbMacro! : macro!;
              const posPct = ((currentWeekIdx - 1) / src.totalWeeks) * 100;
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
          </div>

          {/* Линейка недель — выровнена по границам блоков */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-dim, rgba(255,255,255,0.4))', marginBottom: 8 }}>
            {(() => {
              const src = isBB ? bbMacro! : macro!;
              const total = src.totalWeeks;
              const ticks = [1, Math.ceil(total / 4), Math.ceil(total / 2), Math.ceil(total * 3 / 4), total];
              return ticks.map((t, i) => <span key={i}>Нед {t}</span>);
            })()}
          </div>
          {/* Маркер текущей недели — редактор */}
          <div className="macrocycle-current-week" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>
            <span>📍 Текущая неделя:</span>
             <input aria-label="Текущая неделя макроцикла" style={{ ...IN, padding: '3px 6px', fontSize: 11, width: 60, minHeight: 44, textAlign: 'center' }}
              type="number" min={1} max={(isBB ? bbMacro!.totalWeeks : macro!.totalWeeks)}
              value={currentWeekIdx}
               onChange={e => setCurrentWeekIdx(Math.max(1, Math.min(isBB ? (bbMacro?.totalWeeks ?? 1) : (macro?.totalWeeks ?? 1), +e.target.value || 1)))} />
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>(маркер на таймлайне)</span>
          </div>

          {/* Обзор соревнований (если есть) */}
          {(isBB ? bbMacro!.competitions : macro!.competitions) && (isBB ? bbMacro!.competitions!.length : macro!.competitions!.length) > 0 && (
            <div style={{ marginBottom: 10, padding: 8, borderRadius: 8, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', marginBottom: 4 }}>🏁 Соревнования в макроцикле:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {[...(isBB ? bbMacro!.competitions : macro!.competitions)!].sort((a, b) => a.week - b.week).map(c => {
                  const src = isBB ? bbMacro! : macro!;
                  const block = src.blocks.find(b => b.competitionId === c.id && b.phase === (isBB ? 'contest_prep' : 'competition'));
                  const priorityColor = c.priority === 'A' ? '#ef4444' : c.priority === 'B' ? '#f59e0b' : '#a78bfa';
                  return (
                      <div key={c.id} aria-label={`${c.name}, неделя ${c.week}, приоритет ${c.priority}`} className="macrocycle-competition-summary-row" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--text-light, rgba(255,255,255,0.8))' }}>
                       <span style={{ color: priorityColor, fontWeight: 700 }}>{c.priority === 'A' ? '🔴' : c.priority === 'B' ? '🟡' : '🟣'} [{c.priority}]</span>
                      <span style={{ fontWeight: 600 }}>{c.name}</span>
                      <span style={{ color: 'rgba(255,255,255,0.5)' }}>· нед {c.week}{block ? ` (блок ${block.weekOffset})` : ''}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Детали выбранного блока */}
          {activeBlock && (() => {
            const abColor = isBB ? (BB_PHASE_COLOR[activeBlock.phase as BBMacroPhase] ?? '#888') : PHASE_COLOR[activeBlock.phase as MacroPhase];
            const abIcon = isBB ? (BB_PHASE_ICON[activeBlock.phase as BBMacroPhase] ?? '') : PHASE_ICON[activeBlock.phase as MacroPhase];
            const abLabel = isBB ? (BB_PHASE_LABEL_RU[activeBlock.phase as BBMacroPhase] ?? '') : PHASE_LABEL_RU[activeBlock.phase as MacroPhase];
            return (
             <div className="macrocycle-active-block" style={{ padding: 10, borderRadius: 8, background: abColor + '15', border: `1px solid ${abColor}40`, marginBottom: 8 }}>
               <div className="macrocycle-active-block__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                 <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-light, #fff)', borderLeft: `3px solid ${abColor}`, paddingLeft: 6 }}>{abIcon} {abLabel}</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Нед {activeBlock.weekOffset}–{activeBlock.weekOffset + activeBlock.weeks - 1} ({activeBlock.weeks} нед)</span>
              </div>
              <div className="macrocycle-active-block__description" style={{ ...SMALL, marginBottom: 6 }}>{activeBlock.description}</div>
              {'cycleId' in activeBlock && activeBlock.cycleId && (() => {
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
              {'cycleId' in activeBlock && activeBlock.cycleId && (
                <button onClick={() => applyBlock(selectedBlockIdx)} style={{ ...BTN, fontSize: 11, padding: '8px 12px', minHeight: 44 }}>
                  ✓ Применить как активный цикл
                </button>
              )}
            </div>
            );
          })()}

          {onApplyMacrocycle && (isBB ? bbMacro : macro) && (
            <button onClick={() => { const source = isBB ? bbMacro : macro; if (source) onApplyMacrocycle(source); }} style={{ ...BTN_GHOST, fontSize: 11, padding: '8px 12px', minHeight: 44, marginTop: 6, width: '100%' }}>
              🗓 Применить весь макроцикл
            </button>
          )}

          {/* Действия годового плана: явное сохранение + «Начать работу по циклу» */}
          {(isBB ? bbMacro : macro) && (
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button
                onClick={() => {
                  try {
                    if (isBB && bbMacro) { localStorage.setItem(bbKey, serializeBbMacro(bbMacro)); }
                    else if (macro) { localStorage.setItem(plKey, serializeMacro(macro)); }
                    setMacroSavedFlash(true);
                    window.setTimeout(() => setMacroSavedFlash(false), 2000);
                  } catch { /* ignore */ }
                }}
                style={{ ...BTN_GHOST, flex: 1, fontSize: 11, padding: '8px 12px', minHeight: 44 }}
              >
                {macroSavedFlash ? '✅ Сохранено' : '💾 Сохранить'}
              </button>
              <button
                onClick={() => {
                  const source = isBB ? bbMacro : macro;
                  if (!source) return;
                  if (onApplyMacrocycle) onApplyMacrocycle(source);
                  else if (onApplyCycle) onApplyCycle((source as any).blocks?.[0]?.cycleId || '', source.totalWeeks);
                }}
                style={{ ...BTN, flex: 1, fontSize: 11, padding: '8px 12px', minHeight: 44 }}
              >
                ▶️ Начать работу по циклу
              </button>
            </div>
          )}

          {/* Правка длительности фаз */}
           <div className="macrocycle-phase-editor" style={{ marginTop: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>⚙️ Правка длительности фаз</div>
             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(82px, 1fr))', gap: isCompact ? 4 : 6 }}>
              {(isBB ? BB_PHASES : PL_PHASES).map((phase: BBMacroPhase | MacroPhase) => {
                const src = isBB ? bbMacro! : macro!;
                const phaseWeeks = src.blocks.filter(b => b.phase === phase).reduce((sum, b) => sum + b.weeks, 0);
                if (phaseWeeks === 0) return null;
                const pc = isBB ? BB_PHASE_COLOR[phase as BBMacroPhase] : PHASE_COLOR[phase as MacroPhase];
                const pi = isBB ? BB_PHASE_ICON[phase as BBMacroPhase] : PHASE_ICON[phase as MacroPhase];
                const pl = isBB ? BB_PHASE_LABEL_RU[phase as BBMacroPhase] : PHASE_LABEL_RU[phase as MacroPhase];
                return (
                <div key={phase}>
                  <div style={{ fontSize: 9, color: pc, textAlign: 'center', fontWeight: 700 }}>{pi} {pl}</div>
                  <input
                     aria-label={`Длительность фазы ${pl}`}
                     style={{ ...IN, padding: '4px', fontSize: 11, textAlign: 'center', minHeight: 44, marginTop: 2 }}
                     type="number" min={1} max={Math.max(1, src.totalWeeks)} inputMode="numeric"
                    value={editWeeks[phase] ?? phaseWeeks}
                     onChange={e => {
                       const value = Number(e.target.value);
                       if (Number.isFinite(value) && value >= 1) setEditWeeks(prev => ({ ...prev, [phase]: Math.min(src.totalWeeks, Math.round(value)) }));
                     }}
                  />
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>сумма блоков</div>
                </div>
                );
              })}
            </div>
            <button onClick={applyEdit} style={{ ...BTN_GHOST, fontSize: 11, padding: '6px 12px', minHeight: 44, marginTop: 6 }}>Пересчитать</button>
          </div>

          {/* Rationale */}
           <div className="macrocycle-rationale" style={{ marginTop: 12, padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>Обоснование:</div>
            {(isBB ? bbMacro!.rationale : macro!.rationale).map((r, i) => <div key={i} style={{ ...SMALL, fontSize: 10 }}>• {r}</div>)}
          </div>
        </div>
      )}
    </div>
  );
};

export default MacrocyclePanel;
