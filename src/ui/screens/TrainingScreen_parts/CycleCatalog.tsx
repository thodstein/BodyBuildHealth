/** CycleCatalog.tsx — структурированный каталог тренировочных циклов (Библиотека › Каталог циклов).
 * Разделение на Силовые / Бодибилдинг / Все, подфильтры (специализация/направление,
 * уровень, период, длительность, частота, автор), поиск, группировка по фокусу с
 * метаданными-чипами и блок «Рекомендуемые для меня» (через существующий rankCycles).
 * Новая модель данных НЕ требуется — все оси уже в SRCycleMeta. */
import React from 'react';
import { LMS_CYCLES, normalizeCycleDirection } from '../../../data/lms-cycles/lms-cycle-index';
import type { SRCycleTemplate } from '../../../data/lms-cycles/lms-types';
import { ARM_CYCLE_LIBRARY } from '../../../engines/arm/arm-cycle-library.engine';
import type { ArmCycleTemplate } from '../../../engines/arm/arm-cycle-library.engine';
import { SS_CYCLES } from '../../../data/ss-cycles/ss-cycle-index';
import type { SSCycleTemplate } from '../../../data/ss-cycles/ss-types';
import { rankCycles } from '../../../engines/lms/lms-selector.engine';
import { ExpandableCard } from '../SRCBBScreen_parts/TrainingPopups';
import { applyToPlanner } from './planner-bridge';

type CatFilter = 'all' | 'strength' | 'bodybuilding' | 'arm' | 'strong';
type UserGoal = 'strength' | 'mass' | 'endurance' | 'peak' | 'mixed' | 'speed';
type UserLevel = 'novice' | 'II-KMS' | 'KMS-MS' | 'MS-MSMK' | 'II-MS' | 'intermediate';

interface Props {
  goal: string;
  level: string;
  daysPerWeek: number;
  linked?: unknown;
}

// ── Читаемые подписи фокуса (direction ∪ targetFocus ∪ arm/SS) ──
const FOCUS_LABELS: Record<string, string> = {
  powerlifting: 'Троеборье', bench: 'Жим', deadlift_bench: 'Тяга+Жим', armwrestling: 'Армрестлинг',
  armlifting: 'Армлифтинг', strongman: 'Стронг', weightlifting: 'Тяжёлая атлетика',
  hybrid: 'Гибрид', any: 'Любая',
  bodybuilding: 'Бодибилдинг',
  push: 'Грудь / Жим', pull: 'Спина / Тяга', legs: 'Ноги', upper: 'Верх тела', lower: 'Низ тела',
  fullbody: 'Всё тело', arms: 'Руки', shoulders: 'Плечи', back: 'Спина', chest: 'Грудь',
  mixed: 'Смешанный', specialization: 'Спец-блок', contest: 'Контест-подготовка',
};

// ── Маппинг LMS-уровня фильтра на PRO-уровни арм/SS-библиотек ──
function proLevelsFor(levelF: string): string[] {
  if (levelF === 'novice') return ['beginner'];
  if (levelF === 'intermediate') return ['intermediate'];
  if (levelF === 'MS-MSMK') return ['advanced', 'enhanced'];
  // II-KMS / KMS-MS / II-MS — средний уровень
  return ['beginner', 'intermediate', 'advanced'];
}
/** Совпадение арм-цикла с LMS-фильтром уровня (level — массив). */
export function matchArmLevel(c: ArmCycleTemplate, levelF: string): boolean {
  if (levelF === 'all') return true;
  return c.level.some(l => proLevelsFor(levelF).includes(l));
}
/** Совпадение SS-цикла с LMS-фильтром уровня (level — массив). */
export function matchSSLevel(c: SSCycleTemplate, levelF: string): boolean {
  if (levelF === 'all') return true;
  return c.meta.level.some(l => proLevelsFor(levelF).includes(l));
}
/** Совпадение SS-цикла с фильтром периода (SS-шкала base/build/peak/mixed). */
export function matchSSPeriod(c: SSCycleTemplate, period: string): boolean {
  if (period === 'all') return true;
  if (period === 'strength' || period === 'mass') return c.meta.period === 'base' || c.meta.period === 'build';
  if (period === 'peak') return c.meta.period === 'peak';
  if (period === 'endurance') return false;
  if (period === 'mixed') return c.meta.period === 'mixed';
  return true;
}

// ── Нормализация цели/уровня профиля под union движка rankCycles ──
function normalizeGoal(g: string): UserGoal {
  const s = (g || '').toLowerCase();
  if (/(speed|скорость|координ)/.test(s)) return 'speed';
  if (/(mass|масс|гипертроф|набор|muscle)/.test(s)) return 'mass';
  if (/(strength|сил)/.test(s)) return 'strength';
  if (/(endurance|выносл)/.test(s)) return 'endurance';
  if (/(peak|пик|соревн)/.test(s)) return 'peak';
  return 'mixed';
}
function normalizeLevel(l: string): UserLevel {
  const known: UserLevel[] = ['novice', 'II-KMS', 'KMS-MS', 'MS-MSMK', 'II-MS', 'intermediate'];
  if ((known as string[]).includes(l)) return l as UserLevel;
  const s = (l || '').toLowerCase();
  if (/(novice|beginner|начин|нович)/.test(s)) return 'novice';
  if (/(intermediate|средн)/.test(s)) return 'intermediate';
  if (/(adv|pro|продвин|мастер|мсмк|msmk)/.test(s)) return 'MS-MSMK';
  return 'KMS-MS';
}

