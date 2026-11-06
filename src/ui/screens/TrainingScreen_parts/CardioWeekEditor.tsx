/**
 * CardioWeekEditor.tsx — конструктор недели кардио-цикла:
 * раскладка по дням (Пн-Вс), масштабирование минут ±10%, переключатель HIIT
 * и полноценный редактор сессий (тип, минуты, частота, удалить, добавить).
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  spreadSessionsAcrossDays, DAY_LABELS_RU, CARDIO_PHASE_LABELS,
  loadCardioCycles, saveCardioCycle, setActiveCardioCycle, kcalForCardio,
  saveCardioCycleVersion, latestCardioCycleVersion, restoreCardioCycleVersion,
  cardioCycleVersions, restoreCardioCycleVersionById,
  cardioWeekForDate, cardioSafetyReport, cycleBodyWeight, cycleFfmKg, rebuildCycle, cardioWeekLegConflicts, cardioHiitInjectGate,
  moveCardioSessionInWeek, maxHrClassic,
  CARDIO_EQUIPMENT_OPTIONS, cardioStructuredLabel, cardioStructuredMainSec,
  type CardioCycle, type CardioType, type CardioSession, type CardioWeek, type CardioEquipment, type CardioStructuredBlock,
} from '../../../engines/lms/cardio.engine';
import { CARDIO_INTERVAL_PRESETS, getCardioIntervalPreset } from '../../../engines/lms/cardio-interval-presets.engine';
import { CARD, ROW, LABEL, HINT_SM, BTN, BTN_PRIMARY, BTN_DANGER, BTN_SMALL, SelectInput } from './CardioUI';

const DAY_CELL: React.CSSProperties = {
  flex: '1 1 48px', minWidth: 48, borderRadius: 11, padding: '8px 4px', textAlign: 'center',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015))', border: '1px solid rgba(255,255,255,0.08)', fontSize: 11,
  minHeight: 64, display: 'flex', flexDirection: 'column', gap: 3, fontVariantNumeric: 'tabular-nums',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
};
const SEL: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.13)',
  borderRadius: 10, padding: '10px 12px', color: '#fff', fontSize: 14, minHeight: 44, outline: 'none',
};
const NUM: React.CSSProperties = { ...SEL, width: 72 };

const TYPES: CardioType[] = ['zone2', 'miss', 'hiit', 'recovery'];
const TYPE_LABEL: Record<CardioType, string> = { zone2: 'Zone 2', hiit: 'HIIT', miss: 'MISS', recovery: 'Recovery' };
const TYPE_SHORT: Record<CardioType, string> = { zone2: 'Z2', hiit: 'HIIT', miss: 'MISS', recovery: 'Rec' };

function rebuildTotals(week: CardioWeek): CardioWeek {
  const totalMinutes = week.sessions.reduce((s, x) => s + x.durationMin * x.weeklyFrequency, 0);
  const totalKcal = week.sessions.reduce((s, x) => s + x.kcalPerSession * x.weeklyFrequency, 0);
  return { ...week, totalMinutes, totalKcal };
}

/** Дописать/обновить в тексте сессии пометку о структуре (без дублей). */
function withStructNote(purpose: string | undefined, label: string | null): string | undefined {
  const base = (purpose ?? '').split('⚡ Структура:')[0].trim().replace(/[\s·]+$/, '');
  if (!label) return base || undefined;
  return `${base ? `${base} · ` : ''}⚡ Структура: ${label}`;
}

const clampInt = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, Math.round(Number.isFinite(v) ? v : min)));

/**
 * Нормализация черновика структуры перед записью: пульсовой диапазон с
 * перепутанными границами не должен попадать в план (таймер показывал бы
 * «170–150»), а `targetHr` без единой границы — мусор.
 */
function normalizeStructureBlocks(draft: CardioStructuredBlock[]): CardioStructuredBlock[] {
  return draft
    .filter(b => b.workSec > 0 && b.reps > 0)
    .map(b => {
      if (b.target !== 'hr') return b.targetHr ? { ...b, targetHr: undefined } : b;
      const min = b.targetHr?.min;
      const max = b.targetHr?.max;
      if (min == null && max == null) return { ...b, targetHr: undefined };
      if (min != null && max != null && min > max) return { ...b, targetHr: { min: max, max: min } };
      return b;
    });
}

const TARGET_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'без метки' },
  { value: 'hr', label: 'пульс' },
  { value: 'pace', label: 'темп' },
  { value: 'power', label: 'мощность' },
  { value: 'rpe', label: 'RPE' },
];

