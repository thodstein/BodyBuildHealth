/**
 * annual-training-print.ts — HTML-сводка годового плана (печать в PDF).
 *
 * Показывает разметку блоков (недели/фаза/конструктор/цикл/сплит/статус),
 * taper/пик-бейджи, предупреждения сборки и валидации, а также мини-превью
 * первой недели каждого собранного блока (для инспекции до печати).
 * Пользовательские строки XSS-экранируются.
 */
import type { AnnualTrainingPlan, AnnualBlockState } from './annual-training.types';
import { validateAnnualPlan } from './block-builders.engine';
import { PHASE_LABEL_RU, BB_PHASE_LABEL_RU } from '../lms/macrocycle.engine';
import { getCycleById } from '../../data/lms-cycles/lms-cycle-index';

const escapeHtml = (s: unknown): string => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const STATUS_LABEL: Record<AnnualBlockState['status'], string> = {
  unbuilt: 'не собран',
  built: 'собран',
  stale: 'устарел',
  error: 'ошибка',
};

const STATUS_COLOR: Record<AnnualBlockState['status'], string> = {
  unbuilt: '#94a3b8',
  built: '#16a34a',
  stale: '#d97706',
  error: '#dc2626',
};

const KIND_LABEL: Record<AnnualBlockState['ref']['kind'], string> = {
  PL: 'ПЛ (СРЦ-цикл)',
  BB: 'ББ (ББ-авто)',
  MANUAL: 'ручной',
};

function phaseLabel(phase: string): string {
  return PHASE_LABEL_RU[phase as keyof typeof PHASE_LABEL_RU]
    ?? BB_PHASE_LABEL_RU[phase as keyof typeof BB_PHASE_LABEL_RU]
    ?? phase;
}

function blockConfigSummary(block: AnnualBlockState): string {
  const parts: string[] = [];
  if (block.ref.kind === 'PL' && block.config.cycleId) {
    parts.push(`цикл «${getCycleById(block.config.cycleId)?.meta.title ?? block.config.cycleId}»`);
  } else if (block.ref.kind === 'BB') {
    if (block.config.splitPattern) parts.push(`сплит ${block.config.splitPattern}`);
    if (block.config.goal) parts.push(`цель ${block.config.goal}`);
    if (block.config.daysPerWeek) parts.push(`${block.config.daysPerWeek} дн/нед`);
    if (block.config.peakWeek) parts.push('🎭 пик-неделя');
  } else if (block.ref.kind === 'MANUAL' && block.config.templateFromBlockKey) {
    parts.push('шаблон из другого блока');
  }
  if (block.config.taper?.enabled) parts.push(`📉 taper ${block.config.taper.weeks ?? 2} нед`);
  return parts.join(' · ');
}

function blockTable(plan: AnnualTrainingPlan): string {
  const rows = plan.blocks.map(b => {
    const color = STATUS_COLOR[b.status];
    const badges = [
      `<span style="color:${color};font-weight:700">${STATUS_LABEL[b.status]}</span>`,
      `<span style="color:#7c3aed;font-weight:600">${KIND_LABEL[b.ref.kind]}</span>`,
      blockConfigSummary(b),
      b.result?.taperApplied ? '<span style="color:#d97706">📉 taper применён</span>' : '',
      b.result?.peakApplied ? '<span style="color:#d97706">🎭 пик применён</span>' : '',
      b.result?.warnings?.length ? `<span style="color:#d97706">⚠ ${escapeHtml(b.result.warnings[0])}</span>` : '',
      b.status === 'error' && b.error ? `<span style="color:#dc2626">✖ ${escapeHtml(b.error)}</span>` : '',
    ].filter(Boolean).join(' · ');
    return `<tr>
      <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;white-space:nowrap">${b.ref.startWeek}–${b.ref.startWeek + b.ref.weeks - 1}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0">${escapeHtml(phaseLabel(b.ref.phase))}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0">${escapeHtml(b.ref.description ?? '')}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0">${badges}</td>
    </tr>`;
  }).join('\n');
  return `<table style="width:100%;border-collapse:collapse;font-size:12px">
    <thead><tr style="text-align:left;color:#64748b;font-size:11px;text-transform:uppercase">
      <th style="padding:6px 8px">Недели</th><th style="padding:6px 8px">Фаза</th><th style="padding:6px 8px">Описание</th><th style="padding:6px 8px">Конструктор / статус / настройки</th>
    </tr></thead><tbody>${rows}</tbody></table>`;
}

