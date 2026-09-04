// @ts-nocheck
import React, { useState } from 'react';
import { cardBg, pillActive, pillInactive } from './supportProtocolsShared';
import { InfoErrorBoundary } from './SupportScreenData';

export const SupportProtocolPeptide: React.FC<{ s: Record<string, any> }> = ({ s }) => {
  const [peptideTab, setPeptideTab] = useState('protocol');
  return (
          <InfoErrorBoundary label="Пептиды">
            <div className="sup-proto-peptide" style={{ paddingBottom:30, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={cardBg}>
                <div style={{ fontSize:13, fontWeight:800, color:'#2dd4bf', marginBottom:2 }}>🧬 Пептиды — справочник (НЕ протокол назначения)</div>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Информационный справочник о классах пептидов. Дозировки и схемы приёма — ТОЛЬКО по назначению врача. Самостоятельное применение рискованно.</p>
              </div>
              <div style={{ borderRadius:10, padding:10, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)', marginBottom:10 }}>
                <div style={{ fontSize:9, fontWeight:700, color:'#ef4444', marginBottom:4 }}>⚠️ ВАЖНО: Этот раздел — СПРАВОЧНИК, НЕ клиническое руководство</div>
                <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.4 }}>
                  • Пептиды — лекарственные препараты, требующие назначения врача<br/>
                  • Дозировки ниже — ТОЛЬКО ориентировочные диапазоны из литературы, НЕ рекомендации<br/>
                  • Качество, стерильность, фармакокинетика подкожных пептидов — критически важны<br/>
                  • GH/IGF-1 — риск инсулинорезистентности, отеков, гетероплазии<br/>
                  • BPC-157/TB-500 — экспериментальные, нет крупных RCT у людей<br/>
                  • ВСЕГДА проконсультируйтесь с эндокринологом/спортврачом перед применением
                </div>
              </div>

              <div style={{ display:'flex', gap:4, overflowX:'auto' }}>
                {[{id:'ghrh',label:'GHRP/GHRH'},{id:'repair',label:'Регенерация'},{id:'nootropic',label:'Ноотропы'},{id:'immune',label:'Иммунитет'},{id:'other',label:'Прочие'}].map((t:any)=>(
                  <button key={t.id} onClick={()=>setPeptideTab(t.id)} style={peptideTab===t.id?pillActive('#2dd4bf'):pillInactive()}>{t.label}</button>
                ))}
              </div>
              {peptideTab==='ghrh'&&(<div style={cardBg}>
                <div style={{ fontSize:11, fontWeight:700, color:'#2dd4bf', marginBottom:6 }}>📈 GHRP/GHRH — стимуляторы GH (ориентировочные диапазоны)</div>
                <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Все дозировки — только по назначению эндокринолога. Контроль IGF-1, глюкозы, пролактина, кортизола обязателен.</p>
                <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.6 }}>
                  • <b>GHRP-2:</b> 100-200 мкг 2-3×/сут п/к · Старт 100 мкг · ↓ кортизол · Контроль пролактина<br/>
                  • <b>GHRP-6:</b> 100-200 мкг 2-3×/сут п/к · ↑ аппетит, ↑ кортизол · Титровать 100→200<br/>
                  • <b>Ipamorelin:</b> 200-300 мкг 2-3×/сут п/к · Селективный, не ↑ кортизол/PRL · Старт 200×2<br/>
                  • <b>CJC-1295 (no DAC):</b> 100-200 мкг 1-2×/сут п/к · GHRH-аналог · DAC-версия 1×/нед<br/>
                  • <b>Tesamorelin:</b> 2 мг 1×/сут п/к · Одобрен FDA ↓ висцеральный жир<br/>
                  • <b>Экзогенный GH:</b> 2-4 МЕ утро/перед тренировкой · Контроль IGF-1 в норме
                </div>
              </div>)}
              {peptideTab==='repair'&&(<div style={cardBg}>
                <div style={{ fontSize:11, fontWeight:700, color:'#2dd4bf', marginBottom:6 }}>🩹 Регенеративные пептиды: BPC-157 + TB-500 (ориентировочные диапазоны)</div>
                <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Клинические данные у человека ограничены. Введение — только под контролем спортврача/ортопеда.</p>
                <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.6 }}>
                  • <b>BPC-157:</b> 200-500 мкг 1-2×/сут п/к · Стабильный пентадекапептид · Ангиогенез + заживление сухожилий/ЖКТ<br/>
                  • <b>TB-500:</b> 2.5-10 мг 1×/нед в/м/п/к · G-актин-связывающий · Миграция клеток · Старт 2.5 мг ×2/нед<br/>
                  • <b>BPC+TB стек:</b> BPC 250+TB 2.5 · BPC 2×/сут, TB 2×/нед · Макс. регенерация · Курс 4-6 нед<br/>
                  • <b>GH 2-4 МЕ:</b> Утро + сон · ↑ IGF-1 → заживление · Синергия с BPC/TB
                </div>
              </div>)}
              {peptideTab==='nootropic'&&(<div style={cardBg}>
                <div style={{ fontSize:11, fontWeight:700, color:'#2dd4bf', marginBottom:6 }}>🧠 Ноотропные пептиды (ориентировочные диапазоны)</div>
                <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>ПЕПТИДЫ НЕ ЗАМЕНЯЮТ ЛЕКАРСТВЕННОЕ ЛЕЧЕНИЕ когнитивных расстройств. Невролог/психиатр — ТОЛЬКО врач-назначатель.</p>
                <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.6 }}>
                  • <b>Semax:</b> 200-600 мкг интраназально 1-2/сут · BDNF ↑, внимание · Курс 10-14 дн<br/>
                  • <b>Cerebrolysin:</b> 10-30 мл в/в капельно 10-20 дн · ↑ нейропластичность · NGF, BDNF<br/>
                  • <b>Pinealon:</b> 1-2 мл в/м ×10 дн · ↑ мелатонин · Сон + когнитив<br/>
                  • <b>Noopept:</b> 10-20 мг сублингвально 2-3/сут · Синтетический · 8-12 нед
                </div>
              </div>)}
              {peptideTab==='immune'&&(<div style={cardBg}>
                <div style={{ fontSize:11, fontWeight:700, color:'#2dd4bf', marginBottom:6 }}>🛡️ Иммунные пептиды (ориентировочные диапазоны)</div>
                <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>ИММУНОМОДУЛЯТОРЫ требуют назначения иммунолога. Самолечение — риск аутоиммунных реакций.</p>
                <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.6 }}>
                  • <b>Thymalin/Thymogen:</b> 5-10 мг в/м 5-10 дн 1-2×/год · T-клеточный иммунитет<br/>
                  • <b>TA-1 (Thymosin α1):</b> 1.6 мг п/к 2-4 нед · Противовирусный + противоопухолевый<br/>
                  • <b>Epitalon:</b> 5-10 мг в/м 10-20 дн · ↑ теломераза, мелатонин<br/>
                  • <b>LL-37:</b> 0.5-1 мг местно/п/к · Антимикробный · ЭКСПЕРИМЕНТАЛЬНЫЙ
                </div>
              </div>)}
              {peptideTab==='other'&&(<div style={cardBg}>
                <div style={{ fontSize:11, fontWeight:700, color:'#2dd4bf', marginBottom:6 }}>🧪 Другие пептиды (ориентировочные диапазоны)</div>
                <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>IGF-1 LR3 — ГИПОГЛИКЕМИЯ! Контроль глюкозы каждые 2-3 ч. Только под наблюдением врача.</p>
                <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.6 }}>
                  • <b>MGF (IGF-1Ec):</b> 50-100 мкг в мышцу после тренировки · Локальная гипертрофия · Сателлитные клетки<br/>
                  • <b>IGF-1 LR3:</b> 20-40 мкг п/к/в/м 2-3/сут · ↑ T½ 3× · ⚠ ГИПОГЛИКЕМИЯ! Контроль глюкозы<br/>
                  • <b>PEG-MGF:</b> 100-200 мкг в/м 1-2/нед · ↑ сателлитные клетки · Старт 100 мкг<br/>
                  • <b>ACTH (Синактен):</b> 0.25 мг в/м · ТОЛЬКО ДЛЯ ДИАГНОСТИКИ надпочечниковой недостаточности · НЕ ДЛЯ КУРСА!
                </div>
              </div>)}
            </div>
          </InfoErrorBoundary>
  );
};
