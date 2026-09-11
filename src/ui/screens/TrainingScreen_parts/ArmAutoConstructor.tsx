/**
 * ArmAutoConstructor.tsx — PRO-конструктор армрестлинг/армлифтинг.
 * Изолирован, как BbAutoConstructor, но для arm-движка.
 * 7 шагов в стиле ББ-авто (модерн): params → athlete → grip → split → plan → quality → export.
 * Подача — training-ui токены (CARD/BTN/STEP_PILL) + группы ПАРАМЕТРЫ/ПЛАН/ВЫДАЧА;
 * DOM-контракты (классы .ad-*, data-arm хуки, строки, aria) 1-в-1.
 */
import React, { useMemo, useState, useEffect } from 'react';
import { buildArmPlan } from '../../../engines/arm/arm-builder.engine';
import { finalizeArmPlan } from '../../../engines/arm/arm-finalize.engine';
import { rankArmSplits } from '../../../engines/arm/arm-selector.engine';
import { buildArmSchedule } from '../../../engines/arm/arm-specialization.engine';
import { validateArmPlan } from '../../../engines/arm/arm-validator.engine';
import { calcArmMetrics } from '../../../engines/arm/arm-metrics.engine';
import { buildArmReport } from '../../../engines/arm/arm-report.engine';
import { buildArmPrintHtml, buildArmIcs } from '../../../engines/arm/arm-export.engine';
import { ARM_SPLIT_PATTERNS } from '../../../engines/arm/arm-split-patterns';
import { ARM_MUSCLE_RU } from '../../../engines/arm/arm-types';
import { injectArmCorrections } from '../../../engines/arm/arm-diagnostics-injection.engine';
import { buildWafStartCard } from '../../../engines/arm/arm-waf.engine';
import { PLATFORM_WR, planAttempts, platformWrFor, platformIsInternal } from '../../../engines/arm/arm-platform.engine';
import { WAF_FOULS, WAF_FOULS_OUT_AFTER } from '../../../engines/arm/arm-start-strap.engine';
import { buildSupermatchPlan } from '../../../engines/arm/arm-supermatch.engine';
import { profileOpponent } from '../../../engines/arm/arm-matchup.engine';
import { ladderAdvice } from '../../../engines/arm/arm-implement-ladder.engine';
import { buildArmCalendar, superSeriesYear } from '../../../engines/arm/arm-calendar.engine';
import { buildContestSimWeek } from '../../../engines/arm/arm-contest-sim.engine';
import { buildGripRpe } from '../../../engines/arm/arm-grip-rpe.engine';
import { ARM_CYCLE_LIBRARY, fitCycleToWeeks } from '../../../engines/arm/arm-cycle-library.engine';
import { rankArmCycles } from '../../../engines/arm/arm-cycle-selector.engine';
import { GRIP_IMPLEMENTS, type ArmImplement } from '../../../engines/arm/arm-grip.engine';
import { ARM_MEDLEYS, getMedley } from '../../../engines/arm/arm-medley.engine';
import { buildArmProSummary } from '../../../engines/arm/arm-pro-integration.engine';
import { planBilateralVolume } from '../../../engines/arm/arm-bilateral.engine';
import { planWeightCut, weeksUntilStart } from '../../../engines/arm/arm-competition-prep.engine';
import { ARM_EXERCISES } from '../../../core/exercise-catalog-arm';
import { buildArmBlock, buildArmYearBlocks } from '../../../engines/arm/arm-annual';
import { loadForceTrials, buildWeeklyStats, fatigueTrend, forceTrend } from '../../../engines/arm/arm-force-history.store';
import type { ArmWeakPoint } from '../../../engines/arm/arm-biomechanics.engine';
import { ArmTechniqueCard } from './ArmTechniqueCard';
import { ArmGripCard } from './ArmGripCard';
import { ArmHeatmap } from './ArmHeatmap';
import { useDataLink } from '../../../core/data-link';
import { subscribePlannerApply, getPlannerApply } from './planner-bridge';
import './arm-design.css';
import { CARD, SMALL, BTN, BTN_GHOST, H, STEP_PILL, IN } from './training-ui';
import { AdSwitch, AdSheetSelect } from './arm-design-system';
import { isNativeApp } from '../../../core/app-platform';
import { ensureArmApkStyles } from './arm-apk-loader';

/* ── BB-modern presentation primitives (Ad* DOM contracts kept 1-в-1:
 * classes .ad-* + data-arm hooks + aria, только инлайн-стиль в токенах
 * training-ui как в BbAutoConstructor) ── */
type AdStepDef = { id: string; label: string };
function AdRoot({ rootClass, maxWidth, children }: { rootClass: string; maxWidth?: number; children: React.ReactNode }) {
  React.useEffect(() => { ensureArmApkStyles(); }, []);
  return <div className={isNativeApp() ? `${rootClass} arm-apk ad-wrap` : `${rootClass} ad-wrap`} style={maxWidth ? { maxWidth, margin: '0 auto', padding: '0 10px 90px' } : undefined}>{children}</div>;
}
function AdHead({ icon, title, sub, side }: { icon: string; title: string; sub?: string; side?: React.ReactNode }) {
  return (
    <div className="ad-head" style={{ ...CARD, display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', flexWrap: 'wrap' }}>
      <div className="ad-head-ic" aria-hidden style={{ fontSize: 26, lineHeight: 1, width: 44, height: 44, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, rgba(0,230,138,0.22), rgba(0,200,160,0.08))', border: '1px solid rgba(0,230,138,0.35)', flexShrink: 0 }}>{icon}</div>
      <div className="ad-head-tx" style={{ flex: 1, minWidth: 0 }}>
        <h2 className="ad-head-title" style={{ ...H, margin: 0 }}>{title}</h2>
        {sub ? <p className="ad-head-sub" style={{ ...SMALL, margin: '4px 0 0', color: '#fff' }}>{sub}</p> : null}
      </div>
      {side ? <div className="ad-head-side" style={{ flexShrink: 0 }}>{side}</div> : null}
    </div>
  );
}
function AdCard({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={className ? `ad-card ${className}` : 'ad-card'} style={{ ...CARD, padding: '10px 12px' }} {...rest}>{children}</div>;
}
function AdSec({ title, hint, children, hook, collapsible, defaultOpen, summary, status }: { title: React.ReactNode; hint?: React.ReactNode; children: React.ReactNode; hook?: string; collapsible?: boolean; defaultOpen?: boolean; summary?: React.ReactNode; status?: 'ok' | 'warn' }) {
  const [open, setOpen] = React.useState(defaultOpen ?? true);
  const dot = status ? <span className="ad-dot" data-s={status} aria-hidden style={{ width: 8, height: 8, borderRadius: 99, background: status === 'ok' ? '#00e68a' : '#f59e0b', display: 'inline-block', marginRight: 6 }} /> : null;
  if (!collapsible) {
    return (
      <div className="ad-sec" {...(hook ? { 'data-arm': hook } : {})} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '8px 10px', marginTop: 6 }}>
        <div className="ad-sec-t" style={{ fontSize: 13, fontWeight: 800, color: '#fff', marginBottom: 4 }}>{dot}{title}</div>
        {hint ? <div className="ad-sec-hint" style={{ ...SMALL, marginBottom: 4 }}>{hint}</div> : null}
        {children}
      </div>
    );
  }
  return (
    <div className="ad-sec" {...(hook ? { 'data-arm': hook } : {})} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: open ? '8px 10px' : '0 10px', marginTop: 6 }}>
      <button type="button" className="ad-sec-head" aria-expanded={open} onClick={() => setOpen((o) => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0', cursor: 'pointer', background: 'transparent', border: 'none', color: '#fff', fontSize: 13, fontWeight: 800, textAlign: 'left' }}>
        <span className="ad-sec-chev" aria-hidden style={{ color: '#00e68a', fontSize: 12 }}>{open ? '▾' : '▸'}</span>
        {dot}
        <span className="ad-sec-t" style={{ flex: 1 }}>{title}</span>
        {!open && summary ? <span className="ad-sec-sum" style={{ ...SMALL, color: '#fff' }}>{summary}</span> : null}
      </button>
      {open ? <div className="ad-sec-body" data-collapsed={!open} style={{ paddingBottom: 8 }}>{hint ? <div className="ad-sec-hint" style={{ ...SMALL, marginBottom: 4 }}>{hint}</div> : null}{children}</div> : <div className="ad-sec-body" data-collapsed={!open} style={{ display: 'none' }}>{children}</div>}
    </div>
  );
}
function AdGrid({ cols, children }: { cols: '2' | '3' | 'auto' | 'auto-sm'; children: React.ReactNode }) {
  return <div className="ad-grid" data-cols={cols} style={{ display: 'grid', gap: 6, gridTemplateColumns: cols === '3' ? 'repeat(auto-fit, minmax(150px, 1fr))' : cols === '2' ? 'repeat(auto-fit, minmax(180px, 1fr))' : '1fr' }}>{children}</div>;
}
function AdField({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  const styled = React.Children.map(children, (ch) => {
    if (React.isValidElement(ch) && (ch.type === 'input' || ch.type === 'select')) return React.cloneElement(ch as React.ReactElement<any>, { style: { ...(ch.props as any).style, ...IN, width: '100%' } });
    return ch;
  });
  return <label className="ad-field" style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, fontWeight: 700, color: '#fff' }}><span className="ad-fl">{label}</span>{styled}</label>;
}

function AdChip({ active, children, onClick, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return <button className="ad-chip" data-active={!!active} aria-pressed={!!active} onClick={onClick} style={{ padding: '8px 12px', borderRadius: 999, fontSize: 11, fontWeight: !!active ? 800 : 500, cursor: 'pointer', minHeight: 44, border: !!active ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.1)', background: !!active ? 'linear-gradient(135deg,#00e68a 0%, #00c8a0 100%)' : 'rgba(255,255,255,0.04)', color: !!active ? '#06281c' : '#fff' }} {...rest}>{children}</button>;
}
function AdBtn({ variant = 'primary', block, hero, children, onClick, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'amber' | 'danger' | 'dark'; block?: boolean; hero?: boolean }) {
  const st = variant === 'primary' ? BTN : BTN_GHOST;
  return <button className={`ad-btn${block ? ' ad-btn-block' : ''}${hero ? ' ad-btn-hero' : ''}`} data-variant={variant} onClick={onClick} style={{ ...st, ...(block ? { width: '100%' } : {}), ...(hero ? { fontSize: 14, padding: '14px 16px' } : {}) }} {...rest}>{children}</button>;
}
function AdBanner({ tone = 'info', children, hook }: { tone?: 'info' | 'ok' | 'warn' | 'bad'; children: React.ReactNode; hook?: string }) {
  const color = tone === 'ok' ? '#00e68a' : tone === 'warn' ? '#f59e0b' : tone === 'bad' ? '#ef4444' : '#60a5fa';
  return <div className="ad-banner" data-tone={tone} {...(hook ? { 'data-arm': hook } : {})} style={{ marginTop: 6, padding: '8px 10px', borderRadius: 12, background: `${color}14`, border: `1px solid ${color}44`, borderLeft: `3px solid ${color}`, fontSize: 12, color: '#fff', lineHeight: 1.5 }}>{children}</div>;
}
function AdEmpty({ icon, title, sub, children }: { icon: string; title: string; sub?: string; children?: React.ReactNode }) {
  return <div className="ad-empty" style={{ textAlign: 'center', padding: '18px 12px' }}><div className="ad-empty-ic" aria-hidden style={{ fontSize: 32 }}>{icon}</div><div className="ad-empty-t" style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginTop: 6 }}>{title}</div>{sub ? <p className="ad-empty-s" style={{ ...SMALL, marginTop: 4 }}>{sub}</p> : null}{children ? <div style={{ marginTop: 10 }}>{children}</div> : null}</div>;
}
function AdCta({ children }: { children: React.ReactNode }) {
  return <div className="ad-cta" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, position: 'sticky', bottom: 8, zIndex: 5 }}>{children}</div>;
}

type Step = 'params'|'athlete'|'grip'|'split'|'plan'|'quality'|'export'|'year';

const LEVELS = ['beginner','intermediate','advanced','enhanced'] as const;
const GOALS = [
  { id: 'strength', label: 'Сила' },
  { id: 'hypertrophy', label: 'Масса предплечья' },
  { id: 'peaking', label: 'Пик к старту' },
  { id: 'endurance', label: 'Выносливость' },
  { id: 'maintenance', label: 'Поддержание' },
] as const;
const TECHNIQUES = [
  { id: 'balanced', label: 'Сбалансировано' },
  { id: 'hook', label: 'Хук' },
  { id: 'toproll', label: 'Топролл' },
  { id: 'press', label: 'Пресс' },
] as const;
const DISCIPLINES = [
  { id: 'armwrestling', label: 'Армрестлинг' },
  { id: 'armlifting', label: 'Армлифтинг' },
  { id: 'hybrid', label: 'Гибрид' },
] as const;
const GRIP_FOCI = [
  { id: 'support', label: 'Поддержка (RT/Axle)' },
  { id: 'pinch', label: 'Щипок (Saxon/Hub)' },
  { id: 'crush', label: 'Дробление (CoC)' },
  { id: 'hub', label: 'Хаб' },
] as const;

/* №3: лёгкий haptic на навигации (guard — тишина вне устройства) */
function buzzStep(): void {
  try { (navigator as any)?.vibrate?.(8); } catch { /* no-op */ }
}

const STEP_DEFS: AdStepDef[] = [  { id: 'params', label: '🎛 Параметры' },
  { id: 'athlete', label: '🎯 Атлет' },
  { id: 'grip', label: '✊ Стол и хват' },
  { id: 'split', label: '📚 Сплит и цикл' },
  { id: 'plan', label: '📋 План' },
  { id: 'quality', label: '🏋️ Веса и качество' },
  { id: 'export', label: '📤 Экспорт' },
  { id: 'year', label: '🗓 Год' },
];
const STEP_GROUPS: Array<{ name: string; ids: Step[] }> = [
  { name: 'ПАРАМЕТРЫ', ids: ['params', 'athlete', 'grip', 'split'] },
  { name: 'ПЛАН', ids: ['plan', 'quality'] },
  { name: 'ВЫДАЧА', ids: ['export', 'year'] },
];

const SPLIT_TAG_RU: Record<string, string> = {
  TableHeavy: 'Стол', GripHeavy: 'Хват', TableTech: 'Техника', Support: 'Поддержка',
  SidePress: 'Бок', Hammer: 'Молот', TableSupination: 'Супинация', TablePronation: 'Пронация',
};

function shortSplitTag(tag?: string): string {
  if (!tag) return '—';
  return SPLIT_TAG_RU[tag] || tag;
}

/* Светофор фаз и RIR — та же палитра, что в печати (arm-export engine) */
const PHASE_DOT: Record<string, string> = {
  accumulation: '#22c55e',
  intensification: '#f59e0b',
  deload: '#60a5fa',
  peaking: '#ef4444',
};
/* Кромка сессий по характеру дня */
const CHAR_EDGE: Record<string, string> = {
  'тяж': '#ef4444',
  'памп': '#f59e0b',
  'техника': '#60a5fa',
  'лёг': '#22c55e',
};
function rirTint(rir: any): React.CSSProperties {
  const n = Number(rir);
  const c = !(n >= 0) ? undefined : n <= 1 ? '#ef4444' : n <= 2 ? '#f59e0b' : '#22c55e';
  return c ? { borderColor: `${c}88`, color: c, fontVariantNumeric: 'tabular-nums' as const } : { fontVariantNumeric: 'tabular-nums' as const };
}

/* ── №2 Варианты арм-планов (как bb-plans-store, легче): сохранить текущий
 * (с применёнными правками), загрузить, удалить. Кап 10, старый вытесняется. ── */
