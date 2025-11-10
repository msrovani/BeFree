import { useEffect, useMemo, useState } from 'react';

import { insights } from '../lib/demoData';

export interface JarbasPresence {
  status: 'escutando' | 'respondendo' | 'ocioso';
  mood: 'sereno' | 'vibrante' | 'alerta';
  insights: typeof insights;
  activityLevel: number;
}

export function useJarbasPresence(): JarbasPresence {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 4000);
    return () => clearInterval(timer);
  }, []);

  return useMemo(() => {
    const phase = tick % 3;
    const status: JarbasPresence['status'] = phase === 0 ? 'escutando' : phase === 1 ? 'respondendo' : 'ocioso';
    const mood: JarbasPresence['mood'] = phase === 2 ? 'sereno' : phase === 1 ? 'vibrante' : 'alerta';
    const activityLevel = 0.6 + (phase === 1 ? 0.3 : phase === 2 ? 0.1 : 0);

    return {
      status,
      mood,
      insights,
      activityLevel,
    };
  }, [tick]);
}
