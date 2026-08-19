import React, { useMemo, useState } from 'react';
import { useDataLink } from '../../../core/data-link';
import { loadSessions } from '../../../engines/workout-logger.engine';
import { computePeriWorkoutNutrition } from '../../../engines/nutrition-periworkout.engine';

const ACCENT = '#00e68a';
const SMALL: React.CSSProperties = { color: 'rgba(255,255,255,0.6)', fontSize: 11, lineHeight: 1.4 };
const CARD: React.CSSProperties = { background: '#18181b', borderRadius: 14, border: '1px solid rgba(0,230,138,0.18)', padding: 12, marginBottom: 10 };

export const PeriWorkoutCard: React.FC = () => {
  const linked = useDataLink();
  const bw = linked.profile?.settings?.weight || 80;
  const goal = linked.profile?.settings?.primaryGoal || 'strength';
  const training = linked.profile?.settings?.training;
  const pharma = linked.profile?.settings?.pharma;
  const [overrideVol, setOverrideVol] = useState<number>(0);
  const [overrideDur, setOverrideDur] = useState<number>(0);

  const last = useMemo(() => loadSessions()[0], []);
  const inferredIntensity = (last?.avgIntensity || 0) >= 8 ? 'high' : (last?.avgIntensity || 0) > 0 && (last?.avgIntensity || 0) <= 6 ? 'low' : (training?.minutesPerSession || 60) >= 90 ? 'high' : 'medium';
  const [intensity, setIntensity] = useState<'low' | 'medium' | 'high'>(inferredIntensity);
  const sessionVolume = overrideVol || last?.totalVolume || 0;
  const durationMin = overrideDur || last?.durationMin || 0;

  const plan = useMemo(() => computePeriWorkoutNutrition({
    sessionVolume, durationMin, bodyWeight: bw, goal, intensity,
    ped: { hasInsulin: pharma?.hasInsulin, hasGH: pharma?.hasGH, hasIGF: pharma?.hasIGF, insulinIU: pharma?.insulinIU, ghIU: pharma?.ghIU },
  }), [sessionVolume, durationMin, bw, goal, intensity, pharma?.hasInsulin, pharma?.hasGH, pharma?.hasIGF, pharma?.insulinIU, pharma?.ghIU]);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: ACCENT, margin: '4px 0 8px' }}>🥤 Пери-воркаутное питание</div>
      <div style={{ ...SMALL, marginBottom: 10 }}>Рекомендации по углеводам/белку/жидкости до/во время/после тренировки — на основе последней сессии из блока Тренировки и массы тела ({bw} кг).</div>

      <div style={{ ...CARD, borderColor: 'rgba(245,158,11,0.25)' }}>
        <label style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700 }}>📊 Интенсивность тренировки</label>
        <select value={intensity} onChange={e => setIntensity(e.target.value as 'low' | 'medium' | 'high')} style={{ width: '100%', marginTop: 6, background: '#202023', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 8, fontSize: 12 }}>
          <option value="low">Низкая · восстановительная</option>
          <option value="medium">Средняя · рабочая</option>
          <option value="high">Высокая · тяжёлая/длинная</option>
        </select>
        <div style={{ ...SMALL, marginTop: 5 }}>Авто: по avg RPE последней сессии и длительности; можно уточнить вручную.</div>
      </div>

      {last ? (
        <div style={{ ...CARD, borderColor: 'rgba(59,130,246,0.25)' }}>
          <div style={{ fontSize: 11, color: '#60a5fa', fontWeight: 700 }}>Последняя тренировка: {last.date} · {last.focus}</div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>Тоннаж {Math.round(last.totalVolume)} кг·повт · {last.durationMin} мин · {last.totalSets} сетов</div>
        </div>
      ) : (
        <div style={{ ...CARD, borderColor: 'rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Нет завершённых тренировок — введите объём и длительность вручную ниже или завершите тренировку во вкладке «Тренировки».</div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <div>
          <label style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>Тоннаж, кг·повт</label>
          <input type="number" value={overrideVol || ''} placeholder={String(last?.totalVolume || 0)} onChange={e => setOverrideVol(+e.target.value)} style={{ width: '100%', background: '#202023', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 8, fontSize: 12 }} />
        </div>
        <div>
          <label style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>Длительность, мин</label>
          <input type="number" value={overrideDur || ''} placeholder={String(last?.durationMin || 0)} onChange={e => setOverrideDur(+e.target.value)} style={{ width: '100%', background: '#202023', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 8, fontSize: 12 }} />
        </div>
      </div>

      {sessionVolume > 0 || durationMin > 0 ? (
        <>
          <div style={CARD}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b', marginBottom: 4 }}>⏰ До тренировки</div>
            <div style={{ fontSize: 11, color: '#fff' }}>{plan.pre.carbsG} г углеводов · <span style={{ color: 'var(--text-dim)' }}>{plan.pre.timing}</span></div>
            <div style={{ ...SMALL, marginTop: 4 }}>{plan.pre.note}</div>
          </div>
          <div style={CARD}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa', marginBottom: 4 }}>💧 Во время</div>
            <div style={{ fontSize: 11, color: '#fff' }}>{plan.intra.carbsGPerH > 0 ? `${plan.intra.carbsGPerH} г углеводов/ч` : 'без углеводов'} · {plan.intra.fluidMlPerH} мл/ч</div>
            <div style={{ ...SMALL, marginTop: 4 }}>{plan.intra.note}</div>
          </div>
          <div style={CARD}>
            <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 4 }}>🔄 После ({plan.post.timing})</div>
            <div style={{ fontSize: 11, color: '#fff' }}>{plan.post.carbsG} г углеводов + {plan.post.proteinG} г белка</div>
            <div style={{ ...SMALL, marginTop: 4 }}>{plan.post.note}</div>
          </div>
          <div style={{ ...CARD, borderColor: 'rgba(96,165,250,0.2)' }}>
            <div style={{ fontSize: 11, color: '#60a5fa', fontWeight: 700 }}>💧 Жидкость за сессию: ~{plan.fluidTotalMl} мл</div>
          </div>
          {plan.safetyWarnings.length > 0 && <div style={{ ...CARD, borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)' }}>
            <div style={{ fontSize: 11, color: '#f87171', fontWeight: 700, marginBottom: 4 }}>⚠️ PED-контекст</div>
            {plan.safetyWarnings.map((warning, i) => <div key={i} style={{ ...SMALL, color: 'rgba(255,255,255,0.8)', marginBottom: 3 }}>{warning}</div>)}
          </div>}
          <div style={{ padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 4 }}>Обоснование</div>
            {plan.rationale.map((t, i) => <div key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5, marginBottom: 2 }}>{t}</div>)}
          </div>
        </>
      ) : (
        <div style={{ ...SMALL, textAlign: 'center', padding: 20 }}>Введите тоннаж/длительность или завершите тренировку.</div>
      )}
    </div>
  );
};

export default React.memo(PeriWorkoutCard);
