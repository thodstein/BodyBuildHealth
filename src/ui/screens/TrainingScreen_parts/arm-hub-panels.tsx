/**
 * arm-hub-panels.tsx — панели хаба диагностики: шапка, контролы, вывод,
 * P0-блок, стол-полоса, CTA. Чистая презентация (props H: any), логика
 * живёт в ArmDiagnosticsHub. Строки и aria 1-в-1.
 */
import React from 'react';
import { ARM_MUSCLE_RU } from '../../../engines/arm/arm-types';
import { getArmLandmarks } from '../../../engines/arm/arm-volume-landmarks.engine';
import type { ArmWeakPoint } from '../../../engines/arm/arm-biomechanics.engine';
import { scoreLabel } from '../../../engines/arm/arm-scoring.engine';
import { simulateArmInjection } from '../../../engines/arm/arm-simulator.engine';
import { AdCard, AdSec, AdGrid, AdField, AdChip, AdBtn, AdBanner, AdCta, AdSteps } from './arm-design-system';
import { CARD } from './training-ui';

/* BB-shell: hero/controls/action поверх тех же .ad-* классов и data-arm
 * хуков (APK-CSS и тесты целы) — только воздух, иерархия CTA и липкость. */
const HUB_HERO: React.CSSProperties = {
  ...CARD,
  borderTop: '2px solid rgba(245, 158, 11, 0.5)',
  padding: '10px 12px',
};
const HUB_SECTION_GAP: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 };
import { LEVEL_OPTS, TAB_DEFS } from './arm-hub-shared';

export function HubHead({ H }: { H: any }) {
  const { state, report, scoring, showScoring, weightClassAuto, benchRes, forceVecPro, toast, hasWeak } = H;
  return (
    <div className="ad-card" data-tone="amber" data-arm="hub-head" style={HUB_HERO}>
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
          <div className="ad-head-side" data-arm="hub-score">
            <span className="ad-score-ring" data-level={scoring.level} aria-hidden>
            <svg width="68" height="68" viewBox="0 0 40 40" role="img" aria-label={`Скор ${scoring.score}`}>
              <circle cx="20" cy="20" r="15" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="5" />
              <circle cx="20" cy="20" r="15" fill="none" stroke={col} strokeWidth="5" strokeLinecap="round"
                strokeDasharray={`${(circ * pct / 100).toFixed(1)} ${circ.toFixed(1)}`} transform="rotate(-90 20 20)" />
              <text x="20" y="24" textAnchor="middle" fontSize="11" fontWeight="900" fill="#fff">{scoring.score}</text>
            </svg>
            </span>
            <div className="ad-muted">{scoreLabel(scoring.score)} · v{Math.round(scoring.verification*100)}%</div>
            {scoring.floors.length>0 && <div className="ad-tip">{scoring.floors[0]}</div>}
          </div>
          );
        })()}
      </div>
      <div className="ad-row" data-arm="hub-tags">
        <span className="ad-tag">Table {(report.tableRatio*100).toFixed(0)}% (3/2/1) · Tendon {report.tendonLoad}/22 · WAF {weightClassAuto}кг</span>
        <span className="ad-tag">{benchRes.level} · {Math.round(benchRes.avgScore*10)/10} (сила {forceVecPro.totalScore})</span>
        {report.asymmetryPct!=null && <span className="ad-tag">Асимметрия {report.asymmetryPct}%</span>}
      </div>
      <AdSec title="ℹ️ Как пользоваться" collapsible defaultOpen={false} summary="4 шага до плана">
        <div className="ad-muted">
          <b>1 Тело</b> — вес, хват (RT/Axle/Pinch), VBT · <b>2 Точки</b> — 1–3 мёртвые точки из 12 (подсветка ● = для твоей техники) · <b>3 Тесты</b> — 4×F/t + L/R + стол/scale · <b>4 План</b> — причины → топ-3 → «💉 Вставить» или «→ Применить в Арм-конструктор» внизу. Видео — опционально.
        </div>
      </AdSec>
      {showScoring && scoring && <div className="ad-muted">{scoring.findings.slice(0,3).map((f: any)=>f.text).join(' · ')} {scoring.floors.length? `· floor: ${scoring.floors.join(', ')}` : ''} · v{Math.round(scoring.verification*100)}% (видео 0.35+VBT 0.35+история 0.30)</div>}
      {toast && <AdBanner tone="ok">{toast}</AdBanner>}
    </div>
  );
}

