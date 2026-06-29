const fs = require('fs');
let c = fs.readFileSync('D:/BodyBuildHealth/src/ui/screens/SupportScreen.tsx', 'utf8');

// 1. Expand monitoring card with system grouping
c = c.replace(
  '{planResult.monitoring.slice(0, 12).join(\'\\n\')}',
  '{planResult.monitoring.slice(0, 15).map((line, i) => <div key={i} style={{marginBottom:1}}>{line}</div>)}'
);

// 2. Expand special instructions
c = c.replace(
  '{planResult.specialInstructions.join(\'\\n\')}',
  '{planResult.specialInstructions.map((line, i) => <div key={i} style={{marginBottom:2}}>{line}</div>)}'
);

// 3. Add tier distribution chart after coverage gauge
const gaugeEnd = '                    </div>\n                  )}\n\n                  {/* ===== TIME-BLOCK TABLE (D1) ===== */}';
if (c.includes(gaugeEnd)) {
  const tierChart = `
                  {/* ===== TIER DISTRIBUTION ===== */}
                  {planResult?.substances && (
                    <div style={{marginBottom:10, padding:'8px 12px', borderRadius:10, background:'rgba(255,255,255,0.02)', border:'1px solid var(--border)', fontSize:8}}>
                      <div style={{fontSize:9,fontWeight:700,color:'var(--text-light)',marginBottom:6}}>📊 Распределение по тирам</div>
                      <div style={{display:'flex',gap:6}}>
                        {['core','standard','advanced','specialty'].map(tier => {
                          const count = planResult.substances.filter(s => s.tier === tier).length;
                          const tc = {core:'#22c55e',standard:'#f59e0b',advanced:'#f97316',specialty:'#ef4444'};
                          const tl = {core:'Ядро',standard:'Станд.',advanced:'Продв.',specialty:'Спец.'};
                          return <div key={tier} style={{flex:1,textAlign:'center',padding:'6px 4px',borderRadius:8,background:tc[tier]+'10',border:'1px solid '+tc[tier]+'20'}}>
                            <div style={{fontSize:14,fontWeight:800,color:tc[tier]}}>{count}</div>
                            <div style={{fontSize:7,color:tc[tier],fontWeight:600}}>{tl[tier]}</div>
                          </div>;
                        })}
                      </div>
                      <div style={{fontSize:7,color:'var(--text-dim)',marginTop:6}}>💡 Ядро — обязательно на любом курсе. Стандарт — рекомендовано при дозах &gt;500 мг/нед. Продвинутые и специальные — по показаниям.</div>
                    </div>
                  )}

                  {/* ===== TIME-BLOCK TABLE (D1) ===== */}`;
  c = c.replace(gaugeEnd, tierChart);
}

// 4. Add risk reduction detail after risk dynamics
c = c.replace(
  "Общий риск: <b style={{ color:'#ef4444' }}>{planResult.overallRiskBefore}%</b> → <b style={{ color:'#22c55e' }}>{planResult.overallRiskAfter}%</b>",
  "Общий риск: <b style={{color:'#ef4444'}}>{planResult.overallRiskBefore}%</b> → <b style={{color:'#22c55e'}}>{planResult.overallRiskAfter}%</b> · Снижение: <b style={{color:'var(--accent)'}}>-{planResult.overallRiskBefore - planResult.overallRiskAfter}%</b>"
);

// 5. Add monitoring summary at top of monitoring card
c = c.replace(
  "📊 Мониторинг: что и когда контролировать</summary>",
  "📊 Мониторинг ({planResult.monitoring.length} пунктов)</summary>"
);

// 6. Add substance count breakdown to plan header
c = c.replace(
  "📋 План поддержки ({effectiveLevel.subs.length} препаратов)",
  "📋 План ({effectiveLevel.subs.length} вещ.)"
);

// 7. Expand week timeline with explanation
c = c.replace(
  "✦ текущая · 1-2:60% · 3-4:80% · 5-6:90% · 7+:100%",
  "✦ Текущая неделя · Недели 1-2: стартовые дозы (60% от полных) — организм адаптируется · 3-4: разгон (80%) · 5-6: выход на плато (90%) · 7+: полные дозы (100%)"
);

// 8. Add data completeness note
c = c.replace(
  "Заполните <b>Фарма стек</b> в AutoCalculator для точного подбора.",
  "Заполните <b>💉 Фарма стек</b> в AutoCalculator и <b>🧪 Лабораторию</b> для максимально точного подбора поддержки с учётом реальных рисков и отклонений."
);

// 9. Add plan size indicator
c = c.replace(
  '📍 Рекомендованный уровень:',
  '📍 Авто-уровень:'
);

// 10. Expand what-if description
c = c.replace(
  "Оцените влияние каждого вещества на риски",
  "Нажмите на вещество чтобы увидеть его вклад в защиту — сколько механизмов покрывает и насколько вырастет риск без него"
);

// 11. Expand stack note
c = c.replace(
  "Стеки оцениваются по покрытию рисков, синергии и отсутствию избыточных веществ.",
  "Стеки оцениваются по трём критериям: покрытие активированных механизмов, синергия веществ в стеке, и отсутствие избыточных компонентов. Приоритет имеют стеки с высоким synergyScore и минимальным количеством ненужных веществ."
);

// 12. Add note about data sources
c = c.replace(
  "Данные из калькулятора поддержки",
  "Данные синхронизированы из калькулятора поддержки. Обновляются автоматически при каждом пересчёте."
);

// 13. Expand uncovered mechanisms footer
c = c.replace(
  "⚠️ Критический &gt;30% · ⚡ Повышенный &gt;15%",
  "⚠️ Критический риск &gt;30%: требует обязательного покрытия · ⚡ Повышенный &gt;15%: рекомендуется покрытие"
);

// 14. Expand risk breakdown footer
c = c.replace(
  "💡 Источники риска определены на основе профиля, препаратов курса, анализов и истории.",
  "💡 Риски рассчитаны на основе: профиля пользователя (возраст, вес, образ жизни), препаратов курса (PHARMA_DB: linkedRisks, cvProfile, pd), данных анализов (LAB_MARKER_MAP: 80+ маркеров), истории циклов и медицинских противопоказаний."
);

fs.writeFileSync('D:/BodyBuildHealth/src/ui/screens/SupportScreen.tsx', c);
const lines = c.split('\n').length;
const balanced = (c.match(/\{/g)||[]).length === (c.match(/\}/g)||[]).length;
console.log('Lines:', lines, 'Balanced:', balanced);
