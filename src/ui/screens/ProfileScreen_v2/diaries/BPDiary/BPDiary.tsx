import React, { useEffect, useMemo, useRef, useState } from 'react';
import { colors } from '../../ui';
import { NativeIcon } from '../../../../native/NativeIcons';
import {
  btnBase,
  btnPrimary,
  chip,
  chipActive,
  glassSection,
  main as pageMain,
  tableTh,
  tableTd,
  statCard,
} from '../diary-page-styles';
import { DiaryHeader } from '../DiaryHeader';
import { useDiaryDraft } from '../../diary-modals';
import {
  buildWeeklyHistogram,
  compareWithLastWeek,
  crossCorrelation,
  computeDistribution,
  computeExtremes,
  computeStreak,
  detectAnomalies,
  escapeHtml,
  exportSvgAsFile,
  exportSvgAsPng,
  filterByRange,
  getNormalRange,
  laggedCorrelation,
  paginate,
  sortEntries,
  todayIso,
  type DiaryEntryLike,
  type SortState,
} from '../../diary-helpers';
import type { DiaryWindowProps } from '../../DiaryWindow';
import {
  BPEntry,
  BP_SYMPTOMS,
  classifyBP,
  getBpClassificationLabel,
  getBpClassificationColor,
  calcMAP,
  calcPulsePressure,
  calcBPLoad,
  calcVariability,
  getCircadianPattern,
  compareMedsVsNoMeds,
  calculateGoalAchievement,
  getDefaultGoals,
  generateEntryId,
  sortEntriesByTimestamp,
  validateBpEntry,
  getBpEntries,
  commitBpEntries,
  getPulseDaypartAverages,
  getPulseTrend,
  getOrthostaticPairs,
  getHomeBPAdherence,
  classifyHomeBP,
  getMorningEveningComparison,
  estimateCardioRisk,
  type BPValidationError,
} from '../../../../../core/bp-hr-data';
import { BPChart } from './BPChart';
import { useBPAlerts } from './useBPAlerts';
import { calculateTrend } from './bp-trend-prediction';
import { AnimatedCounter } from '@/ui/components/AnimatedCounter';
import { getProfile } from '../../../../../core/profile-manager';

const KEY = 'he_bp_diary';
type BPForm = {
  date: string;
  systolic: string;
  diastolic: string;
  pulse: string;
  position?: BPEntry['position'];
  arm?: BPEntry['arm'];
  timeOfDay?: BPEntry['timeOfDay'];
  medicationTaken?: boolean;
  selectedSymptoms: string[];
  notes?: string;
};

const ACCENT = '#ef4444';

const btn: React.CSSProperties = { ...btnBase(ACCENT), minHeight: 40, boxShadow: '0 2px 10px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.06)' };
const input: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.06)',
  backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
  color: colors.text, fontSize: 14, outline: 'none', minHeight: 40,
  fontFamily: 'inherit', transition: 'border-color 0.15s, background 0.15s',
};
const tintCard = (bg: string, border: string): React.CSSProperties => ({
  padding: 15,
  borderRadius: 16,
  background: `linear-gradient(135deg, ${bg}, transparent 72%), rgba(28,28,32,0.68)`,
  backdropFilter: 'blur(16px) saturate(150%)',
  WebkitBackdropFilter: 'blur(16px) saturate(150%)',
  border: `1px solid ${border}`,
  boxShadow: '0 8px 24px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.05)',
  marginBottom: 12,
});
const card: React.CSSProperties = { ...glassSection, backdropFilter: 'blur(18px) saturate(150%)', WebkitBackdropFilter: 'blur(18px) saturate(150%)' };
const infoCard: React.CSSProperties = tintCard('rgba(59,130,246,.14)', 'rgba(59,130,246,.28)');
const goodCard: React.CSSProperties = tintCard('rgba(34,197,94,.13)', 'rgba(34,197,94,.28)');
const warnCard: React.CSSProperties = tintCard('rgba(245,158,11,.14)', 'rgba(245,158,11,.28)');
const esc = escapeHtml;

const defaultDraft = (): BPForm => ({
  date: todayIso(), systolic: '120', diastolic: '80', pulse: '70',
  position: 'sitting', arm: 'left', timeOfDay: 'morning',
  medicationTaken: false, selectedSymptoms: [],
});

