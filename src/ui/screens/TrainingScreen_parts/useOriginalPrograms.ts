import { useEffect, useState } from 'react';
import { loadOriginalPrograms } from '../../../engines/original-program-parser';
import { ORIGINAL_PROGRAM_FILES, ORIGINAL_PROGRAMS } from './programs-data';
import type { FullProgram } from '../../../engines/complete-program-library.engine';

export function useOriginalPrograms(): FullProgram[] {
  const [programs, setPrograms] = useState<FullProgram[]>(ORIGINAL_PROGRAMS as FullProgram[]);
  useEffect(() => {
    let active = true;
    loadOriginalPrograms(ORIGINAL_PROGRAM_FILES).then(loaded => {
      if (!active) return;
      setPrograms(loaded);
    }).catch(() => { /* Keep the metadata fallback if the text files are unavailable. */ });
    return () => { active = false; };
  }, []);
  return programs;
}
