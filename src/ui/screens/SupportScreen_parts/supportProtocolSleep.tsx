// @ts-nocheck
import React, { useState } from 'react';
import { cardBg, pillActive, pillInactive, PhaseLabel, ItemRow, ItemRowTriage, triageBadge, phaseBadge, renderRow, renderPhase, timingBlock, monitoringBlock } from './supportProtocolsShared';
import { InfoErrorBoundary } from './SupportScreenData';

export const SupportProtocolSleep: React.FC<{ s: Record<string, any> }> = ({ s }) => {
  const [sleepTab, setSleepTab] = useState('protocol');
  return (
          <InfoErrorBoundary label="Сон">
            <div style={{ paddingBottom: 30, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={cardBg}>
                <div style={{ fontSize:13, fontWeight:800, color:'#8b5cf6', marginBottom:2 }}>💤 Коррекция сна на курсе ААС</div>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Нормализация циркадных ритмов, борьба с бессонницей от стимулирующих ААС и нейротоксичности. Мелатонин, адаптогены, терморегуляция.</p>
              </div>

              <div style={{ display:'flex', gap:4, overflowX:'auto', scrollbarWidth:'none' }}>
                {[
                  { id:'mechanisms', label:'🔬 Механизмы' },
                  { id:'protocol', label:'💊 Фазы протокола' },
                  { id:'timing', label:'⏰ Тайминг' },
                  { id:'monitoring', label:'🧪 Мониторинг' },
                ].map((t: any) => (
                  <button key={t.id} onClick={() => setSleepTab(t.id)}
                    style={sleepTab === t.id ? pillActive('#8b5cf6') : pillInactive()}>{t.label}</button>
                ))}
              </div>

              {sleepTab === 'mechanisms' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>🔬 Механизмы нарушений сна на ААС</div>
                  {[{ m:'↑ Симпатической активности', e:'ААС стимулируют ЦНС через β-адренорецепторы → ↑ норадреналина → ↑ бодрствования, ↓ медленноволнового сна' },
                    { m:'↓ Мелатонина', e:'Высокий кортизол от тренировок + ААС → ↓ пика мелатонина. Нарушение циркадного ритма' },
                    { m:'Термогенез', e:'ААС ↑ базальный метаболизм и термогенез → ↑ температура тела → ↓ качества сна. Оптимум {'<'}18°C' },
                    { m:'Апноэ сна', e:'ААС ↑ мышечную массу шеи → ↑ риск обструктивного апноэ. Высокие дозы AAS + избыточный вес = риск' },
                    { m:'НОР-19 (тренболон)', e:'Тренболон — мощный нейротоксин. ↑ глутаматную эксайтотоксичность → бессонница + кошмары (т.н. трен-сон)' },
                  ].map((x, i) => (
                    <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(139,92,246,0.04)', border:'1px solid rgba(139,92,246,0.08)' }}>
                      <div style={{ fontSize:9, fontWeight:700, color:'#c4b5fd', marginBottom:2 }}>{x.m}</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)' }}>{x.e}</div>
                    </div>
                  ))}
                </div>
              )}

              {sleepTab === 'protocol' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {[
                    { phase:'ФАЗА 1 · ГИГИЕНА СНА', label:'Базовая поддержка', color:'#22c55e', condition:'Лёгкие нарушения, {'<'}30 мин засыпания', desc:'Гигиена сна + базовые добавки',
                      items:[
                        { name:'Мелатонин (пролонгированный)', dose:'2-5 мг', timing:'За 30-60 мин до сна', note:'↓ времени засыпания на 15-30 мин. ↑ REM-фазы. Не применять {'>'}6 мес непрерывно' },
                        { name:'Магний L-треонат / глицинат', dose:'200-400 мг', timing:'За 1 ч до сна', note:'Магний L-треонат проникает через ГЭБ — улучшает качество сна. ↓ кортизола' },
                        { name:'Температура спальни', dose:'18-20°C', timing:'Постоянно', note:'Оптимальная для медленноволнового сна. Использовать кондиционер/вентилятор' },
                        { name:'Экранный детокс', dose:'—', timing:'За 1-2 ч до сна', note:'Синий свет ↓ мелатонин. Использовать режим «тёплый свет» или очки с блокировкой синего' },
                      ]},
                    { phase:'ФАЗА 2 · УМЕРЕННАЯ БЕССОННИЦА', label:'30-60 мин засыпания', color:'#f59e0b', condition:'30-60 мин засыпания, 1-2 пробуждения', desc:'Фармакологическая поддержка',
                      items:[
                        { name:'Апигенин (экстракт ромашки)', dose:'50 мг', timing:'За 30-60 мин до сна', note:'Модулятор ГАМК-A (бензодиазепиновый сайт). Без привыкания. ↓ тревоги' },
                        { name:'Глицин', dose:'3 г', timing:'Под язык за 20-30 мин до сна', note:'Тормозный нейромедиатор. Улучшает качество сна. ↓ времени засыпания' },
                        { name:'L-теанин', dose:'200-400 мг', timing:'За 30-60 мин до сна', note:'↑ альфа-волн (расслабление). ↓ норадреналина. Мягкая седация' },
                        { name:'ГАМК (GABA)', dose:'500-1000 мг', timing:'За 30 мин до сна', note:'ГАМК перорально: биодоступность через ГЭБ <1%. Клиническая эффективность как снотворного не доказана в крупных РКИ. Эффект может быть через блуждающий нерв (недоказано). Mg L-треонат — альтернатива с доказанной ГЭБ-проницаемостью.' },
                      ]},
                    { phase:'ФАЗА 3 · ТЯЖЁЛАЯ БЕССОННИЦА', label:'{'>'}60 мин засыпания', color:'#f97316', condition:'{'>'}60 мин засыпания, {'>'}3 пробуждения/ночь', desc:'Интенсивная терапия сна',
                      items:[
                        { name:'Мелатонин 10 мг пролонг', dose:'5-10 мг', timing:'За 1-2 ч до сна', note:'Высокая доза для тяжёлых случаев. Контроль уровня кортизола!' },
                        { name:'Глицин + L-теанин + магний (комплекс)', dose:'Глицин 3 г + L-теанин 400 мг + Mg 400 мг', timing:'За 30-60 мин до сна', note:'Комбинация трёх седативных. Синергия через разные нейромедиаторные системы' },
                        { name:'Ашваганда (экстракт KSM-66)', dose:'600 мг', timing:'За 30 мин до сна', note:'Адаптоген. ↓ кортизола на 20-30%. Улучшает качество и продолжительность сна' },
                        { name:'Травяной сбор (хмель+валериана+мелисса)', dose:'1 чашка', timing:'За 30 мин до сна', note:'Седативные травы. Не применять {'>'}4 нед — риск привыкания к валериане' },
                      ]},
                    { phase:'ФАЗА 4 · ТРЕБОЛОН/АПНОЭ', label:'Трен-сон / храп', color:'#ef4444', condition:'Кошмары (тренболон) / остановки дыхания', desc:'Специфическая терапия',
                      items:[
                        { name:'Празиозин 2-5 мг 💊', dose:'2-5 мг', timing:'На ночь', note:'α1-блокатор. ↓ кошмаров и ночных пробуждений (особенно на тренболоне). По назначению врача' },
                        { name:'CPAP-терапия (при апноэ)', dose:'По настройкам', timing:'Всю ночь', note:'При апноэ сна (подтверждённом полисомнографией). Снижает сердечно-сосудистый риск' },
                        { name:'Снижение дозы/отмена тренболона', dose:'—', timing:'—', note:'Самая эффективная мера при трен-сне. Замена на нандролон/примоболан' },
                        { name:'Консультация сомнолога', dose:'—', timing:'—', note:'При неэффективности {'>'}4 нед. Полисомнография' },
                      ]},
                  ].map((p: any, i: any) => (
                    <div key={i} style={{ borderRadius:12, background:p.color+'08', border:'1px solid '+p.color+'22', padding:10 }}>
                      <div style={{ fontSize:10, fontWeight:700, color:p.color }}>{p.phase}</div>
                      <div style={{ fontSize:8, fontWeight:600, color:p.color+'aa', marginBottom:2 }}>{p.label}</div>
                      <div style={{ fontSize:7, color:'var(--text-dim)', marginBottom:4 }}>{p.condition}</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:6 }}>{p.desc}</div>
                      {p.items.map((x: any, xi: any) => (
                        <div key={xi} style={{ padding:'5px 6px', borderRadius:6, marginBottom:3, background:'rgba(255,255,255,0.02)' }}>
                          <span style={{ fontSize:8, fontWeight:700, color:'var(--text-light)' }}>{x.name}</span>
                          <span style={{ fontSize:7, color:p.color, marginLeft:4 }}>{x.dose}</span>
                          <span style={{ fontSize:7, color:'var(--text-dim)', marginLeft:4 }}>· {x.timing}</span>
                          <div style={{ fontSize:7, color:'var(--text-dim)', marginTop:1 }}>💡 {x.note}</div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {sleepTab === 'timing' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>⏰ Вечерний тайминг подготовки ко сну</div>
                  <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Соблюдение интервалов: магний за 60 мин, мелатонин за 30-60 мин, экранный детокс за 60-120 мин.</p>
                  {[
                    { time:'🌆 За 2-3 ч до сна', color:'#f59e0b', items:[
                      { n:'Экранный детокс', why:'Синий свет ↓ мелатонин. Чтение книги/аудиокнига' },
                      { n:'Магний L-треонат 200-400 мг', why:'За 2 ч. Проникает через ГЭБ. ↓ кортизола' },
                      { n:'Температура спальни 18-20°C', why:'Кондиционер/вентилятор. Оптимум для сна' },
                    ]},
                    { time:'🌃 За 30-60 мин до сна', color:'#f97316', items:[
                      { n:'Мелатонин 2-10 мг', why:'За 30-60 мин. Пролонг — за 2 ч' },
                      { n:'L-теанин 200-400 мг', why:'↑ альфа-волн расслабления' },
                      { n:'Апигенин 50 мг/Глицин 3 г', why:'ГАМК-эргическая седация. Под язык' },
                      { n:'Ашваганда 600 мг', why:'↓ кортизола на 20-30%' },
                    ]},
                    { time:'🌜 Непосредственно перед сном', color:'#6366f1', items:[
                      { n:'Празиозин 2-5 мг 💊 (при трен-сне)', why:'α1-блокатор. ↓ кошмаров' },
                      { n:'Травяной сбор (хмель+валериана)', why:'Мягкая седация. Чай без кофеина' },
                      { n:'CPAP-маска (при апноэ)', why:'На всю ночь. Проверить герметичность' },
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

              {sleepTab === 'monitoring' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>🧪 Мониторинг сна</div>
                    {[{ marker:'Дневник сна', target:'{'>'}7 ч/ночь, {'<'}30 мин засыпания', when:'Ежедневно', action:'Записывать время засыпания, пробуждения, качество (1-5). Выявлять триггеры' },
                      { marker:'Кортизол (вечерняя слюна)', target:'{'<'}3.0 нмоль/л', when:'При хронической бессоннице', action:'{'>'}3.0 — гиперкортизолемия. Ашваганда, фосфатидилсерин. Снизить объём тренировок' },
                      { marker:'Мелатонин (6-SMT в моче)', target:'{'>'}10 нг/мг креатинина', when:'При подозрении на дефицит', action:'{'<'}10 — дефицит. Мелатонин 2-5 мг за 1 ч до сна' },
                      { marker:'STOP-BANG (скрининг апноэ сна)', target:'{"<"}3 баллов', when:'Однократно (особенно при ИМТ >30, окружности шеи >43 см, АГ)', action:'Оценка: Храп (S) + Дневная усталость (T) + Остановки дыхания во сне (O) + АД >140/90 (P) + ИМТ >35 (B) + Возраст >50 (A) + Окружность шеи >43 см (N) + Пол мужской (G). ≥3 → средний риск. ≥5 → высокий риск → направление на полисомнографию. ИАГ >15 → CPAP обязательно' },
                      { marker:'Полисомнография', target:'N3 {'>'}20%, REM {'>'}20%, ИАГ {'<'}5/ч', when:'При STOP-BANG ≥5 или подозрении на апноэ', action:'ИАГ (индекс апноэ/гипопноэ) 5-15 — лёгкое апноэ. 15-30 — среднее → CPAP обязательно (↓ риска ССЗ на 40%). >30 — тяжёлое → CPAP + консультация сомнолога' },
                    ].map((m: any, i: any) =>(
                      <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(139,92,246,0.04)', border:'1px solid rgba(139,92,246,0.08)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                          <span style={{ fontSize:9, fontWeight:700, color:'#c4b5fd' }}>{m.marker}</span>
                          <span style={{ fontSize:8, fontWeight:600, color:'#8b5cf6' }}>{m.when}</span>
                        </div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:4 }}><b style={{color:'#c4b5fd'}}>Цель: {m.target}</b></div>
                        <div style={{ fontSize:7, color:'#c4b5fd', lineHeight:1.3, padding:'4px 6px', borderRadius:4, background:'rgba(139,92,246,0.06)' }}>💡 {m.action}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ borderRadius:12, padding:12, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#f59e0b', marginBottom:4 }}>🔗 Перекрёстные предупреждения</div>
              <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.5 }}>
                • ❤️ <b>Кардио:</b> Хроническая бессонница → ↑ АД, ↑ риск ССЗ. Коррекция сна — часть кардиопротекции<br/>
                • 🧠 <b>Нейро:</b> Дефицит сна → ↓ когнитивной функции, ↑ нейротоксичности. См. протокол нейропротекции<br/>
                • ⚖️ <b>Метаболизм:</b> Недосып → ↓ лептина, ↑ грелина → ↑ аппетита. Контроль калорий<br/>
                • 💪 <b>Тренировки:</b> {'<'}6 ч сна → ↓ восстановления на 30-50%. Приоритет сна = приоритет прогресса<br/>
                • 🌿 <b>Адаптогены/HPA:</b> Ашвагандха + магний используются в обоих модулях — НЕ суммировать. Mg ≤800 мг/сут суммарно из всех протоколов, ашвагандха ≤600 мг/сут
              </div>
            </div>

          </InfoErrorBoundary>
  );
};
