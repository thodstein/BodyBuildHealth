import React, { useMemo, useState, useEffect } from 'react';
import { EXERCISE_CATALOG, getExerciseById, getSubstitutes } from '../../../core/exercise-catalog';
import { getExerciseBio } from '../../../data/exercise-biomechanics-db';
import { getTechnique, getCues, getErrorsForExercise, getProgression } from '../../../engines/genetic-deload-technique.engine';
import { classifyMovement, estimateDifficulty, getMuscleSynergy, getJointStress, assessSafety } from '../../../engines/movement-engines';
import { generateRepTempo } from '../../../engines/rep-tempo-engine';
import { forceVector, lengthenedPartials } from '../../../engines/pro/exercise-prescription.engine';
import { getMappedIds } from '../../../data/exercise-id-mapping';
import { PopupSelect } from '../SRCBBScreen_parts/TrainingPopups';
import {
  ACCENT, DIM, CARD, BORDER,
  GROUPS, GROUP_RU, GROUP_ICON, TYPE_RU, EQUIP_RU,
  SUBREGION_DEFS, SUB_REGION_COLORS,
  TechniqueDetail, calcTechniqueScore, getRiskColor, getJointEmoji,
  filterBtn, pill, secTitle, chipRow,
} from './ExerciseLabShared';
import { applyToPlanner } from './planner-bridge';

const COLLAPSED_HEIGHT = 42;

interface TechniqueTabProps {
  onSelectForCompare?: (id: string) => void;
}

