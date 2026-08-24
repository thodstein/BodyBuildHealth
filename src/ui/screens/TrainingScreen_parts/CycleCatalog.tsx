/** CycleCatalog.tsx — структурированный каталог тренировочных циклов (Библиотека › Каталог циклов).
 * Разделение на Силовые / Бодибилдинг / Все, подфильтры (специализация/направление,
 * уровень, период, длительность, частота, автор), поиск, группировка по фокусу с
 * метаданными-чипами и блок «Рекомендуемые для меня» (через существующий rankCycles).
 * Новая модель данных НЕ требуется — все оси уже в SRCycleMeta. */
import React from 'react';
import { LMS_CYCLES, normalizeCycleDirection } from '../../../data/lms-cycles/lms-cycle-index';
import type { SRCycleTemplate } from '../../../data/lms-cycles/lms-types';
import { rankCycles } from '../../../engines/lms/lms-selector.engine';
import { ExpandableCard } from '../SRCBBScreen_parts/TrainingPopups';

type CatFilter = 'all' | 'strength' | 'bodybuilding';
type UserGoal = 'strength' | 'mass' | 'endurance' | 'peak' | 'mixed';
type UserLevel = 'novice' | 'II-KMS' | 'KMS-MS' | 'MS-MSMK' | 'II-MS' | 'intermediate';

interface Props {
  goal: string;
  level: string;
  daysPerНеделя: number;
  linked?: unknown;
}

// ── Читаемые подписи фокуса (direction ∪ targetFocus) ──
const FOCUS_LABELS: Record<string, string> = {
  powerlifting: 'Троеборье', bench: 'Жим', deadlift_bench: 'Тяга+Жим', armwrestling: 'Армрестлинг',
  bodybuilding: 'Бодибилдинг', weightlifting: 'Тяжёлая атлетика',
  push: 'Грудь / Жим', pull: 'Спина / Тяга', legs: 'Ноги', upper: 'Верх тела', lower: 'Низ тела',
  fullbody: 'Всё тело', arms: 'Руки', shoulders: 'Плечи', back: 'Спина', chest: 'Грудь',
  mixed: 'Смешанный', specialization: 'Спец-блок', contest: 'Контест-подготовка',
};