const fmtVersionAt = (iso: string): string => {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  const p2 = (n: number) => String(n).padStart(2, '0');
  return `${p2(d.getDate())}.${p2(d.getMonth() + 1)} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
};

/** Цель сессии: черновик до blur/Enter, чтобы каждый символ не создавал
 *  снапшот версии и не писал в localStorage. */
const PurposeField: React.FC<{ purpose?: string; index: number; onCommit: (v: string) => void }> = ({ purpose, index, onCommit }) => {
  const [v, setV] = useState(purpose ?? '');
  useEffect(() => { setV(purpose ?? ''); }, [purpose]);
  const commit = () => { if ((purpose ?? '') !== v) onCommit(v); };
  return (
    <input
      value={v}
      onChange={e => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      aria-label={`Цель сессии ${index + 1}`}
      placeholder="цель сессии"
      style={{ ...SEL, flex: '1 1 150px', minWidth: 0 }}
    />
  );
};

export const CardioWeekEditor: React.FC<{ cycle: CardioCycle | null; onChanged?: () => void }> = ({ cycle, onChanged }) => {
  const [weekNo, setWeekNo] = useState(1);
  const [flash, setFlash] = useState<string | null>(null);
  const [editSessions, setEditSessions] = useState(false);
  const [newType, setNewType] = useState<CardioType>('zone2');
  const [newEquip, setNewEquip] = useState<CardioEquipment | ''>('');
  const [newDay, setNewDay] = useState('');
  // Открытая панель структуры интервалов + черновик (сохраняется кнопкой,
  // чтобы каждое нажатие стрелки не плодило версии и записи в localStorage).
  const [structIdx, setStructIdx] = useState<number | null>(null);
  const [structDraft, setStructDraft] = useState<CardioStructuredBlock[]>([]);
  // Тип сессии, который диктует выбранный протокол (Sweet Spot — MISS,
  // Tabata — HIIT): применяется вместе с 💾, а не в момент выбора пресета.
  const [structTypeDraft, setStructTypeDraft] = useState<CardioType | null>(null);
  const [histOpen, setHistOpen] = useState(false);
  const [confirmVerId, setConfirmVerId] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);

  // Смена недели закрывает панель структуры: иначе черновик одной недели
  // сохранялся бы в сессию с тем же индексом на другой неделе.
  useEffect(() => { setStructIdx(null); setStructDraft([]); setStructTypeDraft(null); }, [weekNo]);

  const week: CardioWeek | null = useMemo(() => {
    if (!cycle) return null;
    const clamped = Math.max(1, Math.min(cycle.totalWeeks, weekNo));
    return cycle.weeks.find(w => w.week === clamped) ?? null;
  }, [cycle, weekNo]);

  const days = useMemo(() => (week ? spreadSessionsAcrossDays(week, cycle?.startDate, { legDays: cycle?.config?.legDays }) : []), [week, cycle]);

  const flashMsg = (m: string) => { setFlash(m); window.setTimeout(() => setFlash(null), 2500); };

  const saveWeek = (patch: (w: CardioWeek) => CardioWeek) => {
    if (!cycle || !week) return;
    saveCardioCycleVersion(cycle, `правка недели ${week.week}`);
    // Итоги НЕДЕЛИ пересчитывает rebuildTotals, итоги ЦИКЛА — rebuildCycle:
    // иначе cycle.totalKkal остаётся от сборки и hero/сводка/экспорт врут.
    const next = rebuildCycle({ ...cycle, weeks: cycle.weeks.map(w => (w.week === week.week ? rebuildTotals(patch(w)) : w)) });
    saveCardioCycle(next);
    setActiveCardioCycle(next);
    onChanged?.();
    flashMsg('💾 Неделя обновлена');
  };

  const undoVersion = () => {
    if (!cycle) return;
    const restored = restoreCardioCycleVersion(cycle.id);
    if (!restored) { flashMsg('⚠ Нет сохранённых версий'); return; }
    saveCardioCycle(restored);
    setActiveCardioCycle(restored);
    onChanged?.();
    flashMsg('↩ Версия недели восстановлена');
  };

  const copyToNext = () => {
    if (!cycle || !week || week.week >= cycle.totalWeeks) return;
    saveCardioCycleVersion(cycle, 'копия недели');
    const next = rebuildCycle({
      ...cycle,
      weeks: cycle.weeks.map(w => (w.week === week.week + 1 ? { ...rebuildTotals({ ...week, week: week.week + 1 }), phase: w.phase, deload: w.deload, taper: w.taper, rationale: w.rationale } : w)),
    });
    saveCardioCycle(next);
    setActiveCardioCycle(next);
    setWeekNo(Math.min(cycle.totalWeeks, week.week + 1));
    onChanged?.();
    flashMsg(`⧉ Неделя ${week.week} скопирована в неделю ${week.week + 1}`);
  };

  const hasVersion = cycle ? latestCardioCycleVersion(cycle.id) != null : false;

  const goCurrentWeek = () => {
    if (!cycle) return;
    const d = new Date();
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const w = cardioWeekForDate(cycle, iso, cycle.startDate);
    setWeekNo(Math.min(cycle.totalWeeks, Math.max(1, w?.week ?? 1)));
  };

  const safety = useMemo(() => (week ? cardioSafetyReport({ ...cycle!, weeks: [week] }).warnings : []), [week, cycle]);

  const legDays = useMemo(() => new Set((cycle?.config?.legDays ?? []).filter(d => d >= 0 && d <= 6)), [cycle]);
  const legConflicts = useMemo(() => (cycle && week ? cardioWeekLegConflicts(cycle, week.week) : []), [cycle, week]);

  /** P0-аудит: мед-гейт на ЛЮБУЮ ручную интенсив-сессию (добавление и смена типа). */
  const hiitGate = useMemo(() => cardioHiitInjectGate(cycle), [cycle]);
  const gateFlash = (type: CardioType) => {
    flashMsg(`⛔ ${hiitGate.reason ?? 'HIIT запрещён мед-скринингом'} (${TYPE_LABEL[type]} не добавлен)`);
  };

  // kcal считаем тем же движком и теми же входами (пол/FFM), что и сборка —
  // иначе ручная правка недели расходится с планом по калориям.
  const bw = cycle ? cycleBodyWeight(cycle) : 80;
  const ffm = cycle ? cycleFfmKg(cycle) : undefined;
  const csex = cycle?.config?.sex;

  const scaleMinutes = (mult: number) => saveWeek(w => ({
    ...w,
    sessions: w.sessions.map(s => {
      // Структура не режется: ниже её основной части минуты не опускаем.
      const need = Math.ceil(cardioStructuredMainSec(s.structured) / 60);
      const dur = Math.max(10, need, Math.round(s.durationMin * mult));
      return { ...s, durationMin: dur, kcalPerSession: kcalForCardio(s.type, dur, bw, s.equipment, csex, ffm) };
    }),
  }));

  const updateSession = (idx: number, patch: Partial<CardioSession>) => {
    // P0-аудит: смена типа на интенсив — тоже под мед-гейтом.
    const cur = week?.sessions?.[idx];
    const nextType = patch.type ?? cur?.type;
    if (cur && nextType && !hiitGate.allowed && (nextType === 'hiit' || nextType === 'miss') && cur.type !== nextType) {
      gateFlash(nextType);
      return;
    }
    let safe = patch;
    if (cur && patch.durationMin != null) {
      const need = Math.ceil(cardioStructuredMainSec(cur.structured) / 60);
      if (need > 0 && patch.durationMin < need) {
        safe = { ...patch, durationMin: need };
        flashMsg(`⚠ Структура занимает ${need} мин — сессия не может быть короче`);
      }
    }
    saveWeek(w => ({
      ...w,
      sessions: w.sessions.map((s, i) => {
        if (i !== idx) return s;
        const next = { ...s, ...safe };
        next.kcalPerSession = kcalForCardio(next.type, next.durationMin, bw, next.equipment, csex, ffm);
        return next;
      }),
    }));
  };

  const removeSession = (idx: number) => {
    // Панель структуры держит индекс: после удаления он должен указывать на
    // ту же сессию, иначе «Сохранить» записало бы структуру чужой сессии.
    if (structIdx === idx) { setStructIdx(null); setStructDraft([]); setStructTypeDraft(null); }
    else if (structIdx != null && structIdx > idx) setStructIdx(structIdx - 1);
    saveWeek(w => ({ ...w, sessions: w.sessions.filter((_, i) => i !== idx) }));
  };

  const addSession = () => {
    if (!hiitGate.allowed && (newType === 'hiit' || newType === 'miss')) { gateFlash(newType); return; }
    saveWeek(w => ({
      ...w,
      sessions: [...w.sessions, {
        type: newType,
        durationMin: 30,
        weeklyFrequency: 1,
        intensity: newType === 'hiit' ? 'high' : newType === 'recovery' ? 'low' : 'moderate',
        kcalPerSession: kcalForCardio(newType, 30, bw, newEquip || undefined, csex, ffm),
        purpose: 'Ручная сессия',
        equipment: newEquip || undefined,
        dayOfWeek: newDay === '' ? undefined : Number(newDay),
      }],
    }));
  };

  // ─── Структура интервалов (⚡): черновик → 💾 сохранить ───
  const openStructure = (idx: number) => {
    if (structIdx === idx) { setStructIdx(null); setStructDraft([]); setStructTypeDraft(null); return; }
    const src = week?.sessions[idx]?.structured;
    setStructIdx(idx);
    setStructDraft(Array.isArray(src) ? src.map(b => ({ ...b })) : []);
    setStructTypeDraft(null);
  };
  const patchBlock = (bi: number, patch: Partial<CardioStructuredBlock>) => {
    setStructDraft(prev => prev.map((b, i) => (i === bi ? { ...b, ...patch } : b)));
  };
  const addBlock = () => setStructDraft(prev => [...prev, { workSec: 60, restSec: 60, reps: 8 }]);
  const removeBlock = (bi: number) => setStructDraft(prev => prev.filter((_, i) => i !== bi));

  /** Пресет → черновик структуры. HRmax берём из возраста в конфиге (220-age),
   *  без него пресет строит блок без targetHr — никаких выдуманных пульсов. */
  const applyPreset = (presetId: string) => {
    const p = getCardioIntervalPreset(presetId);
    if (!p) return;
    // Мед-гейт действует и на пресеты: иначе можно было бы обойти запрет
    // HIIT/MISS, применив протокол в обход селекта типа.
    if (!hiitGate.allowed && (p.sessionType === 'hiit' || p.sessionType === 'miss')) {
      flashMsg(`⛔ ${hiitGate.reason ?? 'HIIT/MISS запрещены мед-скринингом'} — протокол «${p.title}» не применён`);
      return;
    }
    const age = cycle?.config?.age;
    const hrMax = typeof age === 'number' && age > 0 ? maxHrClassic(age, cycle?.config?.sex) : undefined;
    setStructDraft([p.build(hrMax ? { hrMax } : {})]);
    setStructTypeDraft(p.sessionType);
  };

  const saveStructure = (idx: number) => {
    const s = week?.sessions[idx];
    if (!s) return;
    const blocks = normalizeStructureBlocks(structDraft);
    const label = cardioStructuredLabel(blocks);
    const mainSec = cardioStructuredMainSec(blocks);
    // Структура не обрезается никогда: длительность сессии поднимаем до неё
    // (разминка/заминка тогда — только остаток бюджета).
    const needMin = Math.max(5, Math.ceil(mainSec / 60));
    const dur = Math.max(s.durationMin, needMin);
    updateSession(idx, {
      structured: blocks.length > 0 ? blocks : undefined,
      durationMin: dur,
      purpose: withStructNote(s.purpose, label),
      ...(structTypeDraft && structTypeDraft !== s.type ? { type: structTypeDraft } : {}),
    });
    setStructIdx(null);
    setStructDraft([]);
    setStructTypeDraft(null);
    if (needMin > s.durationMin) {
      flashMsg(`⚡ Структура сохранена · сессия увеличена до ${dur} мин, чтобы все отрезки влезли`);
    } else {
      flashMsg(label ? `⚡ Структура сохранена: ${label}` : '⚡ Интервалы убраны — ровный темп');
    }
  };

  /**
   * Прогрессия структуры по остальным неделям: та же работа/отдых, но +1
   * повтор за каждые 2 недели после текущей (не больше +50% и 30 повторов).
   * Длительность сессии поднимается, если основная часть не влезает.
   * Одно явное действие с версией для отмены — никакой «магии» в фоне.
   */
  const progressAcrossWeeks = (idx: number) => {
    const src = week?.sessions[idx];
    const blocks = normalizeStructureBlocks(structDraft);
    if (!cycle || !week || !src || blocks.length === 0) return;
    const nextType = structTypeDraft ?? src.type;
    // Прогрессия пишет цикл напрямую, минуя updateSession: мед-гейт нужно
    // проверить здесь же, иначе протокол HIIT/MISS раскладывался бы на все
    // недели в обход запрета по скринингу.
    if (!hiitGate.allowed && (nextType === 'hiit' || nextType === 'miss')) { gateFlash(nextType); return; }
    // Не затираем чужой протокол: раскладываем только на сессии того же типа,
    // у которых структуры нет или она ровно такая же, как у исходной.
    const srcSig = JSON.stringify(src.structured ?? []);
    const sameStruct = (s: CardioSession) => !s.structured || JSON.stringify(s.structured) === srcSig;
    saveCardioCycleVersion(cycle, `прогрессия структуры с недели ${week.week}`);
    let touched = 0;
    const weeks = cycle.weeks.map(w => {
      if (w.week < week.week) return w;
      const elapsed = w.week - week.week;
      const sessions = w.sessions.map((s, si) => {
        const isSource = w.week === week.week && si === idx;
        if (!isSource && (s.type !== nextType || !sameStruct(s))) return s;
        const scaled = blocks.map(b => ({
          ...b,
          reps: Math.max(1, Math.min(30, b.reps + Math.min(Math.floor(elapsed / 2), Math.ceil(b.reps * 0.5)))),
        }));
        const mainSec = cardioStructuredMainSec(scaled);
        const dur = Math.max(s.durationMin, Math.ceil(mainSec / 60));
        touched++;
        return {
          ...s,
          type: nextType,
          structured: scaled,
          durationMin: dur,
          kcalPerSession: kcalForCardio(nextType, dur, bw, s.equipment, csex, ffm),
          purpose: withStructNote(s.purpose, cardioStructuredLabel(scaled)) ?? s.purpose,
        };
      });
      return rebuildTotals({ ...w, sessions });
    });
    const next = rebuildCycle({ ...cycle, weeks });
    saveCardioCycle(next);
    setActiveCardioCycle(next);
    setStructIdx(null);
    setStructDraft([]);
    setStructTypeDraft(null);
    onChanged?.();
    flashMsg(`📈 Структура разложена на ${touched} сессий: +1 повтор каждые 2 недели (отмена — «↩ Вернуть»)`);
  };

  /** Восстановление конкретной версии: первый тап — подтверждение, второй — вернуть. */
  const restoreVersionRow = (vid: string) => {
    if (!cycle) return;
    if (confirmVerId !== vid) { setConfirmVerId(vid); return; }
    const restored = restoreCardioCycleVersionById(vid);
    if (!restored) { flashMsg('⚠ Версия не найдена'); setConfirmVerId(null); return; }
    // Текущее состояние тоже сохраняем, чтобы восстановление было обратимым.
    saveCardioCycleVersion(cycle, 'перед восстановлением версии');
    saveCardioCycle(restored);
    setActiveCardioCycle(restored);
    setConfirmVerId(null);
    onChanged?.();
    flashMsg('↩ Версия восстановлена');
  };

  if (!cycle || !week) return null;

  const versions = histOpen ? cardioCycleVersions(cycle.id) : [];
  const draftLabel = cardioStructuredLabel(structDraft);
  const draftMainSec = cardioStructuredMainSec(structDraft);
  const draftNeedMin = Math.max(5, Math.ceil(draftMainSec / 60));

  const onDragStart = (idx: number) => setDragIdx(idx);
  const onDragOverDay = (day: number, e: React.DragEvent) => { e.preventDefault(); setDragOverDay(day); };
  const onDropDay = (day: number, e: React.DragEvent) => {
    e.preventDefault();
    if (dragIdx == null || !cycle || !week) return;
    const idx = dragIdx;
    setDragIdx(null);
    setDragOverDay(null);
    // PRO (аудит Oct 2026): drag-and-drop теперь идёт через движок
    // `moveCardioSessionInWeek` (единая точка: итоги недели/цикла
    // пересчитываются там же, где и во всех адаптациях) — было ad-hoc
    // обновление dayOfWeek через updateSession.
    try {
      saveCardioCycleVersion(cycle, `перенос сессии на ${DAY_LABELS_RU[day]}`);
      const next = moveCardioSessionInWeek(cycle, week.week, idx, day);
      if (!next) { flashMsg('⚠ Не удалось перенести сессию'); return; }
      saveCardioCycle(next);
      setActiveCardioCycle(next);
      onChanged?.();
      flashMsg(`↔ Сессия перенесена на ${DAY_LABELS_RU[day]}`);
    } catch { flashMsg('⚠ Не удалось перенести сессию'); }
  };

  return (
    <div style={CARD}>
      <style>{`@media (max-width:480px){.cardio-day-grid{display:grid!important;grid-template-columns:repeat(4,1fr)}.cardio-day-grid>div{min-width:0!important}}`}</style>
      <div style={ROW}>
        <span style={LABEL}>🛠 Конструктор недели</span>
        <button style={BTN_SMALL} onClick={() => setWeekNo(Math.max(1, weekNo - 1))} aria-label="Предыдущая неделя">−</button>
        <span style={{ fontSize: 13, fontWeight: 850, minWidth: 30, textAlign: 'center' }}>{week.week}</span>
        <button style={BTN_SMALL} onClick={() => setWeekNo(Math.min(cycle.totalWeeks, weekNo + 1))} aria-label="Следующая неделя">+</button>
        <button style={BTN_SMALL} onClick={goCurrentWeek} title="К текущей неделе" aria-label="К текущей неделе">📍 Сегодня</button>
        <span style={{ fontSize: 11, color: '#fff', fontWeight: 600 }}>{CARDIO_PHASE_LABELS[week.phase]}{week.deload ? ' · делод' : ''}{week.taper ? ' · taper' : ''} · {week.totalMinutes} мин</span>
      </div>
      {flash && <div style={{ color: '#4ade80', fontSize: 11, fontWeight: 700 }} role="status">{flash}</div>}
      {safety.length > 0 && safety.map((s, i) => (
        <div key={i} style={{ fontSize: 11, color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '6px 8px' }} role="alert">⚠ {s}</div>
      ))}
      {legConflicts.length > 0 && (
        <div style={{ fontSize: 11, color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '6px 8px' }} role="alert">
          ⚠ Сессии на дне ног ({legConflicts.map(c => DAY_LABELS_RU[c.dayOfWeek]).join(', ')}) — перетащите сессию на свободный день (DnD).
        </div>
      )}

      <div className="cardio-day-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
        {DAY_LABELS_RU.map((d, i) => {
          const isLeg = legDays.has(i);
          const sess = days.filter(s => s.dayOfWeek === i);
          const isOver = dragOverDay === i;
          const isConflict = isLeg && sess.some(s => s.type !== 'recovery');
          return (
            <div
              key={d}
              data-day={i}
              onDragOver={e => onDragOverDay(i, e)}
              onDragLeave={() => setDragOverDay(null)}
              onDrop={e => onDropDay(i, e)}
              onTouchMove={e => { const t = e.touches[0]; if (!t) return; const el = document.elementFromPoint(t.clientX, t.clientY) as HTMLElement | null; const dayEl = el?.closest('[data-day]') as HTMLElement | null; if (dayEl?.dataset.day) setDragOverDay(Number(dayEl.dataset.day)); }}
              onTouchEnd={() => { if (dragIdx != null && dragOverDay != null) updateSession(dragIdx, { dayOfWeek: dragOverDay }); setDragIdx(null); setDragOverDay(null); }}
              onTouchCancel={() => { setDragIdx(null); setDragOverDay(null); }}
              style={{
                ...DAY_CELL,
                ...(isLeg ? { background: isConflict ? 'rgba(239,68,68,0.09)' : 'rgba(245,158,11,0.08)', border: isConflict ? '1px solid rgba(239,68,68,0.38)' : '1px solid rgba(245,158,11,0.32)' } : {}),
                ...(isOver ? { background: 'rgba(0,230,138,0.12)', border: '1px solid rgba(0,230,138,0.45)', boxShadow: '0 0 10px rgba(0,230,138,0.18)' } : {}),
              }}
            >
              <div style={{ color: isLeg ? '#fbbf24' : '#fff', fontWeight: 800, fontSize: 11 }}>{d}{isLeg ? ' 🦵' : ''}</div>
              {sess.length === 0 ? <div style={{ color: 'rgba(255,255,255,0.22)', fontSize: 11, marginTop: 4 }}>—</div> : sess.map((s, j) => (
                <div key={j} style={{ color: isLeg && s.type !== 'recovery' ? '#f87171' : '#4ade80', fontWeight: 700, fontSize: 10, whiteSpace: 'nowrap', background: `${isLeg && s.type !== 'recovery' ? 'rgba(239,68,68,0.12)' : 'rgba(0,230,138,0.08)'}`, border: `1px solid ${isLeg && s.type !== 'recovery' ? 'rgba(239,68,68,0.24)' : 'rgba(0,230,138,0.18)'}`, borderRadius: 6, padding: '1px 4px' }}>{TYPE_SHORT[s.type]} {s.durationMin}м{s.structured && s.structured.length > 0 ? ' ⚡' : ''}</div>
              ))}
              {isOver && <div style={{ fontSize: 8, color: '#00e68a', fontWeight: 700 }}>⇣ сюда</div>}
            </div>
          );
        })}
      </div>

      <div style={ROW}>
        <button style={BTN_SMALL} onClick={() => scaleMinutes(0.9)} title="−10% минут на неделе">−10% мин</button>
        <button style={{ ...BTN_PRIMARY, minHeight: 44, padding: '6px 12px', fontSize: 11 } as never} onClick={() => scaleMinutes(1.1)} title="+10% минут на неделе">+10% мин</button>
        <button style={BTN_SMALL} onClick={() => setEditSessions(v => !v)}>{editSessions ? '▾ Скрыть сессии' : '✏️ Редактировать сессии'}</button>
        {week.week < cycle.totalWeeks && <button style={BTN_SMALL} onClick={copyToNext} title="Скопировать сессии недели в следующую">⧉ В след. неделю</button>}
        {hasVersion && <button style={BTN_SMALL} onClick={undoVersion} title="Отменить последнюю правку">↩ Вернуть</button>}
        <button style={BTN_SMALL} onClick={() => { setHistOpen(v => !v); setConfirmVerId(null); }} aria-expanded={histOpen} title="Все сохранённые версии этого цикла">
          🕘 История{hasVersion ? ` (${cardioCycleVersions(cycle.id).length})` : ''}
        </button>
      </div>

      {histOpen && (
        <div data-cardio="week-history" style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '8px 10px', borderRadius: 10, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.24)' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#93c5fd' }}>🕘 Версии цикла — новые сверху</div>
          {versions.length === 0 && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Пока нет версий: они создаются перед каждой правкой недели/подстройкой.</div>}
          {versions.map(v => (
            <div key={v.id} style={{ ...ROW, gap: 6 }}>
              <span style={{ fontSize: 10.5, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{fmtVersionAt(v.savedAt)}</span>
              <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.72)', flex: '1 1 90px', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={v.reason}>{v.reason}</span>
              <button
                style={{ ...BTN_SMALL, ...(confirmVerId === v.id ? { border: '1px solid rgba(239,68,68,0.5)', color: '#fca5a5' } : {}) }}
                onClick={() => restoreVersionRow(v.id)}
                aria-label={confirmVerId === v.id ? 'Подтвердить восстановление версии' : 'Восстановить версию'}
              >
                {confirmVerId === v.id ? 'Точно вернуть?' : '↩ Вернуть'}
              </button>
            </div>
          ))}
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', lineHeight: 1.45 }}>Хранится до 10 версий на цикл; при восстановлении текущее состояние тоже сохраняется в историю.</div>
        </div>
      )}

      {editSessions && (
        <div role="list" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={HINT_SM}>Перетащите строку на день недели выше, или выберите день в селекте. DnD — быстрый перенос. Клавиатура: ←/→ перемещает день.</div>
          {!hiitGate.allowed && (
            <div role="status" data-cardio="week-intense-block"
              style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.30)', borderLeft: '3px solid #f87171', color: '#fca5a5', fontSize: 12, fontWeight: 700, lineHeight: 1.5 }}>
              ⛔ {hiitGate.reason} — HIIT/MISS недоступны (только Zone 2 / recovery).
            </div>
          )}
          {week.sessions.map((s, idx) => {
            const structLabel = cardioStructuredLabel(s.structured);
            const isOpen = structIdx === idx;
            const draftTooLong = draftMainSec > s.durationMin * 60;
            return (
              <div key={idx} role="listitem" style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '5px 6px', background: 'rgba(255,255,255,0.02)' }}>
                <div aria-grabbed={dragIdx === idx} tabIndex={0} onKeyDown={e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); const cur = s.dayOfWeek ?? 0; const next = (cur + (e.key === 'ArrowLeft' ? -1 : 1) + 7) % 7; updateSession(idx, { dayOfWeek: next }); } }} style={{ ...ROW, opacity: dragIdx === idx ? 0.6 : 1, border: dragIdx === idx ? '1px dashed rgba(0,230,138,0.35)' : '1px solid transparent', borderRadius: 8, padding: '4px 0' }} draggable onTouchStart={() => setDragIdx(idx)} onTouchEnd={() => setDragIdx(null)} onDragStart={() => onDragStart(idx)} onDragEnd={() => setDragIdx(null)} title="Перетащите на день недели (мышь/touch) или используйте ←/→ для перемещения">
                  <span style={{ cursor: 'grab', fontSize: 12, color: '#fff', padding: '0 4px', userSelect: 'none' }} aria-hidden>⋮⋮</span>
                  <SelectInput value={s.type} onChange={v => updateSession(idx, { type: v as CardioType })} ariaLabel={`Тип сессии ${idx + 1}`} width={110}
                    options={TYPES.filter(t => hiitGate.allowed || s.type === t || (t !== 'hiit' && t !== 'miss')).map(t => ({ value: t, label: TYPE_LABEL[t] }))} />
                  <SelectInput value={s.dayOfWeek != null ? String(s.dayOfWeek) : ''} onChange={v => updateSession(idx, { dayOfWeek: v === '' ? undefined : Number(v) })} ariaLabel={`День недели сессии ${idx + 1}`} width={110}
                    options={[{ value: '', label: 'Авто' }, ...DAY_LABELS_RU.map((d, di) => ({ value: String(di), label: `${d}${legDays.has(di) ? ' (ноги)' : ''}` }))]} />
                  {s.dayOfWeek != null && legDays.has(s.dayOfWeek) && s.type !== 'recovery' && (
                    <span style={{ fontSize: 10, color: '#f87171', fontWeight: 700 }} title="День тяжёлых ног — интенсивное кардио лучше перенести">⚠ ноги</span>
                  )}
                  <input type="number" value={s.durationMin} onChange={e => updateSession(idx, { durationMin: Math.max(5, Math.min(180, Number(e.target.value) || 30)) })} inputMode="numeric" style={NUM} aria-label={`Минуты сессии ${idx + 1}`} />
                  <span style={{ fontSize: 10, color: '#fff' }}>мин ×</span>
                  <button style={{ ...BTN, minHeight: 44, minWidth: 44, padding: '4px 8px' }} onClick={() => updateSession(idx, { weeklyFrequency: Math.max(1, s.weeklyFrequency - 1) })} aria-label="Меньше частоты">−</button>
                  <span style={{ fontSize: 12, fontWeight: 800, minWidth: 16, textAlign: 'center' }}>{s.weeklyFrequency}</span>
                  <button style={{ ...BTN, minHeight: 44, minWidth: 44, padding: '4px 8px' }} onClick={() => updateSession(idx, { weeklyFrequency: Math.min(7, s.weeklyFrequency + 1) })} aria-label="Больше частоты">+</button>
                  <span style={{ fontSize: 10, color: '#fff' }}>в нед</span>
                  <button style={BTN_DANGER} onClick={() => removeSession(idx)} aria-label={`Удалить сессию ${idx + 1}`}>✕</button>
                </div>
                <div style={{ ...ROW, marginTop: 2 }}>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>⚙ Оборудование</span>
                  <SelectInput
                    value={s.equipment ?? ''}
                    onChange={v => updateSession(idx, { equipment: (v || undefined) as CardioEquipment | undefined })}
                    ariaLabel={`Оборудование сессии ${idx + 1}`}
                    width={140}
                    options={[{ value: '', label: 'Авто' }, ...CARDIO_EQUIPMENT_OPTIONS.map(e => ({ value: e.id, label: `${e.icon} ${e.label}` }))]}
                  />
                  <button
                    style={{ ...BTN_SMALL, flex: '1 1 150px', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...(structLabel ? { border: '1px solid rgba(0,230,138,0.42)' } : {}) }}
                    onClick={() => openStructure(idx)}
                    aria-expanded={isOpen}
                    aria-label={`Интервалы сессии ${idx + 1}`}
                    title="Структура интервалов: работа / отдых / повторы. Таймер пойдёт по отрезкам."
                  >
                    {structLabel ? `⚡ ${structLabel}` : '⚡ Интервалы (ровный темп)'}
                  </button>
                </div>
                <div style={{ ...ROW, marginTop: 2 }}>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>📝 Цель</span>
                  <PurposeField purpose={s.purpose} index={idx} onCommit={v => updateSession(idx, { purpose: v })} />
                </div>
                {isOpen && (
                  <div data-cardio="week-structured" style={{ marginTop: 6, padding: '9px 10px', borderRadius: 10, background: 'rgba(0,230,138,0.05)', border: '1px solid rgba(0,230,138,0.24)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 850, color: '#fff' }}>⚡ Структура: работа / отдых / повторы</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.62)', lineHeight: 1.45 }}>
                      Таймер ведёт по этим отрезкам. Разминка и заминка — из остатка длительности (до 20 мин каждая); сама структура не обрезается.
                    </div>
                    <div style={ROW}>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>Протокол</span>
                      <SelectInput value="" onChange={applyPreset} ariaLabel={`Пресет интервалов ${idx + 1}`} width={190}
                        options={[{ value: '', label: '— выбрать протокол —' }, ...CARDIO_INTERVAL_PRESETS.map(p => ({ value: p.id, label: p.title }))]} />
                    </div>
                    {structTypeDraft && structTypeDraft !== s.type && (
                      <div style={{ fontSize: 10.5, color: '#fbbf24', fontWeight: 700 }}>При сохранении тип сессии станет «{TYPE_LABEL[structTypeDraft]}» — так требует протокол.</div>
                    )}
                    {structDraft.length === 0 && (
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Отрезков нет — сессия идёт ровным темпом.</div>
                    )}
                    {structDraft.map((b, bi) => (
                      <div key={bi} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 0', borderTop: bi > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                        <div style={ROW}>
                          <input type="number" inputMode="numeric" value={b.workSec}
                            onChange={e => patchBlock(bi, { workSec: clampInt(Number(e.target.value), 5, 1800) })}
                            style={NUM} aria-label={`Работа отрезка ${bi + 1}, секунд`} />
                          <span style={{ fontSize: 10, color: '#fff' }}>с работа /</span>
                          <input type="number" inputMode="numeric" value={b.restSec}
                            onChange={e => patchBlock(bi, { restSec: clampInt(Number(e.target.value), 0, 1800) })}
                            style={NUM} aria-label={`Отдых отрезка ${bi + 1}, секунд`} />
                          <span style={{ fontSize: 10, color: '#fff' }}>с отдых ×</span>
                          <input type="number" inputMode="numeric" value={b.reps}
                            onChange={e => patchBlock(bi, { reps: clampInt(Number(e.target.value), 1, 30) })}
                            style={{ ...NUM, width: 54 }} aria-label={`Повторов отрезка ${bi + 1}`} />
                          <button style={BTN_DANGER} onClick={() => removeBlock(bi)} aria-label={`Удалить отрезок ${bi + 1}`}>✕</button>
                        </div>
                        <div style={ROW}>
                          <SelectInput value={b.target ?? ''} onChange={v => patchBlock(bi, v
                            ? { target: v as NonNullable<CardioStructuredBlock['target']>, ...(v !== 'hr' ? { targetHr: undefined } : {}) }
                            : { target: undefined, targetHr: undefined })}
                            ariaLabel={`Цель отрезка ${bi + 1}`} width={115} options={TARGET_OPTIONS} />
                          {b.target === 'hr' && (
                            <>
                              <input type="number" inputMode="numeric" value={b.targetHr?.min ?? ''} placeholder="от"
                                onChange={e => { const n = Number(e.target.value); patchBlock(bi, { targetHr: { ...b.targetHr, min: e.target.value === '' ? undefined : clampInt(n, 80, 220) } }); }}
                                style={{ ...NUM, width: 62 }} aria-label={`Пульс от отрезка ${bi + 1}`} />
                              <span style={{ fontSize: 10, color: '#fff' }}>–</span>
                              <input type="number" inputMode="numeric" value={b.targetHr?.max ?? ''} placeholder="до"
                                onChange={e => { const n = Number(e.target.value); patchBlock(bi, { targetHr: { ...b.targetHr, max: e.target.value === '' ? undefined : clampInt(n, 80, 220) } }); }}
                                style={{ ...NUM, width: 62 }} aria-label={`Пульс до отрезка ${bi + 1}`} />
                              <span style={{ fontSize: 10, color: '#fff' }}>уд/мин</span>
                            </>
                          )}
                          <input value={b.note ?? ''} onChange={e => patchBlock(bi, { note: e.target.value })}
                            placeholder="примечание (таймер покажет)" aria-label={`Примечание отрезка ${bi + 1}`}
                            style={{ ...SEL, flex: '1 1 110px', minWidth: 0 }} />
                        </div>
                      </div>
                    ))}
                    <div style={ROW}>
                      <button style={BTN_SMALL} onClick={addBlock}>+ Отрезок</button>
                      <button style={BTN_SMALL} onClick={() => setStructDraft([])} disabled={structDraft.length === 0}>Очистить</button>
                      <span style={{ flex: 1 }} />
                      <button style={BTN_PRIMARY} onClick={() => saveStructure(idx)}>💾 Сохранить</button>
                    </div>
                    <div style={ROW}>
                      <button style={BTN_SMALL} onClick={() => progressAcrossWeeks(idx)} disabled={structDraft.length === 0} title="Разложить структуру на эту и последующие недели с прогрессией повторов">
                        📈 На все недели (+1 повтор / 2 нед)
                      </button>
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 750, color: draftTooLong ? '#fbbf24' : 'rgba(255,255,255,0.68)', lineHeight: 1.45 }} role="status">
                      {draftLabel ? `${draftLabel} · основная часть ${Math.round(draftMainSec / 60)} мин` : 'Ровный темп'}
                      {draftTooLong
                        ? ` — в ${s.durationMin} мин не влезает: сессия станет ${draftNeedMin} мин (структура не режется)`
                        : ` · в сессии ${s.durationMin} мин остаётся ${Math.max(0, s.durationMin - Math.round(draftMainSec / 60))} мин на разминку/заминку`}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <div style={ROW}>
            <SelectInput value={newType} onChange={v => setNewType(v as CardioType)} ariaLabel="Тип новой сессии" width={130}
              options={TYPES.filter(t => hiitGate.allowed || (t !== 'hiit' && t !== 'miss')).map(t => ({ value: t, label: TYPE_LABEL[t] }))} />
            <SelectInput value={newEquip} onChange={v => setNewEquip(v as CardioEquipment | '')} ariaLabel="Оборудование новой сессии" width={140}
              options={[{ value: '', label: '⚙ Авто' }, ...CARDIO_EQUIPMENT_OPTIONS.map(e => ({ value: e.id, label: `${e.icon} ${e.label}` }))]} />
            <SelectInput value={newDay} onChange={setNewDay} ariaLabel="День новой сессии" width={120}
              options={[{ value: '', label: '📅 Авто' }, ...DAY_LABELS_RU.map((d, di) => ({ value: String(di), label: `${d}${legDays.has(di) ? ' (ноги)' : ''}` }))]} />
            <button style={BTN_PRIMARY} onClick={addSession}>+ Добавить сессию</button>
          </div>
        </div>
      )}

      <div style={{ fontSize: 10, color: '#fff' }}>
        {legDays.size > 0
          ? `🦵 Дни тяжёлых ног: ${DAY_LABELS_RU.filter((_, i) => legDays.has(i)).join(', ')} — интенсивное кардио на них не ставится (recovery — можно в любой день); точные дни задайте в дневнике.`
          : 'Раскладка по дням — ориентировочная (без учёта силовых тренировок); точные дни задайте в дневнике.'}
      </div>
    </div>
  );
};
