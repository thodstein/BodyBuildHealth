/**
 * bb-step-weights.tsx — шаг «⚖️ Реальные веса по упражнениям», вынесен из
 * god-component `BbAutoConstructor.tsx` (§4.3, этап 3). Перенос 1-в-1:
 * логика/тексты/стили не менялись, все state-ссылки переданы явными props.
 */
import React from 'react';
import { collectPlanExercises, recalibratePlanWeights, groupWeightEntries, type PlanWeightEntry } from '../../../engines/bb/bb-weight-calibration.engine';
import type { BBPlan } from '../../../engines/bb/bb-builder.engine';
import { getProfile, updateProfile } from '../../../core/profile-manager';
import { BTN, BTN_GHOST } from './training-ui';
import { muscleLabel } from './bb-labels';

export interface BbWeightsStepProps {
  builtPlan: BBPlan | null;
  setBuiltPlan: React.Dispatch<React.SetStateAction<BBPlan | null>>;
  weightEntries: PlanWeightEntry[];
  setWeightEntries: React.Dispatch<React.SetStateAction<PlanWeightEntry[]>>;
  weightsApplied: number;
  setWeightsApplied: React.Dispatch<React.SetStateAction<number>>;
  weightsCollapsed: Record<string, boolean>;
  setWeightsCollapsed: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  /** «Далее: отчёт качества →». */
  onGoQuality: () => void;
  /** «← Назад» (шаг «План»). */
  onBack: () => void;
}

