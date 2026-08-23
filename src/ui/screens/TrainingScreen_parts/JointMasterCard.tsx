/**
 * JointMasterCard.tsx — ЕДИНЫЙ МАСТЕР СУСТАВНО-СВЯЗОЧНОГО АППАРАТА.
 *
 * 9 блоков на один сустав/движение (опасные зоны: поясница L4-S1 выделена):
 *  0 ИСИ теплокарта → 1 анатомия риска → 2 текущая нагрузка → 3 геометрия → сустав →
 *  4 недельный план → 5 прехаб/мобильность → 6 мониторинг (ФМС-6 + подвижность) →
 *  7 рекомендации (замены + подсказки) → 8 техника и безопасность упражнения → + видео-гид ракурса.
 *
 * Использует все 9 ортопедических калькуляторов проекта + быструю оценку техники. Без вкладок, один скролл.
 */
import React, { useMemo, useState } from 'react';
import { JOINTS, JOINT_OPTIONS, jointLoadDiagnosis, JOINT_MAP, type JointId } from '../../../engines/pro/joint-load-master.engine';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import type { Lift } from '../../../engines/lms/weakpoint-pl';
import { VideoCaptureCard } from './VideoCaptureCard';
import { distributeWeeklyLoad } from '../../../engines/orthopedic-load-engines';
import { applyToPlanner } from './planner-bridge';
import { JointJsiCalculatorCard } from './JointJsiCalculatorCard';
import { ExerciseSafetyPanel } from '../SRCBBScreen_parts/ExerciseSafetyPanel';
import { PopupSelect } from '../SRCBBScreen_parts/TrainingPopups';

const CARD: React.CSSProperties = { padding:12, borderRadius:10, background:'rgba(24,24,27,0.45)', border:'1px solid rgba(255,255,255,0.08)', marginTop:8 };
const DIM='#ffffff', ACCENT='#f43f5e';
const JOINT_COLOR: Record<JointId,string> = { shoulder:'#f43f5e', elbow:'#fb923c', wrist:'#facc15', spine:'#ef4444', hip:'#a78bfa', knee:'#38bdf8', ankle:'#4ade80' };
const LEVEL_RU: Record<string,string> = { critical: 'Критично', high: 'Высокий', moderate: 'Средний', medium: 'Средний', low: 'Низкий', none: 'Нет' };
const PHASE_RU: Record<string,string> = { acute: 'Острая', subacute: 'Подострая', chronic: 'Хроническая', normal: 'Норма', stable: 'Стабильная' };
const DIFF_RU: Record<string,string> = { hard: 'Тяжёлая', medium: 'Средняя', light: 'Лёгкая', off: 'Отдых' };
const LIFT_RU_ALL: Record<string,string> = { squat: 'Присед', deadlift: 'Становая (классика)', bench: 'Жим лёжа', ohp: 'Жим стоя', row: 'Тяга в наклоне', pulldown: 'Тяга блока', incline_press: 'Жим наклонный', sumo: 'Сумо', biceps: 'Бицепс' };
const PATTERN_RU: Record<string,string> = { squat: 'Присед', hinge: 'Наклон', horizontal_push: 'Жим горизонтально', horizontal_pull: 'Тяга горизонтально', vertical_push: 'Жим вертикально', vertical_pull: 'Тяга вертикально', lunge: 'Выпад', carry: 'Перенос', rotation: 'Ротация', anti_rotation: 'Антиротация', accessory: 'Изоляция' };

