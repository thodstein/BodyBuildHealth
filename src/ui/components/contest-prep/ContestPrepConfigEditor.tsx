/**
 * ContestPrepConfigEditor.tsx — единый редактор конфига Тапера ББ.
 *
 * Вынесен из PeakWeekTab (питание) как общий компонент для обеих поверхностей:
 *  - ББ-авто шаг «🏁 Contest Prep»
 *  - Питание вкладка «🏁 Тапер ББ»
 *
 * Принимает BBContestPrepConfig и onChange, рендерит полный набор стратегий
 * движка (trainingProtocol, weeksOut, carbLoad, water, sodium, lowFiber, creatine,
 * specialization, competitions, безопасность). Валидация внутри, forced-моды видны.
 *
 * Не знает про версионированный план — только конфиг. Запись — через
 * bb-contest-prep-sync.saveContestPrepEverywhere.
 */
import React, { useMemo } from 'react';
import {
  validateBBContestPrepConfig,
  CONTEST_CATEGORY_LABELS,
  CONTEST_SPECIALIZATION_LABELS,
  resolveMainCompetition,
  type BBContestPrepConfig,
  type BBContestCategory,
  type ContestSpecialization,
  type ContestEventEntry,
} from '../../../engines/bb/bb-contest-prep.engine';

const DIM = 'rgba(255,255,255,0.55)';
const ACCENT = '#f59e0b';

const BTN_GHOST: React.CSSProperties = {
  flex: 1,
  padding: 11,
  borderRadius: 12,
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: 11,
  minHeight: 44,
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: 'rgba(255,255,255,0.85)',
};

const chip: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '3px 8px',
  borderRadius: 999,
  fontSize: 9,
  fontWeight: 700,
};

const WATER_HINTS: Record<string, string> = {
  classic: 'Load 6–10 л → ступенчатый cut → глотки. Только опытные, здоровые почки.',
  moderate: 'Мягкий cut: обычная вода + снижение в последние 2 дня.',
  minimal: 'Обычный питьевой режим. Для новичков и первых пиков.',
};

const MALE_CATS: BBContestCategory[] = ['mens_physique', 'classic_physique', 'mens_bb', 'bb_212'];
const FEMALE_CATS: BBContestCategory[] = ['bikini', 'figure', 'wellness', 'womens_physique', 'womens_bb'];
const SPECIALIZATIONS: ContestSpecialization[] = [
  'none',
  'chest',
  'back',
  'shoulders',
  'arms',
  'biceps',
  'triceps',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'abs',
  'traps',
];

// ── GlassCard (как в PeakWeekTab) ──
const GlassCard: React.FC<{ title: string; icon: string; color: string; children: React.ReactNode }> = ({
  title,
  icon,
  color,
  children,
}) => (
  <div
    style={{
      padding: 12,
      borderRadius: 14,
      background: 'linear-gradient(180deg, rgba(30,30,34,0.9), rgba(24,24,27,0.7))',
      border: '1px solid rgba(255,255,255,0.07)',
      marginBottom: 10,
      boxShadow: '0 2px 14px rgba(0,0,0,0.25)',
    }}
  >
    <div
      style={{
        fontSize: 12,
        fontWeight: 800,
        color: '#fff',
        marginBottom: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 22,
          height: 22,
          borderRadius: 7,
          background: color + '22',
          border: `1px solid ${color}40`,
          fontSize: 12,
        }}
      >
        {icon}
      </span>
      {title}
    </div>
    {children}
  </div>
);

