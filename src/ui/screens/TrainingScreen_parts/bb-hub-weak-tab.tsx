/**
 * bb-hub-weak-tab.tsx — таб «Слабые» (волна 3 плана хабов: декомпозиция).
 *
 * Перенос разметки 1:1 из `BBDiagnosticsHub.tsx`: зоны роста (1–2), причины из
 * движка слабости, топ-3 упражнений и коррекции с ⭐-выбором (идёт первой в
 * инъекцию/экспорт/блок). Расчёты остаются в хабе — здесь только рендер.
 *
 * Про контракт пропсов: это ЧИСТО презентационная секция, значения приходят из
 * мемо-узлов хаба (report/weakCauses/correctiveTopByZone/…), поэтому вычисленные
 * величины описаны как `any` — их форму задаёт движок, а не эта разметка.
 * Жёстко типизированы только state/setState: их форма — контракт хаба.
 */
import React from 'react';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import { ACCENT } from './training-ui';
import type { BBState } from './BBDiagnosticsHub';

export interface BbWeakTabProps {
  state: BBState;
  setState: React.Dispatch<React.SetStateAction<BBState>>;
  toggleWeak: (id: string) => void;
  bbPlan: any;
  canonicalMuscle: any;
  chipStyle: any;
  corrBlockLines: any;
  corrDoseFlags: any;
  corrInPlanDropped: any;
  correctiveDose: any;
  correctiveLoadFactor: any;
  correctiveTopByZone: any;
  correctiveWeightHint: any;
  diarySessions: any;
  e1rmTrend: any;
  handleAnnualApply: any;
  handleInjectToPlan: any;
  handleRestoreSnapshot: any;
  handleRollbackInject: any;
  handleSpecIcs: any;
  hasInjectPrev: any;
  headCoverage: any;
  lastWeakHeads: any;
  lrDirection: any;
  lrVerdicts: any;
  mmcAdvice: any;
  planHistory: any;
  profileWorkMax: any;
  readiness: any;
  redFlags: any;
  report: any;
  returnActive: any;
  returnCriteria: any;
  returnToPlan: any;
  top3ByZone: any;
  weakCauses: any;
  weakRu: any;
  GRANULAR_OPTS: any;
  MUSCLE_LABEL_RU: any;
  LR_PHASE_ASYM_NOTE: any;
}

