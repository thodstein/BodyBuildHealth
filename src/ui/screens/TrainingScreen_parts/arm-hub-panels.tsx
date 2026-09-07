/**
 * arm-hub-panels.tsx — панели хаба диагностики: шапка, контролы, вывод,
 * P0-блок, стол-полоса, CTA. Чистая презентация (props H: any), логика
 * живёт в ArmDiagnosticsHub. Строки и aria 1-в-1.
 */
import React from 'react';
import { ARM_MUSCLE_RU } from '../../../engines/arm/arm-types';
import { getArmLandmarks } from '../../../engines/arm/arm-volume-landmarks.engine';
import { ARM_CORRECTIONS } from '../../../engines/arm/arm-weakpoint-corrections';
import type { ArmWeakPoint } from '../../../engines/arm/arm-biomechanics.engine';
import { angleJointForWeakPoint, isValidAngleForArmWeakPoint } from '../../../engines/arm/arm-biomechanics.engine';
import { scoreLabel } from '../../../engines/arm/arm-scoring.engine';
import { simulateArmInjection } from '../../../engines/arm/arm-simulator.engine';
import { AdCard, AdSec, AdGrid, AdField, AdChip, AdBtn, AdBanner, AdSteps } from './arm-design-system';
import { LEVEL_OPTS, TAB_DEFS } from './arm-hub-shared';

export function HubHead({ H }: { H: any }) {
  const { state, report, scoring, showScoring, weightClassAuto, benchRes, forceVecPro, toast, hasWeak } = H;
  return (
    <div className="ad-card" data-tone="amber" data-arm="hub-head">
      <div className="ad-head">
        <div className="ad-head-ic" aria-hidden>
          🤝
        </div>
        <div className="ad-head-tx">
          <h2 className="ad-head-title">Арм-диагностика — PRO MAX хаб</h2>
          <p className="ad-head-sub">5 таба × РУ/РА/РН × VBT × Force + Динамика F/t F100/F500 × Асимметрия × Бенчмарки × Fatigue × Tendon ACWR</p>
        </div>
        <div className="ad-head-side">
          <div>{hasWeak ? ((state.weakPoints.length? state.weakPoints.join(', ') : report.weakMuscles.join(', '))) : 'баланс'}</div>
          <div className="ad-muted">{hasWeak ? `${(report as any).weakPoints?.length||0} мёртвых точек · ${report.findings.length} факта` : 'слабые зоны не выявлены'}</div>
        </div>
        {showScoring && scoring && (()=>{
          const pct = Math.max(0, Math.min(100, Number(scoring.score) || 0));
          const col = scoring.level==='ok' ? '#22c55e' : scoring.level==='warn' ? '#f59e0b' : '#ef4444';
          const circ = 2 * Math.PI * 15;
          return (
          <div className="ad-head-side">
            <svg width="52" height="52" viewBox="0 0 40 40" role="img" aria-label={`Скор ${scoring.score}`}>
              <circle cx="20" cy="20" r="15" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="5" />
              <circle cx="20" cy="20" r="15" fill="none" stroke={col} strokeWidth="5" strokeLinecap="round"
                strokeDasharray={`${(circ * pct / 100).toFixed(1)} ${circ.toFixed(1)}`} transform="rotate(-90 20 20)" />
              <text x="20" y="24" textAnchor="middle" fontSize="11" fontWeight="900" fill="#fff">{scoring.score}</text>
            </svg>
            <div className="ad-muted">{scoreLabel(scoring.score)} · v{Math.round(scoring.verification*100)}%</div>
            {scoring.floors.length>0 && <div>{scoring.floors[0]}</div>}
          </div>
          );
        })()}
      </div>
      <div className="ad-row">
        <span className="ad-tag">Table {(report.tableRatio*100).toFixed(0)}% (3/2/1) · Tendon {report.tendonLoad}/22 · WAF {weightClassAuto}кг</span>
        <span className="ad-tag">{benchRes.level} · {Math.round(benchRes.avgScore*10)/10} (сила {forceVecPro.totalScore})</span>
        {report.asymmetryPct!=null && <span className="ad-tag">Асимметрия {report.asymmetryPct}%</span>}
      </div>
      <AdSec title="ℹ️ Как пользоваться" collapsible defaultOpen={false} summary="12 точек + тесты">
        <div className="ad-muted">
           Выбери <b>12 мёртвых точек</b> (группы Кисть/Ротация/Давление) + провалы + хват + углы + 4 теста силы (кг+мс) + VBT → получи биомех-карточки (угол {`{0-20°при 110°}`}) + коррекции из каталога. Кнопка <b>«Применить в Арм-конструктор»</b> отправит мёртвые точки + динамику. RSS оверлей — только при видео/VBT/истории. Видео — опционально (BlazePose/HANDS).
        </div>
      </AdSec>
      {showScoring && scoring && <div className="ad-muted">{scoring.findings.slice(0,3).map((f: any)=>f.text).join(' · ')} {scoring.floors.length? `· floor: ${scoring.floors.join(', ')}` : ''} · v{Math.round(scoring.verification*100)}% (видео 0.35+VBT 0.35+история 0.30)</div>}
      {toast && <AdBanner tone="ok">{toast}</AdBanner>}
    </div>
  );
}

