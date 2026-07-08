/** BbToolsCard.tsx — ББ-инструменты (ранее неиспользуемые движки bb/*).
 * REUSE: bb-tempo-rest (tempoFor/tutForSet/TEMPO/REST_BY_CHARACTER),
 * bb-intensity-techniques (techniquesFor/INTENSITY_TECHNIQUES),
 * bb-weakpoint (planWeakPoints), bb-demographics (splitForDays/femaleAdjust/mastersAdjust/adjustVolumeForDemographic). */
import React, { useState, useMemo } from 'react';
import { tempoFor, tutForSet, TEMPO_BY_CHARACTER, REST_BY_CHARACTER, type DayCharacter } from '../../../engines/bb/bb-tempo-rest';
import { techniquesFor, type TechniqueSpec } from '../../../engines/bb/bb-intensity-techniques';
import { planWeakPoints } from '../../../engines/bb/bb-weakpoint';
import { splitForDays, femaleAdjust, mastersAdjust, adjustVolumeForDemographic } from '../../../engines/bb/bb-demographics';
import { loadTrainingProfile, saveTrainingProfile } from './training-profile';
import { applyToPlanner } from './planner-bridge';

const ACCENT = '#00e68a';
const DIM = 'rgba(255,255,255,0.5)';
const CARD: React.CSSProperties = { padding: 14, borderRadius: 12, background: 'rgba(24,24,27,0.4)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 12 };
const H: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: ACCENT, margin: '0 0 8px' };
const LABEL: React.CSSProperties = { fontSize: 10, color: DIM, margin: '6px 0 3px', fontWeight: 700 };
const SEL: React.CSSProperties = { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box' as const };

const CHAR_LABEL: Record<DayCharacter, string> = { 'тяж': 'Тяжёлый', 'памп': 'Памповый', 'лёг': 'Лёгкий' };
const MUSCLE_RU: Record<string, string> = { chest: 'Грудь', back: 'Спина', quads: 'Квадрицепсы', hamstrings: 'Бицепс бедра', shoulders: 'Плечи', biceps: 'Бицепс', triceps: 'Трицепс', glutes: 'Ягодицы', calves: 'Икры', abs: 'Пресс' };
const ALL_MUSCLES = Object.keys(MUSCLE_RU);

export const BbToolsCard: React.FC = () => {
  const prof = useMemo(() => loadTrainingProfile(), []);
  const [character, setCharacter] = useState<DayCharacter>('тяж');
  const [reps, setReps] = useState(8);
  const [level, setLevel] = useState<string>(prof.level || 'intermediate');
  const [weak, setWeak] = useState<string[]>(prof.weakPoints || []);
  const [specialization, setSpecialization] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveWeak = () => { saveTrainingProfile({ ...loadTrainingProfile(), weakPoints: weak }); applyToPlanner({ kind: 'weakpoints', label: 'Слабые группы (ББ): ' + (weak.join(', ') || 'нет'), data: { groups: weak } }); setSaved(true); setTimeout(() => setSaved(false), 2500); };
  const [demo, setDemo] = useState<'none' | 'female' | 'masters'>('none');
  const [age, setAge] = useState(45);

  const tempo = useMemo(() => tempoFor(character), [character]);
  const rest = REST_BY_CHARACTER[character];
  const tut = useMemo(() => tutForSet(reps, character), [reps, character]);
  const techs = useMemo(() => techniquesFor(character === 'лёг' ? 'both' : character, level), [character, level]);
  const wp = useMemo(() => planWeakPoints(weak, ALL_MUSCLES, level, specialization), [weak, level, specialization]);
  const demoAdj = useMemo(() => demo === 'female' ? femaleAdjust() : demo === 'masters' ? mastersAdjust(age) : null, [demo, age]);
  const demoMuscle = 'chest';
  const demoVol = useMemo(() => demoAdj ? adjustVolumeForDemographic(demoMuscle, level, demoAdj) : null, [demoAdj, level]);

  const toggleWeak = (m: string) => setWeak(p => p.includes(m) ? p.filter(x => x !== m) : [...p, m]);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={H}>💪 ББ-инструменты (гипертрофия)</div>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 10 }}>
        Темп/отдых/TUT по характеру дня, техники интенсификации, планировщик слабых точек и демография (женщины/мастера). Ранее эти движки bb/* не использовались в UI.
      </div>

      <div style={CARD}>
        <div style={H}>⏱️ Темп и отдых по характеру дня</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <div><div style={LABEL}>Характер дня</div>
            <select style={SEL} value={character} onChange={e => setCharacter(e.target.value as DayCharacter)}>
              {(Object.keys(CHAR_LABEL) as DayCharacter[]).map(c => <option key={c} value={c}>{CHAR_LABEL[c]}</option>)}
            </select>
          </div>
          <div><div style={LABEL}>Повторений в сете</div><input type="number" min={1} max={30} style={{ ...SEL }} value={reps} onChange={e => setReps(parseInt(e.target.value) || 0)} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
          <div style={{ background: 'rgba(0,230,138,0.05)', borderRadius: 8, padding: '8px 10px' }}><div style={{ fontSize: 9, color: DIM }}>Темп</div><div style={{ fontSize: 14, fontWeight: 700 }}>{tempo.notation}</div></div>
          <div style={{ background: 'rgba(0,230,138,0.05)', borderRadius: 8, padding: '8px 10px' }}><div style={{ fontSize: 9, color: DIM }}>TUT/повт</div><div style={{ fontSize: 14, fontWeight: 700 }}>{tempo.tutPerRep}с</div></div>
          <div style={{ background: 'rgba(0,230,138,0.05)', borderRadius: 8, padding: '8px 10px' }}><div style={{ fontSize: 9, color: DIM }}>TUT сета</div><div style={{ fontSize: 14, fontWeight: 700 }}>{tut}с</div></div>
          <div style={{ background: 'rgba(0,230,138,0.05)', borderRadius: 8, padding: '8px 10px' }}><div style={{ fontSize: 9, color: DIM }}>Отдых</div><div style={{ fontSize: 14, fontWeight: 700 }}>{rest}с</div></div>
        </div>
        <div style={{ fontSize: 10, color: DIM, marginTop: 6 }}>Эксцентрик {tempo.eccentric}с · пауза {tempo.pause}с · концентрика {tempo.concentric}с.</div>
        <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginBottom: 8 }}>🔗 Применить темп «{tempo.notation}» ({character}) к планировщику — все упражнения получат этот темп.</div>
          <button onClick={() => applyToPlanner({ kind: 'tempo', label: 'Темп ' + tempo.notation + ' (' + CHAR_LABEL[character] + ')', data: { eccentric: tempo.eccentric, bottomPause: tempo.pause, concentric: tempo.concentric, topPause: 0, label: tempo.notation } })} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 13, minHeight: 44 }}>🛠 Применить темп к планировщику</button>
        </div>
      </div>

      <div style={CARD}>
        <div style={H}>🔥 Техники интенсификации ({techs.length})</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={LABEL as React.CSSProperties}>Уровень</div>
          <select style={{ ...SEL, width: 160 }} value={level} onChange={e => setLevel(e.target.value)}>
            {['beginner', 'intermediate', 'advanced', 'enhanced'].map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        {techs.length === 0
          ? <div style={{ fontSize: 10, color: DIM }}>Для этого характера/уровня техник нет.</div>
          : techs.map((t: TechniqueSpec) => (
            <div key={t.technique} style={{ padding: '6px 8px', marginBottom: 4, borderRadius: 6, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(0,230,138,0.1)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT }}>{t.name} <span style={{ fontSize: 9, color: DIM }}>({t.appliesTo})</span></div>
              <div style={{ fontSize: 10, color: DIM }}>{t.description}</div>
            </div>
          ))}
        <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginBottom: 8 }}>🔗 Применить техники интенсификации ({techs.length} шт) к планировщику как рекомендацию — планер учтёт их при подборе методов.</div>
          <button onClick={() => applyToPlanner({ kind: 'volume', label: 'Техники ({level}): ' + techs.map((t: TechniqueSpec) => t.name).join(', '), data: { sets: {}, techniques: techs.map((t: TechniqueSpec) => t.technique) } })} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 13, minHeight: 44 }}>🛠 Применить техники к планировщику</button>
        </div>
      </div>

      <div style={CARD}>
        <div style={H}>🎯 Слабые точки / специализация</div>
        <div style={{ fontSize: 10, color: DIM, marginBottom: 6 }}>Отметьте отстающие группы — планер распределит объём (слабые на MAV+10%, остальные на MEV при специализации).</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
          {ALL_MUSCLES.map(m => {
            const on = weak.includes(m);
            return <button key={m} onClick={() => toggleWeak(m)} style={{ padding: '6px 10px', borderRadius: 14, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: on ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.08)', background: on ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.02)', color: on ? '#00e68a' : DIM }}>{MUSCLE_RU[m]}</button>;
          })}
        </div>
        <label style={{ fontSize: 10, color: DIM, display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
          <input type="checkbox" checked={specialization} onChange={e => setSpecialization(e.target.checked)} /> Блок специализации (топ-2 слабые на MAV+10%, остальное MEV)
        </label>
        {weak.length > 0 && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: ACCENT, marginBottom: 4 }}>План объёма:</div>
            {Object.entries(wp.volumeMap).map(([m, v]) => (
              <div key={m} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, padding: '3px 0', fontSize: 10, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ color: '#fff' }}>{MUSCLE_RU[m] || m}</span>
                <span style={{ color: DIM }}>{v.source}</span>
                <span style={{ color: ACCENT, fontWeight: 700 }}>{v.sets} сет/нед</span>
              </div>
            ))}
            <div style={{ fontSize: 9, color: DIM, marginTop: 4 }}>{wp.rationale.slice(0, 2).join(' · ')}</div>
          </div>
        )}
      </div>

      <div style={CARD}>
        <div style={H}>👤 Демография</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={LABEL as React.CSSProperties}>Группа</div>
          <select style={{ ...SEL, width: 160 }} value={demo} onChange={e => setDemo(e.target.value as any)}>
            <option value="none">Базовая (мужчины до 40)</option>
            <option value="female">Женщины</option>
            <option value="masters">Мастера (40+)</option>
          </select>
          {demo === 'masters' && <input type="number" min={40} max={80} style={{ ...SEL, width: 80 }} value={age} onChange={e => setAge(parseInt(e.target.value) || 0)} aria-label="возраст" />}
        </div>
        <div style={{ fontSize: 10, color: DIM, marginBottom: 6 }}>Сплит по дням: <b style={{ color: ACCENT }}>{splitForDays(prof.daysPerWeek || 4)}</b></div>
        {demoAdj && demoVol && (
          <div style={{ background: 'rgba(0,230,138,0.05)', borderRadius: 8, padding: '8px 10px', fontSize: 10 }}>
            <div style={{ color: DIM, marginBottom: 2 }}>Корректировка для груди ({level}):</div>
            <div style={{ color: '#fff' }}>MEV {demoVol.mev} · MAV {demoVol.mav} · MRV {demoVol.mrv} сет/нед</div>
            {demoAdj.notes && demoAdj.notes.map((n, i) => <div key={i} style={{ color: DIM, marginTop: 2 }}>• {n}</div>)}
          </div>
        )}
        <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginBottom: 8 }}>🔗 Применить демографическую корректировку к планировщику: MRV груди → {demoVol?.mrv ?? 20} сет/нед (для {demo === 'female' ? 'женщин' : demo === 'masters' ? 'мастеров ' + age + '+' : 'базовой группы'}).</div>
          <button onClick={() => applyToPlanner({ kind: 'mrv', label: 'Демография: MRV ' + (demoVol?.mrv ?? 20) + ' сет/нед (' + (demo === 'female' ? 'женщины' : demo === 'masters' ? 'мастера ' + age + '+' : 'базовая') + ')', data: { mrv: demoVol?.mrv ?? 20 } })} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 13, minHeight: 44 }}>🛠 Применить демографию к планировщику</button>
        </div>
      </div>

      <div style={{ marginTop: 6, padding: 12, borderRadius: 12, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)' }}>
        <div style={{ fontSize: 10, color: DIM, marginBottom: 8 }}>🔗 Слабые группы из этого расчёта используются ББ-планировщиком и ручным конструктором. Сохраните — планеры дадут им приоритет (+MAV, ↓RIR).</div>
        <button onClick={saveWeak} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 13, minHeight: 44 }}>{saved ? '✓ Слабые группы сохранены' : '💾 Сохранить слабые группы в профиль'}</button>
      </div>
    </div>
  );
};
