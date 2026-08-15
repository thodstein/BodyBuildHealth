/**
 * PeakWeekTab.tsx — под-вкладка «🏁 Тапер ББ» планировщика питания.
 *
 * Единая система пикинг-подготовки (bb-contest-prep.engine):
 * настройка протокола → тапер тренировок (Библиотека методик) → пик-неделя
 * 7 дней (ккал/БЖУ/вода/Na/K/тренировки/позы) → таймлайн дня шоу.
 *
 * «🏁 Применить тапер-план ББ» — сохраняет конфиг в профиль (goals.bbPeakConfig)
 * и перегенерирует план питания с оверлеем по реальной дате шоу.
 *
 * Все выборы — через PopupSelect/PopupNumber/PopupBool (нативные <select> с
 * appearance:none не открываются в Telegram WebView).
 */
import React, { useMemo, useState } from 'react';
import {
  buildBBContestPrep, validateBBContestPrepConfig, isoToday, isoAddDays, isoDiffDays,
  CONTEST_CATEGORY_LABELS, PHASE_LABELS_RU, PEAK_PHASE_COLORS, CONTEST_SPECIALIZATION_LABELS,
  resolveMainCompetition,
  type BBContestPrepConfig, type BBContestCategory, type PeakDayPhase,
  type ContestSpecialization, type ContestEventEntry,
} from '../../../../engines/bb/bb-contest-prep.engine';
import { GlassCard } from './ui';
import { usePlanCtx } from './IndividualPlanContext';
import { getProfile } from '../../../../core/profile-manager';

const ACCENT = '#f59e0b';
const DIM = 'rgba(255,255,255,0.55)';
const BTN_PRIMARY: React.CSSProperties = {
  flex: 1, padding: 12, borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 12, minHeight: 48,
  background: 'linear-gradient(135deg,#fbbf24,#d97706)', color: '#000',
  boxShadow: '0 4px 18px rgba(245,158,11,0.35)',
};
const BTN_GHOST: React.CSSProperties = {
  flex: 1, padding: 11, borderRadius: 12, cursor: 'pointer', fontWeight: 700, fontSize: 11, minHeight: 44,
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)',
};
const CARD: React.CSSProperties = {
  padding: 12, borderRadius: 14, background: 'linear-gradient(180deg, rgba(30,30,34,0.9), rgba(24,24,27,0.7))',
  border: '1px solid rgba(255,255,255,0.07)', marginBottom: 10,
  boxShadow: '0 2px 14px rgba(0,0,0,0.25)',
};
const CARD_TITLE: React.CSSProperties = { fontSize: 12, fontWeight: 800, color: '#fff', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 };

const MALE_CATS: BBContestCategory[] = ['mens_physique', 'classic_physique', 'mens_bb', 'bb_212'];
const FEMALE_CATS: BBContestCategory[] = ['bikini', 'figure', 'wellness', 'womens_physique', 'womens_bb'];

const WATER_HINTS: Record<string, string> = {
  classic: 'Load 6–10 л → ступенчатый cut → глотки. Только опытные, здоровые почки.',
  moderate: 'Мягкий cut: обычная вода + снижение в последние 2 дня.',
  minimal: 'Обычный питьевой режим. Для новичков и первых пиков.',
};

function defaultConfig(sex: 'male' | 'female', weightKg: number, bbCategory: string): BBContestPrepConfig {
  const fallback: BBContestCategory = sex === 'female' ? 'bikini' : 'mens_physique';
  const known = (sex === 'female' ? FEMALE_CATS : MALE_CATS).find(c => c === bbCategory) ?? fallback;
  return {
    sex,
    category: known,
    weightKg: Math.max(40, Math.min(200, weightKg || 80)),
    bodyFatPct: undefined,
    experienceLevel: 'intermediate',
    enhanced: false,
    prepCount: 0,
    showDate: isoAddDays(isoToday(), 28),
    weeksOut: 3,
    trainingProtocol: 'bb',
    carbLoadStrategy: 'moderate',
    waterStrategy: 'minimal',
    sodiumStrategy: 'constant',
  };
}

const chip: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 999,
  fontSize: 9, fontWeight: 700,
};

/** Тумблер-чип (современная замена checkbox). */
const ToggleChip: React.FC<{ label: string; icon?: string; value: boolean; onChange: (v: boolean) => void; danger?: boolean }> = ({ label, icon, value, onChange, danger }) => {
  const color = danger ? '#f87171' : '#f59e0b';
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 12, cursor: 'pointer',
        minHeight: 44, fontSize: 10, fontWeight: value ? 800 : 600,
        background: value ? (danger ? 'linear-gradient(135deg, rgba(239,68,68,0.18), rgba(239,68,68,0.08))' : 'linear-gradient(135deg, rgba(245,158,11,0.18), rgba(245,158,11,0.08))') : 'rgba(255,255,255,0.04)',
        border: value ? `1px solid ${color}55` : '1px solid rgba(255,255,255,0.1)',
        color: value ? color : 'rgba(255,255,255,0.75)',
        boxShadow: value ? `0 2px 12px ${color}22` : 'none',
        transition: 'all 0.18s ease',
      }}
    >
      <span style={{
        width: 16, height: 16, borderRadius: 6, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9, background: value ? color : 'rgba(255,255,255,0.08)', color: value ? '#000' : 'transparent',
        transition: 'all 0.18s ease',
      }}>
        {value ? '✓' : ''}
      </span>
      {icon && <span>{icon}</span>}
      {label}
    </button>
  );
};

