/**
 * TrainingProfileCard.tsx — единая карточка «Профиль тренированности».
 * Реальные входные данные, общие для ПЛ/ББ/ручного конструктора/калькуляторов.
 */
import React, { useState } from 'react';
import { PopupNumber, PopupSelect, PopupExerciseList } from '../SRCBBScreen_parts/TrainingPopups';
import { EQUIPMENT_OPTIONS, WEAK_GROUP_OPTIONS, type TrainingProfile } from './training-profile';

const ACCENT = '#00e68a';
const H: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: ACCENT, margin: '4px 0 8px' };
const LABEL: React.CSSProperties = { color: 'rgba(255,255,255,0.55)', fontSize: 10, margin: '6px 0 4px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.3 };

export const TrainingProfileCard: React.FC<{ profile: TrainingProfile; update: (patch: Partial<TrainingProfile>) => void; compact?: boolean }> = ({ profile, update, compact }) => {
  const toggleArr = (key: 'weakPoints' | 'equipment', id: string) => {
    const arr = profile[key];
    update({ [key]: arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id] } as Partial<TrainingProfile>);
  };
  const wm = profile.workMax;
  const setWm = (k: string, v: number) => update({ workMax: { [k]: v } });
  return (
    <div style={{ background: 'rgba(24,24,27,0.6)', borderRadius: 12, border: '1px solid rgba(0,230,138,0.2)', padding: 12, margin: '0 0 10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: ACCENT }}>🧬 Профиль тренированности</div>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>единый источник данных</span>
      </div>

      <div style={LABEL}>Цель и уровень</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <PopupSelect label="Цель" value={profile.goal} onChange={v => update({ goal: v })} options={[['bulk','Масса'],['cut','Сушка'],['strength','Сила'],['maintenance','Поддержание'],['recomp','Рекомпозиция'],['rehab','Реабилитация']].map(([id,l]) => ({ id, label: l }))} />
        <PopupSelect label="Уровень" value={profile.level} onChange={v => update({ level: v })} options={[['beginner','Новичок'],['intermediate','Средний'],['advanced','Продвинутый'],['enhanced','Enhanced']].map(([id,l]) => ({ id, label: l }))} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginTop: 6 }}>
        <PopupNumber label="Тренировочный стаж" value={profile.trainingYears} min={0} max={50} suffix=" лет" onChange={v => update({ trainingYears: v })} />
      </div>

      <div style={LABEL}>Антропометрия и восстановление</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
        <PopupNumber label="Вес тела" value={profile.bodyWeight} min={40} max={200} suffix=" кг" onChange={v => update({ bodyWeight: v })} />
        <PopupNumber label="Дней/нед" value={profile.daysPerWeek} min={2} max={7} onChange={v => update({ daysPerWeek: v })} />
        <PopupNumber label="Сон" value={profile.sleepHours} min={3} max={12} suffix=" ч" onChange={v => update({ sleepHours: v })} />
        <PopupNumber label="Стресс" value={profile.stressLevel} min={1} max={10} onChange={v => update({ stressLevel: v })} />
        <PopupNumber label="Восст." value={profile.recovery} min={1} max={10} onChange={v => update({ recovery: v })} />
        <PopupNumber label="Усталость" value={profile.fatigue} min={1} max={10} onChange={v => update({ fatigue: v })} />
      </div>

      <div style={LABEL}>Предельные максимумы (ПМ), кг</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <PopupNumber label="Присед" value={profile.pmSquat} min={20} max={500} suffix=" кг" onChange={v => update({ pmSquat: v })} />
        <PopupNumber label="Жим лёжа" value={profile.pmBench} min={20} max={400} suffix=" кг" onChange={v => update({ pmBench: v })} />
        <PopupNumber label="Становая" value={profile.pmDead} min={20} max={500} suffix=" кг" onChange={v => update({ pmDead: v })} />
      </div>

      <div style={LABEL}>Рабочие максимумы по группам (кг)</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {Object.keys(wm).filter(k => ['chest','back','legs','shoulders','arms','core'].includes(k)).map(k => {
          const RU: Record<string,string> = { chest:'Грудь', back:'Спина', legs:'Ноги', shoulders:'Плечи', arms:'Руки', core:'Кор' };
          return <PopupNumber key={k} label={RU[k] || k} value={wm[k] || 80} min={10} max={400} suffix=" кг" onChange={v => setWm(k, v)} />;
        })}
      </div>

      <div style={LABEL}>Слабые группы (акцент)</div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {WEAK_GROUP_OPTIONS.map(o => {
          const on = profile.weakPoints.includes(o.id);
          return <button key={o.id} onClick={() => toggleArr('weakPoints', o.id)} style={{ padding: '5px 10px', borderRadius: 14, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: on ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.08)', background: on ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.02)', color: on ? '#00e68a' : 'rgba(255,255,255,0.6)' }}>{o.label}{on ? ' ✓' : ''}</button>;
        })}
      </div>

      <div style={LABEL}>Доступное оборудование</div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {EQUIPMENT_OPTIONS.map(o => {
          const on = profile.equipment.includes(o.id);
          return <button key={o.id} onClick={() => toggleArr('equipment', o.id)} style={{ padding: '5px 10px', borderRadius: 14, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: on ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.08)', background: on ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.02)', color: on ? '#00e68a' : 'rgba(255,255,255,0.6)' }}>{o.label}{on ? ' ✓' : ''}</button>;
        })}
      </div>
      <div style={LABEL}>🩹 Травмы / ограничения</div>
      {(() => {
        const [injMuscle, setInjMuscle] = useState('chest');
        const [injFrom, setInjFrom] = useState('');
        const [injTo, setInjTo] = useState('');
        const [injGraded, setInjGraded] = useState(false);
        const [injExclude, setInjExclude] = useState(false);
        const [injWeightPct, setInjWeightPct] = useState(80);
        const [injVolPct, setInjVolPct] = useState(80);
        const [injRepsCap, setInjRepsCap] = useState(12);
        const INJ_GROUPS: [string, string][] = [['chest','Грудь'],['back','Спина'],['legs','Ноги'],['shoulders','Плечи'],['arms','Руки'],['core','Кор']];
        return (
          <div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>Указанные группы исключаются из генерации плана на активный период.</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr auto', gap: 6, marginBottom: 8, alignItems: 'end' }}>
              <div>
                <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>Группа</label>
                <select value={injMuscle} onChange={e => setInjMuscle(e.target.value)} style={{ width: '100%', background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '6px 8px', fontSize: 11 }}>
                  {INJ_GROUPS.map(([g, l]) => <option key={g} value={g}>{l}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>С</label>
                <input type="date" value={injFrom} onChange={e => setInjFrom(e.target.value)} style={{ width: '100%', background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '6px 8px', fontSize: 11 }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>До (опц)</label>
                <input type="date" value={injTo} onChange={e => setInjTo(e.target.value)} style={{ width: '100%', background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '6px 8px', fontSize: 11 }} />
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center', gridColumn: '1 / -1' }}>
                <button onClick={() => { setInjGraded(!injGraded); setInjExclude(false); }} style={{ padding: '4px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: injGraded ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.08)', background: injGraded ? 'rgba(245,158,11,0.1)' : 'transparent', color: injGraded ? '#f59e0b' : 'rgba(255,255,255,0.4)' }}>⚡ Щадящая</button>
                <button onClick={() => { setInjExclude(!injExclude); setInjGraded(false); }} style={{ padding: '4px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: injExclude ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.08)', background: injExclude ? 'rgba(239,68,68,0.1)' : 'transparent', color: injExclude ? '#ef4444' : 'rgba(255,255,255,0.4)' }}>⛔ Исключить</button>
                {injGraded && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Вес {injWeightPct}% · Объём {injVolPct}% · Повт ≤{injRepsCap}</span>}
              </div>
              {injGraded && (
                <div style={{ display: 'flex', gap: 6, gridColumn: '1 / -1', alignItems: 'center' }}>
                  <input type="range" min={30} max={100} value={injWeightPct} onChange={e => setInjWeightPct(+e.target.value)} style={{ flex: 1 }} />
                  <input type="range" min={30} max={100} value={injVolPct} onChange={e => setInjVolPct(+e.target.value)} style={{ flex: 1 }} />
                  <input type="range" min={6} max={25} value={injRepsCap} onChange={e => setInjRepsCap(+e.target.value)} style={{ flex: 1 }} />
                </div>
              )}
              <button onClick={() => { if (!injFrom) return; update({ injuries: [...(profile.injuries || []), { muscle: injMuscle, from: injFrom, to: injTo || undefined, exclude: injExclude ? true : undefined, weightPct: injGraded ? injWeightPct : undefined, volumePct: injGraded ? injVolPct : undefined, repsCap: injGraded ? injRepsCap : undefined }] }); setInjFrom(''); setInjTo(''); setInjGraded(false); setInjExclude(false); setInjWeightPct(80); setInjVolPct(80); setInjRepsCap(12); }} style={{ padding: '7px 12px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Добавить</button>
            </div>
            {(profile.injuries || []).length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {profile.injuries.map((inj: any, i: number) => {
                  const today = new Date().toISOString().slice(0, 10);
                  const active = (inj.from || '') <= today && (!inj.to || inj.to >= today);
                  const ru = INJ_GROUPS.find(([g]) => g === inj.muscle)?.[1] || inj.muscle;
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 8px', borderRadius: 6, background: active ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.02)', border: '1px solid ' + (active ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.04)') }}>
                      <span style={{ fontSize: 11, color: active ? '#fca5a5' : 'rgba(255,255,255,0.4)' }}>{ru} · {inj.from}–{inj.to || '…'}{active ? ' · активна' : ''}</span>
                      <button onClick={() => update({ injuries: (profile.injuries || []).filter((_: any, j: number) => j !== i) })} style={{ padding: '2px 7px', borderRadius: 4, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', fontSize: 10, cursor: 'pointer' }}>✕</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      <div style={LABEL}>Курс (PED-адаптация объёмов)</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <PopupSelect label='На курсе' value={profile.onCourse ? 'yes' : 'no'} onChange={v => update({ onCourse: v === 'yes' })} options={[['no','Нет (натурал)'],['yes','Да (на курсе)']].map(([id,l]) => ({ id, label: l }))} />
        <PopupSelect label='Интенсивность курса' value={profile.courseIntensity} onChange={v => update({ courseIntensity: v as any })} options={[['mild','Лёгкая'],['moderate','Умеренная'],['heavy','Тяжёлая']].map(([id,l]) => ({ id, label: l }))} />
      </div>
      {profile.onCourse && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>На курсе MRV повышается (~+20-30%), восстановление учитывается в готовности.</div>}

      {/* ⭐ Любимые и не любимые упражнения — карточки-кнопки с попапом */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
        <PopupExerciseList
          label="⭐ Любимые упражнения"
          ids={profile.favoriteExercises || []}
          onChange={ids => update({ favoriteExercises: ids })}
          accent="#00e68a"
        />
        <PopupExerciseList
          label="✕ Не любимые"
          ids={profile.excludedExercises || []}
          onChange={ids => update({ excludedExercises: ids })}
          accent="#ef4444"
        />
      </div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
        Любимые получают приоритет при отборе упражнений. Не любимые полностью исключаются из генерации плана.
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 13, color: 'rgba(235,235,245,0.7)', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={!!profile.avoidAxialLoad}
          onChange={e => update({ avoidAxialLoad: e.target.checked })}
          style={{ width: 18, height: 18, accentColor: ACCENT }}
        />
        🦴 Убрать осевую нагрузку (присед/становая/жим стоя)
      </label>

      <div style={{ ...LABEL, marginTop: 10 }}>📊 Фармакологическая история</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <PopupNumber label="Всего курсов" value={profile.pharmaCoursesCount} min={0} max={99} onChange={v => update({ pharmaCoursesCount: v })} />
        <PopupNumber label="С последнего курса" value={profile.monthsSinceLastCourse} min={0} max={999} suffix=" мес" onChange={v => update({ monthsSinceLastCourse: v })} />
        <PopupNumber label="Лет на фарме" value={profile.totalYearsOnPharma} min={0} max={50} suffix=" лет" onChange={v => update({ totalYearsOnPharma: v })} />
      </div>
      {compact !== true && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>Эти данные используются ПЛ, ББ, ручным конструктором и калькуляторами для расчётов.</div>}
    </div>
  );
};

export default TrainingProfileCard;