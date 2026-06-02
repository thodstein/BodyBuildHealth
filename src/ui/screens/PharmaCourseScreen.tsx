import React, { useEffect, useRef } from 'react';
import { renderPharmaModule } from '../pharma-course';

export const PharmaCourseScreen: React.FC = () => {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    renderPharmaModule(hostRef.current);
  }, []);

  return <div className="screen pharma-course" ref={hostRef} />;
};

