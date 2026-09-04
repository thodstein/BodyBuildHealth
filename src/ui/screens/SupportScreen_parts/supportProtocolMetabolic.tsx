// @ts-nocheck
import React, { useState } from 'react';
import { cardBg, pillActive, pillInactive, PhaseLabel, ItemRow, ItemRowTriage, triageBadge, phaseBadge, renderRow, renderPhase, timingBlock, monitoringBlock, StopBanner, RX_NOTE, ContraBanner } from './supportProtocolsShared';
import { InfoErrorBoundary } from './SupportScreenData';

export const SupportProtocolMetabolic: React.FC<{ s: Record<string, any> }> = ({ s }) => {
  const [metabolicTab, setMetabolicTab] = useState('protocol');
  return (
          <InfoErrorBoundary label="Метаболизм">
            <div className="sup-proto-metabolic" style={{ paddingBottom: 30, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={cardBg}>
                <div style={{ fontSize:13, fontWeight:800, color:'#a855f7', marginBottom:2 }}>⚖️ Метаболическая поддержка</div>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Контроль дислипидемии, инсулинорезистентности, электролитных нарушений. ААС-индуцированные метаболические изменения.</p>
              </div>

              <ContraBanner items={[
                'Метформин при СКФ <30 — отменить (риск лактат-ацидоза); <45 — снизить',
                'Красный рис + статин — двойная доза монаколина К → миопатия/рабдомиолиз',
                'Берберин + гипогликемические — риск тяжёлой гипогликемии',
                'Эплеренон без контроля K⁺ — гиперкалиемия >5.0',
              ]} />

              <StopBanner title="Критические метаболические пороги — показание к остановке/коррекции курса" thresholds={[
                'Глюкоза >7.0 ммоль/л или HbA1c >6.5% — эндокринолог (СД 2 типа)',
                'Калий >5.0 ммоль/л при эплереноне/РААС-блокаде — гиперкалиемия, отмена препарата',
                'Мочевая кислота >420 мкмоль/л + суставной приступ — подагра',
                'Магний <0.75 / Калий <3.5 ммоль/л — риск аритмий, срочная коррекция',
              ]} />

              {/* Sub-tabs */}
              <div style={{ display:'flex', gap:4, overflowX:'auto', scrollbarWidth:'none' }}>
                {[
                  { id:'mechanisms', label:'🔬 Механизмы' },
                  { id:'protocol', label:'💊 Фазы протокола' },
                  { id:'timing', label:'⏰ Тайминг' },
                  { id:'monitoring', label:'🧪 Мониторинг' },
                ].map((t: any) => (
                  <button key={t.id} onClick={() => setMetabolicTab(t.id)}
                    style={metabolicTab === t.id ? pillActive('#a855f7') : pillInactive()}>{t.label}</button>
                ))}
              </div>

              {/* Mechanisms */}
              {metabolicTab === 'mechanisms' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>🔬 Метаболические механизмы ААС</div>
                  {[{ m:'Дислипидемия', e:'ААС снижают ЛПВП на 20-50% (особенно оральные 17α-алкилы), повышают ЛПНП на 10-20%, ↑ ЛП(а). Основной драйвер атеросклероза на курсе' },
                    { m:'Инсулинорезистентность', e:'ААС ↓ чувствительность тканей к инсулину (особенно оксандролон, метандростенолон). ↑ риск СД 2 типа при длительных курсах' },
                    { m:'Электролитные нарушения', e:'Задержка Na⁺ (ароматизируемые ААС → эстрадиол → ↑ альдостерон), потеря K⁺, Mg²⁺. Риск гипокалиемии и аритмий' },
                    { m:'Липогенез и ожирение', e:'ААС ↑ липолиз в жировой ткани (через β-адренорецепторы), но ↓ чувствительность к инсулину в жировой ткани → ↑ свободных жирных кислот' },
                  ].map((x, i) => (
                    <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(168,85,247,0.04)', border:'1px solid rgba(168,85,247,0.08)' }}>
                      <div style={{ fontSize:9, fontWeight:700, color:'#d8b4fe', marginBottom:2 }}>{x.m}</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)' }}>{x.e}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Protocol phases */}
              {metabolicTab === 'protocol' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {[
                    { phase:'ФАЗА 1 · ПРОФИЛАКТИКА', label:'Липиды + глюкоза — норма', color:'#22c55e', condition:'ЛПНП {'<'}130, ЛПВП {'>'}40, глюкоза {'<'}5.6', desc:'Поддержка метаболического здоровья на курсе',
                      items:[
                        { name:'Омега-3 (EPA+DHA)', dose:'2-4 г/день', timing:'С едой', note:'↓ ЛПНП, ↓ триглицеридов, ↑ ЛПВП. Базовая метаболическая поддержка' },
                        { name:'Берберин 500 мг', dose:'500 мг', timing:'2×/день до еды', note:'Активатор AMPK → ↓ инсулинорезистентности, ↓ глюкозы, ↓ липидов' },
                        { name:'Магний (цитрат/глицинат)', dose:'400-600 мг', timing:'Вечер', note:'↓ АД, ↓ риск аритмий, улучшение чувствительности к инсулину' },
                        { name:'Калий (калия цитрат)', dose:'500-1000 мг', timing:'С едой', note:'Восполнение потерь K⁺. Контроль K⁺ при терапии эплереноном (селективный MR-антагонист)' },
                      ]},
                    { phase:'ФАЗА 2 · КОРРЕКЦИЯ ДИСЛИПИДЕМИИ', label:'ЛПНП 130-160 / ЛПВП {'<'}35', color:'#f59e0b', condition:'ЛПНП 130-160, ЛПВП {'<'}35', desc:'Целенаправленная коррекция липидного профиля',
                      items:[
                        { name:'Эзетимиб 10 мг 💊', dose:'10 мг', timing:'Утро', note:'Ингибитор всасывания холестерина в тонком кишечнике. ↓ ЛПНП на 15-20%. Не влияет на ЛПВП. Только по назначению врача' + RX_NOTE },
                        { name:'Красный рис (монаколин K) 1200-2400 мг (≈10 мг монаколина К)', dose:'1200-2400 мг', timing:'Вечер', note:'Ингибитор HMG-CoA редуктазы (природный статин). ↓ ЛПНП на 20-30%. Контроль АЛТ/АСТ' },
                        { name:'Берберин 500 мг', dose:'500 мг', timing:'2×/день', note:'↓ ЛПНП ещё на 15-20% дополнительно к эзетимибу' },
                      ]},
                    { phase:'ФАЗА 3 · КОРРЕКЦИЯ ИР/ГЛЮКОЗЫ', label:'Глюкоза 5.6-7.0 / HOMA-IR {'>'}2.5', color:'#f97316', condition:'Глюкоза {'>'}5.6 или HOMA-IR {'>'}2.5', desc:'Снижение инсулинорезистентности (особенно на оксандролоне/метандростенолоне)',
                      items:[
                        { name:'Метформин 500-1000 мг 💊', dose:'500 мг', timing:'2×/день с едой', note:'Снижает продукцию глюкозы печенью. ↑ чувствительность к инсулину. ↓ риска СД 2 типа. Рецептурный препарат — только по назначению врача' + RX_NOTE },
                        { name:'Берберин 500 мг', dose:'500 мг', timing:'2×/день', note:'Синергия с метформином через AMPK. ↓ гликированного гемоглобина на 0.5-1%' },
                        { name:'Хром (пиколинат)', dose:'200-400 мкг', timing:'Утро', note:'Усиливает действие инсулина. ↓ тягу к углеводам' },
                        { name:'Магний 400 мг', dose:'400 мг', timing:'Вечер', note:'Дефицит Mg²⁺ — независимый фактор ИР. Восполнение улучшает гликемию' },
                      ]},
                    { phase:'ФАЗА 4 · КОРРЕКЦИЯ ЭЛЕКТРОЛИТОВ', label:'K⁺/Mg²⁺ низкие / отёки', color:'#ef4444', condition:'K⁺ {'<'}3.5 / Mg²⁺ {'<'}0.75 / отёки 2+', desc:'Восстановление водно-электролитного баланса',
                      items:[
                        { name:'Калия цитрат 500-1500 мг', dose:'500-1500 мг', timing:'2-3×/день с едой', note:'Целевой K⁺ 4.0-5.0. Контроль K⁺ каждые 1-2 нед при терапии' },
                        { name:'Магния цитрат 400-600 мг', dose:'400-600 мг', timing:'Вечер', note:'Целевой Mg²⁺ {'>'}0.85. Магний ↓ риск аритмий' },
                        { name:'Калий + магний (аспарагинат)', dose:'1-2 таб', timing:'2×/день', note:'Комбинированный препарат. Лучшая биодоступность' },
                        { name:'Эплеренон (селективный антагонист MR) 💊', dose:'25-50 мг', timing:'Утро', note:'Селективный антагонист минералокортикоидных рецепторов. Снижает задержку Na⁺/H₂O. Сохраняет K⁺. БЕЗ антиандрогенного действия (в отличие от спиронолактона). Контроль K⁺!' },
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
              {metabolicTab === 'timing' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>⏰ Суточный тайминг метаболической поддержки</div>
                  <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Антигипертензивные утром, метформин с едой, вечером — восстановление электролитов.</p>
                  {[
                    { time:'🌅 Утро (06:00–09:00)', color:'#f59e0b', items:[
                      { n:'Эзетимиб 10 мг (фаза 2)', why:'Утром. Ингибитор всасывания холестерина' },
                      { n:'Хром 200-400 мкг', why:'Утром натощак. Усиление действия инсулина' },
                      { n:'Омега-3 2-4 г', why:'С завтраком. Липидная поддержка' },
                    ]},
                    { time:'☀️ День (12:00–16:00)', color:'#f97316', items:[
                      { n:'Метформин 500 мг с обедом', why:'С едой. Снижение постпрандиальной глюкозы' },
                      { n:'Берберин 500 мг до обеда', why:'За 30 мин до еды. AMPK-активация. ↓ глюкозы на 20-30%' },
                    ]},
                    { time:'🌙 Вечер (19:00–22:00)', color:'#6366f1', items:[
                      { n:'Метформин 500 мг с ужином', why:'С едой. Вторая доза' },
                      { n:'Магний 400-600 мг', why:'Вечером. Расслабление, ↓ АД, антиаритмический. L-треонат/глицинат — предпочтительные формы' },
                      { n:'Калия цитрат 500-1000 мг', why:'С ужином. Восполнение потерь K⁺' },
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
              {metabolicTab === 'monitoring' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>🧪 Лабораторный мониторинг метаболизма</div>
                    {[{ marker:'Липидный профиль (ЛПНП, ЛПВП, ТГ, ЛП(а))', target:'ЛПНП {'<'}130', when:'Каждые 4-8 нед', action:'ЛПНП {'>'}160 — фаза 2. ТГ {'>'}2.3 — рассмотреть фенофибрат' },
                      { marker:'Глюкоза + HOMA-IR', target:'Глюкоза {'<'}5.6', when:'Каждые 4 нед', action:'{'>'}5.6 — фаза 3. HOMA-IR {'>'}2.5 — метформин' },
                      { marker:'Калий (K⁺)', target:'3.5-5.0 ммоль/л', when:'Каждые 2-4 нед', action:'{'<'}3.5 — калий. {'>'}5.0 — риск гиперкалиемии при эплереноне/РААС-блокаде' },
                      { marker:'Магний (Mg²⁺)', target:'{'>'}0.85 ммоль/л', when:'Каждые 4-8 нед', action:'{'<'}0.75 — фаза 4. Mg риск аритмий' },
                      { marker:'Мочевая кислота', target:'{'<'}420 мкмоль/л', when:'Каждые 8 нед', action:'{'>'}420 — риск подагры. Аллопуринол/фебуксостат' },
                      { marker:'HbA1c (гликированный)', target:'{'<'}6.0%', when:'Каждые 12 нед', action:'{'>'}6.5% — СД 2 типа. Эндокринолог' },
                    ].map((m: any, i: any) =>(
                      <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(168,85,247,0.04)', border:'1px solid rgba(168,85,247,0.08)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                          <span style={{ fontSize:9, fontWeight:700, color:'#d8b4fe' }}>{m.marker}</span>
                          <span style={{ fontSize:8, fontWeight:600, color:'#a855f7' }}>{m.when}</span>
                        </div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:4 }}><b style={{color:'#d8b4fe'}}>Цель: {m.target}</b></div>
                        <div style={{ fontSize:7, color:'#d8b4fe', lineHeight:1.3, padding:'4px 6px', borderRadius:4, background:'rgba(168,85,247,0.06)' }}>💡 {m.action}</div>
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
                • ❤️ <b>Кардио:</b> Эзетимиб + статины = синергия ↓ ЛПНП. Статины увеличивают риск СД — контроль глюкозы<br/>
                • 🫁 <b>Печень:</b> Метформин + 17α-алкилы = риск лактат-ацидоза (очень редко, исключить при АЛТ {'>'}3×). Берберин — безопасная альтернатива<br/>
                • 💧 <b>Почки:</b> Метформин отменить при СКФ {'<'}30. Снизить при {'<'}45<br/>
                 • 🩸 <b>Гематология:</b> Метформин {'>'}2 г/день → риск дефицита B12. Контроль B12 каждые 6-12 мес<br/>
                 • 🍷 <b>Красный дрожжевой рис (RYR):</b> содержит ловастатин-подобный монаколин К. ⚠ Риск миопатии/рабдомиолиза (как и статин). Исключить при КФК {'>'}5× или боли в мышцах. Не сочетать с другими статинами. Контроль КФК каждые 8 нед
               </div>
             </div>

          </InfoErrorBoundary>
  );
};
