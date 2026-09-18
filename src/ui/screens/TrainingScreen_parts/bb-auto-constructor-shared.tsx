/**
 * bb-auto-constructor-shared.tsx — вынесенный non-JSX и служебный слой
 * ББ-авто конструктора (этап 1 разреза god-component, план §4.3):
 *  - `CollapsibleCard` (карточка-аккордеон шага 5);
 *  - типы шагов/фаз (`Step`, `PlanMode`, `BBPhase`);
 *  - константы групп/метки/фазовые техники и кэш фаз;
 *  - чистые хелперы фаз (`getPhaseMap`/`phaseForWeek`/`computePhases`),
 *    доноров (`normalizeDonorTargets`), комментариев (`exerciseComment`),
 *    годового контекста (`annualBlockCtxToPrepPatch`/`annualActiveBlockLine`),
 *    UI-меток (`backSubgroupLabel`/`armHeadLabel`), A/B-ротации
 *    (`isAbRotationActive`), стилей чипа (`chipBtn`), a11y inline-модалок
 *    (`useInlineDialogA11y`).
 *
 * Перенос 1-в-1 (поведение не меняется): `BbAutoConstructor` ре-экспортирует
 * публичные символы (`backSubgroupLabel/armHeadLabel/isAbRotationActive/
 * annualBlockCtxToPrepPatch/annualActiveBlockLine/PHASE_TECHNIQUES`) для
 * существующих потребителей и тестов.
 */
import React, { useEffect, useRef, useState } from 'react';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import { canonicalMuscle, expandDonorMuscles } from '../../../engines/bb/bb-specialization.engine';
import { MUSCLE_LABEL_RU } from '../../../engines/volume-landmarks.engine';
import { PATTERN_RU as SUMMARY_PATTERN_RU } from '../../../engines/bb/bb-summary.engine';
import { techniqueLabel } from './bb-technique-display';
import { distributePhases as distributePhasesUnified, type PhaseDistribution } from '../../../engines/periodization';
import {
  CATEGORY_PROFILES, isoAddDays, isoToday,
  canonicalWaterStrategy, canonicalSodiumStrategy,
  type BBContestPrepConfig, type BBContestCategory, type ContestSpecialization,
  type WaterStrategy, type SodiumStrategy, type CarbLoadStrategy,
} from '../../../engines/bb/bb-contest-prep.engine';
import { activeBlockForWeek, weekForDate } from '../../../engines/annual-training/block-builders.engine';
import type { AnnualTrainingPlan } from '../../../engines/annual-training/annual-training.types';
import type { BBExercise } from '../../../engines/bb/bb-builder.engine';
import { ACCENT, CARD } from './training-ui';

/* ── 4.5 (мобилка): APK-кит — переключатели вместо нативных checkbox.
      Касание ≥44px, шрифты ≥10px, aria role=switch/aria-checked. ── */

