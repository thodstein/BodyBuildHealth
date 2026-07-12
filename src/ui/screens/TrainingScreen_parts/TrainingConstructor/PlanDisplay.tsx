import React, { useRef, useState, useCallback, Fragment, useMemo } from 'react';
import { EXERCISE_CATALOG, getSubstitutes, canReplace, getExerciseById } from '../../../../core/exercise-catalog';
import { calcExercisePrescription } from '../../../../engines/training.engine';
import { generateRepTempo } from '../../../../engines/rep-tempo-engine';
import { PCT_FOR_RIR, GROUP_RU, ACCENT, DIM, SET_TEMPLATES, type ManualResult, type ManualWeek } from './types';
import type { TrainingProfile } from '../training-profile';
import { PHASE_LABELS, type BBPhase } from './phase-periodization';

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
  globalTempoStr?: string;
}

const PHASE_COLORS: Record<string, string> = {
  accumulation: '#22c55e',
  intensification: '#f59e0b',
  deload: '#60a5fa',
  peaking: '#ef4444',
};

function getExerciseNote(ex: { name: string; role?: string; rir: number; sets: number; reps: string; tempo?: string; group: string; weight: number }, idx: number, dayExs: any[], weeklySetsMap: Record<string, number>, corrections: string[]): string {
  const notes: string[] = [];
  if (idx === 0) notes.push('Первое упражнение дня — задаёт тон всей тренировке.');
  if (ex.role === 'main') {
    notes.push('Базовое движение. Прогрессируй вес/повторения каждую неделю (2.5-5 кг для верха, 5-10 кг для низа).');
    if (ex.rir <= 1) notes.push('Работа вблизи отказа. Страховка обязательна на последних 1-2 повторениях.');
  }
  if (ex.role === 'accessory') {
    notes.push('Изоляция. Mind-muscle connection и полная амплитуда важнее веса.');
  }
  if (ex.tempo) {
    const pts = ex.tempo.split('-').map(Number);
    if (pts.length === 4) {
      if (pts[0] >= 3) notes.push('Медленная эксцентрика ' + pts[0] + 'с — ключ к микротравмам.');
      if (pts[1] >= 2) notes.push('Пауза ' + pts[1] + 'с в растянутой позиции стимулирует саркомерогенез.');
    }
  }
  const ws = weeklySetsMap[ex.group] || 0;
  if (ws > 18) notes.push('⚠ Высокий недельный объём (' + ws + ' сетов).');
  if (ws < 8) notes.push('Низкий недельный объём (' + ws + ' сетов).');
  const catEntry = EXERCISE_CATALOG.find(c => c.name === ex.name);
  const caveats = (catEntry as any)?.caveats as string[] | undefined;
  if (caveats?.length) notes.push('Техника: ' + caveats[0]);
  if (ex.weight > 0 && ex.reps && parseInt(ex.reps) > 0) {
    const est1RM = Math.round(ex.weight / (0.95 - ex.rir * 0.03));
    if (est1RM > 0) notes.push('Расчётный 1ПМ: ~' + est1RM + ' кг');
  }
  return notes.join(' | ');
}

function calcQualityScore(days: any[], weeklySets: Record<string, number>, level: string, goal: string): { score: number; color: string; breakdown: { label: string; ok: boolean; detail: string }[] } {
  const breakdown: { label: string; ok: boolean; detail: string }[] = [];
  const MRV_MAP: Record<string, number> = { beginner: 15, intermediate: 20, advanced: 24, enhanced: 28 };
  const mrv = MRV_MAP[level] || 20;
  let score = 100;
  for (const [g, sets] of Object.entries(weeklySets)) {
    if (sets > mrv * 1.15) { score -= 8; breakdown.push({ label: 'Объём ' + g, ok: false, detail: g + ': ' + sets + ' сетов > MRV×1.15=' + Math.round(mrv * 1.15) + ' ⚠ перегруз' }); }
    else if (sets < mrv * 0.4) { score -= 6; breakdown.push({ label: 'Объём ' + g, ok: false, detail: g + ': ' + sets + ' сетов < MEV=' + Math.round(mrv * 0.4) + ' — недотрен' }); }
    else { breakdown.push({ label: 'Объём ' + g, ok: true, detail: g + ': ' + sets + ' сетов (MEV→MRV)' }); }
  }
  const groupsPresent = Object.keys(weeklySets).length;
  if (groupsPresent < 4) { score -= 10; breakdown.push({ label: 'Охват групп', ok: false, detail: groupsPresent + ' групп (мин. 4)' }); }
  else { breakdown.push({ label: 'Охват групп', ok: true, detail: groupsPresent + ' групп' }); }
  const totalEx = days.reduce((s: number, d: any) => s + d.exercises.length, 0);
  const avgEx = Math.round(totalEx / Math.max(1, days.length));
  if (avgEx < 3) { score -= 15; breakdown.push({ label: 'Плотность', ok: false, detail: avgEx + ' упр/день — слишком мало' }); }
  else if (avgEx > 14) { score -= 5; breakdown.push({ label: 'Плотность', ok: false, detail: avgEx + ' упр/день — слишком много' }); }
  else { breakdown.push({ label: 'Плотность', ok: true, detail: avgEx + ' упр/день — оптимально' }); }
  const hasMain = days.some((d: any) => d.exercises.some((e: any) => e.role === 'main'));
  if (!hasMain) { score -= 20; breakdown.push({ label: 'Базовые', ok: false, detail: 'Нет базовых упражнений' }); }
  else { breakdown.push({ label: 'Базовые', ok: true, detail: 'Есть compound-упражнения' }); }
  score = Math.max(0, Math.min(100, score));
  const color = score >= 80 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';
  return { score, color, breakdown };
}

