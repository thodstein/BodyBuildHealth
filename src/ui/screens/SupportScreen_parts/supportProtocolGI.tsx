// @ts-nocheck
import React, { useState } from 'react';
import { cardBg, pillActive, pillInactive, PhaseLabel, ItemRow, ItemRowTriage, triageBadge, phaseBadge, renderRow, renderPhase, timingBlock, monitoringBlock } from './supportProtocolsShared';
import { InfoErrorBoundary } from './SupportScreenData';

export const SupportProtocolGI: React.FC<{ s: Record<string, any> }> = ({ s }) => {
  const [giTab, setGiTab] = useState('protocol');
  return (
          <InfoErrorBoundary label="ЖКТ">
            <div style={{ paddingBottom: 30, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={cardBg}>
                <div style={{ fontSize:13, fontWeight:800, color:'#a3e635', marginBottom:2 }}>🫀 ЖКТ — защита слизистой и микробиома</div>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Профилактика гастропатии, дисбактериоза и синдрома дырявого кишечника на курсе ААС.</p>
              </div>

              {/* Sub-tabs */}
              <div style={{ display:'flex', gap:4, overflowX:'auto', scrollbarWidth:'none' }}>
                {[
                  { id:'mechanisms', label:'🔬 Механизмы' },
                  { id:'protocol', label:'💊 Фазы протокола' },
                  { id:'timing', label:'⏰ Тайминг' },
                  { id:'monitoring', label:'🧪 Мониторинг' },
                ].map((t: any) => (
                  <button key={t.id} onClick={() => setGiTab(t.id)}
                    style={giTab === t.id ? pillActive('#a3e635') : pillInactive()}>{t.label}</button>
                ))}
              </div>

              {/* Mechanisms */}
              {giTab === 'mechanisms' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>🔬 Механизмы поражения ЖКТ на ААС</div>
                  {[{ m:'Гастропатия от НПВС', e:'НПВС (диклофенак, ибупрофен) ингибируют ЦОГ-1 → ↓ простагландинов → ↓ защитной слизи → язва/эрозии' },
                    { m:'Нарушение микробиома', e:'Оральные ААС (метандростенолон, станозолол) → дисбактериоз → ↓ diversity → ↑ проницаемость кишечника' },
                    { m:'Холестаз / застой желчи', e:'17α-алкилы → ↓ секреции желчи → ↓ эмульгации жиров → стеаторея → дефицит жирорастворимых витаминов' },
                    { m:'Синдром дырявого кишечника (leaky gut)', e:'ААС → ↑ зонулина → ↑ проницаемость → ЛПС → системное воспаление → цитокиновый шторм' },
                  ].map((x, i) => (
                    <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(163,230,53,0.04)', border:'1px solid rgba(163,230,53,0.08)' }}>
                      <div style={{ fontSize:9, fontWeight:700, color:'#bef264', marginBottom:2 }}>{x.m}</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)' }}>{x.e}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Protocol phases */}
              {giTab === 'protocol' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {[
                    { phase:'ФАЗА 1 · ПРОФИЛАКТИКА', label:'Нет симптомов', color:'#22c55e', condition:'Нет диспепсии, стул нормальный', desc:'Поддержка ЖКТ на курсе',
                      items:[
                        { name:'Пробиотики (Lacto+Bifido+пребиотик)', dose:'1 капс', timing:'Утро натощак', note:'Поддержка diversity микробиома. Не менее 10⁹ КОЕ. 8+ штаммов' },
                        { name:'Цинк-карнозин', dose:'75 мг', timing:'2×/день за 20-30 мин до еды', note:'Защита слизистой желудка. Фиксация на язвах. Принимать ДО еды (не между)' },
                        { name:'DGL (деглицирризированный лакричник)', dose:'1-2 таб', timing:'До еды', note:'Увеличивает защитную слизь желудка. Без глицирризина (↓ АД)' },
                      ]},
                    { phase:'ФАЗА 2 · ДИСПЕПСИЯ', label:'Тяжесть, изжога, вздутие', color:'#f59e0b', condition:'Эпизодическая изжога, тяжесть', desc:'Симптоматическая терапия',
                      items:[
                        { name:'ИПП (омепразол 20 мг / пантопразол 40 мг) 💊', dose:'20-40 мг', timing:'Утро за 30 мин до еды', note:'Блокада протонной помпы. Курс 4-8 нед. ⚠ >8 нед — контроль B12, Mg²⁺, Fe сыворотки (риск дефицитов). По назначению врача' },
                        { name:'Алгедрат+Магния гидроксид (Маалокс)', dose:'1-2 таб', timing:'После еды и на ночь', note:'Антацид. Быстрое снятие изжоги. НЕ одновременно с ИПП — интервал 2 ч' },
                        { name:'Урсодезоксихолевая кислота (УДХК) 500 мг', dose:'500 мг', timing:'На ночь', note:'При холестазе (оральные ААС). Защита гепатоцитов + ↓ стеатореи' },
                      ]},
                    { phase:'ФАЗА 3 · ДИСБАКТЕРИОЗ', label:'Диарея/запор / вздутие ≥2 нед', color:'#f97316', condition:'Диарея/запор, метеоризм', desc:'Коррекция микробиома',
                      items:[
                        { name:'Пробиотики (усиленная формула)', dose:'2 капс', timing:'Утро натощак + вечер', note:'20+ штаммов, 10⁹ КОЕ. Saccharomyces boulardii для профилактики диареи' },
                        { name:'Бутират (масляная кислота)', dose:'300-600 мг', timing:'2×/день с едой', note:'Пища для колоноцитов. Восстановление барьерной функции кишечника' },
                        { name:'Энтеросгель / Полисорб', dose:'1 ст.л.', timing:'За 1-2 ч до еды', note:'Сорбент. При диарее — 3-5 дней. НЕ вместе с едой/лекарствами' },
                        { name:'Глютамин 5-10 г', dose:'5 г', timing:'2×/день между едой', note:'Аминокислота для энтероцитов. Восстанавливает tight junctions → ↓ leaky gut' },
                      ]},
                    { phase:'ФАЗА 4 · ЛЕЧЕБНАЯ (синдром Мэлори-Вейса / язва)', label:'Кровь/мелена / сильная боль', color:'#ef4444', condition:'Мелена, рвота кофейной гущей', desc:'Неотложная. Исключить алкоголь, НПВС, оральные 17α-алкилы до заживления',
                      items:[
                        { name:'ИПП в/в (омепрозол 40 мг) 💊', dose:'40-80 мг', timing:'В/в болюс', note:'Неотложно. Только в стационаре под контролем ФГДС. По назначению врача' },
                        { name:'ФГДС с гемостазом', dose:'—', timing:'Срочно', note:'Эндоскопический гемостаз (клипирование/коагуляция). При активном кровотечении' },
                        { name:'Суктральфат (алсукрал)', dose:'1 г', timing:'За 30 мин до еды', note:'Гастропротектор. Образует плёнку на язве. НЕ одновременно с едой/препаратами' },
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

              {/* Timing */}
              {giTab === 'timing' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>⏰ Суточный тайминг поддержки ЖКТ</div>
                  <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Пробиотики утром натощак, ИПП за 30 мин до завтрака, вечером — сорбенты отдельно.</p>
                  {[
                    { time:'🌅 Утро (06:00–09:00)', color:'#f59e0b', items:[
                      { n:'ИПП (омепразол 20 мг) 💊', why:'За 30-60 мин до завтрака. Макс. ингибирование протонной помпы на целый день' },
                      { n:'Пробиотики 1-2 капс', why:'Натощак. Без контакта с едой — лучшая выживаемость бактерий' },
                      { n:'Цинк-карнозин 75 мг', why:'За 20-30 мин до еды. Защитная плёнка на слизистой' },
                    ]},
                    { time:'☀️ День (12:00–16:00)', color:'#f97316', items:[
                      { n:'Бутират 300 мг с обедом', why:'С едой. Масляная кислота для колоноцитов' },
                      { n:'DGL 1-2 таб до еды', why:'Защитная слизь. Безопасен при длительном приёме' },
                    ]},
                    { time:'🌙 Вечер (19:00–22:00)', color:'#6366f1', items:[
                      { n:'УДХК 500 мг на ночь', why:'Натощак перед сном. Макс. холеретический эффект' },
                      { n:'Глютамин 5-10 г', why:'Между едой. Восстановление энтероцитов' },
                      { n:'Сорбенты (при диарее)', why:'За 1-2 ч до/после еды. Отдельно от лекарств' },
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

              {/* Monitoring */}
              {giTab === 'monitoring' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>🧪 Лабораторный мониторинг ЖКТ</div>
                    {[{ marker:'ФГДС (гастроскопия)', target:'Норма', when:'До курса + при симптомах', action:'Эрозии/язва — фаза 4. Helicobacter pylori — эрадикация' },
                      { marker:'Кальпротектин фекальный', target:'{'<'}50 мкг/г', when:'При подозрении на ВЗК', action:'{'>'}50 — воспаление кишечника. Колоноскопия' },
                      { marker:'Зонулин фекальный', target:'{'<'}50 нг/мг', when:'При leaky gut', action:'{'>'}50 — повышенная проницаемость. Глютамин + бутират' },
                      { marker:'Витамин B12', target:'200-900 пг/мл', when:'Ежегодно при длительном ИПП', action:'ИПП {'>'}6 мес → контроль B12. При дефиците — метилкобаламин' },
                      { marker:'Магний (Mg²⁺)', target:'0.85-1.2 ммоль/л', when:'Ежегодно при длительном ИПП', action:'ИПП {'>'}1 год → риск гипомагниемии. Магния цитрат' },
                    ].map((m: any, i: any) =>(
                      <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(163,230,53,0.04)', border:'1px solid rgba(163,230,53,0.08)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                          <span style={{ fontSize:9, fontWeight:700, color:'#bef264' }}>{m.marker}</span>
                          <span style={{ fontSize:8, fontWeight:600, color:'#a3e635' }}>{m.when}</span>
                        </div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:4 }}><b style={{color:'#bef264'}}>Цель: {m.target}</b></div>
                        <div style={{ fontSize:7, color:'#bef264', lineHeight:1.3, padding:'4px 6px', borderRadius:4, background:'rgba(163,230,53,0.06)' }}>💡 {m.action}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Cross-protocol warnings */}
            <div style={{ borderRadius:12, padding:12, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#f59e0b', marginBottom:4 }}>🔗 Перекрёстные предупреждения</div>
              <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.5 }}>
                • ❤️ <b>Кардио:</b> ИПП + клопидогрель = ↓ эффекта клопидогреля (CYP2C19). Рассмотреть пантопразол вместо омепразола<br/>
                • 🫁 <b>Печень:</b> УДХК + 17α-алкилы = синергия. УДХК снижает холестаз от токсичных метаболитов<br/>
                • 💧 <b>Почки:</b> ИПП {'>'}3 года → риск ХБП. Контроль креатинина каждые 6-12 мес<br/>
                • 🩸 <b>Гематология:</b> Пробиотики + иммуносупрессия = риск бактериемии (редко). Не для пациентов с ЦВК
              </div>
            </div>

          </InfoErrorBoundary>
  );
};
