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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAllPrograms } from '../../../engines/complete-program-library.engine';
import type { FullProgram } from '../../../engines/complete-program-library.engine';
import { LMS_CYCLES } from '../../../data/lms-cycles/lms-cycle-index';
import { getReferencedCycle } from '../../../engines/user-program/program-store';
import {
  loadUserPrograms, saveUserProgram, deleteUserProgram, deleteRevision,
  cloneFromLibrary, cloneFromCycle, createBlank, createFromBuild, userWeekToBBPlan, validateProgram,
} from '../../../engines/user-program/program-store';
import type {
  UserProgram, BBProgramBody, PLProgramBody, UserWeek, UserSession, UserBlock, UserSet,
  ProgramConstraints, ProgramProgression,
} from '../../../engines/user-program/user-program.types';
import { newId } from '../../../engines/user-program/user-program.types';
import { HybridPlanPanel } from './HybridPlanPanel';
import { ExercisePicker } from './ExercisePicker';
import { BbProgramLibraryPicker } from './BbProgramLibraryPicker';
import { VolumeBudgetCard } from './VolumeBudgetCard';
import { BbContextPanel, PLContextPanel } from './program-editor-context-panels';
import { SET_TEMPLATES } from './program-types';
import {
  autodraftBBPlan,
  buildUserProgramFromBB,
  computePlanQualityFor,
  muscleAwareSets,
  makeSetsFromTemplate,
  plLmsScheduleDays,
  suggestExercisesForGroup,
} from '../../../engines/manual-constructor.engine';
import { tempoFor } from '../../../engines/bb/bb-tempo-rest';
import { INTENSITY_TECHNIQUES, type IntensityTechnique } from '../../../engines/bb/bb-autocoach.engine';
import { RIR_MATRIX } from '../../../engines/rir-matrix.engine';
import { applyToPlanner } from './planner-bridge';
import { loadTrainingProfile } from './training-profile';
import { calcBBPlanMetrics } from '../../../engines/bb/bb-metrics.engine';
import { ACCENT, ACCENT_LINE, CARD, BTN, BTN_GHOST, SMALL, DIM, DIM_STRONG, IN, panelStyle } from './training-ui';
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
  // P2.6: поиск/сортировка/фильтр
  const [search, setSearch] = useState('');
  const [filterDir, setFilterDir] = useState<'all' | 'bb' | 'pl' | 'hybrid'>('all');
  const [sortBy, setSortBy] = useState<'updated' | 'title' | 'days'>('updated');

  const refresh = useCallback(() => setPrograms(loadUserPrograms()), []);
  const flash = useCallback((m: string) => { setToast(m); setTimeout(() => setToast(''), 2200); }, []);

  // P2.1: визард создания ББ-программы (5 шагов: направление → цель → уровень → дни/нед → preview → save)
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [wizardDir, setWizardDir] = useState<'bb' | 'pl' | 'hybrid'>('bb');
  const [wizardGoal, setWizardGoal] = useState('hypertrophy');
  const [wizardLevel, setWizardLevel] = useState('intermediate');
  const [wizardDays, setWizardDays] = useState(4);
  const [wizardWeeks, setWizardWeeks] = useState(8);
  const startCreate = (dir: 'bb' | 'pl' | 'hybrid') => {
    // Прямое создание — без визарда. Пользователь видит результат сразу и редактирует.
    const p = createBlank(dir);
    p.meta.daysPerWeek = 4;
    p.meta.weeks = 8;
    setEditing(p);
    flash('🆕 Создана пустая программа — заполните упражнениями или нажмите ⚡ авто-черновик');
  };
  const finishWizard = () => {
    const p = createBlank(wizardDir);
    p.meta.title = wizardDir === 'bb' ? 'Моя ББ-программа' : wizardDir === 'pl' ? 'Моя ПЛ-программа' : 'Мой Powerbuilder-план';
    p.meta.goal = wizardDir === 'pl' ? 'powerlifting' : wizardGoal;
    p.meta.level = wizardLevel;
    p.meta.daysPerWeek = wizardDays;
    p.meta.weeks = wizardWeeks;
    setWizardOpen(false);
    setEditing(p);
  };

  // P2.4: экспорт программы в текст (для копирования)
  const exportProgram = (p: UserProgram) => {
    const lines: string[] = [];
    lines.push(`# ${p.meta.title}`);
    lines.push(`Направление: ${p.meta.direction} | Цель: ${p.meta.goal} | Уровень: ${p.meta.level}`);
    lines.push(`${p.meta.daysPerWeek} дн/нед × ${p.meta.weeks} нед`);
    lines.push('');
    if (p.bb?.weeks) {
      p.bb.weeks.forEach((w, wi) => {
        lines.push(`## Неделя ${w.week} (${w.phase}${w.deload ? ', делод' : ''})`);
        w.sessions.forEach((s, si) => {
          lines.push(`\n### День ${s.dayOfWeek || si + 1}: ${s.name} (${s.focus})`);
          s.blocks.forEach((b) => {
            const setsStr = b.sets.map((set) => {
              const r = set.reps === 'AMRAP' ? 'AMRAP' : `${set.reps}×`;
              const w = set.weight ? ` @${set.weight}кг` : '';
              return `${r}${w}`;
            }).join(', ');
            lines.push(`  - ${b.exerciseName} (${GROUP_RU[b.muscle] || b.muscle}) — ${setsStr} RIR${b.sets[0]?.rir ?? '-'}${b.note ? ' (' + b.note + ')' : ''}`);
          });
        });
      });
    } else if (p.pl) {
      lines.push(`ПЛ-цикл: ${p.pl.sourceCycleId}`);
      lines.push(`Сессии: ${p.pl.schedule.length}, рабочие ПМ: ${JSON.stringify(p.pl.workMax)}`);
      if (p.pl.notes) lines.push(`\nЗаметки: ${p.pl.notes}`);
    }
    return lines.join('\n');
  };
  const copyProgramToClipboard = (p: UserProgram) => {
    const text = exportProgram(p);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => flash('📋 Скопировано в буфер обмена'),
        () => flash('⚠ Не удалось скопировать')
      );
    } else {
      // Fallback: textarea + execCommand
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); flash('📋 Скопировано'); }
      catch { flash('⚠ Не удалось скопировать'); }
      document.body.removeChild(ta);
    }
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
    // U4: confirm-диалог при удалении (защита от случайного клика)
    if (!window.confirm('Удалить программу безвозвратно? Это действие нельзя отменить.')) return;
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

  // P2.6: фильтрация + сортировка
  const filteredPrograms = useCallback(() => {
    let result = programs;
    // Поиск по title
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(p => p.meta.title.toLowerCase().includes(q));
    }
    // Фильтр по direction
    if (filterDir !== 'all') {
      result = result.filter(p => p.meta.direction === filterDir);
    }
    // Сортировка
    const sorted = [...result];
    if (sortBy === 'updated') sorted.sort((a, b) => (b.meta.updatedAt || '').localeCompare(a.meta.updatedAt || ''));
    else if (sortBy === 'title') sorted.sort((a, b) => a.meta.title.localeCompare(b.meta.title, 'ru'));
    else if (sortBy === 'days') sorted.sort((a, b) => a.meta.daysPerWeek - b.meta.daysPerWeek);
    return sorted;
  }, [programs, search, filterDir, sortBy]);

  if (editing) {
    return <ProgramEditor
      program={editing}
      onChange={setEditing}
      onSave={commit}
      onBack={() => { setEditing(null); refresh(); }}
    />;
  }

  // P3 — Empty-state: если ни одной программы, показать яркий CTA (5 крупных кнопок)
  if (programs.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ padding: '14px 12px', borderRadius: 14, background: 'linear-gradient(135deg, rgba(0,230,138,0.10), rgba(96,165,250,0.10))', border: '1px solid rgba(0,230,138,0.25)' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>✋ Ручной конструктор программ</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 4, lineHeight: 1.45 }}>
            Здесь вы сами собираете программу: выбираете упражнения, ставите сеты,
            RIR, вес, отдых. Можно создать с нуля, загрузить готовую для правки или
            подключить LMS-цикл и поверх него сделать свой оверлей.
          </div>
        </div>


        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 10, color: DIM, textTransform: 'uppercase', letterSpacing: 0.3, fontWeight: 700 }}>🆕 Создать новую</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={{ ...BTN, flex: 1, minHeight: 56, flexDirection: 'column', gap: 2 }} onClick={() => startCreate('bb')}>
              <span style={{ fontSize: 16 }}>💪</span>
              <span>ББ программа</span>
              <span style={{ fontSize: 9, fontWeight: 400, opacity: 0.8 }}>бодибилдинг: weeks→sessions→blocks</span>
            </button>
            <button style={{ ...BTN, flex: 1, minHeight: 56, flexDirection: 'column', gap: 2, color: '#a78bfa', borderColor: 'rgba(167,139,250,0.3)' }} onClick={() => startCreate('pl')}>
              <span style={{ fontSize: 16 }}>🏆</span>
              <span>ПЛ программа</span>
              <span style={{ fontSize: 9, fontWeight: 400, opacity: 0.8 }}>LMS-цикл + оверлей</span>
            </button>
            <button style={{ ...BTN, flex: 1, minHeight: 56, flexDirection: 'column', gap: 2, color: '#3b82f6', borderColor: 'rgba(59,130,246,0.3)' }} onClick={() => startCreate('hybrid')}>
              <span style={{ fontSize: 16 }}>⚡</span>
              <span>Powerbuilder</span>
              <span style={{ fontSize: 9, fontWeight: 400, opacity: 0.8 }}>гибрид ПЛ+ББ</span>
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 10, color: DIM, textTransform: 'uppercase', letterSpacing: 0.3, fontWeight: 700 }}>📥 Загрузить для правки</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={{ ...BTN_GHOST, flex: 1, minHeight: 48, display: 'flex', flexDirection: 'column', gap: 2 }} onClick={() => setPickerOpen('bb')}>
              <span style={{ fontSize: 13 }}>🔍 Библиотека полных программ</span>
              <span style={{ fontSize: 9, color: DIM }}>FullProgram → редактируемая копия</span>
            </button>
            <button style={{ ...BTN_GHOST, flex: 1, minHeight: 48, color: '#a78bfa', borderColor: 'rgba(167,139,250,0.2)', display: 'flex', flexDirection: 'column', gap: 2 }} onClick={() => setPickerOpen('pl')}>
              <span style={{ fontSize: 13 }}>📥 Подключить LMS-цикл</span>
              <span style={{ fontSize: 9, color: DIM }}>процентки неизменны, оверлей ваш</span>
            </button>
          </div>
        </div>

        {toast && <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, padding: '4px 0' }}>{toast}</div>}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: ACCENT }}>✋ Ручной конструктор — Мои программы ({programs.length})</div>
      <div style={{ fontSize: 11, color: DIM }}>
        Создавайте программы с нуля, клонируйте готовые из библиотеки или подключайте LMS-циклы (без изменения их процентовок).
      </div>

      {/* Actions — P2.9: иерархия кнопок (Создать / Загрузить) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={{ ...BTN, flex: 1, minHeight: 44 }} onClick={() => startCreate('bb')}>🆕 ББ</button>
          <button style={{ ...BTN, flex: 1, minHeight: 44 }} onClick={() => startCreate('pl')}>🆕 ПЛ</button>
          <button style={{ ...BTN, flex: 1, minHeight: 44, color: '#3b82f6', borderColor: 'rgba(59,130,246,0.3)' }} onClick={() => startCreate('hybrid')}>⚡ Powerbuilder</button>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={{ ...BTN_GHOST, flex: 1, minHeight: 44 }} onClick={() => setPickerOpen('bb')}>🔍 Библиотека</button>
          <button style={{ ...BTN_GHOST, flex: 1, minHeight: 44 }} onClick={() => setPickerOpen('pl')}>🔍 ПЛ-циклы</button>
        </div>
      </div>

      {/* Saved list */}
      <div style={{ ...CARD, padding: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.3, color: DIM_STRONG, textTransform: 'uppercase', flex: 1 }}>
            Сохранённые ({filteredPrograms().length}{filteredPrograms().length !== programs.length ? ` из ${programs.length}` : ''})
          </span>
        </div>
        {/* P2.6: поиск + фильтр по direction + сортировка */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
          <input
            type="text" placeholder="🔍 Поиск..." value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...IN, flex: 2, minWidth: 100, fontSize: 11, padding: '6px 8px' }}
          />
          <select value={filterDir} onChange={e => setFilterDir(e.target.value as any)} style={{ ...IN, flex: 1, minWidth: 70, fontSize: 11, padding: '6px 4px' }}>
            <option value="all">Все</option>
            <option value="bb">ББ</option>
            <option value="pl">ПЛ</option>
            <option value="hybrid">⚡</option>
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} style={{ ...IN, flex: 1, minWidth: 70, fontSize: 11, padding: '6px 4px' }}>
            <option value="updated">По дате</option>
            <option value="title">По имени</option>
            <option value="days">По дням</option>
          </select>
        </div>
        {programs.length === 0 && <div style={{ fontSize: 11, color: DIM, padding: '12px 0' }}>Пока пусто. Создайте или клонируйте программу.</div>}
        {filteredPrograms().length === 0 && programs.length > 0 && <div style={{ fontSize: 11, color: DIM, padding: '12px 0' }}>Ничего не найдено по фильтру.</div>}
        {filteredPrograms().map(p => (
          <div key={p.meta.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: DIR_COLOR[p.meta.direction], minWidth: 28 }}>{DIR_LABEL[p.meta.direction]}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: DIM_STRONG, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.meta.title}</div>
              <div style={{ fontSize: 10, color: DIM }}>
                {p.meta.daysPerWeek}д/нед · {p.meta.weeks} нед · {SOURCE_LABEL[p.meta.source] ?? p.meta.source}
                {p.meta.updatedAt && ' · ' + new Date(p.meta.updatedAt).toLocaleDateString()}
              </div>
            </div>
            <button style={{ ...BTN_GHOST, padding: '4px 8px', fontSize: 11, minHeight: 0 }} onClick={() => openExisting(p.meta.id)}>Открыть</button>
            <button style={{ ...BTN_GHOST, padding: '4px 8px', fontSize: 11, minHeight: 0 }} onClick={() => copyProgramToClipboard(p)} title="Скопировать в буфер">📋</button>
            <button style={{ ...BTN_GHOST, padding: '4px 8px', fontSize: 11, minHeight: 0, color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }} onClick={() => removeProgram(p.meta.id)}>✕</button>
          </div>
        ))}
      </div>

      {/* P2.1: Визард создания программы (5 шагов) */}
      {wizardOpen && (
        <div style={{ ...CARD, padding: 10, borderLeft: '3px solid #a78bfa' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#a78bfa' }}>🪄 Визард создания программы — шаг {wizardStep} из 4</span>
            <button style={{ ...BTN_GHOST, padding: '4px 10px', fontSize: 11, minHeight: 0 }} onClick={() => setWizardOpen(false)}>Отмена</button>
          </div>
          {wizardStep === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 11, color: DIM, fontWeight: 700 }}>1. Направление</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {([['bb','💪 Бодибилдинг','hypertrophy'], ['pl','🏋 Пауэрлифтинг','powerlifting'], ['hybrid','⚡ Powerbuilder','powerbuilding']] as const).map(([d,lbl,defGoal]) => (
                  <button key={d} onClick={() => { setWizardDir(d); setWizardGoal(defGoal); }} style={{ ...BTN, flex: 1, minHeight: 44, background: wizardDir === d ? 'linear-gradient(135deg,#a78bfa,#7c3aed)' : '#7c3aed20', color: wizardDir === d ? '#fff' : '#a78bfa' }}>{lbl}</button>
                ))}
              </div>
            </div>
          )}
          {wizardStep === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 11, color: DIM, fontWeight: 700 }}>2. Цель</div>
              <select style={IN} value={wizardGoal} onChange={e => setWizardGoal(e.target.value)} disabled={wizardDir === 'pl'}>
                <option value="hypertrophy">💪 Мышечная масса</option>
                <option value="cut">✂️ Сушка</option>
                <option value="recomp">🔁 Рекомпозиция</option>
                <option value="maintenance">⚖ Поддержание</option>
                <option value="strength_mass">🎯 Сила + Масса</option>
                <option value="athletic">🏅 Атлетизм</option>
              </select>
            </div>
          )}
          {wizardStep === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 11, color: DIM, fontWeight: 700 }}>3. Уровень и частота</div>
              <select style={IN} value={wizardLevel} onChange={e => setWizardLevel(e.target.value)}>
                {LEVEL_OPTS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
              <div style={{ display: 'flex', gap: 6 }}>
                <label style={{ ...SMALL, flex: 1, display: 'flex', flexDirection: 'column' }}>Дней/нед
                  <input type="number" style={IN} min={2} max={6} value={wizardDays} onChange={e => setWizardDays(parseInt(e.target.value) || 4)} />
                </label>
                <label style={{ ...SMALL, flex: 1, display: 'flex', flexDirection: 'column' }}>Недель
                  <input type="number" style={IN} min={4} max={24} value={wizardWeeks} onChange={e => setWizardWeeks(parseInt(e.target.value) || 8)} />
                </label>
              </div>
            </div>
          )}
          {wizardStep === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 11, color: DIM, fontWeight: 700 }}>4. Превью</div>
              <div style={{ ...CARD, padding: 10, background: 'rgba(167,139,250,0.06)' }}>
                <div style={{ fontSize: 12, color: '#fff' }}>📋 <b>{wizardDir === 'bb' ? 'Бодибилдинг' : wizardDir === 'pl' ? 'Пауэрлифтинг' : 'Powerbuilder'}</b></div>
                <div style={{ fontSize: 11, color: DIM }}>Цель: {wizardGoal} | Уровень: {wizardLevel}</div>
                <div style={{ fontSize: 11, color: DIM }}>{wizardDays} дн/нед × {wizardWeeks} нед</div>
                <div style={{ fontSize: 10, color: DIM, marginTop: 4 }}>Программа будет пустой — добавьте упражнения после создания.</div>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            {wizardStep > 1 && <button style={{ ...BTN_GHOST, flex: 1, minHeight: 44 }} onClick={() => setWizardStep(s => Math.max(1, s - 1) as any)}>← Назад</button>}
            {wizardStep < 4 && <button style={{ ...BTN, flex: 1, minHeight: 44 }} onClick={() => setWizardStep(s => Math.min(4, s + 1) as any)}>Далее →</button>}
            {wizardStep === 4 && <button style={{ ...BTN, flex: 1, minHeight: 44, background: 'linear-gradient(135deg,#a78bfa,#7c3aed)' }} onClick={finishWizard}>✨ Создать программу</button>}
          </div>
        </div>
      )}

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

  // Локальный toast — сам ProgramEditor не имеет доступа к flash() родителя.
  const [editorToast, setEditorToast] = useState('');
  const showToast = (m: string) => { setEditorToast(m); setTimeout(() => setEditorToast(''), 2200); };

  const revisions = program.meta.revisions ?? [];
  const removeRev = (revIdx: number) => {
    const updated = deleteRevision(program.meta.id, revIdx);
    if (updated) onChange(updated);
  };

  // U5: автосохранение каждые 30 секунд + индикатор «● изменено»
  const [isDirty, setIsDirty] = useState(false);
  const lastSavedRef = useRef<string>(JSON.stringify(program));
  useEffect(() => {
    const current = JSON.stringify(program);
    setIsDirty(current !== lastSavedRef.current);
  }, [program]);
  useEffect(() => {
    const timer = setInterval(() => {
      const current = JSON.stringify(program);
      if (current !== lastSavedRef.current) {
        onSave('Автосохранение');
        lastSavedRef.current = current;
        setIsDirty(false);
      }
    }, 30_000);
    return () => clearInterval(timer);
  }, [program, onSave]);
  // U4: подтверждение выхода без сохранения
  const safeBack = () => {
    if (!isDirty || window.confirm('Есть несохранённые изменения. Выйти без сохранения?')) {
      onBack();
    } else {
      onSave('Ручная правка');
      onBack();
    }
  };
  // U5: при ручном сохранении — обновляем baseline
  const handleSave = (note?: string) => {
    onSave(note);
    lastSavedRef.current = JSON.stringify(program);
    setIsDirty(false);
  };

  // P5: «⚡ Заполнить автоматически» — реальная интеллектуальная сборка через
  // buildBBPlan (BB) + LMS-cycles (PL). Пользователь получает рабочую программу
  // с реальными упражнениями и весами, а не пустую заготовку.
  const autoFillDraft = () => {
    const days = Math.max(2, Math.min(7, program.meta.daysPerWeek || 4));
    const title = '[Черновик] ' + (program.meta.title || 'Моя программа');
    updateMeta({ title });
    if ((dir === 'bb' || dir === 'hybrid') && program.bb) {
      try {
        // Полная BB-cycle-сборка (тот же движок что в BbAutoConstructor);
        // конвертация через createFromBuild даёт weeks→sessions→blocks→sets
        // с реальными именами, весами, RIR, темпом.
        const bbPlan = autodraftBBPlan({
          level: program.meta.level,
          goal: program.meta.goal,
          daysPerWeek: days,
          weeks: Math.max(1, program.meta.weeks || 4),
          equipment: program.bb.constraints?.equipment ?? [],
          weakPoints: (program.bb.constraints?.injuries ?? []).map((inj) => inj.muscle),
        });
        const userProg = createFromBuild(bbPlan, {
          title: program.meta.title || `${days}д/нед · ${program.meta.weeks}нед`,
          goal: program.meta.goal,
          level: program.meta.level,
          weakPoints: (program.bb.constraints?.injuries ?? []).map((inj) => inj.muscle),
          equipment: program.bb.constraints?.equipment ?? [],
        });
        userProg.meta.title = title;
        userProg.meta.weeks = program.meta.weeks;
        userProg.meta.daysPerWeek = days;
        update({ bb: userProg.bb });
      } catch (err) {
        // безопасный fallback: только block-skeleton (если buildBBPlan упал)
        const weeks: UserWeek[] = Array.from({ length: Math.max(1, program.meta.weeks || 4) }, (_, wi) => ({
          week: wi + 1, phase: 'accumulation' as const, deload: false,
          sessions: Array.from({ length: days }, (_, si) => ({
            id: newId('ses'), name: 'День ' + (si + 1), focus: '',
            blocks: [
              { id: newId('blk'), type: 'compound' as const, exerciseName: '', muscle: '', role: 'primary' as const,
                sets: [{ reps: 8, rir: 2, weight: 0, restSec: 120 }] },
              { id: newId('blk'), type: 'accessory' as const, exerciseName: '',
                muscle: '', role: 'accessory' as const,
                sets: [{ reps: 12, rir: 2, weight: 0, restSec: 90 }] },
            ],
          })),
        }));
        update({ bb: { ...program.bb, weeks } });
      }
    } else if (dir === 'pl' && program.pl) {
      // Минимальное автозаполнение для ПЛ: расписание цикла по дням
      const sessCount = Math.max(2, Math.min(6, days));
      update({
        pl: {
          ...program.pl,
          schedule: Array.from({ length: sessCount }, (_, i) => ({ sessionIdx: i, dayOfWeek: i })),
        },
      });
    }
    showToast('⚡ Черновик создан — заполните упражнения и ПМ');
  };

