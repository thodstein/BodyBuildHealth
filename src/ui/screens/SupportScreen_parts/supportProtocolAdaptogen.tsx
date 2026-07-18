// @ts-nocheck
import React, { useState } from 'react';
import { cardBg, pillActive, pillInactive, PhaseLabel, ItemRow, ItemRowTriage, triageBadge, phaseBadge, renderRow, renderPhase, timingBlock, monitoringBlock } from './supportProtocolsShared';
import { InfoErrorBoundary } from './SupportScreenData';

export const SupportProtocolAdaptogen: React.FC<{ s: Record<string, any> }> = ({ s }) => {
  const [adaptogenTab, setAdaptogenTab] = useState('protocol');
  return (
          <InfoErrorBoundary label="Адаптогены">
            <div style={{ paddingBottom:30, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={cardBg}>
                <div style={{ fontSize:13, fontWeight:800, color:'#22c55e', marginBottom:2 }}>🌿 Адаптогены/HPA-ось (кортизол)</div>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Кортизол — главный катаболик. Высокий → мышечный катаболизм, висцеральный жир, ИР, гипертония. Низкий → усталость, гипотония.</p>
              </div>
              <div style={{ display:'flex', gap:4, overflowX:'auto' }}>
                {[{id:'protocol',label:'Протокол'},{id:'timing',label:'⏰ Тайминг'},{id:'monitoring',label:'🧪 Мониторинг'}].map((t:any)=>(
                  <button key={t.id} onClick={()=>setAdaptogenTab(t.id)} style={adaptogenTab===t.id?pillActive('#22c55e'):pillInactive()}>{t.label}</button>
                ))}
              </div>
              {adaptogenTab==='protocol'&&(
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {[
                    {phase:'ФАЗА 1 · ПОДДЕРЖКА HPA-ОСИ (кортизол в норме)', label:'Адаптогены + Mg', color:'#22c55e', condition:'Без симптомов дисбаланса кортизола', desc:'Профилактика HPA-дисфункции на курсе ААС',
                      items:[
                        {name:'Ашвагандха (Withania somnifera) 300-600 мг', dose:'300-600 мг', timing:'Вечер, за 30-60 мин до сна', note:triageBadge('ess')+' ↓ кортизол на 15-28% за 60 дн. ↑ свободный T. Синергия с магнием'},
                        {name:'Магний (глицинат) 200-400 мг', dose:'200-400 мг', timing:'Вечер', note:triageBadge('ess')+' Блокирует HPA-ось через ↓ АКТГ. ↑ качество сна. ↓ судороги'},
                        {name:'Родиола розовая 200-400 мг', dose:'200-400 мг', timing:'Утро', note:triageBadge('rec')+' Адаптоген + ↑ стрессоустойчивость. Не принимать вечером — ↑ активность'},
                        {name:'Фосфатидилсерин 100-200 мг', dose:'100-200 мг', timing:'При ↑ кортизола', note:triageBadge('opt')+' ↓ кортизол через ингибирование АКТГ. При высоком кортизоле (≥550 нмоль/л)'},
                      ]},
                    {phase:'ФАЗА 2 · ВЫСОКИЙ КОРТИЗОЛ (>550 нмоль/л)', label:'Кортизол-даун', color:'#f97316', condition:'Симптомы: тревога, висцеральный жир, ИР, гипертония, катаболизм', desc:'Снижение кортизола',
                      items:[
                        {name:'Фосфатидилсерин 300-400 мг', dose:'300-400 мг', timing:'200 мг утро + 200 мг вечер', note:triageBadge('ess')+' Прямой ингибитор АКТГ. ↓ кортизол на 20-30% за 2-4 нед'},
                        {name:'Ашвагандха 600 мг', dose:'600 мг', timing:'Вечер', note:triageBadge('ess')+' ↑ до макс. дозы. Контроль ЩЖ — ашвагандха ↑ T4'},
                        {name:'Магний 400-600 мг + B6 100 мг', dose:'400-600+100', timing:'Магний вечер, B6 утро', note:triageBadge('rec')+' B6 — кофактор дофамин-синтеза. Mg — ↓ АКТГ'},
                        {name:'Теанин (L-теанин) 200-400 мг', dose:'200-400 мг', timing:'Утро + день', note:triageBadge('rec')+' ↑ α-волны мозга, ↓ кортизол. Анксиолитик. Кофеин + теанин — фокус'},
                        {name:'Исключить: высокий кофеин (>400 мг/день), депривация сна', dose:'—', timing:'—', note:triageBadge('ess')+' Кофеин ↑ кортизол на 30-50%. Сон <6 ч → 2-3× кортизол'},
                      ]},
                    {phase:'ФАЗА 3 · ГИПОКОРТИЗОЛЕМИЯ (<150 нмоль/л)', label:'Кортизол-ап', color:'#3b82f6', condition:'Симптомы: усталость, гипотония, ↓ толерантности к стрессу, HPA-suppression от ААС', desc:'Восстановление HPA-оси',
                      items:[
                        {name:'Глицирризиновая кислота (корень солодки) 200-400 мг', dose:'200-400 мг', timing:'Утро', note:triageBadge('ess')+' Ингибитор 11β-HSD2 → ↑ кортизол. ↓ усталость, ↑ АД. Контроль K⁺!'},
                        {name:'Пантотеновая кислота (B5) 500-1000 мг', dose:'500-1000 мг', timing:'Утро', note:triageBadge('rec')+' Кофактор синтеза кортизола. Адреналиновая поддержка'},
                        {name:'Женьшень (Panax ginseng) 200-400 мг', dose:'200-400 мг', timing:'Утро', note:triageBadge('rec')+' Адаптоген. ↑ ACTH. Не принимать вечером'},
                        {name:'Отмена ашвагандхи и фосфатидилсерина', dose:'—', timing:'—', note:triageBadge('ess')+' Эти вещества ↓ кортизол — противопоказаны при гипокортизолемии'},
                      ]},
                    {phase:'ФАЗА 4 · АДДИСОНИЧЕСКИЙ КРИЗ (кортизол <50 нмоль/л + коллапс)', label:'🚑 Экстренная помощь', color:'#ef4444', condition:'Симптомы: коллапс, гипогликемия, гипер-K⁺, гипо-Na⁺, рвота', desc:'Госпитализация!',
                      items:[
                        {name:'Гидрокортизон 100 мг в/в', dose:'100 мг в/в', timing:'Экстренно', note:'Первая линия. Затем 200 мг/день в/в + инфузия. Госпитализация в ОРИТ'},
                        {name:'Инфузия NaCl 0.9% 1-2 л', dose:'1-2 л', timing:'Экстренно', note:'Коррекция гиповолемии. Декстроза 5% при гипогликемии'},
                        {name:'Отмена всех ААС + адаптогенов', dose:'—', timing:'—', note:'ААС могут подавлять HPA-ось. Адаптогены могут маскировать симптомы'},
                      ]},
                  ].map((p:any,i:any)=>renderPhase(p,i))}
                </div>
              )}
              {adaptogenTab==='timing' && timingBlock('adaptogen', [
                {time:'🌅 Утро', items:[{n:'Родиола 200-400 мг',why:'↑ стрессоустойчивость'},{n:'B5 500-1000 мг (при гипокортизоле)',why:'Синтез кортизола'}]},
                {time:'🍽 День', items:[{n:'Теанин 200 мг',why:'Утром + при стрессе'},{n:'Фосфатидилсерин 200 мг (при высоком кортизоле)',why:'После обеда'}]},
                {time:'🌙 Вечер', items:[{n:'Ашвагандха 300-600 мг',why:'За 30-60 мин до сна'},{n:'Магний глицинат 200-400 мг',why:'За 1-2 ч до сна'},{n:'Фосфатидилсерин 200 мг (при высоком кортизоле)',why:'Перед сном'}]},
              ])}
              {adaptogenTab==='monitoring' && monitoringBlock([
                {marker:'Кортизол утро (8:00)', target:'150-550 нмоль/л', when:'Каждые 4-8 нед', action:'>550 → старт кортизол-даун. <150 → старт кортизол-ап'},
                {marker:'Кортизол вечер (23:00)', target:'<50% от утреннего', when:'Каждые 4-8 нед', action:'↓ циркадного ритма → HPA-дисфункция. Восстановление режима сна'},
                {marker:'АКТГ', target:'10-60 пг/мл', when:'При подозрении на HPA-патологию', action:'↑ АКТГ + ↓ кортизол → первичная надпочечниковая недостаточность'},
                {marker:'K⁺, Na⁺', target:'K⁺ 3.5-5.0, Na⁺ 135-148', when:'Каждые 2-4 нед на солодке', action:'Глицирризиновая кислота → ↓ K⁺, ↑ Na⁺. Контроль электролитов!'},
                {marker:'АД', target:'<130/80', when:'1-2×/день на солодке', action:'↑ АД от глицирризиновой кислоты. Коррекция дозы/отмена при АГ'},
              ])}
              </div>

            <div style={{ borderRadius:12, padding:12, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#f59e0b', marginBottom:4 }}>🔗 Перекрёстные предупреждения</div>
              <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.5 }}>
                • 💤 <b>Сон:</b> Ашвагандха + магний используются в обоих модулях — НЕ суммировать дозы. Суммарно Mg ≤800 мг/сут, ашвагандха ≤600 мг/сут<br/>
                • ⚡ <b>Электролиты:</b> Солодка (глицирризиновая кислота) → ↓ K⁺, ↑ Na⁺. Совместно с эплереноном/ингибиторами РААС — риск дисбаланса K⁺<br/>
                • 🧠 <b>Нейро:</b> Высокий кортизол → нейротоксичность. Ашвагандха ↓ кортизол → нейропротективный эффект
              </div>
            </div>

          </InfoErrorBoundary>
  );
};
