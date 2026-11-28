/**
 * bb-step-split.tsx — шаг 3 ББ-авто («🏆 Выбор сплита»), вынесен из
 * god-component `BbAutoConstructor.tsx` (этап 2 §4.3). Перенос 1-в-1:
 * логика/тексты/стили не менялись, все state-ссылки переданы явными props.
 */
import React, { useState } from 'react';
import { SPLIT_PATTERNS, loadCustomSplitPatterns, saveCustomSplitPattern, deleteCustomSplitPattern, createCustomSplitPattern, type SplitPattern, type ScheduleDay } from '../../../engines/bb/bb-split-patterns';
import { FEMALE_GLUTE_SPLITS, getMuscleFrequencies, splitFitWarnings, type BBRankedPattern } from '../../../engines/bb/bb-selector.engine';
import { PHASE_COLORS, PHASE_LABELS } from './PlanOutput';
import { ACCENT, BTN, BTN_GHOST, H, SMALL } from './training-ui';
import { TAG_LABELS_RU, type BBPhase } from './bb-auto-constructor-shared';

const CUSTOM_DAY_TAGS = ['FullBody', 'Upper', 'Lower', 'Push', 'Pull', 'Legs', 'Chest', 'Back', 'Shoulders', 'Arms', 'Glutes', 'Rest'] as const;

export interface BbSplitStepProps {
  selectedSplitId: string;
  /** Ручной выбор: помечает выбор пользователя (splitTouched) и обновляет сплит. */
  onSelectSplit: (id: string) => void;
  /** Пользовательский кастомный сплит (если выбран). */
  customPattern?: SplitPattern | null;
  onSelectCustomPattern?: (p: SplitPattern | null) => void;
  bestSplit: BBRankedPattern | undefined;
  phases: { week: number; phase: BBPhase }[];
  ranked: BBRankedPattern[];
  suggestSplitIds: Set<string>;
  goal: string;
  level: string;
  weeks: number;
  /** Число доступных дней/нед — для честной диагностики соответствия сплита. */
  daysPerWeek?: number;
  /** Пол профиля — диагностика «женский сплит мужчине/без пола» (M2, аудит). */
  sex?: 'male' | 'female';
  isBuilding: boolean;
  onBuild: () => void;
  onBack: () => void;
}

