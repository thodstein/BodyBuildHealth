import React from 'react';
import type { SupportRecommendation } from '../../../engines/tz-mapper-engine';
import type { PlanResult } from '../../../engines/support-plan';

/** Инъекционные ААС (для справки по ротации мест) */
const INJECTABLE_AAS: string[] = [
  'test_enan', 'test_cyp', 'test_prop', 'test_susp', 'test_undecoan', 'sustanon', 'omnadren',
  'nandrolone_dec', 'nandrolone_pp', 'npp', 'deca', 'tren_acet', 'tren_enan', 'tren_hex',
  'boldenone', 'equipoise', 'masteron', 'primobolan', 'primo', 'masteron_enan',
];

const sevColor = (s: string) => (s === 'absolute' ? '#ef4444' : s === 'relative' ? '#f59e0b' : '#60a5fa');
const tierColor = (t: number) => (t >= 3 ? '#ef4444' : t === 2 ? '#f59e0b' : '#fbbf24');
const guardColor = (l: string) => (l === 'high' ? '#ef4444' : l === 'medium' ? '#f59e0b' : '#4ade80');
const labSevColor = (s: string) => (s === 'critical' ? '#ef4444' : s === 'high' ? '#f59e0b' : s === 'medium' ? '#fbbf24' : s === 'low' ? '#60a5fa' : '#94a3b8');
const labSevLabel = (s: string) => (s === 'critical' ? 'КРИТ' : s === 'high' ? 'ВЫСОК' : s === 'medium' ? 'СРЕД' : s === 'low' ? 'НИЗК' : 'ИНФО');

const ORGAN_META: Record<string, { label: string; icon: string }> = {
  cardio: { label: 'Сердечно-сосудистая', icon: '🫀' },
  hepatic: { label: 'Печень', icon: '🩸' },
  renal: { label: 'Почки', icon: '🫘' },
  neuro: { label: 'Нервная', icon: '🧠' },
  reproductive: { label: 'Репродуктивная', icon: '🧬' },
  hematologic: { label: 'Кровь', icon: '🩸' },
  metabolic: { label: 'Метаболизм', icon: '⚡' },
  hormonal: { label: 'Гормональная', icon: '🧪' },
};
const ORGAN_ORDER = ['cardio', 'hepatic', 'renal', 'neuro', 'reproductive', 'hematologic', 'metabolic', 'hormonal', 'other'];

