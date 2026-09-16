/**
 * bb-contest-prep-sections.tsx — под-секции шага «🏁 Contest Prep» ББ-авто, вынесенные из
 * god-component `BbAutoConstructor.tsx` (§4.3 остаток-2: `renderContestPrep` разрезан 4
 * под-секциями, перенос 1-в-1 — логика/тексты/стили не менялись; условная обёртка
 * `{prepPlan && (...)}`, гейт `contestWizard===5` и низ шага остались в конструкторе).
 *
 * Общий контекст — `BbContestPrepCtx` (плоский снимок всех внешних привязок шага, чтобы не
 * тянуть 80+ props; решение §4.3 «через контекст-объект»). Значения читаются как `any` —
 * форма состояния god-component не типизируется снаружи (осознанный trade-off мех. переноса).
 */
import React from 'react';
import {
  buildBBContestPrep, applyPeakWeekOverlayToBBPlan, deserializeBBPrepConfig, legacyConfigFromProfile,
  isoAddDays, isoToday, CATEGORY_PROFILES, CONTEST_CATEGORY_LABELS, CONTEST_SPECIALIZATION_LABELS,
  buildBBContestPrepPlan, applyContestPrepToBBPlan, extendBBPlanPreparation, replanBBContestPrep,
  shiftBBContestPrepShowDate, serializeBBContestPrepPlan, nutritionTargetsForPrepDate,
  prepPhaseForDate, PREP_PHASE_LABELS, PREP_PHASE_COLORS,   buildShowTimeline, configFromPlan,
  computeReadiness, spillRiskScore, isShortCycle,
  saveTestPeakWeekResult, latestTestPeakWeek, resolvePeakStrategy, planFromStored, prepWeightAdvice, recommendCarbStrategyFromTrial, liveAdjustForPeakDay,
  recommendBBTaperConfig, sRPEAdjustment,
  buildShowChecklist, loadShowChecklist, toggleShowChecklistItem,
  type BBTaperRecommendation,
  buildPostShowPlan, buildContestPrepPrintHtml, recordPrepAdjustment, buildPrepIcs, buildPrepCoachJson,
  prepTrainingCompliance, buildPrepWeeklyReportHtml, buildPrepCheckinsCsv,
  manipulationLockedFor, manipulationLockNote, trialCarbDoseGPerKg,
  TAPER_VS_DELOAD_NOTE, lastHardDayForMuscle, prepDietBreaks,
  postShowRecoveryDiet, buildPeakWeek, recarbLoadFromVisual,
  type PrepAdjustment,
  type BBContestPrepConfig, type BBContestPrepResult, type BBContestCategory, type ContestSpecialization,
  type BBContestPrepPlan, type PrepWaterMode, type PrepSodiumMode, type PrepCarbMode, type BBPlanWithPrep,
  type PrepPhaseKey, type ContestEventEntry,
  type WaterStrategy, type SodiumStrategy, type CarbLoadStrategy,
} from '../../../engines/bb/bb-contest-prep.engine';
import {
  getPostShowLog, savePostShowEntry, removePostShowEntry, postShowRecoveryMarkers,
  postShowComedownNotes,
} from '../../../engines/bb/bb-prep-post-show-log.engine';
import { PREP_LAB_PANEL, PREP_PROCEDURES, PREP_HYDRATION_GUIDELINES } from '../../../engines/bb/bb-prep-process.engine';
import { calcRedsCAT2 } from '../../../engines/metabolic-hub.engine';
import { computeEA } from '../NutritionScreen_parts/IndividualPlan/planner-ea.engine';
import type { PeakingProtocol } from '../../../engines/peaking-protocols.engine';
import { loadSessions } from '../../../engines/workout-logger.engine';
import { PopupNumber, PopupSelect } from '../SRCBBScreen_parts/TrainingPopups';
import {
  CollapsibleCard, WEAK_GROUPS, PHASE_TECHNIQUES,
  backSubgroupLabel, armHeadLabel, isAbRotationActive,
  annualBlockCtxToPrepPatch, annualActiveBlockLine,
  getPhaseMap, phaseForWeek, DONOR_GROUPS, normalizeDonorTargets,
  computePhases, chipBtn, useInlineDialogA11y,
  BbRowSwitch, BbToggleChip,
  type Step, type BBPhase, type PlanMode,
} from './bb-auto-constructor-shared';
import { ACCENT, CARD, SMALL, BTN, BTN_GHOST, H, STEP_PILL, IN } from './training-ui';

export interface BbContestPrepCtx { [key: string]: any }

