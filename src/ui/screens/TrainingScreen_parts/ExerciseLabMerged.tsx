/** ExerciseLabMerged.tsx — ЕДИНЫЙ инструмент лаборатории упражнений (без дублей).
 *  4 шага мастера: 1) Подбор (нагрузка + блины + тоннаж + 1RM + VBT + ББ-темп/техники — внутри),
 *  2) Техника (BodyMap + разбор), 3) ПРО+Замена, 4) Сравнение.
 *  Каталог — drawer выбора, а не вкладка. Все вычисления через единый контекст.
 *  
 *  Поддерживает onSelectExercise — режим выбора (drawer). */
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { ACCENT, DIM, LabMode } from './ExerciseLabShared';
import PrescriptionTab from './ExerciseLabPrescription';
import TechniqueTab from './ExerciseLabTechnique';
import CompareTab from './ExerciseLabCompare';
import ProSubstituteTab from './ExerciseLabProSubstitute';
import ExerciseLabCatalog from './ExerciseLabCatalog';
import type { Exercise } from '../../../core/types';

export type LabProMode = LabMode | 'bb_tools' | 'pro_substitute';

const MODE_DEFS: Array<{ m: LabProMode; label: string; icon: string; desc: string; color?: string }> = [
  { m: 'prescription', label: '1 Подбор', icon: '📐', desc: 'Подбор + нагрузка + блины + тоннаж + 1RM + VBT + ББ-темп/техники (внутри). Выбор упражнения → расчёт.' },
  { m: 'technique', label: '2 Техника', icon: '🔬', desc: 'Разбор техники выбранного упражнения: биомеханика, подсказки, ошибки, темп, безопасность.' },
  { m: 'pro_substitute', label: '3 ПРО+Замена', icon: '🔮', desc: 'Force-векторы, stretch-лидеры, покрытие подрегионов, синергия + замены (разрешено/запрещено).' },
  { m: 'compare', label: '4 Сравнение', icon: '⚖️', desc: 'Сравнение двух упражнений бок о бок (если выбраны).' },
];

const ExerciseLabMerged: React.FC<{
  onSelectExercise?: (ex: Exercise) => void;
  onClose?: () => void;
}> = ({ onSelectExercise, onClose }) => {
  const [mode, setMode] = useState<LabProMode>('prescription');
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);

  // При наличии onSelectExercise — открываем drawer каталога (а не вкладку)
  useEffect(() => {
    if (onSelectExercise) {
      setCatalogOpen(true);
    }
  }, [onSelectExercise]);

  const handleSelectForCompare = useCallback((id: string) => {
    setCompareIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  }, []);
  const handleSelectExercise = useCallback((ex: Exercise) => {
    setSelectedId(ex.id);
    setCatalogOpen(false);
    if (onSelectExercise) onSelectExercise(ex);
  }, [onSelectExercise]);

  // Вычисляем шаги для прогресс-линии
  const stepIndex = useMemo(() => MODE_DEFS.findIndex(d => d.m === mode), [mode]);

  return (
    <div style={{ padding: 12, color: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: ACCENT }}>🧬 Лаборатория упражнений</span>
        <span style={{ fontSize: 10, color: DIM, background: 'rgba(0,230,138,0.1)', padding: '1px 8px', borderRadius: 10, fontWeight: 700 }}>PRO · ЕДИНЫЙ</span>
        {onSelectExercise && (
          <span style={{ fontSize: 10, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '1px 8px', borderRadius: 10, fontWeight: 700, marginLeft: 'auto' }}>
            Режим выбора
          </span>
        )}
        {onClose && (
          <button onClick={onClose} style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: 11, borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: DIM, cursor: 'pointer' }}>
            ✕ Закрыть
          </button>
        )}
      </div>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 8 }}>
        Единый инструмент без дублей: подбор + блины + тоннаж + 1RM + VBT + ББ-темп/техники — внутри Шага 1; техника — Шаг 2; ПРО+замена — Шаг 3; сравнение — Шаг 4. Каталог — drawer.
        {onSelectExercise && ' Выберите упражнение из каталога.'}
      </div>
      {/* Прогресс-линия 4 шагов */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
        {MODE_DEFS.map((d, i) => (
          <div key={d.m} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= stepIndex ? ACCENT : 'rgba(255,255,255,0.08)' }} />
        ))}
      </div>

      {/* Единая шапка: выбор упражнения + глобальные действия */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => setCatalogOpen(true)} style={{ flex: '0 0 auto', padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(0,230,138,0.25)', background: 'rgba(0,230,138,0.08)', color: ACCENT, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
          📚 Каталог {selectedId ? '· выбрано' : ''}
        </button>
        {selectedId && <span style={{ fontSize: 10, color: DIM, background: 'rgba(255,255,255,0.04)', padding: '4px 8px', borderRadius: 6 }}>ID: {selectedId}</span>}
        <button onClick={() => setCompareIds(prev => prev.length ? [] : prev)} style={{ marginLeft: 'auto', padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: DIM, cursor: 'pointer', fontSize: 10 }}>
          Сброс сравнения {compareIds.length > 0 ? `(${compareIds.length})` : ''}
        </button>
      </div>

      {/* 4 шага */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {MODE_DEFS.map(({ m, label, icon, desc }) => {
          const active = mode === m;
          return (
            <button key={m} onClick={() => setMode(m)} title={desc}
              style={{
                flex: '1 1 auto', padding: '8px 10px', borderRadius: 10,
                border: active ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.08)',
                background: active ? 'rgba(0,230,138,0.14)' : 'rgba(0,0,0,0.25)',
                color: active ? ACCENT : DIM, cursor: 'pointer', fontSize: 11, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              {icon} {label}
              {m === 'compare' && compareIds.length > 0 && (
                <span style={{ background: ACCENT, color: '#000', borderRadius: 10, fontSize: 10, padding: '1px 6px', fontWeight: 800 }}>{compareIds.length}</span>
              )}
            </button>
          );
        })}
      </div>

      {mode === 'prescription' && <PrescriptionTab selectedId={selectedId} onSelectExercise={handleSelectExercise} />}
      {mode === 'technique' && <TechniqueTab selectedId={selectedId} onSelectForCompare={handleSelectForCompare} />}
      {mode === 'pro_substitute' && <ProSubstituteTab selectedId={selectedId} />}
      {mode === 'compare' && (
        compareIds.length >= 1 || selectedId ? (
          <CompareTab initialId1={compareIds[0] || selectedId || ''} initialId2={compareIds[1] || ''} />
        ) : (
          <div style={{ textAlign: 'center', padding: 20, color: DIM, fontSize: 11, border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 8 }}>
            Выберите упражнения для сравнения: в Шаге 2 нажмите ⇆ или выберите в каталоге. Пока выбрано: {compareIds.length}
          </div>
        )
      )}

      {/* Drawer каталога */}
      {catalogOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '12px 8px', overflowY: 'auto' }}>
          <div style={{ width: '100%', maxWidth: 760, background: '#18181b', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
            <button onClick={() => setCatalogOpen(false)} style={{ position: 'sticky', top: 8, right: 8, float: 'right', margin: 8, padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', color: '#fff', cursor: 'pointer', fontSize: 11, zIndex: 1 }}>✕ Закрыть каталог</button>
            <div style={{ paddingTop: 8 }}>
              <ExerciseLabCatalog onSelectExercise={handleSelectExercise} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExerciseLabMerged;
