'use client';

import { useMemo } from 'react';

import type { ParticipantProfile } from '../lib/demoData';

export interface ReputationMetrics {
  average: number;
  peak: number;
  floor: number;
  totalParticipants: number;
}

export function useReputationMetrics(participantList: ParticipantProfile[]): ReputationMetrics {
  return useMemo(() => {
    const totalParticipants = participantList.length;
    const scores = participantList.map((participant) => participant.reputation);
    const sum = scores.reduce((acc, value) => acc + value, 0);
    const average = scores.length === 0 ? 0 : Math.round((sum / scores.length) * 10) / 10;
    const peak = scores.length === 0 ? 0 : Math.max(...scores);
    const floor = scores.length === 0 ? 0 : Math.min(...scores);

    return {
      average,
      peak,
      floor,
      totalParticipants,
    };
  }, [participantList]);
}
