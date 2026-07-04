import React, { useMemo, useState, useEffect } from 'react';
import { EXERCISE_CATALOG, getExerciseById, getSubstitutes } from '../../../core/exercise-catalog';
import { EXERCISE_BIOMECHANICS_DB, getExerciseBio } from '../../../data/exercise-biomechanics-db';
import { getTechnique, getCues, getErrorsForExercise, getProgression } from '../../../engines/genetic-deload-technique.engine';
import { classifyMovement, estimateDifficulty, getMuscleSynergy, getJointStress, assessSafety } from '../../../engines/movement-engines';
import { generateRepTempo } from '../../../engines/rep-tempo-engine';
import { forceVector, lengthenedPartials } from '../../../engines/pro/exercise-prescription.engine';
import { PopupSelect } from '../SRCBBScreen_parts/TrainingPopups';
import type { Exercise } from '../../../core/types';

const ACCENT = '#00e68a';
const DIM = 'rgba(255,255,255,0.5)';
const BG = 'rgba(24,24,27,0.15)';
const BORDER = 'rgba(255,255,255,0.05)';

const GROUPS = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'] as const;
const GROUP_RU: Record<string, string> = {
  chest: 'Грудь', back: 'Спина', legs: 'Ноги', shoulders: 'Плечи', arms: 'Руки', core: 'Кор',
};
const TYPE_RU: Record<string, string> = { compound: 'Базовое', isolation: 'Изолированное' };
const EQUIP_RU: Record<string, string> = {
  barbell: 'Штанга', dumbbell: 'Гантели', machine: 'Тренажёр', cable: 'Блок', bodyweight: 'Вес тела',
  band: 'Резинка', kettlebell: 'Гиря', smith: 'Смит', plate: 'Блин', suspension: 'Петли',
};

