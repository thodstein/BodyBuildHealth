import React, { useMemo, useState } from 'react';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import { assessSafety } from '../../../engines/movement-engines';
import { forceVector, lengthenedPartials } from '../../../engines/pro/exercise-prescription.engine';
import { PopupSelect } from '../SRCBBScreen_parts/TrainingPopups';
import {
  ACCENT, DIM, CARD, SMALL,
  GROUPS, GROUP_RU, GROUP_ICON,
  SUBREGION_DEFS, SUB_REGION_COLORS,
  getResistanceProfile, calcTechniqueScore, getRiskColor,
} from './ExerciseLabShared';

const ProAnalysisTab: React.FC = () => {
  const [proGroup, setProGroup] = useState('chest');

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
        if (agn.includes(b.fv)) {
          seen.add(key);
          pairs.push({ a: a.exercise.name, b: b.exercise.name, type: 'антагонист', reason: `${a.fv} ↔ ${b.fv} — суперсет без перекрёстного утомления` });
        }
        if (a.fv === b.fv && a.rp.curve !== b.rp.curve) {
          seen.add(key);
          pairs.push({ a: a.exercise.name, b: b.exercise.name, type: 'вариация', reason: `один вектор (${a.fv}), разные кривые: ${a.rp.label} vs ${b.rp.label}` });
        }
      });
    });
    return pairs.slice(0, 10);
  }, [groupExercises]);

  const regionalCoverage = useMemo(() => {
    const regions = SUBREGION_DEFS[proGroup] || [];
    const covered: string[] = [];
    const uncovered: string[] = [];
    regions.forEach(r => {
      const has = groupExercises.some(g => {
        const tm = (g.exercise.targetMuscle || '').toLowerCase();
        return r.keywords.some(kw => tm.includes(kw.toLowerCase()));
      });
      if (has) covered.push(r.name);
      else uncovered.push(r.name);
    });
    return { covered, uncovered, total: regions.length };
  }, [proGroup, groupExercises]);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', color: '#fff' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginBottom: 12 }}>
        <PopupSelect label="Группа мышц" value={proGroup} options={GROUPS.filter(g => g !== 'all').map(g => ({ id: g, label: `${GROUP_ICON[g] || ''} ${GROUP_RU[g]}`, desc: '' }))} hint="Группа для анализа" onChange={v => setProGroup(v)} />
      </div>

      <div style={{ ...CARD, marginBottom: 12, border: '1px solid rgba(168,85,247,0.2)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#a855f7', marginBottom: 8 }}>📐 Распределение force-векторов</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {fvDist.map(([fv, count]) => (
            <div key={fv} style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.15)', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#c084fc' }}>{fv.replace(/_/g, ' ')}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#c084fc' }}>{count}</div>
              <div style={{ fontSize: 8, color: DIM }}>упражнений</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...CARD, marginBottom: 12, border: '1px solid rgba(34,197,94,0.2)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#22c55e', marginBottom: 8 }}>🏆 Stretch-mediated лидеры (топ-5)</div>
        {stretchLeaders.length > 0 ? (
          stretchLeaders.map((g, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', borderRadius: 4, marginBottom: 3, background: i === 0 ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.02)', fontSize: 10 }}>
              <span style={{ fontWeight: 600 }}>#{i + 1} {g.exercise.name}</span>
              <span style={{ color: '#22c55e' }}>{g.rp.score}/10</span>
              <span style={{ color: DIM, fontSize: 8 }}>{g.exercise.type === 'compound' ? 'База' : 'Изол.'}</span>
            </div>
          ))
        ) : <div style={{ fontSize: 10, color: DIM, padding: 8 }}>Нет stretch-mediated упражнений в этой группе.</div>}
      </div>

      <div style={{ ...CARD, marginBottom: 12, border: '1px solid rgba(59,130,246,0.2)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa', marginBottom: 8 }}>📍 Покрытие подрегионов: {regionalCoverage.covered.length}/{regionalCoverage.total}</div>
        {regionalCoverage.covered.length > 0 && (
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 9, color: '#22c55e', fontWeight: 600, marginBottom: 2 }}>✅ Покрыты:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {regionalCoverage.covered.map(r => <span key={r} style={{ padding: '2px 8px', borderRadius: 10, fontSize: 8, background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>{r}</span>)}
            </div>
          </div>
        )}
        {regionalCoverage.uncovered.length > 0 && (
          <div>
            <div style={{ fontSize: 9, color: '#ef4444', fontWeight: 600, marginBottom: 2 }}>❌ Не покрыты:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {regionalCoverage.uncovered.map(r => <span key={r} style={{ padding: '2px 8px', borderRadius: 10, fontSize: 8, background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>{r}</span>)}
            </div>
          </div>
        )}
      </div>

      <div style={{ ...CARD, marginBottom: 12, border: '1px solid rgba(251,146,60,0.2)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fb923c', marginBottom: 8 }}>🔗 Сила синергии: лучшие пары</div>
        {synergyPairs.length > 0 ? (
          synergyPairs.map((p, i) => (
            <div key={i} style={{ padding: '6px 8px', borderRadius: 6, marginBottom: 4, background: 'rgba(251,146,60,0.04)', border: '1px solid rgba(251,146,60,0.1)', fontSize: 9 }}>
              <div style={{ fontWeight: 700, color: '#fff', marginBottom: 2 }}>{p.a} + {p.b}</div>
              <div style={{ color: DIM }}>{p.type}: {p.reason}</div>
            </div>
          ))
        ) : <div style={{ fontSize: 10, color: DIM, padding: 8 }}>Нет явных синергетических пар в этой группе.</div>}
      </div>

      <div style={{ ...CARD, border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: DIM, marginBottom: 8 }}>📋 Полная таблица анализа</div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '2px 4px', fontSize: 8, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 4, marginBottom: 4 }}>
          <span style={{ color: DIM }}>Упражнение</span>
          <span style={{ color: DIM, textAlign: 'center' }}>Профиль</span>
          <span style={{ color: DIM, textAlign: 'center' }}>Force-вектор</span>
          <span style={{ color: DIM, textAlign: 'center' }}>Тех. счёт</span>
          <span style={{ color: DIM, textAlign: 'center' }}>Безоп.</span>
        </div>
        {groupExercises.map((g, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '2px 4px', padding: '3px 0', fontSize: 8, borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
            <span style={{ fontWeight: 600 }}>{g.exercise.name}</span>
            <span style={{ textAlign: 'center', color: g.rp.curve === 'stretch_mediated' ? '#22c55e' : g.rp.curve === 'mid_range' ? '#60a5fa' : '#f59e0b' }}>{g.rp.score}/10</span>
            <span style={{ textAlign: 'center', color: '#c084fc' }}>{g.fv.replace(/_/g, ' ')}</span>
            <span style={{ textAlign: 'center', color: getRiskColor(g.score.level) }}>{g.score.total}</span>
            <span style={{ textAlign: 'center', color: getRiskColor(g.safety.level) }}>{g.safety.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProAnalysisTab;
