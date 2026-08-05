/**
 * useBBUndoRedo.ts — hook для undo/redo в BB-auto планировщике.
 *
 * Хранит историю изменений builtPlan (до 20 состояний).
 * Ctrl+Z = undo, Ctrl+Shift+Z / Ctrl+Y = redo.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { BBPlan } from '../../../../engines/bb/bb-builder.engine';

const MAX_HISTORY = 20;

export function useBBUndoRedo(initialPlan: BBPlan | null) {
  const [plan, setPlan] = useState<BBPlan | null>(initialPlan);
  const historyRef = useRef<BBPlan[]>([]);
  const futureRef = useRef<BBPlan[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const updateState = useCallback(() => {
    setCanUndo(historyRef.current.length > 0);
    setCanRedo(futureRef.current.length > 0);
  }, []);

  const pushSnapshot = useCallback((newPlan: BBPlan) => {
    if (plan) {
      historyRef.current.push(plan);
      if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift();
    }
    futureRef.current = [];
    setPlan(newPlan);
    updateState();
  }, [plan, updateState]);

  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    const prev = historyRef.current.pop()!;
    if (plan) futureRef.current.push(plan);
    setPlan(prev);
    updateState();
  }, [plan, updateState]);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    const next = futureRef.current.pop()!;
    if (plan) historyRef.current.push(plan);
    setPlan(next);
    updateState();
  }, [plan, updateState]);

  const reset = useCallback((newPlan: BBPlan | null) => {
    historyRef.current = [];
    futureRef.current = [];
    setPlan(newPlan);
    updateState();
  }, [updateState]);

  // Keyboard shortcuts: Ctrl+Z = undo, Ctrl+Shift+Z / Ctrl+Y = redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  return { plan, pushSnapshot, undo, redo, reset, canUndo, canRedo };
}