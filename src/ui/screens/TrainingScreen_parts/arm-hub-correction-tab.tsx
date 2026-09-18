/**
 * arm-hub-correction-tab.tsx — P1: отдельный таб «Коррекция» (сквозной экран).
 * Точка → угол → причина → топ-3 с дозами (§3.1 плана) → Δ → вставить/откат.
 * Чистая презентация (props H: any), логика живёт в ArmDiagnosticsHub/движках.
 * Данные 1-в-1 из ARM_CORRECTIONS / armCausesP0 / armTop3P0 (без новой математики).
 */
import React from 'react';
import { ARM_BIOMECH, type ArmWeakPoint } from '../../../engines/arm/arm-biomechanics.engine';
import { ARM_CORRECTIONS, correctionForWeakPoint } from '../../../engines/arm/arm-weakpoint-corrections';
import { doseForCause, doseLabel } from '../../../engines/arm/arm-correction-dose.engine';
import { roleLabel, preventiveFor, drillsForPhase, correctiveWaveForWeek } from '../../../engines/arm/arm-correction-pro2.engine';
import { simulateArmInjection } from '../../../engines/arm/arm-simulator.engine';
import { suggestWeakPointsForTrack } from '../../../engines/arm/arm-video-analysis.engine';
import { AdSec, AdBtn, AdBanner } from './arm-design-system';
import { WP_LABEL_SHORT } from './arm-hub-shared';

const FAILURE_POINTS = [
  { id: '', label: '— без фазы' },
  { id: 'setup', label: 'Setup' },
  { id: 'start', label: 'Старт' },
  { id: 'mid', label: 'Середина' },
  { id: 'pin', label: 'Дожитие' },
];

function baseDoseLabel(wp: ArmWeakPoint): string {
  const c = correctionForWeakPoint(wp);
  if (!c) return '';
  const parts: string[] = [`${c.sets}×${c.repsRange[0]}–${c.repsRange[1]} @${Math.round(c.intensityPct * 100)}%`, `RIR ${c.rir}`];
  if (c.holdSeconds) parts.push(`холд ${c.holdSeconds}с`);
  if (c.tempo) parts.push(c.tempo);
  return parts.join(' · ');
}

