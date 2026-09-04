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

  const GLASS: React.CSSProperties = { background: 'rgba(24,24,27,0.42)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(12px)', transition:'all 0.18s ease' } as any;
  const CARD: React.CSSProperties = { ...GLASS, borderRadius: 14, padding: 12, marginBottom: 10, transition:'all 0.18s ease' } as any;
  return (
    <div className="train-exlabmerged" style={{ padding: '10px 8px 18px', color: '#fff', maxWidth: 760, margin: '0 auto' }}>
      <div style={{ ...CARD, padding:'14px 14px 12px', background:'linear-gradient(135deg,rgba(0,230,138,0.10),rgba(96,165,250,0.07))', border:'1px solid rgba(0,230,138,0.18)', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-18, right:-18, width:110, height:110, borderRadius:110, background:'radial-gradient(circle,rgba(0,230,138,0.16),transparent 70%)', pointerEvents:'none' }} />
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
          <div style={{ width:34, height:34, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#00e68a,#00c853)', color:'#000', fontWeight:900, fontSize:16 }}>🧬</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:15, fontWeight:900, color:'#fff', lineHeight:1 }}>Лаборатория упражнений — единый центр</div>
            <div style={{ fontSize:10, color:'#fff', lineHeight:1.3 }}>Подбор → техника → PRO+замена → сравнение. Каталог — быстрый drawer с поиском, избранным и недавними.</div>
          </div>
          <span style={{ fontSize:9, padding:'4px 8px', borderRadius:20, background:'rgba(0,230,138,0.12)', border:'1px solid rgba(0,230,138,0.22)', color:ACCENT, fontWeight:800, whiteSpace:'nowrap' }}>PRO · ЕДИНЫЙ</span>
          {onSelectExercise && (
            <span style={{ fontSize:9, color:'#f59e0b', background:'rgba(245,158,11,0.12)', padding:'4px 8px', borderRadius:20, fontWeight:800, border:'1px solid rgba(245,158,11,0.22)' }}>
              Режим выбора
            </span>
          )}
          {onClose && (
            <button onClick={onClose} style={{ padding:'6px 10px', fontSize:11, borderRadius:8, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.04)', color:'#fff', cursor:'pointer', fontWeight:700 }}>
              ✕ Закрыть
            </button>
          )}
        </div>
        <div style={{ fontSize:10, color:'#fff', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, padding:'8px 10px', lineHeight:1.45 }}>
          <b style={{ color:'#fff' }}>Как работает:</b> <span style={{ color:ACCENT }}>Шаг 1</span> — подбор + блины + тоннаж + 1RM + VBT + ББ-темп/техники внутри, <span style={{ color:'#60a5fa' }}>Шаг 2</span> — разбор техники (биомеханика/подсказки/ошибки), <span style={{ color:'#a78bfa' }}>Шаг 3</span> — force-векторы + замены, <span style={{ color:'#f59e0b' }}>Шаг 4</span> — сравнение. Каталог — drawer с поиском, группами и избранным.
        </div>
      </div>
      {/* Прогресс-линия 4 шагов */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 10 }}>
        {MODE_DEFS.map((d, i) => (
          <div key={d.m} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= stepIndex ? `linear-gradient(90deg, ${ACCENT}, #00c853)` : 'rgba(255,255,255,0.08)', boxShadow: i <= stepIndex ? `0 0 6px ${ACCENT}55` : 'none', transition:'all 0.2s' }} />
        ))}
      </div>

      {/* Единая шапка: выбор упражнения + глобальные действия — удобно, 0-кликов лишних */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', ...CARD }}>
        <button onClick={() => setCatalogOpen(true)} style={{ flex: '0 0 auto', padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(0,230,138,0.30)', background: 'linear-gradient(135deg,rgba(0,230,138,0.14),rgba(0,200,83,0.08))', color: ACCENT, cursor: 'pointer', fontSize: 11, fontWeight: 800, boxShadow:'0 2px 8px rgba(0,230,138,0.15)' }}>
          📚 Каталог {selectedId ? '· выбрано ✓' : '· выбрать'}
        </button>
        {selectedId ? (
          <span style={{ fontSize: 10, color: '#fff', background: 'rgba(0,230,138,0.12)', padding: '6px 10px', borderRadius: 8, border:'1px solid rgba(0,230,138,0.20)', fontWeight:700 }}>✓ {selectedId}</span>
        ) : (
          <span style={{ fontSize: 10, color: '#fff', background: 'rgba(255,255,255,0.04)', padding: '6px 10px', borderRadius: 8, border:'1px solid rgba(255,255,255,0.06)' }}>Выбери упражнение — все расчёты подтянутся</span>
        )}
        <div style={{ flex:1 }} />
        <button onClick={() => setCompareIds(prev => prev.length ? [] : prev)} style={{ padding: '7px 12px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#fff', cursor: 'pointer', fontSize: 10, fontWeight:700 }}>
          ⇆ Сравнение {compareIds.length > 0 ? `· ${compareIds.length}` : ''}
        </button>
      </div>

      {/* 4 шага — sticky, удобно */}
      <div style={{ position:'sticky', top:0, zIndex:5, margin:'-2px -8px 12px', padding:'8px 8px', background:'rgba(10,10,12,0.72)', backdropFilter:'blur(10px)', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', gap:6, overflowX:'auto', scrollbarWidth:'none' }}>
        {MODE_DEFS.map(({ m, label, icon, desc }) => {
          const active = mode === m;
          return (
            <button key={m} onClick={() => setMode(m)} title={desc}
              style={{
                flex:'0 0 auto', padding: '7px 12px', borderRadius: 20,
                border: active ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.08)',
                background: active ? 'rgba(0,230,138,0.14)' : 'rgba(255,255,255,0.04)',
                color: active ? ACCENT : '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, whiteSpace:'nowrap', transition:'all 0.16s',
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
