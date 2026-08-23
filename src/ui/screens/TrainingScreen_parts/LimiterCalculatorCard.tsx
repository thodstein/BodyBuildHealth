/**
 * LimiterCalculatorCard.tsx — КАЛЬКУЛЯТОР ЛИМИТИРУЮЩИХ ФАКТОРОВ ДВИЖЕНИЯ (NEW).
 *
 * Измерение Категория (11 калькуляторов) × Движение (6 ядровых: жим лёжа, присед,
 * становая классика, сумо, жим стоя, бицепс).
 *
 * Сначала выбирается КАЛЬКУЛЯТОР (категория-фактор): ⚡ Скорость · 📏 Дожимы/доседы ·
 * 🧱 Стабилизация · 🔄 Режимы сокращения · 💪 Гипертрофия · 🦴 Антропометрия · 🏁 Тип старта ·
 * 🖐 Хват · 🤝 Координация · ⏱ Профиль выносливости · 📐 Геометрия техники (пилот жим: 8 параметров).
 * Внутри — параметры для КАЖДОГО движения
 * (по фазам/параметрам пользователя), для каждой опции — метод с доказательной базой,
 * реальные упражнения из пулов (каталог/СРЦ) и протокол (сеты/повторы/%/RIR/темп).
 *
 * Отмеченные упражнения уходят в ПЛ-авто через kind 'limiter' (категорийный протокол,
 * слабые группы профиля не трогаются).
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  LIMITER_CATEGORIES, limiterOptionsFor, analyzeLimiterOption, limiterOptionById,
  type LimiterOption, type LimiterCategory, type LimiterExerciseItem,
} from '../../../engines/pro/limiter-calculator.engine';
import type { Lift } from '../../../engines/lms/weakpoint-pl';
import { applyToPlanner } from './planner-bridge';

const ACCENT = '#00e68a';
const DIM = '#fff';

/** Ядровые движения (в каждом калькуляторе есть параметры для всех 6). */
const CORE_LIFTS: Lift[] = ['bench', 'squat', 'deadlift', 'sumo', 'ohp', 'biceps'];
/** Вспомогательные движения (дополнительное покрытие там, где есть опции). */
const AUX_LIFTS: Lift[] = ['row', 'pulldown', 'incline_press'];

const LIFT_RU: Record<Lift, string> = {
  bench: 'Жим лёжа', squat: 'Присед', deadlift: 'Становая тяга (классика)',
  ohp: 'Жим стоя', row: 'Тяга в наклоне', pulldown: 'Тяга верхнего блока', incline_press: 'Жим на наклонной',
  sumo: 'Становая тяга (сумо)', biceps: 'Подъём на бицепс',
};

const LIFT_KEYS = Object.keys(LIFT_RU) as Lift[];

/** Персистентность выбора карточки (he_pl_limiter_card_v1). */
const LIM_CARD_KEY = 'he_pl_limiter_card_v1';

