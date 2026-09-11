/**
 * CardioRecordsSection.tsx — журнал личных рекордов + прогноз темпа (P2-2).
 * Своя кардио-зона: CRUD рекордов, лучший результат вида,
 * прогноз Riegel с рекорда, калибровка Billat по 6-мин тесту.
 */
import React, { useState } from 'react';
import {
  loadCardioRecords, saveCardioRecord, removeCardioRecord, bestCardioRecord,
  predictRunningTime, billatPaceFrom6Min, formatCardioTime,
  CARDIO_RECORD_LABELS, type CardioRecordKind, type CardioRecord,
} from '../../../engines/lms/cardio-records.engine';
import { CARD, ROW, LABEL, BTN, BTN_PRIMARY, BTN_DANGER, BTN_SMALL, Badge, HINT_SM, EmptyState, NumberInput } from './CardioUI';

const KINDS = Object.keys(CARDIO_RECORD_LABELS) as CardioRecordKind[];

function localToday(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

function fmtVal(kind: CardioRecordKind, v: number): string {
  return kind === 'ftp' || kind === 'cp20' ? `${v} Вт` : formatCardioTime(v);
}

/** Мини-график динамики вида: точки по дате, нормированные в 100×36. */
const RecordTrend: React.FC<{ kind: CardioRecordKind; list: CardioRecord[] }> = ({ kind, list }) => {
  const pts = list.filter(r => r.kind === kind).sort((a, b) => a.date.localeCompare(b.date));
  if (pts.length < 2) return null;
  const vals = pts.map(p => p.value);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const span = hi - lo || 1;
  const W = 100;
  const H = 36;
  const xy = pts.map((p, i) => {
    const x = pts.length === 1 ? 0 : (i / (pts.length - 1)) * W;
    const y = H - 4 - ((p.value - lo) / span) * (H - 8);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const better = kind === 'ftp' || kind === 'cp20'
    ? vals[vals.length - 1] >= vals[0]
    : vals[vals.length - 1] <= vals[0];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <svg width="110" height="40" viewBox={`0 0 ${W} ${H + 4}`} role="img" aria-label={`Динамика ${CARDIO_RECORD_LABELS[kind]}`}>
        <polyline points={xy} fill="none" stroke={better ? '#22c55e' : '#f59e0b'} strokeWidth="2" strokeLinejoin="round" />
        {pts.map((p, i) => {
          const x = pts.length === 1 ? 0 : (i / (pts.length - 1)) * W;
          const y = H - 4 - ((p.value - lo) / span) * (H - 8);
          return <circle key={p.id} cx={x} cy={y} r="2.2" fill={better ? '#22c55e' : '#f59e0b'} />;
        })}
      </svg>
      <span style={{ fontSize: 11, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
        {fmtVal(kind, vals[0])} → {fmtVal(kind, vals[vals.length - 1])} {better ? '▲' : '▼'}
      </span>
    </div>
  );
};

export const CardioRecordsSection: React.FC = () => {
  const [list, setList] = useState<CardioRecord[]>(() => loadCardioRecords());
  const [kind, setKind] = useState<CardioRecordKind>('run5k');
  const [valMin, setValMin] = useState('');
  const [valSec, setValSec] = useState('');
  const [power, setPower] = useState('');
  const [predKind, setPredKind] = useState<CardioRecordKind>('run5k');
  const [predDist, setPredDist] = useState('10000');
  const [sixMin, setSixMin] = useState('');

  const isPower = kind === 'ftp' || kind === 'cp20';
  const refresh = () => setList(loadCardioRecords());

  const add = () => {
    const value = isPower
      ? (Number(power) >= 30 && Number(power) <= 800 ? Math.round(Number(power)) : NaN)
      : ((Number(valMin) || 0) * 60 + (Number(valSec) || 0));
    if (!Number.isFinite(value) || value <= 0 || (!isPower && value > 7200)) return;
    saveCardioRecord({ id: `rec-${Date.now()}`, kind, value, date: localToday() });
    setValMin(''); setValSec(''); setPower('');
    refresh();
  };

  const pred = (() => {
    const base = bestCardioRecord(predKind);
    if (!base || predKind === 'ftp' || predKind === 'cp20') return null;
    const d1 = predKind === 'run5k' ? 5000 : predKind === 'run10k' ? 10000 : 21097.5;
    const d2 = Number(predDist);
    if (!(d2 > 0) || d2 === d1) return null;
    const t = predictRunningTime(base.value, d1, d2);
    return t != null ? { t, d2 } : null;
  })();
  const billat = (() => {
    const d = Number(sixMin);
    if (!(d > 500) || !(d < 5000)) return null;
    return billatPaceFrom6Min(d);
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={CARD}>
        <div style={LABEL}>🏆 Рекорды</div>
        {list.length === 0 && <EmptyState icon="🏆" title="Рекордов нет" desc="Добавьте первый — прогноз и калибровка Billat заработают." />}
        {list.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {list.map(r => (
              <div key={r.id} style={ROW}>
                <Badge>{CARDIO_RECORD_LABELS[r.kind]}</Badge>
                <span style={{ fontSize: 13, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmtVal(r.kind, r.value)}</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{r.date}</span>
                <span style={{ flex: 1 }} />
                <button style={{ ...BTN_DANGER, minHeight: 36, padding: '4px 10px' }} onClick={() => { removeCardioRecord(r.id); refresh(); }} aria-label={`Удалить рекорд ${CARDIO_RECORD_LABELS[r.kind]}`}>✕</button>
              </div>
            ))}
          </div>
        )}
        <div style={{ fontSize: 11, fontWeight: 800, color: '#fff', marginTop: 4 }}>Лучшие:</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {KINDS.map(k => {
            const b = bestCardioRecord(k);
            return <Badge key={k}>{CARDIO_RECORD_LABELS[k]}: {b ? fmtVal(k, b.value) : '—'}</Badge>;
          })}
        </div>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#fff', marginTop: 4 }}>Динамика:</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {KINDS.map(k => <RecordTrend key={k} kind={k} list={list} />)}
        </div>
      </div>
      <div style={CARD}>
        <div style={LABEL}>＋ Новый рекорд</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: '#fff', fontWeight: 700 }}>Вид</span>
            <select value={kind} onChange={e => setKind(e.target.value as CardioRecordKind)} aria-label="Вид рекорда"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.13)', borderRadius: 11, padding: '11px', color: '#fff', fontSize: 14, minHeight: 48 }}>
              {KINDS.map(k => <option key={k} value={k}>{CARDIO_RECORD_LABELS[k]}</option>)}
            </select>
          </label>
          {isPower ? (
            <NumberInput label="Мощность" value={power} onChange={setPower} min={30} max={800} step={1} placeholder="250" ariaLabel="Мощность рекорда" width={100} suffix="Вт" />
          ) : (
            <>
              <NumberInput label="Мин" value={valMin} onChange={setValMin} min={0} max={120} step={1} placeholder="20" ariaLabel="Минуты рекорда" width={80} suffix="мин" />
              <NumberInput label="Сек" value={valSec} onChange={setValSec} min={0} max={59} step={1} placeholder="0" ariaLabel="Секунды рекорда" width={80} suffix="с" />
            </>
          )}
          <button style={{ ...BTN_PRIMARY, minHeight: 48 }} onClick={add}>＋ Добавить</button>
        </div>
      </div>
      <div style={CARD}>
        <div style={LABEL}>🔮 Прогноз Riegel с лучшего рекорда</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: '#fff', fontWeight: 700 }}>База</span>
            <select value={predKind} onChange={e => setPredKind(e.target.value as CardioRecordKind)} aria-label="Базовый рекорд"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.13)', borderRadius: 11, padding: '11px', color: '#fff', fontSize: 14, minHeight: 48 }}>
              {(['run5k', 'run10k', 'runHalf'] as CardioRecordKind[]).map(k => <option key={k} value={k}>{CARDIO_RECORD_LABELS[k]}</option>)}
            </select>
          </label>
          <NumberInput label="Цель, м" value={predDist} onChange={setPredDist} min={1000} max={42195} step={500} placeholder="10000" ariaLabel="Целевая дистанция" width={110} suffix="м" />
        </div>
        <div style={{ fontSize: 13, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
          {pred ? `Прогноз: ${formatCardioTime(pred.t)} на ${(pred.d2 / 1000).toFixed(1)} км` : 'Нет базы для прогноза — добавьте рекорд бега.'}
        </div>
        <div style={HINT_SM}>Riegel t₂=t₁×(d₂/d₁)^1.06 — ориентир, не обещание.</div>
      </div>
      <div style={CARD}>
        <div style={LABEL}>📏 Калибровка Billat 30-30</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <NumberInput label="6-мин тест" value={sixMin} onChange={setSixMin} min={500} max={5000} step={10} placeholder="1720" ariaLabel="Дистанция 6-мин теста" width={110} suffix="м" />
        </div>
        <div style={{ fontSize: 13, color: '#fff' }}>{billat != null ? `Жёсткие 30 с — по ${billat} м (дистанция/12).` : 'Введите дистанцию 6-мин теста.'}</div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button style={BTN} onClick={refresh}>↻ Обновить</button>
      </div>
    </div>
  );
};
