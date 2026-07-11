// @ts-nocheck
import React, { useState } from 'react';
import { cardBg, pillActive, pillInactive, PhaseLabel, ItemRow, ItemRowTriage, triageBadge, phaseBadge, renderRow, renderPhase, timingBlock, monitoringBlock } from './supportProtocolsShared';
import { InfoErrorBoundary } from './SupportScreenData';

export const SupportProtocolHair: React.FC<{ s: Record<string, any> }> = ({ s }) => {
  const [hairTab, setHairTab] = useState('protocol');
  return (
          <InfoErrorBoundary label="Кожа/Волосы">
            <div style={{ paddingBottom: 30, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={cardBg}>
                <div style={{ fontSize:13, fontWeight:800, color:'#f472b6', marginBottom:2 }}>💇 Защита кожи и волос на курсе ААС</div>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Профилактика андрогенетической алопеции, акне, стрий, ухудшения качества кожи.</p>
              </div>

              {/* Sub-tabs */}
              <div style={{ display:'flex', gap:4, overflowX:'auto', scrollbarWidth:'none' }}>
                {[
                  { id:'mechanisms', label:'🔬 Механизмы' },
                  { id:'protocol', label:'💊 Фазы протокола' },
                  { id:'timing', label:'⏰ Тайминг' },
                  { id:'monitoring', label:'🧪 Мониторинг' },
                ].map((t: any) => (
                  <button key={t.id} onClick={() => setHairTab(t.id)}
                    style={hairTab === t.id ? pillActive('#f472b6') : pillInactive()}>{t.label}</button>
                ))}
              </div>

              {/* Mechanisms */}
              {hairTab === 'mechanisms' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>🔬 Механизмы поражения кожи/волос на ААС</div>
                  {[{ m:'DHT → миниатюризация фолликулов', e:'DHT (5α-дигидротестостерон) — основной андроген кожи. Связывается с AR в фолликулах → миниатюризация → андрогенетическая алопеция' },
                    { m:'Себум → акне', e:'Андрогены стимулируют сальные железы → гиперсекреция себума → закупорка пор → C. acnes → воспаление → акне' },
                    { m:'Коллаген → стрии', e:'ААС ↑ mTOR → гипертрофия мышц быстрее, чем адаптация коллагена. Перерастяжение дермы → стрии (растяжки)' },
                  ].map((x, i) => (
                    <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(244,114,182,0.04)', border:'1px solid rgba(244,114,182,0.08)' }}>
                      <div style={{ fontSize:9, fontWeight:700, color:'#f9a8d4', marginBottom:2 }}>{x.m}</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)' }}>{x.e}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Protocol phases */}
              {hairTab === 'protocol' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {[
                    { phase:'ФАЗА 1 · ПРОФИЛАКТИКА', label:'Нет симптомов', color:'#22c55e', condition:'Нет выпадения, нет акне', desc:'Базовая поддержка кожи/волос на курсе',
                      items:[
                        { name:'Цинк (пиколинат)', dose:'30-50 мг', timing:'Вечер', note:'Ингибирует 5α-редуктазу → ↓ DHT в коже. Противовоспалительное' },
                        { name:'Витамин D3', dose:'2000-5000 МЕ', timing:'С жирной едой', note:'Участвует в цикле волосяного фолликула. Дефицит D3 — выпадение' },
                        { name:'Биотин (B7)', dose:'5000-10000 мкг', timing:'Утро', note:'Синтез кератина. Укрепление волос и ногтей' },
                        { name:'Коллаген (гидролизованный)', dose:'10-15 г', timing:'С витамином C', note:'Субстрат для синтеза коллагена кожи. Профилактика стрий' },
                      ]},
                    { phase:'ФАЗА 2 · ВЫПАДЕНИЕ ВОЛОС', label:'{'>'}100 волос/день', color:'#f59e0b', condition:'Заметное выпадение', desc:'Анти-DHT и рост-стимулирующая терапия',
                      items:[
                        { name:'Финастерид 0.5-1 мг (только при АГА)', dose:'0.5-1 мг', timing:'Утро', note:'Ингибитор 5α-редуктазы 2 типа. ↓ DHT в коже на 60-70%. Эффект через 3-6 мес' },
                        { name:'Дутастерид 0.5 мг (резистентность к финастериду)', dose:'0.5 мг', timing:'Утро', note:'Ингибитор 5α-редуктазы 1+2 типа. ↓ DHT на 90%. Сильнее, но больше побочек' },
                        { name:'Миноксидил 5% топический', dose:'1 мл', timing:'2×/день', note:'Вазодилататор фолликулов. Продлевает фазу анагена. Эффект через 4-6 мес' },
                        { name:'Кетоконазол 2% шампунь', dose:'Как шампунь', timing:'2-3×/нед', note:'Слабая антиандрогенная активность. Противогрибковое. ↓ шелушения' },
                      ]},
                    { phase:'ФАЗА 3 · АКНЕ (AAS-ИНДУЦИРОВАННОЕ)', label:'Папулы/пустулы', color:'#f97316', condition:'Акне на спине/плечах/лице', desc:'См. отдельный протокол Акне',
                      items:[
                        { name:'Салициловая кислота 2% скраб', dose:'1-2×/день', timing:'Утро', note:'Кератолитик. Открывает поры. Использовать на спину/плечи' },
                        { name:'Бензоил пероксид 5% гель', dose:'Локально', timing:'Вечер', note:'Уничтожает C. acnes. Не вызывает резистентности' },
                        { name:'Цинк (пиколинат) 50 мг', dose:'50 мг', timing:'Вечер', note:'Ингибирует 5α-редуктазу. Антивоспалительный. Продолжить из фазы 1' },
                      ]},
                    { phase:'ФАЗА 4 · СТРИИ (РАСТЯЖКИ)', label:'Появляющиеся стрии', color:'#ef4444', condition:'Стрии на груди/плечах/бёдрах', desc:'Профилактика и лечение стрий',
                      items:[
                        { name:'Третиноин 0.05% крем', dose:'Тонкий слой', timing:'На ночь локально', note:'Ретиноид. Стимулирует синтез коллагена. Фотосенсибилизация — SPF 50+' },
                        { name:'Гиалуроновая кислота + витамин C сыворотка', dose:'Несколько капель', timing:'Утро', note:'Гидратация + антиоксидант + стимуляция коллагена' },
                        { name:'Микронидлинг (дермапен)', dose:'0.5-1 мм', timing:'1×/2-4 нед', note:'Стимуляция неоколлагенеза. Только в кабинете косметолога' },
                        { name:'Масло ши + витамин E', dose:'Массаж', timing:'Вечер', note:'Увлажнение и питание рубцовой ткани' },
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
              {hairTab === 'timing' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>⏰ Суточный тайминг поддержки кожи/волос</div>
                  <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Утром — анти-DHT и витамины. Вечером — топические средства.</p>
                  {[
                    { time:'🌅 Утро (06:00–09:00)', color:'#f59e0b', items:[
                      { n:'Финастерид/дутастерид (если назначен)', why:'Один раз в день. ↓ DHT на 60-90%' },
                      { n:'Биотин 5000-10000 мкг', why:'Синтез кератина. С завтраком' },
                      { n:'Миноксидил 5% топический', why:'На сухую кожу головы. Массаж 2-3 мин' },
                      { n:'Сыворотка с гиалуроновой кислотой + C', why:'На лицо/шею. Увлажнение + коллаген' },
                    ]},
                    { time:'☀️ День (12:00–16:00)', color:'#f97316', items:[
                      { n:'D3 2000-5000 МЕ с обедом', why:'С жирной едой. Цикл волосяного фолликула' },
                      { n:'Коллаген 10-15 г', why:'С витамином C (апельсиновый сок). Синтез коллагена' },
                      { n:'Коллагенарий/скраб с салициловой к-той (спина)', why:'При акне на спине. После душа' },
                    ]},
                    { time:'🌙 Вечер (19:00–22:00)', color:'#6366f1', items:[
                      { n:'Цинк 30-50 мг', why:'На ночь. Ингибитор 5α-редуктазы' },
                      { n:'Третиноин 0.05% крем (локально)', why:'На стрии/акне. SPF на утро обязательно!' },
                      { n:'Масло ши + витамин E', why:'Массаж зон стрий. Увлажнение ' },
                      { n:'Миноксидил 5% топический', why:'На сухую кожу головы. Второй приём' },
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
              {hairTab === 'monitoring' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>🧪 Мониторинг кожи/волос</div>
                    {[{ marker:'Фототрихограмма', target:'Анаген {'>'}80%', when:'Каждые 6 мес', action:'Анаген {'<'}80% — прогрессия алопеции. Рассмотреть финастерид/дутастерид' },
                      { marker:'DHT (сывороточный)', target:'{'<'}250 пг/мл', when:'Через 3 мес терапии финастеридом', action:'{'>'}250 — резистентность к финастериду. Перейти на дутастерид' },
                      { marker:'Цинк в сыворотке', target:'0.75-1.5 мкг/мл', when:'Каждые 12 нед', action:'{'<'}0.75 — дефицит цинка. Увеличить дозу до 50 мг' },
                      { marker:'Ферритин', target:'{'>'}70 нг/мл', when:'Каждые 12 нед', action:'{'<'}70 — дефицит железа. Ассоциирован с выпадением' },
                    ].map((m: any, i: any) =>(
                      <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(244,114,182,0.04)', border:'1px solid rgba(244,114,182,0.08)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                          <span style={{ fontSize:9, fontWeight:700, color:'#f9a8d4' }}>{m.marker}</span>
                          <span style={{ fontSize:8, fontWeight:600, color:'#f472b6' }}>{m.when}</span>
                        </div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:4 }}><b style={{color:'#f9a8d4'}}>Цель: {m.target}</b></div>
                        <div style={{ fontSize:7, color:'#f9a8d4', lineHeight:1.3, padding:'4px 6px', borderRadius:4, background:'rgba(244,114,182,0.06)' }}>💡 {m.action}</div>
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
                • ❤️ <b>Кардио:</b> Финастерид/дутастерид снижают DHT на 60-90% → возможна гипотензия. Контроль АД первые 2 нед<br/>
                • 🫁 <b>Печень:</b> Финастерид метаболизируется в печени. Контроль АЛТ/АСТ при длительном приёме {'>'}1 года<br/>
                • 🔴 <b>Акне:</b> См. отдельный протокол акне. Комплексная терапия — топики + системные антибиотики + БПО
              </div>
            </div>

          </InfoErrorBoundary>
  );
};
