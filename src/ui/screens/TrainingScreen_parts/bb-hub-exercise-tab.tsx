/**
 * bb-hub-exercise-tab.tsx — таб «Разбор» (волна 3 плана хабов: декомпозиция).
 *
 * Перенос разметки 1:1 из `BBDiagnosticsHub.tsx`: каталог упражнений (план первыми),
 * техника/замены, стимул по упражнению, LVP-калибровка и рабочий коридор из
 * индивидуального e1RM (BB-D-33 хвост). Расчёты остаются в хабе.
 *
 * Контракт пропсов: презентационная секция, вычисленные величины — `any`
 * (их форму задают движки); жёстко типизированы только state/setState.
 */
import React from 'react';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import { BbCheckCard, BbSheetSelect } from './bb-hub-controls';
import { ACCENT } from './training-ui';
import type { BBState } from './BBDiagnosticsHub';

/**
 * Честная подпись капа каталога: «Разбор» показывает первые N (шторка 80 / библиотека 40)
 * из всего списка. Раньше кап молчал — выглядело, будто упражнений всего 40–80.
 * Возвращает null, когда ничего не обрезано (подпись не нужна).
 */
export const catalogLimitNote = (shown: number, total: number, where: 'picker' | 'library'): string | null => {
  if (!Number.isFinite(shown) || !Number.isFinite(total) || total <= shown) return null;
  return where === 'picker'
    ? `Показаны первые ${shown} из ${total} — поиск ищет по всему каталогу: уточни запрос, чтобы дойти до остальных`
    : `Показаны ${shown} из ${total} — сузь поиск или фильтры, остальные в списке не показаны`;
};

export interface BbExerciseTabProps {
  state: BBState;
  setState: React.Dispatch<React.SetStateAction<BBState>>;
  weakRu: (z: string) => string;
  LVP_LIFTS: any;
  MUSCLE_LABEL_RU: any;
  asymMax: any;
  bbPlan: any;
  buildExerciseInstructions: any;
  calcExerciseEffect: any;
  clearLvp: any;
  exPicker: { options: Array<{ id: string; label: string; hint?: string }>; shown: number; total: number };
  exQuery: any;
  exerciseEffectScore: any;
  exerciseLibrary: { list: any[]; shown: number; total: number };
  flagRu: any;
  handleApplyExerciseCorrection: any;
  headsHitOf: any;
  libWeakHeads: any;
  lvpLift: any;
  lvpProfile: any;
  lvpSaved: any;
  lvpText: any;
  lvpWorkingRange: any;
  planAudit: any;
  profileRu: any;
  report: any;
  runLvp: any;
  selectWorstExercise: any;
  selectedCorrections: any;
  selectedDiagnosis: any;
  selectedExRaw: any;
  selectedProf: any;
  setExQuery: any;
  setLvpLift: any;
  setLvpText: any;
  simulateCorrection: any;
  weakListRu: any;
}

