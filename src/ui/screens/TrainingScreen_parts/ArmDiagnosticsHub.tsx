/** ArmDiagnosticsHub.tsx — ХАБ диагностики армрестлинга/армлифтинга (PRO, уровень движения).
 *  Аналог DiagnosticsHub (9 лифтов) но для арм-специфики: 8 движений (cup/rising/pron/sup/ulnar/side/back/grip).
 *  - Углы РУ/РА/РН, tendon-нагрузка, humerus-risk, баланс pron/sup, table ratio
 *  - Хват-тесты (Rolling Thunder/Axle/Pinch) + техника-провалы + дневник (если есть)
 *  - Вывод в конструктор Арм через planner-bridge (weakpoints → ArmAutoConstructor)
 *  Встраивается в Интеллект тренировки (calculators zone) как arm_diagnostics_hub.
 */
import React, { useMemo, useState, useEffect } from 'react';
import { diagnoseArmWeakPoint } from '../../../engines/arm/arm-weakpoint.engine';
import { getArmLandmarks } from '../../../engines/arm/arm-volume-landmarks.engine';
import { checkHumerusGuard, checkWristBalance } from '../../../engines/arm/arm-injury-guard.engine';
import { tableWeekKind, tableWeekParams } from '../../../engines/arm/arm-table.engine';
import { buildArmTaperCurve } from '../../../engines/arm/arm-taper.engine';
import { GRIP_IMPLEMENTS } from '../../../engines/arm/arm-grip.engine';
import { ARM_MUSCLE_RU } from '../../../engines/arm/arm-types';
import { applyToPlanner } from './planner-bridge';
import { CARD, DIM, ACCENT } from './training-ui';

const STORAGE_KEY = 'he_arm_diagnostics_hub_v1';

type ArmDiagState = {
  rtKg: string;
  axleKg: string;
  pinchSec: string;
  cup: boolean;
  rising: boolean;
  pron: boolean;
  sup: boolean;
  side: boolean;
  back: boolean;
  technique: string;
  level: string;
};

const DEFAULT_STATE: ArmDiagState = {
  rtKg: '', axleKg: '', pinchSec: '',
  cup: false, rising: false, pron: false, sup: false, side: false, back: false,
  technique: 'balanced', level: 'intermediate',
};

const LEVEL_OPTS = [
  { id: 'beginner', label: 'Новичок' },
  { id: 'intermediate', label: 'Средний' },
  { id: 'advanced', label: 'Продвинутый' },
  { id: 'enhanced', label: 'Enhanced' },
];