/** Переключатель-строка: заголовок + описание + трек/тамб (минимальная высота 44px). */
export const BbRowSwitch: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  title: React.ReactNode;
  desc?: React.ReactNode;
  icon?: string;
  accent?: string;
  ariaLabel?: string;
  /** Заблокирован (настройка не действует в текущем режиме) — честный гейт. */
  disabled?: boolean;
}> = ({ checked, onChange, title, desc, icon, accent = ACCENT, ariaLabel, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={ariaLabel}
    aria-disabled={disabled}
    onClick={() => { if (!disabled) onChange(!checked); }}
    style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 6px',
      padding: '10px 12px', minHeight: 44, borderRadius: 12, cursor: disabled ? 'not-allowed' : 'pointer', textAlign: 'left',
      boxSizing: 'border-box', fontFamily: 'inherit', opacity: disabled ? 0.5 : 1,
      background: checked ? `linear-gradient(135deg, ${accent}1e, rgba(24,24,27,0.35))` : 'rgba(255,255,255,0.03)',
      border: checked ? `1px solid ${accent}66` : '1px solid rgba(255,255,255,0.08)',
      transition: 'all .15s',
    }}
  >
    {icon && <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>}
    <span style={{ flex: 1, minWidth: 0 }}>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: checked ? accent : '#fff', lineHeight: 1.25 }}>{title}</span>
      {desc && <span style={{ display: 'block', fontSize: 10, color: '#fff', lineHeight: 1.35, marginTop: 2 }}>{desc}</span>}
    </span>
    <span style={{ marginLeft: 'auto', width: 36, height: 20, borderRadius: 10, flexShrink: 0, position: 'relative', background: checked ? accent : 'rgba(255,255,255,0.15)', transition: 'background .2s' }}>
      <span style={{ position: 'absolute', top: 2, left: checked ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
    </span>
  </button>
);

/** Компактный чип-переключатель (чек-листы, инлайн-ряды): ≥44px, aria-pressed-семантика. */
export const BbToggleChip: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
  accent?: string;
  ariaLabel?: string;
}> = ({ checked, onChange, label, accent = '#22c55e', ariaLabel }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={ariaLabel}
    onClick={() => onChange(!checked)}
    style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, padding: '6px 12px',
      borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
      fontSize: 11, fontWeight: checked ? 800 : 600,
      background: checked ? `${accent}22` : 'rgba(255,255,255,0.04)',
      border: checked ? `1px solid ${accent}66` : '1px solid rgba(255,255,255,0.1)',
      color: checked ? accent : '#fff',
    }}
  >
    <span aria-hidden style={{ fontSize: 12 }}>{checked ? '✓' : '○'}</span>
    <span style={{ minWidth: 0 }}>{label}</span>
  </button>
);


/* ── Единый стиль карточек шагов 1–2 (аудит «дубли шаг 1-2»): иконка-тайл,
      заголовок, подпись, бейдж, акцентная верхняя кромка. Один визуальный
      язык для всех секций параметров/PED — вместо разнородных карточек. ── */

/** Базовая карточка секции: иконка + заголовок + подпись + контент. */
export const BbCard: React.FC<{
  icon?: string;
  title: React.ReactNode;
  desc?: React.ReactNode;
  accent?: string;
  badge?: React.ReactNode;
  children?: React.ReactNode;
}> = ({ icon, title, desc, accent = '#a855f7', badge, children }) => (
  <section style={{
    marginBottom: 10, padding: '10px 12px', borderRadius: 14, boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.025)',
    border: `1px solid ${accent}2e`, borderTop: `2px solid ${accent}55`,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: desc || children ? 8 : 0 }}>
      {icon && (
        <span aria-hidden style={{
          width: 26, height: 26, borderRadius: 9, flexShrink: 0, fontSize: 14,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: `${accent}1f`, border: `1px solid ${accent}44`,
        }}>{icon}</span>
      )}
      <span style={{ fontSize: 12.5, fontWeight: 800, color: '#fff', letterSpacing: 0.2 }}>{title}</span>
      {badge && (
        <span style={{
          marginLeft: 'auto', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999,
          background: `${accent}1a`, color: accent, border: `1px solid ${accent}44`,
        }}>{badge}</span>
      )}
    </div>
    {desc && <div style={{ fontSize: 10.5, color: '#fff', lineHeight: 1.45, marginBottom: children ? 8 : 0 }}>{desc}</div>}
    {children}
  </section>
);