const SUBREGION_DEFS: Record<string, { id: string; name: string; keywords: string[]; description: string }[]> = {
  chest: [
    { id: 'chest_upper', name: 'Верхняя часть груди', keywords: ['верх', 'верхняя', 'upper'], description: 'Клавикулярная порция большой грудной. Жимы на наклонной скамье (30°), сведения снизу.' },
    { id: 'chest_mid', name: 'Центр / середина груди', keywords: ['центр', 'средн', 'середин', 'большая грудная'], description: 'Стернальная порция. Жим лёжа, сведения в кроссовере, баттерфляй.' },
    { id: 'chest_lower', name: 'Нижняя часть груди', keywords: ['низ', 'нижн', 'lower', 'decline'], description: 'Абдоминальная порция. Брусья грудным стилем, жим с отрицательным уклоном.' },
    { id: 'chest_inner', name: 'Внутренняя / внешняя часть', keywords: ['внутрен', 'внешн', 'inner', 'outer'], description: 'Сведение рук, кроссовер — акцент на внутренний край. Жимы с широким хватом — внешний.' },
    { id: 'chest_stretch', name: 'Растяжение / изоляция', keywords: ['растяж', 'stretch', 'изол'], description: 'Разводка гантелей, кроссовер — фокус на растяжение фасции и пиковое сокращение.' },
    { id: 'chest_other', name: 'Взрывная сила / комби', keywords: ['взрыв', 'explosive', 'трицепс', 'плечи', 'кор', 'стабил'], description: 'Жимы с акцентом на взрывную силу, комбинированные движения грудь+трицепс+плечи.' },
  ],
  back: [
    { id: 'back_lats', name: 'Широчайшие мышцы', keywords: ['широчайш', 'lats', 'lat'], description: 'Тяги вертикальные и горизонтальные с локтями вдоль тела. Придают V-образную форму спины.' },
    { id: 'back_mid', name: 'Центр спины / ромбовидные', keywords: ['центр спин', 'ромбовид', 'mid back', 'rhomboid'], description: 'Тяги с локтями в стороны, сведение лопаток. Т-гриф, тяга блока к животу.' },
    { id: 'back_traps', name: 'Трапециевидные мышцы', keywords: ['трапец', 'trap'], description: 'Шраги, становая тяга (верхняя фаза), тяга к подбородку. Верхняя/средняя порция.' },
    { id: 'back_erectors', name: 'Разгибатели позвоночника', keywords: ['разгибател', 'erector', 'позвоночник', 'поясниц'], description: 'Становая тяга, гиперэкстензия, гудморнинг. Задняя цепь, защита позвоночника.' },
    { id: 'back_rear_delt', name: 'Задняя дельта / верх спины', keywords: ['задн', 'rear delt', 'верх спин'], description: 'Тяга к лицу, махи в наклоне. Задняя дельта + ромбовидные + низ трапеций.' },
    { id: 'back_other', name: 'Хват / шея / прочее', keywords: ['хват', 'ше', 'grip', 'neck', 'кор', 'плечи'], description: 'Упражнения на хват, мышцы шеи, комбинированные движения.' },
  ],
  legs: [
    { id: 'legs_quads', name: 'Квадрицепсы', keywords: ['квадрицепс', 'quad', 'прямая мышца'], description: 'Приседания, жим ногами, гакк-присед, разгибания ног. Передняя поверхность бедра.' },
    { id: 'legs_hams', name: 'Бицепс бедра / задняя поверхность', keywords: ['бицепс бедр', 'задн', 'hamstring', 'румын'], description: 'Румынская тяга, сгибания ног, гудморнинг. Задняя цепь бедра.' },
    { id: 'legs_glutes', name: 'Ягодичные мышцы', keywords: ['ягодиц', 'glute', 'hip thrust'], description: 'Ягодичный мост, выпады (широкий шаг), румынская тяга. Большая/средняя/малая ягодичные.' },
    { id: 'legs_calves', name: 'Икроножные / голень', keywords: ['икронож', 'камбаловид', 'calf', 'передн'], description: 'Подъёмы на носки стоя/сидя, жим носками. Гастрокнемиус + камбаловидная + передняя большеберцовая.' },
    { id: 'legs_adductors', name: 'Приводящие мышцы', keywords: ['приводящ', 'adductor'], description: 'Сумо-тяга, сведения ног, выпады в сторону. Внутренняя поверхность бедра.' },
    { id: 'legs_other', name: 'Взрывная сила / всё тело', keywords: ['взрыв', 'explosive', 'всё тело', 'мобильн', 'баланс', 'стабильн'], description: 'Взятия на грудь, рывок, толчок, прыжки — взрывная сила всего тела.' },
  ],
  shoulders: [
    { id: 'sh_front', name: 'Передняя дельта', keywords: ['передн', 'front', 'передняя'], description: 'Жимы над головой (армейский, гантелями), фронтальные подъёмы.' },
    { id: 'sh_side', name: 'Средняя дельта', keywords: ['средн', 'side', 'lateral'], description: 'Махи гантелями/в блоке в стороны, тяга к подбородку (до уровня сосков). Ширина плеч.' },
    { id: 'sh_rear', name: 'Задняя дельта', keywords: ['задн', 'rear', 'задняя дельт'], description: 'Махи в наклоне, тяга к лицу, обратные сведения в тренажёре.' },
    { id: 'sh_cuff', name: 'Ротаторная манжета', keywords: ['ротатор', 'cuff', 'rotator'], description: 'Внешняя/внутренняя ротация с резинкой/гантелью. Профилактика травм плеча.' },
    { id: 'sh_other', name: 'Мобильность / комби', keywords: ['мобильн', 'стабильн', 'кор', 'дельты'], description: 'Мобилизация плечевого пояса, комбинированные жимы дельты+ноги.' },
  ],
  arms: [
    { id: 'arms_biceps', name: 'Бицепс', keywords: ['бицепс', 'bicep', 'длинная головка', 'короткая головк', 'пик'], description: 'Подъёмы штанги/гантелей, молотки, сгибания на скамье Скотта. Длинная + короткая головки.' },
    { id: 'arms_triceps', name: 'Трицепс', keywords: ['трицепс', 'tricep', 'tricep'], description: 'Французский жим, разгибания в блоке, отжимания на брусьях трицепсовым стилем.' },
    { id: 'arms_brachialis', name: 'Брахиалис / брахирадиалис', keywords: ['брахиалис', 'брахирадиал', 'brachial', 'плечелуч'], description: 'Молотки нейтральным хватом, обратные подъёмы. Мышца под бицепсом — визуально толще рука.' },
    { id: 'arms_forearms', name: 'Предплечья / хват', keywords: ['предплеч', 'forearm', 'сгибател', 'разгибател', 'пронатор', 'хват', 'grip'], description: 'Сгибания/разгибания запястий, пронация/супинация, удержание. Сила и объём предплечий.' },
  ],
  core: [
    { id: 'core_rectus', name: 'Прямая мышца живота', keywords: ['прям', 'пресс', 'rectus', 'живот'], description: 'Скручивания, подъёмы ног, планка. Верхняя и нижняя порции прямой мышцы.' },
    { id: 'core_obliques', name: 'Косые мышцы живота', keywords: ['кос', 'oblique'], description: 'Боковые скручивания, повороты с блоком/грифом, «дровосек». Внутренние + наружные косые.' },
    { id: 'core_deep', name: 'Глубокие стабилизаторы', keywords: ['глубок', 'стабил', 'трансверс', 'deep', 'кор'], description: 'Поперечная мышца живота, мультифидус. Вакуум, «мёртвый жук», анти-ротация.' },
    { id: 'core_erectors', name: 'Разгибатели спины', keywords: ['разгибател', 'erector', 'спин'], description: 'Гиперэкстензия, «супермен», удержание корпуса. Защита и стабилизация позвоночника.' },
    { id: 'core_other', name: 'Мобильность / полный кор', keywords: ['мобильн', 'все', 'плечи', 'грудной отдел', 'mobility'], description: 'Мобилизация позвоночника, ротация грудного отдела, комплексные упражнения на кор.' },
  ],
};

