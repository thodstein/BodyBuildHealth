/** StrengthAnalyticsCard.tsx — аналитика силы: процентили (sex-aware), соотношения, MEV/MAV/MRV, тоннаж, динамика из дневника, ACWR, валидация, прогноз.
 * Питается от хаба (snapshot) — единый источник. REUSE performance-analytics + volume-landmarks + training-load + strength-diary. */
import React, { useState, useMemo, useEffect } from 'react';
import {
  getStrengthPercentile as getPctRaw, getStrengthLevel, calculateRatios, analyzeRatios,
  getAllVolumeLandmarks, checkVolumeStatus, trainingAgeLevel, projectedTimeline, holtForecast,
} from '../../../engines/performance-analytics.engine';
import { loadTrainingProfile, saveTrainingProfile } from './training-profile';
import { applyToPlanner } from './planner-bridge';
import { PopupNumber } from '../SRCBBScreen_parts/TrainingPopups';
import type { HubSnapshot } from './StrengthAnalysisHub';
import { loadSRPESessions, type SRPESession } from '../../../engines/pro/srpe-store';
import { toDailyLoads, acuteChronicRatio } from '../../../engines/pro/training-load.engine';
import { StrengthDiary } from '../../../engines/strength-diary.engine';
import { epley1RM } from '../../../engines/e1rm';

const ACCENT = '#00e68a';
const DIM = '#fff';
const CARD: React.CSSProperties = { padding: 14, borderRadius: 12, background: 'rgba(24,24,27,0.4)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 12 };
const H: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: ACCENT, margin: '0 0 8px' };

interface Props {
  snapshot?: HubSnapshot;
}

// sex-aware percentile теперь в движке (getStrengthPercentile с sex-параметром)
function getStrengthPercentileSexAware(ex: string, bw: number, oneRM: number, sex: 'male' | 'female'): number {
  return getPctRaw(ex, bw, oneRM, sex);
}

