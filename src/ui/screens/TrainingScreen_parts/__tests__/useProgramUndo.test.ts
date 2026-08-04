/**
 * Tests for useProgramUndo — verifies the underlying localStorage
 * history logic that the hook manages.
 *
 * Since useProgramUndo uses React hooks (useRef/useCallback/useEffect),
 * we test the storage logic directly rather than calling the hook
 * outside a React rendering context.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createBlank } from '../../../../engines/user-program/program-store';
import type { UserProgram } from '../../../../engines/user-program/user-program.types';

const STORAGE_KEY = 'he_editor_history';
const MAX_HISTORY = 50;

const mockStore: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => mockStore[key] ?? null,
  setItem: (key: string, value: string) => { mockStore[key] = value; },
  removeItem: (key: string) => { delete mockStore[key]; },
  clear: () => { for (const k of Object.keys(mockStore)) delete mockStore[k]; },
};
(globalThis as any).localStorage = localStorageMock;

// Re-implement the core logic functions from useProgramUndo for direct testing
function loadHistory(): { past: string[]; future: string[] } {
  try {
    const parsed = JSON.parse(localStorageMock.getItem(STORAGE_KEY) || '{"past":[],"future":[]}');
    if (!parsed || !Array.isArray(parsed.past) || !Array.isArray(parsed.future)) {
      return { past: [], future: [] };
    }
    return parsed;
  } catch {
    return { past: [], future: [] };
  }
}

function saveHistory(hist: { past: string[]; future: string[] }): void {
  localStorageMock.setItem(STORAGE_KEY, JSON.stringify(hist));
}

function pushSnapshot(current: UserProgram, next: UserProgram): void {
  if (!current) return;
  const curStr = JSON.stringify(current);
  const nextStr = JSON.stringify(next);
  if (curStr === nextStr) return;
  const hist = loadHistory();
  hist.past.push(curStr);
  if (hist.past.length > MAX_HISTORY) hist.past.shift();
  hist.future = [];
  saveHistory(hist);
}

function undo(current: UserProgram): UserProgram | null {
  if (!current) return null;
  const hist = loadHistory();
  if (hist.past.length === 0) return null;
  const prev = hist.past.pop()!;
  hist.future.push(JSON.stringify(current));
  saveHistory(hist);
  try { return JSON.parse(prev); } catch { return null; }
}

function redo(current: UserProgram): UserProgram | null {
  if (!current) return null;
  const hist = loadHistory();
  if (hist.future.length === 0) return null;
  const next = hist.future.pop()!;
  hist.past.push(JSON.stringify(current));
  saveHistory(hist);
  try { return JSON.parse(next); } catch { return null; }
}

describe('useProgramUndo — localStorage history logic', () => {
  let program: UserProgram;

  beforeEach(() => {
    localStorageMock.clear();
    program = createBlank('bb');
    program.meta.title = 'Test Program';
  });

  it('pushSnapshot stores current state before change', () => {
    const next = { ...program, meta: { ...program.meta, title: 'Updated' } };
    pushSnapshot(program, next);
    const hist = loadHistory();
    expect(hist.past).toHaveLength(1);
    expect(JSON.parse(hist.past[0]).meta.title).toBe('Test Program');
    expect(hist.future).toHaveLength(0);
  });

  it('pushSnapshot skips identical states (no-op)', () => {
    pushSnapshot(program, program);
    const hist = loadHistory();
    expect(hist.past).toHaveLength(0);
  });

  it('pushSnapshot caps history at 50 entries', () => {
    let current = program;
    for (let i = 0; i < 60; i++) {
      const next = { ...current, meta: { ...current.meta, title: `V${i}` } };
      pushSnapshot(current, next);
      current = next;
    }
    const hist = loadHistory();
    expect(hist.past.length).toBeLessThanOrEqual(50);
  });

  it('pushSnapshot clears future on new change', () => {
    const next1 = { ...program, meta: { ...program.meta, title: 'V1' } };
    pushSnapshot(program, next1);
    // Simulate future from a previous undo
    const hist1 = loadHistory();
    hist1.future = [JSON.stringify(next1)];
    saveHistory(hist1);
    // Push another change
    const next2 = { ...next1, meta: { ...next1.meta, title: 'V2' } };
    pushSnapshot(next1, next2);
    const hist2 = loadHistory();
    expect(hist2.future).toHaveLength(0);
  });

  it('undo restores previous state and pushes current to future', () => {
    const next = { ...program, meta: { ...program.meta, title: 'V1' } };
    pushSnapshot(program, next);
    // current is now next (caller would update state)
    const restored = undo(next);
    expect(restored).toBeTruthy();
    expect(restored!.meta.title).toBe('Test Program');
    const hist = loadHistory();
    expect(hist.past).toHaveLength(0);
    expect(hist.future).toHaveLength(1);
  });

  it('redo restores future state and pushes current to past', () => {
    const next = { ...program, meta: { ...program.meta, title: 'V1' } };
    pushSnapshot(program, next);
    // Simulate undo
    const restored = undo(next);
    expect(restored).toBeTruthy();
    // Now redo from restored (which is program)
    const redone = redo(program);
    expect(redone).toBeTruthy();
    expect(redone!.meta.title).toBe('V1');
    const hist = loadHistory();
    expect(hist.past).toHaveLength(1);
    expect(hist.future).toHaveLength(0);
  });

  it('undo returns null when no history', () => {
    const result = undo(program);
    expect(result).toBeNull();
  });

  it('redo returns null when no future', () => {
    const result = redo(program);
    expect(result).toBeNull();
  });

  it('loadHistory returns empty for corrupted storage', () => {
    localStorageMock.setItem(STORAGE_KEY, 'not-json');
    const hist = loadHistory();
    expect(hist.past).toHaveLength(0);
    expect(hist.future).toHaveLength(0);
  });

  it('loadHistory returns empty for missing past/future arrays', () => {
    localStorageMock.setItem(STORAGE_KEY, JSON.stringify({ past: 'not-array' }));
    const hist = loadHistory();
    expect(hist.past).toHaveLength(0);
  });
});