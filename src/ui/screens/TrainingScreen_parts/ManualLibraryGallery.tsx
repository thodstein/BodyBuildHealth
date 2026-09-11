/**
 * ManualLibraryGallery.tsx — галерея библиотеки для ручного конструктора.
 * Объединяет FullProgram (complete-library + women + custom + originals), LMS-циклы,
 * именные арм-циклы (ARM_CYCLE_LIBRARY, 19), ТА/стронг-циклы (SS_CYCLES, 15)
 * и кардио-циклы (CARDIO_CYCLES, 35).
 * Фильтры: поиск / уровень / цель / дни/нед / избранное.
 * Превью недели-1, сравнение 2 программ, 1-клик «Взять за основу».
 * Арм/SS-циклы уходят в свои конструкторы через planner-bridge
 * (kind arm_cycle/ss_cycle + событие planning-track-open) — как в CycleCatalog.
 * Кардио-циклы — через свой мост cardio-cycle-bridge (трек cardio).
 */
import React, { useMemo, useState } from 'react';
import type { FullProgram } from '../../../engines/complete-program-library.engine';
import type { SRCycleTemplate } from '../../../data/lms-cycles/lms-types';
import { ARM_CYCLE_LIBRARY, type ArmCycleTemplate } from '../../../engines/arm/arm-cycle-library.engine';
import { SS_CYCLES } from '../../../data/ss-cycles/ss-cycle-index';
import type { SSCycleTemplate } from '../../../data/ss-cycles/ss-types';
import { CARDIO_CYCLES } from '../../../data/cardio-cycles/cardio-cycle-index';
import type { CardioCycleTemplate } from '../../../data/cardio-cycles/cardio-cycle-types';
import { requestCardioTemplateBuild } from '../../../engines/lms/cardio-cycle-bridge';
import { applyToPlanner } from './planner-bridge';
import { ManualHeader, SectionCard, Badge, InfoBanner, BTN, BTN_GHOST, CARD } from './ManualUI';
import { periodLabelRu } from '../../../data/lms-cycles/period-labels';
import { ACCENT, DIM } from './training-ui';
import { loadTrainingProfile } from './training-profile';
import { MANUAL_STORAGE_KEYS } from '../../../engines/manual-constructor/manual-storage';

type Tab = 'bb' | 'pl' | 'arm' | 'ss' | 'cardio';

interface Props {
  bbPrograms: FullProgram[];
  plCycles: SRCycleTemplate[];
  armCycles?: ArmCycleTemplate[];
  ssCycles?: SSCycleTemplate[];
  cardioCycles?: CardioCycleTemplate[];
  onSelectBB: (p: FullProgram) => void;
  onSelectPL: (cycleId: string) => void;
  onClose?: () => void;
}

export const ARM_DISC_LABELS_MANUAL: Record<string, string> = { armwrestling: 'Армрестлинг', armlifting: 'Армлифтинг', hybrid: 'Гибрид', any: 'Любая' };
export const SS_MODE_LABELS_MANUAL: Record<string, string> = { weightlifting: 'Тяжёлая атлетика', strongman: 'Стронг', hybrid: 'Гибрид' };
export const CARDIO_SPORT_LABELS_MANUAL: Record<string, string> = { run: 'Бег', row: 'Гребля', bike: 'Вело', mixed: 'Смешанные', hiit: 'HIIT' };

const LEVEL_OPTS = [
  { id: 'all', label: 'Все уровни' },
  { id: 'beginner', label: 'Новичок' },
  { id: 'intermediate', label: 'Средний' },
  { id: 'advanced', label: 'Опытный' },
];

const GOAL_OPTS_BB: Array<{ id: string; label: string }> = [
  { id: 'all', label: 'Все цели' },
  { id: 'strength', label: 'Сила' },
  { id: 'hypertrophy', label: 'Масса' },
  { id: 'bodybuilding', label: 'Бодибилдинг' },
  { id: 'athletic', label: 'Атлетизм' },
  { id: 'rehab', label: 'Реабилитация' },
];

const DAYS_OPTS = [
  { id: 'all', label: 'Любые дни' },
  { id: '2', label: '2д/нед' },
  { id: '3', label: '3д/нед' },
  { id: '4', label: '4д/нед' },
  { id: '5', label: '5д/нед' },
  { id: '6', label: '6д/нед' },
  { id: '7plus', label: '7+ д/нед' },
];

/**
 * Маппинг фильтра уровней галереи на шкалу LMS-циклов
 * (novice/II-KMS/KMS-MS/MS-MSMK/KMS-MSMK/II-MS/intermediate):
 * без него «Новичок»/«Опытный» давали 0 совпадений и ПЛ-циклы «терялись».
 */
const LMS_LEVEL_MAP: Record<string, string[]> = {
  beginner: ['novice', 'beginner'],
  intermediate: ['intermediate', 'II-KMS'],
  advanced: ['KMS-MS', 'MS-MSMK', 'KMS-MSMK', 'II-MS', 'advanced', 'enhanced'],
};
export function plCycleMatchesLevel(metaLevel: string, filter: string): boolean {
  if (filter === 'all') return true;
  return (LMS_LEVEL_MAP[filter] ?? [filter]).includes(String(metaLevel));
}
/** Уровни арм/SS-шкалы (beginner/intermediate/advanced/enhanced): advanced забирает и enhanced. */
export function proCycleMatchesLevel(levels: string[], filter: string): boolean {
  if (filter === 'all') return true;
  if (filter === 'advanced') return levels.includes('advanced') || levels.includes('enhanced');
  return levels.includes(filter);
}
export function matchesDays(value: number, filter: string): boolean {
  if (filter === 'all') return true;
  if (filter === '7plus') return value >= 7;
  return String(value) === filter;
}