export function HubControls({ H }: { H: any }) {
  const { state, setState, weightClassAuto, applyToConstructor, tab, setTab } = H;
  return (
    <>
      <div>
        <div className="ad-fl">Уровень</div>
        <div className="ad-chips">
          {LEVEL_OPTS.map(o=> <AdChip key={o.id} active={state.level===o.id} onClick={()=>setState((s: any)=>({...s, level:o.id}))}>{o.label}</AdChip>)}
        </div>
      </div>
      <div>
        <div className="ad-fl">Техника</div>
        <div className="ad-chips">
          {[{id:'balanced',label:'Сбалансировано'},{id:'hook',label:'Хук'},{id:'toproll',label:'Топролл'},{id:'press',label:'Пресс'}].map(o=> <AdChip key={o.id} active={state.technique===o.id} onClick={()=>setState((s: any)=>({...s, technique:o.id}))}>{o.label}</AdChip>)}
        </div>
      </div>
      <AdGrid cols="2">
        <AdField label="Вес кг">
          <input inputMode="decimal" value={state.bwKg} onChange={e=>setState((s: any)=>({...s, bwKg:e.target.value}))} placeholder="80" />
        </AdField>
        <AdField label="Класс WAF">
          <input value={weightClassAuto} readOnly />
        </AdField>
      </AdGrid>
      <div>
        <div className="ad-fl">Пол</div>
        <div className="ad-chips">
          {[{id:'male',label:'Мужской'},{id:'female',label:'Женский'}].map(o=> <AdChip key={o.id} active={state.sex===o.id} onClick={()=>setState((s: any)=>({...s, sex:o.id}))}>{o.label}</AdChip>)}
        </div>
      </div>
      <AdBtn variant="amber" block onClick={applyToConstructor}>→ Применить в Арм-конструктор</AdBtn>
      <AdSteps steps={TAB_DEFS.map(t=>({ id: t.id, label: `${t.icon} ${t.label}` }))} active={tab} onSelect={(id)=>setTab(id)} hook="hub-tabs" />
    </>
  );
}

