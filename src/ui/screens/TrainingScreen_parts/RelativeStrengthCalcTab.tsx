import React, { useMemo, useState } from 'react';
import {
  relativeStrengthFullReport,
  liftRelativeStrength,
  type Sex,
} from '../../../engines/pro/relative-strength.engine';
import {
  getNormTable,
  findCategory,
  findCategoryByLabel,
  classifyTotalForCategory,
  progressToNextRank,
  NORM_EXPLANATIONS,
  type Federation,
  type Discipline,
} from '../../../engines/pl-norms.engine';

import { applyToPlanner } from './planner-bridge';
import { getProfile } from '../../../core/profile-manager';
import { PopupNumber, PopupSelect } from '../SRCBBScreen_parts/TrainingPopups';
const ACCENT = '#00e68a';
const DIM = '#fff';
const CARD: React.CSSProperties = { padding: 14, borderRadius: 12, background: 'rgba(24,24,27,0.4)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 12 };
const LABEL: React.CSSProperties = { fontSize: 11, color: DIM, marginBottom: 3 };
const ROW: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' };

const LIFT_COLORS: Record<string, string> = { squat: '#ef4444', bench: '#3b82f6', deadlift: '#f59e0b' };
const LIFT_RU: Record<string, string> = { squat: 'Присед', bench: 'Жим', deadlift: 'Тяга' };
const CLASS_COLORS: Record<string, string> = {
  novice: '#fff',
  intermediate: '#60a5fa',
  advanced: '#a855f7',
  elite: '#f59e0b',
  world_class: '#ef4444',
};

const CLASS_MAX: Record<string, number> = {
  squat: 3.2, bench: 2.2, deadlift: 3.8, total: 10,
};

const FEDS: { id: Federation; label: string }[] = [
  { id: 'fpr_ipf', label: 'ФПР / IPF (с ДК)' },
  { id: 'wrpf_untested', label: 'WRPF / СПР (без ДК)' },
  { id: 'wrpf_tested', label: 'WRPF / СПР (с ДК)' },
];

export const RelativeStrengthCalcTab: React.FC = () => {
  const [sex, setSex] = useState<Sex>(() => { try { return (getProfile().settings as any)?.personal?.sex === 'female' ? 'female' : 'male'; } catch { return 'male'; } });
  const [bw, setBw] = useState<number>(88);
  const [squat, setSquat] = useState<number>(180);
  const [bench, setBench] = useState<number>(120);
  const [deadlift, setDeadlift] = useState<number>(220);

  const [fed, setFed] = useState<Federation>('fpr_ipf');
  const [disc, setDisc] = useState<Discipline>('total');
  const [manualCat, setManualCat] = useState<string>('');

  const report = useMemo(() => relativeStrengthFullReport(squat, bench, deadlift, bw, sex), [squat, bench, deadlift, bw, sex]);
  const total = squat + bench + deadlift;

  const liftsRs = useMemo(() => [
    { key: 'squat', value: squat, rs: liftRelativeStrength(squat, bw) },
    { key: 'bench', value: bench, rs: liftRelativeStrength(bench, bw) },
    { key: 'deadlift', value: deadlift, rs: liftRelativeStrength(deadlift, bw) },
  ], [squat, bench, deadlift, bw]);

  const normTable = useMemo(() => getNormTable(fed, disc, sex), [fed, disc, sex]);
  const autoCat = useMemo(() => normTable ? findCategory(normTable, bw) : null, [normTable, bw]);
  const effectiveCat = useMemo(() => {
    if (!normTable) return null;
    if (manualCat) {
      const f = findCategoryByLabel(normTable, manualCat);
      if (f) return f;
    }
    return autoCat;
  }, [normTable, manualCat, autoCat]);
  const classif = useMemo(() => normTable && effectiveCat ? classifyTotalForCategory(normTable, effectiveCat, total) : null, [normTable, effectiveCat, total]);
  const progress = useMemo(() => classif ? progressToNextRank(classif, total) : 0, [classif, total]);

  const availDisc = useMemo(() => {
    if (fed === 'fpr_ipf' && sex === 'male') return [{ id: 'total', label: 'Троеборье' }] as { id: Discipline; label: string }[];
    if (fed === 'fpr_ipf' && sex === 'female') return [{ id: 'total', label: 'Троеборье' }, { id: 'bench', label: 'Жим лёжа' }] as { id: Discipline; label: string }[];
    return [{ id: 'total', label: 'Троеборье' }, { id: 'bench', label: 'Жим лёжа' }, { id: 'deadlift', label: 'Становая тяга' }, { id: 'squat', label: 'Приседания' }] as { id: Discipline; label: string }[];
  }, [fed, sex]);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)', marginBottom: 10, fontSize: 11, color: '#fff', lineHeight: 1.45 }}>
        <b style={{ color: '#a855f7' }}>🔀 Единый калькулятор:</b> вся информация этого экрана теперь собрана в <b style={{ color: '#fff' }}>«Анализ силы → Единый»</b> (PlNormsCalcTab): пол, весовые категории (авто + ручной просмотр), DOTS/Wilks/IPF GL, прогресс-бары, пояснения к каждому графику + режим «по движениям». Этот таб оставлен для совместимости и детального разбора ×BW по трём движениям.<br />
        <span style={{ fontSize: 10, color: '#fff' }}>Итоговое решение по чистке: если «Единый» покрывает все сценарии (что сейчас так — проверьте режим «по движениям»), этот таб можно скрыть из навигации, оставив только «Единый» как канон. Код deduplicated через общие движки <code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 4px', borderRadius: 4 }}>pl-norms.engine</code>/<code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 4px', borderRadius: 4 }}>relative-strength.engine</code>.</span>
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: ACCENT, marginBottom: 4 }}>🏋️ Калькулятор «сила / масса тела» — относительная сила и нормативы</div>
      <div style={{ fontSize: 11, color: DIM, marginBottom: 10, lineHeight: 1.45, background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.12)', borderRadius: 8, padding: 8 }}>
        <b style={{ color: '#fff' }}>Зачем:</b> абсолютный тотал не показывает, кто сильнее относительно веса. Этот калькулятор считает <b>относительную силу</b> (тотал/вес, ×BW), <b>DOTS/Wilks/IPF GL</b> с учётом пола, и сразу показывает разряд в весовой категории. Все графики ниже снабжены подробными пояснениями — как читать и что делать с результатом.
      </div>

      {/* Ввод данных */}
      <div style={CARD}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 10 }}>📝 Ваши показатели</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <PopupNumber label="Присед, кг" value={squat} min={0} suffix=" кг" onChange={v => setSquat(Math.max(0, v || 0))} />
          <PopupNumber label="Жим лёжа, кг" value={bench} min={0} suffix=" кг" onChange={v => setBench(Math.max(0, v || 0))} />
          <PopupNumber label="Тяга, кг" value={deadlift} min={0} suffix=" кг" onChange={v => setDeadlift(Math.max(0, v || 0))} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
          <PopupNumber label="Вес тела, кг" value={bw} min={30} suffix=" кг" onChange={v => setBw(Math.max(30, v || 1))} />
          <PopupSelect label="Пол" value={sex} options={[{ id: 'male', label: '♂ Мужчина' }, { id: 'female', label: '♀ Женщина' }]} onChange={v => setSex(v as Sex)} />
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={LABEL}>Тотал</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: ACCENT }}>{total}<span style={{ fontSize: 12, fontWeight: 400, color: DIM }}> кг</span></div>
          </div>
        </div>
        <div style={{ fontSize: 10, color: '#fff', marginTop: 6, lineHeight: 1.4 }}>
          Тотал = присед + жим + тяга. Меняется автоматически. Вес тела влияет на все графики: относительную силу, DOTS, Wilks, IPF GL и категорию.
        </div>
      </div>

      {/* Per-lift относительная сила с барами */}
      <div style={CARD}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8 }}>📊 Относительная сила по движениям — график «× веса тела»</div>
        {liftsRs.map(l => {
          const cls = report.lifts[l.key as 'squat' | 'bench' | 'deadlift'];
          const maxVal = CLASS_MAX[l.key] || 3;
          const barPct = Math.min(100, (l.rs / maxVal) * 100);
          const clr = LIFT_COLORS[l.key] || '#fff';
          return (
            <div key={l.key} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>{LIFT_RU[l.key]}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{l.rs}× <span style={{ color: CLASS_COLORS[cls.class] || DIM, fontSize: 10 }}>({cls.label})</span> — {l.value} кг</span>
              </div>
              <div style={{ height: 10, borderRadius: 5, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', position: 'relative', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ height: '100%', width: `${barPct}%`, borderRadius: 5, background: `linear-gradient(90deg, ${clr}88, ${clr})`, transition: 'width 0.3s' }} />
                {Object.entries(CLASS_COLORS).map(([clsKey]) => {
                  const thr = sex === 'female'
                    ? (l.key === 'squat' ? { novice: 0, intermediate: 1.0, advanced: 1.4, elite: 1.8, world_class: 2.2 } as const : l.key === 'bench' ? { novice: 0, intermediate: 0.6, advanced: 0.85, elite: 1.1, world_class: 1.4 } as const : { novice: 0, intermediate: 1.3, advanced: 1.8, elite: 2.2, world_class: 2.8 } as const)
                    : (l.key === 'squat' ? { novice: 0, intermediate: 1.5, advanced: 2.0, elite: 2.5, world_class: 3.0 } as const : l.key === 'bench' ? { novice: 0, intermediate: 1.0, advanced: 1.3, elite: 1.6, world_class: 2.0 } as const : { novice: 0, intermediate: 2.0, advanced: 2.5, elite: 3.0, world_class: 3.5 } as const);
                  const pct = (thr[clsKey as keyof typeof thr] / maxVal) * 100;
                  if (pct <= 0 || pct >= 100) return null;
                  return <div key={clsKey} style={{ position: 'absolute', left: `${pct}%`, top: 0, width: 1, height: '100%', background: 'rgba(255,255,255,0.22)' }} />;
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#fff', marginTop: 2 }}>
                <span>0×</span><span>{sex === 'female' ? 'пороги ниже на 30%' : 'мужские пороги'}</span><span>{maxVal}×</span>
              </div>
            </div>
          );
        })}
        <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.1)', fontSize: 11, color: DIM, lineHeight: 1.5, marginTop: 6 }}>
          <b style={{ color: '#fff' }}>Как читать график:</b> длина цветной полосы — ваш результат, делённый на вес тела (например, присед 180 кг при 88 кг = 2.05×). Вертикальные риски — границы уровней: Новичок → Средний → Опытный → Элита → Мировой. Тон — класс самого слабого уровня, который вы превзошли. Подпись в скобках — ваш текущий класс по этому движению ({sex === 'female' ? 'женские пороги мягче' : 'мужские общие'}).<br />
          <b style={{ color: '#fff' }}>Что делать:</b> сравните три полосы — самая короткая относительно своего максимума = отстающее движение. Его стоит приоритезировать в программе (слабые точки).<br />
          <b style={{ color: '#fff' }}>Пол:</b> у женщин пороги ниже (≈30%): присед 1.0/1.4/1.8, жим 0.6/0.85/1.1 — тот же 1.5× у мужчины «средний», у женщины «опытный».
        </div>
      </div>

      {/* Коэффициенты тотала */}
      <div style={CARD}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 6 }}>🏆 Коэффициенты относительной силы (тотал) — DOTS, Wilks, IPF GL</div>
        <div style={ROW}><span style={{ color: DIM }}>Относительная сила (тотал/bw) <span style={{ fontSize: 9, color: '#fff' }}>— простой: тотал ÷ вес</span></span><b style={{ color: '#fff' }}>{report.relative}× <span style={{ color: CLASS_COLORS[report.classification.class], fontSize: 10 }}>{report.classification.label}</span></b></div>
        <div style={ROW}><span style={{ color: DIM }}>DOTS (IPF 2019) <span style={{ fontSize: 9, color: '#fff' }}>— актуальный полином 4 степени</span></span><b style={{ color: ACCENT }}>{report.dots}</b></div>
        <div style={ROW}><span style={{ color: DIM }}>Wilks (IPF до 2019) <span style={{ fontSize: 9, color: '#fff' }}>— старый, завышает лёгких</span></span><b style={{ color: '#fff' }}>{report.wilks}</b></div>
        <div style={ROW}><span style={{ color: DIM }}>IPF GL Points <span style={{ fontSize: 9, color: '#fff' }}>— GoodLift 0-120, 100+ элита</span></span><b style={{ color: '#fff' }}>{report.ipfGL}</b></div>
        <div style={ROW}><span style={{ color: DIM }}>Allometric (×bw<sup>⅔</sup>) <span style={{ fontSize: 9, color: '#fff' }}>— аллометрия 2/3</span></span><b style={{ color: '#fff' }}>{report.allometric}</b></div>
        <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.12)', fontSize: 11, color: DIM, lineHeight: 1.5 }}>
          <b style={{ color: '#fff' }}>Что это:</b> {NORM_EXPLANATIONS.points}<br />
          <b style={{ color: '#fff' }}>Как читать:</b> чем больше число, тем сильнее относительно веса. DOTS 300 — новичок, 380 — опытный, 450 — элита, 520 — мировой. IPF GL 0-120: 60 — КМС, 75 — МС, 85 — МСМК, 100+ — топ. Удобно сравнивать себя с атлетами другого веса.<br />
          <b style={{ color: '#fff' }}>Пол:</b> формулы считают с разными коэффициентами — переключатель пола выше меняет все числа. Сравнивайте только внутри своего пола.
        </div>
      </div>

      {/* Сравнение с нормативами по весовой категории */}
      <div style={CARD}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8 }}>📋 Сравнение с разрядными нормативами — ваш разряд в категории</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
          <PopupSelect label="Федерация" value={fed} options={FEDS.map(f => ({ id: f.id, label: f.label }))} onChange={v => { setFed(v as Federation); setDisc('total'); setManualCat(''); }} />
          <PopupSelect label="Дисциплина" value={disc} options={availDisc.map(d => ({ id: d.id, label: d.label }))} onChange={v => setDisc(v as Discipline)} />
          <PopupSelect label="Категория (просмотр)" value={manualCat || '__auto'} options={[{ id: '__auto', label: autoCat ? `Авто: ${autoCat.label} (по ${bw} кг)` : 'Авто' }, ...(normTable?.categories.map(c => ({ id: c.label, label: c.label })) || [])]} onChange={v => setManualCat(v === '__auto' ? '' : v)} />
        </div>
        {classif && effectiveCat ? (
          <>
            <div style={{ padding: 12, borderRadius: 10, background: 'rgba(0,230,138,0.05)', border: '1px solid rgba(0,230,138,0.2)', textAlign: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: DIM, letterSpacing: 0.3, textTransform: 'uppercase' }}>{sex === 'female' ? '♀ Женщины' : '♂ Мужчины'} · {effectiveCat.label} · тотал {total} кг {manualCat ? '(ручной просмотр)' : '(авто по весу)'}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: classif.achievedRank ? '#f59e0b' : DIM }}>{classif.achievedLabel}</div>
              {classif.kgToNext > 0 && classif.nextRank ? (
                <div style={{ fontSize: 11, color: DIM }}>До {classif.nextLabel}: <b style={{ color: '#f59e0b' }}>+{classif.kgToNext} кг</b> (порог {classif.allRanks.find(r => r.key === classif.nextRank)?.threshold} кг)</div>
              ) : classif.achievedRank ? (
                <div style={{ fontSize: 11, color: '#22c55e' }}>Высший разряд категории — поздравляем!</div>
              ) : null}
              <div style={{ marginTop: 8, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ height: '100%', width: `${Math.max(4, Math.min(100, progress))}%`, borderRadius: 3, background: classif.kgToNext === 0 ? '#22c55e' : 'linear-gradient(90deg,#60a5fa,#a855f7)', transition: 'width 0.3s' }} />
              </div>
              <div style={{ fontSize: 9, color: '#fff', marginTop: 3 }}>Прогресс {Math.round(progress)}% от {classif.achievedRank || '0'} к {classif.nextLabel}</div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {classif.allRanks.map(r => (
                <div key={r.key} style={{ flex: 1, minWidth: 60, padding: '6px 8px', borderRadius: 8, textAlign: 'center', background: r.achieved ? 'rgba(0,230,138,0.12)' : r.key === classif.nextRank ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.03)', border: '1px solid ' + (r.achieved ? 'rgba(0,230,138,0.3)' : r.key === classif.nextRank ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.05)') }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: r.achieved ? ACCENT : r.key === classif.nextRank ? '#f59e0b' : DIM }}>{r.achieved ? '✓ ' : ''}{r.label}{r.key === classif.nextRank ? ' ← цель' : ''}</div>
                  <div style={{ fontSize: 10, marginTop: 2, color: r.achieved ? '#fff' : DIM }}>{r.threshold} кг</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.12)', fontSize: 10, color: DIM, lineHeight: 1.45 }}>
              <b style={{ color: '#fff' }}>Как читать блок нормативов:</b> {NORM_EXPLANATIONS.howRank} <br />
              Верхняя карточка — ваш разряд в выбранной категории и килограммы до следующего. Полоса — доля пути (0% только выполнили текущий, 100% — порог следующего). Ниже — все пороги категории: зелёные выполнены, янтарная — цель.<br />
              <b style={{ color: '#fff' }}>Авто vs ручной:</b> «Авто» — категория по вашему весу ({bw} кг → {autoCat?.label}). «Ручной» — посмотрите нормативы любой категории без смены веса (например, планируете сгонку к «до 83 кг»).
            </div>
          </>
        ) : (
          <div style={{ fontSize: 11, color: DIM }}>Выберите федерацию и дисциплину — покажу разряд.</div>
        )}
      </div>

      {/* Шкала уровней */}
      <div style={CARD}>
        <div style={{ fontSize: 11, fontWeight: 700, color: DIM, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Уровни относительной силы — шкала для интерпретации (DOTS/IPF GL + ×BW)</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 4 }}>
          {[
            { cls: 'novice', label: 'Новичок', color: '#fff', sq: '<1.5', be: '<1.0', dl: '<2.0', dots: '<300' },
            { cls: 'intermediate', label: 'Средний', color: '#60a5fa', sq: '1.5-2.0', be: '1.0-1.3', dl: '2.0-2.5', dots: '300-380' },
            { cls: 'advanced', label: 'Опытный', color: '#a855f7', sq: '2.0-2.5', be: '1.3-1.6', dl: '2.5-3.0', dots: '380-450' },
            { cls: 'elite', label: 'Элита', color: '#f59e0b', sq: '2.5-3.0', be: '1.6-2.0', dl: '3.0-3.5', dots: '450-520' },
            { cls: 'world_class', label: 'Мир. класс', color: '#ef4444', sq: '≥3.0', be: '≥2.0', dl: '≥3.5', dots: '≥520' },
          ].map(lvl => (
            <div key={lvl.cls} style={{ padding: 6, borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: report.classification.class === lvl.cls ? '1px solid ' + lvl.color : '1px solid rgba(255,255,255,0.04)', textAlign: 'center' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: lvl.color, marginBottom: 2 }}>{lvl.label}</div>
              <div style={{ fontSize: 10, color: DIM, lineHeight: 1.35 }}>П {lvl.sq}<br />Ж {lvl.be}<br />Т {lvl.dl}<br /><span style={{ color: lvl.color }}>{lvl.dots} DOTS</span></div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', fontSize: 11, color: DIM, lineHeight: 1.45 }}>
          <b style={{ color: '#fff' }}>Как пользоваться шкалой:</b> найдите столбец с вашим классом (подсвечен). Внутри — пороги относительной силы по движениям и DOTS. Например, если ваш присед 1.8× и DOTS 350 — вы «Средний». Чтобы стать «Опытным», нужен присед ≈2.0× и DOTS 380. У женщин этот же столб соответствует меньшим килограммам, но той же относительной нагрузке.<br />
          Текущий тотал {total} кг при {bw} кг → DOTS {report.dots} ({report.classification.label}). До следующего порога DOTS {report.classification.dotsThreshold + (report.classification.class === 'novice' ? 300 : report.classification.class === 'intermediate' ? 380 : report.classification.class === 'advanced' ? 450 : 520) - report.dots} очка — это ≈ {Math.round(((380 - report.dots) / report.dots) * 100)}% к тоталу при том же весе.
        </div>
      </div>

      <div style={{ fontSize: 10, color: '#fff', marginTop: 8, lineHeight: 1.5, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 8, padding: 8 }}>
        <b style={{ color: '#fff' }}>Источники и пределы:</b> DOTS — полином IPF 2019 (коэффициенты разные для ♂/♀), Wilks — старый IPF, IPF GL — GoodLift 0-120. Нормативы — ФПР 2022-2025 (классика) и WRPF. Пол меняет и DOTS/Wilks/GL, и пороги разряда, и категории. Сравнивайте только внутри одной федерации/дисциплины/пола. Для присвоения разряда нужны официальные старты с судьями ВК и допинг-контролем (см. пояснения в «Нормативы» калькулятора).
      </div>
      <div style={{ marginTop: 8, padding: 12, borderRadius: 12, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)' }}>
        <div style={{ fontSize: 10, color: '#fff', marginBottom: 8 }}>🔗 Определить слабейшее движение по относительной силе и применить как слабую группу к планировщику (приоритет объёма + ↓RIR).</div>
        <button onClick={() => { const weak = liftsRs.reduce((a, b) => b.rs < a.rs ? b : a, liftsRs[0]); const g = weak.key === 'squat' ? 'legs' : weak.key === 'bench' ? 'chest' : 'back'; const ru = weak.key === 'squat' ? 'Присед→ноги' : weak.key === 'bench' ? 'Жим→грудь' : 'Тяга→спина'; applyToPlanner({ kind: 'weakpoints', label: 'Слабейшая группа: ' + ru, data: { groups: [g], lift: weak.key } }); }} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 13, minHeight: 44 }}>🛠 Слабейшая группа → планировщик</button>
      </div>
    </div>
  );
};

export default React.memo(RelativeStrengthCalcTab);