/** A — шапка шага + пилюли визарда + подсказка + карточка «📅 Параметры подготовки» (шаги 1–3). */
export const BbContestPrepParams: React.FC<{ ctx: BbContestPrepCtx }> = ({ ctx }) => {
  const { adaptiveTaper, assembleContestPrep, buildContestPrepConfig, builtPlan, contestWizard, expYearsForPrep, handleApplyAdaptiveTaper, handleExtendPrep, handleShiftPrepShowDate, lastTest, peakSpec, peakWeekCategory, peds, prepApplied, prepBusy, prepCarbMode, prepCompetitions, prepConfirmedManip, prepContra, prepContraExtra, prepCreatineStop, prepMainCompetitionId, prepPlan, prepPreferLowFiber, prepShowDate, prepSodiumMode, prepTaperWeeks, prepTrainingProtocol, prepVolumeMode, prepWaterMode, prepWeeks, readiness, setContestWizard, setPeakSpec, setPeakWeekCategory, setPrepCarbMode, setPrepCompetitions, setPrepConfirmedManip, setPrepContraExtra, setPrepCreatineStop, setPrepMainCompetitionId, setPrepPreferLowFiber, setPrepSodiumMode, setPrepTaperWeeks, setPrepTrainingProtocol, setPrepVolumeMode, setPrepWaterMode, setStep, spillRisk } = ctx;
  return (
    <>
      {/* <<Params>> */}
        <div style={H}>🏁 Contest Prep — подготовка к соревнованию</div>
        <div style={SMALL}>
          Опциональный цикл: <b>подготовка → taper → peak week → show day</b>. План тренировок строится как
          обычный; этот шаг накладывает фазы поверх него (копию) и генерирует дневные цели питания.
          Можно пропустить — план останется обычным.
        </div>
        {/* PRO Wizard 5 шагов */}
        <div style={{ display:'flex', gap:6, marginTop:10, flexWrap:'wrap' }}>
          {[1,2,3,4,5].map(n => {
            const labels=['1 Атлет','2 Кондиция','3 Стратегии','4 Trial','5 Preview'] as const;
            const active=contestWizard===n;
            const disabled=false;
            return <button key={n} onClick={()=>setContestWizard(n as any)} disabled={disabled} style={{ flex:1, minWidth:70, padding:'6px 8px', borderRadius:8, fontSize:10, fontWeight: active?800:600, background: active?'rgba(236,72,153,0.2)':'rgba(255,255,255,0.04)', border: active?'1px solid #ec4899':'1px solid rgba(255,255,255,0.08)', color: active?'#ec4899':'#fff', cursor:'pointer' }}>{labels[n-1]}</button>;
          })}
        </div>
        <div style={{ fontSize:9, color:'#fff', marginTop:4, textAlign:'center' }}>
          {contestWizard===1 && 'Шаг 1: атлет, дата, категория, специализация'}
          {contestWizard===2 && 'Шаг 2: кондиция BF gap, spillRisk, готовность'}
          {contestWizard===3 && 'Шаг 3: стратегии вода/натрий/карбы (gate: BF>14% + light → не front/high)'}
          {contestWizard===4 && 'Шаг 4: репетиция trial peak за 21-28д (фото/вес) → рекомендация'}
          {contestWizard===5 && 'Шаг 5: preview taper curve, peakWeek, warnings, экспорт'}
        </div>

        {/* Параметры */}
        <div style={{ ...CARD, marginTop:10 }}>
          <div style={{ fontSize:12, fontWeight:800, color:'#ec4899', marginBottom:8 }}>📅 Параметры подготовки</div>
          <div style={{ display: contestWizard===1 ? 'grid' : 'none', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
            <div>
              <div style={{ ...SMALL, marginBottom:4 }}>📆 Дата шоу</div>
              <input type="date" value={prepShowDate} onChange={e => handleShiftPrepShowDate(e.target.value)} style={{ ...IN, width:'100%' }} />
            </div>
            <div>
              <PopupSelect
                label="🎭 Категория"
                value={peakWeekCategory}
                onChange={v => setPeakWeekCategory(v as BBContestCategory)}
                options={(Object.keys(CATEGORY_PROFILES) as BBContestCategory[]).map(c => ({ id: c, label: CONTEST_CATEGORY_LABELS[c] }))}
              />
            </div>
            <div>
              <PopupSelect
                label="⭐ Специализация"
                value={peakSpec}
                onChange={v => setPeakSpec(v as ContestSpecialization)}
                options={(Object.keys(CONTEST_SPECIALIZATION_LABELS) as ContestSpecialization[]).map(s => ({ id: s, label: CONTEST_SPECIALIZATION_LABELS[s] }))}
              />
            </div>
            <div>
              <div style={{ ...SMALL, marginBottom:4 }}>Противопоказания (из профиля + ручные)</div>
              <input
                value={prepContraExtra.join(', ')}
                onChange={e => setPrepContraExtra(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                placeholder={prepContra.length ? prepContra.join(', ') : 'kidney, heart, hypertension, diabetes…'}
                style={{ ...IN, width:'100%' }}
              />
            </div>
          </div>
          {/* Step 2 Кондиция — readiness + spillRisk (wizard) */}
          <div style={{ display: contestWizard===2 ? 'block' : 'none', marginBottom:8, padding:8, borderRadius:8, background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.15)' }}>
            <div style={{ ...SMALL, color:'#60a5fa', fontWeight:700, marginBottom:4 }}>📊 Кондиция (BF gap, spill)</div>
            <div style={{ fontSize:11, color: readiness.verdict==='behind' ? '#f87171' : readiness.verdict==='ahead' ? '#4ade80' : '#fff' }}>{readiness.note} {readiness.gap!=null ? `(gap ${readiness.gap}%)` : ''}</div>
            <div style={{ fontSize:11, marginTop:4, color: spillRisk.level==='high' ? '#ef4444' : spillRisk.level==='medium' ? '#f59e0b' : '#4ade80' }}>Spill риск {spillRisk.level}: {spillRisk.note}</div>
            {spillRisk.level==='high' && <div style={{ fontSize:9, color:'#ef4444', marginTop:4 }}>⛔ High: смените carb на moderate/linear, stable вода</div>}
            {isShortCycle(prepWeeks + prepTaperWeeks + 1) && <div style={{ fontSize:9, color:'#fbbf24', marginTop:4 }}>⚠ ShortCycle 4-6 нед: linear/moderate без final каскада</div>}
          </div>
          {/* Соревнования — единый словарь A/B/C — wizard 3 */}
          <div style={{ display: contestWizard===3 ? 'block' : 'none', marginBottom:8, padding:8, borderRadius:8, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.15)' }}>
            <div style={{ ...SMALL, marginBottom:4, color:'#f87171', fontWeight:700 }}>🏁 Соревнования (необязательно)</div>
            {(prepCompetitions && prepCompetitions.length > 0) ? (
              <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:6 }}>
                {prepCompetitions.map((c: any) => (
                  <div key={c.id} style={{ display:'flex', gap:6, alignItems:'center', padding:'4px 6px', borderRadius:6, background:'rgba(255,255,255,0.04)', border: c.id===prepMainCompetitionId ? '1px solid rgba(251,191,36,0.4)' : '1px solid rgba(255,255,255,0.06)' }}>
                    <button onClick={() => setPrepMainCompetitionId(c.id===prepMainCompetitionId ? undefined : c.id)} style={{ fontSize:11, padding:'2px 6px', borderRadius:4, background: c.id===prepMainCompetitionId ? 'rgba(251,191,36,0.2)' : 'transparent', color: c.id===prepMainCompetitionId ? '#fbbf24' : 'rgba(255,255,255,0.5)', border:'1px solid rgba(255,255,255,0.1)', cursor:'pointer' }}>{c.id===prepMainCompetitionId ? '★' : '☆'}</button>
                    <input value={c.name} onChange={e => setPrepCompetitions((prev: any) => (prev||[]).map((x: any) => x.id===c.id ? {...x, name:e.target.value} : x))} style={{ flex:1, background:'transparent', color:'#fff', border:'1px solid rgba(255,255,255,0.1)', borderRadius:4, padding:'2px 6px', fontSize:11 }} />
                    <PopupSelect
                      label="Приоритет"
                      value={c.priority || 'B'}
                      onChange={v => setPrepCompetitions((prev: any) => (prev||[]).map((x: any) => x.id===c.id ? {...x, priority: v as any} : x))}
                      options={[{ id: 'A', label: 'A главный' }, { id: 'B', label: 'B контроль' }, { id: 'C', label: 'C тренир.' }]}
                    />
                    <input type="date" value={c.date || ''} onChange={e => setPrepCompetitions((prev: any) => (prev||[]).map((x: any) => x.id===c.id ? {...x, date:e.target.value || undefined} : x))} style={{ background:'transparent', color:'#fbbf24', border:'1px solid rgba(255,255,255,0.1)', borderRadius:4, fontSize:10 }} />
                    <button onClick={() => setPrepCompetitions((prev: any) => (prev||[]).filter((x: any) => x.id!==c.id))} style={{ color:'#f87171', background:'transparent', border:'none', cursor:'pointer', fontSize:12 }}>✕</button>
                  </div>
                ))}
              </div>
            ) : <div style={{ fontSize:10, color:'rgba(255,255,255,0.55)', marginBottom:6 }}>Одно шоу — дата выше. Добавьте старты для мульти-пика A/B/C.</div>}
            <button onClick={() => setPrepCompetitions((prev: any) => [...(prev||[]), { id:`comp_${Date.now().toString(36)}`, name:`Старт ${((prev||[]).length)+1}`, priority:'B' }])} style={{ fontSize:10, padding:'4px 8px', borderRadius:6, background:'rgba(239,68,68,0.1)', color:'#f87171', border:'1px dashed rgba(239,68,68,0.3)', cursor:'pointer' }}>＋ Добавить соревнование</button>
          </div>
          <div style={{ display: contestWizard===3 ? 'block' : 'none' }}>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center', marginBottom:8 }}>
            <span style={{ ...SMALL }}>Недели подготовки:</span>
            <button style={BTN_GHOST} onClick={() => handleExtendPrep(-1)}>−</button>
            <b style={{ fontSize:15, color:'#fff', minWidth:28, textAlign:'center' }}>{prepPlan ? prepPlan.preparation.weeks : prepWeeks}</b>
            <button style={BTN_GHOST} onClick={() => handleExtendPrep(1)}>+</button>
            <span style={{ ...SMALL, marginLeft:10 }}>Недели taper (1-4):</span>
            <button style={BTN_GHOST} onClick={() => setPrepTaperWeeks((w: any) => Math.max(1, w - 1))}>−</button>
            <b style={{ fontSize:15, color:'#fff', minWidth:24, textAlign:'center' }}>{prepTaperWeeks}</b>
            <button style={BTN_GHOST} onClick={() => setPrepTaperWeeks((w: any) => Math.min(4, w + 1))}>+</button>
          </div>
          {/* 🤖 Адаптивный тапер (Э2): sRPE/ACWR/усталость → рекомендация недель */}
          {adaptiveTaper && (
            <div style={{ marginBottom:8, padding:10, borderRadius:10, background:'rgba(168,85,247,0.07)', border:'1px solid rgba(168,85,247,0.22)' }}>
              <div style={{ fontSize:11, fontWeight:800, color:'#c084fc', marginBottom:4 }}>🤖 Адаптивный тапер <span style={{ fontWeight:400, color:'#fff' }}>· sRPE {adaptiveTaper.srpeN} сесс.{adaptiveTaper.acwrRatio != null ? ` · ACWR ${adaptiveTaper.acwrRatio.toFixed(2)}` : ''}{adaptiveTaper.srpeN >= 3 ? ` · mean ${adaptiveTaper.srpeStat.mean}/monotony ${adaptiveTaper.srpeStat.monotony}` : ''}</span></div>
              {adaptiveTaper.srpeN < 3 && adaptiveTaper.acwrRatio == null && (
                <div style={{ fontSize:10, color:'#fff', marginBottom:4 }}>Нет данных дневника (нужны sRPE-сессии) — рекомендация по базовым неделям. Пик-неделя не двигается.</div>
              )}
              {adaptiveTaper.rec.reasons.length > 0 ? adaptiveTaper.rec.reasons.map((r: any, i: any) => (
                <div key={i} style={{ fontSize:10, color:'#fff' }}>• {r}</div>
              )) : (
                <div style={{ fontSize:10, color:'#fff' }}>По дневнику перегрузки нет — держите {prepTaperWeeks} нед.</div>
              )}
              {lastTest?.verdict === 'tested_ok' && adaptiveTaper.rec.weeksOut > 1 && (
                <div style={{ fontSize:10, color:'#4ade80' }}>🧪 Trial peak пройден успешно — допустимо сократить тапер до 1 нед вручную.</div>
              )}
              <div style={{ display:'flex', gap:8, marginTop:6 }}>
                <button style={BTN_GHOST} onClick={handleApplyAdaptiveTaper}>Применить: {adaptiveTaper.rec.weeksOut} нед{adaptiveTaper.rec.volumeMult < 1 ? ' · ×0.85' : ''}</button>
              </div>
              <div style={{ fontSize:9, color:'#fff', marginTop:4 }}>Пик-неделя и дата шоу не двигаются. После применения — «Собрать и применить».</div>
            </div>
          )}
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:8 }}>
            <div>
              <div style={{ ...SMALL, marginBottom:4 }}>💧 Вода</div>
              <div style={{ display:'flex', gap:6 }}>
                {(['stable', 'tapered', 'high'] as WaterStrategy[]).map(m => (
                  <button key={m} onClick={() => setPrepWaterMode(m)} style={{ ...BTN_GHOST, background: prepWaterMode === m ? 'rgba(59,130,246,0.2)' : 'transparent', borderColor: prepWaterMode === m ? '#3b82f6' : undefined, color: prepWaterMode === m ? '#60a5fa' : undefined }}>
                    {m === 'stable' ? 'Stable — рекомендовано' : m === 'tapered' ? 'Tapered — умеренно' : 'High load+cut'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ ...SMALL, marginBottom:4 }}>🧂 Натрий</div>
              <div style={{ display:'flex', gap:6 }}>
                {(['stable', 'tapered'] as SodiumStrategy[]).map(m => (
                  <button key={m} onClick={() => setPrepSodiumMode(m)} style={{ ...BTN_GHOST, background: prepSodiumMode === m ? 'rgba(245,158,11,0.2)' : 'transparent', borderColor: prepSodiumMode === m ? '#f59e0b' : undefined, color: prepSodiumMode === m ? '#fbbf24' : undefined }}>
                    {m === 'stable' ? 'Stable — не трогаем' : 'Tapered −30% за 48ч'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ ...SMALL, marginBottom:4 }}>🍚 Карб-загрузка</div>
              <div style={{ display:'flex', gap:6 }}>
                {(['back', 'moderate', 'front'] as CarbLoadStrategy[]).map(m => (
                  <button key={m} onClick={() => setPrepCarbMode(m)} style={{ ...BTN_GHOST, background: prepCarbMode === m ? 'rgba(34,197,94,0.2)' : 'transparent', borderColor: prepCarbMode === m ? '#22c55e' : undefined, color: prepCarbMode === m ? '#4ade80' : undefined }}>
                    {m === 'back' ? 'Back-load' : m === 'moderate' ? 'Классика 3/3' : 'Front-load'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ ...SMALL, marginBottom:4 }}>🏋️ Протокол (Библиотека)</div>
              <div style={{ display:'flex', gap:6, marginBottom:8 }}>
                {(['bb', 'classic', 'pl'] as PeakingProtocol[]).map(m => (
                  <button key={m} onClick={() => setPrepTrainingProtocol(m)} style={{ ...BTN_GHOST, background: prepTrainingProtocol === m ? 'rgba(236,72,153,0.2)' : 'transparent', borderColor: prepTrainingProtocol === m ? '#ec4899' : undefined, color: prepTrainingProtocol === m ? '#f472b6' : undefined }}>
                    {m === 'bb' ? 'BB 4н' : m === 'classic' ? 'Classic WF' : 'PL 3н'}
                  </button>
                ))}
              </div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
                <BbToggleChip
                  checked={prepPreferLowFiber}
                  onChange={setPrepPreferLowFiber}
                  label="Низковолокнистые карбс"
                  accent="#22c55e"
                  ariaLabel="Низковолокнистые углеводы"
                />
                <BbToggleChip
                  checked={prepCreatineStop}
                  onChange={setPrepCreatineStop}
                  label="Стоп креатин"
                  accent="#f87171"
                  ariaLabel="Отмена креатина"
                />
              </div>
            </div>
            <div>
              <div style={{ ...SMALL, marginBottom:4 }}>🏋️ Режим подготовки</div>
              <div style={{ display:'flex', gap:6 }}>
                {([1.0, 0.85] as number[]).map(m => (
                  <button key={m} onClick={() => setPrepVolumeMode(m)} style={{ ...BTN_GHOST, background: prepVolumeMode === m ? 'rgba(96,165,250,0.2)' : 'transparent', borderColor: prepVolumeMode === m ? '#60a5fa' : undefined, color: prepVolumeMode === m ? '#60a5fa' : undefined }}>
                    {m === 1.0 ? 'Сохранение (RIR 1–3)' : 'Поддерживающий ×0.85'}
                  </button>
                ))}
              </div>
              <div style={{ fontSize:9, color:'#fff', marginTop:3 }}>
                {prepVolumeMode === 1.0 ? 'Объём как в плане, RIR 1–3, без отказных техник, веса сохраняются' : 'Объём ×0.85 (дефицит), RIR 2–3, без отказных техник'}
                {' · '}{peds.length > 0 ? '💉 на курсе — восстановление выше, объём можно сохранять (×1.0)' : expYearsForPrep >= 2 ? 'natural: при дефиците рекомендуем ×0.85' : 'новичок: объём не снижать (×1.0), RIR 2–3'}
              </div>
            </div>
          </div>
          </div>
          {(prepWaterMode !== 'stable' || prepSodiumMode !== 'stable') && (
            <BbRowSwitch
              checked={prepConfirmedManip}
              onChange={setPrepConfirmedManip}
              icon="⚠"
              accent="#fbbf24"
              title="Я понимаю: умеренная модуляция воды/натрия допустима только при стабильном здоровье, без противопоказаний"
              desc="Диуретики не назначаются; при симптомах нарушения электролитов — план остановить. Подтверждаю выбор."
              ariaLabel="Подтверждаю модуляцию воды и натрия"
            />
          )}
          {/* PRO-2 P1: замок high-манипуляций без trial (движок back-compat, гейт на поверхности сборки) */}
          {(() => {
            try {
              const note = manipulationLockNote(buildContestPrepConfig());
              if (!note) return null;
              return (
                <div style={{ fontSize:10, color:'#fbbf24', background:'rgba(251,191,36,0.07)', border:'1px solid rgba(251,191,36,0.25)', borderRadius:8, padding:8, marginBottom:8, lineHeight:1.5 }}>
                  {note} Сборка с High заблокирована до trial (кнопка ниже вернёт ошибку) — tapered доступен с подтверждением выше.
                </div>
              );
            } catch { return null; }
          })()}
          <div style={{ fontSize:10, color:'#fff', background:'rgba(96,165,250,0.05)', border:'1px solid rgba(96,165,250,0.12)', borderRadius:8, padding:8, marginBottom:8, lineHeight:1.5 }}>
            <b style={{ color:'#60a5fa' }}>Что изменится в плане:</b> только финальная подготовка (×0.9, RIR 2–3), taper (объём 85%→60%, веса сохраняются, RIR 2–4) и пик-неделя (памп). Недели подготовки остаются по объёму 100% (режим подготовки: RIR 1–3, без отказных техник). Весь цикл НЕ переделывается; короткий план не расширяется автоматически — при необходимости добавьте недели подготовки.
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <button
              style={{ ...BTN, flex:1, background: 'linear-gradient(135deg,#ec4899,#db2777)', color:'#fff' }}
              disabled={prepBusy || !builtPlan}
              onClick={() => assembleContestPrep(true)}
            >
              {prepBusy ? 'Собираю…' : prepApplied ? '🔄 Пересобрать и применить' : '🏁 Собрать contest prep и применить'}
            </button>
            <button style={BTN_GHOST} onClick={() => assembleContestPrep(false)} disabled={prepBusy || !builtPlan}>💾 Только сохранить настройки</button>
            <button style={BTN_GHOST} onClick={() => setStep('adjust')}>Пропустить →</button>
          </div>
          {!builtPlan && <div style={{ fontSize:11, color:'#ef4444', marginTop:6 }}>Сначала соберите план тренировок (шаги 1-4).</div>}
        </div>
      {/* <</Params>> */}
    </>
  );
};

/** B — шапка результата + фазы + taper + недели подготовки + выполнение + чек-ины недельного лупа. */
export const BbContestPrepPreview: React.FC<{ ctx: BbContestPrepCtx }> = ({ ctx }) => {
  const { buildContestPrepConfig, builtPlan, currentPrepWeek, expYearsForPrep, handleSaveWeekCheckin, peds, phaseNow, prepApplied, prepPlan, setWkNote, setWkPsyche, setWkSessions, setWkSleep, setWkWaist, setWkWeek, setWkWeight, step, strengthDowns, weekRefs, weeklyLog, wkNote, wkPsyche, wkSessions, wkSleep, wkWaist, wkWeek, wkWeight } = ctx;
  return (
    <>
      {/* <<Preview>> */}
            <div style={{ fontSize:13, fontWeight:800, color:'#ec4899', marginBottom:4 }}>
              🏁 Contest prep · шоу {prepPlan.showDate} · {CONTEST_CATEGORY_LABELS[prepPlan.category as BBContestCategory]}
            </div>
            <div style={{ fontSize:10, color:'#fff', marginBottom:8 }}>
              {prepPlan.preparation.weeks} нед подготовки (финал {prepPlan.preparation.finalWeeks}) · taper {prepPlan.taper.weeks} нед · пик-неделя 7 дн · темп {prepPlan.preparation.targetRatePctPerWeek}%/нед · {prepPlan.preparation.currentCalories} ккал · {prepPlan.preparation.stepsPerDay} шагов
            </div>
            <div style={{ fontSize:10, color:'#fff', marginBottom:8 }}>
              {peds.length > 0 ? '💉 курс: объём ×1.0 (восстановление выше)' : '🌱 natural'} · стаж {expYearsForPrep} г ({prepPlan.safety.requiresReview ? '' : ''}{' '}
              {(() => { const e = buildContestPrepConfig().experienceLevel; return e === 'advanced' ? 'продвинутый' : e === 'beginner' ? 'новичок' : 'средний'; })()}
              ) · режим подготовки: объём {Math.round((prepPlan.preparation.volumeMult ?? 1) * 100)}%
            </div>
            {phaseNow && (
              <div style={{ fontSize:11, fontWeight:700, color:PREP_PHASE_COLORS[phaseNow.key as PrepPhaseKey], marginBottom:4 }}>
                📍 Сейчас: {PREP_PHASE_LABELS[phaseNow.key as PrepPhaseKey]} ({phaseNow.dateStart} — {phaseNow.dateEnd})
              </div>
            )}
            {(() => {
              const totalWeeks = prepPlan.phases.reduce((m: any, p: any) => Math.max(m, p.weekEnd), 0);
              const passedWeeks = Math.max(0, Math.min(totalWeeks, (() => {
                const now = isoToday();
                const p = prepPhaseForDate(prepPlan, now);
                if (!p) return now > prepPlan.showDate ? totalWeeks : 0;
                return p.weekStart;
              })()));
              const pct = totalWeeks > 0 ? Math.round((passedWeeks / totalWeeks) * 100) : 0;
              return (
                <div style={{ marginBottom:8 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'#fff', marginBottom:2 }}>
                    <span>Прогресс подготовки</span>
                    <span>неделя {passedWeeks} из {totalWeeks} ({pct}%)</span>
                  </div>
                  <div style={{ height:5, borderRadius:3, background:'rgba(255,255,255,0.08)', overflow:'hidden' }}>
                    <div style={{ width:`${pct}%`, height:'100%', borderRadius:3, background:'linear-gradient(90deg,#3b82f6,#ec4899)' }} />
                  </div>
                </div>
              );
            })()}

            {/* Фазы календарём */}
            <div style={{ overflowX:'auto', marginBottom:10 }}>
              <table style={{ width:'100%', fontSize:10, borderCollapse:'collapse', minWidth:520 }}>
                <thead>
                  <tr style={{ color:'#fff', textAlign:'left' }}>
                    <th style={{ padding:'4px 6px' }}>Фаза</th>
                    <th style={{ padding:'4px 6px' }}>Недели</th>
                    <th style={{ padding:'4px 6px' }}>Даты</th>
                    <th style={{ padding:'4px 6px' }}>Задача</th>
                  </tr>
                </thead>
                <tbody>
                  {prepPlan.phases.map((p: any) => (
                    <tr key={p.key} style={{ borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding:'4px 6px', fontWeight:700, color:PREP_PHASE_COLORS[p.key as PrepPhaseKey] }}>
                        {p.weekStart === p.weekEnd && p.key === 'show_day' ? '🎬' : ''} {p.label}
                      </td>
                      <td style={{ padding:'4px 6px' }}>
                        {p.key === 'show_day' ? 'день шоу' : p.key === 'post_show' ? 'после шоу' : `${p.weekStart}–${p.weekEnd}`}
                      </td>
                      <td style={{ padding:'4px 6px', color:'#fff' }}>{p.dateStart} — {p.dateEnd}</td>
                      <td style={{ padding:'4px 6px', color:'#fff' }}>{p.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 🗺 Гент-диаграмма фаз по неделям */}
            {(() => {
              const maxWeek = prepPlan.phases.reduce((m: any, p: any) => Math.max(m, p.weekEnd), 0);
              const cells: { color: string; label: string; week: number }[] = [];
              for (let wk = 1; wk <= maxWeek; wk++) {
                const p = prepPlan.phases.find((q: any) => q.key !== 'show_day' && wk >= q.weekStart && wk <= q.weekEnd);
                cells.push({ color: p?.color ?? 'rgba(255,255,255,0.06)', label: p?.label ?? '', week: wk });
              }
              const todayWeek = (() => {
                const now = isoToday();
                const p = prepPhaseForDate(prepPlan, now);
                return p && p.weekStart >= 1 && p.weekStart <= maxWeek ? p.weekStart : null;
              })();
              return (
                <div style={{ marginBottom:10 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#fff', marginBottom:4 }}>🗺 Фазы по неделям {todayWeek ? `· 📍 сейчас: неделя ${todayWeek}` : ''}</div>
                  <div style={{ display:'flex', gap:2, overflowX:'auto', paddingBottom:4 }}>
                    {cells.map((c, i) => (
                      <div key={i} style={{ flex:'0 0 auto', width:22, textAlign:'center' }} title={`Нед ${c.week}: ${c.label}`}>
                        <div style={{ height:34, borderRadius:4, background:c.color, border: c.week === todayWeek ? '2px solid #fff' : '1px solid rgba(255,255,255,0.08)' }} />
                        <div style={{ fontSize:8, color:'#fff', marginTop:2 }}>{c.week}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:4 }}>
                    {prepPlan.phases.filter((p: any) => p.key !== 'show_day').map((p: any) => (
                      <span key={p.key} style={{ fontSize:9, color:'#fff', display:'flex', alignItems:'center', gap:4 }}>
                        <span style={{ width:8, height:8, borderRadius:2, background:PREP_PHASE_COLORS[p.key as PrepPhaseKey], display:'inline-block' }} />
                        {PREP_PHASE_LABELS[p.key as PrepPhaseKey]}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Taper-кривая */}
            <div style={{ fontSize:11, fontWeight:700, color:'#f59e0b', marginBottom:4 }}>📉 Кривая taper (объём ↓, интенсивность сохраняется, RIR 2–4)</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
              {prepPlan.taper.volumeProfile.map((v: any, i: any) => (
                <div key={i} style={{ padding:'6px 10px', borderRadius:8, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)', fontSize:10 }}>
                  <div style={{ color:'#fff' }}>Нед {prepPlan.taper.weeks - i}</div>
                  <div style={{ color:'#fbbf24', fontWeight:700 }}>объём {Math.round(v * 100)}%</div>
                  <div style={{ color:'#60a5fa' }}>вес {Math.round(prepPlan.taper.intensityProfile[i] * 100)}%</div>
                  <div style={{ color:'#4ade80' }}>RIR {prepPlan.taper.rirProfile[i]?.[0]}–{prepPlan.taper.rirProfile[i]?.[1]}</div>
                </div>
              ))}
            </div>

            {/* 📉 Недели taper — тренировочный цикл, наложенный на план */}
            {prepApplied && builtPlan && (() => {
              const taperWeeksList = builtPlan.weeks
                .filter((w: any) => w.contestPhase === 'taper' || w.contestPhase === 'peak_week')
                .map((w: any, wi: number) => {
                  const totalSets = w.sessions.reduce((a: number, s: any) => a + s.exercises.reduce((b: number, e: any) => b + (e.sets || 0), 0), 0);
                  const rirMin = Math.min(...w.sessions.flatMap((s: any) => s.exercises.map((e: any) => e.rir ?? 3)));
                  const firstEx = w.sessions[0]?.exercises?.[0];
                  return { w, wi, totalSets, rirMin, firstEx };
                });
              if (taperWeeksList.length === 0) return null;
              return (
                <div style={{ marginBottom:10 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#f472b6', marginBottom:4 }}>📉 Недели taper (тренировочный цикл в плане)</div>
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', fontSize:10, borderCollapse:'collapse', minWidth:460 }}>
                      <thead>
                        <tr style={{ color:'#fff', textAlign:'left' }}>
                          <th style={{ padding:'4px 6px' }}>Нед</th>
                          <th style={{ padding:'4px 6px' }}>Фаза</th>
                          <th style={{ padding:'4px 6px', textAlign:'right' }}>Сетов</th>
                          <th style={{ padding:'4px 6px', textAlign:'right' }}>RIR</th>
                          <th style={{ padding:'4px 6px' }}>Нагрузка</th>
                        </tr>
                      </thead>
                      <tbody>
                        {taperWeeksList.map(({ w, wi, totalSets, rirMin, firstEx }: any) => (
                          <tr key={wi} style={{ borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                            <td style={{ padding:'4px 6px', fontWeight:700 }}>{(w as any).week}</td>
                            <td style={{ padding:'4px 6px', color: PREP_PHASE_COLORS[(w as any).contestPhase as PrepPhaseKey] ?? '#f472b6', fontWeight:700 }}>
                              {(w as any).contestPhase === 'peak_week' ? '🎭 Пик-неделя' : 'Тапер'}
                            </td>
                            <td style={{ padding:'4px 6px', textAlign:'right' }}>{totalSets}</td>
                            <td style={{ padding:'4px 6px', textAlign:'right' }}>{rirMin}–4</td>
                            <td style={{ padding:'4px 6px', color:'#fff' }}>
                              {firstEx ? `${firstEx.name}${firstEx.workSets?.[0]?.weight ? ` · ${firstEx.workSets[0].weight} кг` : ''}` : 'памп/отдых'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ fontSize:9, color:'#fff', marginTop:3 }}>
                    Объём снижается, веса сохраняются, RIR 2–4, без отказа и новых упражнений. Изменения настроек ниже пересобирают эти недели.
                  </div>
                  {/* PRO-2 P4: тапер≠делод + last-hard по группам */}
                  <div style={{ fontSize:9, color:'#fff', marginTop:4, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.15)', borderRadius:6, padding:6 }}>
                    {TAPER_VS_DELOAD_NOTE}
                  </div>
                  <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:4 }}>
                    {([['legs','Ноги'],['back','Спина'],['chest','Грудь+дельты'],['biceps','Руки']] as const).map(([key, ru]) => (
                      <span key={key} style={{ fontSize:9, color:'#fff', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:999, padding:'3px 8px' }}>
                        {ru}: <b>{lastHardDayForMuscle(key).slice(0, 4)}</b>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* 🏋️ Недели подготовки (режим подготовки) */}
            {prepApplied && builtPlan && (() => {
              const prepWeeksList = builtPlan.weeks
                .filter((w: any) => w.contestPhase === 'preparation' || w.contestPhase === 'final_preparation')
                .map((w: any) => {
                  const totalSets = w.sessions.reduce((a: number, s: any) => a + s.exercises.reduce((b: number, e: any) => b + (e.sets || 0), 0), 0);
                  const rir = Math.min(...w.sessions.flatMap((s: any) => s.exercises.map((e: any) => e.rir ?? 3)));
                  return { w, totalSets, rir };
                });
              if (prepWeeksList.length === 0) return null;
              const shown = prepWeeksList.slice(0, 4);
              const rest = prepWeeksList.length - shown.length;
              return (
                <div style={{ marginBottom:10 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#60a5fa', marginBottom:4 }}>🏋️ Недели подготовки (режим подготовки)</div>
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', fontSize:10, borderCollapse:'collapse', minWidth:420 }}>
                      <thead>
                        <tr style={{ color:'#fff', textAlign:'left' }}>
                          <th style={{ padding:'4px 6px' }}>Нед</th>
                          <th style={{ padding:'4px 6px' }}>Фаза</th>
                          <th style={{ padding:'4px 6px', textAlign:'right' }}>Сетов</th>
                          <th style={{ padding:'4px 6px', textAlign:'right' }}>RIR</th>
                          <th style={{ padding:'4px 6px' }}>Режим</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shown.map(({ w, totalSets, rir }: any) => (
                          <tr key={(w as any).week} style={{ borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                            <td style={{ padding:'4px 6px', fontWeight:700 }}>{(w as any).week}</td>
                            <td style={{ padding:'4px 6px', color: PREP_PHASE_COLORS[(w as any).contestPhase as PrepPhaseKey] ?? '#60a5fa', fontWeight:700 }}>
                              {(w as any).contestPhase === 'final_preparation' ? 'Финальная' : 'Подготовка'}
                            </td>
                            <td style={{ padding:'4px 6px', textAlign:'right' }}>{totalSets}</td>
                            <td style={{ padding:'4px 6px', textAlign:'right' }}>{rir}</td>
                            <td style={{ padding:'4px 6px', color:'#fff', fontSize:9 }}>
                              {String((w as any).prepProtocol || '').startsWith('Подготовка') ? 'RIR 1–3, без отказа' : String((w as any).prepProtocol || '').startsWith('Финальная') ? '×0.9, RIR 2–3' : 'как в плане'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ fontSize:9, color:'#fff', marginTop:3 }}>
                    {rest > 0 ? `и ещё ${rest} недель подготовки с тем же режимом. ` : ''}
                    Объём подготовки не переделывает цикл: меняются только RIR/техники (+объём при выборе ×0.85), веса сохраняются.
                  </div>
                  {/* PRO-2 P7: diet-break длинного препа */}
                  {prepPlan.preparation.weeks >= 16 && (() => {
                    const breaks = prepDietBreaks(prepPlan);
                    if (breaks.length === 0) return null;
                    const start = prepPlan.preparation.startDate;
                    const nums = Array.from(new Set(breaks.map(d => {
                      const [y, m, dd] = d.split('-').map(Number);
                      const [sy, sm, sd] = start.split('-').map(Number);
                      return Math.floor((new Date(y, m - 1, dd).getTime() - new Date(sy, sm - 1, sd).getTime()) / 604800000) + 1;
                    }))).sort((a, b) => a - b);
                    return (
                      <div style={{ fontSize:9, color:'#fff', marginTop:4, background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.15)', borderRadius:6, padding:6 }}>
                        🏖 Diet break: нед {nums.join(', ')} — на поддержании дня (гормоны/психика). Цели рациона переключатся автоматически.
                      </div>
                    );
                  })()}
                </div>
              );
            })()}

            {/* 📈 Выполнение подготовки (план vs факт по дневнику) */}
            {prepApplied && builtPlan && (() => {
              try {
                const compliance = prepTrainingCompliance(
                  prepPlan,
                  builtPlan.weeks.map((w: any) => ({
                    week: (w as any).week,
                    contestPhase: (w as any).contestPhase,
                    plannedSets: w.sessions.reduce((a: number, s: any) => a + s.exercises.reduce((b: number, e: any) => b + (e.sets || 0), 0), 0),
                  })),
                  loadSessions().map(s => ({ date: s.date, totalSets: s.totalSets })),
                );
                const shown = compliance.weeks.slice(0, 8);
                const statusColor: Record<string, string> = { done: '#4ade80', partial: '#fbbf24', missed: '#f87171', upcoming: '#fff' };
                const statusLabel: Record<string, string> = { done: '✓', partial: '◐', missed: '✗', upcoming: '…' };
                return (
                  <div style={{ marginBottom:10 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#4ade80', marginBottom:4 }}>
                      📈 Выполнение подготовки · {Math.round(compliance.overallPct * 100)}% от плана · завершено недель: {compliance.completedWeeks}/{compliance.elapsedWeeks}
                    </div>
                    <div style={{ overflowX:'auto' }}>
                      <table style={{ width:'100%', fontSize:10, borderCollapse:'collapse', minWidth:460 }}>
                        <thead>
                          <tr style={{ color:'#fff', textAlign:'left' }}>
                            <th style={{ padding:'4px 6px' }}>Нед</th>
                            <th style={{ padding:'4px 6px' }}>Фаза</th>
                            <th style={{ padding:'4px 6px', textAlign:'right' }}>План</th>
                            <th style={{ padding:'4px 6px', textAlign:'right' }}>Факт</th>
                            <th style={{ padding:'4px 6px', textAlign:'right' }}>%</th>
                            <th style={{ padding:'4px 6px' }}>Статус</th>
                          </tr>
                        </thead>
                        <tbody>
                          {shown.map(c => (
                            <tr key={c.week} style={{ borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                              <td style={{ padding:'4px 6px', fontWeight:700 }}>{c.week}</td>
                              <td style={{ padding:'4px 6px', color: PREP_PHASE_COLORS[c.phase ?? 'preparation'] ?? '#fff' }}>
                                {c.phase === 'preparation' ? 'Подготовка' : c.phase === 'final_preparation' ? 'Финальная' : c.phase === 'taper' ? 'Тапер' : 'Пик'}
                              </td>
                              <td style={{ padding:'4px 6px', textAlign:'right' }}>{c.plannedSets}</td>
                              <td style={{ padding:'4px 6px', textAlign:'right' }}>{c.actualSets}</td>
                              <td style={{ padding:'4px 6px', textAlign:'right' }}>{Math.round(c.pct * 100)}%</td>
                              <td style={{ padding:'4px 6px', color: statusColor[c.status] ?? '#fff', fontWeight:700 }}>{statusLabel[c.status] ?? c.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ fontSize:9, color:'#fff', marginTop:3 }}>{compliance.recommendation}</div>
                  </div>
                );
                } catch { return null; }
              })()}

            {/* 📊 Недели подготовки — недельный луп чек-инов (Э4) */}
            {prepPlan && weekRefs.length > 0 && (
              <div style={{ marginBottom:10, padding:10, borderRadius:10, background:'rgba(59,130,246,0.06)', border:'1px solid rgba(59,130,246,0.18)' }}>
                <div style={{ fontSize:11, fontWeight:800, color:'#60a5fa', marginBottom:6 }}>
                  📊 Недели подготовки · чек-ины {weeklyLog.length}/{weekRefs.length}
                </div>
                {strengthDowns.length > 0 && (
                  <div style={{ fontSize:10, color:'#fbbf24', marginBottom:6 }}>
                    {strengthDowns.map((s: any) => `📉 ${s.exercise}: e1RM ${s.before} → ${s.after} кг (${s.deltaPct}%)`).join(' · ')}
                    <div style={{ color:'#fff' }}>Сила падает на дефиците — не заглубляйте дефицит и не добавляйте кардио; проверьте сон/белок.</div>
                  </div>
                )}
                {(() => {
                  const last = weeklyLog[weeklyLog.length - 1];
                  const prev = weeklyLog[weeklyLog.length - 2];
                  const stuck = last && prev && last.advice !== 'on_track' && last.advice !== 'no_data' && last.advice === prev.advice
                    && (last.advice === 'too_fast' || last.advice === 'too_slow');
                  return stuck ? (
                    <div style={{ fontSize:10, color:'#fbbf24', marginBottom:6 }}>
                      ⚠ {last.advice === 'too_fast' ? 'Темп выше цели 2 недели подряд' : 'Темп ниже цели 2 недели подряд'} — примените одну переменную в блоке «⚖️ Адаптация по весу» ниже.
                    </div>
                  ) : null;
                })()}
                <div style={{ overflowX:'auto', marginBottom:8 }}>
                  <table style={{ width:'100%', fontSize:9, borderCollapse:'collapse', minWidth:520 }}>
                    <thead>
                      <tr style={{ color:'#fff', textAlign:'left' }}>
                        <th style={{ padding:'3px 5px' }}>Нед</th>
                        <th style={{ padding:'3px 5px' }}>Даты</th>
                        <th style={{ padding:'3px 5px' }}>Фаза</th>
                        <th style={{ padding:'3px 5px', textAlign:'right' }}>Вес ср</th>
                        <th style={{ padding:'3px 5px', textAlign:'right' }}>Δ</th>
                        <th style={{ padding:'3px 5px', textAlign:'right' }}>Сон</th>
                        <th style={{ padding:'3px 5px', textAlign:'right' }}>Сесс</th>
                        <th style={{ padding:'3px 5px', textAlign:'right' }}>Пси</th>
                        <th style={{ padding:'3px 5px' }}>Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weekRefs.map((r: any) => {
                        const c = weeklyLog.find((x: any) => x.week === r.week);
                        const prevC = weeklyLog.find((x: any) => x.week === r.week - 1);
                        const delta = c?.weightAvg != null && prevC?.weightAvg != null
                          ? Math.round((c.weightAvg - prevC.weightAvg) * 10) / 10 : null;
                        const isCur = r.week === currentPrepWeek;
                        return (
                          <tr key={r.week} style={{ borderTop:'1px solid rgba(255,255,255,0.05)', background: isCur ? 'rgba(59,130,246,0.08)' : undefined }}>
                            <td style={{ padding:'3px 5px', fontWeight:800 }}>{r.week}{isCur ? ' ●' : ''}</td>
                            <td style={{ padding:'3px 5px', color:'#fff' }}>{r.dateStart.slice(5).replace('-','.')}–{r.dateEnd.slice(5).replace('-','.')}</td>
                            <td style={{ padding:'3px 5px', color:'#fff' }}>{r.phaseLabel}</td>
                            <td style={{ padding:'3px 5px', textAlign:'right' }}>{c?.weightAvg ?? '—'}</td>
                            <td style={{ padding:'3px 5px', textAlign:'right', color: delta != null && delta > 0 ? '#fbbf24' : '#fff' }}>{delta != null ? (delta > 0 ? `+${delta}` : `${delta}`) : '—'}</td>
                            <td style={{ padding:'3px 5px', textAlign:'right' }}>{c?.sleepAvg ?? '—'}</td>
                            <td style={{ padding:'3px 5px', textAlign:'right' }}>{c?.sessionsDone ?? '—'}</td>
                            <td style={{ padding:'3px 5px', textAlign:'right' }}>{c?.psyche ?? '—'}</td>
                            <td style={{ padding:'3px 5px', color:'#fff' }}>{c?.advice && c.advice !== 'no_data' ? c.advice : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center', marginBottom:6 }}>
                  <span style={{ fontSize:10, color:'#fff' }}>Нед:</span>
                  <input type="number" min={1} max={weekRefs.length} value={wkWeek ?? currentPrepWeek} onChange={e => setWkWeek(Math.min(weekRefs.length, Math.max(1, parseInt(e.target.value) || currentPrepWeek)))} style={{ width:56, ...IN }} />
                  <input type="number" step={0.1} placeholder="Вес ср, кг" value={wkWeight} onChange={e => setWkWeight(e.target.value)} style={{ width:86, ...IN }} />
                  <input type="number" step={0.5} placeholder="Талия, см" value={wkWaist} onChange={e => setWkWaist(e.target.value)} style={{ width:86, ...IN }} />
                  <input type="number" step={0.5} placeholder="Сон, ч" value={wkSleep} onChange={e => setWkSleep(e.target.value)} style={{ width:70, ...IN }} />
                  <input type="number" step={1} placeholder="Сессии" value={wkSessions} onChange={e => setWkSessions(e.target.value)} style={{ width:70, ...IN }} />
                  <input type="number" step={1} min={1} max={5} placeholder="Пси 1-5" value={wkPsyche} onChange={e => setWkPsyche(e.target.value)} style={{ width:70, ...IN }} />
                  <input placeholder="Заметка" value={wkNote} onChange={e => setWkNote(e.target.value)} style={{ flex:'1 1 120px', ...IN }} />
                  <button style={BTN_GHOST} onClick={handleSaveWeekCheckin}>💾 Чек-ин</button>
                </div>
                {!prepPlan.testPeakWeekId && (
                  <div style={{ fontSize:10, color:'#fff' }}>🧪 Trial peak ещё не сделан — прогоните репетицию за 21–28 дней до шоу (блок ниже), стратегия пика станет точнее.</div>
                )}
              </div>
            )}

      {/* <</Preview>> */}
    </>
  );
};

/** C — Test Peak Week (шаг 4) + безопасность + чек-лист шоу + мед-процесс + питание на сегодня. */
export const BbContestPrepTrialSafety: React.FC<{ ctx: BbContestPrepCtx }> = ({ ctx }) => {
  const { contestWizard, flash, handleRunTestPeakWeek, lastTest, liveFull, liveVisual, liveWater, prepPlan, recarb, setLiveFull, setLiveVisual, setLiveWater, setRecarb, setShowCheck, setTestRatings, setTestWeightDelta, showCheck, step, testRatings, testWeightDelta, today } = ctx;
  return (
    <>
      {/* <<TrialSafety>> */}
            {/* 🧪 Test Peak Week — wizard 4 */}
            <div style={{ display: contestWizard===4 ? 'block' : 'none', marginBottom:10, padding:10, borderRadius:10, background:'rgba(168,85,247,0.05)', border:'1px solid rgba(168,85,247,0.18)' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#a855f7', marginBottom:6 }}>🧪 Test Peak Week (не меняет основной план)</div>
              <div style={{ fontSize:10, color:'#fff', marginBottom:8 }}>
                Прогоните протокол за 3–4 недели до шоу и зафиксируйте реакцию — результат сохраняется ({'testPeakWeekId'}) и влияет на стратегию основной пик-недели.
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                {([
                  ['carbTolerance', 'Переносимость углеводов'],
                  ['digestion', 'Пищеварение'],
                  ['fullness', 'Наполненность'],
                  ['waterRetention', 'Вода ушла (5 = ушла)'],
                  ['pump', 'Пампинг'],
                  ['sleep', 'Сон'],
                ] as const).map(([key, label]) => (
                  <div key={key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:6, fontSize:10 }}>
                    <span style={{ color:'#fff' }}>{label}</span>
                    <div style={{ display:'flex', gap:3 }}>
                      {[1, 2, 3, 4, 5].map(v => (
                        <button
                          key={v}
                          onClick={() => setTestRatings((r: any) => ({ ...r, [key]: v }))}
                          style={{
                            width: 22, height: 22, borderRadius: 6, fontSize: 9, cursor: 'pointer', color: '#fff',
                            border: '1px solid rgba(168,85,247,0.3)',
                            background: (testRatings[key] ?? 3) === v ? 'rgba(168,85,247,0.5)' : 'rgba(255,255,255,0.03)',
                          }}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:8, flexWrap:'wrap' }}>
                <span style={{ fontSize:10, color:'#fff' }}>Δ веса за неделю, кг:</span>
                <input type="number" step={0.1} value={testWeightDelta} onChange={e => setTestWeightDelta(parseFloat(e.target.value) || 0)} style={{ width:70, ...IN }} />
                <button style={{ ...BTN_GHOST, borderColor:'#a855f7', color:'#a855f7' }} onClick={handleRunTestPeakWeek}>💾 Сохранить тест</button>
              </div>
              {lastTest && (
                <div style={{ marginTop:8, fontSize:10, color:'#fff' }}>
                  <div style={{ fontWeight:700, color: lastTest.verdict === 'tested_ok' ? '#4ade80' : lastTest.verdict === 'adjust' ? '#ef4444' : '#fbbf24' }}>
                    {lastTest.verdict === 'tested_ok' ? '✅ Протокол подходит (strategy: tested)' : lastTest.verdict === 'adjust' ? '⚠ Нужна коррекция' : '🔶 Консервативный режим'}
                  </div>
                  <div style={{ color:'#fff', marginTop:2 }}>{lastTest.recommendation}</div>
                  <div style={{ color:'#a78bfa', marginTop:4 }}>PRO рекомендация загрузки: <b>{recommendCarbStrategyFromTrial(lastTest)}</b> (spill→back, flat→front, волна→undulating)</div>
                  {/* PRO-2 P2: персональная доза загрузки из trial (Homer 2024: 3–12 г/кг, титрация по trial) */}
                  <div style={{ color:'#4ade80', marginTop:2 }}>
                    Доза trial: <b>{trialCarbDoseGPerKg(lastTest, prepPlan.category, prepPlan.sex)} г/кг</b> total за 36–48 ч
                    (коридор {CATEGORY_PROFILES[prepPlan.category as BBContestCategory]?.carbTotalBudgetGPerKg?.join('–') ?? ''} г/кг) — применится к финальной пик-неделе через «Пересобрать и применить».
                  </div>
                  <div style={{ color:'#38bdf8', marginTop:2 }}>Live-adjust D-1: {liveAdjustForPeakDay(lastTest.responses.fullness, 6 - lastTest.responses.waterRetention, lastTest.responses.waterRetention).note}</div>
                  {prepPlan.testPeakWeekId && (
                    <div style={{ color:'#fff', marginTop:4 }}>
                      Стратегия основной пик-недели: <b>{resolvePeakStrategy(prepPlan)}</b>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Безопасность */}
            {prepPlan.safety.warnings.length > 0 && (
              <div style={{ marginBottom:10 }}>
                {prepPlan.safety.warnings.map((w: any, i: any) => (
                  <div key={i} style={{ fontSize:10, color: w.startsWith('⛔') ? '#ef4444' : '#f87171', marginTop:2 }}>{w}</div>
                ))}
              </div>
            )}
            {prepPlan.safety.requiresReview && (
              <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', marginBottom:6 }}>
                🩺 Требуется профессиональное сопровождение (противопоказания: {prepPlan.safety.contraindications.join(', ')}). Агрессивные режимы отключены.
              </div>
            )}

            {/* 🩸 RED-S-скрин (PRO-3 Э3): EA из ккал подготовки + CAT2-светофор (IOC REDs) */}
            {(() => {
              const ea = computeEA({
                intakeKcal: prepPlan.preparation.currentCalories,
                weightKg: prepPlan.preparation.startingWeightKg,
                lbmKg: 0,
                isTrainingDay: true, trainDurationMin: 75, trainIntensity: 'medium',
                sex: prepPlan.sex,
              });
              const cat2 = calcRedsCAT2({ ea: ea.ea, sex: prepPlan.sex });
              return (
                <div data-bb="reds-screen" style={{ marginBottom:10, padding:10, borderRadius:10, background:'rgba(239,68,68,0.05)', border:"1px solid rgba(239,68,68,0.25)" }}>
                  <div style={{ fontSize:11, fontWeight:800, color: cat2.color, marginBottom:4 }}>
                    🩸 RED-S-скрин (IOC CAT2): {ea.zoneLabel} · EA {ea.ea} ккал/кг FFM
                  </div>
                  <div style={{ fontSize:10, color:'#fff' }}>{cat2.note}</div>
                  <div style={{ fontSize:10, color:'#fff', marginTop:2 }}>Выход: {cat2.returnToPlay}</div>
                  <div style={{ fontSize:9, color:'#fff', marginTop:4 }}>
                    Оценка по ккал подготовки ({prepPlan.preparation.currentCalories}) и тренировочному дню (~75 мин);
                    точный EA — по факту рациона/кардио («🧬 Нагрузка» в питании).{(cat2.light === 'red' || cat2.light === 'orange') ? ' ⛔ До старта препа — консультация врача (цикл/кости/щитовидка).' : ''}
                  </div>
                </div>
              );
            })()}

            {/* 📋 Чек-лист шоу D-10…D-0 + live-adjust (Э5) */}
            {(() => {
              const items = buildShowChecklist(prepPlan.showDate);
              const done = items.filter(i => showCheck[`${prepPlan.showDate}_${i.id}`]).length;
              const live = liveAdjustForPeakDay(liveFull, 6 - liveWater, liveWater);
              return (
                <div style={{ marginBottom:10, padding:10, borderRadius:10, background:'rgba(251,191,36,0.06)', border:'1px solid rgba(251,191,36,0.22)' }}>
                  <div style={{ fontSize:11, fontWeight:800, color:'#fbbf24', marginBottom:6 }}>
                    📋 Чек-лист шоу · {done}/{items.length}
                  </div>
                  {items.map(item => {
                    const key = `${prepPlan.showDate}_${item.id}`;
                    const checked = !!showCheck[key];
                    return (
                      <div key={item.id} style={{ padding:'2px 0' }}>
                        <BbToggleChip
                          checked={checked}
                          ariaLabel={item.label}
                          onChange={() => {
                            try { setShowCheck(toggleShowChecklistItem(prepPlan.showDate, item.id)); } catch { /* ignore */ }
                          }}
                          label={(
                            <span style={{ textDecoration: checked ? 'line-through' : 'none' }}>
                              <b style={{ color:'#fbbf24' }}>{item.dayOffset === 0 ? 'D-0' : `D-${item.dayOffset}`}</b>
                              {' · '}{item.date.slice(5).replace('-','.')} · {item.label}
                              {item.detail && <span style={{ color:'#fff' }}> — {item.detail}</span>}
                            </span>
                          )}
                        />
                      </div>
                    );
                  })}
                  <div style={{ marginTop:8, paddingTop:8, borderTop:'1px solid rgba(251,191,36,0.2)' }}>
                    <div style={{ fontSize:10, fontWeight:800, color:'#fbbf24', marginBottom:4 }}>🎯 Live-adjust (утро D-3…D-1 реальной пик-недели)</div>
                    <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center', fontSize:10, color:'#fff' }}>
                      <span>Наполненность (1=плоско):</span>
                      <span style={{ display:'flex', gap:3 }}>
                        {[1,2,3,4,5].map(v => (
                          <button key={v} onClick={() => setLiveFull(v)} style={{ width:24, height:24, borderRadius:6, fontSize:10, cursor:'pointer', color:'#fff', border:'1px solid rgba(251,191,36,0.35)', background: liveFull === v ? 'rgba(251,191,36,0.45)' : 'rgba(255,255,255,0.03)' }}>{v}</button>
                        ))}
                      </span>
                      <span>Вода ушла (5=ушла):</span>
                      <span style={{ display:'flex', gap:3 }}>
                        {[1,2,3,4,5].map(v => (
                          <button key={v} onClick={() => setLiveWater(v)} style={{ width:24, height:24, borderRadius:6, fontSize:10, cursor:'pointer', color:'#fff', border:'1px solid rgba(251,191,36,0.35)', background: liveWater === v ? 'rgba(251,191,36,0.45)' : 'rgba(255,255,255,0.03)' }}>{v}</button>
                        ))}
                      </span>
                    </div>
                    <div style={{ fontSize:10, color: live.status === 'on_track' ? '#4ade80' : '#fbbf24', marginTop:4 }}>
                      {live.status === 'flat' ? '📉 ' : live.status === 'spill' ? '💧 ' : '✅ '}{live.note}
                    </div>
                    {/* PRO-2 P2-доводка: пересчёт оставшихся load-дней по визуалу */}
                    <div style={{ marginTop:6, paddingTop:6, borderTop:'1px solid rgba(251,191,36,0.2)' }}>
                      <div style={{ fontSize:10, fontWeight:800, color:'#fbbf24', marginBottom:4 }}>🔄 Пересчёт load-дней по визуалу (остаток пик-недели)</div>
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center', fontSize:10, color:'#fff' }}>
                        {([['flat', '📉 Плоско'], ['full', '✅ Норма'], ['spill', '💧 Залило']] as const).map(([v, label]) => (
                          <button key={v} onClick={() => { setLiveVisual(v); setRecarb(null); }} aria-pressed={liveVisual === v} style={{ minHeight:44, padding:'6px 10px', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer', color: liveVisual === v ? '#fbbf24' : '#fff', border:'1px solid rgba(251,191,36,0.35)', background: liveVisual === v ? 'rgba(251,191,36,0.25)' : 'rgba(255,255,255,0.03)' }}>{label}</button>
                        ))}
                        <button
                          onClick={() => {
                            try {
                              const base = buildPeakWeek(configFromPlan(prepPlan), prepPlan.peakWeek.carbDoseGPerKg != null ? { carbDoseGPerKg: prepPlan.peakWeek.carbDoseGPerKg } : undefined);
                              const loads = base.filter(d => d.phase.startsWith('load'));
                              const adj = recarbLoadFromVisual(loads, liveVisual);
                              setRecarb(adj.map(d => ({ day: d.day, phase: d.phaseLabel, carbsG: d.carbsG, kcal: d.kcal })));
                              try { localStorage.setItem(`he_peak_recarb_${prepPlan.showDate}`, JSON.stringify({ visual: liveVisual, at: new Date().toISOString(), days: adj.map(d => ({ day: d.day, carbsG: d.carbsG, kcal: d.kcal })) })); } catch { /* ignore */ }
                              flash(`🔄 Load-дни пересчитаны (${liveVisual === 'flat' ? '+75г' : liveVisual === 'spill' ? '−100г' : 'без изменений'} на остаток)`);
                            } catch { flash('Не удалось пересчитать load-дни'); }
                          }}
                          style={{ minHeight:44, padding:'6px 12px', borderRadius:8, fontSize:11, fontWeight:800, cursor:'pointer', color:'#fff', border:'1px solid #fbbf24', background:'rgba(251,191,36,0.2)' }}
                        >
                          🔄 Пересчитать load-дни
                        </button>
                      </div>
                      {recarb && recarb.length > 0 && (
                        <div style={{ fontSize:10, color:'#fff', marginTop:6 }}>
                          {recarb.map((r: any) => (
                            <div key={r.day}>Д{r.day} ({r.phase}): <b>{r.carbsG}г</b> · {r.kcal} ккал</div>
                          ))}
                          <div style={{ fontSize:9, color:'#fff', marginTop:2 }}>Цифры для приёмов пищи (persist — переживает перезапуск). Дневник/рацион не переписываются.</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 🩺 Мед-процесс подготовки (Э6): лаба к шоу + процедуры doctorOnly + гидратация */}
            <CollapsibleCard title="🩺 Мед-процесс подготовки · анализы и мониторинг" badge="не назначения">
              <div style={{ fontSize:10, color:'#fbbf24', marginBottom:6 }}>
                ⚠ Медицинский чек-лист и мониторинг, НЕ назначения. Процедуры/анализы — только под контролем врача.
              </div>
              <div style={{ fontSize:11, fontWeight:800, color:'#fff', margin:'6px 0 4px' }}>🧪 Панель анализов к шоу</div>
              {PREP_LAB_PANEL.map(item => {
                const contra = prepPlan.safety.contraindications.join(' ').toLowerCase();
                const hot = (contra.includes('kidney') && /почк|eGFR|ОАМ/i.test(item.name))
                  || ((contra.includes('heart') || contra.includes('hypertension') || contra.includes('hyper')) && /кардио|ЭКГ|АД/i.test(item.name + item.why))
                  || /электролит|гипонатрием/i.test(item.name + item.why);
                return (
                  <div key={item.name} style={{ fontSize:10, color:'#fff', padding:'4px 6px', marginBottom:3, borderRadius:6, background: hot ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)', border: hot ? '1px solid rgba(239,68,68,0.35)' : '1px solid rgba(255,255,255,0.06)' }}>
                    <b>{item.name}</b> <span style={{ color:'#fff' }}>· {item.when}</span>
                    <div style={{ color:'#fff' }}>{item.why}</div>
                  </div>
                );
              })}
              <div style={{ fontSize:11, fontWeight:800, color:'#fff', margin:'8px 0 4px' }}>👨‍⚕️ Процедуры — только по назначению врача</div>
              {PREP_PROCEDURES.map(p => (
                <div key={p.id} style={{ fontSize:10, color:'#fff', padding:'4px 6px', marginBottom:3, borderRadius:6, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
                  <b>{p.name}</b> <span style={{ fontSize:8, fontWeight:800, color:'#fbbf24', border:'1px solid rgba(251,191,36,0.4)', borderRadius:999, padding:'0 6px' }}>👨‍⚕️ doctorOnly</span>
                  <div>{p.indication}</div>
                  <div style={{ color:'#f87171' }}>{p.warning}</div>
                </div>
              ))}
              <div style={{ fontSize:11, fontWeight:800, color:'#fff', margin:'8px 0 4px' }}>💧 Гидратация</div>
              {PREP_HYDRATION_GUIDELINES.map((g, i) => (
                <div key={i} style={{ fontSize:10, color:'#fff', marginBottom:2 }}>• {g}</div>
              ))}
            </CollapsibleCard>

            {/* Дневные цели питания на сегодня */}
            <div style={{ fontSize:11, fontWeight:700, color:'#22c55e', marginBottom:4 }}>🍽 Питание на сегодня</div>
            {(() => {
              const w = prepPlan.preparation.startingWeightKg;
              const base = {
                kcal: prepPlan.preparation.currentCalories,
                proteinG: Math.round(w * 2.2),
                fatG: Math.max(30, Math.round(w * (prepPlan.sex === 'female' ? 0.8 : 0.6))),
                carbsG: 0,
                waterMl: 3000,
                sodiumMg: 2800,
              };
              const t = nutritionTargetsForPrepDate(today, prepPlan, base);
              return (
                <div style={{ fontSize:11, color:'#fff', background:'rgba(34,197,94,0.06)', padding:10, borderRadius:8, border:'1px solid rgba(34,197,94,0.15)' }}>
                  <div><b>{t.kcal} ккал</b> · Б {t.proteinG} г · У {t.carbsG} г · Ж {t.fatG} г · 💧 {(t.waterMl / 1000).toFixed(1)} л · Na {t.sodiumMg} мг {t.phaseLabel ? `· ${t.phaseLabel}` : ''}</div>
                  {t.note && <div style={{ color:'#fff', marginTop:4 }}>{t.note}</div>}
                  <div style={{ marginTop:4, fontSize:10, color:'#fff' }}>
                    План отделён от факта: цели переносятся в «Планировщик питания» → дневник сохраняет только фактическое питание.
                  </div>
                </div>
              );
            })()}

      {/* <</TrialSafety>> */}
    </>
  );
};

/** D — адаптация по весу + таймлайн Show Day + контроль готовности + post-show + diff + история + экспорт. */
export const BbContestPrepPost: React.FC<{ ctx: BbContestPrepCtx }> = ({ ctx }) => {
  const { PREP_CHECKIN_ITEMS, buildContestPrepConfig, builtPlan, flash, handleApplyWeightAdjustment, handleExportCheckinsCsv, handleExportPrepIcs, handleExportPrepJson, handleExportWeeklyReport, handleExtendPrep, handlePrintPrepSummary, postLogCycle, postLogHunger, postLogSleep, postLogStrength, postLogTick, postLogWeek, postLogWeight, prepApplied, prepBasePlan, prepCheckin, prepCheckinDone, prepPlan, savePrepToProfile, setPostLogCycle, setPostLogHunger, setPostLogSleep, setPostLogStrength, setPostLogTick, setPostLogWeek, setPostLogWeight, setPrepPlan, setStep, step, togglePrepCheckin, weightAdvice } = ctx;
  return (
    <>
      {/* <<Post>> */}
            {/* ⚖️ Адаптация подготовки по весу */}
            <div style={{ marginTop:10 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#60a5fa', marginBottom:4 }}>⚖️ Адаптация по весу (среднее за 7 дней)</div>
              {weightAdvice && (
                <div style={{ background:'rgba(96,165,250,0.05)', border:'1px solid rgba(96,165,250,0.15)', borderRadius:8, padding:10, fontSize:10 }}>
                  <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'center' }}>
                    <span style={{ color:'#fff' }}>
                      Последний вес: <b style={{ color:'#fff' }}>{weightAdvice.lastWeight ?? '—'} кг</b>
                      {weightAdvice.lastDate ? ` (${weightAdvice.lastDate})` : ''}
                    </span>
                    {weightAdvice.delta7d != null && (
                      <span style={{ color:'#fff' }}>
                        Δ7д: <b style={{ color: weightAdvice.delta7d < 0 ? '#4ade80' : '#fbbf24' }}>{weightAdvice.delta7d > 0 ? '+' : ''}{weightAdvice.delta7d.toFixed(2)} кг</b>
                      </span>
                    )}
                    {weightAdvice.delta14d != null && (
                      <span style={{ color:'#fff' }}>
                        Δ14д: <b style={{ color: weightAdvice.delta14d < 0 ? '#4ade80' : '#fbbf24' }}>{weightAdvice.delta14d > 0 ? '+' : ''}{weightAdvice.delta14d.toFixed(2)} кг</b>
                      </span>
                    )}
                    {weightAdvice.weeklyRatePct != null && (
                      <span style={{ color:'#fff' }}>
                        Темп: <b style={{ color:'#fff' }}>{weightAdvice.weeklyRatePct.toFixed(2)}%/нед</b> (цель {weightAdvice.targetRatePctPerWeek}%/нед)
                      </span>
                    )}
                    <span style={{
                      padding: '2px 8px', borderRadius: 999, fontWeight: 700,
                      background: weightAdvice.status === 'on_track' ? 'rgba(34,197,94,0.15)' : weightAdvice.status === 'no_data' ? 'rgba(255,255,255,0.08)' : weightAdvice.status === 'too_fast' ? 'rgba(239,68,68,0.15)' : weightAdvice.status === 'taper' ? 'rgba(168,85,247,0.15)' : 'rgba(245,158,11,0.15)',
                      color: weightAdvice.status === 'on_track' ? '#4ade80' : weightAdvice.status === 'no_data' ? '#fff' : weightAdvice.status === 'too_fast' ? '#ef4444' : weightAdvice.status === 'taper' ? '#a855f7' : '#fbbf24',
                    }}>
                      {weightAdvice.status === 'on_track' ? '✓ По графику' : weightAdvice.status === 'no_data' ? 'Мало данных' : weightAdvice.status === 'too_fast' ? '⚠ Быстрее цели' : weightAdvice.status === 'taper' ? '🛑 Taper' : '🔶 Плато/медленно'}
                    </span>
                    {weightAdvice.measurements > 0 && <span style={{ color:'#fff' }}>замеров 14д: {weightAdvice.measurements}</span>}
                  </div>
                  {weightAdvice.progressToTargetPct != null && (
                    <div style={{ marginTop:6 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'#fff', marginBottom:2 }}>
                        <span>Прогресс к целевому весу</span>
                        <span>{Math.min(100, Math.max(0, weightAdvice.progressToTargetPct))}%</span>
                      </div>
                      <div style={{ height:5, borderRadius:3, background:'rgba(255,255,255,0.08)', overflow:'hidden' }}>
                        <div style={{ width:`${Math.min(100, Math.max(0, weightAdvice.progressToTargetPct))}%`, height:'100%', borderRadius:3, background:'linear-gradient(90deg,#60a5fa,#00e68a)' }} />
                      </div>
                    </div>
                  )}
                  <div style={{ color:'#fff', marginTop:6, lineHeight:1.45 }}>{weightAdvice.recommendation}</div>
                  {(weightAdvice.adjustCalories !== 0 || weightAdvice.adjustCardioMin !== 0) && (
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:8 }}>
                      {weightAdvice.adjustCalories !== 0 && (
                        <button style={{ ...BTN_GHOST, borderColor:'#60a5fa', color:'#60a5fa' }} onClick={() => handleApplyWeightAdjustment(weightAdvice.adjustCalories, 0)}>
                          {weightAdvice.adjustCalories > 0 ? '➕' : '➖'} Применить калории {weightAdvice.adjustCalories > 0 ? '+' : ''}{weightAdvice.adjustCalories} ккал
                        </button>
                      )}
                      {weightAdvice.adjustCardioMin !== 0 && (
                        <button style={{ ...BTN_GHOST, borderColor:'#34d399', color:'#34d399' }} onClick={() => handleApplyWeightAdjustment(0, weightAdvice.adjustCardioMin)}>
                          {weightAdvice.adjustCardioMin > 0 ? '➕' : '➖'} Кардио {weightAdvice.adjustCardioMin > 0 ? '+' : ''}{weightAdvice.adjustCardioMin} мин/нед
                        </button>
                      )}
                      <span style={{ fontSize:9, color:'#fff', alignSelf:'center' }}>Одна переменная за раз · эффект оценивать через 5–7 дней</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 🎬 Таймлайн Show Day */}
            <div style={{ marginTop:10 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#fbbf24', marginBottom:4 }}>🎬 Таймлайн Show Day</div>
              <div style={{ background:'rgba(251,191,36,0.04)', border:'1px solid rgba(251,191,36,0.12)', borderRadius:8, padding:8 }}>
                {buildShowTimeline(configFromPlan(prepPlan)).map((t, i) => (
                  <div key={i} style={{ display:'grid', gridTemplateColumns:'80px 1fr', gap:8, padding:'4px 0', borderBottom: i < buildShowTimeline(configFromPlan(prepPlan)).length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', fontSize:10 }}>
                    <span style={{ color:'#fbbf24', fontWeight:700 }}>{t.time}</span>
                    <span style={{ color:'#fff' }}><b>{t.action}</b> — {t.detail}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 📋 Контроль готовности (чек-лист дня) */}
            <div style={{ marginTop:10 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#4ade80', marginBottom:4 }}>
                📋 Контроль готовности · {isoToday()} · {prepCheckinDone}/{PREP_CHECKIN_ITEMS.length}
              </div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {PREP_CHECKIN_ITEMS.map((label: any, i: any) => {
                  const checked = !!prepCheckin[`${isoToday()}_${i}`];
                  return (
                    <button key={label} onClick={() => togglePrepCheckin(i)} style={{
                      padding: '6px 10px', borderRadius: 999, fontSize: 10, cursor: 'pointer',
                      background: checked ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.03)',
                      border: checked ? '1px solid rgba(34,197,94,0.5)' : '1px solid rgba(255,255,255,0.1)',
                      color: checked ? '#4ade80' : '#fff',
                    }}>
                      {checked ? '✓ ' : ''}{label}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize:9, color:'#fff', marginTop:3 }}>
                Контрольные показатели подготовки (раздел 3.1): вес по среднему 7 дней, сон, выполнение, шаги/кардио, пищеварение, визуальная форма.
              </div>
            </div>

            {/* 🔄 Post-show: восстановление после шоу */}
            <div style={{ marginTop:10 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#22c55e', marginBottom:4 }}>🔄 Post-show (восстановление после шоу)</div>
              {(() => {
                const post = buildPostShowPlan(prepPlan);
                return (
                  <div style={{ background:'rgba(34,197,94,0.04)', border:'1px solid rgba(34,197,94,0.15)', borderRadius:8, padding:10, fontSize:10 }}>
                    <div style={{ color:'#fff', marginBottom:4 }}>
                      <b>{post.kcal} ккал</b> (поддержание) · Б {post.proteinG} г · 💧 {post.waterLiters} л стабильно · {post.durationDays} дней
                    </div>
                    {/* PRO-2 P5: трек восстановления — recovery (дефолт) vs reverse (opt-in) */}
                    <div style={{ display:'flex', gap:6, marginBottom:6 }}>
                      {([
                        ['recovery', '🔄 Recovery — сразу maintenance', 'гликоген/гормоны/сон быстрее, +5–10% веса'],
                        ['reverse', '🐢 Reverse — +100/нед', 'медленнее, только осознанно'],
                      ] as const).map(([track, label, sub]) => {
                        const active = (prepPlan.postShowTrack ?? 'recovery') === track;
                        return (
                          <button
                            key={track}
                            onClick={() => {
                              const next = { ...prepPlan, postShowTrack: track, updatedAt: new Date().toISOString() };
                              setPrepPlan(next);
                              try { savePrepToProfile(next, buildContestPrepConfig()); } catch { /* ignore */ }
                              flash(track === 'recovery' ? '🔄 Recovery-трек: сразу к maintenance' : '🐢 Reverse-трек: медленно +100/нед');
                            }}
                            aria-pressed={active}
                            style={{
                              flex:1, minHeight:56, borderRadius:10, padding:'6px 8px', cursor:'pointer', textAlign:'left',
                              fontSize:10, fontWeight:800, color: active ? '#4ade80' : '#fff',
                              background: active ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.03)',
                              border: active ? '1px solid #22c55e' : '1px solid rgba(255,255,255,0.1)',
                            }}
                          >
                            {label}
                            <span style={{ display:'block', fontSize:8, fontWeight:400, color:'#fff', marginTop:2 }}>{sub}</span>
                          </button>
                        );
                      })}
                    </div>
                    {(() => {
                      const curve = postShowRecoveryDiet(prepPlan);
                      const w0 = prepPlan.preparation.startingWeightKg;
                      return (
                        <div style={{ fontSize:9, color:'#fff', marginBottom:4 }}>
                          Recovery-кривая: {curve.map(wk => `${wk.week}н ${wk.kcal}`).join(' → ')} ккал · regain-цель +5–10% веса сцены (~{Math.round(w0 * 1.05)}–{Math.round(w0 * 1.1)} кг при сцене {w0} кг)
                        </div>
                      );
                    })()}
                    {post.notes.map((n, i) => <div key={`n${i}`} style={{ color:'#fff', marginTop:2 }}>• {n}</div>)}
                    <div style={{ marginTop:4, fontSize:9, color:'#fff' }}>🏋️ {post.training.join(' ')}</div>
                    <div style={{ marginTop:4, color:'rgba(96,165,250,0.75)' }}>⚖️ {post.weightCheck}</div>
                  </div>
                );
              })()}
            </div>

            {/* PRO-2 P6: лог восстановления post-show (6 нед) + comedown-памятка */}
            {(() => {
              void postLogTick;
              const entries = getPostShowLog(prepPlan.id);
              const last = entries[entries.length - 1];
              const markers = postShowRecoveryMarkers(last ?? null, prepPlan.preparation.startingWeightKg);
              const markRow: Array<[string, boolean]> = [
                ['Вес +5%', markers.weightRegained],
                ['Сон ≥7ч', markers.sleepOk],
                ['Голод ≤3', markers.hungerOk],
                ['Цикл/гормоны', markers.cycleOk],
                ['Сила ≥95%', markers.strengthOk],
              ];
              return (
                <div style={{ marginTop:10, background:'rgba(34,197,94,0.04)', border:'1px solid rgba(34,197,94,0.15)', borderRadius:8, padding:10 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#4ade80', marginBottom:4 }}>
                    🔄 Восстановление · {markers.recoveredCount}/5 {markers.allRecovered ? '— восстановлены ✅' : ''}
                  </div>
                  <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:6 }}>
                    {markRow.map(([label, ok]) => (
                      <span key={label} style={{ fontSize:9, color:'#fff', background: ok ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.05)', border: ok ? '1px solid #22c55e' : '1px solid rgba(255,255,255,0.1)', borderRadius:999, padding:'3px 8px' }}>
                        {ok ? '✓ ' : ''}{label}
                      </span>
                    ))}
                  </div>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center', fontSize:10, color:'#fff', marginBottom:6 }}>
                    <span>Нед:</span>
                    <button style={BTN_GHOST} onClick={() => setPostLogWeek((w: any) => Math.max(1, w - 1))}>−</button>
                    <b style={{ minWidth:18, textAlign:'center' }}>{postLogWeek}</b>
                    <button style={BTN_GHOST} onClick={() => setPostLogWeek((w: any) => Math.min(6, w + 1))}>+</button>
                    <input type="number" step={0.1} placeholder="Вес кг" value={postLogWeight} onChange={e => setPostLogWeight(e.target.value)} style={{ width:74, ...IN }} />
                    <input type="number" step={0.5} placeholder="Сон ч" value={postLogSleep} onChange={e => setPostLogSleep(e.target.value)} style={{ width:64, ...IN }} />
                    <span>Голод:</span>
                    <span style={{ display:'flex', gap:3 }}>
                      {[1,2,3,4,5].map(v => (
                        <button key={v} onClick={() => setPostLogHunger(v)} style={{ width:24, height:24, borderRadius:6, fontSize:10, cursor:'pointer', color:'#fff', border:'1px solid rgba(34,197,94,0.35)', background: postLogHunger === v ? 'rgba(34,197,94,0.45)' : 'rgba(255,255,255,0.03)' }}>{v}</button>
                      ))}
                    </span>
                    <PopupSelect
                      label="Цикл"
                      value={postLogCycle}
                      onChange={v => setPostLogCycle(v as typeof postLogCycle)}
                      options={[
                        { id: 'na', label: 'М — н/п' },
                        { id: 'restored', label: 'Цикл вернулся' },
                        { id: 'irregular', label: 'Нерегулярно' },
                        { id: 'absent', label: 'Нет цикла' },
                      ]}
                    />
                    <input type="number" step={1} placeholder="Сила %" value={postLogStrength} onChange={e => setPostLogStrength(e.target.value)} style={{ width:64, ...IN }} />
                    <button
                      style={{ ...BTN_GHOST, borderColor:'#22c55e', color:'#4ade80' }}
                      onClick={() => {
                        savePostShowEntry(prepPlan.id, {
                          week: postLogWeek as 1|2|3|4|5|6,
                          dateIso: isoToday(),
                          weightKg: parseFloat(postLogWeight) || undefined,
                          sleepH: parseFloat(postLogSleep) || undefined,
                          hunger1_5: postLogHunger,
                          cycle: postLogCycle,
                          strengthReturnPct: parseFloat(postLogStrength) || undefined,
                        });
                        setPostLogTick((t: any) => t + 1);
                        setPostLogWeight(''); setPostLogSleep(''); setPostLogStrength('');
                        flash(`🔄 Запись нед ${postLogWeek} сохранена`);
                      }}
                    >
                      💾 Сохранить нед {postLogWeek}
                    </button>
                  </div>
                  {entries.length > 0 && (
                    <div style={{ fontSize:9, color:'#fff', marginBottom:4 }}>
                      {entries.map(e => (
                        <span key={e.week} style={{ marginRight:8 }}>
                          Н{e.week}: {e.weightKg ? `${e.weightKg} кг` : '—'}
                          <button onClick={() => { removePostShowEntry(prepPlan.id, e.week); setPostLogTick((t: any) => t + 1); }} style={{ marginLeft:3, color:'#f87171', background:'transparent', border:'none', cursor:'pointer', fontSize:10 }} aria-label={`Удалить запись недели ${e.week}`}>✕</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={{ fontSize:9, color:'#fff', borderTop:'1px solid rgba(34,197,94,0.15)', paddingTop:6 }}>
                    {postShowComedownNotes().map((n, i) => <div key={i} style={{ marginTop:2 }}>• {n}</div>)}
                  </div>
                </div>
              );
            })()}

            {/* 🔎 Сравнение до/после: какие недели изменились (diff тренировочного цикла) */}
            {prepApplied && builtPlan && prepBasePlan && (() => {
              const weekSets = (p: any, i: number) => {
                const w = p.weeks[i];
                if (!w) return null;
                return w.sessions.reduce((a: number, s: any) => a + s.exercises.reduce((b: number, e: any) => b + (e.sets || 0), 0), 0);
              };
              const weekRir = (p: any, i: number) => {
                const w = p.weeks[i];
                if (!w) return null;
                const rirs = w.sessions.flatMap((s: any) => s.exercises.map((e: any) => e.rir ?? 3));
                return rirs.length ? Math.min(...rirs) : null;
              };
              const rows = builtPlan.weeks.map((w: any, i: number) => {
                const before = weekSets(prepBasePlan, i);
                const after = weekSets(builtPlan, i);
                const rirB = weekRir(prepBasePlan, i);
                const rirA = weekRir(builtPlan, i);
                const changed = before != null && after != null && (before !== after || rirB !== rirA);
                const cp = (w as any).contestPhase as PrepPhaseKey | undefined;
                return { week: (w as any).week, cp, before, after, rirB, rirA, changed };
              });
              const changedCount = rows.filter((r: any) => r.changed).length;
              return (
                <div style={{ marginTop:10 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#fff', marginBottom:4 }}>
                    🔎 Сравнение до/после {changedCount > 0 ? `· изменено недель: ${changedCount}` : '· изменений нет'}
                  </div>
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', fontSize:10, borderCollapse:'collapse', minWidth:520 }}>
                      <thead>
                        <tr style={{ color:'#fff', textAlign:'left' }}>
                          <th style={{ padding:'4px 6px' }}>Нед</th>
                          <th style={{ padding:'4px 6px' }}>Фаза</th>
                          <th style={{ padding:'4px 6px', textAlign:'right' }}>Сетов до</th>
                          <th style={{ padding:'4px 6px', textAlign:'right' }}>Сетов после</th>
                          <th style={{ padding:'4px 6px', textAlign:'right' }}>RIR до</th>
                          <th style={{ padding:'4px 6px', textAlign:'right' }}>RIR после</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r: any) => {
                          const bg = !r.changed ? 'transparent' : r.cp === 'preparation' ? 'rgba(34,197,94,0.08)' : r.cp === 'final_preparation' ? 'rgba(139,92,246,0.08)' : r.cp === 'taper' ? 'rgba(245,158,11,0.08)' : 'rgba(236,72,153,0.08)';
                          return (
                            <tr key={r.week} style={{ borderTop:'1px solid rgba(255,255,255,0.05)', background: bg }}>
                              <td style={{ padding:'4px 6px', fontWeight:700 }}>{r.week}</td>
                              <td style={{ padding:'4px 6px', color: PREP_PHASE_COLORS[(r.cp ?? 'preparation') as PrepPhaseKey] ?? '#fff' }}>
                                {r.cp === 'preparation' ? '🏁 Подготовка' : r.cp === 'final_preparation' ? 'Финальная' : r.cp === 'taper' ? '📉 Тапер' : '🎭 Пик'}
                              </td>
                              <td style={{ padding:'4px 6px', textAlign:'right', color: r.changed ? '#fff' : '#fff' }}>{r.before ?? '—'}</td>
                              <td style={{ padding:'4px 6px', textAlign:'right', fontWeight: r.changed ? 800 : 400, color: r.changed ? '#fbbf24' : '#fff' }}>{r.after ?? '—'}</td>
                              <td style={{ padding:'4px 6px', textAlign:'right', color: r.changed ? '#fff' : '#fff' }}>{r.rirB ?? '—'}</td>
                              <td style={{ padding:'4px 6px', textAlign:'right', fontWeight: r.changed ? 800 : 400, color: r.changed ? '#fbbf24' : '#fff' }}>{r.rirA ?? '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ fontSize:9, color:'#fff', marginTop:3 }}>
                    Зелёный — подготовка (режим RIR 1–3), фиолетовый — финальная (×0.9), оранжевый — taper (объём ↓, вес сохранён), розовый — пик-неделя.
                  </div>
                </div>
              );
            })()}

            {/* 📝 История корректировок */}
            {(prepPlan.adjustments?.length ?? 0) > 0 && (
              <div style={{ marginTop:10 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#60a5fa', marginBottom:4 }}>📝 История корректировок</div>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', fontSize:10, borderCollapse:'collapse', minWidth:420 }}>
                    <thead>
                      <tr style={{ color:'#fff', textAlign:'left' }}>
                        <th style={{ padding:'4px 6px' }}>Дата</th>
                        <th style={{ padding:'4px 6px', textAlign:'right' }}>Ккал</th>
                        <th style={{ padding:'4px 6px', textAlign:'right' }}>Кардио</th>
                        <th style={{ padding:'4px 6px' }}>Статус</th>
                        <th style={{ padding:'4px 6px' }}>Причина</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...(prepPlan.adjustments ?? [])].reverse().map((a, i) => (
                        <tr key={i} style={{ borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding:'4px 6px' }}>{a.date}</td>
                          <td style={{ padding:'4px 6px', textAlign:'right', color: a.caloriesDelta !== 0 ? (a.caloriesDelta > 0 ? '#4ade80' : '#f87171') : '#fff' }}>{a.caloriesDelta > 0 ? '+' : ''}{a.caloriesDelta}</td>
                          <td style={{ padding:'4px 6px', textAlign:'right', color: a.cardioDelta !== 0 ? (a.cardioDelta > 0 ? '#4ade80' : '#f87171') : '#fff' }}>{a.cardioDelta > 0 ? '+' : ''}{a.cardioDelta}</td>
                          <td style={{ padding:'4px 6px', color:'#fff' }}>{a.weightStatus}</td>
                          <td style={{ padding:'4px 6px', color:'#fff', fontSize:9 }}>{a.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:10 }}>
              <button style={BTN_GHOST} onClick={() => handleExtendPrep(1)}>➕ Неделя подготовки</button>
              <button style={BTN_GHOST} onClick={() => handleExtendPrep(-1)}>➖ Неделя подготовки</button>
              <button style={{ ...BTN_GHOST, borderColor:'#22c55e', color:'#22c55e' }} onClick={handlePrintPrepSummary}>🖨 Сводка prep (PDF)</button>
              <button style={{ ...BTN_GHOST, borderColor:'#60a5fa', color:'#60a5fa' }} onClick={handleExportPrepIcs}>📅 Фазы (.ics)</button>
              <button style={{ ...BTN_GHOST, borderColor:'#a78bfa', color:'#a78bfa' }} onClick={handleExportPrepJson}>📥 JSON тренеру</button>
              <button style={{ ...BTN_GHOST, borderColor:'#f59e0b', color:'#f59e0b' }} onClick={handleExportWeeklyReport}>📥 Отчёт тренеру</button>
              <button style={{ ...BTN_GHOST, borderColor:'#f59e0b', color:'#f59e0b' }} onClick={handleExportCheckinsCsv}>📥 Чек-ины (CSV)</button>
              <button style={{ ...BTN_GHOST, borderColor:'#ec4899', color:'#ec4899' }} onClick={() => setStep('adjust')}>← К коррекции плана</button>
              {prepApplied && <span style={{ fontSize:10, color:'#4ade80', alignSelf:'center' }}>✓ Применено к плану</span>}
            </div>
      {/* <</Post>> */}
    </>
  );
};