// ── Ключ фокуса цикла с учётом выбранной категории ──
function focusKeyOf(c: SRCycleTemplate, cat: CatFilter): string {
  const m = c.meta;
  if (cat === 'bodybuilding') return m.targetFocus ?? 'mixed';
  if (cat === 'strength') return m.direction;
  return normalizeCycleDirection(m.direction) === 'bodybuilding' ? (m.targetFocus ?? 'mixed') : m.direction;
}

// ── Доступные значения для подфильтров (только те, что есть в базе) ──
function uniqKeys(cycles: SRCycleTemplate[], cat: CatFilter): string[] {
  const set = new Set<string>();
  cycles.forEach(c => set.add(focusKeyOf(c, cat)));
  return [...set].sort((a, b) => (FOCUS_LABELS[a] || a).localeCompare(FOCUS_LABELS[b] || b, 'ru'));
}

const LEVELS: UserLevel[] = ['novice', 'II-KMS', 'KMS-MS', 'MS-MSMK', 'II-MS', 'intermediate'];
const PERIODS = ['strength', 'peak', 'mass', 'endurance', 'mixed'];
const AUTHORS = ['lms', 'bodybuilding', 'surovetsky', 'sheiko', 'solovyov', 'muravyov'];
/** Доступные частоты фильтра (дн/нед) — 5-дневные циклы обязаны быть выбираемыми. */
export const CYCLE_FREQ_OPTS = ['2', '3', '4', '5', '6'];

function weeksBucket(w: number): string {
  if (w <= 8) return 'w8';
  if (w <= 12) return 'w12';
  return 'w13';
}
const WEEKS_LABELS: Record<string, string> = { w8: '≤ 8 нед', w12: '9–12 нед', w13: '13+ нед' };
const PERIOD_LABELS: Record<string, string> = { strength: 'Сила', peak: 'Выход на пик', mass: 'Масса', endurance: 'Выносливость', mixed: 'Смешанный' };
// ── Подписи SS-периодов (base/build/peak/mixed) — маппятся на те же ключи фильтра ──
const SS_PERIOD_LABELS: Record<string, string> = { base: 'База', build: 'Напор', peak: 'Пик', mixed: 'Смешанный' };
const SS_MODE_LABELS: Record<string, string> = { weightlifting: 'Тяжёлая атлетика', strongman: 'Стронг', hybrid: 'Гибрид' };
const ARM_DISC_LABELS: Record<string, string> = { armwrestling: 'Армрестлинг', armlifting: 'Армлифтинг', hybrid: 'Гибрид', any: 'Любая' };