export function HubOutput({ H }: { H: any }) {
  const { report, diag, state } = H;
  return (
    <AdCard>
      <AdSec title="🔬 Диагностика — мёртвые точки (12) + сустав/сухожилие">
        <div className="ad-muted">{report.findings.slice(0,3).map((f:any)=>f.text).join(' · ')} {report.asymmetryPct!=null ? `· Асим ${report.asymmetryPct}%` : ''} {(report as any).weakPoints?.length? `· точек ${(report as any).weakPoints.join(', ')}` : ''}</div>
        {report.findings.length>3 && <div className="ad-sec">{report.findings.map((f:any,i:number)=><div key={i} style={{ color: f.level==='critical'?'#ef4444': f.level==='warn'?'#f59e0b':'#22c55e' }}>• {f.text} {f.level!=='ok'?'('+f.level+')':''}</div>)}</div>}
        {(diag as any).biomechCards?.length ? (
          <div className="ad-list">
            {(diag as any).biomechCards.map((c:any)=>{
              const aj = angleJointForWeakPoint(c.weakPoint);
              const curDeg = aj==='wrist' ? (parseFloat(state.wristDeg)||10) : aj==='elbow' ? (parseFloat(state.elbowDeg)||110) : (parseFloat(state.forearmDeg)||90);
              const valid = aj==='none' ? null : isValidAngleForArmWeakPoint(c.weakPoint, curDeg);
              return (
              <div key={c.weakPoint} className="ad-sec">
                <div className="ad-row">
                  <span><b>{c.label}</b></span>
                  <span className="ad-tag">{c.angleRangeDeg[0]}-{c.angleRangeDeg[1]}° {c.keyJoint} {valid===null?'• угол н/п — контроль по технике':valid?'✅':'⚠ вне'}</span>
                  <span className="ad-muted">{c.weakMuscles.join('/')}</span>
                </div>
                <div className="ad-muted">{c.reason}</div>
                <div className="ad-tip"><b>Коррекции:</b> {c.corrections.join(' · ')} @ {Math.round(c.intensityPct*100)}% · <i>{c.loadCues}</i> · VBT warn {H.vbtThresholdForWeakPoint(c.weakPoint).warnPct}%/stop {H.vbtThresholdForWeakPoint(c.weakPoint).stopPct}%</div>
                <div className="ad-muted">День {ARM_CORRECTIONS[c.weakPoint as ArmWeakPoint]?.dayTags[0] || '—'} · {ARM_CORRECTIONS[c.weakPoint as ArmWeakPoint]?.sets}×{ARM_CORRECTIONS[c.weakPoint as ArmWeakPoint]?.repsRange.join('-')} RIR{ARM_CORRECTIONS[c.weakPoint as ArmWeakPoint]?.rir} {ARM_CORRECTIONS[c.weakPoint as ArmWeakPoint]?.holdSeconds?`hold ${ARM_CORRECTIONS[c.weakPoint as ArmWeakPoint]?.holdSeconds}с`:''} · {c.technique.join('/')}</div>
              </div>
              );
            })}
          </div>
        ) : diag.priorities.length===0 ? <div className="ad-muted">Слабые зоны не выявлены — баланс. {H.dynamicReport && (H.dynamicReport as any).asymmetry ? `· ${(H.dynamicReport as any).tactic}` : ''}</div> : (
          <div className="ad-list">
            {diag.priorities.map((p: any,i: number)=>(
              <div key={i} className="ad-sec">
                <div className="ad-row">
                  <span><b>{ARM_MUSCLE_RU[p.muscle as any] || p.muscle}</b></span>
                  <span className="ad-muted">{p.reason}</span>
                </div>
                <div className="ad-tip">{p.exercises.join(' · ')}</div>
                <div className="ad-muted">MEV {getArmLandmarks(state.level, p.muscle).mev} · MAV {getArmLandmarks(state.level, p.muscle).mav} · MRV <b>{getArmLandmarks(state.level, p.muscle).mrv}</b> · Tendon {getArmLandmarks(state.level, p.muscle).mrv <=9?'низкий (humerus)':''}</div>
              </div>
            ))}
          </div>
        )}
        {(report as any).corrections?.length ? (
          <AdBanner tone="ok">
            <b>Инъекция в план (предпросмотр):</b> {(report as any).corrections.map((c:any)=> `${c.weakPoint}→${c.exercises[0]} @${Math.round(c.intensityPct*100)}% в ${c.dayTags[0]}`).join(' · ')}
            <div>Дней инъекции: {Array.from(new Set((report as any).corrections.map((c:any)=>c.dayTags[0]))).join(', ')} · per-day dedup, budget {(report as any).scoring ? `RSS ${(report as any).scoring.score}` : ''}</div>
          </AdBanner>
        ) : null}
        {H.dynamicReport && (H.dynamicReport as any).metrics && (
          <AdBanner tone="warn">
            <b>Динамика F/t:</b> avgFt {(H.dynamicReport as any).avgFt ?? '—'} кг/с · total {(H.dynamicReport as any).totalF ?? '—'}кг · tactic {(H.dynamicReport as any).tactic} · {Object.entries((H.dynamicReport as any).metrics).map(([k,v]:any)=> v? `${k}:${v.ftIndex}`:'' ).filter(Boolean).join(' · ') || ''}
          </AdBanner>
        )}
        {H.showScoring && H.scoring && (
          <div className="ad-muted">
            <b>RSS {H.scoring.score} {scoreLabel(H.scoring.score)}</b> · v{Math.round(H.scoring.verification*100)}% · {H.scoring.findings.map((f: any)=>f.text).join(' · ')} {H.scoring.floors.length? `· floor ${H.scoring.floors.join(', ')}` : ''}
          </div>
        )}
      </AdSec>
    </AdCard>
  );
}