export const BbWeakTab: React.FC<BbWeakTabProps> = (props) => {
  const {
    state, setState, toggleWeak, bbPlan, canonicalMuscle, chipStyle, corrBlockLines, corrDoseFlags, corrInPlanDropped, correctiveDose, correctiveLoadFactor, correctiveTopByZone, correctiveWeightHint, diarySessions, e1rmTrend, handleAnnualApply, handleInjectToPlan, handleRestoreSnapshot, handleRollbackInject, handleSpecIcs, hasInjectPrev, headCoverage, lastWeakHeads, lrDirection, lrVerdicts, mmcAdvice, planHistory, profileWorkMax, readiness, redFlags, report, returnActive, returnCriteria, returnToPlan, top3ByZone, weakCauses, weakRu, GRANULAR_OPTS, MUSCLE_LABEL_RU, LR_PHASE_ASYM_NOTE,
  } = props;
  return (
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Отстающие — зоны роста (1–2)</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {GRANULAR_OPTS.map((o: any) => (
                <button key={o.id} onClick={() => toggleWeak(o.id)} aria-pressed={state.weakManual.includes(o.id)} data-bb="weak-zone" data-active={state.weakManual.includes(o.id) ? '1' : '0'} style={{ minHeight: 44, padding: '8px 12px', borderRadius: 999, border: '1px solid', borderColor: state.weakManual.includes(o.id) ? '#00e68a' : 'rgba(255,255,255,0.12)', background: state.weakManual.includes(o.id) ? 'rgba(0,230,138,0.14)' : 'rgba(255,255,255,0.04)', color: state.weakManual.includes(o.id) ? '#00e68a' : '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{o.label}</button>
              ))}
            </div>
            <div style={{ fontSize: 10, color: '#fff', marginBottom: 6 }}>Авто-кандидаты: {report.weakCandidates.length ? report.weakCandidates.map((c: any) => `${MUSCLE_LABEL_RU[c.muscle] || c.muscle}${c.granular ? ` (${c.granular})` : ''} ${c.deltaPct == null ? 'выбрано вручную' : `${c.deltaPct}%`}`).join(' · ') : '— баланс (дневник/объём/замеры не выдали)'}</div>
            <div style={{ fontSize: 10, color: '#fff', background: '#0a1629', border: '1px solid #1f3a5f', borderRadius: 8, padding: '8px 10px' }}>
              Выбрано: {report.weakZonesGranular.join(', ') || '—'} → канонические: {report.weakMusclesCanonical.join(', ') || '—'} (×1.15 объём + бонус упражнения в ББ-авто)
            </div>
            {report.weakZonesGranular.length === 0 && lastWeakHeads.length > 0 && (
              <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', fontSize: 10, color: '#fff', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <span>Прошлый разбор: {lastWeakHeads.map(weakRu).join(', ')}</span>
                <button onClick={() => setState((s) => ({ ...s, weakManual: lastWeakHeads.slice(0, 2) }))} data-bb="restore-weak" style={{ minHeight: 44, padding: '8px 12px', borderRadius: 10, background: 'rgba(0,230,138,0.12)', border: '1px solid rgba(0,230,138,0.22)', color: '#00e68a', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>↩ Вернуть в работу</button>
              </div>
            )}
            {report.weakZonesGranular.length > 0 && (
              <div style={{ marginTop: 6, display: 'grid', gap: 6 }}>
                {report.weakZonesGranular.slice(0, 2).map((z: any) => {
                  const c = weakCauses[z];
                  if (!c) return null;
                  const col = c.cause === 'recovery' ? '#ef4444' : c.cause === 'volume' ? '#f59e0b' : '#a78bfa';
                  const causeRuMap: Record<string, string> = { volume: 'объём', recovery: 'восстановление', technique: 'техника', strength: 'сила', mobility: 'подвижность', fatigue: 'усталость', activation: 'включение мышцы', genetics: 'особенности строения' };
                  const causeRu = causeRuMap[String(c.cause)] || String(c.cause);
                  return (
                    <div key={z} style={{ padding: '8px 10px', borderRadius: 8, background: `${col}0f`, border: `1px solid ${col}33`, fontSize: 10, lineHeight: 1.5 }}>
                      <b style={{ color: col }}>{weakRu(z)}: причина — {causeRu} ({Math.round(c.confidence * 100)}%)</b>
                      <div style={{ color: '#fff' }}>{c.evidence.join(' · ') || '—'}</div>
                      {(() => {
                        let t: { deltaPct: number; sessions: number } | null = null;
                        try { t = (e1rmTrend as any)[z] || (e1rmTrend as any)[canonicalMuscle(z)] || null; } catch { /* noop */ }
                        if (!t || !Number.isFinite(t.deltaPct)) {
                          if (diarySessions.length > 0) {
                            return <div style={{ color: '#fff' }}>Дневник e1RM: мало данных — нужны замеры 3+ нед назад для тренда</div>;
                          }
                          return null;
                        }
                        const arrow = t.deltaPct <= -5 ? '▼' : t.deltaPct <= 1 ? '►' : '▲';
                        const tcol = t.deltaPct <= -5 ? '#ef4444' : t.deltaPct <= 1 ? '#f59e0b' : '#22c55e';
                        return <div style={{ color: tcol }}>Дневник e1RM (28д): {arrow} {t.deltaPct}% · {t.sessions} зам.</div>;
                      })()}
                      <div style={{ color: '#fff' }}>Чинить: {c.fix}</div>
                      {top3ByZone[z] && top3ByZone[z].length > 0 && (
                        <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {top3ByZone[z].map((r: any, i: any) => (
                            <span key={r.id} title={r.reason} style={{ padding: '2px 7px', borderRadius: 20, background: i === 0 ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${i === 0 ? 'rgba(0,230,138,0.25)' : 'rgba(255,255,255,0.08)'}`, color: i === 0 ? '#00e68a' : '#fff', fontWeight: 700 }}>#{i + 1} {r.name} · {r.reason}</span>
                          ))}
                        </div>
                      )}
                      {correctiveTopByZone[z] && correctiveTopByZone[z].length > 0 && (
                        <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 8, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.22)' }} data-bb="corrective-card" data-zone={z}>
                          <b style={{ color: '#00e68a', fontSize: 11 }}>🛠 Коррекция по скринингам (доза + техника)</b>
                          <span style={{ color: '#fff', fontSize: 10 }} data-bb="corrective-coverage"> · зона: {correctiveTopByZone[z].length} вариантов</span>
                          {(corrInPlanDropped[z] || 0) > 0 && (
                            <div style={{ marginTop: 2, fontSize: 10, color: '#fff' }} data-bb="corrective-inplan-note">
                              ⓘ Скрыто {corrInPlanDropped[z]}: упражнение уже есть в плане — показаны альтернативы
                            </div>
                          )}
                          {/* ⭐ Выбор упражнения: клик по строке — запись идёт первой в инъекцию/экспорт/блок/превью. */}
                          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }} data-bb="corrective-picker">
                            {correctiveTopByZone[z].map((r: any, i: any) => {
                              const isChosen = (state.prefCorr || {})[z] === r.corr.id;
                              return (
                                <button
                                  key={r.corr.id}
                                  type="button"
                                  data-bb="corrective-pick"
                                  data-corr={r.corr.id}
                                  data-active={isChosen ? '1' : '0'}
                                  aria-pressed={isChosen}
                                  aria-label={`Выбрать коррекцию: ${r.corr.title}`}
                                  onClick={() => setState((s) => {
                                    const cur = { ...(s.prefCorr || {}) };
                                    if (cur[z] === r.corr.id) delete cur[z]; else cur[z] = r.corr.id;
                                    return { ...s, prefCorr: cur };
                                  })}
                                  style={{ minHeight: 44, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, textAlign: 'left', cursor: 'pointer', background: isChosen ? 'rgba(0,230,138,0.14)' : 'rgba(255,255,255,0.04)', border: `1px solid ${isChosen ? 'rgba(0,230,138,0.45)' : 'rgba(255,255,255,0.10)'}`, color: '#fff', fontSize: 11, fontWeight: 700 }}
                                >
                                  <span aria-hidden data-bb="corrective-star" style={{ minWidth: 28, minHeight: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14, background: isChosen ? 'rgba(0,230,138,0.25)' : 'transparent', border: `1px solid ${isChosen ? 'rgba(0,230,138,0.5)' : 'rgba(255,255,255,0.14)'}` }}>{isChosen ? '★' : '☆'}</span>
                                  <span style={{ flex: 1, minWidth: 0 }}>
                                    {r.corr.title}
                                    <span style={{ display: 'block', fontSize: 10, fontWeight: 500, color: '#fff' }}>
                                      {i === 0 ? 'идёт первой в план' : 'нажми — поставить первой'} · {r.why.join(' + ') || 'по зоне'}
                                    </span>
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                          <div style={{ marginTop: 4, fontSize: 10, color: '#fff' }} data-bb="corrective-pick-note">
                            {/* «Выбрано» = выбрано И доступно в текущей выдаче. После вставки выбранного
                                упражнения гейт K5 его прячет (оно уже в плане) — обещать «попадёт в
                                инъекцию» было бы враньём, поэтому такое состояние честно гасится. */}
                            {(() => {
                              const live = (correctiveTopByZone[z] || []).map((r: any) => r.corr.id);
                              const pref = (state.prefCorr || {})[z] || '';
                              if (pref && live.includes(pref)) {
                                return `Выбрано: ${weakRu(z)} · попадёт в инъекцию, экспорт и блок`;
                              }
                              if (pref && !live.includes(pref)) {
                                return `Выбор снят: упражнение уже в плане (или отсечено фильтром) — снова топ-1 по ранжиру`;
                              }
                              return 'Своё упражнение не выбрано — в план идёт топ-1 по ранжиру (жми ☆, чтобы поменять)';
                            })()}
                          </div>
                          {correctiveTopByZone[z].slice(0, 2).map((r: any) => {
                            // П2: те же флаги, что вставка (readiness-red/жёлтая боль) — «показано = вставится».
                            const dose = (() => { try { return correctiveDose(r.corr, (weakCauses as any)?.[z]?.cause ?? null, corrDoseFlags()); } catch { return null; } })();
                            // K7: вес/отдых — из тех же входов, что вставка (workMax профиля + loadFactor записи).
                            const hint = (() => { try { return correctiveWeightHint(r.corr.exerciseId, profileWorkMax, canonicalMuscle(z), { loadFactor: correctiveLoadFactor(r.corr.phase) }); } catch { return null; } })();
                            const phaseRu = r.corr.phase === 'strength' ? 'сила' : r.corr.phase === 'stability' ? 'стабильность' : 'техника';
                            return (
                              <div key={r.corr.id} style={{ marginTop: 6, fontSize: 10, lineHeight: 1.5, color: '#fff' }} data-bb="corrective-row" data-corr={r.corr.id}>
                                <b style={{ color: '#fff' }}>{r.corr.title}</b>
                                <span style={{ color: '#fff' }} data-bb="corrective-badge"> · {phaseRu}{r.corr.level !== 'any' ? ` · ${r.corr.level === 'intermediate' ? 'любитель+' : 'профи'}` : ''}</span>
                                <div>Доза: {dose ? `${dose.sets}×${dose.repsMin}–${dose.repsMax} RIR${dose.rir} ${dose.tempo}` : `${r.corr.protocol.sets}×${r.corr.protocol.repsMin}–${r.corr.protocol.repsMax}`}{hint ? ` · ${hint.kg != null ? `≈${hint.kg} кг` : hint.bodyweight ? 'без кг' : 'вес по факту'}` : ''} · отдых {r.corr.protocol.restSec}с · {r.why.join(' + ') || 'по зоне'}</div>
                                <div>Кью: {r.corr.cues.join(' · ')}</div>
                                <div>Дальше: {r.corr.progression} · Ре-тест: {r.corr.retest} ({r.corr.source})</div>
                                {/* K6: мёртвые поля оживлены — «чем заменить» (equipmentAlt) и регрессия (спад) */}
                                {r.corr.regression ? <div>Регрессия: {r.corr.regression}</div> : null}
                                {r.corr.equipmentAlt.length > 0 ? <div data-bb="corrective-alt">Если нет снаряда: {r.corr.equipmentAlt.map((id: any) => { try { const c = (EXERCISE_CATALOG as any[]).find((e) => String(e.id).toLowerCase() === String(id).toLowerCase()); return c ? String(c.name) : id; } catch { return id; } }).join(', ')}</div> : null}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ fontSize: 10, color: '#fff', marginTop: 6, background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.18)', borderRadius: 8, padding: '8px 10px' }}>
              Подсказка: две зоны одной мышцы (средняя + задняя дельты) — можно, плечи + зона — конфликт.
            </div>
            {/* ROUND-10: блок коррекции (волна) — тот же источник, что карточка/вставка (без нового ранжира) */}
            {(() => {
              try {
                if (!corrBlockLines) return null;
                const block = corrBlockLines.block;
                return (
                  <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 10, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.22)', fontSize: 11, lineHeight: 1.5 }} data-bb="corr-block">
                    <b style={{ color: '#00e68a' }}>📅 Блок коррекции (волна 4–8 нед)</b>
                    <div style={{ color: '#fff' }} data-bb="corr-block-summary">{block.summary}</div>
                    {block.weeks.map((wk: any) => (
                      <div key={wk.week} style={{ color: '#fff', fontSize: 10 }} data-bb="corr-block-week">
                        Нед {wk.week} ({wk.focus}): {wk.items.map((i: any) => `${i.name} ${i.sets}×${i.repsMin}–${i.repsMax} RIR${i.rir}`).join('; ')}
                      </div>
                    ))}
                  </div>
                );
              } catch { return null; }
            })()}
            <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 11, lineHeight: 1.5 }} data-bb="lr-card">
              <b style={{ color: '#fff' }}>↔ Лево/право по дневнику (унилатеральные — своей стороне, штанга — поровну)</b>
              {lrVerdicts.length === 0 && <div style={{ color: '#fff', marginTop: 4 }}>Пока пусто — нужны унилатеральные сеты в дневнике (гантели, по одной стороне).</div>}
              {lrVerdicts.slice(0, 4).map((v: any) => (
                <div key={v.group} style={{ color: v.verdict === 'norm' ? '#22c55e' : v.verdict === 'watch' ? '#f59e0b' : '#ef4444', marginTop: 4 }}>
                  {MUSCLE_LABEL_RU[v.group] || v.group}: Л {v.left} · П {v.right}{v.asymPct != null ? ` · перекос ${v.asymPct}%` : ''} — {v.text}
                </div>
              ))}
              <div style={{ color: '#fff', marginTop: 4, fontSize: 10, opacity: 0.9 }} data-bb="lr-disclaimer">Перекос/LSI — ориентир приоритета, не прогноз травмы (BJSM 2025: LSI не различает безопасный возврат)</div>
              <div style={{ color: '#fff', marginTop: 4, fontSize: 10, opacity: 0.9 }} data-bb="lr-phase-note">⚠ {LR_PHASE_ASYM_NOTE}</div>
            </div>
            {report.weakZonesGranular.length > 0 && (
              <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 8, background: '#0a1629', border: '1px solid #1f3a5f', fontSize: 10, lineHeight: 1.5 }}>
                <b style={{ color: ACCENT }}>Покрытие головок планом:</b>
                {!bbPlan && <div style={{ color: '#fff' }}>Нет плана ББ — собери в ББ-авто, покрытие появится здесь.</div>}
                {bbPlan && headCoverage.length === 0 && <div style={{ color: '#fff' }}>—</div>}
                {headCoverage.map((hc: any) => (
                  <div key={hc.head} style={{ color: hc.covered ? '#22c55e' : '#f59e0b', marginTop: 2 }}>
                    {hc.covered ? '✓' : '✗'} {hc.head}{hc.covered ? ` — ${hc.by.join(', ')}` : ' — нет упражнения в плане (см. топ-3 выше)'}
                  </div>
                ))}
              </div>
            )}
            {/* Движения, не нагрузка: скорость/LVP/сухожилия/возврат — в своих хабах, здесь только ссылки */}
            <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 11, lineHeight: 1.5 }} data-bb="pro3-card">
              <b style={{ color: '#fff' }}>🔗 Смежные хабы (без дублей)</b>
              <div style={{ color: '#fff', marginTop: 4, fontSize: 10, lineHeight: 1.5 }}>
                Скорость/VBT — <b>⚡ Анализ силы → VBT</b> · Сухожилия/возврат/боль — <b>🦴 Суставы и ортопедия</b> · Нагрузка/сон/готовность — <b>⚡ Интеллект</b> · Объём MEV/MRV — <b>📐 Объём-хаб</b> · Видеоразбор траектории — <b>ТА/СМ-хаб</b>
              </div>
              {/* AUDIT: «готовность» больше не прячется — при отсутствии метрик это
                  видно, иначе «зелёный» выглядел измеренным результатом. */}
              <div style={{ color: (readiness as any)?.level === 'red' ? '#ef4444' : (readiness as any)?.level === 'yellow' ? '#f59e0b' : '#22c55e', marginTop: 4 }} data-bb="readiness-line">
                {(readiness as any)?.noData ? '⚠ ' : ''}Готовность: {((readiness as any)?.level === 'red' ? 'красный' : (readiness as any)?.level === 'yellow' ? 'жёлтый' : 'зелёный')}{(readiness as any)?.advice ? ` — ${(readiness as any).advice}` : ''}
              </div>
              {mmcAdvice && (
                <div style={{ color: '#fff', marginTop: 4 }} data-bb="mmc-line">
                  {mmcAdvice.focus === 'internal' ? '🧠 Внутренний' : '🎯 Внешний'} фокус: {mmcAdvice.cue} — {mmcAdvice.text}
                </div>
              )}
              {lrDirection.length > 0 && (
                <div style={{ marginTop: 4 }} data-bb="lr-direction">
                  {lrDirection.map((d: any) => (
                    <div key={d.group} style={{ color: '#fff', marginTop: 2 }}>{d.text}</div>
                  ))}
                </div>
              )}
              <button onClick={handleSpecIcs} data-bb="export-ics" style={{ width: '100%', minHeight: 48, marginTop: 6, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>📅 Спец-блок (.ics)</button>
              <button onClick={handleAnnualApply} data-bb="annual-apply" style={{ width: '100%', minHeight: 48, marginTop: 6, padding: '10px 14px', borderRadius: 10, background: 'rgba(0,230,138,0.10)', border: '1px solid rgba(0,230,138,0.30)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>🗓 Спец-блок → в годовой план</button>
            </div>
            {report.weakZonesGranular.length > 0 && (
              <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 11, lineHeight: 1.5 }} data-bb="stop-flags">
                <b style={{ color: '#fff' }}>⛔ Стоп-флаги вставки (скрининг, не диагноз)</b>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                  {([
                    ['acutePain', 'Острая боль', 'в суставе/мышце'],
                    ['swelling', 'Отёк', 'сустав опух'],
                    ['numbness', 'Онемение', 'покалывание'],
                    ['jointClickPain', 'Щелчки с болью', 'щёлкает и болит'],
                  ] as Array<['acutePain' | 'swelling' | 'numbness' | 'jointClickPain', string, string]>).map(([k, title, desc]) => (
                    <button
                      key={k}
                      type="button"
                      role="switch"
                      aria-checked={state[k]}
                      aria-pressed={state[k]}
                      aria-label={title}
                      data-bb="stop-flag"
                      data-on={state[k] ? '1' : '0'}
                      onClick={() => setState((s) => ({ ...s, [k]: !s[k] }))}
                      style={{
                        minHeight: 44, padding: '8px 12px', borderRadius: 999, border: '1px solid',
                        borderColor: state[k] ? '#ef4444' : 'rgba(255,255,255,0.12)',
                        background: state[k] ? 'rgba(239,68,68,0.14)' : 'rgba(255,255,255,0.04)',
                        color: state[k] ? '#ef4444' : '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      {title}
                    </button>
                  ))}
                </div>
                {(redFlags as any).active && (
                  <div style={{ marginTop: 6, color: '#fff' }} data-bb="stop-note">
                    {(redFlags as any).blocked ? '⛔ ' : '⚠ '}{(redFlags as any).text} — при сомнениях к врачу.
                  </div>
                )}
                <div style={{ fontSize: 10, color: '#fff', opacity: 0.85, marginTop: 4 }}>Полный суставной скрининг — <b>🦴 Суставы и ортопедия</b> (здесь только гейт вставки).</div>
              </div>
            )}
            {returnToPlan && (
              <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 10, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.20)', fontSize: 11, lineHeight: 1.5 }} data-bb="return-card">
                <b style={{ color: '#fff' }}>🔄 Возврат в работу после стоп-флагов (ступени — только ручные)</b>
                <div style={{ color: '#fff', marginTop: 4, fontSize: 10 }}>{returnToPlan.text}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                  {([['', 'Авто · ступень 1'], ['1', '1 · техника'], ['2', '2 · ×0.5 RIR+3'], ['3', '3 · полный']] as Array<[BBState['returnStage'], string]>).map(([v, label]) => (
                    <button
                      key={v || 'auto'}
                      type="button"
                      aria-pressed={(state.returnStage || '') === v}
                      aria-label={`Ступень возврата: ${label}`}
                      data-bb="return-stage"
                      data-active={(state.returnStage || '') === v ? '1' : '0'}
                      onClick={() => setState((s) => ({ ...s, returnStage: v }))}
                      style={{ minHeight: 44, padding: '8px 12px', borderRadius: 999, border: '1px solid', borderColor: (state.returnStage || '') === v ? '#f59e0b' : 'rgba(255,255,255,0.12)', background: (state.returnStage || '') === v ? 'rgba(245,158,11,0.14)' : 'rgba(255,255,255,0.04)', color: (state.returnStage || '') === v ? '#f59e0b' : '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                    >{label}</button>
                  ))}
                </div>
                {returnActive && (
                  <div style={{ color: '#fff', marginTop: 6, fontSize: 10 }} data-bb="return-active">
                    Активная: <b style={{ color: '#f59e0b' }}>{returnActive.title}</b> · {returnActive.volume} · {returnActive.rir}
                    {returnActive.action.volumeMult <= 0 ? ' — силовые коррекции не вставляются (только техника)' : ''}
                  </div>
                )}
                <div style={{ color: '#fff', marginTop: 4, fontSize: 10, opacity: 0.9 }}>
                  Правило боли (ПММ): во время ≤5/10 и к утру — как до нагрузки. Боль вернулась — назад на ступень. Ступень уехает в ББ-авто кнопкой «→ В ББ-авто» и учитывается при 💉.
                </div>
                {returnCriteria && (
                  <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }} data-bb="return-criteria">
                    <b style={{ color: '#fff', fontSize: 11 }}>
                      ✅ Критерии выхода (измеримые) — {returnCriteria.metCount} из {returnCriteria.total}
                    </b>
                    {/* вводы: 0–10 для боли, чипы для скованности/плиометрики */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                      {([['retPainLoad', 'Боль при нагрузке 0–10'], ['retPainMorning', 'Боль утром 0–10']] as Array<['retPainLoad' | 'retPainMorning', string]>).map(([key, label]) => (
                        <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#fff', fontSize: 10 }}>
                          {label}
                          <input
                            type="number" inputMode="numeric" min={0} max={10} step={1}
                            aria-label={label} data-bb="return-criterion-input" data-key={key}
                            value={state[key] ?? ''}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const n = raw === '' ? null : Math.max(0, Math.min(10, Math.round(Number(raw) || 0)));
                              setState((s) => ({ ...s, [key]: n }));
                            }}
                            style={{ width: 60, minHeight: 44, padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 14 }}
                          />
                        </label>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                      {([['worse', 'Скованность хуже'], ['same', 'Так же'], ['better', 'Лучше']] as Array<['better' | 'same' | 'worse', string]>).map(([v, label]) => (
                        <button
                          key={`stiff-${v}`} type="button" data-bb="return-stiffness" data-value={v}
                          aria-pressed={state.retStiffness === v}
                          onClick={() => setState((s) => ({ ...s, retStiffness: s.retStiffness === v ? null : v }))}
                          style={chipStyle(state.retStiffness === v)}
                        >{label}</button>
                      ))}
                      <button
                        type="button" data-bb="return-plyo"
                        aria-pressed={state.retPlyo === true}
                        onClick={() => setState((s) => ({ ...s, retPlyo: s.retPlyo === true ? null : true }))}
                        style={chipStyle(state.retPlyo === true)}
                      >{state.retPlyo === true ? '✓ Плиометрика терпится' : 'Плиометрика терпится'}</button>
                    </div>
                    <div style={{ marginTop: 6 }}>
                      {returnCriteria.criteria.map((c: any) => (
                        <div key={c.id} data-bb="return-criterion" data-state={c.state} style={{ color: c.state === 'not_met' ? '#ef4444' : c.state === 'met' ? '#22c55e' : '#fff', fontSize: 10, marginTop: 2 }}>
                          {c.state === 'met' ? '✓' : c.state === 'not_met' ? '✗' : '—'} {c.label}: {c.state === 'no_data' ? 'нет данных' : c.rule}
                        </div>
                      ))}
                    </div>
                    <div style={{ color: '#fff', marginTop: 6, fontSize: 10 }} data-bb="return-criteria-verdict">{returnCriteria.text}</div>
                    <div style={{ color: '#fff', marginTop: 2, fontSize: 10, opacity: 0.9 }} data-bb="return-criteria-note">ⓘ {returnCriteria.note}</div>
                  </div>
                )}
              </div>
            )}
            {report.weakZonesGranular.length > 0 && (
              <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                <button onClick={handleInjectToPlan} data-bb="inject" style={{ minHeight: 48, padding: '10px 14px', borderRadius: 10, background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#06281c', border: 'none', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>💉 Вставить коррекции в план</button>
                {hasInjectPrev && <button onClick={handleRollbackInject} data-bb="rollback" style={{ minHeight: 48, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>↩ Откатить вставку</button>}
              </div>
            )}
            {planHistory.length > 0 && (
              <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 8, background: '#0a1629', border: '1px solid #1f3a5f', fontSize: 10, lineHeight: 1.5 }}>
                <b style={{ color: ACCENT }}>🕓 Журнал плана ({planHistory.length}):</b>
                {planHistory.map((s: any, i: any) => (
                  <div key={`${s.date}-${i}`} style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                    <span style={{ color: '#fff' }}>{s.date} · {s.label || 'снимок'}</span>
                    <button onClick={() => handleRestoreSnapshot(i)} data-bb="snapshot-restore" style={{ minHeight: 44, padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>↩ Восстановить</button>
                  </div>
                ))}
              </div>
            )}
          </div>
  );
};

export default BbWeakTab;
