import React, { useState } from 'react';

const SECTIONS = [
  { id:'formulas', icon:'📐', title:'Формулы расчёта рисков', content:
`Базовый риск (Raw): Σ(механизмы × факторы риска × генетика × стаж) / количество систем.

Чистый риск (Net): Raw × (1 − коэффициент поддержки).
Поддержка = Σ(покрытие системы × эффективность препарата поддержки).

P(событие) = 1 / (1 + e^(-k × (Net − 50))) — логистическая сигмоида вероятности осложнения.
k = 0.08 (коэффициент крутизны).

Агрегированный риск = геометрическое среднее системных рисков с весами источников:
Фарма (40%) + Анализы (25%) + Тренировки (20%) + Питание (15%).

Штраф Data Decay: множитель = 1 + 0.05 × недели_без_анализов.
При >12 недель без анализов: критический штраф ×1.5+.` },

  { id:'mechanisms', icon:'⚙️', title:'Механизмы риска по системам', content:
`❤️ Кардио:
1. Гипертрофия ЛЖ — увеличение массы миокарда, диастолическая дисфункция.
2. Дислипидемия — ЛПНП↑, ЛПВП↓, атерогенный индекс.
3. Эндотелиальная дисфункция — снижение NO, вазоконстрикция.
4. Аритмогенность — удлинение QT, риск фибрилляции.

🫁 Печень:
1. Гепатотоксичность — цитолиз, АЛТ/АСТ↑, холестаз.
2. Стеатоз — жировая инфильтрация, неалкогольная жировая болезнь.
3. Фиброз — активация звёздчатых клеток, коллагеногенез.

🫘 Почки:
1. Нефротоксичность — повреждение канальцев, протеинурия.
2. Гиперфильтрация — повышенная СКФ, гломерулосклероз.

🧠 Нервная:
1. Нейротоксичность — оксидативный стресс, апоптоз нейронов.
2. Нарушение ГЭБ — проницаемость гемато-энцефалического барьера.

⚖️ Эндокринная:
1. Подавление HPG — ЛГ↓, ФСГ↓, тестостерон↓.
2. Инсулинорезистентность — HOMA-IR↑, глюкоза↑.
3. Тиреоидная дисфункция — ТТГ↑/↓, Т3↓.

🩸 Кровь:
1. Полицитемия — гематокрит↑, гемоглобин↑, риск тромбоза.
2. Тромбоцитоз — тромбоциты↑, риск тромбоэмболии.
3. Лейкоцитоз/лейкопения — изменения иммунного ответа.` },

  { id:'systems', icon:'🫀', title:'Системы и органы', content:
`Всего 18 систем органов в модели рисков V7:

1. ❤️ Сердечно-сосудистая — миокард, коронарные артерии
2. 🫀 Сосуды — эндотелий, гладкая мускулатура
3. 🫁 Печень — гепатоциты, желчные протоки
4. 🫘 Почки — клубочки, канальцы
5. 🧠 Нервная — ЦНС, периферическая нервная система
6. ⚖️ Эндокринная — гипофиз, надпочечники, гонады
7. 🩸 Кроветворная — костный мозг, эритроциты
8. 🛡️ Иммунная — лимфоциты, цитокины
9. 🦋 Щитовидная — ТТГ, Т3, Т4
10. 🔴 Простата — ПСА, объём
11. 🧴 Кожа — акне, андрогенная алопеция
12. 💪 Опорно-двигательная — мышцы, сухожилия, связки
13. ⚡ Метаболизм — глюкоза, липиды, инсулин
14. 📈 GH/IGF ось — гормон роста, ИФР-1
15. 🍬 Инсулиновая ось — инсулин, HOMA-IR
16. ⚠️ Нейротоксичность — дофамин, серотонин
17. 🧬 Репродуктивная — ФСГ, ЛГ, тестостерон, эстрадиол
18. Кожа и соединительная ткань` },

  { id:'multipliers', icon:'✖️', title:'Генетические множители', content:
`Генетические полиморфизмы добавляют 2–12% к базовому риску:

COMT (Val158Met): метаболизм катехоламинов. Met/Met → +5% нейротоксичность, −3% кардио.
MTHFR (C677T): метаболизм гомоцистеина. TT → +8% кардио, +5% тромбоз.
ESR1 (PvuII): чувствительность к эстрогенам. PP → +5% репродуктивная.
AGTR1 (A1166C): ангиотензин II рецептор. CC → +7% кардио, +5% сосуды.
NOS3 (G894T): синтез оксида азота. TT → +6% эндотелий, +4% кардио.
SRD5A2 (V89L): конверсия тестостерона в ДГТ. LL → +3% простата.
CYP3A4: метаболизм лекарств. Низкая активность → +8% печень, +5% общий.

Стаж курсов: каждые 12 недель непрерывного курса → +1% ко всем системам.
Кумулятивный стаж: каждые 52 недели → +2% кардио, +3% печень.` },

  { id:'thresholds_info', icon:'💊', title:'Пороги дозировок препаратов', content:
`Максимальные рекомендованные дозировки (превышение экспоненциально увеличивает риски):

Тестостерон: до 300 мг/нед (низкий риск) · 300–600 (средний) · >600 (высокий)
Тренболон: до 200 мг/нед · андрогенность ×1.5
Нандролон: до 400 мг/нед · андрогенность ×0.8
Болденон: до 400 мг/нед · андрогенность ×0.7
Оксандролон: до 50 мг/нед · андрогенность ×0.6
Станозолол: до 30 мг/нед · андрогенность ×1.0
Метандиенон: до 200 мг/нед · андрогенность ×1.1
Оксиметолон: до 150 мг/нед · андрогенность ×1.2
Superdrol: до 30 мг/нед · андрогенность ×1.3
Halotestin: до 20 мг/нед · андрогенность ×1.8

Гормон роста: 2–4 МЕ/день · IGF-1: 40–80 мкг/день
Инсулин: до 10 МЕ/приём (короткий), до 30 МЕ/день (длинный)` },

  { id:'coverages', icon:'🛡️', title:'Фармакологическая поддержка', content:
`Кардио: Омега-3 (2–4 г/день), CoQ10 (100–200 мг), магний (400 мг), NAC (600–1200 мг).
Печень: TUDCA (500–1000 мг), NAC (1200 мг), расторопша (300 мг), липоевая кислота (300 мг).
Почки: Астрагал (500 мг), достаточная гидратация (>3 л/день), контроль АД.
Нервная система: Магний (400 мг), глицин (3 г), мелатонин (1–3 мг), инозитол.
Кровь: Донорство каждые 8–12 недель, аспирин 75–100 мг, грейпфрут (нарингин).
Эндокринная: HCG 250–500 МЕ × 2/нед, кломифен 25–50 мг/день, ингибиторы ароматазы.
Простата: Финастерид 1 мг, дутастерид 0.5 мг, пальма сереноа.
Метаболизм: Берберин 500 мг × 2, метформин 500–1000 мг, хром 200 мкг.
Иммунитет: Витамин D3 2000–5000 МЕ, цинк 30 мг, витамин C 1000 мг.` },

  { id:'v7_info', icon:'🧬', title:'V7 — Монте-Карло моделирование', content:
`V7 Base:
- Детерминированный расчёт по матрице 18 систем × 8 механизмов
- Каждый механизм имеет базовый риск, модифицируемый генетикой и дозировками
- Стаж, тренировки и питание выступают модификаторами

V7 Monte Carlo:
- 50+ симуляций с нормальным распределением параметров (μ=mean, σ=10% mean)
- P5/P95 границы, глобальный P(события) из логистической регрессии
- Organ Summary: meanS, acute, chronic, fibrosis компоненты

Hill-функция: H(x) = x^n / (EC50^n + x^n)
- x — концентрация препарата или уровень биомаркера
- EC50 — половинная эффективная концентрация
- n — коэффициент Хилла (крутизна кривой ответа)

Временной ряд: 84-дневная эволюция рисков с dailyOrganStates
Чувствительность: топ-10 параметров по эластичности
Фармакокинетика: концентрации по дням для каждого препарата` },
];

