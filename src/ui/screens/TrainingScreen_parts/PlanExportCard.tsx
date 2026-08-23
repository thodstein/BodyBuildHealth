/**
 * PlanExportCard.tsx — Экспорт плана: текст + PDF + качество.
 *
 * Компонент принимает план (ManualResult или BBPlan) + профиль,
 * генерирует форматированный текст для тренера/врача,
 * показывает оценку качества и позволяет скопировать/распечатать.
 */
import React, { useMemo, useState } from 'react';
import {
  validatePlanQuality,
  manualToQualityInput,
  bbPlanToQualityInput,
  type PlanQualityResult,
  type PlanQualityInput,
} from '../../../engines/plan-quality.engine';
import type { ManualResult, ManualDay } from './program-types';
import { GROUP_RU, LEVELS, GOALS } from './program-types';

const ACCENT = '#00e68a';
const DIM = 'rgba(255,255,255,0.85)';
const CARD: React.CSSProperties = {
  background: 'rgba(24,24,27,0.5)',
  borderRadius: 12,
  padding: 12,
  border: '1px solid rgba(255,255,255,0.05)',
};
const BTN: React.CSSProperties = {
  padding: '10px 14px',
  background: 'linear-gradient(135deg,#00e68a,#00c853)',
  color: '#000',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  fontWeight: 800,
  fontSize: 12,
  minHeight: 40,
};
const BTN_GHOST: React.CSSProperties = {
  ...BTN,
  background: 'transparent',
  color: ACCENT,
  border: '1px solid rgba(0,230,138,0.2)',
};

interface ProfileSummary {
  name?: string;
  level?: string;
  goal?: string;
  daysPerWeek?: number;
  bodyWeight?: number;
  pmSquat?: number;
  pmBench?: number;
  pmDead?: number;
  weakPoints?: string[];
  onCourse?: boolean;
  injuries?: { muscle: string }[];
}

interface PlanExportCardProps {
  /** Ручной план */
  manualResult?: ManualResult | null;
  /** BB план (weeks structure) */
  bbPlan?: { weeks: { sessions: { exercises: { muscle: string; sets: number; name: string }[] }[] }[] } | null;
  /** Профиль тренированности */
  profile?: ProfileSummary;
  /** Уровень */
  level?: string;
  /** Слабые группы */
  weakPoints?: string[];
  /** Есть делод */
  hasDeload?: boolean;
  /** Доп. метаданные */
  meta?: { splitName?: string; corrections?: string[]; weeks?: number };
}

