// @ts-nocheck
/**
 * SupportProtocols.tsx — ПОЛНОЕ НАПОЛНЕНИЕ: фазы, тайминг, дневники, мониторинг
 * Секция: protocols
 */
import React from 'react';
import { FertilityPCTScreen } from '../FertilityPCTScreen';
import { InfoErrorBoundary } from './SupportScreenData';

const cardBg = { background:'var(--bg-secondary)', borderRadius:12, padding:12, border:'1px solid var(--border)' };
const pillActive = (c: string) => ({ padding:'5px 12px', borderRadius:16, fontSize:9, fontWeight:700, whiteSpace:'nowrap' as const, cursor:'pointer', background:c, color:'#000', border:'1px solid '+c });
const pillInactive = () => ({ padding:'5px 12px', borderRadius:16, fontSize:9, fontWeight:700, whiteSpace:'nowrap' as const, cursor:'pointer', background:'var(--bg-secondary)', color:'var(--text-dim)', border:'1px solid var(--border)' });

const PhaseLabel: React.FC<{ label: string; color: string }> = ({ label, color }) => (
  <span style={{ fontSize:8, fontWeight:800, padding:'1px 6px', borderRadius:4, background:color+'22', color }}>{label}</span>
);

const ItemRow: React.FC<{ name: string; dose: string; timing: string; note: string; color: string }> = ({ name, dose, timing, note, color }) => (
  <div style={{ padding:'5px 8px', borderRadius:4, marginBottom:3, background:'rgba(255,255,255,0.02)', border:'1px solid var(--border)' }}>
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
      <span style={{ fontSize:8, fontWeight:600, color:'var(--text-light)' }}>{name}</span>
      <div style={{ display:'flex', gap:6, alignItems:'center' }}>
        <span style={{ fontSize:8, fontWeight:700, color }}>{dose}</span>
        <span style={{ fontSize:7, color:'var(--text-dim)', padding:'1px 5px', borderRadius:4, background:'rgba(255,255,255,0.04)' }}>{timing}</span>
      </div>
    </div>
    <div style={{ fontSize:7, color:'var(--text-dim)', lineHeight:1.3, marginTop:1 }}>{note}</div>
  </div>
);

