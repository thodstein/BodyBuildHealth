/**
 * arm-hub-tabs2.tsx — табы хаба «Давление», «Сила», «Сухожилие/Восстановление».
 * Чистая презентация (props H: any), логика живёт в ArmDiagnosticsHub.
 * Строки, плейсхолдеры, inputMode и aria 1-в-1.
 */
import React from 'react';
import { profileOpponent } from '../../../engines/arm/arm-matchup.engine';
import { analyzeTableIq, tableIqTrend } from '../../../engines/arm/arm-table-iq.engine';
import { hasVideoSupport } from '../../../engines/arm/arm-motion-capture.engine';
import { ARM_BIOMECH } from '../../../engines/arm/arm-biomechanics.engine';
import { AdSec, AdGrid, AdField, AdChip, AdSwitch, AdSheetSelect, AdBtn, AdBanner } from './arm-design-system';
import { WP_LABEL_SHORT } from './arm-hub-shared';

export function HubPressureTab({ H }: { H: any }) {
  const { state, setState, toggleWeakPoint, toggleLegacy, mockGuard, bwNum, weightClassAuto, tablePreview, muState, setMuState, saveMu, tiq, tiqFouls, setTiqFouls, tiqWin, setTiqWin, tiqSlip, setTiqSlip, tiqStrap, setTiqStrap, tiqCenter, setTiqCenter, tiqFinish, setTiqFinish, addTiqBout, undoTiqBout, clearTiqBouts } = H;
  return (
    <div>
      <AdGrid cols="2">
        <AdField label="Side кг (блок)">
          <input value={state.sideKg} onChange={e=>setState((s: any)=>({...s, sideKg:e.target.value}))} placeholder="30" inputMode="decimal" />
        </AdField>
        <AdField label="Back кг (тяга)">
          <input value={state.backKg} onChange={e=>setState((s: any)=>({...s, backKg:e.target.value}))} placeholder="50" inputMode="decimal" />
        </AdField>
      </AdGrid>
      <div className="ad-row">
        {[
          ['side','Не дожимает боком (side)'],
          ['back','Тяга слабая (back)'],
        ].map(([k,label]) => (
          <AdChip key={k} active={!!(state as any)[k]} tone="red" onClick={()=>toggleLegacy(k as any)}>{label}</AdChip>
        ))}
      </div>
      <AdSec title="Мёртвые точки давления (быстрый выбор)" hint="side/back — humerus guard">
        <div className="ad-chips">
          {(['side_mid','side_pin','back_start','back_drag'] as string[]).map(wp=>{
            const sel = state.weakPoints.includes(wp);
            const bio = ARM_BIOMECH[wp as keyof typeof ARM_BIOMECH];
            return (
              <AdChip key={wp} active={sel} tone="red" onClick={()=>toggleWeakPoint(wp)} title={`${bio.label} ${bio.angleRangeDeg[0]}-${bio.angleRangeDeg[1]}° → ${bio.corrections[0]}`}>
                {WP_LABEL_SHORT[wp as keyof typeof WP_LABEL_SHORT]} {bio.intensityPct*100===60?'60%':'70%'}
              </AdChip>
            );
          })}
        </div>
        {state.weakPoints.filter((wp: string)=>['side_mid','side_pin','back_start','back_drag'].includes(wp)).length>0 && (
          <div className="ad-muted">
            Выбрано давления: {state.weakPoints.filter((wp: string)=>['side_mid','side_pin','back_start','back_drag'].includes(wp)).join(', ')}
            <span> ⚠ Side — прогрессия ≤10%/нед, RIR≥2, ≤3 сета первые 4н</span>
            {state.weakPoints.filter((wp: string)=>['side_mid','side_pin','back_start','back_drag'].includes(wp)).map((wp: string)=>{
              const bio = ARM_BIOMECH[wp as keyof typeof ARM_BIOMECH];
              return <div key={wp}>{bio.label}: {bio.angleRangeDeg[0]}-{bio.angleRangeDeg[1]}° {bio.keyJoint} · угол н/п — контроль по технике</div>;
            })}
          </div>
        )}
      </AdSec>
      <AdGrid cols="2">
        <AdSec title="Humerus (side)">
          <div className="ad-muted">{mockGuard.humerus.length? mockGuard.humerus.join(' · ') : '✓ Нет риска: side ≤3, RIR≥2, прогрессия ≤10%/нед'}</div>
        </AdSec>
        <AdSec title="Side/Back vs норма WAF">
          <div className="ad-muted">Side ref {Math.round(bwNum*0.6)}кг · Back ref {Math.round(bwNum*0.8)}кг · WAF {weightClassAuto} (вектор и асимметрия — во вкладке «✊ Хват»)</div>
        </AdSec>
      </AdGrid>
      <AdSec title="🗓 Стол — периодизация 3/2/1 (Кузнецов VIII) — ≥50% стол">
        <div className="ad-strip" data-arm="hub-strip">
          {tablePreview.map(({ wk, kind }: any) => {
            const col = kind==='moderate'? '#22c55e' : kind==='heavy'? '#f59e0b' : '#ef4444';
            return <div key={wk} className="ad-stat" style={{ borderTopColor: col }}><div className="ad-stat-v">{wk}</div><div className="ad-stat-l">{kind}</div></div>;
          })}
        </div>
      </AdSec>
      <AdSec title="🥇 TOP: матчап + Table-IQ журнал" collapsible defaultOpen={false} summary={`Схваток: ${tiq.length}`}>
        <AdGrid cols="3">
          <AdSheetSelect label="Оппонент" value={muState.opp} onChange={(v)=>{ const nv={...muState, opp:v}; setMuState(nv); saveMu(nv); }} options={[
            { id:'unknown', label:'Неизвестен' },
            { id:'hook', label:'Хук', desc:'давление через кулак' },
            { id:'toproll', label:'Топролл', desc:'раскрытие кисти' },
            { id:'press', label:'Пресс', desc:'жим плечом' },
            { id:'balanced', label:'Универсал' },
          ]} />
          <AdSheetSelect label="Рука" value={muState.hand} onChange={(v)=>{ const nv={...muState, hand:v}; setMuState(nv); saveMu(nv); }} options={[
            { id:'unknown', label:'—' },
            { id:'high', label:'Верхний', desc:'high-hand' },
            { id:'low', label:'Нижний', desc:'low-hand' },
            { id:'neutral', label:'Нейтраль' },
          ]} />
          <AdField label="Δ веса, кг">
            <input inputMode="decimal" value={muState.wd} onChange={e=>{ const v={...muState, wd:e.target.value}; setMuState(v); saveMu(v); }} placeholder="0" />
          </AdField>
        </AdGrid>
        {(()=>{ try {
          if (muState.opp==='unknown' && !muState.wd) return null;
          const mp = profileOpponent({ myTechnique: state.technique, oppStyle: muState.opp, oppHand: muState.hand, weightDeltaKg: parseFloat(muState.wd) || 0 });
          return <div className="ad-muted">Матчап: {mp.note} Приоритет: {mp.priorityMuscles.slice(0,3).join(', ')}. {mp.gameplan[0]}</div>;
        } catch { return null; } })()}
        {(()=>{ try {
          const pts: string[] = state.weakPoints || [];
          if (!pts.length) return null;
          if (muState.opp === 'unknown' && !muState.wd) return <div className="ad-muted">Связка: точки {pts.join(', ')} — выбери оппонента выше, и стол скажет, куда бить.</div>;
          const mp = profileOpponent({ myTechnique: state.technique, oppStyle: muState.opp, oppHand: muState.hand, weightDeltaKg: parseFloat(muState.wd) || 0 });
          const mus = Array.from(new Set(pts.flatMap((wp: string) => ((ARM_BIOMECH as any)[wp]?.weakMuscles || []))));
          const hit = mp.priorityMuscles.filter((m: string) => mus.includes(m));
          return <div className="ad-tip">Связка: точки {pts.join(', ')} ({mus.slice(0, 4).join('/')}) × соперник {muState.opp} → {hit.length ? `бей в ${hit.join(', ')}` : 'прямых пересечений нет — качай приоритет соперника'} · {mp.gameplan[0]}</div>;
        } catch { return null; } })()}
        <div className="ad-sec-t">Table-IQ: схватки ({tiq.length})</div>
        <AdGrid cols="auto-sm">
          <AdField label="Фолы">
            <input inputMode="numeric" aria-label="Фолы за схватку" value={tiqFouls} onChange={e=>setTiqFouls(e.target.value)} placeholder="0" />
          </AdField>
          <AdField label="Центр, с">
            <input inputMode="decimal" value={tiqCenter} onChange={e=>setTiqCenter(e.target.value)} placeholder="—" />
          </AdField>
          <AdField label="Финиш, с">
            <input inputMode="decimal" value={tiqFinish} onChange={e=>setTiqFinish(e.target.value)} placeholder="—" />
          </AdField>
        </AdGrid>
        <div className="ad-row">
          <AdSwitch checked={tiqWin} onChange={setTiqWin} label="Победа" />
          <AdSwitch checked={tiqSlip} onChange={setTiqSlip} label="Срыв" />
          <AdSwitch checked={tiqStrap} onChange={setTiqStrap} label="Ремень" />
          <AdBtn variant="dark" onClick={addTiqBout}>＋ Схватка</AdBtn>
          {tiq.length>0 && <AdBtn variant="dark" onClick={undoTiqBout}>↩ Отменить</AdBtn>}
          {tiq.length>0 && <AdBtn variant="dark" onClick={clearTiqBouts}>🗑 Очистить</AdBtn>}
        </div>
        {(()=>{ try {
          if (!tiq.length) return <div className="ad-muted">Веди журнал схваток: фолы/срывы/ремень/центр/финиш — стол скажет, что чинить.</div>;
          const iq = analyzeTableIq({ bouts: tiq });
          const trend = tableIqTrend(tiq);
          return <div className="ad-sec ad-bio" data-valid="na" data-arm="tiq-out"><div>{iq.note}</div>{iq.levers.map((l: string,i: number)=><div key={i} className="ad-finding" data-level="warn">• {l}</div>)}<div className="ad-muted">{trend.note}</div></div>;
        } catch { return null; } })()}
      </AdSec>
      <AdSec title="📖 Фолы WAF → что чинить" collapsible defaultOpen={false} summary="5 фолов">
        <div className="ad-kv"><span>Отрыв локтя</span><span>пад + back_drag · posting-стойка</span></div>
        <div className="ad-kv"><span>Сгиб кисти (cup открылась)</span><span>cup_start/cup_hold · contain_fingers</span></div>
        <div className="ad-kv"><span>Касание плечом / ранний дожимать</span><span>side_mid · не форсируй, RIR≥2</span></div>
        <div className="ad-kv"><span>Фальстарт</span><span>старт по команде · reaction_go дриллы</span></div>
        <div className="ad-kv"><span>Срыв в ремень</span><span>журнал Table-IQ выше · strap_start</span></div>
      </AdSec>
    </div>
  );
}