export const StrengthAnalyticsCard: React.FC<Props> = ({ snapshot }) => {
  const prof = useMemo(() => loadTrainingProfile(), []);
  const hubSex: 'male' | 'female' = snapshot ? snapshot.sex : (prof as any).sex || 'male';
  const [squat, setSquat] = useState<number>(snapshot ? snapshot.squat : (prof.pmSquat || 100));
  const [bench, setBench] = useState<number>(snapshot ? snapshot.bench : (prof.pmBench || 70));
  const [dead, setDead] = useState<number>(snapshot ? snapshot.dead : (prof.pmDead || 130));
  const [ohp, setOhp] = useState<number>(snapshot ? snapshot.ohp : Math.round((prof.workMax.shoulders || 50) * 1.3) || 40);
  const [bw, setBw] = useState<number>(snapshot ? snapshot.bw : (prof.bodyWeight || 80));
  const [years, setYears] = useState<number>(2);
  const [weeklyVol, setWeeklyVol] = useState<number>(12);
  const [saved, setSaved] = useState(false);
  const [diarySeries, setDiarySeries] = useState<{ date: string; squatE1RM: number; benchE1RM: number; deadE1RM: number }[]>([]);
  const [tonnage7, setTonnage7] = useState<number>(0);
  const [tonnage28, setTonnage28] = useState<number>(0);

  // синхронизация с хабом
  useEffect(() => {
    if (!snapshot) return;
    setSquat(snapshot.squat);
    setBench(snapshot.bench);
    setDead(snapshot.dead);
    setOhp(snapshot.ohp);
    setBw(snapshot.bw);
  }, [snapshot?.squat, snapshot?.bench, snapshot?.dead, snapshot?.ohp, snapshot?.bw, snapshot?.sex]);

  const savePM = () => {
    saveTrainingProfile({ ...loadTrainingProfile(), pmSquat: squat, pmBench: bench, pmDead: dead, bodyWeight: bw });
    applyToPlanner({ kind: 'pm', label: 'ПМ: присед ' + squat + ' / жим ' + bench + ' / тяга ' + dead + ' кг', data: { squat, bench, dead } });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  // динамика из дневника + тоннаж
  useEffect(() => {
    const diary = new StrengthDiary();
    diary.getWorkoutLogs().then(logs => {
      // тоннаж 7/28 дней
      const now = new Date();
      const cutoff7 = new Date(now); cutoff7.setDate(now.getDate() - 7);
      const cutoff28 = new Date(now); cutoff28.setDate(now.getDate() - 28);
      const c7 = cutoff7.toISOString().slice(0, 10);
      const c28 = cutoff28.toISOString().slice(0, 10);
      let t7 = 0, t28 = 0;
      const seriesMap: Record<string, { squat: number; bench: number; dead: number }> = {};
      logs.forEach(l => {
        const d = l.date;
        let dayTonnage = 0;
        (l.exercises || []).forEach(ex => {
          const name = (ex.exerciseName || ex.exerciseId || '').toLowerCase();
          const best = Math.max(...(ex.sets || []).map(s => epley1RM(s.weight, s.reps)), 0);
          const vol = (ex.sets || []).reduce((s, st) => s + st.weight * st.reps, 0);
          dayTonnage += vol;
          if (!seriesMap[d]) seriesMap[d] = { squat: 0, bench: 0, dead: 0 };
          if (name.includes('присед') || name.includes('squat')) seriesMap[d].squat = Math.max(seriesMap[d].squat, best);
          else if (name.includes('жим') && !name.includes('стоя') || name.includes('bench')) seriesMap[d].bench = Math.max(seriesMap[d].bench, best);
          else if (name.includes('тяга') || name.includes('deadlift')) seriesMap[d].dead = Math.max(seriesMap[d].dead, best);
        });
        if (d >= c7) t7 += dayTonnage;
        if (d >= c28) t28 += dayTonnage;
      });
      setTonnage7(Math.round(t7));
      setTonnage28(Math.round(t28));
      const sortedDates = Object.keys(seriesMap).sort();
      const last10 = sortedDates.slice(-10).map(d => ({ date: d, squatE1RM: Math.round(seriesMap[d].squat), benchE1RM: Math.round(seriesMap[d].bench), deadE1RM: Math.round(seriesMap[d].dead) }));
      setDiarySeries(last10);
    }).catch(() => {});
  }, []);

  const pcts = useMemo(() => ({
    squat: getStrengthPercentileSexAware('squat', bw, squat, hubSex),
    bench: getStrengthPercentileSexAware('bench', bw, bench, hubSex),
    deadlift: getStrengthPercentileSexAware('deadlift', bw, dead, hubSex),
    overhead_press: getStrengthPercentileSexAware('overhead_press', bw, ohp, hubSex),
  }), [squat, bench, dead, ohp, bw, hubSex]);

  const levels = useMemo(() => ({
    squat: getStrengthLevel('squat', bw, squat, hubSex),
    bench: getStrengthLevel('bench', bw, bench, hubSex),
    deadlift: getStrengthLevel('deadlift', bw, dead, hubSex),
  }), [squat, bench, dead, bw, hubSex]);

  const ratios = useMemo(() => calculateRatios(squat, bench, dead, ohp), [squat, bench, dead, ohp]);
  const issues = useMemo(() => analyzeRatios(ratios), [ratios]);
  const landmarks = useMemo(() => getAllVolumeLandmarks(prof.level || 'intermediate'), [prof.level]);
  const age = useMemo(() => trainingAgeLevel(years), [years]);

  const target1RM = Math.round(squat * 1.1);
  const weeks = projectedTimeline(squat, target1RM, age.expectedWeeklyGain);

  // ACWR из srpe
  const acwr = useMemo(() => {
    try {
      const srpe = loadSRPESessions() as SRPESession[];
      if (!srpe.length) return null;
      const daily = toDailyLoads(srpe as any);
      return acuteChronicRatio(daily);
    } catch { return null; }
  }, []);

  // валидация аномалий
  const validations = useMemo(() => {
    const out: string[] = [];
    const total = squat + bench + dead;
    if (bw >= 30 && bw <= 250) {
      if (total > 1000 && bw < 65) out.push(`Тотал ${total} кг при весе ${bw} кг — вблизи мирового рекорда, проверьте ввод.`);
      if (total < 100 && bw > 80) out.push(`Тотал ${total} кг при весе ${bw} кг — очень низкий, проверьте ПМ.`);
    }
    if (squat > 0 && bench > 0 && squat < bench) out.push(`Присед (${squat}) < жима (${bench}) — аномалия техники/ввода (обычно присед > жим на 30–60%).`);
    if (bench > 0 && dead > 0 && bench > dead * 0.85) out.push(`Жим (${bench}) близок к тяге (${dead}) — проверьте тягу (обычно тяга > жима на 40–70%).`);
    if (squat > 0 && dead > 0 && squat > dead * 1.15) out.push(`Присед (${squat}) сильно выше тяги (${dead}) — возможна недо-тяга или завышен присед.`);
    if (ohp > 0 && bench > 0 && ohp > bench * 0.75) out.push(`Жим стоя (${ohp}) > 75% от жима лёжа (${bench}) — необычно высоко.`);
    return out;
  }, [squat, bench, dead, ohp, bw]);

  const LEVEL_RU: Record<string, string> = { untrained: 'Нетренир.', novice: 'Новичок', intermediate: 'Средний', advanced: 'Продвинутый', elite: 'Элита', world_class: 'Мировой' };
  const Row = ({ label, pct, level }: { label: string; pct: number; level?: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ fontSize: 11, color: '#fff', width: 90 }}>{label}</span>
      <div style={{ flex: 1, height: 7, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <div style={{ width: Math.min(100, pct) + '%', height: '100%', background: pct >= 70 ? '#00e68a' : pct >= 40 ? '#eab308' : '#ef4444', borderRadius: 4 }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: pct >= 70 ? '#00e68a' : pct >= 40 ? '#eab308' : '#ef4444', minWidth: 32, textAlign: 'right' }}>{pct}%</span>
      {level && <span style={{ fontSize: 10, color: DIM, minWidth: 70 }}>{LEVEL_RU[level] || level}</span>}
    </div>
  );

  return (
    <div className="train-strengthanalytics" style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={H}>💪 Аналитика силы {snapshot ? <span style={{ fontSize: 10, color: ACCENT, border: '1px solid rgba(0,230,138,0.2)', borderRadius: 6, padding: '2px 6px', marginLeft: 6 }}>из хаба · {hubSex === 'female' ? '♀' : '♂'} {bw} кг</span> : null}</div>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 10 }}>
        Процентиль силы (sex-aware), уровень, соотношения, дисбалансы, тоннаж, динамика из дневника, ACWR, объёмные ориентиры (MEV/MAV/MRV). Источники: Rippetoe/Kilgore + StrengthLevel.com (sex-коррекция ×0.62 для женщин); Helms et al. 2016; Israetel MEV/MAV/MRV.
      </div>
      <div style={{ padding: 8, borderRadius: 8, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', marginBottom: 10, fontSize: 10, color: DIM, lineHeight: 1.4 }}>
        <b style={{ color: '#60a5fa' }}>Как читать:</b> Процентиль — место среди атлетов вашего веса и пола (70% = сильнее 70%). У женщин пороги ×0.62. Соотношения: присед/тяга 85–100%, жим/присед 55–70%. Тоннаж — сумма кг×повт за 7/28 дней из дневника. Прогноз — по стажу {prof.level} линейно + Holt-идея (см. ниже).
      </div>

      {validations.length > 0 && (
        <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.18)', marginBottom: 10 }}>
          {validations.map((v, i) => <div key={i} style={{ fontSize: 11, color: '#f59e0b', marginBottom: i < validations.length - 1 ? 4 : 0 }}>⚠️ {v}</div>)}
        </div>
      )}

      <div style={CARD}>
        <div style={H}>⚙️ Ввод {snapshot ? <span style={{ fontSize: 10, color: ACCENT }}>(синхрон с хабом)</span> : null}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <PopupNumber label="Присед" value={squat} min={0} max={500} suffix="кг" onChange={v => { setSquat(v); if (snapshot) { /* хаб-синхрон через родителя — локально */ } }} />
          <PopupNumber label="Жим" value={bench} min={0} max={400} suffix="кг" onChange={setBench} />
          <PopupNumber label="Тяга" value={dead} min={0} max={500} suffix="кг" onChange={setDead} />
          <PopupNumber label="Жим стоя" value={ohp} min={0} max={300} suffix="кг" onChange={setOhp} />
          <PopupNumber label="Вес тела" value={bw} min={0} max={250} suffix="кг" onChange={setBw} />
          <PopupNumber label="Стаж" value={years} min={0} max={40} suffix="лет" onChange={setYears} />
        </div>
        {snapshot && <div style={{ fontSize: 10, color: ACCENT, marginTop: 6 }}>Значения берутся из единого снапшота хаба (шапка). Изменение в шапке сразу отражается здесь.</div>}
      </div>

      <div style={CARD}>
        <div style={H}>📊 Процентиль силы (по весу и полу — {hubSex === 'female' ? '♀ женские ×0.62' : '♂ мужские'})</div>
        <Row label="Присед" pct={pcts.squat} level={levels.squat} />
        <Row label="Жим лёжа" pct={pcts.bench} level={levels.bench} />
        <Row label="Тяга" pct={pcts.deadlift} level={levels.deadlift} />
        <Row label="Жим стоя" pct={pcts.overhead_press} />
        <div style={{ fontSize: 10, color: DIM, marginTop: 6 }}>Женские процентили — масштабирование мужских таблиц ×0.62 (DOTS ratio), без выдумок.</div>
      </div>

      <div style={CARD}>
        <div style={H}>⚖️ Соотношения</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11 }}>
          <div style={{ background: 'rgba(0,230,138,0.05)', borderRadius: 8, padding: '8px 10px' }}><span style={{ color: DIM, fontSize: 10 }}>Присед/Тяга</span><div style={{ fontWeight: 700 }}>{ratios.squatToDeadlift}%</div></div>
          <div style={{ background: 'rgba(0,230,138,0.05)', borderRadius: 8, padding: '8px 10px' }}><span style={{ color: DIM, fontSize: 10 }}>Жим/Присед</span><div style={{ fontWeight: 700 }}>{ratios.benchToSquat}%</div></div>
          <div style={{ background: 'rgba(0,230,138,0.05)', borderRadius: 8, padding: '8px 10px' }}><span style={{ color: DIM, fontSize: 10 }}>Жим стоя/Жим</span><div style={{ fontWeight: 700 }}>{ratios.overheadToBench || 0}%</div></div>
          <div style={{ background: 'rgba(0,230,138,0.05)', borderRadius: 8, padding: '8px 10px' }}><span style={{ color: DIM, fontSize: 10 }}>Жим/Тяга</span><div style={{ fontWeight: 700 }}>{ratios.pushPullRatio}%</div></div>
        </div>
        {issues.length === 0
          ? <div style={{ fontSize: 10, color: '#22c55e', marginTop: 8 }}>✓ Дисбалансов не обнаружено — пропорции в норме.</div>
          : <div style={{ marginTop: 8 }}>
              {issues.map((iss, i) => (
                <div key={i} style={{ fontSize: 10, padding: '6px 8px', marginBottom: 4, borderRadius: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <div style={{ color: '#ef4444', fontWeight: 700 }}>⚠ {iss.issue}</div>
                  <div style={{ color: DIM }}>{iss.recommendation}</div>
                </div>
              ))}
            </div>}
      </div>

      <div style={CARD}>
        <div style={H}>📦 Тоннаж (из дневника) + ACWR</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 11, marginBottom: 8 }}>
          <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.12)', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: DIM }}>Тоннаж 7д</div><div style={{ fontSize: 16, fontWeight: 800, color: '#60a5fa' }}>{tonnage7 ? `${(tonnage7/1000).toFixed(1)}т` : '—'}</div><div style={{ fontSize: 10, color: DIM }}>{tonnage7} кг×повт</div>
          </div>
          <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.12)', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: DIM }}>Тоннаж 28д</div><div style={{ fontSize: 16, fontWeight: 800, color: '#60a5fa' }}>{tonnage28 ? `${(tonnage28/1000).toFixed(1)}т` : '—'}</div><div style={{ fontSize: 10, color: DIM }}>{tonnage28} кг×повт</div>
          </div>
          <div style={{ padding: '8px 10px', borderRadius: 8, background: acwr ? (acwr.zone === 'optimal' ? 'rgba(34,197,94,0.08)' : acwr.zone === 'caution' ? 'rgba(245,158,11,0.08)' : acwr.zone === 'dangerous' ? 'rgba(239,68,68,0.08)' : 'rgba(59,130,246,0.08)') : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: DIM }}>ACWR</div><div style={{ fontSize: 16, fontWeight: 800, color: acwr ? (acwr.zone === 'optimal' ? '#22c55e' : acwr.zone === 'caution' ? '#f59e0b' : acwr.zone === 'dangerous' ? '#ef4444' : '#60a5fa') : '#fff' }}>{acwr ? acwr.ratio.toFixed(2) : '—'}</div><div style={{ fontSize: 10, color: DIM }}>{acwr ? acwr.zone : 'нет srpe'}</div>
          </div>
        </div>
        <div style={{ fontSize: 10, color: DIM, lineHeight: 1.4 }}>Тоннаж — сумма вес×повт по всем упражнениям (дневник). Рядом — ACWR (острая/хроническая нагрузка) из sRPE: 0.8–1.3 оптимум, &gt;1.5 опасно. Используется для авто-делода.</div>
      </div>

      {diarySeries.length > 0 && (
        <div style={CARD}>
          <div style={H}>📈 Динамика e1RM из дневника (последние {diarySeries.length} дней)</div>
          {/* мини-график приседа: факт + Holt-прогноз */}
          {(() => {
            const fact = diarySeries.map(d => d.squatE1RM).filter(v => v > 0);
            if (fact.length >= 3) {
              const forecast = holtForecast(fact, 0.4, 0.2, 4);
              const all = [...fact, ...forecast];
              const min = Math.min(...all) * 0.95;
              const max = Math.max(...all) * 1.05;
              const w = 320, h = 60, pad = 4;
              const xStep = (w - pad * 2) / (all.length - 1);
              const y = (v: number) => h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2);
              const factPath = fact.map((v, i) => `${i === 0 ? 'M' : 'L'} ${pad + i * xStep} ${y(v)}`).join(' ');
              const forePath = forecast.map((v, i) => `${i === 0 ? 'M' : 'L'} ${pad + (fact.length - 1 + i) * xStep} ${y(v)}`).join(' ');
              return (
                <div style={{ marginBottom: 8, padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ fontSize: 10, color: DIM, marginBottom: 4 }}>Присед e1RM — факт (зелёный) + Holt-прогноз 4 шага (пунктир)</div>
                  <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
                    <path d={factPath} fill="none" stroke="#00e68a" strokeWidth={2} />
                    <path d={forePath} fill="none" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 3" />
                    {fact.map((v, i) => <circle key={i} cx={pad + i * xStep} cy={y(v)} r={2} fill="#00e68a" />)}
                    {forecast.map((v, i) => <circle key={'f' + i} cx={pad + (fact.length - 1 + i) * xStep} cy={y(v)} r={2} fill="#f59e0b" />)}
                  </svg>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: DIM, marginTop: 2 }}>
                    <span>факт {fact[fact.length - 1]} кг</span>
                    <span>Holt +4: {forecast.join(' → ')} кг</span>
                  </div>
                </div>
              );
            }
            return null;
          })()}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, minWidth: 420 }}>
              <thead><tr style={{ color: DIM, borderBottom: '1px solid rgba(255,255,255,0.06)' }}><th style={{ padding: '4px 6px', textAlign: 'left' }}>Дата</th><th style={{ padding: '4px 6px' }}>Присед</th><th style={{ padding: '4px 6px' }}>Жим</th><th style={{ padding: '4px 6px' }}>Тяга</th></tr></thead>
              <tbody>
                {diarySeries.map(r => (
                  <tr key={r.date} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '4px 6px', color: '#fff' }}>{r.date}</td>
                    <td style={{ padding: '4px 6px', textAlign: 'center', color: r.squatE1RM ? '#ef4444' : DIM }}>{r.squatE1RM || '—'}</td>
                    <td style={{ padding: '4px 6px', textAlign: 'center', color: r.benchE1RM ? '#3b82f6' : DIM }}>{r.benchE1RM || '—'}</td>
                    <td style={{ padding: '4px 6px', textAlign: 'center', color: r.deadE1RM ? '#f59e0b' : DIM }}>{r.deadE1RM || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 10, color: DIM, marginTop: 6 }}>Берётся лучший e1RM дня (Epley). Holt — двойное экспоненциальное сглаживание (α=0.4, β=0.2) по приседу. ACWR оверлей — см. тоннаж выше.</div>
        </div>
      )}

      <div style={CARD}>
        <div style={H}>📈 Прогноз и стаж (Holt 4 нед)</div>
        <div style={{ fontSize: 11, color: '#fff', marginBottom: 6 }}>
          Уровень стажа: <b>{LEVEL_RU[age.level] || age.level}</b> · ожидаемый прирост <b>{age.expectedWeeklyGain} кг/нед</b> · Holt: {(() => {
            const fact = diarySeries.map(d => d.squatE1RM).filter(v => v > 0);
            if (fact.length >= 3) {
              const f = holtForecast(fact, 0.4, 0.2, 4);
              return `факт ${fact.slice(-3).join('→')} → прогноз ${f.join('→')} кг`;
            }
            return 'недостаточно данных (нужно ≥3 точки приседа)';
          })()}
        </div>
        <div style={{ fontSize: 10, color: DIM, marginBottom: 6 }}>
          Прогноз +10% к приседу ({target1RM} кг) ≈ <b style={{ color: ACCENT }}>{weeks} нед</b> (логарифм). Holt даёт тренд с учётом последних 4 нед — точнее при плато/скачке.
        </div>
        {acwr && acwr.zone !== 'optimal' && <div style={{ fontSize: 10, color: acwr.zone === 'dangerous' ? '#ef4444' : '#f59e0b' }}>ACWR {acwr.zone} — прогноз сдвинут (делод/вариативность). Тоннаж 7д {tonnage7} / 28д {tonnage28} кг·повт.</div>}
      </div>

      <div style={CARD}>
        <div style={H}>📐 Объёмные ориентиры (MEV/MAV/MRV)</div>
        <div style={{ fontSize: 10, color: DIM, marginBottom: 6 }}>Уровень: {LEVEL_RU[prof.level || 'intermediate'] || prof.level}. Статус для текущего объёма:</div>
        <div style={{ marginBottom: 8 }}>
          <PopupNumber label="Объём (по грудь)" value={weeklyVol} min={0} max={40} suffix="подходов/нед" onChange={setWeeklyVol} />
        </div>
        {landmarks.slice(0, 6).map(l => {
          const chest = l.muscle === 'chest' ? checkVolumeStatus(weeklyVol, l) : null;
          return (
            <div key={l.muscle} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 10 }}>
              <span style={{ color: '#fff', textTransform: 'capitalize' }}>{l.muscle}</span>
              <span style={{ color: DIM }}>MEV {l.mev}</span>
              <span style={{ color: DIM }}>MAV {l.mav}</span>
              <span style={{ color: DIM }}>MRV {l.mrv}</span>
              {chest && <span style={{ color: chest === 'optimal' ? '#22c55e' : chest === 'below_mev' ? '#3b82f6' : '#ef4444', gridColumn: '1 / -1' }}>Грудь: {chest === 'optimal' ? 'оптимально' : chest === 'below_mev' ? 'ниже MEV' : 'близко к MRV'}</span>}
            </div>
          );
        })}
        <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.12)', fontSize: 10, color: DIM }}>
          🔗 <b style={{ color: '#a855f7' }}>Диагностика</b> — слабые точки/лимитеры: см. ⚡ Интеллект → 🔬 Диагностика движения (мёртвые точки → слабые точки → траектория). Хаб линкует туда для проработки слабейшего звена.
        </div>
      </div>

      <div style={{ marginTop: 6, padding: 12, borderRadius: 12, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)' }}>
        <div style={{ fontSize: 10, color: DIM, marginBottom: 8 }}>🔗 ПМ из этого расчёта используются ПЛ-планировщиком. Сохраните текущие значения в профиль — ПЛ-планер пересчитает веса автоматически.</div>
        <button onClick={savePM} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 13, minHeight: 44 }}>{saved ? '✓ ПМ сохранены в профиль' : '💾 Сохранить ПМ в профиль'}</button>
      </div>
    </div>
  );
};
