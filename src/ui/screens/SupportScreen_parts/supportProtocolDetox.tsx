// @ts-nocheck
import React, { useState } from 'react';
import { cardBg, pillActive, pillInactive, PhaseLabel, ItemRow, ItemRowTriage, triageBadge, phaseBadge, renderRow, renderPhase, timingBlock, monitoringBlock } from './supportProtocolsShared';
import { InfoErrorBoundary } from './SupportScreenData';

export const SupportProtocolDetox: React.FC<{ s: Record<string, any> }> = ({ s }) => {
  const [detoxTab, setDetoxTab] = useState('protocol');
  return (
          <InfoErrorBoundary label="Детокс">
            <div style={{ paddingBottom: 30, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={cardBg}>
                <div style={{ fontSize:13, fontWeight:800, color:'#22d3ee', marginBottom:2 }}>🧬 Детоксикация на курсе ААС</div>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Поддержка фаз I/II детоксикации печени, элиминация ксенобиотиков и токсичных метаболитов ААС, хелатирование тяжёлых металлов.</p>
              </div>

              <div style={{ display:'flex', gap:4, overflowX:'auto', scrollbarWidth:'none' }}>
                {[
                  { id:'mechanisms', label:'🔬 Механизмы' },
                  { id:'protocol', label:'💊 Фазы протокола' },
                  { id:'timing', label:'⏰ Тайминг' },
                  { id:'monitoring', label:'🧪 Мониторинг' },
                ].map((t: any) => (
                  <button key={t.id} onClick={() => setDetoxTab(t.id)}
                    style={detoxTab === t.id ? pillActive('#22d3ee') : pillInactive()}>{t.label}</button>
                ))}
              </div>

              {detoxTab === 'mechanisms' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>🔬 Пути детоксикации</div>
                  {[{ m:'Фаза I (CYP450)', e:'CYP3A4 метаболизирует большинство ААС (особенно 17α-алкилы). ↑ нагрузки на CYP → ↑ свободных радикалов — требуется антиоксидантная защита' },
                    { m:'Фаза II (конъюгация)', e:'Глутатион-S-трансферазы (GST), UDP-глюкуронилтрансферазы (UGT) конъюгируют токсичные метаболиты → экскреция. Требуются кофакторы: глицин, глюкуроновая к-та, сульфат' },
                    { m:'Метилирование', e:'COMT метилирует катехол-эстрогены (2-OH, 4-OH → нетоксичные метокси). Дефицит МТНFR → ↑ риск токсичности эстрогенов' },
                    { m:'Антиоксидантная сеть', e:'Глутатион (GSH) — главный антиоксидант. NAC — лимитирующий субстрат синтеза GSH. АЛК регенерирует GSH из окисленной формы' },
                    { m:'Экскреция (желчь/моча)', e:'Конъюгированные метаболиты экскретируются через желчь (энтерогепатическая рециркуляция) и мочу. Стимуляция желчеоттока — TUDCA, УДХК' },
                  ].map((x, i) => (
                    <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(34,211,238,0.04)', border:'1px solid rgba(34,211,238,0.08)' }}>
                      <div style={{ fontSize:9, fontWeight:700, color:'#67e8f9', marginBottom:2 }}>{x.m}</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)' }}>{x.e}</div>
                    </div>
                  ))}
                </div>
              )}

              {detoxTab === 'protocol' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {[
                    { phase:'ФАЗА 1 · БАЗОВАЯ ДЕТОКСИКАЦИЯ', label:'NAC + АЛК + TUDCA', color:'#22c55e', condition:'Нормальные АЛТ/АСТ, нет оральных 17α-алкилов', desc:'Базовая поддержка детоксикации на любом курсе',
                      items:[
                        { name:'NAC (N-ацетилцистеин)', dose:'600-1200 мг', timing:'2×/день (утро/вечер)', note:'Предшественник глутатиона. Лимитирующий субстрат синтеза GSH. Связывает активные метаболиты токсинов' },
                        { name:'Альфа-липоевая кислота (АЛК)', dose:'300-600 мг', timing:'Утро', note:'Активатор Nrf2/ARE. ↑ фазу II детоксикации. Регенерирует GSH и витамины C/E. Хелатор тяжёлых металлов' },
                        { name:'TUDCA (тауроурсодезоксихолевая)', dose:'500-1000 мг', timing:'На ночь', note:'Снижает ER-стресс, улучшает желчеотток, защищает гепатоциты от токсических метаболитов' },
                        { name:'Гидратация', dose:'2.5-3.5 л/день', timing:'Равномерно', note:'Поддержка почечной экскреции конъюгированных метаболитов' },
                      ]},
                    { phase:'ФАЗА 2 · УСИЛЕННАЯ (17α-алкилы)', label:'NAC ×2 + TUDCA + силимарин', color:'#f59e0b', condition:'Оральные 17α-алкилы (метандростенолон, станозолол, оксиметолон)', desc:'Усиленная детоксикация при токсичных ААС',
                      items:[
                        { name:'NAC 1200 мг', dose:'1200 мг', timing:'2×/день (2400 мг/сут)', note:'Удвоенная доза для связывания токсичных метаболитов 17α-алкилов. Макс. 3000 мг/сут' },
                        { name:'Силимарин (экстракт расторопши)', dose:'280-560 мг', timing:'2×/день', note:'Стабилизирует мембраны гепатоцитов. ↑ РНК-полимеразу I. ↓ перекисного окисления липидов' },
                        { name:'TUDCA 1000 мг', dose:'1000 мг', timing:'На ночь', note:'Полная доза. Защита от ER-стресса, индуцированного 17α-алкилами' },
                        { name:'АЛК 600 мг', dose:'600 мг', timing:'2×/день', note:'Удвоенная доза для активации Nrf2. ↑ GST, NQO1 (фаза II)' },
                        { name:'Силимарин + TUDCA', dose:'Синергия', timing:'—', note:'Два независимых механизма: мембранная стабилизация + ↓ ER-стресса. Аддитивная защита' },
                      ]},
                    { phase:'ФАЗА 3 · МЕТИЛИРОВАНИЕ', label:'COMT + MTHFR', color:'#f97316', condition:'MTHFR C677T / дефицит метилирования', desc:'Поддержка метилирования (COMT, MTHFR)',
                      items:[
                        { name:'S-аденозилметионин (SAM-e)', dose:'400-800 мг', timing:'Утро натощак', note:'Главный донор метильных групп. Поддержка COMT. ↑ настроения, ↓ токсичности катехол-эстрогенов' },
                        { name:'ТМГ (триметилглицин, бетаин)', dose:'500-1000 мг', timing:'С едой', note:'Донор метильных групп для реметилирования гомоцистеина. Альтернатива SAM-e' },
                        { name:'Метилфолат (5-МТГФ) 400-800 мкг', dose:'400-800 мкг', timing:'Утро', note:'Активная форма фолата. Для MTHFR-мутантов. Поддержка синтеза SAM-e' },
                        { name:'Метилкобаламин (B12) 1000-5000 мкг', dose:'1000-5000 мкг', timing:'Под язык', note:'Кофактор метионин-синтазы. Синергия с метилфолатом' },
                      ]},
                    { phase:'ФАЗА 4 · ХЕЛАТИРОВАНИЕ', label:'Тяжёлые металлы', color:'#ef4444', condition:'Высокий уровень Hg/Pb/Cd / перегрузка Fe', desc:'Хелатирование и элиминация тяжёлых металлов',
                      items:[
                        { name:'Хлорелла (Chlorella vulgaris)', dose:'3-5 г', timing:'2×/день до еды', note:'Связывает Hg, Pb, Cd в кишечнике. ↓ реабсорбции. Курс 4-8 нед' },
                        { name:'NAC 1200 мг', dose:'1200 мг', timing:'2×/день', note:'Хелатор переходных металлов (Cu, Hg, Pb). ↑ экскреции с мочой' },
                        { name:'АЛК 600 мг', dose:'600 мг', timing:'2×/день', note:'Хелатор переходных металлов (Fe, Cu). Проходит ГЭБ — хелатирует Hg в мозге' },
                        { name:'Кордицепс (Cordyceps sinensis)', dose:'1-3 г', timing:'Утро', note:'↑ экскреции токсинов через почки. Адаптоген + иммуномодулятор' },
                        { name:'Кинза (cilantro) — экстракт', dose:'30-50 капель', timing:'2×/день', note:'Связывает Hg в межклеточном пространстве — мобилизует из депо' },
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

              {detoxTab === 'timing' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>⏰ Суточный тайминг детокса</div>
                  <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>NAC и АЛК натощак или с едой (при чувствительном ЖКТ). TUDCA строго натощак перед сном. Силимарин с едой.</p>
                  {[
                    { time:'🌅 Утро (06:00–09:00)', color:'#f59e0b', items:[
                      { n:'NAC 600-1200 мг', why:'Натощак за 1 ч до еды. Макс. абсорбция' },
                      { n:'АЛК 300-600 мг', why:'С завтраком. Активатор Nrf2' },
                      { n:'SAM-e 400-800 мг', why:'Натощак. Донор метильных групп' },
                      { n:'Метилфолат + метилкобаламин', why:'С завтраком. Поддержка метилирования' },
                    ]},
                    { time:'☀️ День (12:00–16:00)', color:'#f97316', items:[
                      { n:'Силимарин 280 мг', why:'С обедом. Стабилизация мембран гепатоцитов' },
                      { n:'Хлорелла 3-5 г', why:'До еды. Связывание токсинов в кишечнике' },
                      { n:'ТМГ 500-1000 мг', why:'С едой. Дополнительный донор метильных групп' },
                      { n:'Гидратация 1-1.5 л', why:'Равномерно. Поддержка почечной экскреции' },
                    ]},
                    { time:'🌙 Вечер (19:00–22:00)', color:'#6366f1', items:[
                      { n:'NAC 600-1200 мг (вторая доза)', why:'Вечером перед сном. Детоксикация во сне' },
                      { n:'TUDCA 500-1000 мг', why:'Строго натощак (2-3 ч после еды). Макс. холеретический эффект' },
                      { n:'АЛК 300 мг (вторая доза)', why:'С ужином. Продолжение Nrf2-активации' },
                      { n:'Кинза (экстракт) 30-50 капель', why:'С водой. Мобилизация Hg из депо' },
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

              {detoxTab === 'monitoring' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>🧪 Лабораторный мониторинг детоксикации</div>
                    {[{ marker:'АЛТ/АСТ/ГГТ/ЩФ', target:'АЛТ/АСТ {'<'}40, ГГТ {'<'}55', when:'Каждые 4 нед', action:'АЛТ {'>'}80 (2×ВГН) — усилить фазу 2 детокса. ГГТ {'>'}55 — холестаз, TUDCA 1000 мг' },
                      { marker:'Глутатион (GSH) в крови', target:'{'>'}600 мкмоль/л', when:'Каждые 8-12 нед', action:'{'<'}600 — истощение GSH. NAC 2400 мг/сут + АЛК 600 мг/сут + селен 200 мкг' },
                      { marker:'8-OHdG (оксидативный стресс ДНК)', target:'{'<'}2.5 нг/мл', when:'Каждые 12-24 нед', action:'{'>'}2.5 — высокий окислительный стресс. АЛК 600 мг, NAC 2400 мг, куркумин' },
                      { marker:'Гомоцистеин', target:'{'<'}10 мкмоль/л', when:'Каждые 12 нед', action:'{'>'}12 — дефицит метилирования. SAM-e, ТМГ, метилфолат, B12' },
                      { marker:'Тяжёлые металлы (Hg, Pb, Cd)', target:'{'<'}5 мкг/л', when:'При симптомах', action:'{'>'}5 — хелатирование. Хлорелла + NAC + АЛК + кинза' },
                    ].map((m: any, i: any) =>(
                      <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(34,211,238,0.04)', border:'1px solid rgba(34,211,238,0.08)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                          <span style={{ fontSize:9, fontWeight:700, color:'#67e8f9' }}>{m.marker}</span>
                          <span style={{ fontSize:8, fontWeight:600, color:'#22d3ee' }}>{m.when}</span>
                        </div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:4 }}><b style={{color:'#67e8f9'}}>Цель: {m.target}</b></div>
                        <div style={{ fontSize:7, color:'#67e8f9', lineHeight:1.3, padding:'4px 6px', borderRadius:4, background:'rgba(34,211,238,0.06)' }}>💡 {m.action}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ borderRadius:12, padding:12, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#f59e0b', marginBottom:4 }}>🔗 Перекрёстные предупреждения</div>
              <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.5 }}>
                • ❤️ <b>Кардио:</b> NAC {'>'}2400 мг/сут → ↑ АД (редко). Контроль АД на высоких дозах NAC<br/>
                • 🫁 <b>Печень:</b> TUDCA не применять при полной обструкции желчевыводящих путей. NAC с антибиотиками — интервал 2 ч<br/>
                • 🧠 <b>Нейро:</b> SAM-e может вызывать тревогу при {'>'}1200 мг/сут. Начинать с 400 мг<br/>
                • 🩸 <b>Гематология:</b> Хлорелла — богата витамином K. Контроль МНО при варфарине. Отменить за 2 нед до операции<br/>
                • ⚠ <b>Кросс-модульный лимит NAC:</b> NAC используется в Детоксе, Иммунитете (фаза 3) и Печени. Суммарно НЕ превышать 3000 мг/сут из всех протоколов
              </div>
            </div>

          </InfoErrorBoundary>
  );
};
