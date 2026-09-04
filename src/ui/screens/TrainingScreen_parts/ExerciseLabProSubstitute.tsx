/** ExerciseLabProSubstitute.tsx — объединённый Шаг 3: ПРО-анализ + Замена без дублей.
 *  Считает groupExercises один раз, переиспользует для обоих блоков.
 *  selectedId → подсвечивает выбранное упражнение в таблице.
 */
import React, { useMemo, useState } from 'react';
import { EXERCISE_CATALOG, canReplace, getExerciseById, getSubstitutes } from '../../../core/exercise-catalog';
import { assessSafety } from '../../../engines/movement-engines';
import { forceVector, lengthenedPartials } from '../../../engines/pro/exercise-prescription.engine';
import { PopupSelect } from '../SRCBBScreen_parts/TrainingPopups';
import {
  ACCENT, DIM, CARD,
  GROUPS, GROUP_RU, GROUP_ICON,
  SUBREGION_DEFS,
  getResistanceProfile, calcTechniqueScore, getRiskColor,
} from './ExerciseLabShared';

const ProSubstituteTab: React.FC<{ selectedId?: string | null }> = ({ selectedId }) => {
  const [proGroup, setProGroup] = useState('chest');
  const [subExId, setSubExId] = useState<string>(selectedId || '');
  // синхронизация если выбрано в шаге 1/2
  React.useEffect(() => { if (selectedId) { const ex = EXERCISE_CATALOG.find(e => e.id === selectedId); if (ex) { setProGroup(ex.group); setSubExId(selectedId); } } }, [selectedId]);

  const groupExercises = useMemo(() =>
    EXERCISE_CATALOG.filter(e => e.group === proGroup).map(ex => ({
      exercise: ex,
      rp: getResistanceProfile(ex),
      fv: forceVector(ex.group, ex.type, ex.name),
      score: calcTechniqueScore(ex),
      safety: assessSafety(ex.id, [], calcTechniqueScore(ex).total / 100),
      lp: lengthenedPartials(ex.group),
    })).sort((a, b) => b.rp.score - a.rp.score),
  [proGroup]);

  const fvDist = useMemo(() => {
    const map: Record<string, number> = {};
    groupExercises.forEach(g => { map[g.fv] = (map[g.fv] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [groupExercises]);

  const stretchLeaders = useMemo(() => groupExercises.filter(g => g.rp.curve === 'stretch_mediated').slice(0, 5), [groupExercises]);
  const synergyPairs = useMemo(() => {
    const pairs: Array<{ a: string; b: string; type: string; reason: string }> = [];
    const seen = new Set<string>();
    const antagonistMap: Record<string, string[]> = {
      horizontal_push: ['horizontal_pull'], horizontal_pull: ['horizontal_push'],
      vertical_push: ['vertical_pull'], vertical_pull: ['vertical_push'],
      knee_dominant: ['hip_dominant'], hip_dominant: ['knee_dominant'],
      core_anti: [], other: [],
    };
    groupExercises.forEach(a => {
      groupExercises.forEach(b => {
        if (a.exercise.id === b.exercise.id) return;
        const key = [a.exercise.id, b.exercise.id].sort().join('|');
        if (seen.has(key)) return;
        const agn = antagonistMap[a.fv] || [];
        if (agn.includes(b.fv)) { seen.add(key); pairs.push({ a: a.exercise.name, b: b.exercise.name, type: 'антагонист', reason: `${a.fv} ↔ ${b.fv} — суперсет` }); }
        else if (a.fv === b.fv && a.rp.curve !== b.rp.curve) { seen.add(key); pairs.push({ a: a.exercise.name, b: b.exercise.name, type: 'вариация', reason: `${a.fv}, ${a.rp.label} vs ${b.rp.label}` }); }
      });
    });
    return pairs.slice(0, 8);
  }, [groupExercises]);

  const regionalCoverage = useMemo(() => {
    const regions = SUBREGION_DEFS[proGroup] || [];
    const covered: string[] = []; const uncovered: string[] = [];
    regions.forEach(r => {
      const has = groupExercises.some(g => r.keywords.some(kw => (g.exercise.targetMuscle || '').toLowerCase().includes(kw.toLowerCase())));
      if (has) covered.push(r.name); else uncovered.push(r.name);
    });
    return { covered, uncovered, total: regions.length };
  }, [proGroup, groupExercises]);

  // — Замена —
  const subEx = useMemo(() => EXERCISE_CATALOG.find(e => e.id === subExId), [subExId]);
  const subs = useMemo(() => {
    if (!subEx) return [];
    const sub = getSubstitutes(subEx.id);
    const opts: Array<{ id: string; name: string; reason: string }> = [];
    if (sub) { for (const s of sub.substitutes) { if (!canReplace(subEx.id, s.id)) continue; const r = getExerciseById(s.id); opts.push({ id: s.id, name: r?.name || s.id, reason: s.reason }); } }
    if (opts.length === 0) { EXERCISE_CATALOG.filter(c => c.group === subEx.group && c.id !== subEx.id && canReplace(subEx.id, c.id)).slice(0, 8).forEach(c => opts.push({ id: c.id, name: c.name, reason: 'Альтернатива той же группы' })); }
    return opts;
  }, [subEx]);
  const forbidden = useMemo(() => {
    if (!subEx) return [];
    const raw = getSubstitutes(subEx.id)?.forbidden ?? [];
    return raw.map((f: any) => { const fex = EXERCISE_CATALOG.find(e => e.id === f.id); return { id: f.id, name: fex?.name || f.id, reason: f.reason }; });
  }, [subEx]);

  const subExList = useMemo(() => subEx ? EXERCISE_CATALOG.filter(e => e.group === subEx.group) : [], [subEx]);

  return (
    <div className="train-exlabsub" style={{ maxWidth: 720, margin: '0 auto', color: '#fff' }}>
      <div style={{ padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', marginBottom: 8, fontSize: 10, color: DIM, lineHeight: 1.4 }}>
        <b style={{ color: '#fff' }}>Как читать графики Шага 3:</b> Force-векторы — направление нагрузки (гориз./верт. жим/тяга, колено/доминант). Stretch-лидеры — где пик в растянутой фазе (лучше для роста). Подрегионы — какие части мышцы покрыты упражнениями группы. Синергия — пары для суперсетов (антагонисты). Замена — зелёные `canReplace` безопасны, жёлтые проверить, красные запрещены. Таблица — свод всех упр. группы с профилем/техникой/безопасностью.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <PopupSelect label="Группа (ПРО)" value={proGroup} options={GROUPS.filter(g => g !== 'all').map(g => ({ id: g, label: `${GROUP_ICON[g] || ''} ${GROUP_RU[g]}` }))} onChange={v => setProGroup(v)} />
        <PopupSelect label="Упражнение для замены" value={subExId} options={EXERCISE_CATALOG.filter(e => e.group === proGroup).map(e => ({ id: e.id, label: e.name }))} hint="Выберите" onChange={v => setSubExId(v)} />
      </div>
      {selectedId && <div style={{ fontSize: 10, color: DIM, marginBottom: 8 }}>Выбрано в Шаге 1: <b style={{ color: ACCENT }}>{EXERCISE_CATALOG.find(e => e.id === selectedId)?.name}</b> — синхронизировано.</div>}

      {/* ПРО */}
      <div style={{ ...CARD, marginBottom: 10, border: '1px solid rgba(168,85,247,0.18)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#a855f7', marginBottom: 6 }}>📐 Force-векторы · {GROUP_RU[proGroup]}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {fvDist.map(([fv, count]) => (
            <div key={fv} style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.15)', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#c084fc' }}>{fv.replace(/_/g, ' ')}</div><div style={{ fontSize: 18, fontWeight: 800, color: '#c084fc' }}>{count}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <div style={{ ...CARD, border: '1px solid rgba(34,197,94,0.18)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#22c55e', marginBottom: 4 }}>🏆 Stretch-лидеры</div>
          {stretchLeaders.length ? stretchLeaders.map((g, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '2px 0' }}><span>#{i + 1} {g.exercise.name}</span><span style={{ color: '#22c55e' }}>{g.rp.score}/10</span></div>
          )) : <div style={{ fontSize: 10, color: DIM }}>Нет stretch-mediated</div>}
        </div>
        <div style={{ ...CARD, border: '1px solid rgba(251,146,60,0.18)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#fb923c', marginBottom: 4 }}>🔗 Синергия (топ)</div>
          {synergyPairs.length ? synergyPairs.slice(0, 4).map((p, i) => (
            <div key={i} style={{ fontSize: 10, padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}><b style={{ color: '#fff' }}>{p.a} + {p.b}</b><div style={{ color: DIM }}>{p.type}</div></div>
          )) : <div style={{ fontSize: 10, color: DIM }}>Нет пар</div>}
        </div>
      </div>

      <div style={{ ...CARD, marginBottom: 10, border: '1px solid rgba(59,130,246,0.18)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', marginBottom: 4 }}>📍 Подрегионы: {regionalCoverage.covered.length}/{regionalCoverage.total}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>{regionalCoverage.covered.map(r => <span key={r} style={{ padding: '2px 6px', borderRadius: 10, fontSize: 10, background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>{r}</span>)} {regionalCoverage.uncovered.map(r => <span key={r} style={{ padding: '2px 6px', borderRadius: 10, fontSize: 10, background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>{r}</span>)}</div>
      </div>

      {/* Таблица */}
      <div style={{ ...CARD, marginBottom: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: DIM, marginBottom: 6 }}>📋 Таблица {GROUP_RU[proGroup]} — {groupExercises.length} упр.</div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 4, fontSize: 10, color: DIM, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 4 }}>
          <span>Упражнение</span><span style={{ textAlign: 'center' }}>Профиль</span><span style={{ textAlign: 'center' }}>Техника</span><span style={{ textAlign: 'center' }}>Безоп.</span>
        </div>
        {groupExercises.slice(0, 20).map((g, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 4, padding: '3px 0', fontSize: 10, borderBottom: '1px solid rgba(255,255,255,0.02)', background: g.exercise.id === selectedId ? 'rgba(0,230,138,0.06)' : 'transparent' }}>
            <span style={{ fontWeight: g.exercise.id === selectedId ? 700 : 400, color: g.exercise.id === selectedId ? ACCENT : '#fff' }}>{g.exercise.name}</span>
            <span style={{ textAlign: 'center', color: g.rp.curve === 'stretch_mediated' ? '#22c55e' : '#60a5fa' }}>{g.rp.score}/10</span>
            <span style={{ textAlign: 'center', color: getRiskColor(g.score.level) }}>{g.score.total}</span>
            <span style={{ textAlign: 'center', color: getRiskColor(g.safety.level) }}>{g.safety.score}</span>
          </div>
        ))}
      </div>

      {/* ЗАМЕНА */}
      <div style={{ borderTop: '2px solid rgba(168,85,247,0.2)', paddingTop: 10, marginTop: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#c084fc', marginBottom: 6 }}>🔄 Замена упражнения {subEx ? `— ${subEx.name}` : '(выберите выше)'}</div>
        {!subEx ? (
          <div style={{ fontSize: 11, color: DIM, textAlign: 'center', padding: 12 }}>Выберите упражнение — покажу допустимые/запретные замены без дублирования расчётов.</div>
        ) : (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 4 }}>✅ Допустимые ({subs.length})</div>
            {subs.length ? subs.map(o => (
              <div key={o.id} style={{ padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderLeft: '3px solid rgba(0,230,138,0.4)', marginBottom: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 700 }}>{o.name}</div><div style={{ fontSize: 10, color: DIM }}>{o.reason}</div>
              </div>
            )) : <div style={{ fontSize: 10, color: DIM }}>Нет явных — ниже все из группы</div>}
            {forbidden.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', margin: '8px 0 4px' }}>🚫 Запретные ({forbidden.length})</div>
                {forbidden.map((f, i) => (
                  <div key={i} style={{ padding: 6, borderRadius: 8, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', marginBottom: 4 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#fca5a5' }}>{f.name}</div><div style={{ fontSize: 10, color: DIM }}>{f.reason}</div>
                  </div>
                ))}
              </>
            )}
            <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', margin: '8px 0 4px' }}>📋 Все в группе {subExList.length - 1} шт</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {subExList.filter(e => e.id !== subEx.id).slice(0, 10).map(e => {
                const ok = canReplace(subEx.id, e.id);
                return <div key={e.id} style={{ padding: '6px 8px', borderRadius: 6, fontSize: 10, background: ok ? 'rgba(34,197,94,0.04)' : 'rgba(245,158,11,0.04)', border: `1px solid ${ok ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)'}`, display: 'flex', justifyContent: 'space-between' }}><span>{e.name}</span><span style={{ color: ok ? '#22c55e' : '#f59e0b', fontWeight: 700 }}>{ok ? '✅' : '⚠️'}</span></div>;
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
export default ProSubstituteTab;