/** Карточка-аккордеон (необязательные/второстепенные секции): тот же стиль, шапка-кнопка. */
export const BbFoldCard: React.FC<{
  icon?: string;
  title: React.ReactNode;
  desc?: React.ReactNode;
  accent?: string;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children?: React.ReactNode;
}> = ({ icon, title, desc, accent = '#60a5fa', badge, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section style={{
      marginBottom: 10, padding: '10px 12px', borderRadius: 14, boxSizing: 'border-box',
      background: 'rgba(255,255,255,0.025)',
      border: `1px solid ${accent}2e`, borderTop: `2px solid ${accent}55`,
    }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          padding: 0, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
          fontFamily: 'inherit', minHeight: 28,
        }}
      >
        {icon && (
          <span aria-hidden style={{
            width: 26, height: 26, borderRadius: 9, flexShrink: 0, fontSize: 14,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: `${accent}1f`, border: `1px solid ${accent}44`,
          }}>{icon}</span>
        )}
        <span style={{ fontSize: 12.5, fontWeight: 800, color: '#fff', letterSpacing: 0.2 }}>{title}</span>
        {badge && (
          <span style={{
            marginLeft: 'auto', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999,
            background: `${accent}1a`, color: accent, border: `1px solid ${accent}44`,
          }}>{badge}</span>
        )}
        <span aria-hidden style={{
          marginLeft: badge ? 6 : 'auto', fontSize: 11, color: '#fff',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s', display: 'inline-block',
        }}>▾</span>
      </button>
      {desc && <div style={{ fontSize: 10.5, color: '#fff', lineHeight: 1.45, marginTop: 6 }}>{desc}</div>}
      {open && <div style={{ marginTop: 8 }}>{children}</div>}
    </section>
  );
};

/* ── CollapsibleCard helper для шага 5 (заголовок-кнопка карточки) ── */
export const CollapsibleCard: React.FC<{
  title: string;
  defaultOpen?: boolean;
  headerStyle?: React.CSSProperties;
  badge?: string;
  children: React.ReactNode;
}> = ({ title, defaultOpen = false, headerStyle, badge, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ ...CARD, padding: 0, overflow: 'hidden', marginTop: 8 }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '11px 12px',
          cursor: 'pointer',
          background: headerStyle?.background || 'linear-gradient(135deg, rgba(96,165,250,0.10), rgba(96,165,250,0.03))',
          border: 'none',
          borderBottom: open ? '1px solid rgba(255,255,255,0.06)' : 'none',
          textAlign: 'left',
          ...headerStyle,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 800, color: headerStyle?.color || '#fff' }}>{title}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {badge && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: 'rgba(255,255,255,0.07)', color: '#fff', border: '1px solid rgba(255,255,255,0.08)' }}>{badge}</span>}
          <span style={{ fontSize: 11, color: '#fff', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', display: 'inline-block' }}>▼</span>
        </span>
      </button>
      <div style={{ display: open ? 'block' : 'none', padding: '10px 12px' }}>{children}</div>
    </div>
  );
};

export type Step = 'params' | 'ped' | 'split' | 'plan' | 'weights' | 'quality' | 'adjust' | 'contest' | 'annual' | 'tools';
export type BBPhase = 'accumulation' | 'intensification' | 'deload' | 'peaking';
export type PlanMode = 'generic_split' | 'bb_cycle' | 'programs';

export const WEAK_GROUPS = [
  ['chest','Грудь'],['chest_upper','Верх груди'],['chest_lower','Низ груди'],
  ['back','Спина'],['back_width','Ширина спины'],['back_thickness','Толщина спины'],
  ['shoulders','Плечи (общее)'],['delt_front','Передняя дельта'],['delt_mid','Средняя дельта'],['delt_rear','Задняя дельта'],
  ['quads','Квадрицепс'],['hamstrings','Бицепс бедра'],['glutes','Ягодицы'],['calves','Икры'],
  ['biceps','Бицепс'],['triceps','Трицепс'],['forearms','Предплечья'],
  ['abs','Пресс'],['traps','Трапеции'],
] as const;
export const BB_WM_KEYS = ['chest','back','quads','hamstrings','shoulders','biceps','triceps','glutes','calves','abs'] as const;
export const BB_WM_RU: Record<string,string> = { chest:'Грудь', back:'Спина', quads:'Квадрицепсы', hamstrings:'Бицепс бедра', shoulders:'Плечи', biceps:'Бицепс', triceps:'Трицепс', glutes:'Ягодичные', calves:'Икры', abs:'Пресс' };
export const TAG_LABELS_RU: Record<string, string> = {
  Push: 'Толкающие', Pull: 'Тянущие', Legs: 'Ноги', Upper: 'Верх', Lower: 'Низ',
  FullBody: 'Всё тело', Chest: 'Грудь', Back: 'Спина', Shoulders: 'Плечи', Arms: 'Руки',
  ChestBack: 'Грудь+Спина', ShouldersArms: 'Плечи+Руки', Torso: 'Торс', Limbs: 'Конечности',
  UpperPower: 'Верх(сила)', LowerPower: 'Низ(сила)', UpperHyp: 'Верх(гиперт)', LowerHyp: 'Низ(гиперт)',
  };
