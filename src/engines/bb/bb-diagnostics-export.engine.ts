/**
 * bb-diagnostics-export.engine.ts — экспорт ББ-диагностики (HTML/CSV, XSS-safe).
 * Расширен таблицей «Упражнение → эффект (SFR/lengthened/паттерн/темп/техника)» для единого инструмента.
 */
import type { BBDiagnosticsReport } from './bb-diagnostics-hub.engine';
import { auditPlanExercises } from './bb-plan-exercise-audit.engine';
import { calcExerciseEffect, exerciseEffectScore } from './bb-exercise-effect.engine';
import { auditHeadCoverage } from './bb-stimulus-target.engine';

function esc(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export interface BBDiagnosticsPro2Meta {
  lr?: Array<{ group: string; left: number; right: number; asymPct: number | null; weakSide: string | null; verdict: string; topUpSets: number; text: string }>;
  readiness?: { level: string; advice: string; reasons: string[] };
  redFlags?: { active: boolean; blocked: boolean; items: string[]; text: string };
  bar?: { xLoop: number; yMax: number; type: string; text: string } | null;
  pose?: { hip?: number; knee?: number; ankle?: number; shoulder?: number; n: number; faults: string[] } | null;
  teen?: string | null;
  femaleNotes?: string[];
  /** PRO-3: LVP-профиль, сухожилия, MMC, return-to, направление перекоса, рабочие веса (legacy-чтение старых файлов). */
  lvp?: { lift: string; r2: number; e1rm: number | null; text: string; valid?: boolean } | null;
  tendon?: { elbow: string; shoulder: string };
  mmc?: string | null;
  returnTo?: { text: string; stages: Array<{ stage: number; title: string; volume: string; rir: string; note: string; action?: { volumeMult: number; rirShift: number } }> } | null;
  lrDirection?: Array<{ group: string; text: string }>;
  workingRange?: string | null;
  /** Движения v2: драйвер скрининга + односторонний вердикт (хаб шлёт, приёмник/экспорт читают). */
  movementDriver?: { driver: string; label: string; fix: string; confidence: number } | null;
  singleLeg?: { weakSide: 'left' | 'right' | null; text: string } | null;
  /** D1–D5: плечо/шарнир/YBT/асимметрии/замены (всё опционально, без — байт-в-байт). */
  shoulder?: { pass: boolean; locus: string; text: string } | null;
  hinge?: { text: string } | null;
  ybt?: { text: string } | null;
  asymPriority?: string | null;
  driverSubs?: { text: string } | null;
  /** R1–R8 PRO-2: жим/боль-мониторинг/задняя цепь/шарнир под весом/ER:IR/приоритет (опционально). */
  bench?: { level: string; text: string } | null;
  painMon?: string | null;
  posterior?: { nhe?: string | null; adductor?: string | null } | null;
  loadedHinge?: { text: string } | null;
  erir?: { text: string } | null;
  screenPriority?: string[] | null;
  /** PRO-CORR: детали коррекций библиотеки (опционально, без — байт-в-байт).
   *  K7: + реальная доза (weightHint/restSec/reps/rir/phase/level/alt) — опционально, старые потребители не трогаются. */
  correctiveDetail?: Array<{
    id: string; zone: string; exerciseId: string; protocol: string; cues: string[]; source: string;
    weightHint?: number | null; bodyweight?: boolean; restSec?: number; reps?: number; repsMax?: number; rir?: number;
    phase?: string; level?: string; alt?: string[];
  }> | null;
}

export function buildBBDiagnosticsHtml(report: BBDiagnosticsReport, meta?: { date?: string; level?: string; plan?: any; weakHeads?: string[]; weakCauses?: Record<string, { cause: string; confidence: number; evidence: string[]; fix: string }>; specBlock?: { lengthWeeks: number; donors: string[]; rationale: string[]; weeks: Array<{ week: number; targetSets: Record<string, number>; frequency: Record<string, number>; note: string }> } | null } & BBDiagnosticsPro2Meta): string {
  const date = meta?.date || new Date().toISOString().slice(0, 10);
  const level = meta?.level || '';
  const rowsWeak = report.weakCandidates.map(c => `<tr><td>${esc(c.muscle)}</td><td>${esc(c.granular || '')}</td><td>${esc(c.source)}</td><td>${c.deltaPct}%</td><td>${esc(c.reason)}</td></tr>`).join('') || '<tr><td colspan="5">— баланс</td></tr>';
  const rowsSym = Object.entries(report.symmetry.ratios).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v}</td></tr>`).join('') || '<tr><td colspan="2">—</td></tr>';
  const issuesSym = report.symmetry.issues.map(s => `<li>${esc(s)}</li>`).join('') || '<li>—</li>';
  const issuesStim = report.stimulus.issues.map(s => `<li>${esc(s)}</li>`).join('') || '<li>—</li>';
  const findings = report.findings.map(s => `<li>${esc(s)}</li>`).join('');
  const priorities = report.priorities.map(s => `<li>${esc(s)}</li>`).join('');
  const floors = report.score.floors.map(s => `<li>${esc(s)}</li>`).join('');
  // Упражнения → эффект (максимально на каждое)
  let exerciseSection = '';
  try {
    const plan = (meta as any)?.plan;
    if (plan && plan.weeks) {
      const audit = auditPlanExercises(plan as any);
      if (audit && audit.totalExercises > 0) {
        const rowsEx = Object.entries(audit.byMuscle).flatMap(([m, bm]) =>
          bm.exercises.map(eff => {
            const sc = exerciseEffectScore(eff);
            return `<tr><td>${esc(m)}</td><td>${esc(eff.name)}</td><td>${eff.sfr ?? '—'}</td><td>${esc(eff.profile ?? '—')}</td><td>${esc(eff.angleClass ?? '—')}</td><td>${esc(eff.strictGroup?.key ?? '—')}</td><td>${esc(eff.jointStress ?? '—')}</td><td>${eff.unilateral ? '↔' : ''}</td><td>${eff.directSets}</td><td>${sc}</td><td>${esc(eff.note ?? '')}</td></tr>`;
          })
        ).join('');
        const flagsEx = audit.flags.length ? `<div style="font-size:11px;color:#f59e0b">Флаги портфеля: ${esc(audit.flags.join(' · '))}</div>` : '';
        exerciseSection = `<h2>Упражнения → эффект (максимально)</h2><div style="font-size:11px;color:#666">SFR средний ${audit.avgSfr ?? '—'}/5 · lengthened ${(audit.lengthenedRatio * 100).toFixed(0)}% · unilateral ${(audit.unilateralRatio * 100).toFixed(0)}% · усталость ${audit.fatigueDensity.toFixed(2)} · ${audit.totalExercises} упр · ${audit.totalSets} сетов</div>${flagsEx}<table><tr><th>Мышца</th><th>Упражнение</th><th>SFR</th><th>Профиль</th><th>Угол</th><th>Строгая</th><th>Сустав</th><th>Uni</th><th>Сеты</th><th>Score</th><th>Прим.</th></tr>${rowsEx || '<tr><td colspan="11">— нет упражнений</td></tr>'}</table>`;
      }
    }
  } catch {}
  // fallback если план не передан — пробуем localStorage (как раньше hub делал)
  if (!exerciseSection) {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('he_bb_plan_saved') : null;
      if (raw) {
        const j = JSON.parse(raw);
        const plan = j?.plan?.weeks ? j.plan : j?.weeks ? j : null;
        if (plan) {
          const audit = auditPlanExercises(plan as any);
          if (audit && audit.totalExercises > 0) {
            const rowsEx2 = Object.entries(audit.byMuscle).flatMap(([m, bm]) => bm.exercises.map(eff => `<tr><td>${esc(m)}</td><td>${esc(eff.name)}</td><td>${eff.sfr ?? '—'}</td><td>${esc(eff.profile ?? '—')}</td><td>${esc(eff.angleClass ?? '—')}</td><td>${esc(eff.jointStress ?? '—')}</td><td>${eff.directSets}</td><td>${exerciseEffectScore(eff)}</td></tr>`)).join('');
            exerciseSection = `<h2>Упражнения → эффект</h2><table><tr><th>Мышца</th><th>Упражнение</th><th>SFR</th><th>Профиль</th><th>Угол</th><th>Сустав</th><th>Сеты</th><th>Score</th></tr>${rowsEx2}</table>`;
          }
        }
      }
    } catch {}
  }

  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>ББ-диагностика ${esc(date)}</title>
<style>body{font-family:system-ui,Arial,sans-serif;padding:18px;color:#111}h1{font-size:18px}h2{font-size:14px;margin:14px 0 6px}table{border-collapse:collapse;width:100%;margin:6px 0}th,td{border:1px solid #ddd;padding:6px 8px;font-size:12px;text-align:left}th{background:#f5f5f5}.badge{padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;color:#fff}</style>
</head><body>
<h1>ББ-диагностика — отчёт ${esc(date)} ${level ? `· ${esc(level)}` : ''}</h1>
<div>Score <span class="badge" style="background:${report.score.level === 'critical' ? '#ef4444' : report.score.level === 'warn' ? '#f59e0b' : '#22c55e'}">${report.score.score}/100 ${esc(report.score.level)}</span> · verification ${report.score.verification} · weak ${report.weakMusclesCanonical.join(', ') || '—'}</div>
${floors ? `<div style="margin-top:8px;color:#ef4444;font-size:11px"><b>Floors:</b><ul>${floors}</ul></div>` : ''}
<h2>Слабые (топ-2 → в ББ-авто)</h2><table><tr><th>Мышца</th><th>Зона</th><th>Источник</th><th>Δ%</th><th>Причина</th></tr>${rowsWeak}</table>
${(meta as any)?.weakCauses ? `<h2>Причины отставания (MAX PRO)</h2><table><tr><th>Зона</th><th>Причина</th><th>Уверенность</th><th>Доказательства</th><th>Чинить</th></tr>${Object.entries((meta as any).weakCauses as Record<string, { cause: string; confidence: number; evidence: string[]; fix: string }>).map(([z, c]) => `<tr><td>${esc(z)}</td><td>${esc(c.cause)}</td><td>${Math.round(c.confidence * 100)}%</td><td>${esc(c.evidence.join(' · '))}</td><td>${esc(c.fix)}</td></tr>`).join('')}</table>` : ''}
  ${(meta as any)?.specBlock ? `<h2>Спец-блок ${(meta as any).specBlock.lengthWeeks} нед</h2><div style="font-size:11px;color:#666">${esc(((meta as any).specBlock.rationale || []).join(' · '))} · доноры: ${esc((((meta as any).specBlock as any).donors || []).join(', ') || '—')}</div><table><tr><th>Нед</th><th>Цели (сеты)</th><th>Частота</th><th>Заметка</th></tr>${((meta as any).specBlock.weeks || []).map((w: { week: number; targetSets: Record<string, number>; frequency: Record<string, number>; note: string }) => `<tr><td>${w.week}</td><td>${esc(Object.entries(w.targetSets).map(([k, v]) => `${k} ${v}`).join(', '))}</td><td>${esc(Object.entries(w.frequency).map(([k, v]) => `${k} ×${v}`).join(', '))}</td><td>${esc(w.note)}</td></tr>`).join('')}</table>` : ''}
  ${(() => {
    try {
      const heads = (meta as any)?.weakHeads as string[] | undefined;
      const plan = (meta as any)?.plan;
      if (!heads?.length || !plan?.weeks) return '';
      const cov = auditHeadCoverage(plan, heads);
      if (!cov.length) return '';
      return `<h2>Покрытие слабых головок планом</h2><table><tr><th>Головка</th><th>Статус</th><th>Упражнения</th></tr>${cov.map((c) => `<tr><td>${esc(c.head)}</td><td>${c.covered ? '✓ есть' : '✗ нет'}</td><td>${esc(c.by.join(', ') || '—')}</td></tr>`).join('')}</table>`;
    } catch { return ''; }
  })()}
${(() => {
    const m = meta as BBDiagnosticsPro2Meta | undefined;
    if (!m) return '';
    const parts: string[] = [];
    if (m.lr?.length) parts.push(`<h2>Лево/право (дневник)</h2><table><tr><th>Группа</th><th>Л</th><th>П</th><th>Перекос</th><th>Вердикт</th></tr>${m.lr.map((v) => `<tr><td>${esc(v.group)}</td><td>${v.left}</td><td>${v.right}</td><td>${v.asymPct ?? '—'}%</td><td>${esc(v.text)}</td></tr>`).join('')}</table>`);
    if ((m as any).movementDriver && typeof (m as any).movementDriver === 'object' && (m as any).movementDriver.label) parts.push(`<h2>Драйвер движений</h2><div style="font-size:12px">${esc((m as any).movementDriver.label)} — ${esc((m as any).movementDriver.fix || '')}</div>`);
    if ((m as any).singleLeg && typeof (m as any).singleLeg === 'object' && (m as any).singleLeg.text) parts.push(`<h2>Односторонний скрининг</h2><div style="font-size:12px">${esc((m as any).singleLeg.text)}</div>`);
    if ((m as any).shoulder && typeof (m as any).shoulder === 'object' && (m as any).shoulder.text) parts.push(`<h2>Плечо у стены</h2><div style="font-size:12px">${esc((m as any).shoulder.text)}</div>`);
    if ((m as any).hinge && typeof (m as any).hinge === 'object' && (m as any).hinge.text) parts.push(`<h2>Шарнир + нагрузка</h2><div style="font-size:12px">${esc((m as any).hinge.text)}</div>`);
    if ((m as any).ybt && typeof (m as any).ybt === 'object' && (m as any).ybt.text) parts.push(`<h2>YBT-баланс</h2><div style="font-size:12px">${esc((m as any).ybt.text)}</div>`);
    if (typeof (m as any).asymPriority === 'string' && (m as any).asymPriority) parts.push(`<h2>Асимметрии</h2><div style="font-size:12px">${esc((m as any).asymPriority)}</div>`);
    if ((m as any).driverSubs && typeof (m as any).driverSubs === 'object' && (m as any).driverSubs.text) parts.push(`<h2>Замены под драйвер</h2><div style="font-size:12px">${esc((m as any).driverSubs.text)}</div>`);
    // R1–R8 PRO-2: жим/боль/задняя цепь/шарнир-нагрузка/ER:IR/приоритет (только заполненное)
    if (m.bench && m.bench.text) parts.push(`<h2>Жим лёжа (скрининг)</h2><div style="font-size:12px">${esc(m.bench.text)}</div>`);
    if (typeof m.painMon === 'string' && m.painMon) parts.push(`<h2>Боль-мониторинг</h2><div style="font-size:12px">${esc(m.painMon)}</div>`);
    if (m.posterior) {
      const nhe = typeof m.posterior.nhe === 'string' && m.posterior.nhe ? m.posterior.nhe : '';
      const add = typeof m.posterior.adductor === 'string' && m.posterior.adductor ? m.posterior.adductor : '';
      if (nhe || add) parts.push(`<h2>Задняя цепь (NHE/аддукторы)</h2><ul>${[nhe, add].filter(Boolean).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`);
    }
    if (m.loadedHinge && typeof m.loadedHinge.text === 'string' && m.loadedHinge.text) parts.push(`<h2>Шарнир под весом</h2><div style="font-size:12px">${esc(m.loadedHinge.text)}</div>`);
    if (m.erir && typeof m.erir.text === 'string' && m.erir.text) parts.push(`<h2>Плечо ER:IR</h2><div style="font-size:12px">${esc(m.erir.text)}</div>`);
    if (Array.isArray(m.screenPriority) && m.screenPriority.length) parts.push(`<h2>Скрининг — приоритет</h2><ol>${m.screenPriority.slice(0, 6).map((x) => `<li>${esc(String(x))}</li>`).join('')}</ol>`);
    if (Array.isArray((m as any).correctiveDetail) && (m as any).correctiveDetail.length) {
      // K7: доза (вес/отдых) — та же, что в карточке хаба и вставке («показано = вставится = выгружено»).
      const doseText = (d: any): string => {
        const bits: string[] = [];
        if (typeof d.weightHint === 'number' && d.weightHint > 0) bits.push(`≈${d.weightHint} кг`);
        else if (d.bodyweight) bits.push('без кг');
        if (typeof d.restSec === 'number' && d.restSec > 0) bits.push(`отдых ${d.restSec}с`);
        if (typeof d.reps === 'number' && d.reps > 0) bits.push(`${d.reps}${typeof d.repsMax === 'number' && d.repsMax > d.reps ? `–${d.repsMax}` : ''} повт`);
        if (typeof d.rir === 'number') bits.push(`RIR${d.rir}`);
        if (typeof d.level === 'string' && d.level && d.level !== 'any') bits.push(d.level);
        return bits.join(' · ');
      };
      parts.push(`<h2>Коррекции (библиотека)</h2><table><tr><th>Зона</th><th>Протокол</th><th>Доза</th><th>Кью</th><th>Источник</th></tr>${(m as any).correctiveDetail.slice(0, 4).map((d: any) => `<tr><td>${esc(d.zone)}</td><td>${esc(d.protocol)}</td><td>${esc(doseText(d))}</td><td>${esc((d.cues || []).join(' · '))}</td><td>${esc(d.source || '')}</td></tr>`).join('')}</table>`);
    }
    if (m.readiness?.level) parts.push(`<h2>Готовность — ${esc(m.readiness.level)}</h2><div style="font-size:12px">${esc(m.readiness.advice)}</div><ul>${m.readiness.reasons.map((r) => `<li>${esc(r)}</li>`).join('') || '<li>—</li>'}</ul>`);
    if (m.redFlags?.active) parts.push(`<h2>Флаги — ${m.redFlags.blocked ? 'стоп' : 'осторожно'}</h2><div style="font-size:12px">${esc(m.redFlags.text)} (скрининг, не диагноз)</div>`);
    if (m.bar) parts.push(`<h2>Штанга (видео)</h2><div style="font-size:12px">Петля ${m.bar.xLoop} см · ${esc(m.bar.type)} — ${esc(m.bar.text)} (порог 4/6 см)</div>`);
    if (m.pose) parts.push(`<h2>Углы (таблица)</h2><div style="font-size:12px">Таз ${m.pose.hip ?? '—'}° · колено ${m.pose.knee ?? '—'}° · голеностоп ${m.pose.ankle ?? '—'}° · плечо ${m.pose.shoulder ?? '—'}° (кадров: ${m.pose.n})${m.pose.faults.length ? ` — ${esc(m.pose.faults.join(' · '))}` : ''}</div>`);
    if (m.teen) parts.push(`<h2>Подросток</h2><div style="font-size:12px">${esc(m.teen)}</div>`);
    if (m.femaleNotes?.length) parts.push(`<h2>Женские ориентиры</h2><ul>${m.femaleNotes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>`);
    if (m.lvp) parts.push(`<h2>LVP (нагрузка–скорость)</h2><div style="font-size:12px">${esc(m.lvp.text)}</div>`);
    if (m.tendon) parts.push(`<h2>Сухожилия (скрининг)</h2><ul><li>${esc(m.tendon.elbow)}</li><li>${esc(m.tendon.shoulder)}</li></ul>`);
    if (m.mmc) parts.push(`<h2>Фокус внимания</h2><div style="font-size:12px">${esc(m.mmc)}</div>`);
    if (m.returnTo) parts.push(`<h2>Возврат после флагов</h2><div style="font-size:12px">${esc(m.returnTo.text)}</div><ul>${m.returnTo.stages.map((s) => `<li>${esc(s.title)}: ${esc(s.volume)}, ${esc(s.rir)} — ${esc(s.note)}</li>`).join('')}</ul>`);
    if (m.lrDirection?.length) parts.push(`<h2>Направление перекоса</h2><ul>${m.lrDirection.map((d) => `<li>${esc(d.text)}</li>`).join('')}</ul>`);
    if (m.workingRange) parts.push(`<h2>Рабочий вес (ориентир)</h2><div style="font-size:12px">${esc(m.workingRange)}</div>`);
    return parts.join('');
  })()}
<h2>Симметрия</h2><table><tr><th>Рацио</th><th>Значение</th></tr>${rowsSym}</table><ul>${issuesSym}</ul>
<h2>Стимул</h2><ul>${issuesStim}</ul><div style="font-size:11px;color:#666">lengthened ${report.stimulus.global.lengthened} · mid ${report.stimulus.global.midRange} · shortened ${report.stimulus.global.shortened} · compound ${report.stimulus.global.compound} / iso ${report.stimulus.global.isolation}</div>
${exerciseSection}
<h2>Находки</h2><ul>${findings || '<li>—</li>'}</ul>
<h2>Приоритеты</h2><ul>${priorities || '<li>—</li>'}</ul>
<div style="margin-top:14px;font-size:10px;color:#888">ББ-диагностика PRO · MEV/MAV/MRV Israetel · Reeves/Sandow · Schoenfeld lengthened · SFR · RSS √Σpen² · PROF выполнение</div>
</body></html>`;
}

export function buildBBDiagnosticsCsv(
  report: BBDiagnosticsReport,
  plan?: any,
  meta?: { weakCauses?: Record<string, { cause: string; confidence: number; evidence: string[]; fix: string }>; weakHeads?: string[]; specBlock?: { lengthWeeks: number; donors: string[]; rationale: string[]; weeks: Array<{ week: number; targetSets: Record<string, number>; note: string }> } | null } & BBDiagnosticsPro2Meta,
): string {
  const escCsv = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines: string[] = [];
  lines.push(['muscle', 'granular', 'source', 'deltaPct', 'reason'].map(escCsv).join(','));
  for (const c of report.weakCandidates) lines.push([c.muscle, c.granular || '', c.source, c.deltaPct, c.reason].map(escCsv).join(','));
  lines.push('');
  lines.push(['metric', 'value'].map(escCsv).join(','));
  lines.push(['score', report.score.score].map(escCsv).join(','));
  lines.push(['level', report.score.level].map(escCsv).join(','));
  lines.push(['verification', report.score.verification].map(escCsv).join(','));
  lines.push(['weakCanonical', report.weakMusclesCanonical.join('|')].map(escCsv).join(','));
  lines.push(['weakGranular', report.weakZonesGranular.join('|')].map(escCsv).join(','));
  if (meta?.weakHeads?.length) lines.push(['weakHeads', meta.weakHeads.join('|')].map(escCsv).join(','));
  try {
    const cov = meta?.weakHeads?.length && plan?.weeks ? auditHeadCoverage(plan, meta.weakHeads) : [];
    if (cov.length) {
      lines.push('');
      lines.push(['head', 'covered', 'by'].map(escCsv).join(','));
      for (const c of cov) lines.push([c.head, c.covered ? '1' : '0', c.by.join('|')].map(escCsv).join(','));
    }
  } catch { /* noop */ }
  if (meta?.weakCauses) {
    lines.push('');
    lines.push(['zone', 'cause', 'confidence', 'evidence', 'fix'].map(escCsv).join(','));
    for (const [z, c] of Object.entries(meta.weakCauses)) {
      lines.push([z, c.cause, Math.round(c.confidence * 100) + '%', c.evidence.join(' · '), c.fix].map(escCsv).join(','));
    }
  }
  if (meta?.specBlock) {
    const sb = meta.specBlock;
    lines.push('');
    lines.push(['spec_weeks', sb.lengthWeeks, 'donors', (sb.donors || []).join('|')].map(escCsv).join(','));
    lines.push(['week', 'targets', 'note'].map(escCsv).join(','));
    for (const w of sb.weeks || []) {
      lines.push([w.week, Object.entries(w.targetSets).map(([k, v]) => `${k} ${v}`).join('; '), w.note].map(escCsv).join(','));
    }
  }
  for (const [k, v] of Object.entries(report.symmetry.ratios)) lines.push([k, v].map(escCsv).join(','));
  if (meta?.lr?.length) {
    lines.push('');
    lines.push(['lr_group', 'left', 'right', 'asymPct', 'verdict'].map(escCsv).join(','));
    for (const v of meta.lr) lines.push([v.group, v.left, v.right, v.asymPct ?? '', v.text].map(escCsv).join(','));
  }
  if (meta?.readiness?.level) {
    lines.push('');
    lines.push(['readiness', meta.readiness.level, meta.readiness.advice, (meta.readiness.reasons || []).join(' · ')].map(escCsv).join(','));
  }
  if (meta?.redFlags?.active) {
    lines.push(['red_flags', meta.redFlags.blocked ? 'stop' : 'caution', meta.redFlags.text].map(escCsv).join(','));
  }
  if (meta?.bar) {
    lines.push(['bar_xLoop', meta.bar.xLoop, 'bar_type', meta.bar.type].map(escCsv).join(','));
  }
  if (meta?.pose) {
    lines.push(['pose', `hip ${meta.pose.hip ?? '—'} knee ${meta.pose.knee ?? '—'} ankle ${meta.pose.ankle ?? '—'} shoulder ${meta.pose.shoulder ?? '—'} n ${meta.pose.n}`].map(escCsv).join(','));
  }
  if (meta?.teen) lines.push(['teen', meta.teen].map(escCsv).join(','));
  if (meta?.femaleNotes?.length) lines.push(['female_notes', meta.femaleNotes.join(' · ')].map(escCsv).join(','));
  if (meta?.lvp) lines.push(['lvp', meta.lvp.text].map(escCsv).join(','));
  if (meta?.tendon) {
    lines.push(['tendon_elbow', meta.tendon.elbow].map(escCsv).join(','));
    lines.push(['tendon_shoulder', meta.tendon.shoulder].map(escCsv).join(','));
  }
  if (meta?.mmc) lines.push(['mmc', meta.mmc].map(escCsv).join(','));
  if ((meta as any)?.movementDriver?.label) lines.push(['movement_driver', `${(meta as any).movementDriver.driver}: ${(meta as any).movementDriver.label}`].map(escCsv).join(','));
  if ((meta as any)?.singleLeg?.text) lines.push(['single_leg', (meta as any).singleLeg.text].map(escCsv).join(','));
  if ((meta as any)?.shoulder?.text) lines.push(['shoulder', (meta as any).shoulder.text].map(escCsv).join(','));
  if ((meta as any)?.hinge?.text) lines.push(['hinge_loaded', (meta as any).hinge.text].map(escCsv).join(','));
  if ((meta as any)?.ybt?.text) lines.push(['ybt', (meta as any).ybt.text].map(escCsv).join(','));
  if (typeof (meta as any)?.asymPriority === 'string' && (meta as any).asymPriority) lines.push(['asym_priority', (meta as any).asymPriority].map(escCsv).join(','));
  if ((meta as any)?.driverSubs?.text) lines.push(['driver_subs', (meta as any).driverSubs.text].map(escCsv).join(','));
  // R1–R8 PRO-2: жим/боль/задняя цепь/шарнир-нагрузка/ER:IR/приоритет
  if (meta?.bench && meta.bench.text) lines.push(['bench', `${meta.bench.level}: ${meta.bench.text}`].map(escCsv).join(','));
  if (typeof meta?.painMon === 'string' && meta.painMon) lines.push(['pain_monitor', meta.painMon].map(escCsv).join(','));
  if (typeof meta?.posterior?.nhe === 'string' && meta.posterior.nhe) lines.push(['posterior_nhe', meta.posterior.nhe].map(escCsv).join(','));
  if (typeof meta?.posterior?.adductor === 'string' && meta.posterior.adductor) lines.push(['posterior_addductor', meta.posterior.adductor].map(escCsv).join(','));
  if (meta?.loadedHinge?.text) lines.push(['loaded_hinge', meta.loadedHinge.text].map(escCsv).join(','));
  if (meta?.erir?.text) lines.push(['er_ir', meta.erir.text].map(escCsv).join(','));
  if (Array.isArray(meta?.screenPriority) && meta.screenPriority.length) lines.push(['screen_priority', meta.screenPriority.join(' · ')].map(escCsv).join(','));
  if (Array.isArray((meta as any)?.correctiveDetail) && (meta as any).correctiveDetail.length) {
    // K7: хвостовые колонки дозы (старые колонки 1-в-1 — потребители формата не ломаются).
    lines.push(['corr_id', 'corr_zone', 'corr_exercise', 'corr_protocol', 'corr_source', 'corr_weight', 'corr_rest', 'corr_reps'].map(escCsv).join(','));
    for (const d of (meta as any).correctiveDetail.slice(0, 4)) {
      const w = typeof d.weightHint === 'number' && d.weightHint > 0 ? String(d.weightHint) : (d.bodyweight ? 'bodyweight' : '');
      const reps = typeof d.reps === 'number' && d.reps > 0 ? `${d.reps}${typeof d.repsMax === 'number' && d.repsMax > d.reps ? `-${d.repsMax}` : ''}` : '';
      lines.push([d.id, d.zone, d.exerciseId, d.protocol, d.source, w, d.restSec != null ? String(d.restSec) : '', reps].map(escCsv).join(','));
    }
  }
  if (meta?.returnTo) lines.push(['return_to', meta.returnTo.text].map(escCsv).join(','));
  if (meta?.lrDirection?.length) lines.push(['lr_direction', meta.lrDirection.map((d) => d.text).join(' · ')].map(escCsv).join(','));
  if (meta?.workingRange) lines.push(['working_range', meta.workingRange].map(escCsv).join(','));
  // упражнения → эффект (максимально)
  try {
    const p = plan || (() => { try { const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('he_bb_plan_saved') : null; if (!raw) return null; const j = JSON.parse(raw); return j?.plan?.weeks ? j.plan : j?.weeks ? j : null; } catch { return null; } })();
    if (p && p.weeks) {
      const audit = auditPlanExercises(p as any);
      if (audit && audit.totalExercises > 0) {
        lines.push('');
        lines.push(['exercise_muscle', 'exercise', 'sfr', 'profile', 'angle', 'strict', 'joint', 'uni', 'sets', 'score'].map(escCsv).join(','));
        for (const [m, bm] of Object.entries(audit.byMuscle)) for (const eff of bm.exercises) {
          lines.push([m, eff.name, eff.sfr ?? '', eff.profile ?? '', eff.angleClass ?? '', eff.strictGroup?.key ?? '', eff.jointStress ?? '', eff.unilateral ? '1' : '0', eff.directSets, exerciseEffectScore(eff)].map(escCsv).join(','));
        }
      }
    }
  } catch {}
  return lines.join('\n');
}

/**
 * П3: блок «Скрининг движений» для печати ББ-плана — читает персист приёмника
 * (`he_bb_last_movement_driver/_single_leg/_movement_extra`), всё через esc.
 * Без ключей — пустая строка (печать байт-в-байт, блока нет). Сборку не трогает.
 */
export function buildBbMovementPrintBlock(): string {
  try {
    const get = (k: string): unknown => {
      try {
        if (typeof localStorage === 'undefined') return null;
        const raw = localStorage.getItem(k);
        return raw ? JSON.parse(raw) : null;
      } catch { return null; }
    };
    const lines: string[] = [];
    const d = get('he_bb_last_movement_driver') as { label?: unknown; fix?: unknown } | null;
    if (d && typeof d.label === 'string' && d.label.trim()) {
      lines.push(`Драйвер: ${d.label.trim()}${typeof d.fix === 'string' && d.fix.trim() ? ` — ${d.fix.trim()}` : ''}`);
    }
    const s = get('he_bb_last_single_leg') as { text?: unknown } | null;
    if (s && typeof s.text === 'string' && s.text.trim()) lines.push(s.text.trim());
    const x = get('he_bb_last_movement_extra') as Record<string, unknown> | null;
    if (x && typeof x === 'object') {
      for (const v of Object.values(x)) {
        if (typeof v === 'string' && v.trim()) lines.push(v.trim().slice(0, 300));
      }
    }
    if (!lines.length) return '';
    return `<h2 style="font-size:14px;margin:16px 0 4px">🧭 Скрининг движений</h2><ul style="font-size:11px;color:#333">${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`;
  } catch { return ''; }
}

export function downloadHtml(html: string, filename: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
