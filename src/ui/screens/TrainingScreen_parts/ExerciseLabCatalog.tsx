import React, { useMemo, useState } from 'react';
import { EXERCISE_CATALOG, canReplace } from '../../../core/exercise-catalog';
import { getExerciseBio } from '../../../data/exercise-biomechanics-db';
import { PopupSelect } from '../SRCBBScreen_parts/TrainingPopups';
import { ACCENT, DIM, SMALL, GROUP_RU, TYPE_RU, EQUIP_RU, GROUPS, BodyMapSVG, muscleToRegion } from './ExerciseLabShared';
import type { Exercise } from '../../../core/types';

const MUSCLE_GROUPS = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'] as const;
const DIFF_RU: Record<string, string> = { beginner: 'Начальное', intermediate: 'Среднее', advanced: 'Продвинутое' };
const EQUIP_ICON: Record<string, string> = { barbell: '🏋️', dumbbell: '💪', machine: '⚙️', cable: '🔗', bodyweight: '🧘', band: '🟢', kettlebell: '🟤', smith: '⚒️', plate: '🥏', suspension: '🪢' };

const PATTERN_RU: Record<string, string> = {
  squat: 'Присед', hinge: 'Тяга', horizontal_push: 'Горизонт. жим', vertical_push: 'Вертик. жим',
  horizontal_pull: 'Горизонт. тяга', vertical_pull: 'Вертик. тяга', lunge: 'Выпады',
  carry: 'Переноска', rotation: 'Ротация', anti_rotation: 'Анти-ротация',
  anti_extension: 'Анти-экстензия', anti_lateral_flexion: 'Анти-латер. сгиб', hip_extension: 'Экстензия бедра',
  knee_flexion: 'Сгибание колена', elbow_flexion: 'Сгибание локтя', elbow_extension: 'Разгибание локтя',
  shoulder_abduction: 'Отведение плеча', shoulder_flexion: 'Сгибание плеча', plantar_flexion: 'Сгибание стопы',
  dorsiflexion: 'Разгибание стопы', spinal_flexion: 'Сгибание позвоночника', spinal_extension: 'Разгибание позвоночника'
};

const TORQUE_RU: Record<string, string> = {
  bottom_peak: 'Пик в нижней точке', midrange_peak: 'Пик в середине', top_peak: 'Пик в верхней точке', uniform: 'Равномерно'
};

const CATEGORY_RU: Record<string, string> = {
  powerlifting: 'Пауэрлифтинг', bodybuilding: 'Бодибилдинг', weightlifting: 'Тяжёлая атлетика',
  strongman: 'Стронгмен', accessory: 'Вспомогательное', rehab: 'Реабилитация', cardio: 'Кардио'
};

const RISK_COLOR: Record<string, string> = { low: '#22c55e', medium: '#f59e0b', high: '#ef4444' };
const LOAD_COLOR: Record<string, string> = { low: '#22c55e', medium: '#f59e0b', high: '#ef4444' };

