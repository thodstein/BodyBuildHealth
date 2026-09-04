// @ts-nocheck
import React, { useState } from 'react';
import { cardBg, pillActive, pillInactive, PhaseLabel, ItemRow, ItemRowTriage, triageBadge, phaseBadge, renderRow, renderPhase, timingBlock, monitoringBlock, StopBanner, ContraBanner } from './supportProtocolsShared';
import { InfoErrorBoundary } from './SupportScreenData';

export const SupportProtocolE2: React.FC<{ s: Record<string, any> }> = ({ s }) => {
  const [e2Tab, setE2Tab] = useState('protocol');
  return (
          <InfoErrorBoundary label="Эстрадиол">
            <div className="sup-proto-e2" style={{ paddingBottom: 30, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={cardBg}>
                <div style={{ fontSize:13, fontWeight:800, color:'#f472b6', marginBottom:2 }}>🔬 Контроль эстрадиола на курсе ААС</div>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Поддержание оптимального уровня эстрадиола (E2). Профилактика гинекомастии, контроль ароматизации, управление эстроген-зависимыми побочными эффектами.</p>
              </div>

              <ContraBanner items={[
                'E2 <20 пг/мл — суставы/либидо/настроение (не «чем ниже тем лучше»)',
                'Анастрозол НЕ при E2 <40 (риск перелечить → обратные эффекты)',
                'hCG без контроля E2 — риск гинекомастии (титровать по E2)',
                'АИ при нормальном E2 — подавление нужного эстрогена',
              ]} />

              <StopBanner title="Критические пороги по эстрадиолу" thresholds={[
                'E2 >120 пг/мл при симптомах — активная терапия ингибитором ароматазы',
                'E2 <20 пг/мл — симптомы гипоэстрогении (суставы/либидо/настроение): снизить или отменить AI',
                'Болезненная гинекомастия, не отвечающая на SERM/AI за 4-6 нед — консультация хирурга',
                'AI титруется ступенчато: старт 0.5 мг 2×/нед, контроль E2 через 14 дней (не выше и не ниже 20-40 пг/мл)',
              ]} />

              <div style={{ display:'flex', gap:4, overflowX:'auto', scrollbarWidth:'none' }}>
                {[
                  { id:'mechanisms', label:'🔬 Механизмы' },
                  { id:'protocol', label:'💊 Фазы протокола' },
                  { id:'timing', label:'⏰ Тайминг' },
                  { id:'monitoring', label:'🧪 Мониторинг' },
                ].map((t: any) => (
                  <button key={t.id} onClick={() => setE2Tab(t.id)}
                    style={e2Tab === t.id ? pillActive('#f472b6') : pillInactive()}>{t.label}</button>
                ))}
              </div>

              {e2Tab === 'mechanisms' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>🔬 Механизмы эстрогенного контроля</div>
                  {[{ m:'Ароматизация андрогенов', e:'Ароматаза (CYP19A1) конвертирует тестостерон в эстрадиол в жировой ткани, печени, молочных железах. Чем выше T → тем выше E2' },
                    { m:'Гинекомастия', e:'Эстрадиол стимулирует пролиферацию протоков молочных желёз через ERα. Риск при E2 {'>'}150 пг/мл у мужчин' },
                    { m:'Задержка жидкости', e:'E2 ↑ альдостерон → ↑ реабсорбции Na⁺ → задержка воды, отёки, ↑ АД' },
                    { m:'Либидо и настроение', e:'E2 необходим для либидо и когнитивной функции. Слишком низкий E2 ({'<'}20) = ↓ либидо, депрессия, упадок энергии' },
                  ].map((x, i) => (
                    <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(244,114,182,0.04)', border:'1px solid rgba(244,114,182,0.08)' }}>
                      <div style={{ fontSize:9, fontWeight:700, color:'#f9a8d4', marginBottom:2 }}>{x.m}</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)' }}>{x.e}</div>
                    </div>
                  ))}
                </div>
              )}

              {e2Tab === 'protocol' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {[
                     { phase:'ФАЗА 1 · ПРОФИЛАКТИКА', label:'E2 в норме', color:'#22c55e', condition:'E2 20-60 пг/мл', desc:'Мониторинг + превентивные меры. ЦЕЛЬ E2: 20-40 пг/мл (не ниже, не выше)',
                      items:[
                        { name:'DIM (дииндолилметан)', dose:'200-400 мг', timing:'2×/день', note:'Модулятор метаболизма E2: ↑ 2-OH (антипролиферативный), ↓ 16α-OH (пролиферативный). Профилактика гинекомастии' },
                        { name:'Цинк (пиколинат)', dose:'30-50 мг', timing:'Вечер', note:'Слабая ингибиция ароматазы. Здоровый уровень E2' },
                        { name:'Кальций-D-глюкарат', dose:'1-2 г', timing:'2×/день', note:'Связывает конъюгированные эстрогены в кишечнике → ↓ рециркуляции E2' },
                        { name:'Ингибиторы ароматазы (только при симптомах)', dose:'—', timing:'—', note:'Анастрозол 0.5-1 мг/нед. ТОЛЬКО при E2 {'>'}80 и симптомах. Не для профилактики!' },
                      ]},
                    { phase:'ФАЗА 2 · ПОВЫШЕННЫЙ E2', label:'E2 60-120 пг/мл', color:'#f59e0b', condition:'E2 {'>'}60, лёгкие симптомы', desc:'Коррекция ароматизации',
                      items:[
                        { name:'Анастрозол 0.5-1 мг 💊', dose:'0.5-1 мг', timing:'1-2×/нед', note:'Ингибитор ароматазы. ↓ E2 на 50-80%. Старт с 0.5 мг × 1/нед, контроль E2 через 14 дней, титрация вверх только при сохранённых симптомах и E2 >60. ⚠ ↓ ЛПВП, ↑ риск атеросклероза' },
                        { name:'Тамоксифен 10-20 мг 💊', dose:'10-20 мг', timing:'Ежедневно', note:'Селективный модулятор ER. Блокирует ERα в груди → профилактика гинекомастии. Не снижает E2 — только блокирует рецепторы' },
                        { name:'DIM 400 мг', dose:'400 мг', timing:'2×/день', note:'Продолжить. ↓ 16α-OH метаболита' },
                        { name:'Контроль E2', dose:'—', timing:'Каждые 2-4 нед', note:'Целевой E2 20-40 пг/мл на терапии. Не снижать {'<'}20!' },
                      ]},
                    { phase:'ФАЗА 3 · ВЫСОКИЙ E2', label:'E2 {'>'}120 пг/мл', color:'#f97316', condition:'E2 {'>'}120, симптомы (отёки, чувствительность груди)', desc:'Активная терапия',
                      items:[
                         { name:'Анастрозол 1 мг', dose:'1 мг', timing:'2×/нед', note:'Увеличение дозы. Контроль E2 через 2 нед. Цель E2 20-40 пг/мл (не снижать <20!)' },
                        { name:'Тамоксифен 20 мг', dose:'20 мг', timing:'Ежедневно', note:'Продолжить. При уже имеющейся sensitive груди' },
                        { name:'Кальций-D-глюкарат 2 г', dose:'2 г', timing:'2×/день', note:'Усиление экскреции эстрогенов через ЖКТ' },
                        { name:'Рассмотреть снижение дозы T', dose:'—', timing:'—', note:'При невозможности контролировать E2 анастрозолом — снизить дозу тестостерона' },
                      ]},
                    { phase:'ФАЗА 4 · НИЗКИЙ E2 (перелечили)', label:'E2 {'<'}20 пг/мл', color:'#ef4444', condition:'E2 {'<'}20, симптомы (суставы, либидо, настроение)', desc:'Восстановление E2',
                      items:[
                        { name:'Отменить/снизить анастрозол', dose:'—', timing:'Немедленно', note:'Снизить дозу АИ вдвое или отменить на 1-2 нед до восстановления E2' },
                        { name:'D-аспарагиновая кислота (DAA)', dose:'3 г', timing:'2×/день', note:'↑ ароматазу → ↑ E2. Мягкое восстановление. ⚠ D-аспарагиновая кислота: доказательства у человека слабые, эффект кратковременный. У некоторых может СНИЖАТЬ E2. Не рекомендуется как надёжный метод контроля E2.' },
                        { name:'Хорионический гонадотропин (hCG)', dose:'500-1000 МЕ', timing:'2×/нед (суммарно 1000-2000 МЕ/нед)', note:'Стимулирует эндогенный тестостерон → ароматизация → ↑ E2. При низком E2 — 500 МЕ 2×/нед; при выраженном дефиците/атрофии яичек — до 1000 МЕ 2×/нед' },
                        { name:'Контроль E2', dose:'—', timing:'Каждые 1-2 нед', note:'Целевое восстановление E2 до 20-40 пг/мл. Симптомы проходят при {'>'}20' },
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

              {e2Tab === 'timing' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>⏰ Суточный тайминг контроля E2</div>
                  <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Анастрозол 1-2×/нед в одно и то же время. Тамоксифен ежедневно. DIM 2×/день.</p>
                  {[
                    { time:'🌅 Утро (06:00–09:00)', color:'#f59e0b', items:[
                      { n:'Анастрозол 0.5-1 мг (1-2×/нед)', why:'Фиксированный день (напр. ср/сб). После еды' },
                      { n:'Тамоксифен 10-20 мг', why:'Ежедневно утром. Селективный модулятор ER' },
                      { n:'DIM 200 мг', why:'С завтраком. Метаболизм E2' },
                    ]},
                    { time:'☀️ День (12:00–16:00)', color:'#f97316', items:[
                      { n:'Кальций-D-глюкарат 1-2 г', why:'С обедом. Связывание эстрогенов в кишечнике' },
                    ]},
                    { time:'🌙 Вечер (19:00–22:00)', color:'#6366f1', items:[
                      { n:'DIM 200 мг (вторая доза)', why:'С ужином. Равномерное подавление 16α-OH' },
                      { n:'Цинк 30-50 мг', why:'На ночь. Слабая ингибиция ароматазы' },
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

              {e2Tab === 'monitoring' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>🧪 Лабораторный мониторинг E2</div>
                    {[{ marker:'Эстрадиол (E2, ECLIA/MS)', target:'20-60 пг/мл (мужчины)', when:'Каждые 2-4 нед при терапии АИ', action:'{'<'}20 — низкий (суставы, либидо). {'>'}60 — повышен. {'>'}120 — высокая ароматизация' },
                      { marker:'Тестостерон общий', target:'{'>'}500 нг/дл (на терапии)', when:'Каждые 4-8 нед', action:'Коррелирует с E2. Высокий T → высокая ароматизация' },
                      { marker:'Глобулин связывающий половые гормоны (ГСПГ/SHBG)', target:'10-50 нмоль/л', when:'Каждые 8-12 нед', action:'Низкий SHBG → ↑ свободного T → ↑ ароматизации. Высокий SHBG → ↓ свободного T' },
                      { marker:'Пролактин', target:'{'<'}20 нг/мл', when:'Каждые 8-12 нед', action:'{'>'}20 — ↑ пролактина на 19-нор андрогенах (тренболон). Возможна галакторея' },
                      { marker:'ЛПВП (HDL)', target:'{'>'}1.0 ммоль/л', when:'Каждые 4-8 нед', action:'Анастрозол ↓ ЛПВП на 15-30%. При {'<'}1.0 — рассмотреть тамоксифен вместо АИ' },
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

            <div style={{ borderRadius:12, padding:12, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#f59e0b', marginBottom:4 }}>🔗 Перекрёстные предупреждения</div>
              <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.5 }}>
                • ❤️ <b>Кардио:</b> Анастрозол ↓ ЛПВП на 15-30% + ↑ ЛПНП на 10% — ухудшение липидного профиля. Тамоксифен — более безопасный профиль<br/>
                • 🦴 <b>Суставы:</b> Низкий E2 ({'<'}20) → суставные боли, крепитация. Отмена/снижение АИ. Добавить хондропротекторы<br/>
                • 🧠 <b>Нейро:</b> Низкий E2 → депрессия, ангедония, ↓ либидо. Восстановить E2 до {'>'}20 пг/мл<br/>
                • 🩸 <b>Гематология:</b> Тамоксифен ↑ риск тромбоза (редко, {'<'}1%). Контроль D-димера
              </div>
            </div>

          </InfoErrorBoundary>
  );
};