/**
 * Техники-подсказки по фазам (UI-тексты). Волна 5.5 (BB-AUTO-EXHAUSTIVE-PRO):
 * формулировки — тайм-эффективность/управление утомлением, не превосходство
 * (Sødal 2023: drop ≈ традиционные подходы, SMD 0.04; rest-pause — небольшой плюс;
 * Havers 2026 / Tsartsapakis 2026; Enes 2025 — темп минимально влияет при равном усилии).
 */
export const PHASE_TECHNIQUES: Record<BBPhase, string[]> = {
  accumulation: ['Темповые повторы (TUT)', 'Пауза в растянутой позиции', 'Суперсеты антагонистов'],
  intensification: ['Дроп-сеты (последний подход)', 'Рест-пауза (compounds)', 'Форсированные повторы (с партнёром)'],
  deload: ['Медленные негативы', 'Стрейч-пауза'],
  peaking: ['Околопредельные веса (RIR 0)', 'Кластеры 5×2'],
};

// P2-6: ограниченный кеш (max 8 записей — достаточно для типичных значений weeks 4-24).
const _phaseMapCache = new Map<string, Map<number, BBPhase>>();
export function getPhaseMap(totalWeeks: number, goal: string = 'mass'): Map<number, BBPhase> {
  const cacheKey = `${totalWeeks}:${goal}`;
  if (_phaseMapCache.has(cacheKey)) return _phaseMapCache.get(cacheKey)!;
  // P2-6: evict oldest if cache > 8 entries (anti-leak)
  if (_phaseMapCache.size >= 8) {
    const firstKey = _phaseMapCache.keys().next().value;
    if (firstKey) _phaseMapCache.delete(firstKey);
  }
  // P1: синхронизируем deloadFreq с движком buildBBPlan (deloadFreq = weeks>=6 ? 4 : 0),
  // иначе календарь/баннер показывал «без делода», а сгенерированный план содержал deload-неделю.
  const deloadFreq = totalWeeks >= 6 ? 4 : 0;
  const dist: PhaseDistribution[] = distributePhasesUnified(totalWeeks, deloadFreq, goal as any);
  const map = new Map<number, BBPhase>();
  for (const d of dist) {
    for (const w of d.weeks) {
      map.set(w, d.phase as BBPhase);
    }
  }
  for (let w = 1; w <= totalWeeks; w++) {
    if (!map.has(w)) map.set(w, 'accumulation' as BBPhase);
  }
  _phaseMapCache.set(cacheKey, map);
  return map;
}

export function phaseForWeek(week: number, totalWeeks: number, goal: string = 'mass'): BBPhase {
  return getPhaseMap(totalWeeks, goal).get(week) || 'accumulation';
}

/** Проверка: мышца в списке слабых групп (с учётом родительских групп). */
export function isWeakMuscle(muscle: string, weakPoints: string[]): boolean {
  if (weakPoints.includes(muscle)) return true;
  const PARENT: Record<string, string> = { delt_front: 'shoulders', delt_mid: 'shoulders', delt_rear: 'shoulders' };
  return weakPoints.includes(PARENT[muscle] ?? '');
}

export const DONOR_GROUPS: readonly (readonly [string, string])[] = [
  ['legs', 'Ноги (квадры+хамсы+ягодицы+икры)'],
  ['arms', 'Руки (бицепс+трицепс+предплечья)'],
  ['core', 'Кор'],
  ...WEAK_GROUPS,
];

