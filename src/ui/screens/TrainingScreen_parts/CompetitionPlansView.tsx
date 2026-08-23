/**
 * CompetitionPlansView.tsx — подвкладка «🏁 Соревнования» дневника тренировок.
 * Показывает сохранённые соревновательные циклы (план с тапером, сохранённый
 * из ПЛ-авто): состав недель (оригинал → mock meet → тапер → соревнования),
 * прикиды дня старта, стратегию. Подходы из карточек прикидов.
 */
import React, { useMemo, useState } from 'react';
import { MEET_STRATEGY_PCT_LABEL, MEET_STRATEGY_LABEL } from '../../../engines/lms/competition-attempts';
import { coachPLPeakPlan } from '../../../engines/lms/lms-taper-coach.engine';
import type { LMSBuildOutput } from '../../../engines/lms/lms-builder.engine';
import { diaryCard, diaryLabel, ACCENT, DIM } from './diary-tokens';

export interface CompetitionPlanRecord {
  id: string;
  savedAt: string;          // ISO дата сохранения
  cycleTitle: string;
  cycleId?: string;
  strategy: string;         // conservative | balanced | aggressive
  weekCount: number;
  taperWeeks: number;
  mockMeet: boolean;
  meetНеделя: boolean;
  weights: { squat: number; bench: number; deadlift: number };
  meetAttempts?: { name: string; opener: number; second: number; third: number }[];
  plan: LMSBuildOutput;     // полный снимок плана с тапером
}

const STORAGE_KEY = 'he_competition_plans';
export const COMPETITION_PLANS_CAP = 5;

export function loadCompetitionPlans(): CompetitionPlanRecord[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter(r => r && typeof r === 'object' && r.id && r.savedAt);
  } catch { return []; }
}

export function saveCompetitionPlan(record: CompetitionPlanRecord): { ok: boolean; error?: string } {
  try {
    const plans = loadCompetitionPlans();
    plans.unshift(record);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plans.slice(0, COMPETITION_PLANS_CAP)));
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Ошибка сохранения' };
  }
}

export function removeCompetitionPlan(id: string): void {
  try {
    const plans = loadCompetitionPlans().filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
  } catch { /* ignore */ }
}

/** Состав недель сохранённого плана: подписи + цвета (как в ПЛ-авто). */
function weekKind(w: LMSBuildOutput['weeks'][number]): { label: string; color: string } {
  if (w.meetWeek) return { label: `🏁 Соревнования (${MEET_STRATEGY_PCT_LABEL[w.meetAttempts?.strategy ?? 'balanced'] ?? MEET_STRATEGY_PCT_LABEL.balanced})`, color: '#eab308' };
  if (w.mockMeet) return { label: '🎯 Mock meet (прикиды-синглы)', color: '#a78bfa' };
  if (w.postMeet) return { label: '🔄 Пост-старт (восстановление)', color: '#34d399' };
  if (w.taperWeek) return { label: `📉 Тапер (${Math.round(w.days.reduce((s, d) => s + d.exercises.reduce((ss, e) => ss + e.workSets.reduce((n, ws) => n + ws.sets, 0), 0), 0) / Math.max(1, w.days.length))} сетов/день)`, color: '#f59e0b' };
  return { label: '🔵 Цикл (оригинал)', color: '#60a5fa' };
}

