import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type MacrocycleDesign,
  type DesignStats,
  type DesignerPhaseBlock,
  type PhaseKey,
  type DesignerDiscipline,
  PHASE_COLORS,
  PHASE_ICONS,
  PHASE_LABELS_RU,
  sportToDiscipline,
  getAllowedPhaseKeysForDiscipline,
  createEmptyDesignForDiscipline,
  loadDesigns,
  saveDesign,
  deleteDesign,
  addBlockToDesign,
  removeBlockFromDesign,
  moveBlockInDesign,
  resizeBlockInDesign,
  updateBlockNotes,
  changeBlockPhase,
  duplicateBlockInDesign,
  setDesignTotalWeeks,
  getDesignVolumeCurve,
  getDesignStats,
  resolveDesignOverlaps,
  getPLPresetDesigns,
  getBBPresetDesigns,
  getPresetsForDiscipline,
} from '../../../engines/periodization-designer.engine';
import { applyToPlanner } from './planner-bridge';
import { DESIGNER_PHASE_VISUAL } from './phase-visual-tokens';
import { useConfirmDialog } from './ConfirmDialog';
import { linkDesignToProgram } from '../../../engines/periodization/designer-to-program';
import { loadUserPrograms, saveUserProgram } from '../../../engines/user-program/program-store';
import type { UserProgram } from '../../../engines/user-program/user-program.types';

