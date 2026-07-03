// @ts-nocheck
/**
 * SupportProtocols.tsx — извлечено из SupportScreen.tsx
 * Секция: protocols
 */
import React from 'react';
import { FertilityPCTScreen } from '../FertilityPCTScreen';
import { InfoErrorBoundary } from './SupportScreenData';

export const SupportProtocols: React.FC<{ s: Record<string, any> }> = ({ s }) => {
  const {
    protocolTab,
    setProtocolTab,
    neuroTab,
    setNeuroTab,
    neuroSelected,
    setNeuroSelected,
    neuroDoses,
    setNeuroDoses,
    neuroDuration,
    setNeuroDuration,
    neuroAge,
    setNeuroAge,
    courseCompounds,
    uniqueCompounds,
    neuroScore,
    supportStack,
    jointPain,
    setJointPain,
    injuryHistory,
    setInjuryHistory,
    trainLoad,
    setTrainLoad,
    linked,
    goBack
  } = s;

  return (
        <div style={{ padding:'0 0 12px' }}>
          {/* Warning card — важные замечания */}
          <div style={{ borderRadius:12, padding:14, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)', marginBottom:8 }}>
            <h3 style={{ margin:'0 0 6px', fontSize:12, fontWeight:700, color:'#f59e0b' }}>⚠️ Важные замечания</h3>
            <div style={{ margin:0 }}>
              <p style={{ margin:'0 0 4px', fontSize:9, lineHeight:1.3 }}><b>Информация носит ознакомительный характер.</b> Подбор поддержки должен производиться врачом или профильным специалистом с учётом индивидуальных особенностей: возраста, веса, генетических полиморфизмов (MTHFR, COMT, CYP), сопутствующих заболеваний и принимаемых лекарств.</p>
              <p style={{ margin:'0 0 4px', fontSize:9, lineHeight:1.3 }}><b>Без лабораторных данных</b> система использует среднестатистические риски по курсу. Для точного подбора необходимы свежие анализы (не старше 3 месяцев).</p>
              <p style={{ margin:0, fontSize:9, lineHeight:1.3 }}><b>Противопоказания:</b> некоторые вещества несовместимы с определёнными заболеваниями или лекарствами. Если вы принимаете варфарин, антидепрессанты, антипсихотики, антигипертензивные — проконсультируйтесь со специалистом.</p>
            </div>
          </div>
          {/* Unified protocol sub-tab pills (6 protocols — peptides removed) */}
          <div style={{ display:'flex', gap:4, padding:'4px 0 8px', overflowX:'auto', scrollbarWidth:'none' }}>
            {[['pct','ПКТ','#8b5cf6'],['fertility','Фертильность','#ec4899'],['hrt','ГЗТ','#f59e0b'],['neuro','Нейро','#06b6d4'],['joints','Суставы','#22c55e'],['acne','Акне','#ef4444']].map(([id, label, color]: [string, string, string]) => (
              <button key={id} onClick={() => setProtocolTab(id as any)} style={{
                padding:'7px 16px', borderRadius:22, fontSize:12, fontWeight:700, whiteSpace:'nowrap', cursor:'pointer', flexShrink:0,
                background: protocolTab === id ? color : 'var(--bg-secondary)',
                color: protocolTab === id ? '#000' : 'var(--text-dim)',
                border: '1px solid ' + (protocolTab === id ? color : 'var(--border)'),
              }}>{label}</button>
            ))}
          </div>

          {/* Content: PCT / Fertility / HRT → FertilityPCTScreen */}
          {(['pct','fertility','hrt'] as string[]).includes(protocolTab) && (
            <InfoErrorBoundary label="Протоколы ПКТ/Фертильность/HRT">
              <FertilityPCTScreen initialTab={protocolTab === 'pct' ? 'pct-plan' : protocolTab === 'hrt' ? 'hrt' : undefined} restrictToMode={protocolTab as 'pct' | 'fertility' | 'hrt'} />
            </InfoErrorBoundary>
          )}

          {/* Content: Neuro → full enhanced (inline, full-screen level) */}
          {protocolTab === 'neuro' && (<InfoErrorBoundary label="Нейропротекция">
            <div style={{ paddingBottom: 70 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#ec4899', marginBottom:6 }}>🧠 Нейротоксичность ААС</div>
              <p style={{ fontSize:9, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Механизмы нейротоксичности, калькулятор риска и многоуровневый протокол нейропротекции.</p>
              <div style={{ display:'flex', gap:4, marginBottom:8, overflowX:'auto', scrollbarWidth:'none' }}>
                {[
                  { id:'mechanisms', label:'🔬 Симптомы и механизмы' },
                  { id:'support', label:'💊 Протокол' },
                ].map((t: any) => (
                  <button key={t.id} onClick={() => setNeuroTab(t.id as any)} style={{
                    padding:'6px 12px', borderRadius:16, fontSize:9, fontWeight:700, whiteSpace:'nowrap', cursor:'pointer',
                    background: neuroTab === t.id ? '#ec4899' : 'var(--bg-secondary)',
                    color: neuroTab === t.id ? '#000' : 'var(--text-dim)',
                    border: '1px solid ' + (neuroTab === t.id ? '#ec4899' : 'var(--border)'),
                  }}>{t.label}</button>
                ))}
              </div>
              {neuroTab === 'mechanisms' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:12, border:'1px solid var(--border)' }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#ec4899', marginBottom:6 }}>🧠 Фундаментальные механизмы</div>
                    <div style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(236,72,153,0.04)', border:'1px solid rgba(236,72,153,0.12)' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:'#f472b6', marginBottom:2 }}>🔬 Гематоэнцефалический барьер (ГЭБ)</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.4 }}>Стероиды свободно проникают через ГЭБ. При супрафизиологических дозах ААС — нейротоксический каскад через повышение проницаемости (подавление клаудинов-5).</div>
                    </div>
                    <div style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(236,72,153,0.04)', border:'1px solid rgba(236,72,153,0.12)' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:'#f472b6', marginBottom:2 }}>🎯 Андрогенные и эстрогенные рецепторы мозга</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.4 }}>AR-гиперстимуляция → окислительный стресс нейронов. ER-опосредованная нейропротекция утрачена при подавлении ароматазы.</div>
                    </div>
                    <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(236,72,153,0.04)', border:'1px solid rgba(236,72,153,0.12)' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:'#f472b6', marginBottom:2 }}>⚡ Негормональные механизмы</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.4 }}>ГАМК-подавление, NMDA-эксайтотоксичность, митохондриальная дисфункция, BDNF-подавление, ионные каналы Ca²⁺.</div>
                    </div>
                  </div>
                  <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:12, border:'1px solid var(--border)' }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#ec4899', marginBottom:6 }}>🔬 Детальные механизмы</div>
                    {[
                      { title:'ГАМК-ергическая дисфункция', desc:'ААС повышают ГАМК-ергический тормозной тон через нейростероиды → подавление ГнРГ. Дисрегуляция GABA-A вызывает тревожность, депрессию при отмене.' },
                      { title:'Окислительный стресс', desc:'Истощение глутатиона в гиппокампе, перекисное окисление липидов. Супероксид-дисмутаза снижена при нандролоне и станозололе.' },
                      { title:'Нейровоспаление', desc:'Активация микроглии через TLR4 → TNF-α, IL-1β, IL-6. NF-κB путь активирован. Хроническое воспаление в гиппокампе.' },
                      { title:'BDNF подавление', desc:'Нандролон и станозолол снижают BDNF на 30-50%. Нарушение CREB-BDNF-TrkB каскада → атрофия дендритных шипиков.' },
                      { title:'Глутаматная эксайтотоксичность', desc:'ААС повышают глутамат → NMDA-рецепторы → Ca²⁺ influx → митохондриальная дисфункция → апоптоз.' },
                      { title:'Нарушение ГЭБ', desc:'Тренболон накапливается в гиппокампе, повышая проницаемость. Нарушение окклюдина, клаудина-5.' },
                      { title:'Апоптоз нейронов', desc:'Каспаза-3 в CA1/CA3 гиппокампа. Фрагментация ДНК. Сдвиг Bax/Bcl-2 в проапоптотический путь.' },
                      { title:'Дофаминовая система', desc:'Изменение D2-рецепторов в стриатуме → ангедония, агрессия. Мезокортикальный путь нарушен.' },
                    ].map((m: any, i: any) =>(
                      <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:4, background:'rgba(236,72,153,0.03)', border:'1px solid rgba(236,72,153,0.08)' }}>
                        <div style={{ fontSize:9, fontWeight:700, color:'#f472b6', marginBottom:2 }}>{m.title}</div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.4 }}>{m.desc}</div>
                      </div>
                    ))}
                  </div>
                  {/* Classification */}
                  <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:12, border:'1px solid var(--border)' }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#f97316', marginBottom:6 }}>⚠️ Классификация нейротоксичности ААС</div>
                    {[
                      { name:'Тренболон', score:10, color:'#ef4444', desc:'ГЭБ + окисл. стресс + глутамат' },
                      { name:'Нандролон', score:8, color:'#ef4444', desc:'BDNF подавление, нейровоспаление' },
                      { name:'Станозолол', score:7, color:'#f97316', desc:'ГАМК-дисфункция, BDNF ↓' },
                      { name:'Метандиенон', score:6, color:'#f97316', desc:'Эстрогеновая активность' },
                      { name:'Болденон', score:5, color:'#f59e0b', desc:'Гематокрит → гипоксия мозга' },
                      { name:'Тестостерон (>500 мг)', score:4, color:'#f59e0b', desc:'AR-гиперстимуляция' },
                      { name:'Оксандролон', score:3, color:'#22c55e', desc:'Низкая андрогенность' },
                      { name:'Мастерон', score:3, color:'#22c55e', desc:'DHT-нейростероиды' },
                      { name:'Примоболан', score:2, color:'#22c55e', desc:'Мин. нейротоксичность' },
                    ].map((drug: any, i: any) =>(
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                        <span style={{ flex:1, fontSize:8, color:'var(--text-light)' }}>{drug.name}</span>
                        <span style={{ fontSize:7, color:'var(--text-dim)', maxWidth:100, textAlign:'right', lineHeight:1.1 }}>{drug.desc}</span>
                        <span style={{ fontSize:9, fontWeight:800, color:drug.color, width:24, textAlign:'center' }}>{drug.score}</span>
                        <div style={{ width:50, height:3, borderRadius:2, background:'rgba(255,255,255,0.06)', overflow:'hidden' }}>
                          <div style={{ width:drug.score*10+'%', height:'100%', borderRadius:2, background:drug.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Symptoms reference — from old calculator */}
                  <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:10, border:'1px solid var(--border)' }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', marginBottom:6 }}>🩺 Симптомы нейротоксичности</div>
                    <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 6px', lineHeight:1.3 }}>При появлении любых из этих симптомов на курсе ААС — немедленно подключите нейропротекцию (вкладка "Протокол") и рассмотрите снижение доз.</p>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                      {['Депрессия','Тревожность','Агрессия','Нарушение сна','Когнитивное снижение','Потеря памяти','Ангедония','Импульсивность','Спутанность сознания','Эмоц. нестабильность'].map((s: any, i: any) =>(<span key={i} style={{fontSize:8,padding:'4px 8px',borderRadius:10,background:'rgba(239,68,68,0.08)',color:'#fca5a5',border:'1px solid rgba(239,68,68,0.15)'}}>⚠ {s}</span>))}
                    </div>
                  </div>
                  {/* Monitoring — from old calculator */}
                  <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:12, border:'1px solid var(--border)' }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#60a5fa', marginBottom:6 }}>📊 Мониторинг нейротоксичности</div>
                    <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Регулярный лабораторный контроль позволяет выявить нейротоксические изменения на ранней стадии.</p>
                    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                      {[
                        { label:'BDNF (нейротрофический фактор мозга)', desc:'Маркер нейропластичности', target:'> 20 нг/мл' },
                        { label:'Нейропсихологическая оценка', desc:'Тесты памяти, внимания, скорости реакции', target:'Каждые 3-6 мес' },
                        { label:'Кортизол (утренний)', desc:'Гиперкортизолемия усугубляет нейротоксичность', target:'10-20 мкг/дл' },
                        { label:'Пролактин', desc:'Гиперпролактинемия → депрессия, ангедония', target:'< 15 нг/мл' },
                      ].map((m: any, i: any) =>(
                        <div key={i} style={{ padding:'6px 8px', borderRadius:6, background:'rgba(59,130,246,0.04)', border:'1px solid rgba(59,130,246,0.08)' }}>
                          <div style={{ display:'flex', justifyContent:'space-between' }}>
                            <span style={{ fontSize:9, fontWeight:600, color:'var(--text-light)' }}>{m.label}</span>
                            <span style={{ fontSize:8, fontWeight:600, color:'#60a5fa' }}>{m.target}</span>
                          </div>
                          <div style={{ fontSize:8, color:'var(--text-dim)' }}>{m.desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {neuroTab === 'support' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:12, border:'1px solid var(--border)' }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#22c55e', marginBottom:4 }}>💊 Многоуровневая нейропротекция</div>
                    <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Начинайте с ядра, добавляйте уровни по мере повышения риска.</p>
                    {[
                      { tier:'ЯДРО', label:'Обязательно всем на курсе', color:'#22c55e', items:[
                        { name:'NAC', dose:'1200-2400 мг/день', note:'Предшественник глутатиона, защита нейронов от окислительного стресса' },
                        { name:'Omega-3 (EPA+DHA)', dose:'3-5 г/день', note:'Нейропротекция через резолвины, антивоспалительное, поддержка мембран' },
                        { name:'Magnesium L-Threonate', dose:'1000-2000 мг/день', note:'Единственная форма Mg через ГЭБ, NMDA-модуляция' },
                        { name:'Таурин', dose:'2-3 г/день', note:'ГАМК-агонист, осморегуляция нейронов, анти-эксайтотоксичность' },
                        { name:'Глицин', dose:'3 г/день', note:'Тормозной нейромедиатор, улучшение сна, модуляция NMDA' },
                      ]},
                      { tier:'БАЗА', label:'При дозах >500 мг/нед', color:'#f59e0b', items:[
                        { name:'Alpha-Lipoic Acid (ALA)', dose:'600 мг/день', note:'Митохондриальный антиоксидант, регенерирует глутатион и вит.C/E' },
                        { name:'CoQ10 (убихинол)', dose:'200-400 мг/день', note:'ЭТЦ митохондрий, снижение перекисного окисления нейронов' },
                        { name:'Pregnenolone', dose:'10-30 мг/день', note:'Нейростероид, восполняет подавленный синтез, улучшает когницию' },
                        { name:'Агмантин', dose:'1-2 г/день', note:'Модулятор NMDA, NO-донатор, нейропротекция через полиамины' },
                        { name:'Альфа-GPC', dose:'300-600 мг/день', note:'Высокобиодоступный холин, синтез ацетилхолина' },
                      ]},
                      { tier:'УСИЛЕНИЕ', label:'При тренболоне/нандролоне', color:'#f97316', items:[
                        { name:'Lion\'s Mane (ежовик)', dose:'1-3 г/день', note:'Стимуляция NGF, нейрогенез в гиппокампе, миелинизация' },
                        { name:'DHEA', dose:'25-50 мг/день', note:'Нейростероид, восстановление GABA-A модуляции, снижение депрессии' },
                        { name:'Phosphatidylserine', dose:'300-600 мг/день', note:'Фосфолипид мембран, поддержка текучести, снижение кортизола' },
                        { name:'Ginkgo Biloba', dose:'120-240 мг/день', note:'Церебральный кровоток, антиоксидант, ингибитор PAF' },
                        { name:'Бромантан', dose:'50-100 мг/день', note:'Актопротектор, нейропротекция, повышение работоспособности' },
                        { name:'Фасорацетам', dose:'100-200 мг/день', note:'AMPA-модулятор, регуляция глутамата, улучшение памяти' },
                        { name:'Гуперзин А', dose:'50-100 мкг/день', note:'Ингибитор ацетилхолинэстеразы, повышение ацетилхолина' },
                      ]},
                      { tier:'МАКСИМУМ', label:'При нейросимптомах', color:'#ef4444', items:[
                        { name:'Bacopa Monnieri', dose:'300-600 мг/день', note:'Улучшение памяти, дендритное ветвление, антиоксидант' },
                        { name:'L-Theanine', dose:'200-400 мг/день', note:'ГАМК-модуляция, повышение альфа-волн, снижение тревоги' },
                        { name:'Citicoline', dose:'500-1000 мг/день', note:'Цитидин+холин, синтез ацетилхолина, стабилизация мембран' },
                        { name:'Noopept', dose:'10-30 мг/день', note:'Повышение BDNF и NGF, улучшение памяти и когниций' },
                        { name:'Семакс', dose:'1-3 мг/день', note:'Нейропептид, повышение BDNF, нейрогенез, ноотроп' },
                        { name:'Кортексин', dose:'10 мг/день', note:'Полипептиды коры мозга, нейропротекция, нейрорепарация' },
                      ]},
                    ].map((tier: any, ti: any) =>(
                      <div key={ti} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:tier.color+'0a', border:'1px solid '+tier.color+'22' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:4 }}>
                          <span style={{ fontSize:8, fontWeight:800, padding:'1px 6px', borderRadius:4, background:tier.color+'22', color:tier.color }}>{tier.tier}</span>
                          <span style={{ fontSize:9, fontWeight:600, color:'var(--text-light)' }}>{tier.label}</span>
                        </div>
                        {tier.items.map((item: any, ii: any) =>(
                          <div key={ii} style={{ padding:'4px 6px', borderRadius:4, marginBottom:3, background:'rgba(255,255,255,0.02)', border:'1px solid var(--border)' }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                              <span style={{ fontSize:8, fontWeight:600, color:'var(--text-light)' }}>{item.name}</span>
                              <span style={{ fontSize:8, fontWeight:700, color:tier.color }}>{item.dose}</span>
                            </div>
                            <div style={{ fontSize:7, color:'var(--text-dim)', lineHeight:1.3 }}>{item.note}</div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </InfoErrorBoundary>)}

          {/* Content: Joints → full enhanced (inline, full-screen level) */}
          {protocolTab === 'joints' && (<InfoErrorBoundary label="Суставы">
            <div style={{ paddingBottom: 70 }}>
              <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:12, border:'1px solid var(--border)' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#f59e0b', marginBottom:4 }}>🦴 Калькулятор суставов и связок</div>
                <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Оценка риска суставной патологии и многоуровневая поддержка хрящевой и соединительной ткани.</p>
                {/* Risk Inputs */}
                <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:8 }}>
                  <div>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                      <span style={{ fontSize:8, color:'var(--text-dim)' }}>🦵 Боль в суставах</span>
                      <span style={{ fontSize:9, fontWeight:700, color: jointScore<20?'#22c55e':jointScore<40?'#f59e0b':jointScore<60?'#f97316':'#ef4444' }}>{jointPain}/10</span>
                    </div>
                    <input type="range" min="0" max="10" value={jointPain} onChange={e=>setJointPain(Number(e.target.value))} style={{ width:'100%', accentColor:jointScore<20?'#22c55e':jointScore<40?'#f59e0b':jointScore<60?'#f97316':'#ef4444' }} />
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:7, color:'var(--text-dim)' }}><span>Нет боли</span><span>Умеренная</span><span>Сильная</span></div>
                  </div>
                  <div>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                      <span style={{ fontSize:8, color:'var(--text-dim)' }}>🏥 Травмы в анамнезе</span>
                      <span style={{ fontSize:9, fontWeight:700, color: jointScore<20?'#22c55e':jointScore<40?'#f59e0b':jointScore<60?'#f97316':'#ef4444' }}>{injuryHistory}/5</span>
                    </div>
                    <input type="range" min="0" max="5" value={injuryHistory} onChange={e=>setInjuryHistory(Number(e.target.value))} style={{ width:'100%', accentColor:'#f59e0b' }} />
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:7, color:'var(--text-dim)' }}><span>Нет</span><span>Растяжения</span><span>Разрывы</span></div>
                  </div>
                  <div>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                      <span style={{ fontSize:8, color:'var(--text-dim)' }}>🏋️ Тренировочная нагрузка</span>
                      <span style={{ fontSize:9, fontWeight:700, color: jointScore<20?'#22c55e':jointScore<40?'#f59e0b':jointScore<60?'#f97316':'#ef4444' }}>{trainLoad}/5</span>
                    </div>
                    <input type="range" min="0" max="5" value={trainLoad} onChange={e=>setTrainLoad(Number(e.target.value))} style={{ width:'100%', accentColor:'#f97316' }} />
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:7, color:'var(--text-dim)' }}><span>Лёгкая</span><span>Умеренная</span><span>Тяжёлые веса</span></div>
                  </div>
                </div>
                {/* Score */}
                <div style={{ background: (jointScore<20?'#22c55e':jointScore<40?'#f59e0b':jointScore<60?'#f97316':'#ef4444')+'18', borderRadius:12, padding:12, marginBottom:8, border:'2px solid '+(jointScore<20?'#22c55e':jointScore<40?'#f59e0b':jointScore<60?'#f97316':'#ef4444')+'44', textAlign:'center' }}>
                  <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:4 }}>Индекс риска суставов</div>
                  <div style={{ fontSize:32, fontWeight:800, color:jointScore<20?'#22c55e':jointScore<40?'#f59e0b':jointScore<60?'#f97316':'#ef4444', lineHeight:1 }}>{jointScore}</div>
                  <div style={{ fontSize:10, fontWeight:700, color:jointScore<20?'#22c55e':jointScore<40?'#f59e0b':jointScore<60?'#f97316':'#ef4444', marginTop:2 }}>{jointScore<20?'🟢 Норма':jointScore<40?'🟡 Умеренный':jointScore<60?'🟠 Высокий':'🔴 Критический'}</div>
                  <div style={{ marginTop:6, height:4, borderRadius:2, background:'rgba(255,255,255,0.1)', overflow:'hidden' }}>
                    <div style={{ width:jointScore+'%', height:'100%', borderRadius:2, background:'linear-gradient(90deg, #22c55e, #f59e0b 40%, #f97316 60%, #ef4444)', transition:'width 0.5s' }} />
                  </div>
                </div>
                {/* Required Analyses */}
                <div style={{ background:'var(--bg-secondary)', borderRadius:8, padding:8, marginBottom:8, border:'1px solid var(--border)' }}>
                  <div style={{ fontSize:9, fontWeight:700, color:'#60a5fa', marginBottom:4 }}>🧪 Рекомендуемые анализы</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                    {[
                      { name:'Ревматоидный фактор (RF)', range:'< 14 МЕ/мл' },
                      { name:'С-реактивный белок (CRP)', range:'< 3 мг/л' },
                      { name:'Мочевая кислота', range:'200-420 мкмоль/л' },
                      { name:'25-OH Витамин D', range:'50-80 нг/мл' },
                      { name:'Кальций общий', range:'2.15-2.55 ммоль/л' },
                      { name:'Антитела к коллагену II типа', range:'< 20 ЕД/мл' },
                    ].map((a: any, i: any) =>(
                      <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', borderRadius:4, background:'rgba(59,130,246,0.04)', border:'1px solid rgba(59,130,246,0.08)', fontSize:8 }}>
                        <span style={{ color:'var(--text-light)' }}>{a.name}</span>
                        <span style={{ fontWeight:600, color:'#60a5fa' }}>{a.range}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Imaging */}
                <div style={{ background:'var(--bg-secondary)', borderRadius:8, padding:8, marginBottom:8, border:'1px solid var(--border)' }}>
                  <div style={{ fontSize:9, fontWeight:700, color:'#a855f7', marginBottom:4 }}>🔬 Инструментальные исследования</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                    {[
                      { name:'УЗИ суставов (B-режим)', purpose:'Выпот, синовит, эрозии', when:'Боль/отёк ≥2 нед' },
                      { name:'МРТ сустава', purpose:'Хрящ, мениски, связки', when:'Боль >4 нед' },
                      { name:'Рентгенография', purpose:'Суставная щель, остеофиты', when:'Перелом/остеоартрит' },
                    ].map((e: any, i: any) =>(
                      <div key={i} style={{ padding:'4px 6px', borderRadius:4, background:'rgba(168,85,247,0.04)', border:'1px solid rgba(168,85,247,0.08)', fontSize:8 }}>
                        <span style={{ fontWeight:600, color:'#a855f7' }}>{e.name}</span>
                        <span style={{ color:'var(--text-dim)', marginLeft:4 }}>— {e.purpose}</span>
                        <div style={{ fontSize:7, color:'#a855f7', opacity:0.7 }}>Показание: {e.when}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Multi-tier protocol */}
                <div style={{ fontSize:10, fontWeight:700, color:'#22c55e', marginBottom:4 }}>💊 Многоуровневая поддержка суставов</div>
                <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Эскалационный протокол: начните с ядра, добавляйте уровни пропорционально риску.</p>
                {[
                  { tier:'ЯДРО', label:'Обязательный минимум', color:'#22c55e', items:[
                    { name:'Коллаген II типа (UC-II)', dose:'40 мг/день', note:'Нативный неденатурированный коллаген, оральная толерантность' },
                    { name:'Витамин C', dose:'500-1000 мг/день', note:'Кофактор синтеза коллагена, гидроксилирование пролина' },
                    { name:'Витамин D3 + K2', dose:'5000 МЕ + 100 мкг/день', note:'Кальциевый обмен, минерализация костной ткани' },
                  ]},
                  { tier:'БАЗА', label:'При умеренном риске', color:'#f59e0b', items:[
                    { name:'Глюкозамин сульфат', dose:'1500 мг/день', note:'Субстрат гликозаминогликанов, стимуляция протеогликанов' },
                    { name:'Хондроитин сульфат', dose:'800-1200 мг/день', note:'Ингибирование MMP-3/13, удержание воды в матриксе' },
                    { name:'MSM', dose:'2000-3000 мг/день', note:'Органическая сера, дисульфидные мостики коллагена' },
                    { name:'Omega-3 (EPA+DHA)', dose:'3-5 г/день', note:'Резолвины, разрешение воспаления в синовиальной жидкости' },
                  ]},
                  { tier:'УСИЛЕНИЕ', label:'При высоком риске', color:'#f97316', items:[
                    { name:'Гиалуроновая кислота', dose:'200-300 мг/день', note:'Синовиальная жидкость, вязкоэластичность, смазка' },
                    { name:'Куркумин + пиперин', dose:'500-1000 мг/день', note:'Ингибирование COX-2, NF-kB, снижение IL-1beta' },
                    { name:'Босвеллия (AKBA)', dose:'300-500 мг/день', note:'Ингибирование 5-липоксигеназы, снижение лейкотриенов' },
                  ]},
                  { tier:'МАКСИМУМ', label:'При критическом риске', color:'#ef4444', items:[
                    { name:'BPC-157', dose:'250-500 мкг/день', note:'Заживление сухожилий/связок, ангиогенез через VEGF' },
                    { name:'TB-500', dose:'2.5-5 мг/нед', note:'Полимеризация актина, миграция клеток, регенерация' },
                    { name:'Секретагоги ГР', dose:'100-300 мкг/день', note:'Пульсирующая секреция ГР, регенерация хряща' },
                  ]},
                ].map((tier: any, ti: any) =>(
                  <div key={ti} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:tier.color+'0a', border:'1px solid '+tier.color+'22' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:3 }}>
                      <span style={{ fontSize:8, fontWeight:800, padding:'1px 6px', borderRadius:4, background:tier.color+'22', color:tier.color }}>{tier.tier}</span>
                      <span style={{ fontSize:8, fontWeight:600, color:'var(--text-light)' }}>{tier.label}</span>
                    </div>
                    {tier.items.map((item: any, ii: any) =>(
                      <div key={ii} style={{ padding:'4px 6px', borderRadius:4, marginBottom:3, background:'rgba(255,255,255,0.02)', border:'1px solid var(--border)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          <span style={{ fontSize:8, fontWeight:600, color:'var(--text-light)' }}>{item.name}</span>
                          <span style={{ fontSize:8, fontWeight:700, color:tier.color }}>{item.dose}</span>
                        </div>
                        <div style={{ fontSize:7, color:'var(--text-dim)', lineHeight:1.3 }}>{item.note}</div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </InfoErrorBoundary>)}

          {/* Content: Acne → full enhanced (inline, full-screen level) */}
          {protocolTab === 'acne' && (<InfoErrorBoundary label="Акне">
            <div style={{ paddingBottom: 70 }}>
              <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:12, border:'1px solid var(--border)' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', marginBottom:4 }}>🔴 Анти-прыщ протокол</div>
                <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Протокол борьбы с акне на курсе ААС: системная и локальная терапия.</p>
                {/* Daily protocol */}
                <div style={{ fontSize:9, fontWeight:700, color:'var(--text-light)', marginBottom:4 }}>⚙️ Ежедневный протокол</div>
                {[
                  { n:'Ниацинамид (Витамин B3)', d:'500-1000 мг', t:'На ночь', note:'Регулирует себум, антивоспалительное, уменьшает покраснения' },
                  { n:'Медь', d:'1-2 мг', t:'На ночь (отдельно от цинка)', note:'Кофактор лизил-оксидазы, сшивка коллагена. Не смешивать с цинком.' },
                  { n:'Цинк (пиколинат)', d:'50 мг', t:'На ночь', note:'Антивоспалительное, антибактериальное, ингибирует 5-альфа-редуктазу' },
                  { n:'Солярий', d:'2 раза/нед × 5 мин', t:'День', note:'UV-B подсушивает акне. Не более 5 минут.' },
                  { n:'Клендовит гель', d:'Тонкий слой', t:'Утро локально', note:'Клиндамицин+адапален. Только на зону акне.' },
                  { n:'Клензит-С', d:'Тонкий слой', t:'На ночь локально', note:'Адапален (ретиноид) + клиндамицин, открывает комедоны.' },
                  { n:'Верошпирон (Спиронолактон)', d:'50 мг', t:'Утро', note:'Антиандроген. Только при гормональном акне. Контроль калия!' },
                ].map((r: any, i: any) =>(
                  <div key={i} style={{ padding:'6px 8px', borderRadius:6, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.12)', fontSize:9, marginBottom:4 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                      <span style={{ fontWeight:700, color:'var(--text-light)' }}>{r.n}</span>
                      <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                        <span style={{ fontSize:8, fontWeight:700, color:'#ef4444' }}>{r.d}</span>
                        <span style={{ fontSize:7, color:'var(--text-dim)', padding:'1px 5px', borderRadius:4, background:'rgba(255,255,255,0.04)' }}>{r.t}</span>
                      </div>
                    </div>
                    <div style={{ fontSize:7, color:'var(--text-dim)', lineHeight:1.3 }}>{r.note}</div>
                  </div>
                ))}
                {/* Analyses */}
                <div style={{ marginTop:6, padding:'8px', borderRadius:6, background:'rgba(236,72,153,0.04)', border:'1px solid rgba(236,72,153,0.08)' }}>
                  <div style={{ fontSize:9, fontWeight:700, color:'#ec4899', marginBottom:3 }}>🧪 Необходимые анализы крови</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                    {['Тестостерон общий/свободный','DHT','Эстрадиол (E2)','ЛГ/ФСГ','Пролактин','DHEA-S','Кортизол','SHBG','Калий (K+)','Глюкоза/Инсулин/HOMA-IR'].map((a: any, i: any) =>(
                      <span key={i} style={{ fontSize:7, padding:'2px 6px', borderRadius:4, background:'rgba(236,72,153,0.06)', color:'#f472b6', border:'1px solid rgba(236,72,153,0.12)' }}>{a}</span>
                    ))}
                  </div>
                </div>
                {/* Instrumental */}
                <div style={{ marginTop:6, padding:'8px', borderRadius:6, background:'rgba(168,85,247,0.04)', border:'1px solid rgba(168,85,247,0.08)' }}>
                  <div style={{ fontSize:9, fontWeight:700, color:'#a855f7', marginBottom:3 }}>🔬 Инструментальные исследования</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                    {['УЗИ кожи (20-50 МГц)','Себуметрия','Дерматоскопия','Микробиология (C.acnes)'].map((e: any, i: any) =>(
                      <span key={i} style={{ fontSize:7, padding:'2px 6px', borderRadius:4, background:'rgba(168,85,247,0.06)', color:'#c084fc', border:'1px solid rgba(168,85,247,0.12)' }}>{e}</span>
                    ))}
                  </div>
                </div>
                {/* Hygiene */}
                <div style={{ marginTop:6, padding:'8px', borderRadius:6, background:'rgba(59,130,246,0.04)', border:'1px solid rgba(59,130,246,0.12)' }}>
                  <div style={{ fontSize:9, fontWeight:700, color:'#60a5fa', marginBottom:3 }}>🧼 Гигиена и уход</div>
                  <div style={{ fontSize:7, color:'var(--text-dim)', lineHeight:1.4 }}>
                    • Минимум <b style={{color:'#ef4444'}}>1 раз в день</b> тщательное мытьё с очищением пор от себума<br/>
                    • На курсе ААС выработка кожного сала резко возрастает → поры забиваются<br/>
                    • Клензит-С + Клендовит — только локально, не на всё лицо<br/>
                    • При сильном акне — дерматолог, системные ретиноиды (Изотретиноин)
                  </div>
                </div>
                {/* Important */}
                <div style={{ marginTop:6, padding:'8px', borderRadius:6, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.12)' }}>
                  <div style={{ fontSize:9, fontWeight:700, color:'#f59e0b', marginBottom:2 }}>⚠️ Важно</div>
                  <div style={{ fontSize:7, color:'var(--text-dim)', lineHeight:1.4 }}>
                    • При Верошпироне — исключить добавки калия<br/>• Солярий ≤ 2 раза/нед по 5 мин<br/>• Цинк и медь — РАЗДЕЛЬНО (цинк на ночь, медь утром)<br/>• При неэффективности 4-6 нед — дерматолог
                  </div>
                </div>
              </div>
            </div>
          </InfoErrorBoundary>)}
        </div>
  );
};
