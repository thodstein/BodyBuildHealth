/**
 * arm-hub-tabs1.tsx — табы хаба «Хват» и «Кисть/Ротация».
 * Чистая презентация (props H: any), логика живёт в ArmDiagnosticsHub.
 * Строки, плейсхолдеры, inputMode и aria 1-в-1.
 */
import React from 'react';
import { getRtWorldClass } from '../../../engines/arm/arm-force-capture.engine';
import { benchAdviceForLevel } from '../../../engines/arm/arm-benchmarks.engine';
import { ARM_BIOMECH, angleJointForWeakPoint, isValidAngleForArmWeakPoint, vbtThresholdForWeakPoint } from '../../../engines/arm/arm-biomechanics.engine';
import type { ArmWeakPoint } from '../../../engines/arm/arm-biomechanics.engine';
import { ARM_CORRECTIONS } from '../../../engines/arm/arm-weakpoint-corrections';
import { saveArmMeasureSnapshot } from '../../../engines/arm/arm-force-history.store';
import { savePlatformLogEntry } from '../../../engines/arm/arm-platform.engine';
import { hasVideoSupport } from '../../../engines/arm/arm-motion-capture.engine';
import { isOnline } from '../../../core/native-bridge';
import { AdSec, AdGrid, AdField, AdChip, AdBtn, AdBanner } from './arm-design-system';
import { WEAK_GROUPS, WP_LABEL_SHORT } from './arm-hub-shared';

