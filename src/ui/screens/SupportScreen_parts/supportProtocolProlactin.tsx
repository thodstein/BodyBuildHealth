// @ts-nocheck
import React, { useState } from 'react';
import { cardBg, pillActive, pillInactive, PhaseLabel, ItemRow, ItemRowTriage, triageBadge, phaseBadge, renderRow, renderPhase, timingBlock, monitoringBlock } from './supportProtocolsShared';
import { InfoErrorBoundary } from './SupportScreenData';

export const SupportProtocolProlactin: React.FC<{ s: Record<string, any> }> = ({ s }) => {
  const [prolactinTab, setProlactinTab] = useState('protocol');
  return (
          <InfoErrorBoundary label="Пролактин">
            <div style={{ paddingBottom:30, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={cardBg}>
                <div style={{ fontSize:13, fontWeight:800, color:'#ec4899', marginBottom:2 }}>🤱 Пролактин/Прогестерон</div>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Гиперпролактинемия от ААС (нандролон, тренболон) и антипсихотиков. Протокол коррекции по уровню PRL.</p>
              </div>
              <div style={{ display:'flex', gap:4, overflowX:'auto' }}>
                {[{id:'protocol',label:'Протокол'},{id:'timing',label:'⏰ Тайминг'},{id:'monitoring',label:'🧪 Мониторинг'}].map((t:any)=>(
                  <button key={t.id} onClick={()=>setProlactinTab(t.id)} style={prolactinTab===t.id?pillActive('#ec4899'):pillInactive()}>{t.label}</button>
                ))}
              </div>
              {prolactinTab==='protocol'&&(
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {[
                    {phase:'ФАЗА 1 · ПРОФИЛАКТИКА (PRL <600 мМЕ/л)', label:'Базовая поддержка нормы', color:'#22c55e', condition:'Все ААС-курсы с нандролоном/тренболоном', desc:'Профилактика гиперпролактинемии без каберголина',
                      items:[
                        {name:'Витамин B6 (пиридоксин) 50-100 мг', dose:'50-100 мг', timing:'Утро', note:triageBadge('ess')+' Кофактор дофамин-синтеза. Поддерживает D2-тонус. ↓ PRL на 15-25%'},
                        {name:'Магний (глицинат) 200-400 мг', dose:'200-400 мг', timing:'Вечер', note:triageBadge('rec')+' Кофактор тирозингидроксилазы. ↓ стресс-индуцированного ↑ PRL'},
                        {name:'Ашвагандха 300-600 мг', dose:'300-600 мг', timing:'Вечер', note:triageBadge('opt')+' ↓ кортизол → ↓ PRL. Синергия с магнием'},
                        {name:'Избегать: домперидон, метоклопрамид, нейролептики', dose:'—', timing:'—', note:triageBadge('ess')+' Все блокаторы D2 ↑ PRL. Альтернатива: ондансетрон (5-HT3)'},
                      ]},
                    {phase:'ФАЗА 2 · УМЕРЕННАЯ (PRL 600-1000 мМЕ/л)', label:'Каберголин — старт', color:'#f59e0b', condition:'PRL 600-1000 / симптомы: ↓ либидо, галакторея, олигоменорея', desc:'Медикаментозная коррекция',
                      items:[
                        {name:'Каберголин (Достинекс) 💊', dose:'0.25 мг', timing:'1-2×/нед', note:triageBadge('ess')+' D2-агонист. Старт 0.25 мг × 1/нед. Контроль PRL через 2 нед'},
                        {name:'B6 100 мг + Mg 400 мг', dose:'100+400 мг', timing:'Утро/вечер', note:triageBadge('rec')+' Адъювант. Повышает эффективность каберголина'},
                        {name:'Контроль тошноты от каберголина', dose:'—', timing:'—', note:triageBadge('rec')+' Принимать с едой. Старт 0.125 мг при непереносимости. Домперидон НЕЛЬЗЯ (блокирует D2)'},
                      ]},
                    {phase:'ФАЗА 3 · ВЫСОКАЯ (PRL 1000-2000 мМЕ/л)', label:'Каберголин — титрация', color:'#f97316', condition:'PRL 1000-2000 / галакторея / гипогонадизм', desc:'Увеличение дозы каберголина',
                      items:[
                        {name:'Каберголин 0.5 мг', dose:'0.5 мг', timing:'1-2×/нед', note:triageBadge('ess')+' Титрация от 0.25→0.5 мг. Разделить приём на 2×/нед (напр. ср+вс)'},
                        {name:'B6 200 мг + Mg 600 мг', dose:'200+600 мг', timing:'100 мг B6 утро + 100 мг вечер. Mg вечер', note:triageBadge('rec')+' ↑ дозу B6 при ↑ PRL. Мониторинг нейропатии (B6 >200 мг × >6 мес)'},
                        {name:'Исключить пролактиному (МРТ гипофиза)', target:'Размер аденомы', when:'PRL >2000 или головные боли/нарушения полей зрения', action:'МРТ гипофиза с контрастом. КТ — если МРТ недоступна'},
                      ]},
                    {phase:'ФАЗА 4 · КРИТИЧЕСКАЯ (PRL >2000 + галакторея/аденома)', label:'Каберголин + эндокринолог', color:'#ef4444', condition:'PRL >2000 / макропролактинома / галакторея', desc:'Терапия под контролем эндокринолога',
                      items:[
                        {name:'Каберголин 1-2 мг', dose:'1-2 мг', timing:'2×/нед', note:triageBadge('ess')+' Высокие дозы. Контроль PRL ежемесячно. Эхокардиография каждые 6-12 мес (риск фиброза клапанов)'},
                        {name:'МРТ гипофиза с контрастом', target:'Размер аденомы', when:'Каждые 12 мес', action:'↓ размеров на фоне каберголина — критерий эффективности'},
                        {name:'Клинический осмотр', target:'Поля зрения, головные боли', when:'Каждые 6 мес', action:'При ↑ размеров аденомы → нейрохирург. При апоплексии гипофиза — экстренная госпитализация'},
                      ]},
                  ].map((p:any,i:any)=>renderPhase(p,i))}
                </div>
              )}
              {prolactinTab==='timing' && timingBlock('prolactin', [
                {time:'🌅 Утро (с едой)', items:[{n:'B6 50-100 мг',why:'С завтраком'},{n:'Каберголин 0.25-0.5 мг (1-2×/нед)',why:'С едой ↓ тошноты'}]},
                {time:'🌙 Вечер', items:[{n:'Магний глицинат 200-400 мг',why:'За 1-2 ч до сна'},{n:'Ашвагандха 300-600 мг',why:'↓ кортизола'}]},
              ])}
              {prolactinTab==='monitoring' && monitoringBlock([
                {marker:'Пролактин (PRL)', target:'60-600 мМЕ/л (2-20 нг/мл)', when:'Каждые 2-4 нед', action:'>600 → старт каберголина. <60 → ↓ каберголин'},
                {marker:'Тестостерон (общий)', target:'20-30 нмоль/л (на курсе)', when:'Каждые 4-8 нед', action:'↓ тестостерон при ↑ PRL → подавление ГнРГ'},
                {marker:'ЛГ/ФСГ', target:'ЛГ 1-8, ФСГ 1-10 МЕ/л', when:'Каждые 8-12 нед', action:'↓ ЛГ/ФСГ при ↑ PRL → гипогонадотропный гипогонадизм'},
                {marker:'Эхокардиография', target:'Без фиброза клапанов', when:'Каждые 6-12 мес на каберголине', action:'Каберголин >2 мг/нед — риск фиброза сердечных клапанов'},
              ])}
            </div>
          </InfoErrorBoundary>
  );
};
