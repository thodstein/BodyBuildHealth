/**
 * ExerciseLabPicker.tsx — выбор упражнения через полную "Лабораторию упражнений".
 * Открывает модальное окно с ExerciseLabMerged (все 7 режимов).
 * При выборе упражнения вызывает onSelect с каноническим упражнением.
 */
import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import ExerciseLabMerged from './ExerciseLabMerged';
import type { Exercise } from '../../../core/types';

export const ExerciseLabPicker: React.FC<{
  value: string;
  muscle: string;
  equipment?: string[];
  onSelect: (ex: Exercise) => void;
}> = ({ value, muscle, equipment = [], onSelect }) => {
  const [open, setOpen] = useState(false);

  const handleSelect = (ex: Exercise) => {
    onSelect(ex);
    setOpen(false);
  };

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        className="train-exlabpicker"
        onClick={() => setOpen(true)}
        style={{
          flex: '1 1 160px',
          minWidth: 140,
          maxWidth: '100%',
          padding: '8px 10px',
          fontSize: 11,
          fontWeight: 700,
          textAlign: 'left',
          cursor: 'pointer',
          color: value ? '#fff' : 'rgba(255,255,255,0.85)',
          background: value ? 'rgba(0,230,138,0.10)' : 'rgba(118,118,128,0.12)',
          border: value ? '1px solid rgba(0,230,138,0.30)' : '0.5px solid rgba(255,255,255,0.10)',
          borderRadius: 12,
          minHeight: 44,
          transition: 'all 0.2s',
          whiteSpace: 'normal',
          wordBreak: 'normal',
          overflowWrap: 'anywhere',
          lineHeight: 1.3,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'normal', whiteSpace: 'normal' }}>{value || '🧬 Выбрать из лаборатории…'}</span>
      </button>
      
      {open && ReactDOM.createPortal(
        <div 
          className="train-exlabpicker-modal"
          style={{ 
            position: 'fixed', 
            inset: 0, 
            zIndex: 10000, 
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 12
          }}
        >
          <div 
            style={{ 
              background: '#18181b', 
              borderRadius: 16, 
              border: '1px solid rgba(255,255,255,0.1)',
              maxWidth: 900, 
              width: '100%', 
              maxHeight: '90vh', 
              overflow: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.8)'
            }}
          >
            <ExerciseLabMerged 
              onSelectExercise={handleSelect}
              onClose={handleClose}
            />
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
