/**
 * ProGuardPanels.tsx — pro-панели обратной связи с дневником.
 *
 * В отличие от калькуляторов в зоне «⚡ Интеллект», эти панели читают
 * UserProgram + TrainingProfile + sRPE/RIR-дневник и показывают рекомендации
 * БЕЗ отдельного ввода — как карточки-статусы с действиями.
 *
 * Панели:
 *  - LoadGuardPanel: ACWR + монотонность + strain из sRPE-дневника → предупреждение перетрена.
 *  - RealMRVPanel: индивидуальный MRV из истории sRPE+готовности → замена статических ландмарок.
 *  - RIRCalibrationPanel: RIR-bias из дневника → корректировка целевого RIR в плане.
 *  - TonnageEstimatePanel: авто-тоннаж/КПШ/УОИ из UserProgram + workMax (без ввода).
 */
import React, { useMemo, useState } from 'react';
import type { UserProgram } from '../../../engines/user-program/user-program.types';
import { loadTrainingProfile } from './training-profile';
import { loadSRPESessions } from '../../../engines/pro/srpe-store';
import { acuteChronicRatio, toDailyLoads, weeklyMonotony, type ACWRZone } from '../../../engines/pro/training-load.engine';
import { loadRirCalibrationStats } from '../../../engines/meso-correction.engine';
import { getVolumeLandmarks } from '../../../engines/volume-landmarks.engine';
import { GROUP_RU } from './program-types';
import { CARD, DIM, DIM_STRONG, ACCENT } from './training-ui';
import { stickingPhases, barPathAnalysis, type BarPathIssue } from '../../../engines/pro/lift-diagnostics.engine';
import { WEAK_POINTS_BY_LIFT, diagnoseWeakPoint, type WeakPoint, type Lift } from '../../../engines/lms/weakpoint-pl';
import { runWhatIf, generateReadinessForecast, type ForecastResult } from '../../../engines/predictive.engine';
import { loadReadinessHistory } from './readiness-history';
import { useDataLink } from '../../../core/data-link';
import { PCT_FOR_RIR } from '../../../engines/rir-table';

interface GuardPanelProps {
  program: UserProgram;
  dir: string;
  onChange?: (p: UserProgram) => void;
  showToast?: (m: string) => void;
  labMrvMult?: number;
}

/* ═════════════ P-1: LoadGuardPanel (ACWR + монотонность + strain) ═════════════ */
export const LoadGuardPanel: React.FC<GuardPanelProps> = ({ program }) => {
  const data = useMemo(() => {
    const srpe = loadSRPESessions();
    if (srpe.length < 2) return null;
    const daily = toDailyLoads(srpe);
    const acwr = acuteChronicRatio(daily);
    let monotony: { monotony: number; strain: number; meanDailyLoad: number } | null = null;
    try { const m = weeklyMonotony(daily); monotony = { monotony: m.monotony, strain: m.strain, meanDailyLoad: m.meanDailyLoad }; } catch {}
    return { acwr, monotony, sessionsCount: srpe.length };
  }, []);

  if (!data) return null;

  const { acwr, monotony, sessionsCount } = data;
  const zoneColors: Record<ACWRZone, string> = {
    undertrained: '#3b82f6',
    optimal: '#22c55e',
    caution: '#f59e0b',
    dangerous: '#ef4444',
  };
  const zoneLabels: Record<ACWRZone, string> = {
    undertrained: 'недотрен',
    optimal: 'оптимум',
    caution: 'осторожно',
    dangerous: 'опасно',
  };
  const zoneColor = zoneColors[acwr.zone];
  const zoneLabel = zoneLabels[acwr.zone];

  // Рекомендации
  const recs: string[] = [];
  if (acwr.zone === 'dangerous') recs.push('⚠ ACWR > 1.5 — критическая зона. Снизьте объём недели на 20-30%, добавьте разгрузку.');
  else if (acwr.zone === 'caution') recs.push('🔶 ACWR 1.3-1.5 — осторожно. Не повышайте объём, рассмотрите разгрузочную неделю.');
  else if (acwr.zone === 'undertrained') recs.push('🔵 ACWR < 0.8 — недотрен. Можно повысить объём на 10-15%.');
  else recs.push('✅ ACWR 0.8-1.3 — оптимальная зона. Продолжайте текущий объём.');

  if (monotony && monotony.monotony > 2) recs.push(`⚠ Монотонность ${monotony.monotony.toFixed(2)} > 2 — однообразие. Добавьте вариативность (смените упражнения/интенсивность).`);
  if (monotony && monotony.strain > 1000) recs.push(`⚠ Strain ${Math.round(monotony.strain)} > 1000 — высокая нагрузка. Снизьте объём или добавьте отдых.`);

  return (
    <div style={{ ...CARD, padding: 10, borderLeft: '3px solid ' + zoneColor }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: ACCENT }}>🛡 Охрана нагрузки</span>
        <span style={{ fontSize: 14, fontWeight: 800, color: zoneColor }}>ACWR {acwr.ratio.toFixed(2)} · {zoneLabel}</span>
        <span style={{ fontSize: 10, color: DIM, marginLeft: 'auto' }}>{sessionsCount} sRPE-сессий</span>
      </div>

      {/* ACWR бар */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: DIM, marginBottom: 4 }}>
          <span>0.5</span>
          <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'linear-gradient(90deg, #3b82f6 0-40%, #22c55e 40-65%, #f59e0b 65-75%, #ef4444 75-100%)', overflow: 'hidden', position: 'relative' }}>
            <div style={{ position: 'absolute', left: `${Math.min(100, Math.max(0, (acwr.ratio / 2) * 100))}%`, top: -2, width: 3, height: 12, background: '#fff', borderRadius: 2, boxShadow: '0 0 4px rgba(0,0,0,0.5)' }} />
          </div>
          <span>2.0</span>
        </div>
        <div style={{ fontSize: 10, color: DIM }}>Острая {Math.round(acwr.acute)} / Хроническая {Math.round(acwr.chronic)}</div>
      </div>

      {/* Монотонность + strain */}
      {monotony && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
          <div style={{ padding: '4px 6px', background: 'rgba(255,255,255,0.03)', borderRadius: 6 }}>
            <div style={{ fontSize: 10, color: DIM }}>Монотонность</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: monotony.monotony > 2 ? '#f59e0b' : '#22c55e' }}>{monotony.monotony.toFixed(2)}</div>
          </div>
          <div style={{ padding: '4px 6px', background: 'rgba(255,255,255,0.03)', borderRadius: 6 }}>
            <div style={{ fontSize: 10, color: DIM }}>Strain</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: monotony.strain > 1000 ? '#ef4444' : '#22c55e' }}>{Math.round(monotony.strain)}</div>
          </div>
        </div>
      )}

      {/* Рекомендации */}
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', lineHeight: 1.45 }}>
        {recs.map((r, i) => <div key={i} style={{ marginBottom: 2 }}>{r}</div>)}
      </div>
    </div>
  );
};

