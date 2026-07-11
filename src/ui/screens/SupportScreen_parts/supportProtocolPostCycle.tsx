// @ts-nocheck
import React, { useState } from 'react';
import { cardBg, pillActive, pillInactive, PhaseLabel, ItemRow, ItemRowTriage, triageBadge, phaseBadge, renderRow, renderPhase, timingBlock, monitoringBlock } from './supportProtocolsShared';
import { InfoErrorBoundary } from './SupportScreenData';

export const SupportProtocolPostCycle: React.FC<{ s: Record<string, any> }> = ({ s }) => {
  const [postCycleTab, setPostCycleTab] = useState('protocol');
  return (
          <InfoErrorBoundary label="Постцикл">
            <div style={{ paddingBottom:30, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={cardBg}>
                <div style={{ fontSize:13, fontWeight:800, color:'#8b5cf6', marginBottom:2 }}>🔄 Послекурсовая реабилитация (3-6 мес)</div>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Комплексное восстановление HPTA-оси, липидного профиля, гематокрита и нейроэндокринного статуса.</p>
              </div>
              <div style={{ display:'flex', gap:4, overflowX:'auto' }}>
                {[{id:'phases',label:'📅 Фазы'},{id:'lipids',label:'Липиды'},{id:'hemato',label:'Гематокрит'},{id:'neuro',label:'Нейро'},{id:'monitoring',label:'🧪 Мониторинг'}].map((t:any)=>(
                  <button key={t.id} onClick={()=>setPostCycleTab(t.id)} style={postCycleTab===t.id?pillActive('#8b5cf6'):pillInactive()}>{t.label}</button>
                ))}
              </div>
              {postCycleTab==='phases'&&(<div style={cardBg}>
                <div style={{ fontSize:11, fontWeight:700, color:'#8b5cf6', marginBottom:6 }}>📅 Фазы восстановления</div>
                <div style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(139,92,246,0.04)' }}>
                  <div style={{ fontSize:9, fontWeight:700, color:'#a78bfa', marginBottom:2 }}>ФАЗА 1 · ОТМЕНА ААС (0-4 нед)</div>
                  <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.3 }}>• Отмена ААС. При инъекционных ААС длительного действия — hCG 500-1000 МЕ 2×/нед × 2-3 нед (до начала SERM) для восстановления тестикулярного объёма<br/>• SERM (тамоксифен 20 мг ИЛИ энкломифен 12.5-25 мг ИЛИ кломифен 25-50 мг/день) — старт после последней инъекции коротких эфиров или через 2-3 нед после последней инъекции длинных эфиров<br/>• AI — только при высоком E2. Каберголин 0.25×2/нед при ↑ PRL<br/>• Контроль T,E2,PRL,АЛТ,HCT каждые 2 нед</div>
                </div>
                <div style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(139,92,246,0.04)' }}>
                  <div style={{ fontSize:9, fontWeight:700, color:'#a78bfa', marginBottom:2 }}>ФАЗА 2 · ПКТ (4-8 нед)</div>
                  <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.3 }}>• SERM (ОДИН из): тамоксифен 20 мг/день ИЛИ энкломифен 12.5-25 мг/день ИЛИ кломифен 25-50 мг/день. Комбинация SERM не рекомендована — одинаковый механизм, ↑ риска побочных эффектов без дополнительной пользы<br/>• Поддержка: цинк 50 мг, Mg 400 мг, D3 5000 МЕ, B6 100 мг<br/>• Адаптогены: ашвагандха 600 мг, фосфатидилсерин 200 мг<br/>• Контроль: T, ЛГ, ФСГ, кортизол каждые 2 нед</div>
                </div>
                <div style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(139,92,246,0.04)' }}>
                  <div style={{ fontSize:9, fontWeight:700, color:'#a78bfa', marginBottom:2 }}>ФАЗА 3 · ВОССТАНОВЛЕНИЕ (8-16 нед)</div>
                  <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.3 }}>• Липиды: омега-3 EPA 4 г, бергамот 1000 мг, ниацин 500 мг<br/>• HCT: кровопускание при {'>'}54, аспирин 100 мг, куркумин<br/>• Нейро: NAC 1200 мг, АЛК 600 мг, PS 400 мг, Mg 600 мг</div>
                </div>
                <div style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(139,92,246,0.04)' }}>
                  <div style={{ fontSize:9, fontWeight:700, color:'#a78bfa', marginBottom:2 }}>ФАЗА 4 · МОНИТОРИНГ (16-24+ нед)</div>
                  <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.3 }}>• Цель: T {'>'}15 нмоль/л, E2 80-150, ЛГ/ФСГ в норме<br/>• Полное восстановление HPTA — 4-12 мес<br/>• Следующий курс — только при T {'>'}15, ЛГ {'>'}3, липиды в норме</div>
                </div>
              </div>)}
              {postCycleTab==='lipids'&&(<div style={cardBg}>
                <div style={{ fontSize:11, fontWeight:700, color:'#8b5cf6', marginBottom:6 }}>🩸 Коррекция липидного профиля</div>
                {[{n:'Омега-3 EPA 4 г/день',d:'4 г',t:'2+2 г с едой',o:'↑ ЛПВП 10-15%, ↓ ТГ 25-30%'},{n:'Бергамот 1000 мг',d:'1000 мг',t:'2×/д до еды',o:'↓ ЛПНП 30-40%, ↑ ЛПВП 20-25%'},{n:'Ниацин B3 500 мг',d:'500 мг',t:'После еды 2-3×/д',o:'↑ ЛПВП 20-30% — мощный. Старт 100 мг титровать'},{n:'Кр. ферм. рис (монаколин K)',d:'10 мг',t:'Вечер',o:'↓ ЛПНП 20-40% +CoQ10. Контроль АЛТ'},{n:'Эзетимиб 10 мг 💊',d:'10 мг',t:'Утро',o:'↓ ЛПНП 15-20%. Аддитивно к статинам'}].map((x:any,i:any)=>renderRow(x,i,'#8b5cf6'))}
              </div>)}
              {postCycleTab==='hemato'&&(<div style={cardBg}>
                <div style={{ fontSize:11, fontWeight:700, color:'#8b5cf6', marginBottom:6 }}>🩸 Коррекция гематокрита</div>
                {[{n:'Кровопускание 400-500 мл',d:'—',t:'При HCT >54 до <50',o:'Золотой стандарт. Донорство. Повтор через 4-6 нед'},{n:'Аспирин 100 мг',d:'100 мг',t:'Утро после еды',o:'↓ агрегация тромбоцитов. При HCT >52'},{n:'Чеснок Kyolic 1200 мг',d:'1200 мг',t:'2×/день',o:'↓ вязкость крови'},{n:'Гидратация 3+ л/день',d:'>3 л',t:'Постоянно',o:'Разжижение крови'},{n:'Наттокиназа 100 мг',d:'100 мг',t:'Утро натощак',o:'Фибринолитик. При HCT >50'}].map((x:any,i:any)=>renderRow(x,i,'#8b5cf6'))}
              </div>)}
              {postCycleTab==='neuro'&&(<div style={cardBg}>
                <div style={{ fontSize:11, fontWeight:700, color:'#8b5cf6', marginBottom:6 }}>🧠 Нейрореабилитация</div>
                {[{n:'NAC 1200 мг',d:'1200 мг',t:'Утро+вечер',o:'↑ глутатион. ↓ глутамат-токсичность'},{n:'Mg глицинат 400-600 мг',d:'400-600 мг',t:'Вечер',o:'↓ глутамат, ГАМК-агонист'},{n:'PS 300-400 мг',d:'300-400 мг',t:'200 утро+200 вечер',o:'↓ кортизол. ↑ дофаминовые рецепторы'},{n:'АЛК 600 мг',d:'600 мг',t:'Утро',o:'Антиоксидант. ↑ глутатион в мозге'},{n:'L-теанин 200-400 мг',d:'200-400 мг',t:'Утро+день',o:'↑ α-волны. Анксиолитик'},{n:'Глицин 3 г',d:'3 г',t:'Перед сном',o:'ГАМК-агонист. Качество сна'},{n:'Куркумин Meriva 500-1000 мг',d:'500-1000 мг',t:'С едой',o:'↓ нейровоспаление NF-κB'}].map((x:any,i:any)=>renderRow(x,i,'#8b5cf6'))}
              </div>)}
              {postCycleTab==='monitoring' && monitoringBlock([
                {marker:'T общий/свободный', target:'>15 нмоль/л', when:'Каждые 4 нед (фазы 1-2)', action:'<10 → add SERM/энкломифен'},
                {marker:'ЛГ, ФСГ', target:'ЛГ 1-8 МЕ/л', when:'Каждые 4 нед', action:'ЛГ <1 → HPTA подавлена'},
                {marker:'E2', target:'80-150 пмоль/л', when:'Каждые 4 нед', action:'>200 → AI. <30 → add SERM'},
                {marker:'Липиды (ЛПВП, ЛПНП, ТГ)', target:'ЛПВП >1.0', when:'Каждые 4-8 нед', action:'ЛПВП <0.8 → старт коррекции'},
                {marker:'HCT', target:'42-50%', when:'Каждые 4 нед', action:'>54% → кровопускание'},
                {marker:'CRP', target:'<1 мг/л', when:'Каждые 8-12 нед', action:'>3 → персистирующее воспаление'},
                {marker:'Кортизол, PRL', target:'150-550, 60-600', when:'Каждые 4-8 нед', action:'↑ PRL → каберголин'},
                {marker:'ПСА (>40 лет)', target:'<2.5 нг/мл', when:'Ежегодно', action:'>4 → уролог'},
              ])}
            </div>
          </InfoErrorBoundary>
  );
};