export function HubP0Panel({ H }: { H: any }) {
  const { state, armAudit, armWorst, armCausesP0, armTop3P0, armSpecP0, diaryTrendsP0, diarySuggestP0, toggleWeakPoint, handleInjectP0, hasInjectPrev, handleRollbackP0, handleExportHtmlP0, handlePrintP0, handleExportCsvP0, injectMsg, criticalSideP0, specWeeks, setSpecWeeks, armPlan } = H;
  return (
    <AdCard>
      <AdSec title="🧬 P0 PRO — план → причины → топ-3 → спец-блок → инъекция">
        <div className="ad-muted">
          {armAudit ? `Аудит плана: покрытие ${armAudit.covered.length}/12 (${armAudit.coveragePct}%) · стол ${(armAudit.tableRatio * 100).toFixed(0)}% · статика ${armAudit.staticSets}/динамика ${armAudit.dynamicSets}${armAudit.duplicates.length ? ` · дубли: ${armAudit.duplicates.slice(0, 3).join(', ')}` : ''}` : 'Нет плана арм (he_arm_plan_saved / he_arm_last_plan) — собери в Арм-конструкторе; причины и топ-3 работают и без плана'}
          {armWorst ? ` · 🎯 худшая из выбранных: ${armWorst}` : ''}
        </div>
        {state.weakPoints.length > 0 && (
          <div className="ad-list">
            {state.weakPoints.map((wp: ArmWeakPoint) => {
              const cause = (armCausesP0 as any)[wp];
              const top = (armTop3P0 as any)[wp] || [];
              const sim = (() => { try { return simulateArmInjection(armPlan as any, wp); } catch { return null; } })();
              return (
                <div key={wp} className="ad-sec">
                  <div><b>{wp} {cause ? `· ${cause.cause} (${Math.round(cause.confidence * 100)}%)` : ''}</b></div>
                  {cause && <div className="ad-muted">{cause.evidence.join(' · ')} → <b>{cause.fix}</b></div>}
                  {top.length > 0 && <div className="ad-tip">Топ-3: {top.map((t: any) => `${t.id} (${t.score})`).join(' · ')} {sim ? `· Δ ${sim.summary}` : ''}</div>}
                </div>
              );
            })}
          </div>
        )}
        <div className="ad-muted">
          {armSpecP0 ? `${armSpecP0.summary} · волна: ${armSpecP0.weeks.slice(0, 4).map((w: any) => `Н${w.week}:${w.kind}`).join(' ')}` : ''}
          {diaryTrendsP0.length ? ` · 📊 дневник: ${diaryTrendsP0.map((t: any) => `${t.muscle} ${t.deltaPct}% (${t.status})`).join(', ')}` : ' · 📊 дневник: нет e1RM-тренда (нужны сессии 28-56д)'}
          {diarySuggestP0.length ? ` → подсказка: ${diarySuggestP0.join(', ')}` : ''}
        </div>
        <div className="ad-row">
          <AdField label="Нед спец-блока">
            <input inputMode="numeric" value={specWeeks} onChange={(e) => setSpecWeeks(e.target.value)} />
          </AdField>
          {armWorst && !state.weakPoints.includes(armWorst as any) && (
            <AdBtn variant="amber" onClick={() => toggleWeakPoint(armWorst as any)}>🎯 Худшая в плане: {armWorst} → разобрать</AdBtn>
          )}
          {diarySuggestP0.length > 0 && (
            <AdBtn variant="dark" onClick={() => { for (const p of diarySuggestP0.slice(0, 3)) if (!state.weakPoints.includes(p as any)) toggleWeakPoint(p as any); }}>📊 Дневник → в слабые ({diarySuggestP0.slice(0, 3).join(', ')})</AdBtn>
          )}
          <AdBtn variant="primary" onClick={handleInjectP0}>💉 Вставить коррекции в план ({state.weakPoints.length || 0})</AdBtn>
          {hasInjectPrev && (
            <AdBtn variant="dark" onClick={handleRollbackP0}>↩ Откат</AdBtn>
          )}
          <AdBtn variant="dark" onClick={handleExportHtmlP0}>🖨 HTML</AdBtn>
          <AdBtn variant="dark" onClick={handlePrintP0}>🖨 Печать</AdBtn>
          <AdBtn variant="dark" onClick={handleExportCsvP0}>📥 CSV</AdBtn>
          {criticalSideP0 && <span className="ad-tip">🔴 критично — side только ремень/изометрия</span>}
        </div>
        {injectMsg && <AdBanner tone={injectMsg.startsWith('✓') || injectMsg.startsWith('↩') ? 'ok' : 'warn'}>{injectMsg}</AdBanner>}
      </AdSec>
    </AdCard>
  );
}

