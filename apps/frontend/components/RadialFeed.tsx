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
      <div className="radial-feed__backdrop" aria-hidden>
        <span className="radial-feed__halo" />
        <span className="radial-feed__halo halo--outer" />
        <span className="radial-feed__grid" />
      </div>
      <div className="radial-feed__orbs">
        {positioned.map((pulse) => (
          <FeedOrb key={pulse.id} pulse={pulse} />
        ))}
      </div>
    </section>
  );
}