export function HubStrengthTab({ H }: { H: any }) {
  const { state, setState, dynamicReport, forceVecPro, bilatP0, bilatTrendP0, bilatHistP0, onSaveBilat, benchRes, handleAddTrialsToHistory, onResetDynamic, forceHistory, toggleWeakPoint } = H;
  return (
    <div>
      <AdBanner tone="warn">
        <b>4 теста Bezkorovainyi — ARM1 Device FB5k (патент #43082)</b>
        <div>finger_flex (сгибание пальцев) · hammer (разгиб. молот) · hook (крюк) · cup (сгибание кисти). Введи силу кг + время достижения макс мс → получи F/t, F100, F500, градиент, F/m.</div>
      </AdBanner>
      <AdGrid cols="auto" >
        {[
          ['fingerKg','fingerMs','Finger flex кг/мс'],
          ['hammerKg','hammerMs','Hammer кг/мс'],
          ['hookKg','hookMs','Hook кг/мс'],
          ['cupKg','cupMs','Cup кг/мс'],
        ].map(([kKg,kMs,label])=> (
          <AdSec key={kKg} title={label} hook="ftest">
            <AdField label="Сила, кг">
              <input inputMode="decimal" value={(state as any)[kKg]} onChange={e=>setState((s: any)=>({...s, [kKg]:e.target.value}))} placeholder="кг" />
            </AdField>
            <AdField label="Время, мс">
              <input inputMode="numeric" value={(state as any)[kMs]} onChange={e=>setState((s: any)=>({...s, [kMs]:e.target.value}))} placeholder="мс" />
            </AdField>
          </AdSec>
        ))}
      </AdGrid>
      <AdGrid cols="2">
        <AdSec title="Динамика — F/t градиент" hook="dyn">
          <div className="ad-muted">
            {(dynamicReport as any)?.avgFt ? `Avg F/t ${(dynamicReport as any).avgFt} кг/с · Total ${(dynamicReport as any).totalF}кг · Avg ${(dynamicReport as any).avgF}кг` : 'Введи 4 теста → F/t'}
            {(dynamicReport as any)?.tactic ? <div><b>Тактика:</b> {(dynamicReport as any).tactic}</div> : null}
          </div>
          {dynamicReport && (dynamicReport as any).metrics && (
            <div className="ad-muted">
              {Object.entries((dynamicReport as any).metrics).map(([k,v]: any)=> v ? <div key={k}>{k}: F{v.fMax} F/t{v.ftIndex} {v.ftIndex < 30 ? '⚠ низкая — чинить' : '✓ в допуске'} · F100{v.f100}({v.explosivePct}%) F500{v.f500}({v.fastPct}%) t0.5F{v.t05F}мс</div> : null)}
            </div>
          )}
        </AdSec>
        <AdSec title="Асимметрия L/R — единый вердикт">
          {(()=>{
            const ds = (dynamicReport as any)?.asymmetry?.asymmetryPct ?? null;
            const gs = forceVecPro.asymmetryPct ?? null;
            const bs = bilatP0?.asymmetryPct ?? null;
            const vals = [ds, gs, bs].filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
            if (!vals.length) return <div className="ad-muted">Введи left/right хват или finger/hook обе руки — вердикта пока нет</div>;
            const mx = Math.max(...vals);
            const dyn = (dynamicReport as any)?.asymmetry;
            const weak = bilatP0?.weakArm || (dyn ? (dyn.leftMax < dyn.rightMax ? 'left' : 'right') : null);
            const verdict = mx >= 12 ? '🔴 своди: слабой +объём, сильной maintenance' : mx >= 7 ? '🟠 своди: слабой +15%' : '🟢 в допуске';
            return (
              <div data-arm="asym-verdict">
                <div className="ad-muted">Источники: {[
                  ds != null ? `динамика ${ds}%` : null,
                  gs != null ? `хват ${gs}%` : null,
                  bs != null ? `bilateral ${bs}%` : null,
                ].filter(Boolean).join(' · ')}</div>
                <div><b>Вердикт: max {mx}%{weak ? ` · слабая ${weak === 'left' ? 'левая' : 'правая'}` : ''} — {verdict}</b></div>
              </div>
            );
          })()}
          <div className="ad-muted">{(dynamicReport as any)?.asymmetry ? `${(dynamicReport as any).asymmetry.leftMax} / ${(dynamicReport as any).asymmetry.rightMax} кг → ${(dynamicReport as any).asymmetry.asymmetryPct}% — ${(dynamicReport as any).asymmetry.advice}` : (forceVecPro.asymmetryPct!=null ? `По хвату ${forceVecPro.asymmetryPct}% ${forceVecPro.asymmetryPct>=12?'🔴':forceVecPro.asymmetryPct>=7?'🟠':'🟢'}` : 'Введи left/right хват или finger/hook обе руки')}</div>
          {bilatP0 && (
            <div className="ad-muted">
              <b>Bilateral:</b> {bilatP0.note} · слабая {bilatP0.weakArm || '—'} {bilatP0.weakSets} / сильная {bilatP0.strongArm || '—'} {bilatP0.strongSets} {bilatP0.withinMrv ? '· в MRV ✓' : '· вне MRV ⚠'}
              {bilatTrendP0 && <div>{bilatTrendP0.text}</div>}
              {bilatHistP0.length > 0 && <div>История: {bilatHistP0.slice(-6).map((h: any) => `${h.asymmetryPct}%`).join(' → ')}</div>}
              <AdBtn variant="dark" onClick={onSaveBilat}>💾 Сохранить L/R замер</AdBtn>
            </div>
          )}
        </AdSec>
      </AdGrid>
      <AdGrid cols="auto">
        <AdField label="Сгибание кисти, фунт">
          <input inputMode="decimal" value={state.wristCurlLb} onChange={e=>setState((s: any)=>({...s, wristCurlLb:e.target.value}))} placeholder="30" />
        </AdField>
        <AdField label="Пронация, с">
          <input inputMode="numeric" value={state.pronHoldSec} onChange={e=>setState((s: any)=>({...s, pronHoldSec:e.target.value}))} placeholder="20" />
        </AdField>
        <AdField label="Чаша, с">
          <input inputMode="numeric" value={state.cupHoldSec} onChange={e=>setState((s: any)=>({...s, cupHoldSec:e.target.value}))} placeholder="25" />
        </AdField>
        <AdField label="CoC, ур.">
          <input inputMode="decimal" value={state.cocLevel} onChange={e=>setState((s: any)=>({...s, cocLevel:e.target.value}))} placeholder="1" />
        </AdField>
      </AdGrid>
      <AdSec title={`Авто-уровень: ${benchRes.level} · score ${benchRes.avgScore}`}>
        <div className="ad-muted">{benchRes.details.map((d: any)=>`${d.id}:${d.value}→${d.level}`).join(' · ') || '—'}</div>
        <div className="ad-muted">Пороги: wrist curl 0/25/45/70/95 lb · pron 0/10/25/45/65с · cup 0/15/30/50/70с · CoC 0/1/1.5/2/2.5 · RT 0/45/75/100/120кг</div>
      </AdSec>
      <div className="ad-row">
        <AdBtn variant="primary" onClick={handleAddTrialsToHistory}>💾 Сохранить 4 теста в историю (12-нед avg/max/min)</AdBtn>
        <AdBtn variant="dark" onClick={onResetDynamic}>🗑 Сброс динамик</AdBtn>
      </div>
      {dynamicReport && (dynamicReport as any).metrics && (
        <AdSec title="F/t → мёртвые точки (авто-подсказка)" collapsible defaultOpen={false} summary="Кандидаты">
          <div className="ad-muted">
            {(dynamicReport as any).metrics.finger_flex && (dynamicReport as any).metrics.finger_flex.ftIndex < 30 ? 'finger_flex низкая → contain_fingers (pinch) · ' : ''}
            {(dynamicReport as any).metrics.hammer && (dynamicReport as any).metrics.hammer.ftIndex < 30 ? 'hammer низкая → sup_drag/back_drag · ' : ''}
            {(dynamicReport as any).metrics.hook && (dynamicReport as any).metrics.hook.fMax < 30 ? 'hook низкая → sup_cup/sup_drag · ' : ''}
            {(dynamicReport as any).metrics.cup && (dynamicReport as any).metrics.cup.f500 < 25 ? 'cup низкая → cup_start/hold · ' : ''}
            {!((dynamicReport as any).metrics.finger_flex?.ftIndex<30 || (dynamicReport as any).metrics.hammer?.ftIndex<30 || (dynamicReport as any).metrics.hook?.fMax<30 || (dynamicReport as any).metrics.cup?.f500<25) ? 'Все F/t в допуске — баланс' : ''}
          </div>
          <div className="ad-chips">
            {[
              { id:'contain_fingers', need: (dynamicReport as any).metrics.finger_flex?.ftIndex<30 },
              { id:'sup_drag', need: (dynamicReport as any).metrics.hammer?.ftIndex<30 },
              { id:'sup_cup', need: (dynamicReport as any).metrics.hook?.fMax<30 },
              { id:'cup_start', need: (dynamicReport as any).metrics.cup?.f500<25 },
            ].filter(x=>x.need).map(x=> (
              <AdChip key={x.id} active={state.weakPoints.includes(x.id)} onClick={()=>toggleWeakPoint(x.id)}>{x.id} {state.weakPoints.includes(x.id)?'✓':'+'}</AdChip>
            ))}
          </div>
        </AdSec>
      )}
      {forceHistory.stats.length>0 && (
        <AdSec title="История 12 нед — avg/max/min + fatigue" collapsible defaultOpen={false} summary="Графики и усталость">
          <div className="ad-row" data-arm="hist-strip">
            {forceHistory.stats.map((w:any)=> (
              <div key={w.week} className="ad-stat">
                <div className="ad-stat-v">{w.avg}</div>
                <div className="ad-stat-l">W{w.week} · {w.fatiguePct}%</div>
                <div className="ad-stat-s">max {w.max} · min {w.min}</div>
              </div>
            ))}
          </div>
          {forceHistory.fatigue && <div className="ad-muted">{forceHistory.fatigue.text}</div>}
          {forceHistory.trend && <div className="ad-muted">{forceHistory.trend.text}</div>}
        </AdSec>
      )}
    </div>
  );
}

export function HubRecoveryTab({ H }: { H: any }) {
  const { acwr, tendonAcwr, state, report, tendonWeeklyLimit, angles, anglesVerified, perMuscleAcwrSumP0, armMobility, mob, setMob, mobRetest, setMobRetest, onMobToProfile, mobMsg, autoregP0, cnsHeavyP0, guardsP0, armPlan, rh, setRh, buildRehabPlanFn, forceHistory } = H;
  return (
    <div>
      <AdSec title="📊 Нагрузка — ACWR и тендоны" collapsible defaultOpen={true} summary={acwr ? `ACWR ${acwr.ratio}` : 'нужен дневник'}>
      <AdGrid cols="2">
        <AdSec title={`ACWR ${acwr? acwr.ratio.toFixed(2) : '—'}`} hook="acwr">
          <div className="ad-muted">{acwr? `Острая/хроническая — факт` : 'нет данных (нужен дневник sRPE)'}</div>
        </AdSec>
        <AdSec title={`Tendon ACWR ${tendonAcwr? tendonAcwr.ratio.toFixed(2) : '—'}`}>
          <div className="ad-muted">{tendonAcwr? `Tendon — факт` : 'нет tendon-данных'}</div>
        </AdSec>
        <AdSec title={`Tendon Load · лимит ${tendonWeeklyLimit(state.level)}`}>
          <div className="ad-muted">{report.tendonLoad} сетов/нед · Side MRV {H.landmarks.side.mrv} · TendonCap 1.2× vs Muscle 1.7×</div>
          <div className="ad-muted">Beginner 12 / Inter 16 / Adv 18 / Enh 22 — GripStrength F1 3с эксцентрик</div>
        </AdSec>
        <AdSec title="Дополнительно">
          <div className="ad-muted">Техника: {state.technique} · Уровень: {state.level} · Направление: {state.direction} · Углы: {angles.elbowDeg}°/{angles.forearmDeg}°/{angles.wristDeg}°</div>
          <div className="ad-muted">Видео: {hasVideoSupport()?'поддерживается':'—'} · Ввод: {anglesVerified?'углы в допуске':'ручной'}</div>
        </AdSec>
      </AdGrid>
      <AdBanner tone="info">
        <b>ACWR — факт:</b> ACWR {acwr ? acwr.ratio : '—'} — факт {acwr ? '' : '(нужен дневник sRPE ≥2 сесс.)'} {tendonAcwr ? `· Tendon ACWR ${tendonAcwr.ratio} — факт` : ''}
        {(perMuscleAcwrSumP0.danger.length > 0 || perMuscleAcwrSumP0.caution.length > 0) && (
          <span> · Per-muscle: {perMuscleAcwrSumP0.danger.length > 0 && <b>🔴 {perMuscleAcwrSumP0.danger.join(', ')}</b>} {perMuscleAcwrSumP0.caution.length > 0 && <span>🟠 {perMuscleAcwrSumP0.caution.join(', ')}</span>}</span>
        )}
      </AdBanner>
      </AdSec>
      <AdSec title="🦿 Тело — мобильность, авторег, возврат" collapsible defaultOpen={true} summary="3 блока">
      <AdSec title={`🦿 Мобильность · score ${armMobility.score} ${armMobility.failedCount ? `· провалы: ${armMobility.fails.join(', ')}` : '· ✓ норма'}`} collapsible hook="mob">
        <div className="ad-muted">Нормы ROM: сгиб кисти ≥80° · разгиб ≥70° · пронация/супинация ≥80° · локоть полный</div>
        <div className="ad-chips" data-arm="mob-chips">
          {[
            ['mobWristFlex', 'Сгиб кисти ≥80°'],
            ['mobWristExt', 'Разгиб ≥70°'],
            ['mobPron', 'Пронация ≥80°'],
            ['mobSup', 'Супинация ≥80°'],
            ['mobElbow', 'Локоть полный'],
          ].map(([key, label]: any) => (
            <AdChip key={key} active={!!mob[key]} tone={mob[key] ? 'green' : 'red'} onClick={() => setMob(key, !mob[key])}>{label}</AdChip>
          ))}
        </div>
        <div className="ad-row">
        <div>
          <div className="ad-fl">Reverse-retest</div>
          <div className="ad-chips">
            {[{id:'',label:'—'},{id:'better',label:'Лучше'},{id:'same',label:'Так же'}].map(o=> <AdChip key={o.id || 'none'} active={mobRetest===o.id} onClick={()=>setMobRetest(o.id)}>{o.label}</AdChip>)}
          </div>
        </div>
          <AdBtn variant="dark" onClick={onMobToProfile}>→ В профиль</AdBtn>
          {armMobility.retestHint && <span className="ad-muted">{armMobility.retestHint}</span>}
          {mobMsg && <span className="ad-tip">{mobMsg}</span>}
        </div>
      </AdSec>
      <AdSec title="🔄 Авторегуляция (sRPE 7д + VBT + боли)" collapsible>
        <div className="ad-row">
          <AdField label="Локоть 0-10">
            <input aria-label="Боль локоть 0-10" inputMode="decimal" value={H.painElbow} onChange={(e) => H.setPainElbow(e.target.value)} placeholder="0" />
          </AdField>
          <AdField label="Запястье 0-10">
            <input aria-label="Боль запястье 0-10" inputMode="decimal" value={H.painWrist} onChange={(e) => H.setPainWrist(e.target.value)} placeholder="0" />
          </AdField>
          <AdField label="Сон, ч">
            <input aria-label="Сон часов" inputMode="decimal" value={H.sleepHours} onChange={(e) => H.setSleepHours(e.target.value)} placeholder="8" />
          </AdField>
        </div>
        <div className="ad-muted">{autoregP0 ? `${autoregP0.note} · объём ×${autoregP0.volumeMult} · RIR+${autoregP0.rirShift}${autoregP0.extraRestDays ? ` · +${autoregP0.extraRestDays} дн отдыха` : ''}` : 'Нет sRPE за 7д — план без изменений'}</div>
        {cnsHeavyP0 && (
          <div className="ad-muted">
            CNS: {cnsHeavyP0.heavy} тяжёлых (RPE≥8) из {cnsHeavyP0.total} за 7д{cnsHeavyP0.heavy >= 2 ? ' — план облегчается ×0.8' : ' — допуск'}
          </div>
        )}
        <div className="ad-muted"><b>Гварды плана:</b> {guardsP0.ucl.length + guardsP0.shoulder.length + guardsP0.tendon.length + guardsP0.humerus.length === 0 ? (armPlan ? '✓ UCL/плечо/tendon/humerus чисто' : 'нет плана — нечего проверять') : [...guardsP0.ucl, ...guardsP0.shoulder, ...guardsP0.tendon, ...guardsP0.humerus].slice(0, 5).join(' · ')}</div>
      </AdSec>
      <AdSec title="🩹 Return-to-pull (после травмы)" collapsible defaultOpen={false} summary={rh.injury==='none' ? 'Скрининг' : rh.injury}>
        <div className="ad-row">
          <AdSheetSelect label="Травма для return-to-pull" value={rh.injury} onChange={(v) => setRh({ ...rh, injury: v })} options={[
            { id:'none', label:'—', desc:'скрининг' },
            { id:'humerus', label:'Перелом плеча' },
            { id:'ucl', label:'UCL/связка локтя' },
            { id:'biceps', label:'Бицепс' },
            { id:'elbow_tendon', label:'Тендинопатия локтя' },
            { id:'wrist', label:'Кисть/запястье' },
          ]} />
          <AdField label="Недель с травмы">
            <input aria-label="Недель с травмы" inputMode="numeric" value={rh.weeks} onChange={(e) => setRh({ ...rh, weeks: e.target.value })} placeholder="0" />
          </AdField>
          <AdField label="Боль 0-10">
            <input aria-label="Боль при травме 0-10" inputMode="decimal" value={rh.pain} onChange={(e) => setRh({ ...rh, pain: e.target.value })} placeholder="0" />
          </AdField>
          <AdSwitch checked={rh.surg} onChange={(v) => setRh({ ...rh, surg: v })} label="Операция была" />
        </div>
        {(()=>{ try {
          if (rh.injury==='none') return <div className="ad-muted">Скрининг, не диагноз: выбери травму — покажем фазу, допуски и критерии перехода.</div>;
          const rhm = buildRehabPlanFn({ injury: rh.injury, weeksSince: parseFloat(rh.weeks) || 0, pain: parseFloat(rh.pain) || 0, surgery: rh.surg });
          return <div className="ad-sec ad-bio" data-valid="na" data-arm="rehab-out">
            <div><b>Фаза {rhm.phase}: {rhm.current.title}</b> ({rhm.current.weeks})</div>
            <div className="ad-muted">✅ {rhm.current.allowed.slice(0,3).join(' · ')}</div>
            <div>⛔ {rhm.current.forbidden.slice(0,3).join(' · ')}</div>
            <div className="ad-muted">Дальше: {rhm.current.criteriaToNext}</div>
            <div className="ad-tip">{rhm.redFlags[0]}</div>
          </div>;
        } catch { return null; } })()}
      </AdSec>
      </AdSec>
      {forceHistory.stats.length>0 && (
      <AdSec title="📈 Итог — усталость" collapsible defaultOpen={false} summary="fatigue 12 нед">
        <AdSec title="Fatigue 12-нед (патент WO2026106582A1)">
          <div className="ad-muted">Avg {forceHistory.stats[0]?.avg}→{forceHistory.stats[forceHistory.stats.length-1]?.avg} · Max {forceHistory.stats[0]?.max}→{forceHistory.stats[forceHistory.stats.length-1]?.max} · Fatigue {forceHistory.fatigue?.first}%→{forceHistory.fatigue?.last}% ({forceHistory.fatigue?.improving? '↓ адаптация':'↑ усталость'})</div>
        </AdSec>
      </AdSec>
      )}
    </div>
  );
}
