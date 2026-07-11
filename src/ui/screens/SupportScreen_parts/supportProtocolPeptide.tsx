// @ts-nocheck
import React, { useState } from 'react';
import { cardBg, pillActive, pillInactive, PhaseLabel, ItemRow, ItemRowTriage, triageBadge, phaseBadge, renderRow, renderPhase, timingBlock, monitoringBlock } from './supportProtocolsShared';
import { InfoErrorBoundary } from './SupportScreenData';

export const SupportProtocolPeptide: React.FC<{ s: Record<string, any> }> = ({ s }) => {
  const [peptideTab, setPeptideTab] = useState('protocol');
  return (
          <InfoErrorBoundary label="Пептиды">
            <div style={{ paddingBottom:30, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={cardBg}>
                <div style={{ fontSize:13, fontWeight:800, color:'#2dd4bf', marginBottom:2 }}>🧬 Пептиды (сводный справочник)</div>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Справочник пептидов: GHRP/GHRH, регенеративные (BPC-157, TB-500), ноотропные, иммунные.</p>
              </div>
              <div style={{ display:'flex', gap:4, overflowX:'auto' }}>
                {[{id:'ghrh',label:'GHRP/GHRH'},{id:'repair',label:'Регенерация'},{id:'nootropic',label:'Ноотропы'},{id:'immune',label:'Иммунитет'},{id:'other',label:'Прочие'}].map((t:any)=>(
                  <button key={t.id} onClick={()=>setPeptideTab(t.id)} style={peptideTab===t.id?pillActive('#2dd4bf'):pillInactive()}>{t.label}</button>
                ))}
              </div>
              {peptideTab==='ghrh'&&(<div style={cardBg}>
                <div style={{ fontSize:11, fontWeight:700, color:'#2dd4bf', marginBottom:6 }}>📈 GHRP/GHRH — стимуляторы GH</div>
                {[{n:'GHRP-2 100-200 мкг',d:'100-200 мкг',t:'2-3×/день п/к',o:'Старт 100 мкг. ↓ кортизол. Контроль пролактина'},{n:'GHRP-6 100-200 мкг',d:'100-200 мкг',t:'2-3×/день п/к',o:'↑ аппетит. ↑ кортизол. Титровать 100→200'},{n:'Ipamorelin 200-300 мкг',d:'200-300 мкг',t:'2-3×/день п/к',o:'Селективный GHRP. Не ↑ кортизол/PRL. Старт 200×2'},{n:'CJC-1295 (без DAC) 100-200 мкг',d:'100-200 мкг',t:'1-2×/день п/к',o:'GHRH-аналог. DAC-версия 1×/нед'},{n:'Tesamorelin 2 мг',d:'2 мг',t:'1×/день п/к',o:'Одобрен FDA ↓ висцеральный жир'},{n:'GH 2-4 МЕ',d:'2-4 МЕ',t:'Утро/перед тренировкой',o:'Экзогенный GH. Старт 2 МЕ. Контроль IGF-1'}].map((x:any,i:any)=>renderRow(x,i,'#2dd4bf'))}
              </div>)}
              {peptideTab==='repair'&&(<div style={cardBg}>
                <div style={{ fontSize:11, fontWeight:700, color:'#2dd4bf', marginBottom:6 }}>🩹 Регенеративные пептиды (BPC-157 + TB-500)</div>
                {[{n:'BPC-157 200-500 мкг',d:'200-500 мкг',t:'1-2×/день п/к',o:'Стабильный пентадекапептид. Ангиогенез + заживление сухожилий и ЖКТ'},{n:'TB-500 2.5-10 мг',d:'2.5-10 мг',t:'1×/нед в/м/п/к',o:'G-актин-связывающий. Миграция клеток. Старт 2.5 мг ×2/нед'},{n:'BPC+TB стек',d:'BPC 250+TB 2.5',t:'BPC 2×/д, TB 2×/нед',o:'Максимальная регенерация. Курс 4-6 нед'},{n:'GH 2-4 МЕ',d:'2-4 МЕ',t:'Утро + сон',o:'↑ IGF-1 → заживление. Синергия с BPC/TB'}].map((x:any,i:any)=>renderRow(x,i,'#2dd4bf'))}
              </div>)}
              {peptideTab==='nootropic'&&(<div style={cardBg}>
                <div style={{ fontSize:11, fontWeight:700, color:'#2dd4bf', marginBottom:6 }}>🧠 Ноотропные пептиды</div>
                {[{n:'Semax 200-600 мкг',d:'200-600 мкг',t:'Интраназально 1-2/д',o:'BDNF ↑, внимание. Курс 10-14 дн'},{n:'Cerebrolysin 10-30 мл',d:'10-30 мл',t:'В/в капельно 10-20 дн',o:'↑ нейропластичность. NGF, BDNF'},{n:'Pinealon 1-2 мл',d:'1-2 мл',t:'В/м ×10 дн',o:'↑ мелатонин. Сон + когнитив'},{n:'Noopept 10-20 мг',d:'10-20 мг',t:'Сублингвально 2-3/д',o:'Синтетический ноотроп. 8-12 нед'}].map((x:any,i:any)=>renderRow(x,i,'#2dd4bf'))}
              </div>)}
              {peptideTab==='immune'&&(<div style={cardBg}>
                <div style={{ fontSize:11, fontWeight:700, color:'#2dd4bf', marginBottom:6 }}>🛡️ Иммунные пептиды</div>
                {[{n:'Thymalin/Thymogen 5-10 мг',d:'5-10 мг',t:'В/м 5-10 дн 1-2×/год',o:'T-клеточный иммунитет'},{n:'TA-1 (тимозин α1) 1.6 мг',d:'1.6 мг',t:'П/к 2-4 нед',o:'Противовирусный + противоопухолевый'},{n:'Epitalon 5-10 мг',d:'5-10 мг',t:'В/м 10-20 дн',o:'↑ теломераза, мелатонин'},{n:'LL-37 0.5-1 мг',d:'0.5-1 мг',t:'Местно/п/к',o:'Антимикробный пептид. Экспериментальный'}].map((x:any,i:any)=>renderRow(x,i,'#2dd4bf'))}
              </div>)}
              {peptideTab==='other'&&(<div style={cardBg}>
                <div style={{ fontSize:11, fontWeight:700, color:'#2dd4bf', marginBottom:6 }}>🧪 Другие пептиды</div>
                {[{n:'MGF (IGF-1Ec) 50-100 мкг',d:'50-100 мкг',t:'В мышцу после тренировки',o:'Локальная гипертрофия. Сателлитные клетки'},{n:'IGF-1 LR3 20-40 мкг',d:'20-40 мкг',t:'П/к/в/м 2-3/д',o:'↑ период полувыведения 3×. Гипогликемия!'},{n:'PEG-MGF 100-200 мкг',d:'100-200 мкг',t:'В/м 1-2/нед',o:'↑ сателлитные клетки. Старт 100 мкг'},{n:'АКТГ (Синактен) 0.25 мг',d:'0.25 мг',t:'В/м (только диагностика!)',o:'Только для диагностического теста надпочечниковой недостаточности. НЕ ДЛЯ КУРСА! Не путать с анаболическим использованием'}].map((x:any,i:any)=>renderRow(x,i,'#2dd4bf'))}
              </div>)}
            </div>
          </InfoErrorBoundary>
  );
};