const SUB_REGION_COLORS = ['#00e68a', '#60a5fa', '#c084fc', '#f59e0b', '#f87171', '#34d399', '#fbbf24', '#818cf8'];

function getRiskColor(level: string): string {
  if (level === 'high') return '#ef4444'; if (level === 'medium' || level === 'med') return '#f59e0b'; return '#22c55e';
}
function getJointEmoji(level: string): string {
  if (level === 'high') return '🔴'; if (level === 'medium' || level === 'med') return '🟡'; return '🟢';
}
function lvl(v: number, max: number): string {
  const p = v / max; if (p >= 0.7) return '#ef4444'; if (p >= 0.4) return '#f59e0b'; return '#22c55e';
}

interface TechniqueScore { total: number; breakdown: { label: string; value: number; max: number }[]; level: 'low'|'medium'|'high'; label: string; }
function calcTechniqueScore(ex: Exercise): TechniqueScore {
  const bio = getExerciseBio(ex.id);
  const difficulty = estimateDifficulty(ex.id);
  const stress = getJointStress(ex.id);
  const cls = classifyMovement(ex.id);
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
  return { total, breakdown: [
    { label: 'Суставная нагрузка', value: Math.round(jointMax), max: 25 },
    { label: 'Сложность движения', value: Math.round(complexityScore), max: 25 },
    { label: 'ЦНС-нагрузка', value: Math.round(cnsScore), max: 25 },
    { label: 'Стабильность', value: Math.round(stabilityScore), max: 15 },
    { label: 'Мобильность', value: Math.round(mobilityScore), max: 10 },
  ], level: total >= 60 ? 'high' : total >= 30 ? 'medium' : 'low', label: total >= 60 ? 'Сложное' : total >= 30 ? 'Среднее' : 'Простое' };
}

const card: React.CSSProperties = { background: BG, borderRadius: 10, border: `1px solid ${BORDER}`, padding: '10px 12px', marginBottom: 6 };
const pill: React.CSSProperties = { display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 9, fontWeight: 600, marginRight: 4, marginBottom: 3 };
const sectionTitle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: ACCENT, margin: '10px 0 4px', borderBottom: '1px solid rgba(0,230,138,0.15)', paddingBottom: 3 };
const chipRow: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 };

const groupIcon: Record<string, string> = {
  chest: '🏋️', back: '🔙', legs: '🦵', shoulders: '💪', arms: '💪', core: '🎯',
};