function generateExportText(
  result: PlanQualityResult,
  profile: ProfileSummary | undefined,
  manualResult: ManualResult | null | undefined,
  bbPlan: { weeks: { sessions: { exercises: { muscle: string; sets: number; name: string }[] }[] }[] } | null | undefined,
  meta?: { splitName?: string; corrections?: string[]; weeks?: number },
): string {
  const lines: string[] = [];
  const now = new Date();
  lines.push('═══════════════════════════════════════════');
  lines.push('  ТРЕНИРОВОЧНЫЙ ПЛАН — ПРОФ-ЭКСПОРТ');
  lines.push(`  Дата: ${now.toLocaleDateString('ru-RU')}`);
  lines.push('═══════════════════════════════════════════');
  lines.push('');

  // Профиль
  if (profile) {
    lines.push('── ПРОФИЛЬ ──');
    if (profile.name) lines.push(`Имя: ${profile.name}`);
    const levelLabel = LEVELS.find(l => l.value === profile.level)?.label || profile.level || '—';
    const goalLabel = GOALS.find(g => g.value === profile.goal)?.label || profile.goal || '—';
    lines.push(`Уровень: ${levelLabel}`);
    lines.push(`Цель: ${goalLabel}`);
    if (profile.daysPerWeek) lines.push(`Дней/нед: ${profile.daysPerWeek}`);
    if (profile.bodyWeight) lines.push(`Вес тела: ${profile.bodyWeight} кг`);
    if (profile.pmSquat || profile.pmBench || profile.pmDead) {
      lines.push(`ПМ: присед ${profile.pmSquat || '—'} / жим ${profile.pmBench || '—'} / тяга ${profile.pmDead || '—'} кг`);
    }
    if (profile.weakPoints && profile.weakPoints.length > 0) {
      lines.push(`Слабые группы: ${profile.weakPoints.map(g => GROUP_RU[g] || g).join(', ')}`);
    }
    if (profile.onCourse) lines.push('PED-курс: да');
    lines.push('');
  }

  // План
  const planName = meta?.splitName || (manualResult?.splitName) || 'Тренировочный план';
  lines.push(`── ПЛАН: ${planName} ──`);
  if (meta?.weeks) lines.push(`Длительность: ${meta.weeks} нед`);
  lines.push('');

  if (manualResult) {
    for (let di = 0; di < manualResult.days.length; di++) {
      const day = manualResult.days[di];
      const dayLabel = day.groups.map(g => GROUP_RU[g] || g).join(' + ');
      lines.push(`  День ${di + 1}: ${dayLabel}`);
      for (const ex of day.exercises) {
        const name = ex.name;
        const sets = ex.sets;
        const reps = ex.reps;
        const rir = ex.rir;
        const weight = ex.weight || 0;
        const rest = ex.rest || 90;
        const wStr = weight > 0 ? ` @ ${weight} кг` : '';
        lines.push(`    ${name}: ${sets}×${reps} RIR${rir}${wStr} (отдых ${rest}с)`);
      }
      lines.push('');
    }
  } else if (bbPlan) {
    const week1 = bbPlan.weeks[0];
    if (week1) {
      for (let si = 0; si < week1.sessions.length; si++) {
        const sess = week1.sessions[si];
        const tag = (sess as any).sessionTag || '';
        lines.push(`  Сессия ${si + 1} (${tag}):`);
        for (const ex of sess.exercises) {
          const ws = (ex as any).workSets;
          const weight = ws && ws.length > 0 ? ws[0].weight : 0;
          const reps = ws && ws.length > 0 ? ws[0].reps : 10;
          const rir = (ex as any).rir ?? 2;
          const wStr = weight > 0 ? ` @ ${weight} кг` : '';
          lines.push(`    ${ex.name}: ${ex.sets}×${reps} RIR${rir}${wStr}`);
        }
        lines.push('');
      }
    }
  }

  // Качество
  lines.push('── ОЦЕНКА КАЧЕСТВА ──');
  lines.push(`Балл: ${result.score}/100 ${result.grade}`);
  lines.push('');
  lines.push('Сеты по группам:');
  for (const m of result.muscles.sort((a, b) => b.weeklySets - a.weeklySets)) {
    const statusIcon = m.status === 'exceeding_mrv' ? '🔴' : m.status === 'approaching_mrv' ? '🟡' : m.status === 'below_mev' ? '⚠' : '🟢';
    const weakMark = m.weakPoint ? ' ★' : '';
    lines.push(`  ${statusIcon} ${GROUP_RU[m.muscle] || m.muscle}: ${m.weeklySets} сетов/нед (${m.pctOfMav}% MAV)${weakMark}`);
  }
  lines.push('');
  lines.push(`Толкай/Тянай: ${result.metadata.pushPullRatio}`);
  lines.push(`Разгрузка: ${result.metadata.hasDeload ? 'включена' : 'отсутствует'}`);
  lines.push(`Покрытие слабых групп: ${result.metadata.weakPointCoverage}%`);

  // Проблемы
  const criticals = result.issues.filter(i => i.severity === 'critical');
  const warnings = result.issues.filter(i => i.severity === 'warning');
  if (criticals.length > 0 || warnings.length > 0) {
    lines.push('');
    lines.push('── ПРОБЛЕМЫ ──');
    for (const iss of criticals) lines.push(`  🔴 ${iss.message}`);
    for (const iss of warnings) lines.push(`  🟡 ${iss.message}`);
  }

  // Рекомендации
  if (result.recommendations.length > 0) {
    lines.push('');
    lines.push('── РЕКОМЕНДАЦИИ ──');
    for (const r of result.recommendations) lines.push(`  • ${r}`);
  }

  // Правки конструктора
  if (meta?.corrections && meta.corrections.length > 0) {
    lines.push('');
    lines.push('── КОММЕНТАРИИ КОНСТРУКТОРА ──');
    for (const c of meta.corrections) lines.push(`  ${c}`);
  }

  lines.push('');
  lines.push('═══════════════════════════════════════════');
  lines.push('  Сгенерировано: Health Engine');
  lines.push('═══════════════════════════════════════════');

  return lines.join('\n');
}