const SegGroup: React.FC<{
  label: string;
  icon?: string;
  value: string;
  accent: string;
  options: Array<{ id: string; label: string; desc?: string }>;
  onChange: (v: string) => void;
}> = ({ label, icon, value, accent, options, onChange }) => (
  <div>
    <div
      style={{
        fontSize: 9,
        color: DIM,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        marginBottom: 4,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {icon ? <span>{icon}</span> : null}
      {label}
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {options.map(o => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            style={{
              textAlign: 'left',
              padding: '9px 10px',
              borderRadius: 10,
              cursor: 'pointer',
              minHeight: 44,
              fontSize: 11,
              fontWeight: active ? 800 : 600,
              background: active ? `${accent}18` : 'rgba(255,255,255,0.04)',
              border: active ? `1px solid ${accent}55` : '1px solid rgba(255,255,255,0.09)',
              color: active ? accent : 'rgba(255,255,255,0.75)',
              transition: 'all 0.15s ease',
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  border: active ? `2px solid ${accent}` : '1px solid rgba(255,255,255,0.25)',
                  background: active ? accent : 'transparent',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {active ? (
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      background: '#000',
                    }}
                  />
                ) : null}
              </span>
              {o.label}
            </span>
            {o.desc ? (
              <span style={{ fontSize: 8.5, color: active ? 'rgba(255,255,255,0.7)' : DIM, lineHeight: 1.3, paddingLeft: 20 }}>
                {o.desc}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  </div>
);

const Stepper: React.FC<{
  label: string;
  icon?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  accent: string;
  onChange: (v: number) => void;
}> = ({ label, icon, value, min, max, step = 1, suffix = '', accent, onChange }) => (
  <div
    style={{
      padding: '8px 9px',
      borderRadius: 10,
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
    }}
  >
    <div style={{ fontSize: 8, color: DIM, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
      {icon ? <span>{icon}</span> : null}
      {label}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <button
        type="button"
        onClick={() => onChange(value - step)}
        disabled={value <= min}
        aria-label={`${label} минус`}
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          cursor: value <= min ? 'default' : 'pointer',
          fontSize: 16,
          fontWeight: 800,
          border: '1px solid rgba(255,255,255,0.12)',
          background: 'rgba(255,255,255,0.04)',
          color: value <= min ? 'rgba(255,255,255,0.25)' : '#fff',
          opacity: value <= min ? 0.5 : 1,
        }}
      >
        −
      </button>
      <span style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: 800, color: accent }}>
        {Number.isInteger(step) ? value : value.toFixed(1)}
        {suffix ? <span style={{ fontSize: 11, color: DIM, marginLeft: 2 }}>{suffix}</span> : null}
      </span>
      <button
        type="button"
        onClick={() => onChange(value + step)}
        disabled={value >= max}
        aria-label={`${label} плюс`}
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          cursor: value >= max ? 'default' : 'pointer',
          fontSize: 16,
          fontWeight: 800,
          border: '1px solid transparent',
          background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
          color: '#000',
          opacity: value >= max ? 0.5 : 1,
        }}
      >
        +
      </button>
    </div>
  </div>
);

const ToggleChip: React.FC<{ label: string; icon?: string; value: boolean; onChange: (v: boolean) => void; danger?: boolean }> = ({
  label,
  icon,
  value,
  onChange,
  danger,
}) => {
  const color = danger ? '#f87171' : '#f59e0b';
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '7px 10px',
        borderRadius: 999,
        cursor: 'pointer',
        minHeight: 36,
        fontSize: 10,
        fontWeight: 700,
        border: value ? `1px solid ${color}66` : '1px solid rgba(255,255,255,0.12)',
        background: value ? `${color}18` : 'rgba(255,255,255,0.04)',
        color: value ? color : 'rgba(255,255,255,0.7)',
        transition: 'all 0.15s ease',
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: 9,
          border: value ? `1px solid ${color}` : '1px solid rgba(255,255,255,0.25)',
          background: value ? color : 'transparent',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10,
          color: value ? '#000' : 'transparent',
        }}
      >
        {value ? '✓' : ''}
      </span>
      {icon ? <span>{icon}</span> : null}
      {label}
    </button>
  );
};

const DateCard: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
  <div
    style={{
      padding: '8px 9px',
      borderRadius: 10,
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
    }}
  >
    <div style={{ fontSize: 8, color: DIM, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>{label}</div>
    <input
      type="date"
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%',
        padding: '8px 10px',
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 700,
        border: '1px solid rgba(245,158,11,0.25)',
        background: 'rgba(0,0,0,0.25)',
        color: '#fff',
        outline: 'none',
        fontFamily: 'inherit',
      }}
    />
  </div>
);

export interface ContestPrepConfigEditorProps {
  value: BBContestPrepConfig;
  onChange: (patch: Partial<BBContestPrepConfig>) => void;
  /** Показать hero-чипы (обратный отсчёт, готовность) снаружи — этот редактор их не рендерит. */
  compact?: boolean;
  /** Скрыть блок соревнований (для компактного режима). */
  hideCompetitions?: boolean;
}

