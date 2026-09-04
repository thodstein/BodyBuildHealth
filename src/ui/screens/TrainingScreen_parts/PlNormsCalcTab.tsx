import React, { useMemo, useState, useEffect } from 'react';
import {
  getNormTable,
  findCategory,
  findCategoryByLabel,
  classifyTotal,
  classifyTotalForCategory,
  progressToNextRank,
  NORM_EXPLANATIONS,
  RANK_DESCRIPTIONS,
  CATEGORY_EXPLANATION,
  RANK_LABELS,
  AGE_GROUPS,
  eligibleRanksForAge,
  ageEligibilityNote,
  type Federation,
  type Discipline,
  type Sex,
  type AgeGroup,
} from '../../../engines/pl-norms.engine';
import { wilksScore, dotsScore, ipfGLPoints, allometricScore, relativeStrength, liftRelativeStrength } from '../../../engines/pro/relative-strength.engine';
import { calcGlossbrenner } from '../../../engines/pl-points.engine';
import { applyToPlanner } from './planner-bridge';
import { PopupNumber, PopupSelect } from '../SRCBBScreen_parts/TrainingPopups';
import { getProfile } from '../../../core/profile-manager';
import type { HubSnapshot } from './StrengthAnalysisHub';

const ACCENT = '#00e68a';
const DIM = '#fff';
const SMALL: React.CSSProperties = { color: DIM, fontSize: 12, lineHeight: 1.5 };
const CARD: React.CSSProperties = { padding: 12, borderRadius: 12, background: 'rgba(24,24,27,0.5)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 10 };
const SECTION: React.CSSProperties = { fontSize: 10, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 };
const rankColor: Record<string, string> = { КМС: '#60a5fa', МС: '#a855f7', МСМК: '#f59e0b', ЭЛИТА: '#ef4444', 'нет разряда': '#fff' };

const FEDS_ALL: { id: Federation; label: string }[] = [
  { id: 'fpr_ipf', label: 'ФПР / IPF (с ДК)' },
  { id: 'wrpf_untested', label: 'WRPF / СПР (без ДК)' },
  { id: 'wrpf_tested', label: 'WRPF / СПР (с ДК)' },
];
const DISC: { id: Discipline; label: string }[] = [
  { id: 'total', label: 'Троеборье (сумма)' },
  { id: 'bench', label: 'Жим лёжа' },
  { id: 'deadlift', label: 'Становая тяга' },
  { id: 'squat', label: 'Приседания' },
];
const SEX_OPTS: { id: Sex; label: string; desc: string }[] = [
  { id: 'male', label: '♂ Мужчина', desc: 'Категории 53-120+ кг, пороги выше' },
  { id: 'female', label: '♀ Женщина', desc: 'Категории 43-84+ кг, пороги ~60% от мужских' },
];

function explainPoints(scale: string): string {
  if (scale === '0-120') return 'Шкала IPF GoodLift: 60 — КМС, 75 — МС, 85 — МСМК, 100+ — мировой топ. Не простая сумма деленная на вес, а экспоненциальная компенсация веса.';
  return 'Шкала 300-500: 300 новичок, 380 опытный, 450 элита, 520 мировой. Нормирует тотал к весу по полиному 4-5 степени.';
}

interface Props {
  snapshot?: HubSnapshot;
  onSnapshotChange?: (patch: Partial<HubSnapshot>) => void;
}

export const PlNormsCalcTab: React.FC<Props> = ({ snapshot, onSnapshotChange }) => {
  const initialSex = (() => { try { return (getProfile().settings as any)?.personal?.sex === 'female' ? 'female' as Sex : 'male' as Sex; } catch { return 'male' as Sex; } })();
  const [sexLocal, setSexLocal] = useState<Sex>(initialSex);
  const [fed, setFed] = useState<Federation>('fpr_ipf');
  const [disc, setDisc] = useState<Discipline>('total');
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('open');
  const [bwLocal, setBwLocal] = useState<number>(() => { try { return Number((getProfile().settings as any)?.personal?.weight) || 83; } catch { return 83; } });
  const [totalLocal, setTotalLocal] = useState<number>(520);
  const [manualCat, setManualCat] = useState<string>('');
  const [showAllCats, setShowAllCats] = useState(false);
  const [showLifts, setShowLifts] = useState(false);
  const [squatLocal, setSquatLocal] = useState<number>(180);
  const [benchLocal, setBenchLocal] = useState<number>(120);
  const [deadLocal, setDeadLocal] = useState<number>(220);

  // хаб-синхронизация: если snapshot передан — он источник для пол/вес/движений
  const sex: Sex = snapshot ? snapshot.sex : sexLocal;
  const bw: number = snapshot ? snapshot.bw : bwLocal;
  const squat: number = snapshot && showLifts ? snapshot.squat : squatLocal;
  const bench: number = snapshot && showLifts ? snapshot.bench : benchLocal;
  const dead: number = snapshot && showLifts ? snapshot.dead : deadLocal;
  // total: если хаб и не в режиме по движениям — тотал из хаба; иначе локальный
  const hubTotal = snapshot ? snapshot.squat + snapshot.bench + snapshot.dead : 520;
  const total: number = snapshot && !showLifts ? hubTotal : totalLocal;

  // при изменении snapshot — синкнуть локальные состояния (чтобы при выходе из хаба не потерять)
  useEffect(() => {
    if (!snapshot) return;
    setSexLocal(snapshot.sex);
    setBwLocal(snapshot.bw);
    setSquatLocal(snapshot.squat);
    setBenchLocal(snapshot.bench);
    setDeadLocal(snapshot.dead);
    setTotalLocal(snapshot.squat + snapshot.bench + snapshot.dead);
    // WRPF для женщин — скрыт: если сейчас выбрана WRPF, а пол стал женский — переключить на ФПР
    if (snapshot.sex === 'female' && (fed === 'wrpf_untested' || fed === 'wrpf_tested')) {
      setFed('fpr_ipf');
      setManualCat('');
    }
  }, [snapshot?.sex, snapshot?.bw, snapshot?.squat, snapshot?.bench, snapshot?.dead]);

  // WRPF для женщин — скрыть (официальных таблиц нет, было масштабирование ×1.12 — скрываем по требованию)
  const FEDS = useMemo(() => {
    if (sex === 'female') return FEDS_ALL.filter(f => f.id === 'fpr_ipf');
    return FEDS_ALL;
  }, [sex]);

  // если текущая фед стала недоступна — сбросить
  useEffect(() => {
    if (sex === 'female' && fed !== 'fpr_ipf') {
      setFed('fpr_ipf');
      setManualCat('');
      if (disc !== 'total' && disc !== 'bench') setDisc('total');
    }
  }, [sex, fed, disc]);

  const table = useMemo(() => getNormTable(fed, disc, sex), [fed, disc, sex]);
  const autoCat = useMemo(() => table ? findCategory(table, bw) : null, [table, bw]);
  const effectiveCat = useMemo(() => {
    if (!table) return null;
    if (manualCat) {
      const found = findCategoryByLabel(table, manualCat);
      if (found) return found;
    }
    return autoCat;
  }, [table, manualCat, autoCat]);
  const result = useMemo(() => {
    if (!table || !effectiveCat) return null;
    return classifyTotalForCategory(table, effectiveCat, total);
  }, [table, effectiveCat, total]);
  const autoResult = useMemo(() => table && autoCat ? classifyTotalForCategory(table, autoCat, total) : null, [table, autoCat, total]);

  const effectiveTotal = showLifts && disc === 'total' ? squat + bench + dead : total;
  const effectiveResult = useMemo(() => {
    if (!table || !effectiveCat) return result;
    if (showLifts && disc === 'total') return classifyTotalForCategory(table, effectiveCat, effectiveTotal);
    return result;
  }, [table, effectiveCat, effectiveTotal, result, showLifts, disc]);
  const displayResult = effectiveResult || result;
  const displayTotal = effectiveTotal;

  const points = useMemo(() => {
    const w = wilksScore(displayTotal, bw, sex);
    const d = dotsScore(displayTotal, bw, sex);
    const gl = ipfGLPoints(displayTotal, bw, sex);
    const al = allometricScore(displayTotal, bw);
    const rel = relativeStrength(displayTotal, bw);
    const gb = sex === 'male' ? calcGlossbrenner(bw, displayTotal) : 0;
    const list = [
      { label: 'IPF GL', value: gl, scale: '0-120', hint: explainPoints('0-120'), accent: '#00e68a' },
      { label: 'DOTS', value: d, scale: '300-500', hint: explainPoints('300-500'), accent: '#60a5fa' },
      { label: 'Wilks', value: w, scale: '300-500', hint: explainPoints('300-500'), accent: '#a855f7' },
    ];
    if (sex === 'male') {
      list.push({ label: 'Glossbrenner', value: gb, scale: '300-500', hint: 'Только мужские коэффициенты (женские не опубликованы — скрыто для женщин).', accent: '#f59e0b' });
    }
    list.push(
      { label: 'Отн. сила', value: rel, scale: '×BW', hint: 'Тотал / вес тела. 5× у мужчин — элита, 7.5× — мировой. У женщин 3×/4×/5×.', accent: '#ec4899' },
      { label: 'Allometric', value: al, scale: '×BW⅔', hint: 'Тотал / BW^0.67 — учитывает аллометрию.', accent: '#22c55e' },
    );
    return list;
  }, [displayTotal, bw, sex]);

  const availDisc = useMemo(() => {
    if (!table) return DISC;
    if (fed === 'fpr_ipf') {
      if (sex === 'female') return DISC.filter(d => d.id === 'total' || d.id === 'bench');
      return DISC.filter(d => d.id === 'total');
    }
    return DISC;
  }, [fed, sex, table]);

  const progress = useMemo(() => displayResult ? progressToNextRank(displayResult, displayTotal) : 0, [displayResult, displayTotal]);
  const eligibleSet = useMemo(() => new Set(eligibleRanksForAge(ageGroup)), [ageGroup]);
  const ageNoteForDisplay = useMemo(() => displayResult ? ageEligibilityNote(ageGroup, displayResult.achievedRank) : null, [ageGroup, displayResult]);
  const liftsRs = useMemo(() => [
    { key: 'squat' as const, value: squat, rs: liftRelativeStrength(squat, bw) },
    { key: 'bench' as const, value: bench, rs: liftRelativeStrength(bench, bw) },
    { key: 'dead' as const, value: dead, rs: liftRelativeStrength(dead, bw) },
  ], [squat, bench, dead, bw]);

  // бейдж федерации: какой показывать
  const fedBadge = useMemo(() => {
    if (fed === 'fpr_ipf') return { label: 'IPF 2024 → смотрите IPF GL', desc: 'Актуальный для ФПР/IPF с 2019 — DOTS, с 2024 — IPF GL.' };
    if (fed === 'wrpf_untested') return { label: 'WRPF без ДК → смотрите DOTS', desc: 'Коммерческие федерации — DOTS для сравнения.' };
    return { label: 'WRPF с ДК → смотрите DOTS', desc: 'С допинг-контролем — DOTS.' };
  }, [fed]);

  const handleBwChange = (v: number) => {
    const nv = Math.max(30, Math.min(250, v || 30));
    if (snapshot && onSnapshotChange) onSnapshotChange({ bw: nv });
    else setBwLocal(nv);
  };
  const handleSexChange = (v: Sex) => {
    if (snapshot && onSnapshotChange) onSnapshotChange({ sex: v });
    else setSexLocal(v);
    setManualCat('');
  };
  const handleTotalChange = (v: number) => {
    if (snapshot && !showLifts && onSnapshotChange) {
      // распределить тотал пропорционально 44/26/30 на хаб
      const sq = Math.round(v * 0.44);
      const bn = Math.round(v * 0.26);
      const dl = v - sq - bn;
      onSnapshotChange({ squat: sq, bench: bn, dead: dl });
    } else {
      setTotalLocal(v);
    }
  };
  const handleSquatChange = (v: number) => {
    if (snapshot && onSnapshotChange) onSnapshotChange({ squat: v });
    else setSquatLocal(v);
  };
  const handleBenchChange = (v: number) => {
    if (snapshot && onSnapshotChange) onSnapshotChange({ bench: v });
    else setBenchLocal(v);
  };
  const handleDeadChange = (v: number) => {
    if (snapshot && onSnapshotChange) onSnapshotChange({ dead: v });
    else setDeadLocal(v);
  };

  return (
    <div className="train-plnorms" style={{ maxWidth: 760, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: ACCENT, margin: '2px 0 6px' }}>🏆 Калькулятор разрядных нормативов — единый центр</div>
      <div style={{ ...SMALL, marginBottom: 10, background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.12)', borderRadius: 8, padding: 8 }}>
        <b style={{ color: '#fff' }}>Что это:</b> единый калькулятор всех разрядных инструментов из приложения — нормативы по федерации/дисциплине/полу/весовой категории + DOTS/Wilks/IPF GL + прогресс до следующего разряда. Выберите пол, федерацию, движение, свой вес и результат — я покажу разряд, сколько до следующего, очки относительной силы и как читать каждый график (разъяснения под каждым блоком).
        <div style={{ marginTop: 6, fontSize: 10, color: '#fff' }}>
          Источник: ФПР 2022-2025 приказ Минспорта №6 (классический пауэрлифтинг) — КМС/МС/МСМК; WRPF/СПР — без/с ДК. Женские таблицы — только ФПР официально (WRPF для женщин скрыты — официальных таблиц нет).
        </div>
        {snapshot && <div style={{ marginTop: 6, fontSize: 10, color: ACCENT }}>🔗 Питается от единого снапшота хаба: пол/вес/движения берутся из шапки хаба. Изменение здесь обновляет хаб.</div>}
      </div>

      {/* ── Управление ── */}
      <div style={CARD}>
        <div style={SECTION}>⚙️ Параметры расчёта {snapshot ? <span style={{ color: ACCENT, fontWeight: 800 }}>· из хаба</span> : null}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <PopupSelect label="Пол" value={sex} options={SEX_OPTS as any} onChange={v => handleSexChange(v as Sex)} />
          <PopupSelect label="Федерация" value={fed} options={FEDS.map(f => ({ id: f.id, label: f.label }))} onChange={v => { const nf = v as Federation; setFed(nf); setManualCat(''); if (nf === 'fpr_ipf' && disc !== 'total' && sex === 'male') setDisc('total'); }} />
          <PopupSelect label="Дисциплина" value={disc} options={availDisc.map(d => ({ id: d.id, label: d.label }))} onChange={v => { setDisc(v as Discipline); setManualCat(''); }} />
          <PopupSelect label="Возрастная группа" value={ageGroup} options={AGE_GROUPS.map(a => ({ id: a.id, label: a.label, desc: a.desc }))} onChange={v => setAgeGroup(v as AgeGroup)} />
          <PopupSelect
            label="Весовая категория (просмотр)"
            value={manualCat || '__auto'}
            options={[{ id: '__auto', label: autoCat ? `Авто: ${autoCat.label} (по ${bw} кг)` : 'Авто' }, ...(table?.categories.map(c => ({ id: c.label, label: c.label })) || [])]}
            onChange={v => setManualCat(v === '__auto' ? '' : v)}
          />
          <PopupNumber label="Собственный вес, кг" value={bw} min={30} max={250} suffix=" кг" onChange={handleBwChange} />
          <PopupNumber label="Сумма / результат, кг" value={total} min={0} max={1500} step={2.5} suffix=" кг" onChange={handleTotalChange} />
        </div>
        {sex === 'female' && (
          <div style={{ marginTop: 8, padding: '6px 8px', borderRadius: 8, background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.18)', fontSize: 10, color: '#94a3b8' }}>
            ℹ️ WRPF для женщин скрыты — официальных таблиц нет (ранее показывались как масштабирование ×1.12/0.55). Доступна только ФПР/IPF (проверенные нормативы). Glossbrenner для женщин скрыт (коэффициенты не опубликованы).
          </div>
        )}
        <div style={{ fontSize: 10, color: '#fff', marginTop: 8, lineHeight: 1.45 }}>
          <b style={{ color: '#fff' }}>Как выбрать категорию:</b> {CATEGORY_EXPLANATION} Переключите «Весовая категория» с Авто на любую для просмотра «что если» — пороги пересчитаются без смены вашего веса.
        </div>
        {manualCat && autoCat && manualCat !== autoCat.label && autoResult && result && (
          <div style={{ marginTop: 6, padding: '6px 8px', borderRadius: 8, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', fontSize: 11, color: '#f59e0b' }}>
            ⚠️ Просмотр категории «{manualCat}» отличается от вашей авто-категории «{autoCat.label}» (по весу {bw} кг вы в «{autoCat.label}»). Разряд по авто-категории: <b>{autoResult.achievedLabel}</b> (до {autoResult.nextLabel}: {autoResult.kgToNext} кг).
          </div>
        )}
        {(() => {
          const note = displayResult ? ageEligibilityNote(ageGroup, displayResult.achievedRank) : null;
          return note ? (
            <div style={{ marginTop: 6, padding: '6px 8px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', fontSize: 11, color: '#ef4444' }}>
              ⚠️ Возраст {AGE_GROUPS.find(a => a.id === ageGroup)?.label}: {note}
            </div>
          ) : null;
        })()}
        {disc === 'total' && (
          <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.16)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#a855f7' }}>
              <input type="checkbox" checked={showLifts} onChange={e => setShowLifts(e.target.checked)} style={{ accentColor: '#a855f7' }} />
              🏋️ Режим «по движениям» — ввести присед/жим/тягу отдельно
            </label>
            {showLifts ? (
              <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <PopupNumber label="Присед, кг" value={squat} min={0} suffix=" кг" onChange={handleSquatChange} />
                <PopupNumber label="Жим, кг" value={bench} min={0} suffix=" кг" onChange={handleBenchChange} />
                <PopupNumber label="Тяга, кг" value={dead} min={0} suffix=" кг" onChange={handleDeadChange} />
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '6px 8px', borderRadius: 8, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.15)', fontSize: 11, color: DIM }}>
                  Тотал = {squat} + {bench} + {dead} = <b style={{ color: ACCENT }}>{effectiveTotal} кг</b> {snapshot ? '· из хаба' : ''} (используется для разряда и очков).
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 10, color: '#fff', marginTop: 4 }}>Включите, чтобы разложить тотал на три движения и увидеть относительную силу по каждому (график ×BW) и слабейшее движение.</div>
            )}
          </div>
        )}
      </div>

      {displayResult && effectiveCat && table && (
        <>
          <div style={{ padding: 14, borderRadius: 14, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.25)', marginBottom: 10, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{ fontSize: 10, color: '#fff', letterSpacing: 0.3, textTransform: 'uppercase' }}>
              {sex === 'female' ? '♀ Женщины' : '♂ Мужчины'} · {table.federationLabel} · {DISC.find(d => d.id === disc)?.label} · Категория: {effectiveCat.label} {showLifts && disc === 'total' ? `· сумма ${displayTotal} кг` : ''}
            </div>
            <div style={{ fontSize: 30, fontWeight: 900, color: rankColor[displayResult.achievedLabel] || ACCENT, margin: '4px 0 2px' }}>{displayResult.achievedLabel}</div>
            <div style={{ fontSize: 12, color: '#fff' }}>
              {displayResult.achievedRank ? (
                displayResult.kgToNext > 0 ? <>до <b style={{ color: '#f59e0b' }}>{displayResult.nextLabel}</b>: <b>{displayResult.kgToNext} кг</b> <span style={{ color: '#fff' }}>({displayResult.allRanks.find(r => r.key === displayResult.nextRank)?.threshold} кг порог)</span></> : 'высший разряд норматива — вы на вершине этой категории'
              ) : (
                <>до <b style={{ color: '#60a5fa' }}>{displayResult.nextLabel}</b>: <b>{displayResult.kgToNext} кг</b> <span style={{ color: '#fff' }}>({displayResult.allRanks[0]?.threshold} кг порог)</span></>
              )}
            </div>
            <div style={{ marginTop: 10, textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#fff', marginBottom: 3 }}>
                <span>Прогресс к следующему разряду</span>
                <span>{displayResult.achievedRank ? displayResult.achievedLabel : 'старт'} → {displayResult.nextLabel} · {Math.round(progress)}%</span>
              </div>
              <div style={{ height: 8, borderRadius: 6, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ height: '100%', width: `${Math.min(100, Math.max(2, progress))}%`, borderRadius: 6, background: displayResult.kgToNext === 0 ? '#22c55e' : 'linear-gradient(90deg,#60a5fa,#a855f7)', transition: 'width 0.35s', opacity: displayResult.kgToNext === 0 ? 0.9 : 1 }} />
              </div>
            </div>
            {table.sourceNote && <div style={{ fontSize: 9, color: '#fff', marginTop: 6 }}>{table.sourceNote}</div>}
          </div>

          <div style={{ ...CARD, background: 'rgba(59,130,246,0.05)', borderColor: 'rgba(59,130,246,0.16)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', marginBottom: 4 }}>🧭 Как читать главный блок</div>
            <div style={{ fontSize: 11, color: DIM, lineHeight: 1.5 }}>
              <b style={{ color: '#fff' }}>Категория</b> — ваша весовая категория (авто по весу или ручной выбор). На соревнованиях вес фиксируется на взвешивании — от неё зависит порог.<br />
              <b style={{ color: '#fff' }}>Разряд</b> — высший выполненный порог в этой категории. Пороги идут по возрастанию: КМС &lt; МС &lt; МСМК &lt; ЭЛИТА (Элита только WRPF без ДК).<br />
              <b style={{ color: '#fff' }}>До следующего</b> — разница: порог_следующего − ваш результат.<br />
              <b style={{ color: '#fff' }}>Прогресс-бар</b> — доля пути от текущего разряда до следующего.
            </div>
          </div>

          <div style={CARD}>
            <div style={SECTION}>📊 Нормативы категории {effectiveCat.label} — пороги по разрядам</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {displayResult.allRanks.map(r => {
                const isAchieved = r.achieved;
                const isNext = r.key === displayResult.nextRank;
                const isEligible = eligibleSet.has(r.key);
                return (
                  <div key={r.key} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 12px', borderRadius: 10,
                    background: !isEligible ? 'rgba(255,255,255,0.015)' : isAchieved ? 'rgba(0,230,138,0.08)' : isNext ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.03)',
                    border: '1px solid ' + (!isEligible ? 'rgba(255,255,255,0.03)' : isAchieved ? 'rgba(0,230,138,0.25)' : isNext ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.05)'),
                    opacity: !isEligible ? 0.45 : 1,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 6, height: 28, borderRadius: 6, background: rankColor[r.label] || '#555', opacity: isEligible ? (isAchieved ? 1 : 0.6) : 0.2 }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: !isEligible ? '#fff' : isAchieved ? ACCENT : isNext ? '#f59e0b' : '#fff' }}>{isAchieved ? '✓ ' : ''}{r.label} {isNext && isEligible ? '← цель' : ''} {!isEligible ? '⛔' : ''}</div>
                        <div style={{ fontSize: 10, color: '#fff' }}>{RANK_DESCRIPTIONS[r.key]} {!isEligible ? '— недоступен' : ''}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: !isEligible ? '#fff' : isAchieved ? ACCENT : isNext ? '#f59e0b' : '#fff' }}>{r.threshold} кг</div>
                      <div style={{ fontSize: 10, color: !isEligible ? 'rgba(255,255,255,0.25)' : isAchieved ? '#22c55e' : isNext ? '#f59e0b' : '#fff' }}>{!isEligible ? 'недоступен' : isAchieved ? `выполнен (+${(displayTotal - r.threshold).toFixed(1)} кг)` : `нужно +${(r.threshold - displayTotal).toFixed(1)} кг`}</div>
                    </div>
                  </div>
                );
              })}
              {ageNoteForDisplay && (
                <div style={{ marginTop: 6, padding: '6px 8px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', fontSize: 11, color: '#f87171' }}>
                  ⚠️ {ageNoteForDisplay}
                </div>
              )}
            </div>
          </div>

          <div style={CARD}>
            <div style={SECTION}>🏆 Очки относительной силы — сравнение вне категорий ({sex === 'female' ? '♀ женские коэффициенты' : '♂ мужские коэффициенты'}) <span style={{ fontSize: 9, color: '#f59e0b', background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.18)', borderRadius: 6, padding: '2px 6px', marginLeft: 6 }}>{fedBadge.label}</span></div>
            <div style={{ fontSize: 10, color: '#f59e0b', marginBottom: 6 }}>{fedBadge.desc} {sex === 'female' ? 'Glossbrenner скрыт.' : 'Wilks — устарел (до 2019), смотрите DOTS/IPF GL.'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {points.map(p => (
                <div key={p.label} style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa' }}>{p.label}</div>
                    <div style={{ fontSize: 10, color: '#fff' }}>{p.scale}</div>
                    <div style={{ fontSize: 9, color: '#fff', marginTop: 2, lineHeight: 1.3 }}>{p.hint}</div>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#60a5fa', marginLeft: 8 }}>{p.value}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.12)', fontSize: 11, color: DIM, lineHeight: 1.45 }}>
              <b style={{ color: '#fff' }}>Что это и зачем:</b> {NORM_EXPLANATIONS.points} <br />
              <b style={{ color: '#fff' }}>Как интерпретировать:</b> не смотрите только на тотал — 600 кг при 60 кг (DOTS ~520, IPF GL ~95) сильнее, чем 700 кг при 110 кг (DOTS ~430, GL ~78). Сравнивайте именно DOTS/IPF GL.<br />
            </div>
          </div>

          {showLifts && disc === 'total' && (
            <div style={CARD}>
              <div style={SECTION}>📊 Относительная сила по движениям — × веса тела</div>
              {liftsRs.map(l => {
                const maxVal = l.key === 'squat' ? 3.2 : l.key === 'bench' ? 2.2 : 3.8;
                const barPct = Math.min(100, (l.rs / maxVal) * 100);
                const clr = l.key === 'squat' ? '#ef4444' : l.key === 'bench' ? '#3b82f6' : '#f59e0b';
                const label = l.key === 'squat' ? 'Присед' : l.key === 'bench' ? 'Жим лёжа' : 'Тяга';
                const cls = (() => {
                  if (sex === 'female') {
                    if (l.key === 'squat') return l.rs >= 2.2 ? 'Мир. класс' : l.rs >= 1.8 ? 'Элита' : l.rs >= 1.4 ? 'Опытный' : l.rs >= 1.0 ? 'Средний' : 'Новичок';
                    if (l.key === 'bench') return l.rs >= 1.4 ? 'Мир. класс' : l.rs >= 1.1 ? 'Элита' : l.rs >= 0.85 ? 'Опытный' : l.rs >= 0.6 ? 'Средний' : 'Новичок';
                    return l.rs >= 2.8 ? 'Мир. класс' : l.rs >= 2.2 ? 'Элита' : l.rs >= 1.8 ? 'Опытный' : l.rs >= 1.3 ? 'Средний' : 'Новичок';
                  } else {
                    if (l.key === 'squat') return l.rs >= 3.0 ? 'Мир. класс' : l.rs >= 2.5 ? 'Элита' : l.rs >= 2.0 ? 'Опытный' : l.rs >= 1.5 ? 'Средний' : 'Новичок';
                    if (l.key === 'bench') return l.rs >= 2.0 ? 'Мир. класс' : l.rs >= 1.6 ? 'Элита' : l.rs >= 1.3 ? 'Опытный' : l.rs >= 1.0 ? 'Средний' : 'Новичок';
                    return l.rs >= 3.5 ? 'Мир. класс' : l.rs >= 3.0 ? 'Элита' : l.rs >= 2.5 ? 'Опытный' : l.rs >= 2.0 ? 'Средний' : 'Новичок';
                  }
                })();
                const weak = [...liftsRs].sort((a, b) => a.rs - b.rs)[0]?.key === l.key;
                return (
                  <div key={l.key} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{label} {weak ? '← слабейшее' : ''}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: weak ? '#f59e0b' : '#fff' }}>{l.rs}× <span style={{ fontSize: 9, color: '#fff' }}>({cls})</span> — {l.value} кг {weak ? '⚠️' : ''}</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 5, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ height: '100%', width: `${barPct}%`, borderRadius: 5, background: `linear-gradient(90deg, ${clr}88, ${clr})`, transition: 'width 0.3s' }} />
                    </div>
                  </div>
                );
              })}
              <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.12)', fontSize: 11, color: DIM, marginTop: 6 }}>
                <b style={{ color: '#fff' }}>Подсказка:</b> тотал {displayTotal} кг при {bw} кг = {relativeStrength(displayTotal, bw)}×BW. DOTS {dotsScore(displayTotal, bw, sex)}, IPF GL {ipfGLPoints(displayTotal, bw, sex)} — слабейшее движение тянет очки вниз.
              </div>
            </div>
          )}

          <div style={CARD}>
            <button onClick={() => setShowAllCats(v => !v)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
              <span style={SECTION}>🗂️ Все категории федерации — полный обзор {showAllCats ? '▲' : '▼'}</span>
              <span style={{ fontSize: 11, color: ACCENT }}>{showAllCats ? 'Свернуть' : 'Развернуть все категории'}</span>
            </button>
            {!showAllCats ? (
              <div style={{ fontSize: 11, color: DIM }}>Нажмите, чтобы увидеть пороги КМС/МС/МСМК во всех весовых категориях этой федерации.</div>
            ) : (
              <div style={{ overflowX: 'auto', marginTop: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: 520 }}>
                  <thead>
                    <tr style={{ color: '#fff', textAlign: 'left', fontSize: 10 }}>
                      <th style={{ padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Категория</th>
                      <th style={{ padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)', color: eligibleSet.has('kms') ? '#60a5fa' : 'rgba(96,165,250,0.35)' }}>КМС</th>
                      <th style={{ padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)', color: eligibleSet.has('ms') ? '#a855f7' : 'rgba(168,85,247,0.35)' }}>МС</th>
                      <th style={{ padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)', color: eligibleSet.has('msmk') ? '#f59e0b' : 'rgba(245,158,11,0.35)' }}>МСМК</th>
                      {table.categories.some(c => c.ranks.elite !== undefined) && <th style={{ padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)', color: eligibleSet.has('elite') ? '#ef4444' : 'rgba(239,68,68,0.35)' }}>ЭЛИТА</th>}
                      <th style={{ padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Ваш тотал</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table.categories.map(cat => {
                      const isCurrent = cat.label === effectiveCat.label;
                      const clr = (v: number | undefined, rank: 'kms' | 'ms' | 'msmk' | 'elite') => {
                        if (v === undefined) return 'rgba(255,255,255,0.25)';
                        const eligible = eligibleSet.has(rank);
                        if (!eligible) return 'rgba(255,255,255,0.28)';
                        return displayTotal >= v ? '#22c55e' : '#fff';
                      };
                      const hasEliteCol = table.categories.some(c => c.ranks.elite !== undefined);
                      return (
                        <tr key={cat.label} style={{ background: isCurrent ? 'rgba(0,230,138,0.06)' : 'transparent', borderLeft: isCurrent ? '2px solid #00e68a' : '2px solid transparent' }}>
                          <td style={{ padding: '6px 8px', fontWeight: isCurrent ? 800 : 600, color: isCurrent ? ACCENT : '#fff' }}>{cat.label} {isCurrent ? '← вы здесь' : ''}</td>
                          <td style={{ padding: '6px 8px', color: clr(cat.ranks.kms, 'kms') }}>{cat.ranks.kms ?? '—'}</td>
                          <td style={{ padding: '6px 8px', color: clr(cat.ranks.ms, 'ms') }}>{cat.ranks.ms ?? '—'}</td>
                          <td style={{ padding: '6px 8px', color: clr(cat.ranks.msmk, 'msmk') }}>{cat.ranks.msmk ?? '—'}</td>
                          {hasEliteCol && <td style={{ padding: '6px 8px', color: clr(cat.ranks.elite, 'elite') }}>{cat.ranks.elite ?? '—'}</td>}
                          <td style={{ padding: '6px 8px', fontWeight: 700, color: '#fff' }}>{isCurrent ? `${displayTotal} кг` : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={{ ...CARD, background: 'rgba(255,255,255,0.02)' }}>
            <div style={SECTION}>📚 Полные пояснения</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 2 }}>🏛 Федерации</div>
                <div style={{ fontSize: 11, color: DIM, lineHeight: 1.5 }}>{NORM_EXPLANATIONS.federation}</div>
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(236,72,153,0.06)', border: '1px solid rgba(236,72,153,0.15)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#ec4899', marginBottom: 2 }}>♀♂ Пол и весовые категории</div>
                <div style={{ fontSize: 11, color: DIM, lineHeight: 1.5 }}>{NORM_EXPLANATIONS.sex}</div>
              </div>
            </div>
          </div>
        </>
      )}

      <div style={{ marginTop: 8, padding: 12, borderRadius: 12, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)' }}>
        <div style={{ fontSize: 10, color: '#fff', marginBottom: 8 }}>🔗 Применить тотал ({displayTotal} кг) к планировщику как целевые ПМ:</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { const sq = showLifts && disc === 'total' ? squat : Math.round(displayTotal * 0.44), bn = showLifts && disc === 'total' ? bench : Math.round(displayTotal * 0.26), dl = showLifts && disc === 'total' ? dead : displayTotal - sq - bn; applyToPlanner({ kind: 'pm', label: 'Норматив: тотал ' + displayTotal + ' кг', data: { squat: sq, bench: bn, dead: dl } }); }} style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 13, minHeight: 44 }}>🛠 Применить ПМ к планировщику</button>
          {showLifts && disc === 'total' && (
            <button onClick={() => { const weak = [...liftsRs].sort((a,b)=>a.rs-b.rs)[0]; const g = weak.key === 'squat' ? 'legs' : weak.key === 'bench' ? 'chest' : 'back'; const ru = weak.key === 'squat' ? 'Присед→ноги' : weak.key === 'bench' ? 'Жим→грудь' : 'Тяга→спина'; applyToPlanner({ kind: 'weakpoints', label: 'Слабейшая группа: ' + ru, data: { groups: [g], lift: weak.key } }); }} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid rgba(168,85,247,0.3)', cursor: 'pointer', background: 'rgba(168,85,247,0.1)', color: '#a855f7', fontWeight: 800, fontSize: 12, minHeight: 44 }}>🎯 Слабейшая → планировщик</button>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(PlNormsCalcTab);