const ACCENT = '#00e68a';
const ACCENT_PL = '#3b82f6';
const ACCENT_BB = '#ec4899';
const DIM = 'rgba(255,255,255,0.5)';
const CARD: React.CSSProperties = { padding: 14, borderRadius: 12, background: 'rgba(24,24,27,0.4)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 12 };

const btn: React.CSSProperties = { padding: '6px 12px', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#fff', minHeight: 38 };

export const PeriodizationDesignerTab: React.FC = () => {
  const [designs, setDesigns] = useState<MacrocycleDesign[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [editBlockId, setEditBlockId] = useState<string | null>(null);
  const [dragPhase, setDragPhase] = useState<PhaseKey | null>(null);
  const [viewQuarter, setViewQuarter] = useState(0);
  const pastRef = useRef<MacrocycleDesign[]>([]);
  const futureRef = useRef<MacrocycleDesign[]>([]);
  const [, setHistoryTick] = useState(0);
  const touchPhaseRef = useRef<PhaseKey | null>(null);
  const touchTimerRef = useRef<number | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [touchActive, setTouchActive] = useState(false);
  const { confirm } = useConfirmDialog();
  const [programs, setPrograms] = useState<UserProgram[]>([]);
  const [linkProgramId, setLinkProgramId] = useState('');
  const [linkMsg, setLinkMsg] = useState('');
  // ── ПЛ / ББ дисциплина ─────────────────────
  const [activeDiscipline, setActiveDiscipline] = useState<DesignerDiscipline>('pl');
  const [isMobile, setIsMobile] = useState(false);
  const [viewMode, setViewMode] = useState<'timeline' | 'list'>('timeline');
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const check = () => {
      const m = typeof window !== 'undefined' ? window.innerWidth < 560 : false;
      setIsMobile(m);
      if (m) setViewMode(prev => prev); // keep user choice
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    try { setPrograms(loadUserPrograms()); } catch { setPrograms([]); }
    let list = loadDesigns();
    // Авто-создание демо-дизайна если пусто — чтобы не было ощущения "ничего нет"
    if (list.length === 0) {
      try {
        let demo = createEmptyDesignForDiscipline(activeDiscipline);
        const starter: PhaseKey = activeDiscipline === 'pl' ? 'gpp' : 'accumulation_hypertrophy';
        demo = addBlockToDesign(demo, starter, 1);
        // второй блок для наглядности
        const second: PhaseKey = activeDiscipline === 'pl' ? 'accumulation_strength' : 'intensification';
        const secondStart = demo.blocks[0] ? demo.blocks[0].endWeek + 1 : 4;
        if (secondStart <= demo.totalWeeks) demo = addBlockToDesign(demo, second, secondStart);
        demo.name = activeDiscipline === 'pl' ? 'Демо ПЛ — старт' : 'Демо ББ — старт';
        saveDesign(demo);
        list = [demo];
      } catch { /* ignore */ }
    }
    setDesigns(list);
    if (list.length > 0 && !currentId) setCurrentId(list[0].id);
  }, []);

  const current = useMemo(() => designs.find(d => d.id === currentId) || null, [designs, currentId]);

  // синхронизируем сегмент с дизайном
  useEffect(() => {
    if (current) {
      const d = sportToDiscipline(current.sport);
      setActiveDiscipline(d);
    }
  }, [current?.sport]);

  const effectiveDiscipline: DesignerDiscipline = current ? sportToDiscipline(current.sport) : activeDiscipline;
  const allowedKeys = useMemo(() => getAllowedPhaseKeysForDiscipline(effectiveDiscipline), [effectiveDiscipline]);
  const allowedSet = useMemo(() => new Set<PhaseKey>(allowedKeys as PhaseKey[]), [allowedKeys]);

  const refresh = useCallback(() => {
    const list = loadDesigns();
    setDesigns(list);
  }, []);

  const commitDesign = useCallback((updated: MacrocycleDesign) => {
    if (current) pastRef.current = [...pastRef.current, JSON.parse(JSON.stringify(current))].slice(-20);
    futureRef.current = [];
    saveDesign(updated);
    refresh();
    setHistoryTick(tick => tick + 1);
  }, [current, refresh]);

  useEffect(() => {
    pastRef.current = [];
    futureRef.current = [];
    setHistoryTick(tick => tick + 1);
  }, [currentId]);

  const undo = useCallback(() => {
    if (!current || pastRef.current.length === 0) return;
    const previous = pastRef.current[pastRef.current.length - 1];
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [JSON.parse(JSON.stringify(current)), ...futureRef.current].slice(0, 20);
    saveDesign(previous);
    refresh();
    setHistoryTick(tick => tick + 1);
  }, [current, refresh]);

  const redo = useCallback(() => {
    if (!current || futureRef.current.length === 0) return;
    const next = futureRef.current[0];
    futureRef.current = futureRef.current.slice(1);
    pastRef.current = [...pastRef.current, JSON.parse(JSON.stringify(current))].slice(-20);
    saveDesign(next);
    refresh();
    setHistoryTick(tick => tick + 1);
  }, [current, refresh]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return;
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) return;
      event.preventDefault();
      if (event.shiftKey) redo(); else undo();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [redo, undo]);

  const stats: DesignStats | null = useMemo(() => current ? getDesignStats(current) : null, [current]);

  const handleResize = useCallback((blockId: string, newEnd: number) => {
    if (!current) return;
    const updated = resizeBlockInDesign(current, blockId, newEnd);
    commitDesign(updated);
  }, [current, commitDesign]);

  const handleDeleteBlock = useCallback((blockId: string) => {
    if (!current) return;
    const updated = removeBlockFromDesign(current, blockId);
    commitDesign(updated);
  }, [current, commitDesign]);

  const handleMoveBlock = useCallback((blockId: string, newStart: number) => {
    if (!current) return;
    const updated = moveBlockInDesign(current, blockId, newStart);
    commitDesign(updated);
  }, [current, commitDesign]);

  const handleResolveOverlaps = useCallback(() => {
    if (!current) return;
    commitDesign(resolveDesignOverlaps(current));
  }, [current, commitDesign]);

  const handleSetTotalWeeks = useCallback((weeks: number) => {
    if (!current) return;
    const updated = setDesignTotalWeeks(current, weeks);
    commitDesign(updated);
    // если квартёр вышел за границу — вернём
    const newCount = Math.max(1, Math.ceil(updated.totalWeeks / weeksPerQuarter));
    if (viewQuarter >= newCount) setViewQuarter(Math.max(0, newCount - 1));
  }, [current, commitDesign, viewQuarter, weeksPerQuarter]);

  const handleDuplicateBlock = useCallback((blockId: string) => {
    if (!current) return;
    commitDesign(duplicateBlockInDesign(current, blockId));
  }, [current, commitDesign]);

  const handleChangeBlockPhase = useCallback((blockId: string, newPhase: PhaseKey) => {
    if (!current) return;
    if (!allowedSet.has(newPhase)) return;
    commitDesign(changeBlockPhase(current, blockId, newPhase));
  }, [current, commitDesign, allowedSet]);

  const handleDropOnCanvas = useCallback((weekNum: number, phaseKey: PhaseKey) => {
    if (!current) return;
    if (!allowedSet.has(phaseKey)) return;
    const updated = addBlockToDesign(current, phaseKey, weekNum);
    commitDesign(updated);
    setDragPhase(null);
  }, [current, commitDesign, allowedSet]);

  const handleAddPreset = useCallback((preset: MacrocycleDesign) => {
    saveDesign(preset);
    refresh();
    setCurrentId(preset.id);
  }, [refresh]);

  const handleNewDesign = useCallback(() => {
    let d = createEmptyDesignForDiscipline(activeDiscipline);
    const starter: PhaseKey = activeDiscipline === 'pl' ? 'gpp' : 'accumulation_hypertrophy';
    d = addBlockToDesign(d, starter, 1);
    d.name = activeDiscipline === 'pl' ? 'Новый ПЛ-макроцикл' : 'Новый ББ-макроцикл';
    saveDesign(d);
    refresh();
    setCurrentId(d.id);
  }, [refresh, activeDiscipline]);

  const handleNewDesignForDiscipline = useCallback((disc: DesignerDiscipline) => {
    let d = createEmptyDesignForDiscipline(disc);
    // Быстрый старт: один базовый блок, чтобы таймлайн сразу не был пустым
    const starter: PhaseKey = disc === 'pl' ? 'gpp' : 'accumulation_hypertrophy';
    d = addBlockToDesign(d, starter, 1);
    // Подганиваем имя
    d.name = disc === 'pl' ? 'Новый ПЛ-макроцикл' : 'Новый ББ-макроцикл';
    saveDesign(d);
    refresh();
    setCurrentId(d.id);
    setActiveDiscipline(disc);
  }, [refresh]);

  const handleDeleteDesign = useCallback(() => {
    if (!current) return;
    deleteDesign(current.id);
    refresh();
    setCurrentId(null);
  }, [current, refresh]);

  const handleSaveName = useCallback((name: string) => {
    if (!current) return;
    const updated = { ...current, name };
    commitDesign(updated);
  }, [current, commitDesign]);

  const handleDuplicate = useCallback(() => {
    if (!current) return;
    const dup: MacrocycleDesign = {
      ...JSON.parse(JSON.stringify(current)),
      id: 'design_' + Date.now(),
      name: current.name + ' (копия)',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveDesign(dup);
    refresh();
    setCurrentId(dup.id);
  }, [current, refresh]);

  const handleSaveSport = useCallback((sport: MacrocycleDesign['sport']) => {
    if (!current) return;
    const updated = { ...current, sport, updatedAt: new Date().toISOString() };
    commitDesign(updated);
  }, [current, commitDesign]);

  const handleDisciplineSwitch = useCallback((disc: DesignerDiscipline) => {
    setActiveDiscipline(disc);
    if (!current) return;
    const targetSport: MacrocycleDesign['sport'] = disc === 'pl' ? 'powerlifting' : 'bodybuilding';
    if (current.sport !== targetSport) {
      handleSaveSport(targetSport);
    }
  }, [current, handleSaveSport]);

  const handleLinkToProgram = useCallback(() => {
    if (!current || !linkProgramId) return;
    const prog = programs.find(p => p.meta.id === linkProgramId);
    if (!prog) { setLinkMsg('⚠ Программа не найдена — сначала сохраните её в ручном конструкторе'); return; }
    const linked = linkDesignToProgram(prog, current);
    try {
      saveUserProgram(linked, 'Привязка дизайна периодизации');
      setLinkMsg(`🔗 Привязано к «${linked.meta.title}» — в редакторе появится карточка дизайна (шаг «Недели»)`);
    } catch {
      setLinkMsg('⚠ Не удалось сохранить программу');
    }
  }, [current, linkProgramId, programs]);

  const editBlock = useMemo(() => {
    if (!editBlockId || !current) return null;
    return current.blocks.find(b => b.id === editBlockId) || null;
  }, [editBlockId, current]);

  // Viewport for the timeline — адаптив
  const weeksPerQuarter = isMobile ? 8 : 13;
  const quarterCount = Math.max(1, Math.ceil((current?.totalWeeks || 52) / weeksPerQuarter));
  const quarterStart = viewQuarter * weeksPerQuarter + 1;
  const quarterEnd = Math.min(quarterStart + weeksPerQuarter - 1, current?.totalWeeks || 52);

  useEffect(() => {
    if (viewQuarter >= quarterCount) setViewQuarter(Math.max(0, quarterCount - 1));
  }, [quarterCount, viewQuarter]);

  // пресеты под дисциплину
  const plPresets = useMemo(() => getPLPresetDesigns(), []);
  const bbPresets = useMemo(() => getBBPresetDesigns(), []);
  const currentPresets = effectiveDiscipline === 'pl' ? plPresets : bbPresets;

  // несовместимые фазы в текущем дизайне
  const incompatibleBlocks = useMemo(() => {
    if (!current) return [] as DesignerPhaseBlock[];
    return current.blocks.filter(b => !allowedSet.has(b.phaseKey));
  }, [current, allowedSet]);

  const accent = effectiveDiscipline === 'pl' ? ACCENT_PL : ACCENT_BB;
  const disciplineLabel = effectiveDiscipline === 'pl' ? 'Пауэрлифтинг' : 'Бодибилдинг';
  const disciplineIcon = effectiveDiscipline === 'pl' ? '🏋️' : '💪';
  const disciplineHint = effectiveDiscipline === 'pl'
    ? 'Сила · техника · взрыв (DE) · пик к помосту'
    : 'Масса · памп · сушка · пик формы';

  return (
    <div className="manual-constructor periodization-designer" style={{ maxWidth: 860, margin: '0 auto', padding: 12, color: '#fff' }}>
      <style>{`
        .periodization-designer * { box-sizing: border-box; }
        .pd-segment { display:flex; gap:4px; padding:4px; border-radius:12px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06);}
        .pd-seg-btn { flex:1; padding:10px 12px; border-radius:10px; font-size:12px; font-weight:800; cursor:pointer; border:1px solid transparent; transition:all .18s; min-height:44px; display:flex; align-items:center; justify-content:center; gap:6px; }
        .pd-seg-btn.active-pl { background:linear-gradient(135deg,#3b82f6,#1e40af); color:#fff; border-color:rgba(59,130,246,0.5); box-shadow:0 4px 14px rgba(59,130,246,0.3); }
        .pd-seg-btn.active-bb { background:linear-gradient(135deg,#ec4899,#be185d); color:#fff; border-color:rgba(236,72,153,0.5); box-shadow:0 4px 14px rgba(236,72,153,0.3); }
        .pd-seg-btn.idle { background:rgba(255,255,255,0.04); color:${DIM}; border-color:rgba(255,255,255,0.06); }
        .pd-palette-chip { min-height:44px; padding:8px 12px; border-radius:10px; font-size:11px; font-weight:700; cursor:grab; display:flex; align-items:center; gap:6px; user-select:none; touch-action:none; transition:transform .12s, box-shadow .12s; }
        .pd-timeline-scroll { overflow-x:auto; -webkit-overflow-scrolling:touch; scrollbar-width:thin; }
        .pd-timeline-scroll::-webkit-scrollbar { height:6px; }
        .pd-timeline-scroll::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.12); border-radius:4px; }
        .pd-week-cell { width:36px; flex-shrink:0; text-align:center; font-size:10px; color:${DIM}; }
        @media (max-width: 560px) {
          .periodization-designer { padding:8px !important; }
          .pd-week-cell { width:34px; }
          .pd-palette-chip { font-size:11px; padding:10px 12px; }
          .pd-card-mobile { padding:12px !important; }
          .pd-header-row { flex-direction:column; align-items:stretch !important; }
          .pd-header-actions { width:100%; justify-content:space-between; }
          .pd-quarter-nav button, .pd-quarter-nav select { min-height:44px; }
        }
      `}</style>

      {/* Header + дисциплина */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 17, fontWeight: 900, color: accent, letterSpacing: -0.2 }}>🎨 Дизайнер периодизации</span>
            <span style={{ fontSize: 10, padding: '4px 8px', borderRadius: 8, background: accent + '18', border: '1px solid ' + accent + '33', color: accent, fontWeight: 700 }}>{disciplineIcon} {disciplineLabel}</span>
          </div>
          <div style={{ fontSize: 10, color: DIM, lineHeight: 1.4, maxWidth: 320 }}>{disciplineHint}</div>
        </div>

        {/* Сегмент ПЛ / ББ */}
        <div className="pd-segment" role="tablist" aria-label="Дисциплина периодизации">
          <button
            role="tab"
            aria-selected={effectiveDiscipline === 'pl'}
            onClick={() => handleDisciplineSwitch('pl')}
            className={`pd-seg-btn ${effectiveDiscipline === 'pl' ? 'active-pl' : 'idle'}`}
            style={{}}
          >🏋️ ПЛ <span style={{ opacity: effectiveDiscipline === 'pl' ? 0.9 : 0.6, fontWeight: 600 }}>Пауэрлифтинг</span></button>
          <button
            role="tab"
            aria-selected={effectiveDiscipline === 'bb'}
            onClick={() => handleDisciplineSwitch('bb')}
            className={`pd-seg-btn ${effectiveDiscipline === 'bb' ? 'active-bb' : 'idle'}`}
          >💪 ББ <span style={{ opacity: effectiveDiscipline === 'bb' ? 0.9 : 0.6, fontWeight: 600 }}>Бодибилдинг</span></button>
        </div>
        <div style={{ fontSize: 10, color: DIM, marginTop: 6, lineHeight: 1.4 }}>
          {effectiveDiscipline === 'pl'
            ? 'Периоды ПЛ: GPP → Накопление (сила) → Интенсификация → Мощностной/DE → Пик → Разгрузка → Техника → Переход. Без гипертрофийных “памп”-блоков ББ.'
            : 'Периоды ББ: GPP → Накопление (гипертрофия) → Накопление (сила) → Интенсификация → Кондиционный/памп → Пик → Разгрузка → Переход. Без техники/скоростных блоков ПЛ.'}
        </div>
        <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
          <button onClick={() => setShowHelp(v => !v)} style={{ ...btn, minHeight: 36, fontSize: 11, background: showHelp ? accent+'18' : 'rgba(255,255,255,0.04)', borderColor: showHelp ? accent+'44' : 'rgba(255,255,255,0.08)', color: showHelp ? accent : DIM }}>
            {showHelp ? '✕ Скрыть справку' : '❓ Как пользоваться'}
          </button>
          <span style={{ fontSize: 10, color: DIM, alignSelf: 'center', lineHeight: 1.3 }}>{isMobile ? 'Тап по фазе → тап по неделе — быстрый ввод' : 'Drag&Drop фазы на таймлайн, или тап по фазе → клик по неделе'}</span>
        </div>
        {showHelp && (
          <div style={{ marginTop: 8, padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', fontSize: 11, lineHeight: 1.5, color: 'rgba(255,255,255,0.85)' }}>
            <div style={{ fontWeight: 800, color: '#fff', marginBottom: 6 }}>📱 Телефон: зажмите фазу 0.35с → вибрация → перетащите на неделю (или тап фаза → тап неделя)</div>
            <div>• <b>ПЛ</b>: GPP база → сила → DE/скорость → пик к помосту · <b>ББ</b>: гипертрофия объём → интенс → памп → пик формы</div>
            <div>• Таймлайн — кварталы по {isMobile ? 8 : 13} нед, свайп/кнопки ◀▶ · Список — удобно на узком экране</div>
            <div>• Тап по блоку — редактирование: длительность, сдвиг, смена фазы, дублирование, заметки</div>
            <div>• <b>Длительность</b> — слайдер 8-52 нед, чипы 12/16/24/52 · <b>Компакт</b> — убирает наложения</div>
            <div>• Применить — создаёт программу в ручном конструкторе (скелет или с упражнениями)</div>
          </div>
        )}
      </div>

      {/* Верх: выбор дизайна + действия */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }} className="pd-header-row">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }} className="pd-header-actions">
          <button onClick={() => handleNewDesignForDiscipline(effectiveDiscipline)} style={{ ...btn, background: accent + '14', borderColor: accent + '55', color: accent, minHeight: 44 }}>➕ Новый {effectiveDiscipline === 'pl' ? 'ПЛ' : 'ББ'}</button>
          <select value={currentId || ''} onChange={e => setCurrentId(e.target.value || null)} style={{ ...btn, padding: '10px 10px', background: 'rgba(24,24,27,0.6)', fontSize: 11, minHeight: 44, maxWidth: 260 }}>
            <option value="">— выберите дизайн —</option>
            {designs
              .filter(d => sportToDiscipline(d.sport) === effectiveDiscipline || d.sport === 'general')
              .map(d => <option key={d.id} value={d.id}>{d.name} ({d.blocks.length} бл · {d.totalWeeks} нед)</option>)}
            {designs.filter(d => sportToDiscipline(d.sport) !== effectiveDiscipline && d.sport !== 'general').length > 0 && (
              <optgroup label={`— другие (${effectiveDiscipline === 'pl' ? 'ББ' : 'ПЛ'}) —`}>
                {designs.filter(d => sportToDiscipline(d.sport) !== effectiveDiscipline && d.sport !== 'general').map(d => <option key={d.id} value={d.id}>{d.name} [{d.sport}]</option>)}
              </optgroup>
            )}
          </select>
          {current && <button onClick={handleDeleteDesign} style={{ ...btn, color: '#ef4444', minHeight: 44, minWidth: 44 }}>🗑</button>}
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: DIM }}>{designs.filter(d => sportToDiscipline(d.sport) === effectiveDiscipline).length} {effectiveDiscipline === 'pl' ? 'ПЛ' : 'ББ'} · {designs.length} всего</span>
        </div>
      </div>

      {!current && (
        <div className="constructor-surface pd-card-mobile" style={CARD}>
          <div style={{ fontSize: 36, textAlign: 'center', marginBottom: 8 }}>{effectiveDiscipline === 'pl' ? '🏋️' : '💪'}</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', marginBottom: 6, textAlign: 'center' }}>
            {effectiveDiscipline === 'pl' ? 'Создайте ПЛ-дизайн: GPP → сила → пик' : 'Создайте ББ-дизайн: масса → интенсификация → сушка'}
          </div>
          <div style={{ fontSize: 11, color: DIM, marginBottom: 12, textAlign: 'center', lineHeight: 1.45 }}>
            {effectiveDiscipline === 'pl'
              ? 'ПЛ использует технику и мощностной блоки (DE/speed) — гипертрофийный памп исключён.'
              : 'ББ использует гипертрофию и кондиционный памп — техника/скоростные блоки ПЛ исключены.'}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={() => handleNewDesignForDiscipline(effectiveDiscipline)} style={{ ...btn, background: accent + '16', borderColor: accent + '55', color: accent, minHeight: 44 }}>
              ➕ Пустой {effectiveDiscipline === 'pl' ? 'ПЛ' : 'ББ'} дизайн
            </button>
            <button onClick={() => {
              const first = getPresetsForDiscipline(effectiveDiscipline)[0];
              if (first) handleAddPreset(first);
            }} style={{ ...btn, background: accent + '22', borderColor: accent + '66', color: accent, minHeight: 44, fontWeight: 800 }}>
              ⚡ Быстрый старт
            </button>
          </div>
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#fff', marginBottom: 8, textAlign: 'center' }}>📋 Готовые пресеты — {disciplineLabel} · тап чтобы загрузить</div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8 }}>
              {getPresetsForDiscipline(effectiveDiscipline).map((p) => (
                <button key={p.name} onClick={() => handleAddPreset(p)} style={{ ...btn, background: effectiveDiscipline === 'pl' ? 'rgba(59,130,246,0.08)' : 'rgba(236,72,153,0.08)', borderColor: effectiveDiscipline === 'pl' ? 'rgba(59,130,246,0.25)' : 'rgba(236,72,153,0.25)', color: effectiveDiscipline === 'pl' ? '#60a5fa' : '#f472b6', minHeight: 64, textAlign: 'left', lineHeight: 1.3, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontWeight: 800, fontSize: 12 }}>{p.name}</span><br />
                    <span style={{ fontSize: 10, opacity: 0.75 }}>{p.totalWeeks} нед · {p.blocks.length} фаз · {p.blocks.map(b=>PHASE_ICONS[b.phaseKey]).join(' ')}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 2, height: 6 }}>
                    {p.blocks.map((b, i) => (
                      <div key={i} style={{ flex: b.endWeek - b.startWeek + 1, background: PHASE_COLORS[b.phaseKey], borderRadius: 2, minWidth: 6 }} />
                    ))}
                  </div>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
              <button onClick={() => {
                const all = [...getPLPresetDesigns(), ...getBBPresetDesigns()];
                all.forEach(p => saveDesign(p));
                refresh();
              }} style={{ ...btn, minHeight: 38, color: DIM }}>📚 Загрузить все пресеты (ПЛ+ББ)</button>
            </div>
          </div>
        </div>
      )}

      {current && (
        <>
          {/* Design info */}
          <div className="constructor-surface pd-card-mobile" style={{ ...CARD, borderLeft: `3px solid ${accent}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
              <input value={current.name} onChange={e => handleSaveName(e.target.value)}
                style={{ background: 'transparent', border: 'none', borderBottom: '1px dashed rgba(255,255,255,0.2)', color: '#fff', fontSize: 15, fontWeight: 800, flex: 1, minWidth: 180, outline: 'none', paddingBottom: 4 }} />
              <span style={{ fontSize: 11, color: DIM, whiteSpace: 'nowrap', background: 'rgba(255,255,255,0.04)', padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>{current.totalWeeks} нед · {current.blocks.length} бл</span>
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              <button onClick={undo} disabled={pastRef.current.length === 0} style={{ ...btn, minHeight: 44, opacity: pastRef.current.length > 0 ? 1 : 0.4, flex: 1 }}>↶ Отменить</button>
              <button onClick={redo} disabled={futureRef.current.length === 0} style={{ ...btn, minHeight: 44, opacity: futureRef.current.length > 0 ? 1 : 0.4, flex: 1 }}>↷ Повторить</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: DIM, fontWeight: 700 }}>Режим:</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: accent, padding: '6px 10px', borderRadius: 8, background: accent + '14', border: '1px solid ' + accent + '33' }}>{disciplineIcon} {disciplineLabel}</span>
              <span style={{ fontSize: 10, color: DIM }}>{current.blocks.length} фаз · {disciplineHint}</span>
            </div>
            {incompatibleBlocks.length > 0 && (
              <div role="alert" style={{ marginBottom: 10, padding: 10, borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.22)', fontSize: 11, lineHeight: 1.45 }}>
                <div style={{ fontWeight: 800, color: '#ef4444', marginBottom: 4 }}>⚠ {incompatibleBlocks.length} блок(ов) не из набора {disciplineLabel}</div>
                <div style={{ color: 'rgba(255,255,255,0.85)', marginBottom: 6 }}>
                  {incompatibleBlocks.map(b => `${PHASE_ICONS[b.phaseKey]} ${PHASE_LABELS_RU[b.phaseKey]} (${b.startWeek}–${b.endWeek})`).join(' · ')}
                </div>
                <div style={{ color: DIM, fontSize: 10 }}>Эти фазы сохранены, но не характерны для {disciplineLabel}. Для чистого плана используйте палитру ниже — лишние можно удалить.</div>
              </div>
            )}
            {/* Длительность */}
            <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#fff' }}>⏱ Длительность — {current.totalWeeks} нед</span>
                <span style={{ fontSize: 10, color: DIM }}>{Math.round(current.totalWeeks/4.3)} мес</span>
              </div>
              <input
                type="range" min={8} max={52} step={1} value={current.totalWeeks}
                onChange={e => handleSetTotalWeeks(parseInt(e.target.value) || 16)}
                style={{ width: '100%', accentColor: accent }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: DIM, marginTop: 2 }}><span>8</span><span>52</span></div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {[12,16,24,32,52].map(w => (
                  <button key={w} onClick={() => handleSetTotalWeeks(w)}
                    style={{ ...btn, minHeight: 38, flex: 1, background: current.totalWeeks===w ? accent+'18' : 'rgba(255,255,255,0.04)', borderColor: current.totalWeeks===w ? accent+'44' : 'rgba(255,255,255,0.08)', color: current.totalWeeks===w ? accent : '#fff', fontWeight: 800 }}>{w}н</button>
                ))}
              </div>
            </div>
            {stats && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11, color: DIM, marginTop: 10 }}>
                <span style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>📊 Занято: <b style={{ color: accent }}>{stats.usedWeeks}</b> нед</span>
                <span style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>🆓 Свободно: <b style={{ color: stats.freeWeeks>0 ? '#f59e0b' : '#22c55e' }}>{stats.freeWeeks}</b> нед</span>
                <span style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>📦 Блоков: <b>{stats.blockCount}</b></span>
                {stats.overlapWeeks>0 && <span style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}>⚠ Перекр {stats.overlapWeeks}н</span>}
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              <button onClick={handleDuplicate} style={{ ...btn, fontSize: 11, minHeight: 44 }}>📋 Дублировать дизайн</button>
              <button onClick={handleResolveOverlaps} disabled={!stats || stats.overlapWeeks===0} style={{ ...btn, fontSize: 11, minHeight: 44, opacity: stats && stats.overlapWeeks>0 ? 1 : 0.4 }}>🧹 Компакт</button>
              <button
                onClick={() => setViewMode(m => m === 'timeline' ? 'list' : 'timeline')}
                style={{ ...btn, fontSize: 11, minHeight: 44, background: viewMode === 'list' ? accent + '18' : 'rgba(255,255,255,0.04)', borderColor: viewMode === 'list' ? accent + '44' : 'rgba(255,255,255,0.08)', color: viewMode === 'list' ? accent : '#fff' }}
              >{viewMode === 'timeline' ? '📋 Список' : '🗓 Таймлайн'}</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: DIM, fontWeight: 700 }}>🔗 К программе:</span>
              <select value={linkProgramId} onChange={e => setLinkProgramId(e.target.value)}
                style={{ background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 10px', fontSize: 11, cursor: 'pointer', minHeight: 44, flex: 1, minWidth: 180 }}>
                <option value="">— выберите программу —</option>
                {programs.map(p => (
                  <option key={p.meta.id} value={p.meta.id}>{p.meta.title} ({p.meta.direction})</option>
                ))}
              </select>
              <button onClick={handleLinkToProgram} disabled={!linkProgramId}
                style={{ ...btn, minHeight: 44, background: 'rgba(0,230,138,0.08)', borderColor: 'rgba(0,230,138,0.3)', color: ACCENT, opacity: linkProgramId ? 1 : 0.4 }}>
                🔗 Привязать
              </button>
            </div>
            {linkMsg && <div style={{ fontSize: 11, color: DIM, marginTop: 6, lineHeight: 1.4 }}>{linkMsg}</div>}
          </div>

          {/* Palette — draggable phase blocks (PL/BB filtered) — sticky на телефоне */}
          <div className="constructor-surface pd-card-mobile" style={{ ...CARD, borderLeft: `3px solid ${accent}`, position: isMobile ? 'sticky' as const : 'relative', top: isMobile ? 4 : undefined, zIndex: isMobile ? 6 : undefined, backdropFilter: isMobile ? 'blur(12px)' : undefined }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 6, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#fff' }}>🎨 Палитра — {disciplineLabel} {effectiveDiscipline === 'pl' ? '(сила/техника/DE)' : '(масса/памп/сушка)'}</div>
              <span style={{ fontSize: 10, color: DIM }}>{allowedKeys.length} фаз</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {allowedKeys.map(pk => {
                const pkTyped = pk as PhaseKey;
                return (
                <div key={pk}
                  draggable
                  role="button"
                  tabIndex={0}
                  aria-label={`Добавить блок ${PHASE_LABELS_RU[pkTyped]}`}
                  onDragStart={() => setDragPhase(pkTyped)}
                  onDragEnd={() => setDragPhase(null)}
                  onClick={() => setDragPhase(previous => previous === pkTyped ? null : pkTyped)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setDragPhase(previous => previous === pkTyped ? null : pkTyped);
                    }
                  }}
                  onTouchStart={(e) => {
                    const touch = e.touches[0];
                    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
                    touchPhaseRef.current = pkTyped;
                    touchTimerRef.current = window.setTimeout(() => {
                      setTouchActive(true);
                      setDragPhase(pkTyped);
                      try { (navigator as any).vibrate?.(15); } catch { /* ignore */ }
                    }, 350);
                  }}
                  onTouchMove={(e) => {
                    if (!touchStartRef.current || !touchTimerRef.current) return;
                    const touch = e.touches[0];
                    const dx = Math.abs(touch.clientX - touchStartRef.current.x);
                    const dy = Math.abs(touch.clientY - touchStartRef.current.y);
                    if (dx > 10 || dy > 10) {
                      window.clearTimeout(touchTimerRef.current);
                      touchTimerRef.current = null;
                      if (!touchActive) touchStartRef.current = null;
                    }
                  }}
                  onTouchEnd={() => {
                    if (touchTimerRef.current) {
                      window.clearTimeout(touchTimerRef.current);
                      touchTimerRef.current = null;
                    }
                    if (touchActive) {
                      // keep dragPhase for drop
                    } else {
                      // tap = select phase for click-to-place
                      setDragPhase(prev => prev === pkTyped ? null : pkTyped);
                    }
                    touchPhaseRef.current = null;
                    touchStartRef.current = null;
                  }}
                  className="pd-palette-chip"
                  style={{
                    background: DESIGNER_PHASE_VISUAL[pkTyped].color + (touchActive && dragPhase === pkTyped ? '44' : '1A'),
                    border: '1px solid ' + DESIGNER_PHASE_VISUAL[pkTyped].color + (dragPhase === pkTyped ? '88' : '38'),
                    color: DESIGNER_PHASE_VISUAL[pkTyped].color,
                    boxShadow: dragPhase === pkTyped ? `0 4px 12px ${DESIGNER_PHASE_VISUAL[pkTyped].color}33` : 'none',
                    transform: touchActive && dragPhase === pkTyped ? 'scale(1.06)' : 'none',
                  }}>
                  <span>{DESIGNER_PHASE_VISUAL[pkTyped].icon}</span>
                  <span>{DESIGNER_PHASE_VISUAL[pkTyped].label}</span>
                  {dragPhase === pkTyped && <span style={{ fontSize: 10, opacity: 0.9, marginLeft: 2 }}>→ тап по неделе</span>}
                </div>
              )})}
            </div>
            <div style={{ fontSize: 10, color: DIM, marginTop: 8, lineHeight: 1.45 }}>
              {effectiveDiscipline === 'pl'
                ? 'ПЛ-палитра: техника и мощностной — скоростная/DE работа, нет “гипертрофия/памп” блоков ББ.'
                : 'ББ-палитра: гипертрофия и кондиционный памп — объём/метабол. стресс, нет техники/скоростных блоков ПЛ.'}
              {dragPhase && <span style={{ color: accent, marginLeft: 6, fontWeight: 700 }}>Выбрано: {PHASE_LABELS_RU[dragPhase]} — тапните по неделе ниже ↓</span>}
            </div>
          </div>

          {/* Timeline canvas / List view */}
          {viewMode === 'timeline' ? (
          <div className="constructor-surface pd-card-mobile pd-timeline-scroll" style={{ ...CARD, padding: 0 }}>
            <div style={{ minWidth: isMobile ? 360 : 420, padding: 12 }}>
              {/* Quarter nav */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginBottom: 10 }} className="pd-quarter-nav">
                <button aria-label="Предыдущий квартал" onClick={() => setViewQuarter(Math.max(0, viewQuarter - 1))} disabled={viewQuarter === 0} style={{ ...btn, minWidth: 44, minHeight: 44, opacity: viewQuarter === 0 ? 0.3 : 1 }}>◀</button>
                <select aria-label="Квартал таймлайна" value={viewQuarter} onChange={e => setViewQuarter(Number(e.target.value))} style={{ ...btn, flex: 1, textAlign: 'center', background: 'rgba(24,24,27,0.6)', minHeight: 44, fontSize: 11, fontWeight: 700 }}>
                  {Array.from({ length: Math.max(1, Math.ceil((current?.totalWeeks || 52) / weeksPerQuarter)) }, (_, quarter) => {
                    const start = quarter * weeksPerQuarter + 1;
                    const end = Math.min(start + weeksPerQuarter - 1, current?.totalWeeks || 52);
                    return <option key={quarter} value={quarter}>Недели {start}–{end} · {weeksPerQuarter} нед</option>;
                  })}
                </select>
                <button aria-label="Следующий квартал" onClick={() => setViewQuarter(Math.min(quarterCount - 1, viewQuarter + 1))} disabled={quarterEnd >= (current?.totalWeeks || 52)} style={{ ...btn, minWidth: 44, minHeight: 44, opacity: quarterEnd >= (current?.totalWeeks || 52) ? 0.3 : 1 }}>▶</button>
              </div>

              {/* Week column headers */}
              <div style={{ display: 'flex', gap: 1, marginBottom: 4 }}>
                <div style={{ width: 38, flexShrink: 0 }} />
                {Array.from({ length: quarterEnd - quarterStart + 1 }, (_, i) => {
                  const wn = quarterStart + i;
                  return <div key={wn} className="pd-week-cell" style={{ width: isMobile ? 34 : 36, fontWeight: dragPhase ? 700 : 400, color: dragPhase ? accent : DIM, background: dragPhase ? accent + '12' : 'transparent', borderRadius: 6, padding: '2px 0' }}>{wn}</div>;
                })}
              </div>

              {/* Block rows */}
              {current.blocks.filter(b => b.startWeek <= quarterEnd && b.endWeek >= quarterStart).length === 0 && (
                <div style={{ padding: 22, textAlign: 'center', color: DIM, fontSize: 11, border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 12, marginTop: 4, background: 'rgba(255,255,255,0.02)' }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>📍</div>
                  Перетащите блоки из палитры {disciplineLabel} на недели {quarterStart}–{quarterEnd}<br />
                  <span style={{ fontSize: 10 }}>или тапните фазу → тап по неделе</span>
                </div>
              )}

              <div style={{ position: 'relative', minHeight: 72 }}>
                {/* Drop zone indicators */}
                {Array.from({ length: quarterEnd - quarterStart + 1 }, (_, i) => {
                  const wn = quarterStart + i;
                  const colW = isMobile ? 34 : 36;
                  return (
                    <div key={wn}
                      onDragOver={e => { e.preventDefault(); }}
                      onClick={() => { if (dragPhase) handleDropOnCanvas(wn, dragPhase); }}
                      onDrop={e => { e.preventDefault(); if (dragPhase) { handleDropOnCanvas(wn, dragPhase); } }}
                      onTouchEnd={() => {
                        if (dragPhase) {
                          handleDropOnCanvas(wn, dragPhase);
                          setTouchActive(false);
                        }
                      }}
                      aria-label={dragPhase ? `Разместить ${PHASE_LABELS_RU[dragPhase]} на неделе ${wn}` : `Неделя ${wn}`}
                      style={{
                        position: 'absolute', left: 38 + i * colW, top: 0, width: colW, height: '100%',
                        background: dragPhase ? accent + '14' : 'transparent',
                        borderLeft: '1px dashed ' + (dragPhase ? accent + '44' : 'rgba(255,255,255,0.10)'),
                        borderRadius: 6,
                        cursor: dragPhase ? 'copy' : 'default',
                        zIndex: 1,
                      }}
                    />
                  );
                })}

                {/* Rendered blocks */}
                {current.blocks.filter(b => b.startWeek <= quarterEnd && b.endWeek >= quarterStart).map(block => {
                  const visStart = Math.max(block.startWeek, quarterStart);
                  const visEnd = Math.min(block.endWeek, quarterEnd);
                  const colW = isMobile ? 34 : 36;
                  const left = (visStart - quarterStart) * colW + 38;
                  const width = (visEnd - visStart + 1) * colW - 3;
                  const color = DESIGNER_PHASE_VISUAL[block.phaseKey]?.color || PHASE_COLORS[block.phaseKey] || '#666';
                  const isAllowed = allowedSet.has(block.phaseKey);
                  return (
                    <div key={block.id}
                      onClick={() => setEditBlockId(block.id === editBlockId ? null : block.id)}
                      role="button"
                      tabIndex={0}
                      aria-label={`${PHASE_LABELS_RU[block.phaseKey]}: недели ${block.startWeek}-${block.endWeek}`}
                      onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setEditBlockId(block.id === editBlockId ? null : block.id);
                        }
                      }}
                      style={{
                        position: 'absolute', left, top: 6, width, height: 44,
                        borderRadius: 10,
                        background: isAllowed ? color + '22' : 'rgba(239,68,68,0.12)',
                        border: `1.5px solid ${editBlockId === block.id ? accent : (isAllowed ? color + '55' : 'rgba(239,68,68,0.35)')}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0 6px 0 8px', cursor: 'pointer', zIndex: 2,
                        transition: 'border 0.15s, transform 0.12s',
                        boxShadow: editBlockId === block.id ? `0 4px 12px ${color}22` : 'none',
                        overflow: 'hidden',
                      }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: isAllowed ? color : '#ef4444', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {PHASE_ICONS[block.phaseKey]} <span style={{ display: isMobile && width < 80 ? 'none' : 'inline' }}>{PHASE_LABELS_RU[block.phaseKey]}</span><span style={{ display: isMobile && width < 80 ? 'inline' : 'none' }}>{DESIGNER_PHASE_VISUAL[block.phaseKey]?.label.split(' ')[0] ?? block.phaseKey}</span>
                      </span>
                      <div style={{ display: 'flex', gap: 2, alignItems: 'center', flexShrink: 0 }}>
                        <div style={{ fontSize: 10, color: color + 'BB', fontWeight: 700, padding: '2px 6px', borderRadius: 6, background: 'rgba(0,0,0,0.18)' }}>
                          {block.endWeek - block.startWeek + 1}н
                        </div>
                        <button aria-label={`Удалить блок ${PHASE_LABELS_RU[block.phaseKey]}`} onClick={e => { e.stopPropagation(); handleDeleteBlock(block.id); }}
                          style={{ fontSize: 13, padding: 6, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 8, cursor: 'pointer', color: '#ef4444', lineHeight: 1, minWidth: 34, minHeight: 34 }}>
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom week numbers */}
              <div style={{ display: 'flex', gap: 1, marginTop: 54 }}>
                <div style={{ width: 38, flexShrink: 0 }} />
                {Array.from({ length: quarterEnd - quarterStart + 1 }, (_, i) => {
                  const wn = quarterStart + i;
                  return <div key={wn} className="pd-week-cell" style={{ width: isMobile ? 34 : 36 }}>{wn}</div>;
                })}
              </div>

              <div style={{ fontSize: 10, color: DIM, marginTop: 8, textAlign: 'center', lineHeight: 1.4 }}>
                Свайп по таймлайну → квартал · {isMobile ? `показ ${weeksPerQuarter} нед` : `показ ${weeksPerQuarter} нед`} · тап по фазе → тап по неделе — быстрый ввод без drag
              </div>
            </div>
          </div>
          ) : (
          // ── LIST VIEW (mobile friendly) ───────────────────────────────
          <div className="constructor-surface pd-card-mobile" style={{ ...CARD, padding: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#fff', marginBottom: 8 }}>📋 Список блоков — {disciplineLabel} · {current.blocks.length} шт · {current.totalWeeks} нед</div>
            {current.blocks.length === 0 && (
              <div style={{ padding: 16, textAlign: 'center', color: DIM, fontSize: 11, border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 10 }}>Пока пусто — добавьте фазы из палитры выше, выбрав неделю старта</div>
            )}
            <div style={{ display: 'grid', gap: 8 }}>
              {[...current.blocks].sort((a, b) => a.startWeek - b.startWeek).map(block => {
                const color = DESIGNER_PHASE_VISUAL[block.phaseKey]?.color || PHASE_COLORS[block.phaseKey] || '#666';
                const isAllowed = allowedSet.has(block.phaseKey);
                return (
                  <div key={block.id} onClick={() => setEditBlockId(block.id === editBlockId ? null : block.id)} role="button" tabIndex={0}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12,
                      background: isAllowed ? color + '14' : 'rgba(239,68,68,0.08)',
                      border: `1px solid ${editBlockId === block.id ? accent : (isAllowed ? color + '30' : 'rgba(239,68,68,0.25)')}`,
                      cursor: 'pointer',
                    }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, background: color + '22', border: `1px solid ${color}44`, flexShrink: 0 }}>
                      {PHASE_ICONS[block.phaseKey]}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: isAllowed ? color : '#ef4444', lineHeight: 1.2 }}>{PHASE_LABELS_RU[block.phaseKey]}</div>
                      <div style={{ fontSize: 11, color: DIM, marginTop: 2 }}>нед {block.startWeek}–{block.endWeek} · {block.endWeek - block.startWeek + 1} нед {isAllowed ? '' : '⚠ не из ' + disciplineLabel}</div>
                      {block.notes && !block.notes.includes('[OVERLAP') && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{block.notes}</div>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <button aria-label="Удалить" onClick={e => { e.stopPropagation(); handleDeleteBlock(block.id); }} style={{ ...btn, minHeight: 36, color: '#ef4444' }}>✕</button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              <button onClick={() => setViewMode('timeline')} style={{ ...btn, minHeight: 44, flex: 1, background: accent + '14', borderColor: accent + '44', color: accent }}>🗓 Показать таймлайн</button>
            </div>
          </div>
          )}

          {/* Edit block panel */}
          {editBlock && (
            <div className="constructor-surface constructor-surface--accent pd-card-mobile" style={{ ...CARD, border: '1px solid ' + accent + '44', background: accent + '06' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: PHASE_COLORS[editBlock.phaseKey] }}>
                  {PHASE_ICONS[editBlock.phaseKey]} {PHASE_LABELS_RU[editBlock.phaseKey]}
                </span>
                <button onClick={() => setEditBlockId(null)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', cursor: 'pointer', fontSize: 14, width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: DIM, marginBottom: 6, fontWeight: 700 }}>Сменить фазу ({disciplineLabel}):</div>
                <select value={editBlock.phaseKey} onChange={e => handleChangeBlockPhase(editBlock.id, e.target.value as PhaseKey)}
                  style={{ width: '100%', background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 12px', fontSize: 12, minHeight: 44 }}>
                  {allowedKeys.map(pk => {
                    const pkT = pk as PhaseKey;
                    return <option key={pk} value={pk}>{PHASE_ICONS[pkT]} {PHASE_LABELS_RU[pkT]}</option>;
                  })}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                <button onClick={() => handleDuplicateBlock(editBlock.id)} style={{ ...btn, flex: 1, minHeight: 44 }}>📋 Дублировать блок</button>
                <button onClick={() => { handleDeleteBlock(editBlock.id); setEditBlockId(null); }} style={{ ...btn, flex: 1, minHeight: 44, color: '#ef4444', borderColor: 'rgba(239,68,68,0.25)' }}>🗑 Удалить</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, fontSize: 11, marginBottom: 8 }}>
                <div style={{ padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}><div style={{ color: DIM, fontSize: 10 }}>Старт</div><b>нед {editBlock.startWeek}</b></div>
                <div style={{ padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}><div style={{ color: DIM, fontSize: 10 }}>Конец</div><b>нед {editBlock.endWeek}</b></div>
                <div style={{ padding: 8, borderRadius: 8, background: accent + '14', border: '1px solid ' + accent + '22', textAlign: 'center' }}><div style={{ color: DIM, fontSize: 10 }}>Длит.</div><b>{editBlock.endWeek - editBlock.startWeek + 1} нед</b></div>
              </div>
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 11, color: DIM, marginBottom: 6, fontWeight: 700 }}>Длительность (недель):</div>
                <input type="range" min={1} max={Math.min(12, current!.totalWeeks - editBlock.startWeek + 1)} value={editBlock.endWeek - editBlock.startWeek + 1}
                  onChange={e => handleResize(editBlock.id, editBlock.startWeek + parseInt(e.target.value) - 1)}
                  style={{ width: '100%', accentColor: accent }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: DIM, marginTop: 2 }}><span>1</span><span>{Math.min(12, current!.totalWeeks - editBlock.startWeek + 1)}</span></div>
              </div>
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11, color: DIM, marginBottom: 6, fontWeight: 700 }}>Сдвинуть:</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
                  {[-4, -2, -1, 1, 2, 4].map(delta => (
                    <button key={delta} onClick={() => {
                      const newStart = Math.max(1, Math.min(current!.totalWeeks - (editBlock.endWeek - editBlock.startWeek), editBlock.startWeek + delta));
                      handleMoveBlock(editBlock.id, newStart);
                    }}
                      style={{ ...btn, fontSize: 12, padding: '8px 4px', minHeight: 44, fontWeight: 800 }}>
                      {delta > 0 ? '+' : ''}{delta}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11, color: DIM, marginBottom: 6, fontWeight: 700 }}>Заметки:</div>
                <textarea value={editBlock.notes} onChange={e => {
                  const updated = updateBlockNotes(current!, editBlock.id, e.target.value);
                  commitDesign(updated);
                }}
                  placeholder="Цель блока, акценты, RIR, примечания…"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#fff', fontSize: 12, padding: 10, resize: 'vertical', minHeight: 64 }} />
              </div>
            </div>
          )}

          {/* Phase distribution overview */}
          {stats && Object.keys(stats.phaseCount).length > 0 && (
            <div style={CARD} className="pd-card-mobile">
              <div style={{ fontSize: 11, fontWeight: 800, color: '#fff', marginBottom: 8 }}>📊 Распределение — {disciplineLabel}</div>
              {Object.entries(stats.phaseCount).map(([pk]) => {
                const phaseBlocks = current.blocks.filter(b => b.phaseKey === pk);
                const totalWeeks = phaseBlocks.reduce((s, b) => s + (b.endWeek - b.startWeek + 1), 0);
                const pct = stats.totalWeeks > 0 ? Math.round((totalWeeks / stats.totalWeeks) * 100) : 0;
                const color = PHASE_COLORS[pk as PhaseKey] || '#666';
                return (
                  <div key={pk} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: DIM, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700 }}><span style={{ color }}>{PHASE_ICONS[pk as PhaseKey]}</span> {PHASE_LABELS_RU[pk as PhaseKey]}</span>
                      <span style={{ fontWeight: 700, color: '#fff' }}>{totalWeeks} нед ({pct}%)</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 4, width: `${pct}%`, background: color, transition: 'width 0.3s' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Мини-график объёма по неделям */}
          {current.blocks.length > 0 && (
            <div style={CARD} className="pd-card-mobile">
              <div style={{ fontSize: 11, fontWeight: 800, color: '#fff', marginBottom: 6 }}>📈 Нагрузка по неделям · объём (столбик) + интенсивность (точка)</div>
              <div style={{ display: 'flex', alignItems: 'end', gap: 2, height: 64, padding: '6px 4px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', overflowX: 'auto' }}>
                {getDesignVolumeCurve(current).map(pt => (
                  <div key={pt.week} title={`нед ${pt.week}: ${pt.label} · объём ${pt.volume}/5 · интенс ${pt.intensity}/4`} style={{ flex: 1, minWidth: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <div style={{ width: '100%', height: Math.max(6, pt.volume * 10), borderRadius: 4, background: pt.color, opacity: 0.9 }} />
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: pt.intensity >= 3 ? '#f59e0b' : pt.intensity >= 2 ? '#22c55e' : '#6b7280', border: '1px solid rgba(255,255,255,0.2)' }} />
                    <span style={{ fontSize: 8, color: DIM, lineHeight: 1 }}>{pt.week}</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 10, color: DIM, marginTop: 6, lineHeight: 1.4 }}>
                Высота — объём фазы (1=мин, 5=макс) · точка — интенсивность. {effectiveDiscipline === 'pl' ? 'ПЛ: пики выше — интенс 4.' : 'ББ: база выше — объём 4-5, сушка — интенс 3-4.'}
              </div>
            </div>
          )}

          {/* Overlap + gap warnings */}
          {stats && (stats.overlapWeeks > 0 || stats.gapRanges.length > 0) && (
            <div role="alert" aria-live="polite" style={{ ...CARD, borderLeft: '3px solid #ef4444' }} className="pd-card-mobile">
              <div style={{ fontSize: 11, fontWeight: 800, color: '#ef4444', marginBottom: 6 }}>⚠ Проблемы структуры</div>
              {stats.overlapWeeks > 0 && (
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', marginBottom: 6, lineHeight: 1.45 }}>
                  🔴 Перекрытие блоков: {stats.overlapWeeks} нед. Недели с перекрытием получат непредсказуемую фазу при применении.
                  <button onClick={handleResolveOverlaps} style={{ ...btn, marginLeft: 8, color: '#ef4444', borderColor: 'rgba(239,68,68,0.45)', minHeight: 36 }}>
                    Исправить автоматически
                  </button>
                </div>
              )}
              {stats.gapRanges.length > 0 && (
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', lineHeight: 1.45 }}>
                  🟡 Пропуски (недели без блока → accumulation по умолчанию): {stats.gapRanges.join(', ')}
                </div>
              )}
            </div>
          )}
        </>
      )}
      {current && current.blocks.length > 0 && (() => {
        const fb = current.blocks[0];
        const seq = current.blocks.map(b => (PHASE_LABELS_RU[b.phaseKey] || b.phaseKey) + ' ' + b.startWeek + '-' + b.endWeek).join(' · ');
        const pick = (pk: PhaseKey) => {
          if (pk === 'peaking') return { kind: 'peak' as const, data: { volumeMult: 0.6, rirTarget: 0 } };
          if (pk === 'deload') return { kind: 'deload' as const, data: { volumeMult: 0.5, rirShift: 3, weeks: Array.from({ length: fb.endWeek - fb.startWeek + 1 }, (_, i) => fb.startWeek + i) } };
          if (pk === 'intensification') return { kind: 'pri' as const, data: { volumeMult: 0.9, rirShift: -1 } };
          if (pk === 'technique') return { kind: 'pri' as const, data: { volumeMult: 0.8, rirShift: 2 } };
          return { kind: 'pri' as const, data: { volumeMult: 1.15, rirShift: 1 } };
        };
        const r = pick(fb.phaseKey);
        return (
          <div style={{ marginTop: 12, padding: 14, borderRadius: 14, background: accent + '0E', border: '1px solid ' + accent + '22' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: accent, marginBottom: 6 }}>{disciplineIcon} {disciplineLabel} — применение</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginBottom: 10, lineHeight: 1.45 }}>🔗 Применить первый блок «{PHASE_LABELS_RU[fb.phaseKey] || fb.phaseKey}» к планировщику. Полная последовательность: {seq}.</div>
            <button onClick={() => applyToPlanner({ kind: r.kind, label: 'Периодизация: ' + seq, data: r.data })} style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg,${accent},${accent}CC)`, color: '#000', fontWeight: 800, fontSize: 13, minHeight: 48, marginBottom: 10 }}>🛠 Применить первый блок — {disciplineLabel}</button>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginBottom: 6, marginTop: 4, lineHeight: 1.4 }}>📥 Весь дизайн ({current.blocks.length} бл · {current.totalWeeks} нед) в ручной планировщик как новая программа.</div>
            <button
              onClick={async () => {
                const ok = await confirm({
                  title: 'Применить весь дизайн?',
                  message: `Будет создана новая программа (${current.totalWeeks} нед, ${current.blocks.length} блоков) — ${disciplineLabel}. Текущая программа будет заменена.`,
                  confirmLabel: 'Применить',
                  cancelLabel: 'Отмена',
                  danger: false,
                });
                if (!ok) return;
                applyToPlanner({
                  kind: 'design',
                  label: 'Дизайн: ' + current.name + ' (' + current.totalWeeks + ' нед, ' + current.blocks.length + ' блоков)',
                  data: { design: current, fillExercises: false, daysPerWeek: 4 },
                });
              }}
              style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#a78bfa,#7c3aed)', color: '#fff', fontWeight: 800, fontSize: 13, minHeight: 48, marginBottom: 8 }}
            >📥 В новую программу (скелет) — {disciplineIcon}</button>
            <button
              onClick={async () => {
                const ok = await confirm({
                  title: 'Применить дизайн с упражнениями?',
                  message: `Будет создана новая программа с упражнениями (${current.totalWeeks} нед, ${current.blocks.length} блоков) — ${disciplineLabel}. Это может занять несколько секунд.`,
                  confirmLabel: 'Применить',
                  cancelLabel: 'Отмена',
                  danger: false,
                });
                if (!ok) return;
                applyToPlanner({
                  kind: 'design',
                  label: 'Дизайн+упражнения: ' + current.name + ' (' + current.totalWeeks + ' нед)',
                  data: { design: current, fillExercises: true, daysPerWeek: 4 },
                });
              }}
              style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg,${accent},#0ea5e9)`, color: '#fff', fontWeight: 800, fontSize: 13, minHeight: 48 }}
            >🏋️ С упражнениями (autodraft) — {disciplineLabel}</button>
          </div>
        );
      })()}
    </div>
  );
};

export default React.memo(PeriodizationDesignerTab);