function favKeyBB(id: string) { return `fav_bb_${id}`; }

/** Маппинг цели ББ-фильтра на период ПЛ-цикла (вкладка ПЛ): strength→сила/пик, масса→mass, атлетизм→mixed/endurance. */
export function plCycleMatchesGoal(period: string, goal: string): boolean {
  if (goal === 'all') return true;
  const p = String(period || '').toLowerCase();
  if (goal === 'strength') return p === 'strength' || p === 'peak';
  if (goal === 'hypertrophy' || goal === 'bodybuilding') return p === 'mass';
  if (goal === 'athletic') return p === 'mixed' || p === 'endurance';
  if (goal === 'rehab') return p === 'endurance';
  return true;
}

export const ManualLibraryGallery: React.FC<Props> = ({ bbPrograms, plCycles, armCycles = ARM_CYCLE_LIBRARY, ssCycles = SS_CYCLES, cardioCycles = CARDIO_CYCLES, onSelectBB, onSelectPL }) => {
  const [tab, setTab] = useState<Tab>('bb');
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState('all');
  const [goal, setGoal] = useState('all');
  const [days, setDays] = useState('all');
  const [favOnly, setFavOnly] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // ── Фильтры сворачиваются: за панелью должны быть видны сами шаблоны ──
  const [showFilters, setShowFilters] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [bridgeMsg, setBridgeMsg] = useState('');

  /** Мост «Библиотека → конструктор» (паритет с CycleCatalog.sendCycle). */
  const sendCycle = (kind: 'arm_cycle' | 'ss_cycle', cycleId: string, title: string) => {    try {
      applyToPlanner({ kind, label: title, data: { cycleId } });
      const track = kind === 'arm_cycle' ? 'arm' : 'strength';
      try { localStorage.setItem('he_training_planning_track', track); } catch { /* ignore */ }
      try { window.dispatchEvent(new CustomEvent('planning-track-open', { detail: track })); } catch { /* ignore */ }
      setBridgeMsg(`✅ «${title}» → ${kind === 'arm_cycle' ? 'арм-конструктор' : 'конструктор ТА/стронга'}`);
      setTimeout(() => setBridgeMsg(''), 5000);
    } catch { setBridgeMsg('⚠ Не удалось отправить цикл'); }
  };

  /** Мост «Библиотека → кардио-конструктор»: свой канал (трек cardio). */
  const sendCardioCycle = (cycleId: string, title: string) => {
    try {
      requestCardioTemplateBuild(cycleId);
      try { localStorage.setItem('he_training_planning_track', 'cardio'); } catch { /* ignore */ }
      try { window.dispatchEvent(new CustomEvent('planning-track-open', { detail: 'cardio' })); } catch { /* ignore */ }
      setBridgeMsg(`✅ «${title}» → кардио-конструктор`);
      setTimeout(() => setBridgeMsg(''), 5000);
    } catch { setBridgeMsg('⚠ Не удалось отправить цикл'); }
  };

  const [bbFavs, setBbFavs] = useState<string[]>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(MANUAL_STORAGE_KEYS.PROGRAM_FAV) || '[]');
      return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
    } catch { return []; }
  });
  const [plFavs, setPlFavs] = useState<string[]>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(MANUAL_STORAGE_KEYS.CYCLE_FAV) || '[]');
      return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
    } catch { return []; }
  });

  const toggleBbFav = (id: string) => {
    setBbFavs(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      try { localStorage.setItem(MANUAL_STORAGE_KEYS.PROGRAM_FAV, JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const togglePlFav = (id: string) => {
    setPlFavs(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      try { localStorage.setItem(MANUAL_STORAGE_KEYS.CYCLE_FAV, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const filteredBB = useMemo(() => {
    let arr = bbPrograms;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      arr = arr.filter(p => (p.name + ' ' + p.description + ' ' + p.author + ' ' + p.type).toLowerCase().includes(q));
    }
    if (level !== 'all') arr = arr.filter(p => proCycleMatchesLevel([p.level], level));
    if (goal !== 'all') arr = arr.filter(p => p.goal === goal || (p as any).direction === goal);
    arr = arr.filter(p => matchesDays(p.daysPerWeek, days));
    if (favOnly) arr = arr.filter(p => bbFavs.includes(p.id));
    return arr;
  }, [bbPrograms, search, level, goal, days, favOnly, bbFavs]);

  const filteredPL = useMemo(() => {
    let arr = plCycles as any[];
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      arr = arr.filter((c: any) => (c.meta.title + ' ' + c.meta.id + ' ' + (c.meta.description || '')).toLowerCase().includes(q));
    }
    if (level !== 'all') arr = arr.filter((c: any) => plCycleMatchesLevel(c.meta.level, level));
    arr = arr.filter((c: any) => matchesDays(c.meta.sessionsPerWeek, days));
    if (favOnly) arr = arr.filter((c: any) => plFavs.includes(c.meta.id));
    if (tab === 'pl' && goal !== 'all') arr = arr.filter((c: any) => plCycleMatchesGoal(c.meta.period, goal));
    return arr as SRCycleTemplate[];
  }, [plCycles, search, level, days, favOnly, plFavs, tab, goal]);

  const filteredArm = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (armCycles as ArmCycleTemplate[]).filter(c => {
      if (favOnly && !plFavs.includes(`arm:${c.id}`)) return false;
      if (!proCycleMatchesLevel([...c.level], level)) return false;
      if (!matchesDays(c.daysPerWeek, days)) return false;
      if (q && !(`${c.name || ''} ${c.note || ''} ${c.rpe || ''}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [armCycles, search, level, days, favOnly, plFavs]);

  const filteredSS = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (ssCycles as SSCycleTemplate[]).filter(c => {
      const m = c.meta;
      if (favOnly && !plFavs.includes(`ss:${m.id}`)) return false;
      if (!proCycleMatchesLevel([...m.level], level)) return false;
      if (!matchesDays(m.sessionsPerWeek, days)) return false;
      if (q && !(`${m.title || ''} ${m.description || ''} ${m.howItWorks || ''}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [ssCycles, search, level, days, favOnly, plFavs]);

  const filteredCardio = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (cardioCycles as CardioCycleTemplate[]).filter(c => {
      const m = c.meta;
      if (favOnly && !plFavs.includes(`cardio:${m.id}`)) return false;
      if (!proCycleMatchesLevel([...m.level], level)) return false;
      if (!matchesDays(m.sessionsPerWeek, days) && !matchesDays(m.sessionsPerWeekMax ?? m.sessionsPerWeek, days)) return false;
      if (q && !(`${m.title || ''} ${m.description || ''} ${m.howItWorks || ''} ${(m.tags || []).join(' ')}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [cardioCycles, search, level, days, favOnly, plFavs]);

  const recommendedBB = useMemo(() => {
    try {
      const prof = loadTrainingProfile() as any;
      const lvl = prof?.level;
      const d = prof?.daysPerWeek;
      const g = prof?.goal;
      const scored = [...bbPrograms].map(p => {
        let s = 0;
        if (lvl && p.level === lvl) s += 10;
        if (d && p.daysPerWeek === d) s += 5; else if (d) s += Math.max(0, 5 - Math.abs(p.daysPerWeek - d) * 2);
        if (g && (p.goal === g || (p as any).direction === g)) s += 3;
        return { p, s };
      });
      scored.sort((a,b)=> b.s - a.s);
      return scored.slice(0,3).map(x=>x.p);
    } catch { return bbPrograms.slice(0,3); }
  }, [bbPrograms]);
  const recommendedBBIds = useMemo(()=> new Set(recommendedBB.map(p=>p.id)), [recommendedBB]);
  const recommendedPL = useMemo(() => {
    try {
      const prof = loadTrainingProfile() as any;
      const lvl = prof?.level;
      const d = prof?.daysPerWeek;
      const arr = [...plCycles] as any[];
      const scored = arr.map(c=>{
        let s=0;
        if(lvl && c.meta.level===lvl) s+=10;
        if(d && c.meta.sessionsPerWeek===d) s+=5; else if(d) s+=Math.max(0,5-Math.abs(c.meta.sessionsPerWeek-d)*2);
        return {c,s};
      });
      scored.sort((a,b)=> b.s-a.s);
      return scored.slice(0,3).map(x=>x.c) as SRCycleTemplate[];
    } catch { return plCycles.slice(0,3); }
  }, [plCycles]);
  const recommendedPLIds = useMemo(()=> new Set((recommendedPL as any[]).map((c:any)=>c.meta.id)), [recommendedPL]);

  const toggleCompare = (id: string) => {
    setCompareIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  const compareBB = compareIds.map(id => filteredBB.find(p => p.id === id) || bbPrograms.find(p => p.id === id)).filter(Boolean) as FullProgram[];
  const comparePL = compareIds.map(id => (plCycles as any[]).find((c: any) => c.meta.id === id)).filter(Boolean) as SRCycleTemplate[];

  return (
    <div className="train-manlib lib-manlib" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <ManualHeader
        title="📚 Библиотека шаблонов"
        subtitle={`${bbPrograms.length} программ · ${plCycles.length} ПЛ-циклов · ${armCycles.length} арм · ${ssCycles.length} ТА/стронг · ${cardioCycles.length} кардио · фильтры + превью + мост в конструкторы`}
        chips={[{ label: `${filteredBB.length + filteredPL.length + filteredArm.length + filteredSS.length + filteredCardio.length} показано`, color: ACCENT }]}
      />
      {bridgeMsg && <div role="status" className="lib-bridge-msg" style={{ fontSize: 12, color: '#fff', background: 'rgba(0,230,138,0.10)', border: '1px solid rgba(0,230,138,0.30)', borderRadius: 10, padding: '8px 10px' }}>{bridgeMsg}</div>}

      {/* Табы */}
      <div className="lib-seg" role="tablist" aria-label="Разделы библиотеки" style={{ display: 'flex', gap: 6 }}>
        {([
          { id: 'bb', label: `💪 ББ (${filteredBB.length})` },
          { id: 'pl', label: `🏆 ПЛ (${filteredPL.length})` },
          { id: 'arm', label: `🦾 Арм (${filteredArm.length})` },
          { id: 'ss', label: `🏋️ ТА·Стронг (${filteredSS.length})` },
          { id: 'cardio', label: `🏃 Кардио (${filteredCardio.length})` },
        ] as const).map(t => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} data-active={tab === t.id ? 'true' : 'false'} aria-pressed={tab === t.id} onClick={() => { setTab(t.id as Tab); setExpandedId(null); }} style={{ flex: 1, padding: '8px 12px', borderRadius: 10, fontSize: 12, fontWeight: tab === t.id ? 800 : 600, cursor: 'pointer', border: tab === t.id ? '2px solid #00e68a' : '1px solid rgba(255,255,255,0.08)', background: tab === t.id ? 'rgba(0,230,138,0.14)' : 'rgba(255,255,255,0.04)', color: tab === t.id ? '#00e68a' : '#fff', minHeight: 44 }}>{t.label}</button>
        ))}
      </div>

      {/* Фильтры (сворачиваются — шаблоны должны быть видны сразу) */}
      {(() => {
        const activeFilters = (search.trim() ? 1 : 0) + (level !== 'all' ? 1 : 0) + (goal !== 'all' ? 1 : 0) + (days !== 'all' ? 1 : 0) + (favOnly ? 1 : 0);
        return (
          <button
            className="lib-filter-toggle"
            aria-expanded={showFilters}
            aria-label={showFilters ? 'Скрыть фильтры' : 'Показать фильтры'}
            onClick={() => setShowFilters(v => !v)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%', padding: '10px 12px', borderRadius: 10, fontSize: 12, fontWeight: 800, cursor: 'pointer', minHeight: 44, border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.04)', color: '#fff' }}
          >
            <span>{showFilters ? '▾' : '▸'} 🎛 Фильтры{activeFilters > 0 ? ` · ${activeFilters} акт.` : ''}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#00e68a' }}>{filteredBB.length + filteredPL.length + filteredArm.length + filteredSS.length + filteredCardio.length} показано</span>
          </button>
        );
      })()}
      <div className="lib-filters" style={{ ...CARD, padding: 10, display: showFilters ? 'flex' : 'none', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <input
            className="lib-search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Поиск по названию/автору..."
            style={{ flex: '1 1 160px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '8px 10px', color: '#fff', fontSize: 12, minHeight: 38 }}
          />
          <select value={level} onChange={e => setLevel(e.target.value)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '8px 10px', color: '#fff', fontSize: 12, minHeight: 38 }}>
            {LEVEL_OPTS.map(o => <option key={o.id} value={o.id} style={{ background: '#18181b' }}>{o.label}</option>)}
          </select>
          <select value={goal} onChange={e => setGoal(e.target.value)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '8px 10px', color: '#fff', fontSize: 12, minHeight: 38 }}>
            {GOAL_OPTS_BB.map(o => <option key={o.id} value={o.id} style={{ background: '#18181b' }}>{o.label}</option>)}
          </select>
          <select value={days} onChange={e => setDays(e.target.value)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '8px 10px', color: '#fff', fontSize: 12, minHeight: 38 }}>
            {DAYS_OPTS.map(o => <option key={o.id} value={o.id} style={{ background: '#18181b' }}>{o.label}</option>)}
          </select>
          <button onClick={() => setFavOnly(v => !v)} style={{ padding: '8px 12px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: favOnly ? '2px solid #f59e0b' : '1px solid rgba(255,255,255,0.12)', background: favOnly ? 'rgba(245,158,11,0.14)' : 'rgba(255,255,255,0.04)', color: favOnly ? '#f59e0b' : '#fff', minHeight: 38 }}>⭐ {favOnly ? 'Избранное' : 'Все'}</button>
        </div>
        {(search || level !== 'all' || goal !== 'all' || days !== 'all' || favOnly) && (
          <button onClick={() => { setSearch(''); setLevel('all'); setGoal('all'); setDays('all'); setFavOnly(false); }} style={{ alignSelf: 'flex-start', padding: '4px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: DIM }}>✕ Сбросить фильтры</button>
        )}
        {compareIds.length > 0 && (
          <InfoBanner tone="info">Сравнение: {compareIds.length}/2 выбрано {compareIds.length === 2 && '— см. карточку ниже'} <button onClick={() => setCompareIds([])} style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 6, fontSize: 10, cursor: 'pointer', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: '#fff' }}>Очистить</button></InfoBanner>
        )}
      </div>

      {/* Рекомендовано для вас — интеллигентный подбор */}
      {tab === 'bb' && !search && !favOnly && level === 'all' && goal === 'all' && days === 'all' && recommendedBB.length > 0 && (
        <div className="lib-rec"><SectionCard title="⭐ Рекомендовано для вас" hint="На основе профиля (уровень/дни/цель) — интеллигентный подбор" accent>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
            {recommendedBB.map(p => (
              <div key={p.id} style={{ padding: 8, borderRadius: 10, background: 'linear-gradient(135deg, rgba(0,230,138,0.10), rgba(96,165,250,0.06))', border: '1px solid rgba(0,230,138,0.25)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>{p.name}</div>
                <div style={{ fontSize: 10, color: DIM }}>{p.level} · {p.daysPerWeek}д/нед · {p.durationWeeks} нед · {p.goal}</div>
                <div style={{ fontSize: 10, color: '#00e68a', fontWeight: 700 }}>★ Подходит вашему профилю</div>
                <button onClick={() => onSelectBB(p)} style={{ ...BTN, minHeight: 36, fontSize: 11, background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#06281c', fontWeight: 800, marginTop: 4 }}>📥 Взять рекомендовано</button>
              </div>
            ))}
          </div>
        </SectionCard></div>
      )}
      {tab === 'pl' && !search && !favOnly && level === 'all' && days === 'all' && (recommendedPL as any[]).length > 0 && (
        <div className="lib-rec"><SectionCard title="⭐ Рекомендовано для вас" hint="ПЛ-циклы под ваш уровень и частоту" accent>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
            {(recommendedPL as any[]).map((c: any) => (
              <div key={c.meta.id} style={{ padding: 8, borderRadius: 10, background: 'linear-gradient(135deg, rgba(167,139,250,0.10), rgba(59,130,246,0.06))', border: '1px solid rgba(167,139,250,0.25)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>{c.meta.title}</div>
                <div style={{ fontSize: 10, color: DIM }}>{c.meta.level} · {c.meta.sessionsPerWeek}д/нед · {c.meta.weeks} нед · {periodLabelRu(c.meta.period)}</div>
                <button onClick={() => onSelectPL(c.meta.id)} style={{ ...BTN, minHeight: 36, fontSize: 11, background: 'linear-gradient(135deg,#a78bfa,#7c3aed)', color: '#fff', fontWeight: 800, marginTop: 4 }}>📥 Подключить</button>
              </div>
            ))}
          </div>
        </SectionCard></div>
      )}

      {/* Сравнение */}
      {compareIds.length === 2 && tab === 'bb' && compareBB.length === 2 && (
        <div className="lib-compare"><SectionCard title="⇄ Сравнение программ" accent>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {compareBB.map(p => (
              <div key={p.id} style={{ padding: 8, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>{p.name}</div>
                <div style={{ fontSize: 10, color: DIM }}>{p.level} · {p.daysPerWeek}д/нед × {p.durationWeeks} нед</div>
                <div style={{ fontSize: 10, color: DIM, marginTop: 4 }}>{p.weeks[0]?.days.map(d => d.name).join(' · ')}</div>
                <div style={{ fontSize: 10, color: '#00e68a', marginTop: 4 }}>{p.weeks[0]?.days.reduce((s, d) => s + d.exercises.length, 0)} упр. в нед-1</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: DIM, marginTop: 6 }}>{compareBB[0].daysPerWeek === compareBB[1].daysPerWeek ? 'Одинаковая частота' : `Разная частота: ${compareBB[0].daysPerWeek} vs ${compareBB[1].daysPerWeek} д/нед`} · {compareBB[0].level === compareBB[1].level ? 'Один уровень' : 'Разные уровни'}</div>
        </SectionCard></div>
      )}
      {compareIds.length === 2 && tab === 'pl' && comparePL.length === 2 && (
        <div className="lib-compare"><SectionCard title="⇄ Сравнение ПЛ-циклов" accent>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {comparePL.map((c: any) => (
              <div key={c.meta.id} style={{ padding: 8, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>{c.meta.title}</div>
                <div style={{ fontSize: 10, color: DIM }}>{c.meta.level} · {c.meta.sessionsPerWeek}д/нед × {c.meta.weeks} нед</div>
                <div style={{ fontSize: 10, color: '#a78bfa', marginTop: 4 }}>{periodLabelRu(c.meta.period)}</div>
              </div>
            ))}
          </div>
        </SectionCard></div>
      )}

      {/* Список ББ */}
      {tab === 'bb' && (
        <div className="lib-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8, maxHeight: '52vh', overflowY: 'auto', paddingRight: 2 }}>
          {filteredBB.map(p => {
            const isFav = bbFavs.includes(p.id);
            const isExpanded = expandedId === p.id;
            const isCompared = compareIds.includes(p.id);
            return (
              <div key={p.id} className="lib-card" style={{ padding: 10, borderRadius: 12, background: isCompared ? 'rgba(0,230,138,0.06)' : 'rgba(255,255,255,0.04)', border: isCompared ? '2px solid #00e68a' : isExpanded ? '1px solid rgba(0,230,138,0.35)' : '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', flex: 1, lineHeight: 1.2 }}>{p.name}</span>
                  <button className="lib-icon" onClick={() => toggleBbFav(p.id)} title={isFav ? 'Убрать из избранного' : 'В избранное'} style={{ padding: '4px 6px', borderRadius: 6, fontSize: 12, cursor: 'pointer', background: isFav ? 'rgba(245,158,11,0.18)' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: isFav ? '#f59e0b' : '#fff' }}>{isFav ? '★' : '☆'}</button>
                  <button className="lib-icon" onClick={() => toggleCompare(p.id)} title="Сравнить" style={{ padding: '4px 8px', borderRadius: 6, fontSize: 10, cursor: 'pointer', background: isCompared ? 'rgba(0,230,138,0.18)' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: isCompared ? '#00e68a' : '#fff' }}>{isCompared ? '✓' : '⇄'}</button>
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <Badge color={p.level === 'beginner' ? '#22c55e' : p.level === 'advanced' ? '#f59e0b' : '#60a5fa'} bg="rgba(255,255,255,0.04)" border="rgba(255,255,255,0.08)">{p.level}</Badge>
                  <Badge>{p.daysPerWeek}д/нед</Badge>
                  <Badge>{p.durationWeeks} нед</Badge>
                  <Badge color="#fff">{p.goal}</Badge>
                  {recommendedBBIds.has(p.id) && <Badge color="#00e68a" bg="rgba(0,230,138,0.12)" border="rgba(0,230,138,0.30)">★ Рекомендовано</Badge>}
                </div>
                <div style={{ fontSize: 10, color: DIM, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2 as any, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }}>{p.description}</div>
                {p.weeks[0] && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>Нед-1: {p.weeks[0].days.map(d => d.name).join(' · ')} · {p.weeks[0].days.reduce((s, d) => s + d.exercises.length, 0)} упр.</div>}
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <button onClick={() => setExpandedId(isExpanded ? null : p.id)} style={{ ...BTN_GHOST, flex: 1, minHeight: 36, fontSize: 11 }}>{isExpanded ? 'Свернуть' : 'Превью'}</button>
                  <button onClick={() => onSelectBB(p)} style={{ ...BTN, flex: 1, minHeight: 36, fontSize: 11, background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#06281c', fontWeight: 800 }}>📥 Взять за основу</button>
                </div>
                {isExpanded && p.weeks[0] && (
                  <div className="lib-preview" style={{ marginTop: 6, padding: 8, borderRadius: 8, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.15)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {p.weeks[0].days.map((d, di) => (
                      <div key={di} style={{ fontSize: 10, color: '#fff' }}><b style={{ color: '#00e68a' }}>{d.name}</b> · {d.focus} — {d.exercises.slice(0, 3).map(e => e.name).join(', ')}{d.exercises.length > 3 ? ` +${d.exercises.length - 3}` : ''}</div>
                    ))}
                    <div style={{ fontSize: 10, color: DIM }}>{p.equipmentNeeded.join(' · ')}</div>
                  </div>
                )}
              </div>
            );
          })}
          {filteredBB.length === 0 && <div style={{ gridColumn: '1/-1', padding: 16, textAlign: 'center', color: DIM, fontSize: 12 }}>Ничего не найдено — сбросьте фильтры</div>}
        </div>
      )}

      {/* Список ПЛ */}
      {tab === 'pl' && (
        <div className="lib-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8, maxHeight: '52vh', overflowY: 'auto', paddingRight: 2 }}>
          {filteredPL.map((c: any) => {
            const isFav = plFavs.includes(c.meta.id);
            const isCompared = compareIds.includes(c.meta.id);
            const isExpanded = expandedId === c.meta.id;
            return (
              <div key={c.meta.id} className="lib-card" style={{ padding: 10, borderRadius: 12, background: isCompared ? 'rgba(167,139,250,0.08)' : 'rgba(255,255,255,0.04)', border: isCompared ? '2px solid #a78bfa' : isExpanded ? '1px solid rgba(167,139,250,0.35)' : '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', flex: 1 }}>{c.meta.title}</span>
                  <button className="lib-icon" onClick={() => togglePlFav(c.meta.id)} style={{ padding: '4px 6px', borderRadius: 6, fontSize: 12, cursor: 'pointer', background: isFav ? 'rgba(245,158,11,0.18)' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: isFav ? '#f59e0b' : '#fff' }}>{isFav ? '★' : '☆'}</button>
                  <button className="lib-icon" onClick={() => toggleCompare(c.meta.id)} style={{ padding: '4px 8px', borderRadius: 6, fontSize: 10, cursor: 'pointer', background: isCompared ? 'rgba(167,139,250,0.18)' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: isCompared ? '#a78bfa' : '#fff' }}>{isCompared ? '✓' : '⇄'}</button>
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <Badge color="#a78bfa">{c.meta.level}</Badge>
                  <Badge>{c.meta.sessionsPerWeek}д/нед</Badge>
                  <Badge>{c.meta.weeks} нед</Badge>
                  <Badge color="#fff">{periodLabelRu(c.meta.period)}</Badge>
                  {recommendedPLIds.has(c.meta.id) && <Badge color="#00e68a" bg="rgba(0,230,138,0.12)" border="rgba(0,230,138,0.30)">★ Рекомендовано</Badge>}
                </div>
                <div style={{ fontSize: 10, color: DIM }}>{c.meta.description?.slice(0, 110) ?? 'Профессиональный СРЦ-цикл — процентовки immutable'}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <button onClick={() => setExpandedId(isExpanded ? null : c.meta.id)} style={{ ...BTN_GHOST, flex: 1, minHeight: 36, fontSize: 11, borderColor: 'rgba(167,139,250,0.25)', color: '#a78bfa' }}>{isExpanded ? 'Свернуть' : 'Превью'}</button>
                  <button onClick={() => onSelectPL(c.meta.id)} style={{ ...BTN, flex: 1, minHeight: 36, fontSize: 11, background: 'linear-gradient(135deg,#a78bfa,#7c3aed)', color: '#fff', fontWeight: 800 }}>📥 Подключить цикл</button>
                </div>
                {isExpanded && (
                  <div className="lib-preview" style={{ marginTop: 6, padding: 8, borderRadius: 8, background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.15)', fontSize: 10, color: '#fff', lineHeight: 1.4 }}>
                    <div>ID: {c.meta.id}</div>
                    <div>Период: {c.meta.period} · {periodLabelRu(c.meta.period)}</div>
                    {c.weeks?.[0] && <div style={{ marginTop: 4 }}>Нед-1: {(c.weeks[0] as any).days?.map((d: any) => d.name || d.lift).join(' · ') || '—'}</div>}
                  </div>
                )}
              </div>
            );
          })}
          {filteredPL.length === 0 && <div style={{ gridColumn: '1/-1', padding: 16, textAlign: 'center', color: DIM, fontSize: 12 }}>Ничего не найдено</div>}
        </div>
      )}

      {/* Список Арм (именные циклы → мост в арм-конструктор) */}
      {tab === 'arm' && (
        <div className="lib-grid lib-arm-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8, maxHeight: '52vh', overflowY: 'auto', paddingRight: 2 }}>
          {filteredArm.map(c => {
            const favId = `arm:${c.id}`;
            const isFav = plFavs.includes(favId);
            const isExpanded = expandedId === c.id;
            return (
              <div key={c.id} className="lib-card lib-arm-card" data-fav={isFav ? 'true' : 'false'} style={{ padding: 10, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: isExpanded ? '1px solid rgba(0,230,138,0.35)' : '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', flex: 1, lineHeight: 1.2 }}>{c.name}</span>
                  <button className="lib-icon" aria-label={isFav ? `Убрать из избранного ${c.name}` : `В избранное ${c.name}`} data-fav={isFav ? 'true' : 'false'} onClick={() => togglePlFav(favId)} title={isFav ? 'Убрать из избранного' : 'В избранное'} style={{ padding: '4px 6px', borderRadius: 6, fontSize: 12, cursor: 'pointer', background: isFav ? 'rgba(245,158,11,0.18)' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: isFav ? '#f59e0b' : '#fff', minWidth: 44, minHeight: 44 }}>{isFav ? '★' : '☆'}</button>
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <Badge color="#00e68a">{ARM_DISC_LABELS_MANUAL[c.discipline] || c.discipline}</Badge>
                  <Badge>{c.weeks} нед</Badge>
                  <Badge>{c.daysPerWeek} дн/нед</Badge>
                  <Badge color="#fff">{c.rpe}</Badge>
                  {c.tablePerWeek > 0 && <Badge color="#f59e0b">🦾 стол {c.tablePerWeek}×/нед</Badge>}
                </div>
                <div style={{ fontSize: 10, color: DIM, lineHeight: 1.4 }}>{c.note?.slice(0, 140)}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <button onClick={() => setExpandedId(isExpanded ? null : c.id)} style={{ ...BTN_GHOST, flex: 1, minHeight: 44, fontSize: 11 }}>{isExpanded ? 'Свернуть' : 'Превью'}</button>
                  <button className="lib-apply" onClick={() => sendCycle('arm_cycle', c.id, c.name)} style={{ ...BTN, flex: 1, minHeight: 44, fontSize: 11, background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#06281c', fontWeight: 800 }}>💪 Собрать в конструкторе →</button>
                </div>
                {isExpanded && (
                  <div className="lib-preview" style={{ marginTop: 6, padding: 8, borderRadius: 8, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.15)', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 10, color: '#fff', lineHeight: 1.4 }}>
                    <div>{c.note}</div>
                    <div style={{ color: DIM }}>Уровень: {c.level.join(', ')} · Тейпер: {c.taperPreset} · Прогрессия: {c.correctionPctDefault}%/нед</div>
                    <div style={{ color: DIM }}>Делод: {c.deloadRule}</div>
                  </div>
                )}
              </div>
            );
          })}
          {filteredArm.length === 0 && <div style={{ gridColumn: '1/-1', padding: 16, textAlign: 'center', color: DIM, fontSize: 12 }}>Ничего не найдено — сбросьте фильтры</div>}
        </div>
      )}

      {/* Список ТА/Стронг (интернет-циклы → мост в стронг-конструктор) */}
      {tab === 'ss' && (
        <div className="lib-grid lib-ss-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8, maxHeight: '52vh', overflowY: 'auto', paddingRight: 2 }}>
          {filteredSS.map(c => {
            const m = c.meta;
            const favId = `ss:${m.id}`;
            const isFav = plFavs.includes(favId);
            const isExpanded = expandedId === m.id;
            return (
              <div key={m.id} className="lib-card lib-ss-card" data-fav={isFav ? 'true' : 'false'} style={{ padding: 10, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: isExpanded ? '1px solid rgba(56,189,248,0.35)' : '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', flex: 1, lineHeight: 1.2 }}>{m.title}</span>
                  <button className="lib-icon" aria-label={isFav ? `Убрать из избранного ${m.title}` : `В избранное ${m.title}`} data-fav={isFav ? 'true' : 'false'} onClick={() => togglePlFav(favId)} title={isFav ? 'Убрать из избранного' : 'В избранное'} style={{ padding: '4px 6px', borderRadius: 6, fontSize: 12, cursor: 'pointer', background: isFav ? 'rgba(245,158,11,0.18)' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: isFav ? '#f59e0b' : '#fff', minWidth: 44, minHeight: 44 }}>{isFav ? '★' : '☆'}</button>
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <Badge color="#38bdf8">{SS_MODE_LABELS_MANUAL[m.mode] || m.mode}</Badge>
                  <Badge>{m.weeks} нед</Badge>
                  <Badge>{m.sessionsPerWeek} дн/нед</Badge>
                  <Badge color="#fff">{m.period}</Badge>
                  {m.needsSpecialty && <Badge color="#f59e0b">🎪 Спец-снаряды</Badge>}
                </div>
                <div style={{ fontSize: 10, color: DIM, lineHeight: 1.4 }}>{m.description?.slice(0, 140)}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <button onClick={() => setExpandedId(isExpanded ? null : m.id)} style={{ ...BTN_GHOST, flex: 1, minHeight: 44, fontSize: 11, borderColor: 'rgba(56,189,248,0.25)', color: '#38bdf8' }}>{isExpanded ? 'Свернуть' : 'Превью'}</button>
                  <button className="lib-apply" onClick={() => sendCycle('ss_cycle', m.id, m.title)} style={{ ...BTN, flex: 1, minHeight: 44, fontSize: 11, background: 'linear-gradient(135deg,#38bdf8,#2563eb)', color: '#fff', fontWeight: 800 }}>🏋️ Собрать в конструкторе →</button>
                </div>
                {isExpanded && (
                  <div className="lib-preview" style={{ marginTop: 6, padding: 8, borderRadius: 8, background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 10, color: '#fff', lineHeight: 1.4 }}>
                    <div>{m.howItWorks}</div>
                    {m.equipment?.length > 0 && <div style={{ color: DIM }}>Снаряжение: {m.equipment.join(', ')}</div>}
                    <div style={{ color: DIM }}>Уровень: {m.level.join('/')} · Нед-1: {(c.week1 || []).map(d => d.tag).join(' · ') || '—'}</div>
                  </div>
                )}
              </div>
            );
          })}
          {filteredSS.length === 0 && <div style={{ gridColumn: '1/-1', padding: 16, textAlign: 'center', color: DIM, fontSize: 12 }}>Ничего не найдено — сбросьте фильтры</div>}
        </div>
      )}

      {/* Список Кардио (именные циклы → мост в кардио-конструктор) */}
      {tab === 'cardio' && (
        <div className="lib-grid lib-cardio-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8, maxHeight: '52vh', overflowY: 'auto', paddingRight: 2 }}>
          {filteredCardio.map(c => {
            const m = c.meta;
            const favId = `cardio:${m.id}`;
            const isFav = plFavs.includes(favId);
            const isExpanded = expandedId === m.id;
            const days = m.sessionsPerWeekMax && m.sessionsPerWeekMax !== m.sessionsPerWeek
              ? `${m.sessionsPerWeek}–${m.sessionsPerWeekMax} дн/нед` : `${m.sessionsPerWeek} дн/нед`;
            return (
              <div key={m.id} className="lib-card lib-cardio-card" data-fav={isFav ? 'true' : 'false'} style={{ padding: 10, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: isExpanded ? '1px solid rgba(6,182,214,0.35)' : '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', flex: 1, lineHeight: 1.2 }}>{m.title}</span>
                  <button className="lib-icon" aria-label={isFav ? `Убрать из избранного ${m.title}` : `В избранное ${m.title}`} data-fav={isFav ? 'true' : 'false'} onClick={() => togglePlFav(favId)} title={isFav ? 'Убрать из избранного' : 'В избранное'} style={{ padding: '4px 6px', borderRadius: 6, fontSize: 12, cursor: 'pointer', background: isFav ? 'rgba(245,158,11,0.18)' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: isFav ? '#f59e0b' : '#fff', minWidth: 44, minHeight: 44 }}>{isFav ? '★' : '☆'}</button>
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <Badge color="#06b6d4">{CARDIO_SPORT_LABELS_MANUAL[m.sport] || m.sport}</Badge>
                  <Badge>{m.weeks} нед</Badge>
                  <Badge>{days}</Badge>
                  {m.lowImpact && <Badge color="#22c55e">🦵 щадящий</Badge>}
                </div>
                <div style={{ fontSize: 10, color: DIM, lineHeight: 1.4 }}>{m.description?.slice(0, 140)}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <button onClick={() => setExpandedId(isExpanded ? null : m.id)} style={{ ...BTN_GHOST, flex: 1, minHeight: 44, fontSize: 11, borderColor: 'rgba(6,182,214,0.25)', color: '#06b6d4' }}>{isExpanded ? 'Свернуть' : 'Превью'}</button>
                  <button className="lib-apply" onClick={() => sendCardioCycle(m.id, m.title)} style={{ ...BTN, flex: 1, minHeight: 44, fontSize: 11, background: 'linear-gradient(135deg,#06b6d4,#2563eb)', color: '#fff', fontWeight: 800 }}>🏃 Собрать в конструкторе →</button>
                </div>
                {isExpanded && (
                  <div className="lib-preview" style={{ marginTop: 6, padding: 8, borderRadius: 8, background: 'rgba(6,182,214,0.06)', border: '1px solid rgba(6,182,214,0.15)', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 10, color: '#fff', lineHeight: 1.4 }}>
                    <div>{m.howItWorks}</div>
                    <div style={{ color: DIM }}>Уровень: {m.level.join('/')} · Источник: {m.sourceLabel}</div>
                  </div>
                )}
              </div>
            );
          })}
          {filteredCardio.length === 0 && <div style={{ gridColumn: '1/-1', padding: 16, textAlign: 'center', color: DIM, fontSize: 12 }}>Ничего не найдено — сбросьте фильтры</div>}
        </div>
      )}
      {/* Запас прокрутки: последнюю карточку не должна съедать нижняя навигация */}
      <div className="lib-bottom-space" aria-hidden="true" style={{ height: 72, flexShrink: 0 }} />
    </div>
  );
};
