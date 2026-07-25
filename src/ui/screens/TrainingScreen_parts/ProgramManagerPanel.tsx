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
import { ExerciseLabPicker } from './ExerciseLabPicker';
import { BbProgramLibraryPicker } from './BbProgramLibraryPicker';
import { BbContextPanel, PLContextPanel } from './program-editor-context-panels';
import { BBEditor, PLEditor, BBConstraintsPanel } from './ProgramEditorComponents';
import { DiagnosticPanel, VolumeLandmarksPanel, PhaseLegend, ExerciseInfo, RecommendationsPanel, ProgressionCoach, SplitConsultant } from './ProgramEditorPanels';
import { getTrainingMethods } from '../../../engines/training-methodology.engine';
import { SET_TEMPLATES } from './program-types';
import {
  autodraftBBPlan,
  buildUserProgramFromBB,
  computePlanQualityFor,
  applyPhaseModulation,
  plLmsScheduleDays,
  suggestExercisesForGroup,
} from '../../../engines/manual-constructor.engine';
import { tempoFor } from '../../../engines/bb/bb-tempo-rest';
import { INTENSITY_TECHNIQUES, type IntensityTechnique } from '../../../engines/bb/bb-autocoach.engine';
import { RIR_MATRIX } from '../../../engines/rir-matrix.engine';
import { loadTrainingProfile, useTrainingProfile, type TrainingProfile } from './training-profile';
import { TrainingProfileCard } from './TrainingProfileCard';
import { calcBBPlanMetrics } from '../../../engines/bb/bb-metrics.engine';
import { ACCENT, ACCENT_LINE, CARD, BTN, BTN_GHOST, SMALL, DIM, DIM_STRONG, IN, panelStyle } from './training-ui';
import { GROUP_RU } from './program-types';
import { labTrainingAdjust } from './lab-training-adjust';
import { distributePhases, PHASE_CONFIGS } from './phase-periodization';
import { suggestFeeders } from '../../../engines/bb/bb-autocoach.engine';
import { useDataLink } from '../../../core/data-link';
import { findSubstitutions } from '../../../engines/exercise-substitution.engine';
import { getVolumeLandmarks } from '../../../engines/volume-landmarks.engine';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import type { Exercise } from '../../../core/types';

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
  // P2-5: сравнение двух программ
  const [compareIds, setCompareIds] = useState<string[]>([]);

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
          {/* P1-6: JSON экспорт/импорт */}
          <button style={{ ...BTN_GHOST, padding: '3px 8px', fontSize: 10, minHeight: 0 }} onClick={() => {
            const json = JSON.stringify(programs, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'bodybuildhealth-programs-' + new Date().toISOString().slice(0,10) + '.json';
            a.click(); URL.revokeObjectURL(url);
            flash('📥 Экспортировано ' + programs.length + ' программ');
          }} title="Экспорт всех программ в JSON">📥 JSON</button>
          <label style={{ ...BTN_GHOST, padding: '3px 8px', fontSize: 10, minHeight: 0, cursor: 'pointer', position: 'relative' }}>
            📤 JSON
            <input type="file" accept=".json" style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} onChange={e => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                try {
                  const imported = JSON.parse(reader.result as string);
                  if (!Array.isArray(imported)) throw new Error('Not an array');
                  let added = 0;
                  for (const p of imported) {
                    if (!p.meta?.id || !p.meta?.direction) continue;
                    const exists = programs.find(x => x.meta.id === p.meta.id);
                    if (exists) continue;
                    saveUserProgram(p as UserProgram, 'Импорт JSON');
                    added++;
                  }
                  refresh();
                  flash('📤 Импортировано: ' + added + ' новых программ');
                } catch { flash('⚠ Ошибка: неверный формат JSON'); }
              };
              reader.readAsText(file);
              e.target.value = '';
            }} />
          </label>
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
            <button style={{ ...BTN_GHOST, padding: '4px 8px', fontSize: 11, minHeight: 0 }} onClick={() => {
              const clone = JSON.parse(JSON.stringify(p));
              clone.meta.id = newId('prog');
              clone.meta.title = p.meta.title + ' (копия)';
              clone.meta.source = 'custom';
              clone.meta.createdAt = new Date().toISOString();
              clone.meta.updatedAt = new Date().toISOString();
              clone.meta.revisions = [{ ts: new Date().toISOString(), note: 'Клон «' + p.meta.title + '»' }];
              saveUserProgram(clone, 'Клонирование');
              refresh();
              flash('📋 Клонировано: ' + clone.meta.title);
            }} title="Клонировать">⧉</button>
            <button style={{ ...BTN_GHOST, padding: '4px 8px', fontSize: 11, minHeight: 0 }} onClick={() => { setCompareIds(prev => prev.includes(p.meta.id) ? prev.filter(x => x !== p.meta.id) : prev.length < 2 ? [...prev, p.meta.id] : [prev[1], p.meta.id]); }} title="Сравнить">⚖</button>
            <button style={{ ...BTN_GHOST, padding: '4px 8px', fontSize: 11, minHeight: 0 }} onClick={() => copyProgramToClipboard(p)} title="Скопировать в буфер">📋</button>
            <button style={{ ...BTN_GHOST, padding: '4px 8px', fontSize: 11, minHeight: 0, color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }} onClick={() => removeProgram(p.meta.id)}>✕</button>
          </div>
        ))}
      </div>

      {/* P2-5: панель сравнения двух программ */}
      {compareIds.length === 2 && (() => {
        const [a, b] = [programs.find(p => p.meta.id === compareIds[0]), programs.find(p => p.meta.id === compareIds[1])];
        if (!a || !b) return null;
        const stats = (p: UserProgram) => {
          const s: Record<string, number> = {};
          if (p.bb?.weeks) {
            for (const w of p.bb.weeks) {
              for (const ses of w.sessions ?? []) {
                for (const blk of ses.blocks ?? []) {
                  const m = (blk.muscle || '').toLowerCase();
                  if (m) s[m] = (s[m] || 0) + (blk.sets?.length ?? 0);
                }
              }
            }
          }
          return s;
        };
        const sa = stats(a);
        const sb = stats(b);
        const allMuscles = Array.from(new Set([...Object.keys(sa), ...Object.keys(sb)])).slice(0, 10);
        return (
          <div style={{ ...CARD, padding: 10, borderLeft: '3px solid #f59e0b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#f59e0b' }}>⚖ Сравнение</span>
              <button style={{ ...BTN_GHOST, padding: '6px 10px', fontSize: 11, minHeight: 38 }} onClick={() => setCompareIds([])}>✕ Закрыть</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 4, fontSize: 11, marginBottom: 4 }}>
              <div style={{ fontWeight: 700, color: DIR_COLOR[a.meta.direction] }}>{a.meta.title}</div>
              <div style={{ color: DIM }}></div>
              <div style={{ fontWeight: 700, color: DIR_COLOR[b.meta.direction] }}>{b.meta.title}</div>
              <div style={{ color: DIM }}>{a.meta.daysPerWeek}д/нед · {a.meta.weeks}нед</div>
              <div style={{ color: DIM }}>vs</div>
              <div style={{ color: DIM }}>{b.meta.daysPerWeek}д/нед · {b.meta.weeks}нед</div>
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: DIM_STRONG, marginBottom: 4, marginTop: 6 }}>Объём по мышцам (сетов/программу):</div>
            {allMuscles.map(m => {
              const va = sa[m] || 0;
              const vb = sb[m] || 0;
              const delta = vb - va;
              return (
                <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', fontSize: 11 }}>
                  <span style={{ color: DIM_STRONG, minWidth: 50 }}>{GROUP_RU[m] ?? m}</span>
                  <span style={{ color: '#00e68a', fontWeight: 700, minWidth: 28, textAlign: 'right' }}>{va}</span>
                  <span style={{ color: delta > 0 ? '#22c55e' : delta < 0 ? '#ef4444' : DIM, fontWeight: 700, minWidth: 36, textAlign: 'center' }}>{delta > 0 ? '+' + delta : delta === 0 ? '0' : delta}</span>
                  <span style={{ color: '#a78bfa', fontWeight: 700, minWidth: 28, textAlign: 'right' }}>{vb}</span>
                </div>
              );
            })}
          </div>
        );
      })()}

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
  const linked = useDataLink();
  const labAdjust = useMemo(() => labTrainingAdjust(linked.labAnalysis ?? null), [linked.labAnalysis]);
  const [tprofile, updateTProfile] = useTrainingProfile();

  // Локальный toast — сам ProgramEditor не имеет доступа к flash() родителя.
  const [editorToast, setEditorToast] = useState('');
  const showToast = (m: string) => { setEditorToast(m); setTimeout(() => setEditorToast(''), 2200); };

  // Библиотека внутри редактора
  const [editorLibOpen, setEditorLibOpen] = useState<'bb' | 'pl' | 'methods' | null>(null);
  const [methCat, setMethCat] = useState('all');
  const [methSearch, setMethSearch] = useState('');
  const libraryPrograms = useMemo(() => getAllPrograms(), []);
  const plCycleList = useMemo(() => LMS_CYCLES, []);
  const loadIntoEditor = (p: UserProgram) => {
    onChange(p);
    setEditorLibOpen(null);
    showToast('📥 Загружено: ' + p.meta.title);
  };
  const loadCycleIntoEditor = (cycleId: string) => {
    const p = cloneFromCycle(cycleId);
    if (!p) { showToast('⚠ Цикл не найден'); return; }
    onChange(p);
    setEditorLibOpen(null);
    showToast('📥 Загружен ПЛ-цикл: ' + p.meta.title);
  };

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
  // Читает единый профиль тренированности (equipment, weakPoints, avoidAxialLoad,
  // workMax, onCourse, favoriteExercises, excludedExercises) + лаб. коррекцию.
  const autoFillDraft = () => {
    const prof = loadTrainingProfile();
    const days = Math.max(2, Math.min(7, program.meta.daysPerWeek || 4));
    const title = '[Черновик] ' + (program.meta.title || 'Моя программа');
    updateMeta({ title });
    if ((dir === 'bb' || dir === 'hybrid') && program.bb) {
      try {
        const bbPlan = autodraftBBPlan({
          level: program.meta.level,
          goal: program.meta.goal,
          daysPerWeek: days,
          weeks: Math.max(1, program.meta.weeks || 4),
          equipment: (prof.equipment ?? []) as string[],
          weakPoints: (prof.weakPoints ?? []) as string[],
          avoidAxialLoad: prof.avoidAxialLoad ?? false,
          favoriteExercises: (prof.favoriteExercises ?? []) as string[],
          excludedExercises: (prof.excludedExercises ?? []) as string[],
          workMax: prof.workMax ?? {},
          onCourse: prof.onCourse ?? false,
          courseIntensity: prof.courseIntensity ?? 'moderate',
          injuries: prof.injuries ?? [],
        });
        const userProg = createFromBuild(bbPlan, {
          title: program.meta.title || `${days}д/нед · ${program.meta.weeks}нед`,
          goal: program.meta.goal,
          level: program.meta.level,
          weakPoints: (prof.weakPoints ?? []) as string[],
          equipment: (prof.equipment ?? []) as string[],
        });
        userProg.meta.title = title;
        userProg.meta.weeks = program.meta.weeks;
        userProg.meta.daysPerWeek = days;
        if (userProg.bb) {
          userProg.bb.constraints = {
            equipment: (prof.equipment ?? []) as string[],
            avoidAxialLoad: prof.avoidAxialLoad ?? false,
            injuries: (prof.injuries ?? []).map((inj) => ({ muscle: inj.muscle, grade: inj.exclude ? 'excluded' : 'graded' })),
            favoriteExercises: (prof.favoriteExercises ?? []) as string[],
            excludedExercises: (prof.excludedExercises ?? []) as string[],
          };
          userProg.bb.progression = {
            loadStrategy: (prof.loadStrategy ?? 'double_progression') as ProgramProgression['loadStrategy'],
            deloadProtocol: 'pump',
            intensityTechniques: ['none'],
          };
          // P0-3: фазовая периодизация — RIR/объём/повторения по неделям
          if ((userProg.bb.weeks?.length ?? 0) >= 4) {
            userProg.bb.weeks = applyPhaseModulation(userProg.bb.weeks!, {
              goal: program.meta.goal,
              level: program.meta.level,
              weeksTotal: program.meta.weeks || 4,
            });
          }
        }
        update({ bb: userProg.bb });
      } catch (err) {
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
      const sessCount = Math.max(2, Math.min(6, days));
      // Авто-подбор LMS-цикла по уровню и дням
      let foundCycle = LMS_CYCLES.find(c =>
        c.meta.level === program.meta.level &&
        Math.abs(c.meta.sessionsPerWeek - sessCount) <= 1
      );
      if (!foundCycle) {
        foundCycle = LMS_CYCLES.find(c =>
          Math.abs(c.meta.sessionsPerWeek - sessCount) <= 1
        );
      }
      update({
        pl: {
          ...program.pl,
          sourceCycleId: foundCycle ? foundCycle.meta.id : program.pl.sourceCycleId,
          schedule: Array.from({ length: sessCount }, (_, i) => ({ sessionIdx: i, dayOfWeek: i })),
          workMax: { squat: prof.pmSquat, bench: prof.pmBench, dead: prof.pmDead },
          weakPoints: (prof.weakPoints ?? []) as string[],
          notes: foundCycle
            ? `Цикл: ${foundCycle.meta.title} (${foundCycle.meta.weeks} нед, ${foundCycle.meta.sessionsPerWeek}д/нед). Процентки неизменны — ваш оверлей.`
            : 'Цикл не выбран. Нажмите «🔍 ПЛ-циклы» чтобы подключить.',
        },
      });
      if (foundCycle) showToast('🏆 ПЛ-цикл подобран: ' + foundCycle.meta.title);
    }
    showToast('⚡ Черновик создан из профиля — заполните упражнения и ПМ');
  };

 // «🚚 К выполнению» — поддерживает BB и PL.
  const [execWeek, setExecWeek] = useState(1);
  const sendToExecution = () => {
    let days: { label: string; exercises: { name: string; muscleGroup: string; targetSets: { weight: number; reps: number; rir: number }[] }[] }[] = [];

    if (dir === 'bb' && program.bb) {
      const wi = Math.max(0, Math.min(execWeek - 1, program.bb.weeks.length - 1));
      const week = program.bb.weeks[wi];
      if (!week) { alert('Сначала добавьте хотя бы одну сессию.'); return; }
      for (const s of week.sessions) {
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
      // P0-2: custom PL — конвертируем customWeeks в PlayerDay[]
      if (program.pl.sourceCycleId === null && program.pl.customWeeks && program.pl.customWeeks.length > 0) {
        const wm = program.pl.workMax || {};
        const wmFor = (lift: string): number => {
          if (lift === 'bench') return wm.bench ?? 0;
          if (lift === 'dead') return wm.dead ?? 0;
          return wm.squat ?? 0;
        };
        const wiPL = Math.max(0, Math.min(execWeek - 1, program.pl.customWeeks!.length - 1));
        const wk0 = program.pl.customWeeks[wiPL];
        if (!wk0 || wk0.days.length === 0) {
          alert('Свой ПЛ-цикл пуст — добавьте дни и упражнения.');
          return;
        }
        days = wk0.days.map((d, di) => ({
          label: d.name || `День ${di + 1}`,
          exercises: d.exercises.map((ex) => ({
            name: ex.name,
            muscleGroup: ex.muscle || ex.lift,
            targetSets: ex.sets.map((st) => ({
              weight: Math.round((wmFor(ex.lift) * st.pct) / 2.5) * 2.5,
              reps: st.reps,
              rir: st.rir ?? 2,
            })),
          })),
        }));
      } else {
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
                const w = (st as { weight?: number }).weight;
                const computed = (typeof w === 'number' && w > 0)
                  ? w
                  : (pmBase > 0 ? Math.round((pmBase * (ex.sets[0]?.pct ?? 0.7)) / 2.5) * 2.5 : 0);
                return { weight: computed, reps: st.reps ?? 5, rir: 2 };
              }),
            };
          }),
        }));
      }
    } else {
      alert('Сначала выберите ББ или ПЛ программу.');
      return;
    }
    try {
      localStorage.setItem('he_pl_runtime', JSON.stringify({ days, focus: program.meta.title || 'Моя программа', week: execWeek, track: dir }));
    } catch {}
    showToast('🚚 Отправлено к выполнению — откройте зону «▶ Тренировка»');
  };

  /** 🖨 PDF-печать программы — print-friendly окно с таблицами */
  const printProgram = () => {
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) { showToast('⚠ Разрешите всплывающие окна'); return; }
    const html: string[] = [];
    html.push(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${program.meta.title}</title><style>`);
    html.push('body{font-family:Arial,sans-serif;margin:20px;color:#1a1a1a;background:#fff}');
    html.push('h1{font-size:20px;margin:0 0 6px}h2{font-size:14px;margin:16px 0 6px;color:#333}');
    html.push('table{border-collapse:collapse;width:100%;margin:6px 0;font-size:12px}');
    html.push('th,td{border:1px solid #ccc;padding:4px 8px;text-align:left}th{background:#f0f0f0}');
    html.push('.meta{color:#666;font-size:11px;margin-bottom:12px}');
    html.push('.phase{display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;margin-left:6px}');
    html.push('</style></head><body>');
    html.push(`<h1>${program.meta.title}</h1>`);
    html.push(`<div class="meta">Цель: ${GOAL_OPTS.find(g=>g.id===program.meta.goal)?.label ?? program.meta.goal} · Уровень: ${LEVEL_OPTS.find(l=>l.id===program.meta.level)?.label ?? program.meta.level} · ${program.meta.daysPerWeek} дн/нед × ${program.meta.weeks} нед</div>`);
    if (program.bb?.weeks) {
      for (const w of program.bb.weeks) {
        html.push(`<h2>Неделя ${w.week} <span class="phase" style="background:${w.deload?'#f59e0b20':'#00e68a20'};color:${w.deload?'#f59e0b':'#00e68a'}">${w.phase}${w.deload?' · делод':''}</span></h2>`);
        for (const s of w.sessions) {
          html.push(`<table><thead><tr><th colspan="5">${s.name || 'День'} ${s.focus ? '· ' + s.focus : ''}</th></tr><tr><th>Упражнение</th><th>Группа</th><th>Сеты</th><th>RIR</th><th>Вес</th></tr></thead><tbody>`);
          for (const b of s.blocks) {
            if (!b.exerciseName) continue;
            const setsStr = b.sets.map(st => `${st.reps}×`).join(', ');
            const rir = b.sets[0]?.rir ?? '-';
            const wt = b.sets[0]?.weight ?? 0;
            html.push(`<tr><td>${b.exerciseName}</td><td>${GROUP_RU[b.muscle] ?? b.muscle}</td><td>${setsStr}</td><td>${rir}</td><td>${wt} кг</td></tr>`);
          }
          html.push('</tbody></table>');
        }
      }
    } else if (program.pl) {
      html.push(`<h2>ПЛ-цикл: ${program.pl.sourceCycleId}</h2>`);
      html.push(`<div class="meta">ПМ: присед ${program.pl.workMax.squat ?? '-'} · жим ${program.pl.workMax.bench ?? '-'} · тяга ${program.pl.workMax.dead ?? '-'} кг</div>`);
      if (program.pl.notes) html.push(`<p>${program.pl.notes}</p>`);
    }
    html.push('</body></html>');
    w.document.write(html.join(''));
    w.document.close();
    setTimeout(() => { w.print(); }, 300);
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
          <button style={{ ...BTN_GHOST, padding: '6px 12px', fontSize: 11, minHeight: 38, borderColor: 'rgba(0,230,138,0.4)', color: '#00e68a' }} onClick={autoFillDraft} title="Заполнить черновик на основе цели/уровня/дней">⚡ Авто-черновик</button>
          {/* Загрузить цикл/программу из библиотеки */}
          <button style={{ ...BTN_GHOST, padding: '6px 12px', fontSize: 11, minHeight: 38, borderColor: 'rgba(245,158,11,0.4)', color: '#f59e0b' }}
            onClick={() => {
              if (dir === 'bb') setEditorLibOpen('bb');
              else if (dir === 'pl') setEditorLibOpen('pl');
            }}
            title="Загрузить программу или цикл из библиотеки для редактирования"
          >📥 Загрузить</button>
          {dir === 'bb' && program.bb && (program.bb.weeks?.length ?? 0) >= 4 && (
            <button style={{ ...BTN_GHOST, padding: '6px 12px', fontSize: 11, minHeight: 38, borderColor: 'rgba(96,165,250,0.4)', color: '#60a5fa' }}
              onClick={() => {
                const updated = { ...program.bb!, weeks: applyPhaseModulation(program.bb!.weeks!, { goal: program.meta.goal, level: program.meta.level, weeksTotal: program.meta.weeks || 4 }) };
                update({ bb: updated });
                showToast('📈 Фазовая периодизация применена: RIR/фазы/повторения по неделям');
              }}
              title="Применить фазовую периодизацию (RIR/объём/повторения по неделям)"
            >📈 Применить фазы</button>
          )}
          <button style={{ ...BTN_GHOST, padding: '6px 12px', fontSize: 11, minHeight: 38, borderColor: 'rgba(167,139,250,0.4)', color: '#a78bfa' }}
            onClick={() => setEditorLibOpen('methods')}
            title="Справочник тренировочных методик"
          >📚 Методики</button>
          {(dir === 'bb' || dir === 'pl') && (
            <label style={{ fontSize: 11, color: DIM, display: 'flex', alignItems: 'center', gap: 4, marginRight: 4 }}>
              Нед
              <input type="number" style={{ ...IN, padding: '3px 4px', fontSize: 11, width: 38, minHeight: 34, textAlign: 'center' }} value={execWeek} min={1} max={program.meta.weeks} onChange={e => setExecWeek(Math.max(1, Math.min(parseInt(e.target.value) || 1, program.meta.weeks)))} />
            </label>
          )}
          {dir === 'bb' && (
            <button style={{ ...BTN_GHOST, padding: '6px 12px', fontSize: 11, minHeight: 38, borderColor: 'rgba(96,165,250,0.4)', color: '#60a5fa' }} onClick={sendToExecution} title="Отправить к выполнению (he_pl_runtime)">🚚 К выполнению</button>
          )}
          {dir === 'pl' && program.pl && (
            <button style={{ ...BTN_GHOST, padding: '6px 12px', fontSize: 11, minHeight: 38, borderColor: 'rgba(167,139,250,0.4)', color: '#a78bfa' }} onClick={sendToExecution} title="Отправить ПЛ-цикл к выполнению (he_pl_runtime)">🚚 К выполнению</button>
          )}
          <button style={{ ...BTN, padding: '8px 16px', fontSize: 11, minHeight: 38 }} onClick={() => handleSave('Ручная правка')}>💾 Сохранить</button>
          <button style={{ ...BTN_GHOST, padding: '6px 12px', fontSize: 11, minHeight: 38, borderColor: 'rgba(167,139,250,0.4)', color: '#a78bfa' }} onClick={printProgram} title="Печать / сохранить в PDF">🖨 PDF</button>
        </div>
      </div>

      {/* P4 — контекстные панели (НЕ калькуляторы): отображают статус текущей программы */}
      {dir === 'bb' && program.bb && <BbContextPanel program={program} level={program.meta.level} />}
      {dir === 'pl' && program.pl && <PLContextPanel program={program} />}

      {/* Единый профиль тренированности: ПМ, workMax, weakPoints, оборудование, курс —
          авто-черновик и SMART-рекомендации читают эти данные. */}
      <TrainingProfileCard profile={tprofile} update={updateTProfile} compact />

      {/* Лабораторная коррекция плана: MRV× + предупреждения по анализам */}
      {labAdjust.mrvMultiplier < 1 && (() => {
        const prof = loadTrainingProfile();
        const feeders = suggestFeeders((prof.weakPoints ?? []) as string[], (prof.equipment ?? []) as string[]);
        return (
          <div style={{ ...panelStyle('#f59e0b'), padding: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', marginBottom: 4 }}>
              🧪 Лабораторная коррекция плана (MRV ×{labAdjust.mrvMultiplier.toFixed(2)})
            </div>
            {labAdjust.intensityNote && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', marginBottom: 4 }}>{labAdjust.intensityNote}</div>}
            {labAdjust.warnings.length > 0 && (
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', lineHeight: 1.45 }}>
                {labAdjust.warnings.map((w, i) => <div key={i}>• {w}</div>)}
              </div>
            )}
            {labAdjust.deloadRecommended && (
              <div style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', marginTop: 4 }}>⚠ Рекомендуется разгрузочная неделя</div>
            )}
            {feeders.length > 0 && (
              <div style={{ fontSize: 10, color: '#a78bfa', marginTop: 6, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 6 }}>
                🔥 Фидер-сеты для слабых групп: {feeders.map((f) => `${f.exercise} ${f.sets}×${f.reps}`).join(' · ')}
              </div>
            )}
          </div>
        );
      })()}

      <DiagnosticPanel program={program} dir={dir} onChange={onChange} showToast={showToast} labMrvMult={labAdjust.mrvMultiplier} />
      <VolumeLandmarksPanel program={program} dir={dir} onChange={onChange} showToast={showToast} labMrvMult={labAdjust.mrvMultiplier} />
      <PhaseLegend weeks={program.meta.weeks} goal={program.meta.goal} level={program.meta.level} />
      <ExerciseInfo program={program} dir={dir} />
      <RecommendationsPanel program={program} dir={dir} onChange={onChange} showToast={showToast} labMrvMult={labAdjust.mrvMultiplier} />
      <ProgressionCoach program={program} dir={dir} onChange={onChange} showToast={showToast} labMrvMult={labAdjust.mrvMultiplier} onCourse={tprofile.onCourse ?? false} courseIntensity={tprofile.courseIntensity ?? 'moderate'} />
      <SplitConsultant program={program} dir={dir} onChange={onChange} showToast={showToast} labMrvMult={labAdjust.mrvMultiplier} />

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
              <span style={{ fontSize: 11, color: DIM, marginLeft: 6, fontWeight: 500 }}>
                (по плану текущей редактируемой программы)
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(52px, 1fr))', gap: 4 }}>
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
                    <div style={{ fontSize: 11, fontWeight: 700, color: d ? '#00e68a' : DIM }}>{day}</div>
                    {d ? (
                      <>
                        <div style={{ fontSize: 10, color: DIM_STRONG, marginTop: 4, fontWeight: 600 }}>{d.label}</div>
                        <div style={{ fontSize: 10, color: DIM, marginTop: 2, lineHeight: 1.2 }}>
                          {d.muscles.filter((m) => m !== '—').slice(0, 2).map((m, mi) => (
                            <span key={mi} style={{
                              display: 'inline-block', padding: '2px 5px', marginRight: 2,
                              borderRadius: 3, fontSize: 10,
                              background: (groupColors[m] ?? '#888') + '20',
                              color: groupColors[m] ?? '#fff',
                            }}>{GROUP_RU[m] ?? m}</span>
                          )) ?? null}
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: 10, color: DIM, marginTop: 12, fontStyle: 'italic' }}>отдых</div>
            )}
            {editorLibOpen === 'methods' && (() => {
              const allM = getTrainingMethods();
              const cats = [...new Set(allM.map(m => m.category))];
              const f2 = allM.filter(m => (methCat === 'all' || m.category === methCat) && (!methSearch || m.name.toLowerCase().includes(methSearch.toLowerCase()))).slice(0, 30);
              return (
                <div>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
                    <input style={{ ...IN, flex: 1, padding: '6px 10px', fontSize: 11, minHeight: 38 }} value={methSearch} onChange={e => setMethSearch(e.target.value)} placeholder="🔍 Поиск методик..." />
                    <select style={{ ...IN, fontSize: 11, minHeight: 38 }} value={methCat} onChange={e => setMethCat(e.target.value)}><option value="all">Все ({allM.length})</option>{cats.map(c => <option key={c} value={c}>{c}</option>)}</select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '55vh', overflow: 'auto' }}>
                    {f2.map((m, i) => (
                      <div key={i} style={{ padding: 10, borderRadius: 10, background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.12)', fontSize: 11 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span style={{ fontWeight: 800, color: DIM_STRONG }}>{m.name}</span>
                          <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: m.evidenceLevel === 'A' ? 'rgba(34,197,94,0.15)' : m.evidenceLevel === 'B' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)', color: m.evidenceLevel === 'A' ? '#22c55e' : m.evidenceLevel === 'B' ? '#f59e0b' : '#ef4444' }}>{m.evidenceLevel}</span>
                          <span style={{ fontSize: 9, color: DIM }}>{m.category}</span>
                        </div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>{m.description}</div>
                        <div style={{ fontSize: 10, color: DIM }}>{m.howItWorks}</div>
                        {m.example && <div style={{ fontSize: 9, color: DIM, marginTop: 2 }}>📋 {m.example}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 10, color: DIM, marginTop: 6, fontStyle: 'italic' }}>
              Шаблон недели повторяется для всех мезоциклов. Делод-недели должны быть явно отмечены флагом «deload» в структуре.
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

      {/* P2 — LIVE Quality Panel: оценка 0-100 и конкретные правки (BB + PL). */}
      {(dir === 'bb' && program.bb || dir === 'pl' && program.pl?.customWeeks) && (() => {
        const prof = loadTrainingProfile();
        const q = computePlanQualityFor(program, program.meta.level, {
          onCourse: prof.onCourse ?? false,
          courseIntensity: prof.courseIntensity ?? 'moderate',
          labMult: labAdjust.mrvMultiplier,
        });
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 6 }}>
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
                  style={{ padding: '8px 14px', borderRadius: 8, fontSize: 11, cursor: 'pointer', background: 'rgba(167,139,250,0.10)', border: '1px solid rgba(167,139,250,0.25)', color: '#a78bfa', fontWeight: 700, minHeight: 38 }}
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
                  style={{ padding: '8px 14px', borderRadius: 8, fontSize: 11, cursor: 'pointer', background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.25)', color: '#22c55e', fontWeight: 700, minHeight: 38 }}
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
                    const template = weeks[0]?.sessions ?? [];
                    const progression = 1 + (n - 1) * 0.025; // +2.5% за каждую неделю
                    weeks.push({ week: n, phase: 'accumulation', deload: n % 4 === 0, sessions: template.map(s => ({ ...s, id: newId('ses'), blocks: s.blocks.map(b => ({ ...b, id: newId('blk'), sets: b.sets.map(st => ({ ...st, weight: st.weight ? Math.round(st.weight * progression / 2.5) * 2.5 : st.weight })) })) })) });
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

      {/* Библиотека — модальное окно внутри редактора */}
      {editorLibOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
          <div style={{ background: '#18181b', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', maxWidth: 700, width: '100%', maxHeight: '85vh', overflow: 'auto', padding: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: ACCENT }}>📚 {editorLibOpen === 'bb' ? 'Библиотека программ' : editorLibOpen === 'pl' ? 'Проф. ПЛ-циклы' : 'Справочник методик'}</span>
              <button style={{ ...BTN_GHOST, padding: '6px 12px', fontSize: 11, minHeight: 38 }} onClick={() => setEditorLibOpen(null)}>✕ Закрыть</button>
            </div>
            {editorLibOpen === 'bb' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '60vh', overflow: 'auto' }}>
                {libraryPrograms.map(pr => (
                  <button key={pr.id ?? pr.name} onClick={() => loadIntoEditor(cloneFromLibrary(pr))}
                    style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 10, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.18)', color: DIM_STRONG, cursor: 'pointer', fontSize: 11 }}>
                    <div style={{ fontWeight: 700 }}>{pr.name}</div>
                    <div style={{ fontSize: 10, color: DIM }}>{pr.author} · {pr.goal} · {pr.daysPerWeek}д/нед · {pr.durationWeeks}нед</div>
                  </button>
                ))}
              </div>
            )}
            {editorLibOpen === 'pl' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '60vh', overflow: 'auto' }}>
                {plCycleList.map(c => (
                  <button key={c.meta.id} onClick={() => loadCycleIntoEditor(c.meta.id)}
                    style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 10, background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.18)', color: DIM_STRONG, cursor: 'pointer', fontSize: 11 }}>
                    <div style={{ fontWeight: 700 }}>{c.meta.title}</div>
                    <div style={{ fontSize: 10, color: DIM }}>{c.meta.sessionsPerWeek}д/нед · {c.meta.weeks} нед · {c.meta.level} · {c.meta.period}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
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
      {dir === 'hybrid' && program.hybrid && (
        <>
          <div style={{ ...CARD, padding: 10, borderLeft: '3px solid #3b82f6', background: 'rgba(59,130,246,0.06)' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#3b82f6' }}>⚡ Powerbuilder (Hybrid)</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>Гибрид ПЛ+ББ в активной разработке. Редактируйте ПЛ и ББ части независимо.</div>
          </div>
          <HybridPlanPanel program={program} onChange={(hybrid) => update({ hybrid })} onSave={onSave} />
        </>
      )}

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