export function HubGripTab({ H }: { H: any }) {
  const { state, setState, forceVecPro, weightClassAuto, bwNum, platformP0, measureHistP0, setMeasureTick, attKg, setAttKg, attOk, setAttOk, attHistP0, setAttTick, vbt, vbtThP0, benchRes, toggleWeakPoint } = H;
  return (
    <div>
      <AdSec title="✊ Замеры хвата" collapsible defaultOpen={true} summary="RT · Axle · Pinch · L/R">
      <AdGrid cols="auto-sm">
        <AdField label="RT кг">
          <input inputMode="decimal" value={state.rtKg} onChange={e=>setState((s: any)=>({...s, rtKg:e.target.value}))} placeholder="60" />
        </AdField>
        <AdField label="Axle кг">
          <input inputMode="decimal" value={state.axleKg} onChange={e=>setState((s: any)=>({...s, axleKg:e.target.value}))} placeholder="100" />
        </AdField>
        <AdField label="Pinch сек">
          <input inputMode="decimal" value={state.pinchSec} onChange={e=>setState((s: any)=>({...s, pinchSec:e.target.value}))} placeholder="15" />
        </AdField>
        <AdField label="Left кг">
          <input inputMode="decimal" value={state.leftKg} onChange={e=>setState((s: any)=>({...s, leftKg:e.target.value}))} placeholder="50" />
        </AdField>
        <AdField label="Right кг">
          <input inputMode="decimal" value={state.rightKg} onChange={e=>setState((s: any)=>({...s, rightKg:e.target.value}))} placeholder="55" />
        </AdField>
        <AdField label="Excalibur кг">
          <input inputMode="decimal" value={state.excalKg} onChange={e=>setState((s: any)=>({...s, excalKg:e.target.value}))} placeholder="40" aria-label="Excalibur кг" />
        </AdField>
      </AdGrid>
      <div>
        <div className="ad-fl">Снаряд Axle</div>
        <div className="ad-chips">
          <AdChip active={state.axleImpl !== 'apollon'} onClick={()=>setState((s: any)=>({...s, axleImpl:'saxon'}))}>Saxon (ориентир 133)</AdChip>
          <AdChip active={state.axleImpl === 'apollon'} onClick={()=>setState((s: any)=>({...s, axleImpl:'apollon'}))}>Apollon (М 237.5 / Ж 137.9)</AdChip>
        </div>
      </div>
      </AdSec>
      <AdGrid cols="2">
        <AdSec title={`Force Vector · WAF ${weightClassAuto}`}>
          <div className="ad-hero-side" data-arm="force-score">
            <div className="ad-hero-score" aria-hidden><b style={{ fontVariantNumeric: 'tabular-nums' }}>{forceVecPro.totalScore}</b><span>сила</span></div>
            <div className="ad-hero-name">Support {forceVecPro.gripSupport} · Pinch {forceVecPro.gripPinch}<span>Side {forceVecPro.sidePressure} · Back {forceVecPro.backPressure}</span></div>
            {forceVecPro.asymmetryPct!=null && <span className="ad-tag" data-sev={forceVecPro.asymmetryPct>=12?'bad':forceVecPro.asymmetryPct>=7?'warn':'ok'}>Асим {forceVecPro.asymmetryPct}%</span>}
          </div>
          <div className="ad-muted">WR M {getRtWorldClass('male')}кг / Ж {getRtWorldClass('female')}кг · Axle {state.axleImpl === 'apollon' ? '237.5/137.9' : 133} · Side ref {(bwNum*0.6).toFixed(0)}кг</div>
          {(()=>{
            const rows: Array<{ n: string; v: string }> = [];
            const rt = parseFloat(state.rtKg);
            if (Number.isFinite(rt) && rt > 0) {
              const wr = state.sex === 'female' ? getRtWorldClass('female') : getRtWorldClass('male');
              rows.push({ n: 'RT vs WR', v: `${rt}кг = ${Math.round((rt / wr) * 100)}% WR (${wr}кг)` });
            }
            const ax = parseFloat(state.axleKg);
            if (Number.isFinite(ax) && ax > 0) {
              const ap = state.axleImpl === 'apollon';
              const wr = ap ? (state.sex === 'female' ? 137.9 : 237.5) : 133;
              rows.push({ n: ap ? 'Axle vs Apollon WR' : 'Axle vs Saxon-ориентир', v: `${ax}кг = ${Math.round((ax / wr) * 100)}% (${wr}кг)` });
            }
            const ex = parseFloat(state.excalKg);
            if (Number.isFinite(ex) && ex > 0) rows.push({ n: 'Excalibur 50мм', v: `${ex}кг · норматив SAR по своей весовой (ред. 01.07.2025)` });
            const pin = parseFloat(state.pinchSec);
            if (Number.isFinite(pin) && pin > 0) rows.push({ n: 'Pinch vs норма', v: `${pin}с ${pin >= 10 ? '✓ ≥10с' : '⚠ <10с — чинить'}` });
            const sd = parseFloat(state.sideKg);
            if (Number.isFinite(sd) && sd > 0) rows.push({ n: 'Side vs WAF-норма', v: `${sd}кг vs ${Math.round(bwNum * 0.6)}кг (${Math.round((sd / Math.max(1, bwNum * 0.6)) * 100)}%)` });
            const bk = parseFloat(state.backKg);
            if (Number.isFinite(bk) && bk > 0) rows.push({ n: 'Back vs WAF-норма', v: `${bk}кг vs ${Math.round(bwNum * 0.8)}кг (${Math.round((bk / Math.max(1, bwNum * 0.8)) * 100)}%)` });
            if (!rows.length) return null;
            return (
              <div data-arm="norms-table">
                {rows.map((r) => (
                  <div key={r.n} className="ad-kv"><span>{r.n}</span><span>{r.v}</span></div>
                ))}
              </div>
            );
          })()}
          {platformP0 && (
            <div className="ad-muted">🏟 Помост RT: {platformP0.bestKg}кг = <b>{platformP0.wrPct}% WR</b> ({platformP0.worldRecordKg}кг) · попытки {platformP0.plan.join('/')} · {platformP0.note}</div>
          )}
          <div className="ad-muted">Весогонка WAF: М −0.5%/нед · Ж −0.4%/нед · L/R — отдельные зачёты</div>
          <div className="ad-row">
            <AdBtn variant="dark" onClick={() => { saveArmMeasureSnapshot({ rtKg: parseFloat(state.rtKg), sideKg: parseFloat(state.sideKg), backKg: parseFloat(state.backKg), leftKg: parseFloat(state.leftKg), rightKg: parseFloat(state.rightKg) }); setMeasureTick((x: number) => x + 1); }}>📸 Снапшот замеров</AdBtn>
            {measureHistP0.length > 0 && <span className="ad-muted">RT: {measureHistP0.slice(-5).map((h: any) => h.rtKg ?? '—').join(' → ')}</span>}
          </div>
          {measureHistP0.filter((h: any) => h.rtKg != null).length >= 2 && (
            <div className="ad-bars" data-arm="rt-bars">
              {(() => {
                const vals = measureHistP0.filter((h: any) => h.rtKg != null).slice(-12).map((h: any) => h.rtKg as number);
                const mx = Math.max(...vals);
                const mn = Math.min(...vals);
                const span = Math.max(1, mx - mn);
                return vals.map((v: number, i: number) => (
                  <div key={i} data-bar="rt" title={`${v}кг`} style={{ height: Math.round(6 + ((v - mn) / span) * 22), background: i === vals.length - 1 ? '#f59e0b' : 'rgba(245,158,11,0.35)' }} />
                ));
              })()}
            </div>
          )}
          <div className="ad-row">
            <AdField label="Попытка RT кг">
              <input aria-label="Попытка помост кг" inputMode="decimal" value={attKg} onChange={(e) => setAttKg(e.target.value)} placeholder="вес" />
            </AdField>
            <AdChip active={attOk} tone={attOk ? 'green' : 'red'} onClick={() => setAttOk((v: boolean) => !v)}>{attOk ? '✓ взята' : '✗ сорвана'}</AdChip>
            <AdBtn variant="dark" onClick={() => { const w = parseFloat(attKg); if (Number.isFinite(w) && w > 0) { savePlatformLogEntry({ implement: 'rolling_thunder', sex: state.sex, weightKg: w, success: attOk }); setAttKg(''); setAttTick((x: number) => x + 1); } }}>💾 Попытку</AdBtn>
            {attHistP0.length > 0 && <span className="ad-muted">Попытки: {attHistP0.slice(-5).map((h: any) => `${h.weightKg}${h.success ? '✓' : '✗'} ${h.wrPct}%`).join(' · ')}</span>}
          </div>
        </AdSec>
        <AdSec title="📟 Приборы — VBT" collapsible defaultOpen={false} summary="скорость · пороги">
        <AdSec title="VBT">
          <div className="ad-muted">{vbt.advice} {vbt.e1RM? `· e1RM ${vbt.e1RM}кг` : ''} · zone <b>{vbt.zone}</b></div>
          {vbtThP0 && <div className="ad-muted">Пороги точки {state.weakPoints[0]}: warn {vbtThP0.warnPct}% / stop {vbtThP0.stopPct}%</div>}
          {vbtThP0 && vbt.velocityLossPct != null && (
            <div data-arm="vbt-scale">
              <div className="ad-muted">Шкала потери: 0% · warn {vbtThP0.warnPct}% · stop {vbtThP0.stopPct}% · факт {vbt.velocityLossPct}%</div>
              <div className="ad-volbar" aria-hidden>
                <span style={{ width: `${Math.max(0, Math.min(100, Math.round((vbt.velocityLossPct / Math.max(1, vbtThP0.stopPct)) * 100)))}%` }} />
              </div>
            </div>
          )}
          <div className="ad-row" data-arm="vbt-inputs">
            <AdField label="Вес, кг">
              <input inputMode="decimal" value={state.vbtWeight} onChange={e=>setState((s: any)=>({...s, vbtWeight:e.target.value}))} placeholder="кг" aria-label="VBT вес кг" />
            </AdField>
            <AdField label="Повторы">
              <input inputMode="numeric" value={state.vbtReps} onChange={e=>setState((s: any)=>({...s, vbtReps:e.target.value}))} placeholder="повт" aria-label="VBT повторы" />
            </AdField>
            <AdField label="Скорость, м/с">
              <input inputMode="decimal" value={state.vbtVel} onChange={e=>setState((s: any)=>({...s, vbtVel:e.target.value}))} placeholder="м/с" aria-label="VBT скорость м/с" />
            </AdField>
          </div>
        </AdSec>
        </AdSec>
      </AdGrid>
      <AdSec title={`Бенчмарки · ${benchRes.level}`} collapsible defaultOpen={false} summary={benchRes.level}>
        <div className="ad-muted" data-arm="bench">{benchRes.details.map((d: any)=>`${d.id}:${d.value}→${d.level}`).join(' · ') || 'введи WristCurl/Coc'}</div>
        <div className="ad-muted">{benchAdviceForLevel(benchRes.level)}</div>
        <div className="ad-muted">CoC-ориентир (фунты, рейтинг IronMind — не калибровка): №1≈140 · №1.5≈168 · №2≈195 · №2.5≈238 · №3≈280 (мировой benchmark)</div>
      </AdSec>
      {(state.pinchSec && parseFloat(state.pinchSec) < 10) || (state.rtKg && parseFloat(state.rtKg) < 60) ? (
        <AdBanner tone="warn">
          <b>Слабое звено хвата → коррекция (contain_fingers)</b>
          <div>
            {state.pinchSec && parseFloat(state.pinchSec) < 10 ? `Pinch ${state.pinchSec}с <10с → hub_pinch / plate_pinch_hold 3×15с @60% · ` : ''}
            {state.rtKg && parseFloat(state.rtKg) < 60 ? `RT ${state.rtKg}кг <60 → rolling_thunder / apollon_axle DOH 3×5 @60%` : ''}
          </div>
          <AdChip active={state.weakPoints.includes('contain_fingers')} onClick={()=>toggleWeakPoint('contain_fingers')}>
            {state.weakPoints.includes('contain_fingers') ? '✓ contain_fingers выбрана' : '+ Добавить contain_fingers'}
          </AdChip>
        </AdBanner>
      ) : null}
      <div className="ad-muted">Нормы IronMind: RT 55 avg /84 accomplished /130.5 WR M /77.2 WR F. Axle Saxon WR 133кг. Side/back нормированы на WAF класс.</div>
    </div>
  );
}