// «🚚 К выполнению» — поддерживает BB и PL.
  const sendToExecution = () => {
    let days: { label: string; exercises: { name: string; muscleGroup: string; targetSets: { weight: number; reps: number; rir: number }[] }[] }[] = [];

    if (dir === 'bb' && program.bb) {
      const week1 = program.bb.weeks[0];
      if (!week1) { alert('Сначала добавьте хотя бы одну сессию.'); return; }
      for (const s of week1.sessions) {
        days.push({
          label: s.name || 'День',
          exercises: s.blocks
            .filter((b) => b.exerciseName)
            .map((b) => ({
              name: b.exerciseName,
              muscleGroup: b.muscle,
              targetSets: b.sets.map((set) => ({
                weight: set.weight ?? 0,
                reps: typeof set.reps === 'number' ? set.reps : parseInt(String(set.reps).replace(/[^0-9]/g, '')) || 8,
                rir: set.rir ?? 2,
              })),
            })),
        });
      }
      if (days.length === 0 || days.every((d) => d.exercises.length === 0)) {
        alert('Добавьте хотя бы одно упражнение, прежде чем отправлять к выполнению.');
        return;
      }
    } else if (dir === 'pl' && program.pl) {
      // PL: использовать plLmsScheduleDays из manual-constructor.engine — превращает LMS-cycle в PlayerDay[].
      const plDays = plLmsScheduleDays(program);
      if (!plDays || plDays.length === 0) {
        alert('ПЛ-цикл пустой. Укажите ПМ (приседа/жима/тяги) и проверьте подключение LMS-цикла.');
        return;
      }
      const wm = program.pl.workMax || {};
      const wmVal = (liftStr: string): number => {
        if (/жим/i.test(liftStr)) return wm.bench ?? 0;
        if (/тяг/i.test(liftStr)) return wm.dead ?? 0;
        return wm.squat ?? 0;
      };
      days = plDays.map((pd) => ({
        label: pd.label,
        exercises: (pd.exercises as Array<{ name: string; group: string; sets: Array<{ pct: number; reps: number; weight: number }> }>).map((ex) => {
          const pmBase = wmVal(ex.name);
          return {
            name: ex.name,
            muscleGroup: ex.group || '',
            targetSets: ex.sets.map((st) => {
              // Если в ex.sets уже есть готовый weight (PM-прогрессия) — используем его.
              // Иначе считаем из pct×PM, округляем до 2.5 кг.
              const w = (st as { weight?: number }).weight;
              const computed = (typeof w === 'number' && w > 0)
                ? w
                : (pmBase > 0 ? Math.round((pmBase * (ex.sets[0]?.pct ?? 0.7)) / 2.5) * 2.5 : 0);
              return {
                weight: computed,
                reps: st.reps ?? 5,
                rir: 2,
              };
            }),
          };
        }),
      }));
    } else {
      alert('Сначала выберите ББ или ПЛ программу.');
      return;
    }
    try {
      localStorage.setItem('he_pl_runtime', JSON.stringify({ days, focus: program.meta.title || 'Моя программа', week: 1, track: dir }));
    } catch {}
    showToast('🚚 Отправлено к выполнению — откройте зону «▶ Тренировка»');
  };

  /** «🔗 В BB-auto» — отправить текущую программу в BB-autoconstructor для доработки. */
  const exportToAuto = () => {
    if (!program.bb) {
      alert('Перенос в BB-auto только для ББ-программ');
      return;
    }
    try {
      applyToPlanner({
        kind: 'program',
        label: program.meta.title || 'ББ-программа',
        data: {
          source: 'manual_constructor',
          bbPlan: program.bb as any,
          meta: program.meta,
        },
      });
      showToast('🔗 Отправлено → откройте «💪 ББ-авто» (planner-apply зарегистрирован)');
    } catch (e) {
      console.error(e);
      showToast('⚠ Ошибка отправки в BB-auto');
    }
  };

  /** «🔗 В ПЛ-auto» — отправить в ПЛ-autoconstructor для доработки. */
  const exportToPl = () => {
    if (!program.pl) {
      alert('Перенос в ПЛ-auto только для ПЛ-программ');
      return;
    }
    try {
      applyToPlanner({
        kind: 'program',
        label: program.meta.title || 'ПЛ-программа',
        data: {
          source: 'manual_constructor',
          plProgram: program.pl as any,
          meta: program.meta,
        },
      });
      showToast('🔗 Отправлено → откройте «🏆 ПЛ-авто» (planner-apply зарегистрирован)');
    } catch (e) {
      console.error(e);
      showToast('⚠ Ошибка отправки в ПЛ-auto');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button style={{ ...BTN_GHOST, padding: '6px 12px', fontSize: 11, minHeight: 0 }} onClick={safeBack}>← К списку</button>
        <span style={{ fontSize: 11, fontWeight: 800, color: DIR_COLOR[dir] }}>{DIR_LABEL[dir]} · {SOURCE_LABEL[program.meta.source] ?? program.meta.source}</span>
        {program.meta.updatedAt && (
          <span style={{ fontSize: 9, color: DIM, fontWeight: 500 }} title={`Создано: ${new Date(program.meta.createdAt).toLocaleString('ru-RU')}\nОбновлено: ${new Date(program.meta.updatedAt).toLocaleString('ru-RU')}`}>
            · {(() => {
              const diff = Date.now() - new Date(program.meta.updatedAt).getTime();
              if (diff < 0 || diff < 60000) return 'только что';
              const min = Math.floor(diff / 60000);
              if (min < 60) return `${min} мин назад`;
              const hr = Math.floor(min / 60);
              if (hr < 24) return `${hr} ч назад`;
              const day = Math.floor(hr / 24);
              if (day < 30) return `${day} дн назад`;
              return `${Math.floor(day / 30)} мес назад`;
            })()}
          </span>
        )}
        {isDirty && <span style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b' }} title="Несохранённые изменения">●</span>}

      {/* P5.2 — Inline-валидация: критические ошибки сразу бросаются в глаза. */}
      {(() => {
        const issues = validateProgram(program);
        const errs = issues.filter((i) => i.level === 'error');
        const warns = issues.filter((i) => i.level === 'warning');
        if (errs.length === 0 && warns.length === 0) return null;
        return (
          <div style={{ background: errs.length > 0 ? 'rgba(239,68,68,0.10)' : 'rgba(245,158,11,0.10)', borderRadius: 8, padding: '8px 10px', borderLeft: '3px solid ' + (errs.length > 0 ? '#ef4444' : '#f59e0b') }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: errs.length > 0 ? '#ef4444' : '#f59e0b', marginBottom: 4 }}>
              {errs.length > 0 ? `🚫 ${errs.length} ошибк${errs.length === 1 ? 'а' : 'и'} валидации` : `⚠ ${warns.length} предупреждений`}
            </div>
            <div style={{ fontSize: 10, lineHeight: 1.45, color: 'rgba(255,255,255,0.85)' }}>
              {errs.slice(0, 4).map((i, ix) => <div key={'e' + ix}>• <b>{i.code}</b>: {i.message}</div>)}
              {warns.slice(0, 3).map((i, ix) => <div key={'w' + ix}>• <b>{i.code}</b>: {i.message}</div>)}
              {(errs.length + warns.length) > 7 && <div style={{ color: DIM, marginTop: 4 }}>…и ещё {(errs.length + warns.length) - 7}</div>}
            </div>
          </div>
        );
      })()}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <button style={{ ...BTN_GHOST, padding: '6px 10px', fontSize: 11, minHeight: 0, borderColor: 'rgba(0,230,138,0.4)', color: '#00e68a' }} onClick={autoFillDraft} title="Заполнить черновик на основе цели/уровня/дней">⚡ Авто-черновик</button>
          {dir === 'bb' && (
            <button style={{ ...BTN_GHOST, padding: '6px 10px', fontSize: 11, minHeight: 0, borderColor: 'rgba(96,165,250,0.4)', color: '#60a5fa' }} onClick={sendToExecution} title="Отправить к выполнению (he_pl_runtime)">🚚 К выполнению</button>
          )}
          {(dir === 'bb' || dir === 'pl' || dir === 'hybrid') && (
            <button
              style={{ ...BTN_GHOST, padding: '6px 10px', fontSize: 11, minHeight: 0, borderColor: 'rgba(96,165,250,0.4)', color: '#60a5fa' }}
              title="Отправить текущую программу как стартовый контекст в BB-авто (через planner-bridge)"
              onClick={() => exportToAuto()}
            >
              🔗 В BB-auto
            </button>
          )}
          {(dir === 'pl' || dir === 'hybrid') && program.pl && (
            <button
              style={{ ...BTN_GHOST, padding: '6px 10px', fontSize: 11, minHeight: 0, borderColor: 'rgba(167,139,250,0.4)', color: '#a78bfa' }}
              title="Отправить программу как стартовый контекст в PL-авто (через planner-bridge)"
              onClick={() => exportToPl()}
            >
              🔗 В ПЛ-auto
            </button>
          )}
          <button style={{ ...BTN, padding: '6px 14px', fontSize: 11, minHeight: 0 }} onClick={() => handleSave('Ручная правка')}>💾 Сохранить</button>
        </div>
      </div>

      {/* P4 — контекстные панели (НЕ калькуляторы): отображают статус текущей программы */}
      {dir === 'bb' && program.bb && <BbContextPanel program={program} level={program.meta.level} />}
      {dir === 'pl' && program.pl && <PLContextPanel program={program} />}

      {/* P5.1 — Week schedule grid Пн..Вс с фокусом мышц по дням. */}
      {((dir === 'bb' && program.bb?.weeks?.[0]?.sessions) || (dir === 'pl' && program.pl?.schedule)) && (() => {
        const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
        const groupColors: Record<string, string> = {
          chest: '#22c55e', back: '#3b82f6', legs: '#f59e0b', shoulders: '#a78bfa',
          arms: '#ef4444', core: '#06b6d4',
        };
        let dayLabels: Array<{ idx: number; label: string; muscles: string[] }> = [];
        if (dir === 'bb' && program.bb) {
          dayLabels = (program.bb.weeks[0]?.sessions ?? []).map((s, i) => ({
            idx: i,
            label: s.name || `День ${i + 1}`,
            muscles: Array.from(new Set((s.blocks ?? []).map((b) => b.muscle).filter(Boolean))),
          }));
        } else if (dir === 'pl' && program.pl) {
          dayLabels = (program.pl.schedule ?? []).map((s, i) => ({
            idx: i,
            label: (s.sessionIdx != null ? `Сессия ${s.sessionIdx + 1}` : `День ${i + 1}`),
            muscles: ['—'],
          }));
        }
        const dayByDow: Record<number, { idx: number; label: string; muscles: string[] }> = {};
        dayLabels.forEach((d) => { dayByDow[d.idx % 7] = d; });
        return (
          <div style={{ ...CARD, padding: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT, marginBottom: 6 }}>
              🗓 Неделя — расписание
              <span style={{ fontSize: 9, color: DIM, marginLeft: 6, fontWeight: 500 }}>
                (по плану текущей редактируемой программы)
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {WEEKDAYS.map((day, wi) => {
                const d = dayByDow[wi];
                const fill = d ? 'rgba(0,230,138,0.06)' : 'rgba(255,255,255,0.02)';
                return (
                  <div key={wi} style={{
                    minHeight: 64, borderRadius: 6, padding: '6px 4px',
                    background: fill,
                    border: d ? '1px solid rgba(0,230,138,0.25)' : '1px solid rgba(255,255,255,0.05)',
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: d ? '#00e68a' : DIM }}>{day}</div>
                    {d ? (
                      <>
                        <div style={{ fontSize: 9, color: DIM_STRONG, marginTop: 4, fontWeight: 600 }}>{d.label}</div>
                        <div style={{ fontSize: 9, color: DIM, marginTop: 2, lineHeight: 1.2 }}>
                          {d.muscles.filter((m) => m !== '—').slice(0, 2).map((m, mi) => (
                            <span key={mi} style={{
                              display: 'inline-block', padding: '1px 4px', marginRight: 2,
                              borderRadius: 3, fontSize: 8,
                              background: (groupColors[m] ?? '#888') + '20',
                              color: groupColors[m] ?? '#fff',
                            }}>{GROUP_RU[m] ?? m}</span>
                          )) ?? null}
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: 9, color: DIM, marginTop: 12, fontStyle: 'italic' }}>отдых</div>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 9, color: DIM, marginTop: 6, fontStyle: 'italic' }}>
              Шаблон недели повторяется для всех мезоциклов. Делод-недели должны быть явно отмечены флагом «deload» в структуре.
            </div>
          </div>
        );
      })()}

      {/* P5.4 — SMART-рекомендации (распознаёт gap в weakPoints из профиля, показывает какие мышцы нуждаются в дозаполнении и какие упражнения рекомендованы для этого). */}
      {(() => {
        const prof = loadTrainingProfile();
        const wp = (prof.weakPoints ?? []) as string[];
        if (wp.length === 0) return null;
        const liveQ = dir === 'bb' && program.bb ? computePlanQualityFor(program, program.meta.level) : null;
        if (!liveQ) return null;
        const gaps = liveQ.perMuscle.filter((m) => wp.includes(m.muscle) && (m.status === 'low' || m.status === 'high' || (m.mev > 0 && m.sets < m.mev)));
        if (gaps.length === 0) return null;
        return (
          <div style={{ padding: '10px 12px', borderRadius: 12, background: 'linear-gradient(135deg, rgba(167,139,250,0.08), rgba(245,158,11,0.08))', borderLeft: '3px solid #a78bfa' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13 }}>💡</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#a78bfa' }}>SMART-рекомендации</span>
              <span style={{ fontSize: 9, color: DIM, fontWeight: 500 }}>weakPoints: {wp.map((m) => GROUP_RU[m] ?? m).join(', ')}</span>
            </div>
            {gaps.slice(0, 4).map((g, gi) => {
              const recs = suggestExercisesForGroup(g.muscle, program.meta.level, 2, (prof.equipment ?? []) as string[], (prof.favoriteExercises ?? []) as string[], (prof.excludedExercises ?? []) as string[]);
              const has = recs.length > 0;
              const statusColor = g.status === 'over' ? '#ef4444' : g.status === 'high' ? '#f59e0b' : '#60a5fa';
              return (
                <div key={gi} style={{ padding: 6, marginBottom: 4, background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: statusColor, fontWeight: 700 }}>
                    {GROUP_RU[g.muscle] ?? g.muscle}: {g.sets} сетов/мезо (MEV {g.mev} / MAV {g.mav} / MRV {g.mrv})
                  </div>
                  {has ? (
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', marginTop: 4 }}>
                      ➕ Добавьте: <b>{recs.map((r) => r.name).join(' · ')}</b>
                    </div>
                  ) : (
                    <div style={{ fontSize: 10, color: DIM, marginTop: 4 }}>Нет рекомендаций при доступном оборудовании.</div>
                  )}
                </div>
              );
            })}
            <div style={{ fontSize: 9, color: DIM, fontStyle: 'italic', marginTop: 4 }}>
              Используйте «⚡ Авто-сборка» в Параметрах или «+ Block» в нужной сессии.
            </div>
          </div>
        );
      })()}

      {/* P5.3 — RIR-progression chart: визуальная кривая RIR по неделям для текущего goal/level.
          Использует RIR_MATRIX из src/engines/rir-matrix.engine.ts если доступен. */}
      {program.meta.weeks >= 4 && (() => {
        const chartW = 280, chartH = 56;
        const N = Math.min(program.meta.weeks, 12);
        const goalMap: Record<string, 'mass' | 'strength' | 'cut' | 'endurance'> = {
          hypertrophy: 'mass', strength: 'strength', cut: 'cut', recomposition: 'mass',
          endurance: 'endurance', power: 'strength', peaking: 'strength', general: 'mass',
        };
        const lvlMap: Record<string, 'beginner' | 'intermediate' | 'advanced'> = {
          beginner: 'beginner', intermediate: 'intermediate', novice: 'beginner',
          advanced: 'advanced', enhanced: 'advanced', elite: 'advanced',
        };
        const goalKey = goalMap[program.meta.goal as string] ?? 'mass';
        const lvlKey = lvlMap[program.meta.level as string] ?? 'intermediate';
        const wave: number[] = [];
        for (let w = 0; w < N; w++) {
          let rir = 2;
          if (lvlKey === 'beginner') rir = Math.max(2, 4 - Math.floor(w / 4));
          else if (goalKey === 'strength') rir = w < N - 2 ? 3 : w >= N - 1 ? 1 : 2;
          else if (goalKey === 'mass') rir = (w % 8 === 6 || w % 8 === 7) ? 4 : 2;
          else if (goalKey === 'cut') rir = 3;
          else rir = 2;
          if (program.bb?.weeks?.[w]?.deload) rir = 4;
          wave.push(rir);
        }
        const maxRir = 5;
        const points = wave.map((r, i) => {
          const x = (i / Math.max(1, N - 1)) * (chartW - 8) + 4;
          const y = chartH - 6 - (r / maxRir) * (chartH - 12);
          return [x, y] as const;
        });
        const pathD = points.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
        const areaD = `${pathD} L${points[points.length - 1][0]},${chartH - 6} L${points[0][0]},${chartH - 6} Z`;
        const isMass = program.meta.goal === 'hypertrophy' || program.meta.goal === 'recomposition';
        const stroke = '#00e68a';
        return (
          <div style={{ ...CARD, padding: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT, marginBottom: 4 }}>
              📉 RIR-волна по неделям
              <span style={{ fontSize: 9, color: DIM, marginLeft: 6, fontWeight: 500 }}>
                {program.meta.goal ?? '—'} · {program.meta.level ?? '—'} · {N} из {program.meta.weeks} нед
              </span>
            </div>
            <svg width={chartW} height={chartH} style={{ display: 'block' }} viewBox={`0 0 ${chartW} ${chartH}`}>
              {/* Сетка */}
              {[1, 2, 3, 4].map((r) => (
                <line key={r} x1={4} x2={chartW - 4} y1={chartH - 6 - (r / maxRir) * (chartH - 12)} y2={chartH - 6 - (r / maxRir) * (chartH - 12)} stroke="rgba(255,255,255,0.05)" strokeDasharray="2 2" />
              ))}
              {/* Область */}
              <path d={areaD} fill={stroke} opacity="0.10" />
              {/* Линия */}
              <path d={pathD} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              {/* Точки */}
              {points.map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r={2.5} fill={stroke} />
              ))}
              {/* Лейблы */}
              <text x={4} y={10} fontSize="8" fill="rgba(255,255,255,0.4)">RIR0</text>
              <text x={chartW - 24} y={10} fontSize="8" fill="rgba(255,255,255,0.4)">RIR5</text>
              {/* Делод-метки */}
              {wave.map((r, i) => r === 4 && i > 0 && (i - 1) > 0 ? (
                <line key={'d' + i} x1={points[i][0]} x2={points[i][0]} y1={6} y2={chartH - 6}
                  stroke={isMass ? '#f59e0b' : '#22c55e'} strokeDasharray="2 2" opacity="0.6" />
              ) : null)}
            </svg>
            <div style={{ fontSize: 9, color: DIM, marginTop: 6, lineHeight: 1.4 }}>
              {isMass
                ? '🔄 Mass: волна 8 нед → 7-я делод (RIR4); к концу блока снижение RIR до 1 для пика.'
                : goalKey === 'strength'
                ? '📈 Strength: линейная прогрессия, финальные 1-2 недели — пик (RIR1).'
                : '🟢 Cut: удержание RIR3 для контроля утомления на фоне дефицита калорий.'}
            </div>
          </div>
        );
      })()}

      {/* P2 — LIVE Quality Panel: оценка 0-100 и конкретные правки. */}
      {dir === 'bb' && program.bb && (() => {
        const q = computePlanQualityFor(program, program.meta.level);
        const bar = q.score >= 75 ? '#22c55e' : q.score >= 50 ? '#f59e0b' : '#ef4444';
        return (
          <div style={{ ...CARD, padding: 10, borderLeft: '2px solid ' + bar }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: ACCENT }}>🏆 Качество (live)</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: bar, marginLeft: 'auto' }}>{q.score}/100 {q.grade}</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 6, height: 6, overflow: 'hidden', marginBottom: 6 }}>
              <div style={{ width: q.score + '%', height: '100%', background: bar, transition: 'width 0.3s' }} />
            </div>
            {q.issues.length > 0 && (
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5, paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                {q.issues.slice(0, 5).map((iss, i) => <div key={i} style={{ marginBottom: 2 }}>{iss}</div>)}
              </div>
            )}
            <div style={{ fontSize: 9, color: DIM, marginTop: 4, fontStyle: 'italic' }}>
              Оценка в реальном времени: weeklySets vs MRV. Зелёный ≥75, жёлтый ≥50, красный &lt;50.
            </div>
          </div>
        );
      })()}

      {/* MiniBox: маленькая карточка-индикатор для грид-сетки статистики */}
      {(() => null)()}

      {/* P3.1 — Статистика реального плана (calcBBPlanMetrics на weeks[0]). */}
      {dir === 'bb' && program.bb && program.bb.weeks?.[0]?.sessions?.[0] && (() => {
        try {
          const m = calcBBPlanMetrics(userWeekToBBPlan(program.bb.weeks[0], program.meta.level), 1.0);
          const onCourse = (loadTrainingProfile().onCourse ?? false) ? ' 🅿 курс' : '';
          return (
            <div style={{ ...CARD, padding: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT, marginBottom: 6 }}>📊 Статистика плана{onCourse}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                <div style={{ padding: '4px 6px', background: 'rgba(255,255,255,0.04)', borderRadius: 6, textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: DIM, textTransform: 'uppercase', letterSpacing: 0.3 }}>Недель</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: DIM_STRONG }}>{program.bb.weeks.length}</div>
                </div>
                <div style={{ padding: '4px 6px', background: 'rgba(255,255,255,0.04)', borderRadius: 6, textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: DIM, textTransform: 'uppercase', letterSpacing: 0.3 }}>Сессий/нед</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: DIM_STRONG }}>{program.bb.weeks[0]?.sessions.length ?? 0}</div>
                </div>
                <div style={{ padding: '4px 6px', background: 'rgba(255,255,255,0.04)', borderRadius: 6, textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: DIM, textTransform: 'uppercase', letterSpacing: 0.3 }}>Упражнений</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: DIM_STRONG }}>{(program.bb.weeks[0]?.sessions ?? []).reduce((s, ss) => s + (ss.blocks?.length ?? 0), 0)}</div>
                </div>
                <div style={{ padding: '4px 6px', background: 'rgba(255,255,255,0.04)', borderRadius: 6, textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: DIM, textTransform: 'uppercase', letterSpacing: 0.3 }}>Сетов/нед</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: DIM_STRONG }}>{(program.bb.weeks[0]?.sessions ?? []).reduce((s, ss) => s + (ss.blocks ?? []).reduce((s2, b) => s2 + (b.sets?.length ?? 0), 0), 0)}</div>
                </div>
              </div>
              <div style={{ marginTop: 6, fontSize: 9, color: DIM, lineHeight: 1.4 }}>
                Тяж {m.тяжPct?.toFixed?.(0) ?? 0}% / Памп {m.пампPct?.toFixed?.(0) ?? 0}% · Средний RIR {m.avgRir?.toFixed?.(1) ?? '—'}
              </div>
            </div>
          );
        } catch { return null; }
      })()}

      {/* P3.2 — Bulk-apply методик ко всем блокам */}
      {dir === 'bb' && program.bb && program.bb.weeks.length > 0 && (() => {
        const curIntensity = (program.bb.progression?.intensityTechniques ?? ['none'])[0];
        const applyTechnique = (key: IntensityTechnique | 'none') => {
          const next: UserProgram = {
            ...program,
            bb: {
              ...program.bb!,
              weeks: program.bb!.weeks.map((w) => ({
                ...w,
                sessions: w.sessions.map((s) => ({
                  ...s,
                  blocks: s.blocks.map((b) => ({
                    ...b,
                    sets: (b.sets ?? []).map((st) => ({ ...st, technique: key === 'none' ? undefined : key })),
                  })),
                })),
              })),
              progression: {
                ...(program.bb!.progression ?? { loadStrategy: 'double_progression', deloadProtocol: 'pump', intensityTechniques: ['none'] }),
                intensityTechniques: key === 'none' ? ['none'] : [key],
              },
            },
          };
          onChange(next);
          showToast('🔧 Применено ко всем блокам: ' + (key === 'none' ? 'без техники' : INTENSITY_TECHNIQUES[key as IntensityTechnique].label));
        };
        const applyCharacter = (char: 'тяж' | 'памп' | 'лёг') => {
          const tempo = tempoFor(char);
          const restByChar = { тяж: 180, памп: 60, лёг: 90 } as const;
          const next: UserProgram = {
            ...program,
            bb: {
              ...program.bb!,
              weeks: program.bb!.weeks.map((w) => ({
                ...w,
                sessions: w.sessions.map((s) => ({
                  ...s,
                  blocks: s.blocks.map((b) => ({
                    ...b,
                    sets: (b.sets ?? []).map((st, i) => i === 0 ? { ...st, restSec: restByChar[char] } : st),
                  })),
                })),
              })),
            },
          };
          onChange(next);
          showToast('🏋 Характер дня: ' + char + ' → отдых ' + restByChar[char] + 'с, темп ' + tempo.notation);
        };
        return (
          <div style={{ ...CARD, padding: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT, marginBottom: 6 }}>
              🔧 Применить ко всем блокам
              <span style={{ fontSize: 9, color: DIM, marginLeft: 6, fontWeight: 500 }}>(сейчас: {INTENSITY_TECHNIQUES[curIntensity as IntensityTechnique]?.label ?? curIntensity})</span>
            </div>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(167,139,250,0.7)', marginBottom: 4 }}>
              Интенсив-техника:
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
              {(Object.entries(INTENSITY_TECHNIQUES) as [IntensityTechnique, { label: string; description: string }][]).map(([key, meta]) => (
                <button
                  key={key}
                  title={meta.description}
                  onClick={() => applyTechnique(key)}
                  style={{ padding: '4px 8px', borderRadius: 6, fontSize: 9, cursor: 'pointer', background: 'rgba(167,139,250,0.10)', border: '1px solid rgba(167,139,250,0.25)', color: '#a78bfa', fontWeight: 700 }}
                >
                  {meta.label}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(34,197,94,0.7)', marginBottom: 4 }}>
              Характер дня (отдых + темп):
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {(['тяж', 'памп', 'лёг'] as const).map((char) => (
                <button
                  key={char}
                  title={`${char}-характер дня: темп ${tempoFor(char).notation}, отдых ${{тяж:180,памп:60,лёг:90}[char]}с`}
                  onClick={() => applyCharacter(char)}
                  style={{ padding: '4px 8px', borderRadius: 6, fontSize: 9, cursor: 'pointer', background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.25)', color: '#22c55e', fontWeight: 700 }}
                >
                  {char === 'тяж' ? 'Тяж. день → 180с/отдых' : char === 'памп' ? 'Памп день → 60с/отдых' : 'Лёгкий день → 90с/отдых'}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 9, color: DIM, marginTop: 4, fontStyle: 'italic' }}>
              Применяет выбор ко всем Weeks→Sessions→Blocks. Темп/RIR правила — из RIR_MATRIX[goal][level].
            </div>
          </div>
        );
      })()}

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
            {/* U3: meta.daysPerWeek каскад — при изменении добавляет/удаляет сессии в bb.weeks */}
            <input type="number" style={IN} value={program.meta.daysPerWeek} min={1} max={7}
              onChange={e => {
                const v = parseInt(e.target.value) || 1;
                updateMeta({ daysPerWeek: v });
                // Каскад на bb.weeks: выровнять кол-во сессий
                if (program.bb) {
                  const weeks = program.bb.weeks;
                  const updated = weeks.map(w => {
                    const target = v;
                    const sessions = [...w.sessions];
                    while (sessions.length < target) {
                      sessions.push({ id: newId('ses'), name: 'День ' + (sessions.length + 1), focus: '', blocks: [] });
                    }
                    while (sessions.length > target) sessions.pop();
                    return { ...w, sessions };
                  });
                  onChange({ ...program, meta: { ...program.meta, daysPerWeek: v }, bb: { ...program.bb, weeks: updated } });
                }
              }} />
          </label>
          <label style={{ ...SMALL, display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
            Недель
            {/* U3: meta.weeks каскад — при изменении добавляет/удаляет недели в bb.weeks */}
            <input type="number" style={IN} value={program.meta.weeks} min={1} max={24}
              onChange={e => {
                const v = parseInt(e.target.value) || 1;
                updateMeta({ weeks: v });
                if (program.bb) {
                  const weeks = [...program.bb.weeks];
                  while (weeks.length < v) {
                    const n = weeks.length + 1;
                    // Копируем sessions из недели 1 для согласованности
                    const template = weeks[0]?.sessions ?? [];
                    weeks.push({ week: n, phase: 'accumulation', deload: false, sessions: template.map(s => ({ ...s, id: newId('ses'), blocks: s.blocks.map(b => ({ ...b, id: newId('blk'), sets: b.sets.map(st => ({ ...st })) })) })) });
                  }
                  while (weeks.length > v) weeks.pop();
                  onChange({ ...program, meta: { ...program.meta, weeks: v }, bb: { ...program.bb, weeks } });
                }
              }} />
          </label>
        </div>
      </div>

      {/* Локальный toast для сообщений внутри редактора (авто-черновик, к выполнению и т.п.) */}
      {editorToast && (
        <div style={{ padding: '6px 10px', background: 'rgba(0,230,138,0.10)', borderLeft: '2px solid rgba(0,230,138,0.4)', borderRadius: 6, fontSize: 11, fontWeight: 700, color: '#fff' }}>
          {editorToast}
        </div>
      )}

      {/* P2.11: редактирование constraints (оборудование, травмы, avoidAxialLoad, любимые/исключённые) + progression */}
      {dir === 'bb' && program.bb && (
        <BBConstraintsPanel
          constraints={program.bb.constraints ?? { equipment: [] }}
          progression={program.bb.progression ?? { loadStrategy: 'double_progression', deloadProtocol: 'pump', intensityTechniques: ['none'] }}
          onChangeConstraints={(constraints) => onChange({ ...program, bb: { ...program.bb!, constraints } })}
          onChangeProgression={(progression) => onChange({ ...program, bb: { ...program.bb!, progression } })}
        />
      )}

      {dir === 'bb' && program.bb && <BBEditor body={program.bb} level={program.meta.level} onChange={(bb) => update({ bb })} />}
      {dir === 'pl' && program.pl && <PLEditor body={program.pl} onChange={(pl) => update({ pl })} />}
      {dir === 'hybrid' && program.hybrid && <HybridPlanPanel program={program} onChange={(hybrid) => update({ hybrid })} onSave={onSave} />}

      {/* P2.8: Валидация программы */}
      {(() => {
        const issues = validateProgram(program);
        if (issues.length === 0) return null;
        const errCount = issues.filter(i => i.level === 'error').length;
        const warnCount = issues.filter(i => i.level === 'warning').length;
        const infoCount = issues.filter(i => i.level === 'info').length;
        const color = errCount > 0 ? '#ef4444' : warnCount > 0 ? '#f59e0b' : '#3b82f6';
        const icon = errCount > 0 ? '🚫' : warnCount > 0 ? '⚠️' : 'ℹ️';
        return (
          <div style={{ ...CARD, padding: 10, marginTop: 4, borderLeft: `3px solid ${color}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color }}>{icon} Валидация</span>
              <span style={{ fontSize: 10, color: DIM }}>({errCount} ошибок, {warnCount} предупреждений, {infoCount} инфо)</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {issues.map((iss, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 6px', borderRadius: 4, background: iss.level === 'error' ? 'rgba(239,68,68,0.08)' : iss.level === 'warning' ? 'rgba(245,158,11,0.08)' : 'rgba(59,130,246,0.08)' }}>
                  <span style={{ fontSize: 10, color: iss.level === 'error' ? '#ef4444' : iss.level === 'warning' ? '#f59e0b' : '#3b82f6', fontWeight: 800, minWidth: 16 }}>{iss.level === 'error' ? '✕' : iss.level === 'warning' ? '!' : 'i'}</span>
                  <span style={{ fontSize: 10, color: '#fff' }}>{iss.message}</span>
                  <span style={{ fontSize: 9, color: DIM, marginLeft: 'auto' }}>{iss.code}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* История правок (revisions): дешёвая версия — без полных снапшотов, только timestamp+note */}
      {revisions.length > 0 && (
        <div style={{ ...CARD, padding: 10, marginTop: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: ACCENT }}>📜 История правок</span>
            <span style={{ fontSize: 10, color: DIM }}>({revisions.length} записей, последние 20)</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflowY: 'auto' }}>
            {revisions.slice().reverse().map((r, i) => {
              const realIdx = revisions.length - 1 - i;
              return (
                <div key={r.ts} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', borderRadius: 6, background: 'rgba(255,255,255,0.02)' }}>
                  <span style={{ fontSize: 10, color: DIM_STRONG, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.note}</span>
                  <span style={{ fontSize: 10, color: DIM }}>{new Date(r.ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                  <button style={{ ...BTN_GHOST, padding: '2px 6px', fontSize: 9, minHeight: 0, color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }} onClick={() => removeRev(realIdx)} title="Удалить запись">✕</button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── ББ-редактор: недели → сессии → блоки ─── */

const BBEditor: React.FC<{ body: BBProgramBody; onChange: (b: BBProgramBody) => void; level: string }> = ({ body, onChange, level }) => {
  const [volWeekIdx, setVolWeekIdx] = useState<number | null>(null);
  const setWeeks = (weeks: UserWeek[]) => onChange({ ...body, weeks });
  const addWeek = () => {
    const n = body.weeks.length + 1;
    setWeeks([...body.weeks, { week: n, phase: 'accumulation', deload: false, sessions: [] }]);
  };
  const updateWeek = (wi: number, patch: Partial<UserWeek>) => {
    const w2 = body.weeks.map((w, i) => i === wi ? { ...w, ...patch } : w);
    setWeeks(w2);
  };
  // U4: confirm-диалог при удалении недели
  const removeWeek = (wi: number) => {
    const wk = body.weeks[wi];
    const sessCount = wk?.sessions?.length ?? 0;
    if (!window.confirm(`Удалить неделю ${wk?.week}? Будет потеряно ${sessCount} сессий. Это нельзя отменить.`)) return;
    setWeeks(body.weeks.filter((_, i) => i !== wi).map((w, i) => ({ ...w, week: i + 1 })));
  };
  // U12: клонировать неделю
  const cloneWeek = (wi: number) => {
    const src = body.weeks[wi];
    if (!src) return;
    const cloned: UserWeek = {
      week: body.weeks.length + 1,
      phase: src.phase,
      deload: src.deload,
      sessions: src.sessions.map(s => ({
        id: newId('ses'),
        name: s.name,
        dayOfWeek: s.dayOfWeek,
        focus: s.focus,
        blocks: s.blocks.map(b => ({ ...b, id: newId('blk'), sets: b.sets.map(st => ({ ...st })) })),
        warmup: s.warmup,
        cooldown: s.cooldown,
      })),
    };
    setWeeks([...body.weeks, cloned]);
  };

  /** Метрики для выбранной недели — пересчитываем при каждом изменении блоков/сетов. */
  const volMetrics = useMemo(() => {
    if (volWeekIdx == null) return null;
    const w = body.weeks[volWeekIdx];
    if (!w) return null;
    if ((w.sessions ?? []).length === 0) return null;
    try { return calcBBPlanMetrics(userWeekToBBPlan(w, level)); } catch { return null; }
  }, [volWeekIdx, body.weeks, level]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT }}>Структура ({body.weeks.length} нед)</div>
      {body.weeks.map((w, wi) => (
        <div key={wi} style={{ ...CARD, padding: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
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
            <button
              style={{ ...BTN_GHOST, padding: '3px 8px', fontSize: 10, minHeight: 0,
                       color: volWeekIdx === wi ? ACCENT : DIM_STRONG,
                       borderColor: volWeekIdx === wi ? ACCENT_LINE : 'rgba(255,255,255,0.08)' }}
              onClick={() => setVolWeekIdx(volWeekIdx === wi ? null : wi)}
              title="Показать бюджет объёма по мышцам для этой недели"
            >📊 Объём</button>
            <button style={{ ...BTN_GHOST, padding: '3px 8px', fontSize: 10, minHeight: 0 }} onClick={() => cloneWeek(wi)} title="Клонировать неделю">⧉</button>
            <button style={{ ...BTN_GHOST, padding: '3px 8px', fontSize: 10, minHeight: 0, marginLeft: 'auto', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }} onClick={() => removeWeek(wi)}>✕ нед</button>
          </div>
          {volWeekIdx === wi && (
            <div style={{ marginBottom: 8 }}>
              {volMetrics
                ? <VolumeBudgetCard metrics={volMetrics} />
                : <div style={{ fontSize: 11, color: DIM, padding: 8, background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
                    Недостаточно данных — добавьте хотя бы одну сессию с упражнениями, чтобы увидеть бюджет объёма.
                  </div>
              }
            </div>
          )}
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
  // U4: confirm-диалог при удалении сессии
  const removeSession = (si: number) => {
    const s = sessions[si];
    if (!window.confirm(`Удалить "${s.name}"? Будет потеряно ${s.blocks.length} упражнений. Это нельзя отменить.`)) return;
    onChange(sessions.filter((_, i) => i !== si));
  };
  // U12: клонировать сессию
  const cloneSession = (si: number) => {
    const src = sessions[si];
    if (!src) return;
    onChange([
      ...sessions,
      {
        id: newId('ses'),
        name: src.name + ' (копия)',
        dayOfWeek: src.dayOfWeek,
        focus: src.focus,
        blocks: src.blocks.map(b => ({ ...b, id: newId('blk'), sets: b.sets.map(st => ({ ...st })) })),
        warmup: src.warmup,
        cooldown: src.cooldown,
      },
    ]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {sessions.map((s, si) => (
        <div key={s.id} style={{ padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <input style={{ ...IN, padding: '4px 6px', fontSize: 11, flex: 1 }} value={s.name} onChange={e => updateSession(si, { name: e.target.value })} placeholder="День" />
            <input style={{ ...IN, padding: '4px 6px', fontSize: 11, flex: 1 }} value={s.focus} onChange={e => updateSession(si, { focus: e.target.value })} placeholder="Фокус (грудь/трицепс)" />
            <button style={{ ...BTN_GHOST, padding: '3px 8px', fontSize: 10, minHeight: 0 }} onClick={() => cloneSession(si)} title="Клонировать сессию">⧉</button>
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
  // U4: confirm-диалог при удалении блока
  const removeBlock = (bi: number) => {
    const b = blocks[bi];
    if (!window.confirm(`Удалить "${b.exerciseName || 'упражнение'}"? Будет потеряно ${b.sets.length} сетов. Это нельзя отменить.`)) return;
    onChange(blocks.filter((_, i) => i !== bi));
  };
  // U12: клонировать блок
  const cloneBlock = (bi: number) => {
    const src = blocks[bi];
    if (!src) return;
    onChange([
      ...blocks,
      { ...src, id: newId('blk'), sets: src.sets.map(s => ({ ...s })) },
    ]);
  };
  // U11: назначить/снять superset-партнёра (следующий/предыдущий блок)
  const linkSuperset = (bi: number) => {
    const current = blocks[bi];
    if (!current) return;
    // Ищем ближайший блок вверх/вниз, у которого ещё нет supersetWith или текущий — не его партнёр
    const partnerIdx = bi > 0 ? bi - 1 : bi + 1;
    if (partnerIdx < 0 || partnerIdx >= blocks.length) return;
    const partner = blocks[partnerIdx];
    onChange(blocks.map((b, i) => {
      if (i === bi) return { ...b, supersetWith: partner.id };
      if (i === partnerIdx) return { ...b, supersetWith: current.id };
      return b;
    }));
  };
  const unlinkSuperset = (bi: number) => {
    onChange(blocks.map((b, i) => {
      if (i === bi) return { ...b, supersetWith: undefined };
      if (b.supersetWith === blocks[bi]?.id) return { ...b, supersetWith: undefined };
      return b;
    }));
  };
  const moveBlock = (bi: number, dir: -1 | 1) => { const j = bi + dir; if (j < 0 || j >= blocks.length) return; const arr = [...blocks]; const tmp = arr[bi]; arr[bi] = arr[j]; arr[j] = tmp; onChange(arr); };
  const moveTo = (from: number, to: number) => {
    if (from === to || from < 0 || from >= blocks.length || to < 0 || to >= blocks.length) return;
    const arr = [...blocks];
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    onChange(arr);
  };

  // HTML5 drag-and-drop: desktop работает «из коробки», мобильный (iOS 13+/Chrome) — через draggable.
  // Touch fallback (long-press → перетаскивание через touch events) для старых мобильных WebView.
  const dragSrcRef = React.useRef<number | null>(null);
  const touchSrcRef = React.useRef<number | null>(null);
  const touchArmedRef = React.useRef<number | null>(null);
  const longPressTimer = React.useRef<number | null>(null);
  const rowRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const onTouchStart = (bi: number) => (e: React.TouchEvent) => {
    touchSrcRef.current = bi;
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => {
      touchArmedRef.current = bi;
      setOverIdx(bi);
      try { (navigator as any).vibrate?.(15); } catch { /* ignore */ }
    }, 350);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (touchArmedRef.current == null) return;
    e.preventDefault();
    const t = e.touches[0];
    const y = t.clientY;
    let nearest = touchArmedRef.current;
    let nearestDist = Infinity;
    rowRefs.current.forEach((el, i) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      const mid = r.top + r.height / 2;
      const d = Math.abs(mid - y);
      if (d < nearestDist) { nearestDist = d; nearest = i; }
    });
    setOverIdx(nearest);
  };
  const onTouchEnd = () => {
    if (longPressTimer.current) { window.clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    if (touchArmedRef.current != null && overIdx != null) {
      moveTo(touchArmedRef.current, overIdx);
    }
    touchSrcRef.current = null;
    touchArmedRef.current = null;
    setOverIdx(null);
  };
  const onTouchCancel = () => {
    if (longPressTimer.current) { window.clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    touchSrcRef.current = null;
    touchArmedRef.current = null;
    setOverIdx(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} onTouchEnd={onTouchEnd} onTouchCancel={onTouchCancel}>
      {blocks.map((b, bi) => (
        <div
          key={b.id}
          ref={el => { rowRefs.current[bi] = el; }}
          draggable
          onDragStart={e => { dragSrcRef.current = bi; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(bi)); setOverIdx(bi); }}
          onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (overIdx !== bi) setOverIdx(bi); }}
          onDragLeave={() => { if (overIdx === bi) setOverIdx(null); }}
          onDrop={e => {
            e.preventDefault();
            const src = dragSrcRef.current;
            dragSrcRef.current = null;
            setOverIdx(null);
            if (src != null) moveTo(src, bi);
          }}
          onDragEnd={() => { dragSrcRef.current = null; setOverIdx(null); }}
          onTouchStart={onTouchStart(bi)}
          onTouchMove={onTouchMove}
          style={{
            display: 'flex', gap: 4, alignItems: 'center', padding: '4px 0',
            borderTop: overIdx === bi ? '2px solid #00e68a' : '2px solid transparent',
            transition: 'border-color 0.1s',
            background: touchArmedRef.current === bi ? 'rgba(0,230,138,0.06)' : 'transparent',
            borderRadius: 6,
          }}
        >
          <span
            title="Перетащите для изменения порядка (или удерживайте на тач-устройстве)"
            style={{ cursor: 'grab', fontSize: 12, color: '#64748b', userSelect: 'none', padding: '0 2px', touchAction: 'none' }}
            aria-label="drag handle"
          >☰</span>
          <select style={{ ...IN, padding: '3px 4px', fontSize: 10, flex: '0 0 86px' }} value={b.type} onChange={e => updateBlock(bi, { type: e.target.value as UserBlock['type'], role: e.target.value === 'compound' ? 'primary' : 'accessory' })}>
            <option value="compound">Базовое</option>
            <option value="accessory">Доп.</option>
            <option value="isolation">Изоляция</option>
            <option value="finisher">Финишь</option>
          </select>
<ExercisePicker value={b.exerciseName} muscle={b.muscle} onSelect={ex => updateBlock(bi, { exerciseName: ex.name, muscle: ex.group || b.muscle, type: (ex.type === 'compound' ? 'compound' : ex.type === 'isolation' ? 'isolation' : 'accessory') as UserBlock['type'], role: ex.type === 'compound' ? 'primary' : 'accessory' })} />
          <input style={{ ...IN, padding: '4px 6px', fontSize: 11, flex: '0 0 90px' }} value={b.muscle} onChange={e => updateBlock(bi, { muscle: e.target.value })} placeholder="Мышечная группа" list="muscle-list" />
          <SetEditor sets={b.sets} onChange={(sets) => updateBlock(bi, { sets })} muscle={b.muscle} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <button style={{ ...BTN_GHOST, padding: '0 4px', fontSize: 9, minHeight: 0, lineHeight: 1 }} onClick={() => moveBlock(bi, -1)} title="Вверх">▲</button>
            <button style={{ ...BTN_GHOST, padding: '0 4px', fontSize: 9, minHeight: 0, lineHeight: 1 }} onClick={() => moveBlock(bi, 1)} title="Вниз">▼</button>
          </div>
          <button
            style={{ ...BTN_GHOST, padding: '2px 4px', fontSize: 9, minHeight: 0, color: b.supersetWith ? '#a78bfa' : DIM, borderColor: b.supersetWith ? 'rgba(167,139,250,0.3)' : 'rgba(255,255,255,0.08)' }}
            onClick={() => b.supersetWith ? unlinkSuperset(bi) : linkSuperset(bi)}
            title={b.supersetWith ? 'Снять superset-привязку' : 'Связать суперсетом с соседним блоком'}
          >⊕</button>
          <button style={{ ...BTN_GHOST, padding: '2px 4px', fontSize: 9, minHeight: 0 }} onClick={() => cloneBlock(bi)} title="Клонировать блок">⧉</button>
          <button style={{ ...BTN_GHOST, padding: '3px 6px', fontSize: 10, minHeight: 0, color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }} onClick={() => removeBlock(bi)}>✕</button>
        </div>
      ))}
      <button style={{ ...BTN_GHOST, padding: '4px 8px', fontSize: 10, minHeight: 0, alignSelf: 'flex-start' }} onClick={addBlock}>+ Упражнение</button>
      <datalist id="muscle-list">{Object.entries(GROUP_RU).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</datalist>
    </div>
  );
};

const SetEditor: React.FC<{ sets: UserSet[]; onChange: (s: UserSet[]) => void; muscle?: string }> = ({ sets, onChange, muscle }) => {
  const add = () => onChange([...sets, { reps: 10, rir: 2, weight: 0, restSec: 90 }]);
  const upd = (i: number, patch: Partial<UserSet>) => onChange(sets.map((s, j) => j === i ? { ...s, ...patch } : s));
  const del = (i: number) => onChange(sets.filter((_, j) => j !== i));
  // U4: confirm при удалении последнего сета (если блок станет пустым)
  const confirmDelete = (i: number) => {
    if (sets.length === 1) {
      if (!window.confirm('Удалить последний сет? Блок останется без сетов (можно добавить заново).')) return;
    }
    del(i);
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, flex: '0 0 auto', flexWrap: 'wrap' }}>
      {sets.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'rgba(0,230,138,0.06)', borderRadius: 6, padding: '2px 4px' }}>
          {/* U7: расширенный SetEditor: reps × rir @ вес + RPE-тайп + техника */}
          <input type="number" style={{ ...IN, padding: '2px 3px', fontSize: 10, width: 30 }} value={typeof s.reps === 'number' ? s.reps : 0} onChange={e => upd(i, { reps: parseInt(e.target.value) || 0 })} title="повторения" />
          <span style={{ fontSize: 9, color: DIM }}>×</span>
          <input type="number" style={{ ...IN, padding: '2px 3px', fontSize: 10, width: 26 }} value={s.rir} min={0} max={5} onChange={e => upd(i, { rir: parseInt(e.target.value) || 0 })} title="RIR" />
          <span style={{ fontSize: 9, color: DIM }}>@</span>
          <input type="number" style={{ ...IN, padding: '2px 3px', fontSize: 10, width: 36 }} value={s.weight ?? 0} onChange={e => upd(i, { weight: parseFloat(e.target.value) || 0 })} title="вес (кг)" placeholder="кг" />
          <select
            style={{ ...IN, padding: '1px 2px', fontSize: 9, width: 50 }}
            value={s.technique || 'none'}
            onChange={e => upd(i, { technique: e.target.value as any })}
            title="Техника"
          >
            <option value="none">—</option>
            <option value="rest_pause">RP</option>
            <option value="drop_set">DRP</option>
            <option value="myo_reps">MYO</option>
            <option value="pause_rep">PRS</option>
            <option value="mechanical_drop">MD</option>
          </select>
          <input
            type="number" style={{ ...IN, padding: '2px 3px', fontSize: 10, width: 32 }} value={Math.floor((s.restSec ?? 90) / 60)}
            min={0} max={20}
            onChange={e => upd(i, { restSec: (parseInt(e.target.value) || 0) * 60 })}
            title="отдых (мин)"
            placeholder="отд"
          />
          <span style={{ fontSize: 8, color: DIM }}>м</span>
          <button style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: 10, padding: 0 }} onClick={() => confirmDelete(i)}>✕</button>
        </div>
      ))}
      <button style={{ ...BTN_GHOST, padding: '2px 6px', fontSize: 10, minHeight: 0 }} onClick={add}>+ сет</button>
      {/* Phase 6: быстрые шаблоны сетов — клик заменяет все сеты на pattern */}
      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 4, paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <span style={{ fontSize: 8, color: DIM, marginRight: 4 }}>📋 Шаблоны:</span>
        {Object.entries(SET_TEMPLATES).slice(0, 5).map(([key, tmpl]) => (
          <button
            key={key}
            title={'Применить: ' + key + ' (' + tmpl.sets + '×' + tmpl.reps + ' RIR' + tmpl.rir + ', ' + Math.floor(tmpl.rest / 60) + 'м)'}
            style={{ padding: '2px 6px', borderRadius: 6, fontSize: 9, cursor: 'pointer', background: 'rgba(167,139,250,0.10)', border: '1px solid rgba(167,139,250,0.25)', color: '#a78bfa', fontWeight: 700 }}
            onClick={() => onChange(Array.from({ length: tmpl.sets }, () => ({ reps: tmpl.reps, rir: tmpl.rir, restSec: tmpl.rest, weight: sets[0]?.weight ?? 0 })))}
          >
            {key}
          </button>
        ))}
      </div>
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

/* ─── P2.11: BBConstraintsPanel — редактирование constraints (оборудование, травмы, avoidAxial, любимые/исключённые) + progression ─── */

const EQUIPMENT_OPTS = [
  { id: 'barbell', label: 'Штанга' }, { id: 'dumbbell', label: 'Гантели' }, { id: 'cable', label: 'Блок' },
  { id: 'machine', label: 'Тренажёр' }, { id: 'bodyweight', label: 'Свой вес' }, { id: 'suspension', label: 'TRX/петли' },
  { id: 'kettlebell', label: 'Гиря' }, { id: 'band', label: 'Резина' }, { id: 'smith', label: 'Смит' }, { id: 'plate', label: 'Блин' },
];
const LOAD_STRATEGY_OPTS = [
  { id: 'double_progression', label: 'Двойная прогрессия' }, { id: 'linear', label: 'Линейная' },
  { id: 'wave', label: 'Волновая' }, { id: 'rpe_based', label: 'По RPE' },
];
const DELOAD_PROTOCOL_OPTS = [
  { id: 'pump', label: 'Памп' }, { id: 'neural', label: 'Нейральная' },
  { id: 'full_rest', label: 'Полный отдых' }, { id: 'mini', label: 'Микро-делод' },
];
const INTENSITY_TECHNIQUE_OPTS = [
  { id: 'none', label: 'Нет' }, { id: 'rest_pause', label: 'Рест-пауза' }, { id: 'drop_set', label: 'Дроп-сет' },
  { id: 'myo_reps', label: 'Мио-репс' }, { id: 'pause_rep', label: 'Пауза' }, { id: 'mechanical_drop', label: 'Мех. дроп' },
];

const Chip: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode; color?: string }> = ({ active, onClick, children, color }) => (
  <button onClick={onClick} style={{ padding: '4px 8px', borderRadius: 6, fontSize: 10, cursor: 'pointer', border: active ? '1px solid ' + (color || '#00e68a') : '1px solid rgba(255,255,255,0.08)', background: active ? (color || '#00e68a') + '20' : 'rgba(255,255,255,0.02)', color: active ? '#fff' : DIM }}>{children}</button>
);

const BBConstraintsPanel: React.FC<{
  constraints: ProgramConstraints;
  progression: ProgramProgression;
  onChangeConstraints: (c: ProgramConstraints) => void;
  onChangeProgression: (p: ProgramProgression) => void;
}> = ({ constraints, progression, onChangeConstraints, onChangeProgression }) => {
  const toggleEq = (eq: string) => {
    const arr = constraints.equipment ?? [];
    onChangeConstraints({ ...constraints, equipment: arr.includes(eq) ? arr.filter(x => x !== eq) : [...arr, eq] });
  };
  const toggleIntensity = (it: any) => {
    const arr: any[] = (progression.intensityTechniques as any[]) ?? ['none'];
    if (it === 'none') onChangeProgression({ ...progression, intensityTechniques: ['none'] as any });
    else onChangeProgression({ ...progression, intensityTechniques: (arr.includes(it) ? arr.filter(x => x !== it && x !== 'none') : [...arr.filter(x => x !== 'none'), it]) as any });
  };
  return (
    <div style={{ ...CARD, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT }}>⚙️ Параметры ББ-программы</div>
      <div>
        <div style={{ fontSize: 10, color: DIM, marginBottom: 4 }}>Оборудование (доступное)</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {EQUIPMENT_OPTS.map(o => <Chip key={o.id} active={(constraints.equipment ?? []).includes(o.id)} onClick={() => toggleEq(o.id)}>{o.label}</Chip>)}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 10, color: DIM, marginBottom: 4 }}>Прогрессия весов</div>
        <select style={IN} value={progression.loadStrategy || 'double_progression'} onChange={e => onChangeProgression({ ...progression, loadStrategy: e.target.value as any })}>
          {LOAD_STRATEGY_OPTS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </div>
      <div>
        <div style={{ fontSize: 10, color: DIM, marginBottom: 4 }}>Протокол делода</div>
        <select style={IN} value={progression.deloadProtocol || 'pump'} onChange={e => onChangeProgression({ ...progression, deloadProtocol: e.target.value as any })}>
          {DELOAD_PROTOCOL_OPTS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </div>
      <div>
        <div style={{ fontSize: 10, color: DIM, marginBottom: 4 }}>Интенсив-техники</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {INTENSITY_TECHNIQUE_OPTS.map(o => <Chip key={o.id} active={((progression.intensityTechniques as any[]) ?? ['none']).includes(o.id as any)} onClick={() => toggleIntensity(o.id)}>{o.label}</Chip>)}
        </div>
      </div>
      <label style={{ ...SMALL, display: 'flex', alignItems: 'center', gap: 6 }}>
        <input type="checkbox" checked={constraints.avoidAxialLoad ?? false} onChange={e => onChangeConstraints({ ...constraints, avoidAxialLoad: e.target.checked })} />
        🦴 Убрать осевую нагрузку (присед/становая/жим стоя)
      </label>
    </div>
  );
};