/** Дата-карточка: нативный date-picker в современной обёртке. */
const DateCard: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
  <div style={{
    width: '100%', minHeight: 58, borderRadius: 12, padding: '8px 12px', boxSizing: 'border-box',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015))',
    border: '1px solid rgba(255,255,255,0.09)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2,
    boxShadow: '0 1px 8px rgba(0,0,0,0.22)', position: 'relative',
  }}>
    <span style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</span>
    <input
      type="date"
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%', border: 'none', background: 'transparent', color: '#fbbf24', fontSize: 12.5,
        fontWeight: 700, outline: 'none', fontFamily: 'inherit', padding: 0,
      }}
    />
  </div>
);

/** Сегментированные чипы — надёжная замена попап-выбора (нативные кнопки). */
const SegGroup: React.FC<{
  label: string;
  icon?: string;
  value: string;
  options: { id: string; label: string; desc?: string }[];
  onChange: (v: string) => void;
  accent?: string;
}> = ({ label, icon, value, options, onChange, accent = '#00e68a' }) => {
  const sel = options.find(o => o.id === value);
  return (
    <div>
      <div style={{ fontSize: 8.5, color: DIM, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5 }}>
        {icon && <span style={{ marginRight: 4 }}>{icon}</span>}{label}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {options.map(o => {
          const active = o.id === value;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(o.id)}
              style={{
                padding: '7px 11px', borderRadius: 999, cursor: 'pointer', minHeight: 36, fontSize: 10,
                fontWeight: active ? 800 : 600, border: active ? '1px solid transparent' : '1px solid rgba(255,255,255,0.1)',
                background: active
                  ? `linear-gradient(135deg, ${accent}, ${accent}cc)`
                  : 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015))',
                color: active ? '#000' : 'rgba(255,255,255,0.7)',
                boxShadow: active ? `0 3px 12px ${accent}44` : '0 1px 6px rgba(0,0,0,0.22)',
                transition: 'all 0.16s ease',
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {sel?.desc && <div style={{ fontSize: 9, color: DIM, marginTop: 4, lineHeight: 1.4 }}>{sel.desc}</div>}
    </div>
  );
};

/** Степпер (−/+) — надёжная замена числового попапа. */
const Stepper: React.FC<{
  label: string;
  icon?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (v: number) => void;
  accent?: string;
}> = ({ label, icon, value, min, max, step = 1, suffix = '', onChange, accent = '#00e68a' }) => {
  const set = (v: number) => onChange(Math.max(min, Math.min(max, Math.round(v * 100) / 100)));
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 12,
      background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015))',
      border: '1px solid rgba(255,255,255,0.09)', boxShadow: '0 1px 8px rgba(0,0,0,0.22)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 8.5, color: DIM, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 1 }}>
          {icon && <span style={{ marginRight: 4 }}>{icon}</span>}{label}
        </div>
        <div style={{ fontSize: 14, fontWeight: 800, color: accent }}>{value}{suffix ? ` ${suffix}` : ''}</div>
      </div>
      <button
        type="button"
        onClick={() => set(value - step)}
        disabled={value <= min}
        aria-label={`${label} минус`}
        style={{
          width: 38, height: 38, borderRadius: 10, cursor: value <= min ? 'default' : 'pointer',
          fontSize: 16, fontWeight: 800, border: '1px solid rgba(255,255,255,0.12)',
          background: 'rgba(255,255,255,0.04)', color: value <= min ? 'rgba(255,255,255,0.25)' : '#fff',
          opacity: value <= min ? 0.5 : 1,
        }}
      >
        −
      </button>
      <button
        type="button"
        onClick={() => set(value + step)}
        disabled={value >= max}
        aria-label={`${label} плюс`}
        style={{
          width: 38, height: 38, borderRadius: 10, cursor: value >= max ? 'default' : 'pointer',
          fontSize: 16, fontWeight: 800, border: '1px solid transparent',
          background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, color: '#000',
          opacity: value >= max ? 0.5 : 1,
        }}
      >
        +
      </button>
    </div>
  );
};