function calcLoadAnalysis(days: any[]): { monotony: number; avgDaily: number; totalWeekly: number; dailyLoads: number[]; strain: number } {
  const dailyLoads = days.map((d: any) => d.exercises.reduce((s: number, e: any) => s + e.sets * e.weight, 0));
  const totalWeekly = dailyLoads.reduce((s: number, v: number) => s + v, 0);
  const avg = dailyLoads.length ? totalWeekly / dailyLoads.length : 0;
  const variance = dailyLoads.length ? dailyLoads.reduce((s: number, v: number) => s + (v - avg) ** 2, 0) / dailyLoads.length : 0;
  const std = Math.sqrt(variance);
  const monotony = avg > 0 ? std / avg : 0;
  const strain = monotony * totalWeekly;
  return { monotony, avgDaily: avg, totalWeekly, dailyLoads, strain };
}

function getWarmup(exercises: any[], goal: string): { general: string[]; specific: { ex: string; sets: string }[] } {
  const general: string[] = [];
  if (goal === 'strength' || goal === 'powerlifting') {
    general.push('5-10 мин кардио (вело/гребля) — повышение ЧСС');
    general.push('Динамическая растяжка: круговые тазом, махи ногами, вращения плечами');
    general.push('Активация: ягодичный мостик 2×15, планка 2×30с');
  } else {
    general.push('5-7 мин лёгкое кардио — разогрев');
    general.push('Динамическая растяжка: вращения рук/ног, наклоны, выпады без веса');
    general.push('Активация целевых мышц: лёгкие подходы [50%]');
  }
  const firstCompound = exercises.find((e: any) => e.role === 'main' || e.rest >= 150);
  const specific: { ex: string; sets: string }[] = [];
  if (firstCompound) {
    specific.push({ ex: firstCompound.name, sets: '1×5 @40%' });
    specific.push({ ex: firstCompound.name, sets: '1×3 @60%' });
    if (goal === 'strength' || goal === 'powerlifting') { specific.push({ ex: firstCompound.name, sets: '1×1 @75%' }); }
  }
  const isolationCount = exercises.filter((e: any) => e.role !== 'main' && e.rest < 150).length;
  if (isolationCount > 0) { specific.push({ ex: 'Изоляционные движения', sets: '1×10 @50% (разминочный подход)' }); }
  return { general, specific };
}