export const RiskInfo: React.FC<{
  riskResult?: any; v7Result?: any; mdssResult?: any;
  weeklyDynamics?: any; aggregatedRisk?: any;
}> = ({ riskResult, v7Result, mdssResult, weeklyDynamics, aggregatedRisk }) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setExpanded(s => ({ ...s, [id]: !s[id] }));

  return (
    <div>
      {/* ─── REAL CALCULATION RESULTS ─── */}
      <div style={{ padding:'8px 0' }}>
        <span style={{ fontSize:16, fontWeight:700, color:'var(--accent)' }}>📊 Результаты расчётов</span>
      </div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:16 }}>
        {riskResult && (
          <div style={{ flex:'1 1 45%', minWidth:120, padding:'10px 8px', borderRadius:12, textAlign:'center',
            background:'rgba(0,230,138,0.08)', border:'1px solid rgba(0,230,138,0.2)',
          }}>
            <div style={{ fontSize:9, color:'var(--text-dim)' }}>Общий риск (raw)</div>
            <div style={{ fontSize:22, fontWeight:800, color:riskResult.overallRaw >= 60 ? '#ef4444' : riskResult.overallRaw >= 30 ? '#f59e0b' : '#00e68a' }}>
              {Math.round(riskResult.overallRaw)}%
            </div>
          </div>
        )}
        {riskResult && (
          <div style={{ flex:'1 1 45%', minWidth:120, padding:'10px 8px', borderRadius:12, textAlign:'center',
            background:'rgba(0,230,138,0.08)', border:'1px solid rgba(0,230,138,0.2)',
          }}>
            <div style={{ fontSize:9, color:'var(--text-dim)' }}>Чистый риск (net)</div>
            <div style={{ fontSize:22, fontWeight:800, color:riskResult.overallNet >= 60 ? '#ef4444' : riskResult.overallNet >= 30 ? '#f59e0b' : '#00e68a' }}>
              {Math.round(riskResult.overallNet)}%
            </div>
          </div>
        )}
        {v7Result && (
          <>
            <div style={{ flex:'1 1 45%', minWidth:120, padding:'10px 8px', borderRadius:12, textAlign:'center',
              background:'rgba(139,92,246,0.1)', border:'1px solid rgba(139,92,246,0.2)',
            }}>
              <div style={{ fontSize:9, color:'var(--text-dim)' }}>V7 Monte Carlo</div>
              <div style={{ fontSize:22, fontWeight:800, color:'#8b5cf6' }}>{Math.round(v7Result.globalRiskNet)}%</div>
            </div>
            <div style={{ flex:'1 1 45%', minWidth:120, padding:'10px 8px', borderRadius:12, textAlign:'center',
              background:'rgba(249,115,22,0.1)', border:'1px solid rgba(249,115,22,0.2)',
            }}>
              <div style={{ fontSize:9, color:'var(--text-dim)' }}>MDSS</div>
              <div style={{ fontSize:22, fontWeight:800, color:'#f97316' }}>{mdssResult ? `${Math.round(mdssResult.overallMaxRisk)}%` : '—'}</div>
            </div>
          </>
        )}
        {aggregatedRisk && (
          <div style={{ flex:'1 1 100%', padding:'10px 8px', borderRadius:12, textAlign:'center',
            background:'rgba(59,130,246,0.08)', border:'1px solid rgba(59,130,246,0.2)',
          }}>
            <div style={{ fontSize:9, color:'var(--text-dim)' }}>Агрегированный риск (фарма+анализы+тренировки+питание)</div>
            <div style={{ fontSize:20, fontWeight:800, color:'#3b82f6' }}>{Math.round(aggregatedRisk)}%</div>
          </div>
        )}
      </div>

      {riskResult?.systemBreakdown && (
        <div style={{ marginBottom:16, padding:'10px 12px', borderRadius:12,
          background:'var(--glass-bg)', border:'1px solid var(--glass-border)',
        }}>
          <div style={{ fontSize:12, fontWeight:700, marginBottom:8, color:'var(--accent)' }}>По системам</div>
          {Object.entries(riskResult.systemBreakdown).map(([sys, v]: [string, any]) => (
            <div key={sys} style={{ marginBottom:4 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:11 }}>
                <span>{sys}</span>
                <span style={{ fontWeight:600, color:v.net >= 60 ? '#ef4444' : v.net >= 30 ? '#f59e0b' : '#00e68a' }}>{Math.round(v.net)}%</span>
              </div>
              <div style={{ height:4, borderRadius:2, background:'var(--border)', overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${v.net}%`, background:v.net >= 60 ? '#ef4444' : v.net >= 30 ? '#f59e0b' : '#00e68a', borderRadius:2 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {!riskResult && !v7Result && (
        <div style={{ padding:20, textAlign:'center', color:'var(--text-dim)', fontSize:12, marginBottom:16,
          background:'var(--glass-bg)', borderRadius:12, border:'1px solid var(--glass-border)',
        }}>
          Нет данных расчётов. Перейдите в «Комплексные расчёты» для генерации.
        </div>
      )}

      {/* ─── REFERENCE INFO ─── */}
      <div style={{ padding:'8px 0' }}>
        <span style={{ fontSize:16, fontWeight:700 }}>ℹ️ Справочная информация</span>
      </div>
      <div style={{ fontSize:11, color:'var(--text-dim)', marginBottom:12, lineHeight:1.5 }}>
        Полный справочник: формулы расчёта, механизмы риска по системам, пороги дозировок, генетические факторы, фармподдержка и описание моделей V7 Monte Carlo.
      </div>
      {SECTIONS.map(s => (
        <div key={s.id} style={{ padding:0, overflow:'hidden', marginBottom:8, borderRadius:14, background:'var(--glass-bg)', border:'1px solid var(--glass-border)' }}>
          <button onClick={() => toggle(s.id)} style={{
            display:'flex', alignItems:'center', gap:8, width:'100%', padding:'12px 14px', cursor:'pointer', textAlign:'left',
            background:'transparent', border:'none', color:'var(--text)', fontSize:13, fontWeight:700,
          }}>
            <span style={{ fontSize:12, transition:'transform 0.2s', transform: expanded[s.id] ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
            <span style={{ fontSize:18 }}>{s.icon}</span> {s.title}
          </button>
          {expanded[s.id] && (
            <div style={{ padding:'0 14px 14px', fontSize:11, color:'var(--text-dim)', lineHeight:1.8, whiteSpace:'pre-line' }}>
              {s.content}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