/* ═════════════ P-2: RealMRVPanel (индивидуальный MRV из истории) ═════════════ */
export const RealMRVPanel: React.FC<GuardPanelProps> = ({ program, labMrvMult = 1 }) => {
  const data = useMemo(() => {
    const srpe = loadSRPESessions();
    if (srpe.length < 4) return null; // нужно минимум 4 сессии для оценки
    const daily = toDailyLoads(srpe);
    const acwr = acuteChronicRatio(daily);
    // F1.3: перемножаем ACWR-множитель × labMrvMult (лаб-данные).
    // Раньше был только ACWR — теперь RealMRV учитывает оба сигнала.
    let acwrMult = 1.0;
    if (acwr.ratio > 1.5) acwrMult = 0.85;
    else if (acwr.ratio > 1.3) acwrMult = 0.9;
    else if (acwr.ratio < 0.8) acwrMult = 1.1;
    const mult = acwrMult * labMrvMult;
    return { mult, acwrMult, labMult: labMrvMult, sessionsCount: srpe.length, ratio: acwr.ratio };
  }, [labMrvMult]);

  if (!data) return null;

  const MUSCLES = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'] as const;
  const level = program.meta.level;
  const staticMRV: Record<string, number> = {};
  const realMRV: Record<string, number> = {};
  for (const m of MUSCLES) {
    const lm = getVolumeLandmarks(level, m);
    if (lm) {
      staticMRV[m] = lm.mrv;
      realMRV[m] = Math.round(lm.mrv * data.mult);
    }
  }

  const multColor = data.mult < 1 ? '#ef4444' : data.mult > 1 ? '#22c55e' : '#f59e0b';
  const sourceLabel = data.acwrMult !== 1 && data.labMult !== 1
    ? `ACWR ×${data.acwrMult.toFixed(2)} + лаб ×${data.labMult.toFixed(2)}`
    : data.acwrMult !== 1
      ? `ACWR ×${data.acwrMult.toFixed(2)} (перетрен-риск)`
      : data.labMult !== 1
        ? `лаб ×${data.labMult.toFixed(2)} (лаб-данные)`
        : 'норма ×1.00';
  const multLabel = data.mult < 1 ? `снижение (${sourceLabel})` : data.mult > 1 ? `повышение (${sourceLabel})` : sourceLabel;

  return (
    <div style={{ ...CARD, padding: 10, borderLeft: '3px solid ' + multColor }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: ACCENT }}>📊 Реальный MRV (из истории)</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: multColor }}>{multLabel}</span>
        <span style={{ fontSize: 10, color: DIM, marginLeft: 'auto' }}>{data.sessionsCount} sRPE-сессий · ACWR {data.ratio.toFixed(2)}</span>
      </div>

      <div style={{ fontSize: 10, color: DIM, marginBottom: 6 }}>
        Статический MRV (из таблиц) vs реальный (скорректированный по вашей истории нагрузки):
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {MUSCLES.filter(m => staticMRV[m]).map(m => {
          const s = staticMRV[m];
          const r = realMRV[m];
          const delta = r - s;
          const deltaColor = delta < 0 ? '#ef4444' : delta > 0 ? '#22c55e' : DIM;
          return (
            <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', borderRadius: 6, background: 'rgba(255,255,255,0.02)' }}>
              <span style={{ fontSize: 11, color: DIM_STRONG, flex: '0 0 80px' }}>{GROUP_RU[m] ?? m}</span>
              <span style={{ fontSize: 11, color: DIM, minWidth: 50, textAlign: 'center' }}>стат: {s}</span>
              <span style={{ fontSize: 11, color: '#fff', fontWeight: 700 }}>→</span>
              <span style={{ fontSize: 11, color: multColor, fontWeight: 700, minWidth: 50, textAlign: 'center' }}>реал: {r}</span>
              <span style={{ fontSize: 11, color: deltaColor, fontWeight: 700, marginLeft: 'auto' }}>{delta > 0 ? '+' : ''}{delta}</span>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 10, color: DIM, marginTop: 6, fontStyle: 'italic' }}>
        Реальный MRV = статический × {data.mult.toFixed(2)}. Используйте реальный для планирования объёма.
      </div>
    </div>
  );
};

