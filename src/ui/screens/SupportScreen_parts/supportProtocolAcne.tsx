// @ts-nocheck
import React, { useState } from 'react';
import { cardBg, pillActive, pillInactive, PhaseLabel, ItemRow, ItemRowTriage, triageBadge, phaseBadge, renderRow, renderPhase, timingBlock, monitoringBlock } from './supportProtocolsShared';
import { InfoErrorBoundary } from './SupportScreenData';

export const SupportProtocolAcne: React.FC<{ s: Record<string, any> }> = ({ s }) => {
  const [acneTab, setAcneTab] = useState('protocol');
  return (
          <InfoErrorBoundary label="Акне">
            <div style={{ paddingBottom: 30, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={cardBg}>
                <div style={{ fontSize:13, fontWeight:800, color:'#ef4444', marginBottom:2 }}>🔴 Анти-акне протокол (ААС-индуцированное акне)</div>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Системная, локальная и гигиеническая терапия. Фазовый подход по тяжести акне.</p>
              </div>

              {/* Sub-tabs */}
              <div style={{ display:'flex', gap:4, overflowX:'auto', scrollbarWidth:'none' }}>
                {[
                  { id:'protocol', label:'💊 Фазы протокола' },
                  { id:'timing', label:'⏰ Тайминг ухода' },
                  { id:'lab', label:'🧪 Анализы' },
                  { id:'diary', label:'📓 Дневник' },
                ].map((t: any) => (
                  <button key={t.id} onClick={() => setAcneTab(t.id)}
                    style={acneTab === t.id ? pillActive('#f97316') : pillInactive()}>{t.label}</button>
                ))}
              </div>

              {/* Phases */}
              {acneTab === 'protocol' && (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {[
                  {
                    phase:'ФАЗА 1 · БАЗОВАЯ ГИГИЕНА', label:'Профилактика (обязательно на курсе)', color:'#22c55e',
                    condition:'Условие: любой курс ААС',
                    desc:'Основа борьбы с акне — ежедневная гигиена. Без этого никакая терапия не будет эффективной.',
                    items:[
                      { name:'Умывание 2×/день', dose:'Утро + Вечер', timing:'Утро и вечер', note:'Средство с салициловой кислотой 0.5-2% или бензоил пероксидом 2.5-5%. Не использовать обычное мыло!' },
                      { name:'Смена наволочки', dose:'Каждые 2-3 дня', timing:'—', note:'Наволочка накапливает себум и бактерии. Частая смена снижает контаминацию кожи на 40%' },
                      { name:'Не трогать лицо руками', dose:'Всегда', timing:'—', note:'Руки — источник бактерий. Каждое прикосновение переносит C. acnes и стафилококки на лицо' },
                      { name:'Увлажнение', dose:'Утро и вечер', timing:'Утро и вечер', note:'Нежирный крем (non-comedogenic). Пересушенная кожа вырабатывает ЕЩЁ БОЛЬШЕ себума' },
                    ]
                  },
                  {
                    phase:'ФАЗА 2 · НУТРИЦЕВТИКИ', label:'При первых признаках акне (лёгкая форма)', color:'#f59e0b',
                    condition:'Условие: единичные папулы/пустулы (<10 элементов)',
                    desc:'Системные нутрицевтики, регулирующие себум и воспаление изнутри.',
                    items:[
                      { name:'Цинк (пиколинат)', dose:'50 мг', timing:'На ночь', note:'Ингибирует 5α-редуктазу → снижение DHT в коже. Антивоспалительное. Антибактериальное (биоплёнки C. acnes)' },
                      { name:'Ниацинамид (B3)', dose:'500-1000 мг', timing:'Утро', note:'Регулирует себум. Антивоспалительное через снижение IL-8. Уменьшает покраснения' },
                      { name:'Медь', dose:'1-2 мг', timing:'Утро (отдельно от Zn!)', note:'Кофактор лизил-оксидазы → сшивка коллагена → заживление. НЕ одновременно с цинком (антагонизм)' },
                      { name:'Витамин А (ретинол)', dose:'5000-10000 МЕ', timing:'С жирной едой', note:'Регулирует кератинизацию. Снижает гиперкератоз фолликулов. При беременности — НЕЛЬЗЯ' },
                    ]
                  },
                  {
                    phase:'ФАЗА 3 · ЛОКАЛЬНАЯ ТЕРАПИЯ', label:'При умеренном акне (10-30 элементов)', color:'#f97316',
                    condition:'Условие: папулы/пустулы 10-30 элементов, есть комедоны',
                    desc:'Топические ретиноиды и антибиотики. Локально на зоны поражения.',
                    items:[
                      { name:'Клензит-С гель 💊', dose:'Тонкий слой', timing:'На ночь локально', note:'Адапален 0.1% (ретиноид) + клиндамицин 1% (антибиотик). Не более 8 нед непрерывно (риск резистентности C. acnes). По назначению врача' },
                      { name:'Клендовит гель 💊', dose:'Тонкий слой', timing:'Утро локально', note:'Клиндамицин 1% + адапален 0.05%. Меньшая концентрация ретиноида. ⚠ То же действующее вещество, что в Клензит-С — не дублировать. По назначению врача' },
                      { name:'Бензоил пероксид 5%', dose:'Тонкий слой', timing:'Утро локально', note:'Окислитель → уничтожает C. acnes. Не вызывает резистентности. Может сушить кожу' },
                      { name:'Салициловая кислота 2%', dose:'Точечно', timing:'Вечер', note:'Кератолитик. Открывает поры. Для жирной кожи. Чередовать: утро БПО, вечер салициловая' },
                    ]
                  },
                  {
                    phase:'ФАЗА 4 · СИСТЕМНАЯ ТЕРАПИЯ', label:'При тяжёлом акне (≥30 элементов / узлы / кисты)', color:'#ef4444',
                    condition:'Условие: обильные папулы/пустулы, узлы, кисты, рубцевание',
                    desc:'Системные препараты + дерматолог. Самолечение на этой стадии опасно.',
                    items:[
                      { name:'Верошпирон 50 мг ⚠ ТОЛЬКО ДЛЯ ЖЕНЩИН', dose:'50 мг', timing:'Утро', note:'Антагонист альдостерона, ингибитор 5α-редуктазы и CYP17 (НЕ блокатор AR). При гормональном акне. Контроль K+ каждые 2 нед! Мужчинам противопоказан' },
                      { name:'−', dose:'−', timing:'−', note:'Исключён (устаревшая практика). УФ-терапия не рекомендуется для лечения акне (AAD/EDF). См. дневной уход ниже' },
                      { name:'Изотретиноин (Роаккутан) 💊', dose:'0.5-1 мг/кг/день', timing:'С жирной едой', note:'⚠ ТОЛЬКО по назначению дерматолога. Контроль АЛТ/АСТ, липидов. Тератогенность!' },
                      { name:'Системные антибиотики 💊', dose:'По назначению врача', timing:'—', note:'Доксициклин 100 мг/день или Миноциклин. Не >3 мес (резистентность). По рецепту' },
                      { name:'Кортикостероиды (инъекции)', dose:'—', timing:'—', note:'Триамцинолон в кисты/узлы. Только дерматолог. Быстрый эффект (48-72 ч)' },
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
              {acneTab === 'timing' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', marginBottom:6 }}>🧼 Суточный гигиенический протокол при акне</div>
                    <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Систематический уход — ключ к контролю акне. Каждый этап дня имеет свои задачи.</p>
                    {[
                      { time:'🌅 Утро (06:00–08:00)', color:'#f59e0b', items:[
                        { n:'Умывание (салициловая кислота 0.5-2%)', why:'Тёплая вода. Смыть ночной себум + бактерии. Промокнуть чистым полотенцем (не тереть!)' },
                        { n:'Клендовит гель (клиндамицин + адапален)', why:'Локально на элементы. Меньшая концентрация ретиноида — дневная поддержка' },
                        { n:'Увлажняющий крем (non-comedogenic)', why:'Пересушенная кожа = больше себума. Нежирная текстура обязательна' },
                        { n:'SPF 30+ (при ретиноидах)', why:'Ретиноиды повышают фоточувствительность. Солнцезащита обязательна ежедневно' },
                      ]},
                      { time:'☀️ День (12:00–14:00)', color:'#f97316', items:[
                        { n:'Не трогать лицо руками', why:'Руки — источник бактерий. Каждое прикосновение = перенос C. acnes' },
                        { n:'Матирующие салфетки (при жирной коже)', why:'Убрать избыток себума без умывания. Промокнуть, не тереть' },
                        { n:'Обильное питьё (вода)', why:'Гидратация кожи изнутри. Снижение концентрации себума' },
                      ]},
                      { time:'🌆 Вечер (18:00–20:00)', color:'#ef4444', items:[
                        { n:'Умывание (салициловая кислота / пенка)', why:'Смыть дневной себум, пот, загрязнения. Тщательно, но без трения' },
                        { n:'Клензит-С гель (адапален + клиндамицин)', why:'Локально на ночь. Ретиноид — ТОЛЬКО на ночь (фоточувствительность!)' },
                        { n:'Бензоил пероксид 5% (при необх.)', why:'Точечно. Утром — БПО, вечером — ретиноид (интервал). Не наносить одновременно — риск раздражения' },
                      ]},
                      { time:'🏋️ После тренировки', color:'#6366f1', items:[
                        { n:'Немедленное умывание', why:'Пот + себум + бактерии = идеальная среда для акне. Не ждать ни минуты' },
                        { n:'Чистая одежда', why:'Синтетика накапливает бактерии. Хлопок для тренировки. Стирка после каждой' },
                        { n:'Душ с антибактериальным средством', why:'Спина и плечи — частая зона гормонального акне. Тщательное мытьё' },
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

              {/* Lab */}
              {acneTab === 'lab' && (
              <div style={cardBg}>
                <div style={{ fontSize:11, fontWeight:700, color:'#ec4899', marginBottom:6 }}>🧪 Необходимые анализы крови</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginBottom:8 }}>
                  {['Тестостерон общий/свободный','DHT','Эстрадиол (E2)','ЛГ/ФСГ','Пролактин','DHEA-S','Кортизол','SHBG','Калий (K+)','Глюкоза/Инсулин/HOMA-IR','АЛТ/АСТ','Липидограмма'].map((a: any, i: any) =>(
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
              )}

              {/* Diary */}
              {acneTab === 'diary' && (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', marginBottom:6 }}>📓 Дневник обострений акне (еженедельный трекинг)</div>
                  <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Отслеживайте динамику. Связывайте обострения с препаратами и дозами.</p>
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    {[
                      { q:'Количество новых элементов за неделю', m:'<3 — норма, 3-10 — ФАЗА 3, >10 — ФАЗА 4' },
                      { q:'Тип элементов (комедоны / папулы / пустулы / узлы)', m:'Узлы и кисты → ФАЗА 4 немедленно' },
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
                    { step:'Утро', action:'Умывание средством с салициловой кислотой 0.5-2%. Тёплая вода (не горячая!). Промокнуть чистым полотенцем. Клендовит гель локально. Увлажняющий крем.' },
                    { step:'День', action:'Не трогать лицо. Матирующие салфетки при жирной коже. Обильное питьё (вода).' },
                    { step:'Вечер', action:'Умывание. Клензит-С гель локально на ночь. Смена наволочки каждые 2-3 дня.' },
                    { step:'После тренировки', action:'Немедленное умывание. Пот + себум + бактерии = идеальная среда. Чистая одежда.' },
                  ].map((x: any, i: any) =>(
                    <div key={i} style={{ padding:'6px 8px', borderRadius:6, marginBottom:4, background:'rgba(59,130,246,0.04)', border:'1px solid rgba(59,130,246,0.08)', fontSize:8 }}>
                      <div style={{ fontWeight:700, color:'#60a5fa' }}>{x.step}</div>
                      <div style={{ color:'var(--text-dim)', marginTop:2, lineHeight:1.3 }}>{x.action}</div>
                    </div>
                  ))}
                </div>
              </div>
              )}

              {/* Warnings (always visible) */}
              <div style={{ borderRadius:12, padding:12, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)' }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#f59e0b', marginBottom:4 }}>⚠️ Критические предупреждения</div>
                <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.5 }}>
                  • <b style={{color:'#ef4444'}}>Верошпирон + добавки калия = ОПАСНО</b> (риск гиперкалиемии и остановки сердца)<br/>
                  • <b style={{color:'#ef4444'}}>Изотретиноин + беременность = ЗАПРЕЩЕНО</b> (тяжёлые пороки развития плода)<br/>
                  • Солярий НЕ рекомендуется для лечения акне (риск меланомы превышает пользу). Использовать топические средства<br/>
                  • Цинк + медь — РАЗДЕЛЬНО (цинк на ночь, медь утром, интервал ≥4 часа)<br/>
                  • При неэффективности терапии 4-6 нед — консультация дерматолога<br/>
                  • Не выдавливать элементы! Выдавливание → рубцы и распространение инфекции<br/>
                  • Системные антибиотики ≤ 3 мес (развитие резистентности C. acnes)
                </div>
              </div>
            </div>
          </InfoErrorBoundary>
  );
};