interface LimiterCardState {
  category: LimiterCategory | '';
  liftFilter: Lift | '';
  selected: Record<string, string[]>;
  days: Record<string, number[]>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cleanStringMap(raw: unknown): Record<string, string[]> {
  if (!isRecord(raw)) return {};
  const out: Record<string, string[]> = {};
  for (const [key, list] of Object.entries(raw)) {
    if (!Array.isArray(list)) continue;
    const names = list.filter((n): n is string => typeof n === 'string').slice(0, 40);
    if (names.length > 0) out[key.slice(0, 160)] = names;
  }
  return out;
}

function cleanDayMap(raw: unknown): Record<string, number[]> {
  if (!isRecord(raw)) return {};
  const out: Record<string, number[]> = {};
  for (const [key, list] of Object.entries(raw)) {
    if (!Array.isArray(list)) continue;
    const days = list.filter((d): d is number => typeof d === 'number' && Number.isFinite(d) && d >= 1 && d <= 7).slice(0, 7);
    if (days.length > 0) out[key.slice(0, 160)] = days;
  }
  return out;
}

function loadLimiterCardState(): LimiterCardState {
  try {
    const raw = JSON.parse(localStorage.getItem(LIM_CARD_KEY) || 'null');
    if (!isRecord(raw)) throw new Error('bad shape');
    const category = LIMITER_CATEGORIES.some(c => c.id === raw.category) ? (raw.category as LimiterCategory) : '';
    // Миграция: раньше состояние было lift-first (raw.lift) — теперь категория-first.
    const liftFilter = LIFT_KEYS.includes(raw.liftFilter as Lift) ? (raw.liftFilter as Lift) : (LIFT_KEYS.includes(raw.lift as Lift) ? (raw.lift as Lift) : '');
    return {
      category,
      liftFilter,
      selected: cleanStringMap(raw.selected),
      days: cleanDayMap(raw.days),
    };
  } catch {
    return { category: '', liftFilter: '', selected: {}, days: {} };
  }
}

function saveLimiterCardState(state: LimiterCardState): void {
  try { localStorage.setItem(LIM_CARD_KEY, JSON.stringify(state)); } catch { /* quota — молча */ }
}

const CARD: React.CSSProperties = {
  padding: 12, borderRadius: 10, background: 'rgba(24,24,27,0.45)',
  border: '1px solid rgba(255,255,255,0.08)', marginTop: 8,
};
const btn: React.CSSProperties = { padding: '5px 10px', borderRadius: 7, cursor: 'pointer', fontSize: 10, fontWeight: 700, minHeight: 32 };

const CATEGORY_COLOR: Record<LimiterCategory, { color: string; bg: string }> = {
  speed_strength: { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  partial_amplitude: { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  stabilization: { color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  contraction_mode: { color: '#f472b6', bg: 'rgba(244,114,182,0.12)' },
  limiter_hypertrophy: { color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
  anthropometry: { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  start_specific: { color: '#22d3ee', bg: 'rgba(34,211,238,0.12)' },
  grip_stiffness: { color: '#fb7185', bg: 'rgba(251,113,133,0.12)' },
  coordination: { color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  endurance_profile: { color: '#c084fc', bg: 'rgba(192,132,252,0.12)' },
  technique_geometry: { color: '#38bdf8', bg: 'rgba(56,189,248,0.12)' },
};

const protocolText = (p: { sets: number; reps: number; pct: number; rir: number; tempo?: string; rest?: string; holdSec?: number; note?: string }): string => {
  const base = `${p.sets}×${p.reps} @${Math.round(p.pct * 100)}% RIR ${p.rir}`;
  const extras = [
    p.holdSec ? `удержание ${p.holdSec}с` : '',
    p.tempo ? `темп ${p.tempo}` : '',
    p.rest ? `отдых ${p.rest}` : '',
  ].filter(Boolean).join(' · ');
  return extras ? `${base} · ${extras}` : base;
};

const ExerciseRow: React.FC<{ item: LimiterExerciseItem; selected: boolean; onToggle: () => void; onAdd: () => void }> = ({ item, selected, onToggle, onAdd }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 6px', marginTop: 3, borderRadius: 6, background: selected ? 'rgba(0,230,138,0.1)' : 'rgba(255,255,255,0.02)', border: selected ? '1px solid rgba(0,230,138,0.35)' : '1px solid rgba(255,255,255,0.05)' }}>
    <button onClick={onToggle} style={{ minWidth: 24, height: 24, borderRadius: 5, cursor: 'pointer', border: 'none', background: selected ? ACCENT : 'rgba(255,255,255,0.1)', color: selected ? '#000' : DIM, fontWeight: 800, fontSize: 12 }}>{selected ? '✓' : '＋'}</button>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>
        {item.optimal ? '⭐ ' : ''}{item.exercise.name} <span style={{ color: ACCENT, fontWeight: 800 }}>{protocolText(item.protocol)}</span>
      </div>
      <div style={{ fontSize: 9, color: DIM, lineHeight: 1.3, marginTop: 1 }}>{item.rationale}</div>
    </div>
    <button onClick={onAdd} style={{ ...btn, background: 'rgba(0,230,138,0.12)', color: ACCENT, border: '1px solid rgba(0,230,138,0.25)' }}>➕</button>
  </div>
);

/** Блок опции (параметр + метод + упражнения + протокол + дни). */
const OptionBlock: React.FC<{
  o: LimiterOption; analysis: { option: LimiterOption; items: LimiterExerciseItem[] };
  keyOf: string; selected: Record<string, string[]>; days: Record<string, number[]>;
  dayCount: number; onToggle: (name: string) => void; onAdd: (names: string[]) => void;
  onДень: (day: number) => void; onAuto: () => void;
}> = ({ o, analysis, keyOf, selected, days, dayCount, onToggle, onAdd, onDay, onAuto }) => {
  const col = CATEGORY_COLOR[o.category];
  const inPlanDays = days[keyOf] || [];
  return (
    <div style={{ marginTop: 8, padding: 9, borderRadius: 8, background: 'rgba(74,222,128,0.04)', border: '1px solid rgba(74,222,128,0.14)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: col.color }}>{o.label}</div>
        {o.methodOverlay && (
          <span style={{ fontSize: 8, padding: '1px 6px', borderRadius: 5, color: '#fbbf24', background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)', fontWeight: 700 }}>
            🔁 метод на движении в плане — применяется к нему, отдельное упражнение не добавляется
          </span>
        )}
      </div>
      <div style={{ fontSize: 9, color: DIM, marginTop: 2, lineHeight: 1.4 }}>{o.description}</div>
      <div style={{ fontSize: 9, color: '#fbbf24', marginTop: 4, lineHeight: 1.4 }}>📋 {o.method}</div>
      <div style={{ fontSize: 9, color: '#fff', marginTop: 3, lineHeight: 1.4 }}>🧠 {o.rationale}</div>
      {o.references.length > 0 && (
        <div style={{ fontSize: 8, color: '#fff', marginTop: 2 }}>📚 {o.references.join(' · ')}</div>
      )}
      {analysis.items.map((item, idx) => (
        <ExerciseRow key={idx} item={item} selected={selected[keyOf]?.includes(item.exercise.name) ?? false}
          onToggle={() => onToggle(item.exercise.name)} onAdd={() => onAdd([item.exercise.name])} />
      ))}
      <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => onAdd(analysis.items.filter(i => i.optimal).map(i => i.exercise.name))} style={{ ...btn, background: 'rgba(0,230,138,0.15)', color: ACCENT, border: '1px solid rgba(0,230,138,0.3)' }}>➕ Рекомендуемое</button>
        <button onClick={() => onAdd(analysis.items.map(i => i.exercise.name))} style={{ ...btn, background: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.25)' }}>➕ Все</button>
        <span style={{ fontSize: 9, color: DIM }}>Дни:</span>
        <button onClick={onAuto} style={{ padding: '3px 7px', borderRadius: 6, cursor: 'pointer', fontSize: 9, border: !inPlanDays.length ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.1)', background: !inPlanDays.length ? 'rgba(0,230,138,0.12)' : 'transparent', color: !inPlanDays.length ? ACCENT : DIM }}>Авто</button>
        {Array.from({ length: Math.max(1, dayCount) }, (_, index) => index + 1).map(day => (
          <button key={day} onClick={() => onDay(day)} style={{ padding: '3px 7px', borderRadius: 6, cursor: 'pointer', fontSize: 9, border: inPlanDays.includes(day) ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.1)', background: inPlanDays.includes(day) ? 'rgba(0,230,138,0.12)' : 'transparent', color: inPlanDays.includes(day) ? ACCENT : DIM }}>Д{day}</button>
        ))}
      </div>
    </div>
  );
};

export const LimiterCalculatorCard: React.FC<{ dayCount?: number }> = ({ dayCount = 7 }) => {
  const initial = useMemo(loadLimiterCardState, []);
  const [category, setCategory] = useState<LimiterCategory | ''>(initial.category);
  const [liftFilter, setLiftFilter] = useState<Lift | ''>(initial.liftFilter);
  const [selected, setSelected] = useState<Record<string, string[]>>(initial.selected);
  const [days, setDays] = useState<Record<string, number[]>>(initial.days);

  useEffect(() => {
    saveLimiterCardState({ category, liftFilter, selected, days });
  }, [category, liftFilter, selected, days]);

  const effectiveCategory: LimiterCategory | '' = category;
  const col = effectiveCategory ? CATEGORY_COLOR[effectiveCategory] : null;

  // Для выбранного калькулятора: все движения с опциями (ядровые всегда, вспомогательные — если есть).
  const visibleLifts = useMemo<Lift[]>(() => {
    if (!effectiveCategory) return [];
    const lifts = liftFilter ? [liftFilter] : CORE_LIFTS;
    return lifts.filter(l => limiterOptionsFor(effectiveCategory, l).length > 0);
  }, [effectiveCategory, liftFilter]);
  const auxVisible = useMemo<Lift[]>(() => {
    if (!effectiveCategory) return [];
    if (liftFilter) return [];
    return AUX_LIFTS.filter(l => limiterOptionsFor(effectiveCategory, l).length > 0);
  }, [effectiveCategory, liftFilter]);

  const analyses = useMemo(() => {
    const out: Record<string, { option: LimiterOption; items: LimiterExerciseItem[] }> = {};
    if (effectiveCategory) {
      for (const l of [...visibleLifts, ...auxVisible]) {
        for (const o of limiterOptionsFor(effectiveCategory, l)) {
          out[o.id] = analyzeLimiterOption(o);
        }
      }
    }
    return out;
  }, [effectiveCategory, visibleLifts, auxVisible]);

  const keyOf = (o: LimiterOption) => `${o.lift}|${o.category}|${o.id}`;

  const toggleExercise = (o: LimiterOption, name: string) => {
    const key = keyOf(o);
    setSelected(cur => {
      const values = new Set(cur[key] || []);
      if (values.has(name)) values.delete(name); else values.add(name);
      return { ...cur, [key]: [...values] };
    });
  };
  const addToPlan = (o: LimiterOption, names: string[]) => {
    if (!names.length) return;
    const key = keyOf(o);
    setSelected(cur => ({ ...cur, [key]: [...new Set([...(cur[key] || []), ...names])] }));
  };
  const toggleDay = (o: LimiterOption, day: number) => {
    const key = keyOf(o);
    setDays(cur => {
      const values = new Set(cur[key] || []);
      if (values.has(day)) values.delete(day); else values.add(day);
      return { ...cur, [key]: [...values].sort((a, b) => a - b) };
    });
  };
  const setAutoDays = (o: LimiterOption) => setDays(cur => { const next = { ...cur }; delete next[keyOf(o)]; return next; });

  const applySelected = () => {
    const limiterExerciseMap: Record<string, string[]> = {};
    const limiterProtocolMap: Record<string, { protocol: { sets: number; reps: number; pct: number; rir: number; tempo?: string; rest?: string; holdSec?: number; note?: string }; category: string }> = {};
    const limiterDayMap: Record<string, number[]> = {};
    for (const [key, names] of Object.entries(selected)) {
      if (!names.length) continue;
      const optionId = key.split('|')[2];
      const opt = limiterOptionById(optionId);
      if (!opt) continue;
      limiterExerciseMap[key] = names;
      limiterProtocolMap[key] = { protocol: opt.protocol, category: opt.category };
      limiterDayMap[key] = days[key] ?? [];
    }
    const total = Object.values(limiterExerciseMap).reduce((s, n) => s + n.length, 0);
    const catLabel = effectiveCategory ? LIMITER_CATEGORIES.find(c => c.id === effectiveCategory)?.label : 'все';
    applyToPlanner({
      kind: 'limiter',
      label: `Лимитирующие факторы: ${catLabel} — ${total} упр.`,
      data: { limiterExerciseMap, limiterProtocolMap, limiterDayMap },
    });
  };

  const selectedCount = Object.values(selected).reduce((s, n) => s + n.length, 0);

  return (
    <div style={{ padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: ACCENT }}>🎯 Калькулятор лимитирующих факторов движения</div>
      <div style={{ fontSize: 10, color: DIM, marginTop: 3, lineHeight: 1.45 }}>
        Сначала выберите <b>калькулятор (категорию-фактор)</b> — внутри для КАЖДОГО из 6 движений (жим лёжа, присед,
        становая классика, сумо, жим стоя, бицепс) свои параметры с методами и реальными упражнениями
        (сеты/повторы/%/RIR/темп).
      </div>

      {/* Калькуляторы (категории) */}
      <div style={CARD}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#fbbf24' }}>🧮 Выберите калькулятор (категорию-фактор)</div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
          {LIMITER_CATEGORIES.map(meta => {
            const on = effectiveCategory === meta.id;
            const c = CATEGORY_COLOR[meta.id];
            return (
              <button key={meta.id} onClick={() => setCategory(on ? '' : meta.id)} style={{ minHeight: 34, padding: '5px 10px', borderRadius: 9, cursor: 'pointer', border: on ? `1px solid ${c.color}` : '1px solid rgba(255,255,255,0.1)', background: on ? c.bg : 'transparent', color: on ? c.color : DIM, fontWeight: 700, fontSize: 10 }}>
                {meta.icon} {meta.label}{on ? ' ✓' : ''}
              </button>
            );
          })}
        </div>
        {effectiveCategory && (
          <div style={{ marginTop: 6, fontSize: 10, color: DIM, lineHeight: 1.45, padding: '7px 9px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            {LIMITER_CATEGORIES.find(c => c.id === effectiveCategory)?.description}
          </div>
        )}
        {effectiveCategory === 'speed_strength' && (
          <div style={{ marginTop: 6, fontSize: 10, color: '#fbbf24', lineHeight: 1.45, padding: '7px 9px', borderRadius: 8, background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)' }}>
            ⚡ Подсказка: потеря скорости штанги (VBT) определяет вероятную фазу срыва — см. секцию «VBT: скорость штанги» в калькуляторе «Слабые мышцы → … → Движение штанги» ниже в дашборде.
          </div>
        )}
      </div>

      {/* Фильтр движений */}
      {effectiveCategory && (
        <div style={CARD}>
          <div style={{ fontSize: 10, color: DIM, lineHeight: 1.4 }}>
            <b style={{ color: col?.color }}>{LIMITER_CATEGORIES.find(c => c.id === effectiveCategory)?.label}</b> — параметры по движениям (все движения / выберите одно):
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
            <button onClick={() => setLiftFilter('')} style={{ minHeight: 30, padding: '4px 10px', borderRadius: 14, cursor: 'pointer', fontSize: 10, fontWeight: 700, border: liftFilter === '' ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.1)', background: liftFilter === '' ? 'rgba(0,230,138,0.14)' : 'transparent', color: liftFilter === '' ? ACCENT : DIM }}>
              Все движения
            </button>
            {[...CORE_LIFTS, ...AUX_LIFTS].map(l => {
              const has = limiterOptionsFor(effectiveCategory, l).length > 0;
              const on = liftFilter === l;
              return (
                <button key={l} onClick={() => setLiftFilter(on ? '' : l)} disabled={!has} style={{ minHeight: 30, padding: '4px 10px', borderRadius: 14, cursor: has ? 'pointer' : 'not-allowed', fontSize: 10, fontWeight: 700, opacity: has ? 1 : 0.35, border: on ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.1)', background: on ? 'rgba(0,230,138,0.14)' : 'transparent', color: on ? ACCENT : DIM }}>
                  {LIFT_RU[l]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Параметры по движениям */}
      {effectiveCategory && visibleLifts.length > 0 && (
        <div style={CARD}>
          <div style={{ fontSize: 11, fontWeight: 800, color: col?.color }}>
            ⚙️ Параметры «{LIMITER_CATEGORIES.find(c => c.id === effectiveCategory)?.label}» по движениям:
          </div>
          {visibleLifts.map(l => (
            <div key={l} style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#fff', padding: '4px 8px', borderRadius: 7, background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.2)' }}>
                🏋️ {LIFT_RU[l]}
              </div>
              {limiterOptionsFor(effectiveCategory, l).map(o => {
                const analysis = analyses[o.id];
                if (!analysis || analysis.items.length === 0) return null;
                return (
                  <OptionBlock key={o.id} o={o} analysis={analysis} keyOf={keyOf(o)} selected={selected} days={days} dayCount={dayCount}
                    onToggle={name => toggleExercise(o, name)} onAdd={names => addToPlan(o, names)}
                    onDay={day => toggleDay(o, day)} onAuto={() => setAutoDays(o)} />
                );
              })}
            </div>
          ))}
        </div>
      )}
      {effectiveCategory && auxVisible.length > 0 && (
        <div style={CARD}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#fff' }}>🧰 Вспомогательные движения (дополнительно)</div>
          {auxVisible.map(l => (
            <div key={l} style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#fff', padding: '4px 8px', borderRadius: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)' }}>
                🏋️ {LIFT_RU[l]}
              </div>
              {limiterOptionsFor(effectiveCategory, l).map(o => {
                const analysis = analyses[o.id];
                if (!analysis || analysis.items.length === 0) return null;
                return (
                  <OptionBlock key={o.id} o={o} analysis={analysis} keyOf={keyOf(o)} selected={selected} days={days} dayCount={dayCount}
                    onToggle={name => toggleExercise(o, name)} onAdd={names => addToPlan(o, names)}
                    onDay={day => toggleDay(o, day)} onAuto={() => setAutoDays(o)} />
                );
              })}
            </div>
          ))}
        </div>
      )}

      <button onClick={applySelected} disabled={selectedCount === 0} style={{ width: '100%', minHeight: 44, marginTop: 10, border: 'none', borderRadius: 9, cursor: selectedCount > 0 ? 'pointer' : 'not-allowed', background: selectedCount > 0 ? 'linear-gradient(135deg,#00e68a,#00c853)' : 'rgba(255,255,255,0.08)', color: selectedCount > 0 ? '#000' : DIM, fontWeight: 800, opacity: selectedCount > 0 ? 1 : 0.6 }}>
        🛠 Добавить выбранные упражнения в ПЛ-авто ({selectedCount})
      </button>

      <div style={{ marginTop: 8, padding: 9, borderRadius: 8, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.18)', color: '#fbbf24', fontSize: 10, lineHeight: 1.45 }}>
        Протоколы категорийные (не из раскладки цикла): скорость 8×2 @55%, дожимы 4×3 @80%, эксцентрика 3×4 @65% темп 6-0-1-0,
        изометрия — удержание 3-5с, гипертрофия — 3×10 @65%. MRV-бюджет учитывается только для гипертрофии лимитирующих групп.
        Слабые группы профиля и проценты цикла не меняются.
      </div>
    </div>
  );
};

export default LimiterCalculatorCard;