/* ═════════════ P-3: RIRCalibrationPanel (RIR-bias из дневника) ═════════════ */
export const RIRCalibrationPanel: React.FC<GuardPanelProps> = ({ program, dir, onChange, showToast }) => {
  const stats = useMemo(() => loadRirCalibrationStats(), []);

  if (stats.totalSets < 3) return null; // нужно минимум 3 сета для калибровки

  const bias = stats.bias;
  // bias = plannedRIR - actualRIR; bias > 0 → работает легче плана (actualRIR < planned)
  // bias < 0 → работает тяжелее плана (actualRIR > planned)
  const biasColor = Math.abs(bias) < 0.5 ? '#22c55e' : Math.abs(bias) < 1.5 ? '#f59e0b' : '#ef4444';
  const biasLabel = bias > 0.5 ? `работаете легче плана на ${bias.toFixed(1)} RIR` : bias < -0.5 ? `работаете тяжелее плана на ${Math.abs(bias).toFixed(1)} RIR` : `калибровка точная (±${Math.abs(bias).toFixed(1)} RIR)`;

  // Рекомендация: скорректировать целевой RIR в плане
  const correction = bias > 0.5 ? `Снизьте целевой RIR на ${Math.round(bias)} (вы работаете легче → можно ближе к отказу)` : bias < -0.5 ? `Повысьте целевой RIR на ${Math.round(Math.abs(bias))} (вы работаете тяжелее → отойдите от отказа)` : 'Корректировка не требуется';

  const applyCorrection = () => {
    if (dir !== 'bb' || !program.bb || !onChange || !showToast) return;
    const delta = bias > 0.5 ? -Math.round(bias) : bias < -0.5 ? Math.round(Math.abs(bias)) : 0;
    if (delta === 0) return;
    const updated = {
      ...program,
      bb: {
        ...program.bb!,
        weeks: program.bb!.weeks.map(w => ({
          ...w,
          sessions: w.sessions.map(s => ({
            ...s,
            blocks: s.blocks.map(b => ({
              ...b,
              sets: b.sets.map(st => ({ ...st, rir: Math.max(0, Math.min(6, (st.rir ?? 2) + delta)) })),
            })),
          })),
        })),
      },
    };
    onChange(updated);
    showToast(`✅ RIR ${delta > 0 ? '+' : ''}${delta} применён ко всем сетам плана`);
  };

  return (
    <div style={{ ...CARD, padding: 10, borderLeft: '3px solid ' + biasColor }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: ACCENT }}>🎯 Калибровка RIR</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: biasColor }}>{biasLabel}</span>
        <span style={{ fontSize: 10, color: DIM, marginLeft: 'auto' }}>{stats.totalSets} сетов · консистенция {stats.consistency}%</span>
      </div>

      {/* Bias-бар */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: DIM }}>
          <span>−3</span>
          <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'linear-gradient(90deg, #ef4444 0-30%, #f59e0b 30-45%, #22c55e 45-55%, #f59e0b 55-70%, #ef4444 70-100%)', overflow: 'hidden', position: 'relative' }}>
            <div style={{ position: 'absolute', left: `${Math.min(100, Math.max(0, ((bias + 3) / 6) * 100))}%`, top: -2, width: 3, height: 12, background: '#fff', borderRadius: 2, boxShadow: '0 0 4px rgba(0,0,0,0.5)' }} />
          </div>
          <span>+3</span>
        </div>
        <div style={{ fontSize: 10, color: DIM, textAlign: 'center', marginTop: 2 }}>Bias: {bias > 0 ? '+' : ''}{bias.toFixed(2)} RIR</div>
      </div>

      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', marginBottom: 6, lineHeight: 1.4 }}>
        📋 {correction}
      </div>

      {Math.abs(bias) >= 0.5 && dir === 'bb' && onChange && showToast && (
        <button onClick={applyCorrection} style={{ marginTop: 4, padding: '8px 14px', borderRadius: 8, fontSize: 11, cursor: 'pointer', background: biasColor + '15', border: '1px solid ' + biasColor + '40', color: biasColor, fontWeight: 700, minHeight: 38, width: '100%' }}>
          🔧 Применить корректировку RIR ко всем сетам
        </button>
      )}
    </div>
  );
};