const TechniqueTab: React.FC<TechniqueTabProps> = ({ onSelectForCompare }) => {
  const [group, setGroup] = useState('chest');
  const [viewMode, setViewMode] = useState<'subregion' | 'list'>('subregion');
  const [expandedEx, setExpandedEx] = useState<string | null>(null);
  const [expandedRegion, setExpandedRegion] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('he_elab_fav') || '[]'); } catch { return []; } });
  const [showFavOnly, setShowFavOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'compound' | 'isolation'>('all');
  const [filterDiff, setFilterDiff] = useState<'all' | 'beginner' | 'intermediate' | 'advanced'>('all');
  const [filterEquip, setFilterEquip] = useState('all');
  const [filterJoint, setFilterJoint] = useState('all');

  const equipmentOptions = useMemo(() => { const set = new Set(EXERCISE_CATALOG.map(e => e.equipment)); return ['all', ...Array.from(set).sort()]; }, []);
  useEffect(() => { try { localStorage.setItem('he_elab_fav', JSON.stringify(favorites)); } catch {} }, [favorites]);

  const toggleFav = (id: string) => setFavorites(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleExpandEx = (id: string) => setExpandedEx(prev => prev === id ? null : id);
  const toggleRegion = (id: string) => setExpandedRegion(prev => prev === id ? null : id);

  const subregions = SUBREGION_DEFS[group] || [];
  const groupedExercises = useMemo(() => {
    const allGroupExs = EXERCISE_CATALOG.filter(e => e.group === group);
    return subregions.map(sr => ({
      ...sr,
      exercises: allGroupExs.filter(ex => {
        const tm = (ex.targetMuscle || '').toLowerCase();
        return sr.keywords.some(kw => tm.includes(kw.toLowerCase()));
      }).map(ex => {
        const map = getMappedIds(ex.id);
        const lookupId = map.bio || map.movement || ex.id;
        return {
          exercise: ex,
          bio: getExerciseBio(lookupId),
          technique: getTechnique(ex.name),
          score: calcTechniqueScore(ex),
          cues: getCues(ex.name),
          errors: getErrorsForExercise(ex.name),
          progression: getProgression(ex.name),
          synergy: getMuscleSynergy(map.synergy || lookupId),
          jointStress: getJointStress(map.joint || lookupId),
          difficultyProfile: estimateDifficulty(lookupId),
          classification: classifyMovement(map.movement || lookupId),
          fVector: forceVector(ex.group, ex.type, ex.name),
          lengthened: lengthenedPartials(ex.group),
        };
      }),
    })).filter(sr => sr.exercises.length > 0);
  }, [group, subregions]);

  const flatList = useMemo(() => {
    let list = EXERCISE_CATALOG.filter(e => e.group === group);
    if (search.trim()) { const s = search.toLowerCase(); list = list.filter(e => e.name.toLowerCase().includes(s) || (e.targetMuscle || '').toLowerCase().includes(s)); }
    if (filterType !== 'all') list = list.filter(e => e.type === filterType);
    if (filterDiff !== 'all') list = list.filter(e => e.difficulty === filterDiff);
    if (filterEquip !== 'all') list = list.filter(e => e.equipment === filterEquip);
    if (filterJoint !== 'all') list = list.filter(e => { const bio = getExerciseBio(e.id); return bio ? (bio.jointStress as any)[filterJoint] <= 4 : e.jointStress !== 'high'; });
    if (showFavOnly) list = list.filter(e => favorites.includes(e.id));
    return list.map(ex => {
      const map = getMappedIds(ex.id);
      const lookupId = map.bio || map.movement || ex.id;
      return {
        exercise: ex,
        bio: getExerciseBio(lookupId),
        technique: getTechnique(ex.name),
        score: calcTechniqueScore(ex),
        cues: getCues(ex.name),
        errors: getErrorsForExercise(ex.name),
        progression: getProgression(ex.name),
        synergy: getMuscleSynergy(map.synergy || lookupId),
        jointStress: getJointStress(map.joint || lookupId),
        difficultyProfile: estimateDifficulty(lookupId),
        classification: classifyMovement(map.movement || lookupId),
        fVector: forceVector(ex.group, ex.type, ex.name),
        lengthened: lengthenedPartials(ex.group),
      };
    });
  }, [group, search, filterType, filterDiff, filterEquip, filterJoint, showFavOnly, favorites]);

  const totalInGroup = EXERCISE_CATALOG.filter(e => e.group === group).length;
  const totalCategorized = groupedExercises.reduce((s, sr) => s + sr.exercises.length, 0);

  const renderExHeader = (ex: any, score: any, bio: any, isFav: boolean, safety: any) => (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{ex.name}</span>
            <button onClick={e => { e.stopPropagation(); toggleFav(ex.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: 0, color: isFav ? '#f59e0b' : DIM }}>{isFav ? '★' : '☆'}</button>
            {onSelectForCompare && <button onClick={e => { e.stopPropagation(); onSelectForCompare(ex.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, padding: '2px 4px', color: DIM, fontWeight: 700 }} title="Добавить к сравнению">⇆</button>}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 3 }}>
            <span style={{ ...pill, background: ex.type === 'compound' ? 'rgba(0,230,138,0.15)' : 'rgba(59,130,246,0.15)', color: ex.type === 'compound' ? ACCENT : '#60a5fa' }}>{TYPE_RU[ex.type] || ex.type}</span>
            <span style={{ ...pill, background: 'rgba(168,85,247,0.12)', color: '#c084fc' }}>{EQUIP_RU[ex.equipment] || ex.equipment}</span>
            <span style={{ ...pill, background: ex.difficulty === 'beginner' ? 'rgba(34,197,94,0.12)' : ex.difficulty === 'advanced' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)', color: ex.difficulty === 'beginner' ? '#22c55e' : ex.difficulty === 'advanced' ? '#ef4444' : '#f59e0b' }}>{ex.difficulty === 'beginner' ? 'Новичок' : ex.difficulty === 'advanced' ? 'Продв.' : 'Средний'}</span>
            {ex.targetMuscle && <span style={{ ...pill, background: 'rgba(255,255,255,0.04)', color: DIM }}>{ex.targetMuscle}</span>}
          </div>
        </div>
        <div style={{ textAlign: 'center', minWidth: 50 }}>
          <div style={{ width: 42, height: 42, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `conic-gradient(${getRiskColor(score.level)} ${score.total * 3.6}deg, rgba(255,255,255,0.06) 0)`, margin: '0 auto' }}>
            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: -1 }}>{score.total}</div>
          </div>
          <div style={{ fontSize: 10, color: getRiskColor(score.level), marginTop: 1, fontWeight: 700 }}>{score.label}</div>
        </div>
      </div>
      {ex.technique && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, marginTop: 6, fontStyle: 'italic' }}>{ex.technique.length > 140 ? ex.technique.slice(0, 140) + '…' : ex.technique}</div>}
      <div style={{ display: 'flex', gap: 10, marginTop: 6, fontSize: 10 }}>
        <span>{getJointEmoji(ex.jointStress)} Суставы: {ex.jointStress === 'high' ? 'высокая' : ex.jointStress === 'med' ? 'средняя' : 'низкая'}</span>
        {bio && <span>🧠 ЦНС: {bio.cnsDemand}/5</span>}
        <span style={{ color: getRiskColor(safety.level) }}>{safety.level === 'safe' ? '✅ Безоп.' : safety.level === 'moderate' ? '⚠️ Вним.' : '🚫 Риск.'}</span>
        {ex.fatigueCost > 0 && <span style={{ color: DIM }}>⚡ Усталость: {ex.fatigueCost}/10</span>}
      </div>
    </>
  );

  const printExercise = (exId: string, htmlId: string) => {
    const el = document.getElementById(htmlId);
    if (el) {
      const w = window.open('', '_blank', 'width=800,height=600');
      if (w) {
        w.document.write(`<html><head><title>Техника</title><style>body{font-family:sans-serif;font-size:12px;line-height:1.6;padding:20px;color:#000;background:#fff}h2{color:#333}.s{margin:12px 0;padding:8px;border-left:3px solid #00e68a}.l{font-weight:700;color:#00e68a}</style></head><body>${el.innerHTML}</body></html>`);
        w.document.close();
        setTimeout(() => w.print(), 300);
      }
    }
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', color: '#fff' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <button onClick={() => setViewMode('subregion')} style={filterBtn(viewMode === 'subregion')}>📐 По подрегионам</button>
        <button onClick={() => setViewMode('list')} style={filterBtn(viewMode === 'list')}>📋 Списком</button>
        <button onClick={() => setShowFavOnly(v => !v)} style={filterBtn(showFavOnly)}>⭐ Избранное ({favorites.length})</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginBottom: 10 }}>
        <PopupSelect label="Целевая группа" value={group} options={GROUPS.filter(g => g !== 'all').map(g => ({ id: g, label: `${GROUP_ICON[g] || ''} ${GROUP_RU[g]}`, desc: '' }))} hint="Группа" onChange={v => { setGroup(v); setExpandedEx(null); setExpandedRegion(null); }} />
        {viewMode === 'list' && (
          <div>
            <div style={{ fontSize: 10, color: DIM, fontWeight: 600, marginBottom: 2 }}>Поиск</div>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Название упражнения…" style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 11, boxSizing: 'border-box', width: '100%' }} />
          </div>
        )}
      </div>

      {viewMode === 'list' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: DIM, fontWeight: 600, marginRight: 2 }}>Тип:</span>
          {(['all', 'compound', 'isolation'] as const).map(t => <button key={t} onClick={() => setFilterType(t)} style={filterBtn(filterType === t)}>{t === 'all' ? 'Все' : TYPE_RU[t]}</button>)}
          <span style={{ fontSize: 10, color: DIM, fontWeight: 600, marginLeft: 8, marginRight: 2 }}>Уровень:</span>
          {(['all', 'beginner', 'intermediate', 'advanced'] as const).map(d => <button key={d} onClick={() => setFilterDiff(d)} style={filterBtn(filterDiff === d)}>{d === 'all' ? 'Все' : d === 'beginner' ? 'Новичок' : d === 'advanced' ? 'Продв.' : 'Средний'}</button>)}
          <span style={{ fontSize: 10, color: DIM, fontWeight: 600, marginLeft: 8, marginRight: 2 }}>Оборуд.:</span>
          <PopupSelect label="Оборудование" value={filterEquip} options={equipmentOptions.map(eq => ({ id: eq, label: eq === 'all' ? 'Всё' : EQUIP_RU[eq] || eq, desc: '' }))} hint="Оборуд." onChange={v => setFilterEquip(v)} />
          <span style={{ fontSize: 10, color: DIM, fontWeight: 600, marginLeft: 8, marginRight: 2 }}>Щадящий:</span>
          <PopupSelect label="Щадящая нагрузка" value={filterJoint} options={[
            { id: 'all', label: 'Все', desc: '' }, { id: 'spine', label: 'Позвоночник', desc: '' }, { id: 'knee', label: 'Колени', desc: '' },
            { id: 'shoulder', label: 'Плечи', desc: '' }, { id: 'elbow', label: 'Локти', desc: '' }, { id: 'hip', label: 'Таз', desc: '' },
          ]} hint="Щадящий" onChange={v => setFilterJoint(v)} />
        </div>
      )}

      <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginBottom: 10 }}>
        {viewMode === 'list'
          ? <>{flatList.length} из {totalInGroup} упражнений · {GROUP_RU[group]}{search ? ` · «${search}»` : ''}{showFavOnly ? ' · ⭐ Избранное' : ''}</>
          : <>{totalCategorized} из {totalInGroup} упражнений группы «{GROUP_RU[group]}» · {groupedExercises.length} подрегионов{showFavOnly ? ' · ⭐ Избранное' : ''}</>}
      </div>

      {/* SUB-REGION VIEW */}
      {viewMode === 'subregion' && groupedExercises.map((sr, srIdx) => {
        const filteredExs = showFavOnly ? sr.exercises.filter(e => favorites.includes(e.exercise.id)) : sr.exercises;
        if (filteredExs.length === 0) return null;
        const isRegionExpanded = expandedRegion === sr.id;
        return (
          <div key={sr.id} style={{ marginBottom: 16 }}>
            <div onClick={() => toggleRegion(sr.id)} style={{ ...CARD, cursor: 'pointer', border: `2px solid ${SUB_REGION_COLORS[srIdx % SUB_REGION_COLORS.length]}33`, borderLeft: `4px solid ${SUB_REGION_COLORS[srIdx % SUB_REGION_COLORS.length]}`, marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: SUB_REGION_COLORS[srIdx % SUB_REGION_COLORS.length], marginBottom: 4 }}>{sr.name}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>{sr.description}</div>
                </div>
                <div style={{ textAlign: 'center', minWidth: 70 }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: SUB_REGION_COLORS[srIdx % SUB_REGION_COLORS.length] }}>{filteredExs.length}</div>
                  <div style={{ fontSize: 10, color: DIM }}>упражнений</div>
                </div>
              </div>
              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <button style={{ padding: '3px 12px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: DIM, cursor: 'pointer', fontSize: 10, fontWeight: 600 }}>{isRegionExpanded ? '▲ Свернуть' : '▼ Развернуть'}</button>
              </div>
            </div>
            {isRegionExpanded && (
              <div style={{ paddingLeft: 8, marginTop: 4 }}>
                {filteredExs.map(({ exercise: ex, bio, technique, score, cues, errors, progression, synergy, jointStress, classification, fVector, lengthened }) => {
                  const isExpanded = expandedEx === ex.id;
                  const safety = assessSafety(ex.id, [], score.total / 100);
                  const isFav = favorites.includes(ex.id);
                  const printId = `elab-t-${ex.id}`;
                  return (
                    <div key={ex.id} style={{ ...CARD, border: isExpanded ? '1px solid rgba(0,230,138,0.2)' : CARD.border, marginLeft: 4 }}>
                      <div onClick={() => toggleExpandEx(ex.id)} style={{ cursor: 'pointer' }}>
                        {renderExHeader(ex, score, bio, isFav, safety)}
                      </div>
                      {isExpanded && <>
                        <TechniqueDetail ex={ex} technique={technique} score={score} cues={cues} errors={errors} progression={progression} synergy={synergy} jointStress={jointStress} classification={classification} fVector={fVector} lengthened={lengthened} safety={safety} bio={bio} cssScale={0.9} />
                        {ex.comments && (
                          <div style={{ marginTop: 8 }}>
                            <div style={secTitle}>💬 Комментарий</div>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', lineHeight: 1.4, fontStyle: 'italic' }}>{ex.comments}</div>
                          </div>
                        )}
                      </>}
                      <div style={{ marginTop: isExpanded ? 10 : 4, textAlign: 'center', display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button onClick={() => toggleExpandEx(ex.id)} style={{ padding: '3px 14px', borderRadius: 14, border: '1px solid rgba(0,230,138,0.15)', background: isExpanded ? 'rgba(0,230,138,0.06)' : 'transparent', color: isExpanded ? ACCENT : DIM, cursor: 'pointer', fontSize: 10, fontWeight: 600 }}>{isExpanded ? '▲ Свернуть' : '▼ Разбор'}</button>
                        {isExpanded && <>
                          <button onClick={() => printExercise(ex.id, printId)} style={{ padding: '3px 10px', borderRadius: 5, border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.06)', color: ACCENT, cursor: 'pointer', fontWeight: 600, fontSize: 10 }}>🖨 Печать</button>
                          <button onClick={() => { navigator.clipboard.writeText(document.getElementById(printId)?.innerText || ''); }} style={{ padding: '3px 10px', borderRadius: 5, border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.06)', color: '#60a5fa', cursor: 'pointer', fontWeight: 600, fontSize: 10 }}>📋 Копировать</button>
                        </>}
                      </div>
                      {isExpanded && <div id={printId} style={{ display: 'none' }}>
                        <h2>{ex.name}</h2>
                        <p><b>Тип:</b> {TYPE_RU[ex.type]} · <b>Оборудование:</b> {EQUIP_RU[ex.equipment]} · <b>Сложность:</b> {score.label} ({score.total}/100)</p>
                        {technique ? <><div className="s"><p className="l">Исходное положение:</p><ul>{technique.setup.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div><div className="s"><p className="l">Выполнение:</p><ul>{technique.execution.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div><div className="s"><p className="l">Дыхание:</p><ul>{technique.breathing.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div></> : ex.technique ? <div className="s"><p className="l">Техника:</p><p>{ex.technique}</p></div> : null}
                        {errors.length > 0 && <div className="s"><p className="l">Ошибки:</p><ul>{errors.map((e: any, i: number) => <li key={i}><b>{e.error}</b> — {e.fix}</li>)}</ul></div>}
                        <p><b>Безопасность:</b> {safety.score}/100</p>
                        {ex.comments && <div className="s"><p className="l">Комментарий:</p><p>{ex.comments}</p></div>}
                      </div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* LIST VIEW */}
      {viewMode === 'list' && [...flatList].sort((a, b) => b.score.total - a.score.total).map(({ exercise: ex, bio, technique, score, cues, errors, progression, synergy, jointStress, classification, fVector, lengthened }) => {
        const isExpanded = expandedEx === ex.id;
        const safety = assessSafety(ex.id, [], score.total / 100);
        const isFav = favorites.includes(ex.id);
        const printId = `elab-l-${ex.id}`;
        return (
          <div key={ex.id} style={{ ...CARD, border: isExpanded ? '1px solid rgba(0,230,138,0.25)' : CARD.border, boxShadow: isExpanded ? '0 0 12px rgba(0,230,138,0.06)' : undefined, marginBottom: 8 }}>
            <div onClick={() => toggleExpandEx(ex.id)} style={{ cursor: 'pointer' }}>{renderExHeader(ex, score, bio, isFav, safety)}</div>
            {isExpanded && <>
              <TechniqueDetail ex={ex} technique={technique} score={score} cues={cues} errors={errors} progression={progression} synergy={synergy} jointStress={jointStress} classification={classification} fVector={fVector} lengthened={lengthened} safety={safety} bio={bio} />
              {ex.comments && (
                <div style={{ marginTop: 8 }}>
                  <div style={secTitle}>💬 Комментарий</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', lineHeight: 1.4, fontStyle: 'italic' }}>{ex.comments}</div>
                </div>
              )}
            </>}
            <div style={{ marginTop: isExpanded ? 10 : 4, textAlign: 'center', display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => toggleExpandEx(ex.id)} style={{ padding: '3px 14px', borderRadius: 14, border: '1px solid rgba(0,230,138,0.15)', background: isExpanded ? 'rgba(0,230,138,0.06)' : 'transparent', color: isExpanded ? ACCENT : DIM, cursor: 'pointer', fontSize: 10, fontWeight: 600 }}>{isExpanded ? '▲ Свернуть разбор' : '▼ Развернуть разбор'}</button>
              {isExpanded && <>
                <button onClick={() => printExercise(ex.id, printId)} style={{ padding: '3px 10px', borderRadius: 5, border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.06)', color: ACCENT, cursor: 'pointer', fontWeight: 600, fontSize: 10 }}>🖨 Печать</button>
                <button onClick={() => { navigator.clipboard.writeText(document.getElementById(printId)?.innerText || ''); }} style={{ padding: '3px 10px', borderRadius: 5, border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.06)', color: '#60a5fa', cursor: 'pointer', fontWeight: 600, fontSize: 10 }}>📋 Копировать</button>
              </>}
            </div>
            {isExpanded && <div id={printId} style={{ display: 'none' }}>
              <h2>{ex.name}</h2>
              <p><b>Тип:</b> {TYPE_RU[ex.type]} · <b>Оборудование:</b> {EQUIP_RU[ex.equipment]} · <b>Сложность:</b> {score.label} ({score.total}/100)</p>
              {technique ? <><div className="s"><p className="l">Техника:</p><ul>{technique.setup.map((s: string, i: number) => <li key={i}>{s}</li>)}{technique.execution.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div><div className="s"><p className="l">Дыхание:</p><ul>{technique.breathing.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div></> : null}
              {errors.length > 0 && <div className="s"><p className="l">Ошибки:</p><ul>{errors.map((e: any, i: number) => <li key={i}><b>{e.error}</b> — {e.fix}</li>)}</ul></div>}
              <p><b>Безопасность:</b> {safety.score}/100</p>
            </div>}
          </div>
        );
      })}

      {groupedExercises.length === 0 && flatList.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: DIM, fontSize: 12 }}>В этой группе нет упражнений с указанной целевой мышцей.</div>
      )}

      {/* Apply to planner — from TargetMuscleCalcTab */}
      <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)' }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginBottom: 8 }}>
          🔗 Применить целевую группу «{GROUP_RU[group]}» к планировщику как приоритет (доп. объём + ↓RIR).
        </div>
        <button onClick={() => applyToPlanner({ kind: 'weakpoints', label: 'Целевая группа: ' + GROUP_RU[group], data: { groups: [group] } })} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 13, minHeight: 44 }}>
          🛠 Целевая группа → планировщик
        </button>
      </div>
    </div>
  );
};

export { TechniqueTab };
export default TechniqueTab;
