import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  type MacrocycleDesign,
  type DesignerPhaseBlock,
  type PhaseKey,
  PHASE_COLORS,
  PHASE_ICONS,
  PHASE_LABELS_RU,
  createEmptyDesign,
  loadDesigns,
  saveDesign,
  deleteDesign,
  addBlockToDesign,
  removeBlockFromDesign,
  moveBlockInDesign,
  resizeBlockInDesign,
  updateBlockNotes,
  getDesignStats,
  getDefaultPresetDesigns,
} from '../../../engines/periodization-designer.engine';
import { applyToPlanner } from './planner-bridge';

const ACCENT = '#00e68a';
const DIM = 'rgba(255,255,255,0.5)';
const CARD: React.CSSProperties = { padding: 14, borderRadius: 12, background: 'rgba(24,24,27,0.4)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 12 };

const btn: React.CSSProperties = { padding: '6px 12px', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#fff' };

export const PeriodizationDesignerTab: React.FC = () => {
  const [designs, setDesigns] = useState<MacrocycleDesign[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [editBlockId, setEditBlockId] = useState<string | null>(null);
  const [dragPhase, setDragPhase] = useState<PhaseKey | null>(null);
  const [viewQuarter, setViewQuarter] = useState(0); // 0-3 for 52-week view

  useEffect(() => {
    const list = loadDesigns();
    setDesigns(list);
    if (list.length > 0 && !currentId) setCurrentId(list[0].id);
  }, []);

  const current = useMemo(() => designs.find(d => d.id === currentId) || null, [designs, currentId]);

  const refresh = useCallback(() => {
    const list = loadDesigns();
    setDesigns(list);
  }, []);

  const stats = useMemo(() => current ? getDesignStats(current) : null, [current]);

  // Resize helpers
  const handleResize = useCallback((blockId: string, newEnd: number) => {
    if (!current) return;
    const updated = resizeBlockInDesign(current, blockId, newEnd);
    saveDesign(updated);
    refresh();
  }, [current, refresh]);

  const handleDeleteBlock = useCallback((blockId: string) => {
    if (!current) return;
    const updated = removeBlockFromDesign(current, blockId);
    saveDesign(updated);
    refresh();
  }, [current, refresh]);

  const handleMoveBlock = useCallback((blockId: string, newStart: number) => {
    if (!current) return;
    const updated = moveBlockInDesign(current, blockId, newStart);
    saveDesign(updated);
    refresh();
  }, [current, refresh]);

  const handleDropOnCanvas = useCallback((weekNum: number, phaseKey: PhaseKey) => {
    if (!current) return;
    const updated = addBlockToDesign(current, phaseKey, weekNum);
    saveDesign(updated);
    refresh();
    setDragPhase(null);
  }, [current, refresh]);

  const handleAddPreset = useCallback((preset: MacrocycleDesign) => {
    saveDesign(preset);
    refresh();
    setCurrentId(preset.id);
  }, [refresh]);

  const handleNewDesign = useCallback(() => {
    const d = createEmptyDesign();
    saveDesign(d);
    refresh();
    setCurrentId(d.id);
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
    saveDesign(updated);
    refresh();
  }, [current, refresh]);

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

  const editBlock = useMemo(() => {
    if (!editBlockId || !current) return null;
    return current.blocks.find(b => b.id === editBlockId) || null;
  }, [editBlockId, current]);

  // Viewport for the timeline
  const weeksPerQuarter = 13;
  const quarterStart = viewQuarter * weeksPerQuarter + 1;
  const quarterEnd = Math.min(quarterStart + weeksPerQuarter - 1, current?.totalWeeks || 52);

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 12, color: '#fff' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: ACCENT }}>🎨 Дизайнер периодизации</span>
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <button onClick={handleNewDesign} style={btn}>➕ Новый</button>
          <select value={currentId || ''} onChange={e => setCurrentId(e.target.value || null)} style={{ ...btn, padding: '6px 8px', background: 'rgba(24,24,27,0.6)', fontSize: 9 }}>
            <option value="">— выберите дизайн —</option>
            {designs.map(d => <option key={d.id} value={d.id}>{d.name} ({d.blocks.length} блоков)</option>)}
          </select>
          {current && <button onClick={handleDeleteDesign} style={{ ...btn, color: '#ef4444' }}>🗑</button>}
        </div>
      </div>

      {!current && (
        <div style={CARD}>
          <div style={{ fontSize: 12, color: DIM, marginBottom: 10, textAlign: 'center' }}>Создайте новый дизайн или загрузите пресет</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={handleNewDesign} style={{ ...btn, background: 'rgba(0,230,138,0.1)', borderColor: ACCENT, color: ACCENT }}>➕ Создать пустой</button>
            {getDefaultPresetDesigns().map((p, i) => (
              <button key={i} onClick={() => handleAddPreset(p)} style={{ ...btn, background: 'rgba(59,130,246,0.08)', borderColor: 'rgba(59,130,246,0.3)', color: '#3b82f6' }}>
                📋 {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {current && (
        <>
          {/* Design info */}
          <div style={CARD}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <input value={current.name} onChange={e => handleSaveName(e.target.value)}
                style={{ background: 'transparent', border: 'none', borderBottom: '1px dashed rgba(255,255,255,0.2)', color: '#fff', fontSize: 14, fontWeight: 700, width: '60%', outline: 'none' }} />
              <span style={{ fontSize: 10, color: DIM }}>{current.totalWeeks} нед · {current.blocks.length} блоков</span>
            </div>
            {stats && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 10, color: DIM }}>
                <span>📊 Занято: <b style={{ color: ACCENT }}>{stats.usedWeeks}</b> нед</span>
                <span>🆓 Свободно: <b style={{ color: '#3b82f6' }}>{stats.freeWeeks}</b> нед</span>
                <span>📦 Блоков: <b>{stats.blockCount}</b></span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button onClick={handleDuplicate} style={{ ...btn, fontSize: 9 }}>📋 Дублировать</button>
            </div>
          </div>

          {/* Palette — draggable phase blocks */}
          <div style={CARD}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 6 }}>🎨 Палитра блоков (перетащите на таймлайн)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {(Object.keys(PHASE_COLORS) as PhaseKey[]).map(pk => (
                <div key={pk}
                  draggable
                  onDragStart={() => setDragPhase(pk)}
                  style={{
                    padding: '4px 10px', borderRadius: 8, fontSize: 9, fontWeight: 600, cursor: 'grab',
                    background: PHASE_COLORS[pk] + '22', border: '1px solid ' + PHASE_COLORS[pk] + '55',
                    color: PHASE_COLORS[pk], display: 'flex', alignItems: 'center', gap: 4,
                    transition: 'transform 0.1s', userSelect: 'none',
                  }}>
                  <span>{PHASE_ICONS[pk]}</span>
                  <span>{PHASE_LABELS_RU[pk]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline canvas */}
          <div style={{ ...CARD, padding: 0, overflowX: 'auto' }}>
            <div style={{ minWidth: 500, padding: 12 }}>
              {/* Quarter nav */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <button onClick={() => setViewQuarter(Math.max(0, viewQuarter - 1))} disabled={viewQuarter === 0} style={{ ...btn, opacity: viewQuarter === 0 ? 0.3 : 1 }}>◀</button>
                <span style={{ fontSize: 11, fontWeight: 700, color: ACCENT }}>Недели {quarterStart}–{quarterEnd}</span>
                <button onClick={() => setViewQuarter(Math.min(3, viewQuarter + 1))} disabled={quarterEnd >= (current?.totalWeeks || 52)} style={{ ...btn, opacity: quarterEnd >= (current?.totalWeeks || 52) ? 0.3 : 1 }}>▶</button>
              </div>

              {/* Week column headers */}
              <div style={{ display: 'flex', gap: 1, marginBottom: 2 }}>
                <div style={{ width: 44, flexShrink: 0 }} />
                {Array.from({ length: quarterEnd - quarterStart + 1 }, (_, i) => {
                  const wn = quarterStart + i;
                  return <div key={wn} style={{ width: 32, flexShrink: 0, textAlign: 'center', fontSize: 7, color: DIM }}>{wn}</div>;
                })}
              </div>

              {/* Block rows */}
              {current.blocks.filter(b => b.startWeek <= quarterEnd && b.endWeek >= quarterStart).length === 0 && (
                <div style={{ padding: 20, textAlign: 'center', color: DIM, fontSize: 10, border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 8, marginTop: 4 }}>
                  Перетащите блоки из палитры на таймлайн
                </div>
              )}

              <div style={{ position: 'relative', minHeight: 60 }}>
                {/* Drop zone indicators */}
                {Array.from({ length: quarterEnd - quarterStart + 1 }, (_, i) => {
                  const wn = quarterStart + i;
                  return (
                    <div key={wn}
                      onDragOver={e => { e.preventDefault(); }}
                      onDrop={e => { e.preventDefault(); if (dragPhase) { handleDropOnCanvas(wn, dragPhase); } }}
                      style={{
                        position: 'absolute', left: 44 + i * 33, top: 0, width: 33, height: '100%',
                        background: dragPhase ? 'rgba(255,255,255,0.03)' : 'transparent',
                        borderLeft: '1px dashed rgba(255,255,255,0.04)',
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
                  const left = (visStart - quarterStart) * 33 + 44;
                  const width = (visEnd - visStart + 1) * 33 - 2;
                  const color = PHASE_COLORS[block.phaseKey] || '#666';
                  return (
                    <div key={block.id}
                      onClick={() => setEditBlockId(block.id === editBlockId ? null : block.id)}
                      style={{
                        position: 'absolute', left, top: 4, width, height: 36,
                        borderRadius: 6,
                        background: color + '28',
                        border: `1px solid ${editBlockId === block.id ? ACCENT : color + '44'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0 6px', cursor: 'pointer', zIndex: 2,
                        transition: 'border 0.15s',
                      }}>
                      <span style={{ fontSize: 8, fontWeight: 600, color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {PHASE_ICONS[block.phaseKey]} {PHASE_LABELS_RU[block.phaseKey].slice(0, 14)}
                      </span>
                      <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                        {/* Resize handle (drag right edge) */}
                        <div style={{ fontSize: 7, color: color + '99' }}>
                          {block.endWeek - block.startWeek + 1}н
                        </div>
                        <button onClick={e => { e.stopPropagation(); handleDeleteBlock(block.id); }}
                          style={{ fontSize: 8, padding: '0 4px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', lineHeight: 1 }}>
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom week numbers */}
              <div style={{ display: 'flex', gap: 1, marginTop: 44 }}>
                <div style={{ width: 44, flexShrink: 0 }} />
                {Array.from({ length: quarterEnd - quarterStart + 1 }, (_, i) => {
                  const wn = quarterStart + i;
                  return <div key={wn} style={{ width: 32, flexShrink: 0, textAlign: 'center', fontSize: 7, color: DIM }}>{wn}</div>;
                })}
              </div>
            </div>
          </div>

          {/* Edit block panel */}
          {editBlock && (
            <div style={{ ...CARD, border: '1px solid ' + ACCENT + '44' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: PHASE_COLORS[editBlock.phaseKey] }}>
                  {PHASE_ICONS[editBlock.phaseKey]} {PHASE_LABELS_RU[editBlock.phaseKey]}
                </span>
                <button onClick={() => setEditBlockId(null)} style={{ background: 'transparent', border: 'none', color: DIM, cursor: 'pointer', fontSize: 14 }}>✕</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 10 }}>
                <div><span style={{ color: DIM }}>Старт:</span> <b>нед {editBlock.startWeek}</b></div>
                <div><span style={{ color: DIM }}>Конец:</span> <b>нед {editBlock.endWeek}</b></div>
                <div><span style={{ color: DIM }}>Длительность:</span> <b>{editBlock.endWeek - editBlock.startWeek + 1} нед</b></div>
              </div>
              <div style={{ marginTop: 6 }}>
                <div style={{ fontSize: 9, color: DIM, marginBottom: 2 }}>Длительность (недель):</div>
                <input type="range" min={1} max={12} value={editBlock.endWeek - editBlock.startWeek + 1}
                  onChange={e => handleResize(editBlock.id, editBlock.startWeek + parseInt(e.target.value) - 1)}
                  style={{ width: '100%' }} />
              </div>
              <div style={{ marginTop: 6 }}>
                <div style={{ fontSize: 9, color: DIM, marginBottom: 2 }}>Сдвинуть на (недель):</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[-4, -2, -1, 1, 2, 4].map(delta => (
                    <button key={delta} onClick={() => {
                      const newStart = Math.max(1, Math.min(current!.totalWeeks - (editBlock.endWeek - editBlock.startWeek), editBlock.startWeek + delta));
                      handleMoveBlock(editBlock.id, newStart);
                    }}
                      style={{ ...btn, fontSize: 9, padding: '4px 8px' }}>
                      {delta > 0 ? '+' : ''}{delta}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ marginTop: 6 }}>
                <div style={{ fontSize: 9, color: DIM, marginBottom: 2 }}>Заметки:</div>
                <textarea value={editBlock.notes} onChange={e => {
                  const updated = updateBlockNotes(current!, editBlock.id, e.target.value);
                  saveDesign(updated);
                  refresh();
                }}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, color: '#fff', fontSize: 10, padding: 6, resize: 'vertical', minHeight: 40 }} />
              </div>
            </div>
          )}

          {/* Phase distribution overview */}
          {stats && Object.keys(stats.phaseCount).length > 0 && (
            <div style={CARD}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 6 }}>📊 Распределение фаз</div>
              {Object.entries(stats.phaseCount).map(([pk, count]) => {
                const phaseBlocks = current.blocks.filter(b => b.phaseKey === pk);
                const totalWeeks = phaseBlocks.reduce((s, b) => s + (b.endWeek - b.startWeek + 1), 0);
                const pct = stats.totalWeeks > 0 ? Math.round((totalWeeks / stats.totalWeeks) * 100) : 0;
                return (
                  <div key={pk} style={{ marginBottom: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: DIM, marginBottom: 2 }}>
                      <span><span style={{ color: PHASE_COLORS[pk as PhaseKey] }}>{PHASE_ICONS[pk as PhaseKey]}</span> {PHASE_LABELS_RU[pk as PhaseKey]}</span>
                      <span>{totalWeeks} нед ({pct}%)</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 2, width: `${pct}%`, background: PHASE_COLORS[pk as PhaseKey], transition: 'width 0.3s' }} />
                    </div>
                  </div>
                );
              })}
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
          <div style={{ marginTop: 8, padding: 12, borderRadius: 12, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginBottom: 8 }}>🔗 Применить первый блок «{PHASE_LABELS_RU[fb.phaseKey] || fb.phaseKey}» к планировщику. Полная последовательность: {seq}.</div>
            <button onClick={() => applyToPlanner({ kind: r.kind, label: 'Периодизация: ' + seq, data: r.data })} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 13, minHeight: 44 }}>🛠 Применить периодизацию к планировщику</button>
          </div>
        );
      })()}
    </div>
  );
};

export default React.memo(PeriodizationDesignerTab);
