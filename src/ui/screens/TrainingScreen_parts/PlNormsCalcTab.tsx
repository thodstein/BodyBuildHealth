import React, { useMemo, useState } from 'react';
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

const ACCENT = '#00e68a';
const DIM = 'rgba(255,255,255,0.65)';
const SMALL: React.CSSProperties = { color: DIM, fontSize: 12, lineHeight: 1.5 };
const CARD: React.CSSProperties = { padding: 12, borderRadius: 12, background: 'rgba(24,24,27,0.5)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 10 };
const SECTION: React.CSSProperties = { fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 };
const rankColor: Record<string, string> = { КМС: '#60a5fa', МС: '#a855f7', МСМК: '#f59e0b', ЭЛИТА: '#ef4444', 'нет разряда': 'var(--text-dim)' };

const FEDS: { id: Federation; label: string }[] = [
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

export const PlNormsCalcTab: React.FC = () => {
  const initialSex = (() => { try { return (getProfile().settings as any)?.personal?.sex === 'female' ? 'female' as Sex : 'male' as Sex; } catch { return 'male' as Sex; } })();
  const [sex, setSex] = useState<Sex>(initialSex);
  const [fed, setFed] = useState<Federation>('fpr_ipf');
  const [disc, setDisc] = useState<Discipline>('total');
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('open');
  const [bw, setBw] = useState<number>(() => { try { return Number((getProfile().settings as any)?.personal?.weight) || 83; } catch { return 83; } });
  const [total, setTotal] = useState<number>(520);
  const [manualCat, setManualCat] = useState<string>(''); // пусто = авто
  const [showAllCats, setShowAllCats] = useState(false);
  // Единый калькулятор: режим «по движениям» — раскрывает присед/жим/тягу (из RelativeStrengthCalcTab)
  const [showLifts, setShowLifts] = useState(false);
  const [squat, setSquat] = useState<number>(180);
  const [bench, setBench] = useState<number>(120);
  const [dead, setDead] = useState<number>(220);

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
  // Для справки — авто-результат (по весу), если выбран ручной просмотр — покажем расхождение
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
    const gb = calcGlossbrenner(bw, displayTotal);
    return [
      { label: 'IPF GL', value: gl, scale: '0-120', hint: explainPoints('0-120') },
      { label: 'DOTS', value: d, scale: '300-500', hint: explainPoints('300-500') },
      { label: 'Wilks', value: w, scale: '300-500', hint: explainPoints('300-500') },
      { label: 'Glossbrenner', value: gb, scale: '300-500', hint: explainPoints('300-500') },
      { label: 'Отн. сила', value: rel, scale: '×BW', hint: 'Тотал / вес тела. 5× у мужчин — элита, 7.5× — мировой. У женщин 3×/4×/5×.' },
      { label: 'Allometric', value: al, scale: '×BW⅔', hint: 'Тотал / BW^0.67 — учитывает аллометрию (большие тяжелее, но не пропорционально).' },
    ];
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

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: ACCENT, margin: '2px 0 6px' }}>🏆 Калькулятор разрядных нормативов — единый центр</div>
      <div style={{ ...SMALL, marginBottom: 10, background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.12)', borderRadius: 8, padding: 8 }}>
        <b style={{ color: '#fff' }}>Что это:</b> единый калькулятор всех разрядных инструментов из приложения — нормативы по федерации/дисциплине/полу/весовой категории + DOTS/Wilks/IPF GL + прогресс до следующего разряда. Выберите пол, федерацию, движение, свой вес и результат — я покажу разряд, сколько до следующего, очки относительной силы и как читать каждый график (разъяснения под каждым блоком).
        <div style={{ marginTop: 6, fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>
          Источник: ФПР 2022-2025 приказ Минспорта №6 (классический пауэрлифтинг) — КМС/МС/МСМК; WRPF/СПР — без/с ДК. Женские таблицы добавлены официально (43-84+ кг).
        </div>
      </div>

      {/* ── Управление ── */}
      <div style={CARD}>
        <div style={SECTION}>⚙️ Параметры расчёта</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <PopupSelect label="Пол" value={sex} options={SEX_OPTS as any} onChange={v => { setSex(v as Sex); setManualCat(''); }} />
          <PopupSelect label="Федерация" value={fed} options={FEDS.map(f => ({ id: f.id, label: f.label }))} onChange={v => { const nf = v as Federation; setFed(nf); setManualCat(''); if (nf === 'fpr_ipf' && disc !== 'total' && sex === 'male') setDisc('total'); }} />
          <PopupSelect label="Дисциплина" value={disc} options={availDisc.map(d => ({ id: d.id, label: d.label }))} onChange={v => { setDisc(v as Discipline); setManualCat(''); }} />
          <PopupSelect label="Возрастная группа" value={ageGroup} options={AGE_GROUPS.map(a => ({ id: a.id, label: a.label, desc: a.desc }))} onChange={v => setAgeGroup(v as AgeGroup)} />
          <PopupSelect
            label="Весовая категория (просмотр)"
            value={manualCat || '__auto'}
            options={[{ id: '__auto', label: autoCat ? `Авто: ${autoCat.label} (по ${bw} кг)` : 'Авто' }, ...(table?.categories.map(c => ({ id: c.label, label: c.label })) || [])]}
            onChange={v => setManualCat(v === '__auto' ? '' : v)}
          />
          <PopupNumber label="Собственный вес, кг" value={bw} min={30} max={250} suffix=" кг" onChange={v => setBw(Math.max(30, Math.min(250, v || 30)))} />
          <PopupNumber label="Сумма / результат, кг" value={total} min={0} max={1500} step={2.5} suffix=" кг" onChange={setTotal} />
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 8, lineHeight: 1.45 }}>
          <b style={{ color: 'rgba(255,255,255,0.7)' }}>Как выбрать категорию:</b> {CATEGORY_EXPLANATION} Переключите «Весовая категория» с Авто на любую для просмотра «что если» — пороги пересчитаются без смены вашего веса. Это удобно, если планируете сгонку/набор к конкретной категории.
        </div>
        {manualCat && autoCat && manualCat !== autoCat.label && autoResult && result && (
          <div style={{ marginTop: 6, padding: '6px 8px', borderRadius: 8, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', fontSize: 11, color: '#f59e0b' }}>
            ⚠️ Просмотр категории «{manualCat}» отличается от вашей авто-категории «{autoCat.label}» (по весу {bw} кг вы в «{autoCat.label}»). Разряд по авто-категории: <b>{autoResult.achievedLabel}</b> (до {autoResult.nextLabel}: {autoResult.kgToNext} кг). На помосте зачёт идёт по фактической категории взвешивания.
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
        {/* ── Единый калькулятор: режим по движениям (из относительной силы) ── */}
        {disc === 'total' && (
          <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.16)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#a855f7' }}>
              <input type="checkbox" checked={showLifts} onChange={e => setShowLifts(e.target.checked)} style={{ accentColor: '#a855f7' }} />
              🏋️ Режим «по движениям» — ввести присед/жим/тягу отдельно (как в калькуляторе относительной силы)
            </label>
            {showLifts ? (
              <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <PopupNumber label="Присед, кг" value={squat} min={0} suffix=" кг" onChange={setSquat} />
                <PopupNumber label="Жим, кг" value={bench} min={0} suffix=" кг" onChange={setBench} />
                <PopupNumber label="Тяга, кг" value={dead} min={0} suffix=" кг" onChange={setDead} />
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '6px 8px', borderRadius: 8, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.15)', fontSize: 11, color: DIM }}>
                  Тотал = {squat} + {bench} + {dead} = <b style={{ color: ACCENT }}>{effectiveTotal} кг</b> (используется для разряда и очков выше). Относительная сила по движениям — ниже.
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>Включите, чтобы разложить тотал на три движения и увидеть относительную силу по каждому (график ×BW) и слабейшее движение.</div>
            )}
          </div>
        )}
      </div>

      {displayResult && effectiveCat && table && (
        <>
          {/* ── Главный результат ── */}
          <div style={{ padding: 14, borderRadius: 14, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.25)', marginBottom: 10, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: 0.3, textTransform: 'uppercase' }}>
              {sex === 'female' ? '♀ Женщины' : '♂ Мужчины'} · {table.federationLabel} · {DISC.find(d => d.id === disc)?.label} · Категория: {effectiveCat.label} {showLifts && disc === 'total' ? `· сумма ${displayTotal} кг (по движениям)` : ''}
            </div>
            <div style={{ fontSize: 30, fontWeight: 900, color: rankColor[displayResult.achievedLabel] || ACCENT, margin: '4px 0 2px' }}>{displayResult.achievedLabel}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
              {displayResult.achievedRank ? (
                displayResult.kgToNext > 0 ? <>до <b style={{ color: '#f59e0b' }}>{displayResult.nextLabel}</b>: <b>{displayResult.kgToNext} кг</b> <span style={{ color: 'rgba(255,255,255,0.45)' }}>({displayResult.allRanks.find(r => r.key === displayResult.nextRank)?.threshold} кг порог)</span></> : 'высший разряд норматива — вы на вершине этой категории'
              ) : (
                <>до <b style={{ color: '#60a5fa' }}>{displayResult.nextLabel}</b>: <b>{displayResult.kgToNext} кг</b> <span style={{ color: 'rgba(255,255,255,0.45)' }}>({displayResult.allRanks[0]?.threshold} кг порог)</span></>
              )}
            </div>
            {/* Прогресс-бар */}
            <div style={{ marginTop: 10, textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 3 }}>
                <span>Прогресс к следующему разряду</span>
                <span>{displayResult.achievedRank ? displayResult.achievedLabel : 'старт'} → {displayResult.nextLabel} · {Math.round(progress)}%</span>
              </div>
              <div style={{ height: 8, borderRadius: 6, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ height: '100%', width: `${Math.min(100, Math.max(2, progress))}%`, borderRadius: 6, background: displayResult.kgToNext === 0 ? '#22c55e' : 'linear-gradient(90deg,#60a5fa,#a855f7)', transition: 'width 0.35s', opacity: displayResult.kgToNext === 0 ? 0.9 : 1 }} />
              </div>
            </div>
            {table.sourceNote && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.32)', marginTop: 6 }}>{table.sourceNote}</div>}
          </div>

          {/* Пояснение к главному графику */}
          <div style={{ ...CARD, background: 'rgba(59,130,246,0.05)', borderColor: 'rgba(59,130,246,0.16)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', marginBottom: 4 }}>🧭 Как читать главный блок</div>
            <div style={{ fontSize: 11, color: DIM, lineHeight: 1.5 }}>
              <b style={{ color: '#fff' }}>Категория</b> — ваша весовая категория (авто по весу или ручной выбор). На соревнованиях вес фиксируется на взвешивании — от неё зависит порог.<br />
              <b style={{ color: '#fff' }}>Разряд</b> — высший выполненный порог в этой категории. Пороги идут по возрастанию: КМС &lt; МС &lt; МСМК &lt; ЭЛИТА (Элита только WRPF без ДК).<br />
              <b style={{ color: '#fff' }}>До следующего</b> — простая разница: порог_следующего − ваш результат. Не проценты, а килограммы, которые нужно прибавить к сумме.<br />
              <b style={{ color: '#fff' }}>Прогресс-бар</b> — доля пути от текущего разряда (или 0) до следующего: (тотал − порог_текущего)/(порог_следующего − порог_текущего). 0% — только получили разряд, 100% — ровно порог следующего. Удобен для планирования цикла.
            </div>
          </div>

          {/* ── Нормативы категории ── */}
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
                    boxShadow: isNext && isEligible ? '0 0 0 1px rgba(245,158,11,0.12) inset' : 'none',
                    opacity: !isEligible ? 0.45 : 1,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 6, height: 28, borderRadius: 6, background: rankColor[r.label] || '#555', opacity: isEligible ? (isAchieved ? 1 : 0.6) : 0.2 }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: !isEligible ? 'rgba(255,255,255,0.35)' : isAchieved ? ACCENT : isNext ? '#f59e0b' : 'var(--text-dim)' }}>{isAchieved ? '✓ ' : ''}{r.label} {isNext && isEligible ? '← цель' : ''} {!isEligible ? '⛔' : ''}</div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>{RANK_DESCRIPTIONS[r.key]} {!isEligible ? '— недоступен для выбранного возраста' : ''}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: !isEligible ? 'rgba(255,255,255,0.35)' : isAchieved ? ACCENT : isNext ? '#f59e0b' : '#fff' }}>{r.threshold} кг</div>
                      <div style={{ fontSize: 10, color: !isEligible ? 'rgba(255,255,255,0.25)' : isAchieved ? '#22c55e' : isNext ? '#f59e0b' : 'rgba(255,255,255,0.35)' }}>{!isEligible ? 'недоступен' : isAchieved ? `выполнен (+${(displayTotal - r.threshold).toFixed(1)} кг)` : `нужно +${(r.threshold - displayTotal).toFixed(1)} кг`}</div>
                    </div>
                  </div>
                );
              })}
              {ageNoteForDisplay && (
                <div style={{ marginTop: 6, padding: '6px 8px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', fontSize: 11, color: '#f87171', lineHeight: 1.4 }}>
                  ⚠️ {ageNoteForDisplay}
                </div>
              )}
            </div>
            <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', fontSize: 11, color: DIM, lineHeight: 1.45 }}>
              <b style={{ color: '#fff' }}>Как читать график порогов:</b> каждая строка — один разряд и килограммы, которые нужно показать в этой категории. Зелёные — уже выполнены, янтарная — ближайшая цель. Пороги нелинейны: от КМС до МС обычно +70-90 кг, от МС до МСМК +80-120 кг. Если в категории 43 кг у женщин нет МС/МСМК (прочерк) — значит, разряд не присваивается в этой категории (слишком лёгкий вес).
            </div>
          </div>

          {/* ── Очки относительной силы ── */}
          <div style={CARD}>
            <div style={SECTION}>🏆 Очки относительной силы — сравнение вне категорий ({sex === 'female' ? '♀ женские коэффициенты' : '♂ мужские коэффициенты'})</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {points.map(p => (
                <div key={p.label} style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa' }}>{p.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{p.scale}</div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.32)', marginTop: 2, lineHeight: 1.3 }}>{p.hint}</div>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#60a5fa', marginLeft: 8 }}>{p.value}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.12)', fontSize: 11, color: DIM, lineHeight: 1.45 }}>
              <b style={{ color: '#fff' }}>Что это и зачем:</b> {NORM_EXPLANATIONS.points} <br />
              <b style={{ color: '#fff' }}>Как интерпретировать:</b> не смотрите только на тотал — 600 кг при 60 кг (DOTS ~520, IPF GL ~95) сильнее, чем 700 кг при 110 кг (DOTS ~430, GL ~78). Сравнивайте именно DOTS/IPF GL, если хотите понять «кто сильнее относительно».<br />
              <b style={{ color: '#fff' }}>Пол:</b> коэффициенты разные: один и тот же тотал 400 кг даст у женщины выше DOTS/Wilks, чем у мужчины того же веса, потому что база ниже. Переключатель пола выше меняет все 4 формулы.
            </div>
          </div>

          {/* ── Относительная сила по движениям (когда включён режим) ── */}
          {showLifts && disc === 'total' && (
            <div style={CARD}>
              <div style={SECTION}>📊 Относительная сила по движениям — × веса тела (из калькулятора относительной силы)</div>
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
                      <span style={{ fontSize: 11, fontWeight: 700, color: weak ? '#f59e0b' : '#fff' }}>{l.rs}× <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)' }}>({cls})</span> — {l.value} кг {weak ? '⚠️' : ''}</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 5, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ height: '100%', width: `${barPct}%`, borderRadius: 5, background: `linear-gradient(90deg, ${clr}88, ${clr})`, transition: 'width 0.3s' }} />
                    </div>
                  </div>
                );
              })}
              <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.12)', fontSize: 11, color: DIM, lineHeight: 1.45, marginTop: 6 }}>
                <b style={{ color: '#fff' }}>Как читать график по движениям:</b> длина полосы — килограммы движения ÷ вес тела. Вертикальных рисок нет — уровень считается по порогам выше (мужчины присед 1.5/2.0/2.5, жим 1.0/1.3/1.6; женщины ниже на 30%). Самая короткая полоса относительно своих порогов = слабейшее движение — его стоит приоритезировать в плане (кнопка ниже). Тотал для разряда уже посчитан как сумма этих трёх.<br />
                <b style={{ color: '#fff' }}>Действие:</b> нажмите «Слабейшая группа → планировщик» внизу, чтобы автоматически добавить объём/спец-частоту для отстающего движения.
              </div>
              <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.12)', fontSize: 11, color: DIM }}>
                <b style={{ color: '#fff' }}>Подсказка:</b> тотал {displayTotal} кг при {bw} кг = {relativeStrength(displayTotal, bw)}×BW. DOTS {dotsScore(displayTotal, bw, sex)}, IPF GL {ipfGLPoints(displayTotal, bw, sex)} — это те же очки, что в блоке выше, но теперь вы видите, какой лифт тянет их вниз.
              </div>
            </div>
          )}

          {/* ── Таблица всех категорий ── */}
          <div style={CARD}>
            <button onClick={() => setShowAllCats(v => !v)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
              <span style={SECTION}>🗂️ Все категории федерации — полный обзор {showAllCats ? '▲' : '▼'}</span>
              <span style={{ fontSize: 11, color: ACCENT }}>{showAllCats ? 'Свернуть' : 'Развернуть все категории'}</span>
            </button>
            {ageGroup !== 'open' && (
              <div style={{ marginTop: 8, padding: '6px 8px', borderRadius: 8, background: ageGroup === 'youth_12_13' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)', border: '1px solid ' + (ageGroup === 'youth_12_13' ? 'rgba(239,68,68,0.18)' : 'rgba(245,158,11,0.18)'), fontSize: 10, color: ageGroup === 'youth_12_13' ? '#f87171' : '#f59e0b', lineHeight: 1.4 }}>
                {ageGroup === 'youth_12_13' ? '⛔ 12-13 лет: все взрослые разряды недоступны — таблица блекнет полностью (доступны только юношеские/I-III вне таблиц).' : `⚠️ Возраст ${AGE_GROUPS.find(a => a.id === ageGroup)?.label}: недоступные разряды в таблице затемнены (opacity 0.45, ⛔). Ваш текущий разряд: ${displayResult?.achievedLabel ?? 'нет'}${ageNoteForDisplay ? ' — ' + ageNoteForDisplay : ''}`}
              </div>
            )}
            {!showAllCats ? (
              <div style={{ fontSize: 11, color: DIM }}>Нажмите, чтобы увидеть пороги КМС/МС/МСМК во всех весовых категориях этой федерации — удобно выбирать, в какую категорию гнать вес.</div>
            ) : (
              <div style={{ overflowX: 'auto', marginTop: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: 520 }}>
                  <thead>
                    <tr style={{ color: 'rgba(255,255,255,0.45)', textAlign: 'left', fontSize: 10 }}>
                      <th style={{ padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Категория</th>
                      <th style={{ padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)', color: eligibleSet.has('kms') ? '#60a5fa' : 'rgba(96,165,250,0.35)', opacity: eligibleSet.has('kms') ? 1 : 0.45 }} title={eligibleSet.has('kms') ? '' : '⛔ недоступен для выбранного возраста'}>КМС {!eligibleSet.has('kms') ? '⛔' : ''}</th>
                      <th style={{ padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)', color: eligibleSet.has('ms') ? '#a855f7' : 'rgba(168,85,247,0.35)', opacity: eligibleSet.has('ms') ? 1 : 0.45 }} title={eligibleSet.has('ms') ? '' : '⛔ недоступен для выбранного возраста'}>МС {!eligibleSet.has('ms') ? '⛔' : ''}</th>
                      <th style={{ padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)', color: eligibleSet.has('msmk') ? '#f59e0b' : 'rgba(245,158,11,0.35)', opacity: eligibleSet.has('msmk') ? 1 : 0.45 }} title={eligibleSet.has('msmk') ? '' : '⛔ недоступен для выбранного возраста'}>МСМК {!eligibleSet.has('msmk') ? '⛔' : ''}</th>
                      {table.categories.some(c => c.ranks.elite !== undefined) && <th style={{ padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)', color: eligibleSet.has('elite') ? '#ef4444' : 'rgba(239,68,68,0.35)', opacity: eligibleSet.has('elite') ? 1 : 0.45 }} title={eligibleSet.has('elite') ? '' : '⛔ недоступен для выбранного возраста'}>ЭЛИТА {!eligibleSet.has('elite') ? '⛔' : ''}</th>}
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
                        return displayTotal >= v ? '#22c55e' : 'rgba(255,255,255,0.7)';
                      };
                      const cellOpacity = (rank: 'kms' | 'ms' | 'msmk' | 'elite') => eligibleSet.has(rank) ? 1 : 0.45;
                      const hasEliteCol = table.categories.some(c => c.ranks.elite !== undefined);
                      return (
                        <tr key={cat.label} style={{ background: isCurrent ? 'rgba(0,230,138,0.06)' : 'transparent', borderLeft: isCurrent ? '2px solid #00e68a' : '2px solid transparent', opacity: ageGroup === 'youth_12_13' ? 0.55 : 1 }}>
                          <td style={{ padding: '6px 8px', fontWeight: isCurrent ? 800 : 600, color: isCurrent ? ACCENT : '#fff' }}>{cat.label} {isCurrent ? '← вы здесь' : ''}</td>
                          <td style={{ padding: '6px 8px', color: clr(cat.ranks.kms, 'kms'), opacity: cellOpacity('kms') }} title={!eligibleSet.has('kms') ? '⛔ недоступен для возраста' : undefined}>{cat.ranks.kms !== undefined ? (eligibleSet.has('kms') ? cat.ranks.kms : `${cat.ranks.kms} ⛔`) : '—'}</td>
                          <td style={{ padding: '6px 8px', color: clr(cat.ranks.ms, 'ms'), opacity: cellOpacity('ms') }} title={!eligibleSet.has('ms') ? '⛔ недоступен для возраста' : undefined}>{cat.ranks.ms !== undefined ? (eligibleSet.has('ms') ? cat.ranks.ms : `${cat.ranks.ms} ⛔`) : '—'}</td>
                          <td style={{ padding: '6px 8px', color: clr(cat.ranks.msmk, 'msmk'), opacity: cellOpacity('msmk') }} title={!eligibleSet.has('msmk') ? '⛔ недоступен для возраста' : undefined}>{cat.ranks.msmk !== undefined ? (eligibleSet.has('msmk') ? cat.ranks.msmk : `${cat.ranks.msmk} ⛔`) : '—'}</td>
                          {hasEliteCol && <td style={{ padding: '6px 8px', color: clr(cat.ranks.elite, 'elite'), opacity: cellOpacity('elite') }} title={!eligibleSet.has('elite') ? '⛔ недоступен для возраста' : undefined}>{cat.ranks.elite !== undefined ? (eligibleSet.has('elite') ? cat.ranks.elite : `${cat.ranks.elite} ⛔`) : '—'}</td>}
                          <td style={{ padding: '6px 8px', fontWeight: 700, color: isCurrent ? '#fff' : 'rgba(255,255,255,0.35)' }}>{isCurrent ? `${displayTotal} кг` : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 6, lineHeight: 1.4 }}>
                  Каждая строка — одна весовая категория. Числа — пороги для разряда. Зелёный — ваш тотал выполняет порог в этой категории. <b style={{ color: 'rgba(255,255,255,0.55)' }}>⛔ затемнённые столбцы — недоступны для выбранного возраста</b> (opacity 0.45, кликните заголовок для подсказки). « — » — разряд в этой категории не присваивается (нет нормы). Подсвеченная строка — выбранная для просмотра (авто или ручная).
                </div>
              </div>
            )}
            <div style={{ marginTop: 8, fontSize: 10, color: 'rgba(255,255,255,0.32)', lineHeight: 1.4 }}>
              Подсказка: если до МСМК не хватает 15 кг, но сгонка 4 кг переводит вас в категорию ниже, где порог ниже на 30 кг — переход выгоден. Сравните строку текущей и целевой категорий. {ageGroup !== 'open' ? 'Фильтр возраста применён ко всей таблице — недоступные разряды блекнут во всех строках.' : ''}
            </div>
          </div>

          {/* ── Дополнительные пояснения ── */}
          <div style={{ ...CARD, background: 'rgba(255,255,255,0.02)' }}>
            <div style={SECTION}>📚 Полные пояснения к графикам и нормативам</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 2 }}>🏛 Федерации</div>
                <div style={{ fontSize: 11, color: DIM, lineHeight: 1.5 }}>{NORM_EXPLANATIONS.federation}</div>
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 2 }}>🎯 Дисциплины</div>
                <div style={{ fontSize: 11, color: DIM, lineHeight: 1.5 }}>{NORM_EXPLANATIONS.discipline}</div>
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(236,72,153,0.06)', border: '1px solid rgba(236,72,153,0.15)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#ec4899', marginBottom: 2 }}>♀♂ Пол и весовые категории</div>
                <div style={{ fontSize: 11, color: DIM, lineHeight: 1.5 }}>{NORM_EXPLANATIONS.sex}</div>
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 2 }}>📈 Как определяется разряд</div>
                <div style={{ fontSize: 11, color: DIM, lineHeight: 1.5 }}>{NORM_EXPLANATIONS.howRank}</div>
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 2 }}>⚖️ Относительная сила</div>
                <div style={{ fontSize: 11, color: DIM, lineHeight: 1.5 }}>{NORM_EXPLANATIONS.relative}</div>
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.12)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', marginBottom: 2 }}>⚠️ Важные условия присвоения (ЕВСК)</div>
                <div style={{ fontSize: 10, color: DIM, lineHeight: 1.5 }}>
                  • МСМК — только на международных из ЕКП с допинг-контролем, с 17 лет.<br />
                  • МС — чемпионат федерального округа / Москвы/СПб с выборочным ДК и 3 судьями ВК, с 16 лет.<br />
                  • КМС — чемпионат субъекта РФ с 1 ВК + 2 судьи 1К, с 14 лет.<br />
                  • I-III и юношеские — любые официальные старты, с 12 лет.<br />
                  • Троеборье — только сумма трёх движений (присед+жим+тяга).
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <div style={{ marginTop: 8, padding: 12, borderRadius: 12, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)' }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginBottom: 8 }}>🔗 Применить тотал ({displayTotal} кг{displayTotal !== total ? ` — из режима по движениям (сумма ${squat}+${bench}+${dead})` : ''}) к планировщику как целевые ПМ (разложу 44% присед / 26% жим / 30% тяга — классическое распределение ПЛ, или используйте точные {showLifts ? 'ваши' : 'расчётные'} присед/жим/тягу).</div>
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