export const PeakWeekTab: React.FC = () => {
  const ctx = usePlanCtx();
  const { bbPrepConfig, setBBPrepConfig, applyBBPeakToPlan, weight, sex, bodyFatPct, bbCategory } = ctx;

  const [draft, setDraft] = useState<BBContestPrepConfig>(() => bbPrepConfig ?? defaultConfig(sex, weight, bbCategory));
  const [savedFlash, setSavedFlash] = useState(false);

  const patch = (p: Partial<BBContestPrepConfig>) => setDraft(prev => ({ ...prev, ...p }));

  const validation = useMemo(() => validateBBContestPrepConfig(draft), [draft]);
  const effDraft = useMemo(() => {
    const v = validateBBContestPrepConfig(draft);
    return v.ok ? { ...draft, ...v.forced } : draft;
  }, [draft]);
  const result = useMemo(() => {
    try { return buildBBContestPrep(effDraft); } catch { return null; }
  }, [effDraft]);

  const daysToShow = useMemo(() => {
    if (!result) return null;
    return isoDiffDays(isoToday(), result.config.showDate);
  }, [result]);

  const autofillFromProfile = () => {
    try {
      const p = getProfile();
      const s = (p.settings || {}) as any;
      const w = Number(s.personal?.weight) || weight || 80;
      const sx: 'male' | 'female' = (s.personal?.sex === 'female' ? 'female' : 'male');
      const cat = String((s as any)?.goals?.bbCategory || '');
      const known = (sx === 'female' ? FEMALE_CATS : MALE_CATS).find(c => c === cat);
      patch({
        sex: sx,
        category: known ?? (sx === 'female' ? 'bikini' : 'mens_physique'),
        weightKg: Math.max(40, Math.min(200, w)),
        bodyFatPct: Number(s.personal?.bodyFat) > 0 ? Number(s.personal?.bodyFat) : undefined,
        allergens: Array.isArray(s.nutrition?.foodAllergies) ? s.nutrition.foodAllergies.filter((x: unknown): x is string => typeof x === 'string') : undefined,
      });
    } catch { /* ignore */ }
  };

  const flash = (fn: () => void) => { fn(); setSavedFlash(true); window.setTimeout(() => setSavedFlash(false), 1800); };

  const applyConfigured = () => {
    if (!validation.ok) return;
    applyBBPeakToPlan(effDraft);
  };
  const saveToProfile = () => {
    if (!validation.ok) return;
    setBBPrepConfig(effDraft);
    flash(() => {});
  };
  const removePrep = () => { applyBBPeakToPlan(null); setDraft(defaultConfig(sex, weight, bbCategory)); };

  const [copyFlash, setCopyFlash] = useState(false);
  const fallbackCopy = (text: string) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); setCopyFlash(true); window.setTimeout(() => setCopyFlash(false), 1800); } catch { /* ignore */ }
    document.body.removeChild(ta);
  };
  const copySummary = () => {
    if (!result) return;
    const cfg = result.config;
    const lines: string[] = [
      `🏁 Тапер ББ — сводка (шоу ${cfg.showDate}, категория ${CONTEST_CATEGORY_LABELS[cfg.category]}, ${cfg.weightKg} кг)`,
      `📉 Тапер тренировок (${cfg.weeksOut} нед): ${result.taper.map(t => `${t.label} ${Math.round(t.volumePct * 100)}%`).join(' → ')}`,
      '— Пик-неделя —',
      ...result.peakWeek.map(d => {
        const dayLabel = d.day === 7 ? 'Шоу' : `D-${7 - d.day}`;
        return `${dayLabel} (${d.date}) ${d.phaseLabel}: ${d.kcal} ккал · Б${d.proteinG}/У${d.carbsG}/Ж${d.fatG} · 💧${d.waterLiters}л · Na ${d.sodiumMg}мг · ${d.training.minutes ? d.training.type : 'отдых'} · позы ${d.posingMinutes}м`;
      }),
      '— День шоу по часам —',
      ...result.showTimeline.map(t => `${t.time} — ${t.action}`),
      ...(result.warnings.length ? ['— Предупреждения —', ...result.warnings] : []),
    ];
    const text = lines.join('\n');
    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(() => { setCopyFlash(true); window.setTimeout(() => setCopyFlash(false), 1800); }).catch(() => fallbackCopy(text));
      } else { fallbackCopy(text); }
    } catch { fallbackCopy(text); }
  };

  const catsFor = draft.sex === 'female' ? FEMALE_CATS : MALE_CATS;

  const SPECIALIZATIONS: ContestSpecialization[] = ['none', 'chest', 'back', 'shoulders', 'arms', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'abs', 'traps'];
  const competitions = draft.competitions ?? [];
  const patchCompetition = (id: string, p: Partial<ContestEventEntry>) =>
    patch({ competitions: (draft.competitions || []).map(c => (c.id === id ? { ...c, ...p } : c)) });
  const addCompetition = () =>
    patch({ competitions: [...(draft.competitions || []), { id: `comp_${Date.now().toString(36)}`, name: `Старт ${(draft.competitions?.length ?? 0) + 1}`, priority: 'B' }] });
  const removeCompetition = (id: string) =>
    patch({
      competitions: (draft.competitions || []).filter(c => c.id !== id),
      mainCompetitionId: draft.mainCompetitionId === id ? undefined : draft.mainCompetitionId,
    });
  const resolveMainId = (c: BBContestPrepConfig): string | undefined => resolveMainCompetition(c)?.id;

  const readinessColor = !result ? '#60a5fa' : result.readiness.verdict === 'behind' ? '#f87171' : result.readiness.verdict === 'ahead' ? '#4ade80' : '#60a5fa';
  const countdownChip = daysToShow == null ? null : daysToShow < 0
    ? { text: `🎬 Шоу прошло (${-daysToShow} дн назад)`, color: '#94a3b8' }
    : daysToShow === 0
      ? { text: '🎬 Сегодня шоу!', color: '#fbbf24' }
      : daysToShow <= 7
        ? { text: `⏳ До шоу: ${daysToShow} дн`, color: '#f87171' }
        : daysToShow <= 21
          ? { text: `⏳ До шоу: ${daysToShow} дн`, color: '#fbbf24' }
          : { text: `⏳ До шоу: ${daysToShow} дн`, color: '#4ade80' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* ── Hero ── */}
      <div style={{
        padding: 14, borderRadius: 16, position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(135deg, rgba(245,158,11,0.14), rgba(24,24,27,0.9) 60%)',
        border: '1px solid rgba(245,158,11,0.3)',
        boxShadow: '0 4px 24px rgba(245,158,11,0.12)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
              🏁 Тапер ББ
              {bbPrepConfig && (
                <span style={{ ...chip, background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.35)' }}>● активен</span>
              )}
            </div>
            <div style={{ fontSize: 9, color: DIM, marginTop: 3, lineHeight: 1.5, maxWidth: 340 }}>
              Пикинг к шоу: тренировочный тапер + пик-неделя 7 дней (карбс/вода/натрий/позы). Накладывается на план питания по дате.
            </div>
          </div>
          {countdownChip && (
            <span style={{ ...chip, background: countdownChip.color + '22', color: countdownChip.color, border: `1px solid ${countdownChip.color}55`, whiteSpace: 'nowrap' }}>
              {countdownChip.text}
            </span>
          )}
        </div>
        {result && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 10 }}>
            <span style={{ ...chip, background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.12)' }}>
              📅 {result.config.showDate}
            </span>
            <span style={{ ...chip, background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.12)' }}>
              {CONTEST_CATEGORY_LABELS[result.config.category]}
            </span>
            <span style={{ ...chip, background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.12)' }}>
              ⚖ {result.config.weightKg} кг
            </span>
            <span style={{ ...chip, background: readinessColor + '22', color: readinessColor, border: `1px solid ${readinessColor}55` }}>
              📊 {result.readiness.verdict === 'behind' ? 'сушить ещё' : result.readiness.verdict === 'ahead' ? 'форма есть' : 'по графику'}
            </span>
          </div>
        )}
      </div>

      <GlassCard title="Атлет и тайминг" icon="👤" color={ACCENT}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SegGroup
            label="Пол"
            icon="👤"
            value={draft.sex}
            accent="#00e68a"
            options={[{ id: 'male', label: 'Мужской' }, { id: 'female', label: 'Женский' }]}
            onChange={v => patch({ sex: v as any, category: (v === 'female' ? 'bikini' : 'mens_physique') })}
          />
          <SegGroup
            label="Категория"
            icon="🏅"
            value={draft.category}
            accent="#f59e0b"
            options={catsFor.map(c => ({ id: c, label: CONTEST_CATEGORY_LABELS[c] }))}
            onChange={v => patch({ category: v as BBContestCategory })}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Stepper label="Вес тела" icon="⚖️" value={draft.weightKg} min={40} max={200} suffix="кг" accent="#f59e0b" onChange={v => patch({ weightKg: v })} />
            <Stepper label="% жира сейчас" icon="📏" value={draft.bodyFatPct ?? 0} min={0} max={60} step={0.5} suffix="%" accent="#60a5fa" onChange={v => patch({ bodyFatPct: v > 0 ? v : undefined })} />
          </div>
          <DateCard label="Дата шоу" value={draft.showDate} onChange={v => patch({ showDate: v })} />
          <SegGroup
            label="Уровень"
            icon="📶"
            value={draft.experienceLevel}
            accent="#a855f7"
            options={[{ id: 'beginner', label: 'Новичок' }, { id: 'intermediate', label: 'Средний' }, { id: 'advanced', label: 'Продвинутый' }]}
            onChange={v => patch({ experienceLevel: v as any })}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Stepper label="Пройдено пиков" icon="🏆" value={draft.prepCount} min={0} max={50} accent="#22c55e" onChange={v => patch({ prepCount: Math.round(v) })} />
            <ToggleChip label="На курсе" icon="💉" value={draft.enhanced} onChange={v => patch({ enhanced: v })} />
          </div>
        </div>
        <div style={{ fontSize: 9, color: DIM, marginTop: 10 }}>
          {bodyFatPct > 0 ? `Профиль: ${sex === 'female' ? 'женщина' : 'мужчина'} · ${weight} кг · ${bodyFatPct}% жира.` : 'Совет: укажите % жира — точнее оценка готовности к пику.'}
        </div>
      </GlassCard>

      <GlassCard title="Стратегии протокола" icon="🎯" color="#ec4899">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SegGroup
            label="Тренировочный протокол (Библиотека методик)"
            icon="🏋️"
            value={draft.trainingProtocol}
            accent="#ec4899"
            options={[
              { id: 'bb', label: 'Бодибилдинг · 4 нед', desc: 'Наполнение → прорисовка → шоу. Классика соревновательного ББ.' },
              { id: 'classic', label: 'Classic WF · 4 нед', desc: 'Перегрузка → суперкомпенсация. Подход Issurin.' },
              { id: 'pl', label: 'ПЛ · 3 нед', desc: 'Интенсивность к 100%, синглы перед стартом.' },
            ]}
            onChange={v => patch({ trainingProtocol: v as any })}
          />
          <SegGroup
            label="Недель тапера (покрывают последние недели плана)"
            icon="📉"
            value={String(draft.weeksOut)}
            accent="#a855f7"
            options={[1, 2, 3, 4].map(n => ({ id: String(n), label: `${n}`, desc: `${n} недел${n === 1 ? 'я' : 'и'} тапера перед шоу.` }))}
            onChange={v => patch({ weeksOut: Number(v) })}
          />
          <SegGroup
            label="Карб-загрузка"
            icon="🍚"
            value={draft.carbLoadStrategy}
            accent="#22c55e"
            options={[
              { id: 'moderate', label: 'Классика 3/3', desc: '3 дня деплеции → 3 дня загрузки. Рекомендуется.' },
              { id: 'front', label: 'Front-load', desc: 'Загрузка раньше (3 дня), день перед шоу — пик.' },
              { id: 'back', label: 'Back-load', desc: 'Поздняя загрузка 2 дня — для тех, кого «заливает».' },
            ]}
            onChange={v => patch({ carbLoadStrategy: v as any })}
          />
          <SegGroup
            label="Вода"
            icon="💧"
            value={draft.waterStrategy}
            accent="#38bdf8"
            options={[
              { id: 'minimal', label: 'Minimal', desc: WATER_HINTS.minimal },
              { id: 'moderate', label: 'Moderate', desc: WATER_HINTS.moderate },
              { id: 'classic', label: 'Classic (load+cut)', desc: WATER_HINTS.classic },
            ]}
            onChange={v => patch({ waterStrategy: v as any })}
          />
          <SegGroup
            label="Натрий"
            icon="🧂"
            value={draft.sodiumStrategy}
            accent="#f59e0b"
            options={[
              { id: 'constant', label: 'Constant', desc: 'Не трогаем — современный подход, не ломает fill.' },
              { id: 'cut_2d', label: 'Cut за 2 дня', desc: 'Ступенчатое снижение к шоу.' },
              { id: 'cut_3d', label: 'Cut за 3 дня', desc: 'Классика: снижаем с D-3.' },
            ]}
            onChange={v => patch({ sodiumStrategy: v as any })}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <ToggleChip label="Низковолокнистые карбс" icon="🍚" value={!!draft.preferLowFiberCarbs} onChange={v => patch({ preferLowFiberCarbs: v })} />
            <ToggleChip label="Прекратить креатин" icon="💊" value={draft.creatineStrategy === 'stop'} onChange={v => patch({ creatineStrategy: v ? 'stop' : 'continue' })} />
          </div>
        </div>
      </GlassCard>

      <GlassCard title="Специализация к соревнованиям" icon="⭐" color="#a855f7">
        <div style={{ fontSize: 9, color: DIM, marginBottom: 8, lineHeight: 1.45 }}>
          Какую мышцу подтягиваем к старту: её объём щадится в тапере (режется мягче), а в памп-сессиях пик-недели она получает добивку.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 6 }}>
          {SPECIALIZATIONS.map(s => {
            const active = (draft.specialization ?? 'none') === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => patch({ specialization: s })}
                style={{
                  padding: '7px 8px', borderRadius: 10, cursor: 'pointer', minHeight: 40, fontSize: 9.5,
                  fontWeight: active ? 800 : 600,
                  background: active ? 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(168,85,247,0.08))' : 'rgba(255,255,255,0.04)',
                  border: active ? '1px solid rgba(168,85,247,0.55)' : '1px solid rgba(255,255,255,0.09)',
                  color: active ? '#c084fc' : 'rgba(255,255,255,0.7)',
                  boxShadow: active ? '0 2px 12px rgba(168,85,247,0.25)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {active ? '★ ' : ''}{CONTEST_SPECIALIZATION_LABELS[s]}
              </button>
            );
          })}
        </div>
      </GlassCard>

      <GlassCard title={`Соревнования (${competitions.length || 1})`} icon="🏁" color="#ef4444">
        <div style={{ fontSize: 9, color: DIM, marginBottom: 8, lineHeight: 1.45 }}>
          Несколько стартов: тапер и пик-неделя строятся под <b style={{ color: '#fbbf24' }}>главное</b> (приоритет A или явный выбор).
          В годовом планировщике тапер накладывается на каждый блок подготовки.
        </div>
        {competitions.length === 0 ? (
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', padding: '6px 0' }}>
            Одно шоу — дата задана выше ({draft.showDate}).
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {competitions.map(c => {
              const isMain = resolveMainId(draft) === c.id;
              return (
                <div key={c.id} style={{
                  padding: 8, borderRadius: 10, border: isMain ? '1px solid rgba(251,191,36,0.45)' : '1px solid rgba(255,255,255,0.08)',
                  background: isMain ? 'linear-gradient(135deg, rgba(251,191,36,0.1), rgba(24,24,27,0.4))' : 'rgba(255,255,255,0.02)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => patch({ mainCompetitionId: isMain ? undefined : c.id })}
                      title={isMain ? 'Главное соревнование' : 'Сделать главным'}
                      style={{
                        flexShrink: 0, width: 34, height: 34, borderRadius: 10, cursor: 'pointer',
                        fontSize: 14, border: isMain ? '1px solid rgba(251,191,36,0.6)' : '1px solid rgba(255,255,255,0.12)',
                        background: isMain ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.03)',
                        color: isMain ? '#fbbf24' : 'rgba(255,255,255,0.35)',
                      }}
                    >
                      ★
                    </button>
                    <input
                      type="text"
                      value={c.name}
                      placeholder="Название"
                      onChange={e => patchCompetition(c.id, { name: e.target.value })}
                      style={{
                        flex: 1, minWidth: 0, padding: '7px 9px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                        border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.25)', color: '#fff', outline: 'none',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => removeCompetition(c.id)}
                      aria-label="Удалить соревнование"
                      style={{
                        flexShrink: 0, width: 34, height: 34, borderRadius: 10, cursor: 'pointer', fontSize: 13,
                        border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#f87171',
                      }}
                    >
                      ✕
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                    <div style={{
                      borderRadius: 8, padding: '6px 9px', background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.09)', display: 'flex', flexDirection: 'column', gap: 1,
                    }}>
                      <span style={{ fontSize: 8, color: DIM, textTransform: 'uppercase', letterSpacing: 0.4 }}>Дата (необязательно)</span>
                      <input
                        type="date"
                        value={c.date ?? ''}
                        onChange={e => patchCompetition(c.id, { date: e.target.value || undefined })}
                        style={{ border: 'none', background: 'transparent', color: '#fbbf24', fontSize: 11, fontWeight: 700, outline: 'none', fontFamily: 'inherit', padding: 0 }}
                      />
                    </div>
                    <div>
                      <span style={{ fontSize: 8, color: DIM, textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', marginBottom: 4 }}>Приоритет</span>
                      <div style={{ display: 'flex', gap: 5 }}>
                        {(['A', 'B', 'C'] as const).map(p => {
                          const active = (c.priority ?? 'B') === p;
                          const color = p === 'A' ? '#fbbf24' : p === 'B' ? '#f59e0b' : '#a78bfa';
                          const labels: Record<string, string> = { A: 'A · главный', B: 'B · контроль', C: 'C · тренир.' };
                          return (
                            <button
                              key={p}
                              type="button"
                              onClick={() => patchCompetition(c.id, { priority: p })}
                              style={{
                                flex: 1, padding: '6px 4px', borderRadius: 8, cursor: 'pointer', minHeight: 32, fontSize: 9.5,
                                fontWeight: active ? 800 : 600,
                                background: active ? `${color}22` : 'rgba(255,255,255,0.04)',
                                border: active ? `1px solid ${color}66` : '1px solid rgba(255,255,255,0.09)',
                                color: active ? color : 'rgba(255,255,255,0.65)',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              {labels[p]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <button
          type="button"
          onClick={addCompetition}
          style={{
            width: '100%', marginTop: 8, padding: '9px', borderRadius: 10, cursor: 'pointer', minHeight: 44,
            fontSize: 10, fontWeight: 800, border: '1px dashed rgba(239,68,68,0.4)',
            background: 'rgba(239,68,68,0.06)', color: '#f87171',
          }}
        >
          ＋ Добавить соревнование
        </button>
      </GlassCard>

      <GlassCard title="Безопасность" icon="🛡" color="#60a5fa">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <ToggleChip danger label="Почки" icon="🫘" value={(draft.contraindications || []).includes('kidney')} onChange={v => patch({ contraindications: v ? [...(draft.contraindications || []), 'kidney'] : (draft.contraindications || []).filter(c => c !== 'kidney') })} />
          <ToggleChip danger label="Сердце" icon="❤️" value={(draft.contraindications || []).includes('heart')} onChange={v => patch({ contraindications: v ? [...(draft.contraindications || []), 'heart'] : (draft.contraindications || []).filter(c => c !== 'heart') })} />
          <ToggleChip danger label="Гипертония" icon="🩸" value={(draft.contraindications || []).includes('hypertension')} onChange={v => patch({ contraindications: v ? [...(draft.contraindications || []), 'hypertension'] : (draft.contraindications || []).filter(c => c !== 'hypertension') })} />
        </div>
        {validation.warnings.length > 0 && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {validation.warnings.map((w, i) => (
              <div key={i} style={{ fontSize: 9, color: '#fbbf24', lineHeight: 1.4, padding: '5px 8px', borderRadius: 8, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>{w}</div>
            ))}
          </div>
        )}
        {!validation.ok && (
          <div style={{ marginTop: 6, fontSize: 10, color: '#ef4444' }}>
            {validation.errors.map((e, i) => <div key={i}>✕ {e}</div>)}
          </div>
        )}
      </GlassCard>

      {result && (
        <>
          <div style={CARD}>
            <div style={CARD_TITLE}>📊 Готовность к пику</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, borderRadius: 10, background: readinessColor + '10', border: `1px solid ${readinessColor}30` }}>
              <span style={{ width: 10, height: 10, borderRadius: 5, background: readinessColor, flexShrink: 0, boxShadow: `0 0 8px ${readinessColor}` }} />
              <span style={{ fontSize: 11, color: readinessColor, lineHeight: 1.5 }}>{result.readiness.note}</span>
            </div>
          </div>

          <div style={CARD}>
            <div style={CARD_TITLE}>📉 Тапер тренировок <span style={{ fontSize: 9, fontWeight: 700, color: DIM, marginLeft: 'auto' }}>{result.taper.length} нед · Библиотека методик</span></div>
            {result.taper.map(t => (
              <div key={t.weekOffset} style={{ padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <span>
                    <span style={{ fontWeight: 800, color: '#a855f7' }}>Нед {t.weekOffset}</span>
                    <span style={{ color: '#fff', marginLeft: 6 }}>{t.label}</span>
                  </span>
                  <span style={{ color: DIM }}>RIR {t.rirMin}–{t.rirMax}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ width: 44, fontSize: 9, color: DIM, flexShrink: 0 }}>Объём</span>
                  <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.round(t.volumePct * 100)}%`, height: '100%', borderRadius: 3, background: 'linear-gradient(90deg,#a855f7,#7c3aed)', transition: 'width 0.3s' }} />
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 800, color: '#a855f7', minWidth: 30, textAlign: 'right' }}>{Math.round(t.volumePct * 100)}%</span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
                  <span style={{ width: 44, fontSize: 9, color: DIM, flexShrink: 0 }}>Вес</span>
                  <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.round(t.intensityPct * 100)}%`, height: '100%', borderRadius: 3, background: 'linear-gradient(90deg,#f59e0b,#d97706)', transition: 'width 0.3s' }} />
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 800, color: '#f59e0b', minWidth: 30, textAlign: 'right' }}>{Math.round(t.intensityPct * 100)}%</span>
                </div>
                <div style={{ color: DIM, fontSize: 9, marginTop: 2 }}>{t.focus}</div>
              </div>
            ))}
          </div>

          <div style={CARD}>
            <div style={CARD_TITLE}>🍚 Пик-неделя <span style={{ fontSize: 9, fontWeight: 700, color: DIM, marginLeft: 'auto' }}>7 дней · шоу {result.config.showDate}</span></div>
            {/* Легенда фаз */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {([['deplete_1', 'Деплеция'], ['load_1', 'Загрузка'], ['peak', 'Пик'], ['show', 'Шоу']] as [PeakDayPhase, string][]).map(([ph, label]) => (
                <span key={ph} style={{ ...chip, background: PEAK_PHASE_COLORS[ph] + '18', color: PEAK_PHASE_COLORS[ph], border: `1px solid ${PEAK_PHASE_COLORS[ph]}40` }}>
                  ● {label}
                </span>
              ))}
            </div>
            <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9, minWidth: 480 }}>
                <thead>
                  <tr style={{ color: DIM, textAlign: 'left', background: 'rgba(255,255,255,0.03)' }}>
                    <th style={{ padding: '5px 6px' }}>День</th>
                    <th style={{ padding: '5px 6px' }}>Фаза</th>
                    <th style={{ padding: '5px 6px', textAlign: 'right' }}>Ккал</th>
                    <th style={{ padding: '5px 6px', textAlign: 'right' }}>Б</th>
                    <th style={{ padding: '5px 6px', textAlign: 'right' }}>У</th>
                    <th style={{ padding: '5px 6px', textAlign: 'right' }}>Ж</th>
                    <th style={{ padding: '5px 6px', textAlign: 'right' }}>💧л</th>
                    <th style={{ padding: '5px 6px', textAlign: 'right' }}>Na</th>
                    <th style={{ padding: '5px 6px' }}>Тренировка</th>
                  </tr>
                </thead>
                <tbody>
                  {result.peakWeek.map(d => {
                    const phColor = PEAK_PHASE_COLORS[d.phase];
                    return (
                      <tr key={d.day} style={{
                        borderTop: '1px solid rgba(255,255,255,0.05)',
                        borderLeft: `3px solid ${phColor}`,
                        background: d.day === 7
                          ? 'linear-gradient(90deg, rgba(251,191,36,0.12), rgba(251,191,36,0.03))'
                          : 'transparent',
                      }}>
                        <td style={{ padding: '5px 6px', fontWeight: 800, color: d.day === 7 ? '#fbbf24' : '#fff' }}>
                          {d.day === 7 ? '🎬' : `D-${7 - d.day}`}
                          <div style={{ fontSize: 8, color: DIM, fontWeight: 400 }}>{d.date.slice(5).replace('-', '.')}</div>
                        </td>
                        <td style={{ padding: '5px 6px' }}>
                          <span style={{ ...chip, background: phColor + '18', color: phColor, border: `1px solid ${phColor}40`, fontSize: 8 }}>
                            {PHASE_LABELS_RU[d.phase]}
                          </span>
                        </td>
                        <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 700 }}>{d.kcal}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'right' }}>{d.proteinG}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'right' }}>{d.carbsG}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'right' }}>{d.fatG}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'right' }}>{d.waterLiters}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'right' }}>{d.sodiumMg}</td>
                        <td style={{ padding: '5px 6px', color: DIM }}>{d.training.minutes > 0 ? d.training.type.split(' ')[0] : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 6, fontSize: 9, color: DIM }}>K {result.peakWeek[0]?.potassiumMg} мг — не снижается всю неделю. Белок {result.peakWeek[0]?.proteinG} г — постоянный.</div>
          </div>

          <div style={CARD}>
            <div style={CARD_TITLE}>⏰ День шоу по часам <span style={{ fontSize: 9, fontWeight: 700, color: DIM, marginLeft: 'auto' }}>сцена {draft.schedule?.stage || '12:00'}</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {result.showTimeline.map((t, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '52px 10px 1fr', gap: 8, position: 'relative' }}>
                  <span style={{ padding: '6px 0', color: ACCENT, fontWeight: 800, fontSize: 10, textAlign: 'right' }}>{t.time}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: 8, height: 8, borderRadius: 4, background: i === result.showTimeline.length - 1 ? '#fbbf24' : ACCENT, marginTop: 9, boxShadow: `0 0 6px ${i === result.showTimeline.length - 1 ? '#fbbf24' : ACCENT}` }} />
                    {i < result.showTimeline.length - 1 && <div style={{ width: 2, flex: 1, background: 'rgba(245,158,11,0.25)' }} />}
                  </div>
                  <div style={{ padding: '6px 0', fontSize: 10, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ color: '#fff', fontWeight: 700 }}>{t.action}</span>
                    <div style={{ color: DIM }}>{t.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {result.warnings.length > 0 && (
            <div style={{ ...CARD, background: 'linear-gradient(180deg, rgba(60,20,20,0.6), rgba(24,24,27,0.7))', border: '1px solid rgba(239,68,68,0.25)' }}>
              <div style={{ ...CARD_TITLE, color: '#f87171' }}>⚠ Предупреждения</div>
              {result.warnings.map((w, i) => <div key={i} style={{ fontSize: 9, color: '#fca5a5', lineHeight: 1.5, marginBottom: 3, paddingLeft: 4, borderLeft: '2px solid rgba(239,68,68,0.4)' }}>{w}</div>)}
            </div>
          )}
        </>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={autofillFromProfile} style={BTN_GHOST}>📋 Из профиля</button>
        <button disabled={!validation.ok} onClick={saveToProfile} style={{ ...BTN_GHOST, opacity: validation.ok ? 1 : 0.4 }}>
          {savedFlash ? '✅ Сохранено' : '💾 Сохранить в профиль'}
        </button>
        {result && (
          <button onClick={copySummary} style={BTN_GHOST}>
            {copyFlash ? '✅ Скопировано' : '📋 Сводка'}
          </button>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button disabled={!validation.ok} onClick={applyConfigured} style={{ ...BTN_PRIMARY, opacity: validation.ok ? 1 : 0.45 }}>
          🏁 Применить тапер-план ББ
        </button>
        {bbPrepConfig && (
          <button onClick={removePrep} style={{ ...BTN_GHOST, borderColor: 'rgba(239,68,68,0.3)', color: '#f87171', flex: '0 0 auto', padding: '11px 14px' }}>🗑 Снять</button>
        )}
      </div>
      <div style={{ fontSize: 9, color: DIM, textAlign: 'center', paddingBottom: 4 }}>
        Применение накладывает протокол на план питания (вкладка «🥗 План») по реальной дате шоу
        и сохраняется в профиль — его же читает «🏆 Шоу ББ» и сборка ББ-плана.
      </div>
    </div>
  );
};

export default PeakWeekTab;