export const TargetMuscleCalcTab: React.FC = () => {
  const [group, setGroup] = useState<string>('chest');
  const [expandedEx, setExpandedEx] = useState<string | null>(null);
  const [expandedRegion, setExpandedRegion] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('he_tgt_fav') || '[]'); } catch { return []; } });
  const [showFavOnly, setShowFavOnly] = useState(false);

  useEffect(() => { try { localStorage.setItem('he_tgt_fav', JSON.stringify(favorites)); } catch {} }, [favorites]);
  const toggleFav = (id: string) => setFavorites(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const subregions = SUBREGION_DEFS[group] || [];

  const groupedExercises = useMemo(() => {
    const allGroupExs = EXERCISE_CATALOG.filter(e => e.group === group);
    const result = subregions.map(sr => {
      const matches = allGroupExs.filter(ex => {
        const tm = (ex.targetMuscle || '').toLowerCase();
        return sr.keywords.some(kw => tm.includes(kw.toLowerCase()));
      });
      return {
        ...sr,
        exercises: matches.map(ex => ({
          exercise: ex,
          bio: getExerciseBio(ex.id),
          technique: getTechnique(ex.name),
          score: calcTechniqueScore(ex),
          cues: getCues(ex.name),
          errors: getErrorsForExercise(ex.name),
          progression: getProgression(ex.name),
          synergy: getMuscleSynergy(ex.id),
          jointStress: getJointStress(ex.id),
          classification: classifyMovement(ex.id),
          fVector: forceVector(ex.group, ex.type, ex.name),
          lengthened: lengthenedPartials(ex.group),
        })),
      };
    });
    return result.filter(sr => sr.exercises.length > 0);
  }, [group, subregions]);

  const totalInGroup = EXERCISE_CATALOG.filter(e => e.group === group).length;
  const totalCategorized = groupedExercises.reduce((s, sr) => s + sr.exercises.length, 0);

  const toggleExpandEx = (id: string) => setExpandedEx(prev => prev === id ? null : id);
  const toggleRegion = (id: string) => setExpandedRegion(prev => prev === id ? null : id);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT, marginBottom: 2 }}>🎯 Калькулятор техники по целевой мышце</div>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 12 }}>
        Выберите группу мышц — увидите подрегионы и упражнения, которые их целево нагружают. С полным разбором техники, биомеханики и безопасности.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginBottom: 14 }}>
        <PopupSelect label="Целевая группа мышц" value={group} options={GROUPS.map(g => ({ id: g, label: `${groupIcon[g] || ''} ${GROUP_RU[g]}`, desc: '' }))} hint="Выберите группу для анализа" onChange={v => { setGroup(v); setExpandedEx(null); setExpandedRegion(null); }} />
        <button onClick={() => setShowFavOnly(v => !v)} style={{
          padding: '8px 14px', borderRadius: 8, border: `1px solid ${showFavOnly ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.08)'}`,
          background: showFavOnly ? 'rgba(245,158,11,0.1)' : 'rgba(0,0,0,0.3)', color: showFavOnly ? '#fbbf24' : DIM,
          cursor: 'pointer', fontSize: 10, fontWeight: 600, marginTop: 'auto',
        }}>⭐ Избранное ({favorites.length})</button>
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginBottom: 10 }}>
        {totalCategorized} из {totalInGroup} упражнений группы «{GROUP_RU[group]}» · {groupedExercises.length} подрегионов{showFavOnly ? ' · ⭐ Избранное' : ''}
      </div>

      {groupedExercises.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: DIM, fontSize: 12 }}>В этой группе нет упражнений с указанной целевой мышцей.</div>
      )}

      {groupedExercises.map((sr, srIdx) => {
        const filteredExs = showFavOnly ? sr.exercises.filter(e => favorites.includes(e.exercise.id)) : sr.exercises;
        if (filteredExs.length === 0) return null;
        const isRegionExpanded = expandedRegion === sr.id;

        return (
          <div key={sr.id} style={{ marginBottom: 16 }}>
            <div
              onClick={() => toggleRegion(sr.id)}
              style={{
                ...card,
                cursor: 'pointer',
                border: `2px solid ${SUB_REGION_COLORS[srIdx % SUB_REGION_COLORS.length]}33`,
                borderLeft: `4px solid ${SUB_REGION_COLORS[srIdx % SUB_REGION_COLORS.length]}`,
                marginBottom: 0,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: SUB_REGION_COLORS[srIdx % SUB_REGION_COLORS.length], marginBottom: 4 }}>
                    {sr.name}
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>{sr.description}</div>
                </div>
                <div style={{ textAlign: 'center', minWidth: 70 }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: SUB_REGION_COLORS[srIdx % SUB_REGION_COLORS.length] }}>{filteredExs.length}</div>
                  <div style={{ fontSize: 9, color: DIM }}>упражнений</div>
                </div>
              </div>
              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <button style={{
                  padding: '3px 12px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)',
                  background: 'transparent', color: DIM, cursor: 'pointer', fontSize: 9, fontWeight: 600,
                }}>{isRegionExpanded ? '▲ Свернуть' : '▼ Развернуть упражнения'}</button>
              </div>
            </div>

            {isRegionExpanded && (
              <div style={{ paddingLeft: 8, marginTop: 4 }}>
                {filteredExs.map(({ exercise: ex, bio, technique, score, cues, errors, progression, synergy, jointStress, classification, fVector, lengthened }) => {
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
                  const subList = subs ? subs.substitutes.filter((s: any) => getExerciseById(s.id)) : [];

                  return (
                    <div key={ex.id} style={{ ...card, border: isExpanded ? '1px solid rgba(0,230,138,0.2)' : card.border, marginLeft: 4 }}>
                      <div onClick={() => toggleExpandEx(ex.id)} style={{ cursor: 'pointer' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{ex.name}</span>
                              <button onClick={e => { e.stopPropagation(); toggleFav(ex.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: 0, color: isFav ? '#f59e0b' : DIM }}>{isFav ? '★' : '☆'}</button>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 3 }}>
                              <span style={{ ...pill, background: ex.type === 'compound' ? 'rgba(0,230,138,0.15)' : 'rgba(59,130,246,0.15)', color: ex.type === 'compound' ? ACCENT : '#60a5fa' }}>{TYPE_RU[ex.type] || ex.type}</span>
                              <span style={{ ...pill, background: 'rgba(168,85,247,0.12)', color: '#c084fc' }}>{EQUIP_RU[ex.equipment] || ex.equipment}</span>
                              <span style={{ ...pill, background: ex.difficulty === 'beginner' ? 'rgba(34,197,94,0.12)' : ex.difficulty === 'advanced' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)', color: ex.difficulty === 'beginner' ? '#22c55e' : ex.difficulty === 'advanced' ? '#ef4444' : '#f59e0b' }}>{ex.difficulty === 'beginner' ? 'Новичок' : ex.difficulty === 'advanced' ? 'Продв.' : 'Средний'}</span>
                              {ex.targetMuscle && <span style={{ ...pill, background: 'rgba(255,255,255,0.04)', color: DIM, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.targetMuscle}</span>}
                            </div>
                          </div>
                          <div style={{ textAlign: 'center', minWidth: 50 }}>
                            <div style={{
                              width: 42, height: 42, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: `conic-gradient(${getRiskColor(score.level)} ${score.total * 3.6}deg, rgba(255,255,255,0.06) 0)`, margin: '0 auto',
                            }}>
                              <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: -1 }}>{score.total}</div>
                            </div>
                            <div style={{ fontSize: 7, color: getRiskColor(score.level), marginTop: 1, fontWeight: 700 }}>{score.label}</div>
                          </div>
                        </div>
                        {ex.technique && (
                          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, marginTop: 6, fontStyle: 'italic' }}>
                            {ex.technique.length > 140 ? ex.technique.slice(0, 140) + '…' : ex.technique}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 10, marginTop: 6, fontSize: 9 }}>
                          <span>{getJointEmoji(ex.jointStress)} Суставы: {ex.jointStress === 'high' ? 'высокая' : ex.jointStress === 'med' ? 'средняя' : 'низкая'}</span>
                          {bio && <span>🧠 ЦНС: {bio.cnsDemand}/5</span>}
                          <span style={{ color: getRiskColor(safety.level) }}>{safety.level === 'safe' ? '✅ Безоп.' : safety.level === 'moderate' ? '⚠️ Вним.' : '🚫 Риск.'}</span>
                        </div>
                      </div>

                      {isExpanded && (
                        <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={sectionTitle}>📊 Технический счёт ({score.total}/100)</div>
                          {score.breakdown.map((b, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, fontSize: 9 }}>
                              <div style={{ width: 110, color: DIM, textAlign: 'right', flexShrink: 0 }}>{b.label}</div>
                              <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${(b.value / b.max) * 100}%`, borderRadius: 3, background: lvl(b.value, b.max) }} />
                              </div>
                              <div style={{ width: 28, textAlign: 'right', fontWeight: 700, color: lvl(b.value, b.max) }}>{b.value}</div>
                              <div style={{ width: 16, color: 'rgba(255,255,255,0.2)', fontSize: 8 }}>/ {b.max}</div>
                            </div>
                          ))}

                          {technique ? (
                            <>
                              <div style={sectionTitle}>🎯 Полный разбор техники</div>
                              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
                                <p style={{ margin: '0 0 6px', fontWeight: 700, color: ACCENT }}>Исходное положение:</p>
                                {technique.setup.map((s: string, i: number) => <div key={i} style={{ marginBottom: 2 }}>{i + 1}. {s}</div>)}
                                <p style={{ margin: '8px 0 6px', fontWeight: 700, color: ACCENT }}>Выполнение:</p>
                                {technique.execution.map((s: string, i: number) => <div key={i} style={{ marginBottom: 2 }}>{i + 1}. {s}</div>)}
                                <p style={{ margin: '8px 0 6px', fontWeight: 700, color: ACCENT }}>Дыхание:</p>
                                {technique.breathing.map((s: string, i: number) => <div key={i} style={{ marginBottom: 2, fontStyle: 'italic' }}>{s}</div>)}
                                {technique.preRequisites?.length > 0 && (
                                  <>
                                    <p style={{ margin: '8px 0 6px', fontWeight: 700, color: ACCENT }}>Пререквизиты:</p>
                                    {technique.preRequisites.map((s: string, i: number) => <div key={i} style={{ marginBottom: 2 }}>{i + 1}. {s}</div>)}
                                  </>
                                )}
                              </div>
                            </>
                          ) : ex.technique ? (
                            <>
                              <div style={sectionTitle}>🎯 Техника выполнения</div>
                              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{ex.technique}</div>
                            </>
                          ) : null}

                          {cues.length > 0 && (
                            <>
                              <div style={sectionTitle}>💡 Ключевые подсказки (cues)</div>
                              <div style={chipRow}>
                                {cues.map((c: any, i: number) => (
                                  <span key={i} style={{ ...pill, background: c.priority === 'critical' ? 'rgba(239,68,68,0.12)' : c.priority === 'important' ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.04)', color: c.priority === 'critical' ? '#f87171' : c.priority === 'important' ? '#fbbf24' : DIM, fontSize: 9 }}>
                                    {c.priority === 'critical' ? '⚡' : c.priority === 'important' ? '📌' : '💬'} {c.cue}
                                  </span>
                                ))}
                              </div>
                            </>
                          )}

                          {errors.length > 0 && (
                            <>
                              <div style={sectionTitle}>⚠️ Частые ошибки</div>
                              {errors.map((e: any, i: number) => (
                                <div key={i} style={{ marginBottom: 4, padding: '6px 8px', background: 'rgba(239,68,68,0.05)', borderRadius: 5, border: '1px solid rgba(239,68,68,0.1)' }}>
                                  <div style={{ fontSize: 9, fontWeight: 700, color: '#f87171' }}>{e.error}</div>
                                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', marginTop: 1 }}>Причина: {e.cause}</div>
                                  <div style={{ fontSize: 8, color: '#22c55e', marginTop: 1 }}>Исправление: {e.fix}</div>
                                </div>
                              ))}
                            </>
                          )}

                          {progression.length > 0 && (
                            <>
                              <div style={sectionTitle}>📈 Прогрессия</div>
                              <div style={{ fontSize: 9, color: '#22c55e', background: 'rgba(34,197,94,0.06)', padding: '6px 8px', borderRadius: 5 }}>{progression.join(' → ')}</div>
                            </>
                          )}
                          {(technique?.regression?.length ?? 0) > 0 && (
                            <>
                              <div style={sectionTitle}>📉 Регрессия</div>
                              <div style={{ fontSize: 9, color: '#f59e0b', background: 'rgba(245,158,11,0.06)', padding: '6px 8px', borderRadius: 5 }}>{technique!.regression!.join(' → ')}</div>
                            </>
                          )}

                          {subList.length > 0 && (
                            <>
                              <div style={sectionTitle}>🔄 Цепочка замен</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, fontSize: 9 }}>
                                {subList.map((s: any) => (
                                  <div key={s.id} style={{ background: 'rgba(168,85,247,0.06)', borderRadius: 5, padding: '3px 6px', border: '1px solid rgba(168,85,247,0.1)' }}>
                                    <span style={{ color: '#c084fc', fontWeight: 600 }}>{getExerciseById(s.id)?.name || s.id}</span>
                                    {s.reason && <span style={{ color: DIM, marginLeft: 3, fontSize: 8 }}>— {s.reason}</span>}
                                  </div>
                                ))}
                              </div>
                            </>
                          )}

                          <div style={sectionTitle}>💪 Мышечная синергия</div>
                          {synergy && synergy.primary.length > 0 && (
                            <div style={{ fontSize: 9, lineHeight: 1.5 }}>
                              <div><span style={{ color: ACCENT }}>Основные:</span> {synergy.primary.join(', ')}</div>
                              {synergy.secondary.length > 0 && <div><span style={{ color: '#60a5fa' }}>Вспом.:</span> {synergy.secondary.join(', ')}</div>}
                              {synergy.stabilizers.length > 0 && <div><span style={{ color: '#a855f7' }}>Стаб.:</span> {synergy.stabilizers.join(', ')}</div>}
                              {synergy.synergists.length > 0 && <div><span style={{ color: '#f59e0b' }}>Синерг.:</span> {synergy.synergists.join(', ')}</div>}
                              {synergy.antagonists.length > 0 && <div><span style={{ color: '#ef4444' }}>Антаг.:</span> {synergy.antagonists.join(', ')}</div>}
                            </div>
                          )}

                          {lengthened.length > 0 && (
                            <>
                              <div style={sectionTitle}>🎯 Региональная гипертрофия</div>
                              <div style={{ fontSize: 9, color: DIM, lineHeight: 1.4 }}>{lengthened.map((l: any, i: number) => <div key={i} style={{ marginBottom: 2 }}>• {l.name}: {l.emphasis}</div>)}</div>
                            </>
                          )}

                          <div style={sectionTitle}>⏱ Темпо-прескрипция</div>
                          <div style={{ display: 'flex', gap: 3, alignItems: 'center', marginBottom: 4 }}>
                            {[tempoRes.tempo.eccentric, tempoRes.tempo.pauseBottom, tempoRes.tempo.concentric, tempoRes.tempo.pauseTop].map((sec, i) => {
                              const labels = ['Эксц.', 'Пауза↓', 'Конц.', 'Пауза↑'];
                              const colors = ['#60a5fa', '#f59e0b', '#22c55e', '#a855f7'];
                              return (
                                <div key={i} style={{ flex: 1, textAlign: 'center', background: `${colors[i]}14`, borderRadius: 6, padding: '4px 2px', border: `1px solid ${colors[i]}22` }}>
                                  <div style={{ fontSize: 16, fontWeight: 800, color: colors[i] }}>{sec === 0 ? 'X' : sec}</div>
                                  <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>{labels[i]}</div>
                                </div>
                              );
                            })}
                          </div>
                          <div style={{ fontSize: 8, color: DIM, fontStyle: 'italic' }}>{tempoRes.rationale}</div>

                          <div style={sectionTitle}>🛡 Безопасность ({safety.score}/100)</div>
                          {safety.requiresSpotter && <div style={{ fontSize: 9, color: '#f59e0b' }}>⚠ Требуется страхующий (споттер)</div>}
                          {safety.contraindications.length > 0 && (
                            <div style={{ fontSize: 9, color: '#f87171' }}><b>Противопоказания:</b> {safety.contraindications.join('; ')}</div>
                          )}
                          {safety.precautions.length > 0 && (
                            <div style={{ fontSize: 9, color: '#fbbf24' }}><b>Предосторожности:</b> {safety.precautions.join('; ')}</div>
                          )}
                          {safety.highRiskPopulation.length > 0 && <div style={{ fontSize: 9, color: DIM }}><b>Группы риска:</b> {safety.highRiskPopulation.join(', ')}</div>}

                          <div style={sectionTitle}>📐 Классификация движения</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px', fontSize: 9, color: DIM }}>
                            <div>Плоскость: <b style={{ color: '#fff' }}>{classification.plane}</b></div>
                            <div>Нагрузка: <b style={{ color: '#fff' }}>{classification.loadType}</b></div>
                            <div>Стойка: <b style={{ color: '#fff' }}>{classification.groundingPattern}</b></div>
                            <div>Force-вектор: <b style={{ color: '#c084fc' }}>{fVector}</b></div>
                            {ex.targetMuscle && <div>Целевая: <b style={{ color: ACCENT }}>{ex.targetMuscle}</b></div>}
                          </div>

                          {ex.comments && (
                            <>
                              <div style={sectionTitle}>💬 Комментарий</div>
                              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', lineHeight: 1.4, fontStyle: 'italic' }}>{ex.comments}</div>
                            </>
                          )}

                          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                            <button onClick={() => {
                              const el = document.getElementById(`tgt-print-${ex.id}`);
                              if (el) {
                                const w = window.open('', '_blank', 'width=800,height=600');
                                if (w) { w.document.write(`<html><head><title>${ex.name} - Техника</title><style>body{font-family:sans-serif;font-size:12px;line-height:1.6;padding:20px;color:#000;background:#fff}h2{color:#333}.section{margin:12px 0;padding:8px;border-left:3px solid #00e68a}.label{font-weight:700;color:#00e68a}</style></head><body>${el.innerHTML}</body></html>`); w.document.close(); setTimeout(() => w.print(), 300); }
                              }
                            }} style={{ padding: '4px 10px', borderRadius: 5, border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.06)', color: ACCENT, cursor: 'pointer', fontWeight: 600, fontSize: 9 }}>🖨 Печать</button>
                            <button onClick={() => { navigator.clipboard.writeText(document.getElementById(`tgt-print-${ex.id}`)?.innerText || ''); }} style={{ padding: '4px 10px', borderRadius: 5, border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.06)', color: '#60a5fa', cursor: 'pointer', fontWeight: 600, fontSize: 9 }}>📋 Копировать</button>
                          </div>

                          <div id={`tgt-print-${ex.id}`} style={{ display: 'none' }}>
                            <h2>{ex.name}</h2>
                            <p><b>Тип:</b> {TYPE_RU[ex.type]} · <b>Оборудование:</b> {EQUIP_RU[ex.equipment]} · <b>Сложность:</b> {score.label} ({score.total}/100)</p>
                            {technique && (
                              <>
                                <div className="section"><p className="label">Исходное положение:</p><ul>{technique.setup.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div>
                                <div className="section"><p className="label">Выполнение:</p><ul>{technique.execution.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div>
                                <div className="section"><p className="label">Дыхание:</p><ul>{technique.breathing.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div>
                              </>
                            )}
                            {!technique && ex.technique && <div className="section"><p className="label">Техника:</p><p>{ex.technique}</p></div>}
                            {errors.length > 0 && <div className="section"><p className="label">Ошибки:</p><ul>{errors.map((e: any, i: number) => <li key={i}><b>{e.error}</b> — {e.fix}</li>)}</ul></div>}
                            <p><b>Темпо:</b> {tempoRes.pattern} · <b>RPE/RIR:</b> {tempoRes.targetRPE}/{tempoRes.targetRIR}</p>
                            <p><b>Безопасность:</b> {safety.score}/100</p>
                          </div>
                        </div>
                      )}

                      <div style={{ marginTop: isExpanded ? 10 : 4, textAlign: 'center' }}>
                        <button onClick={() => toggleExpandEx(ex.id)} style={{
                          padding: '3px 14px', borderRadius: 14, border: '1px solid rgba(0,230,138,0.15)',
                          background: isExpanded ? 'rgba(0,230,138,0.06)' : 'transparent', color: isExpanded ? ACCENT : DIM, cursor: 'pointer', fontSize: 9, fontWeight: 600,
                        }}>{isExpanded ? '▲ Свернуть' : '▼ Развернуть разбор'}</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default TargetMuscleCalcTab;
