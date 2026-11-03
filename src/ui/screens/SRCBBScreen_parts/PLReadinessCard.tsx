/**
 * PLReadinessCard.tsx — 🌅 Утренний чек-ин (Фаза 6, п.6).
 *
 * Показывает, КАК самочувствие повлияет на сегодняшнюю тренировку, и не даёт
 * менять план молча: пользователь видит штрафы, модификаторы и предпросмотр
 * скорректированных подходов, потом сам нажимает «Сохранить на сегодня».
 * Вчерашний чек-ин не действует — дата проверяется в движке.
 */
import React from 'react';
import {
  clearPLCheckin,
  evaluatePLReadiness,
  readPLCheckin,
  writePLCheckin,
  adjustSetsForReadiness,
  type PLAdjustableSet,
  type PLMorningCheckin,
} from '../../../engines/lms/pl-readiness-adjust.engine';
import { BbFoldCard } from '../TrainingScreen_parts/training-ui';

export interface PLReadinessPreviewExercise {
  name: string;
  targetSets: PLAdjustableSet[];
}

export interface PLReadinessCardProps {
  onNote?: (msg: string) => void;
  /** Первый день сегодняшней недели — для предпросмотра «что изменится». */
  previewDay?: PLReadinessPreviewExercise[] | null;
}

const LEVEL_COLOR: Record<'green' | 'yellow' | 'red', string> = {
  green: '#00e68a',
  yellow: '#fbbf24',
  red: '#ff5252',
};
const LEVEL_LABEL: Record<'green' | 'yellow' | 'red', string> = {
  green: 'зелёная',
  yellow: 'жёлтая',
  red: 'красная',
};

const INPUT_STYLE: React.CSSProperties = {
  width: '100%', minHeight: 36, padding: '6px 8px', borderRadius: 8,
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)',
  color: '#fff', fontSize: 13, fontWeight: 700, boxSizing: 'border-box',
};

