import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { EXERCISE_CATALOG, getExerciseById, getSubstitutes } from '../../../core/exercise-catalog';
import { getExerciseBio } from '../../../data/exercise-biomechanics-db';
import { getTechnique, getCues, getErrorsForExercise, getProgression } from '../../../engines/genetic-deload-technique.engine';
import { classifyMovement, estimateDifficulty, getMuscleSynergy, getJointStress, assessSafety } from '../../../engines/movement-engines';
import { generateRepTempo } from '../../../engines/rep-tempo-engine';
import { forceVector, lengthenedPartials } from '../../../engines/pro/exercise-prescription.engine';
import { PopupSelect } from '../SRCBBScreen_parts/TrainingPopups';
import { getMappedIds } from '../../../data/exercise-id-mapping';
import type { Exercise } from '../../../core/types';

const ACCENT = '#00e68a';
const DIM = '#fff';
const BG = 'rgba(24,24,27,0.15)';
const BORDER = 'rgba(255,255,255,0.05)';

const GROUPS = ['all', 'chest', 'back', 'legs', 'shoulders', 'arms', 'core'] as const;
const GROUP_RU: Record<string, string> = {
  all: 'Все группы', chest: 'Грудь', back: 'Спина', legs: 'Ноги', shoulders: 'Плечи', arms: 'Руки', core: 'Кор',
};
const TYPE_RU: Record<string, string> = { compound: 'Базовое', isolation: 'Изолированное' };
const EQUIP_RU: Record<string, string> = {
  barbell: 'Штанга', dumbbell: 'Гантели', machine: 'Тренажёр', cable: 'Блок', bodyweight: 'Вес тела',
  band: 'Резинка', kettlebell: 'Гиря', smith: 'Смит', plate: 'Блин', suspension: 'Петли',
};
const PLANE_RU: Record<string, string> = { sagittal: 'Сагиттальная', frontal: 'Фронтальная', transverse: 'Поперечная', multi: 'Мульти' };
const LOAD_RU: Record<string, string> = { axial: 'Осевая', horizontal: 'Горизонтальная', vertical: 'Вертикальная', rotational: 'Ротационная', anterior: 'Передняя', posterior: 'Задняя' };
const GROUND_RU: Record<string, string> = { bilateral: 'Двусторонняя', unilateral: 'Односторонняя', seated: 'Сидя', prone: 'Лёжа', supine: 'На спине', standing: 'Стоя' };
const JOINT_RU: Record<string, string> = { knee: 'Колено', hip: 'Таз', spine: 'Позвоночник', shoulder: 'Плечо', elbow: 'Локоть', ankle: 'Голеностоп' };

interface TechniqueScore {
  total: number;
  breakdown: { label: string; value: number; max: number }[];
  level: 'low' | 'medium' | 'high';
  label: string;
}

function calcTechniqueScore(ex: Exercise): TechniqueScore {
  const map = getMappedIds(ex.id);
  const lookupId = map.bio || map.movement || ex.id;
  const bio = getExerciseBio(lookupId);
  const difficulty = estimateDifficulty(lookupId);
  const stress = getJointStress(map.joint || lookupId);
  const cls = classifyMovement(map.movement || lookupId);
  const jointScore = Object.values(stress).reduce((s: number, j: any) => {
    const vals = typeof j === 'object' ? Object.values(j).filter((v: any) => typeof v === 'number') as number[] : [];
    return s + vals.reduce((a: number, b: number) => a + b, 0);
  }, 0);
  const jointMax = Math.min(25, jointScore / 2);
  const complexityScore = cls.complexity === 'high' ? 25 : cls.complexity === 'medium' ? 15 : 8;
  const cnsScore = bio ? Math.min(25, bio.cnsDemand * 5) : Math.min(25, difficulty.cnsDemand * 5);
  const stabilityScore = bio ? Math.min(15, bio.difficulty * 3) : 8;
  const mobilityScore = bio ? Math.min(10, bio.difficulty * 2) : 5;
  const total = Math.min(100, Math.round(jointMax + complexityScore + cnsScore + stabilityScore + mobilityScore));
  return {
    total,
    breakdown: [
      { label: 'Суставная нагрузка', value: Math.round(jointMax), max: 25 },
      { label: 'Сложность движения', value: Math.round(complexityScore), max: 25 },
      { label: 'ЦНС-нагрузка', value: Math.round(cnsScore), max: 25 },
      { label: 'Стабильность', value: Math.round(stabilityScore), max: 15 },
      { label: 'Мобильность', value: Math.round(mobilityScore), max: 10 },
    ],
    level: total >= 60 ? 'high' : total >= 30 ? 'medium' : 'low',
    label: total >= 60 ? 'Сложное' : total >= 30 ? 'Среднее' : 'Простое',
  };
}

function getRiskColor(level: string): string {
  if (level === 'high') return '#ef4444'; if (level === 'medium' || level === 'med') return '#f59e0b'; return '#22c55e';
}
function getJointEmoji(level: string): string {
  if (level === 'high') return '🔴'; if (level === 'medium' || level === 'med') return '🟡'; return '🟢';
}
function lvl(v: number, max: number): string {
  const p = v / max; if (p >= 0.7) return '#ef4444'; if (p >= 0.4) return '#f59e0b'; return '#22c55e';
}