export const CompetitionPlansView: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const [plans, setPlans] = useState<CompetitionPlanRecord[]>(() => loadCompetitionPlans());
  const [expanded, setExpanded] = useState<string | null>(null);

  const refresh = () => setPlans(loadCompetitionPlans());

  const groups = useMemo(() => plans.length > 0 ? plans[0].meetAttempts?.length ?? 0 : 0, [plans]);

  if (plans.length === 0) {
    return (
      <div style={{ ...diaryCard, border: '1px solid rgba(234,179,8,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ ...diaryLabel, color: '#eab308', marginBottom: 0 }}>🏁 Соревнования</div>
          {onBack && <button onClick={onBack} style={{ fontSize: 10, color: DIM, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}>← В запись</button>}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
          Пока нет сохранённых соревновательных циклов.
          <br />В ПЛ-авто → «Соревнование + тапер» → добавьте тапер к плану, затем нажмите «🏆 Сохранить как соревновательный» — цикл с неделей соревнований и прикидами появится здесь.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ ...diaryCard, border: '1px solid rgba(234,179,8,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ ...diaryLabel, color: '#eab308', marginBottom: 0 }}>🏁 Соревновательные циклы ({plans.length})</div>
          {onBack && <button onClick={onBack} style={{ fontSize: 10, color: DIM, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}>← В запись</button>}
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)' }}>Сохранённые планы с тапером: разгрузка выполнена, прикиды готовы к выходу на пик (до {MEET_STRATEGY_PCT_LABEL[plans[0]?.strategy as 'balanced'] ?? '105%'}).</div>
      </div>

      {plans.map(rec => {
        const isOpen = expanded === rec.id;
        const pct = MEET_STRATEGY_PCT_LABEL[rec.strategy as 'balanced'] ?? MEET_STRATEGY_PCT_LABEL.balanced;
        const label = MEET_STRATEGY_LABEL[rec.strategy as 'balanced'] ?? MEET_STRATEGY_LABEL.balanced;
        return (
          <div key={rec.id} style={{ ...diaryCard, border: isOpen ? '1px solid rgba(234,179,8,0.45)' : '1px solid rgba(234,179,8,0.18)' }}>
            {/* Шапка */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#eab308', overflowWrap: 'break-word' }}>🏁 {rec.cycleTitle}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>
                  {new Date(rec.savedAt).toLocaleDateString('ru-RU')} · {rec.weekCount} нед · прикиды {pct} ({label})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                  <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 9, background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>📉 тапер ×{rec.taperWeeks}</span>
                  {rec.mockMeet && <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 9, background: 'rgba(167,139,250,0.12)', color: '#a78bfa' }}>🎯 mock meet</span>}
                  {rec.meetWeek && <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 9, background: 'rgba(234,179,8,0.14)', color: '#eab308' }}>🏁 соревнования</span>}
                  {(() => {
                    try {
                      const verdict = coachPLPeakPlan(rec.plan);
                      const c = verdict.score >= 85 ? '#22c55e' : verdict.score >= 65 ? '#eab308' : verdict.score >= 40 ? '#f97316' : '#ef4444';
                      const top = verdict.notes.find(n => n.severity === 'danger' || n.severity === 'warn')?.text ?? verdict.label;
                      return <span title={`🧠 ${verdict.label}. ${top}`} style={{ padding: '2px 8px', borderRadius: 8, fontSize: 9, fontWeight: 800, background: c + '18', border: `1px solid ${c}44`, color: c }}>🧠 {verdict.score}/100</span>;
                    } catch { return null; }
                  })()}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button onClick={() => setExpanded(isOpen ? null : rec.id)} style={{ fontSize: 10, padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(234,179,8,0.35)', background: 'rgba(234,179,8,0.1)', color: '#eab308', cursor: 'pointer' }}>
                  {isOpen ? 'Свернуть' : 'Прикиды'}
                </button>
                <button onClick={() => { removeCompetitionPlan(rec.id); refresh(); }} title="Удалить сохранённый цикл" style={{ fontSize: 10, padding: '4px 8px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#f87171', cursor: 'pointer' }}>🗑</button>
              </div>
            </div>

            {isOpen && (
              <>
                {/* Прикиды — подходы из карточек */}
                {rec.meetAttempts && rec.meetAttempts.length > 0 && (
                  <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 6 }}>
                    {rec.meetAttempts.map(l => (
                      <div key={l.name} style={{ padding: 6, borderRadius: 8, background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)', fontSize: 10 }}>
                        <b style={{ color: '#eab308' }}>{l.name}</b>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 3, marginTop: 4 }}>
                          <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '3px 1px' }}><div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 9 }}>1-я</div><b>{l.opener}</b></div>
                          <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '3px 1px' }}><div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 9 }}>2-я</div><b>{l.second}</b></div>
                          <div style={{ textAlign: 'center', background: 'rgba(234,179,8,0.14)', borderRadius: 6, padding: '3px 1px', border: '1px solid rgba(234,179,8,0.4)' }}><div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 9 }}>3-я</div><b style={{ color: '#eab308' }}>{l.third}</b></div>
                        </div>
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginTop: 3 }}>×1 сингл · RIR 2/1/0</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Состав недель плана */}
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.85)', marginBottom: 4 }}>Состав мезоцикла</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {rec.plan.weeks.map(w => {
                      const k = weekKind(w);
                      return (
                        <span key={w.week} title={`Нед ${w.week}`} style={{ padding: '3px 8px', borderRadius: 8, fontSize: 9, background: k.color + '1a', border: `1px solid ${k.color}44`, color: k.color }}>
                          Н{w.week} {k.label}
                        </span>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginTop: 4, lineHeight: 1.4 }}>
                    ПМ: присед {rec.weights.squat} · жим {rec.weights.bench} · тяга {rec.weights.deadlift} кг · {rec.plan.weeks.length} нед с тапером.
                  </div>
                </div>
              </>
            )}
          </div>
        );
      })}
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', textAlign: 'center' }}>
        {ACCENT ? 'Максимум ' + COMPETITION_PLANS_CAP + ' сохранённых циклов — новые вытесняют старые.' : ''}
      </div>
    </div>
  );
};

export default CompetitionPlansView;
