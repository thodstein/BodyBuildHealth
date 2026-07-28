/**
 * editor-panels/shared.ts — общие типы и хелперы для editor-панелей.
 * F4.6: вынесено из ProgramEditorPanels.tsx для разделения на 4 файла.
 */
import type { UserProgram } from '../../../../engines/user-program/user-program.types';

export interface PanelProps {
  program: UserProgram;
  dir: string;
  onChange: (p: UserProgram) => void;
  showToast: (m: string) => void;
  labMrvMult: number;
}

export const PHASE_LABELS: Record<string, string> = {
  accumulation: 'Накопление',
  intensification: 'Интенсификация',
  deload: 'Разгрузка',
  peaking: 'Пик',
};
