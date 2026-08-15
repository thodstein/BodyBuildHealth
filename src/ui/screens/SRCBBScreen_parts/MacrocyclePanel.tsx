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
  macroWeekStartDate, macroWeekEndDate, weeksUntilWeek, formatMacroDate,
  projectPmGrowthMultiplier, taperWeeksForBlock, moveMacroBlock,
  PHASE_COLOR, PHASE_LABEL_RU, BB_PHASE_COLOR, BB_PHASE_LABEL_RU, BB_PHASE_ICON,
  type Macrocycle, type MacroBlock, type MacroPhase, type MacroInput, type BBMacrocycle, type BBMacroBlock, type BBMacroPhase, type CompetitionEvent,
} from '../../../engines/lms/macrocycle.engine';
import type { BBTrainingFocus } from '../../../engines/bb/bb-goal-types';
import { getCycleById, LMS_CYCLES, normalizeCycleDirection } from '../../../data/lms-cycles/lms-cycle-index';
import { CARD, SMALL, H, IN, BTN, BTN_GHOST } from '../TrainingScreen_parts/training-ui';
import { PL_PHASE_VISUAL, BB_PHASE_VISUAL, COMPETITION_PRIORITY_VISUAL } from '../TrainingScreen_parts/phase-visual-tokens';
import { PopupNumber, PopupSelect } from './TrainingPopups';
import { SPLIT_PATTERNS } from '../../../engines/bb/bb-split-patterns';
import { rankBBSplits } from '../../../engines/bb/bb-selector.engine';
import { applyMacrocycleToBBPlan, type BBPlan } from '../../../engines/bb/bb-builder.engine';
import { applyPeakWeekOverlayToBBPlan, buildBBContestPrep, normalizeContestCategory, isoToday, isoAddDays, PHASE_LABELS_RU, PEAK_PHASE_COLORS, type BBContestPrepConfig, type BBContestPrepResult } from '../../../engines/bb/bb-contest-prep.engine';
import { autodraftBBPlan } from '../../../engines/manual-constructor/manual-draft.engine';
import { createFromBuild } from '../../../engines/user-program/program-store';
import { applyToPlanner } from '../TrainingScreen_parts/planner-bridge';
import { getProfile } from '../../../core/profile-manager';
import { loadSRPESessions } from '../../../engines/pro/srpe-store';
import { toDailyLoads, acuteChronicRatio, type ACWRZone } from '../../../engines/pro/training-load.engine';

/** Маппинг названий категорий профиля → id категорий движка пик-недели. */
const PEAK_CATEGORY_MAP: Record<string, string> = {
  'mens_physique': 'mens_physique', "men's physique": 'mens_physique', 'менс физик': 'mens_physique',
  'classic': 'classic', 'classic physique': 'classic', 'классик': 'classic',
  'bb_212': 'bb_212', '212': 'bb_212',
  'open': 'open', 'open bodybuilding': 'open',
  'bikini': 'bikini', 'бикини': 'bikini',
  'figure': 'figure', 'фигура': 'figure',
  'wellness': 'wellness', 'велнес': 'wellness',
};

export const PEAK_CATEGORY_OPTIONS: { id: string; label: string }[] = [
  { id: 'mens_physique', label: 'Men’s Physique' },
  { id: 'classic', label: 'Classic Physique' },
  { id: 'bb_212', label: '212' },
  { id: 'open', label: 'Open Bodybuilding' },
  { id: 'bikini', label: 'Bikini' },
  { id: 'figure', label: 'Figure' },
  { id: 'wellness', label: 'Wellness' },
];

/** Параметры пик-недели из профиля (вес/пол/категория) с безопасными дефолтами. */
export function profilePeakDefaults(): { weight: number; category: string; sex: 'male' | 'female' } {
  try {
    const settings = getProfile()?.settings as (Record<string, any> | undefined);
    const rawWeight = Number(settings?.personal?.weight);
    const weight = Number.isFinite(rawWeight) && rawWeight > 30 ? rawWeight : 80;
    const sex: 'male' | 'female' = settings?.personal?.sex === 'female' ? 'female' : 'male';
    const rawCat = String(settings?.goals?.bbCategory ?? '').toLowerCase();
    const category = PEAK_CATEGORY_MAP[rawCat] ?? 'mens_physique';
    return { weight, category, sex };
  } catch { return { weight: 80, category: 'mens_physique', sex: 'male' }; }
}

export interface MacroScenario {
  id: string;
  label: string;
  ts: number;
  data: Macrocycle | BBMacrocycle;
}

const SCENARIOS_KEY = 'he_macro_scenarios';
const SCENARIOS_CAP = 6;