export function normalizeDonorTargets(donors: string[], targets: string[] = []): string[] {
  const targetCanonical = targets.map(canonicalMuscle);
  const out: string[] = [];
  const expandedOut: string[] = [];
  for (const donor of donors) {
    if (!donor || out.includes(donor) || out.length >= 2) continue;
    const expanded = expandDonorMuscles([donor]);
    if (expanded.some(m => targetCanonical.includes(canonicalMuscle(m)))) continue;
    if (expanded.some(m => expandedOut.includes(canonicalMuscle(m)))) continue;
    out.push(donor);
    expandedOut.push(...expanded.map(canonicalMuscle));
  }
  return out;
}


/** Метка подгруппы спины (backSubgroup) для UI-бейджа. */
export function backSubgroupLabel(sub: string): string {
  switch (sub) {
    case 'back_width': return '📐 Ширина (латы)';
    case 'back_thickness': return '📐 Толщина';
    case 'upper_back': return '📐 Верх спины';
    case 'rear_delts': return '📐 Задние дельты';
    case 'traps': return '📐 Трапеции';
    case 'erectors': return '📐 Разгибатели';
    default: return '';
  }
}

/** Метка головки руки (movementPattern) для UI-бейджа. */
export function armHeadLabel(pattern: string): string {
  switch (pattern) {
    case 'biceps_lengthened': return '🦴 Длинная гол. (растяжка)';
    case 'biceps_shortened': return '🦴 Короткая гол.';
    case 'biceps_hammer': return '🦴 Брахиалис (молот)';
    case 'triceps_overhead': return '🦴 Длинная гол. (overhead)';
    case 'triceps_pushdown': return '🦴 Латер./мед. (pushdown)';
    case 'triceps_compound': return '🦴 Compound (жим узк.)';
    case 'forearm': return '🦴 Предплечья';
    default: return '';
  }
}

/** A/B-ротация реально применена в плане: хотя бы одна сессия несёт
 *  stash'нутый avoid (abAvoidPatterns). Тогл вкл ≠ применена: faithful
 *  дословно и недели без sibling-сессий ротацию не включают. */
export function isAbRotationActive(plan: any): boolean {
  try {
    return (plan?.weeks || []).some((w: any) => (w?.sessions || []).some((s: any) => ((s as any).abAvoidPatterns || []).length > 0));
  } catch { return false; }
}

/** Мини-чип для параметров упражнения (общий из training-ui). */

/* ─── Годовой план → ББ-авто: маппер контекста блока (he_bb_plan_saved_ctx) ─── */

/** Параметры шага «🏁 Contest prep», предзаполненные из контекста блока года. */
export interface AnnualBlockCtxToPrepPatch {
  peakWeekCategory: BBContestCategory;
  peakSpec: ContestSpecialization;
  prepShowDate: string;
  prepTaperWeeks: number;
  prepWeeks: number;
  prepWaterMode: WaterStrategy;
  prepSodiumMode: SodiumStrategy;
  prepCarbMode: CarbLoadStrategy;
  prepConfirmedManip: boolean;
}

