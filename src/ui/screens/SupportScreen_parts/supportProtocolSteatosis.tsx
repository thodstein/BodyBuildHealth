// @ts-nocheck
import React, { useState } from 'react';
import { cardBg, pillActive, pillInactive, PhaseLabel, ItemRow, ItemRowTriage, triageBadge, phaseBadge, renderRow, renderPhase, timingBlock, monitoringBlock } from './supportProtocolsShared';
import { InfoErrorBoundary } from './SupportScreenData';

export const SupportProtocolSteatosis: React.FC<{ s: Record<string, any> }> = ({ s }) => {
  const [steatosisTab, setSteatosisTab] = useState('protocol');
  return (
          <InfoErrorBoundary label="Стеатоз">
            <div style={{ paddingBottom:30, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={cardBg}>
                <div style={{ fontSize:13, fontWeight:800, color:'#84cc16', marginBottom:2 }}>🫁 Стеатоз печени (НАЖБП)</div>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Неалкогольная жировая болезнь печени — частое осложнение ААС (оральные 17α-алкилированные, избыток калорий).</p>
              </div>
              <div style={{ display:'flex', gap:4, overflowX:'auto' }}>
                {[{id:'protocol',label:'Протокол'},{id:'timing',label:'⏰ Тайминг'},{id:'monitoring',label:'🧪 Мониторинг'}].map((t:any)=>(
                  <button key={t.id} onClick={()=>setSteatosisTab(t.id)} style={steatosisTab===t.id?pillActive('#84cc16'):pillInactive()}>{t.label}</button>
                ))}
              </div>
              {steatosisTab==='protocol'&&(
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {[
                    {phase:'ФАЗА 1 · ПРОФИЛАКТИКА (стеатоза нет)', label:'Гепатопротекция + метаболическая поддержка', color:'#22c55e', condition:'АЛТ/АСТ/ГГТ в норме, УЗИ печени без изменений', desc:'Профилактика стеатоза на курсе ААС',
                      items:[
                        {name:'Берберин 500 мг', dose:'500 мг', timing:'2-3×/день до еды', note:triageBadge('ess')+' AMPK-активатор → ↓ de novo липогенеза. ↓ глюкозы, ↓ ИР. Доказан при НАЖБП'},
                        {name:'TUDCA 250-500 мг', dose:'250-500 мг', timing:'Вечер натощак', note:triageBadge('rec')+' ↓ ER-стресс, ↑ BSEP-экспрессию. Антиапоптотический. +NAC для синергии'},
                        {name:'Омега-3 (EPA/DHA) 2-4 г', dose:'2-4 г', timing:'С едой', note:triageBadge('rec')+' ↓ триглицеридов печени на 25-40%. ↑ окисления жирных кислот'},
                        {name:'Силимарин (расторопша) 140-280 мг', dose:'140-280 мг', timing:'Утро', note:triageBadge('opt')+' Стабилизация мембран гепатоцитов. Антиоксидант'},
                      ]},
                    {phase:'ФАЗА 2 · УМЕРЕННЫЙ СТЕАТОЗ (CAP 250-300 dB/м)', label:'Лечение стеатоза', color:'#f59e0b', condition:'УЗИ: стеатоз 1-2 ст. / CAP 250-300 / АЛТ 40-80', desc:'Терапия стеатоза',
                      items:[
                        {name:'Берберин 500-1000 мг', dose:'500-1000 мг', timing:'3×/день до еды', note:triageBadge('ess')+' ↑ дозу. ↓ HOMA-IR на 30%. ↓ стеатоза по данным МРТ'},
                        {name:'TUDCA 500-750 мг', dose:'500-750 мг', timing:'Вечер натощак', note:triageBadge('ess')+' ↑ BSEP, ↓ стеатоз. Синергия с берберином'},
                        {name:'Омега-3 (EPA) 4 г', dose:'4 г', timing:'С едой (2+2 г)', note:triageBadge('ess')+' EPA 4 г — минимальная эффективная доза для ↓ стеатоза'},
                        {name:'Витамин E (RRR-α-токоферол) 400-800 МЕ', dose:'400-800 МЕ', timing:'С едой', note:triageBadge('rec')+' Антиоксидант. ↓ стеатоза (PIVENS trial). Контроль ПСА! (↑ риск рака простаты)'},
                        {name:'Силимарин 280-420 мг', dose:'280-420 мг', timing:'Утро', note:triageBadge('opt')+' ↑ дозу. Стабилизация мембран'},
                      ]},
                    {phase:'ФАЗА 3 · ТЯЖЁЛЫЙ СТЕАТОЗ/НАСГ/ФИБРОЗ (CAP >300 / FIB-4 >2.67)', label:'НАСГ + риск цирроза', color:'#ef4444', condition:'CAP >300 / АЛТ >80 / FIB-4 >2.67 / эластография >8 кПа', desc:'Терапия под контролем гепатолога',
                      items:[
                        {name:'Берберин 1000 мг + TUDCA 1000 мг', dose:'1000+1000 мг', timing:'Берберин 3×, TUDCA вечер', note:triageBadge('ess')+' Максимальные дозы. Add-on: метформин/пиоглитазон'},
                        {name:'Омега-3 (EPA) 6 г', dose:'6 г', timing:'3+3 г с едой', note:triageBadge('ess')+' Максимальная доза. ↑ окисления жирных кислот'},
                        {name:'Пиоглитазон 15-30 мг 💊', dose:'15-30 мг', timing:'Утро', note:triageBadge('rec')+' ↓ ИР + ↓ стеатоза. Контроль веса (+2-4 кг). ↑ риска переломов (женщины)'},
                        {name:'Эластография печени (FibroScan)', target:'<8 кПа', when:'Каждые 6 мес', action:'>8 кПа → фиброз. >12 кПа → цирроз. Гепатолог'},
                        {name:'FIB-4 индекс', target:'<1.30 (низкий риск)', when:'Каждые 6 мес', action:'>2.67 → высокий риск фиброза. Биопсия/эластография'},
                        {name:'Отмена/замена оральных ААС', dose:'—', timing:'—', note:triageBadge('ess')+' 17α-алкилированные → гепатотоксичность. Переход на инъекционные + GH не рекомендован'},
                      ]},
                  ].map((p:any,i:any)=>renderPhase(p,i))}
                </div>
              )}
              {steatosisTab==='timing' && timingBlock('steatosis', [
                {time:'🌅 Утро', items:[{n:'Берберин 500 мг',why:'За 15-30 мин до завтрака'},{n:'Силимарин 140-280 мг',why:'С едой'},{n:'Пиоглитазон 15-30 мг (при НАСГ)',why:'Утром с едой'}]},
                {time:'🍽 День', items:[{n:'Омега-3 2 г (EPA)',why:'С обедом'},{n:'Берберин 500 мг',why:'До обеда'}]},
                {time:'🌙 Вечер', items:[{n:'TUDCA 500-1000 мг',why:'Натощак за 2 ч до сна'},{n:'Омега-3 2 г (EPA)',why:'С ужином'},{n:'Берберин 500 мг',why:'До ужина'},{n:'Витамин E 400-800 МЕ',why:'С ужином (жирорастворимый)'}]},
              ])}
              {steatosisTab==='monitoring' && monitoringBlock([
                {marker:'АЛТ/АСТ', target:'<40 Ед/л', when:'Каждые 4 нед', action:'>40 → ↑ дозу берберина/TUDCA. >80 → консультация гепатолога'},
                {marker:'ГГТ, ЩФ', target:'ГГТ <60, ЩФ <150', when:'Каждые 4 нед', action:'↑ ГГТ → холестаз. ↑ TUDCA'},
                {marker:'Глюкоза натощак', target:'3.9-5.6 ммоль/л', when:'1×/нед', action:'↑ глюкоза → ИР + стеатоз. Берберин ↓ глюкозу'},
                {marker:'Липидный профиль (ТГ, ЛПВП)', target:'ТГ <1.7, ЛПВП >1.0', when:'Каждые 8-12 нед', action:'↑ ТГ → стеатоз. Омега-3 EPA 4 г ↓ ТГ на 25%'},
                {marker:'УЗИ печени / CAP', target:'CAP <250 дБ/м / нет стеатоза', when:'Каждые 6-12 мес', action:'↑ CAP → прогрессия стеатоза'},
                {marker:'FIB-4 / эластография', target:'FIB-4 <1.30', when:'Ежегодно', action:'>2.67 → продвинутый фиброз. Направить к гепатологу'},
              ])}
            </div>
          </InfoErrorBoundary>
  );
};