export const BPDiary: React.FC<DiaryWindowProps> = ({ open, onClose, goals, onDataChange }) => {
  const [rows, setRows] = useState<BPEntry[]>([]);
  // Персистентный черновик модалки: ввод не теряется при случайном закрытии/переключении вкладок.
  const [draft, setDraft, resetDraft] = useDiaryDraft<BPForm>('he_draft_bp_inline', defaultDraft);
  const [editing, setEditing] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [sessionMode, setSessionMode] = useState(false);
  const [s2, setS2] = useState(''); const [d2, setD2] = useState(''); const [p2, setP2] = useState('');
  const [s3, setS3] = useState(''); const [d3, setD3] = useState(''); const [p3, setP3] = useState('');
  const [undo, setUndo] = useState<BPEntry[] | null>(null);
  const [range, setRange] = useState<'all' | '7' | '30' | '90'>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortState>({ key: 'date', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<'journal' | 'stats' | 'analysis'>('journal');
  const [validationErrors, setValidationErrors] = useState<BPValidationError[]>([]);
  const svg = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (open) setRows(sortEntriesByTimestamp(getBpEntries()));
  }, [open]);

  const [alerts, dismissAlert] = useBPAlerts({
    entries: rows,
    medicationTaken: rows[0]?.medicationTaken,
    lastMeasurementDate: rows[0]?.date,
  });

  const commit = (next: BPEntry[], remember = true) => {
    const ordered = commitBpEntries(next);
    setRows(ordered);
    if (remember) setUndo(rows);
    onDataChange?.();
  };

  const openNew = () => {
    setEditing(null);
    resetDraft(defaultDraft());
    setValidationErrors([]);
    setSessionMode(false); setS2(''); setD2(''); setP2(''); setS3(''); setD3(''); setP3('');
    setModal(true);
  };

  const save = () => {
    // Сессионное среднее: если включен режим 2-3 замера, усредняем валидные показания (ESC: 2-3 замера за раз)
    let sRaw = Number(draft.systolic), dRaw = Number(draft.diastolic), pRaw = Number(draft.pulse);
    let sessionNote = '';
    if (sessionMode) {
      const readings: { s: number; d: number; p: number }[] = [];
      if (Number.isFinite(sRaw) && Number.isFinite(dRaw) && Number.isFinite(pRaw)) readings.push({ s: sRaw, d: dRaw, p: pRaw });
      const s2n = Number(s2), d2n = Number(d2), p2n = Number(p2);
      if (s2.trim() && d2.trim() && p2.trim() && Number.isFinite(s2n) && Number.isFinite(d2n) && Number.isFinite(p2n)) readings.push({ s: s2n, d: d2n, p: p2n });
      const s3n = Number(s3), d3n = Number(d3), p3n = Number(p3);
      if (s3.trim() && d3.trim() && p3.trim() && Number.isFinite(s3n) && Number.isFinite(d3n) && Number.isFinite(p3n)) readings.push({ s: s3n, d: d3n, p: p3n });
      if (readings.length >= 2) {
        sRaw = Math.round(readings.reduce((a, r) => a + r.s, 0) / readings.length);
        dRaw = Math.round(readings.reduce((a, r) => a + r.d, 0) / readings.length);
        pRaw = Math.round(readings.reduce((a, r) => a + r.p, 0) / readings.length);
        sessionNote = `Сессия ${readings.length} замера: ${readings.map(r => `${r.s}/${r.d} ${r.p}уд`).join(' · ')}`;
      } else if (readings.length === 1 && (s2.trim() || d2.trim() || p2.trim())) {
        setValidationErrors([{ field: 'systolic', message: 'Заполните 2-й замер полностью (систола/диастола/пульс) или выключите сессию' }]);
        return;
      }
    }
    const s = sRaw, d = dRaw, p = pRaw;
    const errors = validateBpEntry(s, d, p, draft.date);
    if (errors.length) { setValidationErrors(errors); return; }
    setValidationErrors([]);
    const noteCombined = [draft.notes?.trim(), sessionNote].filter(Boolean).join(' · ');
    const entry: BPEntry = {
      id: editing || generateEntryId(),
      date: draft.date, systolic: Math.round(s), diastolic: Math.round(d), hr: Math.round(p),
      timestamp: editing ? (rows.find(r => r.id === editing)?.timestamp ?? Date.now()) : Date.now(),
      position: draft.position, arm: draft.arm, timeOfDay: draft.timeOfDay,
      medicationTaken: draft.medicationTaken,
      symptoms: draft.selectedSymptoms,
      notes: noteCombined || undefined,
    };
    commit(editing
      ? rows.map(x => x.id === editing ? entry : x)
      : sortEntriesByTimestamp([entry, ...rows]));
    setModal(false); setEditing(null);
    setSessionMode(false); setS2(''); setD2(''); setP2(''); setS3(''); setD3(''); setP3('');
    resetDraft(defaultDraft());
  };

  const editRow = (x: BPEntry) => {
    setEditing(x.id || '');
    resetDraft({ ...defaultDraft(), ...x, systolic: String(x.systolic), diastolic: String(x.diastolic), pulse: String(x.hr), selectedSymptoms: x.symptoms || [] });
    setValidationErrors([]);
    setSessionMode(false); setS2(''); setD2(''); setP2(''); setS3(''); setD3(''); setP3('');
    setModal(true);
  };

  const deleteRow = (id: string) => {
    setUndo(rows);
    commit(rows.filter(r => r.id !== id), true);
  };

  // --- computed values ---
  const entries: DiaryEntryLike[] = useMemo(() =>
    rows.map(x => ({
      id: x.id,
      date: x.date,
      fields: [
        { label: 'Систола', value: String(x.systolic), unit: 'мм рт.ст.' },
        { label: 'Диастола', value: String(x.diastolic), unit: 'мм рт.ст.' },
        { label: 'Пульс', value: String(x.hr), unit: 'уд/мин' },
        ...(x.notes ? [{ label: 'Заметка', value: x.notes, unit: '' }] : []),
      ],
    })), [rows]);

  const visible = useMemo(() => {
    let x = filterByRange(entries, range);
    if (query.trim()) {
      const q = query.toLowerCase();
      x = x.filter(e => e.date.includes(q) || e.fields.some(f => f.value.toLowerCase().includes(q)));
    }
    return sortEntries(x, sort);
  }, [entries, range, query, sort]);

  const pageData = useMemo(() => paginate(visible, page, 8), [visible, page]);
  // Статистика, графики и аномалии зависят ТОЛЬКО от диапазона (не от поиска).
  const rangeEntries = useMemo(() => filterByRange(entries, range), [entries, range]);
  const { points, dist, extremes, streak, anomalies, comparison, weekly, normal } = useMemo(() => {
    const pts = rangeEntries.map(e => ({ date: e.date, value: Number(e.fields[0].value) })).filter(x => Number.isFinite(x.value));
    return {
      points: pts,
      dist: computeDistribution(pts.map(x => x.value)),
      extremes: computeExtremes('bp', rangeEntries),
      streak: computeStreak(rangeEntries),
      anomalies: detectAnomalies('bp', rangeEntries),
      comparison: compareWithLastWeek(pts),
      weekly: buildWeeklyHistogram(pts),
      normal: getNormalRange('bp'),
    };
  }, [rangeEntries]);

  const latest = rows.length > 0 ? sortEntriesByTimestamp(rows)[0] : undefined;
  // Статистика зависит ТОЛЬКО от диапазона (7/30/90); поиск влияет лишь на таблицу.
  const rangeDateSet = useMemo(() => new Set(rangeEntries.map((e) => e.date)), [rangeEntries]);
  const recentRows = rows.filter((x) => rangeDateSet.has(x.date));
  const bpGoal = goals?.systolicTarget > 0 ? goals.systolicTarget : 120;
  const bpClass = latest ? classifyBP(latest.systolic, latest.diastolic) : 'normal';
  const bpColor = getBpClassificationColor(bpClass);
  const bpLabel = getBpClassificationLabel(bpClass);

  // Averages — memo
  const { avgS, avgD, avgP, normalPct } = useMemo(() => ({
    avgS: recentRows.length ? Math.round(recentRows.reduce((n, x) => n + x.systolic, 0) / recentRows.length) : 0,
    avgD: recentRows.length ? Math.round(recentRows.reduce((n, x) => n + x.diastolic, 0) / recentRows.length) : 0,
    avgP: recentRows.length ? Math.round(recentRows.reduce((n, x) => n + x.hr, 0) / recentRows.length) : 0,
    normalPct: recentRows.length ? Math.round(recentRows.filter(x => x.systolic < 130 && x.diastolic < 80).length / recentRows.length * 100) : 0,
  }), [recentRows]);

  // Advanced metrics — memo (ортостатический тест — только парные замеры одного дня via getOrthostaticPairs)
  const { bpLoad, variability, mapAvg, ppAvg, circadian, medsCompare, goalAchievement, defaultGoals } = useMemo(() => ({
    bpLoad: calcBPLoad(recentRows),
    variability: calcVariability(recentRows),
    mapAvg: recentRows.length ? Math.round(recentRows.reduce((n, x) => n + calcMAP(x.systolic, x.diastolic), 0) / recentRows.length) : 0,
    ppAvg: recentRows.length ? Math.round(recentRows.reduce((n, x) => n + calcPulsePressure(x.systolic, x.diastolic), 0) / recentRows.length) : 0,
    circadian: getCircadianPattern(recentRows),
    medsCompare: compareMedsVsNoMeds(recentRows),
    goalAchievement: calculateGoalAchievement(recentRows, { systolicTarget: bpGoal, diastolicTarget: 80, hrTarget: 72 }),
    defaultGoals: getDefaultGoals(bpClass),
  }), [recentRows, bpGoal, bpClass]);
  const trendSystolic = useMemo(() => calculateTrend(recentRows, 'systolic'), [recentRows]);
  const trendDiastolic = useMemo(() => calculateTrend(recentRows, 'diastolic'), [recentRows]);

  // ── Проф-аналитика домашнего мониторинга ──
  const homeAdherence = useMemo(() => getHomeBPAdherence(rows, 7), [rows]);
  const orthoPairs = useMemo(() => getOrthostaticPairs(rows), [rows]);
  const orthoLatest = orthoPairs[0];
  const morningEvening = useMemo(() => getMorningEveningComparison(rows, 7), [rows]);
  const homeClass = homeAdherence.homeMeanS && homeAdherence.homeMeanD ? classifyHomeBP(homeAdherence.homeMeanS, homeAdherence.homeMeanD) : null;
  const homeClassLabel = homeClass ? getBpClassificationLabel(homeClass) : null;
  const homeClassColor = homeClass ? getBpClassificationColor(homeClass) : '#ffffff';
  const cardioRisk = useMemo(() => {
    const profile = getProfile();
    const personal = profile.settings?.personal || {};
    return estimateCardioRisk(rows, { age: Number(personal.age) || 0, sex: personal.sex });
  }, [rows]);

  // ЧСС (утро/вечер) — ведётся в записях АД (поле hr)
  const pulseDayparts = useMemo(() => getPulseDaypartAverages(rows, 7), [rows]);
  const pulseDayparts30 = useMemo(() => getPulseDaypartAverages(rows, 30), [rows]);
  const pulseTrend = useMemo(() => getPulseTrend(rows), [rows]);
  const pulseTone = (v: number | null) =>
    v === null ? colors.textMuted : v >= 100 ? colors.danger : v < 50 ? colors.warning : v >= 90 ? colors.warning : colors.green;

  // Correlations
  const bpCorrelations = useMemo(() => {
    const read = (key: string, value: (entry: any) => number) => {
      try {
        const raw = JSON.parse(localStorage.getItem(key) || '[]');
        return Array.isArray(raw)
          ? raw.map((entry: any) => ({ date: entry.date, value: value(entry) })).filter((x: any) => Number.isFinite(x.value))
          : [];
      } catch { return []; }
    };
    return [
      ['Сон', read('he_sleep_diary', (e) => Number(e.hours))],
      ['Вес', read('he_weight_log', (e) => Number(e.weight))],
      ['Боль', read('he_health_diary', (e) => Number(e.pain?.totalScore ?? e.totalScore))],
    ]
      .flatMap(([label, data]) => {
        const same = crossCorrelation(points, data as { date: string; value: number }[]);
        const lagged = laggedCorrelation(points, data as { date: string; value: number }[], 1);
        return [same && { label, ...same, lag: 0 }, lagged && { label, ...lagged, lag: 1 }].filter(Boolean) as Array<{ label: string; r: number; n: number; lag: number }>;
      })
      .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))
      .slice(0, 6);
  }, [points]);

  const exportCsv = () => {
    const head = 'Дата,Систола,Диастола,Пульс,MAP,ПД,Положение,Рука,Время,Лекарство,Симптомы,Заметки\n';
    const body = rows.map(x =>
      [x.date, x.systolic, x.diastolic, x.hr,
        calcMAP(x.systolic, x.diastolic), calcPulsePressure(x.systolic, x.diastolic),
        x.position || '', x.arm || '', x.timeOfDay || '',
        x.medicationTaken ? 'да' : 'нет',
        (x.symptoms || []).join('; '), x.notes || '',
      ].map(esc).join(','),
    ).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + head + body], { type: 'text/csv' }));
    a.download = `bp-${todayIso()}.csv`; a.click();
  };

  const print = () => {
    const w = window.open('', '_blank');
    if (!w) return;

    const classOf = (s: number, d: number) => {
      const c = classifyBP(s, d);
      return { cls: c, label: getBpClassificationLabel(c), color: getBpClassificationColor(c) };
    };

    const interpretation = bpClass === 'crisis' ? 'КРИЗИС — немедленно к врачу!' :
      bpClass === 'stage2' ? 'Гипертензия 2 ст. — консультация кардиолога' :
      bpClass === 'stage1' ? 'Гипертензия 1 ст. — изменения образа жизни' :
      bpClass === 'elevated' ? 'Повышенное АД — соль <5г, ДД' : 'АД в норме';

    const html =
      `<!doctype html>
<meta charset="utf-8">
<title>Медицинский отчёт: Дневник АД</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 20px; color: #333; }
  h1 { color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 8px; }
  .section { margin: 16px 0; padding: 12px; border: 1px solid #e5e7eb; border-radius: 8px; }
  .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; margin: 12px 0; }
  .card { padding: 8px 12px; border-radius: 6px; border-left: 4px solid #ccc; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  th { background: #1e40af; color: #fff; padding: 6px; }
  td { padding: 6px; border-bottom: 1px solid #e5e7eb; }
  .normal { color: #16a34a; } .elevated { color: #f59e0b; } .high { color: #ef4444; } .crisis { color: #b91c1c; font-weight: bold; }
  .interpretation { padding: 10px; border-radius: 6px; margin: 12px 0; font-weight: 600; }
  .interpretation.normal { background: #dcfce7; border: 1px solid #16a34a; }
  .interpretation.elevated { background: #fef3c7; border: 1px solid #f59e0b; }
  .interpretation.high { background: #fee2e2; border: 1px solid #ef4444; }
  .interpretation.crisis { background: #fecaca; border: 2px solid #b91c1c; }
  @media print { body { margin: 0; } }
</style>
<h1>Медицинский отчёт: Дневник артериального давления</h1>
<p>Дата отчёта: ${todayIso()} | Записей: ${rows.length} | Период: ${rows.length > 0 ? rows[rows.length - 1]?.date + ' — ' + rows[0]?.date : 'нет данных'}</p>

<div class="section">
  <h2>Сводка</h2>
  <div class="summary">
    <div class="card" style="border-left-color: ${bpColor}">
      <div>Среднее АД</div><strong>${avgS}/${avgD}</strong>
    </div>
    <div class="card"><div>Пульс</div><strong>${avgP} уд/мин</strong></div>
    <div class="card"><div>MAP</div><strong>${mapAvg} мм рт.ст.</strong></div>
    <div class="card"><div>Пульсовое</div><strong>${ppAvg} мм рт.ст.</strong></div>
    <div class="card"><div>BP Load</div><strong>${bpLoad}%</strong></div>
    <div class="card"><div>В норме</div><strong>${normalPct}%</strong></div>
  </div>
</div>

<div class="interpretation ${bpClass}">
  Классификация: ${bpLabel} | ${interpretation}
</div>

<div class="section">
  <h2>Таблица измерений</h2>
  <table>
    <tr><th>Дата</th><th>АД</th><th>Пульс</th><th>MAP</th><th>ПД</th><th>Класс</th><th>Лекарство</th><th>Примечания</th></tr>` +
      rows.map(x => {
        const info = classOf(x.systolic, x.diastolic);
        return `<tr>
          <td>${esc(x.date)}</td>
          <td style="color:${info.color}"><b>${x.systolic}/${x.diastolic}</b></td>
          <td>${x.hr}</td>
          <td>${calcMAP(x.systolic, x.diastolic)}</td>
          <td>${calcPulsePressure(x.systolic, x.diastolic)}</td>
          <td style="color:${info.color}">${info.label}</td>
          <td>${x.medicationTaken ? 'да' : 'нет'}</td>
          <td>${esc(x.notes || '')}</td>
        </tr>`;
      }).join('') +
    `</table>
</div>

<div class="section">
  <h2>Анализ</h2>
  <p><b>Вариабельность (SD):</b> систола ${variability.sysSD.toFixed(1)}, диастола ${variability.diaSD.toFixed(1)}</p>
  <p><b>Достижение целей:</b> систола ≤${bpGoal} — ${goalAchievement.systolicAchieved}%, диастола ≤80 — ${goalAchievement.diastolicAchieved}%</p>
  ${orthoLatest ? `<p><b>Ортостатический тест (${orthoLatest.date}):</b> сидя ${orthoLatest.sitting.systolic}/${orthoLatest.sitting.diastolic} → стоя ${orthoLatest.standing.systolic}/${orthoLatest.standing.diastolic} — ${orthoLatest.isOrthostatic ? '⚠ ортостатическая гипотензия' : 'норма'}</p>` : ''}
  ${circadian.isNonDipper ? '<p><b>⚠ Non-dipper паттерн:</b> ночное АД не снижается</p>' : ''}
</div>

<div class="section">
  <p style="font-size:11px;color:#666;">Дневник сформирован автоматически. Данные не заменяют консультацию врача.</p>
</div>`;

    w.document.write(html);
    w.document.close(); w.focus(); setTimeout(() => w.print(), 100);
  };

  if (!open) return null;

  return (
    <div
      className="bp-window diary-scrollbar"
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background:
          'radial-gradient(1000px 560px at 14% -12%, rgba(239,68,68,0.14), transparent 64%), radial-gradient(760px 460px at 100% -6%, rgba(248,113,113,0.08), transparent 58%), radial-gradient(900px 520px at 50% 118%, rgba(255,255,255,0.04), transparent 62%), #08080a',
        color: colors.text, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain',
      }}
    >
      <style>{`
        .bp-window button { font-family: inherit; }
        .bp-window::-webkit-scrollbar { width: 10px; height: 10px; }
        .bp-window::-webkit-scrollbar-track { background: transparent; }
        .bp-window::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 999px; border: 2px solid transparent; background-clip: content-box; }
        .bp-window::-webkit-scrollbar-thumb:hover { background: rgba(239,68,68,0.38); background-clip: content-box; }
        .bp-window h3 { font-size: 11px; font-weight: 800; color: ${ACCENT}; text-transform: uppercase; letter-spacing: 0.7px; margin: 0 0 10px; }
        .diary-card { transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease; }
        .diary-card:hover { transform: translateY(-1px); box-shadow: 0 12px 32px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.06); }
        @media (hover: none) and (pointer: coarse) {
          .bp-window button { min-height: 44px; }
          .bp-window input, .bp-window textarea, .bp-window select { font-size: 16px; }
        }
      `}</style>
      {/* Header */}
      <DiaryHeader
        accent={ACCENT}
        title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><NativeIcon name="heart" size={18} /> Давление</span>}
        count={rows.length}
        onClose={onClose}
        onAdd={openNew}
        addLabel="+ Добавить"
        onToday={openNew}
        undoActive={!!undo}
        onUndo={() => { if (undo) { commit(undo, false); setUndo(null); } }}
        exportActions={[
          { label: '📥 CSV-файл', onClick: exportCsv },
          { label: '🖨 Печать / PDF', onClick: print },
          { label: '📈 График SVG', onClick: () => { if (svg.current) exportSvgAsFile(svg.current, `bp-${todayIso()}.svg`); } },
          { label: '🖼 График PNG', onClick: () => { if (svg.current) exportSvgAsPng(svg.current, `bp-${todayIso()}.png`); } },
          { label: '🗑 Очистить дневник', onClick: () => { if (window.confirm('Очистить дневник давления?')) commit([]); }, danger: true },
        ]}
      />

      {/* Alerts */}
      {alerts.filter(a => !a.dismissed).length > 0 && (
        <div style={{ padding: '0 16px', maxWidth: 1100, margin: 'auto' }}>
          {alerts.filter(a => !a.dismissed).map(alert => (
            <div
              key={alert.id}
              style={{
                padding: 12, borderRadius: 8, marginBottom: 8,
                border: `1px solid ${alert.severity === 'critical' ? '#b91c1c' : alert.severity === 'warning' ? '#f59e0b' : '#3b82f6'}`,
                background: `${alert.severity === 'critical' ? 'rgba(185,28,28,.1)' : alert.severity === 'warning' ? 'rgba(245,158,11,.1)' : 'rgba(59,130,246,.1)'}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}
            >
              <div>
                <strong>{alert.title}</strong>
                <div style={{ fontSize: 13, marginTop: 4 }}>{alert.message}</div>
              </div>
              <button
                style={{ ...btn, padding: '4px 8px', fontSize: 12 }}
                onClick={() => dismissAlert(alert.id)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <main style={{ ...pageMain, paddingBottom: 72 }}>
        {/* Filter bar */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
          {(['all', '7', '30', '90'] as const).map(x => (
            <button key={x} style={range === x ? chipActive(ACCENT) : chip(ACCENT)} onClick={() => { setRange(x); setPage(1); }}>
              {x === 'all' ? 'Всё' : `${x} дней`}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input style={{ ...input, width: 180, paddingRight: query ? 30 : undefined }} placeholder="🔍 Поиск" value={query}
              onChange={e => { setQuery(e.target.value); setPage(1); }} />
            {query && (
              <button onClick={() => { setQuery(''); setPage(1); }} aria-label="Очистить поиск" style={{ position: 'absolute', right: 6, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: colors.textMuted, cursor: 'pointer', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>✕</button>
            )}
          </div>
          <button style={chip(ACCENT)} onClick={() => setSort({ key: 'date', dir: sort.dir === 'asc' ? 'desc' : 'asc' })}>↕ Дата</button>
          {(['journal', 'stats', 'analysis'] as const).map(t => (
            <button key={t} style={tab === t ? chipActive(ACCENT) : chip(ACCENT)} onClick={() => setTab(t)}>
              {t === 'journal' ? '📋 Журнал' : t === 'stats' ? '📊 Статистика' : '🔬 Анализ'}
            </button>
          ))}
        </div>

        {/* Summary cards — премиум сетка */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(134px,1fr))', gap: 10, margin: '14px 0' }}>
          {[
            ['Среднее АД', avgS && avgD ? { s: avgS, d: avgD } : null, bpColor],
            ['Пульс', avgP || null, undefined],
            ['MAP', mapAvg || null, undefined],
            ['Пульсовое', ppAvg || null, undefined],
            ['Последнее', latest ? { s: latest.systolic, d: latest.diastolic } : null, latest ? bpColor : undefined],
            ['Класс', bpLabel, bpColor],
            ['В норме', normalPct || null, normalPct >= 70 ? '#22c55e' : normalPct >= 40 ? '#f59e0b' : '#ef4444'],
            ['Серия', streak.current || null, undefined],
            ['Цель', bpGoal ? `≤${bpGoal}` : null, undefined],
          ].map(([l, v, color]) => {
            let content: React.ReactNode = '—';
            if (typeof v === 'string') {
              content = v;
            } else if (v && typeof v === 'object' && 's' in v) {
              content = `${v.s}/${v.d}`;
            } else if (typeof v === 'number') {
              content = <AnimatedCounter value={v} decimals={0} duration={500} style={{ fontSize: 20, fontWeight: 800 }} />;
            }
            const accentFor = (typeof color === 'string' ? color : ACCENT);
            return (
              <div
                key={String(l)}
                className="diary-card"
                style={{
                  ...statCard,
                  border: `1px solid ${typeof color === 'string' ? `${color}30` : 'rgba(255,255,255,0.08)'}`,
                  background: `linear-gradient(135deg, ${typeof color === 'string' ? `${color}14` : 'rgba(255,255,255,0.03)'} 0%, transparent 72%), rgba(28,28,32,0.74)`,
                  borderLeft: typeof color === 'string' ? `2px solid ${color}88` : undefined,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: `radial-gradient(380px 90px at 14% 0%, ${typeof color === 'string' ? `${color}14` : 'transparent'}, transparent 62%)`, pointerEvents: 'none' }} />
                <small style={{ fontSize: 10, color: 'rgba(255,255,255,0.44)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', position: 'relative' }}>{String(l)}</small>
                <strong style={{ display: 'block', fontSize: 20, fontWeight: 800, letterSpacing: '-0.3px', color: typeof color === 'string' ? color : '#fff', position: 'relative', marginTop: 2 }}>{content}</strong>
              </div>
            );
          })}
        </section>

        {/* Latest reading banner */}
        {latest && (
          <div style={{ marginBottom: 10, color: bpColor, fontWeight: 600 }}>
            Последняя запись:{' '}
            <b>{latest.date} · {latest.systolic}/{latest.diastolic} · {latest.hr} уд/мин</b>
            {' · '}{bpLabel}
            {latest.medicationTaken ? ' · 💊 Лекарство принято' : ''}
          </div>
        )}

        {/* ========== JOURNAL TAB ========== */}
        {tab === 'journal' && (
          <>
            {/* Chart using BPChart component */}
            {recentRows.length > 0 && (
              <section style={{ marginTop: 12 }}>
                <BPChart ref={svg} data={sortEntriesByTimestamp(recentRows).map(r => ({ date: r.date, systolic: r.systolic, diastolic: r.diastolic, pulse: r.hr }))}
                  goalSystolic={bpGoal} goalDiastolic={80}
                  normalRange={normal ? { low: normal.low, high: normal.high } : { low: 120, high: 80 }} />
              </section>
            )}

            {/* Weekly histogram */}
            <section style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
              {weekly.map(x => (
                <div key={x.weekStart} style={{ ...card, flex: '1 1 100px' }}>
                  <small>{x.weekStart}</small>
                  <strong style={{ display: 'block' }}>{x.mean.toFixed(0)}</strong>
                  <small>{x.count} зап. · {x.min}/{x.max}</small>
                </div>
              ))}
            </section>

            {/* Anomalies */}
            {anomalies.slice(0, 8).map((x, i) => (
              <div key={i} style={{ color: x.severity === 'danger' ? '#ef4444' : '#f59e0b', margin: '4px 0' }}>
                ⚠ {x.date}: {x.message}
              </div>
            ))}

            {/* Correlations */}
            {bpCorrelations.length > 0 && (
              <section style={{ ...card, margin: '12px 0' }}>
                <h3>🔗 Корреляции и лаги</h3>
                {bpCorrelations.map((item, index) => (
                  <div key={`${item.label}-${item.lag}-${index}`}>
                    {item.label}: <b style={{ color: item.r >= 0 ? '#ef4444' : '#22c55e' }}>r={item.r.toFixed(2)}</b> ·{' '}
                    {item.lag ? 'лаг 1 день' : 'тот же день'} · n={item.n}
                  </div>
                ))}
              </section>
            )}

            {/* Data table: «день = серия» — замеры одного дня группируются */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
              <thead>
                <tr>
                  <th style={tableTh}>Дата</th><th style={tableTh}>АД</th><th style={tableTh}>Пульс</th><th style={tableTh}>MAP</th><th style={tableTh}>Класс</th><th style={tableTh}>Контекст</th><th style={tableTh}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  // Карта id→запись для O(1) и корректного маппинга при дублях даты (напр. 2 замера в день)
                  const byId = new Map<string, BPEntry>(rows.map((r) => [r.id ?? '', r]));
                  const dayGroups = new Map<string, BPEntry[]>();
                  for (const e of pageData.pageItems) {
                    const x = e.id ? byId.get(e.id) : undefined;
                    if (!x) continue;
                    const list = dayGroups.get(x.date) || [];
                    list.push(x);
                    dayGroups.set(x.date, list);
                  }
                  const groupRow = (entries: BPEntry[]) => {
                    const cls = classifyBP(entries[0].systolic, entries[0].diastolic);
                    const clr = getBpClassificationColor(cls);
                    const multi = entries.length > 1;
                    return entries.map((x, idx) => (
                      <tr key={x.id || `${x.date}-${idx}`} style={multi ? { background: idx === 0 ? 'rgba(255,255,255,0.03)' : undefined } : undefined}>
                        {idx === 0 ? (
                          <td style={{ ...tableTd, whiteSpace: 'nowrap' }} rowSpan={entries.length}>
                            <b>{x.date}</b>
                            {multi && <small style={{ display: 'block', color: colors.textMuted }}>{entries.length} замера</small>}
                          </td>
                        ) : null}
                        <td style={{ ...tableTd, color: clr, fontWeight: 700 }}>{x.systolic}/{x.diastolic}</td>
                        <td style={tableTd}>{x.hr}</td>
                        <td style={tableTd}>{calcMAP(x.systolic, x.diastolic)}</td>
                        <td style={{ ...tableTd, color: clr }}>{getBpClassificationLabel(classifyBP(x.systolic, x.diastolic))}</td>
                        <td style={tableTd}>{x.position || '—'} · {x.timeOfDay || '—'}{x.medicationTaken ? ' · 💊' : ''}</td>
                        <td style={tableTd}>
                          <button style={btn} onClick={() => editRow(x)}>Изменить</button>{' '}
                          <button style={btn} onClick={() => { if (window.confirm('Удалить запись?')) deleteRow(x.id || x.date); }}>Удалить</button>
                        </td>
                      </tr>
                    ));
                  };
                  return [...dayGroups.values()].flatMap(groupRow);
                })()}
              </tbody>
            </table>
            <div style={{ marginTop: 10 }}>
              <button style={btn} disabled={page <= 1} onClick={() => setPage(page - 1)}>←</button>{' '}
              Страница {page}/{pageData.totalPages}{' '}
              <button style={btn} disabled={page >= pageData.totalPages} onClick={() => setPage(page + 1)}>→</button>
            </div>
          </>
        )}

        {/* ========== STATS TAB ========== */}
        {tab === 'stats' && (
          <>
            {rows.length < 3 && (
              <div style={{ ...infoCard, marginTop: 12 }}>
                📊 Минимум 3 записи для полной статистики. Сейчас: {rows.length}.
              </div>
            )}
            <section style={{ ...card, marginTop: 12 }}>
              <h3>📊 Распределение и экстремумы</h3>
              <div>Среднее: <b>{dist?.mean.toFixed(1) || '—'}</b> · медиана: <b>{dist?.median.toFixed(1) || '—'}</b> · SD:{' '}
                <b>{dist?.stdDev.toFixed(1) || '—'}</b> · P25/P75:{' '}
                <b>{dist ? `${dist.p25.toFixed(1)}/${dist.p75.toFixed(1)}` : '—'}</b></div>
              <div>Минимум: {extremes.min ? `${extremes.min.value} (${extremes.min.date})` : '—'} · Максимум:{' '}
                {extremes.max ? `${extremes.max.value} (${extremes.max.date})` : '—'}</div>
              <div>Неделя к неделе:{' '}
                {comparison.delta == null ? '—' : <AnimatedCounter value={Math.abs(comparison.delta)} decimals={1} duration={500} prefix={comparison.delta > 0 ? '+' : '-'} style={{ fontSize: 14, fontWeight: 700 }} />}
              </div>
            </section>

            <section style={{ ...goodCard, marginTop: 12 }}>
              <h3>💓 ЧСС (утро/вечер, поле «Пульс» в записях АД)</h3>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
                <div>Утро (7д): <b style={{ color: pulseTone(pulseDayparts.morning.avg) }}>{pulseDayparts.morning.avg ?? '—'}</b> уд/мин · {pulseDayparts.morning.count} зап.</div>
                <div>Вечер (7д): <b style={{ color: pulseTone(pulseDayparts.evening.avg) }}>{pulseDayparts.evening.avg ?? '—'}</b> уд/мин · {pulseDayparts.evening.count} зап.</div>
                <div>Среднее (30д): <b style={{ color: pulseTone(pulseDayparts30.morning.avg) }}>{pulseDayparts30.morning.avg ?? '—'}</b> утро / <b style={{ color: pulseTone(pulseDayparts30.evening.avg) }}>{pulseDayparts30.evening.avg ?? '—'}</b> вечер</div>
              </div>
              {pulseTrend && (
                <div style={{ marginTop: 6, fontSize: 13 }}>
                  Тренд утреннего ЧСС:{' '}
                  <b style={{ color: pulseTrend.direction === 'up' ? colors.danger : pulseTrend.direction === 'down' ? colors.green : colors.textMuted }}>
                    {pulseTrend.direction === 'up' ? '↑ растёт' : pulseTrend.direction === 'down' ? '↓ падает' : '→ стабилен'}
                  </b>{' '}
                  <span style={{ color: colors.textMuted }}>(Δ {pulseTrend.delta ?? 0} уд/мин)</span>
                </div>
              )}
              <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 6 }}>
                Норма в покое 60–90 · тахикардия ≥100 · брадикардия &lt;50 (у спортсменов 40–50 может быть нормой).
                Утренний замер — в покое, до кофеина и тренировки.
              </div>
            </section>

            <section style={{ ...warnCard, marginTop: 12 }}>
              <h3>⚡ BP Load и вариабельность</h3>
              <div>BP Load: <b>{bpLoad}%</b> измерений выше цели (130/80)
                {bpLoad > 50 && <span style={{ color: '#ef4444' }}> — высокая нагрузка</span>}
                {bpLoad <= 25 && <span style={{ color: '#22c55e' }}> — хорошо</span>}
              </div>
              <div>Вариабельность (SD): систола <b>{variability.sysSD.toFixed(1)}</b>, диастола <b>{variability.diaSD.toFixed(1)}</b>
                {(variability.sysSD > 15 || variability.diaSD > 10) &&
                  <span style={{ color: '#f59e0b' }}> — повышенная (риск сердечно-сосудистых событий)</span>}
              </div>
            </section>

            <section style={{ ...goodCard, marginTop: 12 }}>
              <h3>🎯 Достижение целей</h3>
              <div style={{ marginBottom: 8 }}>Цель: систола ≤{bpGoal}, диастола ≤80, пульс ≤72</div>
              {[
                ['Систола', goalAchievement.systolicAchieved],
                ['Диастола', goalAchievement.diastolicAchieved],
                ['Пульс', goalAchievement.hrAchieved],
              ].map(([label, pct]) => (
                <div key={String(label)} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span>{label}</span><b>{pct}%</b></div>
                  <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${pct}%`, background: Number(pct) >= 70 ? '#22c55e' : Number(pct) >= 40 ? '#f59e0b' : '#ef4444' }} /></div>
                </div>
              ))}
            </section>

            <section style={{ ...infoCard, marginTop: 12 }}>
              <h3>💊 Эффект лекарств</h3>
              {medsCompare.onMeds.count > 0 || medsCompare.offMeds.count > 0 ? (
                <>
                  <div>На лекарствах: <b>{medsCompare.onMeds.count}</b> изм. · ср. {medsCompare.onMeds.avgS}/{medsCompare.onMeds.avgD}</div>
                  <div>Без лекарств: <b>{medsCompare.offMeds.count}</b> изм. · ср. {medsCompare.offMeds.avgS}/{medsCompare.offMeds.avgD}</div>
                  <div>Разница: систола <b style={{ color: medsCompare.diffS > 0 ? '#22c55e' : '#ef4444' }}>{medsCompare.diffS > 0 ? '−' : '+'}{Math.abs(medsCompare.diffS)}</b>, диастола <b style={{ color: medsCompare.diffD > 0 ? '#22c55e' : '#ef4444' }}>{medsCompare.diffD > 0 ? '−' : '+'}{Math.abs(medsCompare.diffD)}</b></div>
                </>
              ) : (
                <div>Недосточно данных с отметками о лекарствах.</div>
              )}
            </section>

            <section style={{ ...infoCard, marginTop: 12 }}>
              <h3>🏠 Протокол домашнего измерения АД (7 дней)</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 6 }}>
                <div>Полные дни (утро+вечер): <b>{homeAdherence.completeDays}/{homeAdherence.daysWindow}</b></div>
                <div>Только утро: <b>{homeAdherence.morningOnlyDays}</b> · только вечер: <b>{homeAdherence.eveningOnlyDays}</b></div>
                <div>Дней с замерами: <b>{homeAdherence.anyDays}</b></div>
              </div>
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span>Полнота протокола</span><b>{homeAdherence.completenessPct}%</b></div>
                <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginTop: 3 }}>
                  <div style={{ height: '100%', width: `${homeAdherence.completenessPct}%`, background: homeAdherence.completenessPct >= 70 ? '#22c55e' : homeAdherence.completenessPct >= 40 ? '#f59e0b' : '#ef4444' }} />
                </div>
              </div>
              {homeAdherence.days.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(76px,1fr))', gap: 6, marginTop: 8 }}>
                  {homeAdherence.days.map(day => (
                    <div key={day.date} style={{ padding: 8, borderRadius: 8, textAlign: 'center', background: 'rgba(255,255,255,0.04)', border: `1px solid ${day.morning && day.evening ? 'rgba(34,197,94,.35)' : day.readings.length ? 'rgba(245,158,11,.3)' : 'rgba(255,255,255,0.08)'}` }}>
                      <small style={{ display: 'block', fontSize: 9, color: colors.textMuted }}>{day.date.slice(5)}</small>
                      <strong style={{ display: 'block', fontSize: 12 }}>{day.dailyAvgS ? `${day.dailyAvgS}/${day.dailyAvgD}` : '—'}</strong>
                      <small style={{ fontSize: 9, color: day.morning && day.evening ? '#22c55e' : day.readings.length ? '#f59e0b' : colors.textMuted }}>
                        {day.morning && day.evening ? '✓✓' : day.morning ? '☀' : day.evening ? '🌆' : '·'}
                      </small>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 8 }}>
                ESC/ISH: 2–3 замера утром и вечером в течение ≥7 дней (1-й день отбрасывается). Домашние пороги ниже кабинетных — см. ниже.
              </div>
            </section>

            <section style={{ ...card, marginTop: 12 }}>
              <h3>🏠 Домашние vs кабинетные пороги</h3>
              <div style={{ fontSize: 13, marginTop: 6 }}>
                Среднее дома за 7 дней: <b style={{ color: homeClassColor }}>{homeAdherence.homeMeanS || '—'}/{homeAdherence.homeMeanD || '—'}</b>
                {homeClassLabel ? <> · класс: <b style={{ color: homeClassColor }}>{homeClassLabel}</b></> : null}
              </div>
              <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 6 }}>
                Дома АД в среднем ниже, чем у врача («эффект белого халата»). Поэтому домашние пороги сдвинуты вниз:
                повышенное ≥130/80, гипертензия ≥135/85. Кабинетная гипертензия — ≥140/90.
              </div>
            </section>

            <section style={{ ...warnCard, marginTop: 12 }}>
              <h3>🌅 Утро vs вечер (утренний подъём)</h3>
              {morningEvening.pattern === 'insufficient' ? (
                <div style={{ fontSize: 13 }}>Нужны и утренние, и вечерние замеры за 7 дней для сравнения.</div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
                    <div style={{ padding: 10, borderRadius: 10, background: 'rgba(59,130,246,.1)', textAlign: 'center' }}>
                      <small style={{ color: colors.textMuted }}>Утро ({morningEvening.morningCount} изм.)</small>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#3b82f6' }}>{morningEvening.morningS}/{morningEvening.morningD}</div>
                    </div>
                    <div style={{ padding: 10, borderRadius: 10, background: 'rgba(168,85,247,.1)', textAlign: 'center' }}>
                      <small style={{ color: colors.textMuted }}>Вечер ({morningEvening.eveningCount} изм.)</small>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#a855f7' }}>{morningEvening.eveningS}/{morningEvening.eveningD}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 13 }}>
                    Разница систолы: <b style={{ color: Math.abs(morningEvening.diffS) >= 10 ? '#f59e0b' : '#22c55e' }}>{morningEvening.diffS > 0 ? '+' : ''}{morningEvening.diffS}</b>
                  </div>
                  {morningEvening.pattern === 'morning_surge' && (
                    <div style={{ color: '#f59e0b', marginTop: 6, fontSize: 13 }}>⚠ Утренний подъём АД (morning surge) — повышенный риск; уточните у врача.</div>
                  )}
                  {morningEvening.pattern === 'evening_higher' && (
                    <div style={{ color: '#f59e0b', marginTop: 6, fontSize: 13 }}>Вечерние значения выше утренних — проверьте кофеин, стресс, сон.</div>
                  )}
                  {morningEvening.pattern === 'similar' && (
                    <div style={{ color: '#22c55e', marginTop: 6, fontSize: 13 }}>Утро и вечер сопоставимы — стабильный суточный профиль.</div>
                  )}
                </>
              )}
            </section>
          </>
        )}

        {/* ========== ANALYSIS TAB ========== */}
        {tab === 'analysis' && (
          <>
            {rows.length < 3 && (
              <div style={{ ...infoCard, marginTop: 12 }}>
                🔬 Анализ требует минимум 3 записи (ортопроба — пару «сидя/стоя» за день). Сейчас: {rows.length}.
              </div>
            )}
            <section style={{ ...card, marginTop: 12 }}>
              <h3>🩺 Ортостатический тест (парные замеры одного дня)</h3>
              {orthoPairs.length > 0 ? (
                <>
                  {orthoPairs.slice(0, 5).map(pair => (
                    <div key={pair.date} style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', marginBottom: 6, borderLeft: `3px solid ${pair.isOrthostatic ? '#ef4444' : '#22c55e'}` }}>
                      <b>{pair.date}</b> · сидя {pair.sitting.systolic}/{pair.sitting.diastolic} → стоя {pair.standing.systolic}/{pair.standing.diastolic}
                      <div style={{ fontSize: 12, color: pair.isOrthostatic ? '#ef4444' : colors.textMuted }}>
                        Δ систолы {pair.dropS > 0 ? '−' : '+'}{Math.abs(pair.dropS)} мм рт.ст. · Δ диастолы {pair.dropD > 0 ? '−' : '+'}{Math.abs(pair.dropD)} мм рт.ст.
                        {pair.isOrthostatic ? ' — ортостатическая гипотензия!' : ' — в пределах нормы'}
                      </div>
                    </div>
                  ))}
                  {orthoPairs.length > 5 && <div style={{ color: colors.textMuted, fontSize: 12 }}>… и ещё {orthoPairs.length - 5} пар.</div>}
                </>
              ) : (
                <div>Нет парных измерений (сидя и стоя в ОДНОМ дне). Протокол: после 5 мин покоя измерьте сидя, затем встаньте и измерьте стоя в течение 3 мин.</div>
              )}
            </section>

            <section style={{ ...card, marginTop: 12 }}>
              <h3>❤️ Оценочный сердечно-сосудистый профиль</h3>
              {cardioRisk ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                    <span style={{
                      padding: '4px 10px', borderRadius: 8, fontWeight: 800, fontSize: 13,
                      background: cardioRisk.level === 'high' ? 'rgba(239,68,68,.18)' : cardioRisk.level === 'moderate' ? 'rgba(245,158,11,.18)' : 'rgba(34,197,94,.18)',
                      color: cardioRisk.level === 'high' ? '#ef4444' : cardioRisk.level === 'moderate' ? '#f59e0b' : '#22c55e',
                      border: `1px solid ${cardioRisk.level === 'high' ? '#ef4444' : cardioRisk.level === 'moderate' ? '#f59e0b' : '#22c55e'}44`,
                    }}>
                      {cardioRisk.level === 'high' ? 'Выше среднего' : cardioRisk.level === 'moderate' ? 'Умеренный' : 'Низкий'}
                    </span>
                    <span style={{ fontSize: 12, color: colors.textMuted }}>{cardioRisk.points} факт. фактора</span>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    {cardioRisk.factors.map((f, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '5px 8px', borderRadius: 6, background: f.active ? 'rgba(239,68,68,.07)' : 'rgba(255,255,255,0.02)', marginBottom: 3 }}>
                        <span style={{ color: f.active ? '#ef4444' : colors.textMuted }}>{f.label}</span>
                        <span>{f.active ? '⚠' : '✓'}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 8, fontStyle: 'italic' }}>{cardioRisk.summary}</div>
                </>
              ) : (
                <div>Добавьте записи для оценки.</div>
              )}
              <div style={{ fontSize: 10, color: colors.textMuted, marginTop: 8 }}>
                Оценочный профиль на основе дневника — НЕ диагноз и не заменяет консультацию врача.
              </div>
            </section>

            <section style={{ ...card, marginTop: 12 }}>
              <h3>🌙 Циркадный паттерн</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 8 }}>
                {([
                  { key: 'morning' as const, label: '🌅 Утро' },
                  { key: 'afternoon' as const, label: '☀️ День' },
                  { key: 'evening' as const, label: '🌆 Вечер' },
                  { key: 'night' as const, label: '🌙 Ночь' },
                ]).map(({ key, label }) => {
                  const g = circadian[key];
                  if (g.count === 0) return (
                    <div key={key} style={{ padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.05)', textAlign: 'center', fontSize: 12, color: colors.textMuted }}>
                      {label}<br />Нет данных
                    </div>
                  );
                  const cls = classifyBP(g.avgS, g.avgD);
                  const bg = getBpClassificationColor(cls);
                  return (
                    <div key={key} style={{
                      padding: 10, borderRadius: 8, textAlign: 'center',
                      background: `${bg}18`, border: `1px solid ${bg}44`,
                    }}>
                      <div style={{ fontSize: 12, color: '#ffffff' }}>{label}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: bg }}>{g.avgS}/{g.avgD}</div>
                      <div style={{ fontSize: 11, color: '#ffffff' }}>{g.count} изм.</div>
                    </div>
                  );
                })}
              </div>
              {circadian.isNonDipper && (
                <div style={{ color: '#f59e0b', marginTop: 8, fontSize: 13 }}>⚠ Non-dipper: ночное АД не снижается (риск поражения органов-мишеней)</div>
              )}
              {!circadian.isNonDipper && circadian.morning.avgS > 0 && (
                <div style={{ color: '#22c55e', marginTop: 8, fontSize: 13 }}>✓ Dipper: нормальное ночное снижение АД</div>
              )}
            </section>

            <section style={{ ...card, marginTop: 12 }}>
              <h3>📈 Тренд и прогноз</h3>
              <div>Систола: <b>{trendSystolic.trend === 'rising' ? '📈 рост' : trendSystolic.trend === 'falling' ? '📉 снижение' : '➡️ стабильно'}</b> ({trendSystolic.slope > 0 ? '+' : ''}{trendSystolic.slope.toFixed(1)} в день)</div>
              <div>Диастола: <b>{trendDiastolic.trend === 'rising' ? '📈 рост' : trendDiastolic.trend === 'falling' ? '📉 снижение' : '➡️ стабильно'}</b> ({trendDiastolic.slope > 0 ? '+' : ''}{trendDiastolic.slope.toFixed(1)} в день)</div>
              <div>R² (достоверность): систола {trendSystolic.r2.toFixed(2)}, диастола {trendDiastolic.r2.toFixed(2)}</div>
              {trendSystolic.r2 > 0.5 && (
                <div style={{ marginTop: 8, padding: 8, background: 'rgba(59,130,246,.1)', borderRadius: 6 }}>
                  <div>Прогноз через 7 дней: <b>{trendSystolic.prediction7d}/{trendDiastolic.prediction7d}</b></div>
                  <div>Прогноз через 14 дней: <b>{trendSystolic.prediction14d}/{trendDiastolic.prediction14d}</b></div>
                  {(trendSystolic.prediction14d >= 140 || trendDiastolic.prediction14d >= 90) && (
                    <div style={{ color: '#ef4444', marginTop: 4 }}>⚠ Прогноз: АД может достичь гипертензии через 2 недели</div>
                  )}
                </div>
              )}
            </section>

            <section style={{ ...card, marginTop: 12 }}>
              <h3>📋 Рекомендации на основе классификации</h3>
              <div>Текущая классификация: <b style={{ color: bpColor }}>{bpLabel}</b></div>
              <div>Рекомендованная цель: ≤{defaultGoals.systolicTarget}/{defaultGoals.diastolicTarget} мм рт.ст.</div>
              {bpClass === 'crisis' && (
                <div style={{ color: '#ef4444', marginTop: 6 }}>🚨 КРИЗИС: немедленно обратитесь к врачу!</div>
              )}
              {bpClass === 'stage2' && (
                <div style={{ color: '#ef4444', marginTop: 6 }}>⚠ Гипертензия 2 ст.: рекомендована консультация кардиолога и медикаментозная терапия.</div>
              )}
              {bpClass === 'stage1' && (
                <div style={{ color: '#f59e0b', marginTop: 6 }}>⚠ Гипертензия 1 ст.: рекомендованы изменения образа жизни + рассмотреть медикаменты.</div>
              )}
              {bpClass === 'elevated' && (
                <div style={{ color: '#f59e0b', marginTop: 6 }}>Повышенное АД: рекомендованы изменения образа жизни (соль &lt;5г, ДД, стресс).</div>
              )}
              {bpClass === 'normal' && (
                <div style={{ color: '#22c55e', marginTop: 6 }}>✓ АД в норме. Продолжайте в том же духе!</div>
              )}
            </section>
          </>
        )}
      </main>

      {/* Latest entries footer */}
      {rows.length > 0 && (
        <section style={{ padding: '0 16px 16px', maxWidth: 1100, margin: 'auto' }}>
          <div style={{ ...card, padding: 14 }}>
            <h3 style={{ marginTop: 0 }}>Последние записи</h3>
            {sortEntriesByTimestamp(rows).slice(0, 3).map(row => {
              const cls = classifyBP(row.systolic, row.diastolic);
              return (
                <div key={row.id || `latest-${row.date}`} style={{ padding: '9px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)', borderLeft: `3px solid ${getBpClassificationColor(cls)}`, paddingLeft: 12 }}>
                  <b>{row.date}</b> · {row.systolic}/{row.diastolic} · {row.hr} уд/мин · MAP {calcMAP(row.systolic, row.diastolic)}
                  {row.position ? ` · ${row.position}` : ''}
                  {row.timeOfDay ? ` · ${row.timeOfDay}` : ''}
                  {row.notes ? ` · ${row.notes}` : ''}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Add/Edit modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2100, background: 'rgba(5,5,9,0.66)', backdropFilter: 'blur(10px)', display: 'flex', overflowY: 'auto', padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget) setModal(false); }}>
          <form onSubmit={e => { e.preventDefault(); save(); }}
            style={{ margin: 'auto', background: 'linear-gradient(165deg, rgba(36,36,48,0.98), rgba(19,19,26,0.98))', padding: 18, borderRadius: 20, border: `1px solid ${ACCENT}38`, width: 'min(560px,100%)', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', boxShadow: '0 24px 70px rgba(0,0,0,0.6)' }}>
            <h3>{editing ? '✏️ Редактирование АД' : '➕ Добавить запись АД'}</h3>
            {validationErrors.length > 0 && (
              <div style={{ background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.35)', borderRadius: 10, padding: 10, marginBottom: 10 }}>
                {validationErrors.map(error => <div key={`${error.field}-${error.message}`} style={{ color: '#ef4444', fontSize: 13 }}>⚠ {error.message}</div>)}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8 }}>
              {([
                ['Дата', 'date'],
                ['Систола', 'systolic'],
                ['Диастола', 'diastolic'],
                ['Пульс', 'pulse'],
              ] as const).map(([label, key]) => (
                <label key={key}>
                  {label}
                  <input style={input} type={key === 'date' ? 'date' : 'number'}
                    value={draft[key]}
                    onChange={e => setDraft({ ...draft, [key]: e.target.value })} />
                </label>
              ))}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, cursor: 'pointer', fontSize: 13 }}>
              <input type="checkbox" checked={sessionMode} onChange={e => setSessionMode(e.target.checked)} style={{ accentColor: ACCENT }} />
              <span style={{ fontWeight: 700, color: sessionMode ? '#f87171' : colors.textMuted }}>Сессия 2-3 замера (усреднение)</span>
              <span style={{ fontSize: 11, color: colors.textMuted }}>ESC: 2-3 измерения → среднее</span>
            </label>
            {sessionMode && (
              <div style={{ marginTop: 8, padding: 10, borderRadius: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#f87171', marginBottom: 8 }}>Дополнительные замеры (через 1-2 мин)</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                  <input style={input} placeholder="Систола 2" value={s2} onChange={e=>setS2(e.target.value)} inputMode="numeric" />
                  <input style={input} placeholder="Диастола 2" value={d2} onChange={e=>setD2(e.target.value)} inputMode="numeric" />
                  <input style={input} placeholder="Пульс 2" value={p2} onChange={e=>setP2(e.target.value)} inputMode="numeric" />
                  <input style={input} placeholder="Систола 3 (опц.)" value={s3} onChange={e=>setS3(e.target.value)} inputMode="numeric" />
                  <input style={input} placeholder="Диастола 3" value={d3} onChange={e=>setD3(e.target.value)} inputMode="numeric" />
                  <input style={input} placeholder="Пульс 3" value={p3} onChange={e=>setP3(e.target.value)} inputMode="numeric" />
                </div>
                {(() => {
                  const readings:{s:number;d:number;p:number}[]=[];
                  const sRaw=Number(draft.systolic), dRaw=Number(draft.diastolic), pRaw=Number(draft.pulse);
                  if (Number.isFinite(sRaw)&&Number.isFinite(dRaw)&&Number.isFinite(pRaw)) readings.push({s:sRaw,d:dRaw,p:pRaw});
                  const s2n=Number(s2), d2n=Number(d2), p2n=Number(p2);
                  if (s2.trim()&&d2.trim()&&p2.trim()&&Number.isFinite(s2n)&&Number.isFinite(d2n)&&Number.isFinite(p2n)) readings.push({s:s2n,d:d2n,p:p2n});
                  const s3n=Number(s3), d3n=Number(d3), p3n=Number(p3);
                  if (s3.trim()&&d3.trim()&&p3.trim()&&Number.isFinite(s3n)&&Number.isFinite(d3n)&&Number.isFinite(p3n)) readings.push({s:s3n,d:d3n,p:p3n});
                  if (readings.length>=2) {
                    const avgS=Math.round(readings.reduce((a,r)=>a+r.s,0)/readings.length);
                    const avgD=Math.round(readings.reduce((a,r)=>a+r.d,0)/readings.length);
                    const avgP=Math.round(readings.reduce((a,r)=>a+r.p,0)/readings.length);
                    return <div style={{ marginTop: 8, fontSize: 12, color: '#f87171', fontWeight: 700 }}>Среднее сессии: {avgS}/{avgD} · {avgP} уд/мин · {readings.length} замера</div>;
                  }
                  return null;
                })()}
                <div style={{ fontSize: 10, color: colors.textMuted, marginTop: 6 }}>ESC/ISH: 2-3 замера подряд с интервалом 1-2 мин, в анализ идёт среднее.</div>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
              <label>Положение
                <select style={input} value={draft.position as string} onChange={e => setDraft({ ...draft, position: e.target.value })}>
                  <option value="sitting">Сидя</option>
                  <option value="standing">Стоя</option>
                  <option value="lying">Лёжа</option>
                </select>
              </label>
              <label>Рука
                <select style={input} value={draft.arm as string} onChange={e => setDraft({ ...draft, arm: e.target.value })}>
                  <option value="left">Левая</option>
                  <option value="right">Правая</option>
                </select>
              </label>
              <label>Время
                <select style={input} value={draft.timeOfDay as string} onChange={e => setDraft({ ...draft, timeOfDay: e.target.value })}>
                  <option value="morning">Утро</option>
                  <option value="afternoon">День</option>
                  <option value="evening">Вечер</option>
                  <option value="night">Ночь</option>
                </select>
              </label>
            </div>
            <label style={{ display: 'block', marginTop: 8 }}>
              <input type="checkbox" checked={!!draft.medicationTaken} onChange={e => setDraft({ ...draft, medicationTaken: e.target.checked })} />{' '}
              Лекарство принято
            </label>
            <div style={{ display: 'block', marginTop: 8 }}>
              <div style={{ marginBottom: 6 }}>Симптомы</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {BP_SYMPTOMS.map(symptom => {
                  const active = draft.selectedSymptoms.includes(symptom);
                  return <button key={symptom} type="button" style={{ minHeight: 32, padding: '4px 9px', borderRadius: 16, border: active ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.12)', background: active ? 'rgba(239,68,68,.2)' : 'rgba(255,255,255,0.05)', color: active ? '#ef4444' : '#ffffff', cursor: 'pointer' }} onClick={() => setDraft({ ...draft, selectedSymptoms: active ? draft.selectedSymptoms.filter(x => x !== symptom) : [...draft.selectedSymptoms, symptom] })}>{symptom}</button>;
                })}
              </div>
            </div>
            <label style={{ display: 'block', marginTop: 8 }}>
              Заметки
              <textarea style={{ ...input, minHeight: 60 }} value={draft.notes || ''} onChange={e => setDraft({ ...draft, notes: e.target.value })} />
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button type="button" style={btn} onClick={() => setModal(false)}>Отмена</button>
              <button type="submit" style={btnPrimary(ACCENT)}>{editing ? 'Сохранить' : 'Добавить'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