export const JointMasterCard: React.FC = () => {
  const [sub, setSub] = useState<'ortho' | 'safety'>('ortho');
  const [joint, setJoint] = useState<JointId>('spine'); // поясница по умолчанию — самая опасная
  const [lift, setLift] = useState<Lift>('squat');
  const [phasePain, setPhasePain] = useState<string>('');
  const [selected, setSelected] = useState<Record<string,string[]>>({});
  const [weekGoal, setWeekGoal] = useState<'strength'|'hypertrophy'|'rehab'>('strength');
  const [weeklySessions, setWeeklySessions] = useState<number>(4);

  const diag = useMemo(()=> jointLoadDiagnosis({ joint, lifts:[lift], currentPain: phasePain ? [phasePain] : [] }), [joint,lift,phasePain]);
  const opts = diag.options;
  const weekPlan = useMemo(()=> distributeWeeklyLoad({ weeklySessions, goal: weekGoal, volumeCapacity: 1, intensityCapacity: 1, priScore: 0.5, riskLevel: diag.phase==='acute'?'high': diag.phase==='subacute'?'medium':'low' }), [weeklySessions, weekGoal, diag.phase]);

  return (
    <div style={{ padding:12, color:'#fff' }}>
      <div style={{ fontSize:15, fontWeight:800, color:ACCENT }}>🦴 Ортопедия и суставы</div>
      <div style={{ fontSize:10, color:'#fff', marginTop:3, lineHeight:1.45 }}>
        Единый центр управления здоровьем суставов: тепловая карта износа, анатомия риска, текущая нагрузка, геометрия, недельный план, прехаб и мобильность, мониторинг движений, замены упражнений, видео-анализ и оценка техники. Всё в одном месте, без дублей и лишних вкладок.
      </div>

      {/* подвкладки */}
      <div style={{ display:'flex', gap:6, marginTop:8, marginBottom:6, flexWrap:'wrap' }}>
        {([['ortho','📋 Режим детализации'],['safety','⚡ Быстрый режим']] as const).map(([id,label])=>(
          <button key={id} onClick={()=>setSub(id)} aria-pressed={sub===id} style={{
            minHeight:36, padding:'7px 14px', borderRadius:10, cursor:'pointer', fontSize:11, fontWeight:800,
            border: sub===id ? '1px solid '+ACCENT : '1px solid rgba(255,255,255,0.08)',
            background: sub===id ? 'rgba(244,63,94,0.14)' : 'rgba(255,255,255,0.02)',
            color: sub===id ? ACCENT : DIM,
          }}>{label}</button>
        ))}
      </div>

      {sub === 'safety' && (
        <>
          <div style={{ marginTop:4, padding:'8px 10px', borderRadius:10, background:'rgba(0,230,138,0.05)', border:'1px solid rgba(0,230,138,0.14)', fontSize:10, color:'#fff', lineHeight:1.4 }}>
            Быстрая оценка техники и противопоказаний для выбранного движения. Детальный разбор каждого сустава — во вкладке <b style={{ color:ACCENT }}>«Режим детализации»</b> выше.
          </div>
          <ExerciseSafetyPanel />
        </>
      )}
      {sub === 'ortho' && (<> 
      {/* выбор сустава */}
      <div style={{ ...CARD, display:'flex', gap:5, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ fontSize:11, fontWeight:800, color:ACCENT, marginRight:6 }}>Сустав/зона:</div>
        {JOINTS.map(j=>{ const on=joint===j.id; return <button key={j.id} onClick={()=>setJoint(j.id)} style={{ minHeight:32, padding:'5px 10px', borderRadius:14, cursor:'pointer', border: on?`1px solid ${JOINT_COLOR[j.id]}`:'1px solid rgba(255,255,255,0.1)', background: on?`${JOINT_COLOR[j.id]}22`:'transparent', color: on?JOINT_COLOR[j.id]:DIM, fontWeight:700, fontSize:10 }}>{j.icon} {j.label}{on?' ✓':''}</button>; })}
      </div>
      <div style={{ ...CARD, display:'flex', gap:5, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ fontSize:11, fontWeight:800, color:ACCENT, marginRight:6 }}>Движение:</div>
        {(['squat','deadlift','bench','ohp','row','pulldown','incline_press','sumo','biceps'] as Lift[]).map(l=>{ const on=lift===l; return <button key={l} onClick={()=>setLift(l)} style={{ minHeight:28, padding:'4px 9px', borderRadius:10, cursor:'pointer', fontSize:9, border: on?'1px solid #38bdf8':'1px solid rgba(255,255,255,0.1)', background: on?'rgba(56,189,248,0.15)':'transparent', color: on?'#38bdf8':DIM, fontWeight:700 }}>{LIFT_RU_ALL[l] || l}</button>; })}
        <div style={{ marginLeft:8, minWidth:160 }}>
          <PopupSelect label="Боль сейчас" value={phasePain} options={[
            { id:'', label:'Нет боли' },
            { id:'spine', label:'Поясница / спина' },
            { id:'shoulder', label:'Плечо' },
            { id:'knee', label:'Колено' },
            { id:'elbow', label:'Локоть' },
            { id:'wrist', label:'Запястье' },
            { id:'hip', label:'Таз / бедро' },
            { id:'ankle', label:'Голеностоп' },
          ]} onChange={setPhasePain} />
        </div>
      </div>

      {/* 1 анатомия */}
      <div style={CARD}>
        <div style={{ fontSize:11, fontWeight:800, color:JOINT_COLOR[joint] }}>1 · Анатомия риска — {diag.joint.label} {diag.joint.icon}</div>
        <div style={{ fontSize:10, color:'#fff', marginTop:4, lineHeight:1.5 }}>{diag.joint.description}</div>
        <div style={{ fontSize:10, color:'#fbbf24', marginTop:4 }}>Опасные структуры: {diag.joint.dangerous.join(' · ')}</div>
        <div style={{ fontSize:10, color:'#fff', marginTop:4 }}>Связанные движения: {diag.joint.relatedLifts.join(', ')}</div>
        {joint==='spine' && <div style={{ marginTop:6, padding:'6px 8px', borderRadius:6, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', color:'#f87171', fontSize:10 }}>🦴 Поясница выделена: диск L4-S1 не терпит округления + сдвиг. Нейтраль + брейсинг + ограничение глубины — база.</div>}
        <button onClick={() => {
          const flow = diag.flows[0];
          if (flow) applyToPlanner({ kind:'limiter', label:`Мобильность ${diag.joint.label}: ${flow.name}`, data:{ limiterExerciseMap:{ [diag.joint.id+'|mobility|'+flow.id]: flow.exercises || [] }, limiterProtocolMap:{}, limiterDayMap:{} } as any });
          else applyToPlanner({ kind:'limiter', label:`Анатомия ${diag.joint.label}: прехаб`, data:{ limiterExerciseMap:{ [diag.joint.id+'|prehab|anat']: diag.mobilityTests.map(t=>t.title) }, limiterProtocolMap:{}, limiterDayMap:{} } as any });
        }} style={{ marginTop:8, width:'100%', minHeight:32, border:'none', borderRadius:8, cursor:'pointer', background:'#fff', color:'#000', fontWeight:800, fontSize:10 }}>🛠 Добавить прехаб для {diag.joint.label}</button>
      </div>

      {/* 2 нагрузка */}
      <div style={CARD}>
        <div style={{ fontSize:11, fontWeight:800, color:ACCENT }}>2 · Текущая нагрузка из плана (нагрузка на сустав)</div>
        <div style={{ fontSize:10, color:'#fff', marginTop:2 }}>Фаза ортопедии: <b style={{color:ACCENT}}>{PHASE_RU[diag.phase] || diag.phase}</b> · Разрешено: {diag.allowedPatterns.map(p=>PATTERN_RU[p]||p).join(', ') || '—'} · Заблокировано: <span style={{color:'#f87171'}}>{diag.blockedPatterns.map(p=>PATTERN_RU[p]||p).join(', ') || 'нет'}</span></div>
        <div style={{ fontSize:10, color:'#fff', marginTop:4 }}>Лимиты амплитуды: {Object.keys(diag.romLimits).length? Object.entries(diag.romLimits).map(([k,v])=>`${k} ${v.min}-${v.max}°`).join(', ') : 'нет'} · Стресс-лимиты: {Object.entries(diag.stressLimits).slice(0,3).map(([k,v])=>`${k}:${v}`).join(', ')}</div>
        <div style={{ fontSize:10, color:'#fff', marginTop:4 }}>Пример упражнений с высокой нагрузкой на сустав:</div>
        <div style={{ fontSize:10, color:'#fff' }}>{EXERCISE_CATALOG.filter(e=>e.jointStress==='high' && (e.group==='legs' && joint==='knee' || e.group==='back' && joint==='spine' || e.group==='chest' && joint==='shoulder')).slice(0,3).map(e=>e.name).join(' · ') || '—'}</div>
        <button onClick={() => {
          if (diag.blockedPatterns.length) {
            const map: Record<string,string[]> = {};
            diag.blockedPatterns.forEach(p => { map[diag.joint.id+'|blocked|'+p] = [PATTERN_RU[p]||p]; });
            applyToPlanner({ kind:'limiter', label:`Разгрузка ${diag.joint.label}: ${diag.blockedPatterns.length} паттернов`, data:{ limiterExerciseMap: map, limiterProtocolMap:{}, limiterDayMap:{} } as any });
          } else {
            applyToPlanner({ kind:'pri', label:`Статус ${diag.joint.label}: норма`, data:{ volumeMult: 1, rirShift: 0 } as any });
          }
        }} style={{ marginTop:8, width:'100%', minHeight:32, border:'none', borderRadius:8, cursor:'pointer', background:'#fff', color:'#000', fontWeight:800, fontSize:10 }}>
          {diag.blockedPatterns.length ? `🛠 Разгрузить ${diag.joint.label} — исключить ${diag.blockedPatterns.length} паттерна` : `✓ ${diag.joint.label}: ограничений нет — применить норму`}
        </button>
      </div>

      {/* 3 геометрия → сустав */}
      <div style={CARD}>
        <div style={{ fontSize:11, fontWeight:800, color:JOINT_COLOR[joint] }}>3 · Геометрия → нагрузка на {diag.joint.label}</div>
        {opts.length===0 ? <div style={{ fontSize:10, color:'#fff' }}>Нет специфичных опций — используйте технику из JointMaster жима/приседа.</div> : opts.map(o=>{
          const sel = selected[o.id] ?? [];
          return (
          <div key={o.id} style={{ marginTop:8, padding:8, borderRadius:7, background:'rgba(255,255,255,0.02)', border:`1px solid ${JOINT_COLOR[joint]}18` }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#fff' }}>{o.label} <span style={{ fontSize:8, color: o.level==='critical'?'#ef4444': o.level==='high'?'#f97316':DIM, border:`1px solid ${o.level==='critical'?'#ef4444':'rgba(255,255,255,0.1)'}`, padding:'1px 5px', borderRadius:4, marginLeft:6 }}>{LEVEL_RU[o.level] || o.level}</span></div>
            <div style={{ fontSize:9, color:'#fff', marginTop:2 }}>{o.description}</div>
            <div style={{ fontSize:9, color:JOINT_COLOR[joint], marginTop:3 }}>📋 {o.method}</div>
            <div style={{ fontSize:9, color:'#fff', marginTop:2 }}>🧠 {o.rationale}</div>
            <div style={{ marginTop:6, display:'flex', gap:4, flexWrap:'wrap' }}>
              {o.assistance.map(name=>{
                const on = sel.includes(name);
                return <button key={name} onClick={()=>{
                  setSelected(cur=>{
                    const curSel = cur[o.id] ?? [];
                    const next = on ? curSel.filter(x=>x!==name) : [...curSel, name];
                    return { ...cur, [o.id]: next };
                  });
                }} style={{ padding:'3px 7px', borderRadius:6, cursor:'pointer', fontSize:9, border: on?`1px solid ${JOINT_COLOR[joint]}`:'1px solid rgba(255,255,255,0.1)', background: on?`${JOINT_COLOR[joint]}22`:'transparent', color: on? JOINT_COLOR[joint]:DIM }}>{name}{on?' ✓':''}</button>;
              })}
            </div>
          </div>
        );})}
        <button onClick={()=>{
          const map: Record<string,string[]> = {}; let total=0;
          for (const [k,v] of Object.entries(selected)) if (v.length) { map[k]=v; total+=v.length; }
          if (total===0) { // если ничего не выбрано — берём первую помощь каждой опции
            for (const o of opts) map[o.id]=[o.assistance[0]];
            total = opts.length;
          }
          // используем limiter канал: joint-коррективы как limiiter с протоколом опции
          const limiterExerciseMap: Record<string,string[]> = {};
          const limiterProtocolMap: Record<string,{protocol:any; category:string}> = {};
          for (const o of opts) if (map[o.id]?.length) {
            const k = `${o.joint}|joint|${o.id}`;
            limiterExerciseMap[k]=map[o.id];
            limiterProtocolMap[k]={ protocol: o.protocol as any, category:'joint' };
          }
          applyToPlanner({ kind:'limiter', label:`Сустав ${diag.joint.label}: ${total} корр.`, data:{ limiterExerciseMap, limiterProtocolMap, limiterDayMap:{} } as any });
        }} style={{ marginTop:8, width:'100%', minHeight:36, border:'none', borderRadius:8, cursor:'pointer', background: ACCENT, color:'#000', fontWeight:800, fontSize:11 }}>
          🛠 Добавить коррекции в PL-авто ({Object.values(selected).reduce((a,b)=>a+b.length,0) || opts.length} авт.)
        </button>
      </div>

      {/* 4 прехаб */}
      <div style={CARD}>
        <div style={{ fontSize:11, fontWeight:800, color:'#a78bfa' }}>4 · Прехаб / мобильность для {diag.joint.label}</div>
        <div style={{ fontSize:10, color:'#fff', marginTop:4 }}>Тесты: {diag.mobilityTests.map(t=>t.title).join(', ') || '—'}</div>
        <div style={{ fontSize:10, color:'#fff', marginTop:4 }}>Слабые (последняя оценка): {diag.weakest.map(w=>`${w.test.title} ${w.score}/2`).join(', ') || 'нет данных — пройдите оценку в «Мобильность»'}</div>
        <div style={{ fontSize:10, color:'#fff', marginTop:4 }}>Потоки: {diag.flows.map(f=>f.name).join(', ') || '—'}</div>
      </div>

      {/* 4b недельный план нагрузки (orthopedic-load) — синхронизирован с движком (равномерное распределение, без блока «дни подряд») */}
      <div style={CARD}>
        <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
          <div style={{ fontSize:11, fontWeight:800, color:ACCENT }}>4b · Недельный план (нагрузка)</div>
          <div style={{ display:'flex', gap:4, alignItems:'center' }}>
            {(['strength','hypertrophy','rehab'] as const).map(g=>{ const on=weekGoal===g; const ru = g==='strength'?'Сила': g==='hypertrophy'?'Масса':'Реабилитация'; return <button key={g} onClick={()=>setWeekGoal(g)} style={{ padding:'3px 7px', borderRadius:6, cursor:'pointer', fontSize:9, border: on?'1px solid #00e68a':'1px solid rgba(255,255,255,0.1)', background: on?'rgba(0,230,138,0.15)':'transparent', color: on?'#00e68a':DIM}}>{ru}</button>; })}
            <span style={{ fontSize:9, color:'#fff', marginLeft:6 }}>Сессий:</span>
            <div style={{ display:'flex', gap:3 }}>
              {[2,3,4,5,6].map(n=>{ const on=weeklySessions===n; return <button key={n} onClick={()=>setWeeklySessions(n)} style={{ minWidth:26, padding:'3px 6px', borderRadius:6, cursor:'pointer', fontSize:9, fontWeight:700, border: on?'1px solid #00e68a':'1px solid rgba(255,255,255,0.1)', background: on?'rgba(0,230,138,0.15)':'transparent', color: on?'#00e68a':DIM }}>{n}</button>; })}
            </div>
          </div>
        </div>
        <div style={{ fontSize:10, color:'#fff', marginTop:4 }}>Фаза: <b style={{color:ACCENT}}>{PHASE_RU[diag.phase] || diag.phase}</b> · Риск: {weekPlan.warnings.join(' · ') || 'нет'} · Тяжёлых дней: {weekPlan.hardDays} · Сессий: {weeklySessions} · Синхр. с движком ✓</div>
        <div style={{ fontSize:9, color:'#fff', marginTop:2 }}>Равномерное распределение — тренировки разнесены по неделе, без 4-дневного блока подряд. Объём синхронизирован с риском (high −40%).</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, marginTop:6 }}>
          {weekPlan.weekPlan.map(d=>(
            <div key={d.day} style={{ padding:'6px 4px', borderRadius:6, background: d.difficulty==='hard'?'rgba(239,68,68,0.12)': d.difficulty==='medium'?'rgba(251,191,36,0.12)': d.difficulty==='light'?'rgba(56,189,248,0.12)': d.difficulty==='rehab'?'rgba(167,139,250,0.12)':'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', textAlign:'center' }}>
              <div style={{ fontSize:8, color:'#fff' }}>Д{d.day}</div>
              <div style={{ fontSize:9, fontWeight:700, color:'#fff' }}>{d.difficulty==='off'?'—':`О${d.volumeTarget}`}</div>
              <div style={{ fontSize:8, color:'#fff' }}>{DIFF_RU[d.difficulty] || d.focus}</div>
              <div style={{ fontSize:7, color:'#fff' }}>{d.intensityTarget ? `${Math.round(d.intensityTarget*100)}%` : ''}</div>
            </div>
          ))}
        </div>
        <button onClick={()=>{
          const hard = weekPlan.hardDays;
          applyToPlanner({ kind:'pri', label:`Ортопедия неделя: ${weeklySessions} сесс., ${hard} тяж.`, data:{ volumeMult: hard>=4?0.85:0.9, rirShift: 0 } as any });
        }} style={{ marginTop:8, width:'100%', minHeight:32, border:'none', borderRadius:8, cursor:'pointer', background:'#00e68a', color:'#000', fontWeight:800, fontSize:10 }}>🛠 Применить недельный план к планировщику</button>
      </div>

      {/* 5 видео гид для сустава */}
      <div style={{ marginTop:8 }}>
        <VideoCaptureCard lift={lift as Lift} />
      </div>

      {/* 0 ИСИ — встроен сразу */}
      <div style={{ marginTop:12, padding:8, borderRadius:10, background:'rgba(244,63,94,0.06)', border:'1px solid rgba(244,63,94,0.18)' }}>
        <div style={{ fontSize:11, fontWeight:800, color:'#f43f5e' }}>0 · ИСИ — тепловая карта износа сустава (ввод → карта)</div>
        <div style={{ fontSize:10, color:'#fff', marginTop:2 }}>Вес × объём × темп × геометрия × фарма × боль → персональный индекс по каждому суставу + тюнинг + нутрицевтики. Часть единого инструмента, переключение не нужно.</div>
      </div>
      <JointJsiCalculatorCard />
      </>)}
    </div>
  );
};

export default JointMasterCard;
