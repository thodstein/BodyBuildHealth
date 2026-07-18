// @ts-nocheck
import React, { useState } from 'react';
import { cardBg, pillActive, pillInactive, PhaseLabel, ItemRow, ItemRowTriage, triageBadge, phaseBadge, renderRow, renderPhase, timingBlock, monitoringBlock } from './supportProtocolsShared';
import { InfoErrorBoundary } from './SupportScreenData';

export const SupportProtocolImmune: React.FC<{ s: Record<string, any> }> = ({ s }) => {
  const [immuneTab, setImmuneTab] = useState('protocol');
  return (
          <InfoErrorBoundary label="Иммунитет">
            <div style={{ paddingBottom: 30, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={cardBg}>
                <div style={{ fontSize:13, fontWeight:800, color:'#6366f1', marginBottom:2 }}>🛡️ Иммунная поддержка на курсе ААС</div>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Укрепление иммунитета, профилактика инфекций на фоне иммуносупрессии от высоких доз ААС, коррекция микробиома и L-глутаминового статуса.</p>
              </div>

              <div style={{ display:'flex', gap:4, overflowX:'auto', scrollbarWidth:'none' }}>
                {[
                  { id:'mechanisms', label:'🔬 Механизмы' },
                  { id:'protocol', label:'💊 Фазы протокола' },
                  { id:'timing', label:'⏰ Тайминг' },
                  { id:'monitoring', label:'🧪 Мониторинг' },
                ].map((t: any) => (
                  <button key={t.id} onClick={() => setImmuneTab(t.id)}
                    style={immuneTab === t.id ? pillActive('#6366f1') : pillInactive()}>{t.label}</button>
                ))}
              </div>

              {immuneTab === 'mechanisms' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>🔬 Механизмы иммуносупрессии на ААС</div>
                  {[{ m:'↓ IgA/IgG', e:'Андрогены подавляют продукцию иммуноглобулинов B-клетками. Снижение IgA в слизистых → ↑ риск респираторных инфекций' },
                    { m:'↓ NK-клеток', e:'Тестостерон ↓ активность и число натуральных киллеров (NK). Противоопухолевый и антивирусный иммунитет снижен' },
                    { m:'↓ Т-клеточного ответа', e:'ААС ↑ IL-10 (противовоспалительный) и ↓ IL-2, IFN-γ → ↓ цитотоксических T-лимфоцитов' },
                    { m:'↑ Окислительный стресс', e:'Высокий метаболизм на курсе → ↑ активных форм кислорода → ↓ функции нейтрофилов и макрофагов' },
                    { m:'Дисбиоз кишечника', e:'Оральные 17α-алкилы нарушают микробиом → ↓ diversity → ↑ проницаемость → системное воспаление' },
                  ].map((x, i) => (
                    <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(99,102,241,0.04)', border:'1px solid rgba(99,102,241,0.08)' }}>
                      <div style={{ fontSize:9, fontWeight:700, color:'#a5b4fc', marginBottom:2 }}>{x.m}</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)' }}>{x.e}</div>
                    </div>
                  ))}
                </div>
              )}

              {immuneTab === 'protocol' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {[
                    { phase:'ФАЗА 1 · БАЗОВАЯ', label:'Профилактика', color:'#22c55e', condition:'Нет симптомов, инфекции {'<'}2/год', desc:'Базовая иммуноподдержка на любом курсе',
                      items:[
                        { name:'Витамин D3', dose:'2000-4000 МЕ', timing:'С жирной едой', note:'Модулятор врождённого и адаптивного иммунитета. ↓ риск респираторных инфекций на 40-70%. >4000 МЕ — контроль 25-OH-D и Ca²⁺' },
                        { name:'Цинк (пиколинат)', dose:'30-50 мг', timing:'Вечер', note:'Кофактор тимулина. Дефицит → атрофия тимуса → ↓ T-клеток' },
                        { name:'Витамин C (аскорбат натрия)', dose:'1-2 г', timing:'2×/день', note:'Антиоксидант. ↑ хемотаксис нейтрофилов. ↓ длительности простуд на 8-14%' },
                        { name:'Пробиотики (Lacto+Bifido)', dose:'1 капс', timing:'Утро натощак', note:'Поддержка иммунитета через микробиом. 8+ штаммов, 10⁹ КОЕ' },
                      ]},
                    { phase:'ФАЗА 2 · УСИЛЕННАЯ', label:'Частые инфекции', color:'#f59e0b', condition:'Инфекции {'>'}2/год / вялое заживление', desc:'Целенаправленная иммуномодуляция',
                      items:[
                        { name:'Бета-глюканы (грибные 1,3/1,6)', dose:'250-500 мг', timing:'Утро натощак', note:'Активация макрофагов и NK-клеток через дектин-1. ↑ IgA в слюне' },
                        { name:'Кверцетин', dose:'500 мг', timing:'2×/день', note:'Ингибитор TLR4/NF-kB. ↑ Nrf2. Противовоспалительный + антиоксидантный' },
                        { name:'Лактоферрин', dose:'200-300 мг', timing:'Утро натощак', note:'Хелатор Fe → бактериостатический эффект. ↑ NK-активности' },
                        { name:'Эхинацея пурпурная (Echinacea)', dose:'300-500 мг', timing:'2×/день', note:'↑ фагоцитоз макрофагов. Курс 8-12 нед с перерывом 1 нед' },
                      ]},
                    { phase:'ФАЗА 3 · ТЕРАПЕВТИЧЕСКАЯ', label:'Острая инфекция + курс', color:'#f97316', condition:'ОРВИ/ангина на курсе', desc:'Иммунотерапия + симптоматическая поддержка',
                      items:[
                        { name:'NAC 600 мг', dose:'600 мг', timing:'3×/день на 5-7 дней', note:'Муколитик + антиоксидант. ↓ репликации вирусов in vitro. Разжижает мокроту' },
                        { name:'Витамин C в/в (аскорбат Na) 10-15 г', dose:'10-15 г', timing:'В/в капельно', note:'При пневмонии/тяжёлой инфекции. Противовирусный + антиоксидантный эффект' },
                        { name:'Андрографис (Andrographis paniculata)', dose:'200-400 мг', timing:'3×/день', note:'Растительный иммуномодулятор. ↓ длительности ОРВИ на 3-5 дней. ↓ IL-6' },
                        { name:'Цинк 50 мг + лозенги с цинком (25 мг)', dose:'75-100 мг/сут', timing:'Каждые 3-4 ч', note:'Лозенги — при боли в горле. ↓ длительности симптомов на 33%' },
                      ]},
                    { phase:'ФАЗА 4 · ПОСТ-ИНФЕКЦИОННАЯ', label:'Восстановление', color:'#ef4444', condition:'После инфекции / затяжной COVID', desc:'Восстановление иммунного ответа и энергии',
                      items:[
                        { name:'Креатин + D-рибоза', dose:'Креатин 5 г + рибоза 5 г', timing:'После тренировки', note:'Восстановление энергетического пула клеток. ↓ утомляемости' },
                        { name:'КоА Q10 (убихинон)', dose:'200-400 мг', timing:'Утро с жирной едой', note:'Митохондриальная поддержка. ↑ энергии. Антиоксидант' },
                        { name:'Адаптогены (родиола/элеутерококк)', dose:'Родиола 200-400 мг', timing:'Утро', note:'Адаптогены. ↑ сопротивляемости стрессу. ↓ усталости' },
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

              {immuneTab === 'timing' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>⏰ Суточный тайминг иммуноподдержки</div>
                  <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Пробиотики натощак, витамин D с жирной едой, цинк на ночь. Адаптогены утром.</p>
                  {[
                    { time:'🌅 Утро (06:00–09:00)', color:'#f59e0b', items:[
                      { n:'Пробиотики 1 капс', why:'Натощак. Макс. выживаемость бактерий' },
                      { n:'Бета-глюканы 250-500 мг (фаза 2)', why:'Натощак. Активация макрофагов' },
                      { n:'Витамин C 1-2 г', why:'С завтраком. Антиоксидант + иммуномодулятор' },
                      { n:'Адаптоген (родиола 200-400 мг)', why:'Утром. Энергия + стресс-устойчивость' },
                    ]},
                    { time:'☀️ День (12:00–16:00)', color:'#f97316', items:[
                      { n:'Кверцетин 500 мг', why:'С обедом. Ингибитор TLR4/NF-kB' },
                      { n:'Витамин D3 2000-4000 МЕ', why:'С жирной едой. Макс. абсорбция. Контроль 25-OH-D' },
                      { n:'Эхинацея 300-500 мг (фаза 2+)', why:'С едой. ↑ фагоцитоз' },
                    ]},
                    { time:'🌙 Вечер (19:00–22:00)', color:'#6366f1', items:[
                      { n:'Цинк 30-50 мг', why:'На ночь. Иммуномодулятор + антиоксидант' },
                      { n:'NAC 600 мг (при инфекции)', why:'Вечером. Муколитик + антиоксидант' },
                      { n:'Андрографис 200-400 мг (при инфекции)', why:'С ужином. ↓ IL-6, ↓ длительности ОРВИ' },
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

              {immuneTab === 'monitoring' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>🧪 Лабораторный мониторинг иммунитета</div>
                    {[{ marker:'IgA, IgG, IgM', target:'IgA 0.7-4.0, IgG 7-16, IgM 0.4-2.3 г/л', when:'Каждые 12-24 нед', action:'IgA {'<'}0.7 — риск инфекций слизистых. IgG {'<'}7 — гипогаммаглобулинемия' },
                      { marker:'Лейкоциты + лимфоциты', target:'Лейк. 4-9 ×10⁹, лимф. 1.0-4.0', when:'Каждые 4-8 нед', action:'Лимф. {'<'}1.0 — лимфопения на фоне ААС. Поддержка иммунитета' },
                      { marker:'СРБ (CRP высокочувствительный)', target:'{'<'}1 мг/л', when:'Каждые 8-12 нед', action:'СРБ {'>'}3 — системное воспаление. Кверцетин, куркумин, NAC' },
                      { marker:'Витамин D (25-OH)', target:'75-150 нмоль/л', when:'Каждые 12-24 нед', action:'{'<'}50 — дефицит. Коррекция D3 5000-10000 МЕ/день 4-8 нед' },
                      { marker:'Цинк в сыворотке', target:'0.75-1.5 мкг/мл', when:'Каждые 12 нед', action:'{'<'}0.75 — дефицит → ↓ функции тимуса. Цинк 50 мг/день' },
                      { marker:'Ферритин', target:'30-150 нг/мл', when:'Каждые 12 нед', action:'{'<'}30 — дефицит Fe → ↓ T-клеточного ответа. Коррекция железа' },
                    ].map((m: any, i: any) =>(
                      <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(99,102,241,0.04)', border:'1px solid rgba(99,102,241,0.08)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                          <span style={{ fontSize:9, fontWeight:700, color:'#a5b4fc' }}>{m.marker}</span>
                          <span style={{ fontSize:8, fontWeight:600, color:'#6366f1' }}>{m.when}</span>
                        </div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:4 }}><b style={{color:'#a5b4fc'}}>Цель: {m.target}</b></div>
                        <div style={{ fontSize:7, color:'#a5b4fc', lineHeight:1.3, padding:'4px 6px', borderRadius:4, background:'rgba(99,102,241,0.06)' }}>💡 {m.action}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ borderRadius:12, padding:12, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#f59e0b', marginBottom:4 }}>🔗 Перекрёстные предупреждения</div>
              <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.5 }}>
                • 🫁 <b>Печень:</b> Высокие дозы витамина D3 — контроль АЛТ/АСТ при жировом гепатозе<br/>
                • 💧 <b>Почки:</b> Эхинацея противопоказана при аутоиммунных заболеваниях (СКВ, ревматоидный артрит)<br/>
                • 🫀 <b>ЖКТ:</b> Пробиотики + иммуносупрессия (кортикостероиды) — редкий риск бактериемии. Не для пациентов с ЦВК<br/>
                • 🧠 <b>Нейро:</b> NAC {'>'}2400 мг/сут → головная боль, тошнота<br/>
                • ⚠ <b>Кросс-модульные лимиты:</b> Zn ≤50 мг/сут суммарно (Акне+Волосы+Иммунитет). NAC ≤3000 мг/сут суммарно (Детокс+Иммунитет+Печень). D3 ≤4000 МЕ/сут (все модули)
              </div>
            </div>

          </InfoErrorBoundary>
  );
};
