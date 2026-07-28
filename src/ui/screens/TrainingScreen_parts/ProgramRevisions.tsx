/**
 * ProgramRevisions.tsx — компактный diff-вьюер ревизий программы.
 *
 * F3.4: тренер хочет видеть, что изменилось между версиями (revisions
 * хранятся в program.meta.revisions). Lite-версия: 2 выпадающих списка
 * для выбора двух ревизий + diff-таблица по упражнениям.
 */
import React, { useMemo, useState } from 'react';
import type { UserProgram } from '../../../engines/user-program/user-program.types';
import { CARD, DIM, DIM_STRONG, ACCENT, BTN_GHOST } from './training-ui';
import { loadUserPrograms } from '../../../engines/user-program/program-store';

interface StoredRevision {
  id: string;
  ts: string;
  note: string;
  program: UserProgram;
}

function getStoredProgramRevisions(programId: string): StoredRevision[] {
  // Текущая реализация revisions хранится inline в program.meta.revisions (без полного snapshot).
  // Для diff-режима нам нужен полный snapshot — в этой lite-версии мы используем
  // все сохранённые UserProgram, у которых meta.id совпадает (из localStorage).
  // Это упрощение: реальные снимки нужно добавить в program-store.
  try {
    const all = loadUserPrograms();
    // Исключаем текущую программу — она не имеет ts (только updatedAt).
    // Это эвристика: возвращаем ВСЕ программы с тем же id (исключая текущую).
    return all
      .filter(p => p.meta.id === programId)
      .map((p, i) => ({
        id: `${p.meta.id}_${p.meta.updatedAt}_${i}`,
        ts: p.meta.updatedAt,
        note: p.meta.title + ' (' + p.meta.weeks + ' нед, ' + p.meta.daysPerWeek + ' д/нед)',
        program: p,
      }));
  } catch { return []; }
}

export const ProgramRevisionsDiff: React.FC<{
  program: UserProgram;
}> = ({ program }) => {
  const [leftId, setLeftId] = useState<string>('');
  const [rightId, setRightId] = useState<string>('');

  const revisions = useMemo(() => getStoredProgramRevisions(program.meta.id), [program.meta.id]);

  if (revisions.length < 2) {
    return (
      <div style={{ ...CARD, padding: 10, borderLeft: '3px solid #94a3b8' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: ACCENT, marginBottom: 4 }}>📜 История правок</div>
        <div style={{ fontSize: 11, color: DIM }}>
          {revisions.length === 0
            ? 'Сохранённых ревизий пока нет. Нажмите «💾 Сохранить» в редакторе.'
            : `Доступна только ${revisions.length} версия. Сохраните программу ещё раз для сравнения.`}
        </div>
      </div>
    );
  }

  // Auto-select: первая = левая (старая), последняя = правая (новая)
  const effectiveLeft = leftId || revisions[0].id;
  const effectiveRight = rightId || revisions[revisions.length - 1].id;
  const leftRev = revisions.find(r => r.id === effectiveLeft);
  const rightRev = revisions.find(r => r.id === effectiveRight);

  const diff = useMemo(() => {
    if (!leftRev || !rightRev) return null;
    const exLeft = new Map<string, number>();
    const exRight = new Map<string, number>();
    for (const w of leftRev.program.bb?.weeks ?? []) {
      for (const s of w.sessions ?? []) {
        for (const b of s.blocks ?? []) {
          if (b.exerciseName) exLeft.set(b.exerciseName, (exLeft.get(b.exerciseName) ?? 0) + (b.sets?.length ?? 0));
        }
      }
    }
    for (const w of rightRev.program.bb?.weeks ?? []) {
      for (const s of w.sessions ?? []) {
        for (const b of s.blocks ?? []) {
          if (b.exerciseName) exRight.set(b.exerciseName, (exRight.get(b.exerciseName) ?? 0) + (b.sets?.length ?? 0));
        }
      }
    }
    const allNames = new Set<string>([...exLeft.keys(), ...exRight.keys()]);
    const changes: Array<{ name: string; from: number; to: number; delta: number }> = [];
    for (const name of allNames) {
      const from = exLeft.get(name) ?? 0;
      const to = exRight.get(name) ?? 0;
      if (from !== to) changes.push({ name, from, to, delta: to - from });
    }
    return changes;
  }, [leftRev, rightRev]);

  return (
    <div style={{ ...CARD, padding: 10, borderLeft: '3px solid #94a3b8' }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: ACCENT, marginBottom: 6 }}>📜 Сравнение ревизий</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
        <select value={leftId} onChange={e => setLeftId(e.target.value)} style={{ flex: 1, minWidth: 120, padding: '4px 6px', fontSize: 10, background: 'var(--bg-secondary)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 4 }}>
          <option value="">— исходная (auto) —</option>
          {revisions.map(r => <option key={r.id} value={r.id}>{new Date(r.ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} — {r.note}</option>)}
        </select>
        <span style={{ alignSelf: 'center', color: DIM }}>→</span>
        <select value={rightId} onChange={e => setRightId(e.target.value)} style={{ flex: 1, minWidth: 120, padding: '4px 6px', fontSize: 10, background: 'var(--bg-secondary)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 4 }}>
          <option value="">— новая (auto) —</option>
          {revisions.map(r => <option key={r.id} value={r.id}>{new Date(r.ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} — {r.note}</option>)}
        </select>
      </div>
      {diff && diff.length > 0 ? (
        <div style={{ maxHeight: 200, overflowY: 'auto', fontSize: 10 }}>
          {diff.slice(0, 20).map(c => (
            <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 6px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ flex: 1, color: DIM_STRONG, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
              <span style={{ color: DIM, minWidth: 50, textAlign: 'right' }}>{c.from}с</span>
              <span style={{ color: c.delta > 0 ? '#22c55e' : '#ef4444', fontWeight: 700, minWidth: 50, textAlign: 'right' }}>{c.delta > 0 ? '+' : ''}{c.delta}с</span>
            </div>
          ))}
          {diff.length > 20 && <div style={{ fontSize: 10, color: DIM, padding: 4, fontStyle: 'italic' }}>…и ещё {diff.length - 20}</div>}
        </div>
      ) : diff ? (
        <div style={{ fontSize: 11, color: '#22c55e', padding: 6 }}>✅ Изменений не найдено</div>
      ) : (
        <div style={{ fontSize: 11, color: DIM, padding: 6 }}>Выберите две ревизии для сравнения.</div>
      )}
    </div>
  );
};