export function HubTableStrip({ H }: { H: any }) {
  const { tablePreview, forceHistory } = H;
  return (
    <AdCard>
      <AdSec title="🗓 Стол — периодизация 3/2/1 (Кузнецов VIII) — ≥50% стол" hint="≥50% тренировок — стол. Тейпер 2–3 нед: 0.65/0.45, side×0.5, RIR+1/+2. Moderate 50-75% 1-3мин / Heavy 75-100% 10с-1мин / Stress 100-125% 5-10с.">
        <div className="ad-strip">
          {tablePreview.map(({ wk, kind }: any) => {
            const col = kind==='moderate'? '#22c55e' : kind==='heavy'? '#f59e0b' : '#ef4444';
            return <div key={wk} className="ad-stat" style={{ borderTopColor: col }}><div className="ad-stat-v">{wk}</div><div className="ad-stat-l">{kind}</div></div>;
          })}
        </div>
        {forceHistory.trend && <div className="ad-tip">{forceHistory.trend.text}</div>}
      </AdSec>
    </AdCard>
  );
}

export function HubAction({ H }: { H: any }) {
  const { applyToConstructor, state, diag, dynamicReport, report } = H;
  return (
    <AdCard>
      <AdBtn variant="amber" block hero onClick={applyToConstructor}>→ Применить в Арм-конструктор ({(state.weakPoints.length? state.weakPoints.join(', ') : diag.weakMuscles.slice(0,2).join(', ')) || (dynamicReport && Object.keys((dynamicReport as any).metrics||{}).length ? 'динамика' : 'баланс')} · {(state.weakPoints.length? `${state.weakPoints.length} точек` : `${diag.weakMuscles.length} мышц`)})</AdBtn>
      <div className="ad-muted">Bridge: <code>weakpoints</code> → <code>ArmAutoConstructor</code> via <code>planner-bridge</code> · <code>armWeakPoints(12)</code>+<code>biomechCards</code>+<code>corrections</code>+<code>armDynamic</code>+<code>scoring</code> в payload · dedup/budget/humerus gated</div>
      {(diag as any).biomechCards?.length ? <div className="ad-muted">Инъекция: {(diag as any).biomechCards.map((c:any)=> `${c.weakPoint}→${c.corrections[0]}`).join(' · ')} · per-day ≤8, budget {(report as any).scoring?.score ?? ''}</div> : null}
    </AdCard>
  );
}
