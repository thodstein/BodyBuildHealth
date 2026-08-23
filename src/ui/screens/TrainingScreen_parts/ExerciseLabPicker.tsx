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
        onClick={() => setOpen(true)} 
        style={{ 
          flex: 1, 
          minWidth: 0,
          padding: '6px 8px', 
          fontSize: 11, 
          textAlign: 'left', 
          cursor: 'pointer', 
          color: value ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.85)', 
          background: 'rgba(118,118,128,0.12)',
          border: '0.5px solid rgba(255,255,255,0.1)',
          borderRadius: 12,
          minHeight: 38,
          transition: 'all 0.2s'
        }}
      >
        {value || '🧬 Выбрать из лаборатории…'}
      </button>
      
      {open && ReactDOM.createPortal(
        <div 
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
