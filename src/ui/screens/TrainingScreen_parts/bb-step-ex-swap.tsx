/**
 * bb-step-ex-swap.tsx — модалка замены упражнения ББ-авто («🔄 Замена: …»),
 * вынесена из god-component `BbAutoConstructor.tsx` (§4.3, этап 3). Перенос 1-в-1:
 * логика/тексты/стили не менялись, state-ссылки и a11y-ref переданы явными props.
 */
import React from 'react';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import type { BBPlan } from '../../../engines/bb/bb-builder.engine';

export interface BbExSwapModalProps {
  builtPlan: BBPlan | null;
  exSwapModal: { si: number; ei: number; muscle: string; currentName: string } | null;
  exSwapSearch: string;
  setExSwapSearch: React.Dispatch<React.SetStateAction<string>>;
  /** Ref из useInlineDialogA11y (role=dialog/aria-modal/Escape/фокус). */
  dialogRef: React.RefObject<HTMLDivElement>;
  /** handleReplaceExercise(si, ei, newName) — замена в builtPlan. */
  onReplace: (si: number, ei: number, newName: string) => void;
  /** Закрытие: сброс exSwapModal + exSwapSearch. */
  onClose: () => void;
}

export const BbExSwapModal: React.FC<BbExSwapModalProps> = ({
  builtPlan, exSwapModal, exSwapSearch, setExSwapSearch, dialogRef, onReplace, onClose,
}) => {
  if (!exSwapModal || !builtPlan) return null;
  const filtered = EXERCISE_CATALOG
    .filter(e => (e.group || '') === exSwapModal.muscle)
    .filter(e => e.name.toLowerCase().includes(exSwapSearch.toLowerCase()));
  return (
    <div style={{ position:'fixed', inset:0, zIndex:250, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.85)' }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()} ref={dialogRef} role="dialog" aria-modal="true" aria-label={`Замена упражнения: ${exSwapModal.currentName}`} tabIndex={-1} style={{ width:'88%', maxWidth:400, maxHeight:'78vh', borderRadius:16, background:'#18181b', border:'1px solid rgba(255,255,255,0.1)', overflow:'hidden', outline:'none' }}>
        <div style={{ height:3, background:'linear-gradient(90deg,#00e68a,#00c853)' }} />
        <div style={{ padding:'14px 16px', maxHeight:'calc(78vh - 3px)', overflowY:'auto' }}>
          <div style={{ fontSize:14, fontWeight:700, color:'#00e68a', marginBottom:10 }}>🔄 Замена: {exSwapModal.currentName}</div>
          <input type="text" placeholder="Поиск упражнений..." value={exSwapSearch} autoFocus
            onChange={e => setExSwapSearch(e.target.value)}
            style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(0,0,0,0.3)', color:'#fff', fontSize:13, boxSizing:'border-box', marginBottom:10 }} />
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {filtered.slice(0, 30).map(ex => {
              const isCurrent = ex.name === exSwapModal.currentName;
              return <button key={ex.id} disabled={isCurrent} onClick={() => { onReplace(exSwapModal.si, exSwapModal.ei, ex.name); onClose(); }}
                style={{ display:'block', width:'100%', padding:'8px 10px', borderRadius:10, cursor:isCurrent?'default':'pointer', textAlign:'left', fontSize:11, fontWeight:isCurrent?400:500, background:isCurrent?'rgba(255,255,255,0.02)':'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', color:isCurrent?'#fff':'#fff', opacity:isCurrent?0.5:1 }}>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span>{ex.name}</span>
                  <span style={{ fontSize:11, color:'#fff' }}>{ex.type} · {ex.equipment}</span>
                </div>
                {isCurrent && <div style={{ fontSize:11, color:'#00e68a', marginTop:2 }}>✓ текущее</div>}
              </button>;
            })}
            {filtered.length === 0 && <div style={{ padding:12, textAlign:'center', fontSize:11, color:'#fff' }}>Ничего не найдено</div>}
          </div>
          <button onClick={onClose} style={{ width:'100%', marginTop:10, padding:'10px', borderRadius:10, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer' }}>Закрыть</button>
        </div>
      </div>
    </div>
  );
};