export const PLReadinessCard: React.FC<PLReadinessCardProps> = ({ onNote, previewDay }) => {
  const stored = React.useMemo(() => readPLCheckin(typeof localStorage === 'undefined' ? null : localStorage), []);
  const [sleepHours, setSleepHours] = React.useState(stored?.checkin.sleepHours ?? 8);
  const [hrvPct, setHrvPct] = React.useState(Math.round((stored?.checkin.hrvRatio ?? 1) * 100));
  const [doms, setDoms] = React.useState(stored?.checkin.doms ?? 0);
  const [stress, setStress] = React.useState(stored?.checkin.stress ?? 0);
  const [weight, setWeight] = React.useState(stored?.checkin.bodyWeightKg ?? 0);
  const [baseline, setBaseline] = React.useState(stored?.checkin.baselineWeightKg ?? 0);
  const [saved, setSaved] = React.useState(!!stored);

  const checkin: PLMorningCheckin = {
    sleepHours,
    hrvRatio: hrvPct / 100,
    doms,
    stress,
    ...(weight > 0 && baseline > 0 ? { bodyWeightKg: weight, baselineWeightKg: baseline } : {}),
  };
  const verdict = evaluatePLReadiness(checkin);
  const color = LEVEL_COLOR[verdict.level];

  const preview = React.useMemo(() => {
    if (!previewDay || previewDay.length === 0 || verdict.level === 'green') return [];
    return previewDay.slice(0, 3).map(ex => {
      const after = adjustSetsForReadiness(ex.targetSets ?? [], verdict);
      const w0 = ex.targetSets?.[0]?.weight ?? 0;
      const w1 = after[0]?.weight ?? 0;
      return {
        name: ex.name,
        before: `${ex.targetSets?.length ?? 0}×${w0}`,
        after: `${after.length}×${w1}`,
        changed: after.length !== (ex.targetSets?.length ?? 0) || w1 !== w0,
      };
    });
  }, [previewDay, verdict.level]);

  return (
    <div data-pl="pl-checkin" style={{ marginTop: 8 }}>
      <BbFoldCard
        icon="🌅"
        accent={color}
        defaultOpen={!stored}
        title={`🌅 Утренний чек-ин · готовность ${verdict.score}/100 (${LEVEL_LABEL[verdict.level]})${saved ? ' · применён на сегодня' : ''}`}
      >
        <div style={{ fontSize: 10, color: '#fff', opacity: 0.8, lineHeight: 1.45, marginBottom: 8 }}>
          Влияет только на <b>сегодняшнюю</b> тренировку (объём/RIR, в красной зоне — вес). Структура плана и недели не меняется;
          нагрузку чек-ин не повышает никогда.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 6 }}>
          <label style={{ fontSize: 10, color: '#fff', fontWeight: 700 }}>
            Сон, ч
            <input
              type="number" min={0} max={14} step={0.5} value={sleepHours}
              aria-label="Сон, часов" style={INPUT_STYLE}
              onChange={e => { setSleepHours(Number(e.target.value)); setSaved(false); }}
            />
          </label>
          <label style={{ fontSize: 10, color: '#fff', fontWeight: 700 }}>
            HRV, % от базы
            <input
              type="number" min={30} max={300} step={1} value={hrvPct}
              aria-label="HRV, процент от базы" style={INPUT_STYLE}
              onChange={e => { setHrvPct(Number(e.target.value)); setSaved(false); }}
            />
          </label>
          <label style={{ fontSize: 10, color: '#fff', fontWeight: 700 }}>
            Мышечная боль 0–10
            <input
              type="number" min={0} max={10} step={1} value={doms}
              aria-label="Мышечная боль" style={INPUT_STYLE}
              onChange={e => { setDoms(Number(e.target.value)); setSaved(false); }}
            />
          </label>
          <label style={{ fontSize: 10, color: '#fff', fontWeight: 700 }}>
            Стресс 0–10
            <input
              type="number" min={0} max={10} step={1} value={stress}
              aria-label="Стресс" style={INPUT_STYLE}
              onChange={e => { setStress(Number(e.target.value)); setSaved(false); }}
            />
          </label>
          <label style={{ fontSize: 10, color: '#fff', fontWeight: 700 }}>
            Вес сегодня, кг
            <input
              type="number" min={0} max={300} step={0.1} value={weight}
              aria-label="Вес сегодня" style={INPUT_STYLE}
              onChange={e => { setWeight(Number(e.target.value)); setSaved(false); }}
            />
          </label>
          <label style={{ fontSize: 10, color: '#fff', fontWeight: 700 }}>
            Обычный вес, кг
            <input
              type="number" min={0} max={300} step={0.1} value={baseline}
              aria-label="Обычный утренний вес" style={INPUT_STYLE}
              onChange={e => { setBaseline(Number(e.target.value)); setSaved(false); }}
            />
          </label>
        </div>

        <div data-pl="pl-checkin-verdict" style={{ marginTop: 8, fontSize: 11, color, fontWeight: 700, lineHeight: 1.45 }}>
          {verdict.summary}
        </div>
        {verdict.reasons.length > 0 && (
          <div style={{ marginTop: 4 }}>
            {verdict.reasons.map((r, i) => (
              <div key={i} style={{ fontSize: 10, color: '#fff', opacity: 0.85, lineHeight: 1.4 }}>· {r}</div>
            ))}
          </div>
        )}
        {preview.length > 0 && (
          <div data-pl="pl-checkin-preview" style={{ marginTop: 6 }}>
            <div style={{ fontSize: 10, color: '#fff', fontWeight: 700, marginBottom: 2 }}>Что изменится в первом дне недели:</div>
            {preview.map(p => (
              <div key={p.name} style={{ fontSize: 10, color: p.changed ? color : '#fff', opacity: p.changed ? 1 : 0.75 }}>
                {p.name}: {p.before} → {p.after}{p.changed ? '' : ' (без изменений)'}
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            data-pl="pl-checkin-save"
            onClick={() => {
              const rec = writePLCheckin(typeof localStorage === 'undefined' ? null : localStorage, checkin);
              setSaved(!!rec);
              onNote?.(rec
                ? `🌅 Чек-ин сохранён: готовность ${rec.verdict.score}/100 (${LEVEL_LABEL[rec.verdict.level]}) — плеер применит изменения к сегодняшней тренировке.`
                : '⚠ Не удалось сохранить чек-ин (localStorage недоступен).');
            }}
            style={{
              minHeight: 38, padding: '8px 12px', borderRadius: 10, border: `1px solid ${color}`,
              background: 'rgba(255,255,255,0.04)', color, fontSize: 12, fontWeight: 800, cursor: 'pointer',
            }}
          >{saved ? '✓ Обновить на сегодня' : 'Применить на сегодня'}</button>
          <button
            type="button"
            data-pl="pl-checkin-clear"
            onClick={() => {
              clearPLCheckin(typeof localStorage === 'undefined' ? null : localStorage);
              setSaved(false);
              onNote?.('🌅 Чек-ин сброшен — тренировка снова идёт по плану.');
            }}
            style={{
              minHeight: 38, padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.18)',
              background: 'transparent', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >Сбросить</button>
        </div>
        <div style={{ marginTop: 6 }}>
          {verdict.notes.map((n, i) => (
            <div key={i} style={{ fontSize: 9, color: '#fff', opacity: 0.6, lineHeight: 1.45 }}>· {n}</div>
          ))}
        </div>
      </BbFoldCard>
    </div>
  );
};

export default PLReadinessCard;
