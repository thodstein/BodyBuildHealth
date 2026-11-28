/**
 * bb-step-ex-swap.tsx — модалка замены упражнения ББ-авто («🔄 Замена: …»),
 * вынесена из god-component `BbAutoConstructor.tsx` (§4.3, этап 3). Перенос 1-в-1:
 * логика/тексты/стили не менялись, state-ссылки и a11y-ref переданы явными props.
 */
import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import { catalogByMuscle } from '../../../engines/bb/bb-catalog-index';
import { strictGroupMembersOf } from '../../../engines/bb/bb-exercise-selection.engine';
import { isBBJunk, type BBPlan } from '../../../engines/bb/bb-builder.engine';
import { isAxialLoadExercise } from '../../../engines/exercise-selector.engine';
import { isMobilityRestricted } from '../../../engines/bb/bb-mobility.engine';
import { isPoolAllowed } from '../../../engines/bb/bb-exercise-levels.engine';

export interface BbExSwapModalProps {
  builtPlan: BBPlan | null;
  exSwapModal: { si: number; ei: number; muscle: string; currentName: string } | null;
  exSwapSearch: string;
  setExSwapSearch: React.Dispatch<React.SetStateAction<string>>;
  /** Ref из useInlineDialogA11y (role=dialog/aria-modal/Escape/фокус). */
  dialogRef: React.RefObject<HTMLDivElement>;
  /** Контекст фильтров безопасности для списка замен. */
  equipment?: string[];
  avoidAxialLoad?: boolean;
  mobilityRestrictions?: string[];
  level?: string;
  excludedExercises?: string[];
  injuredMuscles?: string[];
  /** handleReplaceExercise(si, ei, newName) — замена в builtPlan. */
  onReplace: (si: number, ei: number, newName: string) => void;
  /** Закрытие: сброс exSwapModal + exSwapSearch. */
  onClose: () => void;
}