// ── Нормализация цели/уровня профиля под union движка rankCycles ──
function normalizeGoal(g: string): UserGoal {
  const s = (g || '').toLowerCase();
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

function weeksBucket(w: number): string {
  if (w <= 8) return 'w8';
  if (w <= 12) return 'w12';
  return 'w13';
}
const WEEKS_LABELS: Record<string, string> = { w8: '≤ 8 нед', w12: '9–12 нед', w13: '13+ нед' };
const PERIOD_LABELS: Record<string, string> = { strength: 'Сила', peak: 'Выход на пик', mass: 'Масса', endurance: 'Выносливость', mixed: 'Смешанный' };

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

// ── Чип-кнопка — красиво, без бега
function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '7px 12px', borderRadius: 12, fontSize: 11, fontWeight: 700, cursor: 'pointer',
      whiteSpace: 'normal', wordBreak: 'break-word', transition: 'all 0.2s',
      background: active ? 'linear-gradient(135deg, var(--accent), #00c853)' : 'rgba(255,255,255,0.04)',
      color: active ? '#000' : '#fff', border: active ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)',
      boxShadow: active ? '0 2px 8px rgba(0,230,138,0.25)' : 'none',
    }}>{label}</button>
  );
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
  const [favs, setFavs] = React.useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('he_cycle_fav') || '[]'); } catch { return []; }
  });
  const [favOnly, setFavOnly] = React.useState(false);
  React.useEffect(() => {
    try { localStorage.setItem('he_cycle_fav', JSON.stringify(favs)); } catch { /* ignore */ }
  }, [favs]);
  const toggleFav = (id: string) => setFavs(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const favCycles = React.useMemo(() => LMS_CYCLES.filter(c => favs.includes(c.meta.id)), [favs]);

  const base = React.useMemo(() => {
    if (cat === 'all') return LMS_CYCLES;
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
      if (q && !(`${m.title} ${m.description} ${m.howItWorks}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [base, focus, levelF, period, weeks, freq, author, search, favOnly, favs]);

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

  const availableFocus = React.useMemo(() => uniqKeys(base, cat), [base, cat]);
  const availableAuthors = React.useMemo(() => AUTHORS.filter(a => base.some(c => (c.meta.tags || []).includes(a))), [base]);

  const recommendations = React.useMemo(() => {
    const ranked = rankCycles({
      goal: normalizeGoal(p.goal),
      level: normalizeLevel(p.level),
      daysPerНеделя: p.daysPerWeek,
      direction: cat === 'strength' ? 'powerlifting' : cat === 'bodybuilding' ? 'bodybuilding' : undefined,
    });
    return ranked.filter(r => r.score > 0).slice(0, 5);
  }, [p.goal, p.level, p.daysPerWeek, cat]);

  const resetFilters = () => {
    setFocus('all'); setLevelF('all'); setPeriod('all'); setWeeks('all'); setFreq('all'); setAuthor('all'); setSearch('');
  };

  const focusLabel = cat === 'strength' ? 'Направление' : cat === 'bodybuilding' ? 'Специализация' : 'Специализация / направление';

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ background:'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(0,230,138,0.08))', border:'1px solid rgba(245,158,11,0.18)', borderRadius:14, padding:'12px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}><span style={{ width:32, height:32, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(245,158,11,0.15)', border:'1px solid rgba(245,158,11,0.25)', fontSize:16 }}>📖</span><div><div style={{ fontSize:13, fontWeight:800, color:'#fff' }}>Каталог циклов</div><div style={{ fontSize:10, color:'#fff', opacity:0.9 }}>Готовые циклы ПЛ и ББ с фильтрами и раскладкой</div></div></div><span style={{ fontSize:10, padding:'4px 8px', borderRadius:20, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff' }}>каталог</span></div>
      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)', marginBottom: 2 }}>📖 Каталог тренировочных циклов</div>
      <div style={{ fontSize: 11, color: '#fff' }}>Справочник готовых циклов. Выберите тип (силовые / бодибилдинг), уточните специализацию, уровень, период и другие параметры — каталог перестроится автоматически.</div>

      {/* ── Сегмент-контрол: Силовые / Бодибилдинг / Все ── */}
      <div style={{ display: 'flex', gap: 4, padding: '6px', borderRadius: 12, background: 'rgba(24,24,27,0.15)', border: '1px solid rgba(255,255,255,0.04)' }}>
        {([
          { id: 'all' as CatFilter, label: 'Все', icon: '📚' },
          { id: 'strength' as CatFilter, label: 'Силовые', icon: '🏆' },
          { id: 'bodybuilding' as CatFilter, label: 'Бодибилдинг', icon: '💪' },
        ]).map(s => (
          <button key={s.id} onClick={() => { setCat(s.id); setFocus('all'); }} style={{
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
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="🔎 Поиск по названию и описанию…"
        style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 12, fontSize: 12, color: '#fff', background: 'rgba(118,118,128,0.12)', border: '0.5px solid rgba(255,255,255,0.1)', outline: 'none' }}
      />

      {/* ── Подфильтры ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 }}>{focusLabel}</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <Chip label="Все" active={focus === 'all'} onClick={() => setFocus('all')} />
            {availableFocus.map(k => (
              <Chip key={k} label={FOCUS_LABELS[k] || k} active={focus === k} onClick={() => setFocus(focus === k ? 'all' : k)} />
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
          <div style={{ flex: '1 1 160px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 }}>Период</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <Chip label="Все" active={period === 'all'} onClick={() => setPeriod('all')} />
              {PERIODS.map(p2 => (
                <Chip key={p2} label={PERIOD_LABELS[p2]} active={period === p2} onClick={() => setPeriod(period === p2 ? 'all' : p2)} />
              ))}
            </div>
          </div>
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
              {['2', '3', '4', '6'].map(f => (
                <Chip key={f} label={`${f} дн/нед`} active={freq === f} onClick={() => setFreq(freq === f ? 'all' : f)} />
              ))}
            </div>
          </div>
          {availableAuthors.length > 0 && (
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
            <div style={{ fontSize: 11, color: '#fff' }}>Найдено: <b style={{ color: 'var(--accent)' }}>{filtered.length}</b> циклов</div>
            <Chip label={`⭐ Избранное (${favs.length})`} active={favOnly} onClick={() => setFavOnly(v => !v)} />
          </div>
          <button onClick={resetFilters} style={{ padding: '4px 10px', borderRadius: 8, fontSize: 10, fontWeight: 700, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#fff', cursor: 'pointer' }}>↺ Сбросить</button>
        </div>
      </div>

      {/* ⭐ Избранные циклы */}
      {favCycles.length > 0 && (
        <div style={{ background: 'rgba(250,204,21,0.05)', borderRadius: 12, border: '1px solid rgba(250,204,21,0.18)', padding: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#facc15', marginBottom: 6 }}>⭐ Избранные циклы ({favCycles.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {favCycles.map(c => {
              const m = c.meta;
              return (
                <div key={m.id} style={{ background: 'rgba(24,24,27,0.4)', borderRadius: 10, padding: 8, border: '1px solid rgba(250,204,21,0.15)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#facc15', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</div>
                    <button aria-label={`Убрать из избранного ${m.title}`} onClick={() => toggleFav(m.id)} style={{ minWidth: 44, minHeight: 44, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 15 }} title="Убрать из избранного">⭐</button>
                  </div>
                  <div style={{ fontSize: 10, color: '#fff', marginTop: 2 }}>{m.level} · {m.weeks} нед · {m.sessionsPerWeek} дн/нед · {PERIOD_LABELS[m.period] || m.period}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Рекомендуемые для меня ── */}
      <div style={{ background: 'rgba(0,230,138,0.06)', borderRadius: 12, border: '1px solid rgba(0,230,138,0.2)', padding: 10 }}>
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
      {filtered.length === 0 && (
        <div style={{ fontSize: 12, color: '#fff', textAlign: 'center', padding: 20 }}>По выбранным фильтрам циклов не найдено.</div>
      )}
      {grouped.map(([fk, cycles]) => (
        <div key={fk}>
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