export const CalcSafetyLayer: React.FC<{ rec: SupportRecommendation; planResult?: PlanResult }> = ({ rec, planResult }) => {
  const subs = rec.subs || [];
  const alerts = rec.alerts || [];
  const guardrails = rec.guardrails || [];
  const contra = rec.contraindications || [];
  const gaps = rec.gaps || [];
  const labFindings = planResult?.labFindings || [];
  const depletionWarnings = planResult?.depletionWarnings || [];
  const cumulativeLoad = planResult?.cumulativeLoad || [];
  const pillBurden = planResult?.pillBurden;
  const protocolWarnings = rec.protocolWarnings || [];
  const procedures = rec.procedures || [];
  const assayWarnings = rec.assayWarnings || [];
  const planConflicts = (planResult?.conflicts && planResult.conflicts.length > 0)
    ? planResult.conflicts
    : (rec.conflicts || []).map((c: any) => ({
        a: c.a, b: c.b, aName: c.a, bName: c.b,
        effect: c.reason, severity: c.level === 'block' ? 'HIGH' : 'MEDIUM',
      }));
  const safetyConflictRows = planConflicts.filter((c: any) => c.severity && c.severity !== 'LOW');

  const hasInjectable = subs.some(s => INJECTABLE_AAS.some(id => (s.substanceId || '').toLowerCase().includes(id)));
  const hasPctDrug = subs.some(s => ['hcg', 'tamoxifen', 'clomiphene', 'enclomiphene', 'nolvadex'].includes((s.substanceId || '').toLowerCase()));
  const isPct = rec.phase === 'pct';

  if (alerts.length === 0 && guardrails.length === 0 && contra.length === 0 && gaps.length === 0 && protocolWarnings.length === 0 && safetyConflictRows.length === 0 && procedures.length === 0 && assayWarnings.length === 0 && !hasInjectable && !hasPctDrug && !isPct && labFindings.length === 0 && depletionWarnings.length === 0 && cumulativeLoad.length === 0 && !pillBurden) {
    return null;
  }

  return (
    <div style={{ marginTop: 8 }}>
      {/* ── ПРОАКТИВНОЕ УПРАВЛЕНИЕ (guardrails) ── */}
      {guardrails.length > 0 && (
        <div style={{ marginBottom: 7 }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: '#f87171', marginBottom: 3 }}>🛡️ Проактивное управление рисками</div>
          {guardrails.map((g: any, i: number) => (
            <div key={i} style={{ padding: '5px 7px', borderRadius: 6, marginBottom: 3, background: `${guardColor(g.level)}0c`, border: `1px solid ${guardColor(g.level)}30` }}>
              <div style={{ fontSize: 7, fontWeight: 700, color: guardColor(g.level), marginBottom: 1 }}>
                {g.level === 'high' ? '🔴 КРИТИЧНО' : g.level === 'medium' ? '🟠 ВНИМАНИЕ' : '🟢 КОНТРОЛЬ'}
                {g.substanceId ? ` · ${g.substanceId}` : ''}
              </div>
              <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>{g.reason}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── ТИЕР-АЛЕРТЫ (лаб-драйвенные) ── */}
      {alerts.length > 0 && (
        <div style={{ marginBottom: 7 }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: '#fbbf24', marginBottom: 3 }}>🟠 Лабораторные тревоги (по вашим анализам)</div>
          {alerts.map((a: any, i: number) => (
            <div key={i} style={{ padding: '5px 7px', borderRadius: 6, marginBottom: 3, background: `${tierColor(a.tier)}0c`, border: `1px solid ${tierColor(a.tier)}30` }}>
              <div style={{ fontSize: 7, fontWeight: 700, color: tierColor(a.tier), marginBottom: 1 }}>
                {a.marker} = {a.value} {a.tier >= 3 ? '· ⛔ СТОП КУРС' : a.tier === 2 ? '· лечение' : '· граница'}
              </div>
              <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>{a.message}</div>
            </div>
          ))}
        </div>
      )}

      {protocolWarnings.length > 0 && (
        <div style={{ marginBottom: 7 }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: '#fbbf24', marginBottom: 3 }}>⚠️ Фармакологические ограничения</div>
          {protocolWarnings.map((warning, i) => (
            <div key={i} style={{ padding: '5px 7px', borderRadius: 6, marginBottom: 3, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.24)', color: '#fff', fontSize: 7, lineHeight: 1.45, overflowWrap: 'anywhere' }}>
              {warning}
            </div>
          ))}
        </div>
      )}

      {safetyConflictRows.length > 0 && (
        <div style={{ marginBottom: 7 }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: '#f87171', marginBottom: 3 }}>⚠️ Взаимодействия текущего плана</div>
          {safetyConflictRows.slice(0, 12).map((c: any, i: number) => (
            <div key={`${c.a}-${c.b}-${i}`} style={{ padding: '5px 7px', borderRadius: 6, marginBottom: 3, background: c.severity === 'HIGH' ? 'rgba(239,68,68,0.10)' : 'rgba(245,158,11,0.08)', border: `1px solid ${c.severity === 'HIGH' ? 'rgba(239,68,68,0.28)' : 'rgba(245,158,11,0.24)'}`, color: '#fff', fontSize: 7, lineHeight: 1.45, overflowWrap: 'anywhere' }}>
              <b>{c.aName || c.a} + {c.bName || c.b}</b>: {c.effect || c.mechanism || 'требует проверки'}
              {c.separationAdvice && <div style={{ color: '#fbbf24', marginTop: 2 }}>{c.separationAdvice}</div>}
            </div>
          ))}
        </div>
      )}

      {procedures.length > 0 && (
        <div style={{ marginBottom: 7 }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: '#f87171', marginBottom: 3 }}>🩸 Медицинская эскалация</div>
          {procedures.map((p, i) => (
            <div key={`${p.id}-${i}`} style={{ padding: '6px 8px', borderRadius: 7, marginBottom: 3, background: 'rgba(239,68,68,0.09)', border: '1px solid rgba(239,68,68,0.26)', color: '#fff', fontSize: 7, lineHeight: 1.45, overflowWrap: 'anywhere' }}>
              <div style={{ fontSize: 8, fontWeight: 800, color: '#fca5a5' }}>🩺 {p.label} · только врач</div>
              <div>{p.reason}</div>
              <div style={{ color: '#fbbf24', marginTop: 2 }}>Триггер: {p.trigger}</div>
              <div style={{ color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>Контроль: {p.monitoring.join(', ')}</div>
            </div>
          ))}
        </div>
      )}

      {assayWarnings.length > 0 && (
        <div style={{ marginBottom: 7 }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: '#60a5fa', marginBottom: 3 }}>🧪 Интерпретация анализов</div>
          {assayWarnings.map((warning, i) => (
            <div key={i} style={{ padding: '5px 7px', borderRadius: 6, marginBottom: 3, background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.22)', color: '#fff', fontSize: 7, lineHeight: 1.45, overflowWrap: 'anywhere' }}>
              {warning}
            </div>
          ))}
        </div>
      )}

      {/* ── ПРОТИВОПОКАЗАНИЯ (жёсткий блок) ── */}
      {contra.length > 0 && (
        <div style={{ marginBottom: 7 }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: '#ef4444', marginBottom: 3 }}>🔴 Противопоказания (проверено по вашим данным)</div>
          {contra.map((c: any, i: number) => (
            <div key={i} style={{ padding: '5px 7px', borderRadius: 6, marginBottom: 3, background: c.severity === 'absolute' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.08)', border: `1px solid ${sevColor(c.severity)}40` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 1 }}>
                <span style={{ fontSize: 6, fontWeight: 800, color: sevColor(c.severity), padding: '1px 5px', borderRadius: 4, background: `${sevColor(c.severity)}18` }}>
                  {c.severity === 'absolute' ? 'АБСОЛЮТ' : 'ОТНОСИТ'}
                </span>
                <span style={{ fontSize: 7, fontWeight: 700, color: '#fff' }}>{c.substanceId}</span>
              </div>
              <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>{c.message}</div>
              {c.action && <div style={{ fontSize: 6, color: sevColor(c.severity), marginTop: 1, fontWeight: 600 }}>→ {c.action}</div>}
            </div>
          ))}
        </div>
      )}

      {/* ── НЕПОКРЫТЫЕ МЕХАНИЗМЫ (gaps) ── */}
      {gaps.length > 0 && (
        <div style={{ marginBottom: 7 }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: '#a78bfa', marginBottom: 3 }}>⚠️ Не закрытые механизмы риска</div>
          {gaps.map((g: any, i: number) => (
            <div key={i} style={{ padding: '5px 7px', borderRadius: 6, marginBottom: 3, background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.18)' }}>
              <div style={{ fontSize: 7, fontWeight: 700, color: '#c4b5fd', marginBottom: 1 }}>{g.organLabel} · {g.mechLabel}</div>
              {g.suggestions && g.suggestions.length > 0 && (
                <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
                  {g.suggestions.map((s: string, si: number) => <div key={si}>→ {s}</div>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── ЛАБОРАТОРНЫЕ НАХОДКИ (структурировано по органам) ── */}
      {labFindings.length > 0 && (() => {
        const groups: Record<string, any[]> = {};
        for (const f of labFindings) {
          const key = ORGAN_ORDER.includes(f.system) ? f.system : 'other';
          (groups[key] ||= []).push(f);
        }
        const cnt = (sev: string) => labFindings.filter((f: any) => f.severity === sev).length;
        return (
          <div style={{ marginBottom: 7 }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: '#f472b6', marginBottom: 3 }}>🔬 Лабораторные находки (персональный мониторинг)</div>
            <div style={{ fontSize: 6.5, color: 'rgba(255,255,255,0.7)', marginBottom: 4, padding: '3px 7px', borderRadius: 6, background: 'rgba(244,114,182,0.06)', border: '1px solid rgba(244,114,182,0.16)' }}>
              📊 Итого: <b style={{ color: '#ef4444' }}>{cnt('critical')}</b> критичных · <b style={{ color: '#f59e0b' }}>{cnt('high')}</b> высоких · <b style={{ color: '#fbbf24' }}>{cnt('medium')}</b> средних · всего {labFindings.length}
            </div>
            {ORGAN_ORDER.filter((k: string) => groups[k] && groups[k].length > 0).map((k: string) => (
              <div key={k} style={{ marginBottom: 4 }}>
                <div style={{ fontSize: 7, fontWeight: 800, color: 'rgba(255,255,255,0.82)', marginBottom: 2 }}>
                  {ORGAN_META[k]?.icon || '🧩'} {ORGAN_META[k]?.label || 'Прочее'} <span style={{ opacity: 0.5, fontWeight: 600, fontSize: 6 }}>({groups[k].length})</span>
                </div>
                {groups[k].map((f: any, i: number) => (
                  <div key={i} style={{ padding: '5px 7px', borderRadius: 6, marginBottom: 3, background: `${labSevColor(f.severity)}0c`, border: `1px solid ${labSevColor(f.severity)}40` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 1 }}>
                      <span style={{ fontSize: 6, fontWeight: 800, color: labSevColor(f.severity), padding: '1px 5px', borderRadius: 4, background: `${labSevColor(f.severity)}1f` }}>{labSevLabel(f.severity)}</span>
                      <span style={{ fontSize: 7, fontWeight: 700, color: '#fff' }}>{f.title}</span>
                    </div>
                    {f.substances && f.substances.length > 0 && (
                      <div style={{ marginLeft: 2, marginTop: 1 }}>
                        {f.substances.map((s: any, si: number) => (
                          <div key={si} style={{ fontSize: 6, color: 'rgba(255,255,255,0.72)', lineHeight: 1.5 }}>
                            • {s.name}{s.dose ? ` ${s.dose}` : ''}{s.reasoning ? ` — ${s.reasoning}` : ''} <span style={{ opacity: 0.45 }}>[{s.tier}]</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {f.monitoring && <div style={{ fontSize: 6, color: '#38bdf8', marginTop: 1, fontWeight: 600 }}>🔬 {f.monitoring}</div>}
                    {f.escalation && <div style={{ fontSize: 6, color: '#f59e0b', marginTop: 1, fontWeight: 600 }}>⚠ {f.escalation}</div>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        );
      })()}

      {/* ── КАСКАД ВЫМЫВАНИЯ НУТРИЕНТОВ ── */}
      {depletionWarnings.length > 0 && (
        <div style={{ marginBottom: 7 }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: '#fb923c', marginBottom: 3 }}>💊 Вымывание нутриентов (drug-induced depletion)</div>
          {depletionWarnings.map((d: any, i: number) => (
            <div key={i} style={{ padding: '5px 7px', borderRadius: 6, marginBottom: 3, background: 'rgba(251,146,60,0.06)', border: '1px solid rgba(251,146,60,0.18)' }}>
              <div style={{ fontSize: 7, fontWeight: 700, color: '#fdba74', marginBottom: 1 }}>{d.depleterName} → {d.depletedName} <span style={{ opacity: 0.6 }}>({d.severity})</span></div>
              <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>{d.mechanism}</div>
              {d.recommendation && <div style={{ fontSize: 6, color: '#fb923c', marginTop: 1, fontWeight: 600 }}>→ {d.recommendation}</div>}
            </div>
          ))}
        </div>
      )}

      {/* ── СУММАРНАЯ НАГРУЗКА / UL ── */}
      {cumulativeLoad.length > 0 && (
        <div style={{ marginBottom: 7 }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: '#a78bfa', marginBottom: 3 }}>📊 Суммарная нагрузка / UL</div>
          {cumulativeLoad.filter((c: any) => c.isOverUL).map((c: any, i: number) => (
            <div key={i} style={{ padding: '5px 7px', borderRadius: 6, marginBottom: 3, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <div style={{ fontSize: 7, fontWeight: 700, color: '#f87171', marginBottom: 1 }}>{c.nutrientName} = {c.totalMg} мг/сут <span style={{ opacity: 0.6 }}>(UL: {c.ulMg} мг, {c.percentUL}%)</span></div>
              <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>Источники: {c.contributors.join(', ')}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── ТАБЛЕТОЧНАЯ НАГРУЗКА ── */}
      {pillBurden && (
        <div style={{ marginBottom: 7, padding: '7px 9px', borderRadius: 8, background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.15)' }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: '#60a5fa', marginBottom: 3 }}>💊 Таблеточная нагрузка</div>
          <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.65)', lineHeight: 1.7 }}>
            <div>Всего веществ: <b>{pillBurden.totalSubstances}</b> · Таблеток/день: <b>{pillBurden.estimatedPillsPerDay}</b></div>
            <div>Утро: {pillBurden.morningPills} · День: {pillBurden.afternoonPills} · Вечер: {pillBurden.eveningPills}</div>
            <div style={{ marginTop: 2, color: pillBurden.feasibility === 'high' ? '#4ade80' : pillBurden.feasibility === 'medium' ? '#fbbf24' : '#f87171', fontWeight: 600 }}>{pillBurden.message}</div>
          </div>
        </div>
      )}

      {/* ── ЕСКАЛАЦИЯ МОНИТОРИНГА ПО РИСКУ КУРСА (pedFlags) ── */}
      {rec.pedFlags && (
        <div style={{ marginBottom: 7 }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: '#f87171', marginBottom: 3 }}>📈 Эскалация мониторинга по риску курса</div>
          {rec.pedFlags.hasOral17 && (
            <div style={{ padding: '5px 7px', borderRadius: 6, marginBottom: 3, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <div style={{ fontSize: 7, fontWeight: 700, color: '#f59e0b', marginBottom: 1 }}>Пероральные 17α-алкилированные — гепатотоксичность</div>
              <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>УЗИ печени каждые 2 нед (АЛТ/АСТ/ГГТ/билирубин) + фиброскан каждые 6 мес. Не превышать 6–8 нед перорального блока.</div>
            </div>
          )}
          {rec.pedFlags.isMultiOral && (
            <div style={{ padding: '5px 7px', borderRadius: 6, marginBottom: 3, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <div style={{ fontSize: 7, fontWeight: 700, color: '#ef4444', marginBottom: 1 }}>MULTI-ORAL — несколько пероральных 17α</div>
              <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>Аддитивный гепатотокс. Обязательно: NAC 1200–2400 мг/сут + TUDCA + силимарин. Контроль печени каждые 2 нед. Риск холестаза/фиброза ВЫСОКИЙ.</div>
            </div>
          )}
          {rec.pedFlags.hasTren && (
            <div style={{ padding: '5px 7px', borderRadius: 6, marginBottom: 3, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <div style={{ fontSize: 7, fontWeight: 700, color: '#ef4444', marginBottom: 1 }}>Тренболон — нейро/ССС нагрузка</div>
              <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>ЭКГ + тропонин I при боли. Каберголин (пролактин), небиволол (ЧСС/NO), АЛК+куркумин (нейропротекция). Сон и либидо — ежедневно в дневнике.</div>
            </div>
          )}
          {rec.pedFlags.isGHPlusInsulin && (
            <div style={{ padding: '5px 7px', borderRadius: 6, marginBottom: 3, background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)' }}>
              <div style={{ fontSize: 7, fontWeight: 700, color: '#a855f7', marginBottom: 1 }}>GH + Инсулин — риск гипогликемии</div>
              <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>Глюкоза натощак каждые 3–4 дня. Берберин 1000–2000 + метформин + хром. Никогда не колоть инсулин без глюкозы под рукой.</div>
            </div>
          )}
          {rec.pedFlags.isWinnyPlusOxy && (
            <div style={{ padding: '5px 7px', borderRadius: 6, marginBottom: 3, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)' }}>
              <div style={{ fontSize: 7, fontWeight: 700, color: '#ef4444', marginBottom: 1 }}>ВИНСТРОЛ + ОКСИМЕТОЛОН — СТОП-комбо</div>
              <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>Экстремальный суставной/сухожильный риск + гепатотокс. Не комбинировать. Если уже взято — УЗИ суставов + эластичные стропы, NAC/TUDCA двойная доза.</div>
            </div>
          )}
          {rec.pedFlags.hasNandrolone && (
            <div style={{ padding: '5px 7px', borderRadius: 6, marginBottom: 3, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}>
              <div style={{ fontSize: 7, fontWeight: 700, color: '#22c55e', marginBottom: 1 }}>Нандролон — пролактин и соединительная ткань</div>
              <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>Пролактин каждые 4 нед (цель &lt;15 нг/мл). Гесперидин/диосмин (венотоники). Эластичные стропы для суставов.</div>
            </div>
          )}
          {rec.pedFlags.hasGH && !rec.pedFlags.isGHPlusInsulin && (
            <div style={{ padding: '5px 7px', borderRadius: 6, marginBottom: 3, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
              <div style={{ fontSize: 7, fontWeight: 700, color: '#60a5fa', marginBottom: 1 }}>Гормон роста — метаболический мониторинг</div>
              <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>HbA1c каждые 8 нед (цель &lt;5.7%). Берберин/таурин профилактически. Глюкоза натощак при дозе &gt;4 МЕ.</div>
            </div>
          )}
        </div>
      )}

      {/* ── PCT: ТАЙМИНГ И ТЕЙПЕР ── */}
      {(isPct || hasPctDrug) && (
        <div style={{ marginBottom: 7, padding: '7px 9px', borderRadius: 8, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: '#4ade80', marginBottom: 3 }}>💪 ПКТ: тайминг и тейпер</div>
          <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.65)', lineHeight: 1.7 }}>
            <div>⏱ <b>Старт ПКТ</b> — через 2× T½ последней инъекции эфира (энантат ≈ 2 нед, ципионат ≈ 2 нед, пропионат ≈ 3 дня, деканоат ≈ 3 нед).</div>
            <div>💉 <b>hCG «мост»</b> — 500 МЕ 2×/нед за 2–3 нед до ПКТ, затем отмена (не совмещать с SERM-тейпером напрямую).</div>
            <div>💊 <b>SERM-тейпер</b> — кломифен 50→25 мг/сут или тамоксифен 20→10 мг/сут, 4–6 нед спуском дозы.</div>
            <div>🔄 <b>Эстрадиол-рибаунд</b> — держать AI минимально; при гинекомастии → каберголин/тамоксифен, не AI.</div>
            <div>🩸 <b>Контроль</b> — ЛГ/ФСГ/Тестостерон через 2 и 4 нед ПКТ; цель ЛГ &gt;1.0, Т &gt; норма через 6–8 нед.</div>
          </div>
        </div>
      )}

      {/* ── ИНЪЕКЦИИ: РОТАЦИЯ И ТЕХНИКА ── */}
      {hasInjectable && (
        <div style={{ marginBottom: 4, padding: '7px 9px', borderRadius: 8, background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.2)' }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: '#38bdf8', marginBottom: 3 }}>💉 Инъекции: ротация и техника</div>
          <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.65)', lineHeight: 1.7 }}>
            <div>🔄 <b>Ротация мест</b> — ягодицы (верх-наруж. квадрант) / дельта / квадрицепс; менять каждый укол, не колоть в одну точку &lt;1 раза в 7 дней.</div>
            <div>📏 <b>Объём на сайт</b> — ≤2–3 мл на одну точку (ягодица до 3 мл, дельта ≤1.5 мл).</div>
            <div>🌡 <b>Подогрев</b> — масляный р-р до комнатной Т перед уколом (болезненность ↓).</div>
            <div>🧼 <b>Асептика</b> — спирт+хлоргексидин; игла 21G забор / 23–25G ввод; не трогать наконечник.</div>
            <div>⚠ <b>Абсцесс</b> — краснота/боль/темп &gt;38.5°C в месте укола → врачу.</div>
          </div>
        </div>
      )}
    </div>
  );
};
