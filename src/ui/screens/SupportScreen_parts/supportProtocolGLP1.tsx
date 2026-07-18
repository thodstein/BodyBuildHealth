// @ts-nocheck
import React, { useState } from 'react';
import { cardBg, pillActive, pillInactive, PhaseLabel, ItemRow, ItemRowTriage, triageBadge, phaseBadge, renderRow, renderPhase, timingBlock, monitoringBlock } from './supportProtocolsShared';
import { InfoErrorBoundary } from './SupportScreenData';

export const SupportProtocolGLP1: React.FC<{ s: Record<string, any> }> = ({ s }) => {
  const [glp1Tab, setGlp1Tab] = useState('protocol');
  return (
          <InfoErrorBoundary label="GLP-1">
            <div style={{ paddingBottom: 30, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={cardBg}>
                <div style={{ fontSize:13, fontWeight:800, color:'#f59e0b', marginBottom:2 }}>🍪 GLP-1 и метаболическая поддержка</div>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Управление аппетитом, гликемией и весом через GLP-1 агонисты (семаглутид, лираглутид) и природные GLP-1 секретагоги. Контроль побочных эффектов.</p>
              </div>

              <div style={{ display:'flex', gap:4, overflowX:'auto', scrollbarWidth:'none' }}>
                {[
                  { id:'mechanisms', label:'🔬 Механизмы' },
                  { id:'protocol', label:'💊 Фазы протокола' },
                  { id:'timing', label:'⏰ Тайминг' },
                  { id:'monitoring', label:'🧪 Мониторинг' },
                ].map((t: any) => (
                  <button key={t.id} onClick={() => setGlp1Tab(t.id)}
                    style={glp1Tab === t.id ? pillActive('#f59e0b') : pillInactive()}>{t.label}</button>
                ))}
              </div>

              {glp1Tab === 'mechanisms' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>🔬 Механизмы GLP-1 и метаболической регуляции</div>
                  {[{ m:'GLP-1 — инкретиновый гормон', e:'GLP-1 (глюкагоноподобный пептид-1) секретируется L-клетками кишечника в ответ на еду. ↑ секрецию инсулина, ↓ глюкагона, замедляет опорожнение желудка' },
                    { m:'Подавление аппетита', e:'GLP-1 действует на гипоталамус (ARC/обходной тракт) — ↑ чувства сытости, ↓ грелина. Центральное подавление аппетита' },
                    { m:'GLP-1 и ААС', e:'ААС (особенно оральные 17α-алкилы) ↑ инсулинорезистентность + ↑ аппетит через ↑ грелина. GLP-1 агонисты — патогенетическая терапия' },
                    { m:'Метаболические эффекты', e:'↓ глюкозы (гипогликемический), ↓ веса, ↓ АД, ↑ липолиза, ↓ воспаления (через ↓ IL-6, TNF-α). Защита β-клеток поджелудочной' },
                  ].map((x, i) => (
                    <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.08)' }}>
                      <div style={{ fontSize:9, fontWeight:700, color:'#fcd34d', marginBottom:2 }}>{x.m}</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)' }}>{x.e}</div>
                    </div>
                  ))}
                </div>
              )}

              {glp1Tab === 'protocol' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {[
                    { phase:'ФАЗА 1 · НАТУРАЛЬНАЯ МОДУЛЯЦИЯ', label:'Природные GLP-1 секретагоги', color:'#22c55e', condition:'Преддиабет/ожирение (ИМТ {'>'}27)', desc:'Повышение эндогенного GLP-1 без инъекционных препаратов',
                      items:[
                        { name:'Берберин 500 мг', dose:'500 мг', timing:'2-3×/день до еды', note:'↑ GLP-1 через ↑ активности L-клеток. ↓ глюкозы на 20-30%. AMPK-активатор' },
                        { name:'Клетчатка (гуаровая камедь/пектин/инулин)', dose:'10-20 г', timing:'Перед едой с водой', note:'↑ GLP-1 через ферментацию в толстой кишке → ↑ короткоцепочечных жирных кислот. ↓ аппетита' },
                        { name:'L-глютамин', dose:'5-10 г', timing:'За 30-60 мин до еды', note:'Мощный стимулятор GLP-1 через CaSR-рецепторы L-клеток. ↑ GLP-1 на 2-3× в течение часа' },
                        { name:'Омега-3 (EPA/DHA)', dose:'2-4 г', timing:'С едой', note:'↑ GLP-1 через GPR120 на L-клетках. Системный противовоспалительный эффект' },
                      ]},
                    { phase:'ФАЗА 2 · НИЗКИЕ ДОЗЫ АГОНИСТОВ', label:'Семаглутид/лираглутид', color:'#f59e0b', condition:'ИМТ {'>'}30 / глюкоза {'>'}6.0 / ИР', desc:'Старт GLP-1 агонистов',
                      items:[
                        { name:'Семаглутид (Оземпик/Вегови) 💊', dose:'0.25-0.5 мг', timing:'1×/нед п/к', note:'Старт 0.25 мг × 4 нед. Титрация → 0.5 мг. ↓ веса на 5-10% за 6 мес. Контроль глюкозы' },
                        { name:'Лираглутид (Саксенда/Виктоза) 💊', dose:'0.6-1.8 мг', timing:'Ежедневно п/к', note:'Старт 0.6 мг × 1 нед. Титрация +0.6 мг/нед до 1.8 мг. ↓ веса на 5-8% за 3-6 мес' },
                        { name:'Метформин 500 мг 💊', dose:'500 mg', timing:'2×/день с едой', note:'Синергия с GLP-1. ↓ глюкозы дополнительно на 15-20%. Профилактика гипогликемии. По назначению врача' },
                        { name:'Ингибиторы ДПП-4 (ситаглиптин) 💊', dose:'100 мг', timing:'Утро', note:'Блокирует DPP-4 — ↑ уровень эндогенного GLP-1. Мягче, чем инъекции. Альтернатива при страхе инъекций' },
                      ]},
                    { phase:'ФАЗА 3 · ТИТРАЦИЯ/ПОДДЕРЖАНИЕ', label:'Средние дозы', color:'#f97316', condition:'ИМТ {'>'}35 / глюкоза {'>'}7.0', desc:'Увеличение дозы для клинического эффекта',
                      items:[
                        { name:'Семаглутид 1.0-2.4 мг', dose:'1.0-2.4 мг', timing:'1×/нед п/к', note:'Максимальная доза. ↓ веса до 15% за 12 мес. Контроль HbA1c, глюкозы, АЛТ/АСТ' },
                        { name:'Титрация', dose:'+0.5 мг каждые 4 нед', timing:'—', note:'Не титровать быстрее — ↑ риска тошноты/рвоты. При непереносимости — ↓ дозу и задержаться на 4 нед' },
                        { name:'Контроль тошноты (ондансетрон)', dose:'4-8 мг', timing:'При тошноте', note:'Антагонист 5-HT3. При тошноте от GLP-1. Не более 32 мг/сут' },
                        { name:'Пищевая дисциплина', dose:'—', timing:'Постоянно', note:'GLP-1 ↓ объём желудка → ↑ риска рефлюкса. Малые порции. Без жирного/жареного' },
                      ]},
                    { phase:'ФАЗА 4 · ПОБОЧНЫЕ ЭФФЕКТЫ/ОСЛОЖНЕНИЯ', label:'ЖКТ-токсичность', color:'#ef4444', condition:'Непереносимость / тошнота / рвота / панкреатит', desc:'Управление побочными эффектами GLP-1',
                      items:[
                        { name:'Симптоматическая терапия тошноты', dose:'Метоклопрамид 10 мг / домперидон 10 мг', timing:'За 30 мин до еды', note:'Прокинетики. Ускоряют опорожнение желудка. Короткий курс — не {'>'}2 нед' },
                        { name:'Снижение дозы/увеличение интервала', dose:'—', timing:'—', note:'При выраженной тошноте — ↓ дозу GLP-1 на 50% или увеличить интервал между инъекциями' },
                        { name:'Исключить панкреатит (липаза, амилаза)', target:'Липаза {'<'}60, амилаза {'<'}100', when:'При боли в эпигастрии', action:'{'>'}3× ВГН — панкреатит. Отмена GLP-1. Госпитализация' },
                        { name:'Консультация эндокринолога', dose:'—', timing:'При неэффективности', note:'При {'<'}5% потери веса за 6 мес — пересмотреть терапию. Рассмотреть тирзепатид (dual GIP/GLP-1, одобрен FDA/EMA)' },
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

              {glp1Tab === 'timing' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>⏰ Тайминг GLP-1 терапии</div>
                  <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Семаглутид — 1×/нед (фиксированный день). Liraglutide — ежедневно. Берберин — до еды. Клетчатка — перед едой.</p>
                  {[
                    { time:'🗓 Раз в неделю (фиксированный день)', color:'#f59e0b', items:[
                      { n:'Семаглутид 0.25-2.4 мг п/к', why:'Один и тот же день (напр. вск). В любое время дня, независимо от еды' },
                      { n:'Запись дозы в дневник', why:'Отмечать дозу и побочные эффекты. Фото шприц-ручки с дозой' },
                    ]},
                    { time:'🌅 Ежедневно утром/вечером', color:'#f97316', items:[
                      { n:'Лираглутид 0.6-1.8 мг п/к', why:'Ежедневно в одно и то же время (обычно утром)' },
                      { n:'Метформин 500 мг 💊', why:'2×/день с едой (завтрак+ужин). ↓ ЖКТ-побочки' },
                      { n:'SitaGLP-1 (ингибитор DPP-4)', why:'Утром 100 мг. Вне еды' },
                    ]},
                    { time:'🍽 Связано с едой', color:'#6366f1', items:[
                      { n:'Берберин 500 мг', why:'За 15-30 мин до еды (или с едой при чувствительном ЖКТ)' },
                      { n:'L-глютамин 5-10 г', why:'За 30-60 мин до еды. Стимуляция GLP-1' },
                      { n:'Клетчатка 10-20 г', why:'За 15-30 мин до еды с водой. ↑ сытости' },
                      { n:'Ондансетрон 4-8 мг (при тошноте)', why:'За 30-60 мин до еды. При непереносимости GLP-1' },
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

              {glp1Tab === 'monitoring' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>🧪 Лабораторный мониторинг GLP-1 терапии</div>
                    {[{ marker:'Глюкоза натощак', target:'3.9-5.6 ммоль/л', when:'Еженедельно в первые 4 нед, затем ежемесячно', action:'{'<'}3.9 — гипогликемия (редко на моно-GLP-1). {'>'}7.0 — неадекватный контроль, ↑ дозу' },
                      { marker:'HbA1c (гликированный гемоглобин)', target:'{'<'}6.5%', when:'Каждые 12 нед', action:'{'>'}6.5% — неадекватный ответ. Рассмотреть тирзепатид. {'>'}8.0% — эндокринолог' },
                      { marker:'Липаза, амилаза (панкреатит)', target:'Липаза {'<'}60, амилаза {'<'}100 Ед/л', when:'При боли в эпигастрии', action:'{'>'}3× ВГН — панкреатит. Отмена GLP-1, госпитализация' },
                      { marker:'АЛТ/АСТ', target:'АЛТ {'<'}40, АСТ {'<'}40', when:'Каждые 8-12 нед', action:'АЛТ {'>'}80 — может указывать на стеатоз/НЖБП. GLP-1 ↓ стеатоз — положительный эффект' },
                      { marker:'Креатинин/СКФ', target:'СКФ {'>'}60 мл/мин', when:'Каждые 8-12 нед', action:'СКФ {'<'}45 — риск дегидратации от GLP-1. Гидратация! Коррекция диуретиков' },
                      { marker:'Кальцитонин (риск медуллярного РЩЖ)', target:'{'<'}10 пг/мл', when:'До начала + каждые 12 мес', action:'{'>'}10 — исключить медуллярный рак щитовидной железы (противопоказание для GLP-1). УЗИ ЩЖ' },
                    ].map((m: any, i: any) =>(
                      <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.08)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                          <span style={{ fontSize:9, fontWeight:700, color:'#fcd34d' }}>{m.marker}</span>
                          <span style={{ fontSize:8, fontWeight:600, color:'#f59e0b' }}>{m.when}</span>
                        </div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:4 }}><b style={{color:'#fcd34d'}}>Цель: {m.target}</b></div>
                        <div style={{ fontSize:7, color:'#fcd34d', lineHeight:1.3, padding:'4px 6px', borderRadius:4, background:'rgba(245,158,11,0.06)' }}>💡 {m.action}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ borderRadius:12, padding:12, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#f59e0b', marginBottom:4 }}>🔗 Перекрёстные предупреждения</div>
              <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.5 }}>
                • 🫁 <b>Печень:</b> Семаглутид ↓ стеатоз печени (НЖБП). Контроль АЛТ/АСТ каждые 8-12 нед. Берберин — гепатопротекторная синергия<br/>
                • 💧 <b>Почки:</b> GLP-1 → риск дегидратации (↓ потребления жидкости из-за ↓ аппетита). Принудительная гидратация 2+ л/день<br/>
                • 🩸 <b>Гематология:</b> GLP-1 агонисты ↓ агрегацию тромбоцитов. +антикоагулянты = риск кровотечений. Контроль МНО<br/>
                • ❤️ <b>Кардио:</b> Семаглутид ↓ риск сердечно-сосудистых событий на 26% (SELECT trial). GLP-1 — кардиопротективный эффект<br/>
                • ⚡ <b>Электролиты:</b> GLP-1 → дегидратация + ↓ потребления жидкости → риск гипонатриемии и гипокалиемии. Контроль Na⁺/K⁺ каждые 2-4 нед. Принудительная гидратация 2+ л/день
              </div>
            </div>

          </InfoErrorBoundary>
  );
};
