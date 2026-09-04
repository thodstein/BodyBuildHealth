// @ts-nocheck
import React, { useState } from 'react';
import { cardBg, pillActive, pillInactive, PhaseLabel, ItemRow, ItemRowTriage, triageBadge, phaseBadge, renderRow, renderPhase, timingBlock, monitoringBlock } from './supportProtocolsShared';
import { InfoErrorBoundary } from './SupportScreenData';

export const SupportProtocolJoints: React.FC<{ s: Record<string, any> }> = ({ s }) => {
  const [jointTab, setJointTab] = useState('protocol');
  const { jointPain = 0, setJointPain, injuryHistory = 0, setInjuryHistory, trainLoad = 0, setTrainLoad } = s;
  const jointScore = Math.min(100, Math.round(jointPain * 10 + injuryHistory * 5 + trainLoad * 3));
  return (
          <InfoErrorBoundary label="Суставы">
            <div className="sup-proto-joints" style={{ paddingBottom: 30, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={cardBg}>
                <div style={{ fontSize:13, fontWeight:800, color:'#22c55e', marginBottom:2 }}>🦴 Калькулятор суставов и связок</div>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Оценка риска суставной патологии и фазовый протокол поддержки хрящевой и соединительной ткани.</p>
              </div>

              {/* Sub-tabs */}
              <div style={{ display:'flex', gap:4, overflowX:'auto', scrollbarWidth:'none' }}>
                {[
                  { id:'calculator', label:'📊 Калькулятор' },
                  { id:'protocol', label:'💊 Фазы протокола' },
                  { id:'timing', label:'⏰ Тайминг приёма' },
                  { id:'monitoring', label:'🧪 Мониторинг' },
                  { id:'diary', label:'📓 Дневник боли' },
                ].map((t: any) => (
                  <button key={t.id} onClick={() => setJointTab(t.id)}
                    style={jointTab === t.id ? pillActive('#22c55e') : pillInactive()}>{t.label}</button>
                ))}
              </div>

              {/* Calculator */}
              {jointTab === 'calculator' && (
              <div style={cardBg}>
                <div style={{ fontSize:11, fontWeight:700, color:'#f59e0b', marginBottom:6 }}>📊 Параметры риска</div>
                <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:8 }}>
                  {[
                    { label:'🦵 Боль в суставах', val:jointPain, max:10, set:setJointPain, labels:['Нет боли','Умеренная','Сильная'] },
                    { label:'🏥 Травмы в анамнезе', val:injuryHistory, max:5, set:setInjuryHistory, labels:['Нет','Растяжения','Разрывы'] },
                    { label:'🏋️ Тренировочная нагрузка', val:trainLoad, max:5, set:setTrainLoad, labels:['Лёгкая','Умеренная','Тяжёлые веса'] },
                  ].map((r: any, i: any) =>(
                    <div key={i}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                        <span style={{ fontSize:9, color:'var(--text-dim)' }}>{r.label}</span>
                        <span style={{ fontSize:9, fontWeight:700, color: jointScore<20?'#22c55e':jointScore<40?'#f59e0b':jointScore<60?'#f97316':'#ef4444' }}>{r.val}/{r.max}</span>
                      </div>
                      <input type="range" min="0" max={r.max} value={r.val} onChange={e => r.set(Number(e.target.value))} style={{ width:'100%', accentColor:jointScore<20?'#22c55e':jointScore<40?'#f59e0b':jointScore<60?'#f97316':'#ef4444' }} />
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:7, color:'var(--text-dim)' }}>{r.labels.map((l:any,li:any)=><span key={li}>{l}</span>)}</div>
                    </div>
                  ))}
                </div>
                {/* Score */}
                <div style={{ background: (jointScore<20?'#22c55e':jointScore<40?'#f59e0b':jointScore<60?'#f97316':'#ef4444')+'18', borderRadius:14, padding:14, border:'2px solid '+(jointScore<20?'#22c55e':jointScore<40?'#f59e0b':jointScore<60?'#f97316':'#ef4444')+'44', textAlign:'center' }}>
                  <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:4 }}>Индекс риска суставов</div>
                  <div style={{ fontSize:36, fontWeight:800, color:jointScore<20?'#22c55e':jointScore<40?'#f59e0b':jointScore<60?'#f97316':'#ef4444', lineHeight:1 }}>{jointScore}</div>
                  <div style={{ fontSize:10, fontWeight:700, color:jointScore<20?'#22c55e':jointScore<40?'#f59e0b':jointScore<60?'#f97316':'#ef4444', marginTop:4 }}>
                    {jointScore<20?'🟢 Норма — профилактика':jointScore<40?'🟡 Умеренный — базовая поддержка':jointScore<60?'🟠 Высокий — усиленная защита':'🔴 Критический — максимальная защита'}
                  </div>
                  <div style={{ marginTop:6, height:5, borderRadius:3, background:'rgba(255,255,255,0.1)', overflow:'hidden' }}>
                    <div style={{ width:jointScore+'%', height:'100%', borderRadius:3, background:'linear-gradient(90deg, #22c55e, #f59e0b 40%, #f97316 60%, #ef4444)', transition:'width 0.5s' }} />
                  </div>
                </div>
              </div>
              )}

              {/* Protocol phases */}
              {jointTab === 'protocol' && (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {[
                  {
                    phase:'ФАЗА 1 · ЯДРО', label:'Обязательный минимум (профилактика)', color:'#22c55e',
                    condition:'Условие: любой уровень физической нагрузки',
                    desc:'Структурная основа хряща и кости. Без этого уровня восстановление хрящевой ткани невозможно.',
                    items:[
                      { name:'Коллаген II типа (UC-II)', dose:'40 мг', timing:'Утро натощак', note:'Нативный неденатурированный коллаген. Оральная толерантность. Доказанное снижение боли на 33%' },
                      { name:'Витамин C', dose:'500-1000 мг', timing:'С едой', note:'Кофактор пролил- и лизил-гидроксилазы. Без вит.C синтез коллагена останавливается. Буферный приём 2×/день' },
                      { name:'Витамин D3 + K2', dose:'2000-4000 МЕ + 100 мкг', timing:'С жирной едой', note:'Кальциевый обмен. D3 → абсорбция Ca²⁺. K2 → активация остеокальцина → Ca²⁺ в кости, не в сосуды. Контроль 25-OH-D и Ca²⁺' },
                      { name:'Желатин гидролизованный', dose:'10-15 г', timing:'Натощак / за 1 ч до тренировки', note:'Субстрат коллагена: глицин + пролин + гидроксипролин. + вит.C за 1 ч до нагрузки → синтез коллагена x2' },
                    ]
                  },
                  {
                    phase:'ФАЗА 2 · БАЗА', label:'При умеренном риске (JointScore 20-40)', color:'#f59e0b',
                    condition:'Условие: JointScore ≥20 ИЛИ возраст >30 лет',
                    desc:'Субстраты для синтеза хрящевого матрикса. Противовоспалительный компонент.',
                    items:[
                      { name:'Глюкозамин сульфат', dose:'1500 мг', timing:'С едой', note:'Субстрат гликозаминогликанов. Стимуляция протеогликанов хондроцитами. Только сульфатная форма работает' },
                      { name:'Хондроитин сульфат', dose:'800-1200 мг', timing:'С едой', note:'Ингибирование MMP-3/MMP-13. Удержание воды в матриксе хряща. Мол. масса 14-20 кДа' },
                      { name:'MSM', dose:'2000-3000 мг', timing:'Утро', note:'Органическая сера (34%). Дисульфидные мостики коллагена. Снижение боли на 25-40%' },
                      { name:'Omega-3 (EPA+DHA)', dose:'3-5 г', timing:'С едой', note:'Резолвины и протектины → разрешение воспаления в синовиальной жидкости. EPA >2 г' },
                      { name:'Марганец', dose:'5-10 мг', timing:'С едой (отдельно от Ca/Fe)', note:'Кофактор гликозилтрансфераз → синтез ГАГ. Необходим для сшивки коллагеновых волокон' },
                    ]
                  },
                  {
                    phase:'ФАЗА 3 · УСИЛЕНИЕ', label:'При высоком риске (JointScore 40-60)', color:'#f97316',
                    condition:'Условие: JointScore ≥40 ИЛИ боли ≥4/10',
                    desc:'Таргетная противовоспалительная терапия. Синовиальная защита.',
                    items:[
                      { name:'Гиалуроновая кислота', dose:'200-300 мг', timing:'Утро натощак', note:'Компонент синовиальной жидкости. Вязкоэластичность сустава. Пероральная форма — системный эффект' },
                      { name:'Куркумин + пиперин', dose:'500-1000 мг', timing:'С едой', note:'Ингибирование COX-2 = ибупрофену. NF-kB подавление. IL-1β снижение. Пиперин +2000%' },
                      { name:'Босвеллия (AKBA ≥30%)', dose:'300-500 мг', timing:'С едой', note:'Ингибирование 5-LOX → снижение лейкотриенов. Стандартизованный экстракт AKBA 10-20% — 100-200 мг (нестандарт — 500 мг). Боль на 40-50% при ОА' },
                      { name:'Кремний (монометанол-силанол)', dose:'10-20 мг', timing:'Утро', note:'Сшивка коллагена и эластина. Стабилизация ГАГ. Необходим для прочности соединительной ткани' },
                    ]
                  },
                  {
                    phase:'ФАЗА 4 · МАКСИМУМ', label:'При критическом риске (JointScore ≥60)', color:'#ef4444',
                    condition:'Условие: JointScore ≥60 ИЛИ боли ≥7/10',
                    desc:'Пептидная регенерация. Реальный ремонт повреждённых тканей (не только симптоматика).',
                    items:[
                       { name:'BPC-157 ⚠', dose:'250-500 мкг', timing:'Утро + Вечер', note:'Пентадекапептид. Заживление сухожилий и связок. ⚠ Только стерильные условия: разводить БАКТЕРИОСТАТИЧЕСКОЙ водой (не питьевой!). Иглы/шприцы СТЕРИЛЬНЫЕ. Риск сепсиса при нарушении асептики. Хранить при 2-8°C. После разведения — не более 7-14 дней. Не встряхивать — пузырьки денатурируют пептид. ⚠ Исследовательский пептид — не одобрен FDA/EMA к клиническому применению, контроль качества производителя' },
                       { name:'TB-500 (Thymosin β4) ⚠', dose:'2.5-5 мг', timing:'2×/нед', note:'Полимеризация G-актина. ⚠ Только стерильные условия: БАКТЕРИОСТАТИЧЕСКАЯ вода. СТЕРИЛЬНЫЕ иглы/шприцы. Риск абсцесса/сепсиса при несоблюдении асептики. Хранить при 2-8°C. После разведения — 7-14 дней. Регенерация тканей, антивоспалительное. ⚠ Исследовательский пептид — не одобрен FDA/EMA к клиническому применению' },
                      { name:'Секретагоги ГР ⚠', dose:'100-300 мкг', timing:'На ночь натощак', note:'Грелин-миметики. Пульсирующая секреция ГР → IGF-1 → синтез коллагена хондроцитами. ⚠ Исследовательские пептиды — не одобрены к клиническому применению' },
                      { name:'Кальций + Бор', dose:'500 мг + 3 мг', timing:'Вечер', note:'Ca — минерализация кости. Бор — удлиняет t½ витамина D и E2 (меньше боли)' },
                    ]
                  },
                ].map((phase: any, pi: any) =>(
                  <div key={pi} style={{ ...cardBg, background:phase.color+'08', border:'1px solid '+phase.color+'22' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:6 }}>
                      <span style={{ fontSize:9, fontWeight:800, padding:'2px 8px', borderRadius:4, background:phase.color+'22', color:phase.color }}>{phase.phase}</span>
                      <span style={{ fontSize:10, fontWeight:600, color:phase.color, flex:1 }}>{phase.label}</span>
                    </div>
                    <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:6, lineHeight:1.4, padding:'6px 8px', borderRadius:6, background:'rgba(0,0,0,0.2)' }}>
                      <b style={{color:phase.color}}>{phase.condition}</b> — {phase.desc}
                    </div>
                    {phase.items.map((item: any, ii: any) =>(
                      <ItemRow key={ii} name={item.name} dose={item.dose} timing={item.timing} note={item.note} color={phase.color} />
                    ))}
                  </div>
                ))}
              </div>
              )}

              {/* Timing */}
              {jointTab === 'timing' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#22c55e', marginBottom:6 }}>⏰ Суточный тайминг поддержки суставов</div>
                  <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Коллагеновые субстраты — натощак (нет конкуренции с белком). Противовоспалительные — с едой.</p>
                  {[
                    { time:'🌅 Утро натощак (06:00–08:00)', color:'#22c55e', items:[
                      { n:'UC-II 40 мг + Желатин 10-15 г + вит.C 500 мг', why:'За 30-60 мин ДО завтрака (или за 1 ч до тренировки). Коллагеновые субстраты не конкурируют с пищевым белком' },
                      { n:'Гиалуроновая кислота 200 мг', why:'Натощак — лучшая абсорбция. Высокомолекулярная ГК — системный эффект' },
                      { n:'MSM 2000-3000 мг', why:'Натощак — сера быстро всасывается. Делить дозу при ЖКТ-дискомфорте' },
                    ]},
                    { time:'☀️ День (12:00–15:00)', color:'#f59e0b', items:[
                      { n:'Глюкозамин 1500 мг + Хондроитин 800 мг с обедом', why:'С обедом, содержащим жиры. Абсорбция глюкозамина высокая (90%). Делить при ЖКТ-дискомфорте' },
                      { n:'Куркумин 500 мг + Босвеллия 300 мг', why:'С жирной пищей. Жирорастворимые. Пиперин для куркумина. Пик действия через 2-4 ч' },
                      { n:'Omega-3 3 г', why:'С обедом/ужином (жиры). EPA/DHA — макс. абсорбция с жирами. Резолвины в синовиальной жидкости' },
                    ]},
                    { time:'🌙 Вечер (19:00–22:00)', color:'#6366f1', items:[
                      { n:'Кальций 500 мг + Бор 3 мг + K2 100 мкг', why:'Ночная минерализация костной ткани. Остеобласты наиболее активны ночью' },
                      { n:'BPC-157 250 мкг', why:'На ночь натощак. Пик регенерации тканей — ночью. Пептидная стимуляция ангиогенеза' },
                      { n:'Марганец 5-10 мг', why:'Ночной синтез ГАГ. Отдельно от кальция (конкуренция за всасывание)' },
                    ]},
                  ].map((slot: any, si: any) =>(
                    <div key={si} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:slot.color+'0a', border:'1px solid '+slot.color+'22' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:slot.color, marginBottom:4 }}>{slot.time}</div>
                      {slot.items.map((x: any, xi: any) =>(
                        <div key={xi} style={{ padding:'5px 6px', borderRadius:4, marginBottom:3, background:'rgba(255,255,255,0.02)' }}>
                          <span style={{ fontSize:8, fontWeight:600, color:'var(--text-light)' }}>{x.n}</span>
                          <span style={{ fontSize:7, color:'var(--text-dim)', marginLeft:6 }}>— {x.why}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* Lab monitoring */}
              {jointTab === 'monitoring' && (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#60a5fa', marginBottom:6 }}>🧪 Лабораторный мониторинг суставов</div>
                  {[
                    { m:'Ревматоидный фактор (RF)', t:'< 14 МЕ/мл', w:'Каждые 12 нед' },
                    { m:'С-реактивный белок (hs-CRP)', t:'< 1 мг/л', w:'Каждые 4-8 нед' },
                    { m:'Мочевая кислота', t:'200-420 мкмоль/л', w:'Каждые 8 нед' },
                    { m:'25-OH Витамин D', t:'50-80 нг/мл', w:'Каждые 12 нед' },
                    { m:'Кальций общий + ионизированный', t:'2.15-2.55 ммоль/л', w:'Каждые 12 нед' },
                    { m:'Антитела к коллагену II типа', t:'< 20 ЕД/мл', w:'При подозрении на РА' },
                    { m:'СОЭ', t:'< 15 мм/ч', w:'Каждые 8 нед' },
                  ].map((a: any, i: any) =>(
                    <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'6px 8px', borderRadius:4, marginBottom:3, background:'rgba(59,130,246,0.04)', border:'1px solid rgba(59,130,246,0.08)', fontSize:8 }}>
                      <span style={{ color:'var(--text-light)' }}>{a.m}</span>
                      <span style={{ fontWeight:600, color:'#60a5fa' }}>{a.t} · {a.w}</span>
                    </div>
                  ))}
                </div>

                {/* Imaging */}
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#a855f7', marginBottom:6 }}>🔬 Инструментальная диагностика</div>
                  {[
                    { name:'УЗИ суставов (B-режим + допплер)', purpose:'Выпот, синовит, эрозии, гиперваскуляризация', when:'Боль/отёк ≥2 нед' },
                    { name:'МРТ сустава (1.5/3 Тесла)', purpose:'Хрящ (T2-mapping), мениски, связки, субхондральная кость', when:'Боль >4 нед или подозрение на разрыв' },
                    { name:'Рентгенография', purpose:'Суставная щель (JSN), остеофиты, субхондральный склероз', when:'Подозрение на ОА, перелом' },
                    { name:'Артроскопия', purpose:'Прямая визуализация хряща, биопсия', when:'Неясный диагноз, неэффективность 6 мес терапии' },
                  ].map((e: any, i: any) =>(
                    <div key={i} style={{ padding:'6px 8px', borderRadius:4, marginBottom:4, background:'rgba(168,85,247,0.04)', border:'1px solid rgba(168,85,247,0.08)', fontSize:8 }}>
                      <div style={{ fontWeight:600, color:'#c084fc' }}>{e.name}</div>
                      <div style={{ color:'var(--text-dim)' }}>{e.purpose}</div>
                      <div style={{ fontSize:7, color:'#a855f7', opacity:0.7 }}>Показание: {e.when}</div>
                    </div>
                  ))}
                </div>
              </div>
              )}

              {/* Pain diary */}
              {jointTab === 'diary' && (
              <div style={cardBg}>
                <div style={{ fontSize:11, fontWeight:700, color:'#22c55e', marginBottom:6 }}>📓 Дневник боли (визуально-аналоговая шкала)</div>
                <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Заполняйте ежедневно. Отмечайте локализацию и интенсивность. При боли ≥6/10 — не тренируйте эту область.</p>
                {['Плечи','Локти','Запястья','Поясница','ТБС','Колени','Голеностоп'].map((zone: any, i: any) =>(
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ fontSize:9, fontWeight:600, color:'var(--text-light)', width:90 }}>{zone}</span>
                    <div style={{ flex:1, display:'flex', gap:3 }}>
                      {[0,1,2,3,4,5,6,7,8,9,10].map((v: any) =>(
                        <span key={v} style={{ width:18, height:18, borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center', fontSize:7, fontWeight:v===0?400:700, cursor:'pointer',
                          background: v<=2?'rgba(34,197,94,0.15)':v<=4?'rgba(245,158,11,0.15)':v<=7?'rgba(249,115,22,0.15)':'rgba(239,68,68,0.15)',
                          color: v<=2?'#22c55e':v<=4?'#f59e0b':v<=7?'#f97316':'#ef4444', border:'1px solid rgba(255,255,255,0.06)'
                        }}>{v}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              )}
            </div>
          </InfoErrorBoundary>
  );
};
