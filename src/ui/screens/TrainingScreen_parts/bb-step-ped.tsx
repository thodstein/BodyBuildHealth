/**
 * bb-step-ped.tsx — шаг 2 ББ-авто («💉 Фармакология и рабочие веса»), вынесен из
 * god-component `BbAutoConstructor.tsx` (этап 2 §4.3). Перенос 1-в-1: логика/тексты/
 * стили не менялись, все state-ссылки переданы явными props.
 */
import React from 'react';
import { PedInputPanel, PedAdaptationCard } from './PedCoursePanel';
import { recommendPEDMethodology, suggestMethodologyForStack } from '../../../engines/bb/bb-ped-methodology.engine';
import type { PED, PEDAdaptation } from '../../../engines/bb/bb-ped-adaptation.engine';
import type { BBTrainingFocus } from '../../../engines/bb/bb-goal-types';
import type { DUPMode } from '../../../engines/bb/bb-dup.engine';
import type { SessionMethodology } from '../../../engines/bb/bb-session-order.engine';
import { PopupNumber, PopupSelect } from '../SRCBBScreen_parts/TrainingPopups';
import { BTN, BTN_GHOST, H } from './training-ui';
import { BB_WM_KEYS, BB_WM_RU, type PlanMode } from './bb-auto-constructor-shared';

export interface BbPedWorkMaxStepProps {
  peds: PED[];
  setPeds: React.Dispatch<React.SetStateAction<PED[]>>;
  pedDoses: Record<string, number>;
  setPedDoses: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  courseIntensity: 'mild' | 'moderate' | 'heavy';
  setCourseIntensity: React.Dispatch<React.SetStateAction<'mild' | 'moderate' | 'heavy'>>;
  pedAdapt: PEDAdaptation;
  level: string;
  goal: string;
  trainingFocus: BBTrainingFocus;
  weeks: number;
  pedPhaseOverride: 'auto' | 'proliferation' | 'differentiation';
  setPedPhaseOverride: React.Dispatch<React.SetStateAction<'auto' | 'proliferation' | 'differentiation'>>;
  proPreset: string;
  setProPreset: React.Dispatch<React.SetStateAction<string>>;
  dupMode: DUPMode;
  setDupMode: React.Dispatch<React.SetStateAction<DUPMode>>;
  supersetMode: 'none' | 'antagonist' | 'same_muscle' | 'giant';
  setSupersetMode: React.Dispatch<React.SetStateAction<'none' | 'antagonist' | 'same_muscle' | 'giant'>>;
  volumeScheme: 'standard' | 'gvt' | 'fst7' | 'gironda';
  setVolumeScheme: React.Dispatch<React.SetStateAction<'standard' | 'gvt' | 'fst7' | 'gironda'>>;
  methodology: SessionMethodology;
  setMethodology: React.Dispatch<React.SetStateAction<SessionMethodology>>;
  bfrMode: boolean;
  setBfrMode: React.Dispatch<React.SetStateAction<boolean>>;
  dcMode: boolean;
  setDcMode: React.Dispatch<React.SetStateAction<boolean>>;
  blastCruiseEnabled: boolean;
  setBlastCruiseEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  blastWeeks: number;
  setBlastWeeks: React.Dispatch<React.SetStateAction<number>>;
  cruiseWeeks: number;
  setCruiseWeeks: React.Dispatch<React.SetStateAction<number>>;
  workMax: Record<string, number>;
  setWorkMax: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  planMode: PlanMode;
  onBuild: () => void;
  onNext: () => void;
  onBackToParams: () => void;
  flash: (m: string) => void;
}