/** Чистый маппер peakConfig блока годового плана → предзаполнение шага contest. */
export function annualBlockCtxToPrepPatch(
  ctx: { peakWeek?: boolean; weeks?: number; peakConfig?: Record<string, unknown> | null },
): AnnualBlockCtxToPrepPatch | null {
  if (!ctx.peakWeek || !ctx.peakConfig) return null;
  const cfg = ctx.peakConfig as Partial<BBContestPrepConfig>;
  const category = cfg.category && cfg.category in CATEGORY_PROFILES
    ? (cfg.category as BBContestCategory) : 'mens_physique';
  return {
    peakWeekCategory: category,
    peakSpec: cfg.specialization ?? 'none',
    prepShowDate: cfg.showDate ?? isoAddDays(isoToday(), 8 * 7),
    prepTaperWeeks: Number.isFinite(cfg.weeksOut) ? Math.min(4, Math.max(1, Math.round(cfg.weeksOut!))) : 2,
    prepWeeks: ctx.weeks && ctx.weeks > 0 ? Math.min(52, Math.max(1, Math.round(ctx.weeks))) : 12,
    prepWaterMode: canonicalWaterStrategy(cfg.waterStrategy ?? 'stable') as unknown as WaterStrategy,
    prepSodiumMode: canonicalSodiumStrategy(cfg.sodiumStrategy ?? 'stable') as unknown as SodiumStrategy,
    prepCarbMode: (cfg.carbLoadStrategy === 'front' ? 'high' : cfg.carbLoadStrategy === 'back' ? 'conservative' : 'moderate') as unknown as CarbLoadStrategy,
    prepConfirmedManip: !!cfg.confirmedManipulation,
  };
}

export function computePhases(totalWeeks: number, goal: string = 'mass'): { week: number; phase: BBPhase }[] {
  const phases: { week: number; phase: BBPhase }[] = [];
  for (let w = 1; w <= totalWeeks; w++) {
    const p = phaseForWeek(w, totalWeeks, goal);
    phases.push({ week: w, phase: p });
  }
  return phases;
}

export function exerciseComment(ex: BBExercise, weakPoints: string[], focusGroup: string, phase: BBPhase): string {
  const parts: string[] = [];
  const ruMuscle = (MUSCLE_LABEL_RU as any)[ex.muscle] || ex.muscle;
  // Роль упражнения — подробно
  if (ex.role === 'primary') {
    parts.push(`🎯 Основное движение для «${ruMuscle}» — тяжёлая база, главный стимул гипертрофии этой группы`);
    if (weakPoints.includes(ex.muscle)) parts.push(`🔥 Акцент на отстающую «${ruMuscle}» — дополнительный объём и приоритет в начале дня`);
    if (focusGroup === ex.muscle) parts.push(`⭐ Группа специализации «${ruMuscle}» — повышенный приоритет объёма`);
  } else {
    parts.push(`📌 Добивочное для «${ruMuscle}» — изоляция/добивка после базы, RIR 2-3, контроль техники`);
  }
  // Характер нагрузки — развёрнуто
  if (ex.character === 'тяж') parts.push('💪 Характер: тяж — 6-10 повторов, RIR 1-2, максимум механического натяга, отдых 2-3 мин');
  else if (ex.character === 'памп') parts.push('🩸 Характер: памп — 12-20 повторов, RIR 3, метаболический стресс и жжение, пауза 45-60 сек');
  else parts.push('🌿 Характер: лёгкий — техника/восстановление, RIR 4');
  // Фаза — адаптация
  const phaseDesc: Record<string, string> = {
    accumulation: 'Фаза «Накопление»: умеренный вес, больший объём, темп 3-1-1-0, акцент на растянутой позиции',
    intensification: 'Фаза «Интенсификация»: тяжёлый вес, RIR 1-2, темп 2-0-1-0, максимум напряжения',
    deload: 'Фаза «Разгрузка»: 50% объёма, RIR 3-4, лёгкие веса — восстановление ЦНС и суставов',
    peaking: 'Фаза «Пик»: минимальный объём, околопредельные веса RIR 0-1 — реализация силы',
  };
  if (phaseDesc[phase]) parts.push(`📅 ${phaseDesc[phase]}`);
  // Паттерн движения — по-русски, из каталога или movementPattern упражнения
  const catalogEx: any = EXERCISE_CATALOG.find((e: any) => e.name === ex.name || e.id === (ex as any).exerciseName);
  const rawPat = catalogEx?.movementPattern || (ex as any).movementPattern || '';
  const patRu = rawPat ? (SUMMARY_PATTERN_RU[rawPat] || rawPat) : '';
  if (patRu) parts.push(`🧬 Паттерн: ${patRu}`);
  // Дополнительные мышцы (синергисты) — по-русски
  if (catalogEx?.targetMuscle) {
    const targets = String(catalogEx.targetMuscle).split(',').map((t: string) => t.trim()).filter((t: string) => t && t !== ex.muscle);
    if (targets.length) parts.push(`🎯 Дополнительно нагружает: ${targets.map((t: string) => (MUSCLE_LABEL_RU as any)[t] || t).join(', ')}`);
  }
  // Суперсет / техника
  const ss = (ex as any).supersetWith;
  if (ss) parts.push(`🔗 Суперсет с «${ss}» — выполняется без отдыха между упражнениями пары`);
  const lastTech: any = (ex as any).workSets?.[ (ex as any).workSets.length - 1]?.technique;
  if (lastTech) {
    const tLabel = techniqueLabel(lastTech);
    if (tLabel) parts.push(`💥 Интенсив-техника: ${tLabel} на последнем подходе — продлевает сет за отказом`);
  }
  // Вес / RIR / отдых — факт плана
  const w = (ex as any).workSets?.[0]?.weight ?? 0;
  const r = (ex as any).workSets?.[0]?.reps ?? ex.sets;
  const rir = (ex as any).rir ?? 2;
  const rest = (ex as any).restSeconds ?? (ex as any).workSets?.[0]?.restSeconds;
  if (w) parts.push(`⚙️ Нагрузка плана: ${ex.sets}×${r} @ ${w} кг, RIR ${rir}${rest ? `, отдых ${rest} сек` : ''}`);
  return parts.join(' · ');
}