const ARM_VARIANTS_KEY = 'he_arm_plan_variants';
export type ArmPlanVariant = { id: string; name: string; dateIso: string; plan: any };
export function loadArmVariants(): ArmPlanVariant[] {
  try {
    const raw = localStorage.getItem(ARM_VARIANTS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((v) => v && v.plan && Array.isArray(v.plan.weeks)) : [];
  } catch { return []; }
}
export function saveArmVariants(list: ArmPlanVariant[]): void {
  try { localStorage.setItem(ARM_VARIANTS_KEY, JSON.stringify(list.slice(0, 10))); } catch {}
}

/* ── Сравнение вариантов: недели/сеты/фазы/помышечный объём с дельтой.
 * Чистая функция; UI — выбор двух чекбоксами в секции вариантов. ── */
export type ArmVariantDiff = {
  weeksA: number; weeksB: number;
  setsA: number; setsB: number;
  phasesA: string; phasesB: string;
  rows: Array<{ muscle: string; a: number; b: number; d: number }>;
};
function planMuscleSets(plan: any): Record<string, number> {
  const out: Record<string, number> = {};
  for (const wk of plan?.weeks || []) {
    for (const s of wk.sessions || []) {
      for (const e of s.exercises || []) {
        const m = String(e.muscle || '—');
        out[m] = (out[m] || 0) + (e.sets || 0);
      }
    }
  }
  return out;
}
function planTotalSets(plan: any): number {
  return Object.values(planMuscleSets(plan)).reduce((a: number, v) => (a as number) + (v as number), 0) as number;
}
export function compareArmVariants(a: any, b: any): ArmVariantDiff | null {
  if (!a || !b || !Array.isArray(a.weeks) || !Array.isArray(b.weeks)) return null;
  const ma = planMuscleSets(a);
  const mb = planMuscleSets(b);
  const keys = Array.from(new Set([...Object.keys(ma), ...Object.keys(mb)])).sort();
  const rows = keys.map((muscle) => ({ muscle, a: ma[muscle] || 0, b: mb[muscle] || 0, d: (mb[muscle] || 0) - (ma[muscle] || 0) }));
  const ph = (p: any) => (p.weeks || []).map((w: any) => String(w.phase || '').slice(0, 3)).join('→');
  return {
    weeksA: (a.weeks || []).length, weeksB: (b.weeks || []).length,
    setsA: planTotalSets(a), setsB: planTotalSets(b),
    phasesA: ph(a), phasesB: ph(b),
    rows,
  };
}

/* ── №1 Ручная коррекция плана (overlay поверх builtPlan, как exerciseEdits
 * в ББ-авто): сеты/повторы/вес + своп внутри substitutionGroup каталога.
 * Валидация/отчёт остаются базовыми (честная пометка «с правками»). ── */
export type ArmExerciseEdit = { sets?: number; reps?: number; weight?: number; swapId?: string };
export function armEditKey(week: number, si: number, ei: number): string {
  return `${week}:${si}:${ei}`;
}
export function swapCandidatesFor(ex: any): Array<{ id: string; name: string }> {
  try {
    const all = ARM_EXERCISES as any[];
    const cur = (ex as any)?.exerciseId ? all.find((e) => e.id === (ex as any).exerciseId) : all.find((e) => e.name === ex.name);
    const grp = (cur as any)?.substitutionGroup || (ex as any)?.substitutionGroup;
    const pool = grp ? all.filter((e) => e.substitutionGroup === grp) : [];
    const curId = (cur as any)?.id;
    return pool.filter((e) => e.id !== curId && e.name !== ex.name).map((e) => ({ id: e.id, name: e.name }));
  } catch { return []; }
}
const CHAR_WEIGHT_PCT: Record<string, number> = { 'тяж': 0.82, 'техника': 0.60, 'памп': 0.68, 'лёг': 0.60 };
export function applyArmEdits(plan: any, edits: Record<string, ArmExerciseEdit>, weightBase?: Record<string, number>): any {
  if (!plan || !edits || Object.keys(edits).length === 0) return plan;
  const round2 = (n: number) => Math.round(n * 2) / 2;
  return {
    ...plan,
    weeks: (plan.weeks || []).map((wk: any) => ({
      ...wk,
      sessions: (wk.sessions || []).map((sess: any, si: number) => ({
        ...sess,
        exercises: (sess.exercises || []).map((ex: any, ei: number) => {
          const ed = edits[armEditKey(wk.week, si, ei)];
          if (!ed) return ex;
          let out: any = { ...ex };
          if (ed.swapId) {
            const cat = (ARM_EXERCISES as any[]).find((e) => e.id === ed.swapId);
            if (cat) {
              out = {
                ...out,
                name: cat.name,
                exerciseId: cat.id,
                equipment: cat.equipment,
                movementPattern: cat.movementPattern,
                substitutionGroup: cat.substitutionGroup,
                comment: `🔄 Замена: ${cat.name}. ${cat.technique || ''}`.trim(),
              };
              const base = weightBase?.[out.muscle];
              if (base && base > 0) {
                const w = round2(base * (CHAR_WEIGHT_PCT[out.character] ?? 0.68));
                out.workSets = (out.workSets || []).map((ws: any) => ({ ...ws, weight: w }));
              }
            }
          }
          if (ed.sets != null && ed.sets >= 0) out.sets = Math.round(ed.sets);
          if (ed.sets != null || ed.reps != null || ed.weight != null) {
            if (!out.workSets || out.workSets.length === 0) {
              const r = ed.reps ?? out.repsRange?.[0] ?? 8;
              const w = ed.weight ?? 0;
              out.workSets = Array.from({ length: Math.max(1, out.sets || 1) }, () => ({ weight: w, reps: r }));
            }
          }
          if (ed.reps != null && ed.reps > 0) {
            out.repsRange = [Math.round(ed.reps), Math.round(ed.reps)];
            out.workSets = (out.workSets || []).map((ws: any) => ({ ...ws, reps: Math.round(ed.reps as number) }));
          }
          if (ed.weight != null && ed.weight >= 0) {
            out.workSets = (out.workSets || []).map((ws: any) => ({ ...ws, weight: ed.weight }));
          }
          return out;
        }),
      })),
    })),
  };
}

type GateKey = 'humerus' | 'ucl' | 'shoulder' | 'tendon' | 'table' | 'volume' | 'cycle' | 'antagonist' | 'other';

const GATE_META: Record<GateKey, { title: string }> = {
  humerus: { title: '🦴 Humerus / side' },
  ucl: { title: '🧵 UCL / баланс' },
  shoulder: { title: '🛡 Плечо' },
  tendon: { title: '🦾 Tendon' },
  table: { title: '🖐️ Стол' },
  volume: { title: '📊 Объём MRV/MEV' },
  cycle: { title: '📚 Цикл↔сплит' },
  antagonist: { title: '🔗 Антагонисты' },
  other: { title: '📌 Прочее' },
};

const GUARD_KEYS: GateKey[] = ['humerus', 'ucl', 'shoulder', 'tendon'];
const EXTRA_KEYS: GateKey[] = ['table', 'volume', 'cycle', 'antagonist', 'other'];

function gateOf(msg: string): GateKey {
  const s = String(msg).toLowerCase();
  if (s.includes('humerus') || s.includes('side_pressure')) return 'humerus';
  if (s.includes('ucl') || s.includes('pron') || /\bsup\b/.test(s) || s.includes('супинац') || s.includes('пронац')) return 'ucl';
  if (s.includes('shoulder') || s.includes('плеч')) return 'shoulder';
  if (s.includes('tendon')) return 'tendon';
  if (s.includes('table time') || s.includes('стол')) return 'table';
  if (s.includes('mrv') || s.includes('mev') || s.includes('сетов')) return 'volume';
  if (s.includes('цикл')) return 'cycle';
  if (s.includes('антагонист')) return 'antagonist';
  return 'other';
}

function groupWarnings(warnings: string[]): Record<GateKey, string[]> {
  const out: Record<GateKey, string[]> = {
    humerus: [], ucl: [], shoulder: [], tendon: [], table: [], volume: [], cycle: [], antagonist: [], other: [],
  };
  for (const w of warnings || []) out[gateOf(w)].push(w);
  return out;
}

/* Перф: тяжёлые списки мемоизированы — ререндер только при смене данных/выбора,
 * а не на каждый ввод в соседних полях. DOM/строки/aria 1-в-1. */
const SplitList = React.memo(function SplitList({ ranked, patternId, onPick }: { ranked: any[]; patternId: string; onPick: (id: string) => void }) {
  return (
    <div className="ad-list" data-arm="split-list">
      {ranked.slice(0,6).map((r,i)=> (
        <div key={r.pattern.id} className="ad-sec ad-split" data-active={patternId===r.pattern.id || (!patternId && i===0)} onClick={()=>onPick(r.pattern.id)} role="button" tabIndex={0} aria-pressed={patternId===r.pattern.id} onKeyDown={(e)=>{ if (e.key==='Enter'||e.key===' ') onPick(r.pattern.id); }}>
          <div className="ad-split-top">
            <span className="ad-split-radio" aria-hidden />
            <span className="ad-split-name">{i===0 ? '★ ' : ''}{r.pattern.name} <span>— {r.pattern.sessionsPerRotation}x/{r.pattern.rotationDays}дн</span></span>
            <span className="ad-split-score">{r.score}</span>
          </div>
          <div className="ad-split-desc">{r.pattern.description}</div>
          <div className="ad-strip" data-arm="split-rot" aria-hidden>
            {(r.pattern.schedule || []).map((d: any, di: number) => (
              d && d.kind === 'тренировка'
                ? <span key={di} className="ad-rot" data-ch={d.character || ''} title={`${d.sessionTag || ''} ${d.character || ''}`}>{shortSplitTag(d.sessionTag)}</span>
                : <span key={di} className="ad-rest" title="отдых">·</span>
            ))}
          </div>
          {r.rationale.length>0 && <div className="ad-tip">{r.rationale.join(' · ')}</div>}
          {r.warnings.length>0 && <div className="ad-tip">⚠ {r.warnings.join(' · ')}</div>}
        </div>
      ))}
    </div>
  );
});
const CyclePickerList = React.memo(function CyclePickerList({ items, cycId, onPick, levelRu, phaseRu }: { items: any[]; cycId: string; onPick: (id: string) => void; levelRu: Record<string, string>; phaseRu: Record<string, string> }) {
  if (!items.length) return null;
  return (
    <div className="ad-list" data-arm="cycle-picker">
      {items.map(({ cycle: c, score, reasons }, ci) => (
        <div key={c.id} className="ad-sec ad-split" data-active={cycId===c.id} onClick={()=>onPick(c.id)} role="button" tabIndex={0} aria-pressed={cycId===c.id} aria-label={`Цикл ${c.name}`} onKeyDown={(e)=>{ if (e.key==='Enter'||e.key===' ') onPick(c.id); }}>
          <div className="ad-split-top">
            <span className="ad-split-radio" aria-hidden />
            <span className="ad-split-name">{ci < 3 ? `★${ci + 1} ` : ''}{c.name} <span>— {c.weeks} нед · {c.daysPerWeek}×/нед</span></span>
            <span className="ad-split-score">{score}</span>
          </div>
          <div className="ad-row" data-arm="cycle-chips">
            <span className="ad-tag">{c.rpe}</span>
            {c.tablePerWeek > 0 ? <span className="ad-tag" data-ch="table">🖐️ стол {c.tablePerWeek}×/нед</span> : <span className="ad-tag">хват</span>}
            <span className="ad-tag">{c.level.map((l: any)=>levelRu[l] || l).join('/')}</span>
          </div>
          <div className="ad-strip" data-arm="cycle-phases" aria-hidden>
            {Array.from({ length: c.weeks }, (_, i) => {
              const ph = (c.phases as Record<number, string>)[i + 1] || 'accumulation';
              return <span key={i} className="ad-ph" data-phase={ph} title={`Нед ${i + 1}: ${phaseRu[ph] || ph}`}>{i + 1}</span>;
            })}
          </div>
          <div className="ad-muted">{reasons.slice(0, 2).join(' · ')}</div>
        </div>
      ))}
    </div>
  );
});

export function ArmAutoConstructor() {
  const [step, setStep] = useState<Step>('params');
  const [discipline, setDiscipline] = useState<string>('armwrestling');
  const [technique, setTechnique] = useState<string>('balanced');
  const [gripFocus, setGripFocus] = useState<string>('support');
  const [level, setLevel] = useState<string>('intermediate');
  const [goal, setGoal] = useState<string>('strength');
  const [weeks, setWeeks] = useState<number>(8);
  const [daysPerWeek, setDaysPerWeek] = useState<number>(4);
  const [weakPoints, setWeakPoints] = useState<string[]>([]);
  const [diagWeakPoints, setDiagWeakPoints] = useState<ArmWeakPoint[]>([]);
  const [focusGroup, setFocusGroup] = useState<string>('');
  const [specialization, setSpecialization] = useState<boolean>(false);
  const [patternId, setPatternId] = useState<string>('');
  const [builtPlan, setBuiltPlan] = useState<any>(null);
  const [weekSel, setWeekSel] = useState<number>(1);
  const [msg, setMsg] = useState<string>('');
  const linked: any = (() => { try { return (useDataLink as any)(); } catch { return {}; } })();
  const [pedDoses, setPedDoses] = useState<Record<string, number>>({});
  const [courseIntensity, setCourseIntensity] = useState<'mild'|'moderate'|'heavy'>('moderate');
  const [showPed, setShowPed] = useState(false);
  const [workMaxEdit, setWorkMaxEdit] = useState<Record<string, string>>({});
  // PRO A–J: старт/руки/бенчи/дневник/спарринг (всё опционально)
  const [proBw, setProBw] = useState<string>('');
  const [proAge, setProAge] = useState<string>('');
  const [proArm, setProArm] = useState<string>('both');
  const [proDate, setProDate] = useState<string>('');
  const [proTargetW, setProTargetW] = useState<string>('');
  const [proLeft, setProLeft] = useState<string>('');
  const [proRight, setProRight] = useState<string>('');
  const [proBenchRt, setProBenchRt] = useState<string>('');
  const [proBenchWristLb, setProBenchWristLb] = useState<string>('');
  const [proBenchPron, setProBenchPron] = useState<string>('');
  const [proBenchSide, setProBenchSide] = useState<string>('');
  const [proSrpe, setProSrpe] = useState<string>('');
  const [proElbow, setProElbow] = useState<string>('');
  const [proSpar, setProSpar] = useState<string>('off');
  const [proSparDelta, setProSparDelta] = useState<string>('0');
  const [proSupermatch, setProSupermatch] = useState<boolean>(false);
  const [proStrap, setProStrap] = useState<boolean>(false);
  const [proPlatImpl, setProPlatImpl] = useState<string>('rolling_thunder');
  const [proPlatTarget, setProPlatTarget] = useState<string>('');
  // TOP T1–T8: матчап/скорость/лестница/sim/календарь (всё опционально)
  const [topOpp, setTopOpp] = useState<string>('unknown');
  const [topOppHand, setTopOppHand] = useState<string>('unknown');
  const [topWD, setTopWD] = useState<string>('');
  const [topRfd, setTopRfd] = useState<boolean>(false);
  const [topLadder, setTopLadder] = useState<string>('');
  const [topLadderVal, setTopLadderVal] = useState<string>('');
  const [topSim, setTopSim] = useState<boolean>(false);
  const [topCalPrio, setTopCalPrio] = useState<string>('B');
  const [topCalSeries, setTopCalSeries] = useState<string>('local');
  const [topGripWeek, setTopGripWeek] = useState<string>('');
  const [topGripPhase, setTopGripPhase] = useState<string>('auto');
  const [topHeavy, setTopHeavy] = useState<string>('');
  const [topPullH, setTopPullH] = useState<string>('');
  const [topContinuity, setTopContinuity] = useState<boolean>(false);
  const [topGripAuto, setTopGripAuto] = useState<boolean>(false);
  const [topExpl, setTopExpl] = useState<string>('');
  // CYCLES (интернет-библиотека, всё опционально — пусто = как раньше)
  const [cycId, setCycId] = useState<string>('');
  const [cycConsent, setCycConsent] = useState<boolean>(false);
  const [cycCorr, setCycCorr] = useState<string>('');
  const [cycCoc, setCycCoc] = useState<string>('');
  const [cycFlat, setCycFlat] = useState<boolean>(false);
  const [cycBlood, setCycBlood] = useState<boolean>(false);
  const [cycNever, setCycNever] = useState<boolean>(false);
  const [cycSingles, setCycSingles] = useState<boolean>(false);
  const [cycPumpkin, setCycPumpkin] = useState<string>('');
  const [cycBrzenk, setCycBrzenk] = useState<boolean>(false);
  const [cycAkimov, setCycAkimov] = useState<boolean>(false);
  const [cycComp, setCycComp] = useState<boolean>(false);
  const [cycMedley, setCycMedley] = useState<string>('');
  const [cycFor, setCycFor] = useState<boolean>(false);
  const [cycForSpec, setCycForSpec] = useState<string>('support');
  // R8: ось humerus-2026 + попытки медли (опционально, пусто = как раньше)
  const [cycAxisOn, setCycAxisOn] = useState<boolean>(false);
  const [axTrunk, setAxTrunk] = useState<boolean>(false);
  const [axMisalign, setAxMisalign] = useState<boolean>(false);
  const [axBehind, setAxBehind] = useState<boolean>(false);
  const [axDorsal, setAxDorsal] = useState<boolean>(false);
  const [axCold, setAxCold] = useState<boolean>(false);
  const [axDefense, setAxDefense] = useState<boolean>(false);
  const [axSideMax, setAxSideMax] = useState<boolean>(false);
  const [medAttKg, setMedAttKg] = useState<string[]>(['', '', '']);
  const [medAttOk, setMedAttOk] = useState<boolean[]>([true, true, true]);

  // TOP wave-13: автоподстановка веса/возраста из профиля (только пустые поля)
  useEffect(() => {
    try {
      const p: any = linked?.profile ?? {};
      const per: any = p?.settings?.personal ?? p?.personal ?? {};
      if (per && typeof per === 'object') {
        if (Number(per.weight) > 0) setProBw((prev) => (prev === '' ? String(per.weight) : prev));
        if (Number(per.age) > 0) setProAge((prev) => (prev === '' ? String(per.age) : prev));
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const workMax = useMemo(() => {
    try {
      const pm: any = linked?.profile?.personal ?? {};
      const wm: Record<string, number> = {};
      if (pm.weight) wm['default'] = Number(pm.weight) || 50;
      // editable overrides
      for (const [k,v] of Object.entries(workMaxEdit)) {
        const n = parseFloat(v);
        if (Number.isFinite(n) && n>0) wm[k] = n;
      }
      return wm;
    } catch { return {}; }
  }, [linked, workMaxEdit]);

  // Приём из хаба диагностики (Интеллект → Арм-диагностика → Применить в Арм-конструктор) — PRO MAX v3 (12 мёртвых точек)
  // + мост из Библиотеки (каталог циклов → kind 'arm_cycle': ставит именной цикл)
  useEffect(() => {
    const apply = (payload: any) => {
      if (!payload) return;
      if (payload.kind === 'arm_cycle') {
        try {
          const id = String(payload.data?.cycleId || '');
          const found = ARM_CYCLE_LIBRARY.find((c) => c.id === id);
          if (!found) { flash(`⚠ Цикл ${id || '—'} не найден в библиотеке`); return; }
          setCycId(id);
          if (found.weeks > 0) setWeeks(Math.max(2, Math.min(52, found.weeks)));
          setStep('params');
          flash(`↩ Именной цикл из библиотеки: ${found.name}`);
        } catch {}
        return;
      }
      if (payload.kind !== 'weakpoints') return;
      const groups: string[] | undefined = payload.data?.groups;
      const wp: string[] | undefined = payload.data?.armWeakPoints;
      let appliedWeak: string[] | null = null;
      if (Array.isArray(groups) && groups.length > 0) {
        appliedWeak = groups.slice(0, 2).map((s: string) => String(s).toLowerCase());
        setWeakPoints(appliedWeak);
        setSpecialization(true);
        setStep('params');
        flash(`↩ Из диагностики: ${groups.join(', ')}`);
      }
      if (Array.isArray(wp) && wp.length > 0) {
        const clean = (wp as string[]).slice(0,3) as ArmWeakPoint[];
        setDiagWeakPoints(clean);
        setSpecialization(true);
        setStep('params');
        flash(`↩ Мёртвые точки: ${clean.join(', ')}`);
      } else if (Array.isArray(payload.data?.armBiomechCards) && payload.data.armBiomechCards.length) {
        const fromCards = (payload.data.armBiomechCards as any[]).map((c:any)=> String(c.weakPoint)).slice(0,3) as ArmWeakPoint[];
        if (fromCards.length) setDiagWeakPoints(fromCards);
      }
      // dynamicWeak fallback if groups empty but armDynamic present
      if ((!appliedWeak || appliedWeak.length===0) && payload.data?.armDynamic) {
        try {
          const dyn = payload.data.armDynamic;
          const weak: string[] = [];
          if (dyn?.metrics?.finger_flex && dyn.metrics.finger_flex.f100 < 20) weak.push('risers');
          if (dyn?.metrics?.hammer && dyn.metrics.hammer.ftIndex < 30) weak.push('brachialis');
          if (dyn?.metrics?.hook && dyn.metrics.hook.fMax < 30) weak.push('supinators');
          if (dyn?.metrics?.cup && dyn.metrics.cup.f500 < 25) weak.push('wrist_flexors');
          if (weak.length) { setWeakPoints(weak.slice(0,2)); setSpecialization(true); flash(`↩ Динамика: ${weak.slice(0,2).join(', ')}`); }
        } catch {}
      }
      const tech = payload.data?.armTechnique;
      if (tech) setTechnique(String(tech));
      // PRO-3 W-AL: дисциплина из армлифтинг-хаба (раньше мост всегда оставался в armwrestling)
      try {
        if ((payload.data as any)?.armDiscipline === 'armlifting') {
          setDiscipline('armlifting');
          const vv = (payload.data as any)?.armLiftingVerdict;
          flash(`↩ Армлифтинг-диагностика${vv ? `: ${vv}` : ''} → дисциплина «Армлифтинг»`);
        }
      } catch {}
      // PRO-3 P4: red-flags из диагностики — стоп-баннер (сборку не ломаем)
      try {
        const rf = payload.data?.armRedFlags;
        if (Array.isArray(rf) && rf.length) {
          flash(`⛔ Red-flags из диагностики: ${rf.join(', ')} — сначала врач, тесты после`);
        }
      } catch {}
      // J7 орто-скрининг: гарды ИСПОЛНЯЮТСЯ.
      // mobilityAdd (wrist/forearm/elbow) → прямо в профиль (живой фильтр пула без ручной кнопки);
      // Beighton closedChainOnly / teen → «Без отказов» (щадящий режим); всё — в персист + флеш.
      try {
        const og = payload.data?.orthoGuards;
        if (og && typeof og === 'object') {
          localStorage.setItem('he_arm_ortho_guards', JSON.stringify(og));
          const bits: string[] = [];
          if ((og as any).pauseOverhead) bits.push('плечо-пауза');
          if ((og as any).closedChainOnly) {
            bits.push('Beighton-щадящий');
            setCycNever(true);
          }
          const mobW = Array.isArray((og as any).mobilityAdd)
            ? Array.from(new Set((og as any).mobilityAdd.map((m: unknown) => String(m)).filter((m: string) => ['wrist', 'forearm', 'elbow'].includes(m))))
            : [];
          if (mobW.length) {
            bits.push(mobW.join('+'));
            try {
              const raw = localStorage.getItem('he_profile_v2');
              if (raw) {
                const p = JSON.parse(raw);
                const s = p.settings ?? p;
                s.health = s.health ?? {};
                s.training = s.training ?? {};
                const hPrev: string[] = Array.isArray((s.health as any).mobilityRestrictions) ? (s.health as any).mobilityRestrictions : [];
                const tPrev: string[] = Array.isArray((s.training as any).mobilityRestrictions) ? (s.training as any).mobilityRestrictions : [];
                (s.health as any).mobilityRestrictions = Array.from(new Set([...hPrev, ...mobW]));
                (s.training as any).mobilityRestrictions = Array.from(new Set([...tPrev, ...mobW]));
                localStorage.setItem('he_profile_v2', JSON.stringify(p.settings ? { ...p, settings: s } : s));
              }
              localStorage.setItem('he_arm_ortho_mobility', JSON.stringify(mobW));
            } catch {}
          }
          if (bits.length) flash(`🦴 Орто-гарды: ${bits.join(' · ')}`);
        }
        const of = payload.data?.orthoFlags;
        if (Array.isArray(of) && of.length) {
          try { localStorage.setItem('he_arm_ortho_flags', JSON.stringify(of)); } catch {}
        }
        const tn = payload.data?.teenNote;
        if (typeof tn === 'string' && tn) {
          setCycNever(true);
          flash(`🧒 ${tn}`);
        }
      } catch {}
      // Э3: мост без орто-полей снимает ранее отслеженное из профиля (только свои id).
      try {
        const d: any = payload.data;
        const hasOrtho = (d?.orthoGuards && typeof d.orthoGuards === 'object')
          || (Array.isArray(d?.orthoFlags) && d.orthoFlags.length)
          || (typeof d?.teenNote === 'string' && d.teenNote);
        if (!hasOrtho) {
          const raw = localStorage.getItem('he_arm_ortho_mobility');
          const tm: unknown = raw ? JSON.parse(raw) : [];
          if (Array.isArray(tm) && tm.length) {
            const pr = localStorage.getItem('he_profile_v2');
            if (pr) {
              const pp = JSON.parse(pr);
              const ss = pp.settings ?? pp;
              const strip = (arr: unknown): string[] => Array.isArray(arr) ? arr.map(String).filter((x) => !tm.includes(x)) : [];
              (ss.health as any) = ss.health ?? {};
              (ss.training as any) = ss.training ?? {};
              (ss.health as any).mobilityRestrictions = strip((ss.health as any).mobilityRestrictions);
              (ss.training as any).mobilityRestrictions = strip((ss.training as any).mobilityRestrictions);
              localStorage.setItem('he_profile_v2', JSON.stringify(pp.settings ? { ...pp, settings: ss } : ss));
            }
            flash(`🦴 Орто-гарды сняты (${tm.length})`);
          }
          localStorage.removeItem('he_arm_ortho_mobility');
          localStorage.removeItem('he_arm_ortho_guards');
          localStorage.removeItem('he_arm_ortho_flags');
        }
      } catch {}
      // TOP из хаба: матчап + Table-IQ (аддитивно)
      try {
        const mu = payload.data?.armMatchup;
        if (mu && typeof mu === 'object') {
          if (mu.oppStyle) setTopOpp(String(mu.oppStyle));
          if (mu.oppHand) setTopOppHand(String(mu.oppHand));
          if (Number.isFinite(Number(mu.weightDeltaKg)) && Number(mu.weightDeltaKg) !== 0) setTopWD(String(mu.weightDeltaKg));
          flash('↩ Матчап из диагностики применён');
        }
        // TOP wave-13: профиль хаба (L/R, вес, RT) + динамика → RFD
        try {
          const ap = payload.data?.armProfile;
          if (ap && typeof ap === 'object') {
            if (Number(ap.leftKg) > 0) setProLeft(String(ap.leftKg));
            if (Number(ap.rightKg) > 0) setProRight(String(ap.rightKg));
            if (Number(ap.bwKg) > 0) setProBw(String(ap.bwKg));
            if (Number(ap.rtKg) > 0) setProBenchRt(String(ap.rtKg));
            // PRO-4 добивка: pinch/RT из армлифтинг-хаба в рабочие максимумы (пустые не затираем)
            if (Number((ap as any).pinchKg) > 0) setWorkMaxEdit((prev: any) => (!prev.grip_pinch ? { ...prev, grip_pinch: String((ap as any).pinchKg) } : prev));
            if (Number((ap as any).rtKg) > 0) setWorkMaxEdit((prev: any) => (!prev.grip_support ? { ...prev, grip_support: String((ap as any).rtKg) } : prev));
          }
          const ar = payload.data?.armRfd;
          if (ar && Number.isFinite(Number(ar.explosivePct)) && Number(ar.explosivePct) > 0) {
            setTopExpl(String(ar.explosivePct));
            setTopRfd(true);
          }
        } catch {}
        // PRO-4 добивка: класс/рецепт/LMS/правила из армлифтинг-хаба — видимой строкой (сборку не меняем)
        try {
          const al = (payload.data as any)?.armLifting;
          if (al && typeof al === 'object') {
            const parts: string[] = [];
            if (al.weightClass) parts.push(`класс ${al.weightClass}`);
            if (al.prescription) parts.push(String(al.prescription));
            if (al.lms && Array.isArray(al.lms.steps) && al.lms.steps.length) {
              parts.push(`LMS${al.lms.label ? ` (${al.lms.label})` : ''}: ${(al.lms.steps as number[]).join(' → ')}`);
            }
            if (al.rulesNote) parts.push(String(al.rulesNote));
            if (parts.length) flash(`🏋️ Армлифтинг-мост: ${parts.join(' · ')}`);
          }
        } catch {}
        const bouts = payload.data?.armBouts;
        if (Array.isArray(bouts) && bouts.length) {
          try { localStorage.setItem('he_arm_table_iq', JSON.stringify(bouts.slice(0, 60))); } catch {}
          flash(`↩ Table-IQ: ${bouts.length} схваток из диагностики`);
        }
      } catch {}
      const bench = payload.data?.armBench;
      if (bench?.level) {
        const map: Record<string,string> = { beginner:'beginner', intermediate:'intermediate', advanced:'advanced', competitive:'advanced', elite:'enhanced' };
        const lvl = map[String(bench.level)] || 'intermediate';
        setLevel(lvl);
        try { localStorage.setItem('he_arm_last_bench_level', bench.level); } catch {}
      }
      // сохраняем диагностику для печати — механизм-ориентированная + 12 точек
      try {
        const diagSnap: any = {
          benchLevel: bench?.level,
          armWeakPoints: payload.data?.armWeakPoints,
          armBiomechCards: payload.data?.armBiomechCards,
          armCorrections: payload.data?.armCorrections,
          armScoring: payload.data?.armScoring,
          armDynamic: payload.data?.armDynamic,
          armAngles: payload.data?.armAngles,
          armForce: payload.data?.armForce,
          findings: payload.data?.armFindings,
          humerusWarnings: payload.data?.armHumerus,
          balanceWarnings: payload.data?.armBalance,
          redFlags: payload.data?.armRedFlags,
          asymmetryPct: payload.data?.armAsymmetry,
          info: payload.data?.armInfo,
        };
        localStorage.setItem('he_arm_last_diagnostics', JSON.stringify(diagSnap));
        if (payload.data?.armWeakPoints) localStorage.setItem('he_arm_last_weakpoints', JSON.stringify(payload.data.armWeakPoints));
      } catch {}
    };
    // начальный снимок (если хаб уже отправил до монтирования)
    try {
      const cur = getPlannerApply();
      if (cur) apply(cur);
    } catch {}
    const unsub = subscribePlannerApply((p) => { try { apply(p); } catch {} });
    return () => { try { unsub(); } catch {} };
  }, []);

  const ranked = useMemo(() => {
    // R5: при выбранном именном цикле сплиты ранжируются по ЕГО дням/нед —
    // иначе валидатор потом честно пожалуется на расхождение частоты.
    // Ручной daysPerWeek при этом не затирается (только ранжирование).
    let effDays = daysPerWeek;
    try {
      if (cycId) {
        const c = ARM_CYCLE_LIBRARY.find((x) => x.id === cycId);
        if (c && c.daysPerWeek > 0) effDays = c.daysPerWeek;
      }
    } catch { effDays = daysPerWeek; }
    return rankArmSplits({ level, goal: goal as any, technique, discipline, daysPerWeek: effDays, gripFocus, weakPoints, specialization });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, goal, technique, discipline, daysPerWeek, gripFocus, weakPoints, specialization, cycId]);

  const best = useMemo(() => ranked[0]?.pattern, [ranked]);

  const specPreview = useMemo(() => {
    return buildArmSchedule({ focusGroup: focusGroup || undefined, weakPoints, specialization, totalWeeks: weeks });
  }, [focusGroup, weakPoints, specialization, weeks]);

  const flash = (t: string) => { setMsg(t); setTimeout(()=>setMsg(''), 2600); };

  const handleBuild = () => {
    const pid = patternId || best?.id || ARM_SPLIT_PATTERNS[0].id;
    try {
      const recovery: any = (() => {
        try {
          const p: any = linked?.profile ?? {};
          const lifestyle: any = p.lifestyle ?? p.personal ?? {};
          const per: any = p?.settings?.personal ?? p?.personal ?? {};
          return {
            bodyFat: p.personal?.bodyFat ?? p.personal?.bodyFatPct,
            leanMass: p.personal?.leanMass,
            hrvMs: lifestyle?.morningHRV ?? lifestyle?.hrvMs,
            sleepHours: lifestyle?.sleepHours,
            stressLevel: lifestyle?.stressLevel,
            // TOP wave-14: fallback веса/возраста из профиля, если стор подгрузился после mount
            profileWeight: Number(per?.weight) > 0 ? Number(per.weight) : undefined,
            profileAge: Number(per?.age) > 0 ? Number(per.age) : undefined,
          };
        } catch { return {}; }
      })();
      let plan: any = buildArmPlan({
        discipline: discipline as any,
        patternId: pid,
        level,
        goal: goal as any,
        technique: technique as any,
        weeks,
        gripFocus: gripFocus as any,
        weakPoints,
        focusGroup: focusGroup || undefined,
        specialization,
        workMax,
        pedDoses: Object.keys(pedDoses).length ? pedDoses : undefined,
        courseIntensity,
        bodyFat: recovery.bodyFat,
        leanMass: recovery.leanMass,
        hrvMs: recovery.hrvMs,
        sleepHours: recovery.sleepHours,
        stressLevel: recovery.stressLevel,
        // PRO A–J (пустые строки = не задано; вес/возраст добираются из профиля)
        bodyWeightKg: parseFloat(proBw) > 0 ? parseFloat(proBw) : (recovery as any).bodyWeightKg ?? (recovery as any).profileWeight,
        ageYears: parseFloat(proAge) > 0 ? parseFloat(proAge) : (recovery as any).profileAge,
        arm: (proArm === 'left' || proArm === 'right' ? proArm : 'both') as any,
        leftKg: parseFloat(proLeft) > 0 ? parseFloat(proLeft) : undefined,
        rightKg: parseFloat(proRight) > 0 ? parseFloat(proRight) : undefined,
        competitionDateIso: proDate || undefined,
        targetWeightKg: parseFloat(proTargetW) > 0 ? parseFloat(proTargetW) : undefined,
        supermatch: proSupermatch || undefined,
        strapExpected: proStrap || undefined,
        sparring: proSpar === 'off' ? undefined : { intensityPct: Number(proSpar) as any, partnerDeltaKg: parseFloat(proSparDelta) || 0 },
        diary: (parseFloat(proSrpe) > 0 || parseFloat(proElbow) > 0)
          ? [{ dateIso: new Date().toISOString().slice(0, 10), srpe: parseFloat(proSrpe) || undefined, elbowPain: parseFloat(proElbow) || undefined }]
          : undefined,
        bench: (parseFloat(proBenchRt) > 0 || parseFloat(proBenchWristLb) > 0 || parseFloat(proBenchPron) > 0 || parseFloat(proBenchSide) > 0)
          ? { rtKg: parseFloat(proBenchRt) || undefined, wristCurlLb: parseFloat(proBenchWristLb) || undefined, pronHoldSec: parseFloat(proBenchPron) || undefined, sideKg: parseFloat(proBenchSide) || undefined }
          : undefined,
        // TOP T1–T8 (не задано = выключено, план как раньше)
        oppStyle: topOpp !== 'unknown' ? topOpp : undefined,
        oppHand: topOppHand !== 'unknown' ? topOppHand : undefined,
        weightDeltaKg: parseFloat(topWD) !== 0 && Number.isFinite(parseFloat(topWD)) ? parseFloat(topWD) : undefined,
        rfd: topRfd || undefined,
        explosivePct: parseFloat(topExpl) > 0 ? parseFloat(topExpl) : undefined,
        gripAuto: topGripAuto || undefined,
        gripWeek: parseInt(topGripWeek) > 0 ? parseInt(topGripWeek) : undefined,
        gripPhase: topGripPhase !== 'auto' ? topGripPhase : undefined,
        ladderFrom: topLadder || undefined,
        ladderValue: parseFloat(topLadderVal) > 0 ? parseFloat(topLadderVal) : undefined,
        contestSim: topSim || undefined,
        // CYCLES (пусто/выкл = дефолтный путь, план как раньше)
        cycleId: cycId || undefined,
        cycleConsent: cycConsent || undefined,
        correctionPct: parseFloat(cycCorr) >= 0 && parseFloat(cycCorr) <= 5 ? parseFloat(cycCorr) : undefined,
        cocWorking: cycCoc || undefined,
        flatPyramid: cycFlat || undefined,
        flatPyramidWeightKg: cycFlat && parseFloat(topLadderVal) > 0 ? parseFloat(topLadderVal) : undefined,
        bloodflow: cycBlood || undefined,
        neverFail: cycNever || undefined,
        heavySingles: cycSingles || undefined,
        pumpkinArm: (cycPumpkin === 'left' || cycPumpkin === 'right' ? cycPumpkin : undefined) as any,
        brzenkMode: cycBrzenk || undefined,
        akimovHook: cycAkimov || undefined,
        compPeriod: cycAkimov && cycComp ? true : undefined,
        medleyId: cycMedley || undefined,
        forMode: cycFor || undefined,
        forSpecialization: cycFor ? (cycForSpec as any) : undefined,
        // R8: ось и попытки — только при явном вводе, иначе движок их не видит
        axisCheck: cycAxisOn ? {
          ...(axTrunk ? { trunkRotatedTowardAttack: true } : {}),
          ...(axMisalign ? { wristElbowShoulderAligned: false } : {}),
          ...(axBehind ? { wristBehindShoulder: true } : {}),
          ...(axDorsal ? { wristExtendedDorsally: true } : {}),
          ...(axCold ? { coldNoWarmup: true } : {}),
          ...(axDefense ? { fightingFromDefense: true } : {}),
          ...(axSideMax ? { sideMaxAttempt: true } : {}),
        } : undefined,
        medleyAttempts: cycMedley ? medAttKg.map((kg, i) => ({ eventIdx: i, weightKg: parseFloat(kg) || 0, success: medAttOk[i] !== false })).filter((a) => a.weightKg > 0) : undefined,
        tableSession: (discipline as string) === 'armwrestling' ? true : undefined,
        tendonFuel: (discipline as string) === 'armwrestling' ? true : undefined,
        calStartIso: proDate || undefined,
        calPriority: topCalPrio,
        calSeries: topCalSeries,
        cnsCheck: topHeavy !== '' || topPullH !== '' ? true : undefined,
        heavyGripThisWeek: parseInt(topHeavy) >= 0 ? parseInt(topHeavy) : undefined,
        hoursSinceHeavyPull: parseFloat(topPullH) > 0 ? parseFloat(topPullH) : undefined,
        previousPlan: topContinuity ? ((): any => { try {
          const raw = localStorage.getItem('he_arm_last_plan');
          if (!raw) return undefined;
          const parsed = JSON.parse(raw);
          const weeks = (parsed as any)?.plan?.weeks || (parsed as any)?.weeks;
          if (!Array.isArray(weeks) || !weeks.length) return undefined;
          return (parsed as any)?.plan || parsed;
        } catch { return undefined; } })() : undefined,
        bouts: (()=>{ try { const raw = localStorage.getItem('he_arm_table_iq'); if (raw) { const arr = JSON.parse(raw); if (Array.isArray(arr) && arr.length) return arr.slice(0, 60); } } catch {} return undefined; })(),
      });
      plan = finalizeArmPlan(plan, { level });
      // PRO инъекция 12 мёртвых точек (если пришли из хаба) — parity с TA
      try {
        const toInject: ArmWeakPoint[] = diagWeakPoints.length ? diagWeakPoints : (()=>{ try{ const raw=localStorage.getItem('he_arm_last_weakpoints'); if(raw){ const arr=JSON.parse(raw); if(Array.isArray(arr) && arr.length) return arr as ArmWeakPoint[]; } } catch{} return []; })();
        if (toInject.length) {
          const inj = injectArmCorrections(plan, toInject as ArmWeakPoint[], { level, workMax });
          plan = inj.plan;
          if (inj.injected>0) plan.rationale = [...(plan.rationale||[]), `Инъекция мёртвых точек: ${inj.notes.join(' · ')}`];
        }
      } catch {}
      const v = validateArmPlan(plan, level);
      plan.validation = v;
      plan.report = buildArmReport(plan);
      plan.metrics = calcArmMetrics(plan);
      setBuiltPlan(plan);
      try { localStorage.setItem('he_arm_last_plan', JSON.stringify(plan)); } catch {}
      setWeekSel(1);
      setArmEdits({});
      setEditOpen(null);
      setStep('plan');
      const injInfo = diagWeakPoints.length ? ` + ${diagWeakPoints.join(', ')} инъекция` : '';
      flash(`✅ План собран: ${plan.pattern.name}, ${plan.weeks.length} нед${injInfo}`);
    } catch (e: any) {
      flash(`❌ Ошибка: ${e?.message || e}`);
    }
  };

  const toggleWeak = (m: string) => {
    setWeakPoints(prev => prev.includes(m) ? prev.filter(x=>x!==m) : [...prev, m].slice(0,2));
  };
  // Стабильные колбэки для мемо-списков (иначе memo бесполезно)
  const pickSplit = React.useCallback((id: string) => setPatternId(id), []);
  // Выбор именного цикла ставит его недели → exact-fit без согласия.
  // Иначе движок молча строил generic («цикл нельзя собрать»).
  const cycIdRef = React.useRef(cycId);
  cycIdRef.current = cycId;
  const pickCycleId = React.useCallback((id: string) => {
    if (!id) { setCycId(''); return; }
    if (cycIdRef.current === id) { setCycId(''); return; }
    setCycId(id);
    try {
      const c = ARM_CYCLE_LIBRARY.find(x => x.id === id);
      if (c && c.weeks > 0) setWeeks(Math.max(2, Math.min(52, c.weeks)));
    } catch {}
  }, []);

  // №1: ручные правки упражнений (overlay; сбрасываются при пересборке)
  const [armEdits, setArmEdits] = useState<Record<string, ArmExerciseEdit>>({});
  const [editOpen, setEditOpen] = useState<string | null>(null);
  // №2: сохранённые варианты
  const [armVariants, setArmVariants] = useState<ArmPlanVariant[]>(() => loadArmVariants());
  const [variantName, setVariantName] = useState('');
  const [cmpIds, setCmpIds] = useState<string[]>([]);
  const cmpDiff = useMemo(() => {
    if (cmpIds.length !== 2) return null;
    const va = armVariants.find(v => v.id === cmpIds[0]);
    const vb = armVariants.find(v => v.id === cmpIds[1]);
    if (!va || !vb) return null;
    return { names: [va.name, vb.name] as [string, string], diff: compareArmVariants(va.plan, vb.plan) };
  }, [cmpIds, armVariants]);
  // Год: серия → блоки (preview) → сборка каждого buildArmBlock
  const [yearSeries, setYearSeries] = useState<string>('local');
  const [yearWeeks, setYearWeeks] = useState<number>(52);
  const [yearSuggest, setYearSuggest] = useState<boolean>(true);
  const [yearBuilt, setYearBuilt] = useState<any[] | null>(null);
  const [yearBusy, setYearBusy] = useState(false);
  const yearBlocks = useMemo(() => {
    try { return buildArmYearBlocks(yearSeries, Math.max(4, Math.min(52, yearWeeks || 52)), {}, { suggestCycles: yearSuggest, discipline }); }
    catch { return []; }
  }, [yearSeries, yearWeeks, yearSuggest, discipline]);
  const YEAR_SERIES = [
    { id: 'local', label: 'Локальный' },
    { id: 'waf_worlds', label: 'WAF Worlds' },
    { id: 'east_vs_west', label: 'East-vs-West' },
    { id: 'super_series', label: 'Super Series' },
  ] as const;
  const viewPlan = useMemo(() => applyArmEdits(builtPlan, armEdits, workMax), [builtPlan, armEdits, workMax]);
  const editsCount = Object.keys(armEdits).length;

  const curWeek = viewPlan?.weeks?.find((w:any)=>w.week===weekSel) || viewPlan?.weeks?.[0];

  // Дашборд выдачи — чистые производные плана (логики нет).
  const planDash = (() => {
    try {
      if (!viewPlan) return null;
      const weeks = viewPlan.weeks;
      const sess = weeks.flatMap((w: any) => w.sessions);
      const table = sess.filter((s: any) => s.tableTime).length;
      const light = weeks.filter((w: any) => w.deload || w.phase === 'deload' || w.taper || w.phase === 'peaking').length;
      const ex = sess.reduce((a: number, s: any) => a + s.exercises.length, 0);
      const vol = weeks.map((w: any) => w.sessions.reduce((a: number, s: any) => a + s.exercises.reduce((x: number, e: any) => x + (e.sets || 0), 0), 0));
      const volMax = Math.max(1, ...vol);
      return { weeks: weeks.length, sess: sess.length, tablePct: sess.length ? Math.round((table / sess.length) * 100) : 0, light, ex, vol, volMax };
    } catch { return null; }
  })();

  // Саммари аккордеонов — чистые производные для шапки (логики нет).
  const summWeak = weakPoints.length ? weakPoints.map(m=>ARM_MUSCLE_RU[m] || m).join(' + ') : 'Не выбрано';
  const summPed = !showPed ? 'Выкл' : (Object.keys(pedDoses).length ? `${Object.values(pedDoses).reduce((a,b)=>a+(Number(b)||0),0)} мг/нед` : 'Вкл');
  const summWm = `${Object.values(workMaxEdit).filter(v=>v!=='').length}/7 задано`;
  const summPro = `${proBw || '—'} кг · ${proArm==='both'?'обе':proArm==='left'?'левая':'правая'} · ${proDate || 'без даты'}`;
  const summTop = [topOpp!=='unknown'&&'матчап', topRfd&&'RFD', topSim&&'sim', topContinuity&&'cross-meso', topGripAuto&&'авто-RPE', topLadder&&'лестница'].filter(Boolean).join(' · ') || 'Выкл';
  const summCyc = cycId ? ((()=>{ try { return ARM_CYCLE_LIBRARY.find(c=>c.id===cycId)?.name || cycId; } catch { return cycId; } })()) : 'Обычный план';
  const rankedCycles = useMemo(() => {
    try {
      // №6: весь каталог в пикере (не топ-3) — выбор из всех 19 без селекта
      return rankArmCycles({ discipline, level, goal, weeks, daysPerWeek, gripFocus });
    } catch { return []; }
  }, [discipline, level, goal, weeks, daysPerWeek, gripFocus]);
  const CYC_LEVEL_RU: Record<string, string> = { beginner: 'Новичок', intermediate: 'Средний', advanced: 'Продвинутый', enhanced: 'Enhanced' };
  const CYC_PHASE_RU: Record<string, string> = { accumulation: 'накопление', intensification: 'интенсификация', deload: 'делод', peaking: 'пик' };

const GRIP_GROUPS: Array<{ title: string; ids: ArmImplement[] }> = [
  { title: '✊ Support — удержание', ids: ['rolling_thunder', 'apollon_axle', 'farmer_handles', 'fat_gripz'] },
  { title: '🤏 Pinch — щипок', ids: ['saxon_bar', 'pinch_block', 'hub'] },
  { title: '🗜 Crush — дробление', ids: ['coc_bullet'] },
];
  const summFocus = (()=>{ try { return GRIP_FOCI.find(g=>g.id===gripFocus)?.label || gripFocus; } catch { return gripFocus; } })();

  return (
    <AdRoot rootClass="train-arm" maxWidth={980}>
      <AdHead
        icon="🤝"
        title="Арм-конструктор PRO"
        sub="Армрестлинг (стол: hook/toproll/press, РУ/РА, table ≥50%) + армлифтинг (хват: support/pinch/crush). Периодизация 3/2/1 (Кузнецов), tendon-cap, humerus-guard."
        side={best ? (<div className="ad-hero-side" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div className="ad-hero-score" aria-hidden style={{ minWidth: 56, textAlign: 'center', padding: '6px 10px', borderRadius: 14, background: 'linear-gradient(135deg, rgba(0,230,138,0.25), rgba(0,200,160,0.08))', border: '1px solid rgba(0,230,138,0.4)', boxShadow: '0 4px 16px rgba(0,230,138,0.25)' }}><b style={{ fontSize: 20, fontWeight: 900, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{ranked[0]?.score ?? 0}</b><span style={{ display: 'block', fontSize: 9, color: '#fff' }}>баллов</span></div><div className="ad-hero-name" style={{ fontSize: 12, fontWeight: 800, color: '#fff', lineHeight: 1.3 }}>{best.name}<span style={{ display: 'block', fontSize: 10, fontWeight: 500, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>лучший сплит · {daysPerWeek} дн/нед</span></div></div>) : '—'}
      />

      <div data-arm="steps" aria-label="Шаги" className="ad-steps" style={{ position: 'sticky', top: 0, zIndex: 30, background: 'rgb(20,20,23)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '5px 6px', marginBottom: 8, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {STEP_GROUPS.map((g, gi) => (
          <span key={g.name} className="ad-step-group" style={{ display: 'flex', alignItems: 'center', gap: 4, flex: '1 1 auto', minWidth: 0, flexWrap: 'wrap' }}>
            <span className="ad-step-group-label" aria-hidden style={{ fontSize: 9, fontWeight: 800, color: '#fff', letterSpacing: 0.5 }}>{g.name}</span>
            {g.ids.map((id) => {
              const idx = STEP_DEFS.findIndex((s) => s.id === id);
              const s = STEP_DEFS[idx];
              const active = step === id;
              return (
                <button
                  key={id}
                  aria-label={s.label}
                  aria-pressed={active}
                  data-active={active}
                  className="ad-step"
                  onClick={() => { buzzStep(); setStep(id); }}
                  style={{ ...STEP_PILL(active), backdropFilter: 'none', WebkitBackdropFilter: 'none', transition: 'none', padding: '6px 8px', fontSize: 10, flex: '1 1 auto', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                  <span className="ad-step-n" aria-hidden style={{ marginRight: 4, opacity: 0.8 }}>{idx + 1}</span>
                  {s.label}
                </button>
              );
            })}
            {gi < STEP_GROUPS.length - 1 && <span className="ad-step-sep" aria-hidden style={{ width: 1, height: 18, background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.08), transparent)', margin: '0 2px' }} />}
          </span>
        ))}
      </div>

      {msg && <div className="ad-toast" data-arm="msg">{msg}</div>}

      {step === 'params' && (
        <AdCard className="ad-stepview">
          <AdSec title="🎛 Параметры">
            <div className="ad-list">
              <div>
                <div className="ad-fl">Дисциплина</div>
                <div className="ad-chips">
                  {DISCIPLINES.map(d=> <AdChip key={d.id} active={discipline===d.id} onClick={()=>setDiscipline(d.id)}>{d.label}</AdChip>)}
                </div>
              </div>
              <div>
                <div className="ad-fl">Техника (стол)</div>
                <div className="ad-chips">
                  {TECHNIQUES.map(t=> <AdChip key={t.id} active={technique===t.id} onClick={()=>setTechnique(t.id)}>{t.label}</AdChip>)}
                </div>
              </div>
              <div>
                <div className="ad-fl">Уровень</div>
                <div className="ad-chips">
                  {[{id:'beginner',label:'Новичок'},{id:'intermediate',label:'Средний'},{id:'advanced',label:'Продвинутый'},{id:'enhanced',label:'На курсе'}].map(l=> <AdChip key={l.id} active={level===l.id} onClick={()=>setLevel(l.id)}>{l.label}</AdChip>)}
                </div>
              </div>
              <div>
                <div className="ad-fl">Цель</div>
                <div className="ad-chips">
                  {GOALS.map(g=> <AdChip key={g.id} active={goal===g.id} onClick={()=>setGoal(g.id)}>{g.label}</AdChip>)}
                </div>
              </div>
              <AdGrid cols="2">
                <AdField label="Недель">
                  <input type="number" min={2} max={52} value={weeks} onChange={e=>setWeeks(Math.max(2,Math.min(52, parseInt(e.target.value)||8)))} />
                </AdField>
                <AdField label="Дней/нед">
                  <input type="number" min={2} max={6} value={daysPerWeek} onChange={e=>setDaysPerWeek(Math.max(2,Math.min(6, parseInt(e.target.value)||4)))} />
                </AdField>
              </AdGrid>
            </div>
          </AdSec>

          {discipline !== 'armwrestling' && (
            <AdSec title="Хват-фокус" collapsible summary={summFocus}>
              <div className="ad-chips">
                {GRIP_FOCI.map(g=> (
                  <AdChip key={g.id} active={gripFocus===g.id} onClick={()=>setGripFocus(g.id)}>{g.label}</AdChip>
                ))}
              </div>
            </AdSec>
          )}

          <AdCta>
            <AdBtn variant="primary" block hero onClick={()=>setStep('athlete')}>Далее: Атлет →</AdBtn>
            <div className="ad-muted">Лучший сплит: <b>{best?.name || '—'}</b> ({ranked[0]?.score ?? 0} баллов)</div>
          </AdCta>
        </AdCard>
      )}

      {step === 'athlete' && (
        <AdCard className="ad-stepview">
          <AdSec title="🎯 Слабые зоны (1–2)" hint="Специализация ×1.3 — мышцы" collapsible summary={summWeak} status={weakPoints.length ? 'ok' : undefined}>
            <div className="ad-chips">
              {['wrist_flexors','pronators','supinators','brachialis','risers','grip_support','grip_pinch','side_pressure','back_pressure'].map(m=> (
                <AdChip key={m} active={weakPoints.includes(m)} onClick={()=>toggleWeak(m)}>{ARM_MUSCLE_RU[m] || m}</AdChip>
              ))}
            </div>
            <AdSwitch checked={specialization} onChange={setSpecialization} label="Специализация (блок 6 нед + баланс)" />
            {specialization && <span className="ad-tip">{specPreview.rationale}</span>}
          </AdSec>
          {diagWeakPoints.length>0 && (
            <AdBanner tone="warn">
              <b>🎯 Мёртвые точки из диагностики (инъекция 3× @% в план)</b>
              <div className="ad-row">
                {diagWeakPoints.map(wp=> (
                  <span key={wp} className="ad-tag">{wp}</span>
                ))}
              </div>
              <div className="ad-row">
                <AdBtn variant="dark" onClick={()=>{ setDiagWeakPoints([]); try{ localStorage.removeItem('he_arm_last_weakpoints'); } catch{} }}>✕ Сбросить мёртвые точки</AdBtn>
                <span className="ad-muted">Инъекция: per-day dedup, budget 85, humerus guard</span>
              </div>
            </AdBanner>
          )}

          <AdSec title="💉 На курсе (PED)" hint="TendonCap 1.5× (сухожилия медленнее), recovery × lab × nutrition уже в бюджете." collapsible defaultOpen={false} summary={summPed} status={showPed ? 'ok' : undefined}>
            <AdSwitch checked={showPed} onChange={setShowPed} label="💉 На курсе (PED)" />
            {showPed && (
              <>
              <div>
                <div className="ad-fl">Интенсивность курса</div>
                <div className="ad-chips">
                  {[{id:'mild',label:'Мягкий'},{id:'moderate',label:'Средний'},{id:'heavy',label:'Тяжёлый'}].map(o=> <AdChip key={o.id} active={courseIntensity===o.id} onClick={()=>setCourseIntensity(o.id as any)}>{o.label}</AdChip>)}
                </div>
              </div>
                <AdGrid cols="2">
                  {[
                    ['test_e','Тест энантат мг/нед'],
                    ['tren_a','Тренболон мг/нед'],
                    ['bold_u','Болденон мг/нед'],
                  ].map(([k,label])=> (
                    <AdField key={k} label={label}>
                      <input
                        type="number"
                        value={pedDoses[k] ?? ''}
                        onChange={e=>{
                          const v = parseFloat(e.target.value);
                          setPedDoses(prev=> {
                            const n={...prev};
                            if (Number.isFinite(v) && v>0) n[k]=v; else delete n[k];
                            return n;
                          });
                        }}
                        placeholder="0"
                      />
                    </AdField>
                  ))}
                </AdGrid>
              </>
                )}
              </AdSec>

          <AdSec title="🏋️ Рабочие максимумы (для прогрессии веса)" hint="Веса теперь используются в плане (вес = workMax × %; PRO: тяж 82%, техника 60%, памп 68%)." collapsible defaultOpen={false} summary={summWm} status={Object.values(workMaxEdit).some(v=>v!=='') ? 'ok' : undefined}>
            <AdGrid cols="3">
              {[
                ['wrist_flexors','Кисть (кг)'],
                ['pronators','Пронация (кг)'],
                ['supinators','Супинация (кг)'],
                ['brachialis','Брахиалис (кг)'],
                ['grip_support','Support RT/Axle (кг)'],
                ['grip_pinch','Pinch (кг)'],
                ['default','База (кг)'],
              ].map(([k,label]) => (
                <AdField key={k} label={label}>
                  <input value={workMaxEdit[k]||''} onChange={e=> setWorkMaxEdit(prev=> ({...prev, [k]: e.target.value}))} placeholder="—" inputMode="decimal" />
                </AdField>
              ))}
            </AdGrid>
          </AdSec>

          <AdSec title="🏆 PRO: старт WAF" hint="Руки L/R · бенчи · дневник · спарринг" collapsible defaultOpen={false} summary={summPro} status={(proBw || proAge || proDate || proLeft || proRight) ? 'ok' : undefined}>
            <AdGrid cols="3">
              <AdField label="Вес, кг">
                <input value={proBw} onChange={e=>setProBw(e.target.value)} placeholder="84" inputMode="decimal" />
              </AdField>
              <AdField label="Возраст">
                <input value={proAge} onChange={e=>setProAge(e.target.value)} placeholder="30" inputMode="numeric" />
              </AdField>
              <div>
                <div className="ad-fl">Рука</div>
                <div className="ad-chips">
                  {[{id:'both',label:'Обе (2 зачёта)'},{id:'left',label:'Левая'},{id:'right',label:'Правая'}].map(o=> <AdChip key={o.id} active={proArm===o.id} onClick={()=>setProArm(o.id)}>{o.label}</AdChip>)}
                </div>
              </div>
              <AdField label="Дата старта">
                <input type="date" value={proDate} onChange={e=>setProDate(e.target.value)} />
              </AdField>
              <AdField label="Целевой вес, кг">
                <input value={proTargetW} onChange={e=>setProTargetW(e.target.value)} placeholder="85" inputMode="decimal" />
              </AdField>
              <div>
                <div className="ad-fl">Спарринг</div>
                <div className="ad-chips">
                  {[{id:'off',label:'Выкл'},{id:'70',label:'70% техника'},{id:'90',label:'90% контроль'},{id:'100',label:'100% (heavy-нед)'}].map(o=> <AdChip key={o.id} active={proSpar===o.id} onClick={()=>setProSpar(o.id)}>{o.label}</AdChip>)}
                </div>
              </div>
              <AdField label="Сила левой, кг">
                <input value={proLeft} onChange={e=>setProLeft(e.target.value)} placeholder="—" inputMode="decimal" />
              </AdField>
              <AdField label="Сила правой, кг">
                <input value={proRight} onChange={e=>setProRight(e.target.value)} placeholder="—" inputMode="decimal" />
              </AdField>
              <AdField label="Партнёр Δ, кг">
                <input value={proSparDelta} onChange={e=>setProSparDelta(e.target.value)} placeholder="0" inputMode="decimal" />
              </AdField>
              <AdField label="RT бенч, кг">
                <input value={proBenchRt} onChange={e=>setProBenchRt(e.target.value)} placeholder="—" inputMode="decimal" />
              </AdField>
              <AdField label="Сгибание кисти, фунт">
                <input value={proBenchWristLb} onChange={e=>setProBenchWristLb(e.target.value)} placeholder="—" inputMode="decimal" />
              </AdField>
              <AdField label="Пронация, с">
                <input value={proBenchPron} onChange={e=>setProBenchPron(e.target.value)} placeholder="—" inputMode="numeric" />
              </AdField>
              <AdField label="Боковое, кг">
                <input value={proBenchSide} onChange={e=>setProBenchSide(e.target.value)} placeholder="—" inputMode="decimal" />
              </AdField>
              <AdField label="sRPE (дневник)">
                <input value={proSrpe} onChange={e=>setProSrpe(e.target.value)} placeholder="—" inputMode="decimal" />
              </AdField>
              <AdField label="Боль локтя 0-10">
                <input value={proElbow} onChange={e=>setProElbow(e.target.value)} placeholder="—" inputMode="decimal" />
              </AdField>
            </AdGrid>
            <div className="ad-row">
              <AdSwitch checked={proSupermatch} onChange={setProSupermatch} label="Суперматч best-of-5/6" />
              <AdSwitch checked={proStrap} onChange={setProStrap} label="Ожидается ремень" />
            </div>
            {(proBw || proAge) && (()=>{ try {
              const card = buildWafStartCard({ sex: linked?.profile?.personal?.sex, ageYears: parseFloat(proAge) || 30, bodyWeightKg: parseFloat(proBw) || 80, arm: proArm as any });
              return <div className="ad-tip">WAF {card.ageGroup} · кат. {card.weightClass.label} кг · {card.weighInNote}</div>;
            } catch { return null; } })()}
            {proSupermatch && (()=>{
              const sm = buildSupermatchPlan({ level });
              return <div className="ad-tip">Суперматч: {sm.rounds.length} раундов × {sm.rounds[0]?.fightSec}с / отдых {sm.rounds[0]?.restSec}с · TUT {sm.totalTimeUnderTensionSec}с — пин-холды в слабом углу + скорость.</div>;
            })()}
            {(proLeft && proRight) && (()=>{ try {
              const b = planBilateralVolume({ leftKg: parseFloat(proLeft), rightKg: parseFloat(proRight), baseSets: 10, mrvSets: 16 });
              if (b.asymmetryPct == null) return null;
              return <div className="ad-tip">L/R: асимметрия {b.asymmetryPct}% — {b.note}</div>;
            } catch { return null; } })()}
            {(proBw && proTargetW && proDate) && (()=>{ try {
              const weeksOut = weeksUntilStart(undefined, proDate);
              const cut = planWeightCut({ startKg: parseFloat(proBw), targetKg: parseFloat(proTargetW), weeksOut, sex: linked?.profile?.personal?.sex });
              return <div className="ad-tip">Сгонка: {cut.note}</div>;
            } catch { return null; } })()}
            <div>
              <div className="ad-muted">WAF-фолы ({WAF_FOULS_OUT_AFTER} фола = поражение):</div>
              <div className="ad-chips">
                {WAF_FOULS.map(f=><span key={f.id} title={`${f.what} Профилактика: ${f.prevention}`} className="ad-tag">{f.name}</span>)}
              </div>
            </div>
          </AdSec>

          <AdCta>
            <AdBtn variant="primary" block hero onClick={()=>setStep('grip')}>Далее: Стол и хват →</AdBtn>
            <AdBtn variant="ghost" block onClick={()=>setStep('params')}>← Назад</AdBtn>
          </AdCta>
        </AdCard>
      )}

      {step === 'grip' && (
        <AdCard className="ad-stepview">
          <div>
            <ArmTechniqueCard onApplyWeak={(ws)=>setWeakPoints(ws.slice(0,2))} />
          </div>

          <ArmGripCard onApplyWeak={(ws)=>setWeakPoints(ws.slice(0,2))} />
          <div className="ad-muted">Рекомендация — {best?.name}.</div>
          {GRIP_GROUPS.map(g => (
            <AdSec key={g.title} title={g.title} hook="grip-group" collapsible defaultOpen={false} summary={`${g.ids.length} снар.`}>
              <div className="ad-list">
                {g.ids.map(id => {
                  const spec = GRIP_IMPLEMENTS[id];
                  if (!spec) return null;
                  return (
                    <div key={id} className="ad-sec ad-bio" data-valid="na" data-arm="grip-impl">
                      <div className="ad-row">
                        <span><b>{spec.name}</b></span>
                        <span className="ad-tag ad-angle">⌀{spec.diameterMm}</span>
                        {spec.rotating ? <span className="ad-tag">вращ.</span> : null}
                        <span className="ad-tag">{spec.allowedGrips.join('/')}</span>
                        {spec.strapsAllowed ? <span className="ad-tag">лямки ✓</span> : <span className="ad-tag">без лямок</span>}
                      </div>
                      <div className="ad-volbar" aria-hidden><span style={{ width: `${Math.min(100, Math.round((spec.diameterMm / 76) * 100))}%` }} /></div>
                      <div className="ad-muted">{spec.description}</div>
                    </div>
                  );
                })}
              </div>
            </AdSec>
          ))}
          <AdSec title="🥇 TOP: матчап · скорость" hint="Лестница · sim · календарь" collapsible defaultOpen={false} summary={summTop} status={(topOpp!=='unknown' || topRfd || topSim || topContinuity || topGripAuto || topLadder || cycId) ? 'ok' : undefined}>
            <AdGrid cols="3">
              <div>
                <div className="ad-fl">Стиль оппонента</div>
                <div className="ad-chips">
                  {[{id:'unknown',label:'Неизвестен'},{id:'hook',label:'Хук'},{id:'toproll',label:'Топролл'},{id:'press',label:'Пресс'},{id:'balanced',label:'Универсал'}].map(o=> <AdChip key={o.id} active={topOpp===o.id} onClick={()=>setTopOpp(o.id)}>{o.label}</AdChip>)}
                </div>
              </div>
              <div>
                <div className="ad-fl">Рука оппонента</div>
                <div className="ad-chips">
                  {[{id:'unknown',label:'Неизвестно'},{id:'high',label:'Верхний'},{id:'low',label:'Нижний'},{id:'neutral',label:'Нейтраль'}].map(o=> <AdChip key={o.id} active={topOppHand===o.id} onClick={()=>setTopOppHand(o.id)}>{o.label}</AdChip>)}
                </div>
              </div>
              <AdField label="Оппонент Δ, кг (+ тяжелее)">
                <input value={topWD} onChange={e=>setTopWD(e.target.value)} placeholder="0" inputMode="decimal" />
              </AdField>
              <AdSheetSelect label="Имплемент (лестница)" value={topLadder} onChange={setTopLadder} hook="top-ladder" options={[
                { id:'', label:'—' },
                { id:'fat_gripz', label:'Fat Gripz', desc:'Накладки 50мм' },
                { id:'rolling_thunder', label:'Rolling Thunder', desc:'Вращающаяся ручка 60мм' },
                { id:'apollon_axle', label:'Axle', desc:'Толстый гриф 58мм' },
                { id:'saxon_bar', label:'Saxon', desc:'Щипок 76мм' },
                { id:'pinch_block', label:'Pinch Block', desc:'Блок щипок' },
                { id:'hub', label:'Hub', desc:'Хаб IronMind' },
                { id:'coc_bullet', label:'CoC Bullet', desc:'Эспандер + патрон' },
              ]} />
              <AdField label="Результат (кг/с)">
                <input value={topLadderVal} onChange={e=>setTopLadderVal(e.target.value)} placeholder="—" inputMode="decimal" />
              </AdField>
              <div>
                <div className="ad-fl">Приоритет старта</div>
                <div className="ad-chips">
                  {[{id:'A',label:'A (тейпер 3н)'},{id:'B',label:'B (тейпер 2н)'},{id:'C',label:'C (без тейпера)'}].map(o=> <AdChip key={o.id} active={topCalPrio===o.id} onClick={()=>setTopCalPrio(o.id)}>{o.label}</AdChip>)}
                </div>
              </div>
              <div>
                <div className="ad-fl">Серия</div>
                <div className="ad-chips">
                  {[{id:'local',label:'Локальный'},{id:'waf_worlds',label:'WAF Worlds'},{id:'east_vs_west',label:'East-vs-West'},{id:'super_series',label:'Super Series'}].map(o=> <AdChip key={o.id} active={topCalSeries===o.id} onClick={()=>setTopCalSeries(o.id)}>{o.label}</AdChip>)}
                </div>
              </div>
              <AdSheetSelect label="Grip-RPE неделя" value={topGripWeek} onChange={setTopGripWeek} options={[
                { id:'', label:'Авто' },
                { id:'1', label:'1 (объём)' },
                { id:'2', label:'2 (объём)' },
                { id:'3', label:'3 (интенс.)' },
                { id:'4', label:'4 (делоад)' },
              ]} />
              <AdSheetSelect label="Grip-RPE фаза" value={topGripPhase} onChange={setTopGripPhase} options={[
                { id:'auto', label:'Авто' },
                { id:'volume', label:'Объём RPE7' },
                { id:'intensification', label:'Интенс. RPE8' },
                { id:'peak', label:'Пик RPE9' },
                { id:'deload', label:'Делоад' },
              ]} />
              <AdField label="Тяж. хвата/нед (CNS)">
                <input value={topHeavy} onChange={e=>setTopHeavy(e.target.value)} placeholder="—" inputMode="numeric" />
              </AdField>
              <AdField label="Часов с тяж. тяг">
                <input value={topPullH} onChange={e=>setTopPullH(e.target.value)} placeholder="72" inputMode="decimal" />
              </AdField>
            </AdGrid>
            <div className="ad-row">
              <AdSwitch checked={topRfd} onChange={setTopRfd} label="RFD speed-блок (5×3 RPE8)" />
              <AdSwitch checked={topSim} onChange={setTopSim} label="Contest-sim неделя" />
              <AdSwitch checked={topContinuity} onChange={setTopContinuity} label="🔗 С прошлого плана (+2.5% веса)" />
              <AdSwitch checked={topGripAuto} onChange={setTopGripAuto} label="🌊 Grip-RPE авто-волна" />
            </div>
            {(topOpp !== 'unknown' || topWD) && (()=>{
              try {
                const mp = profileOpponent({ myTechnique: technique, oppStyle: topOpp, oppHand: topOppHand, weightDeltaKg: parseFloat(topWD) || 0, strapExpected: proStrap });
                return <div className="ad-tip">Матчап: {mp.note} Приоритет: {mp.priorityMuscles.slice(0,3).join(', ')}.</div>;
              } catch { return null; }
            })()}
            {topLadder && (()=>{
              try {
                const sex = linked?.profile?.personal?.sex || 'male';
                return <div className="ad-tip">{ladderAdvice(topLadder, parseFloat(topLadderVal) || 0, sex)}</div>;
              } catch { return null; }
            })()}
            {(proDate && topSim) && (()=>{
              try {
                const sim = buildContestSimWeek({ level, discipline, strapExpected: proStrap, targetKg: parseFloat(proTargetW) || undefined, supermatch: proSupermatch });
                return <div className="ad-tip">{sim.note} Чеклист: {sim.checklist.slice(0,3).join(' · ')}.</div>;
              } catch { return null; }
            })()}
            {proDate && (()=>{
              try {
                const cal = buildArmCalendar({ startIso: proDate, priority: topCalPrio, series: topCalSeries });
                const year = topCalSeries !== 'local' ? superSeriesYear(topCalSeries) : null;
                return <div className="ad-tip">Календарь: {cal.note}{year ? ` Год: ${year.note}.` : ''}</div>;
              } catch { return null; }
            })()}
            {(topGripWeek || topGripPhase !== 'auto') && (()=>{
              try {
                const g = buildGripRpe({ week: parseInt(topGripWeek) || 1, phase: topGripPhase !== 'auto' ? topGripPhase : undefined });
                return <div className="ad-tip">Grip-RPE: {g.note} Экстензоры {g.extensor.sets}×{g.extensor.reps} обязательно.</div>;
              } catch { return null; }
            })()}
          </AdSec>

          <AdCta>
            <AdBtn variant="primary" block hero onClick={()=>setStep('split')}>Далее: Сплит и цикл →</AdBtn>
            <AdBtn variant="ghost" block onClick={()=>setStep('athlete')}>← Назад</AdBtn>
          </AdCta>
        </AdCard>
      )}

      {step === 'split' && (
        <AdCard className="ad-stepview">
          <AdSec title="🗓 Выбор сплита" hint={`Ранжирование по уровню/цели/технике/хватe/дням (${daysPerWeek}/нед). Зелёный — лучший.`}>
            <SplitList ranked={ranked} patternId={patternId} onPick={pickSplit} />
          </AdSec>
          <AdCta>
            <AdBtn variant="primary" block hero onClick={handleBuild}>⚡ Собрать план</AdBtn>
            {builtPlan && <AdBtn variant="ghost" block onClick={() => setStep('plan')}>Далее: План →</AdBtn>}
            <div className="ad-muted">Лучший сплит: <b>{best?.name || '—'}</b> ({ranked[0]?.score ?? 0} баллов) · {ranked[0]?.rationale.slice(0,2).join(' · ')}</div>
          </AdCta>
          <AdSec title="📚 Именной цикл" hint="Выбор цикла ставит его недели (exact-fit, согласие не нужно). Пусто = обычный план." collapsible defaultOpen={false} summary={summCyc} status={cycId ? 'ok' : undefined}>
            {rankedCycles.length > 0 && (
              <CyclePickerList items={rankedCycles} cycId={cycId} onPick={pickCycleId} levelRu={CYC_LEVEL_RU} phaseRu={CYC_PHASE_RU} />
            )}
            <AdGrid cols="2">
              <AdSheetSelect label="Цикл" value={cycId} onChange={pickCycleId} hook="cycle-select" options={[
                { id:'', label:'— обычный план —', desc:'параметрический план без шаблона' },
                ...ARM_CYCLE_LIBRARY.map(c=> ({ id: c.id, label: `${c.name} (${c.weeks}н)`, desc: `${c.daysPerWeek}×/нед · ${c.rpe}` })),
              ]} />
              <AdSheetSelect label="Медли (армлифтинг)" value={cycMedley} onChange={setCycMedley} options={[
                { id:'', label:'—' },
                ...ARM_MEDLEYS.map(m=> ({ id: m.id, label: m.name })),
              ]} />
              <AdField label="Коррекция %/нед (СРЦ 0.5)">
                <input value={cycCorr} onChange={e=>setCycCorr(e.target.value)} placeholder="0.5" inputMode="decimal" />
              </AdField>
              <AdSheetSelect label="CoC рабочий" value={cycCoc} onChange={setCycCoc} options={[
                { id:'', label:'—' },
                { id:'guide', label:'Guide', desc:'разминка' },
                { id:'sport', label:'Sport', desc:'база' },
                { id:'trainer', label:'Trainer', desc:'переходный' },
                { id:'no1', label:'№1' },
                { id:'no1_5', label:'№1.5' },
                { id:'no2', label:'№2' },
                { id:'no2_5', label:'№2.5' },
                { id:'no3', label:'№3', desc:'элита' },
              ]} />
              <div>
                <div className="ad-fl">Pumpkin-рука (Larratt)</div>
                <div className="ad-chips">
                  {[{id:'',label:'—'},{id:'left',label:'Левая'},{id:'right',label:'Правая'}].map(o=> <AdChip key={o.id || 'none'} active={cycPumpkin===o.id} onClick={()=>setCycPumpkin(o.id)}>{o.label}</AdChip>)}
                </div>
              </div>
            </AdGrid>
            <div className="ad-row">
              <AdSwitch checked={cycConsent} onChange={setCycConsent} label="Согласен на растяжение/сжатие цикла" />
              <AdSwitch checked={cycFlat} onChange={setCycFlat} label="Плоская пирамида (Бомпа)" />
              <AdSwitch checked={cycBlood} onChange={setCycBlood} label="Приток крови 100×" />
              <AdSwitch checked={cycNever} onChange={setCycNever} label="Без отказов" />
              <AdSwitch checked={cycSingles} onChange={setCycSingles} label="Тяжёлые синглы 17–18" />
              <AdSwitch checked={cycBrzenk} onChange={setCycBrzenk} label="Брзенк 1+1" />
              <AdSwitch checked={cycAkimov} onChange={setCycAkimov} label="Акимов-крюк" />
              {cycAkimov && <AdSwitch checked={cycComp} onChange={setCycComp} label="Соревн. период" />}
              <AdSwitch checked={cycFor} onChange={setCycFor} label="ФОР-7 (для продвинутых)" />
              <AdSwitch checked={cycAxisOn} onChange={setCycAxisOn} label="Ось humerus-2026" />
              {cycFor && (
                <AdSheetSelect label="ФОР-домен" value={cycForSpec} onChange={setCycForSpec} options={[
                  { id:'support', label:'Поддержка' },
                  { id:'crush', label:'Дробление' },
                  { id:'pinch', label:'Щипок' },
                  { id:'open', label:'Открытый' },
                  { id:'wrist', label:'Кисть' },
                ]} />
              )}
            </div>
            {cycAxisOn && (
              <AdSec title="Ось кисть–локоть–плечо (что было):">
                <div className="ad-row">
                  <AdSwitch checked={axTrunk} onChange={setAxTrunk} label="Скрут корпуса в атаку" />
                  <AdSwitch checked={axMisalign} onChange={setAxMisalign} label="Ось разорвана" />
                  <AdSwitch checked={axBehind} onChange={setAxBehind} label="Запястье позади плеча" />
                  <AdSwitch checked={axDorsal} onChange={setAxDorsal} label="Кисть разогнута назад" />
                  <AdSwitch checked={axCold} onChange={setAxCold} label="Холод без разминки" />
                  <AdSwitch checked={axDefense} onChange={setAxDefense} label="Борьба из защиты" />
                  <AdSwitch checked={axSideMax} onChange={setAxSideMax} label="Макс бокового" />
                </div>
              </AdSec>
            )}
            {cycMedley && (()=>{
              let events: Array<{ implement: string }> = [];
              try { events = (getMedley(cycMedley)?.events || []) as Array<{ implement: string }>; } catch { events = []; }
              if (!events.length) return null;
              return (
                <AdSec title="Попытки медли (факт → сводка):">
                  {events.map((ev, i)=>(
                    <label key={i} className="ad-check">{ev.implement}
                      <input aria-label={`Попытка ${i + 1} кг`} value={medAttKg[i] || ''} onChange={e=>setMedAttKg(prev=>prev.map((v, j)=>j===i?e.target.value:v))} placeholder="кг" inputMode="decimal" />
                      <input aria-label={`Попытка ${i + 1} удачна`} type="checkbox" checked={medAttOk[i] !== false} onChange={e=>setMedAttOk(prev=>prev.map((v, j)=>j===i?e.target.checked:v))} />
                    </label>
                  ))}
                </AdSec>
              );
            })()}
            {cycId && (()=>{
              try {
                const f = fitCycleToWeeks(cycId, weeks);
                return <div className="ad-tip">Цикл: {f.note}{f.needsConsent && !cycConsent ? ' — поставьте согласие или недели = длине цикла.' : ''}</div>;
              } catch { return null; }
            })()}
          </AdSec>
          <AdCta>
            <AdBtn variant="ghost" block onClick={()=>setStep('grip')}>← Назад</AdBtn>
          </AdCta>
        </AdCard>
      )}

      {step === 'plan' && (
        <AdCard className="ad-stepview">
          {!builtPlan ? <AdEmpty icon="📋" title="План не собран — вернись в «Параметры»." sub="Выбери дисциплину, уровень и цель — соберём периодизацию 3/2/1 с tendon-cap и humerus-guard."><AdBtn variant="primary" block onClick={()=>setStep('params')}>🎛 К параметрам</AdBtn></AdEmpty> : (
            <>
              <div className="ad-sec-t">📋 План — {builtPlan.pattern.name}</div>
              <div className="ad-row" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                <span className="ad-tag">{DISCIPLINES.find(d => d.id === discipline)?.label || discipline}</span>
                <span className="ad-tag">{TECHNIQUES.find(t => t.id === technique)?.label || technique}</span>
                <span className="ad-tag">{level === 'beginner' ? 'Новичок' : level === 'intermediate' ? 'Средний' : level === 'advanced' ? 'Продвинутый' : 'На курсе'}</span>
                <span className="ad-tag">{GOALS.find(g => g.id === goal)?.label || goal}</span>
                {weakPoints.length > 0 && <span className="ad-tag">🎯 {weakPoints.map(m => ARM_MUSCLE_RU[m] || m).join(' + ')}</span>}
                {cycId ? <span className="ad-tag">📚 {ARM_CYCLE_LIBRARY.find(c => c.id === cycId)?.name || cycId}</span> : null}
              </div>
              {planDash && (
                <div className="ad-stats" data-arm="plan-dash">
                  <div className="ad-stat"><div className="ad-stat-v">{planDash.weeks}</div><div className="ad-stat-l">Недель</div></div>
                  <div className="ad-stat"><div className="ad-stat-v">{planDash.sess}</div><div className="ad-stat-l">Сессий</div><div className="ad-stat-s">{planDash.ex} упр.</div></div>
                  <div className="ad-stat"><div className="ad-stat-v">{planDash.tablePct}%</div><div className="ad-stat-l">Стол</div></div>
                  <div className="ad-stat"><div className="ad-stat-v">{planDash.light}</div><div className="ad-stat-l">Делод/пик</div></div>
                </div>
              )}
              <div className="ad-strip" data-arm="week-pills">
                {builtPlan.weeks.map((w:any)=> {
                  const v = planDash && planDash.vol[w.week - 1] != null ? planDash.vol[w.week - 1] : 0;
                  const h = planDash ? Math.max(8, Math.round((v / planDash.volMax) * 100)) : 8;
                  return (
                  <button key={w.week} className="ad-wpill" data-active={weekSel===w.week} data-phase={w.phase} onClick={()=>setWeekSel(w.week)} aria-label={`Неделя ${w.week}, сетов ${v}`}>
                    <span className="ad-wpill-bar" aria-hidden><span className="ad-wpill-fill" style={{ height: `${h}%` }} /></span>
                    <span className="ad-wpill-t" style={{ fontVariantNumeric: 'tabular-nums' }}>Н{w.week} · {v} {w.phase==='deload' ? '· deload' : w.phase==='peaking' ? '· пик' : ''}</span>
                  </button>
                  );
                })}
              </div>
              {curWeek && (
                <div>
                  <h4 className="ad-sec-t"><span aria-hidden style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 99, background: PHASE_DOT[curWeek.phase] || '#94a3b8', marginRight: 6, verticalAlign: '1px' }} />Неделя {curWeek.week} — {curWeek.phase} {curWeek.deload ? '(deload)' : ''}</h4>
                  {editsCount > 0 && <div className="ad-row" style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}><span className="ad-tag">✏️ Правки: {editsCount} упр.</span><AdBtn variant="ghost" data-arm="edits-reset" onClick={()=>{ setArmEdits({}); setEditOpen(null); }}>Сбросить правки</AdBtn></div>}
                  {curWeek.note && <div className="ad-tip">📝 {curWeek.note}</div>}
                  <div className="ad-sess-list">
                  {curWeek.sessions.map((sess:any, si:number)=> (
                    <div key={si} className="ad-sess" style={CHAR_EDGE[sess.character] ? { borderLeft: `3px solid ${CHAR_EDGE[sess.character]}` } : undefined}>
                      <div className="ad-sess-h">{sess.sessionTag} <span className="ad-tag" data-ch={sess.character}>{sess.character}</span> {sess.tableTime ? <span className="ad-tag" data-ch="table">🖐️ стол</span> : ''}</div>
                      {sess.note && <div className="ad-muted">📝 {sess.note}</div>}
                      {sess.exercises.map((ex:any, ei:number)=> (
                        <div key={ei} className="ad-ex">
                          <div className="ad-ex-top">
                            <span className="ad-ex-nm">{ex.name} <span>· {ARM_MUSCLE_RU[ex.muscle] || ex.muscle}</span> {ex.isTable ? '🖐️' : ''} {ex.workingAngle ? `· РУ ${ex.workingAngle.elbowDeg}° ${ex.workingAngle.direction}` : ''}</span>
                            <span className="ad-ex-vl"><b style={{ fontVariantNumeric: 'tabular-nums' }}>{ex.sets}×{ex.repsRange[0]}-{ex.repsRange[1]}</b> <span className="ad-tag" style={rirTint(ex.rir)}>RIR{ex.rir}</span>{ex.holdSeconds ? <span className="ad-tag">hold {ex.holdSeconds}с</span> : ''}{ex.workSets?.[0]?.weight > 0 ? <span className="ad-wtag">≈{ex.workSets[0].weight} кг</span> : ''}{armEdits[armEditKey(curWeek.week, si, ei)] ? <span className="ad-tag" data-arm="ex-edited">✏️</span> : ''} <button type="button" className="ad-chip" data-arm="ex-edit-toggle" aria-expanded={editOpen===armEditKey(curWeek.week, si, ei)} aria-label={`Править ${ex.name}`} onClick={()=>setEditOpen(prev=>prev===armEditKey(curWeek.week, si, ei)?null:armEditKey(curWeek.week, si, ei))} style={{ minHeight: 44, padding: '8px 12px' }}>✏️</button></span>
                          </div>
                          {ex.comment && /RFD speed|Contest-sim|унилатерально|Table-IQ|overcrush|negatives|🔄 Замена/.test(ex.comment) && (
                            <div className="ad-tip">💡 {ex.comment}</div>
                          )}
                          {ex.workSets?.[0]?.weight > 0 && ex.sets > 1 && (
                            <div className="ad-volbar" aria-hidden><span style={{ width: `${Math.min(100, Math.round((ex.sets / 5) * 100))}%` }} /></div>
                          )}
                          {editOpen===armEditKey(curWeek.week, si, ei) && (()=>{
                            const ekey = armEditKey(curWeek.week, si, ei);
                            const cur = armEdits[ekey] || {};
                            const cands = swapCandidatesFor(ex);
                            const setEd = (patch: Partial<ArmExerciseEdit>) => setArmEdits(prev=>({ ...prev, [ekey]: { ...cur, ...patch } }));
                            return (
                            <div data-arm="ex-editor" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 6, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                              <AdField label="Сеты">
                                <input type="number" aria-label={`Сеты ${ex.name}`} min={0} max={20} value={cur.sets ?? ex.sets} onChange={e=>{ const v = parseInt(e.target.value); setEd({ sets: Number.isFinite(v) ? Math.max(0, Math.min(20, v)) : ex.sets }); }} style={{ width: 64 }} />
                              </AdField>
                              <AdField label="Повт">
                                <input type="number" aria-label={`Повторы ${ex.name}`} min={1} max={30} value={cur.reps ?? ex.repsRange[0]} onChange={e=>{ const v = parseInt(e.target.value); if (Number.isFinite(v)) setEd({ reps: Math.max(1, Math.min(30, v)) }); }} style={{ width: 64 }} />
                              </AdField>
                              <AdField label="Вес, кг">
                                <input type="number" aria-label={`Вес ${ex.name}`} min={0} max={500} inputMode="decimal" value={cur.weight ?? ex.workSets?.[0]?.weight ?? 0} onChange={e=>{ const v = parseFloat(e.target.value); if (Number.isFinite(v)) setEd({ weight: Math.max(0, v) }); }} style={{ width: 76 }} />
                              </AdField>
                              {cands.length > 0 && (
                              <AdField label="Замена (та же группа)">
                                <select aria-label={`Замена для ${ex.name}`} value={cur.swapId ?? ''} onChange={e=>setEd({ swapId: e.target.value || undefined })} style={{ maxWidth: 220 }}>
                                  <option value="">— как в плане —</option>
                                  {cands.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                              </AdField>
                              )}
                              <button type="button" className="ad-chip" aria-label={`Сбросить правку ${ex.name}`} onClick={()=>setArmEdits(prev=>{ const n={...prev}; delete n[ekey]; return n; })} style={{ minHeight: 44, padding: '8px 12px' }}>↩</button>
                            </div>
                            );
                          })()}
                        </div>
                      ))}
                    </div>
                  ))}
                  </div>
                </div>
              )}
              <AdCta>
                <AdBtn variant="primary" block hero onClick={() => setStep('quality')}>Далее: Проверка →</AdBtn>
                <AdBtn variant="ghost" block onClick={() => setStep('split')}>← Назад</AdBtn>
              </AdCta>
            </>
          )}
        </AdCard>
      )}

      {step === 'quality' && !builtPlan && (
        <AdCard className="ad-stepview">
          <AdEmpty icon="🏋️" title="План не собран — вернись в «Сплит и цикл»." sub="Собери план — здесь появятся гейты качества, тепловая карта и веса."><AdBtn variant="primary" block onClick={() => setStep('split')}>📚 К сплиту</AdBtn></AdEmpty>
        </AdCard>
      )}
      {step === 'quality' && builtPlan && (
        <AdCard data-arm="quality-card" className="ad-stepview">
            <>
              <AdSec title="📊 Качество">
                <div className="ad-muted"><b>{builtPlan.report?.summary}</b></div>
                <div className="ad-stats">
                  <div className="ad-stat">
                    <div className="ad-stat-v">Фазы</div>
                    <div className="ad-stat-s">{builtPlan.report?.phaseRationale.join(' · ')}</div>
                  </div>
                  <div className="ad-stat">
                    <div className="ad-stat-v">Объём</div>
                    <div className="ad-stat-s">{builtPlan.report?.volumeSummary.join(' · ')}</div>
                  </div>
                </div>
                {builtPlan.validation && (
                  <div className="ad-list" data-arm="gates">
                    {builtPlan.validation.errors.length>0 && (
                      <div className="ad-sec ad-bio" data-valid="bad" data-arm="gate-errors">
                        <div className="ad-sec-t">❌ Ошибки ({builtPlan.validation.errors.length})</div>
                        {builtPlan.validation.errors.map((e: string, i: number) => <div key={i} className="ad-finding" data-level="critical">{e}</div>)}
                      </div>
                    )}
                    {(() => {
                      const groups = groupWarnings(builtPlan.validation.warnings || []);
                      const cards: React.ReactNode[] = [];
                      for (const k of GUARD_KEYS) {
                        const list = groups[k];
                        cards.push(
                          <div key={k} className="ad-sec ad-bio" data-valid={list.length ? 'warn' : 'ok'} data-arm={`gate-${k}`}>
                            <div className="ad-sec-t">{GATE_META[k].title} {list.length ? `· ${list.length}` : '· ✓ чисто'}</div>
                            {list.slice(0, 5).map((w: string, i: number) => <div key={i} className="ad-finding" data-level="warn">{w}</div>)}
                            {list.length > 5 && <div className="ad-muted">+{list.length - 5} ещё</div>}
                          </div>
                        );
                      }
                      for (const k of EXTRA_KEYS) {
                        const list = groups[k];
                        if (!list.length) continue;
                        cards.push(
                          <div key={k} className="ad-sec ad-bio" data-valid="na" data-arm={`gate-${k}`}>
                            <div className="ad-sec-t">{GATE_META[k].title} · {list.length}</div>
                            {list.slice(0, 5).map((w: string, i: number) => <div key={i} className="ad-finding" data-level={k === 'other' ? 'ok' : 'warn'}>{w}</div>)}
                            {list.length > 5 && <div className="ad-muted">+{list.length - 5} ещё</div>}
                          </div>
                        );
                      }
                      return cards;
                    })()}
                    {builtPlan.validation.valid && <AdBanner tone="ok">✓ Валидация пройдена (MRV, humerus, UCL, shoulder, tendon).</AdBanner>}
                  </div>
                )}
                <div data-arm="report-lines">
                  {builtPlan.report?.techniqueRationale.map((r:string,i:number)=><div key={i} className="ad-finding" data-level="info">{r}</div>)}
                  {builtPlan.report?.gripRationale.map((r:string,i:number)=><div key={i} className="ad-finding" data-level="info">{r}</div>)}
                </div>
              </AdSec>
              <div>
                <ArmHeatmap plan={viewPlan} onToast={flash} />
              </div>
              {editsCount > 0 && <div className="ad-muted">✏️ Правки: {editsCount} упр. — гейты и отчёт по базовому плану.</div>}
              <AdBanner tone="warn">
                <b>4 гейта:</b> humerus (side ≤3, ≤10%/нед, RIR≥2) · UCL (hook n00b) · shoulder (≥4, 12-20, RIR≥2) · tendon (12/16/18/22) — все в валидации.
              </AdBanner>
              <AdCta>
                <AdBtn variant="primary" block hero onClick={() => setStep('export')}>Далее: Экспорт →</AdBtn>
                <AdBtn variant="ghost" block onClick={() => setStep('plan')}>← Назад</AdBtn>
              </AdCta>
            </>
        </AdCard>
      )}
      {step === 'quality' && builtPlan && (
        <AdCard data-arm="weights-card" className="ad-stepview">
          <AdSec title="🏋️ Веса — детали" hint="Веса теперь из рабочих максимумов (выше). Если пусто — используется вес из профиля (default). Прогрессия: тяж 82%, техника 60%, памп 68% от максимума. Для grip — support/pinch отдельно.">
              <>
                <div className="ad-stats">
                  {Object.entries(workMax).map(([k,v])=> (
                    <div key={k} className="ad-stat"><div className="ad-stat-v">{String(v)} кг</div><div className="ad-stat-l">{k}</div></div>
                  ))}
                </div>
                {Object.keys(workMax).length === 0 && (
                  <div className="ad-muted">Максимумы не заданы — введи их в «Параметры» или вес тела в профиле, иначе веса подберутся от базы.</div>
                )}
                <div className="ad-muted">Пример веса в плане (неделя 1, тяж): {(() => {
                  try {
                    const ex = builtPlan.weeks[0]?.sessions[0]?.exercises[0];
                    if (!ex) return '—';
                    return `${ex.name} — ${ex.workSets[0]?.weight ?? 0} кг × ${ex.workSets[0]?.reps} RIR${ex.rir} (${ex.tempoSpec})`;
                  } catch { return '—'; }
                })()}</div>
                {discipline === 'armlifting' && (
                  <AdSec title="🏟 Помост: план попыток (опенер 90 / 96 / 102%)" hook="platform">
                    <AdGrid cols="2">
                      <AdSheetSelect label="Снаряд" value={proPlatImpl} onChange={setProPlatImpl} options={
                        Object.entries(PLATFORM_WR).map(([id, r])=> ({ id, label: (r as any).name + (platformIsInternal(id) ? ' (ориентир)' : '') }))
                      } />
                      <AdField label="Цель, кг">
                        <input value={proPlatTarget} onChange={e=>setProPlatTarget(e.target.value)} placeholder="100" inputMode="decimal" />
                      </AdField>
                    </AdGrid>
                    <div className="ad-muted">{(()=>{
                      const t = parseFloat(proPlatTarget);
                      if (!(t > 0)) return 'Введите цель — покажем раскладку попыток и %WR.';
                      const att = planAttempts(t);
                      const wr = platformWrFor(proPlatImpl, linked?.profile?.personal?.sex);
                      const pct = Math.round((t / wr) * 1000) / 10;
                      const lvl = pct >= 90 ? 'элита' : pct >= 70 ? 'соревновательный уровень' : 'база';
                      const orientir = platformIsInternal(proPlatImpl);
                      return (<><div className="ad-hero-side" data-arm="platform-wr">
                        <div className="ad-hero-score" aria-hidden><b>{pct}%</b><span>{orientir ? 'ориентир' : 'WR'}</span></div>
                        <div className="ad-hero-name">цель {t} кг · {orientir ? `ориентир ${wr}` : `WR ${wr}`} кг<span>{lvl} · опенер {att[0]} кг</span></div>
                        <span className="ad-tag" data-sev={pct >= 90 ? 'ok' : pct >= 70 ? 'warn' : 'bad'}>{lvl}</span>
                      </div>
                      <div className="ad-volbar" aria-hidden><span style={{ width: `${Math.min(100, pct)}%` }} /></div>
                      <div className="ad-stats">{att.map((a: number, i: number) => (
                        <div key={i} className="ad-stat"><div className="ad-stat-v">{a} кг</div><div className="ad-stat-l">Попытка {i + 1}</div><div className="ad-stat-s">{[90, 96, 102][i]}%</div></div>
                      ))}</div>{`Попытки: ${att.join(' / ')} кг · WR ${wr} кг · цель ${pct}% WR — ${lvl}. Правило помоста: промах = выбыл, только DOH, без лямок.`}</>);
                    })()}</div>
                  </AdSec>
                )}
                <AdBtn variant="primary" block onClick={handleBuild}>🔄 Пересобрать с весами</AdBtn>
                <AdCta>
                  <AdBtn variant="primary" block hero onClick={() => setStep('export')}>Далее: Экспорт →</AdBtn>
                  <AdBtn variant="ghost" block onClick={() => setStep('plan')}>← Назад</AdBtn>
                </AdCta>
              </>
          </AdSec>
        </AdCard>
      )}
      {step === 'export' && (
        <AdCard className="ad-stepview">
          {!builtPlan ? <AdEmpty icon="📤" title="План не собран — вернись в «Параметры»." sub="Собери план на шаге «Сплит и цикл» — здесь появятся печать, календарь и обоснование."><AdBtn variant="primary" block onClick={() => setStep('params')}>🎛 К параметрам</AdBtn></AdEmpty> : (
            <>
              <div className="ad-sec-t">📤 Экспорт — {builtPlan.pattern.name}</div>
              <div className="ad-row" data-arm="export-actions" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                <AdBtn variant="ghost" onClick={() => {
                  let diag: any = null;
                  try { const raw = localStorage.getItem('he_arm_last_diagnostics'); if (raw) diag = JSON.parse(raw); } catch {}
                  try {
                    const trials = loadForceTrials();
                    const stats = buildWeeklyStats(trials, 12);
                    const ft = fatigueTrend(stats);
                    const tr = forceTrend(stats);
                    if (diag) { diag.fatigue = ft?.text; diag.trend = tr?.text; }
                  } catch {}
                  let proSummary: any = null;
                  try { if (builtPlan?.inputSnapshot) proSummary = buildArmProSummary(builtPlan.inputSnapshot); } catch { proSummary = null; }
                  const html = buildArmPrintHtml(viewPlan, { findings: diag?.findings, humerusWarnings: diag?.humerusWarnings, balanceWarnings: diag?.balanceWarnings, asymmetryPct: diag?.asymmetryPct, benchLevel: diag?.benchLevel, fatigue: diag?.fatigue, trend: diag?.trend, info: diag?.info }, proSummary);
                  const w = window.open('', '_blank');
                  if (w) { w.document.write(html); w.document.close(); } else flash('⚠ Всплывающие окна заблокированы');
                }} block style={{ minHeight: 48 }}>🖨 Печать</AdBtn>
                <AdBtn variant="ghost" block style={{ minHeight: 48 }} onClick={() => {
                  const ics = buildArmIcs(viewPlan);
                  const blob = new Blob([ics], { type: 'text/calendar' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url; a.download = 'arm-plan.ics'; a.click(); URL.revokeObjectURL(url);
                }}>📅 .ics</AdBtn>
                <AdBtn variant="ghost" onClick={() => {
                  const tot = (viewPlan.weeks || []).reduce((a: number, w: any) => a + (w.sessions || []).reduce((x: number, s: any) => x + (s.exercises || []).reduce((y: number, e: any) => y + (e.sets || 0), 0), 0), 0);
                  const lines = [
                    `🤝 Арм-план — ${viewPlan.pattern.name} (${viewPlan.weeks.length} нед)`,
                    `${discipline} · ${technique} · ${level} · ${goal}`,
                    weakPoints.length ? `Слабые: ${weakPoints.join(', ')}` : 'Без специализации',
                    cycId ? `Цикл: ${cycId}` : 'Обычный план',
                    `Всего: ${tot} сетов · стол ${planDash ? planDash.tablePct : '—'}%`,
                    (viewPlan.weeks || []).map((w: any) => `Н${w.week} (${w.phase}): ${(w.sessions || []).reduce((x: number, s: any) => x + (s.exercises || []).reduce((y: number, e: any) => y + (e.sets || 0), 0), 0)}`).join(' · '),
                  ];
                  const txt = lines.join('\n');
                  const done = () => flash('✅ Сводка скопирована');
                  const fallback = () => {
                    try {
                      const ta = document.createElement('textarea');
                      ta.value = txt;
                      document.body.appendChild(ta);
                      ta.select();
                      (document as any).execCommand('copy');
                      document.body.removeChild(ta);
                      done();
                    } catch { flash('⚠ Не удалось скопировать'); }
                  };
                  try {
                    const nav: any = navigator as any;
                    if (nav?.clipboard?.writeText) nav.clipboard.writeText(txt).then(done, fallback);
                    else fallback();
                  } catch { fallback(); }
                }} block style={{ minHeight: 48 }}>📋 Копировать сводку</AdBtn>
              </div>
              <AdSec title="💾 Варианты плана" hint="Сохранить текущий (с правками), загрузить, удалить. Кап 10." collapsible defaultOpen={false} summary={`${armVariants.length}/10`}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <AdField label="Название варианта">
                    <input aria-label="Название варианта" value={variantName} onChange={e=>setVariantName(e.target.value)} placeholder={`${viewPlan.pattern.name} · ${viewPlan.weeks.length} нед`} style={{ minWidth: 180 }} />
                  </AdField>
                  <AdBtn variant="primary" onClick={()=>{
                    const name = variantName.trim() || `${viewPlan.pattern.name} · ${viewPlan.weeks.length} нед · ${new Date().toLocaleDateString('ru-RU')}`;
                    const v: ArmPlanVariant = { id: `armv-${Date.now()}`, name, dateIso: new Date().toISOString(), plan: viewPlan };
                    const next = [v, ...armVariants].slice(0, 10);
                    setArmVariants(next);
                    saveArmVariants(next);
                    setVariantName('');
                    flash(`💾 Вариант сохранён: ${name}`);
                  }}>💾 Сохранить вариант{editsCount > 0 ? ' (с правками)' : ''}</AdBtn>
                </div>
                {armVariants.length === 0 ? <div className="ad-muted">Вариантов пока нет.</div> : (
                  <div className="ad-list" data-arm="variants-list">
                    {armVariants.map(v=>(
                      <div key={v.id} className="ad-sec ad-bio" data-valid="na">
                        <div className="ad-row" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ flex: 1 }}><b>{v.name}</b> <span className="ad-muted">· {(v.plan?.weeks || []).length} нед · {String(v.dateIso || '').slice(0, 10)}</span></span>
                          <AdChip active={cmpIds.includes(v.id)} onClick={()=>{
                            setCmpIds(prev=>{
                              if (prev.includes(v.id)) return prev.filter(x=>x!==v.id);
                              return [...prev, v.id].slice(-2);
                            });
                          }} aria-label={`Сравнить ${v.name}`}>⇄</AdChip>
                          <AdBtn variant="ghost" aria-label={`Загрузить ${v.name}`} style={{ minWidth: 48, minHeight: 48 }} onClick={()=>{
                            setBuiltPlan(v.plan);
                            try { localStorage.setItem('he_arm_last_plan', JSON.stringify(v.plan)); } catch {}
                            setArmEdits({});
                            setEditOpen(null);
                            setWeekSel(1);
                            setStep('plan');
                            flash(`📥 Вариант загружен: ${v.name}`);
                          }}>📥</AdBtn>
                          <AdBtn variant="ghost" aria-label={`Скачать ${v.name} JSON`} style={{ minWidth: 48, minHeight: 48 }} onClick={()=>{
                            try {
                              const blob = new Blob([JSON.stringify(v, null, 2)], { type: 'application/json' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `arm-plan-${v.id}.json`;
                              a.click();
                              URL.revokeObjectURL(url);
                            } catch { flash('⚠ Не удалось скачать'); }
                          }}>📤</AdBtn>
                          <AdBtn variant="ghost" aria-label={`Удалить ${v.name}`} style={{ minWidth: 48, minHeight: 48 }} onClick={()=>{
                            const next = armVariants.filter(x=>x.id!==v.id);
                            setArmVariants(next);
                            saveArmVariants(next);
                            flash('🗑 Вариант удалён');
                          }}>✕</AdBtn>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {cmpDiff?.diff && (
                  <div data-arm="variants-diff" style={{ marginTop: 8, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="ad-sec-t">⇄ {cmpDiff.names[0]} vs {cmpDiff.names[1]}</div>
                    <div className="ad-muted" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      Недели {cmpDiff.diff.weeksA} → {cmpDiff.diff.weeksB} · Сеты {cmpDiff.diff.setsA} → {cmpDiff.diff.setsB} ({cmpDiff.diff.setsB - cmpDiff.diff.setsA >= 0 ? '+' : ''}{cmpDiff.diff.setsB - cmpDiff.diff.setsA})
                    </div>
                    <div className="ad-muted">Фазы A: {cmpDiff.diff.phasesA || '—'}</div>
                    <div className="ad-muted">Фазы B: {cmpDiff.diff.phasesB || '—'}</div>
                    {cmpDiff.diff.rows.filter(r=>r.d!==0).slice(0, 12).map(r=>(
                      <div key={r.muscle} className="ad-finding" data-level="info" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {ARM_MUSCLE_RU[r.muscle] || r.muscle}: {r.a} → {r.b} ({r.d >= 0 ? '+' : ''}{r.d})
                      </div>
                    ))}
                    {cmpDiff.diff.rows.every(r=>r.d===0) && <div className="ad-muted">Объёмы идентичны.</div>}
                  </div>
                )}
                <div style={{ marginTop: 8 }}>
                  <AdField label="Импорт варианта из JSON-файла">
                    <input type="file" accept="application/json,.json" aria-label="Импорт варианта JSON" onChange={(e)=>{
                      const f = (e.target as HTMLInputElement).files?.[0];
                      if (!f) return;
                      (e.target as HTMLInputElement).value = '';
                      const readText = (): Promise<string> => {
                        try {
                          const t = (f as any).text;
                          if (typeof t === 'function') return t.call(f);
                        } catch {}
                        return new Promise((res, rej) => {
                          try {
                            const rd = new FileReader();
                            rd.onload = () => res(String(rd.result || ''));
                            rd.onerror = () => rej(new Error('read'));
                            rd.readAsText(f);
                          } catch (err) { rej(err); }
                        });
                      };
                      readText().then((txt: string) => {
                        try {
                          const j = JSON.parse(txt);
                          const plan = j && Array.isArray(j.weeks) ? j : j?.plan;
                          if (!plan || !Array.isArray(plan.weeks) || !plan.pattern) { flash('⚠ В файле нет арм-плана'); return; }
                          const v: ArmPlanVariant = {
                            id: `armv-${Date.now()}`,
                            name: String(j?.name || plan?.pattern?.name || 'Импорт').slice(0, 80),
                            dateIso: new Date().toISOString(),
                            plan,
                          };
                          const next = [v, ...armVariants].slice(0, 10);
                          setArmVariants(next);
                          saveArmVariants(next);
                          flash(`📥 Импортирован: ${v.name}`);
                        } catch { flash('⚠ Битый JSON-файл'); }
                      }).catch(()=>flash('⚠ Не удалось прочитать файл'));
                    }} />
                  </AdField>
                </div>
              </AdSec>
              <AdSec title="📖 Обоснование" collapsible defaultOpen={false} summary={`${builtPlan.rationale.length} причин`}>
                <div data-arm="rationale">{builtPlan.rationale.map((r: string, i: number) => <div key={i} className="ad-finding" data-level="info">{r}</div>)}</div>
              </AdSec>
              <AdSec title="📊 Сводка" collapsible defaultOpen={false} summary="фазы · объём">
                <div className="ad-muted"><b>{builtPlan.report?.summary}</b></div>
                <div data-arm="report-lines">
                  {builtPlan.report?.techniqueRationale.map((r: string, i: number) => <div key={i} className="ad-finding" data-level="info">{r}</div>)}
                  {builtPlan.report?.gripRationale.map((r: string, i: number) => <div key={i} className="ad-finding" data-level="info">{r}</div>)}
                </div>
              </AdSec>
              <AdCta>
                <AdBtn variant="primary" block hero onClick={() => setStep('year')}>Далее: Год →</AdBtn>
                <AdBtn variant="ghost" block onClick={() => setStep('quality')}>← Назад</AdBtn>
              </AdCta>
            </>
          )}
        </AdCard>
      )}
      {step === 'year' && (
        <AdCard className="ad-stepview">
          <AdSec title="🗓 Год по блокам" hint="Серия → блоки base/strength/peaking (+тейпер A/B) → сборка каждым buildArmBlock. Без записи в общий годовой план — превью и сборка внутри конструктора.">
            <AdGrid cols="2">
              <div>
                <div className="ad-fl">Серия</div>
                <div className="ad-chips">
                  {YEAR_SERIES.map(o=> <AdChip key={o.id} active={yearSeries===o.id} onClick={()=>{ setYearSeries(o.id); setYearBuilt(null); }}>{o.label}</AdChip>)}
                </div>
              </div>
              <AdField label="Недель в году">
                <input type="number" min={4} max={52} value={yearWeeks} onChange={e=>{ setYearWeeks(Math.max(4, Math.min(52, parseInt(e.target.value) || 52))); setYearBuilt(null); }} />
              </AdField>
            </AdGrid>
            <AdSwitch checked={yearSuggest} onChange={(v)=>{ setYearSuggest(v); setYearBuilt(null); }} label="Именные циклы в блоках (авто-подгонка вкл)" />
            <div className="ad-list" data-arm="year-blocks">
              {yearBlocks.map((b: any)=>(
                <div key={b.blockKey} className="ad-sec ad-bio" data-valid="na">
                  <div className="ad-row" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span><b>{b.phase}</b> <span className="ad-muted">· {b.weeks} нед · приоритет {b.priority}</span></span>
                    <span className="ad-tag">{b.focus}</span>
                  </div>
                  {b.suggestedCycleId && <div className="ad-tip">💡 Цикл: {b.suggestedCycleNote || b.suggestedCycleId}</div>}
                </div>
              ))}
            </div>
          </AdSec>
          <AdCta>
            <AdBtn variant="primary" block hero disabled={yearBusy} onClick={async ()=>{
              if (yearBusy) return;
              setYearBusy(true);
              try {
                // yield кадра: тяжёлая сборка не фризит UI, видна busy-строка
                await new Promise(r=>setTimeout(r, 30));
                const res = yearBlocks.map((b: any)=>{
                  const cfg: any = {
                    discipline, level, technique, gripFocus, workMax,
                    weakPoints, focusGroup: focusGroup || undefined, specialization,
                    patternId: patternId || undefined,
                    taperEnabled: b.priority !== 'C',
                    competitionPriority: b.priority,
                    cycleId: yearSuggest ? b.suggestedCycleId : undefined,
                    cycleConsent: yearSuggest ? true : undefined,
                  };
                  return buildArmBlock({ blockKey: b.blockKey, weeks: b.weeks, phase: b.phase }, cfg, { level });
                });
                setYearBuilt(res);
                const warns = res.reduce((a: number, r: any)=>a + (r.warnings || []).length, 0);
                flash(`🗓 Год собран: ${res.length} блоков · тейпер ${res.filter((r: any)=>r.taperApplied).length} · предупр. ${warns}`);
              } catch (e: any) { flash(`❌ Год: ${e?.message || e}`); } finally { setYearBusy(false); }
            }}>{yearBusy ? '⏳ Собираем год…' : '🗓 Собрать год'}</AdBtn>
            <AdBtn variant="ghost" block onClick={()=>setStep('export')}>← Назад</AdBtn>
          </AdCta>
          {yearBuilt && (
            <AdSec title="📊 Итог года" collapsible defaultOpen={true} summary={`${yearBuilt.length} блоков`}>
              <div className="ad-list" data-arm="year-result">
                {yearBuilt.map((r: any)=>(
                  <div key={r.blockKey} className="ad-sec ad-bio" data-valid={r.warnings.length ? 'warn' : 'ok'}>
                    <div className="ad-row" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span><b>{r.blockKey}</b> <span className="ad-muted">· {r.weeks.length} нед{r.taperApplied ? ' · тейпер' : ''}{r.peakApplied ? ' · пик' : ''}</span></span>
                      {r.warnings.length > 0 && <span className="ad-tag">⚠ {r.warnings.length}</span>}
                    </div>
                    {r.warnings.slice(0, 3).map((w: string, i: number)=><div key={i} className="ad-finding" data-level="warn">{w}</div>)}
                  </div>
                ))}
              </div>
            </AdSec>
          )}
        </AdCard>
      )}
    </AdRoot>
  );
}