export const BbPedWorkMaxStep: React.FC<BbPedWorkMaxStepProps> = ({
  peds, setPeds, pedDoses, setPedDoses, courseIntensity, setCourseIntensity, pedAdapt,
  level, goal, trainingFocus, weeks, pedPhaseOverride, setPedPhaseOverride,
  proPreset, setProPreset, dupMode, setDupMode, supersetMode, setSupersetMode,
  volumeScheme, setVolumeScheme, methodology, setMethodology,
  bfrMode, setBfrMode, dcMode, setDcMode, blastCruiseEnabled, setBlastCruiseEnabled, blastWeeks, setBlastWeeks,
  cruiseWeeks, setCruiseWeeks, workMax, setWorkMax, planMode, onBuild, onNext, onBackToParams, flash,
}) => (
  <div>
    <div style={H}>💉 Шаг 2: Фармакология и рабочие веса</div>
    <PedInputPanel
      peds={peds}
      onToggle={p => setPeds(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
      pedDoses={pedDoses}
      onDose={(p, v) => setPedDoses(d => ({ ...d, [p]: v }))}
      courseIntensity={courseIntensity}
      onIntensity={setCourseIntensity}
    />
    <PedAdaptationCard adaptation={pedAdapt} />
    {peds.length > 0 && (() => {
      try {
        const meth = recommendPEDMethodology({ peds: peds as any, pedDoses, level, goal, focus: trainingFocus, totalWeeks: weeks, phaseOverride: pedPhaseOverride });
        return (
          <div style={{ marginTop:8, padding:10, borderRadius:10, background:'rgba(139,92,246,0.06)', border:'1px solid rgba(139,92,246,0.18)' }}>
            <div style={{ fontSize:11, fontWeight:800, color:'#a78bfa', marginBottom:6 }}>🧬 PED-методика — адаптация плана под курс (тяж/памп не ломаются)</div>
            {meth.jointGuard && <div style={{ fontSize:11, color:'#fff', marginBottom:4, padding:'5px 7px', background:'rgba(59,130,246,0.08)', borderRadius:6, border:'1px solid rgba(59,130,246,0.15)' }}>🛡️ Защита суставов: тяжёлые базовые остаются тяжёлыми (RIR 1-2), но осевая нагрузка на позвоночник (присед/становая/жим стоя) заменяется на машины/блоки/тросы, темп 4-2-1-0 для контроля. Сухожилия на курсе отстают от мышц — снижаем риск травмы.</div>}
            {meth.insulinPumpWindow && <div style={{ fontSize:11, color:'#fff', marginBottom:4, padding:'5px 7px', background:'rgba(168,85,247,0.08)', borderRadius:6, border:'1px solid rgba(168,85,247,0.15)' }}>💉 Окно пампа GH+инсулин: только в памп-дни — внутри тренировки 30-60 г быстрых углеводов + 10 г EAA (незаменимые аминокислоты) для суперкомпенсации гликогена и пампа. Только на курсе GH+инсулин.</div>}
            {meth.bfrAllowed && !meth.insulinPumpWindow && <div style={{ fontSize:11, color:'#fff', marginBottom:4, padding:'5px 7px', background:'rgba(236,72,153,0.08)', borderRadius:6, border:'1px solid rgba(236,72,153,0.15)' }}>🩸 BFR доступен: окклюзионный тренинг 20-30% от 1ПМ, схема 30-15-15-15 с паузой 30 сек, только для памп-изоляций (бицепс/трицепс/дельты), не для базы. Усиливает метаболический стресс без высокой механической нагрузки.</div>}
            {(meth.pedPhase === 'proliferation' || meth.pedPhase === 'differentiation') && <div style={{ fontSize:11, color:'#fff', marginBottom:4, padding:'5px 7px', background:'rgba(34,197,94,0.08)', borderRadius:6, border:'1px solid rgba(34,197,94,0.15)' }}>🧬 {meth.pedPhase === 'proliferation' ? 'Фаза MGF (пролиферация): цель — повреждение + стретч (эксцентрик 3-4с, lengthened, порядок Mountain Dog)' : 'Фаза IGF1 (дифференцировка): цель — синтез белка (памп 12-20 + углеводное окно 50-80 г)'}</div>}
            {meth.pedPhase === 'both' && <div style={{ fontSize:11, color:'#fff', marginBottom:4, padding:'5px 7px', background:'rgba(34,197,94,0.08)', borderRadius:6, border:'1px solid rgba(34,197,94,0.15)' }}>🧬 MGF+IGF1 чередованием по неделям (не одновременно): MGF-недели — повреждение/стретч, IGF1-недели — памп + углеводное окно. Пометки в плане стоят только в свои недели.</div>}
            {meth.insulinSafety && <div style={{ fontSize:11, color:'#fbbf24', marginBottom:4, padding:'5px 7px', background:'rgba(251,191,36,0.08)', borderRadius:6, border:'1px solid rgba(251,191,36,0.2)' }}>🛡 Инсулин {meth.insulinSafety.doseIU} IU: ≥{meth.insulinSafety.requiredCarbsG} г быстрых углеводов + 10-20 г EAA вокруг инъекции, глюкометр и сахара под рукой. Старт 3-5 IU.</div>}
            {meth.periWorkout?.intraNote && <div style={{ fontSize:10, color:'#fbbf24', marginBottom:4 }}>🍚 {meth.periWorkout.intraNote}</div>}
            {meth.periWorkout?.warning && <div style={{ fontSize:10, color:'#f87171', marginBottom:4 }}>⚠ {meth.periWorkout.warning}</div>}
            <div style={{ fontSize:10, color:'#fff', opacity:0.85 }}>📋 Тяж: {meth.recommendedScheme.heavy} · Памп: {meth.recommendedScheme.pump} {proPreset !== 'none' ? `· Пресет ${proPreset}` : ''}</div>
            {(() => { try {
              const sug = suggestMethodologyForStack({ peds: peds as any, pedDoses });
              if (!sug || sug === methodology) return null;
              const sugLabel = sug === 'hyperemia' ? 'Hyperemia' : 'Mountain Dog';
              return (<button onClick={() => { setMethodology(sug); flash('Методика обновлена'); }} style={{ marginTop:6, padding:'6px 12px', borderRadius:10, fontSize:11, fontWeight:700, cursor:'pointer', background:'rgba(139,92,246,0.12)', border:'1px solid rgba(139,92,246,0.4)', color:'#c4b5fd' }}>Взять: {sugLabel}</button>);
            } catch { return null; } })()}
            {(() => { try {
              const sug = suggestMethodologyForStack({ peds: peds as any, pedDoses });
              if (!sug || sug === methodology) return null;
              const sugLabel = sug === 'hyperemia' ? 'Hyperemia (GH+инсулин)' : 'Mountain Dog (MGF)';
              return (<button onClick={() => { setMethodology(sug); flash('Методика порядка обновлена под PED-стек'); }} style={{ marginTop:6, padding:'6px 12px', borderRadius:10, fontSize:11, fontWeight:700, cursor:'pointer', background:'rgba(139,92,246,0.12)', border:'1px solid rgba(139,92,246,0.4)', color:'#c4b5fd' }}>Взять: {sugLabel}</button>);
            } catch { return null; } })()}
            <div style={{ fontSize:10, color:'#fff', opacity:0.7, marginTop:4 }}>🔄 Все сплиты адаптируются под фарму (выбор сохранён, объём ×{(pedAdapt.combinedMrvMultiplier||1).toFixed(2)})</div>
          </div>
        );
      } catch { return null; }
    })()}
    <div style={{ display:'flex', gap:8, marginTop:8, flexWrap:'wrap' }}>
      <button onClick={() => setBfrMode(v=>!v)} style={{ padding:'6px 12px', borderRadius:10, fontSize:11, fontWeight:700, cursor:'pointer', background: bfrMode ? 'rgba(236,72,153,0.18)' : 'rgba(255,255,255,0.04)', border: bfrMode ? '1px solid #ec4899' : '1px solid rgba(255,255,255,0.1)', color: bfrMode ? '#ec4899' : '#fff' }}>{bfrMode ? '🩸 BFR включён (30-15-15-15)' : '🩸 BFR окклюзия (только памп)'}</button>
      <button onClick={() => setDcMode(v=>!v)} style={{ padding:'6px 12px', borderRadius:10, fontSize:11, fontWeight:700, cursor:'pointer', background: dcMode ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.04)', border: dcMode ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)', color: dcMode ? '#fca5a5' : '#fff' }}>{dcMode ? 'DC-лайт включён' : 'DC-лайт (Dante)'}</button>
      <button onClick={() => setBlastCruiseEnabled(v=>!v)} style={{ padding:'6px 12px', borderRadius:10, fontSize:11, fontWeight:700, cursor:'pointer', background: blastCruiseEnabled ? 'rgba(250,204,21,0.18)' : 'rgba(255,255,255,0.04)', border: blastCruiseEnabled ? '1px solid #facc15' : '1px solid rgba(255,255,255,0.1)', color: blastCruiseEnabled ? '#facc15' : '#fff' }}>{blastCruiseEnabled ? `🔄 Blast ${blastWeeks}н / Cruise ${cruiseWeeks}н` : '🔄 Blast/Cruise выкл'}</button>
      {blastCruiseEnabled && <>
        <PopupNumber label='Blast нед' value={blastWeeks} min={4} max={12} onChange={setBlastWeeks} />
        <PopupNumber label='Cruise нед' value={cruiseWeeks} min={2} max={8} onChange={setCruiseWeeks} />
      </>}
      <PopupSelect label='🏆 Pro-пресет (методики профи)' value={proPreset} onChange={v=>{ setProPreset(v); if(v==='dc'&&dupMode==='none') setDupMode('strength_hypertrophy' as any); if(v==='dc') setDcMode(true); if(v==='fortitude'){ setSupersetMode('giant' as any); if(volumeScheme==='standard') setVolumeScheme('fst7' as any);} }} hint='Готовые связки методик от профи-тренеров — в коде: none/dc/fortitude/meadows' options={[
        {id:'none',label:'Без пресета',desc:'Стандартная сборка по вашим параметрам без пресета'},
        {id:'dc',label:'DC Training (DoggCrapp)',desc:'Низкообъёмный, высокоинтенсивный: 1 тяжёлый сет Rest-Pause 11-15 повторов, прогрессия каждый раз, для продвинутых (≥3 года)'},
        {id:'fortitude',label:'Fortitude (Скотт Стивенсон)',desc:'4×6, гигант-сеты, FST-7, волновая нагрузка — объёмный пресет для опытных, требует восстановления'},
        {id:'meadows',label:'Meadows (Джон Медоуз)',desc:'Акцент на растянутой позиции, памп, медленный эксцентрик, проработка слабых мест — для гипертрофии'},
      ]} />
    </div>
    <div style={{ fontSize:10, color:'#fff', opacity:0.65, marginTop:4 }}>DC-лайт: ротация-3 топ-лифтов + widowmaker + круиз каждые 6 нед. Гейт: AAS от 750 + advanced/enhanced.</div>
    {((pedDoses.MGF || 0) > 0 && (pedDoses.IGF1 || 0) > 0) && (
    <PopupSelect label='Фаза MGF/IGF1' value={pedPhaseOverride} onChange={v => setPedPhaseOverride(v as any)} hint='Вручную поверх авто-фазировки.' options={[
      { id: 'auto', label: 'Авто (по стеку)', desc:'Авто.' },
      { id: 'proliferation', label:'Пролиферация', desc:'Повреждение + стретч.' },
      { id: 'differentiation', label:'Дифференцировка', desc:'Памп + углеводное окно.' },
    ]} />
    )}
    {bfrMode && (
      <div style={{ marginTop:8, padding:10, borderRadius:10, background:'rgba(236,72,153,0.06)', border:'1px solid rgba(236,72,153,0.18)', fontSize:11, color:'#fff', lineHeight:1.45 }}>
        <div style={{ fontWeight:800, color:'#ec4899', marginBottom:4 }}>🩸 Что такое BFR и как работает</div>
        <div>Окклюзия — жгуты на верхней части конечности, 20-30% от 1ПМ, схема 30 повторов + 15+15+15 с паузой 30 сек. Кровь задерживается, метаболиты копятся, рост без тяжёлых весов. Только для памп-изоляций (бицепс/трицепс/дельты/икры), не для базы. На курсе — усиливает памп, вне курса — для отстающих с малым весом.</div>
        <div style={{ marginTop:6, fontSize:10, color:'#fff', opacity:0.85, padding:'5px 7px', background:'rgba(236,72,153,0.08)', borderRadius:6 }}>В плане: памп-изоляции получат пометку <b>BFR 30-15-15-15 @25% 1ПМ, отдых 30 сек, RIR 2</b>. Тяжёлые базовые не трогаются. Не для новичков и при проблемах с сосудами.</div>
      </div>
    )}
    {blastCruiseEnabled && (
      <div style={{ marginTop:8, padding:10, borderRadius:10, background:'rgba(250,204,21,0.06)', border:'1px solid rgba(250,204,21,0.18)', fontSize:11, color:'#fff', lineHeight:1.45 }}>
        <div style={{ fontWeight:800, color:'#facc15', marginBottom:4 }}>🔄 Что такое Blast/Cruise и как работает</div>
        <div>Blast — 8 недель высокой дозы (объём ×1.15), Cruise — 4 недели низкой (×0.85), чередование для долгосрочного курса. Позволяет держать высокий объём без перетрена, как периодизация на курсе. Настраивается: Blast 4-12 недель, Cruise 2-8 недель.</div>
        <div style={{ marginTop:6, fontSize:10, color:'#fff', opacity:0.85, padding:'5px 7px', background:'rgba(250,204,21,0.08)', borderRadius:6 }}>В плане: недели Blast получат <b>+15% сетов</b>, Cruise — <b>−15% и RIR +1</b>. Автоматически применяется к объёму и восстановлению. Для натуралов — выкл.</div>
      </div>
    )}
         {/* Рекомендации по питанию */}
        {(() => {
          const nut: Record<string, { cal: string; pro: string; tip: string }> = {
            mass: { cal: 'Профицит 300-500 ккал/день', pro: '1.8-2.2 г/кг (≥160 г/день)', tip: 'Углеводы вокруг тренировки. 4-6 приёмов пищи.' },
            cut: { cal: 'Дефицит 300-500 ккал/день', pro: '2.2-2.8 г/кг (≥180 г/день)', tip: 'Белок повышен для сохранения мышц. Клетчатка 30+ г/день.' },
            recomp: { cal: 'Поддержание ±100 ккал', pro: '2.0-2.4 г/кг', tip: 'Циклирование углеводов: высокие в дни тренировок, низкие в дни отдыха.' },
            maintenance: { cal: 'Поддержание (TDEE)', pro: '1.6-2.0 г/кг', tip: 'Стабильное питание, контроль веса 1 раз/нед.' },
            strength_mass: { cal: 'Профицит 400-600 ккал/день', pro: '2.0-2.5 г/кг (≥180 г/день)', tip: 'Углеводы 5-7 г/кг для силовой производительности.' },
          };
          const n = nut[goal] || nut.mass;
          const calMult = (pedAdapt.combinedMrvMultiplier - 1) * 3 + 1; // PED boost = больше калорий
          const adjCal = goal === 'cut' ? n.cal : n.cal.replace(/\d+/, m => String(Math.round(Number(m) * calMult)));
          return (
            <div style={{ marginTop:8, padding:10, borderRadius:10, background:'rgba(34,197,94,0.04)', border:'1px solid rgba(34,197,94,0.15)' }}>
              <div style={{ fontSize:11, fontWeight:800, color:'#22c55e', marginBottom:6 }}>🥗 Рекомендации по питанию ({goal})</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, fontSize:11 }}>
                <div><span style={{ color:'#fff' }}>Калории: </span><span style={{ fontWeight:700, color:'#f59e0b' }}>{adjCal}</span></div>
                <div><span style={{ color:'#fff' }}>Белок: </span><span style={{ fontWeight:700, color:'#22c55e' }}>{n.pro}</span></div>
                <div style={{ gridColumn:'1/-1' }}><span style={{ color:'#fff' }}>💡 </span><span style={{ color:'#fff' }}>{n.tip}</span></div>
                {pedAdapt.combinedMrvMultiplier > 1 && (
                  <div style={{ gridColumn:'1/-1', marginTop:4, fontSize:10, color:'#f59e0b' }}>
                    💉 PED увеличивают потребность в калориях и белке — значения скорректированы.
                  </div>
                )}
              </div>
            </div>
          );
        })()}
    <div style={H}>💪 Рабочие максимумы (кг)</div>
    <div style={{ marginBottom:8, padding:'6px 10px', borderRadius:10, background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.12)', fontSize:11, color:'#fff' }}>
      💡 Введите <b>рабочий вес на 5-8 повторений</b> (НЕ 1ПМ!) для каждой группы. Например: жим лёжа 100кг×8 → «Грудь 100».
      Для икр/пресса — вес в тренажёре. Веса используются для расчёта нагрузки по RIR и %1RM.
    </div>
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, marginBottom:10 }}>
      {BB_WM_KEYS.map(k => <PopupNumber key={k} label={BB_WM_RU[k]} value={workMax[k] || 80} min={10} max={500} suffix=' кг' onChange={v => setWorkMax(p => ({ ...p, [k]: v }))} />)}
    </div>
    <button style={{ ...BTN, width:'100%' }} onClick={() => planMode === 'programs' ? onBuild() : onNext()}>
      {planMode === 'programs' ? '⚡ Собрать план по программе →' : 'Далее: выбрать сплит →'}
    </button>
    {planMode === 'programs' && (
      <button style={{ ...BTN_GHOST, width:'100%', marginTop:6 }} onClick={onBackToParams}>
        ← Назад к параметрам
      </button>
    )}
  </div>
);
