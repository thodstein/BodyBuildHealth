/**
 * BBRecommendationsTab.tsx — подвкладка «💡 Рекомендации (ББ)» дневника
 * тренировок. Только бодибилдинг (ПЛ-рекомендации — отдельный блок).
 *
 * Связывает блоки: BB-план/цикл (he_bb_plan_saved / he_bb_plans /
 * he_bb_session), PED (дозы/интенсивность из параметров плана), питание
 * (профиль + nutrition_diary_v2 за 7 дней), план добавок (поддержка:
 * he_support_plan_result / he_support_risk), дневник тренировок (частота,
 * RIR, прогрессия), готовность (he_readiness_history), ACWR (sRPE), сон.
 */
import React, { useMemo } from 'react';
import { generateBBRecommendations, bbRecSummary, type BBRecSection } from '../../../engines/bb/bb-training-recommendations.engine';
import { loadSRPESessions } from '../../../engines/pro/srpe-store';
import { acuteChronicRatio, toDailyLoads } from '../../../engines/pro/training-load.engine';
import { loadReadinessHistory } from './readiness-history';
import type { DiaryHubCtx } from './diary-hub-context';

const ACCENT = '#00e68a';
const SEV: Record<string, { color: string; bg: string; border: string; icon: string }> = {
  info: { color: '#60a5fa', bg: 'rgba(59,130,246,0.06)', border: 'rgba(59,130,246,0.2)', icon: 'ℹ️' },
  warn: { color: '#f59e0b', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.25)', icon: '⚠️' },
  critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.07)', border: 'rgba(239,68,68,0.3)', icon: '🔴' },
};

/** Загрузка текущего BB-плана: сохранённый последний → вариант → сессия. */
function loadCurrentBBPlan(): { plan: any; params: any } | null {
  try {
    const saved = JSON.parse(localStorage.getItem('he_bb_plan_saved') || 'null');
    if (saved?.plan) return { plan: saved.plan, params: saved.params };
  } catch {}
  try {
    const plans = JSON.parse(localStorage.getItem('he_bb_plans') || '[]');
    if (Array.isArray(plans) && plans[0]?.plan) return { plan: plans[0].plan, params: plans[0].params };
  } catch {}
  try {
    const sess = JSON.parse(localStorage.getItem('he_bb_session') || 'null');
    if (sess?.builtBb) {
      return {
        plan: sess.builtBb,
        params: { level: sess.bbLevel, goal: sess.bbGoal, weeks: sess.bbWeeks, peds: sess.peds, trainingFocus: sess.bbTrainingFocus },
      };
    }
  } catch {}
  return null;
}

/** Активные добавки плана поддержки (id + имена). */
function loadSupportSubs(): string[] {
  const names: string[] = [];
  try {
    const result = JSON.parse(localStorage.getItem('he_support_plan_result') || 'null');
    if (result?.substances && Array.isArray(result.substances)) {
      for (const s of result.substances) if (s?.name) names.push(String(s.name));
    }
  } catch {}
  try {
    const risk = JSON.parse(localStorage.getItem('he_support_risk') || 'null');
    if (risk?.subs && Array.isArray(risk.subs)) names.push(...risk.subs.map((x: any) => String(x)));
  } catch {}
  return names;
}

/** Среднедневное питание за последние 7 дней из nutrition_diary_v2. */
function loadNutritionAvg(): { avgKcal: number; avgProtein: number; avgCarbs: number; days: number } {
  const result = { avgKcal: 0, avgProtein: 0, avgCarbs: 0, days: 0 };
  try {
    const raw = localStorage.getItem('nutrition_diary_v2');
    if (!raw) return result;
    const diary = JSON.parse(raw);
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
    const cutoffKey = cutoff.toISOString().slice(0, 10);
    const dayKeys = Object.keys(diary || {}).filter(k => k >= cutoffKey).slice(0, 7);
    for (const k of dayKeys) {
      const meals = diary[k]?.meals || {};
      const items = Object.values(meals).flatMap((arr: any) => Array.isArray(arr) ? arr : []);
      if (!items.length) continue;
      result.days += 1;
      for (const it of items) {
        result.avgKcal += Number(it.calories) || 0;
        result.avgProtein += Number(it.protein) || 0;
        result.avgCarbs += Number(it.carbs) || 0;
      }
    }
    if (result.days > 0) {
      result.avgKcal = Math.round(result.avgKcal / result.days);
      result.avgProtein = Math.round(result.avgProtein / result.days);
      result.avgCarbs = Math.round(result.avgCarbs / result.days);
    }
  } catch {}
  return result;
}