export const BbSplitStep: React.FC<BbSplitStepProps> = ({
  selectedSplitId, onSelectSplit, customPattern, onSelectCustomPattern, bestSplit, phases, ranked, suggestSplitIds,
  goal, level, weeks, daysPerWeek, sex, isBuilding, onBuild, onBack,
}) => {
  const [customOpen, setCustomOpen] = useState(false);
  const [savedCustom, setSavedCustom] = useState<SplitPattern[]>(() => loadCustomSplitPatterns());
  const [customName, setCustomName] = useState('Мой сплит');
  const [customDays, setCustomDays] = useState<string[]>(['Upper', 'Lower', 'Rest', 'Push', 'Pull', 'Legs', 'Rest']);
  const selected = SPLIT_PATTERNS.find(p => p.id === selectedSplitId)
    || savedCustom.find(p => p.id === selectedSplitId)
    || (customPattern?.id === selectedSplitId ? customPattern : undefined);
  const selectedRank = ranked.find(r => r.pattern.id === selectedSplitId);
  const fitWarnings = selected && daysPerWeek != null ? splitFitWarnings({ level, goal: goal as any, daysPerWeek, sex }, selected.id) : [];
  const isRecommended = bestSplit?.pattern.id === selectedSplitId;
  // ♀-строки рекомендации показываем первыми: в карточке лимит 4 строки,
  // и «♀ glute-приоритет профиля» иначе обрезался (аудит женского слоя).
  const recLines = bestSplit
    ? [...bestSplit.rationale.filter(x => x.includes('♀')), ...bestSplit.rationale.filter(x => !x.includes('♀'))].slice(0, 4)
    : [];
  const handleSaveCustomSplit = () => {
    const sched: ScheduleDay[] = customDays.map(tag =>
      tag === 'Rest'
        ? { kind: 'отдых', character: null }
        : { kind: 'тренировка', character: /Lower|Legs|Upper|Push|Pull|FullBody|Chest|Back/i.test(tag) ? 'тяж' : 'памп', sessionTag: tag },
    );
    const created = createCustomSplitPattern(customName, sched);
    const updated = saveCustomSplitPattern(created);
    setSavedCustom(updated);
    onSelectCustomPattern?.(created);
    onSelectSplit(created.id);
    setCustomOpen(false);
  };
  return (
  <div>
    <div style={H}>🏆 Шаг 3: Выбор сплита</div>
    <div style={{ marginBottom:8, padding:'6px 10px', borderRadius:10, background:'rgba(0,230,138,0.08)', border:'1px solid rgba(0,230,138,0.22)', fontSize:12, color:'#00e68a', fontWeight:800 }}>
      ✅ Будет собран: {selected?.name || '— выберите сплит ниже —'}
      {selectedRank?.sessionBudget ? ` · ориентир сессии: ≈${selectedRank.sessionBudget.maxExercises} упр / ≤${selectedRank.sessionBudget.maxWorkingSets} сетов` : ''}
      {selected?.schedule?.length ? (
        <div style={{ marginTop:5, display:'flex', flexWrap:'wrap', gap:4, fontWeight:600, fontSize:10.5, color:'var(--text, #fff)' }}>
          {selected.schedule.map((d, idx) => d.kind === 'тренировка' ? (
            <span key={idx} style={{ padding:'2px 7px', borderRadius:6, background:'rgba(0,230,138,0.12)', border:'1px solid rgba(0,230,138,0.25)' }}>
              Д{idx + 1}: {TAG_LABELS_RU[d.sessionTag || ''] || d.sessionTag || d.character}
            </span>
          ) : null)}
        </div>
      ) : null}
    </div>
    {/* Фаза 4: Конструктор собственного сплита (Шаг 3) */}
    <div style={{ marginBottom: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.2)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#c084fc' }}>🛠 Свой сплит ({savedCustom.length} сохр.)</span>
        <button type="button" onClick={() => setCustomOpen(v => !v)} style={{ ...BTN_GHOST, padding: '4px 10px', fontSize: 11 }}>
          {customOpen ? 'Скрыть' : '＋ Создать свой сплит'}
        </button>
      </div>
      {savedCustom.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
          {savedCustom.map(cp => {
            const active = selectedSplitId === cp.id;
            return (
              <div key={cp.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <button
                  type="button"
                  onClick={() => { onSelectCustomPattern?.(cp); onSelectSplit(cp.id); }}
                  style={{
                    padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    background: active ? 'rgba(168,85,247,0.25)' : 'rgba(255,255,255,0.05)',
                    border: active ? '1px solid #c084fc' : '1px solid rgba(255,255,255,0.12)',
                    color: 'var(--text, #fff)',
                  }}
                >
                  {active ? '✓ ' : ''}{cp.name} ({cp.sessionsPerRotation}×)
                </button>
                <button
                  type="button"
                  title="Удалить сплит"
                  onClick={() => {
                    const next = deleteCustomSplitPattern(cp.id);
                    setSavedCustom(next);
                    if (selectedSplitId === cp.id) {
                      onSelectCustomPattern?.(null);
                      if (SPLIT_PATTERNS[0]) onSelectSplit(SPLIT_PATTERNS[0].id);
                    }
                  }}
                  style={{ padding: '4px 6px', borderRadius: 6, fontSize: 10, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}
                >✕</button>
              </div>
            );
          })}
        </div>
      )}
      {customOpen && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(168,85,247,0.18)' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
            <input
              type="text"
              value={customName}
              onChange={e => setCustomName(e.target.value)}
              placeholder="Название сплита"
              style={{ flex: 1, minWidth: 140, padding: '6px 8px', borderRadius: 8, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text, #fff)', fontSize: 12 }}
            />
            <button type="button" onClick={() => setCustomDays(d => [...d, 'Rest'])} style={{ ...BTN_GHOST, padding: '4px 8px', fontSize: 11 }}>＋ День</button>
            {customDays.length > 2 && <button type="button" onClick={() => setCustomDays(d => d.slice(0, -1))} style={{ ...BTN_GHOST, padding: '4px 8px', fontSize: 11 }}>− День</button>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 6 }}>
            {customDays.map((tag, di) => (
              <label key={di} style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 10, color: 'var(--text, #fff)' }}>
                <span>День {di + 1}</span>
                <select
                  value={tag}
                  onChange={e => setCustomDays(prev => prev.map((v, idx) => idx === di ? e.target.value : v))}
                  style={{ padding: '5px 6px', borderRadius: 7, background: 'rgba(15,18,24,0.85)', border: '1px solid rgba(255,255,255,0.14)', color: 'var(--text, #fff)', fontSize: 11 }}
                >
                  {CUSTOM_DAY_TAGS.map(opt => (
                    <option key={opt} value={opt}>{opt === 'Rest' ? 'Отдых' : (TAG_LABELS_RU[opt] || opt)}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <button type="button" onClick={handleSaveCustomSplit} style={{ ...BTN, marginTop: 8, width: '100%', padding: '7px 12px', fontSize: 12 }}>
            💾 Сохранить и выбрать «{customName || 'Свой сплит'}»
          </button>
        </div>
      )}
    </div>
    {/* Честная диагностика выбранного сплита: если он не подходит под дни/уровень —
        говорим прямо, а не молча собираем неудобный план. */}
    {selected && !isRecommended && fitWarnings.length > 0 && (
      <div role="alert" style={{ marginBottom:8, padding:'6px 10px', borderRadius:10, background:'rgba(245,158,11,0.10)', border:'1px solid rgba(245,158,11,0.3)', fontSize:11, color:'#fbbf24', lineHeight:1.45 }}>
        ⚠ Выбранный сплит не подходит под текущие параметры ({daysPerWeek} дн/нед · уровень «{level}»):
        {fitWarnings.map((w, i) => <div key={i}>· {w}</div>)}
        <div style={{ marginTop:4, color:'var(--text, #fff)' }}>Рекомендуем «{bestSplit?.pattern.name}» — нажмите «Применить» ниже или соберите как есть (тогда это осознанный выбор).</div>
      </div>
    )}
    {/* ♀ Мягкая подсказка профиля: ягодичный сплит — основная рекомендация для
        женщин, но это не запрет. Показываем, если выбран другой сплит и по
        дням/уровню он валиден (иначе выше уже есть жёсткое предупреждение). */}
    {selected && !isRecommended && fitWarnings.length === 0 && sex === 'female' && bestSplit && FEMALE_GLUTE_SPLITS.has(bestSplit.pattern.id) && (
      <div role="status" style={{ marginBottom:8, padding:'6px 10px', borderRadius:10, background:'rgba(236,72,153,0.08)', border:'1px solid rgba(236,72,153,0.25)', fontSize:11, color:'#f9a8d4', lineHeight:1.45 }}>
        ♀ Профиль женский: glute-приоритет — основная рекомендация, «{bestSplit.pattern.name}» (ягодичные 2–3×/нед, Schoenfeld 2016).
        Можно нажать «Применить» выше или оставить выбранный сплит — это осознанный выбор.
      </div>
    )}
    <div style={{ marginBottom:8, padding:'6px 10px', borderRadius:10, background:'rgba(168,85,247,0.06)', border:'1px solid rgba(168,85,247,0.12)', fontSize:11, color:'var(--text, #fff)' }}>
      📅 Фазы: {phases.filter((p,i,a) => p.phase !== a[i-1]?.phase).map((p,i,a) => <span key={i} style={{ color:PHASE_COLORS[p.phase], fontWeight:700 }}>{PHASE_LABELS[p.phase]}{i < a.length - 1 ? ' → ' : ''}</span>)}
    </div>
    <div style={{ marginBottom:10, padding:'6px 10px', borderRadius:10, background:'rgba(0,230,138,0.04)', border:'1px solid rgba(0,230,138,0.1)', fontSize:11, color:'var(--text, #fff)' }}>
      💡 Частота каждой группы — ключевой фактор роста. 2×/нед = оптимум для синтеза белка (Schoenfeld 2016, JSF 2019).
      Чипсы <span style={{ color:'#00e68a' }}>зелёные</span> = 2+×/нед (рекомендуемая частота), <span style={{ color:'var(--text, #fff)' }}>серые</span> = 1×/нед.
      Ориентир сессии — сколько упражнений/сетов сплит даёт в самом плотном дне при вашем уровне (реалистичный лимит, не цель).
    </div>
    {bestSplit && (
      <div style={{ marginBottom:10, padding:12, borderRadius:12, background:'linear-gradient(135deg,rgba(250,204,21,0.08),rgba(250,204,21,0.02))', border:'1px solid rgba(250,204,21,0.25)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
          <span style={{ fontWeight:800, fontSize:13, color:'#facc15' }}>🏆 Рекомендованный сплит: {bestSplit.pattern.name}</span>
          <span style={{ fontSize:12, color:'#facc15', fontWeight:700, background:'rgba(250,204,21,0.15)', padding:'2px 10px', borderRadius:8 }}>скор {bestSplit.score}</span>
        </div>
        <div style={{ fontSize:11, color:'var(--text, #fff)', marginBottom:6 }}>{bestSplit.pattern.description}</div>
        {bestSplit.sessionBudget && (
          <div style={{ fontSize:11, color:'var(--text, #fff)', marginBottom:6 }}>
            📐 Самый плотный день: <b>{bestSplit.sessionBudget.maxGroups} групп</b> · ориентир <b>≈{bestSplit.sessionBudget.maxExercises} упражнений</b> / <b>≤{bestSplit.sessionBudget.maxWorkingSets} рабочих сетов</b>
          </div>
        )}
        {recLines.map((x,i) => <div key={i} style={{ fontSize:11, color:'var(--text, #fff)' }}>✓ {x}</div>)}
        {bestSplit.warnings.slice(0, 2).map((x,i) => <div key={i} style={{ fontSize:11, color:'#f59e0b' }}>⚠ {x}</div>)}
        <div style={{ display:'flex', gap:8, marginTop:8 }}>
          <button onClick={() => onSelectSplit(bestSplit.pattern.id)} style={{ padding:'6px 16px', borderRadius:10, fontSize:11, fontWeight:700, cursor:'pointer', background:'rgba(250,204,21,0.15)', border:'1px solid rgba(250,204,21,0.3)', color:'#facc15' }}>✅ Применить</button>
          <button onClick={onBuild} disabled={isBuilding} style={{ padding:'6px 16px', borderRadius:10, fontSize:11, fontWeight:700, cursor: isBuilding ? 'default' : 'pointer', opacity: isBuilding ? 0.6 : 1, background:'rgba(0,230,138,0.15)', border:'1px solid rgba(0,230,138,0.3)', color:'#00e68a' }}>{isBuilding ? '⏳ Сборка…' : '⚡ Собрать план'}</button>
        </div>
      </div>
    )}
    {ranked.length >= 2 && (
      <div data-bb="split-compare-top3" style={{ marginBottom: 10, padding: '10px 12px', borderRadius: 12, background: 'var(--card-bg, rgba(255,255,255,0.03))', border: '1px solid var(--border, rgba(255,255,255,0.1))' }}>
        <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--text, #fff)', marginBottom: 6 }}>⚖ Быстрое сравнение топ-{Math.min(3, ranked.length)} сплитов</div>
        <div className="bb-split-compare-grid" style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(3, ranked.length)}, minmax(0, 1fr))`, gap: 6 }}>
          {ranked.slice(0, 3).map((r, idx) => {
            const active = selectedSplitId === r.pattern.id;
            const freq2 = getMuscleFrequencies(r.pattern).filter(f => f.freq >= 2).length;
            return (
              <button
                key={r.pattern.id}
                type="button"
                onClick={() => onSelectSplit(r.pattern.id)}
                className="bb-auto-num"
                style={{
                  textAlign: 'left', padding: '8px 10px', borderRadius: 10, cursor: 'pointer', minHeight: 44,
                  background: active ? 'var(--accent-soft, rgba(0,230,138,0.14))' : 'var(--surface-subtle, rgba(255,255,255,0.03))',
                  border: active ? '1.5px solid var(--accent, #00e68a)' : '1px solid var(--border, rgba(255,255,255,0.08))',
                  color: 'var(--text, #fff)',
                }}
              >
                <div style={{ fontSize: 10.5, fontWeight: 800, color: active ? 'var(--accent, #00e68a)' : 'var(--text, #fff)' }}>#{idx + 1} {r.pattern.name}</div>
                <div style={{ fontSize: 10, opacity: 0.85, marginTop: 3 }}>Скор: <b>{r.score}</b> · 2×/нед: <b>{freq2}</b></div>
                {r.sessionBudget && <div style={{ fontSize: 10, opacity: 0.75, marginTop: 1 }}>≈{r.sessionBudget.maxExercises} упр / ≤{r.sessionBudget.maxWorkingSets} сет</div>}
              </button>
            );
          })}
        </div>
      </div>
    )}
    <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:8 }}>
      {ranked.map(r => {
        const sel = selectedSplitId === r.pattern.id;
        const mf = getMuscleFrequencies(r.pattern);
        const isSugSplit = suggestSplitIds.has(r.pattern.id);
        const fits = daysPerWeek != null ? splitFitWarnings({ level, goal: goal as any, daysPerWeek, sex }, r.pattern.id) : [];
        return <div key={r.pattern.id}
          style={{ padding:'10px 12px', borderRadius:10, border:sel?'1px solid #00e68a':isSugSplit?'1px solid rgba(245,158,11,0.25)':'1px solid rgba(255,255,255,0.06)', background:sel?'rgba(0,230,138,0.08)':isSugSplit?'rgba(245,158,11,0.04)':'rgba(255,255,255,0.02)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontWeight:700, fontSize:12, color:sel?'#00e68a':isSugSplit?'#f59e0b':'#fff' }}>{isSugSplit ? '★ ' : ''}{r.pattern.name}</span>
            <span style={{ fontSize:11, color:ACCENT, fontWeight:700, background:'rgba(0,230,138,0.12)', padding:'2px 8px', borderRadius:8 }}>скор {r.score}</span>
          </div>
          <div style={{ ...SMALL, marginTop:4 }}>{r.pattern.description}</div>
          {/* Почему именно этот сплит (всегда, а не только для выбранного) + ориентир сессии */}
          {r.rationale.length > 0 && !sel && <div style={{ fontSize:10, color:'var(--text, #fff)', opacity:0.85, marginTop:3 }}>{r.rationale.slice(0, 2).map((x, i) => <div key={i}>✓ {x}</div>)}</div>}
          {r.sessionBudget && (
            <div style={{ fontSize:10, color:'var(--text, #fff)', opacity:0.8, marginTop:3 }}>
              📐 плотный день: {r.sessionBudget.maxGroups} групп · ≈{r.sessionBudget.maxExercises} упр / ≤{r.sessionBudget.maxWorkingSets} сетов
            </div>
          )}
          {fits.length > 0 && <div style={{ fontSize:10, color:'#f59e0b', marginTop:3 }}>⚠ {fits[0]}</div>}
          {r.warnings.length > 0 && <div style={{ fontSize:10, color:'#f59e0b', marginTop:3 }}>⚠ {r.warnings[0]}</div>}
          {isSugSplit && <div style={{ fontSize:10, color:'#f59e0b', marginTop:2 }}>★ Совместим с целью «{goal}» + уровнем «{level}» — рекомендован, но можно выбрать любой</div>}
          {sel && <div style={{ marginTop:6, fontSize:11, color:'var(--text, #fff)' }}>{r.rationale.map((x,i) => <div key={i}>✓ {x}</div>)}</div>}
          <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:4 }}>
            {mf.map(f => (
              <span key={f.tag} style={{ fontSize:11, padding:'1px 6px', borderRadius:4, background:f.freq >= 2 ? 'rgba(0,230,138,0.08)' : 'rgba(255,255,255,0.03)', color:f.freq >= 2 ? '#00e68a' : '#fff' }}>{TAG_LABELS_RU[f.tag] || f.tag} ~ {f.freq}×/нед</span>
            ))}
          </div>
          <button onClick={() => onSelectSplit(r.pattern.id)} style={{ marginTop:8, padding:'6px 12px', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer', background:sel?'#00e68a':'rgba(255,255,255,0.06)', color:sel?'#000':'#fff', border:'1px solid '+(sel?'#00e68a':'rgba(255,255,255,0.1)'), width:'100%' }}>{sel ? '✓ Выбран' : 'Выбрать этот сплит'}</button>
        </div>;
      })}
    </div>
    <div style={{ display:'flex', gap:8, marginTop:12 }}>
      <button style={{ ...BTN, flex:1, opacity: isBuilding ? 0.6 : 1 }} disabled={isBuilding} onClick={onBuild}>{isBuilding ? '⏳ Сборка…' : `✅ Собрать план (${weeks} нед, фазовая периодизация)`}</button>
      <button style={BTN_GHOST} onClick={onBack}>← Назад</button>
    </div>
  </div>
  );
};