export function HubCorrectionTab({ H }: { H: any }) {
  const {
    state, setState, report, diag, armCausesP0, armTop3P0, armSpecP0,
    handleInjectP0, hasInjectPrev, handleRollbackP0, injectMsg,
    toggleWeakPoint, trackType, autoPoint, mvPhase,
  } = H;
  const weakPoints: ArmWeakPoint[] = Array.isArray(state?.weakPoints) && state.weakPoints.length
    ? state.weakPoints
    : (Array.isArray((report as any)?.weakPoints) ? (report as any).weakPoints : []);
  const videoSugs = (() => {
    try { return suggestWeakPointsForTrack(trackType ?? null).filter((s) => !weakPoints.includes(s.point as ArmWeakPoint)); }
    catch { return []; }
  })();
  const videoSuggest = videoSugs.length > 0 ? (
    <div className="ad-tip" data-arm="correction-video-suggest">
      📹 Видео подсказывает ({trackType}): {videoSugs.map((s) => (WP_LABEL_SHORT as any)[s.point] || s.point).join(' · ')}
      {videoSugs.slice(0, 3).map((s) => (
        <AdBtn key={s.point} variant="dark" onClick={() => toggleWeakPoint(s.point as ArmWeakPoint)}>+ {(WP_LABEL_SHORT as any)[s.point] || s.point}</AdBtn>
      ))}
    </div>
  ) : null;
  const phaseChips = (
    <div className="ad-row" data-arm="correction-phase">
      <span className="ad-muted">Где срыв:</span>
      {FAILURE_POINTS.map((f) => (
        <AdBtn
          key={f.id}
          variant={(state?.failurePoint || '') === f.id ? 'amber' : 'dark'}
          aria-pressed={(state?.failurePoint || '') === f.id}
          onClick={() => setState((s: any) => ({ ...s, failurePoint: f.id }))}
        >
          {f.label}
        </AdBtn>
      ))}
    </div>
  );
  const angleSuggest = autoPoint && !weakPoints.includes(autoPoint as ArmWeakPoint) ? (
    <div className="ad-tip" data-arm="correction-angle-suggest">
      📐 Углы подсказывают: {(WP_LABEL_SHORT as any)[autoPoint] || autoPoint}
      <AdBtn variant="dark" onClick={() => toggleWeakPoint(autoPoint as ArmWeakPoint)}>+ {(WP_LABEL_SHORT as any)[autoPoint] || autoPoint}</AdBtn>
    </div>
  ) : null;
  // D2: селект недели микро-волны (пусто = без волны, как инъекция без флага)
  const waveChips = (
    <div className="ad-row" data-arm="correction-wave-select">
      <span className="ad-muted">Волна:</span>
      {[
        { id: '', label: '— без волны' },
        { id: '1', label: 'Н1 база' },
        { id: '2', label: 'Н2 +1' },
        { id: '3', label: 'Н3 делод' },
      ].map((w) => (
        <AdBtn
          key={w.id}
          variant={String((state as any)?.corrWave || '') === w.id ? 'amber' : 'dark'}
          aria-pressed={String((state as any)?.corrWave || '') === w.id}
          onClick={() => setState((s: any) => ({ ...s, corrWave: w.id }))}
        >
          {w.label}
        </AdBtn>
      ))}
    </div>
  );
  if (!weakPoints.length) {
    return (
      <AdSec title="🛠 Коррекция движений" summary="выбери 1–3 мёртвые точки">
        <div className="ad-muted" data-arm="correction-empty">
          Нет выбранных точек. Отметь 1–3 мёртвые точки во вкладках «Кисть/Ротация» или «Давление» —
          здесь соберётся цепочка: угол → причина → топ-3 с дозами → Δ → вставка в план.
        </div>
        {phaseChips}
        {waveChips}
        {mvPhase ? <div className="ad-muted" data-arm="correction-matchphase">Фаза схватки: {mvPhase} — топ-3 получит +4 точкам фазы.</div> : null}
        {videoSuggest}
        {angleSuggest}
        <div className="ad-tip">Канон пулов: §3 `docs/ARM-MOVEMENT-CORRECTION-PLAN.md` (все ids — из каталога).</div>
      </AdSec>
    );
  }
  return (
    <AdSec title={`🛠 Коррекция движений (${weakPoints.length})`} summary="точка → причина → топ-3 → доза → вставка">
      {phaseChips}
      {waveChips}
      {mvPhase ? <div className="ad-muted" data-arm="correction-matchphase">Фаза схватки: {mvPhase} — топ-3 получил +4 точкам фазы (метка «точка слабой фазы» в причинах).</div> : null}
      {videoSuggest}
      {angleSuggest}
      <div className="ad-list" data-arm="correction-list">
        {weakPoints.map((wp) => {
          const bio = (ARM_BIOMECH as any)[wp];
          const corr = (ARM_CORRECTIONS as any)[wp];
          const cause = (armCausesP0 as any)?.[wp];
          const top = (armTop3P0 as any)?.[wp] || [];
          const sim = (() => {
            try {
              const causes: Record<string, any> = {};
              const c = (armCausesP0 as any)?.[wp]?.cause;
              if (typeof c === 'string' && c) causes[wp] = c;
              // D3: сим считает теми же флагами, что инъекция (паритет Δ = факт)
              const flags = (H as any).corrV2 || {};
              const simOpts: Record<string, any> = { level: (state as any)?.level };
              if (Object.keys(causes).length) simOpts.causes = causes;
              if (flags.tendonOverload) simOpts.tendonOverload = true;
              if (flags.waveWeek != null) simOpts.waveWeek = flags.waveWeek;
              return simulateArmInjection(H.armPlan as any, wp, null, simOpts);
            } catch { return null; }
          })();
          const label = (WP_LABEL_SHORT as any)[wp] || wp;
          return (
            <div key={wp} className="ad-sec ad-bio" data-arm="correction-card" data-valid={cause ? 'ok' : 'na'}>
              <div>
                <b>{label}</b>
                <span className="ad-muted"> · {bio?.angleRangeDeg ? `${bio.angleRangeDeg.join('–')}°` : 'без угла'} · {bio?.keyJoint || bio?.joint || ''}</span>
                {cause ? <span> · {cause.cause} ({Math.round(cause.confidence * 100)}%)</span> : null}
              </div>
              {bio?.biomechanicalReason && <div className="ad-muted">{bio.biomechanicalReason}</div>}
              {bio?.loadCues && <div className="ad-tip">🎯 {bio.loadCues}</div>}
              {cause && <div className="ad-muted">{cause.evidence?.join(' · ')} → <b>{cause.fix}</b></div>}
              <div className="ad-tip" data-arm="correction-dose">
                💊 Доза базы: {baseDoseLabel(wp)} · группа {corr?.substitutionGroup || '—'} → {corr?.dayTags?.[0] || '—'}
              </div>
              {(() => {
                const adj = cause ? doseForCause(wp, cause.cause) : null;
                return adj && adj.adjusted ? (
                  <div className="ad-tip" data-arm="correction-dose-cause">📐 Доза по причине ({cause.cause}): {doseLabel(adj)}</div>
                ) : null;
              })()}
              {top.length > 0 ? (
                <div className="ad-tip" data-arm="correction-top3">
                  Топ-3: {top.map((t: any) => `${t.id} (${roleLabel(t.id)} · ${t.score}${t.reason ? `, ${t.reason}` : ''})`).join(' · ')}
                  {sim ? ` · Δ ${sim.summary}` : ''}
                </div>
              ) : (
                <div className="ad-muted">Топ-3: {(corr?.exercises || []).slice(0, 3).join(' · ')}</div>
              )}
              {(() => {
                try {
                  const p = preventiveFor(wp);
                  return p ? <div className="ad-tip" data-arm="correction-prevent">🛡 {p.label} ({p.id})</div> : null;
                } catch { return null; }
              })()}
              {(() => {
                try {
                  const sel = parseInt(String((state as any)?.corrWave || ''), 10);
                  const w = correctiveWaveForWeek(Number.isFinite(sel) && sel >= 1 && sel <= 3 ? sel : 1);
                  return <div className="ad-muted" data-arm="correction-wave">🌊 Волна: {w.note} · Н2 объём +1 · Н3 делод −1</div>;
                } catch { return null; }
              })()}
              <div className="ad-row">
                <AdBtn variant="dark" onClick={() => toggleWeakPoint(wp)}>✕ Убрать {label}</AdBtn>
              </div>
            </div>
          );
        })}
      </div>
      {(() => {
        try {
          const ds = drillsForPhase((state as any)?.failurePoint || mvPhase);
          if (!ds.length) return null;
          return <div className="ad-tip" data-arm="correction-drills">🥋 Table-time: {ds.map((d) => `${d.label} — ${d.dose}`).join(' · ')}</div>;
        } catch { return null; }
      })()}
      {armSpecP0?.summary && <div className="ad-muted">📦 {armSpecP0.summary}</div>}
      <div className="ad-row">
        <AdBtn variant="primary" block hero onClick={handleInjectP0}>💉 Вставить коррекции в план ({weakPoints.length})</AdBtn>
        {hasInjectPrev && <AdBtn variant="dark" onClick={handleRollbackP0}>↩ Откат</AdBtn>}
      </div>
      {injectMsg && <AdBanner tone={injectMsg.startsWith('✓') || injectMsg.startsWith('↩') ? 'ok' : 'warn'}>{injectMsg}</AdBanner>}
      {!!diag && null}
    </AdSec>
  );
}