export const BbExerciseTab: React.FC<BbExerciseTabProps> = (props) => {
  const {
    state, setState, weakRu, LVP_LIFTS, MUSCLE_LABEL_RU, asymMax, bbPlan, buildExerciseInstructions, calcExerciseEffect, clearLvp, exPicker, exQuery, exerciseEffectScore, exerciseLibrary, flagRu, handleApplyExerciseCorrection, headsHitOf, libWeakHeads, lvpLift, lvpProfile, lvpSaved, lvpText, lvpWorkingRange, planAudit, profileRu, report, runLvp, selectWorstExercise, selectedCorrections, selectedDiagnosis, selectedExRaw, selectedProf, setExQuery, setLvpLift, setLvpText, simulateCorrection, weakListRu,
  } = props;
  const pickerNote = catalogLimitNote(exPicker.shown, exPicker.total, 'picker');
  const libraryNote = catalogLimitNote(exerciseLibrary.shown, exerciseLibrary.total, 'library');
  return (
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Разбор — упражнение + техника → стимул в плане (подробно)</div>
            {/* Лента аудита */}
            {planAudit ? (
              <div style={{ padding: '8px 10px', borderRadius: 10, background: 'linear-gradient(135deg,rgba(0,230,138,0.08),rgba(168,85,247,0.06))', border: '1px solid rgba(0,230,138,0.16)', marginBottom: 8, fontSize: 10, lineHeight: 1.5 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                  <span style={{ padding: '2px 8px', borderRadius: 20, background: planAudit.avgSfr != null && planAudit.avgSfr < 3.5 ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.08)', border: '1px solid rgba(255,255,255,0.06)', color: planAudit.avgSfr != null && planAudit.avgSfr < 3.5 ? '#ef4444' : '#22c55e', fontWeight: 700 }}>SFR {planAudit.avgSfr ?? '—'}/5 {planAudit.avgSfr != null && planAudit.avgSfr < 3.5 ? '⚠ низко' : 'порядок'}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 20, background: planAudit.lengthenedRatio < 0.3 ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.08)', border: '1px solid rgba(255,255,255,0.06)', color: planAudit.lengthenedRatio < 0.3 ? '#ef4444' : '#22c55e', fontWeight: 700 }}>растяж. {(planAudit.lengthenedRatio * 100).toFixed(0)}% {planAudit.lengthenedRatio < 0.3 ? '⚠ мало' : 'порядок'}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 20, background: planAudit.unilateralRatio < 0.08 ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.08)', border: '1px solid rgba(255,255,255,0.06)', color: planAudit.unilateralRatio < 0.08 ? '#f59e0b' : '#22c55e' }}>одност. {(planAudit.unilateralRatio * 100).toFixed(0)}% {planAudit.unilateralRatio < 0.08 ? '→ добавь' : 'порядок'}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 20, background: planAudit.fatigueDensity > 1.35 ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.08)', border: '1px solid rgba(255,255,255,0.06)', color: planAudit.fatigueDensity > 1.35 ? '#ef4444' : '#fff' }}>усталость {planAudit.fatigueDensity.toFixed(2)} {planAudit.fatigueDensity > 1.35 ? '⚠ высоко' : ''}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#fff' }}>{planAudit.totalExercises} упр · {planAudit.totalSets} сетов</span>
                </div>
                {planAudit.flags.length > 0 && <div style={{ color: '#f59e0b', fontSize: 10 }}>Замечания: {planAudit.flags.map((f: any) => {
                  const base = String(f).split(':')[0];
                  const ru: Record<string, string> = { lowSFR: 'низкий стимул', midSFR: 'стимул средний', missingLengthened: 'мало растянутой', missingShortened: 'нет пиковой (сечка)', lowUnilateral: 'мало односторонних', highFatigue: 'усталость высокая', singleAngle: 'один угол' };
                  const tail = String(f).includes(':') ? ` (${String(f).split(':').slice(1).map((m) => MUSCLE_LABEL_RU[m] || m).join(', ')})` : '';
                  return `${ru[base] || f}${tail}`;
                }).join(' · ')}</div>}
                <div style={{ color: '#fff', marginTop: 2 }}>План: {bbPlan ? `${bbPlan.weeks?.length || 0} нед` : '— нет плана (собери в ББ-авто)'} · слабые: {weakListRu(report.weakZonesGranular) || '—'} · перекос {asymMax != null ? `${asymMax.toFixed(1)}%` : '—'}</div>
              </div>
            ) : (
              <div style={{ padding: '8px 10px', borderRadius: 8, background: '#0a1629', border: '1px solid #1f3a5f', fontSize: 10, color: '#fff', marginBottom: 8 }}>Нет плана ББ — собери в ББ-авто, тогда аудит портфеля появится здесь.</div>
            )}

            {/* Секция 1: Аудит портфеля по мышцам */}
            {planAudit && (
              <div style={{ marginBottom: 10, border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.03)', fontSize: 11, fontWeight: 700, color: '#fff' }}>1 · Аудит портфеля по мышцам (каждое упражнение — максимально)</div>
                <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                  {Object.entries(planAudit.byMuscle as Record<string, any>).map(([m, bm]: [string, any]) => (
                    <div key={m} style={{ padding: '8px 10px', borderTop: '1px solid rgba(255,255,255,0.04)', background: bm.totalSets >= 6 && bm.angleCoverage.covered === 1 ? 'rgba(239,68,68,0.04)' : 'transparent' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 4 }}>
                        <b style={{ color: '#fff', fontSize: 11 }}>{MUSCLE_LABEL_RU[m] || m}</b>
                        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 20, background: bm.avgSfr != null && bm.avgSfr < 3.5 ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.08)', color: bm.avgSfr != null && bm.avgSfr < 3.5 ? '#ef4444' : '#22c55e' }}>SFR {bm.avgSfr ?? '—'}</span>
                        <span style={{ fontSize: 10, color: '#fff' }}>раст. {bm.lengthened}/{bm.totalSets} · сред. {bm.mid} · пик. {bm.shortened}</span>
                        <span style={{ fontSize: 10, color: bm.angleCoverage.missing.length ? '#f59e0b' : '#22c55e' }}>углы {bm.angleCoverage.covered}/{bm.angleCoverage.total} {bm.angleCoverage.missing.length ? `→ нет: ${bm.angleCoverage.missing.slice(0, 2).join(', ')}` : 'порядок'}</span>
                        <span style={{ fontSize: 10, color: bm.strictCoverage.missing.length ? '#f59e0b' : '#fff' }}>строгие {bm.strictCoverage.covered}/{bm.strictCoverage.total}</span>
                        <span style={{ fontSize: 10, color: bm.regionalCoverage.missing.length ? '#f59e0b' : '#fff' }}>подрег {bm.regionalCoverage.covered}/{bm.regionalCoverage.total}</span>
                        <span style={{ fontSize: 10, color: '#fff' }}>{bm.totalSets} сет · уни {bm.unilateral} · устал {bm.fatigueDensity.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {bm.exercises.map((eff: any, i: any) => {
                          const sc = exerciseEffectScore(eff);
                          const col = sc >= 70 ? '#22c55e' : sc >= 50 ? '#f59e0b' : '#ef4444';
                          return (
                            <button key={i} type="button" title={`${eff.name}: SFR ${eff.sfr ?? '—'} · ${eff.profile ?? '—'} · ${eff.angleClass ?? '—'} · ${eff.strictGroup?.key ?? '—'} · ${eff.jointStress ?? '—'} · tempo ${eff.note || '—'}`} aria-label={`Разобрать ${eff.name}`} style={{ padding: '3px 7px', borderRadius: 20, background: `${col}14`, border: `1px solid ${col}33`, color: col, fontSize: 10, fontWeight: 600, cursor: 'pointer' }} onClick={() => setState(s => ({ ...s, exerciseSelectedId: eff.id || eff.name, stimCheating: false, stimShortRom: false, stimSetupNote: '' }))}>
                              {eff.name} · СФР {eff.sfr ?? '—'} {eff.profile === 'lengthened' ? '📐' : eff.profile === 'short' ? '🔹' : '▪'} {eff.unilateral ? '↔' : ''} {eff.angleClass ? `·${eff.angleClass}` : ''} {eff.strictGroup ? `·${eff.strictGroup.key}` : ''} ·{sc}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Секция 2: Диагноз выбранного */}
            <div style={{ padding: '10px', borderRadius: 10, background: '#0a1629', border: '1px solid #1f3a5f', marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT }}>2 · Диагноз упражнения (выбери из портфеля выше или из каталога)</div>
                <button onClick={selectWorstExercise} data-bb="worst" style={{ marginLeft: 'auto', minHeight: 44, padding: '8px 12px', borderRadius: 10, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>🎯 Худшее в плане</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6, marginBottom: 6 }} data-bb="ex-search-row">
                <input
                  value={exQuery}
                  onChange={(e) => setExQuery(e.target.value)}
                  placeholder="Поиск упражнения (план — первыми)"
                  aria-label="Поиск упражнения"
                  data-bb="ex-search"
                  data-testid="bb-ex-search"
                  style={{ minHeight: 44, padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 16 }}
                />
                <button onClick={() => setExQuery('')} data-bb="ex-search-clear" aria-label="Очистить поиск" style={{ minHeight: 44, minWidth: 48, padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6, marginBottom: 6 }} data-bb="ex-picker">
                <BbSheetSelect label="Упражнение" value={state.exerciseSelectedId || ''} onChange={(v) => setState(s => ({ ...s, exerciseSelectedId: v || null, stimCheating: false, stimShortRom: false, stimSetupNote: '' }))} testId="bb-exercise" options={exPicker.options} />
                <button onClick={() => setState(s => ({ ...s, exerciseSelectedId: null, stimCheating: false, stimShortRom: false, stimSetupNote: '' }))} data-bb="ex-reset" style={{ minHeight: 44, minWidth: 64, padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Сброс</button>
              </div>
              {pickerNote && (
                <div data-bb="catalog-limit-picker" style={{ fontSize: 10, color: '#94a3b8', marginBottom: 6, lineHeight: 1.45 }}>{pickerNote}</div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }} data-bb="exec-cards">
                <BbCheckCard active={state.stimCheating} title="Читинг / раскачка" desc="включаю рывок корпусом" onToggle={() => setState(s => ({ ...s, stimCheating: !s.stimCheating }))} accent="#f59e0b" />
                <BbCheckCard active={state.stimShortRom} title="Амплитуда укорочена" desc="не довожу до конца" onToggle={() => setState(s => ({ ...s, stimShortRom: !s.stimShortRom }))} accent="#f59e0b" />
              </div>
              {/* Текст, а не число: у BbNum `inputMode="decimal"`, и RU-клавиатура
                  предлагала цифры/запятую там, где нужно описать отклонение. */}
              <div style={{ marginBottom: 6 }}>
                <label data-bb="text-field" style={{ fontSize: 11, color: '#fff', display: 'block', minWidth: 0 }}>
                  <span style={{ display: 'block', marginBottom: 3 }}>Отклонение в технике (например: локти вперёд)</span>
                  <input
                    value={state.stimSetupNote}
                    onChange={(e) => setState(s => ({ ...s, stimSetupNote: e.target.value }))}
                    placeholder="Опиши отклонение"
                    aria-label="Отклонение в технике"
                    data-bb="text-input"
                    style={{ width: '100%', minHeight: 44, background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 10px', fontSize: 16 }}
                  />
                </label>
              </div>
              {selectedDiagnosis?.stimulus?.record && selectedDiagnosis.stimulus.record.cheating.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: '#fff' }}>Проверь себя:</span>
                  {selectedDiagnosis.stimulus.record.cheating.map((ch: any, i: any) => {
                    const active = state.stimSetupNote.toLowerCase().includes(ch.deviation.toLowerCase().split(' ')[0]);
                    return (
                      <button
                        key={i}
                        title={`Если так делаешь — забирает: ${ch.steals}`}
                        onClick={() => setState((s) => {
                          const parts = s.stimSetupNote.split(',').map((p) => p.trim()).filter(Boolean);
                          const key = ch.deviation.toLowerCase().split(' ')[0];
                          const has = parts.some((p) => p.toLowerCase().includes(key));
                          const next = has ? parts.filter((p) => !p.toLowerCase().includes(key)) : [...parts, ch.deviation];
                          return { ...s, stimSetupNote: next.join(', ') };
                        })}
                        aria-pressed={active}
                        style={{ minHeight: 44, padding: '8px 12px', borderRadius: 20, border: '1px solid', borderColor: active ? '#f59e0b' : 'rgba(255,255,255,0.12)', background: active ? 'rgba(245,158,11,0.14)' : 'rgba(255,255,255,0.04)', color: active ? '#f59e0b' : '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                      >
                        {active ? '✓ ' : ''}{ch.deviation}
                      </button>
                    );
                  })}
                </div>
              )}
              {!selectedDiagnosis ? (
                <div style={{ fontSize: 10, color: '#fff' }}>Выбери упражнение — появится разбор 12 признаков + проверка техники + оценка 0–100.</div>
              ) : (
                <div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ padding: '4px 10px', borderRadius: 20, background: selectedDiagnosis.score >= 70 ? 'rgba(34,197,94,0.12)' : selectedDiagnosis.score >= 50 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)', border: `1px solid ${selectedDiagnosis.score >= 70 ? 'rgba(34,197,94,0.22)' : selectedDiagnosis.score >= 50 ? 'rgba(245,158,11,0.22)' : 'rgba(239,68,68,0.22)'}`, color: selectedDiagnosis.score >= 70 ? '#22c55e' : selectedDiagnosis.score >= 50 ? '#f59e0b' : '#ef4444', fontWeight: 800, fontSize: 11 }}>Оценка {selectedDiagnosis.score}/100</span>
                    <span style={{ fontSize: 10, color: '#fff' }}>{selectedDiagnosis.effect.name} · {MUSCLE_LABEL_RU[selectedDiagnosis.effect.muscle || ''] || selectedDiagnosis.effect.muscle || '—'} · СФР {selectedDiagnosis.effect.sfr ?? '—'} · {profileRu(selectedDiagnosis.effect.profile)} · {selectedDiagnosis.effect.angleClass ?? '—'} · {selectedDiagnosis.effect.strictGroup?.key ?? '—'} · {selectedDiagnosis.effect.jointStress ?? '—'} · {selectedDiagnosis.effect.unilateral ? '↔ одностороннее' : 'двустороннее'}</span>
                    {selectedProf && <span style={{ fontSize: 10, color: '#a78bfa' }}>Техника {selectedProf.label}: {selectedProf.cues[0]}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                    {selectedDiagnosis.flags.map((f: any) => <span key={f} title={f} style={{ padding: '2px 7px', borderRadius: 20, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.22)', color: '#f59e0b', fontSize: 10, fontWeight: 600 }}>{flagRu(f)}</span>)}
                    {selectedDiagnosis.flags.length === 0 && <span style={{ padding: '2px 7px', borderRadius: 20, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.22)', color: '#22c55e', fontSize: 10 }}>Порядок — выполнение чистое</span>}
                  </div>
                  <div style={{ fontSize: 10, color: selectedDiagnosis.issues.length ? '#fbbf24' : '#22c55e', lineHeight: 1.5, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 8, padding: '6px 8px' }}>{selectedDiagnosis.issues.join(' · ') || 'Замечаний нет — эталон для ББ'}</div>
                  {selectedDiagnosis.profGaps.length > 0 && <div style={{ fontSize: 10, color: '#a78bfa', marginTop: 4, background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.14)', borderRadius: 8, padding: '6px 8px' }}>Разрывы техники: {selectedDiagnosis.profGaps.map((g: any) => g.issue).join(' · ')}</div>}
                  {selectedDiagnosis.stimulus && selectedDiagnosis.stimulus.score != null && (
                    <div style={{ fontSize: 10, marginTop: 4, background: 'rgba(0,230,138,0.05)', border: '1px solid rgba(0,230,138,0.14)', borderRadius: 8, padding: '6px 8px', lineHeight: 1.5 }}>
                      <b style={{ color: '#00e68a' }}>🎯 Стимул в цель: {selectedDiagnosis.stimulus.score}/100</b>
                      <span style={{ color: '#fff' }}> — {selectedDiagnosis.stimulus.headsHit.join(', ') || '—'}</span>
                      {selectedDiagnosis.stimulus.headsMissed.length > 0 && <span style={{ color: '#f59e0b' }}> · мимо: {selectedDiagnosis.stimulus.headsMissed.join(', ')}</span>}
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                        {Object.entries(selectedDiagnosis.stimulus.breakdown || {}).map(([k, v]: [string, any]) => (
                          <span key={k} style={{ padding: '1px 6px', borderRadius: 20, background: (v as number) >= 80 ? 'rgba(34,197,94,0.10)' : (v as number) >= 60 ? 'rgba(245,158,11,0.10)' : 'rgba(239,68,68,0.10)', color: (v as number) >= 80 ? '#22c55e' : (v as number) >= 60 ? '#f59e0b' : '#ef4444' }}>{k} {String(v)}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedProf && (selectedProf.setupChecklist || selectedProf.leakTo) && (
                    <div style={{ fontSize: 10, color: '#fff', marginTop: 4, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 8, padding: '6px 8px', lineHeight: 1.5 }}>
                      {selectedProf.setupChecklist && <div><b style={{ color: '#fff' }}>Сетап:</b> {selectedProf.setupChecklist.join(' · ')}</div>}
                      {selectedProf.leakTo && <div style={{ color: '#f87171' }}>Утечка: {selectedProf.leakTo}</div>}
                    </div>
                  )}
                  {selectedExRaw && (() => { try { const instr = buildExerciseInstructions({ exerciseId: selectedExRaw.id || undefined, exerciseName: selectedExRaw.name, muscle: selectedExRaw.muscle || undefined } as any); return <div style={{ fontSize: 10, color: '#fff', marginTop: 6, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 8, padding: '6px 8px', lineHeight: 1.4 }}><b style={{ color: '#fff' }}>Техника ({instr.source}) · паттерн {instr.pattern} · темп {instr.tempo} · {instr.order}</b><br />{instr.cues.slice(0, 3).join(' · ')}<br /><span style={{ color: '#f87171' }}>Ошибки: {instr.mistakes.slice(0, 3).join(' · ')}</span></div>; } catch { return null; } })()}
                </div>
              )}
            </div>

            {/* Секция 3: PROF-коррекция выполнения (центральная) */}
            {selectedDiagnosis && selectedProf && (
              <div style={{ padding: '10px', borderRadius: 10, background: 'linear-gradient(135deg,rgba(168,85,247,0.08),rgba(0,230,138,0.06))', border: '1px solid rgba(168,85,247,0.18)', marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#a78bfa', marginBottom: 6 }}>3 · Техника выполнения — как дать именно в мышцу ({selectedProf.label})</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8, fontSize: 10 }}>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 8px', border: '1px solid rgba(255,255,255,0.04)' }}><b style={{ color: '#fff' }}>Угол:</b> {selectedProf.angle || '—'}</div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 8px', border: '1px solid rgba(255,255,255,0.04)' }}><b style={{ color: '#fff' }}>Локти:</b> {selectedProf.elbow || '—'}</div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 8px', border: '1px solid rgba(255,255,255,0.04)' }}><b style={{ color: '#fff' }}>Лопатки:</b> {selectedProf.scapula || '—'}</div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 8px', border: '1px solid rgba(255,255,255,0.04)' }}><b style={{ color: '#fff' }}>Темп:</b> {selectedProf.tempo} · <b>ROM:</b> {selectedProf.rom}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                  {selectedProf.cues.map((c: any, i: any) => <span key={i} style={{ padding: '4px 8px', borderRadius: 20, background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.14)', color: '#00e68a', fontSize: 10, fontWeight: 600 }}>{i + 1}. {c}</span>)}
                </div>
                <div style={{ fontSize: 10, color: '#f87171', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)', borderRadius: 8, padding: '6px 8px', marginBottom: 6 }}>Ошибки: {selectedProf.errors.join(' · ')}</div>
                <div style={{ fontSize: 10, color: '#a78bfa', background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.14)', borderRadius: 8, padding: '6px 8px' }}>Связь с мышцей: {selectedProf.mindMuscle} · время под нагрузкой ↑, пауза в растянутой работает лучше</div>
                <button onClick={() => handleApplyExerciseCorrection({ type: 'modifyExecution', execCues: selectedProf.cues, reason: `Техника: ${selectedProf.label}`, confidence: 0.85, deltaPreview: `Проработка: ${selectedProf.label}` } as any, selectedExRaw?.id || null)} data-bb="apply-exec" style={{ marginTop: 8, width: '100%', minHeight: 48, padding: '10px 12px', borderRadius: 10, background: 'linear-gradient(135deg,#a78bfa,#7c3aed)', color: '#fff', border: 'none', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>▶ Применить технику в план</button>
              </div>
            )}

            {/* Секция 4: Коррекция упражнением (замена/дополнение) */}
            {selectedDiagnosis && selectedCorrections.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>4 · Коррекция упражнением → эффект (топ-3)</div>
                {selectedCorrections.slice(0, 3).map((a: any, i: any) => {
                  const delta = (() => { try { return simulateCorrection(bbPlan, a as any, selectedExRaw?.id || null); } catch { return null; } })();
                  return (
                    <div key={i} style={{ padding: '8px 10px', borderRadius: 10, background: i === 0 ? 'rgba(0,230,138,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${i === 0 ? 'rgba(0,230,138,0.18)' : 'rgba(255,255,255,0.06)'}`, marginBottom: 6 }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ padding: '2px 7px', borderRadius: 20, background: i === 0 ? '#00e68a' : 'rgba(255,255,255,0.08)', color: i === 0 ? '#06281c' : '#fff', fontWeight: 800, fontSize: 10 }}>#{i + 1} {a.type}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{a.targetName || a.tempo || a.execCues?.[0] || a.type}</span>
                        <span style={{ marginLeft: 'auto', fontSize: 10, padding: '2px 7px', borderRadius: 20, background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.18)', color: '#a78bfa' }}>увер. {(a.confidence * 100).toFixed(0)}%</span>
                      </div>
                      <div style={{ fontSize: 10, color: '#fff', lineHeight: 1.4, marginBottom: 4 }}>{a.reason}</div>
                      <div style={{ fontSize: 10, color: '#60a5fa', marginBottom: 6 }}>{a.deltaPreview} {delta?.summary ? `· Δ ${delta.summary}` : ''} {delta?.issuesResolved?.length ? `→ исправит: ${delta.issuesResolved.join(', ')}` : ''}</div>
                      <button onClick={() => handleApplyExerciseCorrection(a as any, selectedExRaw?.id || null)} data-bb="apply-correction" style={{ width: '100%', minHeight: 48, padding: '10px 12px', borderRadius: 10, background: i === 0 ? 'linear-gradient(135deg,#00e68a,#00c853)' : 'rgba(255,255,255,0.06)', color: i === 0 ? '#06281c' : '#fff', border: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.08)', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>▶ Применить в ББ-авто</button>
                    </div>
                  );
                })}
                {selectedCorrections.length > 3 && (
                  <details style={{ fontSize: 10, color: '#fff' }}>
                    <summary style={{ cursor: 'pointer', color: ACCENT }}>Ещё {selectedCorrections.length - 3} коррекции</summary>
                    <div style={{ marginTop: 6 }}>
                      {selectedCorrections.slice(3).map((a: any, i: any) => (
                        <div key={i} style={{ padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', marginBottom: 4 }}>
                          <div style={{ fontWeight: 700, color: '#fff' }}>{a.type} {a.targetName || a.tempo || ''}</div>
                          <div style={{ color: '#fff' }}>{a.reason}</div>
                          <button onClick={() => handleApplyExerciseCorrection(a as any, selectedExRaw?.id || null)} data-bb="apply-correction-more" style={{ marginTop: 4, minHeight: 44, padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Применить</button>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}

            {/* Секция 5: Библиотека */}
            <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>5 · Библиотека упражнений (подробно по каждому)</div>
              <div style={{ fontSize: 10, color: '#fff', marginBottom: 6 }}>Детали объёма — <b>📐 Объём-хаб → Объём</b> · качество плана — <b>→ Качество</b> · нагрузка — <b>⚡ Интеллект</b> (без дублей, здесь только выбор).</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }} data-bb="lib-filters">
                <BbSheetSelect label="Стимул от " value={String(state.exerciseFilterSfr)} onChange={(v) => setState(s => ({ ...s, exerciseFilterSfr: parseInt(v) }))} options={[{ id: '0', label: 'Любой' }, { id: '4', label: '4 и выше' }, { id: '5', label: 'Только 5' }]} />
                <BbSheetSelect label="Профиль" value={state.exerciseFilterProfile} onChange={(v) => setState(s => ({ ...s, exerciseFilterProfile: v }))} options={[{ id: 'all', label: 'Все' }, { id: 'lengthened', label: 'Растянутая' }, { id: 'mid', label: 'Средняя' }, { id: 'short', label: 'Пиковая' }]} />
              </div>
              <div style={{ marginBottom: 6 }}><BbCheckCard active={state.exerciseFilterUnilateral} title="Только односторонние" desc="гантели, по одной стороне" onToggle={() => setState(s => ({ ...s, exerciseFilterUnilateral: !s.exerciseFilterUnilateral }))} /></div>
              {libraryNote && (
                <div data-bb="catalog-limit-library" style={{ fontSize: 10, color: '#94a3b8', marginBottom: 6, lineHeight: 1.45 }}>{libraryNote}</div>
              )}
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxHeight: 160, overflowY: 'auto' }}>
                {exerciseLibrary.list.map((c: any) => {
                  const eff = (() => { try { return calcExerciseEffect(c as any, {}); } catch { return null; } })();
                  const sc = eff ? exerciseEffectScore(eff) : 50;
                  const col = sc >= 70 ? '#22c55e' : sc >= 50 ? '#f59e0b' : '#ef4444';
                  const heads = (() => { try { return headsHitOf({ id: c.id, name: c.name }); } catch { return []; } })();
                  const hitsWeak = heads.some((h: any) => libWeakHeads.includes(h));
                  const bcol = hitsWeak ? '#00e68a' : col;
                  return (
                    <button key={c.id} type="button" title={`${c.name}: SFR ${eff?.sfr ?? '—'} · ${eff?.profile ?? '—'} · ${eff?.angleClass ?? '—'} · ${eff?.strictGroup?.key ?? '—'} · ${eff?.jointStress ?? '—'} · бьёт: ${heads.join(', ') || '—'}`} aria-label={`Разобрать ${c.name}`} style={{ padding: '3px 7px', borderRadius: 20, background: hitsWeak ? 'rgba(0,230,138,0.12)' : `${col}12`, border: `1px solid ${bcol}${hitsWeak ? '' : '22'}`, color: hitsWeak ? '#00e68a' : col, fontSize: 10, fontWeight: hitsWeak ? 800 : 600, cursor: 'pointer' }} onClick={() => setState(s => ({ ...s, exerciseSelectedId: c.id, stimCheating: false, stimShortRom: false, stimSetupNote: '' }))}>
                      {hitsWeak ? '🎯 ' : ''}{c.name} · СФР {eff?.sfr ?? '—'} {eff?.profile === 'lengthened' ? '📐' : eff?.profile === 'short' ? '🔹' : '▪'} {eff?.unilateral ? '↔' : ''} ·{sc}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Секция 6: LVP-калибровка (Э6 PRO-5 — движок был без UI) */}
            <details data-bb="lvp-card" style={{ marginTop: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <summary style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center', fontSize: 11, fontWeight: 700, color: ACCENT }}>6 · ⚡ LVP-калибровка (индивидуальный профиль нагрузка–скорость)</summary>
              <div style={{ fontSize: 10, color: '#fff', marginTop: 6, lineHeight: 1.5 }}>
                3+ точки «вес скорость лучшего повтора», по одной в строке: «80 0.62» (кг, м/с). Профиль даёт индивидуальный e1RM при MVT движения (канон VBT).
                В мост/план не идёт — ориентир; в отчёт уходит рабочий коридор. Сохранено профилей: {lvpSaved}.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6, marginTop: 6 }}>
                <BbSheetSelect label="Движение" value={lvpLift} onChange={setLvpLift} testId="bb-lvp-lift" options={LVP_LIFTS} />
                <textarea value={lvpText} onChange={(e) => setLvpText(e.target.value)} placeholder={'80 0.62\n100 0.5\n120 0.4'} aria-label="Точки вес скорость" data-bb="lvp-text" data-testid="bb-lvp-text" style={{ minHeight: 72, padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 16, resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                <button onClick={runLvp} data-bb="lvp-run" style={{ minHeight: 48, padding: '10px 14px', borderRadius: 10, background: 'rgba(0,230,138,0.12)', border: '1px solid rgba(0,230,138,0.30)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>📈 Калибровать</button>
                {lvpSaved > 0 && <button onClick={clearLvp} data-bb="lvp-clear" style={{ minHeight: 48, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Очистить профили</button>}
              </div>
              {lvpProfile && (
                <div data-bb="lvp-result" style={{ marginTop: 6, fontSize: 10, color: lvpProfile.valid ? '#22c55e' : '#f59e0b', lineHeight: 1.5 }}>
                  {lvpProfile.text}
                </div>
              )}
              {/* BB-D-33: рабочий коридор виден в хабе и уезжает в отчёт одним и тем же текстом. */}
              {lvpWorkingRange && (
                <div data-bb="working-range" style={{ marginTop: 4, fontSize: 10, color: '#fff', lineHeight: 1.5 }}>
                  🏋️ Рабочий вес (ориентир): {lvpWorkingRange}
                </div>
              )}
            </details>
          </div>
  );
};

export default BbExerciseTab;
