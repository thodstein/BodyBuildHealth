/**
 * MRVEstimatorTab.tsx — Work capacity / MRV-оценщик: из истории тренировок и готовности
 * вычисляет объём (sRPE-сеты/нед) на котором началось падение готовности → индивидуальный MRV.
 * Алгоритм: для каждой тренировочной недели вычисляется weeklyVolume (sRPE-нагрузка, ежедневные сеты)
 * и уровень_recovery. Ищем точку перегиба: где weeklyVolume ↑ но recovery ↓. Точка максимального объёма
 * перед устойчивым падением recovery считавается как индивидуальный MRV-оценка.
 */
import React, { useMemo, useState } from 'react';
import { loadSRPESessions, type SRPESession } from '../../../engines/pro/srpe-store';
import { toDailyLoads, weeklyMonotony, acuteChronicRatio, type DayLoad } from '../../../engines/pro/training-load.engine';
import { loadReadinessHistory, type ReadinessHistoryPoint } from './readiness-history';
import { PopupSelect, ExpandableCard, MetricCard } from '../SRCBBScreen_parts/TrainingPopups';
import { applyToPlanner } from './planner-bridge';

const ACCENT = '#00e68a';
const DIM = '#fff';
const SMALL: React.CSSProperties = { color: '#fff', fontSize: 11, lineHeight: 1.45 };
const H: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: ACCENT, margin: '4px 0 8px' };
const CARD: React.CSSProperties = { padding: 14, borderRadius: 12, background: 'rgba(24,24,27,0.4)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 12 };

interface WeeklyPoint { weekStart: string; volume: number; meanRecovery: number; meanFatigue: number; days: number; }

const LEVEL_MRVAULT: Record<string, { mrv: number; mav: number; mev: number; label: string }> = {
  beginner: { mrv: 12, mav: 8, mev: 4, label: 'Новичок' },
  intermediate: { mrv: 18, mav: 12, mev: 6, label: 'Средний' },
  advanced: { mrv: 24, mav: 16, mev: 8, label: 'Опытный' },
  enhanced: { mrv: 30, mav: 20, mev: 10, label: 'Enhanced (PED)' },
};

const levelOpts = [
  { id: 'beginner', label: 'Новичок', desc: 'MRV ≈ 12 сетов/мышцу/нед' },
  { id: 'intermediate', label: 'Средний', desc: 'MRV ≈ 18 сетов/мышцу/нед' },
  { id: 'advanced', label: 'Опытный', desc: 'MRV ≈ 24 сетов/мышцу/нед' },
  { id: 'enhanced', label: 'Enhanced (PED)', desc: 'MRV ≈ 30 сетов/мышцу/нед' },
];

function weekStart(dateStr: string): string {
  const d = new Date(dateStr); const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1); return d.toISOString().slice(0, 10);
}

/** Алгоритм оценки индивидуального MRV: возвращаем историю {weekStart, volume, meanRecovery, meanFatigue} отсортированно */
function perWeek(sessions: SRPESession[], readiness: ReadinessHistoryPoint[]): WeeklyPoint[] {
  if (sessions.length === 0) return [];
  const dailyMap: Record<string, number> = {};
  for (const s of sessions) {
    const ws = weekStart(s.date);
    dailyMap[ws] = (dailyMap[ws] || 0) + s.sRPE * s.durationMin;
  }
  const readinessByНеделя: Record<string, { rec: number[]; fat: number[] }> = {};
  for (const r of readiness) {
    const ws = weekStart(r.date);
    if (!readinessByWeek[ws]) readinessByWeek[ws] = { rec: [], fat: [] };
    readinessByWeek[ws].rec.push(r.recovery);
    readinessByWeek[ws].fat.push(r.fatigue);
  }
  const weeks = Object.keys(dailyMap).sort().map(ws => {
    const rec = readinessByWeek[ws]?.rec ?? [];
    const fat = readinessByWeek[ws]?.fat ?? [];
    return {
      weekStart: ws,
      volume: Math.round(dailyMap[ws]),
      days: sessions.filter(s => weekStart(s.date) === ws).length,
      meanRecovery: rec.length ? Math.round(rec.reduce((a, b) => a + b, 0) / rec.length) : NaN,
      meanFatigue: fat.length ? Math.round(fat.reduce((a, b) => a + b, 0) / fat.length) : NaN,
    };
  });
  return weeks;
}

