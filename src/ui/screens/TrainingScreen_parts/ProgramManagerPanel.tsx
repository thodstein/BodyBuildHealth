/**
 * ProgramManagerPanel.tsx — менеджер и редактор программ пользователя (зона «Планировщик», режим «Мои программы»).
 *
 * Три действия:
 *  - 🆕 Создать с нуля (ББ / ПЛ)
 *  - 🔍 Взять из библиотеки (клон FullProgram → редактируемая ББ; клон LMS-цикла → ПЛ-ссылка, цикл immutable)
 *  - 📂 Загрузить свою (список сохранённых UserProgram: открыть / удалить)
 *
 * Редактор:
 *  - Мета (название, цель, уровень, дни/нед).
 *  - ББ: недели → сессии → блоки (упражнение + схема подходов). Добавить/удалить блок, добавить неделю.
 *  - ПЛ: ссылка на immutable LMS-цикл (только просмотр) + пользовательский оверлей
 *    (расписание, заметки, рабочие максимумы, слабые группы). Процентки цикла НЕ редактируются.
 *
 * Сохранение → ProgramStore (localStorage, версионирование через revisions).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getAllPrograms } from '../../../engines/complete-program-library.engine';
import type { FullProgram } from '../../../engines/complete-program-library.engine';
import { LMS_CYCLES } from '../../../data/lms-cycles/lms-cycle-index';
import { getReferencedCycle } from '../../../engines/user-program/program-store';
import {
  loadUserPrograms, saveUserProgram, deleteUserProgram,
  cloneFromLibrary, cloneFromCycle, createBlank, createFromBuild,
} from '../../../engines/user-program/program-store';
import type {
  UserProgram, BBProgramBody, PLProgramBody, UserWeek, UserSession, UserBlock, UserSet,
} from '../../../engines/user-program/user-program.types';
import { newId } from '../../../engines/user-program/user-program.types';
import { HybridPlanPanel } from './HybridPlanPanel';
import { BbProgramLibraryPicker } from './BbProgramLibraryPicker';
import { ACCENT, CARD, BTN, BTN_GHOST, SMALL, DIM, DIM_STRONG, IN, panelStyle } from './training-ui';
import { GROUP_RU } from './program-types';

const GOAL_OPTS = [
  { id: 'hypertrophy', label: 'Масса' }, { id: 'powerlifting', label: 'Сила (ПЛ)' },
  { id: 'peaking', label: 'Пик/сушка' }, { id: 'recomp', label: 'Рекомпозиция' }, { id: 'rehab', label: 'Реабилитация' },
];
const LEVEL_OPTS = [
  { id: 'beginner', label: 'Новичок' }, { id: 'intermediate', label: 'Средний' },
  { id: 'advanced', label: 'Опытный' }, { id: 'enhanced', label: 'Enhanced' },
];

const DIR_COLOR: Record<string, string> = { bb: '#00e68a', pl: '#a78bfa', hybrid: '#3b82f6' };
const DIR_LABEL: Record<string, string> = { bb: 'ББ', pl: 'ПЛ', hybrid: 'Hybrid' };
const SOURCE_LABEL: Record<string, string> = {
  custom: 'своя', cloned_library: 'из библиотеки', cloned_cycle: 'клон цикла', from_build: 'из сборки',
};

const btn: React.CSSProperties = { ...BTN, flex: 1, minWidth: 0 };
const ghostBtn: React.CSSProperties = { ...BTN_GHOST, flex: 1, minWidth: 0 };

export const ProgramManagerPanel: React.FC = () => {
  const [programs, setPrograms] = useState<UserProgram[]>(() => loadUserPrograms());
  const [editing, setEditing] = useState<UserProgram | null>(null);
  const [pickerOpen, setPickerOpen] = useState<'bb' | 'pl' | null>(null);
  const [toast, setToast] = useState('');

  const refresh = useCallback(() => setPrograms(loadUserPrograms()), []);
  const flash = useCallback((m: string) => { setToast(m); setTimeout(() => setToast(''), 2200); }, []);

  const startCreate = (dir: 'bb' | 'pl' | 'hybrid') => {
    const p = createBlank(dir);
    setEditing(p);
  };

  const startCloneLibrary = (program: FullProgram) => {
    const p = cloneFromLibrary(program);
    setEditing(p);
    setPickerOpen(null);
    flash('🔗 Программа клонирована в редактируемую копию');
  };

  const startCloneCycle = (cycleId: string) => {
    const p = cloneFromCycle(cycleId);
    if (!p) { flash('⚠ Цикл не найден'); return; }
    setEditing(p);
    setPickerOpen(null);
    flash('🔗 ПЛ-цикл подключён (immutable, оверлей редактируем)');
  };

  const openExisting = (id: string) => {
    const p = programs.find(x => x.meta.id === id) ?? null;
    setEditing(p);
  };

  const removeProgram = (id: string) => {
    deleteUserProgram(id);
    refresh();
    if (editing?.meta.id === id) setEditing(null);
    flash('🗑 Удалено');
  };

  const commit = (note?: string) => {
    if (!editing) return;
    saveUserProgram(editing, note);
    refresh();
    flash('✅ Сохранено');
  };

  const allLibraryPrograms = useMemo(() => getAllPrograms(), []);
  const plCycles = useMemo(() => LMS_CYCLES, []);

  if (editing) {
    return <ProgramEditor
      program={editing}
      onChange={setEditing}
      onSave={commit}
      onBack={() => { setEditing(null); refresh(); }}
    />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: ACCENT }}>📂 Мои программы</div>
      <div style={{ fontSize: 11, color: DIM }}>
        Создавайте свои программы с нуля, клонируйте из библиотеки или подключайте проф. ПЛ-циклы (без изменения их проценток).
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button style={btn} onClick={() => startCreate('bb')}>🆕 ББ</button>
        <button style={btn} onClick={() => startCreate('pl')}>🆕 ПЛ</button>
        <button style={{...btn, color:'#3b82f6', borderColor:'rgba(59,130,246,0.3)'}} onClick={() => startCreate('hybrid')}>⚡ Powerbuilder</button>
        <button style={ghostBtn} onClick={() => setPickerOpen('bb')}>🔍 Библиотека</button>
        <button style={ghostBtn} onClick={() => setPickerOpen('pl')}>🔍 ПЛ-циклы</button>
      </div>

      {/* Saved list */}
      <div style={{ ...CARD, padding: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.3, marginBottom: 8, color: DIM_STRONG, textTransform: 'uppercase' }}>
          Сохранённые ({programs.length})
        </div>
        {programs.length === 0 && <div style={{ fontSize: 11, color: DIM, padding: '12px 0' }}>Пока пусто. Создайте или клонируйте программу.</div>}
        {programs.map(p => (
          <div key={p.meta.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: DIR_COLOR[p.meta.direction], minWidth: 28 }}>{DIR_LABEL[p.meta.direction]}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: DIM_STRONG, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.meta.title}</div>
              <div style={{ fontSize: 10, color: DIM }}>
                {p.meta.daysPerWeek}д/нед · {p.meta.weeks} нед · {SOURCE_LABEL[p.meta.source] ?? p.meta.source}
                {p.meta.updatedAt && ' · ' + new Date(p.meta.updatedAt).toLocaleDateString()}
              </div>
            </div>
            <button style={{ ...BTN_GHOST, padding: '4px 10px', fontSize: 11, minHeight: 0 }} onClick={() => openExisting(p.meta.id)}>Открыть</button>
            <button style={{ ...BTN_GHOST, padding: '4px 10px', fontSize: 11, minHeight: 0, color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }} onClick={() => removeProgram(p.meta.id)}>✕</button>
          </div>
        ))}
      </div>

      {pickerOpen === 'bb' && (
        <div style={{ ...CARD, padding: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: ACCENT }}>Библиотека программ</span>
            <button style={{ ...BTN_GHOST, padding: '4px 10px', fontSize: 11, minHeight: 0 }} onClick={() => setPickerOpen(null)}>Закрыть</button>
          </div>
          <BbProgramLibraryPicker value={null} label="Выбрать программу" programs={allLibraryPrograms} onSelect={startCloneLibrary} />
        </div>
      )}

      {pickerOpen === 'pl' && (
        <div style={{ ...CARD, padding: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#a78bfa' }}>Проф. ПЛ-циклы (immutable)</span>
            <button style={{ ...BTN_GHOST, padding: '4px 10px', fontSize: 11, minHeight: 0 }} onClick={() => setPickerOpen(null)}>Закрыть</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 360, overflowY: 'auto' }}>
            {plCycles.map(c => (
              <button key={c.meta.id} onClick={() => startCloneCycle(c.meta.id)} style={{ textAlign: 'left', padding: '8px 10px', borderRadius: 8, background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.18)', color: DIM_STRONG, cursor: 'pointer' }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{c.meta.title}</div>
                <div style={{ fontSize: 10, color: DIM }}>{c.meta.sessionsPerWeek}д/нед · {c.meta.weeks} нед · {c.meta.level} · {c.meta.period}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {toast && <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, padding: '4px 0' }}>{toast}</div>}
    </div>
  );
};

/* ───────────────────────── Редактор ───────────────────────── */

const ProgramEditor: React.FC<{ program: UserProgram; onChange: (p: UserProgram) => void; onSave: (note?: string) => void; onBack: () => void }> = ({ program, onChange, onSave, onBack }) => {
  const dir = program.meta.direction;
  const update = (patch: Partial<UserProgram>) => onChange({ ...program, ...patch });
  const updateMeta = (patch: Partial<UserProgram['meta']>) => onChange({ ...program, meta: { ...program.meta, ...patch } });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button style={{ ...BTN_GHOST, padding: '6px 12px', fontSize: 11, minHeight: 0 }} onClick={onBack}>← К списку</button>
        <span style={{ fontSize: 11, fontWeight: 800, color: DIR_COLOR[dir] }}>{DIR_LABEL[dir]} · {SOURCE_LABEL[program.meta.source] ?? program.meta.source}</span>
        <button style={{ ...BTN, padding: '6px 14px', fontSize: 11, minHeight: 0, marginLeft: 'auto' }} onClick={() => onSave('Ручная правка')}>💾 Сохранить</button>
      </div>

      {/* Meta */}
      <div style={{ ...CARD, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input style={IN} value={program.meta.title} onChange={e => updateMeta({ title: e.target.value })} placeholder="Название программы" />
        <div style={{ display: 'flex', gap: 6 }}>
          <select style={IN} value={program.meta.goal} onChange={e => updateMeta({ goal: e.target.value })}>
            {GOAL_OPTS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <select style={IN} value={program.meta.level} onChange={e => updateMeta({ level: e.target.value })}>
            {LEVEL_OPTS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <label style={{ ...SMALL, display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
            Дней/нед
            <input type="number" style={IN} value={program.meta.daysPerWeek} min={1} max={7} onChange={e => updateMeta({ daysPerWeek: parseInt(e.target.value) || 1 })} />
          </label>
          <label style={{ ...SMALL, display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
            Недель
            <input type="number" style={IN} value={program.meta.weeks} min={1} max={24} onChange={e => updateMeta({ weeks: parseInt(e.target.value) || 1 })} />
          </label>
        </div>
      </div>

      {dir === 'bb' && program.bb && <BBEditor body={program.bb} onChange={(bb) => update({ bb })} />}
      {dir === 'pl' && program.pl && <PLEditor body={program.pl} onChange={(pl) => update({ pl })} />}
      {dir === 'hybrid' && <HybridPlanPanel />}
    </div>
  );
};

/* ─── ББ-редактор: недели → сессии → блоки ─── */

const BBEditor: React.FC<{ body: BBProgramBody; onChange: (b: BBProgramBody) => void }> = ({ body, onChange }) => {
  const setWeeks = (weeks: UserWeek[]) => onChange({ ...body, weeks });
  const addWeek = () => {
    const n = body.weeks.length + 1;
    setWeeks([...body.weeks, { week: n, phase: 'accumulation', deload: false, sessions: [] }]);
  };
  const updateWeek = (wi: number, patch: Partial<UserWeek>) => {
    const w2 = body.weeks.map((w, i) => i === wi ? { ...w, ...patch } : w);
    setWeeks(w2);
  };
  const removeWeek = (wi: number) => setWeeks(body.weeks.filter((_, i) => i !== wi).map((w, i) => ({ ...w, week: i + 1 })));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT }}>Структура ({body.weeks.length} нед)</div>
      {body.weeks.map((w, wi) => (
        <div key={wi} style={{ ...CARD, padding: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: DIM_STRONG }}>Неделя {w.week}</span>
            <select style={{ ...IN, padding: '4px 6px', fontSize: 10, flex: '0 0 auto' }} value={w.phase} onChange={e => updateWeek(wi, { phase: e.target.value as UserWeek['phase'] })}>
              <option value="accumulation">Накопление</option>
              <option value="intensification">Интенсификация</option>
              <option value="deload">Разгрузка</option>
              <option value="peaking">Пик</option>
            </select>
            <label style={{ fontSize: 10, color: DIM, display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="checkbox" checked={w.deload} onChange={e => updateWeek(wi, { deload: e.target.checked })} /> deload
            </label>
            <button style={{ ...BTN_GHOST, padding: '3px 8px', fontSize: 10, minHeight: 0, marginLeft: 'auto', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }} onClick={() => removeWeek(wi)}>✕ нед</button>
          </div>
          <SessionList sessions={w.sessions} onChange={(sessions) => updateWeek(wi, { sessions })} />
        </div>
      ))}
      <button style={{ ...BTN_GHOST, padding: '8px' }} onClick={addWeek}>+ Добавить неделю</button>
    </div>
  );
};

const SessionList: React.FC<{ sessions: UserSession[]; onChange: (s: UserSession[]) => void }> = ({ sessions, onChange }) => {
  const addSession = () => onChange([...sessions, { id: newId('ses'), name: 'День ' + (sessions.length + 1), focus: '', blocks: [] }]);
  const updateSession = (si: number, patch: Partial<UserSession>) => onChange(sessions.map((s, i) => i === si ? { ...s, ...patch } : s));
  const removeSession = (si: number) => onChange(sessions.filter((_, i) => i !== si));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {sessions.map((s, si) => (
        <div key={s.id} style={{ padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <input style={{ ...IN, padding: '4px 6px', fontSize: 11, flex: 1 }} value={s.name} onChange={e => updateSession(si, { name: e.target.value })} placeholder="День" />
            <input style={{ ...IN, padding: '4px 6px', fontSize: 11, flex: 1 }} value={s.focus} onChange={e => updateSession(si, { focus: e.target.value })} placeholder="Фокус (грудь/трицепс)" />
            <button style={{ ...BTN_GHOST, padding: '3px 8px', fontSize: 10, minHeight: 0, color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }} onClick={() => removeSession(si)}>✕</button>
          </div>
          <BlockList blocks={s.blocks} onChange={(blocks) => updateSession(si, { blocks })} />
        </div>
      ))}
      <button style={{ ...BTN_GHOST, padding: '6px', fontSize: 10 }} onClick={addSession}>+ Сессия</button>
    </div>
  );
};

const BlockList: React.FC<{ blocks: UserBlock[]; onChange: (b: UserBlock[]) => void }> = ({ blocks, onChange }) => {
  const addBlock = () => onChange([...blocks, { id: newId('blk'), type: 'accessory', exerciseName: '', muscle: '', role: 'accessory', sets: [{ reps: 10, rir: 2 }] }]);
  const updateBlock = (bi: number, patch: Partial<UserBlock>) => onChange(blocks.map((b, i) => i === bi ? { ...b, ...patch } : b));
  const removeBlock = (bi: number) => onChange(blocks.filter((_, i) => i !== bi));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {blocks.map((b, bi) => (
        <div key={b.id} style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '4px 0' }}>
          <select style={{ ...IN, padding: '3px 4px', fontSize: 10, flex: '0 0 86px' }} value={b.type} onChange={e => updateBlock(bi, { type: e.target.value as UserBlock['type'], role: e.target.value === 'compound' ? 'primary' : 'accessory' })}>
            <option value="compound">Базовое</option>
            <option value="accessory">Доп.</option>
            <option value="isolation">Изоляция</option>
            <option value="finisher">Финишь</option>
          </select>
          <input style={{ ...IN, padding: '4px 6px', fontSize: 11, flex: 1 }} value={b.exerciseName} onChange={e => updateBlock(bi, { exerciseName: e.target.value })} placeholder="Упражнение" />
          <input style={{ ...IN, padding: '4px 6px', fontSize: 11, flex: '0 0 90px' }} value={b.muscle} onChange={e => updateBlock(bi, { muscle: e.target.value })} placeholder="Мышца" list="muscle-list" />
          <SetEditor sets={b.sets} onChange={(sets) => updateBlock(bi, { sets })} />
          <button style={{ ...BTN_GHOST, padding: '3px 6px', fontSize: 10, minHeight: 0, color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }} onClick={() => removeBlock(bi)}>✕</button>
        </div>
      ))}
      <button style={{ ...BTN_GHOST, padding: '4px 8px', fontSize: 10, minHeight: 0, alignSelf: 'flex-start' }} onClick={addBlock}>+ Упражнение</button>
      <datalist id="muscle-list">{Object.entries(GROUP_RU).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</datalist>
    </div>
  );
};

const SetEditor: React.FC<{ sets: UserSet[]; onChange: (s: UserSet[]) => void }> = ({ sets, onChange }) => {
  const add = () => onChange([...sets, { reps: 10, rir: 2 }]);
  const upd = (i: number, patch: Partial<UserSet>) => onChange(sets.map((s, j) => j === i ? { ...s, ...patch } : s));
  const del = (i: number) => onChange(sets.filter((_, j) => j !== i));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, flex: '0 0 auto' }}>
      {sets.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'rgba(0,230,138,0.06)', borderRadius: 6, padding: '2px 4px' }}>
          <input type="number" style={{ ...IN, padding: '2px 4px', fontSize: 10, width: 34 }} value={typeof s.reps === 'number' ? s.reps : 0} onChange={e => upd(i, { reps: parseInt(e.target.value) || 0 })} title="повт" />
          <span style={{ fontSize: 9, color: DIM }}>×</span>
          <input type="number" style={{ ...IN, padding: '2px 4px', fontSize: 10, width: 30 }} value={s.rir} min={0} max={5} onChange={e => upd(i, { rir: parseInt(e.target.value) || 0 })} title="RIR" />
          <button style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: 10, padding: 0 }} onClick={() => del(i)}>✕</button>
        </div>
      ))}
      <button style={{ ...BTN_GHOST, padding: '2px 6px', fontSize: 10, minHeight: 0 }} onClick={add}>+ сет</button>
    </div>
  );
};

