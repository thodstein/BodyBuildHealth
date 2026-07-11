import React, { useMemo, useState, useCallback } from 'react';
import { EXERCISE_CATALOG } from '../../../../core/exercise-catalog';
import { calcExercisePrescription, LEVEL_VOLUMES } from '../../../../engines/training.engine';
import { labTrainingAdjust } from '../lab-training-adjust';
import { loadSRPESessions } from '../../../../engines/pro/srpe-store';
import { toDailyLoads, weeklyMonotony } from '../../../../engines/pro/training-load.engine';
import { loadReadinessHistory } from '../readiness-history';
import { PCT_FOR_RIR, GROUP_RU, ACCENT, DIM, type ManualResult } from './types';
import type { TrainingProfile } from '../training-profile';
import { prescribeLoad, suggestFeeders } from '../../../../engines/bb/bb-autocoach.engine';

interface Props {
  result: ManualResult | null;
  setResult: (r: ManualResult | null) => void;
  manualCfg: Record<string, string>;
  tprofile: TrainingProfile;
  goal: string; level: string;
  mesoLength: number;
  daysPerWeek: number;
  manualWorkMax: Record<string, number>;
  labAnalysis: any;
  onToRuntime: () => void;
}

export const ToolsPanel: React.FC<Props> = ({
  result, setResult, manualCfg, tprofile, goal, level, mesoLength, daysPerWeek,
  manualWorkMax, labAnalysis, onToRuntime,
}) => {
  const [improveModal, setImproveModal] = useState<{ notes: string[]; apply: () => void } | null>(null);
  const [planCopied, setPlanCopied] = useState(false);
  const [manualSavedPlans, setManualSavedPlans] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('myTrainingPlans') || '[]'); } catch { return []; }
  });
  const [manualTemplates, setManualTemplates] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('myTrainingTemplates') || '[]'); } catch { return []; }
  });
  const [comparePlan, setComparePlan] = useState<any | null>(null);
  const [showFeederSets, setShowFeederSets] = useState(false);
  const [showLoadStrategy, setShowLoadStrategy] = useState(false);
  const [showCompare, setShowCompare] = useState(false);

  const refreshSaved = useCallback(() => {
    try { setManualSavedPlans(JSON.parse(localStorage.getItem('myTrainingPlans') || '[]')); } catch { setManualSavedPlans([]); }
  }, []);
  const refreshTemplates = useCallback(() => {
    try { setManualTemplates(JSON.parse(localStorage.getItem('myTrainingTemplates') || '[]')); } catch { setManualTemplates([]); }
  }, []);

  const improveProgram = useCallback(() => {
    if (!result) return;
    const ru = (g: string) => GROUP_RU[g] || g;
    const wk: Record<string, number> = {};
    result.days.forEach(d => d.exercises.forEach(e => { wk[e.group] = (wk[e.group] || 0) + e.sets; }));
    const la = labTrainingAdjust(labAnalysis);
    const cmp = tprofile.onCourse ? (tprofile.courseIntensity === 'heavy' ? 1.3 : tprofile.courseIntensity === 'mild' ? 1.15 : 1.2) : 1;
    const mrv = (LEVEL_VOLUMES[level]?.mrv ?? 20) * cmp * la.mrvMultiplier;
    const notes: string[] = [];
    let days = result.days.map(d => ({ ...d, exercises: d.exercises.map(e => ({ ...e })) }));
    Object.entries(wk).forEach(([g, s]) => {
      if (s > mrv) {
        const excess = s - Math.round(mrv);
        let reduced = 0;
        for (const d of days) { for (const e of d.exercises) { if (e.group === g && reduced < excess) { const take = Math.min(Math.max(0, e.sets - 1), excess - reduced); if (take > 0) { e.sets -= take; reduced += take; } } } }
        if (reduced > 0) notes.push(`Снижен объём «${ru(g)}»: −${reduced} сетов (было >MRV ${Math.round(mrv)}).`);
      }
    });
    tprofile.weakPoints.forEach((w: string) => {
      if ((wk[w] || 0) === 0) {
        const cat = EXERCISE_CATALOG.find(e => e.group === w && e.type === 'compound' && (tprofile.equipment.length === 0 || tprofile.equipment.includes(e.equipment)));
        if (cat) {
          const dayIdx = days.findIndex(d => d.groups.includes(w));
          const target = dayIdx >= 0 ? dayIdx : 0;
          const pr = calcExercisePrescription(cat, goal, level, true, false, 1, 1, mesoLength);
          const wm = tprofile.workMax[w] || manualWorkMax[w] || 80;
          const pct = PCT_FOR_RIR[Math.max(0, Math.min(5, pr.rir))] ?? 0.9;
          days[target].exercises.push({ name: cat.name, sets: pr.sets, reps: pr.reps, rir: pr.rir, rest: pr.rest, group: w, weight: Math.round(wm * pct) });
          notes.push(`Добавлено для слабой группы «${ru(w)}»: ${cat.name} (${pr.sets}×${pr.reps}).`);
        } else { notes.push(`Слабая группа «${ru(w)}» не покрыта — нет подходящего упражнения.`); }
      }
    });
    Object.entries(wk).forEach(([g, s]) => {
      if (s > 0 && s < Math.max(4, mrv * 0.4)) {
        for (const d of days) { const e = d.exercises.find(ex => ex.group === g); if (e) { e.sets += 1; notes.push(`Группа «${ru(g)}»: низкий объём (${s} сетов) — +1 подход к «${e.name}».`); break; } }
      }
    });
    if (notes.length === 0) { setImproveModal({ notes: ['План уже сбалансирован.'], apply: () => setImproveModal(null) }); return; }
    setImproveModal({ notes, apply: () => { setResult({ ...result!, days, corrections: [...result!.corrections, '🎯 Улучшение программы:', ...notes] }); setImproveModal(null); } });
  }, [result, labAnalysis, tprofile, level, goal, mesoLength, manualWorkMax, setResult]);

  const exportWeeksText = useCallback(() => {
    if (!result || !result.weeks) return;
    const lines: string[] = ['Тренировочный план (ВСЕ НЕДЕЛИ): ' + result.splitName];
    lines.push('Уровень: ' + level + ' · Цель: ' + goal + ' · ' + daysPerWeek + ' дн/нед · ' + mesoLength + ' нед');
    result.weeks.forEach(w => {
      lines.push(''); lines.push(`═ НЕДЕЛЯ ${w.weekNumber} — ${w.phaseLabel} · RIR ${w.rir} ═`);
      w.days.forEach(d => {
        lines.push(''); lines.push(`  День ${d.day} (${d.groups.map(g => GROUP_RU[g] || g).join(', ')})`);
        d.exercises.forEach(e => lines.push(`    ${e.name} — ${e.sets}×${e.reps} @ RIR${e.rir} · ${e.weight} кг · ${e.rest}с`));
      });
    });
    try { navigator.clipboard?.writeText(lines.join('\n')); } catch {}
    setPlanCopied(true); setTimeout(() => setPlanCopied(false), 1800);
  }, [result, level, goal, daysPerWeek, mesoLength]);

  const recalcWeights = useCallback(() => {
    if (!result) return;
    const days = result.days.map(d => ({ ...d, exercises: d.exercises.map(e => {
      const cat = EXERCISE_CATALOG.find(cc => cc.name === e.name);
      const g = cat?.group || e.group;
      const wm = tprofile.workMax[g] || manualWorkMax[g] || 80;
      const pct = PCT_FOR_RIR[Math.max(0, Math.min(5, e.rir))] ?? 0.9;
      return { ...e, weight: Math.round(wm * pct) };
    }) }));
    setResult({ ...result, days, corrections: [...result.corrections, `🔄 Веса пересчитаны по workMax × %1RM(RIR).`] });
  }, [result, tprofile, manualWorkMax, setResult]);

  const exportText = useCallback(() => {
    if (!result) return;
    const lines: string[] = ['Тренировочный план: ' + result.splitName];
    lines.push('Уровень: ' + level + ' · Цель: ' + goal + ' · Дней/нед: ' + daysPerWeek + ' · Длина: ' + mesoLength + ' нед');
    if (result.corrections?.length) { lines.push(''); lines.push('Комментарии:'); result.corrections.forEach(c => lines.push('  • ' + c)); }
    result.days.forEach(d => { lines.push(''); lines.push('День ' + d.day + ' (' + d.groups.map(g => GROUP_RU[g] || g).join(', ') + ')'); d.exercises.forEach(e => lines.push('  ' + e.name + ' — ' + e.sets + 'x' + e.reps + ' @ RIR' + e.rir + ' · ' + e.weight + ' кг · ' + e.rest + 'с (' + e.group + ')')); });
    try { navigator.clipboard?.writeText(lines.join('\n')); } catch {}
    setPlanCopied(true); setTimeout(() => setPlanCopied(false), 1800);
  }, [result, level, goal, daysPerWeek, mesoLength]);

  const printPlan = useCallback(() => {
    if (!result) return;
    const rows = result.days.map(d => '<h3>День ' + d.day + ' (' + d.groups.map(g => GROUP_RU[g] || g).join(', ') + ')</h3><table border=1 cellpadding=4 style=border-collapse:collapse;width:100%><tr><th>Упражнение</th><th>С×П</th><th>RIR</th><th>Вес</th><th>Отдых</th></tr>' + d.exercises.map(e => '<tr><td>' + e.name + '</td><td>' + e.sets + '×' + e.reps + '</td><td>' + e.rir + '</td><td>' + e.weight + ' кг</td><td>' + e.rest + 'с</td></tr>').join('') + '</table>').join('');
    const html = '<html><head><meta charset=utf-8><title>' + result.splitName + '</title><style>body{font-family:Arial,sans-serif;padding:20px;color:#111}h1{color:#008}h3{margin-top:14px;color:#060}table{font-size:12px}</style></head><body><h1>' + result.splitName + '</h1><p>Уровень: ' + level + ' · Цель: ' + goal + ' · ' + daysPerWeek + ' дн/нед · ' + mesoLength + ' нед</p>' + rows + '</body></html>';
    const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 300); }
  }, [result, level, goal, daysPerWeek, mesoLength]);

  const savePlan = useCallback(() => {
    if (!result) return;
    try {
      const data = { name: `Конструктор: ${result.splitName}`, date: new Date().toISOString().slice(0, 10), cfg: manualCfg, days: result.days, corrections: result.corrections, generatedAt: Date.now() };
      const ex = JSON.parse(localStorage.getItem('myTrainingPlans') || '[]');
      ex.unshift(data); localStorage.setItem('myTrainingPlans', JSON.stringify(ex.slice(0, 30)));
      refreshSaved();
    } catch {}
  }, [result, manualCfg, refreshSaved]);

  const saveAsTemplate = useCallback(() => {
    if (!result) return;
    const name = window.prompt('Название шаблона:', result.splitName); if (!name) return;
    try { const t = { name, date: new Date().toISOString().slice(0, 10), cfg: manualCfg, days: result.days }; const ex = JSON.parse(localStorage.getItem('myTrainingTemplates') || '[]'); ex.unshift(t); localStorage.setItem('myTrainingTemplates', JSON.stringify(ex.slice(0, 30))); refreshTemplates(); } catch {}
  }, [result, manualCfg, refreshTemplates]);

  const loadPlan = useCallback((plan: any) => {
    if (plan?.days) setResult({ splitName: plan.name || 'Загруженный план', corrections: plan.corrections || [], days: plan.days });
  }, [setResult]);

  const deletePlan = useCallback((idx: number) => {
    try { const ex = JSON.parse(localStorage.getItem('myTrainingPlans') || '[]'); ex.splice(idx, 1); localStorage.setItem('myTrainingPlans', JSON.stringify(ex)); refreshSaved(); } catch {}
  }, [refreshSaved]);

  const deleteTemplate = useCallback((idx: number) => {
    try { const ex = JSON.parse(localStorage.getItem('myTrainingTemplates') || '[]'); ex.splice(idx, 1); localStorage.setItem('myTrainingTemplates', JSON.stringify(ex)); refreshTemplates(); } catch {}
  }, [refreshTemplates]);

  const quality = useMemo(() => {
    if (!result) return null;
    const la = labTrainingAdjust(labAnalysis);
    const mrvBase = (LEVEL_VOLUMES[level]?.mrv ?? 20) * (tprofile.onCourse ? (tprofile.courseIntensity === 'heavy' ? 1.3 : tprofile.courseIntensity === 'mild' ? 1.15 : 1.2) : 1) * la.mrvMultiplier;
    const wk: Record<string, number> = {};
    result.days.forEach(d => d.exercises.forEach(e => { wk[e.group] = (wk[e.group] || 0) + e.sets; }));
    const groups = Object.keys(wk);
    const over = groups.filter(g => wk[g] > mrvBase);
    const weakCovered = tprofile.weakPoints.filter((w: string) => (wk[w] || 0) > 0);
    const weakMissed = tprofile.weakPoints.filter((w: string) => (wk[w] || 0) === 0);
    let score = 100; score -= over.length * 12; score -= weakMissed.length * 10;
    score -= groups.filter(g => wk[g] > 0 && wk[g] < Math.max(4, mrvBase * 0.4)).length * 4;
    score = Math.max(0, Math.min(100, score));
    const srpe = loadSRPESessions();
    let monotonyNote = '';
    if (srpe.length >= 7) {
      const m = weeklyMonotony(toDailyLoads(srpe));
      if (m.monotony > 2) monotonyNote = `⚠ Монотонность ${m.monotony.toFixed(1)} (>2 — однообразие)`;
      else if (m.strain > 1000) monotonyNote = `⚠ Strain ${m.strain.toFixed(0)} (>1000 — перетрен)`;
      else monotonyNote = '✅ Монотонность/strain в норме';
    }
    return { score, over, weakCovered, weakMissed, wk, mrvBase, groups, monotonyNote };
  }, [result, level, tprofile, labAnalysis]);

  if (!result) return null;

  const qualityColor = quality ? quality.score >= 80 ? '#22c55e' : quality.score >= 60 ? '#f59e0b' : '#ef4444' : DIM;

  return (
    <>
      <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <button onClick={improveProgram} style={toolBtn(ACCENT)}>🎯 Улучшить</button>
        <button onClick={recalcWeights} style={toolBtn('#60a5fa')}>🔄 Пересчёт весов</button>
        <button onClick={exportText} style={toolBtn(ACCENT)}>{planCopied ? '✓ Скопировано' : '📋 Копировать (текст)'}</button>
        <button onClick={printPlan} style={toolBtn('#60a5fa')}>🖨 Печать/PDF</button>
        {result?.weeks && result.weeks.length > 1 && (
          <button onClick={exportWeeksText} style={toolBtn('#a855f7')}>📅 Все недели (копировать)</button>
        )}
        <button onClick={savePlan} style={toolBtn(ACCENT)}>💾 Сохранить</button>
        <button onClick={saveAsTemplate} style={toolBtn('#a855f7')}>⭐ Шаблон</button>
        <button onClick={() => setShowCompare(v => !v)} style={toolBtn('#f59e0b')}>⚖ Сравнить</button>
        <button onClick={onToRuntime} style={toolBtn(ACCENT)}>▶ Выполнить</button>
      </div>

      {quality && (
        <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: `${qualityColor}10`, border: `1px solid ${qualityColor}30` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: qualityColor }}>🎯 Качество плана</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: qualityColor }}>{quality.score}/100</span>
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
            {quality.over.length > 0 && <div style={{ color: '#ef4444' }}>⚠ Превышение MRV: {quality.over.map(g => GROUP_RU[g] || g).join(', ')}</div>}
            {quality.weakMissed.length > 0 && <div style={{ color: '#f59e0b' }}>⚠ Слабые группы не покрыты: {quality.weakMissed.map(g => GROUP_RU[g] || g).join(', ')}</div>}
            {quality.weakCovered.length > 0 && <div style={{ color: ACCENT }}>✅ Слабые группы покрыты: {quality.weakCovered.map(g => GROUP_RU[g] || g).join(', ')}</div>}
            {quality.monotonyNote && <div style={{ marginTop: 2 }}>{quality.monotonyNote}</div>}
            {quality.over.length === 0 && quality.weakMissed.length === 0 && <div style={{ color: ACCENT }}>✅ Объём в норме, слабые группы покрыты</div>}
          </div>
        </div>
      )}

      {/* Feeder sets for weak points */}
      {result && tprofile.weakPoints.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <button onClick={() => setShowFeederSets(v => !v)} style={{ width:'100%', padding:'8px 10px', borderRadius:8, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.15)', color:'#ef4444', cursor:'pointer', fontSize:10, fontWeight:700, textAlign:'left' }}>
            🔥 Feeder-сеты (ежедневно для слабых групп) {showFeederSets ? '▲' : '▼'}
          </button>
          {showFeederSets && (() => {
            const feeders = suggestFeeders(tprofile.weakPoints, tprofile.equipment);
            if (feeders.length === 0) return <div style={{ padding:'6px 10px', fontSize:9, color:DIM }}>Нет feeder-сетов для выбранных групп.</div>;
            return <div style={{ padding:'6px 10px', borderRadius:8, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.1)', marginTop:4 }}>
              {feeders.map((f, i) => <div key={i} style={{ marginBottom:6, fontSize:9, color:'rgba(255,255,255,0.8)' }}>
                <b>{f.exercise}</b> — {f.sets}×{f.reps} · {f.notes}
              </div>)}
            </div>;
          })()}
        </div>
      )}

      {/* Load strategy application */}
      {result && (
        <div style={{ marginTop: 8 }}>
          <button onClick={() => setShowLoadStrategy(v => !v)} style={{ width:'100%', padding:'8px 10px', borderRadius:8, background:'rgba(168,85,247,0.08)', border:'1px solid rgba(168,85,247,0.15)', color:'#a855f7', cursor:'pointer', fontSize:10, fontWeight:700, textAlign:'left' }}>
            📈 Стратегии прогрессии нагрузки {showLoadStrategy ? '▲' : '▼'}
          </button>
          {showLoadStrategy && (
            <div style={{ marginTop:4, display:'flex', flexDirection:'column', gap:4 }}>
              {(['double_progression','linear','wave','rpe_based'] as const).map(strat => {
                const label = { double_progression:'🔄 Двойная прогрессия', linear:'📈 Линейная', wave:'🌊 Волновая', rpe_based:'🎯 RPE' }[strat];
                return <button key={strat} onClick={() => {
                  if (!result) return;
                  const days = result.days.map(d => ({
                    ...d, exercises: d.exercises.map(e => {
                      const wm = tprofile.workMax[e.group] || manualWorkMax[e.group] || 80;
                      const prescr = prescribeLoad(strat, e.weight, parseInt(e.reps) || 10, e.rir, wm, 1, mesoLength, '');
                      return { ...e, weight: prescr.nextWeight, rir: prescr.nextRIR, reps: String(prescr.nextReps) };
                    }),
                  }));
                  setResult({ ...result, days, corrections: [...result.corrections, `📈 Применена стратегия: ${strat}`] });
                  setShowLoadStrategy(false);
                }} style={{ padding:'6px 10px', borderRadius:6, fontSize:10, fontWeight:600, cursor:'pointer', border:'1px solid rgba(168,85,247,0.15)', background:'rgba(168,85,247,0.04)', color:'rgba(255,255,255,0.8)', textAlign:'left' }}>
                  {label}
                </button>;
              })}
            </div>
          )}
        </div>
      )}

      {showCompare && manualSavedPlans.length > 0 && (
        <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', marginBottom: 6 }}>⚖ Сравнение планов</div>
          <select onChange={e => { const p = manualSavedPlans.find((_, i) => i === parseInt(e.target.value)); if (p) setComparePlan(p); }} style={{ width: '100%', padding: 6, borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11 }}>
            <option value="">Выберите план...</option>
            {manualSavedPlans.map((p, i) => <option key={i} value={i}>{p.name} ({p.date})</option>)}
          </select>
          {comparePlan && (() => {
            const cur: Record<string, number> = {}; result.days.forEach(d => d.exercises.forEach(e => { cur[e.group] = (cur[e.group] || 0) + e.sets; }));
            const cmp: Record<string, number> = {}; (comparePlan.days || []).forEach((d: any) => (d.exercises || []).forEach((e: any) => { cmp[e.group] = (cmp[e.group] || 0) + e.sets; }));
            const allG = Array.from(new Set([...Object.keys(cur), ...Object.keys(cmp)]));
            return (
              <table style={{ width: '100%', marginTop: 6, fontSize: 10, borderCollapse: 'collapse' }}>
                <thead><tr><th style={thStyle}>Группа</th><th style={thStyle}>Текущий</th><th style={thStyle}>Сравнение</th><th style={thStyle}>Δ</th></tr></thead>
                <tbody>{allG.map(g => { const c = cur[g] || 0; const m = cmp[g] || 0; const d = c - m; return <tr key={g}><td style={tdStyle}>{GROUP_RU[g] || g}</td><td style={tdStyle}>{c}</td><td style={tdStyle}>{m}</td><td style={{ ...tdStyle, color: d > 0 ? '#22c55e' : d < 0 ? '#ef4444' : DIM }}>{d > 0 ? '+' : ''}{d}</td></tr>; })}</tbody>
              </table>
            );
          })()}
          <button onClick={() => { setShowCompare(false); setComparePlan(null); }} style={{ width: '100%', marginTop: 6, padding: 6, borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: DIM, cursor: 'pointer', fontSize: 10 }}>✕ Закрыть</button>
        </div>
      )}

      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: DIM, marginBottom: 4 }}>📁 Сохранённые программы ({manualSavedPlans.length})</div>
        {manualSavedPlans.length === 0 ? <div style={{ fontSize: 10, color: DIM }}>Нет сохранённых планов</div> : manualSavedPlans.slice(0, 5).map((p, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 3 }}>
            <span style={{ fontSize: 10, color: 'var(--text)' }}>{p.name} <span style={{ color: DIM, fontSize: 9 }}>({p.date})</span></span>
            <span style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => loadPlan(p)} style={{ padding: '3px 8px', borderRadius: 4, border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.06)', color: ACCENT, cursor: 'pointer', fontSize: 9, fontWeight: 600 }}>↩ Загрузить</button>
              <button onClick={() => deletePlan(i)} style={{ padding: '3px 6px', borderRadius: 4, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)', color: '#ef4444', cursor: 'pointer', fontSize: 9 }}>✕</button>
            </span>
          </div>
        ))}
      </div>

      {manualTemplates.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#a855f7', marginBottom: 4 }}>⭐ Шаблоны ({manualTemplates.length})</div>
          {manualTemplates.slice(0, 5).map((t, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderRadius: 8, background: 'rgba(168,85,247,0.04)', border: '1px solid rgba(168,85,247,0.15)', marginBottom: 3 }}>
              <span style={{ fontSize: 10, color: 'var(--text)' }}>{t.name} <span style={{ color: DIM, fontSize: 9 }}>({t.date})</span></span>
              <span style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => loadPlan(t)} style={{ padding: '3px 8px', borderRadius: 4, border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.08)', color: '#a855f7', cursor: 'pointer', fontSize: 9, fontWeight: 600 }}>↩</button>
                <button onClick={() => deleteTemplate(i)} style={{ padding: '3px 6px', borderRadius: 4, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)', color: '#ef4444', cursor: 'pointer', fontSize: 9 }}>✕</button>
              </span>
            </div>
          ))}
        </div>
      )}

      {improveModal && (
        <div onClick={() => setImproveModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#18181b', borderRadius: 14, padding: 16, maxWidth: 400, width: '100%', maxHeight: '70vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: ACCENT, marginBottom: 10 }}>🎯 Улучшение программы</div>
            {improveModal.notes.map((n, i) => <div key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5, marginBottom: 4, paddingLeft: 8, borderLeft: '2px solid rgba(0,230,138,0.3)' }}>{n}</div>)}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={improveModal.apply} style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: ACCENT, color: '#000', fontWeight: 700, cursor: 'pointer' }}>Применить</button>
              <button onClick={() => setImproveModal(null)} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: DIM, cursor: 'pointer' }}>Отмена</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

function toolBtn(color: string): React.CSSProperties {
  return { padding: '6px 10px', borderRadius: 6, border: `1px solid ${color}40`, background: color + '10', color, cursor: 'pointer', fontSize: 10, fontWeight: 700 };
}
const thStyle: React.CSSProperties = { padding: '4px 6px', borderBottom: '1px solid rgba(255,255,255,0.1)', fontSize: 9, color: DIM, textAlign: 'left' };
const tdStyle: React.CSSProperties = { padding: '4px 6px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 10, color: 'var(--text)' };