/** MRV-оценка: точка максимального объёма, после которой наблюдается устойчивое падение готовности.
 *  Алгоритм: если найдена неделя с volume > пред. и recovery этой недели < предыдущей на ≥5 пунктов,
 *  volume предыдущей нед = индивидуальный MRV. Иначе max(volume). */
function estimateMRV(weeks: WeeklyPoint[]): { mrvVolume: number | null; rationale: string; firstDeclineIdx: number } {
  if (weeks.length === 0) return { mrvVolume: null, rationale: 'Нет данных.', firstDeclineIdx: -1 };
  if (weeks.length < 2) return { mrvVolume: weeks[0].volume, rationale: 'Недостаточно недель: только начало.', firstDeclineIdx: -1 };
  let declIdx = -1;
  for (let i = 1; i < weeks.length; i++) {
    if (!isNaN(weeks[i - 1].meanRecovery) && !isNaN(weeks[i].meanRecovery) &&
        weeks[i].volume > weeks[i - 1].volume &&
        weeks[i - 1].meanRecovery - weeks[i].meanRecovery >= 5) {
      declIdx = i - 1;
      break;
    }
  }
  if (declIdx >= 0) {
    const mrv = weeks[declIdx].volume;
    const next = weeks[declIdx + 1];
    return { mrvVolume: mrv, rationale: `Точка перегиба на неделе ${declIdx + 1}: объём вырос (${weeks[declIdx].volume} AU) до ${next.volume} AU, но готовность упала на ${weeks[declIdx].meanRecovery - next.meanRecovery} п. → MRV-оценка = ${mrv} AU/нед.`, firstDeclineIdx: declIdx };
  }
  // Без падения recovery → MRV ещё не достигнут. Берём максимальный объём.
  const maxVol = Math.max(...weeks.map(w => w.volume));
  return { mrvVolume: maxVol, rationale: `Готовность не падает при росте объёма — MRV не достигнут. Текущая толерантность ≥ ${maxVol} AU/нед (пробуйте нарастить ещё).`, firstDeclineIdx: -1 };
}