function scenariosStorage(): MacroScenario[] {
  try { const v = JSON.parse(localStorage.getItem(SCENARIOS_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}

/** Сохранить снимок текущего макро как сценарий (кап 6, новые первыми). */
export function saveMacroScenario(label: string, src: Macrocycle | BBMacrocycle): MacroScenario[] {
  const list: MacroScenario[] = [{ id: 'sc_' + Date.now().toString(36), label, ts: Date.now(), data: src }];
  for (const s of scenariosStorage()) {
    if (s && s.id && s.data && Array.isArray(s.data.blocks) && s.data.totalWeeks) list.push(s);
  }
  const capped = list.slice(0, SCENARIOS_CAP);
  try { localStorage.setItem(SCENARIOS_KEY, JSON.stringify(capped)); } catch { /* ignore */ }
  return capped;
}

export function loadMacroScenarios(): MacroScenario[] {
  return scenariosStorage().filter(s => s && s.id && s.data && Array.isArray(s.data.blocks));
}

export function removeMacroScenario(id: string): MacroScenario[] {
  const next = loadMacroScenarios().filter(s => s.id !== id);
  try { localStorage.setItem(SCENARIOS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  return next;
}

export interface ScenarioPhaseDiff { phase: string; weeksA: number; weeksB: number; diff: number; }

/** Сравнение двух макро по неделям фаз (для снапшотов-сценариев). */
export function compareMacroScenarios(a: Macrocycle | BBMacrocycle, b: Macrocycle | BBMacrocycle): ScenarioPhaseDiff[] {
  const sum = (src: Macrocycle | BBMacrocycle): Record<string, number> => {
    const m: Record<string, number> = {};
    for (const blk of src.blocks) {
      const key = 'cycleId' in blk
        ? (PHASE_LABEL_RU[blk.phase as MacroPhase] ?? blk.phase)
        : (BB_PHASE_LABEL_RU[blk.phase as BBMacroPhase] ?? blk.phase);
      m[key] = (m[key] || 0) + blk.weeks;
    }
    return m;
  };
  const ma = sum(a);
  const mb = sum(b);
  const keys = Array.from(new Set([...Object.keys(ma), ...Object.keys(mb)]));
  return keys.map(k => ({ phase: k, weeksA: ma[k] || 0, weeksB: mb[k] || 0, diff: (mb[k] || 0) - (ma[k] || 0) }));
}

/** Сводная строка сценария: «Макроцикл: N нед · M соревн.». */
export function scenarioSummary(src: Macrocycle | BBMacrocycle): string {
  return `Макроцикл: ${src.totalWeeks} нед · ${(src.competitions ?? []).length} соревн.`;
}

export interface DiaryMacroStats {
  sessions7: number;        // сессий за последние 7 дней
  sessions28: number;       // за 28 дней
  acwr: { ratio: number; zone: ACWRZone } | null;
  lastSessionDate: string | null;
  lastSessionWeek: number | null; // неделя макро по последней сессии (неделя 1 = reference/сегодня)
}

export const ACWR_ZONE_LABEL: Record<ACWRZone, string> = {
  undertrained: 'недогруз',
  optimal: 'норма',
  caution: 'осторожно (1.3–1.5)',
  dangerous: 'опасно (>1.5)',
};

/** Неделя макро для даты (неделя 1 = reference, по умолчанию сегодня). */
export function macroWeekForDate(isoDate: string, reference?: Date | string): number | null {
  const d = new Date(isoDate).getTime();
  const ref = reference == null ? Date.now() : (reference instanceof Date ? reference.getTime() : new Date(reference).getTime());
  if (!Number.isFinite(d) || !Number.isFinite(ref)) return null;
  const diffDays = (d - ref) / 86400000;
  // Будущее: нед 1 = сегодня; прошлое: нед 2 = 7-13 дней назад и т.д.
  const week = diffDays >= 0
    ? Math.floor(diffDays / 7) + 1
    : 1 + Math.floor(-diffDays / 7);
  return Math.max(1, week);
}

/** Статистика дневника (sRPE) для макроцикла: сессии, ACWR, последняя неделя. */
export function diaryMacroStats(reference?: Date | string): DiaryMacroStats {
  const sessions = loadSRPESessions();
  if (sessions.length === 0) return { sessions7: 0, sessions28: 0, acwr: null, lastSessionDate: null, lastSessionWeek: null };
  const now = reference == null ? Date.now() : (reference instanceof Date ? reference.getTime() : new Date(reference).getTime());
  const dayMs = 86400000;
  const last = sessions.reduce((a, b) => (a.date > b.date ? a : b));
  return {
    sessions7: sessions.filter(s => now - new Date(s.date).getTime() <= 7 * dayMs).length,
    sessions28: sessions.filter(s => now - new Date(s.date).getTime() <= 28 * dayMs).length,
    acwr: (() => {
      try {
        const r = acuteChronicRatio(toDailyLoads(sessions), undefined, 7, 28);
        return r && Number.isFinite(r.ratio) && r.ratio > 0 ? { ratio: Math.round(r.ratio * 100) / 100, zone: r.zone } : null;
      } catch { return null; }
    })(),
    lastSessionDate: last.date,
    lastSessionWeek: macroWeekForDate(last.date, reference),
  };
}

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

/**
 * Текстовое «расписание» макроцикла: фазы с неделями и долями года, циклы, соревнования.
 * Используется для карточки «📊 Итог года» и экспорта «📋 Копировать сводку».
 */
export function buildMacroSummary(src: Macrocycle | BBMacrocycle): string[] {
  const total = Math.max(1, src.totalWeeks);
  const lines: string[] = [];
  lines.push(`🗓 Макроцикл: ${total} нед (${Math.round((total / 7) * 10) / 10} мес)`);
  for (const b of src.blocks) {
    const pct = Math.round((b.weeks / total) * 100);
    const phaseLabel = 'cycleId' in b
      ? (PHASE_LABEL_RU[b.phase as MacroPhase] ?? b.phase)
      : (BB_PHASE_LABEL_RU[b.phase as BBMacroPhase] ?? b.phase);
    const cycleInfo = 'cycleId' in b && b.cycleId
      ? ` · цикл «${getCycleById(b.cycleId)?.meta.title ?? b.cycleId}»`
      : '';
    lines.push(`  ${phaseLabel}: нед ${b.weekOffset}–${b.weekOffset + b.weeks - 1} (${b.weeks} нед, ${pct}%)${cycleInfo}`);
  }
  const comps = src.competitions ?? [];
  if (comps.length > 0) {
    lines.push(`🏁 Соревнования (${comps.length}):`);
    for (const c of [...comps].sort((a, b) => a.week - b.week)) {
      const v = COMPETITION_PRIORITY_VISUAL[c.priority];
      lines.push(`  ${v.icon} [${c.priority}] ${c.name} — нед ${c.week}${c.date ? ` (${c.date})` : ''}`);
    }
  }
  return lines;
}

/** HTML-экранирование пользовательского ввода (названия соревнований и т.п.) для печати. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Экранирование значений ICS (запятая/точка с запятой/перевод строки). */
function escapeIcs(value: string): string {
  return value.replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');
}

/** Дата в формате ICS: YYYYMMDD (без часового пояса). */
function icsDate(d: Date | null): string {
  if (!d || !Number.isFinite(d.getTime())) return '';
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

/**
 * Экспорт макроцикла в календарь (.ics): блоки фаз (диапазоны дат от «сегодня»)
 * и соревнования (дата или воскресенье недели).
 */
export function buildMacroIcs(src: Macrocycle | BBMacrocycle, reference?: Date | string): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BodyBuildHealth//Macrocycle//RU',
    'CALSCALE:GREGORIAN',
  ];
  for (const b of src.blocks) {
    const label = 'cycleId' in b
      ? (PHASE_LABEL_RU[b.phase as MacroPhase] ?? b.phase)
      : (BB_PHASE_LABEL_RU[b.phase as BBMacroPhase] ?? b.phase);
    const ds = icsDate(macroWeekStartDate(b.weekOffset, reference));
    const de = icsDate(macroWeekEndDate(b.weekOffset + b.weeks - 1, reference));
    if (!ds || !de) continue;
    lines.push(
      'BEGIN:VEVENT',
      `SUMMARY:${escapeIcs(label)} (нед ${b.weekOffset}–${b.weekOffset + b.weeks - 1})`,
      `DTSTART;VALUE=DATE:${ds}`,
      `DTEND;VALUE=DATE:${de}`,
      'END:VEVENT',
    );
  }
  for (const c of (src.competitions ?? [])) {
    const dd = c.date ? c.date.replace(/-/g, '') : icsDate(macroWeekEndDate(c.week, reference));
    if (!dd) continue;
    lines.push(
      'BEGIN:VEVENT',
      `SUMMARY:🏁 ${escapeIcs(c.name)} [${c.priority}]`,
      `DTSTART;VALUE=DATE:${dd}`,
      `DTEND;VALUE=DATE:${dd}`,
      `DESCRIPTION:${escapeIcs(`Неделя ${c.week} макроцикла`)}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/** HTML-страница для печати макроцикла (фазы, циклы, соревнования, итог года). */
export function buildMacroPrintHtml(src: Macrocycle | BBMacrocycle): string {
  const lines = buildMacroSummary(src);
  const body = lines.map(l => escapeHtml(l)).join('\n');
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>Макроцикл — ${src.totalWeeks} нед</title>` +
    `<style>body{font-family:system-ui,-apple-system,sans-serif;padding:24px;color:#111;max-width:720px;margin:0 auto}` +
    `h1{font-size:18px;border-bottom:2px solid #00c853;padding-bottom:8px}` +
    `.l{font-size:13px;line-height:1.65;white-space:pre-wrap}` +
    `</style></head><body><h1>🗓 Годовой макроцикл (${src.totalWeeks} нед)</h1><div class="l">${body}</div></body></html>`;
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
  // Флеш «Сводка скопирована».
  const [copyFlash, setCopyFlash] = useState(false);
  // Статус «📦 Весь год → программа».
  const [yearNote, setYearNote] = useState<string | null>(null);
  // 🎭 Пик-неделя (тапер ББ): развёрнутый протокол в карточке prep-блока + применение в сборщике.
  const [peakWeekOpen, setPeakWeekOpen] = useState(false);
  const [builderPeakWeek, setBuilderPeakWeek] = useState(true);
  const [builderCategory, setBuilderCategory] = useState<string>(profilePeakDefaults().category);
  // 📸 Сценарии года (снапшоты макро для сравнения).
  const [scenarios, setScenarios] = useState<MacroScenario[]>(loadMacroScenarios);
  const [compareWith, setCompareWith] = useState<MacroScenario | null>(null);
  // Маркер текущей недели (1-индекс). По умолчанию неделя 1 = "сегодня" (начало макро).
  const [currentWeekIdx, setCurrentWeekIdx] = useState<number>(1);
  // Несколько соревнований: восстанавливаем из macro.competitions (если есть) или одиночное compWeek.
  const [competitions, setCompetitions] = useState<CompetitionEvent[]>(macro?.competitions ?? bbMacro?.competitions ?? []);
  const [buildError, setBuildError] = useState<string | null>(null);
  // ⚙️ Сборка цикла ББ: индекс блока, выбранный сплит, недели фаз, собранный план.
  const [builderForBlock, setBuilderForBlock] = useState<number>(-1);
  const [builderSplit, setBuilderSplit] = useState<string>('');
  const [builderWeeks, setBuilderWeeks] = useState<Record<BBMacroPhase, number>>({ hypertrophy: 0, strength: 0, contest_prep: 0, transition: 0 });
  const [builderPlan, setBuilderPlan] = useState<{ plan: BBPlan; total: number; label: string } | null>(null);
  const [builderMsg, setBuilderMsg] = useState<string | null>(null);
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

  // ⇄ Перемещение блока по таймлайну (C10): сдвиг + пересчёт недель.
  const moveBlock = (dir: -1 | 1) => {
    const src = isBB ? bbMacro : macro;
    if (!src || selectedBlockIdx < 0) return;
    const to = selectedBlockIdx + dir;
    if (to < 0 || to >= src.blocks.length) return;
    const moved = moveMacroBlock(src, selectedBlockIdx, to);
    if (!moved) return;
    if (isBB && bbMacro) setBbMacro(moved as BBMacrocycle);
    else if (macro) setMacro(moved as Macrocycle);
    setSelectedBlockIdx(to);
  };

  // ── ⚙️ Сборка цикла ББ: сплит + фазы ББ-макроцикла → BBPlan → ручной режим / ББ-авто ──
  const openBuilder = (blockIdx: number) => {
    const src = bbMacro;
    if (!src) return;
    const block = src.blocks[blockIdx];
    if (!block) return;
    const ranked = rankBBSplits({ level: effLevel, goal: 'hypertrophy' as any, daysPerWeek: Math.min(6, Math.max(3, block.weeks)) });
    setBuilderForBlock(blockIdx);
    setBuilderSplit(ranked[0]?.pattern.id ?? SPLIT_PATTERNS[0].id);
    setBuilderWeeks({ hypertrophy: 0, strength: 0, contest_prep: 0, transition: 0, [block.phase]: block.weeks });
    setBuilderPlan(null);
    setBuilderMsg(null);
    setBuilderPeakWeek(block.phase === 'contest_prep');
  };
  const buildCycleFromBuilder = () => {
    if (!bbMacro || builderForBlock < 0) return;
    const block = bbMacro.blocks[builderForBlock];
    if (!block) return;
    const pattern = SPLIT_PATTERNS.find(p => p.id === builderSplit) ?? SPLIT_PATTERNS[0];
    const total = BB_PHASES.reduce((s, phase) => s + (builderWeeks[phase] || 0), 0);
    if (total < 4) { setBuilderMsg('Суммарно нужно минимум 4 недели — добавьте недели фазам.'); return; }
    try {
      const draft = autodraftBBPlan({
        level: effLevel,
        goal: 'hypertrophy',
        daysPerWeek: pattern.sessionsPerRotation,
        weeks: total,
        splitPattern: pattern.id,
        equipment: [],
        weakPoints: [],
        trainingFocus: block.trainingFocus ?? 'hypertrophy',
      });
      // Синтезируем ББ-макроцикл из настроенных фаз → объём/RIR по фазам (Helms 2022).
      let offset = 1;
      const phaseBlocks: BBMacrocycle['blocks'] = BB_PHASES
        .filter(phase => (builderWeeks[phase] || 0) > 0)
        .map(phase => {
          const weeks = builderWeeks[phase] || 0;
          const b = { phase, weeks, weekOffset: offset, description: '', trainingFocus: (phase === 'contest_prep' ? 'endurance' : phase) as BBTrainingFocus };
          offset += weeks;
          return b;
        });
      const phaseMacro: BBMacrocycle = { totalWeeks: total, trainingFocus: block.trainingFocus ?? 'hypertrophy', blocks: phaseBlocks, rationale: [] };
      let plan = applyMacrocycleToBBPlan(draft, phaseMacro);
      // 🎭 Пик-неделя (тапер ББ): единая система — применяем к последней неделе contest_prep.
      if (builderPeakWeek) {
        const prepBlock = phaseBlocks.find(b => b.phase === 'contest_prep');
        const lastPrepWeek = prepBlock ? prepBlock.weekOffset + prepBlock.weeks - 1 : null;
        if (lastPrepWeek != null) {
          const pk = profilePeakDefaults();
          const category = normalizeContestCategory(builderCategory || pk.category, pk.sex);
          const comp = (bbMacro?.competitions ?? []).find(c => c.id === block.competitionId);
          const showDate = comp?.date ?? isoAddDays(isoToday(), Math.max(0, lastPrepWeek - 1) * 7);
          const prepCfg: BBContestPrepConfig = {
            sex: pk.sex,
            category,
            weightKg: Math.max(40, Math.min(200, pk.weight)),
            experienceLevel: 'intermediate',
            enhanced: false,
            prepCount: 0,
            showDate,
            weeksOut: 3,
            trainingProtocol: 'bb',
            carbLoadStrategy: 'moderate',
            waterStrategy: 'minimal',
            sodiumStrategy: 'constant',
          };
          plan = applyPeakWeekOverlayToBBPlan(plan, prepCfg, { weekNumber: lastPrepWeek });
        }
      }
      const phasesLabel = phaseBlocks.map(b => `${BB_PHASE_LABEL_RU[b.phase]} ${b.weeks}н`).join(' → ');
      setBuilderPlan({ plan, total, label: `${pattern.name} · ${phasesLabel}${builderPeakWeek && phaseBlocks.some(b => b.phase === 'contest_prep') ? ' · 🎭 пик-неделя' : ''}` });
      setBuilderMsg(null);
    } catch (error) {
      setBuilderMsg(`Ошибка сборки: ${(error as Error).message}`);
    }
  };
  const sendCycleToManual = () => {
    if (!builderPlan) return;
    try {
      const prog = createFromBuild(builderPlan.plan, { goal: 'hypertrophy', level: effLevel, title: 'Сборка цикла ББ: ' + builderPlan.label });
      applyToPlanner({ kind: 'program', label: builderPlan.label, data: { program: prog } });
      setBuilderMsg('✅ Передано в ручной конструктор — подтвердите в баннере «Калькулятор рекомендует».');
      setBuilderForBlock(-1);
    } catch (error) {
      setBuilderMsg(`Ошибка передачи: ${(error as Error).message}`);
    }
  };
  const sendCycleToBbAuto = () => {
    if (!builderPlan) return;
    try {
      localStorage.setItem('he_bb_plan_saved', JSON.stringify({ plan: builderPlan.plan, date: new Date().toISOString() }));
      window.dispatchEvent(new CustomEvent('he-bb-plan-saved'));
      setBuilderMsg('🚀 План передан в ББ-авто — откройте шаг «План».');
    } catch { setBuilderMsg('Не удалось сохранить план в ББ-авто.'); }
  };

  // 📋 Копировать текстовую сводку макроцикла (буфер обмена, фоллбэк execCommand).
  const copyMacroSummary = () => {
    const src = isBB ? bbMacro : macro;
    if (!src) return;
    const text = buildMacroSummary(src).join('\n');
    const done = () => { setCopyFlash(true); window.setTimeout(() => setCopyFlash(false), 2000); };
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(text).then(done).catch(() => { /* fallback ниже */ });
        return;
      }
    } catch { /* fallback ниже */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      done();
    } catch { /* ignore */ }
  };

  // 🖨 Печать макроцикла в новом окне (window.print).
  const printMacro = () => {
    const src = isBB ? bbMacro : macro;
    if (!src) return;
    const win = window.open('', '_blank', 'width=760,height=920');
    if (!win) return;
    win.document.write(buildMacroPrintHtml(src));
    win.document.close();
    win.focus();
    win.print();
  };

  // 📅 Экспорт макроцикла в календарь (.ics).
  const downloadIcs = () => {
    const src = isBB ? bbMacro : macro;
    if (!src) return;
    try {
      const blob = new Blob([buildMacroIcs(src)], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'macrocycle.ics';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  };

  // 📦 «Весь год в программу»: autodraftBBPlan (≤16 нед) → цикл недель до totalWeeks
  // → applyMacrocycleToBBPlan (объём/RIR по фазам макроцикла).
  const buildWholeYearPlan = (): { plan: BBPlan; total: number; label: string } | null => {
    if (!bbMacro) return null;
    const total = bbMacro.totalWeeks;
    const pattern = SPLIT_PATTERNS.find(p => p.id === builderSplit) ?? SPLIT_PATTERNS[0];
    const draft = autodraftBBPlan({
      level: effLevel,
      goal: 'hypertrophy',
      daysPerWeek: pattern.sessionsPerRotation,
      weeks: Math.min(total, 16),
      splitPattern: pattern.id,
      equipment: [],
      weakPoints: [],
      trainingFocus: bbMacro.trainingFocus ?? 'hypertrophy',
    });
    const weeks = Array.from({ length: total }, (_, i) => ({ ...draft.weeks[i % draft.weeks.length], week: i + 1 }));
    const plan = applyMacrocycleToBBPlan({ ...draft, weeks }, bbMacro);
    return { plan, total, label: `Весь год: ${pattern.name} · ${total} нед` };
  };
  const sendWholeYearToManual = () => {
    try {
      const built = buildWholeYearPlan();
      if (!built) return;
      const prog = createFromBuild(built.plan, { goal: 'hypertrophy', level: effLevel, title: 'Годовой план ББ: ' + built.label });
      applyToPlanner({ kind: 'program', label: built.label, data: { program: prog } });
      setYearNote('✅ Год отправлен в ручной конструктор — подтвердите в баннере «Калькулятор рекомендует».');
    } catch (error) {
      setYearNote(`Ошибка сборки года: ${(error as Error).message}`);
    }
  };
  const sendWholeYearToBbAuto = () => {
    try {
      const built = buildWholeYearPlan();
      if (!built) return;
      localStorage.setItem('he_bb_plan_saved', JSON.stringify({ plan: built.plan, date: new Date().toISOString() }));
      window.dispatchEvent(new CustomEvent('he-bb-plan-saved'));
      setYearNote('🚀 Год передан в ББ-авто — откройте шаг «План».');
    } catch (error) {
      setYearNote(`Ошибка передачи года: ${(error as Error).message}`);
    }
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
            <div style={{ marginBottom: 6 }}>
              <PopupNumber label="Неделя главного соревнования" value={compWeek} min={1} max={totalWeeks}
                hint={`Неделя соревнований в макроцикле (1–${totalWeeks}). Пик подстраивается автоматически.`}
                onChange={v => setCompWeek(Number.isFinite(v) ? Math.max(1, Math.min(totalWeeks, Math.round(v))) : compWeek)} />
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
            const setComp = (patch: Partial<CompetitionEvent>) => setCompetitions(competitions.map((cc, j) => j === i ? { ...cc, ...patch } : cc));
            // Список слотов циклов: cycleIds[] (новое) или [cycleId] (legacy); пусто → один слот «Авто».
            const slots: string[] = c.cycleIds && c.cycleIds.length > 0
              ? [...c.cycleIds]
              : (c.cycleId ? [c.cycleId] : ['']);
            const setSlot = (k: number, val: string) => setCompetitions(competitions.map((cc, j) => {
              if (j !== i) return cc;
              const cur = cc.cycleIds && cc.cycleIds.length > 0
                ? [...cc.cycleIds]
                : (cc.cycleId ? [cc.cycleId] : ['']);
              cur[k] = val;
              // Не выкидываем пустые слоты («Авто»): иначе после выбора цикла
              // в одном слоте остальные строки схлопывались в одну.
              const hasCycle = cur.some(x => Boolean(x));
              return { ...cc, cycleIds: hasCycle ? cur : undefined, cycleId: cur.find(x => Boolean(x)) ?? undefined };
            }));
            const removeSlot = (k: number) => setCompetitions(competitions.map((cc, j) => {
              if (j !== i) return cc;
              const cur = (cc.cycleIds && cc.cycleIds.length > 0 ? [...cc.cycleIds] : (cc.cycleId ? [cc.cycleId] : []));
              cur.splice(k, 1);
              const cleaned = cur.filter((x): x is string => Boolean(x));
              return { ...cc, cycleIds: cleaned.length > 0 ? cleaned : undefined, cycleId: cleaned[0] };
            }));
            const cycleOptions = [
              { id: '', label: 'Авто', desc: 'Авто-подбор цикла под фазу пика' },
              // Сначала циклы с совпадающим уровнем, затем остальные (по алфавиту).
              ...[...filteredCycles].sort((a, b) => {
                const am = a.meta.level === effLevel ? 0 : 1;
                const bm = b.meta.level === effLevel ? 0 : 1;
                return am - bm || a.meta.title.localeCompare(b.meta.title, 'ru');
              }).map(cyc => ({
                id: cyc.meta.id,
                label: cyc.meta.title,
                desc: `${cyc.meta.level} · ${cyc.meta.sessionsPerWeek} д/нед · ${cyc.meta.weeks} нед · период «${cyc.meta.period}»`,
              })),
            ];
            const chosenCycles = slots.filter(Boolean).length || (c.cycleId ? 1 : 0);
            return (
              <div key={c.id} style={{ marginBottom: 8, padding: 10, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                {/* Название + неделя (попап) + дублировать + удалить */}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                  <input aria-label={`Название соревнования ${c.name}`} style={{ ...IN, flex: 1, padding: '4px 10px', fontSize: 12, minHeight: 44 }}
                    value={c.name} placeholder="Название (например, «Первенство области»)"
                    onChange={e => setComp({ name: e.target.value })} />
                  <div style={{ width: 104, flexShrink: 0 }}>
                    <PopupNumber label="Неделя" value={c.week} min={1} max={totalWeeks}
                      hint={`Неделя соревнования в макроцикле (1–${totalWeeks}). При вводе даты неделя пересчитается автоматически.`}
                      onChange={v => setComp({ week: Math.max(1, Math.min(totalWeeks, Math.round(v))), date: undefined })} />
                  </div>
                  <button aria-label={`Дублировать соревнование ${c.name}`} onClick={() => {
                    const used = new Set(competitions.map(x => x.week));
                    let w = Math.min(totalWeeks, c.week + 8);
                    while (used.has(w) && w < totalWeeks) w += 1;
                    if (used.has(w)) w = Array.from({ length: totalWeeks }, (_, i) => i + 1).find(x => !used.has(x)) ?? 1;
                    const dup: CompetitionEvent = {
                      ...c,
                      id: 'comp_' + Date.now().toString(36) + '_dup',
                      name: c.name + ' (копия)',
                      week: w,
                      date: undefined,
                      priority: c.priority === 'A' ? 'B' : c.priority,
                    };
                    setCompetitions([...competitions, dup]);
                  }}
                    style={{ border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 14, padding: 4, minHeight: 44, minWidth: 44, flexShrink: 0 }}
                    title="Дублировать соревнование">⧉</button>
                  <button aria-label={`Удалить соревнование ${c.name}`} onClick={() => setCompetitions(competitions.filter((_, j) => j !== i))}
                    style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: 14, padding: 4, minHeight: 44, minWidth: 44, flexShrink: 0 }}
                    title="Удалить соревнование">✕</button>
                </div>
                {/* Дата → авто-расчёт недели */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', flexShrink: 0 }}>📅 Дата:</span>
                  <input type="date" aria-label={`Дата соревнования ${c.name}`} value={c.date ?? ''}
                    style={{ ...IN, flex: 1, padding: '4px 8px', fontSize: 11, minHeight: 44, color: c.date ? '#00e68a' : 'rgba(255,255,255,0.6)' }}
                    onChange={e => {
                      const d = e.target.value;
                      if (!d) { setComp({ date: undefined }); return; }
                      setComp({ date: d, week: Math.max(1, Math.min(totalWeeks, estimateCompetitionWeek(d, totalWeeks))) });
                    }} />
                  {c.date && <span style={{ fontSize: 10, color: '#00e68a', flexShrink: 0 }}>→ нед {c.week}</span>}
                </div>
                {/* ⏳ Обратный отсчёт до старта + дата недели */}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8, fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
                  <span>{(() => {
                    const left = weeksUntilWeek(c.week, currentWeekIdx);
                    if (left < 0) return '⏳ старт прошёл';
                    if (left === 0) return '⏳ эта неделя — старт!';
                    return `⏳ до старта: ${left} нед`;
                  })()}</span>
                  <span>·</span>
                  <span>📅 {c.date ?? `~ ${formatMacroDate(macroWeekStartDate(c.week))}`}</span>
                </div>
                {/* Приоритет — сегментные чипы с цветами */}
                <div role="radiogroup" aria-label={`Приоритет соревнования ${c.name}`} style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                  {(['A', 'B', 'C'] as const).map(p => {
                    const v = COMPETITION_PRIORITY_VISUAL[p];
                    const active = c.priority === p;
                    return (
                      <button key={p} type="button" role="radio" aria-checked={active} aria-label={`Приоритет ${p} — ${v.label}`}
                        onClick={() => setComp({ priority: p })}
                        style={{ flex: 1, minHeight: 44, borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 11, textAlign: 'center',
                          background: active ? v.color + '1f' : 'rgba(255,255,255,0.03)',
                          border: active ? `1px solid ${v.color}` : '1px solid rgba(255,255,255,0.08)',
                          color: active ? v.color : 'rgba(255,255,255,0.5)' }}>
                        {v.icon} {p} — {v.label}
                      </button>
                    );
                  })}
                </div>
                {/* Циклы на пик (только A и B): карточки-попапы */}
                {c.priority !== 'C' && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>
                        🔗 Циклы на пик: {chosenCycles} выбр.
                      </span>
                      <button type="button"
                        onClick={() => {
                          // Добавить ещё один цикл (пустой = автоподбор).
                          // Неявная строка «Авто» становится явным слотом (''),
                          // иначе первый клик не давал видимого результата.
                          const current = c.cycleIds && c.cycleIds.length > 0
                            ? [...c.cycleIds]
                            : (c.cycleId ? [c.cycleId] : ['']);
                          setCompetitions(competitions.map((cc, j) => j === i ? { ...cc, cycleIds: [...current, ''] } : cc));
                        }}
                        style={{ ...BTN_GHOST, padding: '4px 10px', fontSize: 10, minHeight: 44 }}
                        title="Добавить ещё один цикл на пик"
                      >+ Цикл</button>
                    </div>
                    {slots.map((cid, k) => {
                      const sel = cid ? getCycleById(cid) : undefined;
                      const mismatch = sel && sel.meta.level !== effLevel;
                      return (
                        <div key={k} style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <PopupSelect
                              label={`Цикл ${k + 1}${mismatch ? ' ⚠' : ''}`}
                              value={cid}
                              options={cycleOptions}
                              hint={mismatch
                                ? `Уровень выбранного цикла (${sel?.meta.level}) не совпадает с уровнем ${effLevel}.`
                                : 'Цикл для под-фазы пика соревнования. «Авто» — подбор по фазе и уровню.'}
                              onChange={v => setSlot(k, v)}
                            />
                          </div>
                          {slots.length > 1 && (
                            <button aria-label={`Удалить цикл ${k + 1}`} onClick={() => removeSlot(k)}
                              style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: 11, padding: 2, minHeight: 44, minWidth: 44, lineHeight: 1, flexShrink: 0 }}
                              title="Удалить цикл">✕</button>
                          )}
                        </div>
                      );
                    })}
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
          {/* 🔔 «Что тренировать сегодня»: активный блок + ближайший старт + быстрые действия */}
          {(() => {
            const src = isBB ? bbMacro! : macro!;
            const blockIdx = src.blocks.findIndex(b => currentWeekIdx >= b.weekOffset && currentWeekIdx < b.weekOffset + b.weeks);
            const block = blockIdx >= 0 ? src.blocks[blockIdx] : null;
            const nextComp = (src.competitions ?? []).filter(c => c.week >= currentWeekIdx).sort((a, b) => a.week - b.week)[0];
            const blockLabel = block
              ? ('cycleId' in block
                  ? (PHASE_LABEL_RU[block.phase as MacroPhase] ?? block.phase)
                  : (BB_PHASE_LABEL_RU[block.phase as BBMacroPhase] ?? block.phase))
              : null;
            const cycleTitle = block && 'cycleId' in block && block.cycleId
              ? (getCycleById(block.cycleId)?.meta.title ?? block.cycleId)
              : null;
            return (
              <div style={{ marginBottom: 8, padding: 10, borderRadius: 12, background: 'rgba(0,230,138,0.05)', border: '1px solid rgba(0,230,138,0.18)' }} className="macrocycle-today-card">
                <div style={{ fontSize: 11, fontWeight: 800, color: '#00e68a', marginBottom: 4 }}>
                  🔔 Сегодня — нед {currentWeekIdx} ({formatMacroDate(macroWeekStartDate(currentWeekIdx))})
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>
                  {blockLabel ? `Фаза: ${blockLabel}${cycleTitle ? ` · цикл «${cycleTitle}»` : ''}` : 'Макроцикл ещё не покрывает эту неделю'}
                  {nextComp ? ` · ⏳ до старта «${nextComp.name}»: ${Math.max(0, nextComp.week - currentWeekIdx)} нед` : ''}
                </div>
                {block && blockIdx >= 0 && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    {isBB
                      ? <button type="button" onClick={() => openBuilder(blockIdx)} style={{ ...BTN_GHOST, fontSize: 10, padding: '6px 10px', minHeight: 44 }}>⚙️ Собрать этот блок</button>
                      : ('cycleId' in block && block.cycleId
                          ? <button type="button" onClick={() => applyBlock(blockIdx)} style={{ ...BTN_GHOST, fontSize: 10, padding: '6px 10px', minHeight: 44 }}>✓ Применить цикл</button>
                          : null)}
                  </div>
                )}
              </div>
            );
          })()}
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
                   <span style={{ fontSize: 8, color: isSel ? 'var(--accent-contrast, #06281c)' : 'var(--text-dim, rgba(255,255,255,0.7))' }}>{b.weeks}н · с {formatMacroDate(macroWeekStartDate(b.weekOffset))}</span>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-dim, rgba(255,255,255,0.4))' }}>
            {(() => {
              const src = isBB ? bbMacro! : macro!;
              const total = src.totalWeeks;
              const ticks = [1, Math.ceil(total / 4), Math.ceil(total / 2), Math.ceil(total * 3 / 4), total];
              return ticks.map((t, i) => <span key={i}>Нед {t}</span>);
            })()}
          </div>
          {/* Линейка дат (неделя 1 = сегодня) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: 'var(--text-dim, rgba(255,255,255,0.3))', marginBottom: 8 }}>
            {(() => {
              const src = isBB ? bbMacro! : macro!;
              const total = src.totalWeeks;
              const ticks = [1, Math.ceil(total / 4), Math.ceil(total / 2), Math.ceil(total * 3 / 4), total];
              return ticks.map((t, i) => <span key={i}>· {formatMacroDate(macroWeekStartDate(t))}</span>);
            })()}
          </div>
          {/* Маркер текущей недели — редактор (степпер-кнопки) */}
          <div className="macrocycle-current-week" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>
            <span>📍 Текущая неделя:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <button type="button" aria-label="Предыдущая неделя" title="Предыдущая неделя"
                onClick={() => setCurrentWeekIdx(w => Math.max(1, w - 1))}
                style={{ minHeight: 44, minWidth: 44, borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#fff', cursor: 'pointer', fontSize: 14 }}>−</button>
              <span aria-label={`Текущая неделя ${currentWeekIdx}`} style={{ minWidth: 52, textAlign: 'center', fontWeight: 800, fontSize: 13, color: 'var(--accent, #00e68a)', padding: '10px 6px', borderRadius: 10, border: '1px solid rgba(0,230,138,0.25)', background: 'rgba(0,230,138,0.06)' }}>
                {currentWeekIdx} / {(isBB ? bbMacro!.totalWeeks : macro!.totalWeeks)}
              </span>
              <button type="button" aria-label="Следующая неделя" title="Следующая неделя"
                onClick={() => setCurrentWeekIdx(w => Math.min(isBB ? (bbMacro?.totalWeeks ?? 1) : (macro?.totalWeeks ?? 1), w + 1))}
                style={{ minHeight: 44, minWidth: 44, borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#fff', cursor: 'pointer', fontSize: 14 }}>+</button>
              <button type="button" aria-label="К началу макроцикла" title="К началу макроцикла (неделя 1)"
                onClick={() => setCurrentWeekIdx(1)}
                style={{ minHeight: 44, minWidth: 44, borderRadius: 10, border: '1px solid rgba(0,230,138,0.2)', background: 'rgba(0,230,138,0.06)', color: '#00e68a', cursor: 'pointer', fontSize: 13 }}>⟲</button>
            </div>
            {(() => {
              const d = diaryMacroStats();
              if (!d.lastSessionWeek) return null;
              return (
                <button type="button" aria-label="По дневнику"
                  onClick={() => { const w = diaryMacroStats().lastSessionWeek; if (w != null) setCurrentWeekIdx(w); }}
                  title={`Последняя сессия: ${d.lastSessionDate ?? ''} — неделя ${d.lastSessionWeek}. Кнопка переведёт маркер на неё.`}
                  style={{ minHeight: 44, padding: '0 10px', borderRadius: 10, border: '1px solid rgba(139,92,246,0.3)', background: 'rgba(139,92,246,0.07)', color: '#a78bfa', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                  📈 По дневнику (нед {d.lastSessionWeek})
                </button>
              );
            })()}
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
                 <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                   <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Нед {activeBlock.weekOffset}–{activeBlock.weekOffset + activeBlock.weeks - 1} ({activeBlock.weeks} нед · {Math.round((activeBlock.weeks / Math.max(1, (isBB ? bbMacro!.totalWeeks : macro!.totalWeeks))) * 100)}% года)</span>
                   {(isBB ? bbMacro!.blocks.length : macro!.blocks.length) > 1 && (
                     <span style={{ display: 'flex', gap: 2 }}>
                       <button type="button" aria-label="Переместить блок влево" title="Переместить блок раньше"
                         onClick={() => moveBlock(-1)}
                         style={{ minHeight: 44, minWidth: 40, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#fff', cursor: 'pointer', fontSize: 12 }}>◀</button>
                       <button type="button" aria-label="Переместить блок вправо" title="Переместить блок позже"
                         onClick={() => moveBlock(1)}
                         style={{ minHeight: 44, minWidth: 40, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#fff', cursor: 'pointer', fontSize: 12 }}>▶</button>
                     </span>
                   )}
                 </span>
              </div>
              <div className="macrocycle-active-block__description" style={{ ...SMALL, marginBottom: 6 }}>{activeBlock.description}</div>
              <div style={{ ...SMALL, marginBottom: 6, fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
                🗓 {formatMacroDate(macroWeekStartDate(activeBlock.weekOffset))}–{formatMacroDate(macroWeekEndDate(activeBlock.weekOffset + activeBlock.weeks - 1))}
              </div>
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
              {/* 🏁 Тапер к старту + 📈 прогрессия ПМ (ПЛ-блоки с циклом) */}
              {!isBB && 'cycleId' in activeBlock && activeBlock.cycleId && (() => {
                const cyc = getCycleById(activeBlock.cycleId);
                if (!cyc) return null;
                const taper = taperWeeksForBlock(activeBlock as MacroBlock);
                const weeksToStart = Math.max(0, activeBlock.weekOffset + activeBlock.weeks - 1 - currentWeekIdx + 1);
                const pmMult = projectPmGrowthMultiplier(cyc, weeksToStart);
                return (
                  <div style={{ marginTop: 6, padding: 8, borderRadius: 8, background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)', fontSize: 10, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
                    {taper.length > 0 && (
                      <div>🏁 Тапер к старту: {taper.map(t => `нед ${t.week} — ${t.label}, объём ×${t.volumeMult}, RIR +${t.rirShift}`).join(' · ')}</div>
                    )}
                    <div>📈 Прогрессия цикла {Math.round((cyc.meta.correctionPct ?? 0.005) * 1000) / 10}%/нед → к старту ПМ ×{pmMult.toFixed(2)}</div>
                  </div>
                );
              })()}
              {'cycleId' in activeBlock && activeBlock.cycleId && (
                <button onClick={() => applyBlock(selectedBlockIdx)} style={{ ...BTN, fontSize: 11, padding: '8px 12px', minHeight: 44, marginTop: 2 }}>
                  ✓ Применить как активный цикл
                </button>
              )}
              {!isBB && (
                <div style={{ ...SMALL, marginTop: 6, color: 'rgba(255,255,255,0.45)', fontSize: 10 }}>
                  ПЛ-цикл строится через ПЛ-авто; тапер и прикидки — вкладка «🏁 Пик/Соревнования».
                </div>
              )}
              {isBB && activeBlock && (
                <>
                  <button type="button" onClick={() => openBuilder(selectedBlockIdx)} style={{ ...BTN_GHOST, fontSize: 11, padding: '8px 12px', minHeight: 44, marginTop: 6, width: '100%', borderColor: 'rgba(0,230,138,0.3)', color: '#00e68a' }}>
                    ⚙️ Собрать этот цикл (сплит + фазы)
                  </button>
                  {/* 🎭 Пик-неделя (тапер ББ): единая система — протокол для prep-блока */}
                  {activeBlock.phase === 'contest_prep' && (() => {
                    const pk = profilePeakDefaults();
                    const category = normalizeContestCategory(pk.category, pk.sex);
                    const comp = (bbMacro?.competitions ?? []).find(c => c.id === activeBlock.competitionId);
                    const showDate = comp?.date ?? isoAddDays(isoToday(), Math.max(0, activeBlock.weekOffset + activeBlock.weeks - 2) * 7);
                    let res: BBContestPrepResult | null = null;
                    try {
                      const prepCfg: BBContestPrepConfig = {
                        sex: pk.sex,
                        category,
                        weightKg: Math.max(40, Math.min(200, pk.weight)),
                        experienceLevel: 'intermediate',
                        enhanced: false,
                        prepCount: 0,
                        showDate,
                        weeksOut: 3,
                        trainingProtocol: 'bb',
                        carbLoadStrategy: 'moderate',
                        waterStrategy: 'minimal',
                        sodiumStrategy: 'constant',
                      };
                      res = buildBBContestPrep(prepCfg);
                    } catch { res = null; }
                    const proto = res?.peakWeek ?? [];
                    return (
                      <div style={{ marginTop: 6, padding: 10, borderRadius: 10, background: 'linear-gradient(135deg, rgba(245,158,11,0.07), rgba(24,24,27,0.4))', border: '1px solid rgba(245,158,11,0.25)', fontSize: 10, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                          <button type="button" onClick={() => setPeakWeekOpen(v => !v)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 11, fontWeight: 800, color: '#f59e0b' }}>
                            {peakWeekOpen ? '▼' : '▶'} 🎭 Пик-неделя (тапер ББ) — 7 дней к сцене
                          </button>
                          {proto.length > 0 && (
                            <div style={{ display: 'flex', gap: 3, alignItems: 'center' }} title="Фазы пик-недели: деплеция → загрузка → пик → шоу">
                              {proto.map(d => (
                                <span key={d.day} title={`День ${d.day}: ${PHASE_LABELS_RU[d.phase]}`} style={{
                                  width: 10, height: 10, borderRadius: 3,
                                  background: PEAK_PHASE_COLORS[d.phase],
                                  boxShadow: d.day === 7 ? `0 0 6px ${PEAK_PHASE_COLORS[d.phase]}` : 'none',
                                }} />
                              ))}
                            </div>
                          )}
                        </div>
                        {peakWeekOpen && (
                          <>
                            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                              {proto.map(d => {
                                const phColor = PEAK_PHASE_COLORS[d.phase];
                                return (
                                  <div key={d.day} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '3px 6px', borderRadius: 6, borderLeft: `3px solid ${phColor}`, background: d.day === 7 ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.02)' }}>
                                    <span style={{ fontWeight: 700, minWidth: 34, color: d.day === 7 ? '#fbbf24' : '#fff' }}>День {d.day}</span>
                                    <span style={{ minWidth: 74, padding: '1px 6px', borderRadius: 999, fontSize: 8, fontWeight: 700, textAlign: 'center', background: phColor + '18', color: phColor, border: `1px solid ${phColor}40` }}>{PHASE_LABELS_RU[d.phase]}</span>
                                    <span style={{ color: 'rgba(255,255,255,0.55)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      💧{d.waterLiters}л · 🧂{d.sodiumMg}мг · 🍚{d.carbsG}г · {d.training.minutes ? `🏋️${d.training.minutes}м` : 'отдых'} · 🎭{d.posingMinutes}м
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                            {res && res.rationale.length > 0 && (
                              <div style={{ marginTop: 6, color: 'rgba(255,255,255,0.45)' }}>
                                {res.rationale.slice(0, 2).map((r, i) => <div key={i}>• {r}</div>)}
                              </div>
                            )}
                            {res && res.warnings.length > 0 && <div style={{ marginTop: 4, color: '#f59e0b' }}>⚠ {res.warnings[0]}</div>}
                            <div style={{ marginTop: 4, color: 'rgba(255,255,255,0.4)' }}>Протокол на {pk.weight} кг · {pk.category} — при сборке цикла применяется автоматически (галочка в попапе).</div>
                          </>
                        )}
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
            );
          })()}

          {onApplyMacrocycle && (isBB ? bbMacro : macro) && (
            <button onClick={() => { const source = isBB ? bbMacro : macro; if (source) onApplyMacrocycle(source); }} style={{ ...BTN_GHOST, fontSize: 11, padding: '8px 12px', minHeight: 44, marginTop: 6, width: '100%' }}>
              🗓 Применить весь макроцикл
            </button>
          )}

          {/* Действия годового плана: сохранить + сводка + «Начать работу по циклу» */}
          {(isBB ? bbMacro : macro) && (
            <>
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
                onClick={copyMacroSummary}
                style={{ ...BTN_GHOST, flex: 1, fontSize: 11, padding: '8px 12px', minHeight: 44 }}
                title="Скопировать текстовую сводку макроцикла"
              >
                {copyFlash ? '✅ Сводка скопирована' : '📋 Сводка'}
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
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button onClick={printMacro} style={{ ...BTN_GHOST, flex: 1, fontSize: 11, padding: '8px 12px', minHeight: 44 }}
                title="Открыть макроцикл в окне печати">
                🖨 Печать макроцикла
              </button>
              <button onClick={downloadIcs} style={{ ...BTN_GHOST, flex: 1, fontSize: 11, padding: '8px 12px', minHeight: 44 }}
                title="Скачать макроцикл как календарь (.ics)">
                📅 Календарь (.ics)
              </button>
            </div>
            {isBB && (
              <>
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <button type="button" onClick={sendWholeYearToManual} style={{ ...BTN_GHOST, flex: 1, fontSize: 11, padding: '8px 12px', minHeight: 44 }}
                    title="Собрать весь год в одну программу и отправить в ручной конструктор">
                    📦 Год → ручной режим
                  </button>
                  <button type="button" onClick={sendWholeYearToBbAuto} style={{ ...BTN_GHOST, flex: 1, fontSize: 11, padding: '8px 12px', minHeight: 44 }}
                    title="Собрать весь год в одну программу и передать в ББ-авто">
                    📦 Год → ББ-авто
                  </button>
                </div>
                {yearNote && (
                  <div role="status" style={{ marginTop: 6, padding: '8px 10px', borderRadius: 8, fontSize: 11, lineHeight: 1.5,
                    background: yearNote.startsWith('✅') || yearNote.startsWith('🚀') ? 'rgba(0,230,138,0.08)' : 'rgba(245,158,11,0.08)',
                    border: `1px solid ${yearNote.startsWith('✅') || yearNote.startsWith('🚀') ? 'rgba(0,230,138,0.25)' : 'rgba(245,158,11,0.3)'}`,
                    color: yearNote.startsWith('✅') || yearNote.startsWith('🚀') ? '#00e68a' : '#f59e0b' }}>
                    {yearNote}
                  </div>
                )}
              </>
            )}
            </>
          )}

          {/* 📊 Итог года: фазы с долями и прогресс-барами */}
          {(isBB ? bbMacro : macro) && (() => {
            const src = isBB ? bbMacro! : macro!;
            const total = Math.max(1, src.totalWeeks);
            const comps = src.competitions ?? [];
            const blocks = src.blocks.map(b => {
              const pct = Math.round((b.weeks / total) * 100);
              const color = 'cycleId' in b ? (PHASE_COLOR[b.phase as MacroPhase] ?? '#888') : (BB_PHASE_COLOR[b.phase as BBMacroPhase] ?? '#888');
              const label = 'cycleId' in b ? (PHASE_LABEL_RU[b.phase as MacroPhase] ?? b.phase) : (BB_PHASE_LABEL_RU[b.phase as BBMacroPhase] ?? b.phase);
              const icon = 'cycleId' in b ? (PHASE_ICON[b.phase as MacroPhase] ?? '') : (BB_PHASE_ICON[b.phase as BBMacroPhase] ?? '');
              const cycleTitle = 'cycleId' in b && b.cycleId ? (getCycleById(b.cycleId)?.meta.title ?? b.cycleId) : '';
              const isActive = currentWeekIdx >= b.weekOffset && currentWeekIdx < b.weekOffset + b.weeks;
              return { ...b, pct, color, label, icon, cycleTitle, isActive };
            });
            const activeLabel = blocks.find(b => b.isActive)?.label ?? null;
            return (
              <div style={{ marginTop: 12, padding: 10, borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }} className="macrocycle-year-stats">
                <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6 }}>
                  📊 Итог года — {total} нед{comps.length > 0 ? ` · 🏁 ${comps.length} соревн.` : ''}{activeLabel ? ` · 📍 сейчас: ${activeLabel}` : ''}
                </div>
                {blocks.map((b, i) => (
                  <div key={i} style={{ marginBottom: 4, padding: b.isActive ? '4px 6px' : 0, borderRadius: 6, background: b.isActive ? b.color + '14' : 'transparent', border: b.isActive ? `1px solid ${b.color}40` : '1px solid transparent' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6, fontSize: 10 }}>
                      <span style={{ color: 'rgba(255,255,255,0.75)', fontWeight: b.isActive ? 800 : 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {b.isActive ? '📍 ' : ''}{b.icon} {b.label}{b.cycleTitle ? ` — ${b.cycleTitle}` : ''}
                      </span>
                      <span style={{ color: 'rgba(255,255,255,0.45)', flexShrink: 0 }}>нед {b.weekOffset}–{b.weekOffset + b.weeks - 1} · {b.weeks}н · {b.pct}%</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginTop: 2 }}>
                      <div style={{ width: `${b.pct}%`, height: '100%', background: b.color, borderRadius: 3 }} />
                    </div>
                  </div>
                ))}
                {comps.length > 0 && (
                  <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2, fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>
                    {[...comps].sort((a, b) => a.week - b.week).map(c => {
                      const v = COMPETITION_PRIORITY_VISUAL[c.priority];
                      return (
                        <div key={c.id} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <span>{v.icon}</span><span style={{ fontWeight: 700, color: v.color }}>[{c.priority}]</span>
                          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                          <span style={{ color: 'rgba(255,255,255,0.4)' }}>нед {c.week}{c.date ? ` (${c.date})` : ''}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {/* 🗺 Heatmap фаз по неделям (интенсивность) */}
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 2 }} className="macro-week-heatmap">
                  {Array.from({ length: total }, (_, i) => {
                    const w = i + 1;
                    const block = blocks.find(b => w >= b.weekOffset && w < b.weekOffset + b.weeks);
                    const active = w === currentWeekIdx;
                    return (
                      <div key={w} className="macro-week-cell" aria-label={`Нед ${w}: ${block?.label ?? '—'}`}
                        title={`Нед ${w}: ${block?.label ?? '—'}${block ? ` · ${block.weeks}н` : ''}`}
                        style={{ width: 8, height: 8, borderRadius: 2, background: block?.color ?? 'rgba(255,255,255,0.05)', outline: active ? '1.5px solid #fff' : 'none' }} />
                    );
                  })}
                </div>
                {/* ⚡ ACWR из дневника (sRPE) + сессии */}
                {(() => {
                  const d = diaryMacroStats();
                  if (!d.acwr && d.sessions7 === 0) {
                    return <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>🗺 Фазы по неделям (ACWR появится, когда в дневнике будут sRPE-сессии).</div>;
                  }
                  const zoneColor = d.acwr?.zone === 'dangerous' ? '#ef4444' : d.acwr?.zone === 'caution' ? '#f59e0b' : d.acwr?.zone === 'undertrained' ? 'rgba(255,255,255,0.45)' : '#00e68a';
                  return (
                    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2, fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>
                      <div>
                        📈 Дневник: {d.sessions7} сессий (7д) · {d.sessions28} (28д){d.lastSessionDate ? ` · последняя ${d.lastSessionDate}` : ''}
                      </div>
                      {d.acwr && (
                        <div style={{ color: zoneColor, fontWeight: 700 }}>
                          ⚡ ACWR {d.acwr.ratio} — {ACWR_ZONE_LABEL[d.acwr.zone]}
                          {d.acwr.zone === 'caution' && ' · перед пиком снизьте объём'}
                          {d.acwr.zone === 'dangerous' && ' · обязателен делод перед стартом'}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })()}

          {/* 📸 Сценарии года: снапшоты для сравнения планов */}
          <div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }} className="macrocycle-scenarios">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.3 }}>📸 Сценарии года</span>
              <button type="button" onClick={() => {
                const src = isBB ? bbMacro : macro;
                if (!src) return;
                setScenarios(saveMacroScenario(`Сценарий ${scenarios.length + 1} · ${src.totalWeeks} нед`, src));
              }} style={{ ...BTN_GHOST, padding: '4px 10px', fontSize: 10, minHeight: 44 }} title="Снимок текущего макроцикла как сценарий">📸 Снимок</button>
            </div>
            {scenarios.length === 0 && (
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
                Сохраните сценарий (например, соревнование в июне), перестройте план (например, сентябрь) — и сравните фазы.
              </div>
            )}
            {scenarios.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>{new Date(s.ts).toLocaleDateString('ru-RU')}</span>
                <button type="button" onClick={() => setCompareWith(compareWith?.id === s.id ? null : s)} style={{ ...BTN_GHOST, padding: '4px 8px', fontSize: 10, minHeight: 44 }} title="Сравнить с текущим макроциклом">{compareWith?.id === s.id ? '✕ Закрыть' : '⇄ Сравнить'}</button>
                <button type="button" aria-label={`Удалить сценарий ${s.label}`} onClick={() => setScenarios(removeMacroScenario(s.id))} style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: 11, padding: 4, minHeight: 44, minWidth: 44, flexShrink: 0 }}>✕</button>
              </div>
            ))}
            {compareWith && (() => {
              const src = isBB ? bbMacro : macro;
              if (!src) return null;
              const diffs = compareMacroScenarios(compareWith.data, src);
              return (
                <div style={{ marginTop: 8, padding: 8, borderRadius: 8, background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.15)' }} className="macrocycle-scenario-compare">
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#00e68a', marginBottom: 4 }}>⇄ {compareWith.label} → текущий ({src.totalWeeks} нед)</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>{scenarioSummary(compareWith.data)} → {scenarioSummary(src)}</div>
                  {diffs.map(d => (
                    <div key={d.phase} style={{ display: 'flex', gap: 6, fontSize: 10, alignItems: 'baseline' }}>
                      <span style={{ flex: 1, color: 'rgba(255,255,255,0.75)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.phase}</span>
                      <span style={{ color: 'rgba(255,255,255,0.5)', flexShrink: 0 }}>{d.weeksA} → {d.weeksB} нед</span>
                      <span style={{ fontWeight: 700, flexShrink: 0, color: d.diff > 0 ? '#00e68a' : d.diff < 0 ? '#ef4444' : 'rgba(255,255,255,0.35)' }}>{d.diff > 0 ? `+${d.diff}` : d.diff}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

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
                  <div style={{ fontSize: 9, color: pc, textAlign: 'center', fontWeight: 700, marginBottom: 3 }}>{pi} {pl}</div>
                  <PopupNumber
                    label="Недель"
                    value={editWeeks[phase] ?? phaseWeeks}
                    min={1}
                    max={Math.max(1, src.totalWeeks)}
                    suffix=" нед"
                    hint={`Длительность фазы «${pl}» (сумма блоков сейчас: ${phaseWeeks})`}
                    onChange={v => { if (Number.isFinite(v) && v >= 1) setEditWeeks(prev => ({ ...prev, [phase]: Math.min(src.totalWeeks, Math.round(v)) })); }}
                  />
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>сумма блоков: {phaseWeeks}</div>
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

      {/* ⚙️ Сборка цикла ББ: сплит + фазы → расписать в ручной режим / ББ-авто */}
      {isBB && builderForBlock >= 0 && bbMacro && (() => {
        const block = bbMacro.blocks[builderForBlock];
        if (!block) return null;
        const total = BB_PHASES.reduce((s, phase) => s + (builderWeeks[phase] || 0), 0);
        const splitOptions = SPLIT_PATTERNS.map(p => ({
          id: p.id,
          label: p.name,
          desc: `${p.sessionsPerRotation} дн/нед · ${p.description ?? ''}`,
        }));
        return (
          <div role="dialog" aria-modal="true" aria-label="Сборка цикла ББ" onClick={() => setBuilderForBlock(-1)}
            style={{ position: 'fixed', inset: 0, zIndex: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', padding: 12 }}>
            <div onClick={e => e.stopPropagation()} style={{ width: '92%', maxWidth: 440, maxHeight: '84vh', overflow: 'auto', borderRadius: 16, background: '#18181b', border: '1px solid rgba(255,255,255,0.12)' }}>
              <div style={{ height: 3, background: 'linear-gradient(90deg,#00e68a,#00c853)' }} />
              <div style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#00e68a' }}>⚙️ Сборка цикла ББ</div>
                  <button type="button" aria-label="Закрыть" onClick={() => setBuilderForBlock(-1)} style={{ minWidth: 44, minHeight: 44, border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 15 }}>✕</button>
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginBottom: 10, lineHeight: 1.5 }}>
                  Блок «{BB_PHASE_LABEL_RU[block.phase]}» ({block.weeks} нед). Выберите сплит, настройте фазы ББ-макроцикла и соберите цикл — затем отправьте его в ручной конструктор или ББ-авто.
                </div>
                <div style={{ marginBottom: 10 }}>
                  <PopupSelect
                    label="Сплит (генератор сплитов)"
                    value={builderSplit}
                    options={splitOptions}
                    hint="Раскладка тренировочных дней цикла. Рекомендуемый — первым в списке."
                    onChange={v => { setBuilderSplit(v); setBuilderPlan(null); setBuilderMsg(null); }}
                  />
                </div>
                <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.3, margin: '8px 0 6px' }}>
                  Фазы ББ-макроцикла (недель)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {BB_PHASES.map(phase => (
                    <div key={phase}>
                      <PopupNumber
                        label={`${BB_PHASE_ICON[phase]} ${BB_PHASE_LABEL_RU[phase]}`}
                        value={builderWeeks[phase] || 0}
                        min={0}
                        max={52}
                        suffix=" нед"
                        hint={`Недель фазы «${BB_PHASE_LABEL_RU[phase]}» в цикле (0 — фаза не входит).`}
                        onChange={v => { setBuilderWeeks(prev => ({ ...prev, [phase]: Math.max(0, Math.round(v)) })); setBuilderPlan(null); setBuilderMsg(null); }}
                      />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '8px 0' }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Итого недель:</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: total >= 4 ? '#00e68a' : '#f59e0b' }}>{total}</span>
                </div>
                {(builderWeeks.contest_prep || 0) > 0 && (
                  <>
                    <div style={{ marginBottom: 8 }}>
                      <PopupSelect
                        label="🎭 Категория шоу"
                        value={builderCategory}
                        options={PEAK_CATEGORY_OPTIONS}
                        hint="Категория влияет на протокол пик-недели (лёгкие категории — меньше натрия/углеводов). Значение — из профиля."
                        onChange={v => { setBuilderCategory(v); setBuilderPlan(null); setBuilderMsg(null); }}
                      />
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.25)', cursor: 'pointer', fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>
                      <input type="checkbox" checked={builderPeakWeek} onChange={e => { setBuilderPeakWeek(e.target.checked); setBuilderPlan(null); setBuilderMsg(null); }} style={{ width: 18, height: 18, accentColor: '#f59e0b' }} />
                      🎭 Применить пик-неделю (тапер ББ) к последней неделе contest prep — вода/натрий/карбы/позы
                    </label>
                  </>
                )}
                <button type="button" onClick={buildCycleFromBuilder} style={{ ...BTN, width: '100%', minHeight: 44, fontSize: 13 }}>
                  ⚙️ Собрать и расписать ({total} нед)
                </button>
                {builderMsg && (
                  <div role="status" style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, fontSize: 11, lineHeight: 1.5,
                    background: builderMsg.startsWith('✅') || builderMsg.startsWith('🚀') ? 'rgba(0,230,138,0.08)' : 'rgba(245,158,11,0.08)',
                    border: `1px solid ${builderMsg.startsWith('✅') || builderMsg.startsWith('🚀') ? 'rgba(0,230,138,0.25)' : 'rgba(245,158,11,0.3)'}`,
                    color: builderMsg.startsWith('✅') || builderMsg.startsWith('🚀') ? '#00e68a' : '#f59e0b' }}>
                    {builderMsg}
                  </div>
                )}
                {builderPlan && (
                  <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#00e68a', marginBottom: 4 }}>✅ Цикл собран:</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5, marginBottom: 8 }}>{builderPlan.label}</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button type="button" onClick={sendCycleToManual} style={{ ...BTN_GHOST, flex: 1, minHeight: 44, fontSize: 11 }}>📥 В ручной режим</button>
                      <button type="button" onClick={sendCycleToBbAuto} style={{ ...BTN, flex: 1, minHeight: 44, fontSize: 11 }}>🚀 В ББ-авто</button>
                    </div>
                  </div>
                )}
                <div style={{ marginTop: 10, padding: 8, borderRadius: 8, background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', fontSize: 10, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
                  🏁 <b style={{ color: '#f59e0b' }}>Тапер для ББ — единая система</b>: галочка выше накладывает пик-неделю на последнюю неделю contest prep (вода/натрий/карбы/позы). Полный протокол с настройками (категория, стратегии загрузки, день шоу по часам) — во вкладке «🏁 Тапер ББ» блока питания.
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default MacrocyclePanel;