export const PlanExportCard: React.FC<PlanExportCardProps> = ({
  manualResult, bbPlan, profile, level = 'intermediate', weakPoints = [], hasDeload = false, meta,
}) => {
  const [copied, setCopied] = useState(false);

  const qualityResult = useMemo((): PlanQualityResult => {
    if (manualResult) {
      const input = manualToQualityInput(manualResult.days, {
        level,
        weakPoints,
        hasDeload,
        mesoLength: meta?.weeks || 8,
        injuries: profile?.injuries as any,
      });
      return validatePlanQuality(input);
    }
    if (bbPlan) {
      const input = bbPlanToQualityInput(bbPlan, {
        level,
        weakPoints,
        hasDeload,
        onCourse: profile?.onCourse,
      });
      return validatePlanQuality(input);
    }
    return {
      score: 0, grade: '—', issues: [], muscles: [],
      summary: ['Нет плана для оценки'], recommendations: [],
      metadata: { totalExercises: 0, totalSets: 0, totalVolume: 0, avgSetsPerDay: 0, pushPullRatio: '0:0', hasDeload: false, weakPointCoverage: 0 },
    };
  }, [manualResult, bbPlan, level, weakPoints, hasDeload, profile?.onCourse, profile?.injuries, meta?.weeks]);

  const exportText = useMemo(
    () => generateExportText(qualityResult, profile, manualResult, bbPlan, meta),
    [qualityResult, profile, manualResult, bbPlan, meta],
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(exportText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Fallback for non-HTTPS
      const ta = document.createElement('textarea');
      ta.value = exportText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    const html = exportText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/═/g, '━')
      .replace(/\n/g, '<br>');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Тренировочный план</title>
      <style>body{font-family:'SF Pro Display',-apple-system,sans-serif;background:#0a0a0a;color:#e5e5e5;padding:24px;font-size:13px;line-height:1.6;}
      @media print{body{background:#fff;color:#000;padding:12px;font-size:11px;}}</style></head>
      <body><pre style="white-space:pre-wrap;font-family:inherit;">${html}</pre>
      <script>setTimeout(()=>{window.print();},300);</script></body></html>`);
    win.document.close();
  };

  const scoreColor = qualityResult.score >= 85 ? '#22c55e' : qualityResult.score >= 65 ? '#eab308' : qualityResult.score >= 45 ? '#f97316' : '#ef4444';
  const criticals = qualityResult.issues.filter(i => i.severity === 'critical');
  const warnings = qualityResult.issues.filter(i => i.severity === 'warning');

  return (
    <div style={CARD}>
      <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT, marginBottom: 8 }}>
        📤 Экспорт плана и оценка качества
      </div>

      {/* Quality score gauge */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        borderRadius: 10,
        padding: 12,
        marginBottom: 10,
        border: `1px solid ${scoreColor}30`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: scoreColor }}>
            {qualityResult.score}/100
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: scoreColor }}>
            {qualityResult.grade}
          </span>
        </div>
        {/* Progress bar */}
        <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${qualityResult.score}%`,
            borderRadius: 3,
            background: `linear-gradient(90deg, ${scoreColor}, ${scoreColor}99)`,
            transition: 'width 0.5s ease',
          }} />
        </div>

        {/* Quick stats */}
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, color: DIM, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.04)' }}>
            {qualityResult.metadata.totalSets} сетов/нед
          </span>
          <span style={{ fontSize: 10, color: DIM, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.04)' }}>
            Т/Т: {qualityResult.metadata.pushPullRatio}
          </span>
          <span style={{
            fontSize: 10, padding: '2px 6px', borderRadius: 4,
            background: qualityResult.metadata.hasDeload ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            color: qualityResult.metadata.hasDeload ? '#22c55e' : '#ef4444',
          }}>
            {qualityResult.metadata.hasDeload ? '✓ Разгрузка' : '✕ Нет разгрузки'}
          </span>
          <span style={{
            fontSize: 10, padding: '2px 6px', borderRadius: 4,
            background: qualityResult.metadata.weakPointCoverage >= 80 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            color: qualityResult.metadata.weakPointCoverage >= 80 ? '#22c55e' : '#ef4444',
          }}>
            Слабые: {qualityResult.metadata.weakPointCoverage}%
          </span>
        </div>
      </div>

      {/* Issues summary */}
      {(criticals.length > 0 || warnings.length > 0) && (
        <div style={{ marginBottom: 10, padding: 8, borderRadius: 8, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
          {criticals.length > 0 && (
            <div style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', marginBottom: 4 }}>
              🔴 {criticals.length} критических:
              {criticals.slice(0, 3).map((c, i) => <div key={i} style={{ fontSize: 10, fontWeight: 400, color: 'rgba(255,255,255,0.6)', marginLeft: 12 }}>{c.message}</div>)}
            </div>
          )}
          {warnings.length > 0 && (
            <div style={{ fontSize: 10, fontWeight: 700, color: '#eab308' }}>
              🟡 {warnings.length} предупреждений
            </div>
          )}
        </div>
      )}

      {/* Per-muscle bars */}
      <div style={{ marginBottom: 10 }}>
        {qualityResult.muscles
          .sort((a, b) => b.weeklySets - a.weeklySets)
          .slice(0, 10)
          .map(m => {
            const barPct = Math.min(100, m.pctOfMav);
            const barColor = m.status === 'exceeding_mrv' ? '#ef4444'
              : m.status === 'approaching_mrv' ? '#eab308'
              : m.status === 'below_mev' ? '#f97316'
              : '#22c55e';
            return (
              <div key={m.muscle} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <span style={{ fontSize: 10, color: DIM, width: 70, textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {GROUP_RU[m.muscle] || m.muscle}{m.weakPoint ? ' ★' : ''}
                </span>
                <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
                  <div style={{ height: '100%', width: `${barPct}%`, borderRadius: 2, background: barColor, transition: 'width 0.3s' }} />
                </div>
                <span style={{ fontSize: 10, color: barColor, width: 40, textAlign: 'right' }}>
                  {m.weeklySets}с
                </span>
              </div>
            );
          })}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={{ ...BTN, flex: 1 }} onClick={handleCopy}>
          {copied ? '✓ Скопировано!' : '📋 Копировать план'}
        </button>
        <button style={BTN_GHOST} onClick={handlePrint}>
          🖨 PDF
        </button>
      </div>
    </div>
  );
};
