// @ts-nocheck
import React, { useState } from 'react';
import { cardBg, pillActive, pillInactive, PhaseLabel, ItemRow, ItemRowTriage, triageBadge, phaseBadge, renderRow, renderPhase, timingBlock, monitoringBlock } from './supportProtocolsShared';
import { InfoErrorBoundary } from './SupportScreenData';

export const SupportProtocolMito: React.FC<{ s: Record<string, any> }> = ({ s }) => {
  const [mitoTab, setMitoTab] = useState('protocol');
  return (
          <InfoErrorBoundary label="Митохондрии">
            <div className="sup-proto-mito" style={{ paddingBottom:30, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={cardBg}>
                <div style={{ fontSize:13, fontWeight:800, color:'#06b6d4', marginBottom:2 }}>⚡ Митохондриальный (NAD⁺/энергия)</div>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Митохондриальная поддержка для энергетики, долголетия и профилактики метаболических нарушений на курсе ААС и GH.</p>
              </div>
              <div style={{ display:'flex', gap:4, overflowX:'auto' }}>
                {[{id:'protocol',label:'Протокол'},{id:'timing',label:'⏰ Тайминг'},{id:'monitoring',label:'🧪 Мониторинг'}].map((t:any)=>(
                  <button key={t.id} onClick={()=>setMitoTab(t.id)} style={mitoTab===t.id?pillActive('#06b6d4'):pillInactive()}>{t.label}</button>
                ))}
              </div>
              {mitoTab==='protocol'&&(
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {[
                    {phase:'ФАЗА 1 · БАЗОВАЯ МИТОХОНДРИАЛЬНАЯ ПОДДЕРЖКА', label:'NAD⁺-прекурсоры + CoQ10', color:'#22c55e', condition:'Базовый курс без GH', desc:'Поддержка энергетики и антиоксидантной защиты',
                      items:[
                        {name:'CoQ10 (убихинон) 100-200 мг', dose:'100-200 мг', timing:'Утро с жирной едой', note:triageBadge('ess')+' Ключевой переносчик электронов. ↓ с возрастом и на статинах. Убихинол — при ЖКТ-чувствительности'},
                        {name:'L-карнитин (L-карнитин-L-тартрат) 1-2 г', dose:'1-2 г', timing:'Утро натощак / перед тренировкой', note:triageBadge('ess')+' Транспорт жирных кислот в митохондрии. ↑ выносливость, ↓ усталость. Карнитин + АЛК — синергия'},
                        {name:'Альфа-липоевая кислота (АЛК) 300-600 мг', dose:'300-600 мг', timing:'Утро натощак', note:triageBadge('rec')+' Кофактор митохондриальных ферментов. ↑ захват глюкозы. Антиоксидант'},
                        {name:'Магний (цитрат/глицинат) 400 мг', dose:'400 мг', timing:'Вечер', note:triageBadge('rec')+' Кофактор АТФ-синтазы. ↓ мышечные судороги'},
                      ]},
                    {phase:'ФАЗА 2 · ОПТИМАЛЬНАЯ (курс 8+ нед / высокий объём)', label:'+ NAD⁺-бустеры', color:'#f59e0b', condition:'Курс >8 нед, высокий тренировочный объём, возраст >35', desc:'Усиление митохондриального биогенеза',
                      items:[
                        {name:'NMN / NR (никотинамид-рибозид) 250-500 мг', dose:'250-500 мг', timing:'Утро натощак', note:triageBadge('rec')+' NAD⁺-прекурсор. ↑ NAD⁺ на 40-80%. ↓ усталость, ↑ восстановление. Дорого, но эффективно'},
                        {name:'PQQ (пирролохинолинхинон) 10-20 мг', dose:'10-20 мг', timing:'Утро', note:triageBadge('opt')+' Стимулятор митохондриального биогенеза (PGC-1α). Синергия с CoQ10'},
                        {name:'D-рибоза 5 г', dose:'5 г', timing:'После тренировки', note:triageBadge('opt')+' Субстрат для синтеза АТФ. ↓ крепатура, ↑ восстановление. При высоком объёме'},
                        {name:'Берберин 500 мг', dose:'500 мг', timing:'2×/день до еды', note:triageBadge('rec')+' AMPK-активатор → PGC-1α → биогенез митохондрий. ↓ ИР, ↑ чувствительность к инсулину'},
                      ]},
                    {phase:'ФАЗА 3 · ИНТЕНСИВНАЯ (GH + ААС + высокий объём)', label:'Полный митохондриальный стек', color:'#f97316', condition:'GH + ААС + тренировки 6×/нед + возраст >40', desc:'Максимальная поддержка энергетики',
                      items:[
                        {name:'CoQ10 300 мг + PQQ 20 мг', dose:'300+20 мг', timing:'Утро', note:triageBadge('ess')+' Максимальные дозы. PQQ ↑ биогенез, CoQ10 — перенос электронов'},
                        {name:'NMN 500-1000 мг + АЛК 600 мг', dose:'500-1000+600', timing:'Утро натощак', note:triageBadge('ess')+' NAD⁺-буст + антиоксидант. ↓ оксидативный стресс от GH'},
                        {name:'L-карнитин 2-3 г + D-рибоза 5-10 г', dose:'2-3 г + 5-10 г', timing:'До/после тренировки', note:triageBadge('rec')+' ↑ энергия, ↓ усталость. Карнитин — до тренировки, рибоза — после'},
                        {name:'Магний 600 мг + калий 400 мг', dose:'600+400 мг', timing:'Вечер', note:triageBadge('ess')+' Электролиты для митохондрий. Mg — кофактор АТФ'},
                      ]},
                  ].map((p:any,i:any)=>renderPhase(p,i))}
                </div>
              )}
              {mitoTab==='timing' && timingBlock('mito', [
                {time:'🌅 Утро натощак', items:[{n:'NMN/NR 250-500 мг',why:'NAD⁺-буст'},{n:'АЛК 300-600 мг',why:'Антиоксидант'},{n:'CoQ10 100-300 мг',why:'С жирной едой (завтрак)'}]},
                {time:'🏋️ До тренировки', items:[{n:'L-карнитин 1-2 г',why:'↑ окисление жиров + энергия'}]},
                {time:'🍽 После тренировки', items:[{n:'D-рибоза 5 г',why:'Синтез АТФ'}]},
                {time:'🌙 Вечер', items:[{n:'Магний 400-600 мг',why:'Кофактор АТФ'},{n:'PQQ 10-20 мг (если не утром)',why:'Биогенез митохондрий'}]},
              ])}
              {mitoTab==='monitoring' && monitoringBlock([
                {marker:'Энергия (субъективно)', target:'0-10', when:'Ежедневно', action:'Оценка энергии — ключевой критерий эффективности'},
                {marker:'Крепатура (DOMS)', target:'<4/10', when:'Ежедневно', action:'↓ DOMS + ↑ восстановление → эффект митохондриальной поддержки'},
                {marker:'Глюкоза натощак', target:'3.9-5.6 ммоль/л', when:'1×/нед', action:'Берберин ↓ глюкозу. При <3.9 — риск гипогликемии'},
                {marker:'Лактат (после тренировки)', target:'<2 ммоль/л (через 5 мин)', when:'При оценке выносливости', action:'↑ лактат → ↓ митохондриальной функции'},
              ])}
            </div>
          </InfoErrorBoundary>
  );
};