/** Профиль из UnifiedSettings (вес/белок). */
function loadProfile(): { weightKg?: number; proteinPerKg?: number } {
  try {
    const p = JSON.parse(localStorage.getItem('he_profile_v2') || 'null');
    const settings = p?.settings;
    return {
      weightKg: settings?.personal?.weight,
      proteinPerKg: settings?.nutrition?.proteinPerKg,
    };
  } catch { return {}; }
}

function loadSleep(): number | null {
  try {
    const entries: Array<{ date: string; hours?: number }> = JSON.parse(localStorage.getItem('he_sleep_diary') || '[]');
    if (!entries.length) return null;
    const last = [...entries].sort((a, b) => b.date.localeCompare(a.date))[0];
    return typeof last?.hours === 'number' ? last.hours : null;
  } catch { return null; }
}

export const BBRecommendationsTab: React.FC<{ hub: DiaryHubCtx }> = ({ hub }) => {
  const sections: BBRecSection[] = useMemo(() => {
    const current = loadCurrentBBPlan();
    const profile = loadProfile();
    const nutrition = loadNutritionAvg();
    const supportSubs = loadSupportSubs();
    const readinessHistory = loadReadinessHistory();
    const acwr = (() => { try { const s = loadSRPESessions(); return s.length >= 2 ? acuteChronicRatio(toDailyLoads(s)).ratio : undefined; } catch { return undefined; } })();
    const readiness = readinessHistory.length
      ? { lastRecovery: readinessHistory[readinessHistory.length - 1].recovery, lowDays: readinessHistory.slice(-3).filter(r => r.recovery < 60).length }
      : undefined;
    return generateBBRecommendations({
      plan: current?.plan,
      params: current?.params || undefined,
      historyWorkouts: hub.historyWorkouts,
      profile,
      nutrition,
      supportSubs,
      readiness,
      acwr,
      lastSleepHours: loadSleep(),
    });
  }, [hub.historyWorkouts]);

  const summary = bbRecSummary(sections);
  const hasAlerts = summary.warns + summary.criticals > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button onClick={() => hub.setMode('record')} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.7)' }}>← В запись</button>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Вернуться к записи тренировки</span>
      </div>
      <div style={{ padding: 12, borderRadius: 12, background: 'rgba(0,230,138,0.05)', border: '1px solid ' + (hasAlerts ? 'rgba(245,158,11,0.3)' : 'rgba(0,230,138,0.2)') }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: hasAlerts ? '#f59e0b' : ACCENT }}>💡 Рекомендации по тренировкам · ББ</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>
              Учитывают: план/цикл, фарму, питание, добавки, дневник · {summary.total} рекомендаций{summary.warns > 0 ? `, ⚠ ${summary.warns}` : ''}{summary.criticals > 0 ? `, 🔴 ${summary.criticals}` : ''}
            </div>
          </div>
          <span style={{ fontSize: 9, padding: '3px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>ПЛ — отдельно</span>
        </div>
      </div>

      {sections.map(sec => {
        if (!sec.items.length) return null;
        return (
          <div key={sec.id} style={{ padding: 12, borderRadius: 12, background: 'rgba(24,24,27,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#fff', marginBottom: 8 }}>{sec.icon} {sec.title}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sec.items.map(item => {
                const s = SEV[item.severity];
                return (
                  <div key={item.id} style={{ padding: '8px 10px', borderRadius: 8, background: s.bg, border: '1px solid ' + s.border, fontSize: 11, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>
                    <span style={{ fontWeight: 700, color: s.color }}>{s.icon} </span>{item.text}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default BBRecommendationsTab;