export const ArmDiagnosticsHub: React.FC = () => {
  const [state, setState] = useState<ArmDiagState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...DEFAULT_STATE, ...JSON.parse(raw) };
    } catch {}
    return DEFAULT_STATE;
  });
  const [toast, setToast] = useState<string>('');

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }, [state]);

  const diag = useMemo(() => diagnoseArmWeakPoint({
    weakTest: {
      cupFails: state.cup,
      risingFails: state.rising,
      pronationFails: state.pron,
      supinationFails: state.sup,
      sidePressureFails: state.side,
      backPressureFails: state.back,
      gripSupportMaxKg: state.rtKg ? parseFloat(state.rtKg) : undefined,
      gripAxleMaxKg: state.axleKg ? parseFloat(state.axleKg) : undefined,
      pinchHoldSec: state.pinchSec ? parseFloat(state.pinchSec) : undefined,
    },
    technique: state.technique,
  }), [state]);

  // Humerus / balance симуляция для примера (4-нед план)
  const mockGuard = useMemo(() => {
    const mockPlan: any = {
      weeks: [
        { week: 1, sessions: [{ exercises: [{ muscle: 'side_pressure', sets: state.side ? 6 : 3 }] }] },
        { week: 2, sessions: [{ exercises: [{ muscle: 'side_pressure', sets: state.side ? 7 : 3 }] }] },
      ],
    };
    return {
      humerus: checkHumerusGuard(mockPlan),
      balance: checkWristBalance({ weeks: [{ sessions: [{ exercises: [{ muscle: 'pronators', sets: state.pron ? 6 : 4 }, { muscle: 'supinators', sets: state.sup ? 2 : 4 }] }] }] } as any),
    };
  }, [state.side, state.pron, state.sup]);

  const landmarks = useMemo(() => {
    const lvl = state.level as any;
    return {
      wrist: getArmLandmarks(lvl, 'wrist_flexors'),
      pron: getArmLandmarks(lvl, 'pronators'),
      side: getArmLandmarks(lvl, 'side_pressure'),
      grip: getArmLandmarks(lvl, 'grip_support'),
    };
  }, [state.level]);

  const applyToConstructor = () => {
    const groups = diag.weakMuscles.slice(0, 2);
    if (groups.length === 0) {
      setToast('Слабые зоны не выявлены — нечего применять');
      setTimeout(() => setToast(''), 2500);
      return;
    }
    applyToPlanner({
      kind: 'weakpoints',
      label: `Арм диагностика: ${groups.join(', ')}`,
      data: { groups, armTechnique: state.technique, armDiag: state } as any,
      source: 'intellectual',
    });
    setToast(`✓ Применено в Арм-конструктор: ${groups.map(g=>ARM_MUSCLE_RU[g]||g).join(', ')}`);
    setTimeout(() => setToast(''), 3000);
    // Навигация к планировщику
    try {
      window.dispatchEvent(new CustomEvent('planning-track-open', { detail: 'arm' } as any));
      localStorage.setItem('he_training_planning_track', 'arm');
    } catch {}
  };

  const toggle = (k: keyof ArmDiagState) => setState(s => ({ ...s, [k]: !s[k] as any }));

  // Table periodization preview
  const tablePreview = Array.from({ length: 6 }, (_, i) => {
    const wk = i + 1;
    const kind = tableWeekKind(wk, 12);
    const p = tableWeekParams(kind);
    return { wk, kind, p };
  });

  return (
    <div style={{ padding: '10px 8px 18px', color: '#fff', maxWidth: 820, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ ...CARD, padding: '14px 14px 12px', background: 'linear-gradient(135deg,rgba(245,158,11,0.12),rgba(239,68,68,0.08))', border: '1px solid rgba(245,158,11,0.22)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -18, right: -18, width: 110, height: 110, borderRadius: 110, background: 'radial-gradient(circle,rgba(245,158,11,0.14),transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', color: '#fff', fontWeight: 900, fontSize: 16 }}>🤝</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#fff', lineHeight: 1 }}>Арм-диагностика — хаб движения</div>
            <div style={{ fontSize: 10, color: '#fff', lineHeight: 1.3, opacity: 0.9 }}>8 движений (cup/rising/pron/sup/ulnar/side/back/grip) × РУ/РА/РН × tendon × humerus. Уровень как в диагностике движения — с углами и коррекциями.</div>
          </div>
          <span style={{ fontSize: 9, padding: '4px 8px', borderRadius: 20, background: 'rgba(245,158,11,0.14)', border: '1px solid rgba(245,158,11,0.24)', color: '#f59e0b', fontWeight: 800, whiteSpace: 'nowrap' }}>8 движений</span>
        </div>
        <div style={{ fontSize: 10, color: '#fff', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '8px 10px', lineHeight: 1.45 }}>
          Выбери провалы + введи хват-максимумы → получи слабые мышцы, MEV/MRV, humerus-risk и точечные упражнения. Кнопка <b style={{ color: '#f59e0b' }}>«Применить в Арм-конструктор»</b> отправит слабые зоны в планировщик (via <code>planner-bridge</code>).
        </div>
        {toast && <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.2)', color: '#22c55e', fontSize: 11 }}>{toast}</div>}
      </div>

      {/* Controls */}
      <div style={{ ...CARD, padding: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <label style={{ fontSize: 11, color: DIM }}>Уровень<br/>
            <select value={state.level} onChange={e=>setState(s=>({...s, level:e.target.value}))} style={{ marginTop: 4, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '6px 8px', fontSize: 12 }}>
              {LEVEL_OPTS.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 11, color: DIM }}>Техника<br/>
            <select value={state.technique} onChange={e=>setState(s=>({...s, technique:e.target.value}))} style={{ marginTop: 4, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '6px 8px', fontSize: 12 }}>
              <option value="balanced">Сбалансировано</option><option value="hook">Хук</option><option value="toproll">Топролл</option><option value="press">Пресс</option>
            </select>
          </label>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'flex-end' }}>
            <button onClick={applyToConstructor} style={{ padding: '8px 14px', borderRadius: 8, background: 'linear-gradient(135deg,#f59e0b,#ef4444)', color: '#fff', border: 'none', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>→ Применить в Арм-конструктор</button>
          </div>
        </div>

        {/* Grip inputs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: DIM }}>Rolling Thunder кг<br/><input value={state.rtKg} onChange={e=>setState(s=>({...s, rtKg:e.target.value}))} placeholder="60" style={{ width: '100%', marginTop: 4, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '6px 8px', fontSize: 12 }} /></label>
          <label style={{ fontSize: 11, color: DIM }}>Axle кг<br/><input value={state.axleKg} onChange={e=>setState(s=>({...s, axleKg:e.target.value}))} placeholder="100" style={{ width: '100%', marginTop: 4, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '6px 8px', fontSize: 12 }} /></label>
          <label style={{ fontSize: 11, color: DIM }}>Pinch сек<br/><input value={state.pinchSec} onChange={e=>setState(s=>({...s, pinchSec:e.target.value}))} placeholder="15" style={{ width: '100%', marginTop: 4, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '6px 8px', fontSize: 12 }} /></label>
        </div>
        <div style={{ fontSize: 10, color: DIM, marginBottom: 8 }}>Имплементы: RT 60мм вращ. / Axle 58мм DOH / Saxon 76мм pinch — берутся из <code>GRIP_IMPLEMENTS</code> (IronMind).</div>

        {/* Fail toggles */}
        <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>Где проваливаешься за столом?</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {[
            ['cup','Кисть открывается (cup)'],
            ['rising','Пальцы уходят (rising)'],
            ['pron','Топролл не держит (pron)'],
            ['sup','Хук проваливается (sup)'],
            ['side','Не дожимает боком (side)'],
            ['back','Тяга слабая (back)'],
          ].map(([k,label]) => (
            <button key={k} onClick={()=>toggle(k as any)} aria-pressed={!!(state as any)[k]} style={{ padding:'6px 10px', borderRadius:999, border:'1px solid', borderColor:(state as any)[k] ? '#f59e0b' : '#1f3a5f', background:(state as any)[k] ? 'rgba(245,158,11,0.14)' : '#0a1629', color:(state as any)[k] ? '#f59e0b' : DIM, cursor:'pointer', fontSize:11, fontWeight:600 }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Diagnostics output */}
      <div style={{ ...CARD, padding: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: ACCENT, marginBottom: 6 }}>🔬 Диагностика — слабые звенья</div>
        {diag.priorities.length===0 ? <div style={{ fontSize:11, color:DIM }}>Слабые зоны не выявлены — баланс. Попробуй отметить провалы или ввести хват.</div> : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {diag.priorities.map((p,i)=>(
              <div key={i} style={{ padding:'10px 12px', borderRadius:10, background:'#0a1629', border:'1px solid #1f3a5f' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                  <span style={{ fontSize:12, fontWeight:800, color:'#fff' }}>{ARM_MUSCLE_RU[p.muscle as any] || p.muscle}</span>
                  <span style={{ fontSize:10, color:DIM }}>{p.reason}</span>
                  <span style={{ marginLeft:'auto', fontSize:10, padding:'2px 6px', borderRadius:20, background:'rgba(245,158,11,0.12)', border:'1px solid rgba(245,158,11,0.2)', color:'#f59e0b' }}>{p.muscle}</span>
                </div>
                <div style={{ fontSize:11, color:'#5ee', marginBottom:6 }}>{p.exercises.join(' · ')}</div>
                <div style={{ fontSize:10, color:DIM }}>
                  MEV {getArmLandmarks(state.level, p.muscle).mev} · MAV {getArmLandmarks(state.level, p.muscle).mav} · MRV <b style={{color:'#fff'}}>{getArmLandmarks(state.level, p.muscle).mrv}</b> (tendonCap для запястных)
                </div>
              </div>
            ))}
            <div style={{ fontSize:10, color:DIM, marginTop:4 }}>{diag.rationale.join(' · ')}</div>
          </div>
        )}
      </div>

      {/* Injuries & balance */}
      <div style={{ ...CARD, padding: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: ACCENT, marginBottom: 6 }}>🛡️ Травмобезопасность</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          <div style={{ padding:'8px 10px', borderRadius:8, background: mockGuard.humerus.length? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)', border:`1px solid ${mockGuard.humerus.length?'rgba(239,68,68,0.2)':'rgba(34,197,94,0.2)'}` }}>
            <div style={{ fontSize:11, fontWeight:700, color: mockGuard.humerus.length?'#ef4444':'#22c55e' }}>Humerus (side)</div>
            <div style={{ fontSize:10, color:DIM, marginTop:2 }}>{mockGuard.humerus.length? mockGuard.humerus.join(' · ') : '✓ Нет риска: side ≤3, RIR≥2, прогрессия ≤10%/нед'}</div>
            <div style={{ fontSize:10, color:DIM, marginTop:6 }}>Landmark side MRV {landmarks.side.mrv} (самый низкий) · Cap 3/нед первые 4 нед (tendon)</div>
          </div>
          <div style={{ padding:'8px 10px', borderRadius:8, background: mockGuard.balance.length? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)', border:`1px solid ${mockGuard.balance.length?'rgba(245,158,11,0.2)':'rgba(34,197,94,0.2)'}` }}>
            <div style={{ fontSize:11, fontWeight:700, color: mockGuard.balance.length?'#f59e0b':'#22c55e' }}>Баланс pron/sup · flex/ext</div>
            <div style={{ fontSize:10, color:DIM, marginTop:2 }}>{mockGuard.balance.length? mockGuard.balance.join(' · ') : '✓ Баланс ≤1.5× (добивка в finalize)'}</div>
            <div style={{ fontSize:10, color:DIM, marginTop:6 }}>Pron MRV {landmarks.pron.mrv} · Wrist MEV {landmarks.wrist.mev} · Grip MEV {landmarks.grip.mev}</div>
          </div>
        </div>
      </div>

      {/* Table periodization */}
      <div style={{ ...CARD, padding: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: ACCENT, marginBottom: 6 }}>🗓 Стол — периодизация 3/2/1 (Кузнецов VIII)</div>
        <div style={{ display:'flex', gap:2, marginBottom:6 }}>
          {tablePreview.map(({ wk, kind }) => {
            const col = kind==='moderate'? '#22c55e' : kind==='heavy'? '#f59e0b' : '#ef4444';
            return <div key={wk} style={{ flex:1, height:18, background:col, borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:9, fontWeight:700 }}>{wk}</div>;
          })}
        </div>
        <div style={{ display:'flex', gap:8, fontSize:10, color:DIM, flexWrap:'wrap' }}>
          <span><span style={{ display:'inline-block', width:10, height:10, background:'#22c55e', borderRadius:2, verticalAlign:'middle', marginRight:4 }}></span>умеренная 50–75% 1–3мин</span>
          <span><span style={{ display:'inline-block', width:10, height:10, background:'#f59e0b', borderRadius:2, verticalAlign:'middle', marginRight:4 }}></span>тяжёлая 75–100% 10с–1мин</span>
          <span><span style={{ display:'inline-block', width:10, height:10, background:'#ef4444', borderRadius:2, verticalAlign:'middle', marginRight:4 }}></span>стресс 100–125% 5–10с</span>
        </div>
        <div style={{ fontSize:10, color:DIM, marginTop:6 }}>≥50% тренировок — стол. Тейпер 2–3 нед: 0.65/0.45, side×0.5, RIR+1/+2 (<code>arm-taper</code>).</div>
      </div>

      {/* Movements deep */}
      <div style={{ ...CARD, padding: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: ACCENT, marginBottom: 6 }}>🎯 8 движений — углы РУ/РА/РН</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, fontSize:10 }}>
          {[
            ['Cup','сгибание к мизинцу/среднему/большому (РН)', 'wrist_flexors'],
            ['Rising','пальцы + thumb, вертикальная ручка', 'risers'],
            ['Pronation','90° локоть, 5×5 heavy', 'pronators'],
            ['Supination','drag к бедру, hammer', 'supinators'],
            ['Ulnar/Radial','гантель вдоль тела', 'ulnar_deviators'],
            ['Side','на подушке, RIR≥2, ≤10%/нед', 'side_pressure'],
            ['Back','ремень к запястью', 'back_pressure'],
            ['Grip','RT 60мм / Axle 58мм DOH', 'grip_support'],
          ].map(([name, desc, mus])=>(
            <div key={name} style={{ padding:'6px 8px', borderRadius:8, background:'#0a1629', border:'1px solid #1f3a5f' }}>
              <div style={{ fontWeight:700, color:'#fff' }}>{name} <span style={{ color:DIM, fontWeight:400 }}>· {ARM_MUSCLE_RU[mus as any]||mus}</span></div>
              <div style={{ color:DIM }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Action */}
      <div style={{ ...CARD, padding: 12, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.16)' }}>
        <div style={{ fontSize:11, color:DIM, marginBottom:8 }}>Отправь слабые зоны в планировщик — там они станут специализацией ×1.3 и подберут упражнения по РУ/РА.</div>
        <button onClick={applyToConstructor} style={{ width:'100%', padding:'10px 14px', borderRadius:8, background:'linear-gradient(135deg,#f59e0b,#ef4444)', color:'#fff', border:'none', fontWeight:800, fontSize:13, cursor:'pointer' }}>→ Применить в Арм-конструктор ({diag.weakMuscles.slice(0,2).join(', ') || 'баланс'})</button>
        <div style={{ fontSize:10, color:DIM, marginTop:6, textAlign:'center' }}>Bridge: <code>weakpoints</code> → <code>ArmAutoConstructor</code> via <code>planner-bridge</code> (как в Диагностике движения)</div>
      </div>
    </div>
  );
};

export default ArmDiagnosticsHub;