export const BbExSwapModal: React.FC<BbExSwapModalProps> = ({
  builtPlan, exSwapModal, exSwapSearch, setExSwapSearch, dialogRef,
  equipment, avoidAxialLoad, mobilityRestrictions, level, excludedExercises, injuredMuscles,
  onReplace, onClose,
}) => {
  const [showAllMuscle, setShowAllMuscle] = useState(false);
  if (!exSwapModal || !builtPlan) return null;
  // §4.2: жёсткая группа движка (STRICT_EXERCISE_GROUPS) — однотипные движения меняются
  // только между собой; при желании пользователь может раскрыть весь пул мышцы.
  const curCat = EXERCISE_CATALOG.find(e => e.name === exSwapModal.currentName);
  const strict = strictGroupMembersOf({ id: curCat?.id, name: curCat?.name || exSwapModal.currentName }, exSwapModal.muscle);
  const strictIds = new Set(strict.map(s => s.id));
  const byMusclePool = catalogByMuscle(exSwapModal.muscle);
  const fullMusclePool = byMusclePool.length > 0 ? byMusclePool : EXERCISE_CATALOG.filter(e => (e.group || '') === exSwapModal.muscle);
  const basePool = strictIds.size > 0 && !showAllMuscle ? strict : fullMusclePool;

  const exclSet = new Set((excludedExercises || []).map(x => String(x || '').toLowerCase()));
  const injSet = new Set((injuredMuscles || []).map(x => String(x || '').toLowerCase()));
  const eqList = Array.isArray(equipment) ? equipment : [];

  const isSafeCandidate = (ex: any): boolean => {
    if (!ex || isBBJunk(ex)) return false;
    if (level && !isPoolAllowed(level, ex)) return false;
    if (exclSet.has(String(ex.id || '').toLowerCase()) || exclSet.has(String(ex.name || '').toLowerCase())) return false;
    if (avoidAxialLoad && isAxialLoadExercise(ex)) return false;
    if (mobilityRestrictions?.length && isMobilityRestricted(ex, mobilityRestrictions)) return false;
    if (eqList.length > 0) {
      const exEq = Array.isArray(ex.equipment) ? ex.equipment : [String(ex.equipment || '')];
      if (exEq.length > 0 && !exEq.includes('bodyweight') && !exEq.some((q: string) => eqList.includes(q))) return false;
    }
    return true;
  };

  const q = exSwapSearch.toLowerCase();
  const filtered = basePool
    .filter(e => e.name === exSwapModal.currentName || isSafeCandidate(e))
    .filter(e => e.name.toLowerCase().includes(q));

  const modalNode = (
    <div style={{ position:'fixed', inset:0, zIndex:250, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.85)', paddingBottom:'env(safe-area-inset-bottom, 0px)' }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()} ref={dialogRef} role="dialog" aria-modal="true" aria-label={`Замена упражнения: ${exSwapModal.currentName}`} tabIndex={-1} style={{ width:'88%', maxWidth:400, maxHeight:'78vh', borderRadius:16, background:'var(--card-bg, #18181b)', color:'var(--text, #fff)', border:'1px solid var(--border, rgba(255,255,255,0.1))', overflow:'hidden', outline:'none' }}>
        <div style={{ height:3, background:'linear-gradient(90deg,#00e68a,#00c853)' }} />
        <div style={{ padding:'14px 16px', maxHeight:'calc(78vh - 3px)', overflowY:'auto' }}>
          <div style={{ fontSize:14, fontWeight:700, color:'var(--accent, #00e68a)', marginBottom:10 }}>🔄 Замена: {exSwapModal.currentName}</div>
          {injSet.has(exSwapModal.muscle.toLowerCase()) && (
            <div style={{ fontSize:10, color:'#fbbf24', marginBottom:8, padding:'5px 8px', borderRadius:8, background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)' }}>
              ⚠ Группа в активной травме — оставлены только безопасные варианты.
            </div>
          )}
          {strictIds.size > 0 && (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, marginBottom:8, flexWrap:'wrap' }}>
              <span style={{ fontSize:10, color:'var(--text-dim, rgba(255,255,255,0.8))', flex:1 }}>
                {showAllMuscle
                  ? `Показан весь безопасный пул мышцы (${fullMusclePool.length})`
                  : `💡 Однотипные движения (${strict.length})`}
              </span>
              <button
                type="button"
                data-bb="swap-toggle-all-muscle"
                onClick={() => setShowAllMuscle(v => !v)}
                style={{ padding:'4px 8px', borderRadius:8, fontSize:10, fontWeight:700, cursor:'pointer', border:'1px solid var(--border, rgba(255,255,255,0.18))', background:'var(--surface-subtle, rgba(255,255,255,0.05))', color:'var(--text, #fff)' }}
              >
                {showAllMuscle ? 'Только однотипные' : 'Вся мышца'}
              </button>
            </div>
          )}
          <input type="text" placeholder="Поиск упражнений..." value={exSwapSearch} autoFocus
            onChange={e => setExSwapSearch(e.target.value)}
            style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1px solid var(--border, rgba(255,255,255,0.1))', background:'var(--input-bg, rgba(0,0,0,0.3))', color:'var(--text, #fff)', fontSize:13, boxSizing:'border-box', marginBottom:10 }} />
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {filtered.slice(0, 30).map(ex => {
              const isCurrent = ex.name === exSwapModal.currentName;
              const outOfStrict = showAllMuscle && strictIds.size > 0 && !strictIds.has(ex.id);
              return <button key={ex.id} disabled={isCurrent} onClick={() => { onReplace(exSwapModal.si, exSwapModal.ei, ex.name); onClose(); }}
                style={{ display:'block', width:'100%', padding:'8px 10px', borderRadius:10, minHeight:44, cursor:isCurrent?'default':'pointer', textAlign:'left', fontSize:11, fontWeight:isCurrent?400:500, background:'var(--surface-subtle, rgba(255,255,255,0.03))', border:'1px solid var(--border, rgba(255,255,255,0.08))', color:'var(--text, #fff)', opacity:isCurrent?0.5:1 }}>
                <div style={{ display:'flex', justifyContent:'space-between', gap:6 }}>
                  <span>{ex.name}{outOfStrict ? ' ⚠' : ''}</span>
                  <span style={{ fontSize:10.5, color:'var(--text-dim, rgba(255,255,255,0.75))', flexShrink:0 }}>{ex.type} · {ex.equipment}</span>
                </div>
                {isCurrent && <div style={{ fontSize:10.5, color:'var(--accent, #00e68a)', marginTop:2 }}>✓ текущее</div>}
              </button>;
            })}
            {filtered.length === 0 && <div style={{ padding:12, textAlign:'center', fontSize:11, color:'var(--text-dim, rgba(255,255,255,0.7))' }}>Ничего не найдено</div>}
          </div>
          <button onClick={onClose} style={{ width:'100%', marginTop:10, padding:'10px', minHeight:44, borderRadius:10, border:'1px solid var(--border, rgba(255,255,255,0.1))', background:'transparent', color:'var(--text, #fff)', fontWeight:700, fontSize:12, cursor:'pointer' }}>Закрыть</button>
        </div>
      </div>
    </div>
  );
  return typeof document !== 'undefined' ? ReactDOM.createPortal(modalNode, document.body) : modalNode;
};
