import React, { useMemo, useState, useCallback } from 'react';
import { useDataLink } from '../../../core/data-link';
import { ModernHero, modernCardBg } from './nutrition-modern-kit';
import { loadSessions } from '../../../engines/workout-logger.engine';
import { computePeriWorkoutNutrition } from '../../../engines/nutrition-periworkout.engine';

const SMALL: React.CSSProperties = { color: '#fff', fontSize: 11, lineHeight: 1.4 };
const CARD: React.CSSProperties = { background: '#18181b', borderRadius: 14, border: '1px solid rgba(0,230,138,0.18)', padding: 12, marginBottom: 10 };

const INTENSITY_META = {
  low: { icon: '🧘', label: 'Низкая', desc: 'Восстановительная · техника · кардио', color: '#60a5fa' },
  medium: { icon: '💪', label: 'Средняя', desc: 'Рабочая · обычная силовая', color: '#00e68a' },
  high: { icon: '🔥', label: 'Высокая', desc: 'Тяжёлая · длинная · отказные', color: '#f59e0b' },
} as const;

type PopupKind = null | 'intensity' | 'volume' | 'duration';

export const PeriWorkoutCard: React.FC = () => {
  const linked = useDataLink();
  const bw = linked.profile?.settings?.weight || 80;
  const goal = linked.profile?.settings?.primaryGoal || 'strength';
  const training = linked.profile?.settings?.training;
  const pharma = linked.profile?.settings?.pharma;
  const [overrideVol, setOverrideVol] = useState<number>(0);
  const [overrideDur, setOverrideDur] = useState<number>(0);
  const [popup, setPopup] = useState<PopupKind>(null);
  const [draft, setDraft] = useState('');

  const last = useMemo(() => loadSessions()[0], []);
  const inferredIntensity = (last?.avgIntensity || 0) >= 8 ? 'high' : (last?.avgIntensity || 0) > 0 && (last?.avgIntensity || 0) <= 6 ? 'low' : (training?.minutesPerSession || 60) >= 90 ? 'high' : 'medium';
  const [intensity, setIntensity] = useState<'low' | 'medium' | 'high'>(inferredIntensity);
  const sessionVolume = overrideVol || last?.totalVolume || 0;
  const durationMin = overrideDur || last?.durationMin || 0;

  const plan = useMemo(() => computePeriWorkoutNutrition({
    sessionVolume, durationMin, bodyWeight: bw, goal, intensity,
    ped: { hasInsulin: pharma?.hasInsulin, hasGH: pharma?.hasGH, hasIGF: pharma?.hasIGF, insulinIU: pharma?.insulinIU, ghIU: pharma?.ghIU },
  }), [sessionVolume, durationMin, bw, goal, intensity, pharma?.hasInsulin, pharma?.hasGH, pharma?.hasIGF, pharma?.insulinIU, pharma?.ghIU]);

  const openPopup = useCallback((kind: Exclude<PopupKind, null>) => {
    if (kind === 'volume') setDraft(String(overrideVol || last?.totalVolume || ''));
    if (kind === 'duration') setDraft(String(overrideDur || last?.durationMin || ''));
    setPopup(kind);
  }, [overrideVol, overrideDur, last?.totalVolume, last?.durationMin]);

  const closePopup = useCallback(() => setPopup(null), []);

  const saveDraft = useCallback(() => {
    const v = Math.round(Number(draft) || 0);
    if (popup === 'volume') setOverrideVol(Math.max(0, Math.min(100000, v)));
    if (popup === 'duration') setOverrideDur(Math.max(0, Math.min(300, v)));
    setPopup(null);
  }, [draft, popup]);

  const intMeta = INTENSITY_META[intensity];

  const rowBtn: React.CSSProperties = {
    width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
    borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)', background: '#202023',
    color: '#fff', cursor: 'pointer', minHeight: 56, textAlign: 'left',
  };

  return (
    <div className="nut-peri" style={{ display:'flex', flexDirection:'column', gap:10 }}>
      <ModernHero icon="🥤" title="Пери-воркаут" subtitle="Углеводы/белок/жидкость до/во время/после — на основе тоннажа, длительности и массы тела. Авто-тянет последнюю тренировку." stats={[
        { k:'Масса', v: bw+'кг', sub: goal, col:'#00e68a', bg:'rgba(0,230,138,0.08)' },
        { k:'Тоннаж', v: sessionVolume ? Math.round(sessionVolume/1000)+'т' : '—', sub:'кг·повт', col:'#60a5fa', bg:'rgba(96,165,250,0.08)' },
        { k:'Длит.', v: durationMin ? durationMin+'м' : '—', sub: intMeta.label, col:'#f59e0b', bg:'rgba(245,158,11,0.08)' },
      ]} />

      {/* Настройки сессии — один блок, значения вводятся через попапы */}
      <div style={{ ...modernCardBg, padding:12 }}>
        <div style={{ fontSize:11, fontWeight:700, color:'#fff', marginBottom:8 }}>Настройки сессии</div>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <button onClick={() => openPopup('intensity')} aria-label="Выбрать интенсивность" aria-haspopup="dialog" className="nut-peri-intbtn" style={{ ...rowBtn, borderColor: `${intMeta.color}44` }}>
            <span style={{ width:34, height:34, borderRadius:10, background:`${intMeta.color}1f`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>{intMeta.icon}</span>
            <span style={{ flex:1, minWidth:0 }}>
              <span style={{ display:'block', fontSize:8, fontWeight:700, color:'rgba(255,255,255,0.45)', letterSpacing:0.4, textTransform:'uppercase' }}>Интенсивность</span>
              <span style={{ display:'block', fontSize:13, fontWeight:800, color:intMeta.color }}>{intMeta.label} <span style={{ fontWeight:500, fontSize:10, color:'rgba(255,255,255,0.55)' }}>· {intMeta.desc}</span></span>
            </span>
            <span style={{ color:'rgba(255,255,255,0.4)', fontSize:14 }}>›</span>
          </button>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <button onClick={() => openPopup('volume')} aria-label="Ввести тоннаж" aria-haspopup="dialog" className="nut-peri-volbtn" style={rowBtn}>
              <span style={{ width:34, height:34, borderRadius:10, background:'rgba(96,165,250,0.14)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>🏋️</span>
              <span style={{ flex:1, minWidth:0 }}>
                <span style={{ display:'block', fontSize:8, fontWeight:700, color:'rgba(255,255,255,0.45)', letterSpacing:0.4, textTransform:'uppercase' }}>Тоннаж</span>
                <span style={{ display:'block', fontSize:13, fontWeight:800, color:'#fff', fontVariantNumeric:'tabular-nums' }}>{sessionVolume ? `${Math.round(sessionVolume).toLocaleString('ru-RU')} кг` : '—'}</span>
              </span>
              <span style={{ color:'rgba(255,255,255,0.4)', fontSize:14 }}>›</span>
            </button>
            <button onClick={() => openPopup('duration')} aria-label="Ввести длительность" aria-haspopup="dialog" className="nut-peri-durbtn" style={rowBtn}>
              <span style={{ width:34, height:34, borderRadius:10, background:'rgba(245,158,11,0.14)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>⏱</span>
              <span style={{ flex:1, minWidth:0 }}>
                <span style={{ display:'block', fontSize:8, fontWeight:700, color:'rgba(255,255,255,0.45)', letterSpacing:0.4, textTransform:'uppercase' }}>Длит.</span>
                <span style={{ display:'block', fontSize:13, fontWeight:800, color:'#fff', fontVariantNumeric:'tabular-nums' }}>{durationMin ? `${durationMin} мин` : '—'}</span>
              </span>
              <span style={{ color:'rgba(255,255,255,0.4)', fontSize:14 }}>›</span>
            </button>
          </div>
          <div style={{ ...SMALL, color:'rgba(255,255,255,0.45)', fontSize:10 }}>Авто: по avg RPE последней сессии и длительности; тап по строке — точный ввод.</div>
        </div>
        {last ? (
          <div style={{ marginTop:10, padding:'8px 10px', borderRadius:10, background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.12)', display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ width:26, height:26, borderRadius:8, background:'rgba(96,165,250,0.12)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12 }}>🏋️</span>
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#60a5fa' }}>{last.date} · {last.focus}</div>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.5)' }}>{Math.round(last.totalVolume)} кг·повт · {last.durationMin} мин · {last.totalSets} сетов</div>
            </div>
          </div>
        ) : (
          <div style={{ marginTop:10, padding:'10px 12px', borderRadius:10, background:'rgba(255,255,255,0.02)', border:'1px dashed rgba(255,255,255,0.06)', textAlign:'center', fontSize:10, color:'rgba(255,255,255,0.5)' }}>Нет тренировок — введи тоннаж/длительность вручную или завершить тренировку в блоке Тренировки.</div>
        )}
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
            {plan.safetyWarnings.map((warning, i) => <div key={i} style={{ ...SMALL, marginBottom: 3 }}>{warning}</div>)}
          </div>}
          <div style={{ padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Обоснование</div>
            {plan.rationale.map((t, i) => <div key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5, marginBottom: 2 }}>{t}</div>)}
          </div>
        </>
      ) : (
        <div style={{ ...SMALL, textAlign: 'center', padding: 20 }}>Введите тоннаж/длительность или завершите тренировку.</div>
      )}

      {/* ── Попапы ввода ── */}
      {popup && (
        <div
          role="dialog" aria-modal="true"
          aria-label={popup === 'intensity' ? 'Интенсивность тренировки' : popup === 'volume' ? 'Тоннаж сессии' : 'Длительность сессии'}
          className="nut-peri-popup"
          onClick={e => { if (e.target === e.currentTarget) closePopup(); }}
          onKeyDown={e => { if (e.key === 'Escape') closePopup(); }}
          style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,0.75)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
        >
          <div className="nut-peri-sheet" style={{ width:'100%', maxWidth:380, padding:20, borderRadius:20, background:'linear-gradient(135deg, #1a1c26 0%, #18181b 100%)', border:'1px solid rgba(0,230,138,0.2)', boxShadow:'0 20px 60px rgba(0,0,0,0.6)', backdropFilter:'blur(20px)' }}>
            {popup === 'intensity' && (
              <>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                  <span style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#00e68a,#00c8a0)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>📊</span>
                  <div>
                    <div style={{ fontSize:14, fontWeight:800, color:'#fff' }}>Интенсивность</div>
                    <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)' }}>Множитель углеводов до/после</div>
                  </div>
                  <button onClick={closePopup} aria-label="Закрыть" className="nut-peri-close" style={{ marginLeft:'auto', width:44, height:44, borderRadius:10, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.6)', cursor:'pointer', fontSize:14 }}>✕</button>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {(Object.keys(INTENSITY_META) as Array<keyof typeof INTENSITY_META>).map(k => {
                    const m = INTENSITY_META[k];
                    const active = intensity === k;
                    return (
                      <button key={k} onClick={() => { setIntensity(k); closePopup(); }} aria-pressed={active} aria-label={`Интенсивность: ${m.label}`} className="nut-peri-opt" style={{
                        display:'flex', alignItems:'center', gap:10, padding:'12px 14px', borderRadius:14, cursor:'pointer', minHeight:56, textAlign:'left',
                        border: active ? `1.5px solid ${m.color}` : '1px solid rgba(255,255,255,0.07)',
                        background: active ? `linear-gradient(135deg, ${m.color}22, ${m.color}0d)` : '#202023',
                        color:'#fff', boxShadow: active ? `0 4px 16px ${m.color}30` : 'none',
                      }}>
                        <span style={{ width:34, height:34, borderRadius:10, background:`${m.color}1f`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>{m.icon}</span>
                        <span style={{ flex:1 }}>
                          <span style={{ display:'block', fontSize:13, fontWeight:800, color: active ? m.color : '#fff' }}>{m.label}</span>
                          <span style={{ display:'block', fontSize:10, color:'rgba(255,255,255,0.55)' }}>{m.desc}</span>
                        </span>
                        <span style={{ width:20, height:20, borderRadius:999, border:`1.5px solid ${active ? m.color : 'rgba(255,255,255,0.2)'}`, background: active ? m.color : 'transparent', color:'#000', fontSize:12, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center' }}>{active ? '✓' : ''}</span>
                      </button>
                    );
                  })}
                </div>
                <button onClick={closePopup} className="nut-peri-done" style={{ width:'100%', marginTop:14, padding:'11px', borderRadius:12, border:'none', background:'linear-gradient(135deg,#00e68a,#00c8a0)', color:'#000', fontWeight:700, cursor:'pointer', minHeight:48 }}>Готово</button>
              </>
            )}
            {(popup === 'volume' || popup === 'duration') && (
              <>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                  <span style={{ width:36, height:36, borderRadius:10, background: popup === 'volume' ? 'linear-gradient(135deg,#60a5fa,#3b82f6)' : 'linear-gradient(135deg,#f59e0b,#f97316)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>{popup === 'volume' ? '🏋️' : '⏱'}</span>
                  <div>
                    <div style={{ fontSize:14, fontWeight:800, color:'#fff' }}>{popup === 'volume' ? 'Тоннаж сессии' : 'Длительность'}</div>
                    <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)' }}>{popup === 'volume' ? 'кг·повт · влияет на углеводы' : 'минут · влияет на интра-окно'}</div>
                  </div>
                  <button onClick={closePopup} aria-label="Закрыть" className="nut-peri-close" style={{ marginLeft:'auto', width:44, height:44, borderRadius:10, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.6)', cursor:'pointer', fontSize:14 }}>✕</button>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                  <button onClick={() => setDraft(String(Math.max(0, (Number(draft) || 0) - (popup === 'volume' ? 1000 : 5))))} aria-label="Уменьшить значение" style={{ width:48, height:48, borderRadius:12, border:'1px solid rgba(255,255,255,0.08)', background:'#202023', color:'#fff', cursor:'pointer', fontSize:20, fontWeight:600 }}>−</button>
                  <div style={{ flex:1, textAlign:'center' }}>
                    <input autoFocus type="number" value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveDraft(); }} aria-label={popup === 'volume' ? 'Тоннаж, кг' : 'Длительность, минут'} placeholder={popup === 'volume' ? String(last?.totalVolume || 8000) : String(last?.durationMin || 60)} className="nut-peri-input" style={{ width:'100%', padding:'10px', borderRadius:12, background:'#202023', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:22, fontWeight:800, textAlign:'center', outline:'none', fontVariantNumeric:'tabular-nums' }} />
                    <div style={{ fontSize:9, color:'rgba(255,255,255,0.4)', marginTop:4 }}>{popup === 'volume' ? 'килограмм·повторений' : 'минут'}</div>
                  </div>
                  <button onClick={() => setDraft(String((Number(draft) || 0) + (popup === 'volume' ? 1000 : 5)))} aria-label="Увеличить значение" style={{ width:48, height:48, borderRadius:12, border:'1px solid rgba(255,255,255,0.08)', background:'#202023', color:'#fff', cursor:'pointer', fontSize:20, fontWeight:600 }}>+</button>
                </div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:6 }}>
                  {(popup === 'volume' ? [3000, 8000, 12000, 20000] : [45, 60, 75, 90, 120]).map(v => (
                    <button key={v} onClick={() => setDraft(String(v))} aria-label={`${v}`} aria-pressed={Number(draft) === v} className="nut-peri-chip" style={{ padding:'8px 14px', borderRadius:999, border:'1px solid rgba(255,255,255,0.08)', background: Number(draft) === v ? 'rgba(0,230,138,0.12)' : '#202023', color: Number(draft) === v ? '#00e68a' : 'rgba(255,255,255,0.75)', cursor:'pointer', fontSize:12, fontWeight:700, minHeight:44, fontVariantNumeric:'tabular-nums' }}>
                      {popup === 'volume' ? `${(v / 1000).toLocaleString('ru-RU')}т` : `${v} мин`}
                    </button>
                  ))}
                </div>
                <div style={{ display:'flex', gap:8, marginTop:12 }}>
                  <button onClick={closePopup} className="nut-peri-cancel" style={{ flex:1, padding:'11px', borderRadius:12, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.7)', fontWeight:600, cursor:'pointer', minHeight:48 }}>Отмена</button>
                  <button onClick={saveDraft} className="nut-peri-save" style={{ flex:1, padding:'11px', borderRadius:12, border:'none', background:'linear-gradient(135deg,#00e68a,#00c8a0)', color:'#000', fontWeight:700, cursor:'pointer', minHeight:48, boxShadow:'0 4px 16px rgba(0,230,138,0.25)' }}>✓ Сохранить</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(PeriWorkoutCard);
