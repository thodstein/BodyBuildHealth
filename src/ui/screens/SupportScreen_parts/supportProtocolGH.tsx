// @ts-nocheck
import React, { useState } from 'react';
import { cardBg, pillActive, pillInactive, PhaseLabel, ItemRow, ItemRowTriage, triageBadge, phaseBadge, renderRow, renderPhase, timingBlock, monitoringBlock } from './supportProtocolsShared';
import { InfoErrorBoundary } from './SupportScreenData';

export const SupportProtocolGH: React.FC<{ s: Record<string, any> }> = ({ s }) => {
  const [ghTab, setGhTab] = useState('protocol');
  return (
          <InfoErrorBoundary label="GH/IGF-1">
            <div style={{ paddingBottom: 30, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={cardBg}>
                <div style={{ fontSize:13, fontWeight:800, color:'#2dd4bf', marginBottom:2 }}>🫀 Поддержка оси GH/IGF-1</div>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Оптимизация секреции гормона роста, IGF-1 и их метаболических эффектов. Протокол для курсов с соматотропином, GHRP/GHRH и природной стимуляции.</p>
              </div>

              <div style={{ display:'flex', gap:4, overflowX:'auto', scrollbarWidth:'none' }}>
                {[
                  { id:'mechanisms', label:'🔬 Механизмы' },
                  { id:'protocol', label:'💊 Фазы протокола' },
                  { id:'timing', label:'⏰ Тайминг' },
                  { id:'monitoring', label:'🧪 Мониторинг' },
                ].map((t: any) => (
                  <button key={t.id} onClick={() => setGhTab(t.id)}
                    style={ghTab === t.id ? pillActive('#2dd4bf') : pillInactive()}>{t.label}</button>
                ))}
              </div>

              {ghTab === 'mechanisms' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>🔬 Ось GH/IGF-1 и ААС</div>
                  {[{ m:'Соматопауза (↓ GH с возрастом)', e:'После 30 лет секреция GH ↓ на 10-15% за десятилетие. ААС могут дополнительно подавлять эндогенную ось через ↑ соматостатина' },
                    { m:'IGF-1 — медиатор анаболизма', e:'IGF-1 — главный медиатор анаболических эффектов GH. Стимулирует сателлитные клетки, синтез коллагена, гипертрофию' },
                    { m:'GH + ААС = синергия', e:'GH ↑ IGF-1 → ↑ мышечной гипертрофии через mTOR. ААС ↑ AR-экспрессию → ↑ чувствительность к IGF-1. Комбинация = аддитивный анаболизм' },
                    { m:'Инсулин-модуляция', e:'GH ↓ чувствительность к инсулину (↑ глюкозы). ААС ↑ ИР. Комбинация GH+ААС без метформина/берберина → риск гипергликемии' },
                    { m:'Акромегалия/пролапс', e:'Супрафизиологический GH (10+ МЕ/день) → акромегалия (↓ 10 лет жизни). Контроль IGF-1 — абсолютный императив' },
                  ].map((x, i) => (
                    <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(45,212,191,0.04)', border:'1px solid rgba(45,212,191,0.08)' }}>
                      <div style={{ fontSize:9, fontWeight:700, color:'#5eead4', marginBottom:2 }}>{x.m}</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)' }}>{x.e}</div>
                    </div>
                  ))}
                </div>
              )}

              {ghTab === 'protocol' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {[
                    { phase:'ФАЗА 1 · ЭНДОГЕННАЯ СТИМУЛЯЦИЯ', label:'GHRP/GHRH/секретагоги', color:'#22c55e', condition:'Возраст 30-50, IGF-1 {'<'}200 нг/мл, нет GH в курсе', desc:'Природное повышение GH без экзогенного гормона',
                      items:[
                        { name:'GHRP-6/CJC-1295 (Ipamorelin)', dose:'100-200 мкг', timing:'1-3×/день п/к', note:'GHRP-6 стимулирует пульсирующую секрецию GH. CJC-1295 пролонгирует GHRH. Ipamorelin — селективен к GH (не ↑ пролактина/кортизола)' },
                        { name:'Глицин + L-аргинин + L-орнитин', dose:'Глицин 3 г + аргинин 5 г + орнитин 2 г', timing:'Натощак за 30-60 мин до сна/тренировки', note:'Аминокислотный секретагог. ↑ GH на 50-150% на час. ⚠ Не с едой (инсулин ↓ секрецию GH)' },
                        { name:'Глютамин', dose:'5-10 г', timing:'Натощак', note:'↑ GH через ↑ орнитина. Усиливает эффект секретагогов' },
                        { name:'Максимальное качество сна', dose:'7-9 ч', timing:'Ежедневно', note:'Основной пульс GH — во 2-3 цикле медленноволнового сна. Без качественного сна — стимуляция бесполезна' },
                      ]},
                    { phase:'ФАЗА 2 · НИЗКИЕ ДОЗЫ GH', label:'GH 2-4 МЕ/день', color:'#f59e0b', condition:'IGF-1 200-350 нг/мл, контроль глюкозы', desc:'Метаболическая доза. Анаболизм + жиросжигание',
                      items:[
                        { name:'Соматотропин (GH) 2-4 МЕ/день', dose:'2-4 МЕ', timing:'Утро натощак (или п/к)', note:'Разделить на 2 инъекции при {'>'}3 МЕ. Контроль IGF-1 через 2-4 нед. Цель IGF-1 {'<'}350' },
                        { name:'Метформин 500 мг 💊', dose:'500 мг', timing:'2×/день с едой', note:'Обязательно на GH! ↓ риска гипергликемии. Контроль глюкозы натощак через 2 нед. По назначению врача' },
                        { name:'Калий + магний', dose:'K⁺ 500-1000 мг + Mg 400 мг', timing:'Вечер', note:'GH ↑ задержки Na⁺ → ↓ K⁺, Mg²⁺. Восполнение потерь' },
                        { name:'Контроль глюкозы', dose:'—', timing:'Еженедельно', note:'Глюкоза натощак {'>'}5.6 — ↑ метформин до 1000 мг × 2/день или добавить берберин' },
                      ]},
                    { phase:'ФАЗА 3 · СРЕДНИЕ ДОЗЫ GH', label:'GH 4-8 МЕ/день', color:'#f97316', condition:'IGF-1 350-500 нг/мл', desc:'Анаболическая доза. Только для опытных',
                      items:[
                        { name:'Соматотропин (GH) 4-8 МЕ/день', dose:'4-8 МЕ', timing:'Утро + предтренировочно', note:'Разделить на 2-3 инъекции. IGF-1 не выше 500 нг/мл! Акромегалия при {'>'}600' },
                        { name:'Метформин 1000 мг 💊', dose:'1000 мг', timing:'2×/день с едой', note:'Максимальная доза. Контроль глюкозы + HbA1c каждые 8-12 нед. По назначению врача' },
                        { name:'Инсулин (при гипергликемии) ⚠', dose:'Только манифестный СД', timing:'Под эндокринологом', note:'⚠ Инсулин при GH-индуцированной гипергликемии — ТОЛЬКО при манифестном СД под эндокринологом. У не-диабетика жизнеугрожающая гипогликемия. Первая линия: снижение/отмена GH + метформин 1000 мг' },
                        { name:'L-карнитин (ацетил/тартрат)', dose:'1-3 г', timing:'Утро/предтренировочно', note:'↓ ИР от GH. ↑ окисления жиров. Митохондриальная поддержка' },
                      ]},
                    { phase:'ФАЗА 4 · ВЫСОКИЕ ДОЗЫ / ТОКСИЧНОСТЬ', label:'GH {'>'}8 МЕ/день', color:'#ef4444', condition:'IGF-1 {'>'}500, симптомы акромегалии', desc:'Неотложная коррекция',
                      items:[
                        { name:'Снижение/отмена GH', dose:'—', timing:'Немедленно', note:'IGF-1 {'>'}500 → ↓ дозу на 50%. {'>'}600 → отмена. Риск акромегалии + ↓ продолжительности жизни' },
                        { name:'Метформин 1000-2000 мг 💊', dose:'1000-2000 мг', timing:'2×/день с едой', note:'↓ гипергликемии, вызванной GH. Не снижает IGF-1, но контролирует метаболические последствия. По назначению врача' },
                        { name:'Аналоги соматостатина (октреотид 💊)', dose:'По назначению', timing:'П/к', note:'Ингибитор секреции GH ГИПОФИЗОМ. При экзогенном GH — НЕэффективен. Только при акромегалии (эндогенная гиперсекреция). По назначению эндокринолога' },
                        { name:'Контроль IGF-1', dose:'—', timing:'Каждые 2 нед', note:'Цель — нормализация IGF-1 ({'<'}350). Не возобновлять GH {'>'}4 МЕ/день после коррекции' },
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

              {ghTab === 'timing' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>⏰ Суточный тайминг GH-поддержки</div>
                  <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>GH утром натощак (имитация пульса). Секретагоги — перед сном. Еда — через 30-60 мин после GH (чтобы ↓ инсулинового ответа).</p>
                  {[
                    { time:'🌅 Утро (06:00–09:00)', color:'#f59e0b', items:[
                      { n:'GH 2-4 МЕ (утренняя доза)', why:'Натощак. П/к. Без еды 30-60 мин' },
                      { n:'L-карнитин 1-3 г', why:'Натощак. Транспорт жиров в митохондрии' },
                      { n:'Метформин 500 мг 💊', why:'С завтраком. Профилактика гипергликемии' },
                    ]},
                    { time:'☀️ День (12:00–16:00)', color:'#f97316', items:[
                      { n:'GH 2-4 МЕ (предтренировочная доза)', why:'За 30-60 мин до тренировки. П/к. Плюс аргинин/орнитин' },
                      { n:'Калий + магний', why:'С обедом. Восполнение электролитов' },
                      { n:'Метформин 500 мг 💊 (вторая доза)', why:'С ужином. Контроль глюкозы' },
                    ]},
                    { time:'🌙 Вечер (19:00–22:00)', color:'#6366f1', items:[
                      { n:'Секретагоги (GHRP-6/ипаморелин 100-200 мкг)', why:'Перед сном п/к. Пик GH во сне' },
                      { n:'Глицин+аргинин+орнитин (при секретагогах)', why:'Натощак. Натуральный ↑ GH' },
                      { n:'Глютамин 5-10 г', why:'На ночь. ↑ GH + восстановление ЖКТ' },
                      { n:'Без еды за 1-2 ч до сна', why:'Инсулин блокирует секрецию GH. Сон натощак = макс. GH' },
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

              {ghTab === 'monitoring' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>🧪 Лабораторный мониторинг GH/IGF-1</div>
                    {[{ marker:'IGF-1 (соматомедин C)', target:'150-350 нг/мл (возраст-зависимо)', when:'Каждые 4-8 нед на GH', action:'{'<'}150 — ↓ дозу GH/секретагога. {'>'}500 — ↓ дозу GH на 50%. {'>'}600 — отмена GH. Акромегалия!' },
                      { marker:'Глюкоза натощак', target:'{'<'}5.6 ммоль/л', when:'Еженедельно на GH', action:'5.6-7.0 — метформин 1000 мг. {'>'}7.0 — инсулин. {'>'}11.1 — диабет. Эндокринолог' },
                      { marker:'HbA1c', target:'{'<'}6.0%', when:'Каждые 12 нед на GH', action:'{'>'}6.5% — преддиабет. Снизить/отменить GH, метформин 2 г/день' },
                      { marker:'T4/T3/ТТГ', target:'ТТГ 0.5-2.5, T4 10-22', when:'Каждые 8-12 нед', action:'GH ↓ T4→T3 конверсию → возможен гипотиреоз. Контроль щитовидной железы' },
                      { marker:'Калий (K⁺)', target:'3.5-5.0 ммоль/л', when:'Каждые 4-8 нед', action:'{'<'}3.5 — задержка Na⁺ от GH. Коррекция калия' },
                    ].map((m: any, i: any) =>(
                      <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(45,212,191,0.04)', border:'1px solid rgba(45,212,191,0.08)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                          <span style={{ fontSize:9, fontWeight:700, color:'#5eead4' }}>{m.marker}</span>
                          <span style={{ fontSize:8, fontWeight:600, color:'#2dd4bf' }}>{m.when}</span>
                        </div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:4 }}><b style={{color:'#5eead4'}}>Цель: {m.target}</b></div>
                        <div style={{ fontSize:7, color:'#5eead4', lineHeight:1.3, padding:'4px 6px', borderRadius:4, background:'rgba(45,212,191,0.06)' }}>💡 {m.action}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ borderRadius:12, padding:12, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#f59e0b', marginBottom:4 }}>🔗 Перекрёстные предупреждения</div>
              <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.5 }}>
                • ❤️ <b>Кардио:</b> GH ↑ задержку Na⁺ → ↑ АД + ↑ риск гипертрофии миокарда. Контроль АД каждую неделю<br/>
                • ⚖️ <b>Метаболизм:</b> GH ↓ чувствительность к инсулину → гипергликемия. Метформин — обязательно на GH {'>'}2 МЕ/день<br/>
                • 🫁 <b>Печень:</b> IGF-1 синтезируется печенью. При нарушении функции печени — ↓ IGF-1 даже при высоком GH<br/>
                • 🦴 <b>Суставы:</b> GH ↑ синтез коллагена → ↓ риска травм. Но высокие дозы → акромегалия → остеоартрит. IGF-1 {'<'}350!
              </div>
            </div>

          </InfoErrorBoundary>
  );
};
