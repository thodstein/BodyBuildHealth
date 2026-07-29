// @ts-nocheck
import React, { useState } from 'react';
import { cardBg, pillActive, pillInactive, PhaseLabel, ItemRow, ItemRowTriage, triageBadge, phaseBadge, renderRow, renderPhase, timingBlock, monitoringBlock, ContraBanner } from './supportProtocolsShared';
import { InfoErrorBoundary } from './SupportScreenData';

export const SupportProtocolThyroid: React.FC<{ s: Record<string, any> }> = ({ s }) => {
  const [thyroidTab, setThyroidTab] = useState('protocol');
  return (
          <InfoErrorBoundary label="Тиреоидный">
            <div style={{ paddingBottom: 30, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={cardBg}>
                <div style={{ fontSize:13, fontWeight:800, color:'#ec4899', marginBottom:2 }}>🦋 Тиреоидная поддержка на курсе ААС</div>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Контроль функции щитовидной железы: T3, T4, ТТГ. ААС могут подавлять ось HPTA и влиять на метаболизм тиреоидных гормонов.</p>
              </div>

              <ContraBanner items={[
                'L-T4 без титрования по св. T4/T3 — риск ятрогенного гипер/гипотиреоза (доза ≠ весу 1.6 мкг/кг)',
                'Йод при аутоиммунном тиреоидите — может спровоцировать гипертиреоз (блокировать только при доказанном дефиците)',
                'Железо/кальций — интервал 4 ч с L-T4 (снижают всасывание на 20-40%)',
                'T3 изолированно при не подавленном ТТГ — риск тиреотоксикоза',
              ]} />

              <div style={{ display:'flex', gap:4, overflowX:'auto', scrollbarWidth:'none' }}>
                {[
                  { id:'mechanisms', label:'🔬 Механизмы' },
                  { id:'protocol', label:'💊 Фазы протокола' },
                  { id:'timing', label:'⏰ Тайминг' },
                  { id:'monitoring', label:'🧪 Мониторинг' },
                ].map((t: any) => (
                  <button key={t.id} onClick={() => setThyroidTab(t.id)}
                    style={thyroidTab === t.id ? pillActive('#ec4899') : pillInactive()}>{t.label}</button>
                ))}
              </div>

              {thyroidTab === 'mechanisms' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>🔬 Механизмы влияния ААС на щитовидную железу</div>
                  {[{ m:'Снижение ТТГ', e:'Экзогенные андрогены подавляют гипоталамо-гипофизарную ось → ↓ ТТГ → ↓ T4 → ↓ T3. Аналогично центральному гипотиреозу' },
                    { m:'Конверсия T4→T3', e:'ААС модулируют дейодиназу D1/D2: ↑ активность → относительный избыток T3 на фоне низкого T4' },
                    { m:'Транспорт (TBG)', e:'Андрогены снижают тироксин-связывающий глобулин (TBG) в печени → ЛОЖНОЕ ↓ общего T4/T3 при нормальном свободном (не истинный гипотиреоз! Контроль — только св. T4/T3)' },
                    { m:'Прямая токсичность', e:'Высокие дозы ААС (особенно тренболон) могут вызывать тиреоидит → ↑ обратного T3 (rT3) → тканевой гипотиреоз' },
                  ].map((x, i) => (
                    <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(236,72,153,0.04)', border:'1px solid rgba(236,72,153,0.08)' }}>
                      <div style={{ fontSize:9, fontWeight:700, color:'#f9a8d4', marginBottom:2 }}>{x.m}</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)' }}>{x.e}</div>
                    </div>
                  ))}
                </div>
              )}

              {thyroidTab === 'protocol' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {[
                    { phase:'ФАЗА 1 · ПРОФИЛАКТИКА', label:'ТТГ/Т3/Т4 в норме', color:'#22c55e', condition:'ТТГ 0.5-2.5, T4 св 10-22, T3 св 3.5-6.5', desc:'Мониторинг + нутритивная поддержка',
                      items:[
                        { name:'Селен (L-селенометионин)', dose:'200 мкг', timing:'Утро с едой', note:'Кофактор дейодиназ (↓ rT3, ↑ активность конверсии T4→T3). Селен: снижение риска тиреоидита — только при АИТ (Хашимото) или беременности (SEP-01 trial). У эутиреоидных эффект отсутствует.' },
                        { name:'Цинк (пиколинат)', dose:'30 мг', timing:'Вечер', note:'Кофактор синтеза ТТГ. Дефицит цинка → ↓ ТТГ и T3' },
                        { name:'Йод (калия йодид)', dose:'150 мкг', timing:'Утро', note:'Субстрат для синтеза T4/T3. Только при отсутствии аутоиммунного тиреоидита' },
                        { name:'L-тирозин', dose:'500 мг', timing:'Утро натощак', note:'Аминокислота-предшественник тиреоидных гормонов' },
                      ]},
                    { phase:'ФАЗА 2 · СУБКЛИНИЧЕСКИЙ ГИПОТИРЕОЗ', label:'ТТГ 2.5-4.5 / T4 низкий', color:'#f59e0b', condition:'ТТГ {'>'}2.5, T4 св {'<'}10', desc:'Мягкая коррекция',
                      items:[
                        { name:'L-T4 (левотироксин) 25-50 мкг 💊', dose:'25-50 мкг', timing:'Утро натощак за 30-60 мин до еды', note:'Старт с 25 мкг. Титрация каждые 4-6 нед по ТТГ. Цель ТТГ 0.5-2.0' },
                        { name:'Селен 200 мкг', dose:'200 мкг', timing:'Утро', note:'Продолжить. Оптимизация конверсии T4→T3' },
                        { name:'Ашваганда (Withania)', dose:'300-600 мг', timing:'2×/день', note:'Адаптоген. Повышает ТТГ, T4 и T3 у субклинического гипотиреоза. Курс 8-12 нед' },
                      ]},
                    { phase:'ФАЗА 3 · МАНИФЕСТНЫЙ ГИПОТИРЕОЗ', label:'ТТГ {'>'}4.5 / T4 низкий', color:'#f97316', condition:'ТТГ {'>'}4.5, T4 св {'<'}9, симптомы', desc:'Заместительная терапия',
                      items:[
                        { name:'L-T4 (левотироксин) 50-100 мкг 💊', dose:'50-100 мкг', timing:'Утро натощак', note:'Старт 50 мкг. Титрация ПО СВ. T4/T3 (не по весу 1.6 мкг/кг — это полная заместительная доза при тотальной тиреоидэктомии, а не цель при субклиническом ААС-гипотиреозе). Цель ТТГ 0.5-2.0, св. T4 10-22' },
                        { name:'L-T4 + L-T3 (комбинированная терапия) 💊', dose:'T4 50-75 мкг + T3 5-10 мкг', timing:'T4 утром, T3 дробно', note:'При недостаточном ответе на моно-T4. Контроль T3 св. Не превышать T3 {'>'}15 мкг/сут' },
                        { name:'Исключить дефицит Fe, Se, Zn', dose:'По анализам', timing:'Коррекция до нормализации', note:'Дефицит железа → ↓ активности ТПО. Ферритин {'>'}70, Se {'>'}1.2 мкмоль/л. ТАКЖЕ: гипокалория и дефицит Fe → ↓ конверсии T4→T3 (ложный тканевой гипотиреоз при норм. св. T4/T3)' },
                      ]},
                    { phase:'ФАЗА 4 · ТИРЕОТОКСИКОЗ / ГИПЕРТИРЕОЗ', label:'ТТГ {'<'}0.1 / T3/T4 высокий', color:'#ef4444', condition:'ТТГ {'<'}0.1, T3 св {'>'}6.5, пульс {'>'}100', desc:'Неотложно. Исключить тиреоидит/тиреотоксикоз от ААС',
                      items:[
                        { name:'β-блокатор (пропранолол 20-40 мг)', dose:'20-40 мг', timing:'2-3×/день', note:'Контроль пульса {'<'}90. Симптоматическая терапия до нормализации T3' },
                        { name:'Тионамиды (тиамазол 5-20 мг) 💊', dose:'5-20 мг', timing:'1-2×/день', note:'Ингибитор синтеза T3/T4. Только по назначению эндокринолога' },
                        { name:'Отмена тиреоидных препаратов', dose:'—', timing:'Немедленно', note:'Отменить L-T4. Контроль T3/T4/ТТГ каждые 3-5 дней' },
                        { name:'Консультация эндокринолога', dose:'—', timing:'Срочно', note:'При тиреотоксикозе — госпитализация при пульсе {'>'}120, аритмии' },
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

              {thyroidTab === 'timing' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>⏰ Суточный тайминг тиреоидной поддержки</div>
                  <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Левотироксин строго натощак за 30-60 мин до еды. Селен и цинк — в разное время суток.</p>
                  {[
                    { time:'🌅 Утро (06:00–09:00)', color:'#f59e0b', items:[
                      { n:'L-T4 25-100 мкг (если назначен)', why:'Натощак за 30-60 мин до еды. Не запивать кальцием/железом — интервал 4 ч' },
                      { n:'L-тирозин 500 мг', why:'Натощак. Предшественник тиреоидных гормонов' },
                      { n:'Селен 200 мкг', why:'С завтраком. Кофактор дейодиназ' },
                    ]},
                    { time:'☀️ День (12:00–16:00)', color:'#f97316', items:[
                      { n:'Ашваганда 300-600 мг', why:'С обедом. Адаптоген, ↑ ТТГ при субклиническом гипотиреозе' },
                    ]},
                    { time:'🌙 Вечер (19:00–22:00)', color:'#6366f1', items:[
                      { n:'Цинк 30 мг', why:'На ночь. Кофактор синтеза ТТГ' },
                      { n:'Избегать кальция/железа в течение 4 ч после L-T4', why:'Снижают всасывание левотироксина на 20-40%' },
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

              {thyroidTab === 'monitoring' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>🧪 Лабораторный мониторинг щитовидной железы</div>
                    {[{ marker:'ТТГ', target:'0.5-2.5 мМЕ/л', when:'Каждые 4-6 нед при терапии', action:'{'<'}0.1 — тиреотоксикоз. {'>'}4.5 — манифестный гипотиреоз. Цель на терапии 0.5-2.0' },
                      { marker:'T4 свободный', target:'10-22 пмоль/л', when:'Каждые 4-6 нед', action:'{'<'}10 — гипотиреоз. {'>'}22 — гипертиреоз/передозировка L-T4' },
                      { marker:'T3 свободный', target:'3.5-6.5 пмоль/л', when:'Каждые 4-6 нед', action:'T3 {'>'}6.5 + ТТГ {'<'}0.1 — тиреотоксикоз. T3 {'<'}3.0 + rT3 ↑ — тканевой гипотиреоз' },
                      { marker:'Анти-ТПО / Анти-ТГ', target:'{'<'}30 МЕ/мл / {'<'}40 МЕ/мл', when:'1 раз до курса', action:'{'>'}нормы — аутоиммунный тиреоидит. Исключить избыток йода. Контроль ТТГ каждые 8 нед' },
                      { marker:'Ферритин', target:'{'>'}70 нг/мл', when:'Каждые 12 нед', action:'{'<'}70 — дефицит железа → ↓ активности ТПО → ↓ синтеза T4' },
                      { marker:'Селен в сыворотке', target:'1.2-2.0 мкмоль/л', when:'Каждые 12 нед', action:'{'<'}1.0 — дефицит → ↓ конверсии T4→T3. Коррекция 200 мкг/день' },
                    ].map((m: any, i: any) =>(
                      <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(236,72,153,0.04)', border:'1px solid rgba(236,72,153,0.08)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                          <span style={{ fontSize:9, fontWeight:700, color:'#f9a8d4' }}>{m.marker}</span>
                          <span style={{ fontSize:8, fontWeight:600, color:'#ec4899' }}>{m.when}</span>
                        </div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:4 }}><b style={{color:'#f9a8d4'}}>Цель: {m.target}</b></div>
                        <div style={{ fontSize:7, color:'#f9a8d4', lineHeight:1.3, padding:'4px 6px', borderRadius:4, background:'rgba(236,72,153,0.06)' }}>💡 {m.action}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ borderRadius:12, padding:12, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#f59e0b', marginBottom:4 }}>🔗 Перекрёстные предупреждения</div>
              <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.5 }}>
                • ❤️ <b>Кардио:</b> L-T4 повышает потребность миокарда в O₂. Контроль пульса. При тиреотоксикозе — β-блокаторы<br/>
                • ⚖️ <b>Метаболизм:</b> Тиреоидные гормоны ↑ метаболизм → ↓ веса, ↑ теплопродукции. Контроль калорийности питания<br/>
                • 🧠 <b>Нейро:</b> Гипотиреоз → депрессия, ↓ когниции. Тиреотоксикоз → тревога, тремор, инсомния<br/>
                • 🩸 <b>Гематология:</b> L-T4 ↑ антикоагулянтный эффект варфарина. МНО контроль при комбинации
              </div>
            </div>

          </InfoErrorBoundary>
  );
};
