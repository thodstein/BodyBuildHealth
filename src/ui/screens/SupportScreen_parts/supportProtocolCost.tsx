// @ts-nocheck
import React, { useState } from 'react';
import { cardBg, pillActive, pillInactive } from './supportProtocolsShared';
import { InfoErrorBoundary } from './SupportScreenData';

export const SupportProtocolCost: React.FC<{ s: Record<string, any> }> = ({ s }) => {
  const [costTab, setCostTab] = useState('liver');
  return (
    <InfoErrorBoundary label="Оптимизация стоимости">
      <div className="sup-proto-cost" style={{ paddingBottom:30, display:'flex', flexDirection:'column', gap:8 }}>
        <div style={cardBg}>
          <div style={{ fontSize:13, fontWeight:800, color:'#22c55e', marginBottom:2 }}>💰 Оптимизация стоимости поддержки — справочник (НЕ протокол назначения)</div>
          <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Ориентировочные цены и приоритеты. Реальные назначения и дозировки — ТОЛЬКО по назначению врача.</p>
        </div>
        <div style={{ borderRadius:10, padding:10, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)', marginBottom:10 }}>
          <div style={{ fontSize:9, fontWeight:700, color:'#ef4444', marginBottom:4 }}>⚠️ ВАЖНО: Этот раздел — СПРАВОЧНИК, НЕ клиническое руководство</div>
          <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.4 }}>
            • Цены указаны примерно (РФ, 2024), могут отличаться в 2-3 раза<br/>
            • Дозировки — ориентировочные диапазоны из литературы, НЕ рекомендации<br/>
            • Рецептурные препараты (💊) — ТОЛЬКО по назначению врача<br/>
            • Качество БАДов критично — дешевые аналоги могут быть неэффективны<br/>
            • ВСЕГДА проконсультируйтесь с врачом перед покупкой и приёмом
          </div>
        </div>

        <div style={{ display:'flex', gap:4, overflowX:'auto', scrollbarWidth:'none' }}>
          {[
            { id:'liver', label:'🫁 Печень' },
            { id:'cardio', label:'❤️ ССС' },
            { id:'kidney', label:'💧 Почки' },
            { id:'blood', label:'🩸 Кровь' },
            { id:'neuro', label:'🧠 Нейро' },
            { id:'hormones', label:'🔬 Гормоны' },
          ].map((t: any) => (
            <button key={t.id} onClick={() => setCostTab(t.id)}
              style={costTab === t.id ? pillActive('#22c55e') : pillInactive()}>{t.label}</button>
          ))}
        </div>

        {/* Liver */}
        {costTab === 'liver' && (
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {[
              { tier:'🔴 CORE (базовая защита)', items:[
                { sub:'NAC 1200 мг/сут (типичная доза)', cost:'~600 ₽/мес', why:'Предшественник глутатиона. Без него защита печени не работает.' },
                { sub:'TUDCA 500-1000 мг/сут (при оральных ААС)', cost:'~900 ₽/мес', why:'Снижение ER-стресса, желчеотток. Обязательно при 17α-алкилированных ААС.' },
              ]},
              { tier:'🟡 ADVANCED (усиленная защита)', items:[
                { sub:'Силимарин (расторопша) 280-560 мг', cost:'~500 ₽/мес', why:'Стабилизация мембран гепатоцитов. Доказательства уровня B (мета-анализы противоречивы).' },
                { sub:'АЛК (альфа-липоевая кислота) 600 мг', cost:'~600 ₽/мес', why:'Активатор Nrf2. Регенерация глутатиона. Хелатор металлов.' },
                { sub:'УДХК 500 мг (альтернатива TUDCA)', cost:'~900 ₽/мес', why:'Дешевле TUDCA, слабее по анти-ER-стресс, но эффективна для желчеоттока.' },
              ]},
              { tier:'🟢 OPTIONAL (дополнительно)', items:[
                { sub:'SAM-e 400-800 мг', cost:'~2000-4000 ₽/мес', why:'Дорого. Только при MTHFR / высоком гомоцистеине.' },
                { sub:'Хлорелла 3-5 г', cost:'~800 ₽/мес', why:'Только при подтверждённой нагрузке тяжёлыми металлами.' },
              ]},
            ].map((g: any, gi: any) => (
              <div key={gi} style={{ borderRadius:10, padding:'10px 12px', background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.15)' }}>
                <div style={{ fontSize:10, fontWeight:800, color:'#22c55e', marginBottom:6 }}>{g.tier}</div>
                {g.items.map((x: any, xi: any) => (
                  <div key={xi} style={{ padding:'6px 8px', borderRadius:6, marginBottom:3, background:'rgba(255,255,255,0.02)', border:'1px solid var(--border)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between' }}>
                      <span style={{ fontSize:8, fontWeight:700, color:'var(--text-light)' }}>{x.sub}</span>
                      <span style={{ fontSize:7, fontWeight:600, color:'#22c55e' }}>{x.cost}</span>
                    </div>
                    <div style={{ fontSize:7, color:'var(--text-dim)', marginTop:1 }}>{x.why}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Cardio */}
        {costTab === 'cardio' && (
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {[
              { tier:'🔴 CORE (базовая защита)', items:[
                { sub:'Омега-3 (EPA+DHA) 2-3 г/сут', cost:'~600 ₽/мес', why:'База: ↓ ТГ, ↓ воспаления, стабилизация мембран. Минимум 60% EPA.' },
                { sub:'CoQ10 (убихинол) 100-200 мг', cost:'~400 ₽/мес', why:'Митохондриальная защита кардиомиоцитов. Особенно важно при статинах (↓ CoQ10).' },
              ]},
              { tier:'🟡 ADVANCED (усиленная защита)', items:[
                { sub:'Телмисартан 40-80 мг 💊 (только врач)', cost:'~500-1000 ₽/мес', why:'ARB + PPARγ. При АД >130/85. Рецептурный — только врач.' },
                { sub:'Небиволол 2.5-5 мг 💊 (только врач)', cost:'~600 ₽/мес', why:'β1-блокатор + NO-модуляция. При тахикардии >90. Рецептурный.' },
                { sub:'Красный дрожжевой рис 1200 мг', cost:'~600 ₽/мес', why:'ВТОРАЯ линия после эзетимиба. ≈10 мг монаколина K (=ловастатин). Только БЕЗ цитринина + CoQ10. Контроль АЛТ/КФК.' },
                { sub:'L-карнитин 2-3 г', cost:'~800 ₽/мес', why:'Энергия миокарда. Жиросжигание. Дорого — опционально при нормолипидемии.' },
              ]},
              { tier:'🟢 OPTIONAL (дополнительно)', items:[
                { sub:'Эзетимиб 10 мг 💊', cost:'~1500 ₽/мес', why:'Первая линия при ЛПНП >130 на фоне ААС (стандартизирован, без миопатии). Дорого, но экономить здесь нельзя.' },
                { sub:'Аспирин кардио 75-100 мг + ИПП 💊', cost:'~100 ₽/мес', why:'Дёшево, но риск ЖКТ-кровотечения. Только при ≥2 факторах тромбориска + ИПП.' },
              ]},
            ].map((g: any, gi: any) => (
              <div key={gi} style={{ borderRadius:10, padding:'10px 12px', background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.15)' }}>
                <div style={{ fontSize:10, fontWeight:800, color:'#22c55e', marginBottom:6 }}>{g.tier}</div>
                {g.items.map((x: any, xi: any) => (
                  <div key={xi} style={{ padding:'6px 8px', borderRadius:6, marginBottom:3, background:'rgba(255,255,255,0.02)', border:'1px solid var(--border)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between' }}>
                      <span style={{ fontSize:8, fontWeight:700, color:'var(--text-light)' }}>{x.sub}</span>
                      <span style={{ fontSize:7, fontWeight:600, color:'#22c55e' }}>{x.cost}</span>
                    </div>
                    <div style={{ fontSize:7, color:'var(--text-dim)', marginTop:1 }}>{x.why}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Generic template for remaining systems */}
        {['kidney','blood','neuro','hormones'].includes(costTab) && (
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {[
              {
                system: costTab==='kidney'?'💧 Почки':costTab==='blood'?'🩸 Кровь':costTab==='neuro'?'🧠 Нейро':'🔬 Гормоны',
                tiers: costTab==='kidney'?[
                  { tier:'🔴 CORE', items:[{ sub:'Гидратация 2.5-3.5 л/сут', cost:'0 ₽', why:'Бесплатно и эффективно. Основа нефропротекции.' },{ sub:'Астрагал 1-3 г', cost:'~400 ₽/мес', why:'↓ креатинина. Доказательства уровня B.' }]},
                  { tier:'🟡 ADVANCED', items:[{ sub:'Кордицепс 1-3 г', cost:'~800 ₽/мес', why:'↑ СКФ. Почечная микроциркуляция.' },{ sub:'Кетостерил (при ХБП)', cost:'~3000+ ₽/мес', why:'Только при СКФ <60. Дорого, но эффективно (↓ диализа).' }]},
                  { tier:'🟢 OPTIONAL', items:[{ sub:'Эплеренон 25-50 мг 💊', cost:'~1500 ₽/мес', why:'Антифибротическое. При протеинурии >300 мг/г. Рецептурный.' }]},
                ]:costTab==='blood'?[
                  { tier:'🔴 CORE', items:[{ sub:'Донация крови каждые 8-12 нед', cost:'0 ₽', why:'Бесплатно. ↓ Hct на 3-5%. Лучшая профилактика тромбоза.' },{ sub:'Омега-3 2-3 г', cost:'~600 ₽/мес', why:'Антиагрегант. Снижение вязкости.' }]},
                  { tier:'🟡 ADVANCED', items:[{ sub:'Аспирин 75-100 мг + ИПП 💊', cost:'~100 ₽/мес', why:'При Hct >52% + ≥2 факторах риска. Только врач.' },{ sub:'Наттокиназа 100 мг (2000 FU)', cost:'~600 ₽/мес', why:'Фибринолиз. НЕ сочетать с аспирином/антикоагулянтами без врача — меньше ЖКТ-риск, но аддитивный bleed.' }]},
                  { tier:'🟢 OPTIONAL', items:[{ sub:'Серрапептаза 20 мг', cost:'~500 ₽/мес', why:'Дополнительный фибринолиз. При высоком фибриногене.' }]},
                ]:costTab==='neuro'?[
                  { tier:'🔴 CORE', items:[{ sub:'Омега-3 (DHA >1 г)', cost:'~600 ₽/мес', why:'DHA — структурный компонент мозга.' },{ sub:'Магний L-треонат 400 мг', cost:'~800 ₽/мес', why:'Проходит ГЭБ. Единственная форма Mg для мозга.' }]},
                  { tier:'🟡 ADVANCED', items:[{ sub:'Lion\'s Mane 1-3 г', cost:'~700 ₽/мес', why:'NGF/BDNF. Нейрогенез гиппокампа.' },{ sub:'PQQ 20 мг + CoQ10 200 мг', cost:'~1000 ₽/мес', why:'Митохондриальный биогенез нейронов.' }]},
                  { tier:'🟢 OPTIONAL', items:[{ sub:'Семакс 200-600 мкг', cost:'~1500 ₽/мес', why:'Ноотропный пептид. Интраназально. Дорого.' }]},
                ]:[
                  { tier:'🔴 CORE', items:[{ sub:'Цинк 30-50 мг', cost:'~200 ₽/мес', why:'База тестостерона. Ингибитор ароматазы (слабо).' },{ sub:'D3 2000-4000 МЕ + K2 100 мкг', cost:'~300 ₽/мес', why:'Стероидогенез + кальциевый обмен.' }]},
                  { tier:'🟡 ADVANCED', items:[{ sub:'Ашвагандха 600 мг', cost:'~400 ₽/мес', why:'↑ свободного T на 15-25%. ↓ кортизола.' },{ sub:'DIM 200 мг (при E2 >40)', cost:'~500 ₽/мес', why:'Метаболизм E2 в 2-OH (защитный путь).' }]},
                  { tier:'🟢 OPTIONAL', items:[{ sub:'Анастрозол 0.25-0.5 мг 💊', cost:'~2000 ₽/мес', why:'Только врач! При E2 >60 на SERM\'ах.' }]},
                ],
              },
            ].map((g: any, gi: any) => (
              <div key={gi}>
                <div style={{ fontSize:11, fontWeight:700, color:'#22c55e', marginBottom:6 }}>{g.system}</div>
                {g.tiers.map((t: any, ti: any) => (
                  <div key={ti} style={{ borderRadius:10, padding:'10px 12px', marginBottom:8, background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.15)' }}>
                    <div style={{ fontSize:10, fontWeight:800, color:'#22c55e', marginBottom:6 }}>{t.tier}</div>
                    {t.items.map((x: any, xi: any) => (
                      <div key={xi} style={{ padding:'6px 8px', borderRadius:6, marginBottom:3, background:'rgba(255,255,255,0.02)', border:'1px solid var(--border)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between' }}>
                          <span style={{ fontSize:8, fontWeight:700, color:'var(--text-light)' }}>{x.sub}</span>
                          <span style={{ fontSize:7, fontWeight:600, color:'#22c55e' }}>{x.cost}</span>
                        </div>
                        <div style={{ fontSize:7, color:'var(--text-dim)', marginTop:1 }}>{x.why}</div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        <div style={{ borderRadius:10, padding:12, background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.25)' }}>
          <div style={{ fontSize:10, fontWeight:800, color:'#22c55e', marginBottom:4 }}>💡 Итоговая стратегия</div>
          <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.5 }}>
            <b>Минимальный бюджет (≈2500 ₽/мес):</b> NAC + TUDCA + Омега-3 + Mg + D3+K2 + Цинк — покрывает 70% базовой защиты.<br/>
            <b>Оптимальный бюджет (≈5000 ₽/мес):</b> + CoQ10 + Астрагал + Ашвагандха + L-карнитин — полная защита всех систем.<br/>
            <b>Максимальный бюджет (≈8000+ ₽/мес):</b> + рецептурные 💊 (по назначению врача) + специализированные (SAM-e, пептиды).<br/>
            <b style={{color:'#ef4444'}}>НЕ экономьте на:</b> NAC, TUDCA (при оральных ААС), омега-3 (EPA+DHA), гидратации (бесплатно), донации крови (бесплатно).<br/>
            <b style={{color:'#22c55e'}}>Можно отложить:</b> SAM-e, хлорелла, пептиды, эзетимиб (дорого, только при рефрактерности).
          </div>
        </div>
      </div>
    </InfoErrorBoundary>
  );
};