/** п.18: строка карточки «📍 Текущий блок года» для даты (null — нет плана/активного блока). */
export function annualActiveBlockLine(plan: AnnualTrainingPlan | null, iso: string): string | null {
  if (!plan) return null;
  const w = weekForDate(iso);
  const active = w != null ? activeBlockForWeek(plan, w) : null;
  if (!active) return null;
  const statusIcon = active.status === 'built' ? '✅' : active.status === 'stale' ? '⚠' : active.status === 'error' ? '❌' : '·';
  const statusLabel = active.status === 'built' ? 'собран' : active.status === 'stale' ? 'устарел' : active.status === 'error' ? 'ошибка' : 'не собран';
  const kindLabel = active.ref.kind === 'PL' ? 'ПЛ' : active.ref.kind === 'BB' ? 'ББ' : '✍ Ручной';
  const prepNote = active.ref.kind === 'BB' && active.ref.phase === 'contest_prep' && active.status === 'built'
    ? ' · 🏁 contest prep — настройте пик в «🏁 Contest prep»' : '';
  return `📍 Текущий блок года: нед ${w} · ${active.ref.phase} (${active.ref.startWeek}–${active.ref.startWeek + active.ref.weeks - 1}) · ${kindLabel} ${statusIcon} ${statusLabel}${prepNote}`;
}


/** Чип-кнопка для выбора акцентов/минимума/режима в Prep-цикле. */
export const chipBtn = (label: string, on = false, danger = false): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '8px 11px', borderRadius: 12, cursor: 'pointer',
  minHeight: 36, fontSize: 11, fontWeight: on ? 800 : 600,
  background: on ? (danger ? 'rgba(239,68,68,0.18)' : 'rgba(236,72,153,0.18)') : 'rgba(255,255,255,0.04)',
  border: on ? `1px solid ${danger ? '#ef4444' : '#ec4899'}66` : '1px solid rgba(255,255,255,0.1)',
  color: on ? (danger ? '#f87171' : '#ec4899') : '#fff',
});

/**
 * 4.4: единый a11y-паттерн inline-модалок ББ-авто — role=dialog/aria-modal + Escape +
 * фокус на диалог/возврат фокуса (как TrainingModal; без визуального churn).
 */
export function useInlineDialogA11y(active: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!active) return;
    const prev = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => ref.current?.focus(), 0);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(); };
    document.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); document.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [active]);
  return ref;
}
