import React, { useState } from 'react';
import { RISK_SYSTEMS, ALL_RISK_SYSTEMS, DRUG_THRESHOLDS, GENETIC_MULTIPLIERS, MRR_FACTORS, HGI_FACTORS, RIR_FACTORS, SUPPORT_BASE_COVERAGE, BASE_RISK } from '../../../core/constants';
import { MECHANISM_INFO, SYSTEM_INFO, SYSTEM_ORGANS } from '../../../core/risk-info';
import { SYSTEM_MECHANISMS } from '../../../core/system-mechanisms';

export const RiskInfo: React.FC = () => {
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggle = (id: string) => setExpanded(expanded === id ? null : id);

  return (
    <div className="risk-info">
      {/* Общее описание */}
      <div className="card" style={{ marginBottom: 8 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>📝 Формулы расчёта рисков</h3>
        <p style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5, margin: '0 0 8px' }}>
          Движок Health Engine v9 рассчитывает риски по <strong>14 системам органов</strong> с <strong>7–9 специфичными механизмами</strong> для каждой (105 всего) + <strong>7 общих механизмов</strong> повреждения.
          Результат — значение от 0% (нет риска) до 100% (критический риск).
        </p>
        <div style={{ background: 'rgba(0,230,138,0.08)', padding: 8, borderRadius: 8, fontSize: 10, color: 'var(--text-dim)' }}>
          <strong>Raw</strong> — риск без учёта поддержки (препараты + генетика + питание + тренировки).<br/>
          <strong>Net</strong> — итоговый риск с учётом БАДов, препаратов поддержки и образа жизни.
        </div>
      </div>

      {/* Базовая формула */}
      <div className="card" style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => toggle('base')}>
          <h4 style={{ margin: 0, fontSize: 13 }}>📊 Базовая формула риска</h4>
          <span style={{ fontSize: 12 }}>{expanded === 'base' ? '▸' : '▾'}</span>
        </div>
        {expanded === 'base' && (
          <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.6 }}>
            <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8, fontFamily: 'monospace', fontSize: 11, overflowX: 'auto', whiteSpace: 'pre-wrap', marginBottom: 8 }}>
{`Raw(system, mech) = max(7, min(100,
  (1 - ∏ drugs(1 - baseRisk ? doseRatio ? G ? N ? T ? MRR ? HGI ? RIR)) ? 100
  + pdFactor × 15
))

Net(system, mech) = Raw ? (1 - coverage)

OverallRaw = geom(allSystems) ? overallMRR ? overallHGI ? (2 - overallRIR)
OverallNet  = geom(allSystems) ? overallMRR ? overallHGI ? (2 - overallRIR)`}
            </div>
            <p style={{ margin: '0 0 4px' }}><strong>baseRisk</strong> = {BASE_RISK} — константа базового риска</p>
            <p style={{ margin: '0 0 4px' }}><strong>∏ drugs</strong> — произведение по всем активным препаратам (модель «независимого риска»)</p>
            <p style={{ margin: '0 0 4px' }}><strong>pdFactor</strong> — вклад фармакодинамики препарата в конкретную систему</p>
            <p style={{ margin: '0 0 4px' }}><strong>coverage</strong> — коэффициент защиты (БАДы, препараты поддержки)</p>
            <p style={{ margin: '0 0 4px' }}><strong>geom()</strong> — геометрическое среднее по всем системам/механизмам</p>
          </div>
        )}
      </div>

      {/* Дозо-зависимый расчёт */}
      <div className="card" style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => toggle('dose')}>
          <h4 style={{ margin: 0, fontSize: 13 }}>📈 Дозо-зависимый расчёт</h4>
          <span style={{ fontSize: 12 }}>{expanded === 'dose' ? '▸' : '▾'}</span>
        </div>
        {expanded === 'dose' && (
          <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.6 }}>
            <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8, fontFamily: 'monospace', fontSize: 11, marginBottom: 8 }}>
{`doseRatio = min(2, (dosePerWeek / thresholdDose)^1.2)

if drug has threshold:
  doseRatio = min(2, (dosePerWeek / threshold) ^ 1.2)
if drug has no threshold but has mechWeight:
  doseRatio = min(1.5, dosePerWeek / 300)

mechContribution = max(0, baseRisk ? doseRatio ? G ? N ? T ? MRR ? HGI ? RIR ? (1 + mechWeight ? 3))

if mechContribution > 0.005:
  prod *= (1 - min(0.99, baseRisk ? doseRatio ? G ? N ? T ? MRR ? HGI ? RIR))`}
            </div>
            <p style={{ margin: '0 0 4px' }}><strong>thresholdDose</strong> — пороговая доза из DRUG_THRESHOLDS (мг/нед)</p>
            <p style={{ margin: '0 0 4px' }}><strong>Степень 1.2</strong> — нелинейная зависимость «доза-риск» (суперлинейная)</p>
            <p style={{ margin: '0 0 4px' }}><strong>mechWeight</strong> — вес механизма (0-1) для препарата и механизма повреждения</p>
            <p style={{ margin: '0 0 4px' }}><strong>Множитель (1 + mechWeight × 3)</strong> — усиление для значимых механизмов (макс ?4)</p>
          </div>
        )}
      </div>

      {/* Множители корректировки */}
      <div className="card" style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => toggle('multipliers')}>
          <h4 style={{ margin: 0, fontSize: 13 }}>⚙️ Множители корректировки</h4>
          <span style={{ fontSize: 12 }}>{expanded === 'multipliers' ? '▸' : '▾'}</span>
        </div>
        {expanded === 'multipliers' && (
          <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.6 }}>
            <div style={{ marginBottom: 12 }}>
              <strong style={{ color: 'var(--accent)' }}>G — Генетический множитель</strong>
              <div style={{ background: 'var(--bg-secondary)', padding: 8, borderRadius: 6, marginTop: 4, fontFamily: 'monospace', fontSize: 10 }}>
                G = GENETIC_MULTIPLIERS[system][genotype]<br/>
                COMT: Met/Met=2.0, Val/Met=1.5, Val/Val=1.0<br/>
                MTHFR: TT=1.7, CT=1.3, CC=1.0<br/>
                AGTR1: CC=1.4, AC=1.2, AA=1.0<br/>
                CYP3A4: *22/*22=1.35, *1/*22=1.15, *1/*1=1.0<br/>
                NOS3: TT=1.3, GT=1.15, GG=1.0
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <strong style={{ color: '#eab308' }}>N — Фактор питания</strong>
              <div style={{ background: 'var(--bg-secondary)', padding: 8, borderRadius: 6, marginTop: 4 }}>
                N = clamp(nutritionFactor, 0.5, 1.5)<br/>
                По умолчанию: 0.8 (среднее питание)<br/>
                0.5 = плохое питание, 1.0 = хорошее, 1.5 = идеальное
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <strong style={{ color: '#f97316' }}>T — Фактор тренировок</strong>
              <div style={{ background: 'var(--bg-secondary)', padding: 8, borderRadius: 6, marginTop: 4 }}>
                T = clamp(trainingFactor, 1.0, 1.5)<br/>
                По умолчанию: 0.7 (умеренные тренировки)<br/>
                Увеличивает риск при чрезмерных нагрузках
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <strong style={{ color: '#3b82f6' }}>MRR — Medical Risk Ratio</strong>
              <div style={{ background: 'var(--bg-secondary)', padding: 8, borderRadius: 6, marginTop: 4, fontFamily: 'monospace', fontSize: 10 }}>
                MRR(system) = 1 + deviation ? 2<br/>
                deviation = |value - optimal| / optimal<br/>
                Если значение в норме: MRR = 1.0<br/>
                Если отклонение 50%: MRR = 2.0<br/><br/>
                Нормы по системам:<br/>
                cardio: 0.8–1.2, hepatic: 0.7–1.3, renal: 0.8–1.2<br/>
                neuro: 0.85–1.15, endocrine: 0.75–1.25, reproductive: 0.7–1.3
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <strong style={{ color: '#8b5cf6' }}>HGI — Hemostasis/GI Index</strong>
              <div style={{ background: 'var(--bg-secondary)', padding: 8, borderRadius: 6, marginTop: 4 }}>
                HGI = clamp(average(hgiMarkers), 0.5, 1.5)<br/>
                Веса: CRP=0.30, IL-6=0.25, TNF-α=0.20, Фибриноген=0.15, СОЭ=0.10
              </div>
            </div>

            <div>
              <strong style={{ color: '#22c55e' }}>RIR — Risk Intervention Response</strong>
              <div style={{ background: 'var(--bg-secondary)', padding: 8, borderRadius: 6, marginTop: 4 }}>
                RIR = 0.5 + (interventionResponse ? 0.5)<br/>
                0.5 = нет вмешательств, 1.0 = максимальная эффективность<br/>
                Влияние на итог: Overall × HGI × (2 - RIR)
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Фармакодинамика (PD) */}
      <div className="card" style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => toggle('pd')}>
          <h4 style={{ margin: 0, fontSize: 13 }}>📈 Фармакодинамика (PD)</h4>
          <span style={{ fontSize: 12 }}>{expanded === 'pd' ? '▸' : '▾'}</span>
        </div>
        {expanded === 'pd' && (
          <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.6 }}>
            <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8, fontFamily: 'monospace', fontSize: 11, marginBottom: 8 }}>
{`pdFactor = ? |PD_value| ? weight ? (dose / EC50)`}
            </div>
            <p style={{ margin: '0 0 4px' }}><strong>PD_value</strong> — значение фармакодинамического параметра препарата (от -1 до +4)</p>
            <p style={{ margin: '0 0 4px' }}><strong>weight</strong> — вес связи PD-параметра с системой (0–1)</p>
            <p style={{ margin: '0 0 4px' }}><strong>EC50</strong> — полумаксимальная эффективная концентрация (мг/л)</p>
            <p style={{ margin: '0 0 4px' }}><strong>× 15</strong> — масштабирование PD-вклада в итоговый риск</p>

            <div style={{ marginTop: 8 }}>
              <strong>{'Маппинг PD > Системы:'}</strong>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, marginTop: 4 }}>
                {Object.entries({
                  cardio: 'lipid_impact (0.6)',
                  hepatic: 'hepatotoxicity (1.0)',
                  renal: 'hct_impact (0.15)',
                  neuro: 'neuro_toxicity (1.0)',
                  endocrine: 'aromatization (0.5)',
                  hematologic: 'hct_impact (0.5)',
                  reproductive: 'progestogenic (0.4)',
                  musculoskeletal: 'lipid_impact (0.1)',
                }).map(([sys, pd]) => (
                  <div key={sys} style={{ fontSize: 10, padding: '2px 4px' }}>
                    <span style={{ fontWeight: 600 }}>{SYSTEM_INFO[sys]?.label || sys}</span>: {pd}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 7 механизмов повреждения */}
      <div className="card" style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => toggle('mechs')}>
          <h4 style={{ margin: 0, fontSize: 13 }}>⚠️ 7 общих механизмов повреждения</h4>
          <span style={{ fontSize: 12 }}>{expanded === 'mechs' ? '▸' : '▾'}</span>
        </div>
        {expanded === 'mechs' && (
          <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.5 }}>
            <p style={{ margin: '0 0 6px', color: 'var(--text-dim)' }}>Каждый препарат действует через 1-5 механизмов с разным весом (0-1):</p>
            {Object.entries(MECHANISM_INFO).map(([num, info]) => (
              <div key={num} style={{ background: 'var(--bg-secondary)', padding: '6px 10px', borderRadius: 6, marginBottom: 4 }}>
                <div style={{ fontWeight: 600 }}>{info.id}. {num}. {info.label}</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>{info.description.substring(0, 100)}...</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Защита (coverage) */}
      <div className="card" style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => toggle('coverage')}>
          <h4 style={{ margin: 0, fontSize: 13 }}>🛡️ Защита (Coverage)</h4>
          <span style={{ fontSize: 12 }}>{expanded === 'coverage' ? '▸' : '▾'}</span>
        </div>
        {expanded === 'coverage' && (
          <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.6 }}>
            <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8, fontFamily: 'monospace', fontSize: 11, marginBottom: 8 }}>
{`Net = Raw ? (1 - coverage)

coverage(cell) = ? supportSubstances(cellCov)

Пример: telmisartan покрывает:
  cardio_2 (АГ): 55%
  cardio_3 (Гипертрофия ЛЖ): 45%
  renal_1 (Гипертензия): 50%`}
            </div>
            <p style={{ margin: '0 0 4px' }}>Каждый БАД/препарат поддержки имеет коэффициент покрытия (0-1) для конкретных ячеек «система_механизм».</p>
            <p style={{ margin: '0 0 4px' }}>Сумма всех покрытий вычитается из Raw для получения Net.</p>
            <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              {Object.entries(SUPPORT_BASE_COVERAGE).slice(0, 10).map(([sub, effects]) => (
                <div key={sub} style={{ background: 'var(--bg-secondary)', padding: 4, borderRadius: 4, fontSize: 10 }}>
                  <strong>{sub}</strong>
                  <div style={{ color: 'var(--text-dim)' }}>
                    {Object.entries(effects).slice(0, 2).map(([k, v]) => `${k}: ${Math.round((v as number) * 100)}%`).join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Штраф за отсутствие анализов */}
      <div className="card" style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => toggle('penalty')}>
          <h4 style={{ margin: 0, fontSize: 13 }}>⚠️ Штраф за отсутствие анализов</h4>
          <span style={{ fontSize: 12 }}>{expanded === 'penalty' ? '▸' : '▾'}</span>
        </div>
        {expanded === 'penalty' && (
          <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.6 }}>
            <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8, fontFamily: 'monospace', fontSize: 11, marginBottom: 8 }}>
{`labPenalty = labRatio × 0.40 (или 0.50 при ≥90% пропущено)
diagPenalty = diagRatio × 0.25 (или 0.35 при ≥90% пропущено)
totalMultiplier = 1.0 + labPenalty + diagPenalty (макс 2.0)

Для каждой системы:
  if systemHasPenalty:
    systemNet = min(100, systemNet ? totalMultiplier)
  else:
    systemNet = systemNet (без штрафа)

OverallNet = min(100, overallNet ? totalMultiplier)`}
            </div>
            <p style={{ margin: '0 0 4px' }}><strong>labRatio</strong> — доля отсутствующих анализов из обязательных для текущей фазы</p>
            <p style={{ margin: '0 0 4px' }}><strong>diagRatio</strong> — доля отсутствующих обследований</p>
            <p style={{ margin: '0 0 4px' }}><strong>Кнопка «Без анализов»</strong> — принудительно назначает штрафной коэффициент</p>
          </div>
        )}
      </div>

      {/* Понедельная динамика */}
      <div className="card" style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => toggle('dynamics')}>
          <h4 style={{ margin: 0, fontSize: 13 }}>⚠️ Понедельная динамика (PK)</h4>
          <span style={{ fontSize: 12 }}>{expanded === 'dynamics' ? '▸' : '▾'}</span>
        </div>
        {expanded === 'dynamics' && (
          <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.6 }}>
            <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8, fontFamily: 'monospace', fontSize: 11, marginBottom: 8 }}>
{`k = ln(2) / T½_hours   (константа выведения)

Накопление (во время приёма):
  factor = 1 - e^(-k ? weeks ? 168)
  > достигает ~99% за 5 × T½

Выведение (после отмены):
  peakConc = 1 - e^(-k ? usedWeeks ? 168)
  factor = peakConc ? e^(-k ? weeksSinceEnd ? 168)

Эффективная доза = dosePerWeek × max(factor, 0.05)`}
            </div>
            <p style={{ margin: '0 0 6px' }}>Для каждого препарата рассчитывается фармакокинетический профиль:</p>
            <div style={{ display: 'grid', gap: 4 }}>
              <div style={{ background: 'rgba(234,179,8,0.1)', padding: 6, borderRadius: 6 }}>
                <strong>⚠️ Накопление</strong> — концентрация растёт от 0 до стационарной
              </div>
              <div style={{ background: 'rgba(0,230,138,0.1)', padding: 6, borderRadius: 6 }}>
                <strong>⚠️ Стационар</strong> — концентрация ≈ 85% от максимума
              </div>
              <div style={{ background: 'rgba(59,130,246,0.1)', padding: 6, borderRadius: 6 }}>
                <strong>⚠️ Выведение</strong> — концентрация падает после отмены
              </div>
            </div>
            <p style={{ margin: '8px 0 0', color: 'var(--text-dim)', fontSize: 10 }}>
              Примеры: Тестостерон энантат (T½ 14 дней) {'>'} стационар через ~10 нед, выведение ~10 нед. Тренболон ацетат (T½ 3 дня) {'>'} стационар через ~2 нед, выведение ~2 нед.
            </p>
          </div>
        )}
      </div>

      {/* Агрегация */}
      <div className="card" style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => toggle('agg')}>
          <h4 style={{ margin: 0, fontSize: 13 }}>⚠️ Агрегация рисков</h4>
          <span style={{ fontSize: 12 }}>{expanded === 'agg' ? '▸' : '▾'}</span>
        </div>
        {expanded === 'agg' && (
          <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.6 }}>
            <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8, fontFamily: 'monospace', fontSize: 11, marginBottom: 8 }}>
{`systemRisk = geom(allMechanisms) // Геометрическое среднее по 7-9 специфичным механизмам

overallRisk = geom(allSystems) ? overallMRR ? overallHGI ? (2 - overallRIR)

geom(arr) = exp(avg(ln(arr))) ? 100

Взвешенная агрегация (из всех источников):
  pharma: 35%  labs: 25%
  training: 20%  nutrition: 15%
  diagnostics: 5%

net = ?(sourceRaw ? weight / totalWeight)`}
            </div>
            <p style={{ margin: '0 0 4px' }}><strong>Геометрическое среднее</strong> — чувствительно к высоким значениям: если хоть один механизм даёт 80%, общий не будет ниже ~60%</p>
            <p style={{ margin: '0 0 4px' }}><strong>Множитель (2 - RIR)</strong> — при максимальной защите RIR=1.0, множитель = 1.0 (без изменения). При отсутствии защиты RIR=0.5, множитель = 1.5 (повышение риска)</p>
          </div>
        )}
      </div>

      {/* Пороги препаратов */}
      <div className="card" style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => toggle('thresholds')}>
          <h4 style={{ margin: 0, fontSize: 13 }}>⚠️ Пороговые дозы препаратов</h4>
          <span style={{ fontSize: 12 }}>{expanded === 'thresholds' ? '▸' : '▾'}</span>
        </div>
        {expanded === 'thresholds' && (
          <div style={{ marginTop: 8, fontSize: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
              {Object.entries(DRUG_THRESHOLDS).slice(0, 18).map(([id, t]) => (
                <div key={id} style={{ background: 'var(--bg-secondary)', padding: '4px 8px', borderRadius: 4 }}>
                  <div style={{ fontWeight: 500, fontSize: 11 }}>{id.replace(/_/g, ' ')}</div>
                  <div style={{ color: 'var(--text-dim)' }}>{t.dosePerWeek} мг/нед</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 14 систем */}
      <div className="card" style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => toggle('systems')}>
          <h4 style={{ margin: 0, fontSize: 13 }}>🫀 14 систем органов</h4>
          <span style={{ fontSize: 12 }}>{expanded === 'systems' ? '▸' : '▾'}</span>
        </div>
        {expanded === 'systems' && (
          <div style={{ marginTop: 8, fontSize: 11 }}>
            {ALL_RISK_SYSTEMS.map(sys => {
              const info = SYSTEM_INFO[sys];
              return (
                <div key={sys} style={{ background: 'var(--bg-secondary)', padding: '6px 10px', borderRadius: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 14 }}>{info?.icon || '⚠️'}</span>
                  <span style={{ fontWeight: 600, marginLeft: 6 }}>{info?.label || sys}</span>
                  {info?.keyMarkers && <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>Ключевые маркеры: {info.keyMarkers.join(', ')}</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>

            {/* Специфичные механизмы по системам */}
      <div className="card" style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => toggle('sysmechs')}>
          <h4 style={{ margin: 0, fontSize: 13 }}>🔬 Специфичные механизмы по системам</h4>
          <span style={{ fontSize: 12 }}>{expanded === 'sysmechs' ? '▸' : '▾'}</span>
        </div>
        {expanded === 'sysmechs' && (
          <div style={{ marginTop: 8, fontSize: 11 }}>
            <p style={{ margin: '0 0 8px', color: 'var(--text-dim)' }}>Каждая система органов имеет 7–8 специфичных механизмов повреждения, которые рассчитываются независимо и затем агрегируются.</p>
            <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8, fontFamily: 'monospace', fontSize: 10, marginBottom: 8, overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
{`specificRisk(sys, mech) = max(0, baseRisk ? doseRatio ? G ? N ? T ? (1 + mechWeight ? 3))

systemRisk(sys) = geom(allSpecificMechs(sys))

overallRisk = geom(allSystems) ? overallMRR ? overallHGI ? (2 - overallRIR)`}
            </div>
            <p style={{ margin: '0 0 6px', color: 'var(--text-dim)', fontSize: 10 }}>Механизмы привязаны к препаратам и маркерам анализов:</p>
            {ALL_RISK_SYSTEMS.map(sys => {
              const info = SYSTEM_INFO[sys];
              const mechs = SYSTEM_MECHANISMS[sys] || [];
              if (mechs.length === 0) return null;
              return (
                <div key={sys} style={{ background: 'var(--bg-secondary)', padding: '6px 10px', borderRadius: 6, marginBottom: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600 }}>{info?.icon || '?'} {info?.label || sys}</span>
                    <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>{mechs.length} мех.</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginTop: 3 }}>
                    {mechs.map(m => (
                      <span key={m.id} style={{ background: 'rgba(0,230,138,0.08)', padding: '1px 5px', borderRadius: 3, fontSize: 9 }}>
                        {m.num}. {m.label}
                      </span>
                    ))}
                  </div>
                  {SYSTEM_ORGANS[sys] && (
                    <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>
                      Органы: {SYSTEM_ORGANS[sys].slice(0, 3).join(', ')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

{/* Disclaimer */}
      <div style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'center', marginTop: 8, fontStyle: 'italic', lineHeight: 1.4 }}>
        Данные расчёты носят информационный характер и не заменяют консультацию врача.<br/>
        Модель Health Engine v9 — математическая аппроксимация на основе опубликованных данных.
      </div>
    </div>
  );
};