function weekPreview(block: AnnualBlockState): string {
  const w = block.result?.weeks?.[0];
  if (!w || w.sessions.length === 0) return '';
  const sessions = w.sessions.slice(0, 3).map(s => {
    const ex = (s.blocks ?? []).slice(0, 6).map(b => {
      const sets = Array.isArray(b.sets) && b.sets.length > 0
        ? `${b.sets.length}×${b.sets[0].reps} (RIR ${b.sets[0].rir ?? '-'})`
        : '—';
      return `<li>${escapeHtml(b.exerciseName)} — ${sets}</li>`;
    }).join('');
    return `<div style="margin:4px 0"><b>${escapeHtml(s.name)}</b> (${escapeHtml(s.focus || '')})<ul style="margin:2px 0 2px 18px">${ex}</ul></div>`;
  }).join('');
  return `<details style="margin:4px 0"><summary style="cursor:pointer;color:#0f766e;font-weight:600">Неделя ${w.week}: превью сессий</summary>${sessions}</details>`;
}

/** Полная HTML-сводка годового плана для печати (window.print). */
export function buildAnnualPrintHtml(plan: AnnualTrainingPlan, title?: string): string {
  const v = validateAnnualPlan(plan);
  const built = plan.blocks.filter(b => b.status === 'built').length;
  const stale = plan.blocks.filter(b => b.status === 'stale').length;
  const errors = plan.blocks.filter(b => b.status === 'error').length;
  const summary = [
    `Блоков: ${plan.blocks.length}`,
    `✅ собранных: ${built}`,
    stale ? `⚠ устарело: ${stale}` : '',
    errors ? `❌ ошибок: ${errors}` : '',
    `статус: ${plan.status}`,
  ].filter(Boolean).join(' · ');
  const validation = v.warnings.length > 0
    ? `<div style="padding:8px 12px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;color:#b91c1c;font-size:12px;margin:8px 0">⚠ Разметка года: ${escapeHtml(v.warnings.join('; '))}</div>`
    : '';
  const blocks = plan.blocks.map(b => {
    const preview = b.status === 'built' ? weekPreview(b) : '';
    return `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;margin:8px 0">
      ${blockTable({ ...plan, blocks: [b] }).replace('<thead>', '<thead style="display:none">')}
      ${preview}
    </div>`;
  }).join('');
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8">
    <title>${escapeHtml(title ?? 'Годовой план по конструкторам')}</title>
    <style>body{font-family:-apple-system,'Segoe UI',Roboto,sans-serif;padding:24px;color:#0f172a;max-width:900px;margin:0 auto}
      h1{font-size:20px;margin:0 0 4px}h2{font-size:13px;color:#475569;font-weight:600;margin:14px 0 4px}
      .muted{color:#64748b;font-size:12px}code{background:#f1f5f9;padding:1px 4px;border-radius:4px}
    </style></head><body>
    <h1>🗓 ${escapeHtml(title ?? 'Годовой план по конструкторам')}</h1>
    <div class="muted">${plan.totalWeeks} нед · ${escapeHtml(plan.direction)} · ${escapeHtml(summary)}</div>
    ${validation}
    <h2>Блоки года</h2>
    ${blocks}
    <h2>Сводка</h2>
    <div class="muted">Недели покрываются блоками ${v.totalMismatch ? 'НЕ полностью' : 'полностью'} · собранные блоки не пересобираются без изменений; правка макро помечает блок «устарел».</div>
    </body></html>`;
}