export const SupportProtocols: React.FC<{ s: Record<string, any> }> = ({ s }) => {
  const {
    protocolTab,
    setProtocolTab,
    neuroTab,
    setNeuroTab,
    jointPain,
    setJointPain,
    injuryHistory,
    setInjuryHistory,
    trainLoad,
    setTrainLoad,
  } = s;

  const jointScore = Math.min(100, Math.round(jointPain * 10 + injuryHistory * 5 + trainLoad * 3));

  return (
        <div style={{ padding:'0 0 70px' }}>
          {/* Warning card */}
          <div style={{ borderRadius:12, padding:14, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)', marginBottom:8 }}>
            <h3 style={{ margin:'0 0 6px', fontSize:12, fontWeight:700, color:'#f59e0b' }}>⚠️ Важные замечания</h3>
            <div style={{ margin:0 }}>
              <p style={{ margin:'0 0 4px', fontSize:9, lineHeight:1.3 }}><b>Информация носит ознакомительный характер.</b> Подбор поддержки должен производиться врачом или профильным специалистом с учётом индивидуальных особенностей: возраста, веса, генетических полиморфизмов (MTHFR, COMT, CYP), сопутствующих заболеваний и принимаемых лекарств.</p>
              <p style={{ margin:'0 0 4px', fontSize:9, lineHeight:1.3 }}><b>Без лабораторных данных</b> система использует среднестатистические риски по курсу. Для точного подбора необходимы свежие анализы (не старше 3 месяцев).</p>
              <p style={{ margin:0, fontSize:9, lineHeight:1.3 }}><b>Противопоказания:</b> некоторые вещества несовместимы с определёнными заболеваниями или лекарствами. Проконсультируйтесь со специалистом.</p>
            </div>
          </div>

          {/* Protocol sub-tab pills */}
          <div style={{ display:'flex', gap:4, padding:'4px 0 8px', overflowX:'auto', scrollbarWidth:'none' }}>
            {[['pct','ПКТ','#8b5cf6'],['fertility','Фертильность','#ec4899'],['hrt','ГЗТ','#f59e0b'],['neuro','Нейро','#06b6d4'],['joints','Суставы','#22c55e'],['acne','Акне','#ef4444']].map(([id, label, color]: [string, string, string]) => (
              <button key={id} onClick={() => setProtocolTab(id)} style={{
                padding:'7px 16px', borderRadius:22, fontSize:12, fontWeight:700, whiteSpace:'nowrap', cursor:'pointer', flexShrink:0,
                background: protocolTab === id ? color : 'var(--bg-secondary)',
                color: protocolTab === id ? '#000' : 'var(--text-dim)',
                border: '1px solid ' + (protocolTab === id ? color : 'var(--border)'),
              }}>{label}</button>
            ))}
          </div>

          {/* Content: PCT / Fertility / HRT */}
          {(['pct','fertility','hrt'] as string[]).includes(protocolTab) && (
            <InfoErrorBoundary label="Протоколы ПКТ/Фертильность/HRT">
              <FertilityPCTScreen initialTab={protocolTab === 'pct' ? 'pct-plan' : protocolTab === 'hrt' ? 'hrt' : undefined} restrictToMode={protocolTab as 'pct' | 'fertility' | 'hrt'} />
            </InfoErrorBoundary>
          )}

          {/* ══════════ NEURO ══════════ */}
          {protocolTab === 'neuro' && (<InfoErrorBoundary label="Нейропротекция">
            <div style={{ paddingBottom: 30, display:'flex', flexDirection:'column', gap:8 }}>
              {/* Header */}
              <div style={cardBg}>
                <div style={{ fontSize:13, fontWeight:800, color:'#06b6d4', marginBottom:2 }}>🧠 Нейротоксичность ААС</div>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Механизмы нейротоксичности, калькулятор риска и фазовый протокол нейропротекции.</p>
              </div>

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
                      desc:'Начинайте за 1 неделю ДО курса. Базовая нейропротекция закрывает окислительный стресс и ГАМК-дисбаланс. Эти вещества составляют фундамент — без них нейротоксичность неизбежна.',
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
                        { name:'Pregnenolone', dose:'10-30 мг', timing:'Утро', note:'Нейростероид — «материнский гормон». Восполняет подавленный синтез, модулирует GABA-A' },
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
                        { name:'DHEA', dose:'25-50 мг', timing:'Утро', note:'Нейростероид. Восстановление GABA-A, снижение депрессии, повышение нейропластичности' },
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
                      desc:'Максимальный уровень защиты при появлении симптомов. Ноотропный компонент для восстановления когнитивных функций.',
                      items:[
                        { name:'Bacopa Monnieri', dose:'300-600 мг', timing:'Утро', note:'Улучшение памяти, дендритное ветвление. Стандартизация 20% бакозидов. Эффект через 4-6 нед' },
                        { name:'L-Theanine', dose:'200-400 мг', timing:'Утро + Вечер', note:'ГАМК-модуляция. Повышение альфа-волн мозга. Снижение тревоги без седации' },
                        { name:'Citicoline', dose:'500-1000 мг', timing:'Утро', note:'Цитидин + холин. Синтез фосфатидилхолина мембран. Восстановление после ишемии' },
                        { name:'Noopept', dose:'10-30 мг', timing:'Утро + День', note:'Циклопролилглицин. Повышение BDNF и NGF. Улучшение памяти и когниций. Биодоступность ~99%' },
                        { name:'Семакс', dose:'1-3 мг', timing:'Утро интраназально', note:'Пептид ACTH(4-7)-Pro-Gly-Pro. Повышение BDNF +30%. Нейрогенез. Ноотропный эффект' },
                        { name:'Кортексин', dose:'10 мг/день', timing:'Утро в/м', note:'Полипептиды коры мозга телят. Нейропротекция + нейрорепарация. Курс 10 дней' },
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
          </InfoErrorBoundary>)}

          {/* ══════════ JOINTS ══════════ */}
          {protocolTab === 'joints' && (<InfoErrorBoundary label="Суставы">
            <div style={{ paddingBottom: 30, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={cardBg}>
                <div style={{ fontSize:13, fontWeight:800, color:'#22c55e', marginBottom:2 }}>🦴 Калькулятор суставов и связок</div>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Оценка риска суставной патологии и фазовый протокол поддержки хрящевой и соединительной ткани.</p>
              </div>

              {/* Calculator */}
              <div style={cardBg}>
                <div style={{ fontSize:11, fontWeight:700, color:'#f59e0b', marginBottom:6 }}>📊 Параметры риска</div>
                <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:8 }}>
                  {[
                    { label:'🦵 Боль в суставах', val:jointPain, max:10, set:setJointPain, labels:['Нет боли','Умеренная','Сильная'] },
                    { label:'🏥 Травмы в анамнезе', val:injuryHistory, max:5, set:setInjuryHistory, labels:['Нет','Растяжения','Разрывы'] },
                    { label:'🏋️ Тренировочная нагрузка', val:trainLoad, max:5, set:setTrainLoad, labels:['Лёгкая','Умеренная','Тяжёлые веса'] },
                  ].map((r: any, i: any) =>(
                    <div key={i}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                        <span style={{ fontSize:9, color:'var(--text-dim)' }}>{r.label}</span>
                        <span style={{ fontSize:9, fontWeight:700, color: jointScore<20?'#22c55e':jointScore<40?'#f59e0b':jointScore<60?'#f97316':'#ef4444' }}>{r.val}/{r.max}</span>
                      </div>
                      <input type="range" min="0" max={r.max} value={r.val} onChange={e => r.set(Number(e.target.value))} style={{ width:'100%', accentColor:jointScore<20?'#22c55e':jointScore<40?'#f59e0b':jointScore<60?'#f97316':'#ef4444' }} />
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:7, color:'var(--text-dim)' }}>{r.labels.map((l:any,li:any)=><span key={li}>{l}</span>)}</div>
                    </div>
                  ))}
                </div>
                {/* Score */}
                <div style={{ background: (jointScore<20?'#22c55e':jointScore<40?'#f59e0b':jointScore<60?'#f97316':'#ef4444')+'18', borderRadius:14, padding:14, border:'2px solid '+(jointScore<20?'#22c55e':jointScore<40?'#f59e0b':jointScore<60?'#f97316':'#ef4444')+'44', textAlign:'center' }}>
                  <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:4 }}>Индекс риска суставов</div>
                  <div style={{ fontSize:36, fontWeight:800, color:jointScore<20?'#22c55e':jointScore<40?'#f59e0b':jointScore<60?'#f97316':'#ef4444', lineHeight:1 }}>{jointScore}</div>
                  <div style={{ fontSize:10, fontWeight:700, color:jointScore<20?'#22c55e':jointScore<40?'#f59e0b':jointScore<60?'#f97316':'#ef4444', marginTop:4 }}>
                    {jointScore<20?'🟢 Норма — профилактика':jointScore<40?'🟡 Умеренный — базовая поддержка':jointScore<60?'🟠 Высокий — усиленная защита':'🔴 Критический — максимальная защита'}
                  </div>
                  <div style={{ marginTop:6, height:5, borderRadius:3, background:'rgba(255,255,255,0.1)', overflow:'hidden' }}>
                    <div style={{ width:jointScore+'%', height:'100%', borderRadius:3, background:'linear-gradient(90deg, #22c55e, #f59e0b 40%, #f97316 60%, #ef4444)', transition:'width 0.5s' }} />
                  </div>
                </div>
              </div>

              {/* Protocol phases */}
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {[
                  {
                    phase:'ФАЗА 1 · ЯДРО', label:'Обязательный минимум (профилактика)', color:'#22c55e',
                    condition:'Условие: любой уровень физической нагрузки',
                    desc:'Структурная основа хряща и кости. Без этого уровня восстановление хрящевой ткани невозможно.',
                    items:[
                      { name:'Коллаген II типа (UC-II)', dose:'40 мг', timing:'Утро натощак', note:'Нативный неденатурированный коллаген. Оральная толерантность: иммунные клетки Пейеровых бляшек «обучаются» не атаковать коллаген. Доказанное снижение боли на 33%' },
                      { name:'Витамин C', dose:'500-1000 мг', timing:'С едой', note:'Кофактор пролил- и лизил-гидроксилазы. Без вит.C синтез коллагена останавливается. Буферный приём 2×/день' },
                      { name:'Витамин D3 + K2', dose:'5000 МЕ + 100 мкг', timing:'С жирной едой', note:'Кальциевый обмен. D3 → абсорбция Ca²⁺. K2 → активация остеокальцина → Ca²⁺ в кости, не в сосуды' },
                    ]
                  },
                  {
                    phase:'ФАЗА 2 · БАЗА', label:'При умеренном риске (JointScore 20-40)', color:'#f59e0b',
                    condition:'Условие: JointScore ≥20 ИЛИ возраст >30 лет',
                    desc:'Субстраты для синтеза хрящевого матрикса. Противовоспалительный компонент.',
                    items:[
                      { name:'Глюкозамин сульфат', dose:'1500 мг', timing:'С едой', note:'Субстрат гликозаминогликанов. Стимуляция синтеза протеогликанов хондроцитами. Сульфатная форма — только она работает' },
                      { name:'Хондроитин сульфат', dose:'800-1200 мг', timing:'С едой', note:'Ингибирование MMP-3 и MMP-13 (коллагеназы). Удержание воды в матриксе хряща. Мол. масса 14-20 кДа' },
                      { name:'MSM', dose:'2000-3000 мг', timing:'Утро', note:'Органическая сера (34%). Дисульфидные мостики коллагена. Снижение боли на 25-40% в исследованиях' },
                      { name:'Omega-3 (EPA+DHA)', dose:'3-5 г', timing:'С едой', note:'Резолвины и протектины → разрешение воспаления в синовиальной жидкости. EPA >2 г для эффекта' },
                    ]
                  },
                  {
                    phase:'ФАЗА 3 · УСИЛЕНИЕ', label:'При высоком риске (JointScore 40-60)', color:'#f97316',
                    condition:'Условие: JointScore ≥40 ИЛИ боли ≥4/10',
                    desc:'Таргетная противовоспалительная терапия. Синовиальная защита.',
                    items:[
                      { name:'Гиалуроновая кислота', dose:'200-300 мг', timing:'Утро натощак', note:'Компонент синовиальной жидкости. Вязкоэластичность сустава. Пероральная форма — системный эффект' },
                      { name:'Куркумин + пиперин', dose:'500-1000 мг', timing:'С едой', note:'Ингибирование COX-2 = ибупрофену. NF-kB подавление. IL-1β ↓. Пиперин повышает биодоступность на 2000%' },
                      { name:'Босвеллия (AKBA ≥30%)', dose:'300-500 мг', timing:'С едой', note:'Ингибирование 5-LOX → ↓ лейкотриенов. Снижение боли на 40-50% при ОА. Не раздражает ЖКТ (в отличие от НПВС)' },
                    ]
                  },
                  {
                    phase:'ФАЗА 4 · МАКСИМУМ', label:'При критическом риске (JointScore ≥60)', color:'#ef4444',
                    condition:'Условие: JointScore ≥60 ИЛИ боли ≥7/10',
                    desc:'Пептидная регенерация. Реальный ремонт повреждённых тканей (не только симптоматика).',
                    items:[
                      { name:'BPC-157', dose:'250-500 мкг', timing:'Утро + Вечер', note:'Пентадекапептид. Заживление сухожилий и связок. Ангиогенез через VEGF. Ускорение регенерации в 2-3 раза' },
                      { name:'TB-500 (Thymosin β4)', dose:'2.5-5 мг', timing:'2×/нед', note:'Полимеризация G-актина → F-актин. Миграция клеток. Регенерация. Антивоспалительное' },
                      { name:'Секретагоги ГР', dose:'100-300 мкг', timing:'На ночь натощак', note:'Грелин-миметики. Пульсирующая секреция ГР → IGF-1 → синтез коллагена хондроцитами' },
                      { name:'Кальций + Бор', dose:'500 мг + 3 мг', timing:'Вечер', note:'Ca — минерализация кости. Бор — удлиняет t½ витамина D и E2 (меньше боли)' },
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

              {/* Lab monitoring */}
              <div style={cardBg}>
                <div style={{ fontSize:11, fontWeight:700, color:'#60a5fa', marginBottom:6 }}>🧪 Лабораторный мониторинг суставов</div>
                {[
                  { m:'Ревматоидный фактор (RF)', t:'< 14 МЕ/мл', w:'Каждые 12 нед' },
                  { m:'С-реактивный белок (hs-CRP)', t:'< 1 мг/л', w:'Каждые 4-8 нед' },
                  { m:'Мочевая кислота', t:'200-420 мкмоль/л', w:'Каждые 8 нед' },
                  { m:'25-OH Витамин D', t:'50-80 нг/мл', w:'Каждые 12 нед' },
                  { m:'Кальций общий + ионизированный', t:'2.15-2.55 ммоль/л', w:'Каждые 12 нед' },
                  { m:'Антитела к коллагену II типа', t:'< 20 ЕД/мл', w:'При подозрении на РА' },
                  { m:'СОЭ', t:'< 15 мм/ч', w:'Каждые 8 нед' },
                ].map((a: any, i: any) =>(
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'6px 8px', borderRadius:4, marginBottom:3, background:'rgba(59,130,246,0.04)', border:'1px solid rgba(59,130,246,0.08)', fontSize:8 }}>
                    <span style={{ color:'var(--text-light)' }}>{a.m}</span>
                    <span style={{ fontWeight:600, color:'#60a5fa' }}>{a.t} · {a.w}</span>
                  </div>
                ))}
              </div>

              {/* Imaging */}
              <div style={cardBg}>
                <div style={{ fontSize:11, fontWeight:700, color:'#a855f7', marginBottom:6 }}>🔬 Инструментальная диагностика</div>
                {[
                  { name:'УЗИ суставов (B-режим + допплер)', purpose:'Выпот, синовит, эрозии, гиперваскуляризация', when:'Боль/отёк ≥2 нед' },
                  { name:'МРТ сустава (1.5/3 Тесла)', purpose:'Хрящ (T2-mapping), мениски, связки, субхондральная кость', when:'Боль >4 нед или подозрение на разрыв' },
                  { name:'Рентгенография', purpose:'Суставная щель (JSN), остеофиты, субхондральный склероз', when:'Подозрение на ОА, перелом' },
                  { name:'Артроскопия', purpose:'Прямая визуализация хряща, биопсия', when:'Неясный диагноз, неэффективность 6 мес терапии' },
                ].map((e: any, i: any) =>(
                  <div key={i} style={{ padding:'6px 8px', borderRadius:4, marginBottom:4, background:'rgba(168,85,247,0.04)', border:'1px solid rgba(168,85,247,0.08)', fontSize:8 }}>
                    <div style={{ fontWeight:600, color:'#c084fc' }}>{e.name}</div>
                    <div style={{ color:'var(--text-dim)' }}>{e.purpose}</div>
                    <div style={{ fontSize:7, color:'#a855f7', opacity:0.7 }}>Показание: {e.when}</div>
                  </div>
                ))}
              </div>

              {/* Pain diary */}
              <div style={cardBg}>
                <div style={{ fontSize:11, fontWeight:700, color:'#22c55e', marginBottom:6 }}>📓 Дневник боли (визуально-аналоговая шкала)</div>
                <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Заполняйте ежедневно. Отмечайте локализацию и интенсивность. При боли ≥6/10 — не тренируйте эту область.</p>
                {['Плечи','Локти','Запястья','Поясница','ТБС','Колени','Голеностоп'].map((zone: any, i: any) =>(
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ fontSize:9, fontWeight:600, color:'var(--text-light)', width:90 }}>{zone}</span>
                    <div style={{ flex:1, display:'flex', gap:3 }}>
                      {[0,1,2,3,4,5,6,7,8,9,10].map((v: any) =>(
                        <span key={v} style={{ width:18, height:18, borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center', fontSize:7, fontWeight:v===0?400:700, cursor:'pointer',
                          background: v<=2?'rgba(34,197,94,0.15)':v<=4?'rgba(245,158,11,0.15)':v<=7?'rgba(249,115,22,0.15)':'rgba(239,68,68,0.15)',
                          color: v<=2?'#22c55e':v<=4?'#f59e0b':v<=7?'#f97316':'#ef4444', border:'1px solid rgba(255,255,255,0.06)'
                        }}>{v}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </InfoErrorBoundary>)}

          {/* ══════════ ACNE ══════════ */}
          {protocolTab === 'acne' && (<InfoErrorBoundary label="Акне">
            <div style={{ paddingBottom: 30, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={cardBg}>
                <div style={{ fontSize:13, fontWeight:800, color:'#ef4444', marginBottom:2 }}>🔴 Анти-акне протокол (ААС-индуцированное акне)</div>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Системная, локальная и гигиеническая терапия. Фазовый подход по тяжести акне.</p>
              </div>

              {/* Phases */}
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {[
                  {
                    phase:'ФАЗА 1 · БАЗОВАЯ ГИГИЕНА', label:'Профилактика (обязательно на курсе)', color:'#22c55e',
                    condition:'Условие: любой курс ААС',
                    desc:'Основа борьбы с акне — ежедневная гигиена. Без этого никакая терапия не будет эффективной.',
                    items:[
                      { name:'Умывание 2×/день', dose:'Утро + Вечер', timing:'Утро и вечер', note:'Специализированное средство с салициловой кислотой 0.5-2% или бензоил пероксидом 2.5-5%. Не использовать обычное мыло!' },
                      { name:'Смена наволочки', dose:'Каждые 2-3 дня', timing:'—', note:'Наволочка накапливает себум и бактерии. Частая смена снижает контаминацию кожи лица на 40%' },
                      { name:'Не трогать лицо руками', dose:'Всегда', timing:'—', note:'Руки — источник бактерий. Каждое прикосновение переносит C. acnes и стафилококки на лицо' },
                      { name:'Увлажнение', dose:'Утро и вечер', timing:'Утро и вечер', note:'Нежирный увлажняющий крем (non-comedogenic). Пересушенная кожа вырабатывает ЕЩЁ БОЛЬШЕ себума' },
                    ]
                  },
                  {
                    phase:'ФАЗА 2 · НУТРИЦЕВТИКИ', label:'При первых признаках акне (лёгкая форма)', color:'#f59e0b',
                    condition:'Условие: единичные папулы/пустулы (<10 элементов)',
                    desc:'Системные нутрицевтики, регулирующие себум и воспаление изнутри.',
                    items:[
                      { name:'Цинк (пиколинат)', dose:'50 мг', timing:'На ночь', note:'Ингибирует 5α-редуктазу → ↓ DHT в коже. Антивоспалительное. Антибактериальное (биоплёнки C. acnes)' },
                      { name:'Ниацинамид (B3)', dose:'500-1000 мг', timing:'Утро', note:'Регулирует себум. Антивоспалительное через ↓ IL-8. Уменьшает покраснения. Доказанная эффективность' },
                      { name:'Медь', dose:'1-2 мг', timing:'Утро (отдельно от Zn!)', note:'Кофактор лизил-оксидазы → сшивка коллагена → заживление. НЕ одновременно с цинком (антагонизм)' },
                      { name:'Витамин А (ретинол)', dose:'5000-10000 МЕ', timing:'С жирной едой', note:'Регулирует кератинизацию. Снижает гиперкератоз фолликулов. При беременности — НЕЛЬЗЯ' },
                    ]
                  },
                  {
                    phase:'ФАЗА 3 · ЛОКАЛЬНАЯ ТЕРАПИЯ', label:'При умеренном акне (10-30 элементов)', color:'#f97316',
                    condition:'Условие: папулы/пустулы 10-30 элементов, есть комедоны',
                    desc:'Топические ретиноиды и антибиотики. Локально на зоны поражения.',
                    items:[
                      { name:'Клензит-С гель', dose:'Тонкий слой', timing:'На ночь локально', note:'Адапален 0.1% (ретиноид 3-го поколения) + клиндамицин 1%. Открывает комедоны + антибиотик. Не на всё лицо!' },
                      { name:'Клендовит гель', dose:'Тонкий слой', timing:'Утро локально', note:'Клиндамицин 1% + адапален 0.05%. Меньшая концентрация ретиноида — дневная поддержка' },
                      { name:'Бензоил пероксид 5%', dose:'Тонкий слой', timing:'Утро локально', note:'Окислитель → уничтожает C. acnes. Не вызывает резистентности (в отличие от антибиотиков). Может сушить кожу' },
                      { name:'Салициловая кислота 2%', dose:'Точечно', timing:'Вечер', note:'Кератолитик. Открывает поры. Для жирной кожи. Не сочетать с бензоил пероксидом одновременно' },
                    ]
                  },
                  {
                    phase:'ФАЗА 4 · СИСТЕМНАЯ ТЕРАПИЯ', label:'При тяжёлом акне (≥30 элементов / узлы / кисты)', color:'#ef4444',
                    condition:'Условие: обильные папулы/пустулы, узлы, кисты, рубцевание',
                    desc:'Системные препараты + дерматолог. Самолечение на этой стадии опасно.',
                    items:[
                      { name:'Верошпирон 50 мг', dose:'50 мг', timing:'Утро', note:'Антиандроген (блокатор AR). Только при гормональном акне (DHT/E2). Контроль K+ каждые 2 нед! ' },
                      { name:'Солярий', dose:'2×/нед × 5 мин', timing:'День', note:'UV-B подсушивает акне, снижает C. acnes. Не более 5 мин / 2 раза в неделю. Риск меланомы' },
                      { name:'Изотретиноин (Роаккутан)', dose:'0.5-1 мг/кг/день', timing:'С жирной едой', note:'⚠ ТОЛЬКО по назначению дерматолога. Контроль АЛТ/АСТ, липидов ежемесячно. Тератогенность!' },
                      { name:'Системные антибиотики', dose:'По назначению врача', timing:'—', note:'Доксициклин 100 мг/день или Миноциклин. Не >3 мес (резистентность). Только по рецепту' },
                      { name:'Кортикостероиды (инъекции)', dose:'—', timing:'—', note:'Внутриочаговое введение триамцинолона в кисты/узлы. Только дерматолог. Быстрый эффект (48-72 ч)' },
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

              {/* Lab */}
              <div style={cardBg}>
                <div style={{ fontSize:11, fontWeight:700, color:'#ec4899', marginBottom:6 }}>🧪 Необходимые анализы крови</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginBottom:8 }}>
                  {['Тестостерон общий/свободный','DHT','Эстрадиол (E2)','ЛГ/ФСГ','Пролактин','DHEA-S','Кортизол','SHBG','Калий (K+)','Глюкоза/Инсулин/HOMA-IR','АЛТ/АСТ (контроль гепатотоксичности)','Липидограмма (при Изотретиноине)'].map((a: any, i: any) =>(
                    <span key={i} style={{ fontSize:7, padding:'3px 8px', borderRadius:4, background:'rgba(236,72,153,0.06)', color:'#f472b6', border:'1px solid rgba(236,72,153,0.12)' }}>{a}</span>
                  ))}
                </div>
                <div style={{ fontSize:9, fontWeight:700, color:'#a855f7', marginBottom:4 }}>🔬 Инструментальные исследования</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                  {['УЗИ кожи (20-50 МГц)','Себуметрия','Дерматоскопия','Микробиология (C. acnes)','Биопсия (при атипии)'].map((e: any, i: any) =>(
                    <span key={i} style={{ fontSize:7, padding:'2px 6px', borderRadius:4, background:'rgba(168,85,247,0.06)', color:'#c084fc', border:'1px solid rgba(168,85,247,0.12)' }}>{e}</span>
                  ))}
                </div>
              </div>

              {/* Diary */}
              <div style={cardBg}>
                <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', marginBottom:6 }}>📓 Дневник обострений акне (еженедельный трекинг)</div>
                <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Отслеживайте динамику. Связывайте обострения с препаратами и дозами.</p>
                <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  {[
                    { q:'Количество новых элементов за неделю', m:'< 3 — норма, 3-10 — ФАЗА 3, >10 — ФАЗА 4' },
                    { q:'Тип элементов (комедоны / папулы / пустулы / узлы / кисты)', m:'Узлы и кисты → ФАЗА 4 немедленно' },
                    { q:'Зоны поражения (лицо / спина / плечи / грудь)', m:'Спина — часто гормональное (DHT). Лицо — гигиена + локально' },
                    { q:'Зуд / болезненность элементов', m:'Зуд = воспаление. Боль = глубокие узлы → дерматолог' },
                    { q:'Связь с препаратом / дозой ААС', m:'Записывайте. Поможет выявить триггерный ААС' },
                    { q:'Рубцевание / гиперпигментация', m:'Рубцы = немедленно к дерматологу. Атрофические рубцы необратимы' },
                  ].map((x: any, i: any) =>(
                    <div key={i} style={{ padding:'6px 8px', borderRadius:6, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.08)', fontSize:8 }}>
                      <div style={{ fontWeight:600, color:'#fca5a5' }}>{x.q}</div>
                      <div style={{ color:'var(--text-dim)', marginTop:2 }}>{x.m}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Hygiene detailed */}
              <div style={cardBg}>
                <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>🧼 Детальный гигиенический протокол</div>
                {[
                  { step:'Утро', action:'Умывание средством с салициловой кислотой 0.5-2%. Тёплая вода (не горячая!). Промокнуть (не тереть!) чистым полотенцем. Клендовит гель локально на элементы. Увлажняющий крем.' },
                  { step:'День', action:'Не трогать лицо. Если жирная кожа — матирующие салфетки. Обильное питьё (вода). Солярий 2×/нед по 5 мин (если назначено).' },
                  { step:'Вечер', action:'Умывание. Клензит-С гель локально на ночь (ретиноид — только на ночь, фоточувствительность!). Смена наволочки каждые 2-3 дня.' },
                  { step:'После тренировки', action:'НЕМЕДЛЕННО умыться. Пот + себум + бактерии = идеальная среда для акне. Специальное средство. Чистая одежда.' },
                ].map((x: any, i: any) =>(
                  <div key={i} style={{ padding:'6px 8px', borderRadius:6, marginBottom:4, background:'rgba(59,130,246,0.04)', border:'1px solid rgba(59,130,246,0.08)', fontSize:8 }}>
                    <div style={{ fontWeight:700, color:'#60a5fa' }}>{x.step}</div>
                    <div style={{ color:'var(--text-dim)', marginTop:2, lineHeight:1.3 }}>{x.action}</div>
                  </div>
                ))}
              </div>

              {/* Warnings */}
              <div style={{ borderRadius:12, padding:12, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)' }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#f59e0b', marginBottom:4 }}>⚠️ Критические предупреждения</div>
                <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.5 }}>
                  • <b style={{color:'#ef4444'}}>Верошпирон + добавки калия = ОПАСНО</b> (риск гиперкалиемии и остановки сердца)<br/>
                  • <b style={{color:'#ef4444'}}>Изотретиноин + беременность = ЗАПРЕЩЕНО</b> (тяжёлые пороки развития плода)<br/>
                  • Солярий ≤ 2 раза/нед по 5 мин (превышение = риск меланомы)<br/>
                  • Цинк + медь — РАЗДЕЛЬНО (цинк на ночь, медь утром, интервал ≥4 часа)<br/>
                  • При неэффективности терапии 4-6 нед — консультация дерматолога<br/>
                  • Не выдавливать элементы! Выдавливание → рубцы и распространение инфекции<br/>
                  • Системные антибиотики ≤ 3 мес (развитие резистентности C. acnes)
                </div>
              </div>
            </div>
          </InfoErrorBoundary>)}
        </div>
  );
};
