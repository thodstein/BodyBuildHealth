import React, { useMemo, useState } from 'react';
import { useDataLink } from '../../../core/data-link';
import { ModernHero, modernCardBg } from './nutrition-modern-kit';
import { loadSessions } from '../../../engines/workout-logger.engine';
import { computePeriWorkoutNutrition } from '../../../engines/nutrition-periworkout.engine';

const ACCENT = '#00e68a';
const SMALL: React.CSSProperties = { color: 'rgba(255,255,255,0.6)', fontSize: 11, lineHeight: 1.4 };
const CARD: React.CSSProperties = { background: '#18181b', borderRadius: 14, border: '1px solid rgba(0,230,138,0.18)', padding: 12, marginBottom: 10 };

export const PeriWorkoutCard: React.FC = () => {
  const linked = useDataLink();
  const bw = linked.profile?.settings?.weight || 80;
  const goal = linked.profile?.settings?.primaryGoal || 'strength';
  const training = linked.profile?.settings?.training;
  const pharma = linked.profile?.settings?.pharma;
  const [overrideVol, setOverrideVol] = useState<number>(0);
  const [overrideDur, setOverrideDur] = useState<number>(0);

  const last = useMemo(() => loadSessions()[0], []);
  const inferredIntensity = (last?.avgIntensity || 0) >= 8 ? 'high' : (last?.avgIntensity || 0) > 0 && (last?.avgIntensity || 0) <= 6 ? 'low' : (training?.minutesPerSession || 60) >= 90 ? 'high' : 'medium';
  const [intensity, setIntensity] = useState<'low' | 'medium' | 'high'>(inferredIntensity);
  const sessionVolume = overrideVol || last?.totalVolume || 0;
  const durationMin = overrideDur || last?.durationMin || 0;

  const plan = useMemo(() => computePeriWorkoutNutrition({
    sessionVolume, durationMin, bodyWeight: bw, goal, intensity,
    ped: { hasInsulin: pharma?.hasInsulin, hasGH: pharma?.hasGH, hasIGF: pharma?.hasIGF, insulinIU: pharma?.insulinIU, ghIU: pharma?.ghIU },
  }), [sessionVolume, durationMin, bw, goal, intensity, pharma?.hasInsulin, pharma?.hasGH, pharma?.hasIGF, pharma?.insulinIU, pharma?.ghIU]);

  const hasData = sessionVolume > 0 || durationMin > 0;
  return (
    <div className="nut-peri" style={{ display:'flex', flexDirection:'column', gap:10 }}>
      <ModernHero icon="🥤" title="Пери-воркаут" subtitle="Углеводы/белок/жидкость до/во время/после — на основе тоннажа, длительности и массы тела. Авто-тянет последнюю тренировку." stats={[
        { k:'Масса', v: bw+'кг', sub: goal, col:'#00e68a', bg:'rgba(0,230,138,0.08)' },
        { k:'Тоннаж', v: sessionVolume ? Math.round(sessionVolume/1000)+'т' : '—', sub:'кг·повт', col:'#60a5fa', bg:'rgba(96,165,250,0.08)' },
        { k:'Длит.', v: durationMin ? durationMin+'м' : '—', sub: intensity, col:'#f59e0b', bg:'rgba(245,158,11,0.08)' },
      ]} />
      <div style={{ ...modernCardBg, padding:12 }}>
        <div style={{ fontSize:11, fontWeight:700, color:'#fff', marginBottom:6 }}>Настройки сессии</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
          <div>
            <div style={{ fontSize:8, fontWeight:700, color:'rgba(255,255,255,0.45)', letterSpacing:0.4, textTransform:'uppercase', marginBottom:4 }}>Интенсивность</div>
            <select value={intensity} onChange={e => setIntensity(e.target.value as 'low' | 'medium' | 'high')} style={{ width:'100%', background:'#202023', color:'#fff', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'8px 10px', fontSize:12, outline:'none' }}>
              <option value="low">Низкая · восстановительная</option>
              <option value="medium">Средняя · рабочая</option>
              <option value="high">Высокая · тяжёлая</option>
            </select>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
            <div>
              <div style={{ fontSize:8, fontWeight:700, color:'rgba(255,255,255,0.45)', letterSpacing:0.4, textTransform:'uppercase', marginBottom:4 }}>Тоннаж</div>
              <input type="number" value={overrideVol || ''} placeholder={String(last?.totalVolume || 0)} onChange={e => setOverrideVol(+e.target.value)} style={{ width:'100%', background:'#202023', color:'#fff', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'8px 10px', fontSize:12, outline:'none' }} />
            </div>
            <div>
              <div style={{ fontSize:8, fontWeight:700, color:'rgba(255,255,255,0.45)', letterSpacing:0.4, textTransform:'uppercase', marginBottom:4 }}>Длит.</div>
              <input type="number" value={overrideDur || ''} placeholder={String(last?.durationMin || 0)} onChange={e => setOverrideDur(+e.target.value)} style={{ width:'100%', background:'#202023', color:'#fff', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'8px 10px', fontSize:12, outline:'none' }} />
            </div>
          </div>
        </div>
        {last ? (
          <div style={{ padding:'8px 10px', borderRadius:10, background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.12)', display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ width:26, height:26, borderRadius:8, background:'rgba(96,165,250,0.12)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12 }}>🏋️</span>
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#60a5fa' }}>{last.date} · {last.focus}</div>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.5)' }}>{Math.round(last.totalVolume)} кг·повт · {last.durationMin} мин · {last.totalSets} сетов</div>
            </div>
          </div>
        ) : (
          <div style={{ padding:'10px 12px', borderRadius:10, background:'rgba(255,255,255,0.02)', border:'1px dashed rgba(255,255,255,0.06)', textAlign:'center', fontSize:10, color:'rgba(255,255,255,0.5)' }}>Нет тренировок — введи тоннаж/длительность вручную или завершить тренировку в блоке Тренировки.</div>
        )}
      </div>

      <div style={{ ...CARD, borderColor: 'rgba(245,158,11,0.25)' }}>
        <label style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700 }}>📊 Интенсивность тренировки</label>
        <select value={intensity} onChange={e => setIntensity(e.target.value as 'low' | 'medium' | 'high')} style={{ width: '100%', marginTop: 6, background: '#202023', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 8, fontSize: 12 }}>
          <option value="low">Низкая · восстановительная</option>
          <option value="medium">Средняя · рабочая</option>
          <option value="high">Высокая · тяжёлая/длинная</option>
        </select>
        <div style={{ ...SMALL, marginTop: 5 }}>Авто: по avg RPE последней сессии и длительности; можно уточнить вручную.</div>
      </div>

      {last ? (
        <div style={{ ...CARD, borderColor: 'rgba(59,130,246,0.25)' }}>
          <div style={{ fontSize: 11, color: '#60a5fa', fontWeight: 700 }}>Последняя тренировка: {last.date} · {last.focus}</div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>Тоннаж {Math.round(last.totalVolume)} кг·повт · {last.durationMin} мин · {last.totalSets} сетов</div>
        </div>
      ) : (
        <div style={{ ...CARD, borderColor: 'rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Нет завершённых тренировок — введите объём и длительность вручную ниже или завершите тренировку во вкладке «Тренировки».</div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <div>
          <label style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>Тоннаж, кг·повт</label>
          <input type="number" value={overrideVol || ''} placeholder={String(last?.totalVolume || 0)} onChange={e => setOverrideVol(+e.target.value)} style={{ width: '100%', background: '#202023', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 8, fontSize: 12 }} />
        </div>
        <div>
          <label style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>Длительность, мин</label>
          <input type="number" value={overrideDur || ''} placeholder={String(last?.durationMin || 0)} onChange={e => setOverrideDur(+e.target.value)} style={{ width: '100%', background: '#202023', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 8, fontSize: 12 }} />
        </div>
      </div>

      {sessionVolume > 0 || durationMin > 0 ? (
        <>
          <div style={{ ...modernCardBg, padding:12, border:'1px solid rgba(245,158,11,0.14)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}><span style={{ width:28, height:28, borderRadius:8, background:'rgba(245,158,11,0.12)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>⏰</span><div style={{ fontSize:12, fontWeight:700, color:'#f59e0b' }}>До тренировки</div><span style={{ marginLeft:'auto', fontSize:9, padding:'3px 7px', borderRadius:999, background:'rgba(245,158,11,0.10)', color:'#f59e0b', border:'1px solid rgba(245,158,11,0.18)' }}>{plan.pre.timing}</span></div>
            <div style={{ fontSize:18, fontWeight:800, color:'#f59e0b' }}>{plan.pre.carbsG}г <span style={{ fontSize:10, fontWeight:500, color:'rgba(255,255,255,0.5)' }}>углеводов</span></div>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.65)', marginTop:6, lineHeight:1.4 }}>{plan.pre.note}</div>
          </div>
          <div style={{ ...modernCardBg, padding:12, border:'1px solid rgba(96,165,250,0.14)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}><span style={{ width:28, height:28, borderRadius:8, background:'rgba(96,165,250,0.12)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>💧</span><div style={{ fontSize:12, fontWeight:700, color:'#60a5fa' }}>Во время</div></div>
            <div style={{ fontSize:18, fontWeight:800, color:'#60a5fa' }}>{plan.intra.carbsGPerH > 0 ? `${plan.intra.carbsGPerH}г/ч` : 'без углеводов'} <span style={{ fontSize:10, fontWeight:500, color:'rgba(255,255,255,0.5)' }}>· {plan.intra.fluidMlPerH} мл/ч</span></div>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.65)', marginTop:6, lineHeight:1.4 }}>{plan.intra.note}</div>
          </div>
          <div style={{ ...modernCardBg, padding:12, border:'1px solid rgba(0,230,138,0.14)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}><span style={{ width:28, height:28, borderRadius:8, background:'rgba(0,230,138,0.12)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>🔄</span><div style={{ fontSize:12, fontWeight:700, color:'#00e68a' }}>После</div><span style={{ marginLeft:'auto', fontSize:9, padding:'3px 7px', borderRadius:999, background:'rgba(0,230,138,0.10)', color:'#00e68a', border:'1px solid rgba(0,230,138,0.18)' }}>{plan.post.timing}</span></div>
            <div style={{ fontSize:18, fontWeight:800, color:'#00e68a' }}>{plan.post.carbsG}г <span style={{ fontSize:10, fontWeight:500, color:'rgba(255,255,255,0.5)' }}>углей +</span> {plan.post.proteinG}г <span style={{ fontSize:10, fontWeight:500, color:'rgba(255,255,255,0.5)' }}>белка</span></div>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.65)', marginTop:6, lineHeight:1.4 }}>{plan.post.note}</div>
          </div>
          <div style={{ ...CARD, borderColor: 'rgba(96,165,250,0.2)' }}>
            <div style={{ fontSize: 11, color: '#60a5fa', fontWeight: 700 }}>💧 Жидкость за сессию: ~{plan.fluidTotalMl} мл</div>
          </div>
          {plan.safetyWarnings.length > 0 && <div style={{ ...CARD, borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)' }}>
            <div style={{ fontSize: 11, color: '#f87171', fontWeight: 700, marginBottom: 4 }}>⚠️ PED-контекст</div>
            {plan.safetyWarnings.map((warning, i) => <div key={i} style={{ ...SMALL, color: 'rgba(255,255,255,0.8)', marginBottom: 3 }}>{warning}</div>)}
          </div>}
          <div style={{ padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 4 }}>Обоснование</div>
            {plan.rationale.map((t, i) => <div key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5, marginBottom: 2 }}>{t}</div>)}
          </div>
        </>
      ) : (
        <div style={{ ...SMALL, textAlign: 'center', padding: 20 }}>Введите тоннаж/длительность или завершите тренировку.</div>
      )}
    </div>
  );
};

export default React.memo(PeriWorkoutCard);