const card: React.CSSProperties = { background: BG, borderRadius: 10, border: `1px solid ${BORDER}`, padding: '12px 14px', marginBottom: 8 };
const pill: React.CSSProperties = { display: 'inline-block', padding: '3px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600, marginRight: 6, marginBottom: 4 };
const sectionTitle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: ACCENT, margin: '12px 0 6px', borderBottom: '1px solid rgba(0,230,138,0.15)', paddingBottom: 4 };
const chipRow: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 };
const filterBtn = (active: boolean): React.CSSProperties => ({
  padding: '4px 12px', borderRadius: 14, border: `1px solid ${active ? 'rgba(0,230,138,0.4)' : 'rgba(255,255,255,0.08)'}`,
  background: active ? 'rgba(0,230,138,0.1)' : 'transparent', color: active ? ACCENT : DIM,
  cursor: 'pointer', fontSize: 10, fontWeight: 600,
});

export const TechniqueCalcTab: React.FC = () => {
  const [group, setGroup] = useState<string>('chest');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'compound' | 'isolation'>('all');
  const [filterDiff, setFilterDiff] = useState<'all' | 'beginner' | 'intermediate' | 'advanced'>('all');
  const [filterEquip, setFilterEquip] = useState<string>('all');
  const [filterJoint, setFilterJoint] = useState<string>('all');
  const [expandedEx, setExpandedEx] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('he_tech_fav') || '[]'); } catch { return []; } });
  const [showFavOnly, setShowFavOnly] = useState(false);

  useEffect(() => { try { localStorage.setItem('he_tech_fav', JSON.stringify(favorites)); } catch {} }, [favorites]);
  const toggleFav = (id: string) => setFavorites(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleCompare = (id: string) => setCompareIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 2 ? [...prev, id] : [prev[1], id]);

  const equipmentOptions = useMemo(() => {
    const set = new Set(EXERCISE_CATALOG.map(e => e.equipment));
    return ['all', ...Array.from(set).sort()];
  }, []);

  const filtered = useMemo(() => {
    let list = group === 'all' ? EXERCISE_CATALOG : EXERCISE_CATALOG.filter(e => e.group === group);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(e => e.name.toLowerCase().includes(s) || (e.targetMuscle || '').toLowerCase().includes(s) || e.id.toLowerCase().includes(s));
    }
    if (filterType !== 'all') list = list.filter(e => e.type === filterType);
    if (filterDiff !== 'all') list = list.filter(e => e.difficulty === filterDiff);
    if (filterEquip !== 'all') list = list.filter(e => e.equipment === filterEquip);
    if (filterJoint !== 'all') {
      list = list.filter(e => {
        const bio = getExerciseBio(e.id);
        if (bio) return (bio.jointStress as any)[filterJoint] <= 4;
        const js = e.jointStress; return js !== 'high' || filterJoint !== 'spine';
      });
    }
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
    };});
  }, [group, search, filterType, filterDiff, filterEquip, filterJoint, showFavOnly, favorites]);

  const sortedByScore = useMemo(() => [...filtered].sort((a, b) => b.score.total - a.score.total), [filtered]);

  const toggleExpand = (id: string) => setExpandedEx(prev => prev === id ? null : id);

  return (
    <div className="train-techcalc" style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      {/* ── Заголовок ── */}
      <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT, marginBottom: 2 }}>🧬 Калькулятор техники</div>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 12 }}>
        Полный анализ техники, биомеханики, безопасности и синергии каждого упражнения. Раскройте карточку для детального разбора.
      </div>

      {/* ── Основные фильтры ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginBottom: 10 }}>
        <PopupSelect label="Целевая группа мышц" value={group} options={GROUPS.map(g => ({ id: g, label: GROUP_RU[g], desc: '' }))} hint="Фильтр по целевой группе" onChange={v => { setGroup(v); setExpandedEx(null); }} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 10, color: DIM, fontWeight: 600, marginBottom: 4 }}>Поиск по названию</div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Название упражнения…" style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 11, boxSizing: 'border-box', width: '100%' }} />
        </div>
      </div>

      {/* ── Быстрые фильтры-чипсы ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10, alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: DIM, fontWeight: 600, marginRight: 2 }}>Тип:</span>
        {(['all','compound','isolation'] as const).map(t => (
          <button key={t} onClick={() => setFilterType(t)} style={filterBtn(filterType === t)}>{t === 'all' ? 'Все' : TYPE_RU[t]}</button>
        ))}
        <span style={{ fontSize: 10, color: DIM, fontWeight: 600, marginLeft: 8, marginRight: 2 }}>Уровень:</span>
        {(['all','beginner','intermediate','advanced'] as const).map(d => (
          <button key={d} onClick={() => setFilterDiff(d)} style={filterBtn(filterDiff === d)}>{d === 'all' ? 'Все' : d === 'beginner' ? 'Новичок' : d === 'advanced' ? 'Продв.' : 'Средний'}</button>
        ))}
        <div style={{ minWidth: 150 }}>
          <PopupSelect label="Оборудование" value={filterEquip} options={equipmentOptions.map(eq => ({ id: eq, label: eq === 'all' ? 'Всё оборудование' : EQUIP_RU[eq] || eq, desc: '' }))} onChange={setFilterEquip} />
        </div>
        <div style={{ minWidth: 150 }}>
          <PopupSelect label="Щадящий режим" value={filterJoint} options={[
            { id: 'all', label: 'Все суставы', desc: '' },
            { id: 'spine', label: 'Щадить позвоночник', desc: '' },
            { id: 'knee', label: 'Щадить колени', desc: '' },
            { id: 'shoulder', label: 'Щадить плечи', desc: '' },
            { id: 'elbow', label: 'Щадить локти', desc: '' },
            { id: 'hip', label: 'Щадить таз', desc: '' },
          ]} onChange={setFilterJoint} />
        </div>
        <button onClick={() => setShowFavOnly(v => !v)} style={filterBtn(showFavOnly)}>⭐ Избранное ({favorites.length})</button>
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
        {filtered.length} из {group === 'all' ? EXERCISE_CATALOG.length : EXERCISE_CATALOG.filter(e => e.group === group).length} упражнений · {GROUP_RU[group]}{search ? ` · «${search}»` : ''}{showFavOnly ? ' · ⭐ Избранное' : ''}
      </div>

      {/* ── Карточки упражнений ── */}
      {sortedByScore.map(({ exercise: ex, bio, technique, score, cues, errors, progression, synergy, jointStress, difficultyProfile, classification, fVector, lengthened }) => {
        const isExpanded = expandedEx === ex.id;
        const safety = assessSafety(ex.id, [], score.total / 100);
        const isFav = favorites.includes(ex.id);
        const tempoRes = generateRepTempo({
          goal: ex.type === 'compound' ? 'strength' : 'hypertrophy',
          riskLevel: score.level,
          difficultyLevel: score.level,
          techniqueIssues: [],
          isMainLift: ex.type === 'compound',
        });
        const subs = getSubstitutes(ex.id);
        const subList = subs ? subs.substitutes.filter(s => getExerciseById(s.id)) : [];

        return (
          <div key={ex.id} style={{ ...card, border: isExpanded ? '1px solid rgba(0,230,138,0.25)' : card.border, boxShadow: isExpanded ? '0 0 12px rgba(0,230,138,0.06)' : undefined }}>
            {/* ── Заголовок ── */}
            <div onClick={() => toggleExpand(ex.id)} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{ex.name}</span>
                    <button onClick={e => { e.stopPropagation(); toggleFav(ex.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: 0, color: isFav ? '#f59e0b' : DIM }}>{isFav ? '★' : '☆'}</button>
                    <button onClick={e => { e.stopPropagation(); toggleCompare(ex.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, padding: '2px 4px', color: compareIds.includes(ex.id) ? '#60a5fa' : DIM, fontWeight: 700 }}>⇆</button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
                    <span style={{ ...pill, background: ex.type === 'compound' ? 'rgba(0,230,138,0.15)' : 'rgba(59,130,246,0.15)', color: ex.type === 'compound' ? ACCENT : '#60a5fa' }}>{TYPE_RU[ex.type] || ex.type}</span>
                    <span style={{ ...pill, background: 'rgba(168,85,247,0.12)', color: '#c084fc' }}>{EQUIP_RU[ex.equipment] || ex.equipment}</span>
                    {bio && <span style={{ ...pill, background: 'rgba(255,255,255,0.05)', color: DIM }}>{bio.pattern}</span>}
                    <span style={{ ...pill, background: ex.difficulty === 'beginner' ? 'rgba(34,197,94,0.12)' : ex.difficulty === 'advanced' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)', color: ex.difficulty === 'beginner' ? '#22c55e' : ex.difficulty === 'advanced' ? '#ef4444' : '#f59e0b' }}>{ex.difficulty === 'beginner' ? 'Новичок' : ex.difficulty === 'advanced' ? 'Продвинутый' : 'Средний'}</span>
                    {bio?.isCompetition && <span style={{ ...pill, background: 'rgba(239,68,68,0.12)', color: '#f87171' }}>Соревновательное</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'center', minWidth: 58 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: `conic-gradient(${getRiskColor(score.level)} ${score.total * 3.6}deg, rgba(255,255,255,0.06) 0)`, margin: '0 auto',
                  }}>
                    <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: -1 }}>{score.total}</div>
                  </div>
                  <div style={{ fontSize: 10, color: getRiskColor(score.level), marginTop: 2, fontWeight: 700 }}>{score.label}</div>
                </div>
              </div>
              {ex.technique && (
                <div style={{ fontSize: 10, color: '#fff', lineHeight: 1.5, marginTop: 8, fontStyle: 'italic' }}>
                  {ex.technique.length > 180 ? ex.technique.slice(0, 180) + '…' : ex.technique}
                </div>
              )}
              <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 10 }}>
                <span>{getJointEmoji(ex.jointStress)} Суставы: {ex.jointStress === 'high' ? 'высокая' : ex.jointStress === 'med' ? 'средняя' : 'низкая'}</span>
                {bio && <span>🧠 ЦНС: {bio.cnsDemand}/5</span>}
                <span style={{ color: getRiskColor(safety.level) }}>{safety.level === 'safe' ? '✅' : safety.level === 'moderate' ? '⚠️' : '🚫'} {safety.level === 'safe' ? 'Безоп.' : safety.level === 'moderate' ? 'Вним.' : 'Риск.'}</span>
                {ex.fatigueCost > 0 && <span style={{ color: DIM }}>⚡ Усталость: {ex.fatigueCost}/10</span>}
              </div>
            </div>

            {/* ── Раскрытый контент ── */}
            {isExpanded && (
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                {/* Технический счёт с барами */}
                <div style={sectionTitle}>📊 Технический счёт ({score.total}/100)</div>
                {score.breakdown.map((b, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: 10 }}>
                    <div style={{ width: 120, color: DIM, textAlign: 'right', flexShrink: 0 }}>{b.label}</div>
                    <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(b.value / b.max) * 100}%`, borderRadius: 4, background: lvl(b.value, b.max), transition: 'width 0.3s' }} />
                    </div>
                    <div style={{ width: 32, textAlign: 'right', fontWeight: 700, color: lvl(b.value, b.max) }}>{b.value}</div>
                    <div style={{ width: 22, color: '#fff', fontSize: 10 }}>/ {b.max}</div>
                  </div>
                ))}

                {/* Техника — полный разбор (TECHNIQUE_DB) */}
                {technique ? (
                  <>
                    <div style={sectionTitle}>🎯 Полный разбор техники</div>
                    <div style={{ fontSize: 10, color: '#fff', lineHeight: 1.7 }}>
                      <p style={{ margin: '0 0 8px', fontWeight: 700, color: ACCENT }}>Исходное положение:</p>
                      {technique.setup.map((s: string, i: number) => <div key={i} style={{ marginBottom: 3 }}>{i + 1}. {s}</div>)}
                      <p style={{ margin: '10px 0 8px', fontWeight: 700, color: ACCENT }}>Выполнение:</p>
                      {technique.execution.map((s: string, i: number) => <div key={i} style={{ marginBottom: 3 }}>{i + 1}. {s}</div>)}
                      <p style={{ margin: '10px 0 8px', fontWeight: 700, color: ACCENT }}>Дыхание:</p>
                      {technique.breathing.map((s: string, i: number) => <div key={i} style={{ marginBottom: 3, fontStyle: 'italic' }}>{s}</div>)}
                      {technique.preRequisites.length > 0 && (
                        <>
                          <p style={{ margin: '10px 0 8px', fontWeight: 700, color: ACCENT }}>Пререквизиты:</p>
                          {technique.preRequisites.map((s: string, i: number) => <div key={i} style={{ marginBottom: 3 }}>{i + 1}. {s}</div>)}
                        </>
                      )}
                    </div>
                  </>
                ) : ex.technique ? (
                  <>
                    <div style={sectionTitle}>🎯 Техника выполнения</div>
                    <div style={{ fontSize: 10, color: '#fff', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{ex.technique}</div>
                  </>
                ) : null}

                {/* Cues */}
                {cues.length > 0 && (
                  <>
                    <div style={sectionTitle}>💡 Ключевые подсказки (cues)</div>
                    <div style={chipRow}>
                      {cues.map((c: any, i: number) => (
                        <span key={i} style={{ ...pill, background: c.priority === 'critical' ? 'rgba(239,68,68,0.12)' : c.priority === 'important' ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.04)', color: c.priority === 'critical' ? '#f87171' : c.priority === 'important' ? '#fbbf24' : DIM }}>
                          {c.priority === 'critical' ? '⚡' : c.priority === 'important' ? '📌' : '💬'} {c.cue}
                        </span>
                      ))}
                    </div>
                  </>
                )}
                {cues.length === 0 && (bio?.techniqueCues?.length ?? 0) > 0 && (
                  <>
                    <div style={sectionTitle}>💡 Ключевые подсказки</div>
                    <div style={chipRow}>{bio!.techniqueCues!.map((cue: string, i: number) => <span key={i} style={{ ...pill, background: 'rgba(0,230,138,0.08)', color: ACCENT }}>{cue}</span>)}</div>
                  </>
                )}

                {/* Ошибки */}
                {errors.length > 0 && (
                  <>
                    <div style={sectionTitle}>⚠️ Частые ошибки и исправления</div>
                    {errors.map((e: any, i: number) => (
                      <div key={i} style={{ marginBottom: 6, padding: '8px 10px', background: 'rgba(239,68,68,0.05)', borderRadius: 6, border: '1px solid rgba(239,68,68,0.1)' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#f87171' }}>{e.error}</div>
                        <div style={{ fontSize: 10, color:'#fff', marginTop: 2 }}>Причина: {e.cause}</div>
                        <div style={{ fontSize: 10, color: '#22c55e', marginTop: 2 }}>Исправление: {e.fix}</div>
                      </div>
                    ))}
                  </>
                )}

                {/* Прогрессия / Регрессия */}
                {progression.length > 0 && (
                  <>
                    <div style={sectionTitle}>📈 Прогрессия</div>
                    <div style={{ fontSize: 10, color: '#22c55e', background: 'rgba(34,197,94,0.06)', padding: '8px 10px', borderRadius: 6 }}>{progression.join(' → ')}</div>
                  </>
                )}
                {(technique?.regression?.length ?? 0) > 0 && (
                  <>
                    <div style={sectionTitle}>📉 Регрессия</div>
                    <div style={{ fontSize: 10, color: '#f59e0b', background: 'rgba(245,158,11,0.06)', padding: '8px 10px', borderRadius: 6 }}>{technique!.regression!.join(' → ')}</div>
                  </>
                )}

                {/* ROM-требования */}
                {bio?.romRequirements && Object.keys(bio.romRequirements).length > 0 && (
                  <>
                    <div style={sectionTitle}>📐 Требования к ROM (амплитуде)</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 10 }}>
                      {Object.entries(bio.romRequirements).map(([joint, deg]) => (
                        <div key={joint} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ color: DIM, width: 80 }}>{JOINT_RU[joint] || joint}</span>
                          <div style={{ width: 80, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.min(100, (deg / 120) * 100)}%`, borderRadius: 3, background: deg >= 90 ? '#ef4444' : deg >= 60 ? '#f59e0b' : '#22c55e' }} />
                          </div>
                          <span style={{ fontWeight: 700, width: 30, textAlign: 'right' }}>{deg}°</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Цепочка замен (substitution chain) */}
                {subList.length > 0 && (
                  <>
                    <div style={sectionTitle}>🔄 Цепочка замен</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 10 }}>
                      {subList.map((s: any) => (
                        <div key={s.id} style={{ background: 'rgba(168,85,247,0.06)', borderRadius: 6, padding: '4px 8px', border: '1px solid rgba(168,85,247,0.1)' }}>
                          <span style={{ color: '#c084fc', fontWeight: 600 }}>{getExerciseById(s.id)?.name || s.id}</span>
                          {s.reason && <span style={{ color: DIM, marginLeft: 4, fontSize: 10 }}>— {s.reason}</span>}
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Биомеханика суставов */}
                {(bio?.jointStress || jointStress) && (
                  <>
                    <div style={sectionTitle}>🔬 Биомеханика суставов</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 6 }}>
                      {Object.entries(bio?.jointStress || jointStress || {}).filter(([k]) => !['toString'].includes(k)).map(([joint, val]: [string, any]) => {
                        if (typeof val !== 'object' || !val) return null;
                        const level = (val as any).level || 'low';
                        const maxVal = Math.max(...(Object.values(val).filter((v: any) => typeof v === 'number') as number[]));
                        return (
                          <div key={joint} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
                            <div style={{ fontSize: 10, color: DIM, marginBottom: 3 }}>{JOINT_RU[joint] || joint}</div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: getRiskColor(level) }}>{maxVal}</div>
                            <div style={{ fontSize: 10, color: getRiskColor(level) }}>{level === 'high' ? 'Высокая' : level === 'medium' ? 'Средняя' : 'Низкая'}</div>
                          </div>
                        );
                      })}
                    </div>
                    {bio && (
                      <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: 10, color: DIM }}>
                        <div>Крутящий момент: <b style={{ color: '#fff' }}>{bio.torqueProfile?.replace('_', ' ') || '—'}</b></div>
                        <div>Риск-профиль: <b style={{ color: getRiskColor(bio.riskProfile) }}>{bio.riskProfile === 'high' ? 'Высокий' : bio.riskProfile === 'medium' ? 'Средний' : 'Низкий'}</b></div>
                        <div>Позвоночник: <b style={{ color: '#fff' }}>{bio.spineLoad || '—'}</b></div>
                        <div>Колени: <b style={{ color: '#fff' }}>{bio.kneeLoad || '—'}</b></div>
                        <div>Плечи: <b style={{ color: '#fff' }}>{bio.shoulderLoad || '—'}</b></div>
                        <div>Одностор.: <b style={{ color: '#fff' }}>{bio.isUnilateral ? 'Да' : 'Нет'}</b></div>
                      </div>
                    )}
                  </>
                )}

                {/* Мышечная синергия */}
                {synergy && synergy.primary.length > 0 && (
                  <>
                    <div style={sectionTitle}>💪 Мышечная синергия</div>
                    <div style={{ fontSize: 10, lineHeight: 1.6 }}>
                      <div><span style={{ color: ACCENT }}>Основные:</span> {synergy.primary.join(', ')}</div>
                      {synergy.secondary.length > 0 && <div><span style={{ color: '#60a5fa' }}>Вспом.:</span> {synergy.secondary.join(', ')}</div>}
                      {synergy.stabilizers.length > 0 && <div><span style={{ color: '#a855f7' }}>Стаб.:</span> {synergy.stabilizers.join(', ')}</div>}
                      {synergy.synergists.length > 0 && <div><span style={{ color: '#f59e0b' }}>Синерг.:</span> {synergy.synergists.join(', ')}</div>}
                      {synergy.antagonists.length > 0 && <div><span style={{ color: '#ef4444' }}>Антаг.:</span> {synergy.antagonists.join(', ')}</div>}
                    </div>
                  </>
                )}

                {/* Региональная гипертрофия */}
                {lengthened.length > 0 && (
                  <>
                    <div style={sectionTitle}>🎯 Региональная гипертрофия</div>
                    <div style={{ fontSize: 10, color: DIM, lineHeight: 1.5 }}>{lengthened.map((l: any, i: number) => <div key={i} style={{ marginBottom: 3 }}>• {l.name}: {l.emphasis}</div>)}</div>
                  </>
                )}

                {/* Темпо */}
                <div style={sectionTitle}>⏱ Темпо-прескрипция</div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 6 }}>
                  {[tempoRes.tempo.eccentric, tempoRes.tempo.pauseBottom, tempoRes.tempo.concentric, tempoRes.tempo.pauseTop].map((sec, i) => {
                    const labels = ['Эксц.', 'Пауза ↓', 'Конц.', 'Пауза ↑'];
                    const colors = ['#60a5fa', '#f59e0b', '#22c55e', '#a855f7'];
                    return (
                      <div key={i} style={{ flex: 1, textAlign: 'center', background: `${colors[i]}14`, borderRadius: 8, padding: '6px 4px', border: `1px solid ${colors[i]}22` }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: colors[i] }}>{sec === 0 ? 'X' : sec}</div>
                        <div style={{ fontSize: 10, color: '#fff', marginTop: 2 }}>{labels[i]}</div>
                        <div style={{ fontSize: 10, color: colors[i] }}>{i === 0 ? `${sec}c` : i === 2 ? (sec === 0 ? 'взрыв' : `${sec}c`) : `${sec}c`}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 10, marginTop: 4 }}>
                  <div style={{ background: 'rgba(59,130,246,0.06)', borderRadius: 6, padding: 6, textAlign: 'center' }}><div style={{ color: DIM }}>Паттерн</div><div style={{ fontWeight: 800, color: '#60a5fa' }}>{tempoRes.pattern}</div></div>
                  <div style={{ background: 'rgba(59,130,246,0.06)', borderRadius: 6, padding: 6, textAlign: 'center' }}><div style={{ color: DIM }}>RPE / RIR</div><div style={{ fontWeight: 800, color: '#60a5fa' }}>{tempoRes.targetRPE} / {tempoRes.targetRIR}</div></div>
                </div>
                <div style={{ fontSize: 10, color: DIM, marginTop: 4, fontStyle: 'italic' }}>{tempoRes.rationale}</div>

                {/* Безопасность */}
                <div style={sectionTitle}>🛡 Оценка безопасности (safety score: {safety.score}/100)</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${safety.score}%`, borderRadius: 4, background: safety.score > 70 ? '#22c55e' : safety.score > 40 ? '#f59e0b' : '#ef4444' }} />
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: getRiskColor(safety.level), width: 70, textAlign: 'right' }}>
                    {safety.level === 'safe' ? 'Безопасно' : safety.level === 'moderate' ? 'Умеренно' : 'Рискованно'}
                  </span>
                </div>
                <div style={{ fontSize: 10, lineHeight: 1.6 }}>
                  {safety.requiresSpotter && <div style={{ color: '#f59e0b', marginTop: 2 }}>⚠ Требуется страхующий (споттер)</div>}
                  {safety.contraindications.length > 0 && (
                    <div style={{ marginTop: 4, color: '#f87171' }}>
                      <b>Противопоказания:</b>
                      {safety.contraindications.map((c: string, i: number) => <div key={i} style={{ marginLeft: 12, marginTop: 2 }}>• {c}</div>)}
                    </div>
                  )}
                  {safety.precautions.length > 0 && (
                    <div style={{ marginTop: 4, color: '#fbbf24' }}>
                      <b>Предосторожности:</b>
                      {safety.precautions.map((p: string, i: number) => <div key={i} style={{ marginLeft: 12, marginTop: 2 }}>• {p}</div>)}
                    </div>
                  )}
                  {safety.highRiskPopulation.length > 0 && <div style={{ marginTop: 4, color: DIM }}><b>Группы риска:</b> {safety.highRiskPopulation.join(', ')}</div>}
                </div>

                {/* Классификация движения */}
                <div style={sectionTitle}>📐 Классификация движения</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 16px', fontSize: 10, color: DIM }}>
                  <div>Плоскость: <b style={{ color: '#fff' }}>{PLANE_RU[classification.plane] || classification.plane}</b></div>
                  <div>Нагрузка: <b style={{ color: '#fff' }}>{LOAD_RU[classification.loadType] || classification.loadType}</b></div>
                  <div>Стойка: <b style={{ color: '#fff' }}>{GROUND_RU[classification.groundingPattern] || classification.groundingPattern}</b></div>
                  <div>Force-вектор: <b style={{ color: '#c084fc' }}>{fVector}</b></div>
                  {ex.targetMuscle && <div>Целевая мышца: <b style={{ color: ACCENT }}>{ex.targetMuscle}</b></div>}
                  {classification.primaryJoints.length > 0 && <div>Суставы: <b style={{ color: '#fff' }}>{classification.primaryJoints.join(', ')}</b></div>}
                </div>

                {/* Детали */}
                {(ex.pauseSeconds || ex.peakContraction || ex.stretchPhase || ex.setFormat) && (
                  <div style={sectionTitle}>📋 Детали выполнения</div>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, fontSize: 10 }}>
                  {ex.pauseSeconds && <span style={{ ...pill, background: 'rgba(245,158,11,0.1)', color: '#fbbf24' }}>Пауза {ex.pauseSeconds}с</span>}
                  {ex.peakContraction && <span style={{ ...pill, background: 'rgba(0,230,138,0.1)', color: ACCENT }}>Пиковое сокращение</span>}
                  {ex.stretchPhase && <span style={{ ...pill, background: 'rgba(168,85,247,0.1)', color: '#c084fc' }}>Фаза растяжения</span>}
                  {ex.dropSet && <span style={{ ...pill, background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>Дроп-сет</span>}
                  {ex.backoffSet && <span style={{ ...pill, background: 'rgba(59,130,246,0.1)', color: '#60a5fa' }}>Backoff-сет</span>}
                  {ex.setFormat && <span style={{ ...pill, background: 'rgba(255,255,255,0.05)', color: DIM }}>Формат: {String(ex.setFormat)}</span>}
                </div>

                {ex.comments && (
                  <>
                    <div style={sectionTitle}>💬 Комментарий</div>
                    <div style={{ fontSize: 10, color:'#fff', lineHeight: 1.5, fontStyle: 'italic' }}>{ex.comments}</div>
                  </>
                )}

                {/* Чеклист техники (печатная форма) */}
                <div style={sectionTitle}>✅ Чеклист техники</div>
                {(() => {
                  const checklist: string[] = [];
                  if (technique) {
                    checklist.push(...technique.setup.map(s => `[ ] ИП: ${s}`));
                    checklist.push(...technique.execution.map(s => `[ ] Вып: ${s}`));
                    checklist.push(...technique.breathing.map(s => `[ ] Дых: ${s}`));
                  } else if (ex.technique) {
                    const lines = ex.technique.split(/[.!?]/).filter(l => l.trim().length > 5);
                    checklist.push(...lines.map(l => `[ ] ${l.trim()}`));
                  }
                  if (checklist.length === 0) checklist.push('[ ] Контролируйте полную амплитуду движения');
                  return (
                    <div style={{ fontSize: 10, color: DIM, background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '8px 10px', lineHeight: 1.8, fontFamily: 'monospace', maxHeight: 200, overflowY: 'auto' }}>
                      {checklist.map((item, i) => <div key={i}>{item.startsWith('[ ]') ? item : `[ ] ${item}`}</div>)}
                    </div>
                  );
                })()}

                {/* Кнопки действий */}
                <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                  <button onClick={() => {
                    const printContent = document.getElementById(`tech-print-${ex.id}`);
                    if (printContent) {
                      const w = window.open('', '_blank', 'width=800,height=600');
                      if (w) { w.document.write(`<html><head><title>${ex.name} - Техника</title><style>body{font-family:sans-serif;font-size:12px;line-height:1.6;padding:20px;color:#000;background:#fff}h2{color:#333}p{margin:4px 0}ul{margin:4px 0 12px}li{margin:2px 0}.section{margin:12px 0;padding:8px;border-left:3px solid #00e68a}.label{font-weight:700;color:#00e68a}</style></head><body>${printContent.innerHTML}</body></html>`); w.document.close(); setTimeout(() => w.print(), 300); }
                    }
                  }} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.06)', color: ACCENT, cursor: 'pointer', fontWeight: 600, fontSize: 10 }}>🖨 Печать техники</button>
                  <button onClick={() => { navigator.clipboard.writeText(document.getElementById(`tech-print-${ex.id}`)?.innerText || ''); }} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.06)', color: '#60a5fa', cursor: 'pointer', fontWeight: 600, fontSize: 10 }}>📋 Скопировать</button>
                </div>

                {/* Скрытый печатный блок */}
                <div id={`tech-print-${ex.id}`} style={{ display: 'none' }}>
                  <h2>{ex.name}</h2>
                  <p><b>Тип:</b> {TYPE_RU[ex.type]} · <b>Оборудование:</b> {EQUIP_RU[ex.equipment]} · <b>Сложность:</b> {score.label} ({score.total}/100)</p>
                  {technique && (
                    <>
                      <div className="section">
                        <p className="label">Исходное положение:</p>
                        <ul>{technique.setup.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
                      </div>
                      <div className="section">
                        <p className="label">Выполнение:</p>
                        <ul>{technique.execution.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
                      </div>
                      <div className="section">
                        <p className="label">Дыхание:</p>
                        <ul>{technique.breathing.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
                      </div>
                    </>
                  )}
                  {!technique && ex.technique && <div className="section"><p className="label">Техника:</p><p>{ex.technique}</p></div>}
                  {errors.length > 0 && (
                    <div className="section">
                      <p className="label">Частые ошибки:</p>
                      <ul>{errors.map((e: any, i: number) => <li key={i}><b>{e.error}</b> — {e.fix}</li>)}</ul>
                    </div>
                  )}
                  {progression.length > 0 && <p><b>Прогрессия:</b> {progression.join(' → ')}</p>}
                  {technique?.regression?.length && <p><b>Регрессия:</b> {technique!.regression!.join(' → ')}</p>}
                  <p><b>Темпо:</b> {tempoRes.tempo.toString} · <b>RPE/RIR:</b> {tempoRes.targetRPE}/{tempoRes.targetRIR}</p>
                  <p><b>Безопасность:</b> {safety.score}/100 · {safety.level === 'safe' ? 'Безопасно' : safety.level === 'moderate' ? 'Умеренно' : 'Рискованно'}</p>
                  {safety.contraindications.length > 0 && <p><b>Противопоказания:</b> {safety.contraindications.join('; ')}</p>}
                  {safety.precautions.length > 0 && <p><b>Предосторожности:</b> {safety.precautions.join('; ')}</p>}
                </div>
              </div>
            )}

            <div style={{ marginTop: isExpanded ? 12 : 6, textAlign: 'center' }}>
              <button onClick={() => toggleExpand(ex.id)} style={{
                padding: '4px 16px', borderRadius: 14, border: '1px solid rgba(0,230,138,0.2)',
                background: isExpanded ? 'rgba(0,230,138,0.08)' : 'transparent', color: isExpanded ? ACCENT : DIM, cursor: 'pointer', fontSize: 10, fontWeight: 600,
              }}>{isExpanded ? '▲ Свернуть' : '▼ Развернуть полный разбор'}</button>
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: DIM, fontSize: 12 }}>Нет упражнений по выбранным фильтрам.</div>}

      {/* ── Сравнение двух упражнений ── */}
      {compareIds.length === 2 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ ...sectionTitle, fontSize: 13 }}>⚖ Сравнение: {getExerciseById(compareIds[0])?.name || compareIds[0]} vs {getExerciseById(compareIds[1])?.name || compareIds[1]}</div>
          <button onClick={() => setCompareIds([])} style={{ ...filterBtn(false), marginBottom: 8 }}>✕ Закрыть сравнение</button>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ padding: '6px 8px', textAlign: 'left', color: DIM }}>Параметр</th>
                  {compareIds.map(id => <th key={id} style={{ padding: '6px 8px', textAlign: 'center', color: ACCENT }}>{getExerciseById(id)?.name || id}</th>)}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const rows: { label: string; get: (ex: Exercise) => string | number }[] = [
                    { label: 'Тип', get: e => TYPE_RU[e.type] || e.type },
                    { label: 'Оборудование', get: e => EQUIP_RU[e.equipment] || e.equipment },
                    { label: 'Сложность', get: e => e.difficulty === 'beginner' ? 'Новичок' : e.difficulty === 'advanced' ? 'Продвинутый' : 'Средний' },
                    { label: 'Тех. счёт', get: e => String(calcTechniqueScore(e).total) },
                    { label: 'Суставы', get: e => e.jointStress },
                    { label: 'ЦНС', get: e => String(getExerciseBio(e.id)?.cnsDemand || '—') },
                    { label: 'Усталость', get: e => String(e.fatigueCost || '—') },
                    { label: 'Пауза (с)', get: e => String(e.pauseSeconds || '—') },
                    { label: 'Пик. сокр.', get: e => e.peakContraction ? 'Да' : 'Нет' },
                    { label: 'Растяжение', get: e => e.stretchPhase ? 'Да' : 'Нет' },
                    { label: 'Force-вектор', get: e => forceVector(e.group, e.type, e.name) },
                  ];
                  return rows.map((row, i) => {
                    const vals = compareIds.map(id => { const ex = getExerciseById(id); return ex ? row.get(ex) : '—'; });
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '5px 8px', color: DIM }}>{row.label}</td>
                        {vals.map((v, j) => <td key={j} style={{ padding: '5px 8px', textAlign: 'center', fontWeight: 600, color: vals[0] !== vals[1] ? '#fbbf24' : '#fff' }}>{v}</td>)}
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Сводная таблица ── */}
      {filtered.length > 1 && (
        <div style={{ marginTop: 24 }}>
          <div style={sectionTitle}>📊 Сводное сравнение по группе «{GROUP_RU[group]}» ({filtered.length} упр.)</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <th style={{ textAlign: 'left', padding: '6px 8px', color: DIM, fontWeight: 600 }}>#</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', color: DIM, fontWeight: 600 }}>Упражнение</th>
                  <th style={{ textAlign: 'center', padding: '6px 8px', color: DIM, fontWeight: 600 }}>Тип</th>
                  <th style={{ textAlign: 'center', padding: '6px 8px', color: DIM, fontWeight: 600 }}>Счёт</th>
                  <th style={{ textAlign: 'center', padding: '6px 8px', color: DIM, fontWeight: 600 }}>Суставы</th>
                  <th style={{ textAlign: 'center', padding: '6px 8px', color: DIM, fontWeight: 600 }}>ЦНС</th>
                  <th style={{ textAlign: 'center', padding: '6px 8px', color: DIM, fontWeight: 600 }}>ROM</th>
                  <th style={{ textAlign: 'center', padding: '6px 8px', color: DIM, fontWeight: 600 }}>Безоп.</th>
                  <th style={{ textAlign: 'center', padding: '6px 8px', color: DIM, fontWeight: 600 }}>Ур.</th>
                </tr>
              </thead>
              <tbody>
                {sortedByScore.map(({ exercise: ex, score, bio }, idx) => {
                  const safety = assessSafety(ex.id, [], score.total / 100);
                  const romCount = bio?.romRequirements ? Object.keys(bio.romRequirements).length : 0;
                  return (
                    <tr key={ex.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }} onClick={() => toggleExpand(ex.id)}>
                      <td style={{ padding: '6px 8px', color: DIM }}>{idx + 1}</td>
                      <td style={{ padding: '6px 8px', fontWeight: 600, fontSize: 10 }}>{ex.name}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                        <span style={{ color: ex.type === 'compound' ? ACCENT : '#60a5fa' }}>{ex.type === 'compound' ? 'Баз' : 'Изо'}</span>
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 800, color: getRiskColor(score.level) }}>{score.total}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>{getJointEmoji(ex.jointStress)}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>{bio?.cnsDemand || '—'}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'center', color: romCount >= 3 ? '#f59e0b' : '#22c55e' }}>{romCount || '—'}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'center', color: getRiskColor(safety.level) }}>{safety.level === 'safe' ? '✅' : safety.level === 'moderate' ? '⚠️' : '❌'}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                        <span style={{ color: ex.difficulty === 'beginner' ? '#22c55e' : ex.difficulty === 'advanced' ? '#ef4444' : '#f59e0b', fontSize: 10, fontWeight: 600 }}>
                          {ex.difficulty === 'beginner' ? 'Нов' : ex.difficulty === 'advanced' ? 'Про' : 'Ср'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default TechniqueCalcTab;
