import React, { useRef, useState, useCallback } from 'react';
import { EXERCISE_CATALOG, getSubstitutes, canReplace, getExerciseById } from '../../../../core/exercise-catalog';
import { calcExercisePrescription } from '../../../../engines/training.engine';
import { generateRepTempo } from '../../../../engines/rep-tempo-engine';
import { PCT_FOR_RIR, GROUP_RU, ACCENT, DIM, SET_TEMPLATES, type ManualResult } from './types';
import type { TrainingProfile } from '../training-profile';

interface Props {
  result: ManualResult | null;
  manualWorkMax: Record<string, number>;
  tprofile: TrainingProfile;
  goal: string;
  level: string;
  mesoLength: number;
  daysPerWeek: number;
  setResult: (r: ManualResult | null) => void;
  onToRuntime: () => void;
}

export const PlanDisplay: React.FC<Props> = ({
  result, manualWorkMax, tprofile, goal, level, mesoLength, daysPerWeek,
  setResult, onToRuntime,
}) => {
  const [subModal, setSubModal] = useState<{ dayIdx: number; exIdx: number; options: { id: string; name: string; reason: string }[] } | null>(null);
  const [inlineEdit, setInlineEdit] = useState<{ dayIdx: number; exIdx: number; field: string; value: string } | null>(null);
  const [dragFrom, setDragFrom] = useState<{ dayIdx: number; exIdx: number } | null>(null);
  const [showMacroPreview, setShowMacroPreview] = useState(false);
  const [exerciseTempos, setExerciseTempos] = useState<Record<string, string>>({});
  const [tempoPicker, setTempoPicker] = useState<{ dayIdx: number; exIdx: number } | null>(null);
  const inlineRef = useRef<HTMLInputElement | null>(null);

  const startInline = useCallback((di: number, ei: number, field: string, val: string | number) => {
    setInlineEdit({ dayIdx: di, exIdx: ei, field, value: String(val) });
    setTimeout(() => inlineRef.current?.focus(), 10);
  }, []);

  const commitInline = useCallback(() => {
    if (!inlineEdit || !result) { setInlineEdit(null); return; }
    const { dayIdx, exIdx, field, value } = inlineEdit;
    const old = result.days[dayIdx]?.exercises[exIdx];
    if (!old) { setInlineEdit(null); return; }
    const days = result.days.map((d, di) => di === dayIdx ? { ...d, exercises: d.exercises.map((ex, ei) => {
      if (ei !== exIdx) return ex;
      const ne = { ...ex };
      if (field === 'sets') ne.sets = parseInt(value) || ex.sets;
      else if (field === 'reps') ne.reps = value;
      else if (field === 'rir') { const v = parseInt(value); if (!isNaN(v)) ne.rir = v; }
      else if (field === 'weight') { const v = parseInt(value); if (!isNaN(v)) ne.weight = v; }
      else if (field === 'rest') { const v = parseInt(value); if (!isNaN(v)) ne.rest = v; }
      return ne;
    }) } : d);
    setResult({ ...result, days, corrections: [...result.corrections, `✏️ ${old.name}: ${field}=${value}`] });
    setInlineEdit(null);
  }, [inlineEdit, result, setResult]);

  const openSubstitute = useCallback((di: number, ei: number) => {
    if (!result) return;
    const e = result.days[di]?.exercises[ei]; if (!e) return;
    const cat = EXERCISE_CATALOG.find(c => c.name === e.name) || getExerciseById(e.name);
    if (!cat) { setSubModal({ dayIdx: di, exIdx: ei, options: [] }); return; }
    const sub = getSubstitutes(cat.id);
    const opts: { id: string; name: string; reason: string }[] = [];
    if (sub) { for (const s of sub.substitutes) { if (!canReplace(cat.id, s.id)) continue; const rep = getExerciseById(s.id); opts.push({ id: s.id, name: rep?.name || s.id, reason: s.reason }); } }
    if (opts.length === 0) { EXERCISE_CATALOG.filter(c => c.group === cat.group && c.id !== cat.id && canReplace(cat.id, c.id)).slice(0, 6).forEach(c => opts.push({ id: c.id, name: c.name, reason: 'Альтернатива той же группы' })); }
    setSubModal({ dayIdx: di, exIdx: ei, options: opts });
  }, [result]);

  const applySubstitute = useCallback((newId: string) => {
    if (!subModal || !result) return;
    const rep = getExerciseById(newId); if (!rep) { setSubModal(null); return; }
    const { dayIdx, exIdx } = subModal;
    const old = result.days[dayIdx].exercises[exIdx];
    const reason = subModal.options.find(o => o.id === newId)?.reason || '';
    const wm = (tprofile.workMax[rep.group] || manualWorkMax[rep.group] || 80);
    const pct = PCT_FOR_RIR[Math.max(0, Math.min(5, old.rir))] ?? 0.9;
    const weight = Math.round(wm * pct);
    const days = result.days.map((d, di) => di === dayIdx ? { ...d, exercises: d.exercises.map((ex, ei) => ei === exIdx ? { ...ex, name: rep.name, group: rep.group, weight } : ex) } : d);
    setResult({ ...result, days, corrections: [...result.corrections, `🔄 Замена: «${old.name}» → «${rep.name}» (${reason}). Вес ${weight} кг.`] });
    setSubModal(null);
  }, [subModal, result, tprofile, manualWorkMax, setResult]);

  const handleDragStart = useCallback((e: React.DragEvent, di: number, ei: number) => {
    setDragFrom({ dayIdx: di, exIdx: ei }); e.dataTransfer.effectAllowed = 'move';
  }, []);
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }, []);
  const handleDrop = useCallback((e: React.DragEvent, tDay: number, tEx: number) => {
    e.preventDefault(); if (!dragFrom || !result) return;
    const { dayIdx: fDay, exIdx: fEx } = dragFrom;
    if (fDay === tDay && fEx === tEx) { setDragFrom(null); return; }
    const days = result.days.map(d => ({ ...d, exercises: [...d.exercises.map(ee => ({ ...ee }))] }));
    const moved = days[fDay].exercises.splice(fEx, 1)[0]; if (!moved) { setDragFrom(null); return; }
    const insertAt = fDay === tDay && tEx > fEx ? tEx - 1 : tEx;
    days[tDay].exercises.splice(insertAt, 0, moved);
    setResult({ ...result, days, corrections: [...result.corrections, `↕️ «${moved.name}» — День ${days[fDay].day} → День ${days[tDay].day}.`] });
    setDragFrom(null);
  }, [dragFrom, result, setResult]);

  const copyDay = useCallback((di: number) => {
    if (!result) return;
    const src = result.days[di]; const newNum = Math.max(...result.days.map(d => d.day)) + 1;
    setResult({ ...result, days: [...result.days, { ...src, day: newNum, exercises: src.exercises.map(e => ({ ...e })) }], corrections: [...result.corrections, `📋 День ${src.day} скопирован → День ${newNum}.`] });
  }, [result, setResult]);

  const massEditWeight = useCallback((pct: number) => {
    if (!result) return;
    const sgn = pct > 0 ? '+' : '';
    const days = result.days.map(d => ({ ...d, exercises: d.exercises.map(e => ({ ...e, weight: Math.round(e.weight * (1 + pct / 100)) })) }));
    setResult({ ...result, days, corrections: [...result.corrections, `⚡ Масс-правка: веса ${sgn}${pct}%.`] });
  }, [result, setResult]);

  const massEditVolume = useCallback((pct: number) => {
    if (!result) return;
    const sgn = pct > 0 ? '+' : '';
    const days = result.days.map(d => ({ ...d, exercises: d.exercises.map(e => ({ ...e, sets: Math.max(1, Math.round(e.sets * (1 + pct / 100))) })) }));
    setResult({ ...result, days, corrections: [...result.corrections, `⚡ Масс-правка: объём ${sgn}${pct}%.`] });
  }, [result, setResult]);

  const applySetTemplate = useCallback((di: number, ei: number, key: string) => {
    if (!result) return;
    const t = SET_TEMPLATES[key]; if (!t) return;
    const e = result.days[di].exercises[ei];
    const pct = PCT_FOR_RIR[Math.max(0, Math.min(5, t.rir))] ?? 0.9;
    const wm = tprofile.workMax[e.group] || manualWorkMax[e.group] || 80;
    const days = result.days.map((d, di2) => di2 === di ? { ...d, exercises: d.exercises.map((ex, ei2) => ei2 === ei ? { ...ex, sets: t.sets, reps: t.reps, rir: t.rir, rest: t.rest, weight: Math.round(wm * pct) } : ex) } : d);
    setResult({ ...result, days, corrections: [...result.corrections, `⚡ Шаблон «${key}» → «${e.name}»: ${t.sets}×${t.reps}, RIR ${t.rir}.`] });
  }, [result, tprofile, manualWorkMax, setResult]);

  if (!result) return null;

  return (
    <div style={{ marginTop: 10, padding: 10, borderRadius: 12, border: '1px solid rgba(0,230,138,0.25)', background: 'rgba(0,230,138,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: ACCENT }}>📋 Результат: {result.splitName}</div>
        <span style={{ fontSize: 10, fontWeight: 700, color: ACCENT, background: 'rgba(0,230,138,0.12)', padding: '3px 8px', borderRadius: 8 }}>
          {result.days.length} дн/нед · {mesoLength} нед
        </span>
      </div>

      {result.corrections?.length > 0 && (
        <div style={{ marginTop: 6, padding: 10, borderRadius: 10, background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#60a5fa', marginBottom: 6 }}>📝 Комментарии к плану</div>
          {result.corrections.map((c, i) => (
            <div key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5, marginBottom: 3, paddingLeft: 4, borderLeft: '2px solid rgba(59,130,246,0.4)' }}>{c}</div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: DIM, alignSelf: 'center' }}>⚡ Масс-правка:</span>
        <button onClick={() => massEditWeight(5)} style={massBtnStyle(ACCENT)}>+5% вес</button>
        <button onClick={() => massEditWeight(-5)} style={massBtnStyle(ACCENT)}>−5% вес</button>
        <button onClick={() => massEditVolume(-20)} style={massBtnStyle('#ef4444')}>−20% объём</button>
        <button onClick={() => massEditVolume(10)} style={massBtnStyle(ACCENT)}>+10% объём</button>
        <button onClick={() => setShowMacroPreview(v => !v)} style={massBtnStyle('#a855f7')}>
          {showMacroPreview ? '▲ Скрыть' : '📅 Макроцикл'}
        </button>
      </div>

      {showMacroPreview && <MacroPreview result={result} mesoLength={mesoLength} level={level} />}

      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {result.days.map((d, di) => (
          <div key={d.day} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'rgba(0,230,138,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>🏋️ День {d.day}</span>
              <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 9, color: ACCENT, fontWeight: 700 }}>{d.groups.map(g => GROUP_RU[g] || g).join(' · ')}</span>
                <button onClick={() => copyDay(di)} title="Копировать день" style={{ padding: '1px 6px', borderRadius: 4, border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.08)', color: '#a855f7', cursor: 'pointer', fontSize: 9, fontWeight: 700 }}>📋</button>
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '14px 1.8fr 0.7fr 0.7fr 0.5fr 0.5fr 0.5fr 0.7fr', gap: 2, padding: '4px 10px', fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>
              <span></span><span>Упражнение</span><span>С×П</span><span>RIR</span><span>Вес</span><span>Группа</span><span>Отдых</span><span>Действия</span>
            </div>
            {d.exercises.map((e, ei) => {
              const tempoKey = `${di}-${ei}`;
              const overrideTempo = exerciseTempos[tempoKey];
              const tmpo = overrideTempo ? { tempo: { toString: overrideTempo } } : generateRepTempo({ goal: goal === 'strength' ? 'strength' : 'hypertrophy', riskLevel: 'low', difficultyLevel: 'medium', techniqueIssues: [], isMainLift: ei === 0 });
              return (
                <div key={ei} draggable onDragStart={ev => handleDragStart(ev, di, ei)} onDragOver={handleDragOver} onDrop={ev => handleDrop(ev, di, ei)} onDragEnd={() => setDragFrom(null)} style={{ display: 'grid', gridTemplateColumns: '14px 1.8fr 0.7fr 0.7fr 0.5fr 0.5fr 0.5fr 0.7fr', gap: 2, padding: '5px 10px', fontSize: 10, color: 'rgba(255,255,255,0.85)', borderTop: '1px solid rgba(255,255,255,0.04)', background: dragFrom?.dayIdx === di && dragFrom?.exIdx === ei ? 'rgba(0,230,138,0.1)' : 'transparent', cursor: 'grab', alignItems: 'center' }}>
                  <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', cursor: 'grab', userSelect: 'none' }}>⠿</span>
                  <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    {e.name}
                    <span onClick={(ev: React.MouseEvent) => { ev.stopPropagation(); setTempoPicker({ dayIdx: di, exIdx: ei }); }} title="Сменить темп" style={{ fontSize: 7, color: '#a855f7', fontWeight: 700, background: 'rgba(168,85,247,0.1)', padding: '1px 5px', borderRadius: 4, whiteSpace: 'nowrap', cursor: 'pointer', border: overrideTempo ? '1px solid #a855f7' : '1px solid transparent' }}>{overrideTempo || tmpo.tempo.toString}{overrideTempo ? ' *' : ''}</span>
                  </span>
                  <span onClick={() => startInline(di, ei, 'sets', e.sets)} style={{ cursor: 'text', color: ACCENT, fontWeight: 700 }}>{e.sets}×{e.reps}</span>
                  <span onClick={() => startInline(di, ei, 'rir', e.rir)} style={{ cursor: 'text', color: '#f59e0b' }}>{e.rir}</span>
                  <span onClick={() => startInline(di, ei, 'weight', e.weight)} style={{ cursor: 'text', color: '#60a5fa', fontWeight: 700 }}>{e.weight} кг</span>
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>{GROUP_RU[e.group] || e.group}</span>
                  <span onClick={() => startInline(di, ei, 'rest', e.rest)} style={{ cursor: 'text', color: 'rgba(255,255,255,0.6)' }}>{e.rest}с</span>
                  <span style={{ display: 'flex', gap: 2 }}>
                    <button onClick={(ev: React.MouseEvent) => { ev.stopPropagation(); openSubstitute(di, ei); }} title="Замена" style={actionBtnStyle(ACCENT)}>🔄</button>
                    <button onClick={(ev: React.MouseEvent) => { ev.stopPropagation(); const k = window.prompt('Шаблон (5×5, 3×8, 4×10, 3×12, AMRAP, Myo-rep, 10×10 GVT, 5/3/1):', '5×5'); if (k && SET_TEMPLATES[k]) applySetTemplate(di, ei, k); }} title="Шаблон" style={actionBtnStyle('#a855f7')}>⚡</button>
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <button onClick={onToRuntime} style={{ width: '100%', marginTop: 10, padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 13 }}>
        ▶ К выполнению (SessionPlayer)
      </button>

      {subModal && (
        <div onClick={() => setSubModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#18181b', borderRadius: 14, padding: 16, maxWidth: 400, width: '100%', maxHeight: '70vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: ACCENT, marginBottom: 10 }}>🔄 Замена упражнения</div>
            {subModal.options.length === 0 ? <div style={{ fontSize: 11, color: DIM }}>Нет доступных замен.</div> : subModal.options.map(o => (
              <button key={o.id} onClick={() => applySubstitute(o.id)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)', color: 'var(--text)', cursor: 'pointer', marginBottom: 4, fontSize: 11 }}>
                <div style={{ fontWeight: 700 }}>{o.name}</div>
                <div style={{ fontSize: 9, color: DIM }}>{o.reason}</div>
              </button>
            ))}
            <button onClick={() => setSubModal(null)} style={{ width: '100%', marginTop: 8, padding: 8, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: DIM, cursor: 'pointer' }}>Отмена</button>
          </div>
        </div>
      )}

      {inlineEdit && (
        <div onClick={() => setInlineEdit(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#18181b', borderRadius: 14, padding: 16, maxWidth: 300, width: '100%' }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: ACCENT }}>Изменить: {inlineEdit.field}</div>
            <input ref={inlineRef} type="text" value={inlineEdit.value}
              onChange={e => setInlineEdit({ ...inlineEdit, value: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter') commitInline(); if (e.key === 'Escape') setInlineEdit(null); }}
              autoFocus style={{ width: '100%', padding: 10, borderRadius: 8, background: '#000', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 14, boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={commitInline} style={{ flex: 1, padding: 8, borderRadius: 8, border: 'none', background: ACCENT, color: '#000', fontWeight: 700, cursor: 'pointer' }}>OK</button>
              <button onClick={() => setInlineEdit(null)} style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: DIM, cursor: 'pointer' }}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {tempoPicker && (
        <div onClick={() => setTempoPicker(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#18181b', borderRadius: 14, padding: 16, maxWidth: 320, width: '100%' }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: '#a855f7' }}>Темп (ECC-ISO-CON-PAUSE)</div>
            {['3-1-1-0', '4-1-1-0', '2-0-2-0', '3-0-1-0', '5-0-1-0', '2-1-2-0', '3-1-X-0', '4-2-2-0'].map(t => (
              <button key={t} onClick={() => { const k = `${tempoPicker.dayIdx}-${tempoPicker.exIdx}`; setExerciseTempos(p => ({ ...p, [k]: t })); setTempoPicker(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: 8, borderRadius: 8, border: '1px solid rgba(168,85,247,0.2)', background: 'rgba(168,85,247,0.06)', color: '#a855f7', cursor: 'pointer', marginBottom: 4, fontSize: 11, fontWeight: 600 }}>{t}</button>
            ))}
            <button onClick={() => { const k = `${tempoPicker.dayIdx}-${tempoPicker.exIdx}`; setExerciseTempos(p => { const n = { ...p }; delete n[k]; return n; }); setTempoPicker(null); }} style={{ width: '100%', marginTop: 4, padding: 8, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: DIM, cursor: 'pointer', fontSize: 10 }}>Сбросить</button>
          </div>
        </div>
      )}
    </div>
  );
};

function massBtnStyle(color: string): React.CSSProperties {
  return { padding: '3px 8px', borderRadius: 6, border: `1px solid ${color}40`, background: color + '10', color, cursor: 'pointer', fontSize: 9, fontWeight: 600 };
}
function actionBtnStyle(color: string): React.CSSProperties {
  return { padding: '2px 5px', borderRadius: 4, border: `1px solid ${color}50`, background: color + '14', color, cursor: 'pointer', fontSize: 10, fontWeight: 700 };
}

const MacroPreview: React.FC<{ result: ManualResult; mesoLength: number; level: string }> = ({ result, mesoLength, level }) => {
  const deloadFreq = level === 'beginner' ? 6 : level === 'advanced' ? 4 : 5;
  const deloadWeeks = new Set<number>();
  for (let w = deloadFreq; w <= mesoLength; w += deloadFreq) deloadWeeks.add(w);

  return (
    <div style={{ marginTop: 8, padding: 8, borderRadius: 10, background: 'rgba(168,85,247,0.04)', border: '1px solid rgba(168,85,247,0.15)' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#a855f7', marginBottom: 6 }}>
        📅 Макроцикл: {mesoLength} нед × {result.days.length} дн/нед
      </div>
      <div style={{ fontSize: 8, color: DIM, marginBottom: 4 }}>
        🟦 Делод каждые {deloadFreq} нед (нед: {[...deloadWeeks].join(', ')})
      </div>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: 4, minWidth: 'max-content' }}>
          {[...Array(Math.ceil(mesoLength))].map((_, wi) => {
            const wk = wi + 1;
            const isDeload = wk % deloadFreq === 0 && wk > 0;
            const heat = isDeload ? 0.25 : Math.min(1, (wi < mesoLength / 2 ? 65 + wi : 85 - (wi - mesoLength / 2)) / 100);
            const acColor = isDeload ? '#60a5fa' : '#a855f7';
            return (
              <div key={wi} style={{ padding: '4px 6px', borderRadius: 8, background: isDeload ? 'rgba(96,165,250,0.1)' : `rgba(168,85,247,${0.04 + heat * 0.1})`, border: `1px solid ${isDeload ? 'rgba(96,165,250,0.3)' : `rgba(168,85,247,${0.1 + heat * 0.2})`}`, minWidth: 72 }}>
                <div style={{ fontSize: 8, fontWeight: 700, color: acColor, textAlign: 'center', marginBottom: 3 }}>{isDeload ? '🔄 Делод' : `Нед ${wk}`}</div>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${result.days.length}, 1fr)`, gap: 2 }}>
                  {result.days.map((_, di2) => (
                    <div key={di2} style={{ height: 18, borderRadius: 3, background: isDeload ? 'rgba(96,165,250,0.3)' : `rgba(0,230,138,${0.15 + heat * 0.35})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 7, color: isDeload ? '#fff' : 'rgba(255,255,255,0.6)' }}>{isDeload ? '—' : `Д${di2 + 1}`}</span>
                    </div>
                  ))}
                </div>
                <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', marginTop: 2 }}>
                  <div style={{ height: '100%', width: isDeload ? '40%' : Math.round(heat * 100) + '%', borderRadius: 2, background: isDeload ? '#60a5fa' : heat > 0.75 ? '#f59e0b' : ACCENT }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