/* ─── ПЛ-редактор: immutable-цикл + оверлей ─── */

const PLEditor: React.FC<{ body: PLProgramBody; onChange: (b: PLProgramBody) => void }> = ({ body, onChange }) => {
  const cycle = useMemo(() => getReferencedCycle({ meta: {} as any, pl: body } as UserProgram), [body.sourceCycleId]);
  const set = (patch: Partial<PLProgramBody>) => onChange({ ...body, ...patch });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ ...panelStyle('#a78bfa'), padding: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#a78bfa', marginBottom: 4 }}>📋 Проф. ПЛ-цикл (immutable)</div>
        {cycle ? (
          <div style={{ fontSize: 11, color: DIM_STRONG }}>
            <div style={{ fontWeight: 700 }}>{cycle.meta.title}</div>
            <div style={{ fontSize: 10, color: DIM }}>{cycle.meta.sessionsPerWeek}д/нед · {cycle.meta.weeks} нед · {cycle.meta.level} · {cycle.meta.period} · корректировка {((cycle.meta.correctionPct || 0) * 100).toFixed(1)}%/нед</div>
            <div style={{ fontSize: 10, color: DIM, marginTop: 4 }}>Процентки/сеты/повторения цикла не редактируются — это профессиональная методика. Ниже — ваш оверлей.</div>
          </div>
        ) : (
          <div style={{ fontSize: 11, color: '#ef4444' }}>⚠ Цикл не выбран. Вернитесь и подключите цикл через «🔍 ПЛ-циклы».</div>
        )}
      </div>

      <div style={{ ...CARD, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT }}>Оверлей пользователя</div>

        <label style={{ ...SMALL, display: 'flex', flexDirection: 'column', gap: 4 }}>
          Рабочие максимумы (кг) — для расчёта весов из % цикла
          <div style={{ display: 'flex', gap: 6 }}>
            {(['squat', 'bench', 'dead'] as const).map(k => (
              <label key={k} style={{ flex: 1, fontSize: 10, color: DIM }}>
                {k === 'squat' ? 'Присед' : k === 'bench' ? 'Жим' : 'Тяга'}
                <input type="number" style={IN} value={body.workMax[k] ?? ''} onChange={e => set({ workMax: { ...body.workMax, [k]: parseFloat(e.target.value) || undefined } })} />
              </label>
            ))}
          </div>
        </label>

        <label style={{ ...SMALL, display: 'flex', flexDirection: 'column', gap: 4 }}>
          Заметки к циклу
          <textarea style={{ ...IN, minHeight: 60, resize: 'vertical' }} value={body.notes} onChange={e => set({ notes: e.target.value })} placeholder="Например: акцент на слабые группы, адаптации под восстановление" />
        </label>

        <div>
          <div style={{ fontSize: 10, color: DIM, marginBottom: 4 }}>Слабые группы (приоритет акцента)</div>
          <WeakPointChips value={body.weakPoints} onChange={(weakPoints) => set({ weakPoints })} />
        </div>

        <div>
          <div style={{ fontSize: 10, color: DIM, marginBottom: 4 }}>Расписание: сессия → день недели</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {body.schedule.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                <span style={{ color: DIM, minWidth: 70 }}>Сессия {s.sessionIdx + 1}</span>
                <select style={{ ...IN, padding: '4px 6px', fontSize: 10 }} value={s.dayOfWeek} onChange={e => { const sc = [...body.schedule]; sc[i] = { ...sc[i], dayOfWeek: parseInt(e.target.value) }; set({ schedule: sc }); }}>
                  {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d, di) => <option key={di} value={di}>{d}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const WEAK_OPTS = ['chest', 'back', 'quads', 'hamstrings', 'glutes', 'shoulders', 'biceps', 'triceps', 'core', 'deadlift', 'squat', 'bench'];
const WeakPointChips: React.FC<{ value: string[]; onChange: (v: string[]) => void }> = ({ value, onChange }) => {
  const toggle = (m: string) => onChange(value.includes(m) ? value.filter(x => x !== m) : [...value, m]);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {WEAK_OPTS.map(m => {
        const on = value.includes(m);
        return <button key={m} onClick={() => toggle(m)} style={{ padding: '3px 8px', borderRadius: 8, fontSize: 10, cursor: 'pointer', border: on ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)', background: on ? 'rgba(0,230,138,0.18)' : 'rgba(255,255,255,0.02)', color: on ? '#fff' : DIM }}>{GROUP_RU[m] ?? m}</button>;
      })}
    </div>
  );
};