export const BbWeightsStep: React.FC<BbWeightsStepProps> = ({
  builtPlan, setBuiltPlan, weightEntries, setWeightEntries, weightsApplied, setWeightsApplied,
  weightsCollapsed, setWeightsCollapsed, onGoQuality, onBack,
}) => {
  if (!builtPlan) return null;
  const entries = weightEntries.length ? weightEntries : collectPlanExercises(builtPlan);
  const filled = entries.filter(e => e.actualWeight != null && e.actualWeight > 0).length;
  // Фаза 0: группировка по группам мышц (порядок — по появлению в плане).
  const groups = groupWeightEntries(entries);
  const setEntry = (i: number, v: number | null) =>
    setWeightEntries(prev => { const c = prev.length ? prev.slice() : collectPlanExercises(builtPlan); c[i] = { ...c[i], actualWeight: v }; return c; });
  const apply = () => {
    if (!builtPlan) return;
    const res = recalibratePlanWeights(builtPlan, entries);
    setBuiltPlan({ ...res.plan, rationale: [...res.plan.rationale, `⚖️ Реальные веса: применено к ${res.applied} вхождений упражнений (${filled} заполнено).`] });
    setWeightsApplied(res.applied);
    // Персистентность в training.workMaxByExercise (ключ = id упражнения)
    try {
      const saved: Record<string, number> = {};
      for (const e of entries) if (e.id && e.actualWeight != null && e.actualWeight > 0) saved[e.id] = e.actualWeight;
      if (Object.keys(saved).length) {
        const cur = getProfile();
        const next: any = JSON.parse(JSON.stringify(cur.settings || {}));
        if (!next.training) next.training = {};
        next.training.workMaxByExercise = { ...(next.training.workMaxByExercise || {}), ...saved };
        updateProfile({ settings: next });
      }
    } catch { /* ignore */ }
  };
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 4 }}>⚖️ Реальные веса по упражнениям</div>
      <div style={{ fontSize: 12, color: '#fff', opacity: 0.85, marginBottom: 12, lineHeight: 1.5 }}>
        Введите <b style={{ color: '#00e68a' }}>фактические рабочие веса</b> (кг) для упражнений плана, сгруппированных по группам мышц.
        Движок пересчитает сеты и тоннаж от реальных значений вместо формульной экстраполяции от рабочего максимума по группе.
        Сохранённые веса применятся и при следующей пересборке.
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <button style={{ ...BTN, flex: 1 }} onClick={apply} disabled={filled === 0}>
          {weightsApplied > 0 ? `✓ Применено к ${weightsApplied} вхождений` : '⚖️ Применить реальные веса'}
        </button>
        <button style={BTN_GHOST} onClick={() => { setWeightEntries(collectPlanExercises(builtPlan)); setWeightsApplied(0); }}>⟲ Сбросить</button>
        <button style={BTN_GHOST} onClick={() => { const allOpen = Object.values(weightsCollapsed).every(Boolean); const next: Record<string, boolean> = {}; for (const g of groups) next[g.muscle] = !allOpen; setWeightsCollapsed(next); }}>{(Object.values(weightsCollapsed).filter(Boolean).length === 0 ? 'Свернуть все' : 'Развернуть все')}</button>
      </div>
      {filled === 0 && <div style={{ fontSize: 11, color: '#fbbf24', marginBottom: 8 }}>Введите хотя бы один фактический вес, чтобы пересчитать нагрузку.</div>}
      {entries.length === 0
        ? <div style={{ fontSize: 12, color: '#fff', opacity: 0.7, padding: 20, textAlign: 'center' }}>План пуст — сначала соберите план.</div>
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {groups.map(g => {
              const collapsed = !!weightsCollapsed[g.muscle];
              const gFilled = g.items.filter(e => e.actualWeight != null && e.actualWeight > 0).length;
              return (
                <div key={g.muscle} style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(0,230,138,0.18)', background: 'rgba(0,230,138,0.03)' }}>
                  <button
                    type="button"
                    aria-expanded={!collapsed}
                    onClick={() => setWeightsCollapsed(p => ({ ...p, [g.muscle]: !collapsed }))}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 12px', cursor: 'pointer', border: 'none', background: 'linear-gradient(135deg, rgba(0,230,138,0.14), rgba(0,230,138,0.05))', color: '#fff', fontWeight: 800, fontSize: 13, minHeight: 46 }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 28, height: 28, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,230,138,0.18)', color: '#00e68a', fontSize: 14 }}>💪</span>
                      {muscleLabel(g.muscle)}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600 }}>
                      <span style={{ padding: '2px 8px', borderRadius: 12, background: gFilled === g.items.length ? 'rgba(34,197,94,0.2)' : gFilled > 0 ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.08)', color: gFilled === g.items.length ? '#4ade80' : gFilled > 0 ? '#fbbf24' : 'rgba(255,255,255,0.6)' }}>{gFilled}/{g.items.length}</span>
                      <span style={{ color: 'rgba(255,255,255,0.6)' }}>{collapsed ? '▸ показать' : '▾ скрыть'}</span>
                    </span>
                  </button>
                  {!collapsed && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 8 }}>
                      {g.items.map((e, i) => (
                        <div key={e.id || e.name} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8, boxSizing: 'border-box' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</div>
                            <div style={{ fontSize: 10, color: '#fff', opacity: 0.55 }}>
                              {e.role === 'primary' ? 'Основное' : 'Добивка'} · план {e.referenceWeight} кг
                              {e.actualWeight != null && e.actualWeight > 0 ? ` · введено ${e.actualWeight} кг` : ''}
                            </div>
                          </div>
                          <label style={{ fontSize: 10, color: '#fff', opacity: 0.6, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            Вес (кг)
                            <input
                              type="number" inputMode="decimal" min={0} step={0.5}
                              value={e.actualWeight ?? ''}
                              placeholder={String(e.referenceWeight)}
                              onChange={ev => setEntry(i, ev.target.value === '' ? null : Number(ev.target.value))}
                              style={{ width: 84, textAlign: 'center', flexShrink: 0, background: e.actualWeight != null && e.actualWeight > 0 ? 'rgba(0,230,138,0.12)' : '#18181b', color: '#fff', border: e.actualWeight != null && e.actualWeight > 0 ? '1px solid rgba(0,230,138,0.4)' : '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '6px 8px', fontSize: 12 }}
                            />
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button style={{ ...BTN, flex: 1 }} onClick={onGoQuality}>Далее: отчёт качества →</button>
        <button style={BTN_GHOST} onClick={onBack}>← Назад</button>
      </div>
    </div>
  );
};