export const ContestPrepConfigEditor: React.FC<ContestPrepConfigEditorProps> = ({ value: draft, onChange: patch }) => {
  const validation = useMemo(() => validateBBContestPrepConfig(draft), [draft]);
  const competitions = draft.competitions ?? [];

  const patchCompetition = (id: string, p: Partial<ContestEventEntry>) =>
    patch({ competitions: (draft.competitions || []).map(c => (c.id === id ? { ...c, ...p } : c)) });
  const addCompetition = () =>
    patch({
      competitions: [
        ...(draft.competitions || []),
        { id: `comp_${Date.now().toString(36)}`, name: `Старт ${(draft.competitions?.length ?? 0) + 1}`, priority: 'B' },
      ],
    });
  const removeCompetition = (id: string) =>
    patch({
      competitions: (draft.competitions || []).filter(c => c.id !== id),
      mainCompetitionId: draft.mainCompetitionId === id ? undefined : draft.mainCompetitionId,
    });
  const resolveMainId = (c: BBContestPrepConfig): string | undefined => resolveMainCompetition(c)?.id;
  const catsFor = draft.sex === 'female' ? FEMALE_CATS : MALE_CATS;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <GlassCard title="Атлет и тайминг" icon="👤" color={ACCENT}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SegGroup
            label="Пол"
            icon="👤"
            value={draft.sex}
            accent="#00e68a"
            options={[
              { id: 'male', label: 'Мужской' },
              { id: 'female', label: 'Женский' },
            ]}
            onChange={v => patch({ sex: v as any, category: (v === 'female' ? 'bikini' : 'mens_physique') as BBContestCategory })}
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
            <Stepper
              label="Вес тела"
              icon="⚖️"
              value={draft.weightKg}
              min={40}
              max={200}
              suffix="кг"
              accent="#f59e0b"
              onChange={v => patch({ weightKg: v })}
            />
            <Stepper
              label="% жира сейчас"
              icon="📏"
              value={draft.bodyFatPct ?? 0}
              min={0}
              max={60}
              step={0.5}
              suffix="%"
              accent="#60a5fa"
              onChange={v => patch({ bodyFatPct: v > 0 ? v : undefined })}
            />
          </div>
          <DateCard label="Дата шоу" value={draft.showDate} onChange={v => patch({ showDate: v })} />
          <SegGroup
            label="Уровень"
            icon="📶"
            value={draft.experienceLevel}
            accent="#a855f7"
            options={[
              { id: 'beginner', label: 'Новичок' },
              { id: 'intermediate', label: 'Средний' },
              { id: 'advanced', label: 'Продвинутый' },
            ]}
            onChange={v => patch({ experienceLevel: v as any })}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Stepper
              label="Пройдено пиков"
              icon="🏆"
              value={draft.prepCount}
              min={0}
              max={50}
              accent="#22c55e"
              onChange={v => patch({ prepCount: Math.round(v) })}
            />
            <ToggleChip label="На курсе" icon="💉" value={draft.enhanced} onChange={v => patch({ enhanced: v })} />
          </div>
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
            <ToggleChip
              label="Низковолокнистые карбс"
              icon="🍚"
              value={!!draft.preferLowFiberCarbs}
              onChange={v => patch({ preferLowFiberCarbs: v || undefined })}
            />
            <ToggleChip
              label="Прекратить креатин"
              icon="💊"
              value={draft.creatineStrategy === 'stop'}
              onChange={v => patch({ creatineStrategy: v ? 'stop' : 'continue' })}
            />
          </div>
          {(draft.waterStrategy === 'classic' || draft.sodiumStrategy !== 'constant') && (
            <label
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
                fontSize: 11,
                color: '#fbbf24',
                background: 'rgba(245,158,11,0.08)',
                padding: 10,
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={draft.confirmedManipulation === true}
                onChange={e => patch({ confirmedManipulation: e.target.checked || undefined })}
              />
              <span>
                ⚠ Я понимаю: агрессивная модуляция воды/натрия допустима только при стабильном здоровье, без
                противопоказаний; диуретики не назначаются; при симптомах нарушения электролитов — план остановить.
              </span>
            </label>
          )}
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
                  padding: '7px 8px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  minHeight: 40,
                  fontSize: 9.5,
                  fontWeight: active ? 800 : 600,
                  background: active ? 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(168,85,247,0.08))' : 'rgba(255,255,255,0.04)',
                  border: active ? '1px solid rgba(168,85,247,0.55)' : '1px solid rgba(255,255,255,0.09)',
                  color: active ? '#c084fc' : 'rgba(255,255,255,0.7)',
                  boxShadow: active ? '0 2px 12px rgba(168,85,247,0.25)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {active ? '★ ' : ''}
                {CONTEST_SPECIALIZATION_LABELS[s]}
              </button>
            );
          })}
        </div>
      </GlassCard>

      <GlassCard title={`Соревнования (${competitions.length || 1})`} icon="🏁" color="#ef4444">
        <div style={{ fontSize: 9, color: DIM, marginBottom: 8, lineHeight: 1.45 }}>
          Несколько стартов: тапер и пик-неделя строятся под <b style={{ color: '#fbbf24' }}>главное</b> (приоритет A или явный выбор). В годовом планировщике тапер накладывается на каждый блок подготовки.
        </div>
        {competitions.length === 0 ? (
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', padding: '6px 0' }}>Одно шоу — дата задана выше ({draft.showDate}).</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {competitions.map(c => {
              const isMain = resolveMainId(draft) === c.id;
              return (
                <div
                  key={c.id}
                  style={{
                    padding: 8,
                    borderRadius: 10,
                    border: isMain ? '1px solid rgba(251,191,36,0.45)' : '1px solid rgba(255,255,255,0.08)',
                    background: isMain ? 'linear-gradient(135deg, rgba(251,191,36,0.1), rgba(24,24,27,0.4))' : 'rgba(255,255,255,0.02)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => patch({ mainCompetitionId: isMain ? undefined : c.id })}
                      title={isMain ? 'Главное соревнование' : 'Сделать главным'}
                      style={{
                        flexShrink: 0,
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        cursor: 'pointer',
                        fontSize: 14,
                        border: isMain ? '1px solid rgba(251,191,36,0.6)' : '1px solid rgba(255,255,255,0.12)',
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
                        flex: 1,
                        minWidth: 0,
                        padding: '7px 9px',
                        borderRadius: 8,
                        fontSize: 11,
                        fontWeight: 700,
                        border: '1px solid rgba(255,255,255,0.1)',
                        background: 'rgba(0,0,0,0.25)',
                        color: '#fff',
                        outline: 'none',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => removeCompetition(c.id)}
                      aria-label="Удалить соревнование"
                      style={{
                        flexShrink: 0,
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        cursor: 'pointer',
                        fontSize: 13,
                        border: '1px solid rgba(239,68,68,0.3)',
                        background: 'rgba(239,68,68,0.08)',
                        color: '#f87171',
                      }}
                    >
                      ✕
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                    <div
                      style={{
                        borderRadius: 8,
                        padding: '6px 9px',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.09)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1,
                      }}
                    >
                      <span style={{ fontSize: 8, color: DIM, textTransform: 'uppercase', letterSpacing: 0.4 }}>Дата (необязательно)</span>
                      <input
                        type="date"
                        value={c.date ?? ''}
                        onChange={e => patchCompetition(c.id, { date: e.target.value || undefined })}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: '#fbbf24',
                          fontSize: 11,
                          fontWeight: 700,
                          outline: 'none',
                          fontFamily: 'inherit',
                          padding: 0,
                        }}
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
                                flex: 1,
                                padding: '6px 4px',
                                borderRadius: 8,
                                cursor: 'pointer',
                                minHeight: 32,
                                fontSize: 9.5,
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
            width: '100%',
            marginTop: 8,
            padding: '9px',
            borderRadius: 10,
            cursor: 'pointer',
            minHeight: 44,
            fontSize: 10,
            fontWeight: 800,
            border: '1px dashed rgba(239,68,68,0.4)',
            background: 'rgba(239,68,68,0.06)',
            color: '#f87171',
          }}
        >
          ＋ Добавить соревнование
        </button>
      </GlassCard>

      <GlassCard title="Безопасность" icon="🛡" color="#60a5fa">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <ToggleChip
            danger
            label="Почки"
            icon="🫘"
            value={(draft.contraindications || []).includes('kidney')}
            onChange={v =>
              patch({
                contraindications: v
                  ? [...(draft.contraindications || []), 'kidney']
                  : (draft.contraindications || []).filter(c => c !== 'kidney'),
              })
            }
          />
          <ToggleChip
            danger
            label="Сердце"
            icon="❤️"
            value={(draft.contraindications || []).includes('heart')}
            onChange={v =>
              patch({
                contraindications: v
                  ? [...(draft.contraindications || []), 'heart']
                  : (draft.contraindications || []).filter(c => c !== 'heart'),
              })
            }
          />
          <ToggleChip
            danger
            label="Гипертония"
            icon="🩸"
            value={(draft.contraindications || []).includes('hypertension')}
            onChange={v =>
              patch({
                contraindications: v
                  ? [...(draft.contraindications || []), 'hypertension']
                  : (draft.contraindications || []).filter(c => c !== 'hypertension'),
              })
            }
          />
        </div>
        {validation.warnings.length > 0 && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {validation.warnings.map((w, i) => (
              <div
                key={i}
                style={{
                  fontSize: 9,
                  color: '#fbbf24',
                  lineHeight: 1.4,
                  padding: '5px 8px',
                  borderRadius: 8,
                  background: 'rgba(245,158,11,0.08)',
                  border: '1px solid rgba(245,158,11,0.2)',
                }}
              >
                {w}
              </div>
            ))}
          </div>
        )}
        {!validation.ok && (
          <div style={{ marginTop: 6, fontSize: 10, color: '#ef4444' }}>
            {validation.errors.map((e, i) => (
              <div key={i}>✕ {e}</div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
};

export default ContestPrepConfigEditor;
