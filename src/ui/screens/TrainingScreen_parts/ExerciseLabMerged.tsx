/** ExerciseLabMerged.tsx — ПРОФЕССИОНАЛЬНАЯ лаборатория упражнений.
 *  Объединяет: Лабораторию упражнений (6 режимов) + ББ-инструменты (темп/техники/слабые/демография).
 *  Единый инструмент тренера: подбор → техника → сравнение → ПРО-анализ → замена → каталог → ББ-параметры.
 *  
 *  Поддерживает опциональный режим выбора: при передаче onSelectExercise добавляет кнопки выбора
 *  в каталог и автоматически переключается в режим 'catalog'. */
import React, { useState, useCallback, useEffect } from 'react';
import { ACCENT, DIM, LabMode } from './ExerciseLabShared';
import PrescriptionTab from './ExerciseLabPrescription';
import TechniqueTab from './ExerciseLabTechnique';
import CompareTab from './ExerciseLabCompare';
import ProAnalysisTab from './ExerciseLabPro';
import ExerciseLabSubstitute from './ExerciseLabSubstitute';
import ExerciseLabCatalog from './ExerciseLabCatalog';
import { BbToolsCard } from './BbToolsCard';
import type { Exercise } from '../../../core/types';

export type LabProMode = LabMode | 'bb_tools';

const MODE_DEFS: Array<{ m: LabProMode; label: string; icon: string; desc: string; color?: string }> = [
  { m: 'prescription', label: 'Подбор', icon: '📐', desc: 'Подбор упражнений, расчёт нагрузки, 1RM, прогрессия, PRO-анализ группы.' },
  { m: 'technique', label: 'Техника', icon: '🔬', desc: 'Полный разбор техники: биомеханика, подсказки, ошибки, темп, безопасность, регионы.' },
  { m: 'compare', label: 'Сравнение', icon: '⚖️', desc: 'Сравнение двух упражнений бок о бок: техника, нагрузка, рекомендация.' },
  { m: 'pro', label: 'ПРО-анализ', icon: '🔮', desc: 'Force-векторы, stretch-лидеры, покрытие подрегионов, синергетические пары.' },
  { m: 'substitute', label: 'Замена', icon: '🔄', desc: 'Поиск замены упражнения: разрешённые/запрещённые, альтернативы по группе.' },
  { m: 'catalog', label: 'Каталог', icon: '📚', desc: 'Полный каталог ~500 упражнений с фильтрами и детальными карточками.' },
  { m: 'bb_tools', label: 'ББ-инструменты', icon: '💪', desc: 'Темп/отдых по характеру дня, техники интенсификации, слабые группы, демография.', color: '#00e68a' },
];

const ExerciseLabMerged: React.FC<{
  onSelectExercise?: (ex: Exercise) => void;
  onClose?: () => void;
}> = ({ onSelectExercise, onClose }) => {
  const [mode, setMode] = useState<LabProMode>('prescription');
  const [compareIds, setCompareIds] = useState<string[]>([]);

  // При наличии onSelectExercise автоматически переключаемся в режим каталога
  useEffect(() => {
    if (onSelectExercise) {
      setMode('catalog');
    }
  }, [onSelectExercise]);

  const handleSelectForCompare = useCallback((id: string) => {
    setCompareIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  }, []);

  return (
    <div style={{ padding: 12, color: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: ACCENT }}>🧬 Лаборатория упражнений</span>
        <span style={{ fontSize: 10, color: DIM, background: 'rgba(0,230,138,0.1)', padding: '1px 8px', borderRadius: 10, fontWeight: 700 }}>PRO</span>
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
      <div style={{ fontSize: 10, color: DIM, marginBottom: 12 }}>
        Профессиональный инструмент тренера: подбор нагрузки, анализ техники, сравнение, ПРО-анализ, замена упражнений, полный каталог и ББ-инструменты — всё в одном месте.
        {onSelectExercise && ' Выберите упражнение из каталога.'}
      </div>

      {/* Row 1: основные режимы */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        {MODE_DEFS.slice(0, 5).map(({ m, label, icon, desc }) => {
          const active = mode === m;
          return (
            <button key={m} onClick={() => setMode(m)} title={desc}
              style={{
                padding: '7px 14px', borderRadius: 9,
                border: active ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.08)',
                background: active ? 'rgba(0,230,138,0.12)' : 'rgba(0,0,0,0.3)',
                color: active ? ACCENT : DIM, cursor: 'pointer', fontSize: 11, fontWeight: 700,
                transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              {icon} {label}
            </button>
          );
        })}
      </div>
      {/* Row 2: каталог + ББ-инструменты */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {MODE_DEFS.slice(5).map(({ m, label, icon, desc, color }) => {
          const active = mode === m;
          const accent = color || ACCENT;
          return (
            <button key={m} onClick={() => setMode(m)} title={desc}
              style={{
                padding: '7px 14px', borderRadius: 9,
                border: active ? `1px solid ${accent}` : '1px solid rgba(255,255,255,0.08)',
                background: active ? `${accent}14` : 'rgba(0,0,0,0.3)',
                color: active ? accent : DIM, cursor: 'pointer', fontSize: 11, fontWeight: 700,
                transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 5,
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

      {mode === 'prescription' && <PrescriptionTab />}
      {mode === 'technique' && <TechniqueTab onSelectForCompare={handleSelectForCompare} />}
      {mode === 'compare' && <CompareTab initialId1={compareIds[0] || ''} initialId2={compareIds[1] || ''} />}
      {mode === 'pro' && <ProAnalysisTab />}
      {mode === 'substitute' && <ExerciseLabSubstitute />}
      {mode === 'catalog' && <ExerciseLabCatalog onSelectExercise={onSelectExercise} />}
      {mode === 'bb_tools' && <BbToolsCard />}
    </div>
  );
};

export default ExerciseLabMerged;