export const PlanDisplay: React.FC<Props> = ({
  result, manualWorkMax, tprofile, goal, level, mesoLength, daysPerWeek,
  setResult, onToRuntime, globalTempoStr,
}) => {
  const [subModal, setSubModal] = useState<{ dayIdx: number; exIdx: number; options: { id: string; name: string; reason: string }[] } | null>(null);
  const [inlineEdit, setInlineEdit] = useState<{ dayIdx: number; exIdx: number; field: string; value: string } | null>(null);
  const [dragFrom, setDragFrom] = useState<{ dayIdx: number; exIdx: number } | null>(null);
  const [showMacroPreview, setShowMacroPreview] = useState(false);
  const [exerciseTempos, setExerciseTempos] = useState<Record<string, string>>({});
  const [tempoPicker, setTempoPicker] = useState<{ dayIdx: number; exIdx: number } | null>(null);
  const [expandedEx, setExpandedEx] = useState<Set<string>>(new Set());
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
      else if (field === 'loadMode') ne.loadMode = value as 'weight' | 'velocity';
      else if (field === 'targetVelocity') { const v = parseFloat(value); if (!isNaN(v)) ne.targetVelocity = v; }
      return ne;
    }) } : d);
    setResult({ ...result, days, corrections: [...result.corrections, '✏️ ' + old.name + ': ' + field + '=' + value] });
    setInlineEdit(null);
  }, [inlineEdit, result, setResult]);

  const openSubstitute = useCallback((di: number, ei: number) => {
    if (!result) return;
    const e = result.days[di]?.exercises[ei]; if (!e) return;
    const cat = EXERCISE_CATALOG.find(c => c.name === e.name) || getExerciseById(e.name);
    if (!cat) { setSubModal({ dayIdx: di, exIdx: ei, options: [] }); return; }
    const opts: { id: string; name: string; reason: string }[] = [];
    const pattern = cat.movementPattern || 'unknown';
    const patternMatches = EXERCISE_CATALOG.filter(ex => ex.group === cat.group && ex.movementPattern === pattern && ex.id !== cat.id);
    patternMatches.forEach(ex => opts.push({ id: ex.id, name: ex.name, reason: 'Идеальная замена (Паттерн: ' + pattern + ')' }));
    const sub = getSubstitutes(cat.id);
    if (sub) { for (const s of sub.substitutes) { if (opts.find(o => o.id === s.id)) continue; const rep = getExerciseById(s.id); opts.push({ id: s.id, name: rep?.name || s.id, reason: s.reason }); } }
    if (opts.length === 0) { EXERCISE_CATALOG.filter(c => c.group === cat.group && c.id !== cat.id).slice(0, 6).forEach(c => opts.push({ id: c.id, name: c.name, reason: 'Альтернатива той же группы' })); }
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
    setResult({ ...result, days, corrections: [...result.corrections, '🔄 Замена: "' + old.name + '" → "' + rep.name + '" (' + reason + '). Вес ' + weight + ' кг.'] });
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
    setResult({ ...result, days, corrections: [...result.corrections, '↕️ "' + moved.name + '" — День ' + days[fDay].day + ' → День ' + days[tDay].day + '.'] });
    setDragFrom(null);
  }, [dragFrom, result, setResult]);

  const copyDay = useCallback((di: number) => {
    if (!result) return;
    const src = result.days[di]; const newNum = Math.max(...result.days.map(d => d.day)) + 1;
    setResult({ ...result, days: [...result.days, { ...src, day: newNum, exercises: src.exercises.map(e => ({ ...e })) }], corrections: [...result.corrections, '📋 День ' + src.day + ' скопирован → День ' + newNum + '.'] });
  }, [result, setResult]);

  const massEditWeight = useCallback((pct: number) => {
    if (!result) return;
    const sgn = pct > 0 ? '+' : '';
    const days = result.days.map(d => ({ ...d, exercises: d.exercises.map(e => ({ ...e, weight: Math.round(e.weight * (1 + pct / 100)) })) }));
    setResult({ ...result, days, corrections: [...result.corrections, '⚡ Масс-правка: веса ' + sgn + pct + '%.'] });
  }, [result, setResult]);

  const massEditVolume = useCallback((pct: number) => {
    if (!result) return;
    const sgn = pct > 0 ? '+' : '';
    const days = result.days.map(d => ({ ...d, exercises: d.exercises.map(e => ({ ...e, sets: Math.max(1, Math.round(e.sets * (1 + pct / 100))) })) }));
    setResult({ ...result, days, corrections: [...result.corrections, '⚡ Масс-правка: объём ' + sgn + pct + '%.'] });
  }, [result, setResult]);

  const applySetTemplate = useCallback((di: number, ei: number, key: string) => {
    if (!result) return;
    const t = SET_TEMPLATES[key]; if (!t) return;
    const e = result.days[di].exercises[ei];
    const pct = PCT_FOR_RIR[Math.max(0, Math.min(5, t.rir))] ?? 0.9;
    const wm = tprofile.workMax[e.group] || manualWorkMax[e.group] || 80;
    const days = result.days.map((d, di2) => di2 === di ? { ...d, exercises: d.exercises.map((ex, ei2) => ei2 === ei ? { ...ex, sets: t.sets, reps: t.reps, rir: t.rir, rest: t.rest, weight: Math.round(wm * pct) } : ex) } : d);
    setResult({ ...result, days, corrections: [...result.corrections, '⚡ Шаблон "' + key + '" → "' + e.name + '": ' + t.sets + '×' + t.reps + ', RIR ' + t.rir + '.'] });
  }, [result, tprofile, manualWorkMax, setResult]);

  /* ─── Переключение недель (фазовая периодизация) ─── */
  const goToWeek = useCallback((weekNum: number) => {
    if (!result || !result.weeks) return;
    const week = result.weeks.find(w => w.weekNumber === weekNum);
    if (!week) return;
    const switchNote = '📅 Неделя ' + weekNum + ' (' + week.phaseLabel + ', RIR ' + week.rir + (week.totalTonnage ? ', ~' + (week.totalTonnage / 1000).toFixed(1) + ' т' : '') + ')';
    setResult({
      ...result,
      currentWeek: weekNum,
      days: week.days,
      corrections: [...result.corrections, switchNote, ...(week.corrections?.length ? [''] : []), ...(week.corrections || [])],
    });
  }, [result, setResult]);

  if (!result) return null;

  const weeklySetsMap: Record<string, number> = {};
  result.days.forEach(d => d.exercises.forEach(e => { weeklySetsMap[e.group] = (weeklySetsMap[e.group] || 0) + e.sets; }));
  const quality = calcQualityScore(result.days, weeklySetsMap, level, goal);
  const load = calcLoadAnalysis(result.days);

  const hasWeeks = !!result.weeks?.length;
  const currentWeekNum = result.currentWeek || 1;
  const currentWeekMeta = result.weeks?.find(w => w.weekNumber === currentWeekNum);

  return (
    <div style={{ marginTop: 10, padding: 10, borderRadius: 12, border: '1px solid rgba(0,230,138,0.25)', background: 'rgba(0,230,138,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: ACCENT }}>📋 {result.splitName}</div>
        <span style={{ fontSize: 10, fontWeight: 700, color: ACCENT, background: 'rgba(0,230,138,0.12)', padding: '3px 8px', borderRadius: 8 }}>
          {result.days.length} дн/нед · {result.mesoLength || mesoLength} нед
        </span>
      </div>

      {/* ═══ ФАЗОВАЯ ШКАЛА (все недели) ═══ */}
      {hasWeeks && (() => {
        const wks = result.weeks!;
        return (
        <div style={{ marginTop: 8, padding: 8, borderRadius: 10, background: 'rgba(168,85,247,0.04)', border: '1px solid rgba(168,85,247,0.15)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#a855f7', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
            <span>📅 Фазы мезоцикла</span>
            {currentWeekMeta && (
              <span style={{ fontSize: 9, opacity: 0.7 }}>
                Нед {currentWeekNum}: {currentWeekMeta.phaseLabel} · RIR {currentWeekMeta.rir}
              </span>
            )}
          </div>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
            <div style={{ display: 'flex', gap: 3, minWidth: 'max-content' }}>
              {wks.map(w => {
                const isActive = w.weekNumber === currentWeekNum;
                const phaseColor = PHASE_COLORS[w.phase] || '#a855f7';
                const isDeload = w.phase === 'deload';
                return (
                  <button key={w.weekNumber} onClick={() => goToWeek(w.weekNumber)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                      padding: '5px 8px', borderRadius: 8, cursor: 'pointer', minWidth: 44,
                      border: isActive ? '2px solid ' + phaseColor : '1px solid ' + phaseColor + '40',
                      background: isActive ? phaseColor + '18' : phaseColor + '08',
                      transition: 'all 0.15s',
                    }}>
                    <span style={{ fontSize: 8, fontWeight: 700, color: isActive ? '#fff' : phaseColor }}>
                      {isDeload ? '🔄' : w.weekNumber}
                    </span>
                    <span style={{ fontSize: 6, fontWeight: 600, color: isActive ? phaseColor : phaseColor + 'aa', textTransform: 'uppercase', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>
                      {w.phaseLabel}
                    </span>
                    <div style={{
                      width: 16, height: 3, borderRadius: 2,
                      background: phaseColor,
                      opacity: isActive ? 1 : 0.5,
                    }} />
                  </button>
                );
              })}
            </div>
          </div>
          {/* Навигация ◀ ▶ */}
          <div style={{ display: 'flex', gap: 4, marginTop: 6, justifyContent: 'center' }}>
            <button onClick={() => { const p = wks.findIndex(w => w.weekNumber === currentWeekNum); if (p > 0) goToWeek(wks[p - 1].weekNumber); }}
              disabled={wks[0]?.weekNumber === currentWeekNum}
              style={{ padding: '3px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: DIM, cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>◀</button>
            <span style={{ fontSize: 9, color: DIM, padding: '3px 8px', alignSelf: 'center' }}>
              Нед {currentWeekNum} / {result.mesoLength || mesoLength}
            </span>
            <button onClick={() => { const p = wks.findIndex(w => w.weekNumber === currentWeekNum); if (p < wks.length - 1) goToWeek(wks[p + 1].weekNumber); }}
              disabled={wks[wks.length - 1]?.weekNumber === currentWeekNum}
              style={{ padding: '3px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: DIM, cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>▶</button>
          </div>
        </div>
        );
      })()}

      {result.corrections?.length > 0 && (
        <div style={{ marginTop: 6, padding: 10, borderRadius: 10, background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#60a5fa', marginBottom: 6 }}>📝 Комментарии к плану</div>
          {result.corrections.map((c, i) => (
            <div key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5, marginBottom: 3, paddingLeft: 4, borderLeft: '2px solid rgba(59,130,246,0.4)' }}>{c}</div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 8, padding: 10, borderRadius: 10, border: '1px solid ' + quality.color + '40', background: quality.color + '08' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: quality.color }}>🎯 Качество плана</span>
          <span style={{ fontSize: 20, fontWeight: 900, color: quality.color }}>{quality.score}<span style={{ fontSize: 11, fontWeight: 600, opacity: 0.6 }}>/100</span></span>
        </div>
        <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', marginBottom: 8 }}>
          <div style={{ height: '100%', width: quality.score + '%', borderRadius: 2, background: quality.color, transition: 'width 1s' }} />
        </div>
        {quality.breakdown.map((b, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, fontSize: 10, color: b.ok ? 'rgba(255,255,255,0.7)' : quality.color }}>
            <span style={{ fontSize: 9 }}>{b.ok ? '✅' : '❌'}</span>
            <span style={{ fontWeight: 700, minWidth: 80 }}>{b.label}</span>
            <span style={{ opacity: 0.8 }}>{b.detail}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: 'rgba(96,165,250,0.04)', border: '1px solid rgba(96,165,250,0.15)' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#60a5fa', marginBottom: 6 }}>📊 Анализ нагрузки</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          <div style={{ padding: 6, borderRadius: 6, background: 'rgba(255,255,255,0.03)' }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: DIM, textTransform: 'uppercase' }}>Тоннаж/нед</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#60a5fa' }}>{load.totalWeekly.toLocaleString()} кг</div>
          </div>
          <div style={{ padding: 6, borderRadius: 6, background: 'rgba(255,255,255,0.03)' }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: DIM, textTransform: 'uppercase' }}>Ср/день</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#60a5fa' }}>{Math.round(load.avgDaily).toLocaleString()} кг</div>
          </div>
          <div style={{ padding: 6, borderRadius: 6, background: 'rgba(255,255,255,0.03)' }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: DIM, textTransform: 'uppercase' }}>Монотонность</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: load.monotony > 1.5 ? '#ef4444' : load.monotony > 0.9 ? '#f59e0b' : '#22c55e' }}>{load.monotony.toFixed(2)}</div>
          </div>
        </div>
        {load.monotony > 1.5 && <div style={{ fontSize: 9, color: '#ef4444', marginTop: 6 }}>⚠ Монотонность высокая — добавьте вариативность</div>}
        {load.monotony > 0.9 && load.monotony <= 1.5 && <div style={{ fontSize: 9, color: '#f59e0b', marginTop: 6 }}>Монотонность в норме</div>}
        {load.monotony <= 0.9 && <div style={{ fontSize: 9, color: '#22c55e', marginTop: 6 }}>✅ Монотонность низкая — разнообразие отличное</div>}
      </div>

      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 8, fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.03em', textTransform: 'uppercase', minWidth: 40 }}>⚖️ Вес</span>
        <button onClick={() => massEditWeight(5)} style={massBtnStyle(ACCENT)}>+5%</button>
        <button onClick={() => massEditWeight(-5)} style={massBtnStyle(ACCENT)}>−5%</button>
        <span style={{ fontSize: 8, fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.03em', textTransform: 'uppercase', marginLeft: 6, minWidth: 40 }}>📦 Объём</span>
        <button onClick={() => massEditVolume(-20)} style={massBtnStyle('#ef4444')}>−20%</button>
        <button onClick={() => massEditVolume(10)} style={massBtnStyle(ACCENT)}>+10%</button>
        <span style={{ fontSize: 8, fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.03em', textTransform: 'uppercase', marginLeft: 6, minWidth: 40 }}>🗓️ План</span>
        <button onClick={() => setShowMacroPreview(v => !v)} style={massBtnStyle('#a855f7')}>
          {showMacroPreview ? '▲ Скрыть макроцикл' : '📅 Макроцикл'}
        </button>
      </div>

      {showMacroPreview && <MacroPreview result={result} mesoLength={mesoLength} level={level} />}

  {hasWeeks && (
    <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.15)' }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#22c55e', marginBottom: 8 }}>📈 ПРОГРЕССИЯ ПО НЕДЕЛЯМ: RIR / ОБЪЁМ / ТОННАЖ</div>
      {(() => {
        const wks = result.weeks || [];
        if (wks.length === 0) return null;
        const maxSets = Math.max(...wks.map(w => w.days.reduce((s: number, d: any) => s + d.exercises.reduce((ss: number, e: any) => ss + e.sets, 0), 0)));
        const maxTonnage = Math.max(...wks.map(w => w.days.reduce((s: number, d: any) => s + d.exercises.reduce((ss: number, e: any) => ss + e.sets * e.weight, 0), 0)));
        const barMaxW = 240;
        const isMulti = wks.length > 1 && new Set(wks.map(w => w.rir)).size > 1;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {wks.map(w => {
              const totalSets = w.days.reduce((s: number, d: any) => s + d.exercises.reduce((ss: number, e: any) => ss + e.sets, 0), 0);
              const totalTonnage = w.days.reduce((s: number, d: any) => s + d.exercises.reduce((ss: number, e: any) => ss + e.sets * e.weight, 0), 0);
              const pc = PHASE_COLORS[w.phase] || '#a855f7';
              return (
                <div key={w.weekNumber} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0' }}>
                  <button onClick={() => goToWeek(w.weekNumber)} style={{
                    minWidth: 36, padding: '2px 4px', borderRadius: 4, cursor: 'pointer',
                    border: w.weekNumber === currentWeekNum ? '1px solid ' + pc : '1px solid transparent',
                    background: w.weekNumber === currentWeekNum ? pc + '20' : 'transparent',
                    color: w.weekNumber === currentWeekNum ? '#fff' : 'rgba(255,255,255,0.6)',
                    fontSize: 9, fontWeight: 700, textAlign: 'center',
                  }}>{w.weekNumber}</button>
                  <div style={{ fontSize: 8, fontWeight: 600, minWidth: 72, color: pc }}>{w.phaseLabel}</div>
                  <div style={{ fontSize: 9, fontWeight: 700, minWidth: 22, textAlign: 'center', color: w.rir <= 1 ? '#ef4444' : w.rir <= 2 ? '#f59e0b' : '#22c55e' }}>RIR{w.rir}</div>
                  <div style={{ flex: 1, display: 'flex', gap: 2, alignItems: 'center' }}>
                    <div style={{
                      height: 10, width: Math.round((totalSets / Math.max(1, maxSets)) * barMaxW), borderRadius: 4,
                      background: totalSets > 0 ? pc : 'transparent', opacity: 0.7, minWidth: totalSets > 0 ? 4 : 0,
                      transition: 'width 0.5s',
                    }} />
                    <span style={{ fontSize: 7, fontWeight: 600, color: 'rgba(255,255,255,0.5)', minWidth: 20 }}>{totalSets}</span>
                  </div>
                  <div style={{ flex: 1, display: 'flex', gap: 2, alignItems: 'center' }}>
                    <div style={{
                      height: 8, width: Math.round((totalTonnage / Math.max(1, maxTonnage)) * barMaxW), borderRadius: 4,
                      background: totalTonnage > 0 ? '#60a5fa' : 'transparent', opacity: 0.6, minWidth: totalTonnage > 0 ? 4 : 0,
                      transition: 'width 0.5s',
                    }} />
                    <span style={{ fontSize: 7, fontWeight: 600, color: 'rgba(255,255,255,0.5)', minWidth: 30 }}>{(totalTonnage / 1000).toFixed(1)}k</span>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}
      <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 8, color: 'rgba(255,255,255,0.35)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 4 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#22c55e' }} /> сеты/нед</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#60a5fa' }} /> тоннаж (кг)</span>
        <span>RIR: 🟢3+ · 🟡1-2 · 🔴0</span>
        {(result.weeks?.length ?? 0) > 1 && new Set(result.weeks?.map(w => w.rir) ?? []).size > 1 && <span style={{ color: '#f59e0b' }}>⏳ волна RIR активна</span>}
      </div>
    </div>
  )}

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
            <details style={{ margin: '4px 10px' }}>
              <summary style={{ fontSize: 9, fontWeight: 700, color: '#a855f7', cursor: 'pointer', padding: '4px 0', opacity: 0.7 }}>
                🔥 Разминка ({goal === 'strength' || goal === 'powerlifting' ? 'силовой протокол' : 'гипертрофия'})
              </summary>
              <div style={{ padding: '6px 8px', marginBottom: 6, borderRadius: 6, background: 'rgba(168,85,247,0.04)', border: '1px solid rgba(168,85,247,0.1)' }}>
                {(getWarmup(d.exercises, goal).general.map((g, gi) => (
                  <div key={gi} style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, paddingLeft: 8, borderLeft: '2px solid rgba(168,85,247,0.2)', marginBottom: 2 }}>⚡ {g}</div>
                )))}
                {getWarmup(d.exercises, goal).specific.length > 0 && (
                  <div style={{ marginTop: 4, borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 4 }}>
                    <div style={{ fontSize: 8, fontWeight: 700, color: '#a855f7', marginBottom: 2, textTransform: 'uppercase' }}>Спец. подводка:</div>
                    {getWarmup(d.exercises, goal).specific.map((s, si) => (
                      <div key={si} style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, paddingLeft: 8 }}>🎯 {s.ex}: {s.sets}</div>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>💡 Тренер: разминка обязательна перед первым рабочим подходом.</div>
              </div>
            </details>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', margin: '0 -4px', padding: '0 2px', scrollbarWidth: 'none' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '14px 3fr 0.8fr 0.6fr 0.6fr 0.7fr 0.6fr 0.8fr', gap: 2, padding: '4px 10px', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', minWidth: 380 }}>
              <span></span><span>Упражнение</span><span>С×П</span><span>RIR</span><span>Вес</span><span>Группа</span><span>Отдых</span><span>Действия</span>
            </div>
             {d.exercises.map((e, ei) => {
              const tempoKey = di + '-' + ei;
              const overrideTempo = exerciseTempos[tempoKey];
              const tmpo = globalTempoStr ? { tempo: { toString: () => globalTempoStr } } : (overrideTempo ? { tempo: { toString: () => overrideTempo } } : generateRepTempo({ goal: goal === 'strength' ? 'strength' : 'hypertrophy', riskLevel: 'low', difficultyLevel: 'medium', techniqueIssues: [], isMainLift: ei === 0 }));
              const note = getExerciseNote(e, ei, d.exercises, weeklySetsMap, result.corrections);
              return (
                <Fragment key={ei}>
                  <div draggable onDragStart={ev => handleDragStart(ev, di, ei)} onDragOver={handleDragOver} onDrop={ev => handleDrop(ev, di, ei)} onDragEnd={() => setDragFrom(null)} style={{ display: 'grid', gridTemplateColumns: '14px 3fr 0.8fr 0.6fr 0.6fr 0.7fr 0.6fr 0.8fr', gap: 2, padding: '5px 10px', fontSize: 10, color: 'rgba(255,255,255,0.85)', borderTop: '1px solid rgba(255,255,255,0.04)', background: dragFrom?.dayIdx === di && dragFrom?.exIdx === ei ? 'rgba(0,230,138,0.1)' : 'transparent', cursor: 'grab', alignItems: 'center', minWidth: 380 }}>
                    <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', cursor: 'grab', userSelect: 'none' }}>⠿</span>
                    <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 8, padding: '1px 4px', borderRadius: 4, fontWeight: 800, textTransform: 'uppercase',
                        background: e.role === 'main' ? 'rgba(0,230,138,0.2)' : e.role === 'secondary' ? 'rgba(96,165,250,0.2)' : 'rgba(255,255,255,0.1)',
                        color: e.role === 'main' ? ACCENT : e.role === 'secondary' ? '#60a5fa' : DIM,
                        border: '0.5px solid ' + (e.role === 'main' ? ACCENT : e.role === 'secondary' ? '#60a5fa' : 'rgba(255,255,255,0.2)')
                      }}>{e.role === 'main' ? 'База' : e.role === 'secondary' ? 'Доп' : 'Изо'}</span>
                      {e.name}
                      <span onClick={(ev: React.MouseEvent) => { ev.stopPropagation(); setTempoPicker({ dayIdx: di, exIdx: ei }); }} title="Сменить темп" style={{ fontSize: 9, color: '#a855f7', fontWeight: 700, background: 'rgba(168,85,247,0.1)', padding: '2px 6px', borderRadius: 4, cursor: 'pointer', border: overrideTempo ? '1px solid #a855f7' : '1px solid transparent' }}>
                        {overrideTempo || (tmpo as any).tempo?.toString?.()}{overrideTempo ? ' *' : ''}
                      </span>
                    </span>
                    <span onClick={() => startInline(di, ei, 'sets', e.sets)} style={{ cursor: 'text', color: ACCENT, fontWeight: 700 }}>{e.sets}×{e.reps}</span>
                    <span onClick={() => startInline(di, ei, 'rir', e.rir)} style={{ cursor: 'text', color: '#f59e0b' }}>{e.rir}</span>
                    <span onClick={() => startInline(di, ei, 'weight', e.weight)} style={{ cursor: 'text', color: '#60a5fa', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                      {e.loadMode === 'velocity' ? (
                        <><span onClick={ev => { ev.stopPropagation(); setInlineEdit({ dayIdx: di, exIdx: ei, field: 'targetVelocity', value: String(e.targetVelocity || 0.5) }); }} style={{ color: '#a855f7' }}>{e.targetVelocity || 0.5} m/s</span>
                        <span onClick={ev => { ev.stopPropagation(); setInlineEdit({ dayIdx: di, exIdx: ei, field: 'loadMode', value: 'weight' }); }} style={{ fontSize: 8, opacity: 0.6, cursor: 'pointer' }}>→ кг</span></>
                      ) : (
                        <>{e.weight} кг
                        <span onClick={ev => { ev.stopPropagation(); setInlineEdit({ dayIdx: di, exIdx: ei, field: 'loadMode', value: 'velocity' }); }} style={{ fontSize: 8, opacity: 0.6, cursor: 'pointer' }}>→ m/s</span></>
                      )}
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.6)' }}>{GROUP_RU[e.group] || e.group}</span>
                    <span onClick={() => startInline(di, ei, 'rest', e.rest)} style={{ cursor: 'text', color: 'rgba(255,255,255,0.6)' }}>{e.rest}с</span>
                    <span style={{ display: 'flex', gap: 2 }}>
                      <button onClick={(ev: React.MouseEvent) => { ev.stopPropagation(); openSubstitute(di, ei); }} title="Замена" style={actionBtnStyle(ACCENT)}>🔄</button>
                      <button onClick={(ev: React.MouseEvent) => { ev.stopPropagation(); const k = window.prompt('Шаблон (5×5, 3×8, 4×10, 3×12, AMRAP, Myo-rep, 10×10 GVT, 5/3/1):', '5×5'); if (k && SET_TEMPLATES[k]) applySetTemplate(di, ei, k); }} title="Шаблон" style={actionBtnStyle('#a855f7')}>⚡</button>
                    </span>
                  </div>
                  {note && (
                    <div style={{ padding: '2px 10px 4px 10px', fontSize: 9, color: 'rgba(255,255,255,0.45)', lineHeight: 1.4, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      💡 {note}
                    </div>
                  )}
                  {/* Раскрываемые детали */}
                  <div style={{ padding: '1px 10px' }}>
                    {(() => {
                      const key = `${di}-${ei}`;
                      const isExp = expandedEx.has(key);
                      const exData = e as any;
                      const hasDetails = exData.technique || exData.rationale || (exData.substitutions?.length > 0) || (exData.warmupScheme?.length > 0) || exData.backoffWeight || exData.comments || exData.fatigueCost;
                      if (!hasDetails) return null;
                      return (
                        <>
                          <span onClick={() => {
                            const next = new Set(expandedEx);
                            isExp ? next.delete(key) : next.add(key);
                            setExpandedEx(next);
                          }} style={{ fontSize: 9, color: ACCENT, cursor: 'pointer', userSelect: 'none' }}>
                            {isExp ? '▲ Скрыть детали' : '▼ Подробнее'}
                          </span>
                          {isExp && (
                            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, padding: '4px 0 6px 4px', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                              {exData.rationale && <div>🎯 <b>Выбрано:</b> {exData.rationale}</div>}
                              {exData.technique && <div>📐 <b>Техника:</b> {exData.technique}</div>}
                              {exData.comments && <div>💬 {exData.comments}</div>}
                              {exData.substitutions?.length > 0 && <div>🔄 <b>Замены:</b> {exData.substitutions.join(', ')}</div>}
                              {exData.warmupScheme?.length > 0 && (
                                <div>🔥 <b>Разминка:</b> {exData.warmupScheme.map((w: any) => `${w.weight}кг×${w.reps} (${Math.round(w.pct*100)}%)`).join(' → ')}</div>
                              )}
                              {exData.backoffWeight && <div>⬇ <b>Добивка:</b> {exData.backoffWeight} кг (−20%)</div>}
                              {exData.fatigueCost && <div>⚡ <b>Утомление:</b> {exData.fatigueCost}/10</div>}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </Fragment>
              );
            })}
            </div>
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
              <button key={o.id} onClick={() => applySubstitute(o.id)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)', color: '#fff', cursor: 'pointer', marginBottom: 4, fontSize: 11 }}>
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
              <button key={t} onClick={() => { const k = tempoPicker.dayIdx + '-' + tempoPicker.exIdx; setExerciseTempos(p => ({ ...p, [k]: t })); setTempoPicker(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: 8, borderRadius: 8, border: '1px solid rgba(168,85,247,0.2)', background: 'rgba(168,85,247,0.06)', color: '#a855f7', cursor: 'pointer', marginBottom: 4, fontSize: 11, fontWeight: 600 }}>{t}</button>
            ))}
            <button onClick={() => { const k = tempoPicker.dayIdx + '-' + tempoPicker.exIdx; setExerciseTempos(p => { const n = { ...p }; delete n[k]; return n; }); setTempoPicker(null); }} style={{ width: '100%', marginTop: 4, padding: 8, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: DIM, cursor: 'pointer', fontSize: 10 }}>Сбросить</button>
          </div>
        </div>
      )}
    </div>
  );
};

function massBtnStyle(color: string): React.CSSProperties {
  return { padding: '3px 8px', borderRadius: 6, border: '1px solid ' + color + '40', background: color + '10', color, cursor: 'pointer', fontSize: 9, fontWeight: 600 };
}
function actionBtnStyle(color: string): React.CSSProperties {
  return { padding: '2px 5px', borderRadius: 4, border: '1px solid ' + color + '50', background: color + '14', color, cursor: 'pointer', fontSize: 10, fontWeight: 700 };
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
              <div key={wi} style={{ padding: '4px 6px', borderRadius: 8, background: isDeload ? 'rgba(96,165,250,0.1)' : 'rgba(168,85,247,' + (0.04 + heat * 0.1) + ')', border: '1px solid ' + (isDeload ? 'rgba(96,165,250,0.3)' : 'rgba(168,85,247,' + (0.1 + heat * 0.2) + ')'), minWidth: 72 }}>
                <div style={{ fontSize: 8, fontWeight: 700, color: acColor, textAlign: 'center', marginBottom: 3 }}>{isDeload ? '🔄 Делод' : 'Нед ' + wk}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(' + result.days.length + ', 1fr)', gap: 2 }}>
                  {result.days.map((_, di2) => (
                    <div key={di2} style={{ height: 18, borderRadius: 3, background: isDeload ? 'rgba(96,165,250,0.3)' : 'rgba(0,230,138,' + (0.15 + heat * 0.35) + ')', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 9, color: isDeload ? '#fff' : 'rgba(255,255,255,0.6)' }}>{isDeload ? '—' : 'Д' + (di2 + 1)}</span>
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