// ── Просмотр раскладки цикла (дни → упражнения → подходы/повторы/%ПМ) ──
export const CycleLayoutView: React.FC<{ cycle: SRCycleTemplate }> = ({ cycle }) => {
  const explicit = cycle.weeks && cycle.weeks.length > 0 ? cycle.weeks : undefined;
  const [weekIdx, setWeekIdx] = React.useState(0);
  React.useEffect(() => { setWeekIdx(0); }, [cycle.meta.id]);
  const days = explicit
    ? explicit[Math.min(weekIdx, explicit.length - 1)]
    : cycle.week1;
  if (!days || days.length === 0) return <div style={{ fontSize: 11, color: '#fff' }}>Раскладка цикла не задана.</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {explicit && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Неделя раскладки:</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {explicit.map((_, i) => (
              <button key={i} onClick={() => setWeekIdx(i)} style={{
                minWidth: 30, padding: '4px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                border: weekIdx === i ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)',
                background: weekIdx === i ? 'rgba(0,230,138,0.14)' : 'rgba(255,255,255,0.03)',
                color: weekIdx === i ? 'var(--accent)' : '#fff',
              }}>Неделя {i + 1}</button>
            ))}
          </div>
        </div>
      )}
      {!explicit && cycle.meta.weeks > 1 && (
        <div style={{ fontSize: 10, color: '#fff' }}>
          Показана неделя 1 из {cycle.meta.weeks}. Недели 2..N генерируются прогрессией (коррекция ПМ {Math.round((cycle.meta.correctionPct || 0) * 1000) / 10}%/нед).
        </div>
      )}
      {days.map((day, di) => (
        <div key={di} style={{ borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.3, padding: '5px 8px', background: 'rgba(0,230,138,0.06)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            День {di + 1}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '5px 8px' }}>
            {day.exercises.map((ex, ei) => (
              <div key={ei} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 4, fontSize: 11, lineHeight: 1.5 }}>
                <span style={{ color: '#fff' }}>{ex.name}</span>
                {ex.load && <span style={{ fontSize: 10, color: ex.load === 'Тяжелая' ? '#ef4444' : ex.load === 'Средняя' ? '#eab308' : '#22c55e' }}>{ex.load}</span>}
                <span style={{ color: '#fff', fontSize: 10 }}>
                  {(ex.sets || []).map((s, si) => `${s.sets}×${s.reps} @${Math.round(s.pct * 100)}%${s.rir !== undefined ? ` · RIR ${s.rir}` : ''}`).join(' + ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Раскладка SS-цикла (ТА/стронг): явные недели → дни → упражнения ──
export const SSCycleLayoutView: React.FC<{ cycle: SSCycleTemplate }> = ({ cycle }) => {
  const total = cycle.weeks ? cycle.weeks.length : 0;
  const [weekIdx, setWeekIdx] = React.useState(0);
  React.useEffect(() => { setWeekIdx(0); }, [cycle.meta.id]);
  const days = cycle.weeks && cycle.weeks.length > 0 ? cycle.weeks[Math.min(weekIdx, cycle.weeks.length - 1)] : cycle.week1;
  if (!days || days.length === 0) return <div style={{ fontSize: 11, color: '#fff' }}>Раскладка цикла не задана.</div>;
  return (
    <div className="lib-ss-layout" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {total > 1 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Неделя раскладки:</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {cycle.weeks.map((_, i) => (
              <button key={i} onClick={() => setWeekIdx(i)} style={{
                minWidth: 30, padding: '4px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                border: weekIdx === i ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)',
                background: weekIdx === i ? 'rgba(0,230,138,0.14)' : 'rgba(255,255,255,0.03)',
                color: weekIdx === i ? 'var(--accent)' : '#fff',
              }}>Неделя {i + 1}</button>
            ))}
          </div>
        </div>
      )}
      {days.map((day, di) => (
        <div key={di} style={{ borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.3, padding: '5px 8px', background: 'rgba(0,230,138,0.06)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            День {di + 1} · {day.character}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '5px 8px' }}>
            {day.exercises.map((ex, ei) => (
              <div key={ei} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 4, fontSize: 11, lineHeight: 1.5 }}>
                <span style={{ color: '#fff' }}>{ex.name}</span>
                <span style={{ color: '#fff', fontSize: 10 }}>
                  {ex.sets.map((s, si) => `${s.sets}×${s.reps} @${Math.round(s.pct * 100)}%${s.distanceM ? ` · ${s.distanceM}м` : ''}${s.timeCapS ? ` · ${s.timeCapS}с` : ''}`).join(' + ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Фазовая карта арм-цикла: мини-полоска недель (библиотека фаз, не раскладка) ──
export const ArmPhaseStrip: React.FC<{ cycle: ArmCycleTemplate }> = ({ cycle }) => {
  const phaseColor = (ph: string): string =>
    ph === 'accumulation' ? 'rgba(0,230,138,0.55)'
    : ph === 'intensification' ? 'rgba(245,158,11,0.65)'
    : ph === 'peaking' ? 'rgba(239,68,68,0.65)'
    : 'rgba(59,130,246,0.55)';
  const phaseShort = (ph: string): string =>
    ph === 'accumulation' ? 'Б' : ph === 'intensification' ? 'Н' : ph === 'peaking' ? 'П' : 'Д';
  const weeks = Object.keys(cycle.phases).map(Number).sort((a, b) => a - b);
  if (weeks.length === 0) return null;
  return (
    <div className="lib-phase-strip" style={{ display: 'flex', gap: 2, marginTop: 6 }} aria-label="Фазовая карта цикла">
      {weeks.map(w => (
        <span key={w} title={`Неделя ${w}: ${cycle.phases[w]}`} style={{
          flex: 1, minWidth: 0, textAlign: 'center', fontSize: 9, fontWeight: 800, color: '#fff',
          background: phaseColor(cycle.phases[w]), borderRadius: 4, padding: '3px 0',
        }}>{phaseShort(cycle.phases[w])}</span>
      ))}
    </div>
  );
};

// ── Чип-кнопка — красиво, без бега
function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button className="lib-chip" data-active={active ? 'true' : 'false'} onClick={onClick} style={{
      padding: '7px 12px', borderRadius: 12, fontSize: 11, fontWeight: 700, cursor: 'pointer',
      whiteSpace: 'normal', wordBreak: 'break-word', transition: 'all 0.2s',
      background: active ? 'linear-gradient(135deg, var(--accent), #00c853)' : 'rgba(255,255,255,0.04)',
      color: active ? '#000' : '#fff', border: active ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)',
      boxShadow: active ? '0 2px 8px rgba(0,230,138,0.25)' : 'none',
    }}>{label}</button>
  );
}

/** Безопасное чтение избранного: битый storage (объект/строка/число) → [] вместо краша рендера. */
export function readCycleFavs(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem('he_cycle_fav') || '[]');
    if (!Array.isArray(v)) return [];
    return v.filter((x): x is string => typeof x === 'string');
  } catch { return []; }
}

export const CycleCatalog: React.FC<Props> = (p) => {
  const [cat, setCat] = React.useState<CatFilter>('all');
  const [search, setSearch] = React.useState('');
  const [focus, setFocus] = React.useState('all');
  const [levelF, setLevelF] = React.useState('all');
  const [period, setPeriod] = React.useState('all');
  const [weeks, setWeeks] = React.useState('all');
  const [freq, setFreq] = React.useState('all');
  const [author, setAuthor] = React.useState('all');
  const [showRec, setShowRec] = React.useState(false);
  // ⭐ Избранные циклы (he_cycle_fav)
  const [favs, setFavs] = React.useState<string[]>(readCycleFavs);
  const [favOnly, setFavOnly] = React.useState(false);
  React.useEffect(() => {
    try { localStorage.setItem('he_cycle_fav', JSON.stringify(favs)); } catch { /* ignore */ }
  }, [favs]);
  const toggleFav = (id: string) => setFavs(prev => {
    const arr = Array.isArray(prev) ? prev : [];
    return arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id];
  });
  // ── Мост «Библиотека → конструктор»: именной цикл уходит в planner-bridge
  // (kind arm_cycle/ss_cycle), конструктор подхватывает при открытии + живьём.
  const [bridgeMsg, setBridgeMsg] = React.useState('');
  const sendCycle = (kind: 'arm_cycle' | 'ss_cycle', cycleId: string, title: string) => {
    try {
      applyToPlanner({ kind, label: title, data: { cycleId } });
      const track = kind === 'arm_cycle' ? 'arm' : 'strength';
      try { localStorage.setItem('he_training_planning_track', track); } catch { /* ignore */ }
      try { window.dispatchEvent(new CustomEvent('planning-track-open', { detail: track })); } catch { /* ignore */ }
      setBridgeMsg(`✅ «${title}» → ${kind === 'arm_cycle' ? 'арм-конструктор' : 'конструктор ТА/стронга'}`);
      setTimeout(() => setBridgeMsg(''), 5000);
    } catch { setBridgeMsg('⚠ Не удалось отправить цикл'); }
  };
  const favCycles = React.useMemo(
    () => (Array.isArray(favs) ? LMS_CYCLES.filter(c => favs.includes(c.meta.id)) : []),
    [favs],
  );
  const favArmCycles = React.useMemo(
    () => (Array.isArray(favs) ? ARM_CYCLE_LIBRARY.filter(c => favs.includes(`arm:${c.id}`)) : []),
    [favs],
  );
  const favSSCycles = React.useMemo(
    () => (Array.isArray(favs) ? SS_CYCLES.filter(c => favs.includes(`ss:${c.meta.id}`)) : []),
    [favs],
  );
  const favTotal = favCycles.length + favArmCycles.length + favSSCycles.length;

  const base = React.useMemo(() => {
    if (cat === 'all') return LMS_CYCLES;
    if (cat === 'arm' || cat === 'strong') return LMS_CYCLES;
    return LMS_CYCLES.filter(c =>
      cat === 'bodybuilding'
        ? normalizeCycleDirection(c.meta.direction) === 'bodybuilding'
        : normalizeCycleDirection(c.meta.direction) !== 'bodybuilding',
    );
  }, [cat]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return base.filter(c => {
      const m = c.meta;
      if (favOnly && !favs.includes(m.id)) return false;
      if (focus !== 'all' && focusKeyOf(c, cat) !== focus) return false;
      if (levelF !== 'all' && m.level !== levelF) return false;
      if (period !== 'all' && m.period !== period) return false;
      if (weeks !== 'all' && weeksBucket(m.weeks) !== weeks) return false;
      if (freq !== 'all' && String(m.sessionsPerWeek) !== freq) return false;
      if (author !== 'all' && !(m.tags || []).includes(author)) return false;
      if (q && !(`${m.title || ''} ${m.description || ''} ${m.howItWorks || ''}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [base, focus, levelF, period, weeks, freq, author, search, favOnly, favs]);

  // ── Арм-библиотека (19 именных циклов): фильтры поиска/фокуса/уровня/недель/частоты ──
  const armFiltered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return ARM_CYCLE_LIBRARY.filter(c => {
      if (favOnly && !favs.includes(`arm:${c.id}`)) return false;
      // Фокус-ось арм-раздела (дисциплина) применяется только внутри раздела;
      // в «Все» LMS-фокус арм-циклы не прячет.
      if (cat === 'arm' && focus !== 'all' && c.discipline !== focus) return false;
      if (!matchArmLevel(c, levelF)) return false;
      if (weeks !== 'all' && weeksBucket(c.weeks) !== weeks) return false;
      if (freq !== 'all' && String(c.daysPerWeek) !== freq) return false;
      if (q && !(`${c.name || ''} ${c.note || ''} ${c.rpe || ''}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [search, focus, levelF, weeks, freq, favOnly, favs, cat]);

  // ── SS-библиотека (ТА/стронг, 15 циклов): фильтры поиска/режима/уровня/периода/недель/частоты ──
  const ssFiltered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return SS_CYCLES.filter(c => {
      const m = c.meta;
      if (favOnly && !favs.includes(`ss:${m.id}`)) return false;
      // Режим SS применяется только внутри раздела; в «Все» LMS-фокус SS не прячет.
      if (cat === 'strong' && focus !== 'all' && m.mode !== focus) return false;
      if (!matchSSLevel(c, levelF)) return false;
      if (!matchSSPeriod(c, period)) return false;
      if (weeks !== 'all' && weeksBucket(m.weeks) !== weeks) return false;
      if (freq !== 'all' && String(m.sessionsPerWeek) !== freq) return false;
      if (q && !(`${m.title || ''} ${m.description || ''} ${m.howItWorks || ''}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [search, focus, levelF, period, weeks, freq, favOnly, favs, cat]);

  const grouped = React.useMemo(() => {
    const map = new Map<string, SRCycleTemplate[]>();
    for (const c of filtered) {
      const k = focusKeyOf(c, cat);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(c);
    }
    return [...map.entries()].sort((a, b) =>
      (FOCUS_LABELS[a[0]] || a[0]).localeCompare(FOCUS_LABELS[b[0]] || b[0], 'ru'));
  }, [filtered, cat]);

  const armGrouped = React.useMemo(() => {
    const map = new Map<string, ArmCycleTemplate[]>();
    for (const c of armFiltered) {
      if (!map.has(c.discipline)) map.set(c.discipline, []);
      map.get(c.discipline)!.push(c);
    }
    return [...map.entries()].sort((a, b) =>
      (ARM_DISC_LABELS[a[0]] || a[0]).localeCompare(ARM_DISC_LABELS[b[0]] || b[0], 'ru'));
  }, [armFiltered]);

  const ssGrouped = React.useMemo(() => {
    const map = new Map<string, SSCycleTemplate[]>();
    for (const c of ssFiltered) {
      if (!map.has(c.meta.mode)) map.set(c.meta.mode, []);
      map.get(c.meta.mode)!.push(c);
    }
    return [...map.entries()].sort((a, b) =>
      (SS_MODE_LABELS[a[0]] || a[0]).localeCompare(SS_MODE_LABELS[b[0]] || b[0], 'ru'));
  }, [ssFiltered]);

  const availableFocus = React.useMemo(() => {
    if (cat === 'arm') return [...new Set(ARM_CYCLE_LIBRARY.map(c => c.discipline))].sort((a, b) => (ARM_DISC_LABELS[a] || a).localeCompare(ARM_DISC_LABELS[b] || b, 'ru'));
    if (cat === 'strong') return [...new Set(SS_CYCLES.map(c => c.meta.mode))].sort((a, b) => (SS_MODE_LABELS[a] || a).localeCompare(SS_MODE_LABELS[b] || b, 'ru'));
    return uniqKeys(base, cat);
  }, [base, cat]);
  const availableAuthors = React.useMemo(() => AUTHORS.filter(a => base.some(c => (c.meta.tags || []).includes(a))), [base]);

  // ── Сколько всего видно в текущей категории (LMS + арм + SS) ──
  const visibleCount = cat === 'arm' ? armFiltered.length
    : cat === 'strong' ? ssFiltered.length
    : cat === 'all' ? filtered.length + armFiltered.length + ssFiltered.length
    : filtered.length;
  const totalCount = cat === 'arm' ? ARM_CYCLE_LIBRARY.length
    : cat === 'strong' ? SS_CYCLES.length
    : cat === 'all' ? LMS_CYCLES.length + ARM_CYCLE_LIBRARY.length + SS_CYCLES.length
    : LMS_CYCLES.length;

  const recommendations = React.useMemo(() => {
    const ranked = rankCycles({
      goal: normalizeGoal(p.goal),
      level: normalizeLevel(p.level),
      daysPerWeek: p.daysPerWeek,
      direction: cat === 'strength' ? 'powerlifting' : cat === 'bodybuilding' ? 'bodybuilding' : undefined,
    });
    return ranked.filter(r => r.score > 0).slice(0, 5);
  }, [p.goal, p.level, p.daysPerWeek, cat]);

  const resetFilters = () => {
    setFocus('all'); setLevelF('all'); setPeriod('all'); setWeeks('all'); setFreq('all'); setAuthor('all'); setSearch('');
    setFavOnly(false);
  };

  const focusLabel = cat === 'strength' ? 'Направление'
    : cat === 'bodybuilding' ? 'Специализация'
    : cat === 'arm' ? 'Дисциплина'
    : cat === 'strong' ? 'Режим' : 'Специализация / направление';
  const focusChipLabel = (k: string): string => {
    if (cat === 'arm') return ARM_DISC_LABELS[k] || k;
    if (cat === 'strong') return SS_MODE_LABELS[k] || k;
    return FOCUS_LABELS[k] || k;
  };

  return (
    <div className="train-cycles lib-cycles" style={{ maxWidth: 720, margin: '0 auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="lib-intro" style={{ fontSize: 11, color: '#fff' }}>Справочник готовых циклов: ПЛ и ББ ({LMS_CYCLES.length}), армрестлинг и армлифтинг ({ARM_CYCLE_LIBRARY.length}), тяжёлая атлетика и стронг ({SS_CYCLES.length}). Выберите тип, уточните специализацию, уровень, период и другие параметры — каталог перестроится автоматически.</div>

      {/* ── Сегмент-контрол: Все / Силовые / Бодибилдинг / Арм / ТА·Стронг ── */}
      <div className="lib-seg" style={{ display: 'flex', gap: 4, padding: '6px', borderRadius: 12, background: 'rgba(24,24,27,0.15)', border: '1px solid rgba(255,255,255,0.04)' }}>
        {([
          { id: 'all' as CatFilter, label: 'Все', icon: '📚' },
          { id: 'strength' as CatFilter, label: 'Силовые', icon: '🏆' },
          { id: 'bodybuilding' as CatFilter, label: 'Бодибилдинг', icon: '💪' },
          { id: 'arm' as CatFilter, label: 'Арм', icon: '💪' },
          { id: 'strong' as CatFilter, label: 'ТА·Стронг', icon: '🏋️' },
        ]).map(s => (
          <button key={s.id} data-active={cat === s.id ? 'true' : 'false'} aria-pressed={cat === s.id} onClick={() => { setCat(s.id); setFocus('all'); }} style={{
            flex: 1, padding: '8px 4px', borderRadius: 9, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: cat === s.id ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.06)',
            background: cat === s.id ? 'rgba(0,230,138,0.14)' : 'rgba(255,255,255,0.02)', color: cat === s.id ? 'var(--accent)' : '#fff',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          }}>
            <span style={{ fontSize: 15 }}>{s.icon}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </div>

      {/* ── Поиск ── */}
      <input
        className="lib-search"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="🔎 Поиск по названию и описанию…"
        style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 12, fontSize: 12, color: '#fff', background: 'rgba(118,118,128,0.12)', border: '0.5px solid rgba(255,255,255,0.1)', outline: 'none' }}
      />

      {/* ── Подфильтры ── */}
      <div className="lib-filters" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 }}>{focusLabel}</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <Chip label="Все" active={focus === 'all'} onClick={() => setFocus('all')} />
            {availableFocus.map(k => (
              <Chip key={k} label={focusChipLabel(k)} active={focus === k} onClick={() => setFocus(focus === k ? 'all' : k)} />
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 }}>Уровень</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <Chip label="Все" active={levelF === 'all'} onClick={() => setLevelF('all')} />
            {LEVELS.map(l => (
              <Chip key={l} label={l} active={levelF === l} onClick={() => setLevelF(levelF === l ? 'all' : l)} />
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {cat !== 'arm' && (
          <div style={{ flex: '1 1 160px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 }}>Период</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <Chip label="Все" active={period === 'all'} onClick={() => setPeriod('all')} />
              {PERIODS.map(p2 => (
                <Chip key={p2} label={PERIOD_LABELS[p2]} active={period === p2} onClick={() => setPeriod(period === p2 ? 'all' : p2)} />
              ))}
            </div>
          </div>
          )}
          <div style={{ flex: '1 1 160px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 }}>Длительность</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <Chip label="Все" active={weeks === 'all'} onClick={() => setWeeks('all')} />
              {Object.keys(WEEKS_LABELS).map(w => (
                <Chip key={w} label={WEEKS_LABELS[w]} active={weeks === w} onClick={() => setWeeks(weeks === w ? 'all' : w)} />
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 160px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 }}>Частота</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <Chip label="Все" active={freq === 'all'} onClick={() => setFreq('all')} />
              {CYCLE_FREQ_OPTS.map(f => (
                <Chip key={f} label={`${f} дн/нед`} active={freq === f} onClick={() => setFreq(freq === f ? 'all' : f)} />
              ))}
            </div>
          </div>
          {(cat !== 'arm' && cat !== 'strong' && availableAuthors.length > 0) && (
            <div style={{ flex: '1 1 160px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 }}>Автор / источник</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <Chip label="Все" active={author === 'all'} onClick={() => setAuthor('all')} />
                {availableAuthors.map(a => (
                  <Chip key={a} label={a} active={author === a} onClick={() => setAuthor(author === a ? 'all' : a)} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 11, color: '#fff' }}>Найдено: <b style={{ color: 'var(--accent)' }}>{visibleCount}</b> циклов</div>
            <Chip label={`⭐ Избранное (${favs.length})`} active={favOnly} onClick={() => setFavOnly(v => !v)} />
          </div>
          <button onClick={resetFilters} style={{ padding: '4px 10px', borderRadius: 8, fontSize: 10, fontWeight: 700, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#fff', cursor: 'pointer' }}>↺ Сбросить</button>
        </div>
      </div>

      {/* ── Подтверждение моста в конструктор ── */}
      {bridgeMsg && (
        <div role="status" style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.25)', borderRadius: 12, padding: '10px 12px' }}>{bridgeMsg}</div>
      )}

      {/* ⭐ Избранные циклы (ПЛ/ББ + арм + ТА/стронг) */}
      {favTotal > 0 && (
        <div className="lib-fav" style={{ background: 'rgba(250,204,21,0.05)', borderRadius: 12, border: '1px solid rgba(250,204,21,0.18)', padding: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#facc15', marginBottom: 6 }}>⭐ Избранные циклы ({favTotal})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {favCycles.map(c => {
              const m = c.meta;
              return (
                <div key={m.id} style={{ background: 'rgba(24,24,27,0.4)', borderRadius: 10, padding: 8, border: '1px solid rgba(250,204,21,0.15)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#facc15', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</div>
                    <button aria-label={`Убрать из избранного ${m.title}`} data-fav="true" onClick={() => toggleFav(m.id)} style={{ minWidth: 44, minHeight: 44, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 15 }} title="Убрать из избранного">⭐</button>
                  </div>
                  <div style={{ fontSize: 10, color: '#fff', marginTop: 2 }}>{m.level} · {m.weeks} нед · {m.sessionsPerWeek} дн/нед · {PERIOD_LABELS[m.period] || m.period}</div>
                </div>
              );
            })}
            {favArmCycles.map(c => (
              <div key={`arm:${c.id}`} style={{ background: 'rgba(24,24,27,0.4)', borderRadius: 10, padding: 8, border: '1px solid rgba(250,204,21,0.15)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#facc15', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                  <button aria-label={`Убрать из избранного ${c.name}`} data-fav="true" onClick={() => toggleFav(`arm:${c.id}`)} style={{ minWidth: 44, minHeight: 44, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 15 }} title="Убрать из избранного">⭐</button>
                </div>
                <div style={{ fontSize: 10, color: '#fff', marginTop: 2 }}>💪 {ARM_DISC_LABELS[c.discipline] || c.discipline} · {c.weeks} нед · {c.daysPerWeek} дн/нед</div>
              </div>
            ))}
            {favSSCycles.map(c => {
              const m = c.meta;
              return (
                <div key={`ss:${m.id}`} style={{ background: 'rgba(24,24,27,0.4)', borderRadius: 10, padding: 8, border: '1px solid rgba(250,204,21,0.15)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#facc15', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</div>
                    <button aria-label={`Убрать из избранного ${m.title}`} data-fav="true" onClick={() => toggleFav(`ss:${m.id}`)} style={{ minWidth: 44, minHeight: 44, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 15 }} title="Убрать из избранного">⭐</button>
                  </div>
                  <div style={{ fontSize: 10, color: '#fff', marginTop: 2 }}>🏋️ {SS_MODE_LABELS[m.mode] || m.mode} · {m.weeks} нед · {m.sessionsPerWeek} дн/нед · {SS_PERIOD_LABELS[m.period] || m.period}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Рекомендуемые для меня ── */}
      <div className="lib-rec" style={{ background: 'rgba(0,230,138,0.06)', borderRadius: 12, border: '1px solid rgba(0,230,138,0.2)', padding: 10 }}>
        <button onClick={() => setShowRec(v => !v)} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, fontWeight: 800, cursor: 'pointer', padding: 0 }}>
          {showRec ? '▼' : '▶'} 💡 Рекомендуемые для меня
        </button>
        {showRec && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recommendations.length === 0 && <div style={{ fontSize: 11, color: '#fff' }}>Нет подходящих — уточните цель/уровень в профиле.</div>}
            {recommendations.map(r => (
              <div key={r.cycle.meta.id} style={{ background: 'rgba(24,24,27,0.4)', borderRadius: 10, padding: 8, border: '1px solid rgba(0,230,138,0.18)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>{r.cycle.meta.title}</div>
                <div style={{ fontSize: 11, color: '#fff', margin: '2px 0 4px' }}>Скоринг подбора: {r.score}</div>
                {r.rationale.slice(0, 2).map((x, i) => (
                  <div key={i} style={{ fontSize: 10, color: '#fff', lineHeight: 1.4 }}>✓ {x}</div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Сгруппированный список ── */}
      {visibleCount === 0 && (
        <div className="lib-empty" style={{ fontSize: 12, color: '#fff', textAlign: 'center', padding: 20, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
          <div style={{ fontSize: 28 }}>🗂</div>
          <div style={{ fontWeight: 800 }}>Ничего не найдено</div>
          <div style={{ fontSize: 11, opacity: 0.85, lineHeight: 1.5 }}>
            {favOnly && favs.length === 0
              ? 'Включён фильтр «⭐ Избранное», а избранных циклов пока нет — нажмите ⭐ на карточке цикла.'
              : 'По выбранным фильтрам циклов не найдено — ослабьте условия поиска.'}
          </div>
          <button onClick={resetFilters} style={{ padding: '10px 20px', borderRadius: 12, fontSize: 12, fontWeight: 800, cursor: 'pointer', minHeight: 48, border: '1px solid var(--accent)', background: 'rgba(0,230,138,0.12)', color: 'var(--accent)' }}>
            Показать всё ({totalCount})
          </button>
        </div>
      )}
      {/* ── Арм-циклы (именная библиотека: стол, хват, тейпер-пресеты) ── */}
      {(cat === 'arm' || cat === 'all') && armFiltered.length > 0 && (
        <div className="lib-group lib-arm-group">
          <div style={{ fontSize: 10, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.3, margin: '6px 0 2px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>💪 Армрестлинг / армлифтинг</span>
            <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '1px 7px', color: '#fff' }}>{armFiltered.length}</span>
          </div>
        </div>
      )}
      {(cat === 'arm' || cat === 'all' ? armGrouped : []).map(([dk, cycles]) => (
        <div key={`arm-${dk}`} className="lib-group lib-cat-arm">
          <div style={{ fontSize: 10, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.3, margin: '6px 0 2px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>{ARM_DISC_LABELS[dk] || dk}</span>
            <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '1px 7px', color: '#fff' }}>{cycles.length}</span>
          </div>
          {cycles.map(c => {
            const favId = `arm:${c.id}`;
            const chips = [`${c.weeks} нед`, `${c.daysPerWeek} дн/нед`, c.rpe, `Стол ${c.tablePerWeek}×/нед`];
            return (
              <ExpandableCard
                key={favId}
                title={c.name}
                icon=""
                accent="#f59e0b"
                short={
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {chips.map((ch, i) => (
                          <span key={i} style={{ fontSize: 11, fontWeight: 600, color: '#fff', background: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: '2px 7px' }}>{ch}</span>
                        ))}
                      </div>
                      <button aria-label={favs.includes(favId) ? `Убрать из избранного ${c.name}` : `В избранное ${c.name}`}
                        data-fav={favs.includes(favId) ? 'true' : 'false'}
                        onClick={e => { e.stopPropagation(); toggleFav(favId); }}
                        style={{ minWidth: 40, minHeight: 40, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 15, flexShrink: 0, filter: favs.includes(favId) ? 'none' : 'grayscale(1)', opacity: favs.includes(favId) ? 1 : 0.4 }}
                        title={favs.includes(favId) ? 'Убрать из избранного' : 'В избранное'}>⭐</button>
                    </div>
                    <div>{c.note}</div>
                    <ArmPhaseStrip cycle={c} />
                  </div>
                }
                full={
                  <div>
                    <div style={{ marginBottom: 6 }}>{c.note}</div>
                    <div>
                      <b style={{ fontSize: 11 }}>Параметры:</b>
                      <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: 11 }}>
                        <li style={{ marginBottom: 2 }}>Уровень: {c.level.join(', ')}</li>
                        <li style={{ marginBottom: 2 }}>Стол: {c.tablePerWeek}×/нед</li>
                        <li style={{ marginBottom: 2 }}>Тейпер-пресет: {c.taperPreset}</li>
                        <li style={{ marginBottom: 2 }}>Делод: {c.deloadRule}</li>
                        <li style={{ marginBottom: 2 }}>Прогрессия: {c.correctionPctDefault}%/нед</li>
                      </ul>
                    </div>
                    <div className="lib-arm-note" style={{ marginTop: 8, fontSize: 11, color: '#fff', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.22)', borderRadius: 8, padding: '6px 8px' }}>
                      💪 Именной цикл — одной кнопкой уходит в конструктор (блок «📚 Именной цикл»).
                    </div>
                    <button className="lib-apply" onClick={() => sendCycle('arm_cycle', c.id, c.name)} style={{
                      width: '100%', marginTop: 8, padding: 12, borderRadius: 12, border: 'none', cursor: 'pointer',
                      background: 'var(--accent)', color: '#000', fontWeight: 800, fontSize: 13, minHeight: 48,
                    }}>💪 Собрать в арм-конструкторе →</button>
                  </div>
                }
              />
            );
          })}
        </div>
      ))}
      {/* ── ТА/стронг-циклы (явные недели из источника) ── */}
      {(cat === 'strong' || cat === 'all') && ssFiltered.length > 0 && (
        <div className="lib-group lib-strong-group">
          <div style={{ fontSize: 10, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.3, margin: '6px 0 2px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🏋️ Тяжёлая атлетика / стронг</span>
            <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '1px 7px', color: '#fff' }}>{ssFiltered.length}</span>
          </div>
        </div>
      )}
      {(cat === 'strong' || cat === 'all' ? ssGrouped : []).map(([mk, cycles]) => (
        <div key={`ss-${mk}`} className="lib-group lib-cat-strong">
          <div style={{ fontSize: 10, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.3, margin: '6px 0 2px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>{SS_MODE_LABELS[mk] || mk}</span>
            <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '1px 7px', color: '#fff' }}>{cycles.length}</span>
          </div>
          {cycles.map(c => {
            const m = c.meta;
            const favId = `ss:${m.id}`;
            const chips = [`${m.weeks} нед`, `${m.sessionsPerWeek} дн/нед`, SS_PERIOD_LABELS[m.period] || m.period, (m.level || []).join('/')];
            return (
              <ExpandableCard
                key={favId}
                title={m.title}
                icon=""
                accent="#38bdf8"
                short={
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {chips.map((ch, i) => (
                          <span key={i} style={{ fontSize: 11, fontWeight: 600, color: '#fff', background: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: '2px 7px' }}>{ch}</span>
                        ))}
                        {m.needsSpecialty && (
                          <span className="lib-equip-badge" style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: 'rgba(245,158,11,0.16)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '2px 7px' }}>🎪 Спец-снаряды</span>
                        )}
                      </div>
                      <button aria-label={favs.includes(favId) ? `Убрать из избранного ${m.title}` : `В избранное ${m.title}`}
                        data-fav={favs.includes(favId) ? 'true' : 'false'}
                        onClick={e => { e.stopPropagation(); toggleFav(favId); }}
                        style={{ minWidth: 40, minHeight: 40, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 15, flexShrink: 0, filter: favs.includes(favId) ? 'none' : 'grayscale(1)', opacity: favs.includes(favId) ? 1 : 0.4 }}
                        title={favs.includes(favId) ? 'Убрать из избранного' : 'В избранное'}>⭐</button>
                    </div>
                    <div>{m.description}</div>
                  </div>
                }
                full={
                  <div>
                    <div style={{ marginBottom: 6 }}>{m.howItWorks}</div>
                    {m.conditions.length > 0 && (
                      <div>
                        <b style={{ fontSize: 11 }}>Условия:</b>
                        <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: 11 }}>
                          {m.conditions.map((cond, i) => <li key={i} style={{ marginBottom: 2 }}>{cond}</li>)}
                        </ul>
                      </div>
                    )}
                    {m.equipment && m.equipment.length > 0 && (
                      <div style={{ marginTop: 6, fontSize: 11, color: '#fff' }}>Снаряжение: {m.equipment.join(', ')}</div>
                    )}
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', marginBottom: 4 }}>📅 Раскладка тренировок</div>
                      <SSCycleLayoutView cycle={c} />
                    </div>
                    <button className="lib-apply" onClick={() => sendCycle('ss_cycle', m.id, m.title)} style={{
                      width: '100%', marginTop: 8, padding: 12, borderRadius: 12, border: 'none', cursor: 'pointer',
                      background: 'var(--accent)', color: '#000', fontWeight: 800, fontSize: 13, minHeight: 48,
                    }}>🏋️ Собрать в ТА/стронг-конструкторе →</button>
                  </div>
                }
              />
            );
          })}
        </div>
      ))}
      {(cat === 'all' || cat === 'strength' || cat === 'bodybuilding') && grouped.map(([fk, cycles]) => (
        <div key={fk} className="lib-group">
          <div style={{ fontSize: 10, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.3, margin: '6px 0 2px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>{FOCUS_LABELS[fk] || fk}</span>
            <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '1px 7px', color: '#fff' }}>{cycles.length}</span>
          </div>
          {cycles.map(c => {
            const m = c.meta;
            const chips = [m.level, `${m.weeks} нед`, `${m.sessionsPerWeek} дн/нед`, PERIOD_LABELS[m.period] || m.period, FOCUS_LABELS[focusKeyOf(c, cat)] || focusKeyOf(c, cat)];
            return (
              <ExpandableCard
                key={m.id}
                title={m.title}
                icon=""
                accent="#00e68a"
                short={
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {chips.map((ch, i) => (
                          <span key={i} style={{ fontSize: 11, fontWeight: 600, color: '#fff', background: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: '2px 7px' }}>{ch}</span>
                        ))}
                      </div>
                      <button aria-label={favs.includes(m.id) ? `Убрать из избранного ${m.title}` : `В избранное ${m.title}`}
                        data-fav={favs.includes(m.id) ? 'true' : 'false'}
                        onClick={e => { e.stopPropagation(); toggleFav(m.id); }}
                        style={{ minWidth: 40, minHeight: 40, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 15, flexShrink: 0, filter: favs.includes(m.id) ? 'none' : 'grayscale(1)', opacity: favs.includes(m.id) ? 1 : 0.4 }}
                        title={favs.includes(m.id) ? 'Убрать из избранного' : 'В избранное'}>⭐</button>
                    </div>
                    <div>{m.description}</div>
                  </div>
                }
                full={
                  <div>
                    <div style={{ marginBottom: 6 }}>{m.howItWorks}</div>
                    {m.conditions.length > 0 && (
                      <div>
                        <b style={{ fontSize: 11 }}>Условия:</b>
                        <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: 11 }}>
                          {m.conditions.map((cond, i) => <li key={i} style={{ marginBottom: 2 }}>{cond}</li>)}
                        </ul>
                      </div>
                    )}
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', marginBottom: 4 }}>📅 Раскладка тренировок</div>
                      <CycleLayoutView cycle={c} />
                    </div>
                  </div>
                }
              />
            );
          })}
        </div>
      ))}
    </div>
  );
};
