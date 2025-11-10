'use client';

import { useEffect, useMemo, useState } from 'react';

import type { JarbasInsight } from '../lib/demoData';

export interface JarbasPresence {
  status: 'escutando' | 'respondendo' | 'ocioso';
  mood: 'sereno' | 'vibrante' | 'alerta';
  insights: JarbasInsight[];
  activityLevel: number;
}

export function useJarbasPresence(initialInsights: JarbasInsight[]): JarbasPresence {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 4000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setTick(0);
  }, [initialInsights]);

  return useMemo(() => {
    const phase = tick % 3;
    const status: JarbasPresence['status'] = phase === 0 ? 'escutando' : phase === 1 ? 'respondendo' : 'ocioso';
    const mood: JarbasPresence['mood'] = phase === 2 ? 'sereno' : phase === 1 ? 'vibrante' : 'alerta';
    const activityLevel = Number((0.6 + (phase === 1 ? 0.3 : phase === 2 ? 0.1 : 0)).toFixed(2));
    const rotated =
      initialInsights.length === 0
        ? []
        : initialInsights.map((_, index) => initialInsights[(index + tick) % initialInsights.length]!);

    return {
      status,
      mood,
      insights: rotated,
      activityLevel,
    };
  }, [tick, initialInsights]);
}
