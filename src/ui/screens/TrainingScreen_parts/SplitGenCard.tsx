/** SplitGenCard.tsx — ПРОФЕССИОНАЛЬНЫЙ генератор сплитов.
 *  3 режима: Конструктор (каталог + настройка) | Визуализация (календарь + объём) | Сравнение.
 *  Интегрирован с planner-bridge для отправки в ручной конструктор.
 *  REUSE: split-engines (9 типов), LEVEL_VOLUMES + VOLUME_REFERENCES (MEV/MAV/MRV). */
import React, { useState, useMemo, useCallback } from 'react';
import {
  generateFBWSplit, generateUpperLowerSplit, generatePPLSplit, generatePowerbuildingSplit,
  generateStrongmanSplit, generateWeightliftingSplit, generateCrossFitSplit, generateRehabSplit,
  generateSplit, type SplitGoal, type SplitInput, type SplitOutput, type SessionTemplate,
} from '../../../engines/split-engines';
import { getVolumeLandmarks } from '../../../engines/volume-landmarks.engine';
import { loadTrainingProfile } from './training-profile';
import { applyToPlanner } from './planner-bridge';

// ── Константы ──
const ACCENT = '#00e68a'; const DIM = '#fff'; const BG = 'rgba(24,24,27,0.3)';
const C: React.CSSProperties = { padding: 14, borderRadius: 12, background: BG, border: '1px solid rgba(255,255,255,0.05)', marginBottom: 12 };
const H: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: ACCENT, margin: '0 0 8px' };
const L: React.CSSProperties = { fontSize: 10, color: DIM, margin: '6px 0 3px', fontWeight: 700 };
const S: React.CSSProperties = { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 10px', fontSize: 12, width: '100%', boxSizing: 'border-box' as const };

// ── Типы/маппинги ──
type Mode = 'builder' | 'visual' | 'compare';
const PATTERN_RU: Record<string, string> = {
  squat:'Присед', hinge:'Тяга', horizontal_push:'Жим г.', horizontal_pull:'Тяга г.',
  vertical_push:'Жим в.', vertical_pull:'Тяга в.', lunge:'Выпад', carry:'Носка',
  accessory:'Аксессуар', core:'Кор', rotation:'Ротация', anti_rotation:'Анти-ротация',
};
const PATTERN_TO_GROUP: Record<string, string> = {
  squat:'legs', lunge:'legs', hinge:'legs',
  horizontal_push:'chest', vertical_push:'shoulders',
  horizontal_pull:'back', vertical_pull:'back',
  carry:'core', core:'core', anti_rotation:'core', rotation:'core', accessory:'',
};
const GROUP_RU: Record<string, string> = { chest:'Грудь', back:'Спина', legs:'Ноги', shoulders:'Плечи', arms:'Руки', core:'Кор' };
const GROUP_COLOR: Record<string, string> = { chest:'#ef4444', back:'#3b82f6', legs:'#22c55e', shoulders:'#f59e0b', arms:'#a855f7', core:'#ec4899' };

const SPLIT_CATALOG = [
  { id:'auto', icon:'🧠', name:'Авто (по цели)', who:'Автоматический подбор', days:0, goal:'auto' as SplitGoal, desc:'Авто-выбор сплита по цели и дням: FBW (≤3дн) → Upper/Lower (4) → PPL (5+)' },
  { id:'fbw', icon:'🔄', name:'Full Body (FBW)', who:'Новички, реабилитация', days:3, goal:'strength', desc:'3 тренировки в неделю, каждая задействует всё тело. Фокус дня: присед → тяга → жим. Идеально для начинающих.' },
  { id:'ul', icon:'↕️', name:'Upper/Lower', who:'Средний уровень', days:4, goal:'hypertrophy', desc:'Чередование верха и низа. 4 дня/нед: Upper strength → Lower → Upper hyper → Lower hyper.' },
  { id:'ppl', icon:'🔺', name:'Push/Pull/Legs', who:'Опытные, гипертрофия', days:6, goal:'hypertrophy', desc:'Классика гипертрофии. PPL ×2 (6 дн) или ×1 (3 дн). Каждая группа — 2×/нед в 6-дневном варианте.' },
  { id:'pb', icon:'⚡', name:'Powerbuilding', who:'Сила + масса', days:4, goal:'powerbuilding', desc:'Гибрид силы и гипертрофии. Squat → Bench → Deadlift + 1 гипертрофийный день верха.' },
  { id:'sm', icon:'🪨', name:'Strongman', who:'Стронгмены', days:3, goal:'strongman', desc:'Overhead+Carry → Deadlift+Events → Squat+Grip. Специализация на стронгмен-движениях.' },
  { id:'wl', icon:'🏋️', name:'Weightlifting', who:'Тяжёлая атлетика', days:4, goal:'weightlifting', desc:'Snatch → Clean&Jerk → Strength → Technique. Олимпийские движения + силовая база.' },
  { id:'cf', icon:'🔥', name:'CrossFit', who:'Кроссфит', days:5, goal:'crossfit', desc:'Metcon → Strength → Fullbody → Strength → Metcon. Кондиционная + силовая работа.' },
  { id:'rehab', icon:'🩹', name:'Rehab', who:'Восстановление', days:3, goal:'rehab', desc:'Восстановительная программа. Исключает травмированные паттерны, фокус на безопасные движения.' },
];

const GOAL_OPTIONS: SplitGoal[] = ['strength','hypertrophy','powerbuilding','weightlifting','crossfit','conditioning','technique','rehab'];

// MEV/MAV/MRV per group — канон volume-landmarks.engine (intermediate), без дубля хардкода
const VOLUME_NORMS: Record<string, { mev:number; mav:number; mrv:number }> = (() => {
  const groups = ['chest','back','legs','shoulders','arms','core'] as const;
  const out: Record<string, { mev:number; mav:number; mrv:number }> = {} as any;
  for (const g of groups) {
    const lm = getVolumeLandmarks('intermediate', g);
    out[g] = lm ? { mev: lm.mev, mav: lm.mav, mrv: lm.mrv } : { mev: 6, mav: 12, mrv: 20 };
  }
  return out;
})();

// ── Утилиты ──
function estimateSetsPerGroup(sessions: SessionTemplate[]): Record<string, number> {
  const sets: Record<string, number> = {};
  const BASE: Record<string, number> = { main:4, secondary:3, accessory:2, rehab:2 };
  for (const s of sessions) {
    for (const sl of s.slots) {
      const g = PATTERN_TO_GROUP[sl.pattern];
      if (!g) continue;
      sets[g] = (sets[g] || 0) + (BASE[sl.role] || 3);
    }
  }
  return sets;
}

function getDaysCoverage(sessions: SessionTemplate[]): Record<string, number> {
  const days: Record<string, number> = {};
  for (const s of sessions) {
    const seen = new Set<string>();
    for (const sl of s.slots) {
      const g = PATTERN_TO_GROUP[sl.pattern];
      if (g && !seen.has(g)) { days[g] = (days[g] || 0) + 1; seen.add(g); }
    }
  }
  return days;
}

const groupMuscles: Record<string, string[]> = {
  chest:['chest'], back:['back'], legs:['legs'], shoulders:['shoulders'], arms:['arms'], core:['core'],
};

function getGroupForWeak(weak: string): string | undefined {
  const m: Record<string, string> = {
    chest:'chest', pecs:'chest', грудь:'chest',
    back:'back', lats:'back', спина:'back', спину:'back',
    legs:'legs', quads:'legs', hamstrings:'legs', glutes:'legs', ноги:'legs', бедра:'legs',
    shoulders:'shoulders', delts:'shoulders', плечи:'shoulders',
    arms:'arms', biceps:'arms', triceps:'arms', руки:'arms',
    core:'core', abs:'core', пресс:'core', кор:'core',
  };
  return m[weak.toLowerCase()];
}

// ── Компонент ──
export const SplitGenCard: React.FC = () => {
  const prof = useMemo(() => loadTrainingProfile(), []);
  const [mode, setMode] = useState<Mode>('builder');
  const [type, setType] = useState('ppl');
  const [goal, setGoal] = useState<SplitGoal>('hypertrophy');
  const [days, setDays] = useState(6);
  const [weak, setWeak] = useState<string[]>(prof.weakPoints || []);
  const [weakInput, setWeakInput] = useState('');
  const [injury, setInjury] = useState<'knee'|'shoulder'|'lower_back'|'hip'|'ankle'|''>('');
  const [applied, setApplied] = useState(false);

  // Split generation
  const out: SplitOutput | null = useMemo(() => {
    const input: SplitInput = {
        daysPerНеделя: days, goal, weakPoints: weak,
        equipmentAvailable: prof.equipment || ['barbell'],
        injuryType: injury || undefined,
    };
    try {
      const t = SPLIT_CATALOG.find(s => s.id === type)!;
      return t.id === 'auto' ? generateSplit(input) : (() => {
        const fns: Record<string, (i:SplitInput)=>SplitOutput> = {
          fbw:generateFBWSplit, ul:generateUpperLowerSplit, ppl:generatePPLSplit,
          pb:generatePowerbuildingSplit, sm:generateStrongmanSplit,
          wl:generateWeightliftingSplit, cf:generateCrossFitSplit, rehab:generateRehabSplit,
        };
        return (fns[type] || generateSplit)(input);
      })();
    } catch { return null; }
  }, [type, goal, days, weak, injury, prof.equipment]);

  // Аналитика
  const setEstimate = useMemo(() => out ? estimateSetsPerGroup(out.sessions) : {}, [out]);
  const dayCoverage = useMemo(() => out ? getDaysCoverage(out.sessions) : {}, [out]);

  // Календарь: день → группы
  const calendar = useMemo(() => {
    if (!out) return [];
    return out.sessions.map(s => {
      const groups: string[] = [];
      for (const sl of s.slots) { const g = PATTERN_TO_GROUP[sl.pattern]; if (g && !groups.includes(g)) groups.push(g); }
      return { day:s.dayIndex, focus:s.focus, priority:s.priority, groups };
    });
  }, [out]);

  // Визуализация календаря (mode 'visual')
  const [visType, setVisType] = useState('ppl');
  const [visGoal, setVisGoal] = useState<SplitGoal>('hypertrophy');
  const [visDays, setVisDays] = useState(6);
  const visOut = useMemo(() => {
    const visCat = SPLIT_CATALOG.find(s => s.id === visType);
    if (!visCat || visType === 'auto') return null;
    const input: SplitInput = {
      daysPerНеделя: visDays, goal: visGoal, weakPoints: weak,
      equipmentAvailable: prof.equipment || ['barbell'],
    };
    try {
      const fns: Record<string, (i:SplitInput)=>SplitOutput> = {
        fbw:generateFBWSplit, ul:generateUpperLowerSplit, ppl:generatePPLSplit,
        pb:generatePowerbuildingSplit, sm:generateStrongmanSplit,
        wl:generateWeightliftingSplit, cf:generateCrossFitSplit, rehab:generateRehabSplit,
      };
      return (fns[visType] || generateSplit)(input);
    } catch { return null; }
  }, [visType, visGoal, visDays, weak, prof.equipment]);

  const visCalendar = useMemo(() => {
    if (!visOut) return [];
    return visOut.sessions.map(s => {
      const groups: string[] = [];
      for (const sl of s.slots) { const g = PATTERN_TO_GROUP[sl.pattern]; if (g && !groups.includes(g)) groups.push(g); }
      return { day:s.dayIndex, focus:s.focus, priority:s.priority, groups };
    });
  }, [visOut]);
  const visSets = useMemo(() => visOut ? estimateSetsPerGroup(visOut.sessions) : {}, [visOut]);

  // Comparison mode
  const [cmpA, setCmpA] = useState('ppl');
  const [cmpB, setCmpB] = useState('ul');
  const [cmpGoal, setCmpGoal] = useState<SplitGoal>('hypertrophy');
  const [cmpDays, setCmpDays] = useState(4);
  const cmpOutA = useMemo(() => {
    const input: SplitInput = { daysPerНеделя:cmpDays, goal:cmpGoal, weakPoints:weak, equipmentAvailable:prof.equipment||['barbell'] };
    try {
      const fns: Record<string, (i:SplitInput)=>SplitOutput> = { fbw:generateFBWSplit, ul:generateUpperLowerSplit, ppl:generatePPLSplit, pb:generatePowerbuildingSplit, sm:generateStrongmanSplit, wl:generateWeightliftingSplit, cf:generateCrossFitSplit, rehab:generateRehabSplit };
      return (fns[cmpA] || generateSplit)(input);
    } catch { return null; }
  }, [cmpA, cmpGoal, cmpDays, weak, prof.equipment]);
  const cmpOutB = useMemo(() => {
    const input: SplitInput = { daysPerНеделя:cmpDays, goal:cmpGoal, weakPoints:weak, equipmentAvailable:prof.equipment||['barbell'] };
    try {
      const fns: Record<string, (i:SplitInput)=>SplitOutput> = { fbw:generateFBWSplit, ul:generateUpperLowerSplit, ppl:generatePPLSplit, pb:generatePowerbuildingSplit, sm:generateStrongmanSplit, wl:generateWeightliftingSplit, cf:generateCrossFitSplit, rehab:generateRehabSplit };
      return (fns[cmpB] || generateSplit)(input);
    } catch { return null; }
  }, [cmpB, cmpGoal, cmpDays, weak, prof.equipment]);
  const cmpSetsA = useMemo(() => cmpOutA ? estimateSetsPerGroup(cmpOutA.sessions) : {}, [cmpOutA]);
  const cmpSetsB = useMemo(() => cmpOutB ? estimateSetsPerGroup(cmpOutB.sessions) : {}, [cmpOutB]);

  // Apply
  const applySplit = useCallback(() => {
    if (!out) return;
    const cycle: string[][] = out.sessions.map(s => {
      const gs: string[] = [];
      for (const sl of s.slots) { const g = PATTERN_TO_GROUP[sl.pattern]; if (g && !gs.includes(g)) gs.push(g); }
      return gs;
    }).filter(g => g.length > 0);
    if (cycle.length === 0) return;
    applyToPlanner({ kind:'split', label:'Сплит «'+out.name+'» ('+cycle.length+' дн)', data:{ cycle, name:out.name } });
    setApplied(true); setTimeout(() => setApplied(false), 2500);
  }, [out]);

  const addWeak = () => {
    const w = weakInput.trim().toLowerCase();
    if (!w) return;
    const g = getGroupForWeak(w);
    if (g && !weak.includes(g)) setWeak(p => [...p, g]);
    setWeakInput('');
  };

  // ── Рендер ──
  return (
    <div style={{ maxWidth: 800, margin:'0 auto', padding:12, color:'#fff' }}>
      {/* ── Заголовок + навигация режимов ── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2, flexWrap:'wrap', gap:8 }}>
        <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
          <span style={{ fontSize:16, fontWeight:800, color:ACCENT }}>🧩 Генератор сплитов</span>
          <span style={{ fontSize:10, color:DIM, background:'rgba(0,230,138,0.1)', padding:'1px 8px', borderRadius:10, fontWeight:700 }}>9 типов</span>
        </div>
        <div style={{ display:'flex', gap:4 }}>
          {(['builder','visual','compare'] as Mode[]).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              padding:'6px 12px', borderRadius:8, fontSize:10, fontWeight:700, cursor:'pointer',
              border: mode===m ? '1px solid '+ACCENT : '1px solid rgba(255,255,255,0.08)',
              background: mode===m ? 'rgba(0,230,138,0.1)' : 'rgba(0,0,0,0.3)',
              color: mode===m ? ACCENT : DIM,
            }}>
              {{builder:'🎛️ Конструктор', visual:'📊 Визуализация', compare:'⚖️ Сравнение'}[m]}
            </button>
          ))}
        </div>
      </div>
      <div style={{ fontSize:10, color:DIM, marginBottom:12 }}>
        Профессиональный подбор сплита: каталог всех типов, визуальный календарь, оценка объёма по группам, сравнение, авто-подключение к планировщику.
      </div>

      {/* ═══════════ MODE 1: BUILDER ═══════════ */}
      {mode === 'builder' && (<>
        {/* Каталог сплитов */}
        <div style={C}>
          <div style={H}>📚 Каталог сплитов (выберите тип)</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:8 }}>
            {SPLIT_CATALOG.map(s => {
              const active = type === s.id;
              return (
                <button key={s.id} onClick={() => { setType(s.id); if (s.days > 0) setDays(s.days); }}
                  style={{
                    textAlign:'left', padding:12, borderRadius:10, cursor:'pointer',
                    border: active ? '1px solid '+ACCENT : '1px solid rgba(255,255,255,0.06)',
                    background: active ? 'rgba(0,230,138,0.08)' : BG,
                    color:'#fff',
                  }}>
                  <div style={{ fontSize:18, marginBottom:4 }}>{s.icon}</div>
                  <div style={{ fontSize:11, fontWeight:700, color:active?ACCENT:'#fff', marginBottom:2 }}>{s.name}</div>
                  <div style={{ fontSize:10, color:DIM, marginBottom:4 }}>{s.who} · {s.days>0 ? s.days+' дн/нед' : 'авто'}</div>
                  <div style={{ fontSize:10, color:'#fff', lineHeight:1.3 }}>{s.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Параметры */}
        <div style={C}>
          <div style={H}>🎛️ Параметры сплита</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:8, marginBottom:8 }}>
            <div><div style={L}>Цель</div><select style={S} value={goal} onChange={e => setGoal(e.target.value as SplitGoal)}>{GOAL_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}</select></div>
            <div><div style={L}>Дней/нед</div><input type="number" min={2} max={7} style={S} value={days} onChange={e => setDays(parseInt(e.target.value)||0)} /></div>
            <div><div style={L}>Травма (для Rehab)</div><select style={S} value={injury} onChange={e => setInjury(e.target.value as any)}>
              <option value="">Нет</option>
              <option value="knee">Колено</option><option value="shoulder">Плечо</option>
              <option value="lower_back">Поясница</option><option value="hip">Таз</option><option value="ankle">Голеностоп</option>
            </select></div>
          </div>
          <div><div style={L}>Слабые группы (приоритет в генерации)</div>
            <div style={{ display:'flex', gap:6, marginBottom:6, flexWrap:'wrap', alignItems:'center' }}>
              <input type="text" style={{ ...S, width:160 }} value={weakInput} onChange={e => setWeakInput(e.target.value)}
                onKeyDown={e => e.key==='Enter' && addWeak()}
                placeholder="грудь, спина, ноги…" />
              <button onClick={addWeak} style={{ padding:'6px 14px', borderRadius:8, background:'rgba(0,230,138,0.1)', border:'1px solid rgba(0,230,138,0.2)', color:ACCENT, cursor:'pointer', fontWeight:700, fontSize:11 }}>+ Добавить</button>
            </div>
            <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
              {weak.map(g => (
                <span key={g} style={{ padding:'4px 10px', borderRadius:14, fontSize:10, fontWeight:700, background:'rgba(0,230,138,0.1)', border:'1px solid rgba(0,230,138,0.2)', color:ACCENT, cursor:'pointer' }}
                  onClick={() => setWeak(p => p.filter(w => w !== g))}>
                  {GROUP_RU[g] || g} ✕
                </span>
              ))}
              {weak.length === 0 && <span style={{ fontSize:10, color:DIM }}>Не выбраны — сплит строится без акцента</span>}
            </div>
          </div>
        </div>

        {/* Результат */}
        {out && (<>
          <div style={C}>
            <div style={{ ...H, fontSize:15 }}>{out.name}</div>
            <div style={{ fontSize:10, color:DIM, marginBottom:10 }}>{out.description}</div>

            {/* Недельный календарь */}
            <div style={{ marginBottom:10 }}>
              <div style={{ ...L, color:ACCENT }}>📅 Недельная структура (календарь)</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(100px, 1fr))', gap:6 }}>
                {calendar.map((d, i) => (
                  <div key={i} style={{ padding:10, borderRadius:8, background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.05)', textAlign:'center' }}>
                    <div style={{ fontSize:10, color:DIM, fontWeight:700, marginBottom:4 }}>День {d.day} · {d.focus}</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:3, justifyContent:'center' }}>
                      {d.groups.map(g => (
                        <span key={g} style={{ padding:'2px 6px', borderRadius:10, fontSize:10, fontWeight:700, background:GROUP_COLOR[g]+'22', color:GROUP_COLOR[g], border:'1px solid '+GROUP_COLOR[g]+'33' }}>
                          {GROUP_RU[g]}
                        </span>
                      ))}
                    </div>
                    <div style={{ fontSize:10, color:DIM, marginTop:4 }}>
                      {d.priority === 'strength' ? '💪 Сила' : d.priority === 'hypertrophy' ? '🏋️ Гипертрофия' : '🎯 '+d.priority}
                    </div>
                  </div>
                ))}
                {/* Empty days */}
                {Array.from({ length: Math.max(0, 7 - calendar.length) }).map((_, i) => (
                  <div key={'empty'+i} style={{ padding:10, borderRadius:8, background:'rgba(0,0,0,0.1)', border:'1px solid rgba(255,255,255,0.02)', textAlign:'center', opacity:0.3 }}>
                    <div style={{ fontSize:10, color:DIM }}>Отдых</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Детальные дни */}
            <div style={{ marginBottom:10 }}>
              <div style={{ ...L, color:ACCENT }}>🔍 Структура по дням (паттерны движений)</div>
              {out.sessions.map((s, i) => (
                <div key={i} style={{ marginBottom:6, padding:8, borderRadius:8, background:'rgba(0,230,138,0.04)', border:'1px solid rgba(0,230,138,0.08)' }}>
                  <div style={{ fontSize:10, fontWeight:700, color:ACCENT, marginBottom:3 }}>
                    День {s.dayIndex} · {s.focus} · {s.priority}
                  </div>
                  <div style={{ display:'flex', gap:3, flexWrap:'wrap' }}>
                    {s.slots.map((sl, j) => {
                      const isMain = sl.role === 'main';
                      return (
                        <span key={j} style={{
                          padding:'3px 7px', borderRadius:12, fontSize:10, fontWeight:700,
                          border: isMain ? '1px solid '+ACCENT : '1px solid rgba(255,255,255,0.08)',
                          background: isMain ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.02)',
                          color: isMain ? ACCENT : DIM,
                        }}>
                          {PATTERN_RU[sl.pattern] || sl.pattern}
                          <span style={{ opacity:0.5, fontSize:10 }}> · {sl.role}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Объём по группам */}
            <div style={{ marginBottom:10 }}>
              <div style={{ ...L, color:ACCENT }}>📊 Оценка недельного объёма по группам (сетов/нед)</div>
              {(['chest','back','legs','shoulders','arms','core'] as string[]).map(g => {
                const s = setEstimate[g] || 0;
                const n = VOLUME_NORMS[g] || { mev:6, mav:14, mrv:20 };
                const pct = Math.min(100, Math.round(s / n.mrv * 100));
                const color = s < n.mev ? '#ef4444' : s < n.mav ? '#f59e0b' : s <= n.mrv ? '#22c55e' : '#ef4444';
                const cov = dayCoverage[g] || 0;
                return (
                  <div key={g} style={{ marginBottom:4 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:1 }}>
                      <span style={{ color:GROUP_COLOR[g], fontWeight:700 }}>{GROUP_RU[g]}</span>
                      <span style={{ color:DIM }}>{s} сет/нед · {cov}×/нед · MEV {n.mev} / MAV {n.mav} / MRV {n.mrv}</span>
                    </div>
                    <div style={{ height:6, borderRadius:3, background:'rgba(255,255,255,0.06)', overflow:'hidden' }}>
                      <div style={{ height:'100%', width:pct+'%', borderRadius:3, background:color, transition:'width 0.3s' }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Рекомендации */}
            {out.recommendations.length > 0 && (
              <div style={{ marginTop:6, padding:10, borderRadius:8, background:'rgba(59,130,246,0.06)', border:'1px solid rgba(59,130,246,0.15)' }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#60a5fa', marginBottom:4 }}>💡 Рекомендации</div>
                {out.recommendations.map((r, i) => <div key={i} style={{ fontSize:10, color:DIM, marginBottom:2 }}>• {r}</div>)}
              </div>
            )}

            {/* Recovery overlap */}
            {(() => {
              const overlaps: { group:string; days:number[]; gap:number }[] = [];
              for (const g of ['chest','back','legs','shoulders','arms','core'] as string[]) {
                const dayNums = out.sessions.filter(s => s.slots.some(sl => PATTERN_TO_GROUP[sl.pattern] === g)).map(s => s.dayIndex);
                if (dayNums.length >= 2) {
                  let minGap = 999;
                  for (let i = 1; i < dayNums.length; i++) minGap = Math.min(minGap, dayNums[i] - dayNums[i-1]);
                  if (minGap < 2) overlaps.push({ group:g, days:dayNums, gap:minGap });
                }
              }
              if (overlaps.length > 0) return (
                <div style={{ marginTop:8, padding:10, borderRadius:8, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.15)' }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'#f87171', marginBottom:4 }}>⚠️ Низкий интервал восстановления</div>
                  {overlaps.map((o, i) => (
                    <div key={i} style={{ fontSize:10, color:'#fff' }}>
                      {GROUP_RU[o.group]}: дни {o.days.join(', ')} — интервал {o.gap} дн (рекомендуется ≥2 дн). Добавьте день отдыха между этими тренировками.
                    </div>
                  ))}
                </div>
              );
              return null;
            })()}

            {/* Apply button */}
            <div style={{ marginTop:12, padding:12, borderRadius:12, background:'rgba(0,230,138,0.06)', border:'1px solid rgba(0,230,138,0.2)' }}>
              <div style={{ fontSize:10, color:DIM, marginBottom:8 }}>
                🔗 Применить сплит к ручному конструктору — структура дней загрузится в план, конструктор подберёт упражнения с учётом вашего профиля.
              </div>
              <button onClick={applySplit} style={{
                width:'100%', padding:12, borderRadius:10, border:'none', cursor:'pointer',
                background: applied ? 'rgba(0,230,138,0.2)' : 'linear-gradient(135deg,#00e68a,#00c853)',
                color: applied ? ACCENT : '#000', fontWeight:800, fontSize:13, minHeight:44,
              }}>
                {applied ? '✓ Отправлено в конструктор' : '🛠 Применить к ручному конструктору'}
              </button>
            </div>
          </div>
        </>)}
      </>)}

      {/* ═══════════ MODE 2: VISUAL ═══════════ */}
      {mode === 'visual' && (<>
        <div style={C}>
          <div style={H}>📊 Визуализация недельного календаря</div>
          <div style={{ fontSize:10, color:DIM, marginBottom:8 }}>Выберите сплит и смотрите, как распределены группы мышц по дням недели, с оценкой объёма.</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:8, marginBottom:10 }}>
            <div><div style={L}>Тип сплита</div><select style={S} value={visType} onChange={e => setVisType(e.target.value)}>
              {SPLIT_CATALOG.filter(s => s.id !== 'auto').map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
            </select></div>
            <div><div style={L}>Цель</div><select style={S} value={visGoal} onChange={e => setVisGoal(e.target.value as SplitGoal)}>{GOAL_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}</select></div>
            <div><div style={L}>Дней/нед</div><input type="number" min={2} max={7} style={S} value={visDays} onChange={e => setVisDays(parseInt(e.target.value)||0)} /></div>
          </div>

          {visCalendar.length > 0 && (
            <div>
              <div style={{ ...L, color:ACCENT }}>📅 Календарь недели</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:4 }}>
                {Array.from({ length:7 }).map((_, i) => {
                  const d = visCalendar.find(c => c.day === i+1);
                  if (!d) return (
                    <div key={i} style={{ padding:8, borderRadius:8, background:'rgba(0,0,0,0.15)', border:'1px solid rgba(255,255,255,0.03)', textAlign:'center', opacity:0.25, minHeight:60 }}>
                      <div style={{ fontSize:10, color:DIM, fontWeight:700 }}>Д {i+1}</div>
                      <div style={{ fontSize:10, color:DIM, marginTop:4 }}>Отдых</div>
                    </div>
                  );
                  return (
                    <div key={i} style={{ padding:'6px 4px', borderRadius:8, background:'rgba(0,0,0,0.2)', border:'1px solid rgba(0,230,138,0.1)', textAlign:'center', minHeight:60 }}>
                      <div style={{ fontSize:10, color:DIM, fontWeight:700, marginBottom:3 }}>Д {d.day}</div>
                      {d.groups.map(g => (
                        <div key={g} style={{ padding:'1px 4px', borderRadius:8, fontSize:6, fontWeight:700, marginBottom:1, background:GROUP_COLOR[g]+'33', color:GROUP_COLOR[g] }}>
                          {GROUP_RU[g]}
                        </div>
                      ))}
                      <div style={{ fontSize:6, color:DIM, marginTop:3 }}>
                        {d.priority === 'strength' ? 'Сила' : d.priority === 'hypertrophy' ? 'Гипер.' : d.priority}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Объём в визуальном режиме */}
              <div style={{ marginTop:12 }}>
                <div style={{ ...L, color:ACCENT }}>📊 Объём по группам</div>
                {(['chest','back','legs','shoulders','arms','core'] as string[]).map(g => {
                  const s = visSets[g] || 0;
                  const n = VOLUME_NORMS[g] || { mev:6, mav:14, mrv:20 };
                  const pct = Math.min(100, Math.round(s / n.mrv * 100));
                  const color = s < n.mev ? '#ef4444' : s < n.mav ? '#f59e0b' : s <= n.mrv ? '#22c55e' : '#ef4444';
                  return (
                    <div key={g} style={{ marginBottom:3 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:10 }}>
                        <span style={{ color:GROUP_COLOR[g], fontWeight:700, width:50 }}>{GROUP_RU[g]}</span>
                        <span style={{ color:DIM, flex:1, textAlign:'right' }}>{s} сет/нед (MEV:{n.mev} MAV:{n.mav} MRV:{n.mrv})</span>
                      </div>
                      <div style={{ height:5, borderRadius:3, background:'rgba(255,255,255,0.06)', overflow:'hidden' }}>
                        <div style={{ height:'100%', width:pct+'%', borderRadius:3, background:color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {visCalendar.length === 0 && <div style={{ textAlign:'center', padding:20, color:DIM, fontSize:11 }}>Выберите тип сплита для визуализации.</div>}
        </div>
      </>)}

      {/* ═══════════ MODE 3: COMPARE ═══════════ */}
      {mode === 'compare' && (<>
        <div style={C}>
          <div style={H}>⚖️ Сравнение двух сплитов</div>
          <div style={{ fontSize:10, color:DIM, marginBottom:8 }}>Выберите два сплита и сравните структуру, объём и покрытие групп при одинаковых параметрах.</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
            <div>
              <div style={{ ...L, color:'#60a5fa' }}>Сплит A</div>
              <select style={S} value={cmpA} onChange={e => setCmpA(e.target.value)}>
                {SPLIT_CATALOG.filter(s => s.id !== 'auto').map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
              </select>
            </div>
            <div>
              <div style={{ ...L, color:'#a855f7' }}>Сплит B</div>
              <select style={S} value={cmpB} onChange={e => setCmpB(e.target.value)}>
                {SPLIT_CATALOG.filter(s => s.id !== 'auto').map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
              </select>
            </div>
            <div><div style={L}>Цель</div><select style={S} value={cmpGoal} onChange={e => setCmpGoal(e.target.value as SplitGoal)}>{GOAL_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}</select></div>
            <div><div style={L}>Дней/нед</div><input type="number" min={2} max={7} style={S} value={cmpDays} onChange={e => setCmpDays(parseInt(e.target.value)||0)} /></div>
          </div>

          {/* Comparison table */}
          {cmpOutA && cmpOutB && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {/* Column A */}
                <div style={{ padding:10, borderRadius:8, background:'rgba(59,130,246,0.04)', border:'1px solid rgba(59,130,246,0.12)' }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#60a5fa', marginBottom:6 }}>{cmpOutA.name}</div>
                  <div style={{ fontSize:10, color:DIM, marginBottom:6 }}>{cmpOutA.sessions.length} дн/нед · {cmpOutA.description}</div>
                  {(['chest','back','legs','shoulders','arms','core'] as string[]).map(g => {
                    const s = cmpSetsA[g] || 0;
                    const n = VOLUME_NORMS[g];
                    const stat = s < n.mev ? '⬇' : s <= n.mav ? '—' : s <= n.mrv ? '⬆' : '⚠';
                    return (
                      <div key={g} style={{ display:'flex', justifyContent:'space-between', fontSize:10, padding:'2px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                        <span style={{ color:GROUP_COLOR[g] }}>{GROUP_RU[g]}</span>
                        <span style={{ color:DIM }}>{s} сет {stat}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Column B */}
                <div style={{ padding:10, borderRadius:8, background:'rgba(168,85,247,0.04)', border:'1px solid rgba(168,85,247,0.12)' }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#a855f7', marginBottom:6 }}>{cmpOutB.name}</div>
                  <div style={{ fontSize:10, color:DIM, marginBottom:6 }}>{cmpOutB.sessions.length} дн/нед · {cmpOutB.description}</div>
                  {(['chest','back','legs','shoulders','arms','core'] as string[]).map(g => {
                    const s = cmpSetsB[g] || 0;
                    const n = VOLUME_NORMS[g];
                    const stat = s < n.mev ? '⬇' : s <= n.mav ? '—' : s <= n.mrv ? '⬆' : '⚠';
                    return (
                      <div key={g} style={{ display:'flex', justifyContent:'space-between', fontSize:10, padding:'2px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                        <span style={{ color:GROUP_COLOR[g] }}>{GROUP_RU[g]}</span>
                        <span style={{ color:DIM }}>{s} сет {stat}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Delta */}
              <div style={{ marginTop:10, padding:10, borderRadius:8, background:'rgba(0,230,138,0.04)', border:'1px solid rgba(0,230,138,0.1)' }}>
                <div style={{ fontSize:10, fontWeight:700, color:ACCENT, marginBottom:4 }}>📊 Разница (A − B)</div>
                {(['chest','back','legs','shoulders','arms','core'] as string[]).map(g => {
                  const d = (cmpSetsA[g] || 0) - (cmpSetsB[g] || 0);
                  if (d === 0) return null;
                  return (
                    <div key={g} style={{ display:'flex', justifyContent:'space-between', fontSize:10, padding:'2px 0' }}>
                      <span style={{ color:GROUP_COLOR[g] }}>{GROUP_RU[g]}</span>
                      <span style={{ color: d > 0 ? '#22c55e' : '#ef4444', fontWeight:700 }}>
                        {d > 0 ? '+' : ''}{d} сет
                        <span style={{ color:DIM, fontWeight:400 }}> ({cmpOutA.name} {d > 0 ? '>' : '<'} {cmpOutB.name})</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {(!cmpOutA || !cmpOutB) && <div style={{ textAlign:'center', padding:20, color:DIM, fontSize:11 }}>Выберите два сплита для сравнения.</div>}
        </div>
      </>)}
    </div>
  );
};

export default SplitGenCard;