export function HubControls({ H }: { H: any }) {
  const { state, setState, weightClassAuto, tab, setTab } = H;
  return (
    <div style={HUB_SECTION_GAP}>
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
      {state.level === 'beginner' && state.technique === 'press' && (
        <AdBanner tone="warn">
          <b>⚠ Новичкам пресс опасен</b>
          <div>Тендоны локтя рвутся от пресса из невыгодной позиции — только из нейтрали, начни с хука/топролла.</div>
        </AdBanner>
      )}
      <AdSteps steps={TAB_DEFS.map(t=>({ id: t.id, label: `${t.icon} ${t.label}` }))} active={tab} onSelect={(id)=>setTab(id)} hook="hub-tabs" numbered={false} />
    </div>
  );
}

export function HubOutput({ H }: { H: any }) {
  const { report, diag, state } = H;
  return (
    <AdCard>
      <AdSec title="🔬 Диагностика — мёртвые точки (12) + сустав/сухожилие">
        <div className="ad-muted">{report.findings.slice(0,3).map((f:any)=>f.text).join(' · ')} {report.asymmetryPct!=null ? `· Асим ${report.asymmetryPct}%` : ''} {(report as any).weakPoints?.length? `· точек ${(report as any).weakPoints.join(', ')}` : ''}</div>
        {report.findings.length>3 && <div className="ad-sec">{report.findings.map((f:any,i:number)=><div key={i} className="ad-finding" data-level={f.level} style={{ color: f.level==='critical'?'#ef4444': f.level==='warn'?'#f59e0b':'#22c55e' }}>• {f.text} {f.level!=='ok'?'('+f.level+')':''}</div>)}</div>}
        {(diag as any).biomechCards?.length ? (
          <div className="ad-muted">Биомех-карточки ({(diag as any).biomechCards.length}: {(diag as any).biomechCards.map((c:any)=>c.weakPoint).join(', ')}) — полностью во вкладке «🤚 Кисть/Ротация» (углы + коррекции + VBT-пороги), здесь не дублируем.</div>
        ) : diag.priorities.length===0 ? <div className="ad-muted">Слабые зоны не выявлены — баланс. {H.dynamicReport && (H.dynamicReport as any).asymmetry ? `· ${(H.dynamicReport as any).tactic}` : ''}</div> : (
          <div className="ad-list">
            {diag.priorities.map((p: any,i: number)=>(
              <div key={i} className="ad-sec ad-bio" data-valid="na">
                <div className="ad-row">
                  <span><b>{ARM_MUSCLE_RU[p.muscle as any] || p.muscle}</b></span>
                  <span className="ad-tag ad-angle">MEV {getArmLandmarks(state.level, p.muscle).mev} · MAV {getArmLandmarks(state.level, p.muscle).mav} · MRV {getArmLandmarks(state.level, p.muscle).mrv}</span>
                </div>
                <div className="ad-muted">{p.reason}</div>
                <div className="ad-tip">{p.exercises.join(' · ')}</div>
                <div className="ad-muted">Tendon {getArmLandmarks(state.level, p.muscle).mrv <=9?'низкий (humerus)':'в норме'}</div>
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
      </AdSec>
    </AdCard>
  );
}

const RED_FLAGS: Array<{ id: string; label: string }> = [
  { id: 'pain', label: 'Острая боль' },
  { id: 'swell', label: 'Отёк' },
  { id: 'click', label: 'Щелчки в локте' },
  { id: 'numb', label: 'Онемение пальцев' },
  { id: 'fract', label: 'Перелом <6 мес' },
];

export function HubP0Panel({ H }: { H: any }) {
  const { state, armAudit, armWorst, armCausesP0, armTop3P0, armSpecP0, diaryTrendsP0, diarySuggestP0, toggleWeakPoint, handleInjectP0, hasInjectPrev, handleRollbackP0, handleExportHtmlP0, handlePrintP0, handleExportCsvP0, injectMsg, criticalSideP0, specWeeks, setSpecWeeks, armPlan, setTab } = H;
  const [redFlags, setRedFlags] = React.useState<string[]>([]);
  const toggleRed = (id: string) => setRedFlags((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  return (
    <AdCard>
      <AdSec title="🚨 Red-flags — скрининг перед тестами" collapsible defaultOpen={false} summary={redFlags.length ? `🔴 ${redFlags.length}` : 'проверь себя'}>
        <div className="ad-chips" data-arm="red-flags">
          {RED_FLAGS.map((f) => (
            <AdChip key={f.id} active={redFlags.includes(f.id)} tone="red" onClick={() => toggleRed(f.id)}>{f.label}</AdChip>
          ))}
        </div>
        {redFlags.length > 0 ? (
          <AdBanner tone="bad">
            <b>🔴 Стоп: {redFlags.map((id) => RED_FLAGS.find((f) => f.id === id)?.label).join(', ')}</b>
            <div>Сначала врач + return-to-pull (вкладка «Сухожилие/Восстановление»), тесты — после. Это скрининг, не диагноз.</div>
            <AdBtn variant="danger" onClick={() => setTab('recovery')}>→ К return-to-pull</AdBtn>
          </AdBanner>
        ) : (
          <div className="ad-muted">Ничего из списка? Можно тестироваться. Скрининг, не диагноз.</div>
        )}
      </AdSec>
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
                <div key={wp} className="ad-sec ad-bio" data-valid={cause ? 'ok' : 'na'}>
                  <div><b>{wp} {cause ? `· ${cause.cause} (${Math.round(cause.confidence * 100)}%)` : ''}</b></div>
                  {cause && <div className="ad-volbar" aria-hidden><span style={{ width: `${Math.round(cause.confidence * 100)}%` }} /></div>}
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

export function HubTabNext({ H }: { H: any }) {
  const { tab, setTab } = H;
  const idx = Math.max(0, TAB_DEFS.findIndex((t) => t.id === tab));
  const next = TAB_DEFS[(idx + 1) % TAB_DEFS.length];
  return (
    <div style={{ marginTop: 8 }}>
      <AdBtn variant="ghost" block aria-label="Следующий шаг диагностики" onClick={() => setTab(next.id)}>
        Шаг {idx + 1} из {TAB_DEFS.length} · Далее: {next.icon} {next.label} →
      </AdBtn>
    </div>
  );
}

const SCEN_KEY = 'he_arm_diag_scenarios';
type DiagScenario = { id: string; date: string; fields: Record<string, string>; weakPoints: string[] };
function loadScenarios(): DiagScenario[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(SCEN_KEY) : null;
    const j = raw ? JSON.parse(raw) : [];
    return Array.isArray(j) ? j.filter((s) => s && typeof s === 'object').slice(0, 6) : [];
  } catch { return []; }
}
function saveScenarios(list: DiagScenario[]): void {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(SCEN_KEY, JSON.stringify(list.slice(0, 6))); } catch {}
}

export function HubScenarios({ H }: { H: any }) {
  const { state, setState } = H;
  const [scens, setScens] = React.useState<DiagScenario[]>(() => loadScenarios());
  const take = () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const s: DiagScenario = {
      id: `${d.getTime()}`,
      date: `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`,
      fields: { rtKg: state.rtKg, axleKg: state.axleKg, pinchSec: state.pinchSec, sideKg: state.sideKg, backKg: state.backKg, leftKg: state.leftKg, rightKg: state.rightKg, bwKg: state.bwKg },
      weakPoints: [...state.weakPoints],
    };
    setScens((p) => { const n = [s, ...p].slice(0, 6); saveScenarios(n); return n; });
  };
  const load = (s: DiagScenario) => setState((prev: any) => ({ ...prev, ...s.fields, weakPoints: [...s.weakPoints] }));
  const drop = (id: string) => setScens((p) => { const n = p.filter((s) => s.id !== id); saveScenarios(n); return n; });
  const deltaLine = (s: DiagScenario) => {
    const parts: string[] = [];
    const num = (a: string, b: string, label: string) => {
      const x = parseFloat(a); const y = parseFloat(b);
      if (Number.isFinite(x) && Number.isFinite(y) && x > 0 && y > 0 && x !== y) parts.push(`${label} ${y > x ? '+' : ''}${Math.round((y - x) * 10) / 10}`);
    };
    num(s.fields.rtKg, state.rtKg, 'RT');
    num(s.fields.sideKg, state.sideKg, 'Side');
    num(s.fields.backKg, state.backKg, 'Back');
    num(s.fields.pinchSec, state.pinchSec, 'Pinch');
    const added = state.weakPoints.filter((w: string) => !s.weakPoints.includes(w));
    const gone = s.weakPoints.filter((w: string) => !state.weakPoints.includes(w));
    if (added.length) parts.push(`точки +${added.join('+')}`);
    if (gone.length) parts.push(`точки −${gone.join('−')}`);
    return parts.length ? `Δ vs сейчас: ${parts.join(' · ')}` : 'Δ vs сейчас: без изменений';
  };
  return (
    <AdCard>
      <AdSec title={`📸 Сценарии замеров (${scens.length}/6)`} collapsible defaultOpen={false} summary={scens.length ? 'было/стало' : 'сними сейчас'}>
        <div className="ad-row">
          <AdBtn variant="dark" onClick={take}>📸 Снапшот текущего</AdBtn>
          {scens.length === 0 && <span className="ad-muted">Сними замер — через недели сравнишь прогресс RT/Side/точек.</span>}
        </div>
        {scens.length > 0 && (
          <div className="ad-list">
            {scens.map((s) => (
              <div key={s.id} className="ad-sec" data-arm="scenario">
                <div className="ad-row">
                  <span><b>{s.date}</b></span>
                  <span className="ad-muted">RT {s.fields.rtKg || '—'} · Side {s.fields.sideKg || '—'} · точки {s.weakPoints.join(', ') || '—'}</span>
                </div>
                <div className="ad-muted">{deltaLine(s)}</div>
                <div className="ad-row">
                  <AdBtn variant="dark" onClick={() => load(s)}>📥 Загрузить</AdBtn>
                  <AdBtn variant="dark" onClick={() => drop(s.id)}>✕</AdBtn>
                </div>
              </div>
            ))}
          </div>
        )}
      </AdSec>
    </AdCard>
  );
}

export function HubAction({ H }: { H: any }) {
  const { applyToConstructor, state, diag, dynamicReport, report } = H;
  return (
    <AdCard>
      <AdCta>
      <AdBtn variant="amber" block hero onClick={applyToConstructor}>→ Применить в Арм-конструктор ({(state.weakPoints.length? state.weakPoints.join(', ') : diag.weakMuscles.slice(0,2).join(', ')) || (dynamicReport && Object.keys((dynamicReport as any).metrics||{}).length ? 'динамика' : 'баланс')} · {(state.weakPoints.length? `${state.weakPoints.length} точек` : `${diag.weakMuscles.length} мышц`)})</AdBtn>
      </AdCta>
      <div className="ad-muted">Bridge: <code>weakpoints</code> → <code>ArmAutoConstructor</code> via <code>planner-bridge</code> · <code>armWeakPoints(12)</code>+<code>biomechCards</code>+<code>corrections</code>+<code>armDynamic</code>+<code>scoring</code> в payload · dedup/budget/humerus gated</div>
      {(diag as any).biomechCards?.length ? <div className="ad-muted">Инъекция: {(diag as any).biomechCards.map((c:any)=> `${c.weakPoint}→${c.corrections[0]}`).join(' · ')} · per-day ≤8, budget {(report as any).scoring?.score ?? ''}</div> : null}
    </AdCard>
  );
}
