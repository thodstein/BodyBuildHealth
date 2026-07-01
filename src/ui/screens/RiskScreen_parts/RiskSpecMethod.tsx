// Механизм-ориентированная модель риска — UI
// Данные курса → из linked.course (Фарма), анализы → из linked.labs, поддержка → из калькулятора
import React, { useState, useEffect, useMemo } from 'react';
import { calculateTzSpecRisk, DRUG_CLASSES, getCategoryLabel, type TzSpecInput, type TzSpecResult, type TzSpecOrganResult, type TzSpecMechanismResult } from '../../../engines/risk-engine-tz-spec';
import { useDataLink } from '../../../core/data-link';
import { PHARMA_DB } from '../../../core/pharma-database';
const Risk3DModel = React.lazy(() => import('./Risk3DModel').then(m => ({ default: m.Risk3DModel })));

const ACCENT = '#00e68a';
const CARD: React.CSSProperties = { padding: 14, borderRadius: 16, background: 'rgba(24,24,27,0.15)', border: '1px solid rgba(255,255,255,0.04)', marginBottom: 10 };

const catColor = (pct: number) => {
  if (pct < 25) return '#22c55e';
  if (pct < 50) return '#eab308';
  if (pct < 75) return '#f97316';
  return '#ef4444';
};

export const RiskSpecMethod: React.FC = () => {
  const linked = useDataLink();
  const course = linked.course || [];
  const labs = linked.labs || [];

  // ── Извлекаем данные курса (linked.course) ──
  const courseSummary = useMemo(() => {
    if (!course.length) return null;
    const totalDose = course.reduce((s, c) => s + (c.doseValue || 0), 0);
    const totalWeeks = course.reduce((max, c) => Math.max(max, (c.endWeek || 12) - (c.startWeek || 0)), 0);
    // Определяем классы по substanceId (эвристика)
    const ids = course.map(c => (c.substanceId || '').toLowerCase());
    const hasAAS = ids.some(id => !id.includes('gh') && !id.includes('growth') && !id.includes('insulin') && !id.includes('igf') && !id.includes('ghrp') && !id.includes('cjc') && !id.includes('ipa'));
    const hasGH = ids.some(id => id.includes('gh') || id.includes('growth') || id.includes('igf') || id.includes('ghrp') || id.includes('cjc') || id.includes('ipa') || id.includes('tese') || id.includes('soma'));
    const hasInsulin = ids.some(id => id.includes('insulin') || id.includes('novor') || id.includes('aktrap') || id.includes('lantus'));
    const drugClasses: string[] = [];
    if (hasAAS) drugClasses.push('aas');
    if (hasGH) drugClasses.push('gh');
    if (hasInsulin) drugClasses.push('insulin');

    let drugClass: 'aas' | 'gh' | 'insulin' = 'aas';
    if (drugClasses.length === 1) drugClass = drugClasses[0] as any;
    else if (hasAAS) drugClass = 'aas';
    else if (hasGH) drugClass = 'gh';
    else if (hasInsulin) drugClass = 'insulin';

    const avgDose = course.length > 0 ? Math.round(totalDose / course.length) : 500;
    const form: 'inject' | 'oral' = ids.some(id => id.includes('oxand') || id.includes('stan') || id.includes('meth') || id.includes('oxym') || id.includes('turin') || id.includes('superdrol') || id.includes('sarm')) ? 'oral' : 'inject';
    const combos = drugClasses.length;

    return { drugClass, avgDose, totalWeeks: Math.max(1, totalWeeks), form, combos, count: course.length, classes: drugClasses };
  }, [course]);

  // ── Анализы (linked.labs) ──
  const labMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const l of labs) {
      const code = (l.code || l.name || '').toUpperCase();
      if (code && l.value) m[code] = l.value;
    }
    return m;
  }, [labs]);

  const labCount = Object.keys(labMap).length;

  // ── Тоггл «Без анализов» ──
  const [forceNoLabs, setForceNoLabs] = useState(false);
  const [supportIds, setSupportIds] = useState<string[]>([]);

  // Авто-загрузка поддержки из калькулятора
  useEffect(() => {
    try {
      const sr = JSON.parse(localStorage.getItem('he_support_risk') || 'null');
      if (sr && Array.isArray(sr.subs)) setSupportIds(sr.subs.map((id: string) => id.toLowerCase()));
    } catch {}
  }, []);

  // D_cov — покрытие анализами
  const REQUIRED_LAB_CODES = ['LDL','HDL','TG','HCT','ALT','AST','GGT','CREATININE','eGFR','GLU','LH','FSH','TT','E2','K','Na'];
  const presentCount = REQUIRED_LAB_CODES.filter(c => labMap[c] !== undefined).length;
  const rawDcov = labCount > 0 ? presentCount / REQUIRED_LAB_CODES.length : 0.1;
  const dCov = forceNoLabs ? 0.1 : Math.max(0.1, rawDcov);

  const handleCalc = () => {
    if (!courseSummary) return;
    // Строим массив препаратов из linked.course (каждый со своей дозой)
    const drugs = course.length > 0 ? course.map(c => {
      const id = (c.substanceId || '').toLowerCase();
      const isAAS = !id.includes('gh') && !id.includes('growth') && !id.includes('insulin') && !id.includes('igf');
      return {
        drugClass: isAAS ? 'aas' as const : id.includes('insulin') ? 'insulin' as const : 'gh' as const,
        drugName: id || 'unknown',
        dose: c.doseValue || 250,
        form: (id.includes('oxand') || id.includes('stan') || id.includes('meth') ? 'oral' : 'inject') as 'inject' | 'oral',
      };
    }) : undefined;
    const input: TzSpecInput = {
      drugClass: courseSummary.drugClass,
      drugName: 'course',
      dose: courseSummary.avgDose,
      duration: courseSummary.totalWeeks,
      form: courseSummary.form,
      combinations: courseSummary.combos,
      labCoverage: dCov,
      labValues: forceNoLabs ? {} : labMap,
      supportSubstances: supportIds,
      drugs,
    };
    setResult(calculateTzSpecRisk(input));
    setShowResult(true);
  };

  const [showResult, setShowResult] = useState(false);
  const [result, setResult] = useState<TzSpecResult | null>(null);
  const [expandedMech, setExpandedMech] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [show3D, setShow3D] = useState(false);

  return (
    <div>
      {/* ── Заголовок ── */}
      <div style={CARD}>
        <div style={{ fontSize: 15, fontWeight: 800, color: ACCENT, marginBottom: 2 }}>🧬 Механизм-ориентированная модель</div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>
          Интегральный индекс риска · 6 систем · 28 механизмов · Полуколичественная шкала
          <br /><b>R = Σ(w × m × E × U × Π(1−k*))</b>
        </div>
      </div>

      {/* ── Данные курса из Фармы ── */}
      <div style={CARD}>
        <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 8 }}>💉 Курс (из вкладки «Фарма»)</div>
        {courseSummary ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)' }}>Класс</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#8b5cf6' }}>
                {DRUG_CLASSES[courseSummary.drugClass]?.icon} {courseSummary.classes.join(' + ') || '—'}
              </div>
            </div>
            <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)' }}>Препаратов</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{courseSummary.count} шт</div>
            </div>
            <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)' }}>Средняя доза</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#f97316' }}>{courseSummary.avgDose} {DRUG_CLASSES[courseSummary.drugClass]?.doseLabel || ''}</div>
            </div>
            <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)' }}>Длительность</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6' }}>{courseSummary.totalWeeks} нед</div>
            </div>
          </div>
        ) : (
          <div style={{ padding: '12px', borderRadius: 8, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)', fontSize: 10, color: '#f59e0b', textAlign: 'center' }}>
            ⚠ Нет активного курса. Добавьте препараты во вкладке «Фарма» → «Курс».
          </div>
        )}
      </div>

      {/* ── Лаборатория ── */}
      <div style={CARD}>
        <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>🧪 Лаборатория (из «Анализы»)</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <button onClick={() => setForceNoLabs(!forceNoLabs)} style={{
            padding: '6px 14px', borderRadius: 20, fontSize: 10, fontWeight: 700, cursor: 'pointer',
            background: forceNoLabs ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.08)',
            border: forceNoLabs ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(59,130,246,0.2)',
            color: forceNoLabs ? '#f87171' : '#60a5fa',
          }}>
            {forceNoLabs ? '✅ Штраф без анализов' : '🚫 БЕЗ АНАЛИЗОВ'}
          </button>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>
            Маркеров: {labCount} · Покрытие: {Math.round(dCov * 100)}%
          </span>
        </div>
        {forceNoLabs && (
          <div style={{ padding: '6px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.08)', fontSize: 9, color: '#f87171', textAlign: 'center', marginBottom: 4 }}>
            ⚠ Штраф ×{(1 + 0.25 * (1 - dCov)).toFixed(2)}. Введите анализы для точной оценки.
          </div>
        )}
        {!forceNoLabs && labCount > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {Object.entries(labMap).slice(0, 12).map(([code, val]) => (
              <span key={code} style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.1)', fontSize: 8, color: ACCENT }}>
                {code}: {val}
              </span>
            ))}
            {Object.keys(labMap).length > 12 && <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>+{Object.keys(labMap).length - 12}</span>}
          </div>
        )}
        {!forceNoLabs && labCount === 0 && (
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
            Нет данных анализов. Добавьте во вкладке «Анализы» или включите штраф.
          </div>
        )}
      </div>

      {/* ── Поддержка ── */}
      <div style={CARD}>
        <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>💊 Поддержка (из калькулятора)</div>
        <div style={{ fontSize: 10, color: supportIds.length > 0 ? '#4ade80' : 'rgba(255,255,255,0.5)' }}>
          {supportIds.length > 0
            ? `${supportIds.length} веществ: ${supportIds.map(id => id.charAt(0).toUpperCase() + id.slice(1)).join(', ')}`
            : 'Нет активной поддержки. Добавьте в «Поддержка» → «Калькулятор».'}
        </div>
      </div>

      {/* ── Кнопка расчёта ── */}
      <button onClick={handleCalc} disabled={!courseSummary} style={{
        width: '100%', padding: 12, borderRadius: 12, border: 'none', cursor: courseSummary ? 'pointer' : 'not-allowed', marginBottom: 10, opacity: courseSummary ? 1 : 0.4,
        background: `linear-gradient(135deg,${ACCENT},#00c853)`, color: '#000', fontWeight: 800, fontSize: 14,
      }}>🧮 Рассчитать интегральный риск</button>

      {/* ── РЕЗУЛЬТАТЫ ── */}
      {showResult && result && (
        <>
          <div style={{ ...CARD, textAlign: 'center', background: `linear-gradient(135deg, rgba(0,230,138,0.06) 0%, rgba(0,230,138,0.02) 100%)`, border: `1px solid rgba(0,230,138,0.15)` }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>📊 Общий интегральный риск</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 9, color: '#f87171' }}>Без поддержки</div>
                <div style={{ fontSize: 30, fontWeight: 800, color: catColor(result.overallRaw) }}>{result.overallRaw}%</div>
              </div>
              <div style={{ fontSize: 20, color: 'rgba(255,255,255,0.3)' }}>→</div>
              <div>
                <div style={{ fontSize: 9, color: '#4ade80' }}>С поддержкой</div>
                <div style={{ fontSize: 30, fontWeight: 800, color: catColor(result.overallAfter) }}>{result.overallAfter}%</div>
              </div>
            </div>
            <div style={{ marginTop: 6, fontSize: 11, fontWeight: 600, color: catColor(result.overallAfter) }}>
              {result.overallCategory} · K_protect = {result.k_protect_overall}%
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, result.overallAfter)}%`, background: catColor(result.overallAfter), borderRadius: 3 }} />
            </div>
            <div style={{ marginTop: 4, fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>
              D_cov = {result.d_cov.toFixed(1)} · U_i = ×{result.u_i.toFixed(2)} · Поддержка: {result.supportCount}
            </div>
          </div>

          <div style={CARD}>
            <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 8 }}>🫀 Риск по системам</div>
            {result.organs.map((organ: TzSpecOrganResult) => (
              <div key={organ.id} style={{ marginBottom: 6, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, cursor: 'pointer' }}
                  onClick={() => setExpandedMech(expandedMech === organ.id ? null : organ.id)}>
                  <span style={{ fontSize: 11, fontWeight: 600 }}>{organ.icon} {organ.name}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10, color: '#f87171' }}>{organ.rawPercent}%</span>
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>→</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: catColor(organ.afterPercent) }}>{organ.afterPercent}%</span>
                    <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>{expandedMech === organ.id ? '▲' : '▼'}</span>
                  </span>
                </div>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, organ.afterPercent)}%`, background: catColor(organ.afterPercent), borderRadius: 2 }} />
                </div>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>K_protect: {organ.k_protect}%</div>

                {expandedMech === organ.id && (
                  <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>Механизмы:</div>
                    {organ.mechanisms.map((m: TzSpecMechanismResult) => (
                      <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.02)', marginBottom: 2, fontSize: 9 }}>
                        <span style={{ flex: 1, color: 'rgba(255,255,255,0.8)' }}>
                          {m.name} <span style={{ fontSize: 8, color: '#8b5cf6' }}>(w={m.weight}, m={m.m_i})</span>
                        </span>
                        <span style={{ color: m.afterSupport < m.raw ? ACCENT : '#f87171', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {Math.round(m.raw)} → {Math.round(m.afterSupport)}
                          {m.k_used > 0 && <span style={{ fontSize: 8, color: ACCENT, marginLeft: 3 }}>↓{m.k_used}%</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={CARD}>
            <button onClick={() => setShowExplanation(!showExplanation)} style={{
              width: '100%', padding: 8, borderRadius: 8, cursor: 'pointer', textAlign: 'center',
              background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.15)',
              color: ACCENT, fontSize: 11, fontWeight: 600,
            }}>
              {showExplanation ? '▲ Скрыть обоснование' : '▼ Показать обоснование'}
            </button>
            {showExplanation && (
              <div style={{ marginTop: 8, padding: 10, borderRadius: 8, background: 'rgba(0,0,0,0.2)', fontSize: 10, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {result.explanation}
              </div>
            )}
          </div>

          {/* ── Понедельная динамика ── */}
          {course.length > 0 && result && (() => {
            const weeks = Math.max(course.reduce((m, c) => Math.max(m, (c.endWeek || 12)), 0) + 4, 8);
            const weekly: { week: number; risk: number }[] = [];
            for (let w = 0; w <= weeks; w++) {
              let effectiveDose = 0;
              let drugCount = 0;
              for (const c of course) {
                const sw = c.startWeek || 0;
                const ew = c.endWeek || 12;
                const hl = (PHARMA_DB as any)?.[(c.substanceId || '').toLowerCase()]?.pk?.halfLifeHours ?? 168;
                const hlWeeks = hl / 168;
                if (w >= sw && w <= ew) {
                  const weeksOn = w - sw + 1;
                  const accum = 1 - Math.pow(0.5, weeksOn / Math.max(hlWeeks, 0.1));
                  effectiveDose += (c.doseValue || 0) * accum;
                  drugCount++;
                } else if (w > ew) {
                  const weeksOff = w - ew;
                  const lastDose = (c.doseValue || 0) * (1 - Math.pow(0.5, Math.max(1, ew - sw + 1) / Math.max(hlWeeks, 0.1)));
                  effectiveDose += lastDose * Math.pow(0.5, weeksOff / Math.max(hlWeeks, 0.1));
                }
              }
              const weeklyInput: TzSpecInput = {
                drugClass: courseSummary?.drugClass || 'aas', drugName: 'weekly', dose: Math.round(effectiveDose) || 1,
                duration: Math.max(w, 1), form: courseSummary?.form || 'inject',
                combinations: courseSummary?.combos || 1,
                labCoverage: dCov, labValues: forceNoLabs ? {} : labMap, supportSubstances: supportIds,
              };
              const r = calculateTzSpecRisk(weeklyInput);
              weekly.push({ week: w, risk: r.overallAfter });
            }
            const maxRisk = Math.max(...weekly.map(w => w.risk), 10);
            const chartH = 80; const chartW = 280;
            return (
              <div style={CARD}>
                <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>📈 Динамика риска по неделям (накопление/распад)</div>
                <svg viewBox={`0 0 ${chartW} ${chartH}`} style={{ width: '100%', height: chartH, marginBottom: 4 }}>
                  {weekly.map((w, i) => {
                    const x = (i / weekly.length) * chartW;
                    const h = (w.risk / maxRisk) * (chartH - 10);
                    return <rect key={w.week} x={x} y={chartH - 10 - h} width={Math.max(2, chartW / weekly.length - 1)} height={h} fill={catColor(w.risk)} rx={1} opacity={0.85}>
                      <title>Нед {w.week}: {Math.round(w.risk)}%</title>
                    </rect>;
                  })}
                  {[0, 25, 50, 75].map(l => (
                    <line key={l} x1={0} y1={chartH - 10 - (l / 100) * (chartH - 10)} x2={chartW} y2={chartH - 10 - (l / 100) * (chartH - 10)} stroke="rgba(255,255,255,0.08)" strokeWidth={0.5} strokeDasharray="3,3" />
                  ))}
                  <line x1={0} y1={chartH - 10} x2={chartW} y2={chartH - 10} stroke="rgba(255,255,255,0.2)" strokeWidth={0.5} />
                </svg>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, justifyContent: 'center' }}>
                  {weekly.filter((_, i) => i % Math.max(1, Math.floor(weekly.length / 8)) === 0).map(w => (
                    <span key={w.week} style={{ fontSize: 7, color: catColor(w.risk), padding: '1px 3px', borderRadius: 3, background: catColor(w.risk) + '18' }}>
                      {w.week}: {Math.round(w.risk)}%
                    </span>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ── 3D модель ── */}
          <div style={CARD}>
            <button onClick={() => setShow3D(!show3D)} style={{
              width: '100%', padding: 8, borderRadius: 8, cursor: 'pointer', textAlign: 'center',
              background: show3D ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${show3D ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.06)'}`,
              color: show3D ? '#8b5cf6' : 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 600,
            }}>
              {show3D ? '▲ Скрыть 3D модель' : '🧊 Показать 3D модель рисков'}
            </button>
            {show3D && (
              <div style={{ marginTop: 8, minHeight: 300 }}>
                <React.Suspense fallback={<div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>Загрузка 3D модели...</div>}>
                  <Risk3DModel result={null as any} mcEnabled={false} onToggleMC={() => {}} organWeek={0} onWeekChange={() => {}} />
                </React.Suspense>
              </div>
            )}
          </div>

          <div style={{ ...CARD, fontSize: 9, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
            <b style={{ color: ACCENT }}>📐 Методология:</b><br />
            R = Σ(w × m × E × U × Π(1−k*))<br />
            w (1-4) — вес механизма · m (0-3) — выраженность · E = D×T×F×C — экспозиция · U — штраф · k* — скорр. защита<br />
            Категории: 0-24% низкий · 25-49% умеренный · 50-74% высокий · 75-100% очень высокий
          </div>
        </>
      )}
    </div>
  );
};
