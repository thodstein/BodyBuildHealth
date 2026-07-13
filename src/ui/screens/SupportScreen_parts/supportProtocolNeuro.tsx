// @ts-nocheck
import React, { useState } from 'react';
import { cardBg, pillActive, pillInactive, PhaseLabel, ItemRow, ItemRowTriage, triageBadge, phaseBadge, renderRow, renderPhase, timingBlock, monitoringBlock, StopBanner } from './supportProtocolsShared';
import { InfoErrorBoundary } from './SupportScreenData';

export const SupportProtocolNeuro: React.FC<{ s: Record<string, any> }> = ({ s }) => {
  const [neuroTab, setNeuroTab] = useState('protocol');
  return (
          <InfoErrorBoundary label="Нейропротекция">
            <div style={{ paddingBottom: 30, display:'flex', flexDirection:'column', gap:8 }}>
              {/* Header */}
              <div style={cardBg}>
                <div style={{ fontSize:13, fontWeight:800, color:'#06b6d4', marginBottom:2 }}>🧠 Нейротоксичность ААС</div>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Механизмы нейротоксичности, калькулятор риска и фазовый протокол нейропротекции.</p>
              </div>

              <ContraBanner items={[
                'Прегненолон/DHEA без контроля E2/T — риск гинекомастии (при E2 >60 пг/мл снизить дозу/отменить)',
                'Ноотропы (Семакс/Ноопепт/Кортексин/Бромантан) — рецептурные, только по назначению врача',
                'Не превышать дозы ГАМК-ергиков (агматин/таурин) при астме — риск бронхоспазма',
                'Пергамелон/L-теанин — не позже 16:00 (риск бессонницы)',
              ]} />

              <StopBanner title="Критические нейропороги — показание к отмене ААС" thresholds={[
                'Депрессия/тревога/агрессия тяжёлой степени или суицидальные мысли — отмена ААС, консультация психиатра',
                'Сумма симптомов ≥10 баллов — снижение доз ААС + невролог',
                'Галлюцинации/психоз/спутанность сознания — экстренная помощь',
              ]} />

              {/* Sub-tabs */}
              <div style={{ display:'flex', gap:4, overflowX:'auto', scrollbarWidth:'none' }}>
                {[
                  { id:'mechanisms', label:'🔬 Механизмы' },
                  { id:'calculator', label:'📊 Калькулятор риска' },
                  { id:'protocol', label:'💊 Фазы протокола' },
                  { id:'timing', label:'⏰ Тайминг приёма' },
                  { id:'diary', label:'📓 Дневник симптомов' },
                  { id:'monitoring', label:'🧪 Мониторинг' },
                ].map((t: any) => (
                  <button key={t.id} onClick={() => setNeuroTab(t.id)}
                    style={neuroTab === t.id ? pillActive('#06b6d4') : pillInactive()}>{t.label}</button>
                ))}
              </div>

              {/* Mechanisms */}
              {neuroTab === 'mechanisms' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#06b6d4', marginBottom:6 }}>🧠 Фундаментальные механизмы</div>
                    {[
                      { title:'Гематоэнцефалический барьер (ГЭБ)', desc:'Стероиды свободно проникают через ГЭБ. При супрафизиологических дозах ААС — нейротоксический каскад через повышение проницаемости (подавление клаудинов-5). Тренболон накапливается в гиппокампе, повышая проницаемость ГЭБ.', evidence:'A' },
                      { title:'Андрогенные и эстрогенные рецепторы мозга', desc:'AR-гиперстимуляция → окислительный стресс нейронов. ER-опосредованная нейропротекция утрачена при подавлении ароматазы. При низком E2 нейроны теряют ключевой механизм защиты.', evidence:'B' },
                      { title:'Негормональные механизмы', desc:'ГАМК-подавление, NMDA-эксайтотоксичность, митохондриальная дисфункция, BDNF-подавление, ионные каналы Ca²⁺, активация микроглии через TLR4.', evidence:'B' },
                    ].map((m: any, i: any) =>(
                      <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(6,182,212,0.04)', border:'1px solid rgba(6,182,212,0.12)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                          <span style={{ fontSize:9, fontWeight:700, color:'#22d3ee' }}>{m.title}</span>
                          <span style={{ fontSize:7, fontWeight:700, padding:'1px 5px', borderRadius:3, background:m.evidence==='A'?'rgba(34,197,94,0.15)':'rgba(245,158,11,0.15)', color:m.evidence==='A'?'#22c55e':'#f59e0b' }}>Уровень {m.evidence}</span>
                        </div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.4 }}>{m.desc}</div>
                      </div>
                    ))}
                  </div>
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#06b6d4', marginBottom:6 }}>🔬 Детальные механизмы (8 путей токсичности)</div>
                    {[
                      { title:'ГАМК-ергическая дисфункция', desc:'ААС повышают ГАМК-ергический тормозной тон через нейростероиды → подавление ГнРГ. Дисрегуляция GABA-A вызывает тревожность, депрессию при отмене. При хроническом воздействии — downregulation GABA-A рецепторов.' },
                      { title:'Окислительный стресс', desc:'Истощение глутатиона в гиппокампе, перекисное окисление липидов. Супероксид-дисмутаза снижена при нандролоне и станозололе. NADPH-оксидаза активирована.' },
                      { title:'Нейровоспаление', desc:'Активация микроглии через TLR4 → TNF-α, IL-1β, IL-6. NF-κB путь активирован. Хроническое воспаление в гиппокампе. Цитокиновый шторм при высоких дозах.' },
                      { title:'BDNF подавление', desc:'Нандролон и станозолол снижают BDNF на 30-50%. Нарушение CREB-BDNF-TrkB каскада → атрофия дендритных шипиков. Гиппокампальная нейропластичность нарушена.' },
                      { title:'Глутаматная эксайтотоксичность', desc:'ААС повышают глутамат → NMDA-рецепторы → Ca²⁺ influx → митохондриальная дисфункция → апоптоз. Кальпаин-опосредованная протеолиз → гибель нейронов.' },
                      { title:'Нарушение ГЭБ', desc:'Повышение проницаемости ГЭБ через подавление окклюдина, клаудина-5, ZO-1. Проникновение периферических цитокинов и токсинов в мозг.' },
                      { title:'Апоптоз нейронов', desc:'Каспаза-3 в CA1/CA3 гиппокампа. Фрагментация ДНК. Сдвиг Bax/Bcl-2 в проапоптотический путь. Апоптоз дофаминергических нейронов.' },
                      { title:'Дофаминовая система', desc:'Изменение D2-рецепторов в стриатуме → ангедония, агрессия. Мезокортикальный путь нарушен. DAT-транспортёр (дофамин) подавлен при нандролоне.' },
                    ].map((m: any, i: any) =>(
                      <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:4, background:'rgba(6,182,212,0.03)', border:'1px solid rgba(6,182,212,0.08)' }}>
                        <div style={{ fontSize:9, fontWeight:700, color:'#22d3ee', marginBottom:2 }}>{m.title}</div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.4 }}>{m.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Calculator */}
              {neuroTab === 'calculator' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#06b6d4', marginBottom:6 }}>⚠️ Классификация нейротоксичности ААС (шкала 1–10)</div>
                    {[
                      { name:'Тренболон', score:10, color:'#ef4444', desc:'Максимальная: ГЭБ + окислит. стресс + глутамат + апоптоз', ref:'Tucci 2010, Bertozzi 2017' },
                      { name:'Нандролон', score:8, color:'#ef4444', desc:'BDNF подавление, нейровоспаление, дофаминовая дисфункция', ref:'Kaufman 2019, Ricci 2012' },
                      { name:'Станозолол', score:7, color:'#f97316', desc:'ГАМК-дисфункция, BDNF ↓, выраженный оксидативный стресс', ref:'Turillazzi 2011' },
                      { name:'Метандиенон', score:6, color:'#f97316', desc:'Эстрогеновая активность + 17α-алкил → печёночный метаболит', ref:'Maravelias 2004' },
                      { name:'Болденон', score:5, color:'#f59e0b', desc:'Гематокрит (>52%) → гипоксия мозга, снижение кровотока', ref:'Hartgens 2004' },
                      { name:'Тестостерон >500 мг', score:4, color:'#f59e0b', desc:'AR-гиперстимуляция, нейростероидный дисбаланс', ref:'Kanayama 2010' },
                      { name:'Оксандролон', score:3, color:'#22c55e', desc:'Низкая андрогенность, минимальная нейротоксичность', ref:'Orr 2011' },
                      { name:'Мастерон', score:3, color:'#22c55e', desc:'DHT-производное, нейростероидный профиль', ref:'-' },
                      { name:'Примоболан', score:2, color:'#22c55e', desc:'Минимальная нейротоксичность, низкая андрогенность', ref:'-' },
                    ].map((drug: any, i: any) =>(
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                        <span style={{ flex:1, fontSize:8, color:'var(--text-light)' }}>{drug.name}</span>
                        <span style={{ fontSize:7, color:'var(--text-dim)', maxWidth:120, textAlign:'right', lineHeight:1.1 }}>{drug.desc}</span>
                        <span style={{ fontSize:9, fontWeight:800, color:drug.color, width:24, textAlign:'center' }}>{drug.score}</span>
                        <div style={{ width:50, height:3, borderRadius:2, background:'rgba(255,255,255,0.06)', overflow:'hidden' }}>
                          <div style={{ width:drug.score*10+'%', height:'100%', borderRadius:2, background:drug.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', marginBottom:6 }}>🩺 Симптомы нейротоксичности — шкала тяжести</div>
                    <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 6px', lineHeight:1.3 }}>При появлении любых симптомов — подключите нейропротекцию. При ≥3 симптомах — рассмотрите снижение доз.</p>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:6 }}>
                      {[
                        { s:'Депрессия', sev:'ТЯЖ', c:'#ef4444' },{ s:'Тревожность', sev:'СРЕД', c:'#f97316' },{ s:'Агрессия', sev:'ТЯЖ', c:'#ef4444' },
                        { s:'Нарушение сна', sev:'СРЕД', c:'#f97316' },{ s:'Когнитивное снижение', sev:'ТЯЖ', c:'#ef4444' },
                        { s:'Потеря памяти', sev:'ТЯЖ', c:'#ef4444' },{ s:'Ангедония', sev:'СРЕД', c:'#f97316' },
                        { s:'Импульсивность', sev:'ЛЁГК', c:'#f59e0b' },{ s:'Спутанность сознания', sev:'ТЯЖ', c:'#ef4444' },
                        { s:'Эмоц. нестабильность', sev:'ЛЁГК', c:'#f59e0b' },{ s:'Тремор', sev:'ЛЁГК', c:'#f59e0b' },{ s:'Головные боли', sev:'СРЕД', c:'#f97316' },
                      ].map((x: any, i: any) =>(
                        <span key={i} style={{ fontSize:8, padding:'4px 8px', borderRadius:10, background:x.c+'14', color:x.c, border:'1px solid '+x.c+'33' }}>{x.sev} {x.s}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Protocol phases */}
              {neuroTab === 'protocol' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {[
                    {
                      phase:'ФАЗА 1 · ЯДРО', label:'Обязательно всем на курсе ААС (любая доза)', color:'#22c55e',
                      condition:'Условие: курс ААС любой интенсивности',
                      desc:'Начинайте за 1 неделю ДО курса. Базовая нейропротекция закрывает окислительный стресс и ГАМК-дисбаланс. Эти вещества — фундамент; их отсутствие повышает риск окислительного стресса и ГАМК-дисбаланса, но не является единственной причиной нейротоксичности (она определяется дозой/классом ААС, ГЭБ-проницаемостью, длительностью).',
                      items:[
                        { name:'NAC', dose:'1200-2400 мг', timing:'Утро + Вечер', note:'Предшественник глутатиона. Только NAC проникает в мозг и восстанавливает нейрональный GSH' },
                        { name:'Omega-3 (EPA+DHA)', dose:'3-5 г', timing:'С едой', note:'DHA — структурный компонент мембран нейронов. EPA → резолвины → разрешение нейровоспаления' },
                        { name:'Mg L-Threonate', dose:'1000-2000 мг', timing:'Вечер', note:'Единственная форма Mg через ГЭБ. Модуляция NMDA-рецепторов, снижение эксайтотоксичности' },
                        { name:'Таурин', dose:'2-3 г', timing:'Утро + Вечер', note:'ГАМК-агонист, осморегуляция нейронов, блокада Ca²⁺-каналов' },
                        { name:'Глицин', dose:'3 г', timing:'На ночь', note:'Ко-агонист NMDA (защитный), улучшение сна, снижение кортизола' },
                      ]
                    },
                    {
                      phase:'ФАЗА 2 · БАЗА', label:'При дозах ААС >500 мг/нед или стаж >2 лет', color:'#f59e0b',
                      condition:'Условие: кумулятивная доза >500 мг/нед ИЛИ длительный стаж',
                      desc:'Добавляется при повышении дозировок. Митохондриальная поддержка и холинергическая защита. Ключевой рубеж — переход от профилактики к активной защите.',
                      items:[
                        { name:'Alpha-Lipoic Acid', dose:'600 мг', timing:'Утро натощак', note:'Митохондриальный антиоксидант, регенерирует GSH и вит.C/E. Проникает через ГЭБ' },
                        { name:'CoQ10 (убихинол)', dose:'200-400 мг', timing:'С жирной едой', note:'ЭТЦ митохондрий, снижение перекисного окисления. Убихинол > убихинон' },
                        { name:'Pregnenolone', dose:'10-30 мг', timing:'Утро', note:'Нейростероид — «материнский гормон». Восполняет подавленный синтез, модулирует GABA-A. ⚠ Контроль E2/T каждые 4 нед — при E2 >60 пг/мл или T >5 нг/мл снизить дозу/отменить' },
                        { name:'Агмантин', dose:'1-2 г', timing:'Утро натощак', note:'Модулятор NMDA (блокирует при избытке, активирует при дефиците). NO-донатор' },
                        { name:'Альфа-GPC', dose:'300-600 мг', timing:'Утро', note:'40% холина по весу (vs 14% в CDP-холине). Синтез ацетилхолина → когниции' },
                      ]
                    },
                    {
                      phase:'ФАЗА 3 · УСИЛЕНИЕ', label:'При тренболоне / нандролоне / станозололе', color:'#f97316',
                      condition:'Условие: в курсе присутствуют высоко-нейротоксичные ААС',
                      desc:'Специфическая защита от наиболее нейротоксичных соединений. Восстановление нейрогенеза и миелинизации.',
                      items:[
                        { name:'Lion\'s Mane (ежовик)', dose:'1-3 г', timing:'Утро', note:'Стимуляция NGF (фактор роста нервов). Нейрогенез в гиппокампе. Миелинизация' },
                        { name:'DHEA', dose:'25-50 мг', timing:'Утро', note:'Нейростероид. Восстановление GABA-A, снижение депрессии, повышение нейропластичности. ⚠ Контроль E2/T каждые 4 нед — при E2 >60 пг/мл или T >5 нг/мл снизить дозу/отменить' },
                        { name:'Phosphatidylserine', dose:'300-600 мг', timing:'Вечер', note:'Фосфолипид мембран нейронов. Снижение кортизола, поддержка текучести мембран' },
                        { name:'Ginkgo Biloba', dose:'120-240 мг', timing:'Утро', note:'Церебральный кровоток +25%, антиоксидант, ингибитор PAF. Стандартизация 24% гликозидов' },
                        { name:'Бромантан', dose:'50-100 мг', timing:'Утро', note:'Актопротектор. Повышение тирозина и серотонина в гипоталамусе. Нейропротекция' },
                        { name:'Фасорацетам', dose:'100-200 мг', timing:'Утро', note:'AMPA-позитивный модулятор, регуляция глутамата. Улучшение памяти +30% в тестах' },
                        { name:'Гуперзин А', dose:'50-100 мкг', timing:'Утро', note:'Ингибитор AChE. Повышение ацетилхолина на 40-60%. Нейропротективный эффект' },
                      ]
                    },
                    {
                      phase:'ФАЗА 4 · МАКСИМУМ', label:'При нейросимптомах любой тяжести', color:'#ef4444',
                      condition:'Условие: появление ≥1 симптома нейротоксичности',
                       desc:'Максимальный уровень защиты при появлении симптомов. Ноотропный компонент — восстановительная поддержка; специфическая доказательная база защиты именно от ААС-нейротоксичности ограничена, эффект экстраполирован из других областей. Ноотропы (Семакс, Кортексин, Ноопепт, Бромантан) — рецептурные, только по назначению врача.',
                      items:[
                        { name:'Bacopa Monnieri', dose:'300-600 мг', timing:'Утро', note:'Улучшение памяти, дендритное ветвление. Стандартизация 20% бакозидов. Эффект через 4-6 нед' },
                        { name:'L-Theanine', dose:'200-400 мг', timing:'Утро + Вечер', note:'ГАМК-модуляция. Повышение альфа-волн мозга. Снижение тревоги без седации' },
                        { name:'Citicoline', dose:'500-1000 мг', timing:'Утро', note:'Цитидин + холин. Синтез фосфатидилхолина мембран. Восстановление после ишемии' },
                        { name:'Noopept 💊', dose:'10-30 мг', timing:'Утро + День', note:'Циклопролилглицин. Повышение BDNF и NGF. Улучшение памяти и когниций. Рецептурно, по назначению врача' },
                        { name:'Семакс 💊', dose:'1-3 мг', timing:'Утро интраназально', note:'Пептид ACTH(4-7)-Pro-Gly-Pro. Повышение BDNF +30%. Нейрогенез. Ноотропный эффект. Рецептурно' },
                        { name:'Кортексин 💊', dose:'10 мг/день', timing:'Утро в/м', note:'Полипептиды коры мозга телят. Нейропротекция + нейрорепарация. Курс 10 дней. Рецептурно' },
                      ]
                    },
                  ].map((phase: any, pi: any) =>(
                    <div key={pi} style={{ ...cardBg, background:phase.color+'08', border:'1px solid '+phase.color+'22' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:6 }}>
                        <span style={{ fontSize:9, fontWeight:800, padding:'2px 8px', borderRadius:4, background:phase.color+'22', color:phase.color }}>{phase.phase}</span>
                        <span style={{ fontSize:10, fontWeight:600, color:phase.color, flex:1 }}>{phase.label}</span>
                      </div>
                      <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:6, lineHeight:1.4, padding:'6px 8px', borderRadius:6, background:'rgba(0,0,0,0.2)' }}>
                        <b style={{color:phase.color}}>{phase.condition}</b> — {phase.desc}
                      </div>
                      {phase.items.map((item: any, ii: any) =>(
                        <ItemRow key={ii} name={item.name} dose={item.dose} timing={item.timing} note={item.note} color={phase.color} />
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* Timing */}
              {neuroTab === 'timing' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#06b6d4', marginBottom:6 }}>⏰ Суточный тайминг нейропротекции</div>
                    <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Распределение по времени суток критично: одни вещества работают утром, другие — на ночь.</p>
                    {[
                      { time:'🌅 Утро (06:00–09:00)', color:'#f59e0b', items:[
                        { n:'NAC (600 мг)', why:'Пик оксидативного стресса — сразу после пробуждения. Натощак → быстрая абсорбция' },
                        { n:'Альфа-GPC (300 мг)', why:'Стимуляция ацетилхолина. Улучшение фокуса и внимания на тренировке' },
                        { n:'Lion\'s Mane (1 г)', why:'NGF стимуляция. Пик когнитивной активности утром' },
                        { n:'Pregnenolone (10-30 мг)', why:'Восполнение нейростероидов. Не принимать на ночь — может нарушить сон' },
                        { n:'DHEA (25-50 мг)', why:'Кортизол-противодействие. Пик кортизола — утренний' },
                        { n:'Bacopa (300 мг)', why:'Адаптоген, улучшение памяти. С едой для снижения ЖКТ-эффектов' },
                      ]},
                      { time:'☀️ День (12:00–14:00)', color:'#f97316', items:[
                        { n:'CoQ10 (200 мг)', why:'С жирной пищей (обед). Биодоступность +300% с жирами' },
                        { n:'Агмантин (1 г)', why:'Перед тренировкой. NO-донатор + NMDA-модулятор. Пампинг + нейропротекция' },
                        { n:'Noopept (10 мг)', why:'Пик умственной активности. Не после 16:00 — может мешать сну' },
                        { n:'Таурин (1 г)', why:'Осморегуляция, анти-эксайтотоксичность. За 30 мин до тренировки' },
                      ]},
                      { time:'🌆 Вечер (17:00–19:00)', color:'#8b5cf6', items:[
                        { n:'Omega-3 (3 г)', why:'С ужином. Жиры улучшают усвоение. EPA/DHA — структурная интеграция в мембраны' },
                        { n:'Фасорацетам (100 мг)', why:'AMPA-модуляция. Не позже 18:00 — стимулирует глутамат' },
                        { n:'Phosphatidylserine (300 мг)', why:'Снижение вечернего кортизола. Подготовка ко сну' },
                      ]},
                      { time:'🌙 Ночь (21:00–23:00)', color:'#6366f1', items:[
                        { n:'Mg L-Threonate (1000 мг)', why:'Пик абсорбции магния. NMDA-блокада. Глубокий сон' },
                        { n:'Глицин (3 г)', why:'Тормозной нейромедиатор. Снижение температуры тела → засыпание. NMDA-коагонист' },
                        { n:'L-Theanine (200 мг)', why:'Альфа-волны мозга. Снижение тревоги без седации. Качество сна' },
                        { n:'NAC (600 мг)', why:'Ночной пик окислительного стресса. Медленное высвобождение глутатиона' },
                        { n:'Гуперзин А (50 мкг)', why:'REM-сон консолидация памяти. Не превышать дозу — иначе бессонница' },
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
                </div>
              )}

              {/* Symptom diary */}
              {neuroTab === 'diary' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', marginBottom:6 }}>📓 Дневник нейросимптомов (еженедельный чек-лист)</div>
                    <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Заполняйте раз в неделю. При ≥5 баллов — переходите на ФАЗУ 4 протокола. При ≥10 баллов — рассмотрите снижение доз ААС.</p>
                    {[
                      { s:'Депрессия / подавленность', w:2 },{ s:'Тревожность / панические атаки', w:2 },
                      { s:'Агрессия / раздражительность', w:2 },{ s:'Бессонница / нарушение сна', w:2 },
                      { s:'Снижение концентрации', w:1 },{ s:'Провалы в памяти', w:2 },
                      { s:'Ангедония (ничего не радует)', w:2 },{ s:'Импульсивные решения', w:1 },
                      { s:'Головные боли', w:1 },{ s:'Эмоциональная нестабильность', w:1 },
                      { s:'Тремор / подёргивания', w:1 },{ s:'Спутанность сознания', w:2 },
                    ].map((x: any, i: any) =>(
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                        <span style={{ flex:1, fontSize:9, color:'var(--text-light)' }}>{x.s}</span>
                        <span style={{ fontSize:7, color:'var(--text-dim)', width:20, textAlign:'center' }}>×{x.w}</span>
                        {[0,1,2,3].map((v: any) =>(
                          <span key={v} style={{ width:24, height:24, borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, cursor:'pointer',
                            background: v===0?'rgba(34,197,94,0.15)':v===1?'rgba(245,158,11,0.15)':v===2?'rgba(249,115,22,0.15)':'rgba(239,68,68,0.15)',
                            color: v===0?'#22c55e':v===1?'#f59e0b':v===2?'#f97316':'#ef4444',
                            border:'1px solid '+(v===0?'rgba(34,197,94,0.3)':v===1?'rgba(245,158,11,0.3)':v===2?'rgba(249,115,22,0.3)':'rgba(239,68,68,0.3)')
                          }}>{v}</span>
                        ))}
                      </div>
                    ))}
                    <div style={{ marginTop:8, padding:'8px', borderRadius:6, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.15)' }}>
                      <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.4 }}>
                        <b style={{color:'#fca5a5'}}>Интерпретация баллов:</b><br/>
                        🟢 0-4 — норма, продолжайте ФАЗУ 1<br/>
                        🟡 5-9 — умеренные симптомы, подключите ФАЗУ 3<br/>
                        🔴 10+ — выраженные симптомы, ФАЗА 4 + консультация невролога
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Monitoring */}
              {neuroTab === 'monitoring' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>🧪 Лабораторный мониторинг нейротоксичности</div>
                    {[
                      { marker:'BDNF', what:'Нейротрофический фактор мозга', when:'Каждые 6-12 нед', target:'> 20 нг/мл', action:'При <15 нг/мл — Lion\'s Mane + Noopept + Семакс' },
                      { marker:'Кортизол (утренний)', what:'Гиперкортизолемия → нейротоксичность', when:'Каждые 4 нед', target:'10-20 мкг/дл', action:'При >25 — Phosphatidylserine + Ashwagandha + DHEA' },
                      { marker:'Пролактин', what:'Гиперпролактинемия → депрессия', when:'Каждые 4 нед', target:'< 15 нг/мл', action:'При >20 — P5P (B6) 100-200 мг + каберголин' },
                      { marker:'DHEA-S', what:'Резерв нейростероидов', when:'Каждые 8 нед', target:'200-500 мкг/дл', action:'При <150 — DHEA 25-50 мг + Pregnenolone 30 мг' },
                      { marker:'Гомоцистеин', what:'Нейротоксическая аминокислота', when:'Каждые 8 нед', target:'< 10 мкмоль/л', action:'При >12 — метилфолат + B12 + TMG' },
                      { marker:'Витамин B12', what:'Миелинизация нейронов', when:'Каждые 12 нед', target:'> 400 пг/мл', action:'При <300 — метилкобаламин 1000-5000 мкг/день' },
                      { marker:'Ферритин', what:'Накопление железа → оксидативный стресс', when:'Каждые 8 нед', target:'50-150 нг/мл', action:'При >300 — донация крови + IP6' },
                    ].map((m: any, i: any) =>(
                      <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(59,130,246,0.04)', border:'1px solid rgba(59,130,246,0.08)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                          <span style={{ fontSize:9, fontWeight:700, color:'#60a5fa' }}>{m.marker}</span>
                          <span style={{ fontSize:8, fontWeight:600, color:'#3b82f6' }}>{m.when}</span>
                        </div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:4 }}>{m.what} — <b style={{color:'#60a5fa'}}>Цель: {m.target}</b></div>
                        <div style={{ fontSize:7, color:'#93c5fd', lineHeight:1.3, padding:'4px 6px', borderRadius:4, background:'rgba(59,130,246,0.06)' }}>💡 {m.action}</div>
                      </div>
                    ))}
                  </div>
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#a855f7', marginBottom:6 }}>🔬 Инструментальные методы</div>
                    {[
                      { name:'Нейропсихологическое тестирование', freq:'Каждые 3-6 мес', note:'Батарея тестов: память, внимание, скорость реакции, исполнительные функции' },
                      { name:'ЭЭГ (электроэнцефалография)', freq:'При симптомах', note:'Выявление эпилептиформной активности, нарушений ритмов (альфа/бета/дельта)' },
                      { name:'МРТ головного мозга', freq:'При стойких симптомах >8 нед', note:'Оценка объёма гиппокампа, признаков атрофии, микрокровоизлияний' },
                      { name:'Полисомнография', freq:'При нарушениях сна', note:'Архитектура сна, REM-латентность, апноэ (часто при ААС)' },
                    ].map((x: any, i: any) =>(
                      <div key={i} style={{ padding:'6px 8px', borderRadius:6, marginBottom:4, background:'rgba(168,85,247,0.04)', border:'1px solid rgba(168,85,247,0.08)', fontSize:8 }}>
                        <div style={{ fontWeight:600, color:'#c084fc' }}>{x.name} — {x.freq}</div>
                        <div style={{ color:'var(--text-dim)', marginTop:2 }}>{x.note}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </InfoErrorBoundary>
  );
};