export const MRVEstimatorTab: React.FC = () => {
  const [sessions] = useState<SRPESession[]>(() => loadSRPESessions());
  const [readiness] = useState<ReadinessHistoryPoint[]>(() => loadReadinessHistory());
  const [level, setLevel] = useState<keyof typeof LEVEL_MRVAULT>('intermediate');

  const dailyLoads: DayLoad[] = useMemo(() => toDailyLoads(sessions), [sessions]);
  const weeks = useMemo(() => perWeek(sessions, readiness), [sessions, readiness]);
  const est = useMemo(() => estimateMRV(weeks), [weeks]);
  const mon = useMemo(() => weeklyMonotony(dailyLoads), [dailyLoads]);
  const acwr = useMemo(() => acuteChronicRatio(dailyLoads), [dailyLoads]);

  const levelData = LEVEL_MRVAULT[level];
  // Конверсия sRPE AU → "прикидочные сеты/нед" (1 сет ≈ 100-150 AU: 8 RPE × 12.5 мин)
  const setsPerWeek = est.mrvVolume != null ? Math.round(est.mrvVolume / 125) : 0;
  const perMuscleSets = Math.round(setsPerWeek / Math.max(1, 6));
  const mrvRatio = perMuscleSets > 0 ? levelData.mrv / perMuscleSets : 0;

  // SVG: трафик объём (бар) vs готовность (линия) по неделям
  const maxVol = Math.max(1, ...weeks.map(w => w.volume));
  const recs = weeks.map(w => w.meanRecovery).filter(v => !isNaN(v)) as number[];
  const recMin = Math.min(40, ...(recs.length ? recs : [50]));
  const recMax = Math.max(80, ...(recs.length ? recs : [80]));

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={H}>🎯 Work capacity / MRV-оценщик</div>
      <div style={{ ...SMALL, color: '#fff', marginBottom: 10 }}>
        Индивидуальный MRV (Maximum Recoverable Volume) оценивается по истории тренировок (sRPE) и готовности:
        ищется точка перегиба — объём, после которого рост нагрузки приводит к падению recovery. Без точки перегиба —
        MRV считается недостигнутым (толерантность = max объём в истории).
      </div>

      <div style={CARD}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <PopupSelect label="Уровень (стандарт)" value={level} options={levelOpts} onChange={v => setLevel(v as keyof typeof LEVEL_MRVAULT)} />
          <div>
            <div style={{ fontSize: 10, color: DIM, marginBottom: 3 }}>Сессий / дней готовности</div>
            <div style={{ padding: 10, borderRadius: 8, background: '#18181b', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' as const, fontSize: 12, color: '#fff', minHeight: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{sessions.length} / {readiness.length}</div>
          </div>
        </div>
      </div>

      {/* Сводка MRV */}
      {est.mrvVolume != null ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
          <MetricCard title="Индивидуальный MRV" icon="🎯" accent={ACCENT}>
            <div style={{ fontSize: 18, fontWeight: 800, color: ACCENT }}>{est.mrvVolume} AU</div>
            <div style={SMALL}>{setsPerWeek} сетов/нед (прогноз)</div>
          </MetricCard>
          <MetricCard title="Сетов на мышцу/нед" icon="💪" accent={ACCENT}>
            <div style={{ fontSize: 18, fontWeight: 800, color: ACCENT }}>≈{perMuscleSets}</div>
            <div style={SMALL}>~6 мышц/нед (плитка тренировок)</div>
          </MetricCard>
          <MetricCard title="Стандарт MRV" icon="📊" accent={'#3b82f6'}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#3b82f6' }}>{levelData.mrv}</div>
            <div style={SMALL}>сет/м/нед ({levelData.label})</div>
          </MetricCard>
          <MetricCard title="Коэф. запаса" icon="🛡" accent={mrvRatio > 1.3 ? '#ef4444' : mrvRatio > 0.9 ? '#eab308' : ACCENT}>
            <div style={{ fontSize: 18, fontWeight: 800, color: mrvRatio > 1.3 ? '#ef4444' : mrvRatio > 0.9 ? '#eab308' : ACCENT }}>{mrvRatio.toFixed(2)}×</div>
            <div style={SMALL}>{mrvRatio > 1.3 ? 'выше MRV!' : mrvRatio > 0.9 ? 'при MRV' : 'запас'}</div>
          </MetricCard>
        </div>
      ) : (
        <div style={CARD}>
          <div style={SMALL}>Недостаточно данных для оценки MRV. Sессий: {sessions.length}, записей готовности: {readiness.length}. Нужно ≥2 недель sRPE с ежедневной записью готовности.</div>
        </div>
      )}

      {/* График по неделям: объём (бар) + готовность (линия) */}
      {weeks.length > 0 && (
        <div style={CARD}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8 }}>📈 Объём vs готовность по неделям</div>
          <svg width="100%" height="180" viewBox="0 0 360 180" preserveAspectRatio="none">
            {/* y-grid для recovery (40-100) */}
            {[60, 80, 100].map(yv => {
              const y = 80 - ((yv - 40) / 60) * 70;
              return <g key={yv}><line x1="0" y1={y} x2="360" y2={y} stroke="rgba(255,255,255,0.04)" /><text x="4" y={y - 3} fontSize="8" fill="#fff">{yv}</text></g>;
            })}
            {(() => {
              const bw = 360 / Math.max(1, weeks.length);
              return weeks.map((w, i) => {
                const barH = (w.volume / maxVol) * 70;
                const barY = 80 - barH;
                const recoveryPt = !isNaN(w.meanRecovery) && recMin !== Infinity
                  ? 80 - ((w.meanRecovery - recMin) / Math.max(1, recMax - recMin)) * 70
                  : null;
                const isDecl = est.firstDeclineIdx === i;
                return (
                  <g key={i}>
                    <rect x={i * bw + 1} y={barY} width={bw - 2} height={barH} fill={isDecl ? '#ef4444' : `${ACCENT}88`} />
                    <text x={i * bw + bw / 2} y={barY - 2} fontSize="7" fill="#fff" textAnchor="middle">{w.volume}</text>
                    <text x={i * bw + bw / 2} y={158} fontSize="6" fill="#fff" textAnchor="middle">Н{i + 1}</text>
                    {recoveryPt != null && <circle cx={i * bw + bw / 2} cy={recoveryPt} r="3" fill="#3b82f6" />}
                    {est.firstDeclineIdx > 0 && i > 0 && !isNaN(weeks[i - 1].meanRecovery) && !isNaN(weeks[i].meanRecovery) && (() => {
                      const px = (i - 1) * bw + bw / 2;
                      const py = 80 - ((weeks[i - 1].meanRecovery - recMin) / Math.max(1, recMax - recMin)) * 70;
                      const cx = i * bw + bw / 2;
                      const cy = recoveryPt || 0;
                      return <line x1={px} y1={py} x2={cx} y2={cy} stroke="#3b82f6" strokeWidth="1" opacity="0.6" />;
                    })()}
                  </g>
                );
              });
            })()}
          </svg>
          <div style={{ display: 'flex', gap: 12, fontSize: 10, color: DIM, marginTop: 8 }}>
            <span>🟩 Объём (sRPE AU)</span>
            <span>🔵 Готовность (recovery)</span>
            <span>🟥 Точка перегиба</span>
          </div>
        </div>
      )}

      {/* Интерпретация */}
      {est.mrvVolume != null && (
        <div style={CARD}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 6 }}>📊 Интерпретация</div>
          <div style={{ ...SMALL, color: '#fff' }}>{est.rationale}</div>
          {est.firstDeclineIdx >= 0 && (
            <div style={{ padding: 8, borderRadius: 8, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', color: '#f87171', fontSize: 11, marginTop: 8 }}>
              ⛔ Падение готовности: объём {weeks[est.firstDeclineIdx].volume} AU → {weeks[est.firstDeclineIdx + 1].volume} AU (↑{Math.round((weeks[est.firstDeclineIdx + 1].volume - weeks[est.firstDeclineIdx].volume) / weeks[est.firstDeclineIdx].volume * 100)}%), recovery упал на {weeks[est.firstDeclineIdx].meanRecovery - weeks[est.firstDeclineIdx + 1].meanRecovery} п.
            </div>
          )}
          {est.firstDeclineIdx < 0 && (
            <div style={{ padding: 8, borderRadius: 8, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', color: '#86efac', fontSize: 11, marginTop: 8 }}>
              ✅ Толерантность не нарушена: готовность держится при росте объёма. Можно наращивать до точки перегиба.
            </div>
          )}
        </div>
      )}

      {/* Контекстная статистика */}
      <div style={CARD}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 6 }}>🛈 Сводные показатели</div>
        <div style={{ fontSize: 11, color: '#fff', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>Недельных точек: <b style={{ color: '#fff' }}>{weeks.length}</b></div>
        <div style={{ fontSize: 11, color: '#fff', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>ACWR: <b style={{ color: acwr.ratio > 1.5 ? '#ef4444' : ACCENT }}>{acwr.ratio}</b></div>
        <div style={{ fontSize: 11, color: '#fff', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>Монотонность: <b style={{ color: mon.monotony > 2 ? '#ef4444' : '#fff' }}>{mon.monotony}</b></div>
        <div style={{ fontSize: 11, color: '#fff', padding: '4px 0' }}>Недельная нагрузка: <b style={{ color: ACCENT }}>{mon.weeklyLoad} AU</b></div>
      </div>

      <div style={{ fontSize: 10, color: DIM, marginTop: 12, lineHeight: 1.4 }}>
        MRV (Maximum Recoverable Volume) — максимальный тренировочный объём, при котором вы восстанавливаетесь к следующей неделе.
        Справочные значения: Helms M. (2018) — 12-30+ сет/м/нед по уровню/PED. Точка перегиба = первая неделя, где рост объёма привёл к падению recovery ≥5 п.
      </div>
      {est.mrvVolume != null && (
        <div style={{ marginTop: 8, padding: 12, borderRadius: 12, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)' }}>
          <div style={{ fontSize: 10, color: '#fff', marginBottom: 8 }}>🔗 Применить индивидуальный MRV (<b style={{ color: '#00e68a' }}>{perMuscleSets} сет/м/нед</b>) к планировщику — объём плана будет ограничен этой величиной.</div>
          <button onClick={() => applyToPlanner({ kind: 'mrv', label: 'MRV ' + perMuscleSets + ' сет/м/нед', data: { mrv: perMuscleSets } })} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 13, minHeight: 44 }}>🛠 Применить MRV к планировщику</button>
        </div>
      )}
    </div>
  );
};

export default MRVEstimatorTab;