/* ═════════════ P-5: TonnageEstimatePanel (авто-тоннаж/КПШ/УОИ из плана) ═════════════ */
export const TonnageEstimatePanel: React.FC<GuardPanelProps> = ({ program, dir }) => {
  const data = useMemo(() => {
    if (dir !== 'bb' || !program.bb) return null;
    const prof = loadTrainingProfile();
    const workMax = prof.workMax ?? {};
    // Берём пиковую неделю (макс сетов)
    let peakWeek = program.bb.weeks[0];
    let peakSets = 0;
    for (const w of program.bb.weeks) {
      const sets = w.sessions.reduce((s, ses) => s + ses.blocks.reduce((s2, b) => s2 + b.sets.length, 0), 0);
      if (sets > peakSets) { peakSets = sets; peakWeek = w; }
    }
    if (!peakWeek) return null;

    let totalTonnage = 0;
    let totalReps = 0; // КПШ
    let totalSets = 0;
    const perMuscle: Record<string, { tonnage: number; reps: number; sets: number }> = {};

    for (const s of peakWeek.sessions) {
      for (const b of s.blocks) {
        if (!b.exerciseName) continue;
        const wm = (workMax as any)[b.muscle] ?? 0;
        for (const set of b.sets) {
          const reps = typeof set.reps === 'number' ? set.reps : parseInt(String(set.reps).replace(/[^0-9]/g, '')) || 8;
          let weight = set.weight ?? 0;
          if (!weight && wm > 0) {
            // F1.6: используем PCT_FOR_RIR (rir-table.ts) — единый канонический маппинг
            // RIR→%1RM. Раньше был ручной маппинг 0.65/0.72/0.80/0.87 — давал ошибки до 7%
            // (RIR 2 давал 72% вместо правильных 78-80%).
            const rir = set.rir ?? 2;
            const pct = PCT_FOR_RIR[rir] ?? (rir >= 4 ? 0.84 : rir >= 2 ? 0.92 : 0.96);
            weight = Math.round((wm * pct) / 2.5) * 2.5;
          }
          totalTonnage += weight * reps;
          totalReps += reps;
          totalSets += 1;
          if (b.muscle) {
            if (!perMuscle[b.muscle]) perMuscle[b.muscle] = { tonnage: 0, reps: 0, sets: 0 };
            perMuscle[b.muscle].tonnage += weight * reps;
            perMuscle[b.muscle].reps += reps;
            perMuscle[b.muscle].sets += 1;
          }
        }
      }
    }

    // УОИ = средний относительный вес к workMax
    let uoiSum = 0; let uoiCount = 0;
    for (const s of peakWeek.sessions) {
      for (const b of s.blocks) {
        const wm = (workMax as any)[b.muscle] ?? 0;
        if (!wm) continue;
        for (const set of b.sets) {
          const w = set.weight ?? 0;
          if (w > 0) { uoiSum += (w / wm) * 100; uoiCount++; }
        }
      }
    }
    const uoi = uoiCount > 0 ? Math.round(uoiSum / uoiCount) : 0;

    return { totalTonnage, totalReps, totalSets, uoi, perMuscle, weekNum: peakWeek.week };
  }, [program, dir]);

  if (!data) return null;

  const intensityLabel = data.uoi >= 85 ? 'тяжёлая' : data.uoi >= 75 ? 'умеренная' : data.uoi >= 65 ? 'лёгкая' : 'разгрузка';
  const intensityColor = data.uoi >= 85 ? '#ef4444' : data.uoi >= 75 ? '#f59e0b' : data.uoi >= 65 ? '#22c55e' : '#3b82f6';

  return (
    <div style={{ ...CARD, padding: 10, borderLeft: '3px solid ' + intensityColor }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: ACCENT }}>📊 Тоннаж недели {data.weekNum} (пик)</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: intensityColor }}>УОИ {data.uoi}% · {intensityLabel}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 6, marginBottom: 8 }}>
        <div style={{ padding: '4px 6px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: DIM }}>Тоннаж</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: DIM_STRONG }}>{(data.totalTonnage / 1000).toFixed(1)}k кг</div>
        </div>
        <div style={{ padding: '4px 6px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: DIM }}>КПШ</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: DIM_STRONG }}>{data.totalReps}</div>
        </div>
        <div style={{ padding: '4px 6px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: DIM }}>Сетов</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: DIM_STRONG }}>{data.totalSets}</div>
        </div>
        <div style={{ padding: '4px 6px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: DIM }}>УОИ</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: intensityColor }}>{data.uoi}%</div>
        </div>
      </div>

      {/* По мышцам */}
      {Object.keys(data.perMuscle).length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: DIM_STRONG, marginBottom: 4 }}>По мышцам:</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {Object.entries(data.perMuscle).sort((a, b) => b[1].tonnage - a[1].tonnage).slice(0, 8).map(([m, d]) => (
              <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, padding: '2px 0' }}>
                <span style={{ color: DIM_STRONG, flex: '0 0 70px' }}>{GROUP_RU[m] ?? m}</span>
                <span style={{ color: ACCENT, minWidth: 60 }}>{(d.tonnage / 1000).toFixed(1)}k кг</span>
                <span style={{ color: DIM, minWidth: 40 }}>{d.reps} КПШ</span>
                <span style={{ color: DIM, minWidth: 30 }}>{d.sets}с</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* ═════════════ P-11: StickingPointPanel (фазы срыва для упражнений плана) ═════════════ */
export const StickingPointPanel: React.FC<GuardPanelProps> = ({ program, dir, onChange, showToast }) => {
  if (dir !== 'bb' || !program.bb) return null;
  let peakWeek = program.bb.weeks[0];
  let peakSets = 0;
  for (const w of program.bb.weeks) {
    const sets = w.sessions.reduce((s, ses) => s + ses.blocks.reduce((s2, b) => s2 + b.sets.length, 0), 0);
    if (sets > peakSets) { peakSets = sets; peakWeek = w; }
  }
  if (!peakWeek) return null;

  const PL_LIFTS: Array<{ lift: Lift; keywords: string[] }> = [
    { lift: 'squat', keywords: ['присед', 'squat', 'фронтальн'] },
    { lift: 'bench', keywords: ['жим', 'bench', 'жим лёжа', 'жим лежа'] },
    { lift: 'deadlift', keywords: ['тяг', 'deadlift', 'станов'] },
  ];
  const detectedLifts: Array<{ lift: Lift; exerciseName: string }> = [];
  for (const s of peakWeek.sessions) {
    for (const b of s.blocks) {
      if (!b.exerciseName) continue;
      const lower = b.exerciseName.toLowerCase();
      for (const { lift, keywords } of PL_LIFTS) {
        if (keywords.some(k => lower.includes(k))) {
          if (!detectedLifts.find(d => d.exerciseName === b.exerciseName)) {
            detectedLifts.push({ lift, exerciseName: b.exerciseName });
          }
        }
      }
    }
  }
  if (detectedLifts.length === 0) return null;

  return (
    <div style={{ ...CARD, padding: 10, borderLeft: '3px solid #f59e0b' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: ACCENT }}>🎯 Срывы и слабые точки</span>
        <span style={{ fontSize: 10, color: DIM, marginLeft: 'auto' }}>{detectedLifts.length} ПЛ-движений в плане</span>
      </div>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 8 }}>
        Фазы срыва по упражнениям плана + рекомендованные assistance-упражнения.
      </div>
      {detectedLifts.map(({ lift, exerciseName }) => {
        const phases = stickingPhases(lift);
        if (!phases || phases.length === 0) return null;
        return (
          <div key={exerciseName} style={{ marginBottom: 8, padding: 8, borderRadius: 8, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', marginBottom: 4 }}>{exerciseName} ({lift})</div>
            <div style={{ fontSize: 10, color: DIM, marginBottom: 4 }}>Фазы срыва: {phases.join(' · ')}</div>
            {phases.map((wp: WeakPoint) => {
              const diag = diagnoseWeakPoint(lift, wp);
              if (!diag || !diag.assistance || diag.assistance.length === 0) return null;
              return (
                <div key={wp} style={{ marginTop: 4 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: DIM_STRONG }}>{wp}:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 2 }}>
                    {diag.assistance.slice(0, 3).map((a: any, i: number) => (
                      <button key={i} onClick={() => {
                        if (!onChange || !showToast || !program.bb?.weeks[0]?.sessions[0]) return;
                        const nb: any = { id: 'blk_' + Date.now() + '_' + i, type: 'accessory', exerciseName: a.name || a.exercise || a, muscle: lift === 'bench' ? 'chest' : lift === 'squat' ? 'legs' : 'back', role: 'accessory', sets: [{ reps: 10, rir: 2, weight: 0, restSec: 90 }] };
                        const upd = { ...program, bb: { ...program.bb!, weeks: program.bb!.weeks.map((w, wi) => wi === 0 ? { ...w, sessions: w.sessions.map((s, si) => si === 0 ? { ...s, blocks: [...s.blocks, nb] } : s) } : w) } };
                        onChange(upd);
                        showToast('✅ ' + (a.name || a.exercise || a) + ' → неделя 1, день 1');
                      }} style={{ padding: '4px 8px', borderRadius: 6, fontSize: 10, cursor: 'pointer', background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b', fontWeight: 700, minHeight: 32 }}>
                        + {a.name || a.exercise || a}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

/* ═════════════ P-12: PlateAutoPanel (блины для упражнений недели) ═════════════ */
const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5];
const BAR_KG = 20;

function calcPlates(weight: number): { plate: number; count: number }[] | null {
  if (weight <= BAR_KG) return [];
  const perSide = (weight - BAR_KG) / 2;
  if (perSide <= 0) return [];
  let remaining = perSide;
  const result: { plate: number; count: number }[] = [];
  for (const p of PLATES) {
    const n = Math.floor(remaining / p);
    if (n > 0) { result.push({ plate: p, count: n }); remaining -= n * p; }
    if (remaining < 0.01) break;
  }
  return result;
}

export const PlateAutoPanel: React.FC<GuardPanelProps> = ({ program, dir }) => {
  if (dir !== 'bb' || !program.bb) return null;
  const prof = loadTrainingProfile();
  const workMax = prof.workMax ?? {};
  const week = program.bb.weeks[0];
  if (!week) return null;

  const rows: Array<{ exerciseName: string; muscle: string; weight: number; plates: { plate: number; count: number }[] | null }> = [];
  for (const s of week.sessions) {
    for (const b of s.blocks) {
      if (!b.exerciseName) continue;
      const wm = (workMax as any)[b.muscle] ?? 0;
      const set = b.sets[0];
      if (!set) continue;
      let weight = set.weight ?? 0;
      if (!weight && wm > 0) {
        const rir = set.rir ?? 2;
        const pct = PCT_FOR_RIR[rir] ?? (rir >= 4 ? 0.84 : rir >= 2 ? 0.92 : 0.96);
        weight = Math.round((wm * pct) / 2.5) * 2.5;
      }
      if (weight <= 0) continue;
      rows.push({ exerciseName: b.exerciseName, muscle: b.muscle || '', weight, plates: calcPlates(weight) });
    }
  }
  if (rows.length === 0) return null;

  return (
    <div style={{ ...CARD, padding: 10, borderLeft: '3px solid #06b6d4' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: ACCENT }}>🏋️ Блины для недели 1</span>
        <span style={{ fontSize: 10, color: DIM, marginLeft: 'auto' }}>гриф {BAR_KG}кг · веса из workMax×%</span>
      </div>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 6 }}>
        Авто-расчёт комплекта блинов для каждого упражнения. Вес = workMax × %1RM (по RIR).
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: '40vh', overflow: 'auto' }}>
        {rows.map((r, i) => (
          <div key={i} style={{ padding: 6, borderRadius: 6, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <span style={{ flex: 1, fontWeight: 600, color: DIM_STRONG }}>{r.exerciseName}</span>
              <span style={{ color: ACCENT, fontWeight: 700 }}>{r.weight}кг</span>
            </div>
            {r.plates && r.plates.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
                {r.plates.map((p, pi) => (
                  <span key={pi} style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, background: 'rgba(6,182,212,0.10)', border: '1px solid rgba(6,182,212,0.25)', color: '#06b6d4', fontWeight: 600 }}>
                    {p.count}×{p.plate}кг
                  </span>
                ))}
              </div>
            )}
            {r.plates && r.plates.length === 0 && (
              <div style={{ fontSize: 10, color: DIM, marginTop: 4, fontStyle: 'italic' }}>Только гриф ({BAR_KG}кг)</div>
            )}
            {!r.plates && (
              <div style={{ fontSize: 10, color: DIM, marginTop: 4, fontStyle: 'italic' }}>Вес &lt; {BAR_KG}кг — только гриф</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

/* ═════════════ P-13a: WhatIfGuardPanel (прогноз Δ риска/готовности) ═════════════ */
export const WhatIfGuardPanel: React.FC<GuardPanelProps> = () => {
  const linked = useDataLink();
  const baseRisk = linked.risk?.overallRaw ?? 20;
  const baseReadiness = linked.readiness?.recovery ?? 70;
  const [deltaSleep, setDeltaSleep] = useState(0);
  const [deltaCal, setDeltaCal] = useState(0);

  const result = useMemo(() => {
    return runWhatIf(baseRisk, baseReadiness, {
      sleepChange: deltaSleep,
      calorieChange: deltaCal,
    });
  }, [baseRisk, baseReadiness, deltaSleep, deltaCal]);

  const riskColor = result.riskDelta > 5 ? '#ef4444' : result.riskDelta < -5 ? '#22c55e' : '#f59e0b';
  const readColor = result.readinessDelta > 5 ? '#22c55e' : result.readinessDelta < -5 ? '#ef4444' : '#f59e0b';

  return (
    <div style={{ ...CARD, padding: 10, borderLeft: '3px solid #a78bfa' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: ACCENT }}>🔮 What-if прогноз</span>
        <span style={{ fontSize: 10, color: DIM, marginLeft: 'auto' }}>база: риск {Math.round(baseRisk)}, готовность {Math.round(baseReadiness)}</span>
      </div>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 6 }}>
        Прогноз изменения риска и готовности при корректировке сна/калорий.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 10, color: DIM, marginBottom: 2 }}>Δ сон (часов/день): {deltaSleep > 0 ? '+' : ''}{deltaSleep}</div>
          <input type="range" min={-3} max={3} step={1} value={deltaSleep} onChange={e => setDeltaSleep(parseInt(e.target.value))} style={{ width: '100%', accentColor: '#a78bfa' }} />
        </div>
        <div>
          <div style={{ fontSize: 10, color: DIM, marginBottom: 2 }}>Δ калории (ккал/день): {deltaCal > 0 ? '+' : ''}{deltaCal}</div>
          <input type="range" min={-500} max={500} step={100} value={deltaCal} onChange={e => setDeltaCal(parseInt(e.target.value))} style={{ width: '100%', accentColor: '#a78bfa' }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <div style={{ padding: '6px 8px', background: riskColor + '10', borderRadius: 6, border: '1px solid ' + riskColor + '30' }}>
          <div style={{ fontSize: 10, color: DIM }}>Δ риск</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: riskColor }}>{result.riskDelta > 0 ? '+' : ''}{result.riskDelta}</div>
        </div>
        <div style={{ padding: '6px 8px', background: readColor + '10', borderRadius: 6, border: '1px solid ' + readColor + '30' }}>
          <div style={{ fontSize: 10, color: DIM }}>Δ готовность</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: readColor }}>{result.readinessDelta > 0 ? '+' : ''}{result.readinessDelta}</div>
        </div>
      </div>
      {deltaSleep < -2 && (
        <div style={{ fontSize: 10, color: '#ef4444', marginTop: 6 }}>⚠ Дефицит сна {deltaSleep}ч → готовность {result.readinessDelta < 0 ? '↓' : '↑'}. Рассмотрите снижение объёма.</div>
      )}
      {deltaCal < -300 && (
        <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 4 }}>🔶 Дефицит {deltaCal} ккал → восстановление хуже. RIR +1, объём ×0.9.</div>
      )}
    </div>
  );
};

/* ═════════════ P-13b: ReadinessForecastPanel (прогноз готовности) ═════════════ */
export const ReadinessForecastPanel: React.FC<GuardPanelProps> = () => {
  const forecast: ForecastResult | null = useMemo(() => {
    const history = loadReadinessHistory();
    if (history.length < 3) return null;
    return generateReadinessForecast(history.map(h => h.recovery));
  }, []);

  if (!forecast) return null;

  const chartW = 280, chartH = 60;
  const allValues = [...forecast.values];
  const minVal = Math.min(...allValues, 40);
  const maxVal = Math.max(...allValues, 80);
  const range = Math.max(1, maxVal - minVal);
  const points = forecast.values.map((v, i) => {
    const x = (i / Math.max(1, forecast.values.length - 1)) * (chartW - 8) + 4;
    const y = chartH - 6 - ((v - minVal) / range) * (chartH - 12);
    return [x, y] as const;
  });
  const pathD = points.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
  const stroke = forecast.values[0] < 50 ? '#ef4444' : forecast.values[0] < 65 ? '#f59e0b' : '#22c55e';

  return (
    <div style={{ ...CARD, padding: 10, borderLeft: '3px solid ' + stroke }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: ACCENT }}>📈 Прогноз готовности</span>
        <span style={{ fontSize: 10, color: DIM, marginLeft: 'auto' }}>Хольт-линейный, 5 дней</span>
      </div>
      <svg width={chartW} height={chartH} style={{ display: 'block' }} viewBox={`0 0 ${chartW} ${chartH}`}>
        <line x1={4} x2={chartW - 4} y1={chartH - 6 - ((40 - minVal) / range) * (chartH - 12)} y2={chartH - 6 - ((40 - minVal) / range) * (chartH - 12)} stroke="rgba(239,68,68,0.2)" strokeDasharray="2 2" />
        <path d={pathD} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={2.5} fill={stroke} />)}
        <text x={4} y={10} fontSize="8" fill="rgba(255,255,255,0.4)">день+1</text>
        <text x={chartW - 30} y={10} fontSize="8" fill="rgba(255,255,255,0.4)">день+5</text>
      </svg>
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        {forecast.values.map((v, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', padding: '3px 4px', background: (v < 50 ? '#ef4444' : v < 65 ? '#f59e0b' : '#22c55e') + '10', borderRadius: 4 }}>
            <div style={{ fontSize: 9, color: DIM }}>+{i + 1}д</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: v < 50 ? '#ef4444' : v < 65 ? '#f59e0b' : '#22c55e' }}>{Math.round(v)}</div>
          </div>
        ))}
      </div>
      {forecast.warnings.length > 0 && (
        <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 6, lineHeight: 1.4 }}>
          {forecast.warnings.map((w, i) => <div key={i}>{w}</div>)}
        </div>
      )}
    </div>
  );
};

/* ═════════════ P-13c: CheckinGuardPanel (последний чек-ин → коррекция) ═════════════ */
export const CheckinGuardPanel: React.FC<GuardPanelProps> = () => {
  const checkin = useMemo(() => {
    try {
      const raw = localStorage.getItem('he_checkin_latest');
      if (!raw) return null;
      const c = JSON.parse(raw);
      return c;
    } catch { return null; }
  }, []);

  if (!checkin) return null;

  // Эвристика коррекции плана по чек-ину
  const recs: string[] = [];
  let mult = 1.0;
  let rirDelta = 0;

  if (checkin.sleepHours && checkin.sleepHours < 6) { recs.push(`😴 Сон ${checkin.sleepHours}ч < 6 → восстановление снижено`); mult *= 0.9; rirDelta += 1; }
  if (checkin.subjectiveSoreness && checkin.subjectiveSoreness >= 4) { recs.push(`🔥 DOMS ${checkin.subjectiveSoreness}/5 → мышцы не восстановлены`); mult *= 0.85; }
  if (checkin.subjectiveStress && checkin.subjectiveStress >= 4) { recs.push(`💔 Стресс ${checkin.subjectiveStress}/5 → ЦНС перегружена`); mult *= 0.9; rirDelta += 1; }
  if (checkin.subjectiveEnergy && checkin.subjectiveEnergy <= 2) { recs.push(`⚡ Энергия ${checkin.subjectiveEnergy}/5 → низкая готовность`); mult *= 0.85; }
  if (checkin.hrvMs && checkin.hrvMs < 30) { recs.push(`📊 HRV ${checkin.hrvMs}мс < 30 → высокий стресс`); mult *= 0.9; }

  if (recs.length === 0) {
    recs.push('✅ Чек-ин в норме — корректировка не требуется');
  } else {
    recs.push(`📋 Рекомендация: объём ×${mult.toFixed(2)}${rirDelta > 0 ? `, RIR +${rirDelta}` : ''}`);
  }

  const color = mult < 0.9 ? '#ef4444' : mult < 1 ? '#f59e0b' : '#22c55e';

  return (
    <div style={{ ...CARD, padding: 10, borderLeft: '3px solid ' + color }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: ACCENT }}>📋 Чек-ин коррекция</span>
        <span style={{ fontSize: 11, fontWeight: 700, color }}>×{mult.toFixed(2)}</span>
        <span style={{ fontSize: 10, color: DIM, marginLeft: 'auto' }}>{checkin.date || 'сегодня'}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(70px, 1fr))', gap: 4, marginBottom: 6 }}>
        {checkin.sleepHours != null && <div style={{ padding: '3px 5px', background: 'rgba(255,255,255,0.03)', borderRadius: 4, textAlign: 'center' }}><div style={{ fontSize: 9, color: DIM }}>Сон</div><div style={{ fontSize: 11, fontWeight: 700, color: DIM_STRONG }}>{checkin.sleepHours}ч</div></div>}
        {checkin.subjectiveSoreness != null && <div style={{ padding: '3px 5px', background: 'rgba(255,255,255,0.03)', borderRadius: 4, textAlign: 'center' }}><div style={{ fontSize: 9, color: DIM }}>DOMS</div><div style={{ fontSize: 11, fontWeight: 700, color: DIM_STRONG }}>{checkin.subjectiveSoreness}/5</div></div>}
        {checkin.subjectiveStress != null && <div style={{ padding: '3px 5px', background: 'rgba(255,255,255,0.03)', borderRadius: 4, textAlign: 'center' }}><div style={{ fontSize: 9, color: DIM }}>Стресс</div><div style={{ fontSize: 11, fontWeight: 700, color: DIM_STRONG }}>{checkin.subjectiveStress}/5</div></div>}
        {checkin.subjectiveEnergy != null && <div style={{ padding: '3px 5px', background: 'rgba(255,255,255,0.03)', borderRadius: 4, textAlign: 'center' }}><div style={{ fontSize: 9, color: DIM }}>Энергия</div><div style={{ fontSize: 11, fontWeight: 700, color: DIM_STRONG }}>{checkin.subjectiveEnergy}/5</div></div>}
        {checkin.hrvMs != null && <div style={{ padding: '3px 5px', background: 'rgba(255,255,255,0.03)', borderRadius: 4, textAlign: 'center' }}><div style={{ fontSize: 9, color: DIM }}>HRV</div><div style={{ fontSize: 11, fontWeight: 700, color: DIM_STRONG }}>{checkin.hrvMs}мс</div></div>}
      </div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', lineHeight: 1.45 }}>
        {recs.map((r, i) => <div key={i} style={{ marginBottom: 2 }}>{r}</div>)}
      </div>
    </div>
  );
};

/* ═════════════ P-14: BiomechanicsPanel (bar-path анализ для ПЛ-движений плана) ═════════════ */
const BAR_PATH_RU: Record<BarPathIssue, string> = {
  forward_drift: 'Уход штанги вперёд',
  hips_shoot_up: 'Таз выстреливает вверх',
  good_morning: 'Good-morning присед',
  bar_loops: 'Петлеобразная траектория',
  asymmetric: 'Асимметрия сторон',
};

export const BiomechanicsPanel: React.FC<GuardPanelProps> = ({ program, dir }) => {
  const [selectedLift, setSelectedLift] = useState<Lift | null>(null);

  if (dir !== 'bb' || !program.bb) return null;
  const week = program.bb.weeks[0];
  if (!week) return null;
  const PL_LIFTS: Array<{ lift: Lift; keywords: string[] }> = [
    { lift: 'squat', keywords: ['присед', 'squat', 'фронтальн'] },
    { lift: 'bench', keywords: ['жим', 'bench', 'жим лёжа', 'жим лежа'] },
    { lift: 'deadlift', keywords: ['тяг', 'deadlift', 'станов'] },
  ];
  const detectedLifts: Lift[] = [];
  for (const s of week.sessions) {
    for (const b of s.blocks) {
      if (!b.exerciseName) continue;
      const lower = b.exerciseName.toLowerCase();
      for (const { lift, keywords } of PL_LIFTS) {
        if (keywords.some(k => lower.includes(k)) && !detectedLifts.includes(lift)) {
          detectedLifts.push(lift);
        }
      }
    }
  }
  if (detectedLifts.length === 0) return null;

  const lift = selectedLift ?? detectedLifts[0];
  const allIssues: BarPathIssue[] = ['forward_drift', 'hips_shoot_up', 'good_morning', 'bar_loops', 'asymmetric'];
  const analysis = barPathAnalysis(lift, allIssues);

  return (
    <div style={{ ...CARD, padding: 10, borderLeft: '3px solid #06b6d4' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: ACCENT }}>🦴 Биомеханика</span>
        <div style={{ display: 'flex', gap: 3, marginLeft: 'auto' }}>
          {detectedLifts.map(l => (
            <button key={l} onClick={() => setSelectedLift(l)} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer', background: lift === l ? 'rgba(6,182,212,0.15)' : 'rgba(255,255,255,0.04)', border: '1px solid ' + (lift === l ? 'rgba(6,182,212,0.3)' : 'rgba(255,255,255,0.06)'), color: lift === l ? '#06b6d4' : DIM }}>{l}</button>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 6 }}>
        Возможные ошибки траектории штанги для {lift}. Причина + коррекция.
      </div>
      {analysis && analysis.diagnoses && analysis.diagnoses.map((d, i) => (
        <div key={i} style={{ marginBottom: 4, padding: 6, borderRadius: 6, background: 'rgba(6,182,212,0.04)', border: '1px solid rgba(6,182,212,0.12)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#06b6d4' }}>{BAR_PATH_RU[d.issue] ?? d.issue}</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>📍 {d.cause}</div>
          <div style={{ fontSize: 10, color: '#22c55e', marginTop: 2 }}>✅ {d.correction}</div>
        </div>
      ))}
    </div>
  );
};