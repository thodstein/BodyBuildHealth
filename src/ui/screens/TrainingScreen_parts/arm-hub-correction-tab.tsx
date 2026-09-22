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
import { roleLabel, roleOf, preventiveFor, drillsForPhase, correctiveWaveForWeek, doseForCauseV2, shouldUseDoseV2 } from '../../../engines/arm/arm-correction-pro2.engine';
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
    toggleWeakPoint, trackType, autoPoint, mvPhase, corrV2, armPrefCorr, setArmPrefCorr,
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
      <AdSec title="🛠 Коррекция движений" summary="выбор точки → причина → методы с выбором упражнения">
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
    <AdSec title={`🛠 Коррекция движений (${weakPoints.length})`} summary="выбор точки → причина → методы с выбором упражнения">
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
                // E3: показанная доза = вставляемая (v2 с флагами инъекции; без — v1 как раньше)
                const c = cause ? cause.cause : null;
                const useV2 = shouldUseDoseV2(c, (state as any)?.level, { tendonOverload: !!(corrV2 as any)?.tendonOverload });
                const adj = useV2
                  ? doseForCauseV2(wp, c, { level: (state as any)?.level, tendonOverload: !!(corrV2 as any)?.tendonOverload })
                  : (cause ? doseForCause(wp, cause.cause) : null);
                return adj && adj.adjusted ? (
                  <div className="ad-tip" data-arm="correction-dose-cause">📐 Доза по причине ({cause.cause}): {doseLabel(adj)}</div>
                ) : null;
              })()}
              {top.length > 0 ? (
                <div data-arm="correction-top3" style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div className="ad-muted">Методы с выбором упражнения — выбери, что пойдёт первым в план:</div>
                  {top.map((t: any) => {
                    const pref = (armPrefCorr as any)?.[wp] === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        data-arm="correction-pick"
                        data-selected={pref ? 'true' : 'false'}
                        aria-pressed={pref}
                        aria-label={`${pref ? 'Выбрано' : 'Выбрать'}: ${t.id}`}
                        onClick={() => setArmPrefCorr(wp, t.id)}
                        style={{ display: 'block', width: '100%', textAlign: 'left', minHeight: 52, padding: '8px 10px', borderRadius: 10, cursor: 'pointer', color: '#fff', background: pref ? 'linear-gradient(135deg, rgba(245,158,11,0.16), rgba(245,158,11,0.06))' : 'rgba(59,130,246,0.06)', border: pref ? '2px solid rgba(245,158,11,0.65)' : '1px solid rgba(59,130,246,0.14)' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span data-arm="correction-star" aria-hidden style={{ minWidth: 32, minHeight: 32, borderRadius: 8, border: '1px solid rgba(245,158,11,0.4)', background: pref ? 'rgba(245,158,11,0.25)' : 'transparent', color: '#fff', fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{pref ? '⭐' : '☆'}</span>
                          <b style={{ flex: 1, minWidth: 0 }}>{t.id}</b>
                          <span style={{ fontSize: 11, fontWeight: 800, color: pref ? '#f5b04c' : '#fff', whiteSpace: 'nowrap', flexShrink: 0 }}>{pref ? '✓ Выбрано' : 'Выбрать'}</span>
                        </div>
                        <div className="ad-muted">{roleLabel(t.id)} · score {t.score}{t.reason ? ` · ${t.reason}` : ''}</div>
                      </button>
                    );
                  })}
                  {sim ? <div className="ad-muted">Δ {sim.summary}</div> : null}
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
      {(() => {
        const roleOrder: Record<string, number> = { heavy: 0, table: 1, static: 2, iso: 3, pulse: 4, pump: 5 };
        const picks = (weakPoints as ArmWeakPoint[]).map((wp) => {
          const pref = (armPrefCorr || {})[wp];
          const top = ((H.armTop3P0?.[wp] || []) as any[]);
          const ordered = pref ? [...top.filter((t) => t.id === pref), ...top.filter((t) => t.id !== pref)] : top;
          const id = ordered[0]?.id;
          if (!id) return null;
          const corr = (ARM_CORRECTIONS as any)?.[wp];
          return { wp, id, role: roleOf(id) || 'heavy', sets: corr?.sets ?? 3, reps: (corr?.repsRange ?? [6, 8]) as number[], pct: Math.round((corr?.intensityPct ?? 0.65) * 100), hold: corr?.holdSeconds };
        }).filter(Boolean) as Array<{ wp: string; id: string; role: string; sets: number; reps: number[]; pct: number; hold?: number }>;
        picks.sort((a, b) => (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9));
        const session = picks.slice(0, 6);
        if (!session.length) return null;
        const w = correctiveWaveForWeek(1);
        return (
          <div data-arm="correction-session" style={{ marginTop: 8, padding: '10px 12px', borderRadius: 12, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.18)' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#22c55e' }}>📋 Коррекционная сессия ({session.length}) — сила → стол → стабильность → объём</div>
            {session.map((s, i) => (
              <div key={`${s.wp}-${s.id}-${i}`} style={{ fontSize: 11, color: '#fff', marginTop: 3 }}>{i + 1}. {s.id} — {s.sets}×{s.reps[0]}–{s.reps[1]}{s.hold ? ` · холд ${s.hold}с` : ''} @{s.pct}% · {roleLabel(s.id)}</div>
            ))}
            <div data-arm="correction-wave-note" style={{ fontSize: 11, color: '#fff', marginTop: 6 }}>🌊 Волна: {w.note} · Н2 объём +1 · Н3 делод −1</div>
            <div style={{ fontSize: 10, color: '#fff', marginTop: 4 }}>⭐-выбранное идёт первым в план; сессия — предпросмотр по 1 упражнению на точку.</div>
          </div>
        );
      })()}
      <div className="ad-row">
        <AdBtn variant="primary" block hero onClick={handleInjectP0}>💉 Вставить коррекции в план ({weakPoints.length})</AdBtn>
        {hasInjectPrev && <AdBtn variant="dark" onClick={handleRollbackP0}>↩ Откат</AdBtn>}
      </div>
      {injectMsg && <AdBanner tone={injectMsg.startsWith('✓') || injectMsg.startsWith('↩') ? 'ok' : 'warn'}>{injectMsg}</AdBanner>}
      {!!diag && null}
    </AdSec>
  );
}
