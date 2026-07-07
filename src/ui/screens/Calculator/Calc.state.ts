import { useState, useEffect, useCallback } from 'react';
import type { PowerLevel } from '../../../engines/support-plan';

export type SupportLevel = 'basic' | 'mid' | 'max' | 'boost';

export interface CalculatorStateHook {
  boostEnabled: boolean;
  setBoostEnabled: (v: boolean) => void;
  jointMode: boolean;
  setJointMode: (v: boolean) => void;
  reproMode: boolean;
  setReproMode: (v: boolean) => void;
  neuroMode: boolean;
  setNeuroMode: (v: boolean) => void;
  autoLevel: SupportLevel;
  setAutoLevel: (v: SupportLevel) => void;
  manualLevelSelected: boolean;
  setManualLevelSelected: (v: boolean) => void;
  supportLevel: SupportLevel;
  setSupportLevel: (v: SupportLevel | PowerLevel) => void;
  toggleBoost: () => void;
  toggleJoint: () => void;
  toggleRepro: () => void;
  toggleNeuro: () => void;
}

export function useCalculatorState(
  initialLevel: SupportLevel = 'mid',
  autoLevelLogic?: (sl: SupportLevel) => SupportLevel
): CalculatorStateHook {
  const [boostEnabled, setBoostEnabled] = useState(false);
  const [jointMode, setJointMode] = useState(false);
  const [reproMode, setReproMode] = useState(false);
  const [neuroMode, setNeuroMode] = useState(false);
  const [autoLevel, setAutoLevel] = useState<SupportLevel>('mid');
  const [manualLevelSelected, setManualLevelSelected] = useState(false);
  const [supportLevel, setSupportLevelState] = useState<SupportLevel>(initialLevel);

  const setSupportLevel = useCallback((v: SupportLevel | PowerLevel) => {
    setSupportLevelState(v as SupportLevel);
  }, []);

  useEffect(() => {
    if (autoLevelLogic && !manualLevelSelected) {
      const newLevel = autoLevelLogic(supportLevel);
      if (newLevel !== autoLevel) {
        setAutoLevel(newLevel);
        setSupportLevelState(newLevel);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLevelLogic, manualLevelSelected, supportLevel]);

  const toggleBoost = useCallback(() => setBoostEnabled(v => !v), []);
  const toggleJoint = useCallback(() => setJointMode(v => !v), []);
  const toggleRepro = useCallback(() => setReproMode(v => !v), []);
  const toggleNeuro = useCallback(() => setNeuroMode(v => !v), []);

  return {
    boostEnabled, setBoostEnabled,
    jointMode, setJointMode,
    reproMode, setReproMode,
    neuroMode, setNeuroMode,
    autoLevel, setAutoLevel,
    manualLevelSelected, setManualLevelSelected,
    supportLevel, setSupportLevel,
    toggleBoost, toggleJoint, toggleRepro, toggleNeuro,
  };
}