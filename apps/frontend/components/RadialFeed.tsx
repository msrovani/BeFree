'use client';

import React from 'react';

import { usePulseLayout } from '../hooks/usePulseLayout';
import type { Pulse } from '../lib/demoData';

import { FeedOrb } from './FeedOrb';

interface RadialFeedProps {
  pulses: Pulse[];
}

export function RadialFeed({ pulses }: RadialFeedProps) {
  const positioned = usePulseLayout(pulses);

  return (
    <section className="radial-feed">
      <div className="radial-feed__halo" />
      <div className="radial-feed__halo halo--outer" />
      <div className="radial-feed__orbs">
        {positioned.map((pulse) => (
          <FeedOrb key={pulse.id} pulse={pulse} />
        ))}
      </div>
    </section>
  );
}