export function HubWristTab({ H }: { H: any }) {
  const { state, setState, angles, angleValid, anglesVerified, recAngles, autoPoint, toggleWeakPoint, showCam, setShowCam, handleVideoFile, trackCsv, setTrackCsv, trackMetrics, trackType, trackSrd, setBaseXLoop, setTrackCsvClear, diag, clearWeakPoints, toggleLegacy, videoRef } = H;
  return (
    <div>
      <AdGrid cols="auto">
        <AdField label="Локоть°">
          <input inputMode="decimal" value={state.elbowDeg} onChange={e=>setState((s: any)=>({...s, elbowDeg:e.target.value}))} placeholder="110" />
        </AdField>
        <AdField label="Предплечье°">
          <input inputMode="decimal" value={state.forearmDeg} onChange={e=>setState((s: any)=>({...s, forearmDeg:e.target.value}))} placeholder="90" />
        </AdField>
        <AdField label="Кисть°">
          <input inputMode="decimal" value={state.wristDeg} onChange={e=>setState((s: any)=>({...s, wristDeg:e.target.value}))} placeholder="10" />
        </AdField>
        <div>
          <div className="ad-fl">Направление</div>
          <div className="ad-chips">
            {[{id:'to_little',label:'К мизинцу'},{id:'to_middle',label:'К среднему'},{id:'to_thumb',label:'К большому'}].map(o=> <AdChip key={o.id} active={state.direction===o.id} onClick={()=>setState((s: any)=>({...s, direction:o.id}))}>{o.label}</AdChip>)}
          </div>
        </div>
      </AdGrid>
      <AdBanner tone={angleValid.valid ? 'ok' : 'bad'}>
        <b>РУ: {angles.elbowDeg}° · {angles.direction} · pron {angles.pronDeg}° sup {angles.supDeg}° · {anglesVerified?'✓ верифицировано':'○ ручной ввод'}</b>
        <div>{angleValid.valid? '✓ В допуске' : angleValid.warnings.join(' · ')}</div>
        <div>Рекомендация для {state.technique}: {recAngles.elbowDeg}° {recAngles.direction} (hasVideoSupport: {hasVideoSupport()?'да':'нет — подключи Hands/BlazePose'})</div>
      </AdBanner>
      {autoPoint && !state.weakPoints.includes(autoPoint) && (
        <AdBanner tone="warn">
          <div>Авто по углам ({angles.elbowDeg}°/{angles.forearmDeg}°/{angles.wristDeg}°): похожа на <b>{autoPoint}</b> — {ARM_BIOMECH[autoPoint as ArmWeakPoint].label}</div>
          <AdChip active={false} onClick={()=>toggleWeakPoint(autoPoint)}>+ Добавить {autoPoint}</AdChip>
        </AdBanner>
      )}
      <AdSec title="📹 Видео (BlazePose/HANDS) — опционально" hint="Камера или landmarks JSON → углы автоматически (estimateAnglesFromLandmarks + angleBetween). Fallback — ручные ползунки." collapsible defaultOpen={false} summary={showCam ? 'камера вкл' : 'ручной ввод'}>
        {!isOnline() && <AdBanner tone="warn">📴 Офлайн (APK): Hands-модель грузится из CDN и недоступна — камера покажет картинку без live-углов, вводи углы вручную или JSON.</AdBanner>}
        <div className="ad-row">
          <AdChip active={showCam} tone="green" onClick={()=> setShowCam((v: boolean)=>!v)}>{showCam?'⏹ Выкл камеру':'📹 Включить камеру'}</AdChip>
          <label className="ad-chip">📁 JSON<input type="file" accept=".json" onChange={handleVideoFile} style={{ display:'none' }} /></label>
        </div>
        <AdSec title="📊 Kinovea CSV трекинга кисти (t,x,y)" collapsible defaultOpen={false} summary={trackMetrics ? `xLoop ${trackMetrics.xLoop} · ${trackMetrics.points} точек` : 'CSV не загружен'}>
          <textarea value={trackCsv} onChange={(e) => setTrackCsv(e.target.value)} placeholder={'t,x,y\n0,0,0\n0.1,1.2,0.5'} rows={3} className="ad-mono" />
          <div className="ad-row">
            <AdBtn variant="dark" onClick={() => { try { if (trackMetrics) { setBaseXLoop(String(trackMetrics.xLoop)); localStorage.setItem('he_arm_track_base', String(trackMetrics.xLoop)); } } catch {} }}>📌 База SRD</AdBtn>
            <AdBtn variant="dark" onClick={() => setTrackCsvClear()}>🗑 Очистить</AdBtn>
          </div>
          {trackMetrics && (
            <div className="ad-muted">
              xLoop {trackMetrics.xLoop} · yMax {trackMetrics.yMax} · vMax {trackMetrics.vMax} · точек {trackMetrics.points} · тип <b>{trackType === 'inside_hook' ? 'hook внутрь' : trackType === 'outside_toproll' ? 'toproll наружу' : 'press прямо'}</b>
              {trackSrd && <span> · {trackSrd}</span>}
              <div className="ad-tip">
                {trackType === 'inside_hook' ? 'Что чинить: держи пронацию, не отдавай кисть — качай pron_lock'
                  : trackType === 'outside_toproll' ? 'Что чинить: rising + тяга на себя, локоть 90° — качай rising_top'
                  : 'Что чинить: плечо за рукой, только из нейтрали — новичкам пресс опасен'}
              </div>
            </div>
          )}
        </AdSec>
        <div className="ad-sec">
          {showCam ? (
            <>
              <video ref={videoRef} className="ad-video" autoPlay muted playsInline />
              <div className="ad-row">
                <span className="ad-tag">Элбоу {angles.elbowDeg}°</span>
                <span className="ad-tag">{angles.direction}</span>
                <span className="ad-tag">{angleValid.valid?'✓':'⚠'}</span>
              </div>
            </>
          ) : (
            <>
              <div className="ad-video-ph" data-arm="video-ph">video preview — PRO: BlazePose + angleBetween()</div>
              <div className="ad-muted">Элбоу {angles.elbowDeg}° · forearm {angles.forearmDeg}° · wrist {angles.wristDeg}° · {hasVideoSupport()?'Hands ready':'нужен Hands'}</div>
            </>
          )}
        </div>
      </AdSec>
      <AdSec title="🎯 12 мёртвых точек (1–3)" hint={`Группы Кисть/Ротация/Давление · техника ${state.technique} · до 3`} status={state.weakPoints.length ? 'ok' : undefined}>
        <div className="ad-row" data-arm="wp-groups">
          {WEAK_GROUPS.map(g=> (
            <div key={g.title}>
              <div className="ad-muted">{g.title} {g.title==='Кисть'?'🤚' : g.title==='Ротация'?'🔄':'💥'}</div>
                    <div className="ad-chips">
                      {g.points.map(wp=>{
                  const sel = state.weakPoints.includes(wp);
                  const bio = ARM_BIOMECH[wp];
                  const isForTech = bio.technique.includes(state.technique) || bio.technique.includes('all') || state.technique==='balanced';
                  return (
                    <AdChip key={wp} active={sel} dim={!isForTech} onClick={()=>toggleWeakPoint(wp)} title={`${bio.label} ${bio.angleRangeDeg[0]}-${bio.angleRangeDeg[1]}° ${bio.keyJoint} → ${bio.corrections[0]}`}>
                      {WP_LABEL_SHORT[wp]} {isForTech? '●':''}
                    </AdChip>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="ad-row">
          <span className="ad-muted">Выбрано: {state.weakPoints.length? state.weakPoints.join(', ') : '—'} {state.weakPoints.length>=3? '(макс 3)' : ''}</span>
          {state.weakPoints.length>0 && <AdChip active={false} onClick={clearWeakPoints}>✕ Сбросить</AdChip>}
          <span className="ad-muted">Фильтр ● = для техники {state.technique}</span>
        </div>
        {state.weakPoints.length>0 && (
          <div className="ad-list">
            {(diag as any).biomechCards?.map((c:any)=> {
              const aj = angleJointForWeakPoint(c.weakPoint as ArmWeakPoint);
              const curDeg = aj==='wrist' ? (parseFloat(state.wristDeg)||10) : aj==='elbow' ? (parseFloat(state.elbowDeg)||110) : (parseFloat(state.forearmDeg)||90);
              const valid = aj==='none' ? null : isValidAngleForArmWeakPoint(c.weakPoint as ArmWeakPoint, curDeg);
              const corr = ARM_CORRECTIONS[c.weakPoint as ArmWeakPoint];
              return (
                <div key={c.weakPoint} className="ad-sec ad-bio" data-valid={valid===null?'na':valid?'ok':'bad'}>
                  <div className="ad-row">
                    <span><b>{c.label}</b></span>
                    <span className="ad-tag ad-angle">{c.angleRangeDeg[0]}-{c.angleRangeDeg[1]}° {c.keyJoint} {valid===null?'• угол н/п — контроль по технике':valid?'✅':'⚠ вне'}</span>
                    <span className="ad-muted">{c.technique.join('/')} · {c.weakMuscles.join('/')}</span>
                  </div>
                  <div className="ad-muted">{c.reason}</div>
                  <div className="ad-tip"><b>Коррекции:</b> {c.corrections.join(' · ')} @ {Math.round(c.intensityPct*100)}% · <i>{c.loadCues}</i> · VBT {vbtThresholdForWeakPoint(c.weakPoint).warnPct}/{vbtThresholdForWeakPoint(c.weakPoint).stopPct}%</div>
                  {corr && <div className="ad-muted">Сеты {corr.sets}×{corr.repsRange[0]}-{corr.repsRange[1]} RIR{corr.rir}{corr.holdSeconds?` hold ${corr.holdSeconds}с`:''} → день {corr.dayTags[0]} · группа {corr.substitutionGroup}</div>}
                </div>
              );
            })}
          </div>
        )}
      </AdSec>
      <div className="ad-chips">
        <span className="ad-muted">Legacy провалы (совместимость):</span>
        {[
          ['cup','Кисть открывается (cup)'],
          ['rising','Пальцы уходят (rising)'],
          ['pron','Топролл не держит (pron)'],
          ['sup','Хук проваливается (sup)'],
        ].map(([k,label]) => (
          <AdChip key={k} active={!!(state as any)[k]} onClick={()=>toggleLegacy(k as any)}>{label}</AdChip>
        ))}
      </div>
    </div>
  );
}
