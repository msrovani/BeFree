'use client';

import { useEffect, useMemo, useState } from 'react';

import type { JarbasInsight } from '../lib/demoData';

export interface JarbasPresence {
  status: 'escutando' | 'respondendo' | 'ocioso';
  mood: 'sereno' | 'vibrante' | 'alerta';
  insights: JarbasInsight[];
  activityLevel: number;
}

const STATUS_CYCLE: JarbasPresence['status'][] = ['escutando', 'respondendo', 'ocioso'];

const MOOD_FOR_STATUS: Record<JarbasPresence['status'], JarbasPresence['mood']> = {
  escutando: 'sereno',
  respondendo: 'vibrante',
  ocioso: 'alerta',
};

const ACTIVITY_FOR_STATUS: Record<JarbasPresence['status'], number> = {
  escutando: 0.68,
  respondendo: 0.92,
  ocioso: 0.52,
};

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
    const status = STATUS_CYCLE[tick % STATUS_CYCLE.length];
    const mood = MOOD_FOR_STATUS[status];
    const activityLevel = Number(ACTIVITY_FOR_STATUS[status].toFixed(2));
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
