// @ts-nocheck
import React, { useState } from 'react';
import { cardBg, pillActive, pillInactive, PhaseLabel, ItemRow, ItemRowTriage, triageBadge, phaseBadge, renderRow, renderPhase, timingBlock, monitoringBlock } from './supportProtocolsShared';
import { InfoErrorBoundary } from './SupportScreenData';

export const SupportProtocolInjections: React.FC<{ s: Record<string, any> }> = ({ s }) => {
  const [injectionTab, setInjectionTab] = useState('map');
  return (
          <InfoErrorBoundary label="Инъекции">
            <div className="sup-proto-inj" style={{ paddingBottom: 30, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={cardBg}>
                <div style={{ fontSize:13, fontWeight:800, color:'#14b8a6', marginBottom:2 }}>💉 Карта инъекций · Техника · Ошибки и правила</div>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Карта ротации зон для локальных и общих инъекций. Техника безопасности. Частые ошибки и их предотвращение.</p>
              </div>

              {/* Sub-tabs */}
              <div style={{ display:'flex', gap:4, overflowX:'auto', scrollbarWidth:'none' }}>
                {[
                  { id:'map', label:'🗺 Карта зон' },
                  { id:'general', label:'💉 Техника' },
                  { id:'sterility', label:'🧪 Стерильность' },
                  { id:'needles', label:'📏 Иглы/шприцы' },
                  { id:'complications', label:'🩺 Осложнения' },
                  { id:'errors', label:'⚠ Ошибки' },
                ].map((t: any) => (
                  <button key={t.id} onClick={() => setInjectionTab(t.id)}
                    style={injectionTab === t.id ? pillActive('#14b8a6') : pillInactive()}>{t.label}</button>
                ))}
              </div>

              {/* ══════ КАРТА ЗОН ══════ */}
              {injectionTab === 'map' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {/* Header */}
                  <div style={cardBg}>
                    <div style={{ fontSize:13, fontWeight:800, color:'#14b8a6', marginBottom:4 }}>🗺 Карта зон инъекций: полный анатомический атлас</div>
                    <p style={{ fontSize:8, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Подробное описание каждой зоны с анатомическими ориентирами, техникой поиска, допустимыми объёмами и комментариями по безопасности. Ротация критична: <b>минимум 7 дней отдыха</b> на каждую зону.</p>
                  </div>

                  {/* ═══ Zone 1: Glutes ═══ */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#14b8a6', marginBottom:2 }}>🍑 1. ЯГОДИЦЫ (дорсальная) — верхне-наружный квадрант</div>
                    <div style={{ fontSize:7, fontWeight:600, color:'#2dd4bf', marginBottom:6 }}>Gluteus Maximus · Dorsogluteal Site</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(20,184,166,0.03)', border:'1px solid rgba(20,184,166,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#5eead4' }}>📍 Анатомические ориентиры:</span>
                        <span style={{ color:'var(--text-dim)' }}> Разделите ягодицу на 4 квадранта крестом (вертикаль через центр, горизонталь через гребень подвздошной кости). <b>ТОЛЬКО верхне-наружный квадрант.</b> Остальные 3 — ОПАСНО (седалищный нерв проходит через нижние квадранты).</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(20,184,166,0.03)', border:'1px solid rgba(20,184,166,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#5eead4' }}>🔍 Как найти:</span>
                        <span style={{ color:'var(--text-dim)' }}> Положите ладонь на большой вертел бедренной кости (костный выступ сбоку бедра). Большой палец направьте к паху. Указательный — к гребню подвздошной кости. Зона между пальцами — безопасное окно.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(20,184,166,0.03)', border:'1px solid rgba(20,184,166,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#5eead4' }}>📐 Подзоны (4):</span>
                        <span style={{ color:'var(--text-dim)' }}> Верхне-наружная / Верхне-внутренняя / Нижне-наружная / Нижне-внутренняя. Ротируйте подзоны каждые 2 инъекции для максимального отдыха ткани.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(20,184,166,0.03)', border:'1px solid rgba(20,184,166,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#5eead4' }}>💉 Параметры:</span>
                        <span style={{ color:'var(--text-dim)' }}> Игла <b>21-23G × 1.5" (40 мм)</b>. Угол <b>90°</b>. Макс. объём <b>5 мл</b>. В/м.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.1)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#fbbf24' }}>💬 Комментарий:</span>
                        <span style={{ color:'var(--text-dim)' }}> Самая безопасная и вместительная зона. Идеальна для масляных растворов и больших объёмов (до 5 мл). При самостоятельной инъекции — лягте на бок, верхнюю ногу согните. Это расслабляет ягодичную мышцу и снижает боль. Если объём превышает 3 мл — рассмотрите разделение на 2 инъекции (разные подзоны).</span>
                      </div>
                    </div>
                  </div>

                  {/* ═══ Zone 2: Ventrogluteal ═══ */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#a855f7', marginBottom:2 }}>🍑 2. ВЕНТРО-ЯГОДИЧНАЯ ОБЛАСТЬ</div>
                    <div style={{ fontSize:7, fontWeight:600, color:'#c084fc', marginBottom:6 }}>Ventrogluteal Site · Gluteus Medius & Minimus</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(168,85,247,0.03)', border:'1px solid rgba(168,85,247,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#c084fc' }}>📍 Анатомические ориентиры:</span>
                        <span style={{ color:'var(--text-dim)' }}> Боковая поверхность таза. Не путать с дорсальной ягодицей! Зона находится <b>спереди-сбоку</b> от бедра, а не сзади.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(168,85,247,0.03)', border:'1px solid rgba(168,85,247,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#c084fc' }}>🔍 V-метод (как найти):</span>
                        <span style={{ color:'var(--text-dim)' }}> Положите ладонь ПРАВОЙ руки на ЛЕВЫЙ большой вертел (для левой стороны). Указательный палец — на переднюю верхнюю подвздошную ость (ASIS). Средний палец разведите максимально в сторону — он укажет на гребень подвздошной кости. <b>Треугольник между указательным и средним пальцами</b> — безопасная зона инъекции.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(168,85,247,0.03)', border:'1px solid rgba(168,85,247,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#c084fc' }}>💉 Параметры:</span>
                        <span style={{ color:'var(--text-dim)' }}> Игла <b>21-23G × 1.5" (40 мм)</b>. Угол <b>90°</b>. Макс. объём <b>4 мл</b>. В/м.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.1)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#fbbf24' }}>💬 Комментарий:</span>
                        <span style={{ color:'var(--text-dim)' }}> ПРЕДПОЧТИТЕЛЬНАЯ альтернатива дорсальной ягодице. Меньше жировой прослойки — игла гарантированно доходит до мышцы. Седалищный нерв проходит ЗНАЧИТЕЛЬНО дальше — риск его повреждения практически нулевой. Рекомендована ВОЗ как зона первого выбора для в/м инъекций. Единственный минус: сложнее колоть самому себе (нужна практика V-метода).</span>
                      </div>
                    </div>
                  </div>

                  {/* ═══ Zone 3: Quads ═══ */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:2 }}>🦵 3. КВАДРИЦЕПСЫ — латеральная головка</div>
                    <div style={{ fontSize:7, fontWeight:600, color:'#60a5fa', marginBottom:6 }}>Vastus Lateralis · Lateral Thigh</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(59,130,246,0.03)', border:'1px solid rgba(59,130,246,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#93c5fd' }}>📍 Анатомические ориентиры:</span>
                        <span style={{ color:'var(--text-dim)' }}> <b>ТОЛЬКО наружная (латеральная) поверхность бедра.</b> Границы: от ладони ниже тазобедренного сустава до ладони выше колена. Ширина: от средней линии бедра до наружного края.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(59,130,246,0.03)', border:'1px solid rgba(59,130,246,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#93c5fd' }}>🔍 Как найти:</span>
                        <span style={{ color:'var(--text-dim)' }}> Сядьте, вытяните ногу. Разделите бедро мысленно на 3 трети по длине. <b>Средняя треть</b> — оптимальная зона. Верхняя — риск тазобедренного сустава. Нижняя — близко к коленному суставу. Отступайте на 2 пальца от средней линии бедра кнаружи.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(59,130,246,0.03)', border:'1px solid rgba(59,130,246,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#93c5fd' }}>⚠️ ОПАСНЫЕ ЗОНЫ:</span>
                        <span style={{ color:'#ff6b6b' }}> ❌ Передняя поверхность — бедренный нерв и артерия. ❌ Внутренняя (медиальная) — бедренная артерия и вена. ❌ Задняя — седалищный нерв. Только латеральная поверхность!</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(59,130,246,0.03)', border:'1px solid rgba(59,130,246,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#93c5fd' }}>💉 Параметры:</span>
                        <span style={{ color:'var(--text-dim)' }}> Игла <b>23-25G × 1" (25 мм)</b>. Угол <b>90°</b> для в/м, <b>45°</b> для п/к. Макс. объём <b>3 мл</b>. Тонкие иглы (25G) предпочтительны — меньше травма.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.1)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#fbbf24' }}>💬 Комментарий:</span>
                        <span style={{ color:'var(--text-dim)' }}> Самая удобная зона для самостоятельных инъекций — сидя, нога расслаблена. Новичкам лучше начинать именно с бедра. Масляные растворы могут давать PIP (post-injection pain) на 1-2 дня — это нормально. Если боль не проходит через 3 дня или усиливается — проверьте на инфекцию. Не колоть в день тренировки ног (усиливает боль и воспаление).</span>
                      </div>
                    </div>
                  </div>

                  {/* ═══ Zone 4: Delts ═══ */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#22c55e', marginBottom:2 }}>💪 4. ДЕЛЬТОВИДНАЯ МЫШЦА</div>
                    <div style={{ fontSize:7, fontWeight:600, color:'#4ade80', marginBottom:6 }}>Deltoid · Intramuscular Shoulder</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(34,197,94,0.03)', border:'1px solid rgba(34,197,94,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#86efac' }}>📍 Анатомические ориентиры:</span>
                        <span style={{ color:'var(--text-dim)' }}> <b>Центр мышечного брюшка дельты.</b> Границы: акромион (костный выступ плеча) сверху, дельтовидная бугристость плечевой кости снизу. Боковая поверхность плеча.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(34,197,94,0.03)', border:'1px solid rgba(34,197,94,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#86efac' }}>🔍 Как найти:</span>
                        <span style={{ color:'var(--text-dim)' }}> Опустите руку свободно вниз. Найдите акромион (самую верхнюю точку плеча). Опуститесь на <b>2-3 пальца (3-5 см) ниже</b>. Центр образовавшегося мышечного брюшка — точка вкола. Слишком высоко = риск субакромиального бурсита и повреждения сустава. Слишком низко = лучевой нерв (в средней трети плеча).</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(34,197,94,0.03)', border:'1px solid rgba(34,197,94,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#86efac' }}>⚠️ Важно:</span>
                        <span style={{ color:'var(--text-dim)' }}> При перекачанных дельтах мышца уплотняется — может потребоваться игла 1" вместо 5/8". Если чувствуете кость — игла слишком короткая/неправильный угол. У худощавых людей дельта может быть тонкой — используйте иглу 5/8" и угол 90°.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(34,197,94,0.03)', border:'1px solid rgba(34,197,94,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#86efac' }}>💉 Параметры:</span>
                        <span style={{ color:'var(--text-dim)' }}> Игла <b>25-27G × 5/8"-1" (16-25 мм)</b>. Угол <b>90°</b>. Макс. объём <b>2 мл</b>. В/м. Тонкая игла обязательна.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.1)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#fbbf24' }}>💬 Комментарий:</span>
                        <span style={{ color:'var(--text-dim)' }}> Зона МАЛОГО объёма. Не пытайтесь ввести &gt;2 мл — боль, отёк, риск повреждения сустава и нерва. Для масляных растворов объёмом &gt;1 мл лучше выбрать бедро или ягодицу. Самостоятельная инъекция в дельту не очень удобна (одна рука держит шприц, вторая расслаблена). Можно выполнять стоя перед зеркалом или сидя, опираясь локтем на стол. Не колоть в день тренировки плеч.</span>
                      </div>
                    </div>
                  </div>

                  {/* ═══ Zone 5: Lats ═══ */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#f97316', marginBottom:2 }}>🔙 5. ШИРОЧАЙШАЯ МЫШЦА СПИНЫ</div>
                    <div style={{ fontSize:7, fontWeight:600, color:'#fb923c', marginBottom:6 }}>Latissimus Dorsi · Subaxillary Site</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(249,115,22,0.03)', border:'1px solid rgba(249,115,22,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#fdba74' }}>📍 Анатомические ориентиры:</span>
                        <span style={{ color:'var(--text-dim)' }}> Задняя стенка подмышечной впадины. Широкая мышца, идущая от поясницы к плечу. Подмышечная складка — задняя её часть образована широчайшей мышцей.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(249,115,22,0.03)', border:'1px solid rgba(249,115,22,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#fdba74' }}>🔍 Как найти:</span>
                        <span style={{ color:'var(--text-dim)' }}> Заведите руку за голову — широчайшая напрягается. Точка вкола: подмышечная складка сзади, в верхней трети мышцы. Ближе к подмышке = толще мышца = безопаснее. Ниже середины спины = тоньше мышца = риск пневмоторакса.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.1)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#fca5a5' }}>⚠ КРИТИЧЕСКИ:</span>
                        <span style={{ color:'#ff6b6b' }}> ТОЛЬКО верхняя треть мышцы. Ниже — плевра и лёгкое. Слишком глубокий вкол = пневмоторакс (прокол лёгкого). При резкой боли в груди + одышке после инъекции — немедленно в больницу!</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(249,115,22,0.03)', border:'1px solid rgba(249,115,22,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#fdba74' }}>💉 Параметры:</span>
                        <span style={{ color:'var(--text-dim)' }}> Игла <b>25-27G × 5/8" (16 мм)</b>. Угол <b>90°</b>. Макс. объём <b>2 мл</b>. Только тонкие иглы. В/м.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.1)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#fbbf24' }}>💬 Комментарий:</span>
                        <span style={{ color:'var(--text-dim)' }}> Зона для ОПЫТНЫХ. Хорошая ротационная альтернатива, когда ягодицы/бёдра/дельты перегружены. Самостоятельно колоть сложно — нужна помощь. Если нет опыта — лучше использовать другие зоны. Не рекомендуется для масляных растворов объёмом более 1 мл — риск образования кисты в труднодоступном месте.</span>
                      </div>
                    </div>
                  </div>

                  {/* ═══ Zone 6: Pecs ═══ */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#ec4899', marginBottom:2 }}>🏋️ 6. БОЛЬШАЯ ГРУДНАЯ МЫШЦА (ЛОКАЛЬНАЯ)</div>
                    <div style={{ fontSize:7, fontWeight:600, color:'#f472b6', marginBottom:6 }}>Pectoralis Major · Chest Site · Spot Injection</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(236,72,153,0.03)', border:'1px solid rgba(236,72,153,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#f9a8d4' }}>📍 Анатомические ориентиры:</span>
                        <span style={{ color:'var(--text-dim)' }}> Верхне-наружная часть грудной мышцы. Точка: на 2 пальца ниже ключицы и на 3 пальца кнутри от плечевого сустава (дельтовидно-грудная борозда). Самая мясистая часть.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(236,72,153,0.03)', border:'1px solid rgba(236,72,153,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#f9a8d4' }}>🔍 Как найти:</span>
                        <span style={{ color:'var(--text-dim)' }}> Поднимите руку на 90° и напрягите грудную. Точка вкола — между верхней и средней третью мышцы по горизонтали и на 2-3 пальца отступив от подмышки к центру груди.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.1)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#fca5a5' }}>⚠ ОПАСНО:</span>
                        <span style={{ color:'#ff6b6b' }}> Не колоть в нижнюю треть (молочная железа у мужчин — гинекомастия). Не колоть в среднюю линию груди (грудина, сердце). Не заходить глубже 1.5 см (плевра и лёгкое). При появлении кашля/одышки после инъекции — срочно к врачу.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(236,72,153,0.03)', border:'1px solid rgba(236,72,153,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#f9a8d4' }}>💉 Параметры:</span>
                        <span style={{ color:'var(--text-dim)' }}> Игла <b>25-27G × 5/8" (16 мм)</b>. Угол <b>90°</b>. Макс. объём <b>1.5 мл</b>. ТОЛЬКО водные растворы и тонкие масла. В/м.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.1)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#fbbf24' }}>💬 Комментарий:</span>
                        <span style={{ color:'var(--text-dim)' }}> Локальная инъекция для site-enhancement. НЕ для системного курса (масляные депо слишком близко к жизненно важным структурам). Часто используется с водными препаратами (водная суспензия тестостерона, Winstrol водный) для локального эффекта. Самостоятельная инъекция возможна, но требует осторожности. Высокий риск гематом (грудная мышца хорошо кровоснабжается).</span>
                      </div>
                    </div>
                  </div>

                  {/* ═══ Zone 7: Traps ═══ */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#f59e0b', marginBottom:2 }}>🏔 7. ТРАПЕЦИЕВИДНАЯ МЫШЦА (ЛОКАЛЬНАЯ)</div>
                    <div style={{ fontSize:7, fontWeight:600, color:'#fbbf24', marginBottom:6 }}>Trapezius · Upper Back · Spot Injection</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(245,158,11,0.03)', border:'1px solid rgba(245,158,11,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#fcd34d' }}>📍 Анатомические ориентиры:</span>
                        <span style={{ color:'var(--text-dim)' }}> Верхняя порция трапеции. Точка вкола: центр мышечного брюшка между шеей и плечевым суставом. Мысленная линия от затылка до акромиона — на середине этой линии.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(245,158,11,0.03)', border:'1px solid rgba(245,158,11,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#fcd34d' }}>🔍 Как найти:</span>
                        <span style={{ color:'var(--text-dim)' }}> Пожмите плечами — трапеция напрягается и становится заметной. Выберите самую толстую часть мышцы. Отступите 2 пальца от позвоночника (остистые отростки) и 2 пальца от шеи.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.1)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#fca5a5' }}>⚠ ОПАСНО:</span>
                        <span style={{ color:'#ff6b6b' }}> Не колоть близко к шее (шейное сплетение, сонная артерия). Не колоть близко к позвоночнику. Глубина не более 1.5 см (под трапецией — рёбра и лёгкое). Объём не более 1 мл.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(245,158,11,0.03)', border:'1px solid rgba(245,158,11,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#fcd34d' }}>💉 Параметры:</span>
                        <span style={{ color:'var(--text-dim)' }}> Игла <b>27-29G × 1/2" (13 мм)</b>. Угол <b>90°</b>. Макс. объём <b>1 мл</b>. ТОЛЬКО водные. П/к или поверхностный в/м.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.1)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#fbbf24' }}>💬 Комментарий:</span>
                        <span style={{ color:'var(--text-dim)' }}> Высокорисковая локальная зона. Только для водных препаратов малого объёма (0.5-1 мл). Самостоятельно — через зеркало или с помощником. При попадании в нервное сплетение — острая боль в руку. При боли — немедленно извлечь. Начинающим НЕ рекомендуется.</span>
                      </div>
                    </div>
                  </div>

                  {/* ═══ Zone 8: Triceps ═══ */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#06b6d4', marginBottom:2 }}>💪 8. ТРИЦЕПС (ЛОКАЛЬНАЯ)</div>
                    <div style={{ fontSize:7, fontWeight:600, color:'#22d3ee', marginBottom:6 }}>Triceps Brachii · Lateral Head · Spot Injection</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(6,182,212,0.03)', border:'1px solid rgba(6,182,212,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#67e8f9' }}>📍 Анатомические ориентиры:</span>
                        <span style={{ color:'var(--text-dim)' }}> Латеральная (наружная) головка трицепса. Задняя поверхность плеча, наружная часть. Точка: середина между локтём и плечевым суставом по наружному краю.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(6,182,212,0.03)', border:'1px solid rgba(6,182,212,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#67e8f9' }}>🔍 Как найти:</span>
                        <span style={{ color:'var(--text-dim)' }}> Согните руку в локте на 90° и напрягите трицепс (как при разгибании). Визуально определяется подковообразная мышца. Латеральная головка — наружная часть этой подковы. Точка вкола — середина по высоте.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(6,182,212,0.03)', border:'1px solid rgba(6,182,212,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#67e8f9' }}>⚠️ Важно:</span>
                        <span style={{ color:'var(--text-dim)' }}> На внутренней поверхности плеча проходит лучевой нерв (в спиральном канале). Держитесь строго наружной поверхности. Средняя и нижняя треть безопаснее верхней (близко к подмышечному нерву).</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(6,182,212,0.03)', border:'1px solid rgba(6,182,212,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#67e8f9' }}>💉 Параметры:</span>
                        <span style={{ color:'var(--text-dim)' }}> Игла <b>25-27G × 5/8" (16 мм)</b>. Угол <b>90°</b>. Макс. объём <b>1.5 мл</b>. Водные + лёгкие масляные. В/м.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.1)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#fbbf24' }}>💬 Комментарий:</span>
                        <span style={{ color:'var(--text-dim)' }}> Удобная локальная зона. Самостоятельная инъекция возможна: согните руку и упритесь локтем в колено (поза «задумчивый»). Масляные растворы — осторожно, склонность к PIP и затяжным болям. Чередуйте левую и правую руку.</span>
                      </div>
                    </div>
                  </div>

                  {/* ═══ Zone 9: Biceps ═══ */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', marginBottom:2 }}>💪 9. БИЦЕПС (ЛОКАЛЬНАЯ)</div>
                    <div style={{ fontSize:7, fontWeight:600, color:'#f87171', marginBottom:6 }}>Biceps Brachii · Spot Injection</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(239,68,68,0.03)', border:'1px solid rgba(239,68,68,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#fca5a5' }}>📍 Анатомические ориентиры:</span>
                        <span style={{ color:'var(--text-dim)' }}> Двуглавая мышца плеча. Передняя поверхность плеча. Точка: центр мышечного брюшка (средняя треть по высоте). При напряжении — заметное утолщение.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(239,68,68,0.03)', border:'1px solid rgba(239,68,68,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#fca5a5' }}>🔍 Как найти:</span>
                        <span style={{ color:'var(--text-dim)' }}> Согните руку на 90° и напрягите бицепс. Определите центр брюшка. Точка — наружная сторона бицепса (ближе к плечевой кости, а не к внутренней стороне, где проходит сосудисто-нервный пучок).</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.1)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#fca5a5' }}>⚠ ОЧЕНЬ ОПАСНО:</span>
                        <span style={{ color:'#ff6b6b' }}> Самая рисковая локальная зона. Маленький объём мышцы, много нервов и сосудов. НЕ ДЛЯ НАЧИНАЮЩИХ. Попадание в срединный нерв = паралич сгибания пальцев.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(239,68,68,0.03)', border:'1px solid rgba(239,68,68,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#fca5a5' }}>💉 Параметры:</span>
                        <span style={{ color:'var(--text-dim)' }}> Игла <b>27-29G × 1/2" (13 мм)</b>. Угол <b>90°</b>. Макс. объём <b>1 мл</b>. ТОЛЬКО водные препараты. Поверхностный в/м или глубокая п/к.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.1)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#fbbf24' }}>💬 Комментарий:</span>
                        <span style={{ color:'var(--text-dim)' }}> Экстремально рисковая зона. Оправдана ТОЛЬКО при необходимости site-enhancement (предсоревновательная подготовка). Не используйте для системных курсов. Самостоятельная инъекция — через зеркало, рука согнута. При малейшем онемении или простреле в пальцы — немедленно извлечь иглу. Повреждение нерва может быть необратимым.</span>
                      </div>
                    </div>
                  </div>

                  {/* ═══ Zone 10: Calves ═══ */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#8b5cf6', marginBottom:2 }}>🦵 10. ИКРОНОЖНЫЕ МЫШЦЫ (ЛОКАЛЬНАЯ)</div>
                    <div style={{ fontSize:7, fontWeight:600, color:'#a78bfa', marginBottom:6 }}>Gastrocnemius · Calves · Spot Injection</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(139,92,246,0.03)', border:'1px solid rgba(139,92,246,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#c4b5fd' }}>📍 Анатомические ориентиры:</span>
                        <span style={{ color:'var(--text-dim)' }}> Икроножная мышца. Задняя поверхность голени. Точка вкола: верхняя треть медиальной (внутренней) головки. Мышца здесь наиболее толстая.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(139,92,246,0.03)', border:'1px solid rgba(139,92,246,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#c4b5fd' }}>🔍 Как найти:</span>
                        <span style={{ color:'var(--text-dim)' }}> Встаньте на носок — икроножная напрягается. Точка: внутренняя головка (медиальная), верхняя треть, самый толстый участок. Отступайте 1-2 см от средней линии голени кнутри.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.1)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#fca5a5' }}>⚠ ОЧЕНЬ БОЛЬНО:</span>
                        <span style={{ color:'#ff6b6b' }}> Самая болезненная зона. Плотная фасция + мало места = сильный PIP. Масляные растворы ВЫЗЫВАЮТ СИЛЬНУЮ БОЛЬ. Риск компартмент-синдрома (сдавление сосудов и нервов в фасциальном футляре).</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(139,92,246,0.03)', border:'1px solid rgba(139,92,246,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#c4b5fd' }}>💉 Параметры:</span>
                        <span style={{ color:'var(--text-dim)' }}> Игла <b>25-27G × 5/8" (16 мм)</b>. Угол <b>90°</b>. Макс. объём <b>1 мл</b>. ТОЛЬКО водные препараты. В/м.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.1)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#fbbf24' }}>💬 Комментарий:</span>
                        <span style={{ color:'var(--text-dim)' }}> Только для опытных и только водные растворы. Никогда не используйте масляные препараты в икры — боль может быть настолько сильной, что вы не сможете ходить 3-5 дней. Компартмент-синдром — редкое, но серьёзное осложнение (требует хирургической фасциотомии). При нарастающей распирающей боли в икре после инъекции — немедленно к врачу.</span>
                      </div>
                    </div>
                  </div>

                  {/* ═══ 8-week rotation schedule (expanded) ═══ */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#f59e0b', marginBottom:6 }}>📅 Полный график ротации (8-недельный цикл, 2 инъекции/нед)</div>
                    <p style={{ fontSize:7, color:'var(--text-dim)', margin:'0 0 6px', lineHeight:1.3 }}>Каждая зона получает минимум 7 дней отдыха. При 3+ инъекциях в неделю — добавьте локальные зоны (грудь, трицепс) в ротацию для расширения цикла.</p>
                    <div style={{ overflowX:'auto' }}>
                      <table style={{ width:'100%', fontSize:8, borderCollapse:'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom:'1px solid var(--border)' }}>
                            <th style={{ padding:4, color:'var(--text-dim)', textAlign:'left', fontWeight:600 }}>Неделя</th>
                            <th style={{ padding:4, color:'#60a5fa', textAlign:'left', fontWeight:600 }}>Инъекция 1</th>
                            <th style={{ padding:4, color:'#f472b6', textAlign:'left', fontWeight:600 }}>Инъекция 2</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            ['Нед 1','Правая ягодица (в/н квадрант)','Левое бедро (латеральная, середина)'],
                            ['Нед 2','Левая ягодица (в/н квадрант)','Правое бедро (латеральная, середина)'],
                            ['Нед 3','Правая дельта','Левая вентро-ягодичная'],
                            ['Нед 4','Левая дельта','Правая вентро-ягодичная'],
                            ['Нед 5','Правая ягодица (в/вн квадрант)','Левое бедро (латеральная, верх)'],
                            ['Нед 6','Левая ягодица (в/вн квадрант)','Правое бедро (латеральная, верх)'],
                            ['Нед 7','Правая грудь (верхне-наружная)','Левый трицепс (латеральная)'],
                            ['Нед 8','Левая грудь (верхне-наружная)','Правый трицепс (латеральная)'],
                          ].map((r: any, i: any) =>(
                            <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                              <td style={{ padding:5, color:'var(--text-light)', fontWeight:600 }}>{r[0]}</td>
                              <td style={{ padding:5, color:'#93c5fd' }}>{r[1]}</td>
                              <td style={{ padding:5, color:'#f9a8d4' }}>{r[2]}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* ═══ Zone status tracking (expanded) ═══ */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#22c55e', marginBottom:6 }}>📊 Дневник состояния зон инъекций</div>
                    <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>При появлении любых отклонений — исключайте зону из ротации на 2-4 недели. <b>Никогда не колите в зону с признаками воспаления.</b></p>
                    {[
                      { zone:'Ягодицы (дорсальные)', freq:'Каждые 7-10 дн', indicators:['OK','Уплотнение','Боль','Гематома','Инфильтрат','Абсцесс'],
                        actions:'Тёплый компресс 15 мин × 3 р/день. Гепариновая мазь. При уплотнении >5 дней без признаков инфекции — лёгкий массаж.' },
                      { zone:'Вентро-ягодичные', freq:'Каждые 7-10 дн', indicators:['OK','Уплотнение','Боль','Гематома'],
                        actions:'При боли >2 дней: проверьте технику V-метода. Возможно, попали в надкостницу или слишком глубоко.' },
                      { zone:'Квадрицепсы (латеральные)', freq:'Каждые 7-10 дн', indicators:['OK','Уплотнение','Боль','Гематома','Инфильтрат','Онемение'],
                        actions:'При онемении: НЕМЕДЛЕННО исключить. Возможно задели ветвь бедренного нерва. Проверьте, не ушли ли на переднюю поверхность.' },
                      { zone:'Дельты', freq:'Каждые 7-10 дн', indicators:['OK','Уплотнение','Боль','Гематома','Отёк','Ограничение движения'],
                        actions:'При ограничении: исключить на 3-4 нед. НПВС местно. Проверить объём инъекции (не >2 мл).' },
                      { zone:'Грудные (локальные)', freq:'Каждые 14 дн', indicators:['OK','Уплотнение','Боль','Гематома','Шишка'],
                        actions:'Высокий риск гематом. При «шишке» >3 дней — исключить зону на 4 нед. Тёплый компресс. Проверить на инфекцию.' },
                      { zone:'Трицепсы (локальные)', freq:'Каждые 10-14 дн', indicators:['OK','Уплотнение','Боль','Гематома'],
                        actions:'При простреле в пальцы — повреждение лучевого нерва. Немедленно исключить зону на 6-8 нед.' },
                    ].map((z: any, i: any) =>(
                      <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:4, background:'rgba(34,197,94,0.03)', border:'1px solid rgba(34,197,94,0.08)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                          <span style={{ fontSize:9, fontWeight:700, color:'#4ade80' }}>{z.zone}</span>
                          <span style={{ fontSize:7, color:'var(--text-dim)', padding:'2px 6px', borderRadius:4, background:'rgba(255,255,255,0.04)' }}>Ротация: {z.freq}</span>
                        </div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginBottom:4 }}>
                          {z.indicators.map((ind: any, ii: any) =>(
                            <span key={ii} style={{ fontSize:7, padding:'2px 6px', borderRadius:4, cursor:'pointer',
                              background:ind==='OK'?'rgba(34,197,94,0.12)':ind==='Абсцесс'?'rgba(239,68,68,0.12)':ind==='Онемение'?'rgba(239,68,68,0.15)':'rgba(245,158,11,0.08)',
                              color:ind==='OK'?'#22c55e':ind==='Абсцесс'?'#ef4444':ind==='Онемение'?'#ef4444':'#f59e0b',
                              border:'1px solid rgba(255,255,255,0.06)' }}>{ind}</span>
                          ))}
                        </div>
                        <div style={{ fontSize:7, color:'var(--text-dim)', lineHeight:1.3 }}>{z.actions}</div>
                      </div>
                    ))}
                  </div>

                  {/* ═══ Summary: all zones at a glance ═══ */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#6366f1', marginBottom:6 }}>📋 Сводная таблица: все зоны инъекций</div>
                    <div style={{ overflowX:'auto' }}>
                      <table style={{ width:'100%', fontSize:7, borderCollapse:'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom:'1px solid var(--border)' }}>
                            <th style={{ padding:3, color:'var(--text-dim)', textAlign:'left' }}>Зона</th>
                            <th style={{ padding:3, color:'var(--text-dim)', textAlign:'left' }}>Тип</th>
                            <th style={{ padding:3, color:'var(--text-dim)', textAlign:'left' }}>Игла</th>
                            <th style={{ padding:3, color:'var(--text-dim)', textAlign:'left' }}>Макс. мл</th>
                            <th style={{ padding:3, color:'var(--text-dim)', textAlign:'left' }}>Раствор</th>
                            <th style={{ padding:3, color:'var(--text-dim)', textAlign:'left' }}>Сложность</th>
                            <th style={{ padding:3, color:'var(--text-dim)', textAlign:'left' }}>Риск</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            ['Ягодицы (дорс.)','Общая','21-23G × 1.5"','5 мл','Любой','⭐','Низкий'],
                            ['Вентро-ягодичная','Общая','21-23G × 1.5"','4 мл','Любой','⭐⭐','Низкий'],
                            ['Квадрицепсы (лат.)','Общая','23-25G × 1"','3 мл','Любой','⭐','Средний'],
                            ['Дельты','Общая','25-27G × 5/8-1"','2 мл','Любой','⭐','Средний'],
                            ['Широчайшая','Общая','25-27G × 5/8"','2 мл','Водный','⭐⭐⭐','Высокий'],
                            ['Грудные','Локальная','25-27G × 5/8"','1.5 мл','Водный','⭐⭐','Высокий'],
                            ['Трапеции','Локальная','27-29G × 1/2"','1 мл','Водный','⭐⭐⭐','Оч. высокий'],
                            ['Трицепс','Локальная','25-27G × 5/8"','1.5 мл','Водный','⭐⭐','Средний'],
                            ['Бицепс','Локальная','27-29G × 1/2"','1 мл','Водный','⭐⭐⭐','Оч. высокий'],
                            ['Икры','Локальная','25-27G × 5/8"','1 мл','Водный','⭐⭐⭐','Оч. высокий'],
                          ].map((r: any, i: any) =>(
                            <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                              <td style={{ padding:3, color:'var(--text-light)', fontWeight:600 }}>{r[0]}</td>
                              <td style={{ padding:3, color:r[1]==='Общая'?'#60a5fa':'#f472b6' }}>{r[1]}</td>
                              <td style={{ padding:3, color:'var(--text-dim)' }}>{r[2]}</td>
                              <td style={{ padding:3, color:'#fbbf24', fontWeight:600 }}>{r[3]}</td>
                              <td style={{ padding:3, color:r[4]==='Любой'?'#4ade80':'#fbbf24' }}>{r[4]}</td>
                              <td style={{ padding:3, color:'var(--text-dim)' }}>{r[5]}</td>
                              <td style={{ padding:3, color:r[6]==='Низкий'?'#4ade80':r[6]==='Средний'?'#fbbf24':r[6]==='Высокий'?'#f97316':'#ef4444', fontWeight:600 }}>{r[6]}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ══════ ТЕХНИКА ИНЪЕКЦИЙ ══════ */}
              {injectionTab === 'general' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {/* Header */}
                  <div style={cardBg}>
                    <div style={{ fontSize:13, fontWeight:800, color:'#14b8a6', marginBottom:4 }}>💉 Полное руководство по технике инъекций</div>
                    <p style={{ fontSize:8, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Внутримышечные (в/м), подкожные (п/к), набор из ампул и флаконов, самостоятельные инъекции, уменьшение боли. Пошаговые протоколы для каждого типа.</p>
                  </div>

                  {/* ═══ В/М ИНЪЕКЦИЯ: ПОШАГОВО ═══ */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#14b8a6', marginBottom:6 }}>💪 Внутримышечная инъекция: 10 шагов</div>
                    {[
                      { step:'1. Подготовка рабочего места', detail:'Чистая горизонтальная поверхность. Спирт 70% + стерильные салфетки + шприцы + иглы + препарат + контейнер для утилизации. Вымойте руки 30 сек с мылом. Наденьте перчатки (опционально, но рекомендовано).' },
                      { step:'2. Вскрытие и набор', detail:'<b>Ампула:</b> постучите по шейке, подпилите (если без точки надлома), оберните салфеткой, надломите «от себя». <b>Флакон:</b> снимите крышку, обработайте пробку спиртом. Наберите воздух в шприц = объёму препарата. Вколите иглу для набора (18-21G) в пробку, введите воздух, переверните флакон, наберите препарат. Извлеките иглу. <b>СМЕНИТЕ ИГЛУ</b> на новую для инъекции (игла затупилась о стекло/резину).' },
                      { step:'3. Удаление пузырьков воздуха', detail:'Держите шприц иглой вверх. Постучите по цилиндру. Медленно нажмите на поршень чтобы вытолкнуть воздух до появления капли на кончике иглы. Эта капля — смазка. НЕ вытирайте иглу (риск инфекции + ворсинки).' },
                      { step:'4. Выбор зоны и пальпация', detail:'Определите зону по карте. Пропальпируйте пальцами — нет ли уплотнений, болезненности, гематом. <b>При ЛЮБЫХ отклонениях — другая зона.</b> Ягодица: разделите на 4 квадранта, ТОЛЬКО верхне-наружный. Бедро: средняя треть латеральной поверхности. Дельта: 2-3 пальца ниже акромиона.' },
                      { step:'5. Обработка кожи', detail:'Спиртовая салфетка 70% (НЕ 96% — он испаряется слишком быстро и слабее убивает бактерии). Круговыми движениями от центра к периферии, диаметр ~5 см. <b>Дайте ВЫСОХНУТЬ 15-30 сек</b>. Мокрая кожа = жжение + неполная антисептика + занос бактерий с поверхности.' },
                      { step:'6. Z-тракт метод (обязательно!)', detail:'Свободной рукой сместите кожу на 1-2 см в сторону. Удерживайте до конца процедуры. После извлечения иглы — отпустите. <b>Зачем:</b> создаётся зигзагообразный канал. Препарат не вытекает обратно по каналу иглы. Снижает боль, раздражение и риск инфильтрата.' },
                      { step:'7. Вкол', detail:'Быстрое, уверенное, хлёсткое движение под углом <b>90°</b> (строго перпендикулярно поверхности). Игла входит на 2/3-3/4 длины (часть остаётся снаружи для экстренного извлечения при поломке). <b>Держите шприц как дротик</b> — между большим и указательным/средним пальцем. Медленный вкол = БОЛЬШЕ боли (игла растягивает, а не прокалывает ткани).' },
                      { step:'8. Аспирационная проба', detail:'Потяните поршень НАЗАД на 2-3 сек (создайте разрежение). <b>Кровь в шприце</b> = игла в кровеносном сосуде → извлеките иглу, смените иглу и зону, начните заново. <b>Пузырьки воздуха</b> (пена) = игла в мышце — всё правильно, можно вводить. <b>Ничего не тянется</b> = плотная ткань/фасция — продвиньте иглу чуть глубже или чуть оттяните.' },
                      { step:'9. Введение препарата', detail:'<b>МЕДЛЕННО.</b> Водные растворы: 1 мл за 10-15 сек. Масляные растворы: 1 мл за 20-30 сек. Быстрое введение масла = масляная эмболия. Не двигайте иглу во время введения (микротравмы). При появлении резкой боли — НЕМЕДЛЕННО остановитесь и извлеките иглу (возможно, попали в нерв или сосуд).' },
                      { step:'10. Извлечение и пост-уход', detail:'Быстро извлеките иглу под тем же углом (90°). Отпустите Z-тракт. Сразу прижмите СУХУЮ стерильную салфетку на 30-60 сек (без смещения). НЕ массируйте масляные инъекции (разрушение депо + PIP). Двигайтесь 5-10 мин для улучшения кровотока. Утилизируйте иглу в непрокалываемый контейнер (надевайте колпачок одной рукой методом «зачерпывания»).' },
                    ].map((s: any, i: any) =>(
                      <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:4, background:'rgba(20,184,166,0.03)', border:'1px solid rgba(20,184,166,0.08)' }}>
                        <div style={{ fontSize:10, fontWeight:700, color:'#2dd4bf', marginBottom:3 }}>{s.step}</div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.4 }} dangerouslySetInnerHTML={{ __html: s.detail }} />
                      </div>
                    ))}
                  </div>

                  {/* ═══ П/К ИНЪЕКЦИЯ ═══ */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#ec4899', marginBottom:6 }}>💉 Подкожная инъекция (п/к): полный протокол</div>
                    <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Для пептидов, HCG, HGH, инсулина, некоторых водных препаратов. Техника отличается от в/м по углу, длине иглы и зонам.</p>
                    {[
                      { step:'📐 Угол и техника', detail:'Угол <b>45°</b> (в кожную складку) или <b>90°</b> (короткая игла 5-8 мм). Соберите кожу в складку большим и указательным пальцами. Не захватывайте мышцу (приподнимайте только кожу и жир). Иглу вводите в ОСНОВАНИЕ складки (не в вершину).' },
                      { step:'📍 Зоны для п/к', detail:'<b>Живот:</b> 5 см от пупка, по полукругу. Самая удобная зона для самостоятельных инъекций. Чередуйте левую/правую сторону. <b>Бедро:</b> передняя или латеральная поверхность, верхняя треть. <b>Плечо:</b> задняя поверхность (трицепс), верхняя половина. <b>Ягодица:</b> любая точка (жировая прослойка толстая). <b>Ротация п/к зон:</b> минимум 4 зоны, расстояние между точками &gt;2 см.' },
                      { step:'💉 Иглы для п/к', detail:'Инсулиновые шприцы 29-31G × 5/16"-1/2" (8-13 мм) — идеальны для пептидов и HCG. Обычные шприцы 25-27G × 5/8" — для водных растворов. <b>Объём:</b> не &gt;1.5 мл в одну зону. При объёмах &gt;1 мл — разделяйте на 2 инъекции в разные зоны.' },
                      { step:'⚠️ Риски п/к инъекций', detail:'<b>Липодистрофия:</b> истончение или уплотнение жировой ткани при частых инъекциях в одну зону. <b>Липогипертрофия:</b> разрастание жировой ткани (шишки). В эти зоны НЕ колоть — всасывание нарушено. <b>Инфекция:</b> реже чем в/м, но возможна. <b>Гематома:</b> чаще чем в/м (подкожные капилляры). Прижимать дольше — до 2 мин.' },
                      { step:'🔍 Как проверить, что вы в п/к, а не в/м', detail:'1. Кожная складка должна быть мягкой и подвижной. 2. При уколе ощущение «провала» меньше чем при в/м. 3. Аспирационная проба (да, даже для п/к) — крови быть НЕ должно. 4. После введения — небольшой волдырь под кожей (нормально для объёмов &gt;0.5 мл).' },
                    ].map((s: any, i: any) =>(
                      <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:4, background:'rgba(236,72,153,0.03)', border:'1px solid rgba(236,72,153,0.08)' }}>
                        <div style={{ fontSize:10, fontWeight:700, color:'#f472b6', marginBottom:3 }}>{s.step}</div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.4 }} dangerouslySetInnerHTML={{ __html: s.detail }} />
                      </div>
                    ))}
                  </div>

                  {/* ═══ DRAWING UP ═══ */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#f59e0b', marginBottom:6 }}>🔬 Набор препарата: ампула vs флакон</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.1)' }}>
                        <div style={{ fontSize:10, fontWeight:700, color:'#fbbf24', marginBottom:4 }}>🧪 Из стеклянной ампулы</div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.5 }}>
                          <b>1.</b> Постучите ногтем по шейке — раствор стечёт вниз.<br/>
                          <b>2.</b> При отсутствии точки/кольца надлома — подпилите шейку пилочкой (идут в упаковке).<br/>
                          <b>3.</b> Оберните шейку спиртовой салфеткой — защита от порезов.<br/>
                          <b>4.</b> Надломите шейку <b>ОТ СЕБЯ</b> (осколки летят наружу).<br/>
                          <b>5.</b> Вскрытую ампулу поставьте на стол (она устойчива).<br/>
                          <b>6.</b> Используйте <b>ФИЛЬТР-ИГЛУ</b> (blunt fill needle, обычно зелёная 18-19G с фильтром 5 мкм) или обычную 18-21G. Фильтр-игла задерживает осколки стекла (бывают микроскопические).<br/>
                          <b>7.</b> Наклоните ампулу. Наберите раствор, не касаясь иглой краёв (стеклянная пыль, бактерии).<br/>
                          <b>8.</b> СМЕНИТЕ ИГЛУ на новую для инъекции.
                        </div>
                      </div>
                      <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(59,130,246,0.04)', border:'1px solid rgba(59,130,246,0.1)' }}>
                        <div style={{ fontSize:10, fontWeight:700, color:'#60a5fa', marginBottom:4 }}>💊 Из резинового флакона (виалы)</div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.5 }}>
                          <b>1.</b> Снимите пластиковую крышку (flip-off cap).<br/>
                          <b>2.</b> Обработайте резиновую пробку спиртовой салфеткой. Дайте высохнуть.<br/>
                          <b>3.</b> Наберите в шприц ВОЗДУХ, равный объёму препарата.<br/>
                          <b>4.</b> Вколите иглу в ЦЕНТР пробки под углом 90°.<br/>
                          <b>5.</b> ВВЕДИТЕ ВОЗДУХ во флакон (создаёт давление → легче набирать).<br/>
                          <b>6.</b> Переверните флакон вверх дном. Кончик иглы должен быть ПОГРУЖЁН в жидкость.<br/>
                          <b>7.</b> Медленно набирайте препарат. При «присасывании» поршня — добавьте ещё воздуха.<br/>
                          <b>8.</b> Извлеките иглу. СМЕНИТЕ ИГЛУ на новую для инъекции.<br/>
                          <b>9.</b> Многодозовые флаконы: храните в холодильнике (если указано), НЕ используйте &gt;28 дней после вскрытия. Записывайте дату вскрытия на флаконе.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ═══ PAIN REDUCTION ═══ */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#22c55e', marginBottom:6 }}>🟢 12 способов уменьшить боль при инъекции</div>
                    {[
                      { tip:'Согрейте препарат', detail:'Масляный раствор — в руке 1-2 мин или под тёплой (не горячей!) водой. Холодное масло = кристаллизация в тканях = боль.' },
                      { tip:'Используйте тонкую иглу', detail:'25G вместо 21G = субъективно на 60% меньше боли. Тоньше — медленнее введение, но комфортнее.' },
                      { tip:'Меняйте иглу после набора', detail:'Затупленная о резину/стекло игла = микроразрывы ткани при вколе. Новая острая игла = минимум травмы.' },
                      { tip:'Быстрый вкол', detail:'Хлёсткое движение как дротик. Медленный вкол = игла «расталкивает» ткани вместо прокола.' },
                      { tip:'Расслабьте мышцу', detail:'Напряжённая мышца = плотная ткань = больше сопротивление = больше боли. Лягте/сядьте, глубоко дышите.' },
                      { tip:'Медленное введение', detail:'1 мл / 20-30 сек для масла. Быстрое введение = гидравлический разрыв тканей + воспаление.' },
                      { tip:'Z-тракт метод', detail:'Смещение кожи на 1-2 см. Препарат остаётся в мышце, не раздражает п/к клетчатку.' },
                      { tip:'Лёд перед инъекцией', detail:'Кубик льда на 30 сек на зону перед обработкой спиртом. Снижает чувствительность поверхностных нервов. НЕ переохлаждать.' },
                      { tip:'Растяните кожу', detail:'Свободной рукой натяните кожу в зоне вкола. Натянутая кожа = меньше сопротивление = меньше боли.' },
                      { tip:'Лидокаин (опционально)', detail:'Добавление 0.1-0.2 мл 2% лидокаина в шприц (при совместимости). Местная анестезия. НЕ для тех, у кого аллергия на лидокаин.' },
                      { tip:'Движение после', detail:'5-10 мин ходьбы. Улучшает кровоток, распределяет препарат, снижает PIP.' },
                      { tip:'Массаж (только водные!)', detail:'Лёгкий массаж зоны через 30 мин после в/м инъекции водных растворов. Масляные — НЕЛЬЗЯ (разрушение депо).' },
                    ].map((t: any, i: any) =>(
                      <div key={i} style={{ padding:'6px 8px', borderRadius:6, marginBottom:3, background:'rgba(34,197,94,0.03)', border:'1px solid rgba(34,197,94,0.06)' }}>
                        <div style={{ fontSize:9, fontWeight:700, color:'#4ade80', marginBottom:2 }}>✅ {t.tip}</div>
                        <div style={{ fontSize:7, color:'var(--text-dim)', lineHeight:1.4 }}>{t.detail}</div>
                      </div>
                    ))}
                  </div>

                  {/* ═══ SELF-INJECTION ═══ */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#6366f1', marginBottom:6 }}>🪞 Самостоятельные инъекции: стратегии для труднодоступных зон</div>
                    {[
                      { zone:'Ягодица', method:'Лягте на бок. Нижняя нога прямая, верхняя согнута в колене. Свободной рукой найдите верхне-наружный квадрант. Шприц держите как дротик в доминантной руке. Зеркало на полу/низко — помогает контролировать угол.' },
                      { zone:'Вентро-ягодичная', method:'Стоя, перенесите вес на противоположную ногу. V-метод: ладонь на большой вертел, указательный на ASIS, средний развести — треугольник между пальцами. Колите доминантной рукой. Зеркало сбоку.' },
                      { zone:'Бедро (латеральное)', method:'Сядьте на стул. Нога прямая, расслаблена. Разверните бедро кнаружи. Доминантная рука держит шприц. Свободная — стабилизирует бедро. Самая простая зона для самостоятельной инъекции.' },
                      { zone:'Дельта', method:'Сядьте, обопритесь локтем на стол (рука свисает расслабленно). Или стойте перед зеркалом, рука свободно опущена. Доминантная рука через грудь к противоположному плечу. Можно колоть стоя боком к зеркалу.' },
                      { zone:'Грудь (локальная)', method:'Стоя перед зеркалом. Рука со стороны инъекции за головой (расширяет грудную). Точка: верхне-наружная часть. Доминантная рука через грудь. Медленно. Не дышите глубоко (движение грудной клетки).' },
                      { zone:'Трицепс', method:'Сядьте, рука согнута в локте, кисть касается противоположного плеча («поза задумчивый»). Латеральная головка трицепса доступна. Колите доминантной рукой. Или: положите руку на стол перед собой и колите сверху.' },
                    ].map((z: any, i: any) =>(
                      <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:4, background:'rgba(99,102,241,0.03)', border:'1px solid rgba(99,102,241,0.08)' }}>
                        <div style={{ fontSize:9, fontWeight:700, color:'#a5b4fc', marginBottom:2 }}>{z.zone}</div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.4 }}>{z.method}</div>
                      </div>
                    ))}
                  </div>

                  {/* ═══ COMPARISON TABLE ═══ */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#a855f7', marginBottom:6 }}>📐 Сравнение: в/м vs п/к vs в/в</div>
                    <div style={{ overflowX:'auto' }}>
                      <table style={{ width:'100%', fontSize:8, borderCollapse:'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom:'1px solid var(--border)' }}>
                            <th style={{ padding:4, color:'var(--text-dim)', textAlign:'left' }}>Параметр</th>
                            <th style={{ padding:4, color:'#60a5fa', textAlign:'left' }}>В/м (внутримышечно)</th>
                            <th style={{ padding:4, color:'#f472b6', textAlign:'left' }}>П/к (подкожно)</th>
                            <th style={{ padding:4, color:'#ef4444', textAlign:'left' }}>В/в (внутривенно)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            ['Угол','90°','45° (в складку) или 90° (короткая игла)','15-30°'],
                            ['Глубина','2.5-4 см','0.5-1.5 см','В просвет вены'],
                            ['Игла','21-23G × 1-1.5"','27-31G × 5/16-5/8"','21-25G'],
                            ['Макс. объём','5 мл (ягодица) / 2-3 мл (дельты/бедро)','1-1.5 мл','Любой (капельно)'],
                            ['Скорость введения','1 мл/10-30 сек','1 мл/5-10 сек','Капельно / медленно'],
                            ['Всасывание','Депо-эффект (медленное, ровное)','Медленное (через жир)','Мгновенное 100%'],
                            ['Пик в крови','24-72 ч (масло) / 1-4 ч (вода)','2-8 ч','Немедленно'],
                            ['Для чего','Масляные ААС, антибиотики','Пептиды, инсулин, HCG, HGH, вакцины','Только врач!'],
                            ['Риски','Абсцесс, нерв, сосуд, гематома','Липодистрофия, инфекция, гематома','Флебит, сепсис, эмболия, анафилаксия'],
                            ['Аспирация','ОБЯЗАТЕЛЬНА','Рекомендована','Не нужна (уже в вене)'],
                          ].map((r: any, i: any) =>(
                            <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                              <td style={{ padding:4, color:'var(--text-light)', fontWeight:600 }}>{r[0]}</td>
                              <td style={{ padding:4, color:'#93c5fd' }}>{r[1]}</td>
                              <td style={{ padding:4, color:'#f9a8d4' }}>{r[2]}</td>
                              <td style={{ padding:4, color:'#fca5a5' }}>{r[3]}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Pre-injection checklist */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#22c55e', marginBottom:6 }}>✅ Полный чек-лист перед инъекцией</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                      {[
                        'Чистые руки (30 сек)',
                        'Спирт 70%',
                        'Стерильные салфетки',
                        'Новая игла для набора (18-21G)',
                        'Новая игла для инъекции (23-27G)',
                        'Шприц нужного объёма',
                        'Срок годности препарата',
                        'Проверить раствор (цвет, осадок)',
                        'Согреть масляный р-р в руке',
                        'Контейнер для утилизации',
                        'Зона без уплотнений',
                        'Зона обработана и сухая',
                        'Z-тракт смещение кожи',
                        'Аспирационная проба',
                        'Пластырь (при необходимости)',
                      ].map((c: any, i: any) =>(
                        <span key={i} style={{ fontSize:7, padding:'3px 8px', borderRadius:6, background:'rgba(34,197,94,0.08)', color:'#4ade80', border:'1px solid rgba(34,197,94,0.15)' }}>☑ {c}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ══════ СТЕРИЛЬНОСТЬ ══════ */}
              {injectionTab === 'sterility' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={cardBg}>
                    <div style={{ fontSize:13, fontWeight:800, color:'#6366f1', marginBottom:4 }}>🧪 Стерильность и асептика: полный протокол</div>
                    <p style={{ fontSize:8, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Нарушение стерильности — причина №1 постинъекционных осложнений. Абсцесс, флегмона, сепсис развиваются из-за бактерий, занесённых при инъекции. <b>Асептика — это НЕ опция, это ОБЯЗАТЕЛЬНОЕ УСЛОВИЕ.</b></p>
                  </div>

                  {/* Workspace preparation */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#6366f1', marginBottom:6 }}>🏠 Подготовка рабочего места</div>
                    {[
                      { step:'1. Выбор поверхности', detail:'Чистый стол/тумба без лишних предметов. Протрите поверхность спиртом 70% или хлоргексидином. Постелите чистую бумажную салфетку или одноразовую пелёнку. <b>НИКОГДА не делайте инъекции в ванной</b> (влажность = бактерии + плесень).' },
                      { step:'2. Организация инструментов', detail:'Разложите всё ЗАРАНЕЕ. Слева направо: спиртовые салфетки → шприцы → иглы для набора → иглы для инъекции → препарат → стерильные салфетки → контейнер для утилизации. Вскрывайте упаковки непосредственно перед использованием, а не заранее.' },
                      { step:'3. Гигиена рук', detail:'<b>Полное мытьё 30 сек:</b> ладони → тыльная сторона → между пальцами → кончики пальцев → большие пальцы → запястья. Вытрите чистым одноразовым полотенцем. Обработайте антисептиком (спирт 70% или хлоргексидин). Дайте высохнуть. Наденьте перчатки (рекомендовано).' },
                      { step:'4. Освещение и вентиляция', detail:'Хороший свет (видно зону инъекции). Закрытые окна (сквозняк несёт пыль и бактерии). Выключенный вентилятор/кондиционер. Никаких домашних животных в помещении (шерсть = источник бактерий).' },
                    ].map((s: any, i: any) =>(
                      <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:4, background:'rgba(99,102,241,0.03)', border:'1px solid rgba(99,102,241,0.08)' }}>
                        <div style={{ fontSize:10, fontWeight:700, color:'#a5b4fc', marginBottom:3 }}>{s.step}</div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.4 }}>{s.detail}</div>
                      </div>
                    ))}
                  </div>

                  {/* Multi-dose vial safety */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#f59e0b', marginBottom:6 }}>💊 Безопасность многодозовых флаконов</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                      <div style={{ padding:'8px 10px', borderRadius:6, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.1)', fontSize:8 }}>
                        <div style={{ fontWeight:700, color:'#fbbf24', marginBottom:3 }}>📅 Правило 28 дней</div>
                        <div style={{ color:'var(--text-dim)', lineHeight:1.4 }}>
                          После первого прокола резиновой пробки многодозовый флакон пригоден <b>не более 28 дней</b> (по стандартам USP &lt;797&gt;). Даже если препарат выглядит нормально — бактерии могли попасть через проколы и размножиться до опасного уровня. <b>Записывайте дату вскрытия маркером на флаконе.</b>
                        </div>
                      </div>
                      <div style={{ padding:'8px 10px', borderRadius:6, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.1)', fontSize:8 }}>
                        <div style={{ fontWeight:700, color:'#fbbf24', marginBottom:3 }}>🧊 Хранение</div>
                        <div style={{ color:'var(--text-dim)', lineHeight:1.4 }}>
                          • Большинство препаратов — сухое тёмное место, 15-25°C.<br/>
                          • Пептиды (HCG, HGH после разведения) — холодильник 2-8°C.<br/>
                          • НЕ замораживать (если не указано производителем). Кристаллы льда разрушают молекулы.<br/>
                          • Всегда проверяйте инструкцию. Условия хранения различаются.
                        </div>
                      </div>
                      <div style={{ padding:'8px 10px', borderRadius:6, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.1)', fontSize:8 }}>
                        <div style={{ fontWeight:700, color:'#fbbf24', marginBottom:3 }}>🔍 Проверка перед каждым использованием</div>
                        <div style={{ color:'var(--text-dim)', lineHeight:1.4 }}>
                          • <b>Мутность</b> (у изначально прозрачных растворов) = бактериальный рост.<br/>
                          • <b>Осадок / хлопья</b> (у изначально однородных) = выпадение действующего вещества или контаминация.<br/>
                          • <b>Изменение цвета</b> (потемнение, пожелтение) = окисление / деградация.<br/>
                          • <b>Резиновая пробка</b> с кусочками (фрагментация) = частицы резины попали в раствор.<br/>
                          • <b>ЛЮБОЕ из перечисленного</b> = УТИЛИЗИРУЙТЕ флакон. Не рискуйте.
                        </div>
                      </div>
                      <div style={{ padding:'8px 10px', borderRadius:6, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.1)', fontSize:8 }}>
                        <div style={{ fontWeight:700, color:'#fca5a5', marginBottom:3 }}>⚠ Правила прокола пробки</div>
                        <div style={{ color:'var(--text-dim)', lineHeight:1.4 }}>
                          • Всегда обрабатывайте пробку спиртом 70% ПЕРЕД КАЖДЫМ проколом.<br/>
                          • Дайте спирту высохнуть (15-30 сек).<br/>
                          • Прокалывайте в РАЗНЫХ точках пробки (не в одно и то же место).<br/>
                          • Используйте иглу 18-21G (тонкие иглы 25G+ могут вырезать кусочек резины).<br/>
                          • НЕ храните флакон с воткнутой иглой («для удобства») — прямой доступ бактерий.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Antiseptic comparison */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#22c55e', marginBottom:6 }}>🧴 Антисептики для инъекций: сравнение</div>
                    <div style={{ overflowX:'auto' }}>
                      <table style={{ width:'100%', fontSize:8, borderCollapse:'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom:'1px solid var(--border)' }}>
                            <th style={{ padding:3, color:'var(--text-dim)', textAlign:'left' }}>Средство</th>
                            <th style={{ padding:3, color:'var(--text-dim)', textAlign:'left' }}>Концентрация</th>
                            <th style={{ padding:3, color:'var(--text-dim)', textAlign:'left' }}>Время экспозиции</th>
                            <th style={{ padding:3, color:'var(--text-dim)', textAlign:'left' }}>Спектр</th>
                            <th style={{ padding:3, color:'var(--text-dim)', textAlign:'left' }}>Примечание</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            ['Спирт этиловый','70%','15-30 сек','Бактерии, вирусы, грибы','⭐ Золотой стандарт. 96% слабее — быстро испаряется.'],
                            ['Хлоргексидин','0.5-2%','30-60 сек','Бактерии (лучше грам+), вирусы','Остаточное действие до 6 ч. Лучше для операций.'],
                            ['Повидон-йод','10%','2-3 мин','Бактерии, вирусы, грибы, споры','Медленный. Окрашивает. Аллергия на йод.'],
                            ['Перекись водорода','3%','1-5 мин','Бактерии, споры (слабо)','НЕ для обработки кожи перед инъекцией. Для ран.'],
                            ['Мирамистин','0.01%','1-2 мин','Широкий спектр + биоплёнки','Можно для аллергиков на спирт. ⚠ Не инактивирует HBV/HCV — для инъекций предпочтителен 70% спирт. Дороже спирта.'],
                          ].map((r: any, i: any) =>(
                            <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                              <td style={{ padding:3, color:'var(--text-light)', fontWeight:600 }}>{r[0]}</td>
                              <td style={{ padding:3, color:'var(--text-dim)' }}>{r[1]}</td>
                              <td style={{ padding:3, color:'var(--text-dim)' }}>{r[2]}</td>
                              <td style={{ padding:3, color:'var(--text-dim)' }}>{r[3]}</td>
                              <td style={{ padding:3, color:'#5eead4' }}>{r[4]}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Item sterility */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#a855f7', marginBottom:6 }}>📦 Стерильность расходных материалов</div>
                    {[
                      { item:'Шприцы и иглы', rule:'Все современные шприцы и иглы — стерильные в заводской упаковке. <b>Вскрывайте непосредственно перед использованием.</b> Не касайтесь иглы, поршня и внутренней части цилиндра. Упаковка с повреждением = не использовать.' },
                      { item:'Спиртовые салфетки', rule:'Индивидуальная упаковка каждой салфетки. После вскрытия используйте сразу. Не храните вскрытые салфетки — спирт испаряется, бактерии проникают.' },
                      { item:'Стерильные салфетки', rule:'Для прижатия после инъекции. Упаковка вскрывается непосредственно перед применением. Не используйте вату (ворсинки!) и туалетную бумагу (нестерильна!).' },
                      { item:'Перчатки', rule:'Нестерильные смотровые — для ЗАЩИТЫ ВАС, не для стерильности процедуры. Если касаетесь иглы — то же самое что без перчаток. Стерильные перчатки — другой уровень, но избыточны для самому себе.' },
                      { item:'Контейнер для утилизации', rule:'Специальный непрокалываемый пластиковый контейнер (оранжевый/жёлтый). Или плотная пластиковая бутылка с крышкой. НЕ выбрасывать иглы в обычный мусор.' },
                    ].map((x: any, i: any) =>(
                      <div key={i} style={{ padding:'6px 8px', borderRadius:6, marginBottom:3, background:'rgba(168,85,247,0.03)', border:'1px solid rgba(168,85,247,0.06)' }}>
                        <div style={{ fontSize:9, fontWeight:700, color:'#c084fc', marginBottom:2 }}>{x.item}</div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.4 }}>{x.rule}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ══════ ОШИБКИ И ПРАВИЛА ══════ */}
              {injectionTab === 'errors' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {/* Critical errors */}
                  <div style={{ borderRadius:12, padding:12, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.2)' }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', marginBottom:8 }}>🚫 ТОП-15 критических ошибок при инъекциях</div>
                    {[
                      { err:'1. Повторное использование иглы', cons:'Затупленная игла → микротравмы ткани → воспаление + фиброз. Инфекция.', fix:'Всегда новая игла. Цена иглы 5-10₽, лечение абсцесса — 5000-50000₽.' },
                      { err:'2. Инъекция в одну и ту же зону', cons:'Липодистрофия, фиброз, образование масляных кист. Ткань перестаёт всасывать препарат.', fix:'Ротация минимум 8 зон. Карта ротации выше. Каждая зона — 7 дней отдыха.' },
                      { err:'3. Слишком быстрый вкол/введение', cons:'Разрыв мышечных волокон, гематома, боль. Быстрое введение масла → масляная эмболия (редко).', fix:'Вкол быстро, но введение медленно: 1 мл за 10-15 сек (водный) или 20-30 сек (масляный).' },
                      { err:'4. Пропуск аспирационной пробы', cons:'Попадание в сосуд → масляная эмболия лёгких (кашель, одышка, боль в груди — через 2-5 мин).', fix:'Всегда аспирируйте 2-3 сек. Кровь → извлечь, сменить иглу, новое место.' },
                      { err:'5. Неправильный угол или глубина', cons:'П/к вместо в/м → медленное всасывание + воспаление. В/м слишком глубоко → надкостница.', fix:'Угол строго 90° для в/м. Длина иглы по зоне: ягодица 1.5", бедро 1", дельта 5/8-1".' },
                      { err:'6. Попадание в седалищный нерв', cons:'Мгновенная острая боль → онемение ноги → парез стопы (временный или постоянный).', fix:'Только верхне-наружный квадрант ягодицы. V-метод. При боли — немедленно извлечь.' },
                      { err:'7. Введение холодного масляного раствора', cons:'Кристаллизация в тканях → боль, воспаление, замедленное всасывание, PIP (post-injection pain).', fix:'Согрейте ампулу/шприц в руке 1-2 мин или под тёплой водой (не кипяток!).' },
                      { err:'8. Смешивание несовместимых препаратов', cons:'Выпадение осадка, химическая реакция, эмболия кристаллами. Разные масла-носители могут расслаиваться.', fix:'Не смешивайте в одном шприце без точных данных о совместимости. Разные шприцы, разные зоны.' },
                      { err:'9. Грязные руки / нестерильная техника', cons:'Staphylococcus aureus → абсцесс за 2-5 дней. Требуется хирургическое дренирование.', fix:'Мытьё рук 30 сек с мылом. Спирт 70% на зону инъекции. Новая игла. Не касаться иглы.' },
                      { err:'10. Инъекция при ОРВИ / температуре', cons:'Иммунитет ослаблен → повышенный риск инфекции. Воспалительный ответ усилен.', fix:'Отложите инъекцию на 1-2 дня после нормализации температуры. Исключение: ЗГТ (пропуск некритичен).' },
                      { err:'11. Избыточный объём в одну зону', cons:'>5 мл → разрыв фасции, компартмент-синдром, некроз. >3 мл в дельту → повреждение сустава.', fix:'Ягодица ≤5 мл, бедро ≤3 мл, дельта ≤2 мл. Разделите большую дозу на 2 инъекции в разные зоны.' },
                      { err:'12. Не менять иглу после набора из ампулы', cons:'Игла затупляется о стекло/резину → боль + микротравмы. Резиновая крошка в мышце → гранулёма.', fix:'Всегда: 1 игла для набора (18-21G), 1 новая игла для инъекции (23-25G). 2 иглы на 1 укол.' },
                      { err:'13. Массаж места инъекции (масляные)', cons:'Разрыв масляного депо → неравномерное всасывание + PIP. Микротравма капилляров → гематома.', fix:'Прижать салфеткой на 30-60 сек без смещения. Лёгкое давление, без массажа. Двигайтесь 5-10 мин после.' },
                      { err:'14. Хранение препаратов неправильно', cons:'Свет, тепло, заморозка → деградация. Бактериальный рост в многодозовых флаконах.', fix:'Сухое, тёмное место, t° 15-25°C (если не указано иное). Многодозовые — не >28 дней после вскрытия.' },
                      { err:'15. Игнорирование признаков инфекции', cons:'Покраснение + отёк + боль + тепло = абсцесс. Без лечения → сепсис, некроз, госпитализация.', fix:'Признаки инфекции → НЕМЕДЛЕННО к врачу. Не пытайтесь «переждать». Антибиотики на ранней стадии.' },
                    ].map((e: any, i: any) =>(
                      <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:4, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.1)' }}>
                        <div style={{ fontSize:9, fontWeight:700, color:'#fca5a5', marginBottom:3 }}>{e.err}</div>
                        <div style={{ fontSize:8, color:'#fbbf24', marginBottom:3, lineHeight:1.3 }}>❌ Последствия: {e.cons}</div>
                        <div style={{ fontSize:8, color:'#4ade80', lineHeight:1.3 }}>✅ Как избежать: {e.fix}</div>
                      </div>
                    ))}
                  </div>

                  {/* Golden rules */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#f59e0b', marginBottom:6 }}>⭐ Золотые правила безопасности инъекций</div>
                    {[
                      '1 игла = 1 прокол. Никаких исключений. Цена новой иглы — копейки.',
                      'Всегда аспирационная проба. 2-3 секунды спасают от масляной эмболии.',
                      'Ротация зон — не рекомендация, а ОБЯЗАТЕЛЬНОЕ УСЛОВИЕ. Минимум 8 зон в цикле ротации.',
                      'Спирт 70% (не 96% — слабее антисептика). Дать высохнуть 15-30 сек.',
                      'Медленное введение: масляные растворы — 1 мл за 20-30 сек, водные — 1 мл за 10-15 сек.',
                      'После инъекции — сухая стерильная салфетка на 30-60 сек, без массажа.',
                      'При малейших признаках инфекции (боль, краснота, отёк, тепло) — врач, не затягивать.',
                      'Многодозовые флаконы: не использовать >28 дней после вскрытия. Хранить в холодильнике.',
                      'Не смешивать препараты в одном шприце без 100% уверенности в совместимости.',
                      'Не колоть при ОРВИ, температуре, в состоянии алкогольного опьянения.',
                      'Контейнер для острых предметов. Не выбрасывать иглы в обычное мусорное ведро.',
                      'Масляные растворы перед инъекцией — согреть в руке 1-2 минуты.',
                    ].map((r: any, i: any) =>(
                      <div key={i} style={{ padding:'6px 8px', borderRadius:6, marginBottom:3, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.08)', fontSize:8, color:'var(--text-light)', lineHeight:1.4 }}>
                        <span style={{ color:'#fbbf24', fontWeight:700, marginRight:4 }}>◆</span> {r}
                      </div>
                    ))}
                  </div>

                  {/* Emergency signs */}
                  <div style={{ borderRadius:12, padding:12, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.2)' }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', marginBottom:6 }}>🚨 Экстренные признаки: когда НЕМЕДЛЕННО к врачу</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                      {[
                        { s:'Одышка / кашель через 2-5 мин после инъекции', why:'Масляная эмболия лёгких' },
                        { s:'Онемение / паралич конечности', why:'Повреждение нерва (седалищный, бедренный)' },
                        { s:'Краснота + отёк + боль + температура >38°C', why:'Абсцесс / целлюлит / сепсис' },
                        { s:'Гнойное отделяемое из места укола', why:'Инфекция, требуется дренирование' },
                        { s:'Анафилаксия: сыпь, отёк лица, затруднение дыхания', why:'Аллергия на препарат / масло-носитель' },
                        { s:'Боль в груди + тахикардия', why:'Масляная эмболия / инфаркт' },
                        { s:'Острая боль по ходу вены + покраснение', why:'Флебит / тромбофлебит' },
                        { s:'Головная боль + рвота + светобоязнь', why:'Асептический менингит (редко)' },
                      ].map((x: any, i: any) =>(
                        <div key={i} style={{ width:'100%', padding:'6px 8px', borderRadius:6, marginBottom:3, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.12)', fontSize:8 }}>
                          <div style={{ color:'#fca5a5', fontWeight:700 }}>⚠ {x.s}</div>
                          <div style={{ color:'var(--text-dim)', marginTop:2 }}>Возможная причина: {x.why}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ══════ ИГЛЫ И ШПРИЦЫ ══════ */}
              {injectionTab === 'needles' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {/* Needle table */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#14b8a6', marginBottom:6 }}>📏 Таблица игл: Gauge × Длина × Назначение</div>
                    <div style={{ overflowX:'auto' }}>
                      <table style={{ width:'100%', fontSize:8, borderCollapse:'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom:'1px solid var(--border)' }}>
                            <th style={{ padding:4, color:'var(--text-dim)', textAlign:'left' }}>Gauge (G)</th>
                            <th style={{ padding:4, color:'var(--text-dim)', textAlign:'left' }}>Цвет</th>
                            <th style={{ padding:4, color:'var(--text-dim)', textAlign:'left' }}>Диаметр</th>
                            <th style={{ padding:4, color:'var(--text-dim)', textAlign:'left' }}>Длина</th>
                            <th style={{ padding:4, color:'var(--text-dim)', textAlign:'left' }}>Назначение</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            ['18G','Розовый','1.2 мм','1.5" (40 мм)','Набор масляных растворов из ампул/флаконов. Быстрый набор.'],
                            ['19-20G','Кремовый/Жёлтый','1.0-0.9 мм','1-1.5"','Фильтр-иглы (blunt fill) для набора из ампул. Защита от стекла.'],
                            ['21G','Зелёный','0.8 мм','1.5" (40 мм)','В/м инъекции (ягодица). Масляные р-ры. Быстрый ввод.'],
                            ['22G','Серый','0.7 мм','1.5" (40 мм)','В/м инъекции (ягодица/бедро). Компромисс скорость/комфорт.'],
                            ['23G','Голубой','0.6 мм','1" / 1.25"','⭐ Стандарт в/м (дельты, бедро, ягодица). Минимум дискомфорта.'],
                            ['25G','Оранжевый','0.5 мм','5/8" / 1"','Дельты, п/к инъекции. Тонкая. Водные р-ры и пептиды.'],
                            ['27G','Серый','0.4 мм','1/2"','П/к инъекции (HCG, HGH, инсулин). Минимальная травма.'],
                            ['29G','Коричневый','0.33 мм','1/2"','Инсулиновые шприцы. Безболезненно.'],
                            ['30-31G','Бесцветный','0.3-0.25 мм','5/16" (8 мм)','Инсулиновые шприцы ultra-fine. П/к без ощущений.'],
                          ].map((r: any, i: any) =>(
                            <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                              <td style={{ padding:4, color:'var(--text-light)', fontWeight:700 }}>{r[0]}</td>
                              <td style={{ padding:4, color:'var(--text-dim)' }}>{r[1]}</td>
                              <td style={{ padding:4, color:'var(--text-dim)' }}>{r[2]}</td>
                              <td style={{ padding:4, color:'var(--text-dim)' }}>{r[3]}</td>
                              <td style={{ padding:4, color:'#5eead4' }}>{r[4]}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Syringe types */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#a855f7', marginBottom:6 }}>💉 Типы шприцев: как выбрать</div>
                    <div style={{ overflowX:'auto' }}>
                      <table style={{ width:'100%', fontSize:8, borderCollapse:'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom:'1px solid var(--border)' }}>
                            <th style={{ padding:3, color:'var(--text-dim)', textAlign:'left' }}>Тип</th>
                            <th style={{ padding:3, color:'var(--text-dim)', textAlign:'left' }}>Объём</th>
                            <th style={{ padding:3, color:'var(--text-dim)', textAlign:'left' }}>Крепление</th>
                            <th style={{ padding:3, color:'var(--text-dim)', textAlign:'left' }}>Мёртвый объём</th>
                            <th style={{ padding:3, color:'var(--text-dim)', textAlign:'left' }}>Для чего</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            ['2-секционный','2 / 3 / 5 / 10 мл','Luer-Lock (резьба)','0.05-0.1 мл','В/м инъекции. Игла НЕ интегрирована. Стандарт.'],
                            ['3-секционный','2 / 3 / 5 / 10 мл','Luer-Lock (резьба)','0.02-0.05 мл','В/м инъекции. Резиновый поршень плотнее. Меньше мёртвый объём.'],
                            ['Luer-Slip','2 / 3 / 5 мл','Luer-Slip (трение)','0.05-0.1 мл','Проще надеть иглу. Риск соскока при высоком давлении (масло). Лучше Luer-Lock.'],
                            ['Инсулиновый','0.3 / 0.5 / 1 мл','Интегрированная игла','0 (нет мёртвого)','Пептиды, HCG, HGH, инсулин. Шкала в единицах (U-100). Игла несъёмная.'],
                            ['Туберкулиновый','1 мл','Luer-Slip / Luer-Lock','0.02-0.05 мл','Малые дозы (≤1 мл). Тонкая шкала (0.01 мл). Можно менять иглу.'],
                          ].map((r: any, i: any) =>(
                            <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                              <td style={{ padding:3, color:'var(--text-light)', fontWeight:700 }}>{r[0]}</td>
                              <td style={{ padding:3, color:'var(--text-dim)' }}>{r[1]}</td>
                              <td style={{ padding:3, color:'#c084fc' }}>{r[2]}</td>
                              <td style={{ padding:3, color:r[3].includes('0')?'#4ade80':'#fbbf24' }}>{r[3]}</td>
                              <td style={{ padding:3, color:'var(--text-dim)' }}>{r[4]}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Dead space */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#f59e0b', marginBottom:6 }}>⚙️ Мёртвый объём (dead space): почему это важно</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                      <div style={{ padding:'8px 10px', borderRadius:6, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.1)', fontSize:8 }}>
                        <div style={{ fontWeight:700, color:'#fbbf24', marginBottom:2 }}>📐 Что такое мёртвый объём?</div>
                        <div style={{ color:'var(--text-dim)', lineHeight:1.4 }}>
                          Объём препарата, который остаётся в игле и конусе шприца после полного нажатия поршня. Стандартно 0.05-0.1 мл. При 2 инъекциях в неделю × 20 недель курса это <b>2-4 мл потерянного препарата</b> (до $50-100 потерянной стоимости).
                        </div>
                      </div>
                      <div style={{ padding:'8px 10px', borderRadius:6, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.1)', fontSize:8 }}>
                        <div style={{ fontWeight:700, color:'#fbbf24', marginBottom:2 }}>💡 Как снизить потери</div>
                        <div style={{ color:'var(--text-dim)', lineHeight:1.4 }}>
                          • <b>Метод воздушной пробки (air-lock):</b> после набора препарата наберите 0.1-0.2 мл воздуха. При инъекции воздух выталкивает препарат из иглы в мышцу. Безопасно (малые объёмы воздуха в мышце рассасываются).<br/>
                          • <b>Инсулиновые шприцы:</b> нулевой мёртвый объём (игла интегрирована). Для малых доз (≤1 мл).<br/>
                          • <b>Шприцы low-dead-space:</b> специальная конструкция поршня. Снижают потери до 0.01 мл.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Volume limits */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', marginBottom:6 }}>💧 Предельные объёмы по зонам</div>
                    {[
                      { zone:'Ягодица (дорсальная)', maxVol:'5 мл', needle:'21-23G × 1.5"', note:'Крупнейшая мышца. Масляные и водные.' },
                      { zone:'Ягодица (вентральная)', maxVol:'4 мл', needle:'21-23G × 1.5"', note:'Меньше риск нерва. Предпочтительная зона.' },
                      { zone:'Бедро (латеральное)', maxVol:'3 мл', needle:'23-25G × 1"', note:'Не &gt;3 мл — риск компартмент-синдрома.' },
                      { zone:'Дельта', maxVol:'2 мл', needle:'25-27G × 5/8-1"', note:'Маленькая мышца. &gt;2 мл — боль и риск сустава.' },
                      { zone:'Широчайшая', maxVol:'2 мл', needle:'25-27G × 5/8"', note:'Опытные. Риск пневмоторакса.' },
                      { zone:'Грудные (локальные)', maxVol:'1.5 мл', needle:'25-27G × 5/8"', note:'Только водные. Высокий риск гематом.' },
                      { zone:'Трицепс (локальная)', maxVol:'1.5 мл', needle:'25-27G × 5/8"', note:'Водные + лёгкие масляные.' },
                      { zone:'Бицепс/Трапеции/Икры', maxVol:'1 мл', needle:'27-29G × 1/2"', note:'Только водные! Экстремальный риск.' },
                    ].map((z: any, i: any) =>(
                      <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:4, background:'rgba(239,68,68,0.03)', border:'1px solid rgba(239,68,68,0.08)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:3 }}>
                          <span style={{ fontSize:9, fontWeight:700, color:'#fca5a5' }}>{z.zone}</span>
                          <span style={{ fontSize:9, fontWeight:800, color:'#fbbf24' }}>≤ {z.maxVol}</span>
                        </div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.3 }}>Игла: {z.needle} · {z.note}</div>
                      </div>
                    ))}
                  </div>

                  {/* Needle selection guide */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#22c55e', marginBottom:6 }}>🎯 Выбор иглы: правила толщины и длины</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      <div style={{ padding:'8px 10px', borderRadius:6, background:'rgba(34,197,94,0.04)', border:'1px solid rgba(34,197,94,0.1)', fontSize:8 }}>
                        <div style={{ fontWeight:700, color:'#4ade80', marginBottom:2 }}>📐 Длина — глубина залегания мышцы</div>
                        <div style={{ color:'var(--text-dim)', lineHeight:1.4 }}>
                          • Худощавые (жир &lt;10%) → 1" (25 мм) для ягодицы, 5/8" (16 мм) для дельты<br/>
                          • Среднее телосложение → 1.25-1.5" (30-40 мм) для ягодицы, 1" для бедра/дельты<br/>
                          • Полные (жир &gt;20%) → 1.5" (40 мм) для ягодицы, 1.25" для бедра<br/>
                          • Правило: 1/3 иглы снаружи для экстренного извлечения
                        </div>
                      </div>
                      <div style={{ padding:'8px 10px', borderRadius:6, background:'rgba(59,130,246,0.04)', border:'1px solid rgba(59,130,246,0.1)', fontSize:8 }}>
                        <div style={{ fontWeight:700, color:'#60a5fa', marginBottom:2 }}>📏 Толщина (Gauge) — вязкость раствора</div>
                        <div style={{ color:'var(--text-dim)', lineHeight:1.4 }}>
                          • Меньше G = толще игла = быстрее введение = больше травма<br/>
                          • Масляные → 21-23G · Водные → 23-25G · Пептиды/HCG/HGH → 27-31G<br/>
                          • 23G — золотая середина для большинства ААС
                        </div>
                      </div>
                      <div style={{ padding:'8px 10px', borderRadius:6, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.1)', fontSize:8 }}>
                        <div style={{ fontWeight:700, color:'#fbbf24', marginBottom:2 }}>🔧 Практические правила</div>
                        <div style={{ color:'var(--text-dim)', lineHeight:1.4 }}>
                          • 18G для набора → сменить на 23G для инъекции<br/>
                          • Фильтр-игла (blunt fill) для ампул — задерживает осколки стекла<br/>
                          • Никогда не колоть иглой после набора (затуплена!)<br/>
                          • Luer-Lock надёжнее Luer-Slip для масляных растворов<br/>
                          • Инсулиновые шприцы для малых доз пептидов (нет мёртвого объёма)
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Post-injection care */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#f59e0b', marginBottom:6 }}>🩹 Уход после инъекции</div>
                    {[
                      { action:'Прижать салфеткой', detail:'Сухая стерильная салфетка. 30-60 сек без смещения. НЕ тереть, НЕ массировать (масляные). Остановить капиллярное кровотечение.' },
                      { action:'Двигаться 5-10 мин', detail:'Лёгкая ходьба или движение конечностью. Улучшает кровоток и распределение препарата. Снижает PIP.' },
                      { action:'Тёплый компресс (при боли)', detail:'Если боль через 2-4 ч — тёплый (не горячий!) компресс 15 мин. Ускоряет всасывание. НЕ при подозрении на инфекцию!' },
                      { action:'Холод (при гематоме)', detail:'Лёд через ткань на 10-15 мин в первые 2 ч. Сужает сосуды → меньше синяк.' },
                      { action:'Гепариновая мазь', detail:'При уплотнениях без инфекции. Микроциркуляция. 2-3 р/день тонким слоем.' },
                      { action:'НПВС местно', detail:'Диклофенак / кетопрофен при PIP &gt;24 ч. Не сразу после инъекции (спирт + гель = раздражение).' },
                    ].map((a: any, i: any) =>(
                      <div key={i} style={{ padding:'6px 8px', borderRadius:6, marginBottom:4, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.08)', fontSize:8 }}>
                        <div style={{ fontWeight:700, color:'#fbbf24', marginBottom:2 }}>{a.action}</div>
                        <div style={{ color:'var(--text-dim)', lineHeight:1.4 }}>{a.detail}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ══════ ОСЛОЖНЕНИЯ ══════ */}
              {injectionTab === 'complications' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={cardBg}>
                    <div style={{ fontSize:13, fontWeight:800, color:'#ef4444', marginBottom:4 }}>🩺 Постинъекционные осложнения: распознавание и действия</div>
                    <p style={{ fontSize:8, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Полное руководство по PIP (постинъекционная боль), гематомам, абсцессам, масляной эмболии, повреждению нервов и стерильному воспалению. Знание того, что нормально, а что требует врача — спасает здоровье.</p>
                  </div>

                  {/* PIP */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#f59e0b', marginBottom:6 }}>🔥 PIP (Post-Injection Pain) — постинъекционная боль</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                      <div style={{ padding:'8px 10px', borderRadius:6, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.1)', fontSize:8 }}>
                        <div style={{ fontWeight:700, color:'#fbbf24', marginBottom:2 }}>📋 Что такое PIP и почему возникает</div>
                        <div style={{ color:'var(--text-dim)', lineHeight:1.4 }}>
                          Боль, отёк и дискомфорт в месте инъекции через 4-48 часов после укола. <b>Это НОРМАЛЬНАЯ реакция</b> на механическое повреждение ткани + химическое раздражение препаратом. Возникает из-за: кристаллизации масла в холодной мышце, реакции на растворитель (бензиловый спирт, бензилбензоат), объёма инъекции, травмы иглой, индивидуальной чувствительности к эфиру/носителю.
                        </div>
                      </div>
                      <div style={{ padding:'8px 10px', borderRadius:6, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.1)', fontSize:8 }}>
                        <div style={{ fontWeight:700, color:'#fbbf24', marginBottom:2 }}>🟢 PIP vs 🟡 Начинающийся абсцесс vs 🔴 Абсцесс</div>
                        <div style={{ color:'var(--text-dim)', lineHeight:1.4 }}>
                          <b>🟢 PIP (норма):</b> Боль тянущая/ноющая, появляется через 4-24 ч, максимум на 2-3 день, проходит к 5-7 дню. Кожа не горячая, нет системной температуры. Зона может быть чуть уплотнена.<br/>
                          <b>🟡 Начинающийся абсцесс (внимание!):</b> Боль нарастает, а не убывает, после 3 дня. Кожа КРАСНАЯ и ГОРЯЧАЯ на ощупь в сравнении с соседней зоной.<br/>
                          <b>🔴 Абсцесс (срочно к врачу!):</b> Температура тела &gt;38°C, озноб. Зона Горячая, красная, отёк увеличивается. Может определяться флюктуация (зыбление) при пальпации. Требуется разрез и дренирование.
                        </div>
                      </div>
                      <div style={{ padding:'8px 10px', borderRadius:6, background:'rgba(34,197,94,0.04)', border:'1px solid rgba(34,197,94,0.1)', fontSize:8 }}>
                        <div style={{ fontWeight:700, color:'#4ade80', marginBottom:2 }}>🟢 Лечение PIP (домашнее)</div>
                        <div style={{ color:'var(--text-dim)', lineHeight:1.4 }}>
                          • Тёплый компресс 15 мин × 3 р/день. Расширяет сосуды, ускоряет всасывание.<br/>
                          • НПВС (ибупрофен 400-600 мг) внутрь — снижает воспаление и боль.<br/>
                          • Диклофенак-гель 1-2% местно 2-3 р/день.<br/>
                          • Лёгкое движение (ходьба, растяжка) — улучшает кровоток.<br/>
                          • НЕ массировать (масляные) — разрыв депо.<br/>
                          • НЕ греть горячим (ванна, сауна) — риск распространения инфекции если она есть.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Hematoma */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#6366f1', marginBottom:6 }}>🩸 Гематома (синяк) в месте инъекции</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                      <div style={{ padding:'8px 10px', borderRadius:6, background:'rgba(99,102,241,0.04)', border:'1px solid rgba(99,102,241,0.1)', fontSize:8 }}>
                        <div style={{ fontWeight:700, color:'#a5b4fc', marginBottom:2 }}>📋 Причины</div>
                        <div style={{ color:'var(--text-dim)', lineHeight:1.4 }}>
                          Повреждение капилляра/мелкого сосуда иглой. Чаще при: использовании толстых игл, нарушении свёртываемости, приёме антикоагулянтов/аспирина/рыбьего жира, тонкой коже, варикозе, неправильной технике.
                        </div>
                      </div>
                      <div style={{ padding:'8px 10px', borderRadius:6, background:'rgba(99,102,241,0.04)', border:'1px solid rgba(99,102,241,0.1)', fontSize:8 }}>
                        <div style={{ fontWeight:700, color:'#a5b4fc', marginBottom:2 }}>🩹 Лечение</div>
                        <div style={{ color:'var(--text-dim)', lineHeight:1.4 }}>
                          • <b>Первые 2 часа:</b> ХОЛОД (лёд через ткань) 10-15 мин. Сужает сосуды → меньше объём гематомы.<br/>
                          • <b>После 24 часов:</b> ТЕПЛО (тёплый компресс). Расширяет сосуды → ускоряет рассасывание.<br/>
                          • Гепариновая мазь / Троксевазин 2-3 р/день — ускоряет рассасывание синяка.<br/>
                          • Синяк проходит за 7-14 дней. Меняет цвет: синий → зелёный → жёлтый → исчезает.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Abscess */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', marginBottom:6 }}>🔴 Абсцесс: стадии, распознавание, действия</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                      <div style={{ padding:'8px 10px', borderRadius:6, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.1)', fontSize:8 }}>
                        <div style={{ fontWeight:700, color:'#fca5a5', marginBottom:2 }}>🦠 Как развивается абсцесс</div>
                        <div style={{ color:'var(--text-dim)', lineHeight:1.4 }}>
                          Бактерии (чаще Staphylococcus aureus со своей кожи) попадают в мышцу через прокол → начинают размножаться → иммунная система формирует гнойную полость (абсцесс). Инкубационный период: 2-7 дней после инъекции.
                        </div>
                      </div>
                      <div style={{ padding:'8px 10px', borderRadius:6, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.1)', fontSize:8 }}>
                        <div style={{ fontWeight:700, color:'#fca5a5', marginBottom:2 }}>🔍 4 стадии распознавания</div>
                        <div style={{ color:'var(--text-dim)', lineHeight:1.4 }}>
                          <b>Стадия 1 (1-2 день):</b> Лёгкое покраснение, незначительное повышение температуры кожи. От PIP отличается НАРАСТАНИЕМ симптомов.<br/>
                          <b>Стадия 2 (2-4 день):</b> Яркое покраснение, зона ГОРЯЧАЯ, болезненность усиливается. Отёк. Может быть субфебрильная температура (37.2-37.8).<br/>
                          <b>Стадия 3 (4-7 день):</b> Сильная боль пульсирующего характера. Кожа багрово-красная. Температура &gt;38°C, озноб. Зона отёка плотная. Может определяться флюктуация (зыбление гноя под кожей).<br/>
                          <b>Стадия 4 (&gt;7 дней):</b> Самопроизвольное вскрытие с выделением гноя (если повезло) или распространение: флегмона (разлитое гнойное воспаление) → сепсис (заражение крови). ОПАСНО ДЛЯ ЖИЗНИ.
                        </div>
                      </div>
                      <div style={{ padding:'8px 10px', borderRadius:6, background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.2)', fontSize:8 }}>
                        <div style={{ fontWeight:700, color:'#4ade80', marginBottom:2 }}>✅ Что делать</div>
                        <div style={{ color:'var(--text-dim)', lineHeight:1.4 }}>
                          • <b>Стадия 1:</b> Наблюдение. Возможно саморазрешение. Тёплые компрессы. При нарастании — к врачу.<br/>
                          • <b>Стадия 2+:</b> НЕМЕДЛЕННО к хирургу. Антибиотики (внутрь или в/м). Возможно, потребуется разрез и дренирование.<br/>
                          • <b>НИКОГДА:</b> не пытайтесь выдавить абсцесс самостоятельно (разрыв капсулы внутрь → распространение инфекции).<br/>
                          • <b>НИКОГДА:</b> не грейте на стадии 2+ (ускоряет размножение бактерий).<br/>
                          • Лечение абсцесса: разрез → удаление гноя → дренаж → перевязки → антибиотики. Заживление: 2-4 недели.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Oil embolism */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', marginBottom:6 }}>🫁 Масляная эмболия лёгких (МЭЛА)</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                      <div style={{ padding:'8px 10px', borderRadius:6, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.1)', fontSize:8 }}>
                        <div style={{ fontWeight:700, color:'#fca5a5', marginBottom:2 }}>📋 Что это и почему опасно</div>
                        <div style={{ color:'var(--text-dim)', lineHeight:1.4 }}>
                          Попадание масляного раствора в кровеносный сосуд → масло доходит до лёгочных капилляров → закупорка → нарушение газообмена. <b>Редкое (1:5000 — 1:10000 инъекций), но ПОТЕНЦИАЛЬНО СМЕРТЕЛЬНОЕ</b> осложнение. Чаще при самостоятельных инъекциях без аспирации.
                        </div>
                      </div>
                      <div style={{ padding:'8px 10px', borderRadius:6, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.1)', fontSize:8 }}>
                        <div style={{ fontWeight:700, color:'#fca5a5', marginBottom:2 }}>🚨 Симптомы (появляются через 2-10 мин после инъекции)</div>
                        <div style={{ color:'var(--text-dim)', lineHeight:1.4 }}>
                          • <b>Внезапный кашель</b> (сухой, навязчивый, неконтролируемый)<br/>
                          • <b>Одышка / затруднение дыхания</b><br/>
                          • <b>Боль в груди</b> (острая, давящая)<br/>
                          • <b>Тахикардия</b> (пульс &gt;100)<br/>
                          • <b>Чувство страха / паники</b><br/>
                          • При тяжёлой эмболии: цианоз (синеют губы), потеря сознания.
                        </div>
                      </div>
                      <div style={{ padding:'8px 10px', borderRadius:6, background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.2)', fontSize:8 }}>
                        <div style={{ fontWeight:700, color:'#4ade80', marginBottom:2 }}>✅ Действия при подозрении на МЭЛА</div>
                        <div style={{ color:'var(--text-dim)', lineHeight:1.4 }}>
                          • <b>НЕМЕДЛЕННО вызывайте скорую (112/103).</b><br/>
                          • Положение: сидя или полусидя (облегчает дыхание).<br/>
                          • Расстегните одежду. Обеспечьте доступ воздуха.<br/>
                          • Кислород через маску (если есть).<br/>
                          • Сообщите врачу: какой препарат, какой объём, когда была инъекция.<br/>
                          • Лёгкие случаи разрешаются самостоятельно через 30-60 мин (кашель + одышка проходят). Тяжёлые требуют госпитализации.<br/>
                          • <b>Профилактика:</b> ВСЕГДА аспирационная проба. Медленное введение. Правильный угол.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Nerve injury */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#f97316', marginBottom:6 }}>⚡ Повреждение нерва</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                      <div style={{ padding:'8px 10px', borderRadius:6, background:'rgba(249,115,22,0.04)', border:'1px solid rgba(249,115,22,0.1)', fontSize:8 }}>
                        <div style={{ fontWeight:700, color:'#fdba74', marginBottom:2 }}>📋 Причины и признаки</div>
                        <div style={{ color:'var(--text-dim)', lineHeight:1.4 }}>
                          • <b>Прямая травма иглой:</b> МГНОВЕННАЯ острая боль («прострел») по ходу нерва. Онемение, покалывание в зоне иннервации.<br/>
                          • <b>Химическое повреждение:</b> препарат введён РЯДОМ с нервом → воспаление → сдавление нерва. Симптомы появляются через часы/дни.<br/>
                          • <b>Самые частые зоны повреждения:</b> седалищный нерв (ягодица), бедренный нерв (передняя поверхность бедра), лучевой нерв (средняя треть плеча).
                        </div>
                      </div>
                      <div style={{ padding:'8px 10px', borderRadius:6, background:'rgba(249,115,22,0.04)', border:'1px solid rgba(249,115,22,0.1)', fontSize:8 }}>
                        <div style={{ fontWeight:700, color:'#fdba74', marginBottom:2 }}>🚨 Симптомы, требующие врача</div>
                        <div style={{ color:'var(--text-dim)', lineHeight:1.4 }}>
                          • Онемение конечности (не проходит через 30 мин)<br/>
                          • Слабость / парез («стопа шлёпает», «рука не поднимается»)<br/>
                          • Жгучая боль по ходу нерва<br/>
                          • Потеря чувствительности в зоне иннервации<br/>
                          • <b>Большинство нейропатий ВРЕМЕННЫЕ</b> (проходят за 2-6 недель). Постоянное повреждение — редкость (прямая инъекция в нерв).
                        </div>
                      </div>
                      <div style={{ padding:'8px 10px', borderRadius:6, background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.2)', fontSize:8 }}>
                        <div style={{ fontWeight:700, color:'#4ade80', marginBottom:2 }}>✅ Действия</div>
                        <div style={{ color:'var(--text-dim)', lineHeight:1.4 }}>
                          • При «простреле» во время вкола — немедленно извлеките иглу (не вводите препарат!).<br/>
                          • Консультация невролога. Возможно: ЭМГ (электромиография) для оценки проводимости.<br/>
                          • Витамины группы B (B1, B6, B12) — поддержка регенерации нерва.<br/>
                          • Физиотерапия (после острой фазы).<br/>
                          • Время восстановления: от 2 недель (лёгкое) до 6 месяцев (тяжёлое).
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sterile inflammation vs infection */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#8b5cf6', marginBottom:6 }}>🔬 Стерильное воспаление vs Инфекция: дифференциальная диагностика</div>
                    <div style={{ overflowX:'auto' }}>
                      <table style={{ width:'100%', fontSize:8, borderCollapse:'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom:'1px solid var(--border)' }}>
                            <th style={{ padding:3, color:'var(--text-dim)', textAlign:'left' }}>Признак</th>
                            <th style={{ padding:3, color:'#22c55e', textAlign:'left' }}>Стерильное воспаление (PIP)</th>
                            <th style={{ padding:3, color:'#ef4444', textAlign:'left' }}>Инфекция (абсцесс)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            ['Начало','Через 4-24 ч','Через 24-72 ч'],
                            ['Динамика','Пик на 2-3 день, затем ↓','Нарастает с каждым днём'],
                            ['Покраснение','Лёгкое или отсутствует','Яркое, распространяется'],
                            ['Температура кожи','Чуть теплее (локально)','ГОРЯЧАЯ (значительно теплее)'],
                            ['Температура тела','Нормальная (&lt;37.2)','&gt;38°C, озноб'],
                            ['Боль','Тянущая, ноющая','Пульсирующая, острая'],
                            ['Отёк','Умеренный, мягкий','Плотный, нарастающий'],
                            ['Флюктуация','Нет','Есть (зыбление гноя)'],
                            ['Анализ крови','Норма','Лейкоцитоз, ↑ СОЭ, ↑ CRP'],
                            ['Лечение','НПВС + тёплые компрессы','Разрез + дренаж + антибиотики'],
                          ].map((r: any, i: any) =>(
                            <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                              <td style={{ padding:3, color:'var(--text-light)', fontWeight:600 }}>{r[0]}</td>
                              <td style={{ padding:3, color:'#86efac' }}>{r[1]}</td>
                              <td style={{ padding:3, color:'#fca5a5' }}>{r[2]}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Warning banner (always visible) */}
              <div style={{ borderRadius:12, padding:12, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.2)' }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#ef4444', marginBottom:4 }}>⚠️ Критические предупреждения</div>
                <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.5 }}>
                  • <b style={{color:'#ef4444'}}>Никогда не используйте одну иглу дважды.</b> Затупленная игла = микротравмы + инфекция.<br/>
                  • <b style={{color:'#ef4444'}}>Всегда аспирационная проба.</b> Попадание масла в сосуд = масляная эмболия лёгких (угроза жизни).<br/>
                  • <b style={{color:'#ef4444'}}>При онемении / острой боли во время вкола — немедленно извлеките иглу.</b> Вы попали в нерв.<br/>
                  • <b style={{color:'#ef4444'}}>Спирт ТОЛЬКО 70%.</b> 96% спирт — слабее антисептик (быстро испаряется, не успевает убить бактерии).<br/>
                  • Ротация зон — не опция, а ОБЯЗАТЕЛЬНОЕ УСЛОВИЕ безопасности. Минимум 8 зон в цикле.<br/>
                  • Медленное введение масляных растворов: 1 мл = 20-30 сек. Быстрое = боль + риск осложнений.<br/>
                  • Не грейте масляный раствор выше температуры тела (разрушение эфиров, потеря стерильности).<br/>
                  • Храните препараты в тёмном, сухом месте при 15-25°C. Многодозовые флаконы — не &gt;28 дней после вскрытия.<br/>
                  • При малейших признаках инфекции (покраснение, отёк, боль, тепло) — НЕМЕДЛЕННО к врачу.<br/>
                  • Утилизируйте иглы ТОЛЬКО в непрокалываемый контейнер. Не в обычное мусорное ведро.<br/>
                  • Не занимайтесь самолечением осложнений. Абсцесс требует хирургического вмешательства, а не «народных средств».
                </div>
              </div>
            </div>
          {/* Cross-protocol warnings */}
            <div style={{ borderRadius:12, padding:12, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#f59e0b', marginBottom:4 }}>🔗 Перекрёстные предупреждения</div>
              <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.5 }}>
                • ❤️ <b>Кардио:</b> Эритропоэтин + ААС = риск тромбоза (Hct {'>'}50%). Контроль Hct каждые 2 нед. Флеботомия при Hct {'>'}54%<br/>
                • 🫁 <b>Печень:</b> Метформин + 17α-алкилы = риск лактат-ацидоза (редиайшие, но при нарушении функции печени). Контроль АЛТ/АСТ<br/>
                • 💧 <b>Почки:</b> Растворение тромбов — аспирин + гидратация. Риск ОПП при дегидратации + НПВС<br/>
                • 🦴 <b>Суставы:</b> Витамин C + коллаген — синергия. Витамин C улучшает абсорбцию негемового железа (осторожно при гемохроматозе)
              </div>
            </div>

          </InfoErrorBoundary>
  );
};
