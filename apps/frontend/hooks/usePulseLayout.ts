import { useMemo } from 'react';

import type { Pulse } from '../lib/demoData';

export interface PositionedPulse extends Pulse {
  angle: number;
  radius: number;
  orbitIndex: number;
}

const ORBIT_RADII = [120, 190, 260];
const MAX_PER_ORBIT = 8;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function usePulseLayout(pulses: Pulse[]): PositionedPulse[] {
  return useMemo(() => {
    const sorted = [...pulses].sort((a, b) => b.energy - a.energy);
    const positioned: PositionedPulse[] = [];

    sorted.forEach((pulse, index) => {
      const orbitIndex = Math.floor(index / MAX_PER_ORBIT);
      const orbit = ORBIT_RADII[clamp(orbitIndex, 0, ORBIT_RADII.length - 1)];
      const positionWithinOrbit = index % MAX_PER_ORBIT;
      const angle = (positionWithinOrbit / MAX_PER_ORBIT) * 360;

      positioned.push({
        ...pulse,
        angle,
        radius: orbit,
        orbitIndex,
      });
    });

    return positioned;
  }, [pulses]);
}