const ExerciseLabCatalog: React.FC<{
  onSelectExercise?: (ex: Exercise) => void;
}> = ({ onSelectExercise }) => {
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState('all');
  const [type, setType] = useState('all');
  const [equipment, setEquipment] = useState('all');
  const [difficulty, setDifficulty] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visible, setVisible] = useState(40);

  const filtered = useMemo(() => {
    let list = EXERCISE_CATALOG;
    if (group !== 'all') list = list.filter(e => e.group === group);
    if (type !== 'all') list = list.filter(e => e.type === type);
    if (equipment !== 'all') list = list.filter(e => e.equipment === equipment);
    if (difficulty !== 'all') list = list.filter(e => e.difficulty === difficulty);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(e => e.name.toLowerCase().includes(s) || (e.targetMuscle || '').toLowerCase().includes(s) || (e.technique || '').toLowerCase().includes(s));
    }
    return list;
  }, [search, group, type, equipment, difficulty]);

  const selectedEx = useMemo(() => EXERCISE_CATALOG.find(e => e.id === selectedId), [selectedId]);
  const selectedBio = useMemo(() => selectedId ? getExerciseBio(selectedId) : null, [selectedId]);
  // 🗺 Карта работающих мышц (primary/secondary → регионы тела).
  const primaryRegions = useMemo(() => selectedBio ? [...new Set((selectedBio.primaryMuscles || []).map(muscleToRegion).filter(r => r !== 'other'))] : [], [selectedBio]);
  const secondaryRegions = useMemo(() => selectedBio ? [...new Set((selectedBio.secondaryMuscles || []).map(muscleToRegion).filter(r => r !== 'other'))] : [], [selectedBio]);
  const visibleList = filtered.slice(0, visible);

  const groupOptions = [
    { id: 'all', label: 'Все группы' },
    ...MUSCLE_GROUPS.map(g => ({ id: g, label: GROUP_RU[g] })),
  ];
  const typeOptions = [
    { id: 'all', label: 'Все типы' },
    { id: 'compound', label: 'Базовые' },
    { id: 'isolation', label: 'Изолирующие' },
  ];
  const equipOptions = [
    { id: 'all', label: 'Весь инвентарь' },
    { id: 'barbell', label: 'Штанга' },
    { id: 'dumbbell', label: 'Гантели' },
    { id: 'machine', label: 'Тренажёр' },
    { id: 'cable', label: 'Блок' },
    { id: 'bodyweight', label: 'Вес тела' },
    { id: 'kettlebell', label: 'Гиря' },
    { id: 'band', label: 'Резина' },
    { id: 'smith', label: 'Смит' },
  ];
  const diffOptions = [
    { id: 'all', label: 'Любая сложность' },
    { id: 'beginner', label: 'Начальные' },
    { id: 'intermediate', label: 'Средние' },
    { id: 'advanced', label: 'Продвинутые' },
  ];

  const filterReset = () => setVisible(40);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', color: '#fff' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: ACCENT, margin: '4px 0 8px' }}>🏋️ Каталог упражнений</div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10 }}>
        Полный каталог упражнений (~500+) с фильтрами, биомеханикой, техникой и распределением нагрузки.
        Кликните по упражнению для полной информации.
      </div>

      {/* Фильтры */}
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 14, padding: '10px', border: '1px solid var(--border)', marginBottom: 8 }}>
        <input type="text" value={search} onChange={e => { setSearch(e.target.value); setVisible(40); }}
          placeholder="🔍 Поиск по названию, мышце, технике..." style={{ width: '100%', padding: '10px 12px', borderRadius: 10, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box', marginBottom: 8 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <PopupSelect label="Группа" value={group} options={groupOptions} onChange={v => { setGroup(v); filterReset(); }} />
          <PopupSelect label="Тип" value={type} options={typeOptions} onChange={v => { setType(v); filterReset(); }} />
          <PopupSelect label="Инвентарь" value={equipment} options={equipOptions} onChange={v => { setEquipment(v); filterReset(); }} />
          <PopupSelect label="Сложность" value={difficulty} options={diffOptions} onChange={v => { setDifficulty(v); filterReset(); }} />
        </div>
      </div>

      {/* Список упражнений */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: '60vh', overflowY: 'auto', paddingRight: 2 }}>
        {visibleList.map(ex => {
          const isSelected = selectedEx?.id === ex.id;
          const equipIcon = EQUIP_ICON[ex.equipment] || '📦';
          const bio = getExerciseBio(ex.id);
          return (
            <div key={ex.id} onClick={() => setSelectedId(isSelected ? null : ex.id)} style={{
              padding: '8px 10px', borderRadius: 12, cursor: 'pointer',
              background: isSelected ? 'linear-gradient(135deg, rgba(0,230,138,0.08), rgba(59,130,246,0.04))' : 'var(--bg-secondary)',
              border: isSelected ? '1px solid rgba(0,230,138,0.3)' : '1px solid var(--border)',
              transition: 'all 0.15s',
            }}>
              {/* Сводная строка */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: isSelected ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                  {ex.type === 'compound' ? '🔩' : '🎯'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: isSelected ? 'var(--accent)' : 'var(--text-light)', lineHeight: 1.2 }}>{ex.name}</div>
                  <div style={{ display: 'flex', gap: 3, marginTop: 2, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, padding: '1px 4px', borderRadius: 3, background: 'rgba(255,255,255,0.04)', color: 'var(--text-dim)' }}>{equipIcon} {EQUIP_RU[ex.equipment] || ex.equipment}</span>
                    <span style={{ fontSize: 10, padding: '1px 4px', borderRadius: 3, background: 'rgba(255,255,255,0.04)', color: 'var(--text-dim)' }}>{GROUP_RU[ex.group]}</span>
                    <span style={{ fontSize: 10, padding: '1px 4px', borderRadius: 3, background: ex.jointStress === 'high' ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)', color: ex.jointStress === 'high' ? '#ef4444' : '#22c55e' }}>
                      {ex.jointStress === 'high' ? '⚠ сустав' : ex.jointStress === 'med' ? 'средне' : '✓ сустав'}
                    </span>
                    {bio && <span style={{ fontSize: 10, padding: '1px 4px', borderRadius: 3, background: RISK_COLOR[bio.riskProfile] + '14', color: RISK_COLOR[bio.riskProfile] }}>{bio.riskProfile === 'low' ? '✓ риск' : bio.riskProfile === 'medium' ? '⚠ риск' : '🛑 риск'}</span>}
                  </div>
                </div>
                <span style={{ fontSize: 10, color: isSelected ? 'var(--accent)' : 'var(--text-dim)', transition: 'transform 0.15s', transform: isSelected ? 'rotate(180deg)' : 'none' }}>▼</span>
              </div>

              {/* ПОЛНАЯ КАРТОЧКА */}
              {isSelected && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>

                  {/* Бейджи */}
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 6 }}>
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(0,230,138,0.08)', color: 'var(--accent)' }}>{ex.type === 'compound' ? '🔩 Базовое' : '🎯 Изолирующее'}</span>
                    {ex.difficulty && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: ex.difficulty === 'advanced' ? 'rgba(239,68,68,0.08)' : 'rgba(249,115,22,0.08)', color: ex.difficulty === 'advanced' ? '#ef4444' : ex.difficulty === 'intermediate' ? '#f97316' : '#22c55e' }}>{DIFF_RU[ex.difficulty]}</span>}
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(139,92,246,0.08)', color: '#8b5cf6' }}>Усталость: {ex.fatigueCost}/10</span>
                    {ex.targetMuscle && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(236,72,153,0.08)', color: '#ec4899' }}>🎯 {ex.targetMuscle}</span>}
                    {ex.movementPattern && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(59,130,246,0.08)', color: '#60a5fa' }}>📐 {PATTERN_RU[ex.movementPattern] || ex.movementPattern}</span>}
                    {ex.movementType && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(167,139,250,0.08)', color: '#a78bfa' }}>{ex.movementType === 'competition_lift' ? '🏆 Соревновательное' : ex.movementType}</span>}
                    {bio?.isCompetition && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(245,158,11,0.08)', color: '#f59e0b' }}>🏆 Competition</span>}
                    {bio?.isUnilateral && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(34,197,94,0.08)', color: '#22c55e' }}>1️⃣ Унилатеральное</span>}
                  </div>

                  {/* 🗺 Карта работающих мышц (из демо-панели ПЛ-авто) */}
                  {selectedBio && (primaryRegions.length > 0 || secondaryRegions.length > 0) && (
                    <div style={{ marginBottom: 4, display: 'flex', gap: 10, alignItems: 'center', background: 'rgba(0,230,138,0.03)', borderRadius: 8, padding: '6px 8px' }}>
                      <BodyMapSVG primary={primaryRegions} secondary={secondaryRegions} size={72} />
                      <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.5, minWidth: 0 }}>
                        <b style={{ color: ACCENT }}>🗺 Карта работающих мышц:</b>
                        <div style={{ color: ACCENT, marginTop: 2 }}>• Основные: {primaryRegions.map(r => GROUP_RU[r] || r).join(', ') || '—'}</div>
                        <div>• Вспомогательные: {secondaryRegions.map(r => GROUP_RU[r] || r).join(', ') || '—'}</div>
                      </div>
                    </div>
                  )}

                  {/* Техника выполнения */}
                  {ex.technique && (
                    <div style={{ marginBottom: 4, background: 'rgba(0,230,138,0.04)', borderRadius: 8, padding: '6px 8px', fontSize: 10, color: 'var(--text)', lineHeight: 1.4 }}>
                      <b style={{ color: ACCENT }}>🎯 Техника:</b> {ex.technique}
                    </div>
                  )}

                  {/* Комментарии */}
                  {ex.comments && (
                    <div style={{ marginBottom: 4, background: 'rgba(255,145,0,0.04)', borderRadius: 8, padding: '6px 8px', fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.4 }}>
                      <b style={{ color: '#f97316' }}>💡 Комментарии:</b> {ex.comments}
                    </div>
                  )}

                  {/* Дефолтные параметры сет/повт/отдых/RIR */}
                  {(ex.sets || ex.reps || ex.rest || ex.rir) && (
                    <div style={{ marginBottom: 4, background: 'rgba(59,130,246,0.04)', borderRadius: 8, padding: '6px 8px', fontSize: 10, color: 'var(--text-dim)' }}>
                      <b style={{ color: '#60a5fa' }}>📋 Дефолт:</b> {ex.sets ? `${ex.sets}×` : ''}{ex.reps ? `${ex.reps} повт` : ''}{ex.rir !== undefined ? ` RIR${ex.rir}` : ''}{ex.rest ? ` · отдых ${ex.rest}с` : ''}{ex.weight ? ` · ${ex.weight}кг` : ''}
                    </div>
                  )}

                  {/* Спец-форматы: дроп-сет, backoff, peakContraction, stretchPhase */}
                  {(ex.dropSet || ex.backoffSet || ex.peakContraction || ex.stretchPhase || ex.pauseSeconds || ex.setFormat) && (
                    <div style={{ marginBottom: 4, background: 'rgba(167,139,250,0.04)', borderRadius: 8, padding: '6px 8px', fontSize: 10, color: '#a78bfa', lineHeight: 1.4 }}>
                      <b>⚡ Спец-форматы:</b>
                      {ex.dropSet && <span style={{ marginLeft: 4 }}> Drop-set{ex.dropSetReps ? ` (${ex.dropSetReps})` : ''}</span>}
                      {ex.backoffSet && <span style={{ marginLeft: 4 }}> Backoff-set</span>}
                      {ex.peakContraction && <span style={{ marginLeft: 4 }}> Пик-сокращение</span>}
                      {ex.stretchPhase && <span style={{ marginLeft: 4 }}> Stretch-фаза</span>}
                      {ex.pauseSeconds ? <span style={{ marginLeft: 4 }}> Пауза {ex.pauseSeconds}с</span> : null}
                      {ex.setFormat && <span style={{ marginLeft: 4 }}> Формат: {String(ex.setFormat)}</span>}
                    </div>
                  )}

                  {/* БИОМЕХАНИКА — полная */}
                  {bio && (
                    <>
                      <div style={{ marginBottom: 4, background: 'rgba(59,130,246,0.04)', borderRadius: 8, padding: '6px 8px', fontSize: 10, color: 'var(--text-dim)' }}>
                        <b style={{ color: '#60a5fa' }}>🔬 Биомеханика:</b> {CATEGORY_RU[bio.category] || bio.category} · {PATTERN_RU[bio.pattern] || bio.pattern} · Крутящий момент: {TORQUE_RU[bio.torqueProfile] || bio.torqueProfile}
                      </div>

                      {/* Нагрузка на суставы — цветная шкала */}
                      <div style={{ marginBottom: 4, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
                        {bio.spineLoad && (
                          <div style={{ background: LOAD_COLOR[bio.spineLoad] + '10', borderRadius: 6, padding: '4px 6px', textAlign: 'center', border: `1px solid ${LOAD_COLOR[bio.spineLoad]}30` }}>
                            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>🦴 Позвоночник</div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: LOAD_COLOR[bio.spineLoad] }}>{bio.spineLoad === 'high' ? 'Высокая' : bio.spineLoad === 'medium' ? 'Средняя' : 'Низкая'}</div>
                          </div>
                        )}
                        {bio.kneeLoad && (
                          <div style={{ background: LOAD_COLOR[bio.kneeLoad] + '10', borderRadius: 6, padding: '4px 6px', textAlign: 'center', border: `1px solid ${LOAD_COLOR[bio.kneeLoad]}30` }}>
                            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>🦵 Колено</div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: LOAD_COLOR[bio.kneeLoad] }}>{bio.kneeLoad === 'high' ? 'Высокая' : bio.kneeLoad === 'medium' ? 'Средняя' : 'Низкая'}</div>
                          </div>
                        )}
                        {bio.shoulderLoad && (
                          <div style={{ background: LOAD_COLOR[bio.shoulderLoad] + '10', borderRadius: 6, padding: '4px 6px', textAlign: 'center', border: `1px solid ${LOAD_COLOR[bio.shoulderLoad]}30` }}>
                            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>💪 Плечо</div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: LOAD_COLOR[bio.shoulderLoad] }}>{bio.shoulderLoad === 'high' ? 'Высокая' : bio.shoulderLoad === 'medium' ? 'Средняя' : 'Низкая'}</div>
                          </div>
                        )}
                      </div>

                      {/* Детальные баллы нагрузки на суставы */}
                      {bio.jointStress && Object.keys(bio.jointStress).length > 0 && (
                        <div style={{ marginBottom: 4, background: 'rgba(99,102,241,0.04)', borderRadius: 8, padding: '5px 8px', fontSize: 10, color: 'var(--text-dim)' }}>
                          <b style={{ color: '#818cf8' }}>📊 Детально:</b> {Object.entries(bio.jointStress).map(([k, v]) => `${k} ${v}/10`).join(' · ')}
                        </div>
                      )}

                      {/* ЦНС и сложность */}
                      <div style={{ marginBottom: 4, display: 'flex', gap: 4 }}>
                        <div style={{ flex: 1, background: 'rgba(245,158,11,0.04)', borderRadius: 6, padding: '4px 6px', textAlign: 'center' }}>
                          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>🧠 ЦНС</div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b' }}>{bio.cnsDemand || 5}/5</div>
                        </div>
                        <div style={{ flex: 1, background: 'rgba(34,197,94,0.04)', borderRadius: 6, padding: '4px 6px', textAlign: 'center' }}>
                          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>📊 Сложность</div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#22c55e' }}>{bio.difficulty}/10</div>
                        </div>
                        <div style={{ flex: 1, background: RISK_COLOR[bio.riskProfile] + '08', borderRadius: 6, padding: '4px 6px', textAlign: 'center' }}>
                          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>⚠ Риск</div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: RISK_COLOR[bio.riskProfile] }}>{bio.riskProfile === 'low' ? 'Низкий' : bio.riskProfile === 'medium' ? 'Средний' : 'Высокий'}</div>
                        </div>
                      </div>

                      {/* Мышцы: primary / secondary / stabilizers */}
                      <div style={{ marginBottom: 4 }}>
                        {bio.primaryMuscles && bio.primaryMuscles.length > 0 && (
                          <div style={{ background: 'rgba(0,230,138,0.06)', borderRadius: 6, padding: '5px 8px', fontSize: 10, color: 'var(--text)', marginBottom: 2 }}>
                            <b style={{ color: ACCENT }}>🎯 Основные:</b> {bio.primaryMuscles.map(m => GROUP_RU[m] || m).join(', ')}
                          </div>
                        )}
                        {bio.secondaryMuscles && bio.secondaryMuscles.length > 0 && (
                          <div style={{ background: 'rgba(59,130,246,0.06)', borderRadius: 6, padding: '5px 8px', fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>
                            <b style={{ color: '#60a5fa' }}>↳ Вспомогательные:</b> {bio.secondaryMuscles.map(m => GROUP_RU[m] || m).join(', ')}
                          </div>
                        )}
                        {bio.stabilizers && bio.stabilizers.length > 0 && (
                          <div style={{ background: 'rgba(139,92,246,0.06)', borderRadius: 6, padding: '5px 8px', fontSize: 10, color: 'var(--text-dim)' }}>
                            <b style={{ color: '#8b5cf6' }}>🛡 Стабилизаторы:</b> {bio.stabilizers.map(m => GROUP_RU[m] || m).join(', ')}
                          </div>
                        )}
                      </div>

                      {/* ROM требования */}
                      {bio.romRequirements && Object.keys(bio.romRequirements).length > 0 && (
                        <div style={{ marginBottom: 4, background: 'rgba(236,72,153,0.04)', borderRadius: 8, padding: '5px 8px', fontSize: 10, color: 'var(--text-dim)' }}>
                          <b style={{ color: '#ec4899' }}>📐 ROM:</b> {Object.entries(bio.romRequirements).map(([k, v]) => `${k} ${v}°`).join(' · ')}
                        </div>
                      )}

                      {/* Технические подсказки */}
                      {bio.techniqueCues && bio.techniqueCues.length > 0 && (
                        <div style={{ marginBottom: 4, background: 'rgba(0,230,138,0.04)', borderRadius: 8, padding: '6px 8px', fontSize: 10, color: 'var(--text)', lineHeight: 1.5 }}>
                          <b style={{ color: ACCENT }}>🎯 Технические подсказки:</b>
                          {bio.techniqueCues.map((cue, ci) => <div key={ci} style={{ marginLeft: 8 }}>• {cue}</div>)}
                        </div>
                      )}

                      {/* Замены из биомеханики */}
                      {bio.substitutions && bio.substitutions.length > 0 && (
                        <div style={{ marginBottom: 4, background: 'rgba(245,158,11,0.04)', borderRadius: 8, padding: '5px 8px', fontSize: 10, color: 'var(--text-dim)' }}>
                          <b style={{ color: '#f59e0b' }}>🔄 Замены (биомех):</b> {bio.substitutions.map(s => { const rep = EXERCISE_CATALOG.find(e => e.id === s); return rep ? rep.name : s; }).join(', ')}
                        </div>
                      )}
                    </>
                  )}

                  {/* Замены из каталога */}
                  {ex.canReplace && ex.canReplace.length > 0 && (
                    <div style={{ marginBottom: 4, display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center' }}>
                      <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>✅ Можно заменить:</span>
                      {ex.canReplace.map(r => { const rep = EXERCISE_CATALOG.find(e => e.id === r); return rep ? <span key={r} style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: 'rgba(0,230,138,0.06)', color: 'var(--accent)' }}>{rep.name}</span> : null; })}
                    </div>
                  )}

                  {/* Нельзя заменять */}
                  {ex.cannotReplace && ex.cannotReplace.length > 0 && (
                    <div style={{ marginBottom: 4, display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center' }}>
                      <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>🚫 Нельзя заменять:</span>
                      {ex.cannotReplace.map(r => { const rep = EXERCISE_CATALOG.find(e => e.id === r); return rep ? <span key={r} style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: 'rgba(239,68,68,0.06)', color: '#ef4444' }}>{rep.name}</span> : null; })}
                    </div>
                  )}

                  {/* Группа замены */}
                  {ex.substitutionGroup && (
                    <div style={{ marginBottom: 4, fontSize: 10, color: 'var(--text-dim)' }}>
                      <b>🔀 Группа замены:</b> {ex.substitutionGroup}
                    </div>
                  )}

                  {/* Кнопка выбора — если в режиме выбора */}
                  {onSelectExercise && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onSelectExercise(ex); }}
                      style={{ width: '100%', marginTop: 6, padding: '12px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #00e68a, #00b36b)', color: '#000', fontWeight: 800, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(0,230,138,0.3)' }}
                    >
                      ✓ Выбрать это упражнение
                    </button>
                  )}

                  <button onClick={() => setSelectedId(null)} style={{ width: '100%', marginTop: 4, padding: '8px', borderRadius: 8, border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.06)', color: 'var(--accent)', fontWeight: 700, fontSize: 11, cursor: 'pointer', transition: 'all 0.3s' }}>
                    ▲ Свернуть
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-dim)', fontSize: 11 }}>Упражнения не найдены</div>}
        {filtered.length > visible && (
          <button onClick={() => setVisible(v => v + 40)} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid rgba(0,230,138,0.2)', background: 'rgba(0,230,138,0.04)', color: 'var(--accent)', cursor: 'pointer', fontSize: 11, fontWeight: 600, marginTop: 4 }}>
            ▼ Показать ещё ({filtered.length - visible} из {filtered.length})
          </button>
        )}
      </div>
    </div>
  );
};

export default ExerciseLabCatalog;
