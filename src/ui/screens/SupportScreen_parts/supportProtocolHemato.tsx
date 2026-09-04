// @ts-nocheck
import React, { useState } from 'react';
import { cardBg, pillActive, pillInactive, PhaseLabel, ItemRow, ItemRowTriage, triageBadge, phaseBadge, renderRow, renderPhase, timingBlock, monitoringBlock, StopBanner } from './supportProtocolsShared';
import { InfoErrorBoundary } from './SupportScreenData';

export const SupportProtocolHemato: React.FC<{ s: Record<string, any> }> = ({ s }) => {
  const [hematoTab, setHematoTab] = useState('protocol');
  return (
          <InfoErrorBoundary label="Гематология">
            <div className="sup-proto-hemato" style={{ paddingBottom: 30, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={cardBg}>
                <div style={{ fontSize:13, fontWeight:800, color:'#ef4444', marginBottom:2 }}>🩸 Гематологическая поддержка на курсе ААС</div>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Контроль полицитемии, коагуляции и анемии. Профилактика тромбозов при высоком Hct.</p>
              </div>

              <StopBanner title="Критические гематологические пороги" thresholds={[
                'Гематокрит >48% — усиление контроля вязкости (рыбий жир, гидратация 4+ л/день); донорство/флеботомия — ТОЛЬКО при симптомах. Перед решением — регидратация + повтор Hct (утренняя дегидратация завышает на 2-3%)',
                'Гематокрит >52% — активная флеботомия 300-400 мл 1-2×/нед до Hct <48% + контроль ферритина (повторные кровопускания → Fe-дефицит → реактивный тромбоцитоз)',
                'Гематокрит >54% — экстренное кровопускание 400-500 мл, риск тромбоза/инфаркта',
                'Гематокрит >60% или HGB >200 г/л — СМЕРТЕЛЬНЫЙ риск: экстренная медпомощь, остановка курса',
              ]} />

              {/* Sub-tabs */}
              <div style={{ display:'flex', gap:4, overflowX:'auto', scrollbarWidth:'none' }}>
                {[
                  { id:'mechanisms', label:'🔬 Механизмы' },
                  { id:'protocol', label:'💊 Фазы протокола' },
                  { id:'timing', label:'⏰ Тайминг' },
                  { id:'monitoring', label:'🧪 Мониторинг' },
                  { id:'diary', label:'📓 Дневник' },
                ].map((t: any) => (
                  <button key={t.id} onClick={() => setHematoTab(t.id)}
                    style={hematoTab === t.id ? pillActive('#ef4444') : pillInactive()}>{t.label}</button>
                ))}
              </div>

              {/* Mechanisms */}
              {hematoTab === 'mechanisms' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>🔬 Механизмы: почему кровь требует контроля на курсе</div>
                  {[
                    { m:'Эритроцитоз (Hct ↑)', e:'ААС стимулируют ЭПО-независимый эритропоэз (через ↑ HIF-1α + ↑ чувствительность предшественников к ЭПО). Hct растёт на 5-10% в первые 4-6 нед.', a:'Флеботомия при Hct {'>'}54%. Аспирин — только при ≥2 факторах тромбориска (Hct >50%, курение, возраст >40, ожирение, тромбоанамнез)' },
                    { m:'Тромбоцитоз (PLT ↑)', e:'Андрогены ↑ TPO (тромбопоэтин) → ↑ продукция тромбоцитов на 20-40%', a:'Контроль числа тромбоцитов при Hct {'>'}50%' },
                    { m:'Гиперкоагуляция (факторы свёртывания)', e:'ААС ↑ факторы II, VII, X, ↓ антитромбин III, ↑ ингибитор активатора плазминогена PAI-1', a:'D-димер, фибриноген, АЧТВ. Аспирин — после оценки соотношения риск/польза' },
                    { m:'Вязкость крови (гемореология)', e:'Hct ↑ + фибриноген ↑ + ↓ деформируемость эритроцитов = ↑ вязкости в 1.5-2× относительно нормы', a:'Гидратация 3+ л/день. Пентоксифиллин при симптомах' },
                  ].map((x, i) => (
                    <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.08)' }}>
                      <div style={{ fontSize:9, fontWeight:700, color:'#fca5a5', marginBottom:2 }}>{x.m}</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:2 }}>{x.e}</div>
                      <div style={{ fontSize:7, color:'#fca5a5', padding:'3px 5px', borderRadius:4, background:'rgba(239,68,68,0.06)' }}>🩺 Действие: {x.a}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Protocol phases */}
              {hematoTab === 'protocol' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {[
                    { phase:'ФАЗА 1 · ПРОФИЛАКТИКА', label:'Базовый курс (Hct {'<'}48%)', color:'#22c55e', condition:'Hct {'<'}48%, PLT в норме', desc:'Профилактика гиперкоагуляции на любом курсе ААС',
                      items:[
                        { name:'Аспирин кардио 100 мг (опционально)', dose:'100 мг', timing:'Утро после еды', note:'НЕ обязателен в фазе 1 (профилактика). Назначать ТОЛЬКО при ≥2 факторах тромбориска (Hct >50%, курение, возраст >40, ожирение, тромбоанамнез) — иначе риск ЖКТ-кровотечения > пользы (USPSTF 2022). Снижает риск тромбоза на 30-40%. Обязательно + ИПП' },
                        { name:'Гидратация', dose:'3+ л/день', timing:'Равномерно', note:'Снижение вязкости крови. Особенно важно при высоких дозах ААС и летом' },
                        { name:'Омега-3 (EPA+DHA)', dose:'2-4 г/день', timing:'С едой', note:'↓ вязкости, ↓ фибриногена, ↑ NO. Двойная кардио+гемато защита' },
                        { name:'Рыбий жир', dose:'EPA 1000 мг', timing:'С едой', note:'Дополнительный источник омега-3 при недостатке в пище' },
                      ]},
                    { phase:'ФАЗА 2 · РАННЯЯ КОРРЕКЦИЯ', label:'Hct 48-52%', color:'#f59e0b', condition:'Hct 48-52%, без симптомов', desc:'Усиление антикоагуляции',
                      items:[
                        { name:'Аспирин кардио 75-100 мг', dose:'75-100 мг', timing:'Утро после еды', note:'ТОЛЬКО при ≥2 факторах тромбориска (см. фазу 1). Обязательно с ИПП (омепразол 20 мг; при клопидогреле — пантопразол) для защиты ЖКТ. Не сочетать с НПВС, омега-3 >3 г, вит.E >400 МЕ, антикоагулянтами без врача' },
                        { name:'Пентоксифиллин 400 мг', dose:'400 мг', timing:'2×/день с едой', note:'Улучшает деформируемость эритроцитов, ↓ вязкость. Курс 4-6 нед' },
                        { name:'NAC 600-1200 мг', dose:'600 мг', timing:'2×/день', note:'Антиоксидант ↓ вязкости через ↑ глутатиона в эритроцитах. Защита от окислительного стресса. ⚠ Сумма со всеми модулями ≤4000 мг/сут' },
                        { name:'Плазмаферез (опционально)', dose:'—', timing:'По показаниям', note:'При Hct {'>'}54% или симптомах гипервязкости. 1-2 сеанса до нормализации' },
                      ]},
                    { phase:'ФАЗА 3 · ТЕРАПИЯ', label:'Hct 52-54%', color:'#f97316', condition:'Hct 52-54% или симптомы', desc:'Медицинское вмешательство. Флеботомия при необходимости',
                      items:[
                        { name:'Флеботомия (кровопускание)', dose:'300-400 мл', timing:'1-2 раза/нед', note:'До Hct {'<'}48%. Восполнение жидкости — физраствор или вода 1 л после процедуры. Контроль ферритина/ОЖСС каждые 4-8 нед: при ферритине <30 — пауза + Fe-коррекция с врачом (иначе реактивный тромбоцитоз)' },
                        { name:'Аспирин 75-100 мг', dose:'75-100 мг', timing:'Утро', note:'ТОЛЬКО при ≥2 факторах тромбориска. Обязательно + ИПП (омепразол 20 мг; при переходе на клопидогрель — пантопразол, т.к. омепразол ↓ его эффект через CYP2C19). При высоком риске тромбоза — рассмотреть клопидогрель вместо усиления аспирина' },
                        { name:'Дипиридамол 75 мг', dose:'75 мг', timing:'3×/день', note:'Антиагрегант + вазодилататор. Улучшает микроциркуляцию' },
                        { name:'Гидратация', dose:'4+ л/день', timing:'Равномерно', note:'Принудительная гидратация для ↓ гематокрита' },
                      ]},
                    { phase:'ФАЗА 4 · УРГЕНТНАЯ', label:'Hct {'>'}54% / Hct {'>'}60%', color:'#ef4444', condition:'Hct {'>'}54% и/или симптомы гипервязкости', desc:'Неотложное вмешательство',
                      items:[
                        { name:'Флеботомия', dose:'400-500 мл', timing:'Ежедневно до Hct {'<'}48%', note:'Под контролем АД и пульса' },
                        { name:'Низкомол. гепарин (НМГ) 💊', dose:'По весу', timing:'П/к 1-2×/день', note:'Эноксапарин 40 мг 1×/день при D-димер {'>'}500. Переход на варфарин при тромбозе. По назначению врача' },
                        { name:'Консультация гематолога', dose:'—', timing:'Срочно', note:'Экстренная при симптомах ТЭЛА/ТГВ. Не откладывать' },
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
              {hematoTab === 'timing' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>⏰ Суточный тайминг гематологической поддержки</div>
                  <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Основной принцип: антиагреганты утром, гидратация в течение дня, контроль вечером.</p>
                  {[
                    { time:'🌅 Утро (06:00–09:00)', color:'#f59e0b', items:[
                      { n:'Аспирин 75-100 мг + ИПП (только при ≥2 факторах риска)', why:'После еды. Защита ЖКТ + антиагрегантный эффект на весь день' },
                      { n:'Омега-3 2-4 г с едой', why:'С завтраком. EPA/DHA снижают вязкость, ↑ NO' },
                      { n:'Вода 500 мл', why:'После пробуждения. Компенсация ночной дегидратации' },
                    ]},
                    { time:'☀️ День (12:00–16:00)', color:'#f97316', items:[
                      { n:'Пентоксифиллин 400 мг (если фаза 2+)', why:'С обедом. Улучшение реологии эритроцитов' },
                      { n:'Гидратация 1-1.5 л', why:'Равномерно. Особенно при физ. нагрузке + дополнительно 500-1000 мл' },
                    ]},
                    { time:'🌙 Вечер (19:00–22:00)', color:'#6366f1', items:[
                      { n:'NAC 600-1200 мг', why:'Антиоксидант. Принимать вечером перед сном для ночной детоксикации' },
                      { n:'Вода 500 мл', why:'Умеренная гидратация. Не перед сном' },
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
              {hematoTab === 'monitoring' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>🧪 Лабораторный мониторинг крови</div>
                    {[{ marker:'Гематокрит (Hct)', target:'42-50%', when:'Каждые 2-4 нед', action:'50-52% — фаза 2. 52-54% — фаза 3. {'>'}54% — фаза 4 (ургентная). {'>'}60% — риск спонтанного тромбоза. Измерять гидратированным: 500 мл воды за 1-2 ч + повтор при пограничном значении' },
                      { marker:'Ферритин / ОЖСС (при флеботомиях)', target:'Ферритин 30-150 нг/мл', when:'До старта флеботомий + каждые 4-8 нед', action:'Повторные кровопускания → Fe-дефицит → реактивный тромбоцитоз → парадоксальный тромбоз. При ферритине <30 — пауза флеботомий + Fe-коррекция с врачом' },
                      { marker:'Гемоглобин (Hb)', target:'13.5-17.5 г/дл', when:'Каждые 2-4 нед', action:'Hb {'>'}17.5 — коррелирует с Hct. Hb {'<'}12.5 — возможна анемия при длительных курсах' },
                      { marker:'Тромбоциты (PLT)', target:'150-350 ×10⁹/л', when:'Каждые 4 нед', action:'PLT {'>'}400 — риск тромбоза. Аспирин 75-100 мг — только при ≥2 факторах тромбориска + ИПП' },
                      { marker:'D-димер', target:'{'<'}500 нг/мл', when:'При симптомах', action:'{'>'}500 — активный тромбоз/фибринолиз. 0.5-2.0 — УЗДГ вен ног (исключить ТГВ). {'>'}2.0 — КТ-ангиография лёгких (исключить ТЭЛА). {'>'}4.0 — высокая вероятность ТЭЛА, госпитализация' },
                      { marker:'JAK2 V617F (мутация)', target:'Отрицательно', when:'При Hct {'>'}52% + тромбоциты {'>'}450 или спленомегалия', action:'Исключить истинную полицитемию (ПВ). ААС-индуцированный эритроцитоз и ПВ различаются именно JAK2. При положительном — гематолог, аспирин 100 мг, флеботомия, НЕ только отмена ААС' },
                      { marker:'Фибриноген', target:'2-4 г/л', when:'Каждые 8 нед', action:'{'>'}4.5 — гиперкоагуляция. Коррекция гидратацией + омега-3' },
                      { marker:'АЧТВ / ПВ / МНО', target:'АЧТВ 25-35 с, МНО 0.8-1.2', when:'При терапии антикоагулянтами', action:'МНО {'>'}1.5 — риск кровотечения при НМГ/варфарине' },
                    ].map((m: any, i: any) =>(
                      <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.08)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                          <span style={{ fontSize:9, fontWeight:700, color:'#fca5a5' }}>{m.marker}</span>
                          <span style={{ fontSize:8, fontWeight:600, color:'#ef4444' }}>{m.when}</span>
                        </div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:4 }}><b style={{color:'#fca5a5'}}>Цель: {m.target}</b></div>
                        <div style={{ fontSize:7, color:'#fca5a5', lineHeight:1.3, padding:'4px 6px', borderRadius:4, background:'rgba(239,68,68,0.06)' }}>💡 {m.action}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Diary */}
              {hematoTab === 'diary' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>📓 Дневник гематологических симптомов</div>
                  {[{ s:'Головная боль (пульсирующая)', hint:'Маркёр гипервязкости. Проверить Hct + АД. Флеботомия при Hct {'>'}54%' },
                    { s:'Покраснение лица/кожи', hint:'Плетора. При Hct {'>'}50%. Гидратация; аспирин — только при ≥2 факторах тромбориска + ИПП' },
                    { s:'Звон в ушах (тиннитус)', hint:'Нарушение микроциркуляции. Пентоксифиллин. Проверить АД' },
                    { s:'Одышка при нагрузке', hint:'Снижение кислородной ёмкости. Проверить Hct {'>'}52%' },
                    { s:'Гематомы без причины', hint:'Избыток антикоагуляции. МНО >1.5 при аспирине. Проверить свёртываемость' },
                  ].map((x, i) => (
                    <div key={i} style={{ padding:'6px 8px', borderRadius:6, marginBottom:4, background:'rgba(239,68,68,0.03)', border:'1px solid rgba(239,68,68,0.08)' }}>
                      <span style={{ fontSize:9, color:'var(--text-light)' }}>{x.s}</span>
                      <div style={{ fontSize:7, color:'var(--text-dim)', marginTop:2 }}>💡 {x.hint}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cross-protocol warnings */}
            <div style={{ borderRadius:12, padding:12, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#f59e0b', marginBottom:4 }}>🔗 Перекрёстные предупреждения</div>
              <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.5 }}>
                • ❤️ <b>Кардио:</b> Hct {'>'}50% + ААС = риск тромбоза. Аспирин — после оценки тромбориска (≥2 факторов). Флеботомия при {'>'}54%<br/>
                • 🫁 <b>Печень:</b> Hct {'>'}50% + 17α-алкилы = риск веноокклюзионной болезни печени (редиайше)<br/>
                • ⚖️ <b>Метаболизм:</b> Hct ↑ → нагрузка на миокард. Контроль липидов (ААС ↓ ЛПВП)<br/>
                • 🏥 <b>Операция:</b> чеклист отмен (аспирин 7-10 д, омега-3 {'>'}3 г, вит.E {'>'}400, чеснок/гинкго/натто/серра) — см. «Экстренные → Подготовка к операции»; при Hct {'>'}52% — флеботомия за 1-2 нед до (цель {'<'}50%)
              </div>
            </div>

          </InfoErrorBoundary>
  );
};
